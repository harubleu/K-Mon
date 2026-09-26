// src/utils/effectSelection.ts
//
// フェーズ5: 「選択が必要な効果」をDeckModal等の対話フローへ橋渡しする層。
// resolveMonsterEffect（effectExecutor.ts）がnullを返した効果に対してのみ呼び出される想定。
//
// - describeSelectionRequirement: 「何を聞くべきか」を判定する（純粋関数）
// - buildActionsFromSelection: ユーザーの回答を受けて最終的なGameAction[]を組み立てる（純粋関数）
// 2つに分けているのは、選択待ちの間に盤面が変化していても、確定時に最新のgameStateで
// 再計算できるようにするため（クロージャに古いstateを抱え込まない）。

import type {
  GameAction,
  GameState,
  ManaCard,
  MonsterCard,
  MonsterEffect,
  PlayerSide,
  ZoneType,
} from '../types';
import type { ExecutorContext } from './effectExecutor';
import {
  resolveSide,
  getOpponentSide,
  getPlayerState,
  resolveRevealCheckActions,
  isMonsterEffectsDisabledByOpponentBan,
  buildJankenOutcomeActions,
  getOpenSlotKanji,
  getWildcardKanji,
} from './effectExecutor';
import { getEffectiveKanji } from './manaKanji';

// --- DeckModalに「カードを選ばせる」ケース ---
export interface DeckSelectRequirement {
  kind: 'deck_select';
  side: PlayerSide; // 開くべき山札の持ち主
  constraint: { min: number; max: number };
  kanjiFilter?: string[]; // 未指定なら全カード選択可
  actionLabel: string; // 確定ボタンのラベル
}

// --- DeckModalの「並び替えモード」を使わせるケース ---
export interface DeckReorderRequirement {
  kind: 'deck_reorder';
  side: PlayerSide;
  scope: 'full' | { partialTopCount: number };
}

// --- 械・泣: 山札を公開せず、全種類から選ぶケース ---
export interface KanjiTypeSelectRequirement {
  kind: 'kanji_type_select';
  kanjiCount: number;
  perTypeLimit?: number; // 1種類あたりの上限(undefined=無制限)
}

// --- 検・派: 山札(の一部)を公開し、実在する種類からのみ選ぶケース ---
export interface DeckKanjiRevealSelectRequirement {
  kind: 'deck_kanji_reveal_select';
  side: PlayerSide; // App.tsx側でのルーティング(どちらのPlayerZoneにDeckModalを開かせるか)に使用
  revealScope: 'full' | number;
  kanjiCount: number;
  perTypeLimit?: number;
  // 【今回追加】trueなら、公開した山札に無い漢字も指定できる(検。公式QA: 相手の山札にない
  // マナを指定できる)。派(上から8枚の中から選ぶ)はfalse。
  allowAnyKanji?: boolean;
}

// --- CemeteryAndExileModalに「墓地のカードを選ばせる」ケース ---
export interface GraveyardSelectRequirement {
  kind: 'graveyard_select';
  side: PlayerSide; // graveyard_select_recover/equipは自分固定。deck_compare_branchは動的に決まる
  constraint: { min: number; max: number };
  kanjiFilter?: string[]; // 未指定なら墓地の全カードが選択可能
  // 【追加】特定のカードIDのみを候補にする（方のsourceRestriction:'just_trashed_by_this_effect'用）
  cardIdFilter?: string[];
  actionLabel: string;
}

// --- 代: 装備マナ1枚と墓地カード1枚を選ばせ、入れ替えるケース(案A: 1組のみ) ---
export interface EquipSwapSelectRequirement {
  kind: 'equip_swap_select';
  side: PlayerSide; // swap_equipped_with_graveyardにtargetSideフィールドは無いため常に自分
}

// --- 斧: 装備マナ＋山札の混在候補からN枚選ぶケース ---
export interface MixedZoneTrashSelectRequirement {
  kind: 'mixed_zone_trash_select';
  side: PlayerSide;
  sources: ('monster_mana' | 'deck')[];
  constraint: { min: number; max: number };
}

// --- 【追加】然: 相手の山札1番上＋相手の墓地を1つの候補プールとして提示し、1枚選ばせるケース ---
export interface ZoneMoveSelectRequirement {
  kind: 'zone_move_select';
  side: PlayerSide; // resolveSide(effect.targetSide, ownerSide)で解決済みの対象側
  sourceOptions: ('deck_top' | 'graveyard')[]; // 候補プールに何を含めるか(現状は常に両方)
}

// --- 反: 対象側のモンスターを選ぶケース ---
export interface MonsterSelectRequirement {
  kind: 'monster_select';
  side: PlayerSide;
  constraint: { min: number; max: number };
  // 【追加】候補から除外するモンスターのindex（生・方の「このカードにはつけられない」用）
  excludeMonsterIndex?: number;
  // 【今回追加】isRemovedFromGame等、候補には出すがクリック不可にするモンスター一覧。
  // 理由(reason)を持たせているのは、excludeMonsterIndex(発動元自身)とグレーアウトの
  // 表示理由をUI側で出し分けるため。現状はremoved_from_gameの1種類のみ。
  disabledMonsters?: { index: number; reason: 'removed_from_game' }[];
}

// --- 刃・屍・死・葬: 数値を選ぶケース ---
export interface NumberSelectRequirement {
  kind: 'number_select';
  minNumber: number;
  maxNumber: number;
}

// --- 二・三: 選択肢から1つ選ぶケース ---
export interface ChoiceOfEffectsSelectRequirement {
  kind: 'choice_of_effects_select';
  options: string[]; // ラベルのみ。選ばれた後の解決はuseEffectExecutor側で再帰的に行う
}

// --- 【追加】言・信・競・招・右・哲: じゃんけんで決着させるケース ---
export interface JankenSelectRequirement {
  kind: 'janken_select';
  restrictOpponentHands?: ('rock' | 'scissors' | 'paper')[]; // 哲: 相手はチョキ・パーのみ
  resolveTieAsOutcome: boolean; // true = あいこも決着として扱う(tieCount定義済み。現状は哲のみ)
}

// --- 【追加】拾: 相手の効果で墓地送りになった自分のマナカードから1枚選び、
// 選んだモンスターに装備するケース(phase2)。phase1(装備先モンスター選択)は
// 既存のMonsterSelectRequirementをそのまま流用する(生・方と同じ2段階選択パターン)。
export interface PickupSelectRequirement {
  kind: 'pickup_select';
  side: PlayerSide;
  candidates: { id: string; kanji: string; reading: string }[];
}

// --- 【追加】国: 対象(自分/相手)×領域(山札/墓地)の4通りから1つ選ばせるケース。
// UIはChoiceOfEffectsModalを流用するが、既存choice_of_effects(二・三)とは異なるeffectId
// (deck_or_graveyard_count_win_condition)から発行されるため、専用のkindとして区別する
// (App.tsx側のchoiceOfEffectsPropsがeffect.effectId==='choice_of_effects'限定のガードを
// 持っているため、同じkindを共用すると国側が描画されなくなるのを避けるための分離)。
// optionsの順序は常に固定: [自分の山札, 自分の墓地, 相手の山札, 相手の墓地]。
export interface ZoneTargetSelectRequirement {
  kind: 'zone_target_select';
  options: string[];
}

// --- 【追加】究: 相手の山札の構成(漢字種類ごとの枚数)を丸ごと申告させるケース。
export interface DeckCompositionPredictRequirement {
  kind: 'deck_composition_predict';
}

// 【追加】
// --- 兄・各・共・生・方(graveyard_select_equip、monsterTargetMode指定時): 墓地のカードと
// 装備先モンスターの空きスロットをペアリングして選ばせるケース。pairCountちょうどの
// ペアが揃うまで確定できない(部分確定は許容しない)。
export interface GraveyardEquipSelectRequirement {
  kind: 'graveyard_equip_select';
  side: PlayerSide;
  pairCount: number;
  kanjiFilter?: string[];
  cardIdFilter?: string[];
  excludeMonsterIndex?: number;
  disabledMonsters?: { index: number; reason: 'removed_from_game' }[];
  // 【今回追加・方】trueなら全ペアを同一モンスターへ強制する。
  singleMonster?: boolean;
}

// --- 方: 山札の上から1枚ずつめくり、送るかどうかを都度決めるケース ---
export interface DeckIterativeSelectRequirement {
  kind: 'deck_iterative_select';
  side: PlayerSide;
  maxCount: number;
  sentCount: number; // これまでに送った枚数(現在表示中のカードは含まない)
}

