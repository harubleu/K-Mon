// src/utils/graveyardReactions.ts
//
// 【養】own_kanji_to_graveyard_reaction: 「羊がじぶんの墓地におくられるとき、あいての山札を1まい
// へらす」。効果によってマナが墓地に送られる(手動操作は対象外。囲・吸と同方針)たびに、
// dispatch直前に、送られた羊の枚数分の山札減少を追加する純粋関数。
//
// 設計:
//   - 効果由来のAction列(山札減少・マナ破棄の割り込み処理を通した後のもの)を受け取り、
//     各Actionを順に「軽量シミュレーション」で進めながら、墓地へ送られるカードを検出する。
//   - 追加した山札減少(DAMAGE → applyDeckReducePassives)も墓地送りを起こすため、相手側の
//     養が連鎖する。1巡ごとに盤面をシミュレーションして次の反応を組み立て、上限(MAX_DEPTH)で
//     打ち切る(山札は有限のため通常は自然に終わる)。
//   - 泊で無効化中・裏向き・取り除き済みの養は反応しない(getPassiveListGatedByBan)。
//   - 逆(SWAP_ZONES)による山札・墓地の入れ替えは「墓地送り」として扱わない(FAQ)ため、
//     対象のActionに含めない。
//   - 【設計注記】シミュレーションはこの反応の判定に必要な範囲(山札・墓地・除外・保留領域・
//     装備マナ・保持ゾーン・裏表・消費済みマーク・ドロー)のみを再現する。

import type {
  GameAction,
  GameState,
  ManaCard,
  PlayerSide,
  ZoneType,
} from '../types';
import {
  applyDeckReducePassives,
  getPassiveListGatedByBan,
  resolveSide,
} from './effectExecutor';
import { getEffectiveKanji } from './manaKanji';

const MAX_DEPTH = 8;

type ZoneKey = 'deck' | 'cemetery' | 'exile' | 'pendingDrawCards';

const zoneKey = (zone: ZoneType): ZoneKey =>
  zone === 'pending' ? 'pendingDrawCards' : zone;

// 墓地へ送られるカード(送られる側sideと、そのカード実体)を返す。
function getGraveyardArrivals(
  state: GameState,
  action: GameAction,
): { side: PlayerSide; cards: ManaCard[] }[] {
  switch (action.type) {
    case 'MOVE_CARD_BETWEEN_ZONES': {
      const { sourceSide, targetSide, cardIds, sourceZone, targetZone } =
        action.payload;
      if (targetZone !== 'cemetery') return [];
      if (sourceZone === 'cemetery' && sourceSide === targetSide) return [];
      const cards = state[sourceSide][zoneKey(sourceZone)].filter((c) =>
        cardIds.includes(c.id),
      );
      return cards.length > 0 ? [{ side: targetSide, cards }] : [];
    }
    case 'TRASH_MANA': {
      const { side, monsterIndex, manaCardIds, destination } = action.payload;
      if (destination !== 'cemetery') return [];
      const monster = state[side].monsters[monsterIndex];
      if (!monster) return [];
      const cards = monster.equippedMana.filter(
        (m): m is ManaCard =>
          m !== null &&
          m !== undefined &&
          (manaCardIds === 'all' || manaCardIds.includes(m.id)),
      );
      return cards.length > 0 ? [{ side, cards }] : [];
    }
    case 'CONSUME_RESERVED_CARD': {
      const { side, monsterIndex, cardId } = action.payload;
      const card = state[side].monsters[monsterIndex]?.reservedCards?.find(
        (c) => c.id === cardId,
      );
      return card ? [{ side, cards: [card] }] : [];
    }
    default:
      return [];
  }
}

