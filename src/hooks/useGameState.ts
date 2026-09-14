// src/hooks/useGameState.ts

import { useReducer, useState, useCallback, useEffect } from 'react';
import type {
  GameState,
  GameAction,
  ManaCard,
  ActionLog,
  LogType,
  GameStatus,
  ZoneType,
  PlayerSide,
  PlayerState,
} from '../types';
import {
  getPassiveList,
  resolveSide,
  getOpponentSide,
} from '../utils/effectExecutor';

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

// 【追加】保: 表面かつreservedCardsを持つモンスターがいる側の山札が0の場合、
// そのreservedCardsを山札へ戻す(ターン終了時の決定的処理。選択UIは不要)。
// 「効果発動」ボタン経由ではなく、AUTO_DRAWと同種のReducer内蔵処理として扱う。
const returnReservedCardsIfDeckEmpty = (
  playerState: PlayerState,
): PlayerState => {
  if (playerState.deck.length > 0) return playerState;

  const targetMonsterIndex = playerState.monsters.findIndex(
    (m) => !m.isFlipped && m.reservedCards && m.reservedCards.length > 0,
  );
  if (targetMonsterIndex === -1) return playerState;

  const targetMonster = playerState.monsters[targetMonsterIndex];
  const returningCards = targetMonster.reservedCards ?? [];

  const updatedMonsters = playerState.monsters.map((m, idx) =>
    idx === targetMonsterIndex
      ? { ...m, reservedCards: [], isFlipped: true }
      : m,
  );

  return {
    ...playerState,
    deck: shuffleArray([...playerState.deck, ...returningCards]),
    monsters: updatedMonsters,
  };
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

// 【追加・暮】graveyard_kanji_threshold_win。原文に「ターンがはじまるとき」等の時制表現が
// 無く、常時条件として読める。かつ暮が成立させるのは所有者にとって有利な条件であり、
// 山札0枚判定のように「不利な側の逆転猶予」を確保する必要がない。そのため即時判定とし、
// あらゆるAction後の状態変化を(gameReducerの内部ではなく)useGameState側で一括検知する
// (下記useEffect参照)。「5まいより多い」＝6枚以上(count > threshold)として判定する。
const evaluateGraveyardThresholdWinConditions = (
  state: GameState,
): { status: GameStatus; logMessage: string } | null => {
  if (state.gameStatus !== 'playing') return null;
  for (const side of ['player', 'opponent'] as PlayerSide[]) {
    const monsters = state[side].monsters;
    for (const monster of monsters) {
      if (monster.isFlipped) continue; // 表向き固定の永続効果のため
      for (const passive of getPassiveList(monster)) {
        if (passive.trigger !== 'graveyard_kanji_threshold_win') continue;
        const count = state[side].cemetery.filter(
          (c) => c.kanji === passive.targetKanji,
        ).length;
        if (count > passive.threshold) {
          return {
            status: side === 'player' ? 'player_win' : 'opponent_win',
            logMessage: `${getSideLabel(side)}の「${monster.name || '暮'}」の勝利条件が成立しました（墓地の${passive.targetKanji}が${count}枚）。`,
          };
        }
      }
    }
  }
  return null;
};

// 【追加・浅/政】own_turn_start_win_condition(浅)・seeded_mana_return_win_condition(政)。
// 原文に明示的な時制(「じぶんのターンがはじまる時」)があるため、NEXT_PHASEでのターン交代
// 確定直後(nextTurnPlayerが確定した時点)にのみ判定する。浅・政のどちらかが成立した時点で
// 判定を打ち切る(複数同時成立は現状考慮しない。既存のfindApplicable系ヘルパーと同じ方針)。
const evaluateTurnStartCardWinConditions = (
  state: GameState,
  nextTurnPlayer: PlayerSide,
): { status: GameStatus; logMessage: string } | null => {
  const opponentOfNext = getOpponentSide(nextTurnPlayer);
  const nextPlayerState = state[nextTurnPlayer];

  // 浅（own_turn_start_win_condition）
  for (const monster of nextPlayerState.monsters) {
    if (monster.isFlipped) continue;
    for (const passive of getPassiveList(monster)) {
      if (passive.trigger !== 'own_turn_start_win_condition') continue;
      const targetSide = resolveSide(passive.targetSide, nextTurnPlayer);
      const count = state[targetSide].deck.length;
      const met =
        passive.comparator === 'less_than'
          ? count < passive.threshold
          : count > passive.threshold;
      if (met) {
        return {
          status: nextTurnPlayer === 'player' ? 'player_win' : 'opponent_win',
          logMessage: `${getSideLabel(nextTurnPlayer)}の「${monster.name || '浅'}」の勝利条件が成立しました。`,
        };
      }
    }
  }

  // 政（seeded_mana_return_win_condition）。混入後は相手が引いて墓地送りにするまで
  // 毎自ターン開始時に判定し続ける(消費・回数制限の概念なし)。
  const opponentCemetery = state[opponentOfNext].cemetery;
  const seiMonster = nextPlayerState.monsters.find(
    (m) =>
      !m.isFlipped &&
      getPassiveList(m).some(
        (p) => p.trigger === 'seeded_mana_return_win_condition',
      ),
  );
  if (
    seiMonster &&
    opponentCemetery.some((c) => c.seededBy?.side === nextTurnPlayer)
  ) {
    return {
      status: nextTurnPlayer === 'player' ? 'player_win' : 'opponent_win',
      logMessage: `${getSideLabel(nextTurnPlayer)}の「${seiMonster.name || '政'}」の勝利条件が成立しました。`,
    };
  }

  return null;
};

// 【追加・激】own_turn_end_predict_win。ドロー系Action(AUTO_DRAW/DRAW_REPLACE_FROM_GRAVEYARD)
// の直後に呼ばれる。drawerSide(実際に引いた側)の相手が、表向きの激で予想を宣言していれば
// 漢字を照合する。的中・不的中を問わず、判定後は必ず予想をクリアする(「次にひく」一回限りの
// 予想のため)。的中していればgameStatusを更新する(既に決着済みなら上書きしない)。
const applyPredictedDrawCheck = (
  state: GameState,
  drawerSide: PlayerSide,
  drawnKanji: string,
): GameState => {
  const watcherSide = getOpponentSide(drawerSide);
  const watcherState = state[watcherSide];
  const monsterIndex = watcherState.monsters.findIndex(
    (m) => !m.isFlipped && m.predictedDrawKanji !== undefined,
  );
  if (monsterIndex === -1) return state;

  const monster = watcherState.monsters[monsterIndex];
  const isHit = monster.predictedDrawKanji === drawnKanji;
  const updatedMonsters = [...watcherState.monsters];
  updatedMonsters[monsterIndex] = { ...monster, predictedDrawKanji: undefined };

  const stateAfterClear: GameState = {
    ...state,
    [watcherSide]: { ...watcherState, monsters: updatedMonsters },
  };

  if (isHit && state.gameStatus === 'playing') {
    return {
      ...stateAfterClear,
      gameStatus: watcherSide === 'player' ? 'player_win' : 'opponent_win',
      logs: [
        createLog(
          'alert',
          `${getSideLabel(watcherSide)}の「${monster.name || '激'}」の予想が的中し、勝利条件が成立しました。`,
        ),
        ...stateAfterClear.logs,
      ],
    };
  }
  return stateAfterClear;
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
  pendingExtraTurn: false,
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

      // 【追加】ターン終了時、保による山札復帰処理を先に適用する(選択不要・決定的)。
      // その後の状態で勝敗判定を行うことで、保が発動できた場合は決着を回避できる。
      const playerAfterReserve = returnReservedCardsIfDeckEmpty(state.player);
      const opponentAfterReserve = returnReservedCardsIfDeckEmpty(
        state.opponent,
      );
      const stateAfterReserve = {
        ...state,
        player: playerAfterReserve,
        opponent: opponentAfterReserve,
      };

      // 【追加】勝敗判定をここに集約。ターン終了の瞬間(=次のプレイヤーへ移る直前)にのみ判定する。
      // 公式ルール「山札0でもそのターン中は効果発動でき、逆転できる」に基づき、
      // 山札を減らす他のAction(DAMAGE・MOVE_CARD_BETWEEN_ZONES等)からは判定を行わない。
      const { status, alertLog } = evaluateGameStatus(
        stateAfterReserve.player.deck.length,
        stateAfterReserve.opponent.deck.length,
        state.gameStatus,
      );

      const reserveLogs: ActionLog[] = [];
      if (playerAfterReserve !== state.player) {
        reserveLogs.push(
          createLog(
            'system',
            `${getSideLabel('player')}の保が発動し、保持していたカードを山札へ戻しました。`,
          ),
        );
      }
      if (opponentAfterReserve !== state.opponent) {
        reserveLogs.push(
          createLog(
            'system',
            `${getSideLabel('opponent')}の保が発動し、保持していたカードを山札へ戻しました。`,
          ),
        );
      }

      // 【追加・電】もう一度自分のターンを付与するフラグが立っている場合、ターン交代を
      // スキップし同じプレイヤーのstartフェーズへ戻す(ドローフェーズ以降は通常通り進行する)。
      if (stateAfterReserve.pendingExtraTurn) {
        const extraTurnLogs = [
          createLog(
            'system',
            `${getSideLabel(turnPlayer)}がもう一度ターンを行います。`,
          ),
          ...reserveLogs,
          ...state.logs,
        ];
        return {
          ...stateAfterReserve,
          currentPhase: 'start',
          pendingExtraTurn: false,
          logs: extraTurnLogs,
        };
      }

      // 【追加】決着した場合はターンプレイヤーを切り替えず、ここで停止する
      // (負けの直前のプレイヤーの手番のまま、GameStatusAlertModalで通知する)。
      if (status !== 'playing') {
        return {
          ...stateAfterReserve,
          gameStatus: status,
          logs: [
            ...(alertLog ? [alertLog] : []),
            ...reserveLogs,
            ...state.logs,
          ],
        };
      }

      const nextTurnPlayer = turnPlayer === 'player' ? 'opponent' : 'player';
      const nextTurnCount =
        turnPlayer === 'opponent' ? turnCount + 1 : turnCount;

      // 【変更・浅/政の勝敗接続】従来は政のみログ出力に留めていたが、evaluateTurnStartCardWinConditions
      // (浅・政を統合)へ差し替え、実際にgameStatusを更新するよう格上げした。
      const turnStartWinResult = evaluateTurnStartCardWinConditions(
        stateAfterReserve,
        nextTurnPlayer,
      );

      const newLogs = [
        ...(turnStartWinResult
          ? [createLog('alert', turnStartWinResult.logMessage)]
          : []),
        createLog(
          'system',
          `ターン ${nextTurnCount} 開始 (${getSideLabel(nextTurnPlayer)}のターン)`,
        ),
        ...reserveLogs,
        ...state.logs,
      ];

      if (turnStartWinResult) {
        return {
          ...stateAfterReserve,
          turnPlayer: nextTurnPlayer,
          turnCount: nextTurnCount,
          currentPhase: 'start',
          gameStatus: turnStartWinResult.status,
          logs: newLogs,
        };
      }

      return {
        ...stateAfterReserve,
        turnPlayer: nextTurnPlayer,
        turnCount: nextTurnCount,
        // 【追加】ターン交代後は必ずstartフェーズへ。own_turn_startパイプラインの判定が
        // 名実ともに正しく機能するようになる。
        currentPhase: 'start',
        logs: newLogs,
      };
    }

    case 'AUTO_DRAW': {
      const targetSide = action.payload.player;
      const player = state[targetSide];
      if (player.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = player.deck;

      // 【追加・忍】引いたカードがtrapEffectを持っていた場合、山札の上からreduceCount枚を
      // 追加でdestinationへ送る(決定的処理・選択不要)。発動は1回限りのため、
      // drawnCard自体からはtrapEffectを消費済みとして取り除く。
      let deckAfterTrap = remainingDeck;
      let cemeteryAfterTrap = player.cemetery;
      let exileAfterTrap = player.exile;
      const trapLogs: ActionLog[] = [];
      const { trapEffect, ...drawnCardWithoutTrap } = drawnCard;

      if (trapEffect) {
        const { reduceCount, destination } = trapEffect;
        const trashedCards = deckAfterTrap.slice(0, reduceCount);
        deckAfterTrap = deckAfterTrap.slice(reduceCount);
        if (destination === 'exile') {
          exileAfterTrap = [...exileAfterTrap, ...trashedCards];
        } else {
          cemeteryAfterTrap = [...cemeteryAfterTrap, ...trashedCards];
        }
        trapLogs.push(
          createLog(
            'alert',
            `${getSideLabel(targetSide)}が仕込まれたトラップを踏み抜き、山札を${trashedCards.length}枚失いました。`,
          ),
        );
      }

      const nextState = {
        ...state,
        [targetSide]: {
          ...player,
          deck: deckAfterTrap,
          cemetery: cemeteryAfterTrap,
          exile: exileAfterTrap,
          pendingDrawCards: [...player.pendingDrawCards, drawnCardWithoutTrap],
        },
      };

      const newLogs = [
        ...trapLogs,
        createLog('draw', `${getSideLabel(targetSide)}が1枚ドローしました。`),
        ...state.logs,
      ];

      // 【追加・激】相手が表向きの激で予想を宣言していれば、引いた漢字と照合する。
      return applyPredictedDrawCheck(
        { ...nextState, logs: newLogs },
        targetSide,
        drawnCardWithoutTrap.kanji,
      );
    }

    // 【追加・仁/花】draw_replace用。山札の代わりに、指定した墓地のカードをpendingDrawCardsへ
    // 移動する。AUTO_DRAWと同様に「1枚をpendingへ」という結果になるため、既存の
    // 「1枚ドロー確認」モーダル（PlayerZone.tsx）がそのまま流用できる。
    case 'DRAW_REPLACE_FROM_GRAVEYARD': {
      const { side, cardId } = action.payload;
      const player = state[side];
      const card = player.cemetery.find((c) => c.id === cardId);
      if (!card) return state;

      const nextState = {
        ...state,
        [side]: {
          ...player,
          cemetery: player.cemetery.filter((c) => c.id !== cardId),
          pendingDrawCards: [...player.pendingDrawCards, card],
        },
      };

      const newLogs = [
        createLog(
          'draw',
          `${getSideLabel(side)}が墓地からマナ「${card.kanji}」を代わりにドローしました。`,
        ),
        ...state.logs,
      ];

      // 【追加・激】「墓地からひく場合も含む」(includeGraveyardDraw)対応。
      return applyPredictedDrawCheck(
        { ...nextState, logs: newLogs },
        side,
        card.kanji,
      );
    }

    // 【追加・激】「ターンを終了」ボタン割り込みフロー(App.tsx)から、NEXT_PHASEの前に
    // 予想する漢字を保存するためのAction。
    case 'SET_PREDICTED_DRAW_KANJI': {
      const { side, monsterIndex, kanji } = action.payload;
      const player = state[side];
      const target = player.monsters[monsterIndex];
      if (!target) return state;

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = { ...target, predictedDrawKanji: kanji };

      return {
        ...state,
        [side]: { ...player, monsters: updatedMonsters },
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の「${target.name || `モンスター${monsterIndex + 1}`}」が相手の次のドローを「${kanji}」と予想しました。`,
          ),
          ...state.logs,
        ],
      };
    }

    // 【追加・暮/浅/政/激の勝敗接続共通】カード効果由来の勝利条件成立をgameStatusへ反映する。
    // 既に決着済みの場合は上書きしない(evaluateGameStatusの早期returnと同じ防御方針)。
    case 'SET_GAME_STATUS': {
      if (state.gameStatus !== 'playing') return state;
      return {
        ...state,
        gameStatus: action.payload.status,
        logs: [
          createLog(
            'alert',
            action.payload.logMessage ?? '勝利条件が成立しました。',
          ),
          ...state.logs,
        ],
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

      const newLogs = [
        createLog(
          'mana',
          `${getSideLabel(side)}の「${monster.name || `モンスター${monsterIndex + 1}`}」にマナを装備しました。`,
        ),
        ...state.logs,
      ];

      return { ...nextState, logs: newLogs };
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

      const newLogs = [
        createLog(
          'attack',
          `${getSideLabel(newTargetSide)}の山札から ${damagedCards.length} 枚が墓地へ送られました。`,
        ),
        ...state.logs,
      ];

      return { ...nextState, logs: newLogs };
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

      const newLogs = [
        createLog(
          'system',
          `${getSideLabel(side)}の墓地から ${recoveredCards.length} 枚のカードを山札に戻しシャッフルしました。`,
        ),
        ...state.logs,
      ];

      return { ...nextState, logs: newLogs };
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

      const newLogs = [createLog('mana', logMsg), ...state.logs];

      return { ...nextState, logs: newLogs };
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

      const newLogs = [createLog(logType, moveMsg), ...state.logs];

      return { ...nextState, logs: newLogs };
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

    case 'MOVE_CARD_TO_RESERVE': {
      // 【変更・囲】sourceZoneを追加(未指定時は'deck'扱い、保の既存呼び出し箇所との後方互換)。
      // 保(山札由来)・囲(墓地由来)の両方に対応する。
      const {
        side,
        monsterIndex,
        cardIds,
        sourceZone = 'deck',
      } = action.payload;
      const player = state[side];
      const monster = player.monsters[monsterIndex];
      if (!monster) return state;

      const sourceList =
        sourceZone === 'cemetery' ? player.cemetery : player.deck;
      const movingCards: ManaCard[] = [];
      const remainingSourceList = sourceList.filter((c) => {
        if (cardIds.includes(c.id)) {
          movingCards.push(c);
          return false;
        }
        return true;
      });
      if (movingCards.length === 0) return state;

      const updatedMonsters = player.monsters.map((m, idx) =>
        idx === monsterIndex
          ? {
              ...m,
              reservedCards: [...(m.reservedCards ?? []), ...movingCards],
            }
          : m,
      );

      return {
        ...state,
        [side]: {
          ...player,
          [sourceZone]: remainingSourceList,
          monsters: updatedMonsters,
        },
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の「${monster.name || `モンスター${monsterIndex + 1}`}」が${sourceZone === 'cemetery' ? '墓地' : '山札'}から ${movingCards.length} 枚を保持しました。`,
          ),
          ...state.logs,
        ],
      };
    }

    case 'SET_DECK_CARD_TRAP': {
      const { side, cardId, reduceCount, destination } = action.payload;
      const player = state[side];
      const cardExists = player.deck.some((c) => c.id === cardId);
      if (!cardExists) return state;

      const updatedDeck = player.deck.map((c) =>
        c.id === cardId
          ? { ...c, trapEffect: { reduceCount, destination } }
          : c,
      );

      return {
        ...state,
        [side]: {
          ...player,
          deck: updatedDeck,
        },
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の山札のカードにトラップ効果が仕込まれました。`,
          ),
          ...state.logs,
        ],
      };
    }

    // 【追加・政】相手の山札に混入したカード群にseededByタグを付ける。
    // SET_DECK_CARD_TRAP(忍)と同じ「カード実体に直接タグを持たせる」パターン。
    case 'SET_MANA_SEEDED_MARKER': {
      const { side, cardIds, markedBySide } = action.payload;
      const player = state[side];
      const updatedDeck = player.deck.map((c) =>
        cardIds.includes(c.id) ? { ...c, seededBy: { side: markedBySide } } : c,
      );

      return {
        ...state,
        [side]: {
          ...player,
          deck: updatedDeck,
        },
        logs: [
          createLog(
            'system',
            `${getSideLabel(markedBySide)}の政が${getSideLabel(side)}の山札にマナを混入しました。`,
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
          // 【追加・明】シャッフルした側の山札トップ公開フラグを解除する
          deckTopRevealed: false,
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
    case 'GRANT_EXTRA_TURN': {
      return { ...state, pendingExtraTurn: true };
    }

    case 'CONSUME_PASSIVE_EFFECT': {
      const { side, monsterIndex, passiveIndex } = action.payload;
      const player = state[side];
      const target = player.monsters[monsterIndex];
      if (!target) return state;

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...target,
        consumedPassiveIndexes: [
          ...(target.consumedPassiveIndexes ?? []),
          passiveIndex,
        ],
      };

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
        },
      };
    }

    case 'SET_DECK_TOP_REVEALED': {
      const { side, revealed } = action.payload;
      return {
        ...state,
        [side]: {
          ...state[side],
          deckTopRevealed: revealed,
        },
      };
    }

    case 'INCREMENT_ACTIVATION_COUNT': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];
      const target = player.monsters[monsterIndex];
      if (!target) return state;

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...target,
        activationCount: (target.activationCount ?? 0) + 1,
      };

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
        },
      };
    }

    case 'REMOVE_MONSTER_FROM_GAME': {
      const { side, monsterIndex } = action.payload;
      const player = state[side];
      const target = player.monsters[monsterIndex];
      if (!target) return state;

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...target,
        isRemovedFromGame: true,
      };

      const logMsg = `${getSideLabel(side)}の「${target.name || `モンスター${monsterIndex + 1}`}」がゲームから取り除かれました。`;

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
        },
        logs: [createLog('system', logMsg), ...state.logs],
      };
    }

    case 'CONSUME_RESERVED_CARD': {
      const { side, monsterIndex, cardId } = action.payload;
      const player = state[side];
      const target = player.monsters[monsterIndex];
      if (!target) return state;

      const buffer = target.reservedCards ?? [];
      const consumedCard = buffer.find((c) => c.id === cardId);
      if (!consumedCard) return state;

      const updatedMonsters = [...player.monsters];
      updatedMonsters[monsterIndex] = {
        ...target,
        reservedCards: buffer.filter((c) => c.id !== cardId),
      };

      return {
        ...state,
        [side]: {
          ...player,
          monsters: updatedMonsters,
          cemetery: [...player.cemetery, consumedCard],
        },
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の「${target.name || `モンスター${monsterIndex + 1}`}」が囲のバッファを1枚消費し、墓地へ送りました。`,
          ),
          ...state.logs,
        ],
      };
    }

    case 'FORCE_END_OPPONENT_TURN': {
      const { side } = action.payload;
      return {
        ...state,
        turnPlayer: side,
        turnCount: state.turnCount + 1,
        currentPhase: 'start',
        logs: [
          createLog(
            'system',
            `${getSideLabel(side)}の拾が発動し、相手のターンを打ち切って自分のターンを開始しました。`,
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

  // 【追加・暮】あらゆるAction後の状態変化を検知し、即時に勝利条件をチェックする。
  // TRASH_MANA/MOVE_CARD_BETWEEN_ZONES/DAMAGE等、墓地枚数を変化させ得るAction個別に
  // フックを追加する（保修正前の「あちこちで判定」構造の再導入）のではなく、
  // gameState全体の変化を単一のuseEffectで監視することで判定ロジックを1箇所に集約する。
  // 履歴(Undo/Redo)には積まない生のdispatch(useReducer由来)を使う。これは「プレイヤーが
  // 選んだ操作」ではなく、直前の操作に不可分な自動的な結果として扱うため
  // (pendingDrawCards絡みの操作を履歴から除外している既存の isPendingAction 判定と同じ考え方)。
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    const result = evaluateGraveyardThresholdWinConditions(gameState);
    if (result) {
      dispatch({
        type: 'SET_GAME_STATUS',
        payload: { status: result.status, logMessage: result.logMessage },
      });
    }
  }, [gameState]);

  return {
    gameState,
    dispatch: dispatchWithHistory,
    undo: handleUndo,
    canUndo: past.length > 0,
    redo: handleRedo,
    canRedo: future.length > 0,
  };
};