export type SelectionRequirement =
  | DeckSelectRequirement
  | DeckIterativeSelectRequirement
  | DeckReorderRequirement
  | KanjiTypeSelectRequirement
  | DeckKanjiRevealSelectRequirement
  | GraveyardSelectRequirement
  | GraveyardEquipSelectRequirement
  | EquipSwapSelectRequirement
  | MixedZoneTrashSelectRequirement
  | MonsterSelectRequirement
  | NumberSelectRequirement
  | ChoiceOfEffectsSelectRequirement
  | JankenSelectRequirement
  | ZoneMoveSelectRequirement
  | PickupSelectRequirement
  | ZoneTargetSelectRequirement
  | DeckCompositionPredictRequirement;

// 【今回追加】isRemovedFromGame横断フィルタ:
// monster_selectを発行する箇所は必ずこのヘルパーを経由し、disabledMonstersを算出する。
// デフォルトはisRemovedFromGame===trueの全モンスターを無効化対象に含める。
// 「操」(copy_opponent_monster_effect)のみ例外: 相手モンスターの状態を隠さず全て候補に
// 出す既存方針(design書7.29.1節で確定済み)のため、常に空配列を返す。
function getDisabledMonstersForSelect(
  effectId: MonsterEffect['effectId'],
  monsters: MonsterCard[],
): { index: number; reason: 'removed_from_game' }[] {
  if (effectId === 'copy_opponent_monster_effect') return [];
  return monsters
    .map((monster, index) => ({ monster, index }))
    .filter(({ monster }) => monster.isRemovedFromGame === true)
    .map(({ index }) => ({ index, reason: 'removed_from_game' as const }));
}

// 【今回追加・花】空きスロット(openKanji)につけられるカードか。花が表向きなら、万能マナ
// (屮)は空きスロットがあればどの漢字のスロットにもつけられる(装備時にそのスロットの
// 漢字へ自動で色が指定される)。それ以外は、実効的な漢字が空きスロットの漢字と一致すること。
function canFillOpenSlot(
  card: ManaCard,
  openKanji: string[],
  wildcardKanji: string | null,
): boolean {
  if (openKanji.length === 0) return false;
  return (
    openKanji.includes(getEffectiveKanji(card)) ||
    (wildcardKanji !== null && card.kanji === wildcardKanji)
  );
}

/**
 * resolveMonsterEffectがnullを返した効果に対して、既存UIへの誘導が可能か判定する。
 * 対応するUIがまだ無い効果はnullを返す。
 */
