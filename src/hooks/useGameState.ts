// src/hooks/useGameState.ts
import { useReducer, useState, useCallback } from 'react';
import type { GameState, GameAction, ManaCard } from '../types';

// 初期状態
const initialState: GameState = {
  player: {
    deck: [],
    cemetery: [],
    exile: [],
    pendingDrawCards: [],
    monsters: [
      {
        id: 'p-mon-1',
        name: '',
        slots: [],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'p-mon-2',
        name: '',
        slots: [],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'p-mon-3',
        name: '',
        slots: [],
        equippedMana: [],
        isFlipped: false,
      },
    ],
  },
  opponent: {
    deck: [],
    cemetery: [],
    exile: [],
    pendingDrawCards: [],
    monsters: [
      {
        id: 'o-mon-1',
        name: '',
        slots: [],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'o-mon-2',
        name: '',
        slots: [],
        equippedMana: [],
        isFlipped: false,
      },
      {
        id: 'o-mon-3',
        name: '',
        slots: [],
        equippedMana: [],
        isFlipped: false,
      },
    ],
  },
  // フェーズ2: ターン進行管理用の初期状態
  turnPlayer: 'player',
  turnCount: 1,
  currentPhase: 'start',
};

// 配列を不変にシャッフルするヘルパー関数 (Fisher-Yates)
const shuffleArray = <T>(array: T[]): T[] => {
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
    // ----------------------------------------------------
    // フェーズ4 追加: Undo/Redo用の状態復元アクション
    // ----------------------------------------------------
    case 'RESTORE_STATE': {
      return action.payload;
    }

    // ----------------------------------------------------
    // ターン切替処理（フェーズ進行から簡略化）
    // ----------------------------------------------------
    case 'NEXT_PHASE': {
      const { turnPlayer, turnCount } = state;
      return {
        ...state,
        turnPlayer: turnPlayer === 'player' ? 'opponent' : 'player',
        turnCount: turnPlayer === 'opponent' ? turnCount + 1 : turnCount,
      };
    }

    // ----------------------------------------------------
    // 既存の手動アクション
    // ----------------------------------------------------
    case 'AUTO_DRAW': {
      // (※手動でのドロー用として既存ロジックを維持。UIからは削除予定ですが、テスト用に残します)
      const targetSide = action.payload.player;
      const player = state[targetSide];
      if (player.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = player.deck;

      return {
        ...state,
        [targetSide]: {
          ...player,
          deck: remainingDeck,
          pendingDrawCards: [...player.pendingDrawCards, drawnCard],
        },
      };
    }

    case 'EQUIP_MANA': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];

      if (player.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = player.deck;

      const updatedMonsters = [...player.monsters];
      const monster = updatedMonsters[monsterIndex];

      const newEquippedMana = [...monster.equippedMana];
      // 【修正】最初の空きスロット（null）を探す
      const emptyIndex = newEquippedMana.findIndex((m) => m === null);

      if (emptyIndex !== -1) {
        newEquippedMana[emptyIndex] = drawnCard; // 空き枠に装備
      } else {
        newEquippedMana.push(drawnCard); // 空きがなければ末尾に追加
      }

      updatedMonsters[monsterIndex] = {
        ...monster,
        equippedMana: newEquippedMana,
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
      let remainingMana: (ManaCard | null)[] = [];

      if (manaCardIds === 'all') {
        // 【修正】nullを除外して実際に存在するカードだけを抽出
        trashedCards = monster.equippedMana.filter(
          (m): m is ManaCard => m !== null,
        );
        // 【修正】枠の数だけnullで埋める（スロット位置を維持するため）
        remainingMana = new Array(monster.equippedMana.length).fill(null);
      } else {
        // 【修正】指定されたカードのみ抽出し、TypeScriptの型を確定させる
        trashedCards = monster.equippedMana.filter(
          (m): m is ManaCard => m !== null && manaCardIds.includes(m.id),
        );
        // 【修正】指定されたカードIDの箇所のみ null に置換し、それ以外（位置情報含む）はそのまま残す
        remainingMana = monster.equippedMana.map((m) =>
          m !== null && manaCardIds.includes(m.id) ? null : m,
        );
      }

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...monster,
        equippedMana: remainingMana,
      };

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
        isFlipped: !updatedMonsters[monsterIndex].isFlipped,
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
      const {
        side,
        monsterIndex,
        sourceZone = 'deck',
        manaCardId,
        targetSlotIndex,
      } = action.payload;
      const player = state[side];
      if (!player) {
        console.warn(
          '[EQUIP_SPECIFIC_MANA] 不正な side が渡されたため処理を中断しました:',
          action.payload,
        );
        return state;
      }

      // 移動元の配列を安全に取得 (pending対応)
      const sourceKey =
        sourceZone === 'pending' ? 'pendingDrawCards' : sourceZone;
      const sourceArray = player[sourceKey] || [];
      const cardToEquip = sourceArray.find((c) => c.id === manaCardId);

      if (!cardToEquip) return state;

      const updatedSourceArray = sourceArray.filter((c) => c.id !== manaCardId);

      const updatedMonsters = player.monsters.map((monster, index) => {
        if (index !== monsterIndex) return monster;

        const newEquippedMana = [...monster.equippedMana];

        // 【修正】targetSlotIndex が指定されている場合、その位置にピンポイントで配置
        if (targetSlotIndex !== undefined) {
          // 配列長が指定インデックスに満たない場合は null でパディングして枠を拡張する
          while (newEquippedMana.length <= targetSlotIndex) {
            newEquippedMana.push(null);
          }
          newEquippedMana[targetSlotIndex] = cardToEquip;
        } else {
          // ボタン経由など枠指定がない場合、まずは monster.slots の漢字と一致する空き枠を優先的に探す。
          // 見つからなければ従来通り最初の空き枠にフォールバックする。
          const matchingEmptyIndex = monster.slots.findIndex(
            (requiredKanji, i) =>
              requiredKanji === cardToEquip.kanji &&
              newEquippedMana[i] === null,
          );

          if (matchingEmptyIndex !== -1) {
            newEquippedMana[matchingEmptyIndex] = cardToEquip;
          } else {
            const emptyIndex = newEquippedMana.findIndex((m) => m === null);
            if (emptyIndex !== -1) {
              newEquippedMana[emptyIndex] = cardToEquip;
            } else {
              newEquippedMana.push(cardToEquip);
            }
          }
        }

        return {
          ...monster,
          equippedMana: newEquippedMana,
        };
      });

      return {
        ...state,
        [side]: {
          ...player,
          [sourceKey]: updatedSourceArray,
          monsters: updatedMonsters,
        },
      };
    }

    case 'MOVE_CARD_BETWEEN_ZONES': {
      const {
        side,
        cardIds,
        sourceZone = 'deck',
        targetZone = 'cemetery',
      } = action.payload;
      const targetPlayer = state[side];

      // 安全に配列を取得 (pending対応)
      const sourceKey =
        sourceZone === 'pending' ? 'pendingDrawCards' : sourceZone;
      const targetKey =
        targetZone === 'pending' ? 'pendingDrawCards' : targetZone;

      const sourceList = targetPlayer[sourceKey] || [];
      const targetList = targetPlayer[targetKey] || [];

      const movingCards = sourceList.filter((card) =>
        cardIds.includes(card.id),
      );

      const newSourceList = sourceList.filter(
        (card) => !cardIds.includes(card.id),
      );

      // 移動先にカードを追加 (山札に戻す場合は先頭に追加)
      const newTargetList =
        targetZone === 'deck'
          ? [...movingCards, ...targetList]
          : [...targetList, ...movingCards];

      return {
        ...state,
        [side]: {
          ...targetPlayer,
          [sourceKey]: newSourceList,
          [targetKey]: newTargetList,
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

    case 'SET_INITIAL_STATE': {
      return {
        ...state,
        player: {
          ...state.player,
          monsters: action.payload.player.monsters,
          deck: action.payload.player.deck,
        },
        opponent: {
          ...state.opponent,
          monsters: action.payload.opponent.monsters,
          deck: action.payload.opponent.deck,
        },
      };
    }

    case 'SET_TURN_PLAYER': {
      return {
        ...state,
        turnPlayer: action.payload.turnPlayer,
      };
    }

    default:
      return state;
  }
};

export const useGameState = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);

  // 修正: 過去(Undo用)と未来(Redo用)のスタックを別々に保持 (最大20手)
  const [past, setPast] = useState<GameState[]>([]);
  const [future, setFuture] = useState<GameState[]>([]);

  // 状態を変更するアクションが発行されたら履歴に保存するラップ関数
  const dispatchWithHistory = useCallback(
    (action: GameAction) => {
      if (
        action.type !== 'RESTORE_STATE' &&
        action.type !== 'SET_INITIAL_STATE'
      ) {
        // ドローモーダル内での操作（pending領域からのカード移動・装備）は中間状態のため履歴追加をスキップ
        const isPendingAction =
          (action.type === 'EQUIP_SPECIFIC_MANA' &&
            action.payload.sourceZone === 'pending') ||
          (action.type === 'MOVE_CARD_BETWEEN_ZONES' &&
            action.payload.sourceZone === 'pending');

        if (!isPendingAction) {
          setPast((prev: GameState[]) => {
            const nextPast = [...prev, gameState];
            return nextPast.length > 20 ? nextPast.slice(1) : nextPast;
          });
          // 新しい操作が行われたらRedo(未来)の履歴は破棄する
          setFuture([]);
        }
      } else if (action.type === 'SET_INITIAL_STATE') {
        // 初期化時は両方の履歴をリセット
        setPast([]);
        setFuture([]);
      }
      dispatch(action);
    },
    [gameState],
  );

  // 1手戻す (Undo) 処理
  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previousState = past[past.length - 1];

    setPast((prev: GameState[]) => prev.slice(0, -1));
    // 現在の状態を「未来」スタックに退避
    setFuture((prev: GameState[]) => [gameState, ...prev].slice(0, 20));

    dispatch({ type: 'RESTORE_STATE', payload: previousState });
  }, [past, gameState]);

  // 追加: やり直す (Redo) 処理
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];

    setFuture((prev: GameState[]) => prev.slice(1));
    // 現在の状態を「過去」スタックに退避
    setPast((prev: GameState[]) => {
      const nextPast = [...prev, gameState];
      return nextPast.length > 20 ? nextPast.slice(1) : nextPast;
    });

    dispatch({ type: 'RESTORE_STATE', payload: nextState });
  }, [future, gameState]);

  return {
    gameState,
    dispatch: dispatchWithHistory,
    undo: handleUndo,
    canUndo: past.length > 0,
    redo: handleRedo, // 追加
    canRedo: future.length > 0, // 追加
  };
};
