// src/hooks/useGameState.ts

import { useReducer, useState, useCallback } from 'react';
import type {
  GameState,
  GameAction,
  ManaCard,
  ActionLog,
  LogType,
  GameStatus,
  ZoneType,
  PlayerSide,
} from '../types';

// --- 追加: ログ生成・勝敗判定用ヘルパー関数 ---
const createLog = (type: LogType, message: string): ActionLog => ({
  id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  timestamp: new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
  type,
  message,
});

const getSideLabel = (side: PlayerSide): string =>
  side === 'player' ? '自分' : '相手';
const getZoneLabel = (zone: ZoneType): string => {
  switch (zone) {
    case 'deck':
      return '山札';
    case 'cemetery':
      return '墓地';
    case 'exile':
      return '除外エリア';
    case 'pending':
      return '保留領域';
    default:
      return zone;
  }
};

const evaluateGameStatus = (
  playerDeckCount: number,
  opponentDeckCount: number,
  currentStatus: GameStatus,
): { status: GameStatus; alertLog?: ActionLog } => {
  // すでに決着がついている場合は判定・アラートをスキップ
  if (currentStatus !== 'playing') return { status: currentStatus };

  if (playerDeckCount <= 0 && opponentDeckCount <= 0) {
    return {
      status: 'draw',
      alertLog: createLog(
        'alert',
        '両者の山札が0枚になりました。引き分けです。',
      ),
    };
  }
  if (playerDeckCount <= 0) {
    return {
      status: 'opponent_win',
      alertLog: createLog(
        'alert',
        '自分の山札が0枚になりました。相手の勝利です。',
      ),
    };
  }
  if (opponentDeckCount <= 0) {
    return {
      status: 'player_win',
      alertLog: createLog(
        'alert',
        '相手の山札が0枚になりました。自分の勝利です。',
      ),
    };
  }
  return { status: 'playing' };
};
// ----------------------------------------------------

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
  turnPlayer: 'player',
  turnCount: 1,
  currentPhase: 'start',
  // 追加: ログと勝敗状態
  logs: [],
  gameStatus: 'playing',
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
    case 'RESTORE_STATE': {
      return action.payload;
    }

    case 'NEXT_PHASE': {
      const { turnPlayer, turnCount } = state;
      const nextTurnPlayer = turnPlayer === 'player' ? 'opponent' : 'player';
      const nextTurnCount =
        turnPlayer === 'opponent' ? turnCount + 1 : turnCount;

      const newLogs = [
        createLog(
          'system',
          `ターン ${nextTurnCount} 開始 (${getSideLabel(nextTurnPlayer)}のターン)`,
        ),
        ...state.logs,
      ];

      return {
        ...state,
        turnPlayer: nextTurnPlayer,
        turnCount: nextTurnCount,
        logs: newLogs,
      };
    }

    case 'AUTO_DRAW': {
      const targetSide = action.payload.player;
      const player = state[targetSide];
      if (player.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = player.deck;

      const nextState = {
        ...state,
        [targetSide]: {
          ...player,
          deck: remainingDeck,
          pendingDrawCards: [...player.pendingDrawCards, drawnCard],
        },
      };

      const { status, alertLog } = evaluateGameStatus(
        nextState.player.deck.length,
        nextState.opponent.deck.length,
        state.gameStatus,
      );
      const newLogs = [
        createLog('draw', `${getSideLabel(targetSide)}が1枚ドローしました。`),
        ...state.logs,
      ];
      if (alertLog) newLogs.unshift(alertLog);

      return { ...nextState, logs: newLogs, gameStatus: status };
    }

    case 'EQUIP_MANA': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];

      if (player.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = player.deck;
      const updatedMonsters = [...player.monsters];
      const monster = updatedMonsters[monsterIndex];

      const newEquippedMana = [...monster.equippedMana];
      const emptyIndex = newEquippedMana.findIndex((m) => m === null);

      if (emptyIndex !== -1) {
        newEquippedMana[emptyIndex] = drawnCard;
      } else {
        newEquippedMana.push(drawnCard);
      }

      updatedMonsters[monsterIndex] = {
        ...monster,
        equippedMana: newEquippedMana,
      };

      const nextState = {
        ...state,
        [side]: {
          ...player,
          deck: remainingDeck,
          monsters: updatedMonsters,
        },
      };

      const { status, alertLog } = evaluateGameStatus(
        nextState.player.deck.length,
        nextState.opponent.deck.length,
        state.gameStatus,
      );
      const newLogs = [
        createLog(
          'mana',
          `${getSideLabel(side)}の「${monster.name || `モンスター${monsterIndex + 1}`}」にマナを装備しました。`,
        ),
        ...state.logs,
      ];
      if (alertLog) newLogs.unshift(alertLog);

      return { ...nextState, logs: newLogs, gameStatus: status };
    }

    case 'TRASH_MANA': {
      const { side, monsterIndex, manaCardIds, destination } = action.payload;
      const player = state[side];
      const monster = player.monsters[monsterIndex];

      if (monster.equippedMana.length === 0) return state;

      let trashedCards: ManaCard[] = [];
      let remainingMana: (ManaCard | null)[] = [];

      if (manaCardIds === 'all') {
        trashedCards = monster.equippedMana.filter(
          (m): m is ManaCard => m !== null,
        );
        remainingMana = new Array(monster.equippedMana.length).fill(null);
      } else {
        trashedCards = monster.equippedMana.filter(
          (m): m is ManaCard => m !== null && manaCardIds.includes(m.id),
        );
        remainingMana = monster.equippedMana.map((m) =>
          m !== null && manaCardIds.includes(m.id) ? null : m,
        );
      }

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...monster,
        equippedMana: remainingMana,
      };

      const newLogs = [
        createLog(
          'mana',
          `${getSideLabel(side)}の「${monster.name || `モンスター${monsterIndex + 1}`}」から ${trashedCards.length} 枚のマナを${getZoneLabel(destination)}へ破棄しました。`,
        ),
        ...state.logs,
      ];

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
          [destination]: [...player[destination], ...trashedCards],
        },
        logs: newLogs,
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

      const nextState = {
        ...state,
        [newTargetSide]: {
          ...targetPlayer,
          deck: remainingDeck,
          cemetery: [...targetPlayer.cemetery, ...damagedCards],
        },
      };

      const { status, alertLog } = evaluateGameStatus(
        nextState.player.deck.length,
        nextState.opponent.deck.length,
        state.gameStatus,
      );
      const newLogs = [
        createLog(
          'attack',
          `${getSideLabel(newTargetSide)}の山札から ${damagedCards.length} 枚が墓地へ送られました。`,
        ),
        ...state.logs,
      ];
      if (alertLog) newLogs.unshift(alertLog);

      return { ...nextState, logs: newLogs, gameStatus: status };
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

      const nextState = {
        ...state,
        [side]: {
          ...player,
          deck: newDeck,
          cemetery: remainingCemetery,
        },
      };

      const { status, alertLog } = evaluateGameStatus(
        nextState.player.deck.length,
        nextState.opponent.deck.length,
        state.gameStatus,
      );
      const newLogs = [
        createLog(
          'system',
          `${getSideLabel(side)}の墓地から ${recoveredCards.length} 枚のカードを山札に戻しシャッフルしました。`,
        ),
        ...state.logs,
      ];
      if (alertLog) newLogs.unshift(alertLog);

      return { ...nextState, logs: newLogs, gameStatus: status };
    }

    case 'FLIP_MONSTER': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];

      const updatedMonsters = [...player.monsters];
      const nextIsFlipped = !updatedMonsters[monsterIndex].isFlipped;

      updatedMonsters[monsterIndex] = {
        ...updatedMonsters[monsterIndex],
        isFlipped: nextIsFlipped,
      };

      const logMsg = `${getSideLabel(side)}の「${updatedMonsters[monsterIndex].name || `モンスター${monsterIndex + 1}`}」を${nextIsFlipped ? '裏面(スロット面)' : '表面(イラスト面)'}に表示切替しました。`;

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
        },
        logs: [createLog('system', logMsg), ...state.logs],
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

      const sourceKey =
        sourceZone === 'pending' ? 'pendingDrawCards' : sourceZone;
      const sourceArray = player[sourceKey] || [];
      const cardToEquip = sourceArray.find((c) => c.id === manaCardId);

      if (!cardToEquip) return state;

      const updatedSourceArray = sourceArray.filter((c) => c.id !== manaCardId);

      const updatedMonsters = player.monsters.map((monster, index) => {
        if (index !== monsterIndex) return monster;

        const newEquippedMana = [...monster.equippedMana];

        if (targetSlotIndex !== undefined) {
          while (newEquippedMana.length <= targetSlotIndex) {
            newEquippedMana.push(null);
          }
          newEquippedMana[targetSlotIndex] = cardToEquip;
        } else {
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

      const nextState = {
        ...state,
        [side]: {
          ...player,
          [sourceKey]: updatedSourceArray,
          monsters: updatedMonsters,
        },
      };

      const logMsg = `${getSideLabel(side)}の「${player.monsters[monsterIndex].name || `モンスター${monsterIndex + 1}`}」にマナ「${cardToEquip.kanji}」を装備しました。`;
      const { status, alertLog } = evaluateGameStatus(
        nextState.player.deck.length,
        nextState.opponent.deck.length,
        state.gameStatus,
      );
      const newLogs = [createLog('mana', logMsg), ...state.logs];
      if (alertLog) newLogs.unshift(alertLog);

      return { ...nextState, logs: newLogs, gameStatus: status };
    }

    case 'MOVE_CARD_BETWEEN_ZONES': {
      const {
        sourceSide,
        targetSide,
        cardIds,
        sourceZone = 'deck',
        targetZone = 'cemetery',
      } = action.payload;

      const sourcePlayer = state[sourceSide];
      const sourceKey =
        sourceZone === 'pending' ? 'pendingDrawCards' : sourceZone;
      const sourceList = sourcePlayer[sourceKey] || [];

      const movingCards = sourceList.filter((card) =>
        cardIds.includes(card.id),
      );
      const newSourceList = sourceList.filter(
        (card) => !cardIds.includes(card.id),
      );

      if (movingCards.length === 0) return state;

      const targetKey =
        targetZone === 'pending' ? 'pendingDrawCards' : targetZone;

      let nextState: GameState;

      if (sourceSide === targetSide) {
        const targetList = sourcePlayer[targetKey] || [];
        const newTargetList =
          targetZone === 'deck'
            ? [...movingCards, ...targetList]
            : [...targetList, ...movingCards];

        nextState = {
          ...state,
          [sourceSide]: {
            ...sourcePlayer,
            [sourceKey]: newSourceList,
            [targetKey]: newTargetList,
          },
        };
      } else {
        const targetPlayer = state[targetSide];
        const targetList = targetPlayer[targetKey] || [];
        const newTargetList =
          targetZone === 'deck'
            ? [...movingCards, ...targetList]
            : [...targetList, ...movingCards];

        nextState = {
          ...state,
          [sourceSide]: {
            ...sourcePlayer,
            [sourceKey]: newSourceList,
          },
          [targetSide]: {
            ...targetPlayer,
            [targetKey]: newTargetList,
          },
        };
      }

      const logType: LogType =
        sourceZone === 'deck' && targetZone === 'pending' ? 'draw' : 'system';
      const moveMsg = `${getSideLabel(sourceSide)}の${getZoneLabel(sourceZone)}から${getSideLabel(targetSide)}の${getZoneLabel(targetZone)}へ ${movingCards.length} 枚カードを移動しました。`;

      const { status, alertLog } = evaluateGameStatus(
        nextState.player.deck.length,
        nextState.opponent.deck.length,
        state.gameStatus,
      );
      const newLogs = [createLog(logType, moveMsg), ...state.logs];
      if (alertLog) newLogs.unshift(alertLog);

      return { ...nextState, logs: newLogs, gameStatus: status };
    }

    case 'REORDER_DECK': {
      const { side, orderedCardIds } = action.payload;
      const player = state[side];

      const orderedCards = orderedCardIds
        .map((id) => player.deck.find((c) => c.id === id))
        .filter((c): c is ManaCard => c !== undefined);
      const remainingCards = player.deck.filter(
        (c) => !orderedCardIds.includes(c.id),
      );

      return {
        ...state,
        [side]: {
          ...player,
          deck: [...orderedCards, ...remainingCards],
        },
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の山札の並び順を変更しました。`,
          ),
          ...state.logs,
        ],
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
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の山札をシャッフルしました。`,
          ),
          ...state.logs,
        ],
      };
    }

    case 'SET_INITIAL_STATE': {
      const pDeckCount = action.payload.player.deck.length;
      const oDeckCount = action.payload.opponent.deck.length;
      const { status, alertLog } = evaluateGameStatus(
        pDeckCount,
        oDeckCount,
        'playing',
      );

      const initialLogs = [createLog('system', '対戦を開始しました。')];
      if (alertLog) initialLogs.unshift(alertLog);

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
        logs: initialLogs,
        gameStatus: status,
      };
    }

    case 'SET_TURN_PLAYER': {
      return {
        ...state,
        turnPlayer: action.payload.turnPlayer,
        logs: [
          createLog(
            'system',
            `ターンプレイヤーが ${getSideLabel(action.payload.turnPlayer)} に変更されました。`,
          ),
          ...state.logs,
        ],
      };
    }

    default:
      return state;
  }
};

export const useGameState = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);

  const [past, setPast] = useState<GameState[]>([]);
  const [future, setFuture] = useState<GameState[]>([]);

  const dispatchWithHistory = useCallback(
    (action: GameAction) => {
      if (
        action.type !== 'RESTORE_STATE' &&
        action.type !== 'SET_INITIAL_STATE'
      ) {
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
          setFuture([]);
        }
      } else if (action.type === 'SET_INITIAL_STATE') {
        setPast([]);
        setFuture([]);
      }
      dispatch(action);
    },
    [gameState],
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previousState = past[past.length - 1];

    setPast((prev: GameState[]) => prev.slice(0, -1));
    setFuture((prev: GameState[]) => [gameState, ...prev].slice(0, 20));

    dispatch({ type: 'RESTORE_STATE', payload: previousState });
  }, [past, gameState]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];

    setFuture((prev: GameState[]) => prev.slice(1));
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
    redo: handleRedo,
    canRedo: future.length > 0,
  };
};