export function describeSelectionRequirement(
  effect: MonsterEffect,
  ctx: ExecutorContext,
): SelectionRequirement | null {
  switch (effect.effectId) {
    // ============ 今回実装: DeckModalでの選択 ============
    case 'deck_select_trash': {
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      const constraint =
        effect.count !== undefined
          ? { min: effect.count, max: effect.count }
          : { min: 0, max: effect.maxCount ?? 0 };
      return {
        kind: 'deck_select',
        side,
        constraint,
        actionLabel: '選択したカードを破棄',
      };
    }

    // 【今回改訂】令・草: graveyard_select_equipと同じ多段階選択(phase1: 装備先モンスター、
    // phase2: 山札のカード)。従来は装備先が発動元自身に固定されていた(草の「このカードには
    // つけられない」も無視されていた)。装備先の空きスロットに対応する漢字のカードだけを
    // 候補にし(7.18章と同方針)、選択可能枚数も実際の候補数で頭打ちにする。
    case 'deck_select_equip':
    case 'deck_kanji_search_equip': {
      const ownMonsters = getPlayerState(ctx.gameState, ctx.ownerSide).monsters;
      if (
        effect.monsterTargetMode &&
        ctx.equipTargetMonsterIndex === undefined
      ) {
        if (ctx.sourceMonsterIndex === undefined) return null;
        return {
          kind: 'monster_select',
          side: ctx.ownerSide,
          constraint: { min: 1, max: 1 },
          excludeMonsterIndex:
            effect.monsterTargetMode === 'exclude_self'
              ? ctx.sourceMonsterIndex
              : undefined,
          disabledMonsters: getDisabledMonstersForSelect(
            effect.effectId,
            ownMonsters,
          ),
        };
      }

      const targetIdx = ctx.equipTargetMonsterIndex ?? ctx.sourceMonsterIndex;
      const target =
        targetIdx !== undefined ? ownMonsters[targetIdx] : undefined;
      if (!target) return null;
      const deck = getPlayerState(ctx.gameState, ctx.ownerSide).deck;
      const openSlots = getOpenSlotKanji(target);

      const wildcard = getWildcardKanji(ctx.gameState, ctx.ownerSide);

      if (effect.effectId === 'deck_kanji_search_equip') {
        // 花が表向きで、対象の漢字が万能マナ(屮)自身なら、どの空きスロットにもつけられる
        const openCount =
          wildcard === effect.targetKanji
            ? openSlots.length
            : openSlots.filter((k) => k === effect.targetKanji).length;
        const deckCount = deck.filter(
          (c) =>
            getEffectiveKanji(c) === effect.targetKanji ||
            c.kanji === effect.targetKanji,
        ).length;
        const cappedMax = Math.min(effect.maxCount, openCount, deckCount);
        if (cappedMax === 0) return null; // 装備できる候補が無ければ効果不発
        return {
          kind: 'deck_select',
          side: ctx.ownerSide,
          constraint: { min: 0, max: cappedMax },
          kanjiFilter: [effect.targetKanji],
          actionLabel: '選択したカードを装備',
        };
      }

      const openKanji = Array.from(new Set(openSlots));
      const eligibleCount = deck.filter((c) =>
        canFillOpenSlot(c, openKanji, wildcard),
      ).length;
      const cappedCount = Math.min(effect.count, eligibleCount);
      if (cappedCount === 0) return null;
      return {
        kind: 'deck_select',
        side: ctx.ownerSide,
        constraint: { min: cappedCount, max: cappedCount },
        kanjiFilter: wildcard ? [...openKanji, wildcard] : openKanji,
        actionLabel: '選択したカードを装備',
      };
    }

    // ============ 今回実装: DeckModalでの並び替え ============
    // 【今回改訂】'both'（並・詳）を新規対応。1巡目はctx.ownerSide、2巡目は相手側の順で
    // 逐次実行する(出のforcedSideと同型の「PendingSelectionに次巡の対象を持たせる」方式)。
    // 1巡目かどうかはctx.forcedSide未指定で判定する。
    case 'deck_full_reorder': {
      if (effect.targetSide === 'both') {
        const side = ctx.forcedSide ?? ctx.ownerSide;
        return { kind: 'deck_reorder', side, scope: 'full' };
      }
      const side = resolveSide(effect.targetSide ?? 'self', ctx.ownerSide);
      return { kind: 'deck_reorder', side, scope: 'full' };
    }

    // 【今回実装】詳・美。
    // 詳(targetSide:'both')：並と同じ2巡ロジック。faceUp:trueならscope.faceUpも伝える。
    // 美(targetSide:'choose')：phase1でzone_target_select(2択)、確定後にctx.reorderTargetSideを
    // 見てphase2(deck_reorder本体)へ進む、生方のexcludeSelfと同型の多段階選択パターン。
    case 'deck_partial_reorder': {
      if (effect.targetSide === 'choose') {
        if (ctx.reorderTargetSide === undefined) {
          return {
            kind: 'zone_target_select',
            options: ['自分の山札', '相手の山札'],
          };
        }
        return {
          kind: 'deck_reorder',
          side: ctx.reorderTargetSide,
          scope: { partialTopCount: effect.count },
        };
      }
      if (effect.targetSide === 'both') {
        const side = ctx.forcedSide ?? ctx.ownerSide;
        return {
          kind: 'deck_reorder',
          side,
          scope: { partialTopCount: effect.count },
        };
      }
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      return {
        kind: 'deck_reorder',
        side,
        scope: { partialTopCount: effect.count },
      };
    }

    case 'deck_kanji_purge': {
      const kanjiCount = effect.kanjiCount ?? 1;
      const perTypeLimit = effect.count;
      if (effect.revealScope === undefined) {
        // 械・泣: 公開せず、全種類から選べる
        return { kind: 'kanji_type_select', kanjiCount, perTypeLimit };
      }
      // 検・派: 公開した範囲に実在する種類からのみ選べる。対象は常に相手の山札(実データ4件で確認)
      return {
        kind: 'deck_kanji_reveal_select',
        side: getOpponentSide(ctx.ownerSide),
        revealScope: effect.revealScope,
        kanjiCount,
        perTypeLimit,
        allowAnyKanji: effect.revealScope === 'full',
      };
    }

    case 'graveyard_select_recover': {
      if (effect.count === 'all') return null; // resolveMonsterEffect側で自動解決される想定
      // 【追加・友】墓地の実際の枚数で頭打ちにする(墓地が指定枚数未満でも選択できるように)
      const cemetery = getPlayerState(ctx.gameState, ctx.ownerSide).cemetery;
      const cappedCount = Math.min(effect.count, cemetery.length);
      if (cappedCount === 0) return null;
      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: cappedCount, max: cappedCount },
        actionLabel: '選択したカードを山札に戻す',
      };
    }

    case 'graveyard_select_equip': {
      // monsterTargetMode未指定(現状該当カード無し。将来のため維持): 発動元自身へ固定装備。
      if (!effect.monsterTargetMode) {
        if (ctx.sourceMonsterIndex === undefined) return null;
        const targetMonster = getPlayerState(ctx.gameState, ctx.ownerSide)
          .monsters[ctx.sourceMonsterIndex];
        if (!targetMonster) return null;
        const availableKanji = Array.from(
          new Set(getOpenSlotKanji(targetMonster)),
        );
        const cemetery = getPlayerState(ctx.gameState, ctx.ownerSide).cemetery;
        const wildcard = getWildcardKanji(ctx.gameState, ctx.ownerSide);
        const eligibleCount = cemetery.filter((c) =>
          canFillOpenSlot(c, availableKanji, wildcard),
        ).length;
        const cappedCount = Math.min(effect.count, eligibleCount);
        if (cappedCount === 0) return null;
        return {
          kind: 'graveyard_select',
          side: ctx.ownerSide,
          constraint: { min: cappedCount, max: cappedCount },
          kanjiFilter:
            availableKanji.length > 0 && wildcard
              ? [...availableKanji, wildcard]
              : availableKanji,
          actionLabel: '選択したカードを装備',
        };
      }

      // 【今回改訂・重大】monsterTargetMode指定時(兄・各・共・生・方)は、モンスター先選択
      // (単一モンスター前提)を廃止し、「墓地カード×装備先スロット」のペアリングモーダルへ
      // 一本化する。生(装備先を分散できる)がこの単一モンスター前提と食い違い、常に1体へ
      // まとめて装備されてしまう不具合があったため。
      const ownMonsters = getPlayerState(ctx.gameState, ctx.ownerSide).monsters;
      const cemetery = getPlayerState(ctx.gameState, ctx.ownerSide).cemetery;
      const wildcard = getWildcardKanji(ctx.gameState, ctx.ownerSide);
      const restrictionFilter =
        effect.sourceRestriction === 'just_trashed_by_this_effect'
          ? ctx.justTrashedCardIds
          : undefined;
      const excludeIdx =
        effect.monsterTargetMode === 'exclude_self'
          ? ctx.sourceMonsterIndex
          : undefined;

      const eligibleMonsters = ownMonsters
        .map((m, i) => ({ m, i }))
        .filter(({ i, m }) => i !== excludeIdx && !m.isRemovedFromGame);
      const openKanjiSet = new Set<string>();
      eligibleMonsters.forEach(({ m }) =>
        getOpenSlotKanji(m).forEach((k) => openKanjiSet.add(k)),
      );
      const openKanjiList = Array.from(openKanjiSet);

      const eligibleCards = cemetery.filter((c) => {
        if (restrictionFilter && !restrictionFilter.includes(c.id))
          return false;
        return canFillOpenSlot(c, openKanjiList, wildcard);
      });
      const cappedCount = Math.min(effect.count, eligibleCards.length);
      if (cappedCount === 0) return null;

      return {
        kind: 'graveyard_equip_select',
        side: ctx.ownerSide,
        pairCount: cappedCount,
        kanjiFilter:
          openKanjiList.length > 0 && wildcard
            ? [...openKanjiList, wildcard]
            : openKanjiList,
        cardIdFilter: restrictionFilter,
        excludeMonsterIndex: excludeIdx,
        disabledMonsters: getDisabledMonstersForSelect(
          effect.effectId,
          ownMonsters,
        ),
        singleMonster: effect.singleTargetMonster,
      };
    }

    case 'deck_normalize_to_count': {
      // resolveMonsterEffect側で山札超過時は既に自動解決されているため、ここに来るのは不足時のみ
      const deck = getPlayerState(ctx.gameState, ctx.ownerSide).deck;
      const shortage = effect.targetCount - deck.length;
      if (shortage <= 0) return null; // 念のため(理論上到達しないはず)
      const cemetery = getPlayerState(ctx.gameState, ctx.ownerSide).cemetery;
      // 墓地が不足分に満たない場合の挙動が原文から不明なため、現状は未対応としておく(要確認)
      if (cemetery.length < shortage) return null;
      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: shortage, max: shortage },
        actionLabel: '選択したカードを山札に戻す',
      };
    }

    case 'swap_equipped_with_graveyard':
      // 【案A】maxCountに関わらず1組のみのスワップとして扱う。
      // 複数組の同時交換(連鎖選択UI)は将来のアーキテクチャ拡張時に対応する。
      return { kind: 'equip_swap_select', side: ctx.ownerSide };

    case 'mixed_zone_select_trash': {
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      return {
        kind: 'mixed_zone_trash_select',
        side,
        sources: effect.sources,
        constraint: { min: effect.count, max: effect.count },
      };
    }

    case 'graveyard_recover_then_deck_trash_matching_count':
      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: 0, max: effect.maxRecoverCount },
        kanjiFilter: [effect.recoverKanji],
        actionLabel: '選択したカードを山札に戻す',
      };

    // 【追加】囲: 墓地からマナを2枚選び、reservedCardsへ並べる（保持ゾーンの充填）。
    // graveyard_select_recoverと似た「墓地カードを選ぶ」UIだが行き先がreservedCardsである点が異なる。
    case 'graveyard_partial_to_reserve': {
      if (ctx.sourceMonsterIndex === undefined) return null;
      const cemetery = getPlayerState(ctx.gameState, ctx.ownerSide).cemetery;
      const cappedCount = Math.min(effect.count, cemetery.length);
      if (cappedCount === 0) return null;
      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: cappedCount, max: cappedCount },
        actionLabel: 'このモンスターの前に並べる',
      };
    }

    // 【追加】政: 自分の墓地から、相手のデッキ構成(山札/装備中/保持/墓地/除外の全領域合計)に
    // 存在しない漢字種類のマナを1~maxCount枚選ぶ。候補漢字が0種類(相手が全種類を保有)の場合は
    // 不発(null)。選べる枚数は「候補漢字に一致する自分の墓地の実枚数」でも頭打ちにする。
    case 'deck_seed_mana_win_condition': {
      if (ctx.sourceMonsterIndex === undefined) return null;
      const opponentSide = getOpponentSide(ctx.ownerSide);
      const opp = getPlayerState(ctx.gameState, opponentSide);
      const opponentKanjiSet = new Set<string>();
      opp.deck.forEach((c) => opponentKanjiSet.add(c.kanji));
      opp.cemetery.forEach((c) => opponentKanjiSet.add(c.kanji));
      opp.exile.forEach((c) => opponentKanjiSet.add(c.kanji));
      opp.monsters.forEach((m) => {
        m.equippedMana.forEach((c) => c && opponentKanjiSet.add(c.kanji));
        (m.reservedCards ?? []).forEach((c) => opponentKanjiSet.add(c.kanji));
      });

      const cemetery = getPlayerState(ctx.gameState, ctx.ownerSide).cemetery;
      const eligibleCards = cemetery.filter(
        (c) => !opponentKanjiSet.has(c.kanji),
      );
      if (eligibleCards.length === 0) return null; // 候補0件なら不発

      const eligibleKanji = Array.from(
        new Set(eligibleCards.map((c) => c.kanji)),
      );
      const cappedMax = Math.min(effect.maxCount, eligibleCards.length);
      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: 1, max: cappedMax },
        kanjiFilter: eligibleKanji,
        actionLabel: '選択したカードを相手の山札に混入する',
      };
    }

    // 【追加】操: 相手のモンスターを1体選ぶ(制限なし)。選ばれたモンスターのeffectの解決は
    // useEffectExecutor.ts側の再帰処理(tryExecute)に委ねる(choice_of_effectsと同じ設計)。
    case 'copy_opponent_monster_effect': {
      const side = getOpponentSide(ctx.ownerSide);
      return {
        kind: 'monster_select',
        side,
        constraint: { min: 1, max: 1 },
        // 操は例外的に無効化しない(getDisabledMonstersForSelectが空配列を返す)。
        disabledMonsters: getDisabledMonstersForSelect(
          effect.effectId,
          getPlayerState(ctx.gameState, side).monsters,
        ),
      };
    }

    case 'flip_monster_facedown': {
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      return {
        kind: 'monster_select',
        side,
        constraint: { min: effect.count, max: effect.count },
        disabledMonsters: getDisabledMonstersForSelect(
          effect.effectId,
          getPlayerState(ctx.gameState, side).monsters,
        ),
      };
    }

    case 'graveyard_auto_equip_by_target_slots': {
      // 採: 自分のモンスターを1体選ぶ(自分自身は除外)。マナの選定・装備は
      // buildActionsFromSelection側で完全自動(選択UIを介さない)。
      if (ctx.sourceMonsterIndex === undefined) return null;
      return {
        kind: 'monster_select',
        side: ctx.ownerSide,
        constraint: { min: 1, max: 1 },
        excludeMonsterIndex: ctx.sourceMonsterIndex,
        disabledMonsters: getDisabledMonstersForSelect(
          effect.effectId,
          getPlayerState(ctx.gameState, ctx.ownerSide).monsters,
        ),
      };
    }

    case 'choose_number_reduce':
      return {
        kind: 'number_select',
        minNumber: 1,
        maxNumber: effect.maxNumber,
      };

    case 'choose_number_reduce_both':
      return {
        kind: 'number_select',
        minNumber: 1,
        maxNumber: effect.maxNumber,
      };

    // 【追加】保: 山札の下から残す枚数を選ばせ、残りをreservedCardsへ送る。
    // NumberSelectRequirementを流用(刃・屍・死・葬と同じ「数値を1つ選ぶ」UI)。
    // maxNumberは現在の山札枚数(発動時点で変動するため動的に算出)。
    case 'deck_partial_to_reserve': {
      const deck = getPlayerState(ctx.gameState, ctx.ownerSide).deck;
      // 【今回改訂】公式QA: このカードの上に置く枚数はゼロにできない。選ぶ数値は「山札に
      // 残す枚数」なので、最大は山札枚数-1(最低1枚は置く)。山札が空なら発動できない。
      if (deck.length === 0) return null;
      return {
        kind: 'number_select',
        minNumber: 0,
        maxNumber: deck.length - 1,
      };
    }

    case 'choice_of_effects':
      return {
        kind: 'choice_of_effects_select',
        options: effect.options.map((o) => o.label),
      };

    // ============ 【追加】じゃんけん系(言・信・競・招・右・哲) ============
    // 詩(m00041)はpassiveEffect.own_turn_start内にネストされておりmonster.effectを見る
    // 発動トリガーUIの対象外(然と同じ問題)。own_turn_startパイプライン実装まで対応不可。
    case 'janken_conditional_reduce':
      return {
        kind: 'janken_select',
        restrictOpponentHands: effect.restrictOpponentHands,
        resolveTieAsOutcome: effect.tieCount !== undefined,
      };

    // ============ 【追加】予想系: KanjiTypePickerModal流用(告・呪・推・竜・善・名) ============
    case 'deck_predict_reveal_reduce':
      return { kind: 'kanji_type_select', kanjiCount: 1 };

    // ============ 【追加】誓のみ(targetKanji未指定)。煉・初・朝はresolveMonsterEffectで自動解決済み ============
    case 'deck_reveal_kanji_check': {
      if (effect.targetKanji !== undefined) return null;
      return { kind: 'kanji_type_select', kanjiCount: 1 };
    }

    // ============ 【追加】出: 少ない方を動的に判定し、graveyard_select_recoverへ委譲 ============
    case 'deck_compare_branch': {
      if (effect.fewerSideEffect.effectId !== 'graveyard_select_recover')
        return null;
      const inner = effect.fewerSideEffect;
      if (inner.count === 'all') return null;

      // 【追加】2巡目呼び出し(同数ケースのopponent側)。forcedSideがあれば
      // 比較計算をスキップしてそのままそのsideを対象にする。
      if (ctx.forcedSide) {
        return {
          kind: 'graveyard_select',
          side: ctx.forcedSide,
          constraint: { min: inner.count, max: inner.count },
          actionLabel: '選択したカードを山札に戻す',
        };
      }

      const selfDeck = getPlayerState(ctx.gameState, ctx.ownerSide).deck;
      const oppDeck = getPlayerState(
        ctx.gameState,
        getOpponentSide(ctx.ownerSide),
      ).deck;

      // 【今回実装】同数(案B: 両者とも回復)。1巡目は自分側から選ばせ、
      // 確定後にuseEffectExecutor.ts側が相手側を2巡目としてつなげる。
      if (selfDeck.length === oppDeck.length) {
        return {
          kind: 'graveyard_select',
          side: ctx.ownerSide,
          constraint: { min: inner.count, max: inner.count },
          actionLabel: '選択したカードを山札に戻す',
        };
      }

      const fewerSide =
        selfDeck.length < oppDeck.length
          ? ctx.ownerSide
          : getOpponentSide(ctx.ownerSide);

      return {
        kind: 'graveyard_select',
        side: fewerSide,
        constraint: { min: inner.count, max: inner.count },
        actionLabel: '選択したカードを山札に戻す',
      };
    }

    // 【追加】然: 相手の山札1番上＋相手の墓地を合算候補として提示する。
    // 「山札1番上は常に0〜1枚・墓地は0枚以上」という非対称性はUI側(ZoneMoveSelectModal)が
    // グループ分け表示で吸収し、SelectionRequirement自体はどちらのソースを含めるかのみを渡す。
    case 'select_zone_move_one': {
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      return {
        kind: 'zone_move_select',
        side,
        sourceOptions: effect.sourceOptions,
      };
    }

    // 【追加】進: trash_monster_mana(targetScope:'select')。斧(mixed_zone_select_trash)の
    // 「装備マナ＋山札の混在候補」UIを、装備マナのみ(sources:['monster_mana'])に絞って再利用する。
    case 'trash_monster_mana': {
      // 'single'は現状未対応(要件不明のため保留)。'all'はresolveMonsterEffect側で自動解決される。
      if (effect.targetScope !== 'select') return null;
      // 【assumption】'all'ケースの既存実装が常にopponent固定(全確認例で確認済み)であるのに倣い、
      // 'select'も相手モンスターのマナを対象とする前提で実装する。type定義にtargetSideフィールドが
      // 無く、'select'を使うのは進(m00069)1件のみで他に突き合わせ対象が無いため、この前提が崩れる
      // 実例が今後見つかった場合は要修正。
      const side = getOpponentSide(ctx.ownerSide);
      return {
        kind: 'mixed_zone_trash_select',
        side,
        sources: ['monster_mana'],
        constraint: { min: effect.count ?? 1, max: effect.count ?? 1 },
      };
    }

    case 'monster_remove_from_game': {
      // 認・獄: 原文確認済み。対象は常に相手モンスター(全確認例で「あいてのモンスター」)。
      const side = getOpponentSide(ctx.ownerSide);
      return {
        kind: 'monster_select',
        side,
        constraint: { min: effect.count, max: effect.count },
        disabledMonsters: getDisabledMonstersForSelect(
          effect.effectId,
          getPlayerState(ctx.gameState, side).monsters,
        ),
      };
    }

    // ============ 【今回実装】国: 対象×領域の4通りから1つ選ばせる ============
    case 'deck_or_graveyard_count_win_condition': {
      if (effect.scope !== 'either_player_either_zone') return null;
      return {
        kind: 'zone_target_select',
        options: ['自分の山札', '自分の墓地', '相手の山札', '相手の墓地'],
      };
    }

    // ============ 【今回実装】究: 相手の山札構成を丸ごと申告させる ============
    case 'deck_predict_full_composition_win':
      return { kind: 'deck_composition_predict' };

    // 【追加】方: 山札の上から1枚ずつ公開しながら、送るか止めるかを決める。
    case 'deck_iterative_select_trash': {
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      const deck = getPlayerState(ctx.gameState, side).deck;
      if (deck.length === 0) return null; // 山札が空なら発動不可
      return {
        kind: 'deck_iterative_select',
        side,
        maxCount: effect.maxCount,
        sentCount: 0, // 2巡目以降はuseEffectExecutor.ts側で直接次のrequirementを組み立てる
      };
    }
    // ============ 見送り: 該当カードなし（旧・詳/美のみで、今回対応済み） ============

    // ============ そもそも選択不要(resolveMonsterEffectで自動解決されるはずの効果) ============
    // ここに来ることは基本ないが、呼び出し順序の誤り等で来た場合に備えnullを返す
    case 'deck_reduce_fixed':
    case 'graveyard_kanji_count_threshold':
    case 'graveyard_kanji_count_linear':
    case 'deck_keep_rest_trash':
    case 'deck_compare_reduce':
    case 'deck_iterative_reveal_until_condition':
    case 'draw_and_play_n':
    case 'swap_deck_and_graveyard':
    case 'deck_mark_delayed_reduce':
    case 'deck_reduce_grant_extra_turn':
    case 'reveal_both_top_until_shuffle':
    case 'deck_reduce_scaling_by_activation_count':
    case 'deck_count_win_or_reduce':
    case 'deck_diff_threshold_win_or_reduce':
    case 'graveyard_total_count_threshold_win':
    case 'deck_count_tiered_effect':
      return null;

    // ============ sequence / custom ============
    // sequence: 内部にdeck_select系ステップを含む場合の対話フロー連鎖は今回未対応
    case 'sequence':
    case 'custom':
      return null;

    default: {
      // 網羅性チェック: 新しいeffectIdが追加されたのにこのswitchへの反映を忘れると
      // コンパイルエラーで気づける(effectExecutor.tsと同じパターン)
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}

