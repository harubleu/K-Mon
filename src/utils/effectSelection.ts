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
} from './effectExecutor';

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

export type SelectionRequirement =
  | DeckSelectRequirement
  | DeckReorderRequirement
  | KanjiTypeSelectRequirement
  | DeckKanjiRevealSelectRequirement
  | GraveyardSelectRequirement
  | EquipSwapSelectRequirement
  | MixedZoneTrashSelectRequirement
  | MonsterSelectRequirement
  | NumberSelectRequirement
  | ChoiceOfEffectsSelectRequirement
  | JankenSelectRequirement
  | ZoneMoveSelectRequirement;

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

    case 'deck_select_equip':
      return {
        kind: 'deck_select',
        side: ctx.ownerSide,
        constraint: { min: effect.count, max: effect.count },
        actionLabel: '選択したカードを装備',
      };

    case 'deck_kanji_search_equip':
      return {
        kind: 'deck_select',
        side: ctx.ownerSide,
        constraint: { min: 0, max: effect.maxCount },
        kanjiFilter: [effect.targetKanji],
        actionLabel: '選択したカードを装備',
      };

    // ============ 今回実装: DeckModalでの並び替え ============
    case 'deck_full_reorder': {
      // 'both'（両者の山札を並び替える）は2モーダルの逐次制御が必要なため今回は見送り
      if (effect.targetSide === 'both') return null;
      const side = resolveSide(effect.targetSide ?? 'self', ctx.ownerSide);
      return { kind: 'deck_reorder', side, scope: 'full' };
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
      };
    }

    case 'graveyard_select_recover': {
      if (effect.count === 'all') return null; // resolveMonsterEffect側で自動解決されるはず
      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: effect.count, max: effect.count },
        actionLabel: '選択したカードを山札に戻す',
      };
    }

    case 'graveyard_select_equip': {
      // 【追加】excludeSelf対応: 装備先を選べる場合、phase1として装備先モンスター選択を
      // 先に返す。ctx.equipTargetMonsterIndexが確定済み(phase2)なら通常のgraveyard_selectへ進む。
      if (effect.excludeSelf && ctx.equipTargetMonsterIndex === undefined) {
        if (ctx.sourceMonsterIndex === undefined) return null;
        return {
          kind: 'monster_select',
          side: ctx.ownerSide,
          constraint: { min: 1, max: 1 },
          excludeMonsterIndex: ctx.sourceMonsterIndex,
        };
      }

      // 【追加】sourceRestriction対応: 直前のステップ(sequence内)で実際に墓地送りにした
      // カードのみを候補にする(方)。単発発動時はjustTrashedCardIdsがundefinedのため無制限。
      const cardIdFilter =
        effect.sourceRestriction === 'just_trashed_by_this_effect'
          ? ctx.justTrashedCardIds
          : undefined;

      return {
        kind: 'graveyard_select',
        side: ctx.ownerSide,
        constraint: { min: effect.count, max: effect.count },
        cardIdFilter,
        actionLabel: '選択したカードを装備',
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

    case 'flip_monster_facedown': {
      const side = resolveSide(effect.targetSide, ctx.ownerSide);
      return {
        kind: 'monster_select',
        side,
        constraint: { min: effect.count, max: effect.count },
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
      return {
        kind: 'number_select',
        minNumber: 0,
        maxNumber: deck.length,
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

    // ============ 見送り: 現状該当カードが'both'/'choose'のみのため（3章参照） ============
    // 型としてはDeckReorderRequirement.scope: {partialTopCount}を既に用意してあるため、
    // self/opponent固定のカードが増えた際はdeck_full_reorderと同様の実装で対応可能
    case 'deck_partial_reorder':
      return null;

    // ============ 見送り: 外部勝敗システム接続待ち(design_document.md 7.6章2番) ============
    case 'deck_count_win_or_reduce':
    case 'deck_or_graveyard_count_win_condition':
    case 'deck_count_tiered_effect':
    case 'graveyard_total_count_threshold_win':
    case 'deck_predict_full_composition_win':
    case 'deck_diff_threshold_win_or_reduce':
      return null;

    // ============ そもそも選択不要(resolveMonsterEffectで自動解決されるはずの効果) ============
    // ここに来ることは基本ないが、呼び出し順序の誤り等で来た場合に備えnullを返す
    case 'deck_reduce_fixed':
    case 'graveyard_kanji_count_threshold':
    case 'graveyard_kanji_count_linear':
    case 'deck_keep_rest_trash':
    case 'deck_compare_reduce':
    case 'deck_iterative_reveal_until_condition':
    case 'monster_remove_from_game':
    case 'draw_and_play_n':
    case 'swap_deck_and_graveyard':
    case 'deck_mark_delayed_reduce':
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
    const matches = scope.filter((c) => c.kanji === kanji);
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
  | { kind: 'zone_move_select'; selectedCardId: string };

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
      // 発動元モンスターが不明な場合は組み立て不可(発動トリガーUI実装後に配線される想定)
      if (ctx.sourceMonsterIndex === undefined) return null;
      return answer.selectedCardIds.map((cardId) => ({
        type: 'EQUIP_SPECIFIC_MANA',
        payload: {
          side: ctx.ownerSide,
          monsterIndex: ctx.sourceMonsterIndex!,
          sourceZone: 'deck',
          manaCardId: cardId,
        },
      }));
    }

    case 'deck_full_reorder': {
      if (answer.kind !== 'deck_reorder') return null;
      if (effect.targetSide === 'both') return null;
      const side = resolveSide(effect.targetSide ?? 'self', ctx.ownerSide);
      return [
        {
          type: 'REORDER_DECK',
          payload: { side, orderedCardIds: answer.orderedCardIds },
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
      if (answer.kind !== 'graveyard_select') return null;
      // 【追加】phase1(monster_select)で装備先が選ばれていればそちらを優先。
      // excludeSelfを使わない既存3件はctx.equipTargetMonsterIndexが常にundefinedのため
      // 従来通りsourceMonsterIndex(発動元自身)が装備先になる。
      const targetMonsterIndex =
        ctx.equipTargetMonsterIndex ?? ctx.sourceMonsterIndex;
      if (targetMonsterIndex === undefined) return null;
      return answer.selectedCardIds.map((cardId) => ({
        type: 'EQUIP_SPECIFIC_MANA',
        payload: {
          side: ctx.ownerSide,
          monsterIndex: targetMonsterIndex,
          sourceZone: 'cemetery',
          manaCardId: cardId,
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

    case 'graveyard_recover_then_deck_trash_matching_count': {
      if (answer.kind !== 'graveyard_select') return null;
      const side = ctx.ownerSide;
      const recoveredCount = answer.selectedCardIds.length;
      const actions: GameAction[] = [];
      if (recoveredCount === 0) return actions;
      actions.push({
        type: 'MOVE_CARD_BETWEEN_ZONES',
        payload: {
          sourceSide: side,
          targetSide: side,
          cardIds: answer.selectedCardIds,
          sourceZone: 'cemetery',
          targetZone: 'deck',
        },
      });
      actions.push({ type: 'SHUFFLE_DECK', payload: { side } });
      // 回復と同数、trashExcludeKanji以外を山札の上から墓地へ(回復前のdeckを基準に選定して問題ない)
      const deck = getPlayerState(ctx.gameState, side).deck;
      const eligible = deck.filter((c) => c.kanji !== effect.trashExcludeKanji);
      const trashIds = eligible.slice(0, recoveredCount).map((c) => c.id);
      if (trashIds.length > 0) {
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: side,
            targetSide: side,
            cardIds: trashIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        });
      }
      return actions;
    }

    // 【追加】言・信・競・招・右・哲: じゃんけんの決着結果に応じて対象・枚数を算出する。
    // 哲の原文「かち▷あいて／あいこ▷あいて／まけ▷じぶん」で確認した対応関係に基づく。
    case 'janken_conditional_reduce': {
      if (answer.kind !== 'janken_select') return null;
      let targetSide: PlayerSide;
      let count: number;
      if (answer.outcome === 'win') {
        targetSide = getOpponentSide(ctx.ownerSide);
        count = effect.winCount ?? 0;
      } else if (answer.outcome === 'tie') {
        targetSide = getOpponentSide(ctx.ownerSide);
        count = effect.tieCount ?? 0;
      } else {
        targetSide = ctx.ownerSide;
        count = effect.loseCount ?? 0;
      }
      if (count <= 0) return [];
      const deck = getPlayerState(ctx.gameState, targetSide).deck;
      const cardIds = deck.slice(0, count).map((c) => c.id);
      if (cardIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: targetSide,
            targetSide: targetSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        },
      ];
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
        (card) => card.kanji === declaredKanji,
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
        (card) => card.kanji === declaredKanji,
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

    // それ以外は今回未実装。describeSelectionRequirement側で既にnullを返しているため
    // ここに到達すること自体が想定外だが、念のため網羅させておく。
    default:
      return null;
  }
}
