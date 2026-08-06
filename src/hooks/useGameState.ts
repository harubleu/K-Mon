// src/hooks/useGameState.ts
import { useReducer } from 'react';
import type { GameState, GameAction, ManaCard } from '../types';

// テスト用ダミー初期状態
const initialState: GameState = {
  player: {
    deck: [
      { id: 'p-m1', color: 'red' },
      { id: 'p-m2', color: 'blue' },
      { id: 'p-m3', color: 'yellow' },
      { id: 'p-m4', color: 'green' },
      { id: 'p-m5', color: 'white' },
    ],
    cemetery: [
      { id: 'p-c1', color: 'sun' },
    ],
    exile: [],
    monsters: [
      {
        id: 'p-mon-1',
        name: '火炎竜',
        slots: ['red', 'red', 'white'],
        equippedMana: [{ id: 'p-m6', color: 'red' }],
        isFlipped: false,
      },
      {
        id: 'p-mon-2',
        name: '水流獣',
        slots: ['blue', 'green'],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'p-mon-3',
        name: '雷電鳥',
        slots: ['yellow', 'yellow'],
        equippedMana: [],
        isFlipped: false,
      },
    ],
  },
  opponent: {
    deck: [
      { id: 'o-m1', color: 'moon' },
      { id: 'o-m2', color: 'red' },
      { id: 'o-m3', color: 'blue' },
    ],
    cemetery: [],
    exile: [],
    monsters: [
      {
        id: 'o-mon-1',
        name: '岩石巨人',
        slots: ['green', 'green', 'sun'],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'o-mon-2',
        name: '暗黒騎士',
        slots: ['moon', 'red'],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'o-mon-3',
        name: '光の精霊',
        slots: ['sun', 'white'],
        equippedMana: [],
        isFlipped: false,
      },
    ],
  },
};

// 配列を不変にシャッフルするヘルパー関数 (Fisher-Yates)
const shuffleArray = <T,>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Stateを更新する純粋関数 (ルールの自動チェックは行わない)
const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'EQUIP_MANA': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];

      if (player.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = player.deck;
      
      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...updatedMonsters[monsterIndex],
        equippedMana: [...updatedMonsters[monsterIndex].equippedMana, drawnCard]
      };

      return {
        ...state,
        [side]: {
          ...player,
          deck: remainingDeck,
          monsters: updatedMonsters,
        },
      };
    }

    case 'TRASH_MANA': {
      const { side, monsterIndex, manaCardIds, destination } = action.payload;
      const player = state[side];
      const monster = player.monsters[monsterIndex];

      if (monster.equippedMana.length === 0) return state;

      let trashedCards: ManaCard[] = [];
      let remainingMana: ManaCard[] = [];

      if (manaCardIds === 'all') {
        trashedCards = [...monster.equippedMana];
        remainingMana = [];
      } else {
        trashedCards = monster.equippedMana.filter(m => manaCardIds.includes(m.id));
        remainingMana = monster.equippedMana.filter(m => !manaCardIds.includes(m.id));
      }

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = { ...monster, equippedMana: remainingMana };

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
          [destination]: [...player[destination], ...trashedCards],
        },
      };
    }

    case 'DAMAGE': {
      const { targetSide, side, amount } = action.payload;
      const newTargetSide = targetSide ?? side;
      if (!newTargetSide) return state;

      const targetPlayer = state[newTargetSide];
      if (amount <= 0 || targetPlayer.deck.length === 0) return state;

      const actualAmount = Math.min(amount, targetPlayer.deck.length);
      const damagedCards = targetPlayer.deck.slice(0, actualAmount);
      const remainingDeck = targetPlayer.deck.slice(actualAmount);

      return {
        ...state,
        [newTargetSide]: {
          ...targetPlayer,
          deck: remainingDeck,
          cemetery: [...targetPlayer.cemetery, ...damagedCards],
        },
      };
    }

    case 'RECOVER': {
      const { side, manaCardIds } = action.payload;
      const player = state[side];

      if (manaCardIds.length === 0) return state;

      const recoveredCards: ManaCard[] = [];
      const remainingCemetery = player.cemetery.filter((card) => {
        if (manaCardIds.includes(card.id)) {
          recoveredCards.push(card);
          return false;
        }
        return true;
      });

      if (recoveredCards.length === 0) return state;

      const newDeck = shuffleArray([...player.deck, ...recoveredCards]);

      return {
        ...state,
        [side]: {
          ...player,
          deck: newDeck,
          cemetery: remainingCemetery,
        },
      };
    }

    case 'FLIP_MONSTER': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...updatedMonsters[monsterIndex],
        isFlipped: !updatedMonsters[monsterIndex].isFlipped
      };

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
        },
      };
    }

    case 'EQUIP_SPECIFIC_MANA': {
      // sourceZone にデフォルト値 'deck' を設定して undefined を排除
      const { side, monsterIndex, sourceZone = 'deck', manaCardId } = action.payload;
      const player = state[side];
      
      // 移動元の配列を安全に取得
      const sourceArray = player[sourceZone] || [];
      const cardToEquip = sourceArray.find((c) => c.id === manaCardId);
      
      // カードが見つからない場合は状態を変更しない
      if (!cardToEquip) return state;

      // 移動元から対象カードを取り除く
      const updatedSourceArray = sourceArray.filter((c) => c.id !== manaCardId);

      // 指定されたモンスターにマナを装備
      const updatedMonsters = player.monsters.map((monster, index) => {
        if (index !== monsterIndex) return monster;
        return {
          ...monster,
          equippedMana: [...monster.equippedMana, cardToEquip],
        };
      });

      return {
        ...state,
        [side]: {
          ...player,
          [sourceZone]: updatedSourceArray,
          monsters: updatedMonsters,
        },
      };
    }

    case 'MOVE_CARD_BETWEEN_ZONES': {
      const { side, cardIds, sourceZone = 'deck', targetZone = 'cemetery' } = action.payload;
      const targetPlayer = state[side];

      // 安全に配列を取得
      const sourceList = targetPlayer[sourceZone] || [];
      const targetList = targetPlayer[targetZone] || [];

      // 移動対象のカードを抽出
      const movingCards = sourceList.filter((card) => cardIds.includes(card.id));
      
      // 移動元から対象カードを除外
      const newSourceList = sourceList.filter((card) => !cardIds.includes(card.id));
      
      // 移動先にカードを追加
      const newTargetList = [...targetList, ...movingCards];

      return {
        ...state,
        [side]: {
          ...targetPlayer,
          [sourceZone]: newSourceList,
          [targetZone]: newTargetList,
        },
      };
    }

    case 'SHUFFLE_DECK': {
      const { side } = action.payload;
      const player = state[side];
      
      return {
        ...state,
        [side]: {
          ...player,
          deck: shuffleArray(player.deck),
        },
      };
    }

    default:
      return state;
  }
};

export const useGameState = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  return { gameState, dispatch };
};