// 選択された漢字種類群にマッチする山札カードのIDを集める。
// scopeLimitがundefinedなら山札全体、numberなら上からその枚数だけを検索範囲にする(派用)。
function collectKanjiPurgeCardIds(
  gameState: GameState,
  side: PlayerSide,
  selectedKanji: string[],
  perTypeLimit: number | undefined,
  scopeLimit: number | undefined,
): string[] {
  const deck = getPlayerState(gameState, side).deck;
  const scope = scopeLimit === undefined ? deck : deck.slice(0, scopeLimit);
  const cardIds: string[] = [];
  for (const kanji of selectedKanji) {
    const matches = scope.filter((c) => getEffectiveKanji(c) === kanji);
    const taken =
      perTypeLimit === undefined ? matches : matches.slice(0, perTypeLimit);
    cardIds.push(...taken.map((c) => c.id));
  }
  return cardIds;
}

// --- ユーザーの回答 ---
export type EffectSelectionAnswer =
  | { kind: 'deck_select'; selectedCardIds: string[] }
  | { kind: 'deck_reorder'; orderedCardIds: string[] }
  | { kind: 'kanji_type_select'; selectedKanji: string[] }
  | { kind: 'deck_kanji_reveal_select'; selectedKanji: string[] }
  | { kind: 'graveyard_select'; selectedCardIds: string[] }
  | {
      kind: 'equip_swap_select';
      equippedManaId: string;
      graveyardCardId: string;
    }
  | { kind: 'mixed_zone_trash_select'; selectedCardIds: string[] }
  | { kind: 'monster_select'; selectedMonsterIndexes: number[] }
  | { kind: 'number_select'; selectedNumber: number }
  // 【訂正】buildActionsFromSelection内では未使用(useEffectExecutor.ts側で
  // choice_of_effectsのケースとして先に横取りされるため到達しない)だが、
  // confirmSelectionの引数型としては必要なため、EffectSelectionAnswer自体には含める。
  | { kind: 'choice_of_effects_select'; selectedIndex: number }
  // 【追加】じゃんけんの決着結果。JankenModal内部でランダムに決着し、その結果のみを返す
  // (「何を選んだか」ではなく「どう決着したか」を返す点が他のkindと異なる)。
  | { kind: 'janken_select'; outcome: 'win' | 'tie' | 'lose' }
  // 【追加】然: 選ばれたカードID(山札1番上か墓地のいずれか)を返す
  | { kind: 'zone_move_select'; selectedCardId: string }
  // 【追加】拾: phase2で選ばれた、装備するマナカードのIDを返す
  | { kind: 'pickup_select'; selectedCardId: string }
  // 【追加】国: 選ばれた対象(自分/相手×山札/墓地)のindex(0〜3、順序はdescribeSelectionRequirement
  // のoptionsと同じ固定順)を返す
  | { kind: 'zone_target_select'; selectedIndex: number }
  | {
      // 【追加】
      kind: 'graveyard_equip_select';
      pairs: { cardId: string; monsterIndex: number; slotIndex: number }[];
    }
  // 【追加】究: 申告した山札構成(漢字→枚数のマップ。0枚の種類はキー自体を含めなくてよい)を返す
  | { kind: 'deck_composition_predict'; composition: Record<string, number> }
  | { kind: 'deck_iterative_select'; action: 'stop' | 'continue' };