// 反応の判定に必要な範囲のみを再現する軽量シミュレーション(reducerは呼ばない)。
function simulateAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE_CARD_BETWEEN_ZONES': {
      const { sourceSide, targetSide, cardIds, sourceZone, targetZone } =
        action.payload;
      const srcKey = zoneKey(sourceZone);
      const tgtKey = zoneKey(targetZone);
      const moving = state[sourceSide][srcKey].filter((c) =>
        cardIds.includes(c.id),
      );
      if (moving.length === 0) return state;
      const afterSource: GameState = {
        ...state,
        [sourceSide]: {
          ...state[sourceSide],
          [srcKey]: state[sourceSide][srcKey].filter(
            (c) => !cardIds.includes(c.id),
          ),
        },
      };
      const tgtList = afterSource[targetSide][tgtKey];
      return {
        ...afterSource,
        [targetSide]: {
          ...afterSource[targetSide],
          [tgtKey]:
            targetZone === 'deck'
              ? [...moving, ...tgtList]
              : [...tgtList, ...moving],
        },
      };
    }
    case 'TRASH_MANA': {
      const { side, monsterIndex, manaCardIds, destination } = action.payload;
      const monster = state[side].monsters[monsterIndex];
      if (!monster) return state;
      const trashed: ManaCard[] = [];
      const remaining = monster.equippedMana.map((m) => {
        if (
          m !== null &&
          m !== undefined &&
          (manaCardIds === 'all' || manaCardIds.includes(m.id))
        ) {
          trashed.push(m);
          return null;
        }
        return m;
      });
      if (trashed.length === 0) return state;
      const monsters = state[side].monsters.map((mo, i) =>
        i === monsterIndex ? { ...mo, equippedMana: remaining } : mo,
      );
      return {
        ...state,
        [side]: {
          ...state[side],
          monsters,
          [destination]: [...state[side][destination], ...trashed],
        },
      };
    }
    case 'CONSUME_RESERVED_CARD': {
      const { side, monsterIndex, cardId } = action.payload;
      const monster = state[side].monsters[monsterIndex];
      const card = monster?.reservedCards?.find((c) => c.id === cardId);
      if (!monster || !card) return state;
      const monsters = state[side].monsters.map((mo, i) =>
        i === monsterIndex
          ? {
              ...mo,
              reservedCards: (mo.reservedCards ?? []).filter(
                (c) => c.id !== cardId,
              ),
            }
          : mo,
      );
      return {
        ...state,
        [side]: {
          ...state[side],
          monsters,
          cemetery: [...state[side].cemetery, card],
        },
      };
    }
    case 'CONSUME_PASSIVE_EFFECT': {
      const { side, monsterIndex, passiveIndex } = action.payload;
      const monsters = state[side].monsters.map((mo, i) =>
        i === monsterIndex
          ? {
              ...mo,
              consumedPassiveIndexes: [
                ...(mo.consumedPassiveIndexes ?? []),
                passiveIndex,
              ],
            }
          : mo,
      );
      return { ...state, [side]: { ...state[side], monsters } };
    }
    case 'FLIP_MONSTER': {
      const { side, monsterIndex } = action.payload;
      const monsters = state[side].monsters.map((mo, i) =>
        i === monsterIndex ? { ...mo, isFlipped: !mo.isFlipped } : mo,
      );
      return { ...state, [side]: { ...state[side], monsters } };
    }
    case 'AUTO_DRAW': {
      const side = action.payload.player;
      const [top, ...rest] = state[side].deck;
      if (!top) return state;
      return {
        ...state,
        [side]: {
          ...state[side],
          deck: rest,
          pendingDrawCards: [...state[side].pendingDrawCards, top],
        },
      };
    }
    default:
      return state;
  }
}

/**
 * 効果由来のAction列(actions)により墓地へ送られる羊等を検出し、表向きの養の反応
 * (相手の山札減少)をpipeline適用済みのAction列として返す。戻り値は追加分のみ。
 * gameStateはactionsをdispatchする前の状態。
 */
export function applyGraveyardReactions(
  actions: GameAction[],
  gameState: GameState,
): GameAction[] {
  const extra: GameAction[] = [];
  let state = gameState;
  let batch = actions;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const arrivals: Record<PlayerSide, Record<string, number>> = {
      player: {},
      opponent: {},
    };
    for (const action of batch) {
      for (const arrival of getGraveyardArrivals(state, action)) {
        arrival.cards.forEach((card) => {
          const kanji = getEffectiveKanji(card);
          arrivals[arrival.side][kanji] =
            (arrivals[arrival.side][kanji] ?? 0) + 1;
        });
      }
      state = simulateAction(state, action);
    }

    const next: GameAction[] = [];
    for (const side of ['player', 'opponent'] as PlayerSide[]) {
      const damages: GameAction[] = [];
      state[side].monsters.forEach((monster) => {
        getPassiveListGatedByBan(monster, state, side).forEach((p) => {
          if (p.trigger !== 'own_kanji_to_graveyard_reaction') return;
          const count = arrivals[side][p.targetKanji] ?? 0;
          if (count === 0) return;
          damages.push({
            type: 'DAMAGE',
            payload: {
              targetSide: resolveSide(p.onTrigger.targetSide, side),
              amount: count * p.onTrigger.count,
            },
          });
        });
      });
      if (damages.length > 0) {
        next.push(...applyDeckReducePassives(damages, side, state));
      }
    }

    if (next.length === 0) break;
    extra.push(...next);
    batch = next;
  }

  return extra;
}
