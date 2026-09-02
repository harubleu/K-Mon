import { useState, useMemo } from 'react';
import {
  MANA_MASTER_LIST,
  MONSTER_MASTER_LIST,
  type MonsterMasterDefinition,
} from '../data/masterData';
import { MONSTER_EFFECTS } from '../data/monsterEffects';
import type { ManaCard, MonsterCard, PresetDeck } from '../types';

export const useDeckBuilder = () => {
  const [recipe, setRecipe] = useState<{
    monsterIds: string[];
    manaCounts: Record<string, number>;
  }>({
    monsterIds: [],
    manaCounts: {},
  });

  const totalManaCount = useMemo(() => {
    return Object.values(recipe.manaCounts).reduce(
      (acc, count) => acc + count,
      0,
    );
  }, [recipe.manaCounts]);

  const toggleMonster = (monsterId: string) => {
    setRecipe((prev) => {
      const isSelected = prev.monsterIds.includes(monsterId);
      if (isSelected) {
        return {
          ...prev,
          monsterIds: prev.monsterIds.filter((id) => id !== monsterId),
        };
      } else {
        if (prev.monsterIds.length >= 3) return prev;
        return { ...prev, monsterIds: [...prev.monsterIds, monsterId] };
      }
    });
  };

  const updateManaCount = (kanji: string, delta: number) => {
    setRecipe((prev) => {
      const current = prev.manaCounts[kanji] || 0;
      const next = Math.max(0, current + delta);
      // 上限20枚のチェック
      const currentTotal = Object.values(prev.manaCounts).reduce(
        (a, b) => a + b,
        0,
      );
      if (delta > 0 && currentTotal >= 20) return prev;

      return {
        ...prev,
        manaCounts: { ...prev.manaCounts, [kanji]: next },
      };
    });
  };

  // オートバランス（ラウンドロビン方式）
  const autoFillMana = () => {
    if (recipe.monsterIds.length === 0) return;

    // 選択された順にモンスターを取得
    const selectedMonsters = recipe.monsterIds
      .map((id) => MONSTER_MASTER_LIST.find((m) => m.id === id))
      .filter((m): m is MonsterMasterDefinition => m !== undefined);

    // 必要スロットを順番に平坦化して配列化
    const requiredSlots: string[] = [];
    selectedMonsters.forEach((monster) => {
      monster.slots.forEach((slot) => {
        requiredSlots.push(slot);
      });
    });

    if (requiredSlots.length === 0) return;

    // 20枚になるまで順番に配分
    const newManaCounts: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const targetKanji = requiredSlots[i % requiredSlots.length];
      newManaCounts[targetKanji] = (newManaCounts[targetKanji] || 0) + 1;
    }

    setRecipe((prev) => ({ ...prev, manaCounts: newManaCounts }));
  };

  const loadPreset = (preset: PresetDeck) => {
    setRecipe({
      monsterIds: preset.monsterIds,
      manaCounts: preset.manaCounts,
    });
  };

  const clearDeck = () => {
    setRecipe({ monsterIds: [], manaCounts: {} });
  };

  const generateGameCards = (): {
    monsters: MonsterCard[];
    deck: ManaCard[];
  } => {
    const monsters: MonsterCard[] = recipe.monsterIds.map((id) => {
      const master = MONSTER_MASTER_LIST.find((m) => m.id === id)!;
      const effectData = MONSTER_EFFECTS[master.id]; // 追加
      return {
        id: `${master.id}_${Date.now()}`,
        name: master.name,
        slots: master.slots,
        slotPositions: master.slotPositions,
        equippedMana: [],
        isFlipped: false,
        imageUrl: master.imageUrl,
        flippedImageUrl: master.flippedImageUrl,
        effect: effectData?.effect, // 追加
        passiveEffect: effectData?.passiveEffect, // 追加
      };
    });

    const deck: ManaCard[] = [];
    // 【削除】let manaIdCounter = 1; ← 連番方式だとplayer/opponent間でIDが衝突するため廃止
    Object.entries(recipe.manaCounts).forEach(([kanji, count]) => {
      const master = MANA_MASTER_LIST.find((m) => m.kanji === kanji);
      if (master) {
        for (let i = 0; i < count; i++) {
          deck.push({
            // 【修正】player/opponentどちらのuseDeckBuilderインスタンスから生成しても
            // 絶対に衝突しないよう、ブラウザ標準のcrypto.randomUUID()で一意なIDを生成する。
            // クロスプレイヤー移動機能により、両陣営のカードが同一配列に混在し得るようになったため必須の変更。
            id: `mana_${master.kanji}_${crypto.randomUUID()}`,
            hexColor: master.hexColor,
            kanji: master.kanji,
            reading: master.reading,
          });
        }
      }
    });

    // 初期シャッフル
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return { monsters, deck };
  };

  // 【追加】選択中モンスターのみをクリア
  const clearMonsters = () => {
    setRecipe((prev) => ({ ...prev, monsterIds: [] }));
  };

  // 【追加】選択中マナのみをクリア
  const clearMana = () => {
    setRecipe((prev) => ({ ...prev, manaCounts: {} }));
  };

  // 【追加】選択中モンスターの並び順を直接差し替える（D&D・矢印クリック両方から呼ばれる）
  const reorderMonsters = (newOrder: string[]) => {
    setRecipe((prev) => ({ ...prev, monsterIds: newOrder }));
  };

  return {
    recipe,
    manaCounts: recipe.manaCounts,
    totalManaCount,
    toggleMonster,
    updateManaCount,
    autoFillMana,
    loadPreset,
    generateGameCards,
    clearDeck,
    clearMonsters,
    clearMana,
    reorderMonsters,
  };
};