/**
 * describeSelectionRequirementで示した内容に対する回答(answer)を受けて、
 * 最終的なGameAction[]を組み立てる。回答の形式が効果と噛み合わない場合や、
 * 未実装の効果の場合はnullを返す。
 */
export function buildActionsFromSelection(
  effect: MonsterEffect,
  ctx: ExecutorContext,
  answer: EffectSelectionAnswer,
): GameAction[] | null {
  // 【今回追加・泊】resolveMonsterEffectと同じガード。選択UI自体は通常通り出すが
  // (describeSelectionRequirementは変更しない)、確定時のActionは空にする
  // (「発動はするが効果は無効」)。nullではなく空配列[]を返す(nullはanswer.kind
  // 不一致等の別の意味を持つ既存の意味論のため、混同を避ける)。
  if (isMonsterEffectsDisabledByOpponentBan(ctx.gameState, ctx.ownerSide)) {
    return [];
  }

  switch (effect.effectId) {
    case 'deck_select_trash': {
      if (answer.kind !== 'deck_select') return null;
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      const actions: GameAction[] = [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds: answer.selectedCardIds,
            sourceZone: 'deck',
            targetZone: effect.destination,
            // 【今回追加・横展開】化(graveyard_recover_then_deck_trash_matching_count)で
            // 発見した「永続パッシブ割り込みパイプラインがcardIdsを無視し山札の上からN枚に
            // 作り直す」問題への対応。deck_select_trashは山札から任意の(非連続な)カードを
            // 自由選択する効果のため、選択結果をpreferredCardIdsとして明示的に優先採用させる。
            // 単発発動(負・吐・探・正)・sequence内のstep1(識・生・方)いずれもこのcaseを
            // 経由するため、7体全てに一括で波及する。amountが選択枚数を上回る場合(boost等で
            // 増えた場合)は、buildDeckReduceAction側で不足分を山札上部から自動補完する。
            preferredCardIds: answer.selectedCardIds,
          },
        },
      ];
      if (effect.shuffleAfter) {
        actions.push({ type: 'SHUFFLE_DECK', payload: { side } });
      }
      return actions;
    }

    case 'deck_select_equip':
    case 'deck_kanji_search_equip': {
      if (answer.kind !== 'deck_select') return null;
      // 【今回改訂】phase1(monster_select)で装備先が選ばれていればそちらを優先
      // (graveyard_select_equipと同じ扱い)。未選択なら従来通り発動元自身。
      const equipTargetIndex =
        ctx.equipTargetMonsterIndex ?? ctx.sourceMonsterIndex;
      if (equipTargetIndex === undefined) return null;
      return answer.selectedCardIds.map((cardId) => ({
        type: 'EQUIP_SPECIFIC_MANA',
        payload: {
          side: ctx.ownerSide,
          monsterIndex: equipTargetIndex,
          sourceZone: 'deck',
          manaCardId: cardId,
        },
      }));
    }

    // 【今回改訂】並(deck_full_reorder)のboth対応。forcedSideが来ていればそちらを優先、
    // 無ければ従来通りresolveSideで解決する(self/opponent固定カード向けの後方互換)。
    case 'deck_full_reorder': {
      if (answer.kind !== 'deck_reorder') return null;
      const side =
        effect.targetSide === 'both'
          ? (ctx.forcedSide ?? ctx.ownerSide)
          : resolveSide(effect.targetSide ?? 'self', ctx.ownerSide);
      return [
        {
          type: 'REORDER_DECK',
          payload: { side, orderedCardIds: answer.orderedCardIds },
        },
      ];
    }

    // 【今回実装】詳・美。
    case 'deck_partial_reorder': {
      if (answer.kind !== 'deck_reorder') return null;
      let side: PlayerSide;
      if (effect.targetSide === 'choose') {
        if (ctx.reorderTargetSide === undefined) return null;
        side = ctx.reorderTargetSide;
      } else if (effect.targetSide === 'both') {
        side = ctx.forcedSide ?? ctx.ownerSide;
      } else {
        side = resolveSide(effect.targetSide, ctx.ownerSide);
      }
      return [
        {
          type: 'REORDER_DECK',
          payload: {
            side,
            orderedCardIds: answer.orderedCardIds,
            faceUp: effect.faceUp,
          },
        },
      ];
    }

    case 'deck_kanji_purge': {
      if (
        answer.kind !== 'kanji_type_select' &&
        answer.kind !== 'deck_kanji_reveal_select'
      )
        return null;
      const side = getOpponentSide(ctx.ownerSide);
      const scopeLimit =
        effect.revealScope === undefined || effect.revealScope === 'full'
          ? undefined
          : effect.revealScope;
      const cardIds = collectKanjiPurgeCardIds(
        ctx.gameState,
        side,
        answer.selectedKanji,
        effect.count,
        scopeLimit,
      );
      const actions: GameAction[] = [];
      if (cardIds.length > 0) {
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        });
      }
      if (effect.shuffleAfter) {
        actions.push({ type: 'SHUFFLE_DECK', payload: { side } });
      }
      return actions;
    }

    case 'graveyard_select_recover': {
      if (answer.kind !== 'graveyard_select') return null;
      const side = ctx.ownerSide;
      const actions: GameAction[] = [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds: answer.selectedCardIds,
            sourceZone: 'cemetery',
            targetZone: 'deck',
          },
        },
      ];
      if (effect.placement === 'top') {
        actions.push({
          type: 'REORDER_DECK',
          payload: { side, orderedCardIds: answer.selectedCardIds },
        });
      } else {
        actions.push({ type: 'SHUFFLE_DECK', payload: { side } });
      }
      return actions;
    }

    case 'graveyard_select_equip': {
      // monsterTargetMode未指定(現状該当カード無し): 従来通り発動元自身へ固定装備。
      if (!effect.monsterTargetMode) {
        if (answer.kind !== 'graveyard_select') return null;
        if (ctx.sourceMonsterIndex === undefined) return null;
        return answer.selectedCardIds.map((cardId) => ({
          type: 'EQUIP_SPECIFIC_MANA',
          payload: {
            side: ctx.ownerSide,
            monsterIndex: ctx.sourceMonsterIndex!,
            sourceZone: 'cemetery',
            manaCardId: cardId,
          },
        }));
      }
      // 【今回改訂】ペアリングモーダルの回答から、カードごとに装備先(monsterIndex・
      // slotIndex)を直接指定してEQUIP_SPECIFIC_MANAを組み立てる。targetSlotIndexを
      // 明示するため、reducer側の「同じ漢字の空きスロット優先」フォールバックには
      // 委ねない(ペアリング時点でスロット単位の対応関係が確定しているため)。
      if (answer.kind !== 'graveyard_equip_select') return null;
      return answer.pairs.map(({ cardId, monsterIndex, slotIndex }) => ({
        type: 'EQUIP_SPECIFIC_MANA',
        payload: {
          side: ctx.ownerSide,
          monsterIndex,
          sourceZone: 'cemetery',
          manaCardId: cardId,
          targetSlotIndex: slotIndex,
        },
      }));
    }

    case 'deck_normalize_to_count': {
      if (answer.kind !== 'graveyard_select') return null;
      const side = ctx.ownerSide;
      const actions: GameAction[] = [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds: answer.selectedCardIds,
            sourceZone: 'cemetery',
            targetZone: 'deck',
          },
        },
      ];
      if (effect.shuffleAfter) {
        actions.push({ type: 'SHUFFLE_DECK', payload: { side } });
      }
      return actions;
    }

    case 'swap_equipped_with_graveyard': {
      if (answer.kind !== 'equip_swap_select') return null;
      const side = ctx.ownerSide;
      const playerState = getPlayerState(ctx.gameState, side);
      let monsterIndex = -1;
      let slotIndex = -1;
      playerState.monsters.forEach((m, mi) => {
        m.equippedMana.forEach((mana, si) => {
          if (mana?.id === answer.equippedManaId) {
            monsterIndex = mi;
            slotIndex = si;
          }
        });
      });
      if (monsterIndex === -1) return null; // 選択後に状態が変わり対象が消えていた場合等
      return [
        {
          type: 'TRASH_MANA',
          payload: {
            side,
            monsterIndex,
            manaCardIds: [answer.equippedManaId],
            destination: 'cemetery',
          },
        },
        {
          type: 'EQUIP_SPECIFIC_MANA',
          payload: {
            side,
            monsterIndex,
            sourceZone: 'cemetery',
            manaCardId: answer.graveyardCardId,
            targetSlotIndex: slotIndex,
          },
        },
      ];
    }

    case 'mixed_zone_select_trash': {
      if (answer.kind !== 'mixed_zone_trash_select') return null;
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      const playerState = getPlayerState(ctx.gameState, side);
      const deckIds: string[] = [];
      const manaByMonster: Record<number, string[]> = {};
      for (const cardId of answer.selectedCardIds) {
        if (playerState.deck.some((c) => c.id === cardId)) {
          deckIds.push(cardId);
          continue;
        }
        const monsterIndex = playerState.monsters.findIndex((m) =>
          m.equippedMana.some((mana) => mana?.id === cardId),
        );
        if (monsterIndex !== -1) {
          (manaByMonster[monsterIndex] ??= []).push(cardId);
        }
      }
      const actions: GameAction[] = [];
      if (deckIds.length > 0) {
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds: deckIds,
            sourceZone: 'deck',
            targetZone: effect.destination,
          },
        });
      }
      Object.entries(manaByMonster).forEach(([monsterIndexStr, manaIds]) => {
        actions.push({
          type: 'TRASH_MANA',
          payload: {
            side,
            monsterIndex: Number(monsterIndexStr),
            manaCardIds: manaIds,
            destination: effect.destination,
          },
        });
      });
      return actions;
    }

    // 【追加】進: trash_monster_mana(select)の確定処理。斧のグルーピングロジックを踏襲するが、
    // 候補が装備マナのみ(sources:['monster_mana']固定)なので山札分の分岐は不要。
    case 'trash_monster_mana': {
      if (effect.targetScope !== 'select') return null;
      if (answer.kind !== 'mixed_zone_trash_select') return null;
      const side = getOpponentSide(ctx.ownerSide);
      const playerState = getPlayerState(ctx.gameState, side);
      const manaByMonster: Record<number, string[]> = {};
      answer.selectedCardIds.forEach((cardId) => {
        const monsterIndex = playerState.monsters.findIndex((m) =>
          m.equippedMana.some((mana) => mana?.id === cardId),
        );
        if (monsterIndex !== -1) {
          (manaByMonster[monsterIndex] ??= []).push(cardId);
        }
      });
      return Object.entries(manaByMonster).map(
        ([monsterIndexStr, manaIds]) => ({
          type: 'TRASH_MANA',
          payload: {
            side,
            monsterIndex: Number(monsterIndexStr),
            manaCardIds: manaIds,
            destination: 'cemetery',
          },
        }),
      );
    }

    case 'monster_remove_from_game': {
      // 認・獄: 選択された相手モンスターを、①装備マナを全て墓地へ(TRASH_MANA)
      // ②isRemovedFromGameを立てる(REMOVE_MONSTER_FROM_GAME)の2Actionずつ組み立てる。
      // Q&A確認済み：取り除かれた時点で装備マナは墓地行き。既に取り除き済みのモンスターは
      // 二重処理を避けるためスキップする。
      if (answer.kind !== 'monster_select') return null;
      const side = getOpponentSide(ctx.ownerSide);
      const monsters = getPlayerState(ctx.gameState, side).monsters;
      const actions: GameAction[] = [];
      answer.selectedMonsterIndexes.forEach((idx) => {
        const monster = monsters[idx];
        if (!monster || monster.isRemovedFromGame) return;
        actions.push({
          type: 'TRASH_MANA',
          payload: {
            side,
            monsterIndex: idx,
            manaCardIds: 'all',
            destination: 'cemetery',
          },
        });
        actions.push({
          type: 'REMOVE_MONSTER_FROM_GAME',
          payload: { side, monsterIndex: idx },
        });
      });
      return actions;
    }

    case 'flip_monster_facedown': {
      if (answer.kind !== 'monster_select') return null;
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      const monsters = getPlayerState(ctx.gameState, side).monsters;
      const actions: GameAction[] = [];
      answer.selectedMonsterIndexes.forEach((idx) => {
        const monster = monsters[idx];
        // 既に裏面(isFlipped:true)の場合は何もしない(FLIP_MONSTERはトグルのため、
        // 誤って表に戻してしまわないためのガード)
        if (monster && !monster.isFlipped) {
          actions.push({
            type: 'FLIP_MONSTER',
            payload: { side, monsterIndex: idx },
          });
        }
      });
      return actions;
    }

    case 'graveyard_auto_equip_by_target_slots': {
      // 採: phase1(モンスター選択)確定後、選択UIを介さず完全自動で装備まで組み立てる。
      // 対象モンスターの空きスロットに対応する漢字種類を重複無しで洗い出し、
      // 1色につき墓地の先頭1枚をEQUIP_SPECIFIC_MANA(targetSlotIndex省略)で装備する。
      // 空きスロット判定はここで確定させ、reducer側の寛容なフォールバック(空きが無ければ
      // 別スロットへ強引に装備等)には委ねない(「空きスロットのみ埋める」という確認済み仕様のため)。
      if (answer.kind !== 'monster_select') return null;
      const targetMonsterIndex = answer.selectedMonsterIndexes[0];
      if (targetMonsterIndex === undefined) return null;

      const playerState = getPlayerState(ctx.gameState, ctx.ownerSide);
      const targetMonster = playerState.monsters[targetMonsterIndex];
      if (!targetMonster) return null;

      const requiredKanji = Array.from(
        new Set(getOpenSlotKanji(targetMonster)),
      );

      const cemetery = [...playerState.cemetery];
      const actions: GameAction[] = [];
      const wildcard = getWildcardKanji(ctx.gameState, ctx.ownerSide);
      requiredKanji.forEach((kanji) => {
        // 同じ色のマナを優先し、無ければ(花が表向きなら)万能マナ(屮)で代用する
        let cardIndex = cemetery.findIndex(
          (c) => getEffectiveKanji(c) === kanji,
        );
        if (cardIndex === -1 && wildcard) {
          cardIndex = cemetery.findIndex((c) => c.kanji === wildcard);
        }
        if (cardIndex === -1) return; // 墓地に該当色が無ければスキップ(不発)
        const [card] = cemetery.splice(cardIndex, 1); // 同じ実体を2回使わないよう候補から除去
        actions.push({
          type: 'EQUIP_SPECIFIC_MANA',
          payload: {
            side: ctx.ownerSide,
            monsterIndex: targetMonsterIndex,
            sourceZone: 'cemetery',
            manaCardId: card.id,
          },
        });
      });
      return actions;
    }

    case 'choose_number_reduce': {
      if (answer.kind !== 'number_select') return null;
      const n = answer.selectedNumber;
      const sides: PlayerSide[] =
        effect.targetScope === 'both'
          ? [ctx.ownerSide, getOpponentSide(ctx.ownerSide)]
          : [getOpponentSide(ctx.ownerSide)];
      const actions: GameAction[] = [];
      for (const side of sides) {
        const deck = getPlayerState(ctx.gameState, side).deck;
        const cardIds = deck.slice(0, n).map((c) => c.id);
        if (cardIds.length > 0) {
          actions.push({
            type: 'MOVE_CARD_BETWEEN_ZONES',
            payload: {
              sourceSide: side,
              targetSide: side,
              cardIds,
              sourceZone: 'deck',
              targetZone: 'cemetery',
            },
          });
        }
      }
      return actions;
    }

    case 'choose_number_reduce_both': {
      if (answer.kind !== 'number_select') return null;
      const n = answer.selectedNumber;
      const actions: GameAction[] = [];
      for (const side of [ctx.ownerSide, getOpponentSide(ctx.ownerSide)]) {
        const deck = getPlayerState(ctx.gameState, side).deck;
        const cardIds = deck.slice(0, n).map((c) => c.id);
        if (cardIds.length > 0) {
          actions.push({
            type: 'MOVE_CARD_BETWEEN_ZONES',
            payload: {
              sourceSide: side,
              targetSide: side,
              cardIds,
              sourceZone: 'deck',
              targetZone: 'cemetery',
            },
          });
        }
      }
      return actions;
    }

    // 【追加】保: 選ばれた数値=「下から残す枚数」。残り(=山札の上から詰めた分)をreservedCardsへ。
    // 山札配列のindex 0が「山札の一番上」という既存規約(takeTopDeckIds等)に基づき、
    // 「下から残す」= 配列の末尾からkeepCount枚を山札に残し、残り(先頭側)を保持ゾーンへ送る。
    // 【今回・表面固定発動ガード検討時の差し戻し】保はFLIP_MONSTERを伴わせない。
    // 山札0枚時の自動返却処理(useGameState.tsのreturnReservedCardsIfDeckEmpty)が
    // 「!m.isFlipped(表向き)」を対象探索の条件にしており、発動時に裏向き化すると
    // 自動返却が機能しなくなる致命的な矛盾が生じるため、保は従来通り「発動後も
    // 表向きのまま」の挙動を維持する(囲・政のみ1回限りとし、MARK_PREPARATION_USEDで管理する)。
    case 'deck_partial_to_reserve': {
      if (answer.kind !== 'number_select') return null;
      if (ctx.sourceMonsterIndex === undefined) return null;
      const keepCount = answer.selectedNumber;
      const deck = getPlayerState(ctx.gameState, ctx.ownerSide).deck;
      const reserveCount = Math.max(0, deck.length - keepCount);
      if (reserveCount === 0) return [];

      const reservedCardIds = deck.slice(0, reserveCount).map((c) => c.id);

      // 既存のMOVE_CARD_BETWEEN_ZONESはdeck/cemetery/exile/pendingしか対象にできないため、
      // reservedCardsへの移動には対応していない。新規Actionが必要。
      return [
        {
          type: 'MOVE_CARD_TO_RESERVE',
          payload: {
            side: ctx.ownerSide,
            monsterIndex: ctx.sourceMonsterIndex,
            cardIds: reservedCardIds,
          },
        },
      ];
    }

    case 'graveyard_recover_then_deck_trash_matching_count':
      // 【今回改訂・化の戻す位置UI】従来はここで「戻す→山札の上から人以外を選んで捨てる」の
      // 2Actionを一括生成していたが、「山札を見ずに好きな場所へ戻す」という原文の要求を
      // 満たすため、戻す(phase1)→並び替え(phase2、deck_reorder流用)→捨てる(phase2確定時)
      // という3段階の特別分岐へ再設計した。copy_opponent_monster_effectと同じ理由
      // (useEffectExecutor.ts側のconfirmSelection内で横取りされ、ここには到達しない)により、
      // 型上の受け皿としてnullを返すだけの実装にした。
      return null;

    // 【追加】囲: 選択された墓地カードをreservedCardsへ送る(墓地起点)。
    // 【今回改訂】表面固定永続効果の発動ガード: 前準備発動は1回限りとし、発動と同時に
    // MARK_PREPARATION_USED(発動済みマーク)を立てる。従来のFLIP_MONSTER(裏向き化)は
    // 「おもてむきのままにする」という原文と矛盾し、バッファ切れ時のトグルが逆転する
    // 不具合を生んだため廃止した(表裏はisFlippedのまま維持され、バッファ切れ時の
    // FLIP_MONSTERで初めて裏向きに戻る)。
    case 'graveyard_partial_to_reserve': {
      if (answer.kind !== 'graveyard_select') return null;
      if (ctx.sourceMonsterIndex === undefined) return null;
      return [
        {
          type: 'MOVE_CARD_TO_RESERVE',
          payload: {
            side: ctx.ownerSide,
            monsterIndex: ctx.sourceMonsterIndex,
            cardIds: answer.selectedCardIds,
            sourceZone: 'cemetery',
          },
        },
        {
          type: 'MARK_PREPARATION_USED',
          payload: {
            side: ctx.ownerSide,
            monsterIndex: ctx.sourceMonsterIndex,
          },
        },
      ];
    }

    // 【追加】政: 選択された自分の墓地カードを相手の山札へ移動しシャッフル、
    // 移動した各カードにseededByタグ(markedBySide=自分)を付ける。
    // own_turn_startパイプライン(seeded_mana_return_win_condition)がこのタグを見て
    // 「相手の墓地にあるか」を毎自ターン開始時に判定する。
    // 【今回改訂】表面固定永続効果の発動ガード: 前準備発動は1回限りとし、発動と同時に
    // MARK_PREPARATION_USED(発動済みマーク)を立てる。FLIP_MONSTERで裏向き化すると
    // 政の勝利条件監視(!isFlipped)が止まってしまうため廃止した。
    case 'deck_seed_mana_win_condition': {
      if (answer.kind !== 'graveyard_select') return null;
      if (ctx.sourceMonsterIndex === undefined) return null;
      const ownerSide = ctx.ownerSide;
      const opponentSide = getOpponentSide(ownerSide);
      const cardIds = answer.selectedCardIds;
      if (cardIds.length === 0) {
        return [
          {
            type: 'MARK_PREPARATION_USED',
            payload: {
              side: ownerSide,
              monsterIndex: ctx.sourceMonsterIndex,
            },
          },
        ];
      }
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: ownerSide,
            targetSide: opponentSide,
            cardIds,
            sourceZone: 'cemetery',
            targetZone: 'deck',
          },
        },
        { type: 'SHUFFLE_DECK', payload: { side: opponentSide } },
        {
          type: 'SET_MANA_SEEDED_MARKER',
          payload: { side: opponentSide, cardIds, markedBySide: ownerSide },
        },
        {
          type: 'MARK_PREPARATION_USED',
          payload: {
            side: ownerSide,
            monsterIndex: ctx.sourceMonsterIndex,
          },
        },
      ];
    }

    // 【追加】操: 選ばれた相手モンスターのeffectを控えるだけの中間ステップ。
    // 実際の解決(tryExecuteへの再帰投入)はuseEffectExecutor.ts側のconfirmSelection内、
    // choice_of_effectsと同様の特別分岐で行うため、ここには到達しない
    // (monster_select確定時にconfirmSelection側で横取りされる)。念のため型として用意。
    case 'copy_opponent_monster_effect':
      return null;

    // 【追加】言・信・競・招・右・哲: じゃんけんの決着結果に応じて対象・枚数を算出する。
    // 哲の原文「かち▷あいて／あいこ▷あいて／まけ▷じぶん」で確認した対応関係に基づく。
    case 'janken_conditional_reduce': {
      if (answer.kind !== 'janken_select') return null;
      return buildJankenOutcomeActions(
        effect,
        ctx.ownerSide,
        ctx.gameState,
        answer.outcome,
      );
    }

    // 【追加】告・呪・推・竜・善・名: 宣言した漢字と、公開したrevealCount枚が一致するかで分岐
    case 'deck_predict_reveal_reduce': {
      if (answer.kind !== 'kanji_type_select') return null;
      const declaredKanji = answer.selectedKanji[0];
      if (!declaredKanji) return [];
      const revealSide = resolveSide(effect.predictSide, ctx.ownerSide);
      return resolveRevealCheckActions(
        ctx.gameState,
        ctx.ownerSide,
        revealSide,
        effect.revealCount ?? 1,
        (card) => getEffectiveKanji(card) === declaredKanji,
        effect.onHit,
        effect.onMiss,
      );
    }

    // 【追加】誓のみ到達(targetKanji未指定分)。煉・初・朝はresolveMonsterEffectで既に自動解決済み
    case 'deck_reveal_kanji_check': {
      if (answer.kind !== 'kanji_type_select') return null;
      const declaredKanji = answer.selectedKanji[0];
      if (!declaredKanji) return [];
      return resolveRevealCheckActions(
        ctx.gameState,
        ctx.ownerSide,
        ctx.ownerSide, // 自分の山札固定
        effect.revealCount,
        (card) => getEffectiveKanji(card) === declaredKanji,
        effect.onMatch,
        effect.onMiss,
      );
    }

    // 【追加】出: describeSelectionRequirement側で既に「少ない方」を判定しGraveyardSelectRequirement.side
    // に格納しているため、ここでは改めて比較し直し、確定時点の最新盤面で side を再計算する
    // (選択待ちの間に盤面が変化していても、最新状態を基準にするため。1.3章の設計方針に準拠)。
    case 'deck_compare_branch': {
      if (answer.kind !== 'graveyard_select') return null;
      if (effect.fewerSideEffect.effectId !== 'graveyard_select_recover')
        return null;
      const placement = effect.fewerSideEffect.placement;

      // 【追加】forcedSideがあれば(2巡目)そのまま使う。無ければ(1巡目)最新状態で再判定する
      // (選択待ちの間に盤面が変化していても、確定時点の最新状態を基準にするため。1.3章の設計方針に準拠)。
      let targetSide: PlayerSide;
      if (ctx.forcedSide) {
        targetSide = ctx.forcedSide;
      } else {
        const selfDeck = getPlayerState(ctx.gameState, ctx.ownerSide).deck;
        const oppDeck = getPlayerState(
          ctx.gameState,
          getOpponentSide(ctx.ownerSide),
        ).deck;
        targetSide =
          selfDeck.length === oppDeck.length
            ? ctx.ownerSide // 同数の1巡目は常に自分側から
            : selfDeck.length < oppDeck.length
              ? ctx.ownerSide
              : getOpponentSide(ctx.ownerSide);
      }

      const actions: GameAction[] = [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: targetSide,
            targetSide: targetSide,
            cardIds: answer.selectedCardIds,
            sourceZone: 'cemetery',
            targetZone: 'deck',
          },
        },
      ];
      if (placement === 'top') {
        actions.push({
          type: 'REORDER_DECK',
          payload: { side: targetSide, orderedCardIds: answer.selectedCardIds },
        });
      } else {
        actions.push({ type: 'SHUFFLE_DECK', payload: { side: targetSide } });
      }
      return actions;
    }

    // 【追加】然: 選択されたカードが山札の1番上か墓地かを、確定時点の最新状態で判定する
    // (選択待ちの間に盤面が変化する可能性を考慮。1.3章の設計方針に準拠。
    // 特に然はターン開始のたびに毎回発動しうるため、他の効果より状態変化の機会が多い点に留意)。
    case 'select_zone_move_one': {
      if (answer.kind !== 'zone_move_select') return null;
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      const playerState = getPlayerState(ctx.gameState, side);
      const isDeckTop = playerState.deck[0]?.id === answer.selectedCardId;
      const sourceZone: ZoneType = isDeckTop ? 'deck' : 'cemetery';
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds: [answer.selectedCardId],
            sourceZone,
            targetZone: effect.destination, // 型上は常に'exile'
          },
        },
      ];
    }

    // 【追加】国: 選ばれたindex(0〜3、固定順)から対象(自分/相手×山札/墓地)を復元し、
    // 枚数がtargetValues(1か9)に一致すれば勝利、それ以外は何も起きない。
    case 'deck_or_graveyard_count_win_condition': {
      if (answer.kind !== 'zone_target_select') return null;
      const opponentSide = getOpponentSide(ctx.ownerSide);
      const targets: { side: PlayerSide; zone: 'deck' | 'cemetery' }[] = [
        { side: ctx.ownerSide, zone: 'deck' },
        { side: ctx.ownerSide, zone: 'cemetery' },
        { side: opponentSide, zone: 'deck' },
        { side: opponentSide, zone: 'cemetery' },
      ];
      const target = targets[answer.selectedIndex];
      if (!target) return null;

      const count = getPlayerState(ctx.gameState, target.side)[target.zone]
        .length;
      if (!effect.targetValues.includes(count)) return [];

      const sideLabel = target.side === ctx.ownerSide ? '自分' : '相手';
      const zoneLabel = target.zone === 'deck' ? '山札' : '墓地';
      return [
        {
          type: 'SET_GAME_STATUS',
          payload: {
            status: ctx.ownerSide === 'player' ? 'player_win' : 'opponent_win',
            logMessage: `国の勝利条件が成立しました（${sideLabel}の${zoneLabel}が${count}枚）。`,
          },
        },
      ];
    }

    // 【追加】究: 申告された山札構成(composition)と、相手の山札の実際の構成が
    // 完全一致するかを判定する。一致すれば勝利、不一致なら相手の山札をシャッフルする。
    case 'deck_predict_full_composition_win': {
      if (answer.kind !== 'deck_composition_predict') return null;
      const opponentSide = getOpponentSide(ctx.ownerSide);
      const actualDeck = getPlayerState(ctx.gameState, opponentSide).deck;

      const actualComposition: Record<string, number> = {};
      actualDeck.forEach((c) => {
        actualComposition[c.kanji] = (actualComposition[c.kanji] ?? 0) + 1;
      });

      const guessedEntries = Object.entries(answer.composition).filter(
        ([, count]) => count > 0,
      );
      const actualEntries = Object.entries(actualComposition);
      const isExactMatch =
        guessedEntries.length === actualEntries.length &&
        guessedEntries.every(
          ([kanji, count]) => actualComposition[kanji] === count,
        );

      if (isExactMatch) {
        const ownerLabel = ctx.ownerSide === 'player' ? '自分' : '相手';
        return [
          {
            type: 'SET_GAME_STATUS',
            payload: {
              status:
                ctx.ownerSide === 'player' ? 'player_win' : 'opponent_win',
              logMessage: `${ownerLabel}の究の予想が的中し、勝利条件が成立しました。`,
            },
          },
        ];
      }

      if (effect.onMiss.shuffleAfter) {
        return [{ type: 'SHUFFLE_DECK', payload: { side: opponentSide } }];
      }
      return [];
    }

    case 'deck_iterative_select_trash':
      // 【追加・方】選択のたびに1枚ずつ即時dispatchするため、useEffectExecutor.ts側の
      // confirmSelection内の特別分岐で完結する(ここには到達しない)。型の受け皿。
      return null;

    // それ以外は今回未実装。describeSelectionRequirement側で既にnullを返しているため
    // ここに到達すること自体が想定外だが、念のため網羅させておく。
    default:
      return null;
  }
}
