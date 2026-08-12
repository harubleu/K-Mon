// src/hooks/useGameState.ts
import { useReducer } from 'react';
import type { GameState, GameAction, ManaCard } from '../types';

// テスト用ダミー初期状態
const initialState: GameState = {
  player: {
    deck: [
      { id: 'p-m1', color: 'red' } as any, // ※マスターデータ完全移行までは既存のモック維持
      { id: 'p-m2', color: 'blue' } as any,
      { id: 'p-m3', color: 'yellow' } as any,
      { id: 'p-m4', color: 'green' } as any,
      { id: 'p-m5', color: 'white' } as any,
    ],
    cemetery: [{ id: 'p-c1', color: 'sun' } as any],
    exile: [],
    pendingDrawCards: [],
    monsters: [
      {
        id: 'p-mon-1',
        name: '火炎竜',
        slots: ['red', 'red', 'white'],
        equippedMana: [{ id: 'p-m6', color: 'red' } as any],
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
      { id: 'o-m1', color: 'moon' } as any,
      { id: 'o-m2', color: 'red' } as any,
      { id: 'o-m3', color: 'blue' } as any,
    ],
    cemetery: [],
    exile: [],
    pendingDrawCards: [],
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
    // フェーズ2 追加: ターン進行管理と自動ドロー処理の統合
    // ----------------------------------------------------
    case 'NEXT_PHASE': {
      const { currentPhase, turnPlayer, turnCount } = state;

      if (currentPhase === 'start') {
        // start -> draw への移行時、ターンプレイヤーの山札から1枚引いてpendingDrawCardsへ移動する
        const playerState = state[turnPlayer];

        // 山札が0枚の場合はドローできない（フェーズのみ進める）
        if (playerState.deck.length === 0) {
          return { ...state, currentPhase: 'draw' };
        }

        const newDeck = [...playerState.deck];
        const drawnCard = newDeck.shift()!; // 先頭から1枚ドロー
        const newPending = [...playerState.pendingDrawCards, drawnCard];

        return {
          ...state,
          currentPhase: 'draw',
          [turnPlayer]: {
            ...playerState,
            deck: newDeck,
            pendingDrawCards: newPending,
          },
        };
      } else if (currentPhase === 'draw') {
        return { ...state, currentPhase: 'main' };
      } else if (currentPhase === 'main') {
        return { ...state, currentPhase: 'end' };
      } else if (currentPhase === 'end') {
        // end -> start への移行時、ターンプレイヤーを交代し、ターン数を加算する
        return {
          ...state,
          currentPhase: 'start',
          turnPlayer: turnPlayer === 'player' ? 'opponent' : 'player',
          turnCount: turnCount + 1,
        };
      }
      return state;
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
      updatedMonsters[monsterIndex] = {
        ...updatedMonsters[monsterIndex],
        equippedMana: [
          ...updatedMonsters[monsterIndex].equippedMana,
          drawnCard,
        ],
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
        trashedCards = monster.equippedMana.filter((m) =>
          manaCardIds.includes(m.id),
        );
        remainingMana = monster.equippedMana.filter(
          (m) => !manaCardIds.includes(m.id),
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
      } = action.payload;
      const player = state[side];

      // 移動元の配列を安全に取得 (pending対応)
      const sourceKey =
        sourceZone === 'pending' ? 'pendingDrawCards' : sourceZone;
      const sourceArray = player[sourceKey] || [];
      const cardToEquip = sourceArray.find((c) => c.id === manaCardId);

      if (!cardToEquip) return state;

      const updatedSourceArray = sourceArray.filter((c) => c.id !== manaCardId);

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

    default:
      return state;
  }
};

export const useGameState = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  return { gameState, dispatch };
};
