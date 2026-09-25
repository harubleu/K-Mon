// src/utils/drawFlow.ts
//
// ドローボタン(App.tsx handleAutoDraw)から呼ばれる、ドローの種類と簿記の判定(純粋関数)。
// 従来はhandleAutoDraw内に直書きされていたが、命(ターン開始ドローの枚数増加)・仁/花
// (ターン開始ドローの置き換え)・走/命の残りドロー回数の判定が絡んで複雑になったため、
// UIから切り出した(ガイドライン1.3: ロジックはUIコンポーネントに直書きしない)。
//
// 公式QAに基づくルール:
//   - 命の枚数増加と、仁・花の置き換えは「ターンのはじめのドロー」にのみ適用される。
//   - 「ターン開始のドロー」= ターンプレイヤーがそのターン最初に行うドロー
//     (GameState.hasDrawnThisTurn)。命の2枚目(残りドロー回数 kind:'turn_start')もこれに含む。
//   - 走のめくり(残りドロー回数 kind:'effect')は、置き換えの対象外。
//   - それ以外の手動ドローは通常の山札ドロー。

import type {
  GameAction,
  GameState,
  ManaCard,
  PendingDraws,
  PlayerSide,
} from '../types';
import {
  applyDeckReducePassives,
  getFlowWatcher,
  getStarReactionActions,
  getTurnStartDrawCount,
  resolveDrawReplace,
  sideLabel,
} from './effectExecutor';
import { applyGraveyardReactions } from './graveyardReactions';
import { getEffectiveKanji } from './manaKanji';

// AUTO_DRAW / DRAW_REPLACE_FROM_GRAVEYARDのpayloadに載せる簿記フィールド。
// 通常の手動ドローでは空オブジェクト(何も変更しない)。
export interface DrawBookkeeping {
  isTurnStartDraw?: boolean;
  remainingDrawsAfter?: PendingDraws | null;
}

export type DrawPlan =
  | {
      kind: 'deck';
      bookkeeping: DrawBookkeeping;
      // 【今回追加・星/流】ターン開始のドロー(山札から)のとき、ドロー時の反応(星・流)を判定する。
      // 手動の追加ドローは判定しない。
      reactions: boolean;
      // 流(表向き・泊で無効化されていない)がいるとき、ドローの前に予想の入力が必要
      needsPrediction: boolean;
    }
  | { kind: 'graveyard_auto'; cardId: string; bookkeeping: DrawBookkeeping }
  | {
      kind: 'graveyard_choose';
      candidateIds: string[];
      // 選択確定時にDRAW_REPLACE_FROM_GRAVEYARDへ引き継ぐ値(isTurnStartDrawは常にtrue)
      remainingDrawsAfter: PendingDraws | null;
    };

export function planDraw(
  gameState: GameState,
  side: PlayerSide,
  opts: { suppressReplace?: boolean } = {},
): DrawPlan {
  const remaining = gameState[side].remainingDraws;
  const continuation = remaining && remaining.count > 0 ? remaining : null;
  const isFreshTurnStart =
    !continuation &&
    side === gameState.turnPlayer &&
    !gameState.hasDrawnThisTurn;
  const isTurnStartDraw =
    isFreshTurnStart || continuation?.kind === 'turn_start';

  // このドローを含めた、今回分の合計枚数 → このドローの後に残る枚数
  const totalThisRound = continuation
    ? continuation.count
    : isFreshTurnStart
      ? getTurnStartDrawCount(gameState, side)
      : 1;
  const remainingDrawsAfter: PendingDraws | null =
    totalThisRound - 1 > 0
      ? {
          count: totalThisRound - 1,
          kind: continuation ? continuation.kind : 'turn_start',
        }
      : null;

  // 通常の手動ドロー(ターン開始ドローでも残りドローの続きでもない)は簿記を変更しない
  const bookkeeping: DrawBookkeeping =
    continuation || isFreshTurnStart
      ? { isTurnStartDraw, remainingDrawsAfter }
      : {};

  if (opts.suppressReplace || !isTurnStartDraw) {
    return {
      kind: 'deck',
      bookkeeping,
      reactions: isTurnStartDraw,
      needsPrediction: false, // 効果解決中(suppressReplace)は予想モーダルを開かない
    };
  }

  const replace = resolveDrawReplace(gameState, side);
  if (replace.kind === 'auto') {
    return { kind: 'graveyard_auto', cardId: replace.cardId, bookkeeping };
  }
  if (replace.kind === 'choose') {
    return {
      kind: 'graveyard_choose',
      candidateIds: replace.candidateIds,
      remainingDrawsAfter,
    };
  }
  return {
    kind: 'deck',
    bookkeeping,
    reactions: true,
    needsPrediction: getFlowWatcher(gameState, side) !== null,
  };
}

// 【今回追加・星/流】山札からのターン開始ドローに対する反応(pipeline適用済みのAction列)を返す。
// 呼び出し側は「AUTO_DRAW → この戻り値」の順にdispatchする(引いたカードはpendingにある前提)。
//   星: 引いたカードが日・月なら、相手の山札を3枚墓地へ(浮・重・抑・注等の割り込みを適用)
//   流: 予想(prediction)が引いたカードと一致(的中)なら、引いたマナと山札1枚を墓地へ
//       (浮等の軽減で枚数が減った場合、引いたマナは最後に守られる=そのまま引いた状態で残る。
//        公式QA「浮で守られ、普通につけられる」)。
// 山札減少の割り込み処理は、ドロー前の状態(gameState)を基に組み立てる。
export function planDrawReactions(
  gameState: GameState,
  drawerSide: PlayerSide,
  drawn: ManaCard,
  prediction?: string,
): GameAction[] {
  const actions: GameAction[] = [];

  // 星(引いた側=drawerSideが所有)
  const star = getStarReactionActions(gameState, drawerSide, [getEffectiveKanji(drawn)]);
  if (star.length > 0) {
    actions.push(...applyDeckReducePassives(star, drawerSide, gameState));
  }

  // 流(引いた側の相手=watcherSideが所有)
  const flow = getFlowWatcher(gameState, drawerSide);
  if (flow && prediction !== undefined && prediction === getEffectiveKanji(drawn)) {
    const reduced = applyDeckReducePassives(
      [
        {
          type: 'DAMAGE',
          payload: {
            targetSide: drawerSide,
            amount: flow.hitCount,
            logNote: `${sideLabel(flow.watcherSide)}の流(予想的中)`,
          },
        },
      ],
      flow.watcherSide,
      gameState,
    );
    // パイプラインは「山札の上からN枚」をMOVEで返すが、先頭は今まさに引いたマナ
    // (この時点ではpendingにある)。先頭を「pending → 墓地」に組み替える。
    for (const action of reduced) {
      if (
        action.type === 'MOVE_CARD_BETWEEN_ZONES' &&
        action.payload.sourceZone === 'deck' &&
        action.payload.sourceSide === drawerSide &&
        action.payload.cardIds.includes(drawn.id)
      ) {
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            ...action.payload,
            cardIds: [drawn.id],
            sourceZone: 'pending',
          },
        });
        const rest = action.payload.cardIds.filter((id) => id !== drawn.id);
        if (rest.length > 0) {
          actions.push({
            type: 'MOVE_CARD_BETWEEN_ZONES',
            payload: { ...action.payload, cardIds: rest },
          });
        }
      } else {
        actions.push(action);
      }
    }
  }

  return actions;
}

// 【今回追加】山札からのドロー(plan.kind==='deck')で、dispatchすべきAction列を組み立てる。
// AUTO_DRAWの後に、ドロー時の反応(星・流)が続く。
export function buildDeckDrawActions(
  gameState: GameState,
  side: PlayerSide,
  plan: Extract<DrawPlan, { kind: 'deck' }>,
  prediction?: string,
): GameAction[] {
  const draw: GameAction = {
    type: 'AUTO_DRAW',
    payload: { player: side, ...plan.bookkeeping },
  };
  const drawn = gameState[side].deck[0];
  if (!drawn || !plan.reactions) return [draw];
  const withReactions = [
    draw,
    ...planDrawReactions(gameState, side, drawn, prediction),
  ];
  // 【今回追加・養】星・流の山札減少・墓地送りで羊が墓地に送られた場合の、養の反応も続ける。
  return [...withReactions, ...applyGraveyardReactions(withReactions, gameState)];
}
