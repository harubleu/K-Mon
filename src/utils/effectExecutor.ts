// src/utils/effectExecutor.ts
//
// フェーズ5: MonsterEffect/PassiveEffectを解釈し、既存のGameActionへ変換するexecutor。
// 「対象選択は人間・実行は自動」の方針に基づき、選択が不要と確認できる効果のみを
// この段階で自動実行対象とする。
//
// resolveMonsterEffect は、選択（ユーザー入力）が必要で自動化できない効果に対しては
// null を返す契約とする。呼び出し側は null の場合、既存の手動UI（DeckModal/JankenModal等）
// へ誘導すること。

import type {
  GameState,
  GameAction,
  ManaCard,
  MonsterCard,
  MonsterEffect,
  PassiveEffect,
  PlayerSide,
  RelativeSide,
  PlayerState,
} from '../types';

// --- 汎用ヘルパー ---

export function getOpponentSide(side: PlayerSide): PlayerSide {
  return side === 'player' ? 'opponent' : 'player';
}

// masterData定義の相対的な向き（'self'|'opponent'）を、実際のPlayerSideへ変換する。
// この効果を持つモンスターの所有者（ownerSide）を基準にする。
export function resolveSide(
  relative: RelativeSide,
  ownerSide: PlayerSide,
): PlayerSide {
  return relative === 'self' ? ownerSide : getOpponentSide(ownerSide);
}

export function getPlayerState(
  gameState: GameState,
  side: PlayerSide,
): PlayerState {
  return side === 'player' ? gameState.player : gameState.opponent;
}

// 指定サイドの山札の「上からN枚」のカードIDを返す（山札の残数がN未満なら残り全部）。
// 山札配列のindex 0が先頭（山札の一番上）という既存のREORDER_DECK等の実装規約に準拠。
function takeTopDeckIds(
  gameState: GameState,
  side: PlayerSide,
  count: number,
): string[] {
  const deck = getPlayerState(gameState, side).deck;
  return deck.slice(0, Math.min(count, deck.length)).map((c) => c.id);
}

// 指定サイドの墓地にある、指定漢字群に一致するカードの枚数を数える
function countGraveyardKanji(
  gameState: GameState,
  side: PlayerSide,
  targetKanji: string[] | 'all',
): number {
  const cemetery = getPlayerState(gameState, side).cemetery;
  if (targetKanji === 'all') return cemetery.length;
  return cemetery.filter((c) => targetKanji.includes(c.kanji)).length;
}

// 【追加・フェーズ5後半】「山札からrevealCount枚公開して墓地へ送り、公開カードが判定条件に
// 一致するか(isMatch)で当落を分岐する」という共通パターンを切り出したヘルパー。
// 告・呪・推・竜・善・名（deck_predict_reveal_reduce）・誓・煉・初・朝（deck_reveal_kanji_check）
// の4effectId×計10件で共有する。
//
// 【設計注記】revealSideとonMatch/onMissのtargetSideが同じ山札を指す場合（例: 呪）、
// 公開分（先頭revealCount枚）は既に別アクションで墓地へ送られる前提のため、当落側の
// カード選定は「公開分を除いた続き」から取る(startIndexで調整)。MOVE_CARD_BETWEEN_ZONES は
// dispatch時点のstateからID一致で対象を探すため、この事前計算のずれは実害を生まない
// （既存のgraveyard_recover_then_deck_trash_matching_countと同じ考え方）。
export function resolveRevealCheckActions(
  gameState: GameState,
  ownerSide: PlayerSide,
  revealSide: PlayerSide,
  revealCount: number,
  isMatch: (card: ManaCard) => boolean,
  onMatchOutcome:
    | { targetSide: RelativeSide; count: number }
    | null
    | undefined,
  onMissOutcome: { targetSide: RelativeSide; count: number } | null | undefined,
): GameAction[] {
  const deck = getPlayerState(gameState, revealSide).deck;
  const revealedCards = deck.slice(0, revealCount);
  const revealedIds = revealedCards.map((c) => c.id);

  const actions: GameAction[] = [];
  if (revealedIds.length > 0) {
    actions.push({
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: {
        sourceSide: revealSide,
        targetSide: revealSide,
        cardIds: revealedIds,
        sourceZone: 'deck',
        targetZone: 'cemetery',
      },
    });
  }

  const hit = revealedCards.some(isMatch);
  const outcome = hit ? onMatchOutcome : onMissOutcome;
  if (outcome && outcome.count > 0) {
    const outcomeSide = resolveSide(outcome.targetSide, ownerSide);
    const outcomeDeck = getPlayerState(gameState, outcomeSide).deck;
    const startIndex = outcomeSide === revealSide ? revealCount : 0;
    const outcomeIds = outcomeDeck
      .slice(startIndex, startIndex + outcome.count)
      .map((c) => c.id);
    if (outcomeIds.length > 0) {
      actions.push({
        type: 'MOVE_CARD_BETWEEN_ZONES',
        payload: {
          sourceSide: outcomeSide,
          targetSide: outcomeSide,
          cardIds: outcomeIds,
          sourceZone: 'deck',
          targetZone: 'cemetery',
        },
      });
    }
  }

  return actions;
}

// 【追加・own_turn_startパイプライン】「効果発動」ボタンが実際にどのMonsterEffectを対象とすべきかを
// 判定する。自分の(ownerSideが手番の)startフェーズ中は、passiveEffectのown_turn_startトリガーを
// monster.effectより優先する。それ以外は従来通りmonster.effect。
//
// 【設計判断】現状データでは、同一モンスターがmonster.effectとown_turn_start型passiveEffectを
// 同時に持つケースは0件（bash_toolで確認済み）。将来そのようなモンスターが追加された場合も、
// このルールにより「自分のstartフェーズ中はown_turn_start側が優先される」という一貫した挙動になる。
//
// 【対応効果の広がり】歩・脈(deck_reduce_fixedのみ)を主眼に設計したが、詩(janken_conditional_reduce)も
// このヘルパーだけで自動的に解決可能になる(janken系は本セッション前半で実装済みのため)。
// 然(select_zone_move_one)はdescribeSelectionRequirement側で引き続きnullを返す設計のため、
// このヘルパーがactionを返してもisEffectSupportedがfalseになりボタンはdisabledのまま
// (専用UI設計まで安全にスコープ外を維持できる)。
export function getActivatableEffect(
  monster: MonsterCard,
  ownerSide: PlayerSide,
  gameState: GameState,
): MonsterEffect | null {
  const isOwnStartPhase =
    gameState.currentPhase === 'start' && gameState.turnPlayer === ownerSide;

  if (isOwnStartPhase && monster.passiveEffect) {
    const passives = Array.isArray(monster.passiveEffect)
      ? monster.passiveEffect
      : [monster.passiveEffect];
    const startTrigger = passives.find(
      (p): p is Extract<PassiveEffect, { trigger: 'own_turn_start' }> =>
        p.trigger === 'own_turn_start',
    );
    if (startTrigger) return startTrigger.action;
  }

  return monster.effect ?? null;
}

export interface ExecutorContext {
  ownerSide: PlayerSide;
  gameState: GameState;
  sourceMonsterIndex?: number;
  justTrashedCardIds?: string[];
  // 【追加・出の同数ケース専用】deck_compare_branchの2巡目呼び出し時、
  // 「今回はこちらのsideを対象にする」と明示的に強制するためのフィールド。
  // 1巡目(通常の少ない方判定、または同数時の自分側)では未指定で、動的に判定する。
  forcedSide?: PlayerSide;
  // 【追加・生方のexcludeSelf対応】phase1(monster_select)で選ばれた装備先モンスターのindex。
  // phase2(graveyard_select_equipの実処理)でsourceMonsterIndexの代わりに使う。
  equipTargetMonsterIndex?: number;
}

/**
 * MonsterEffectを解決し、dispatchすべきGameActionの配列を返す。
 * 選択（ユーザー入力）が必要で、この段階では自動化できない効果に対しては null を返す。
 */
export function resolveMonsterEffect(
  effect: MonsterEffect,
  ctx: ExecutorContext,
): GameAction[] | null {
  const { ownerSide, gameState } = ctx;
  const opponentSide = getOpponentSide(ownerSide);

  switch (effect.effectId) {
    case 'deck_reduce_fixed': {
      // 全確認例（黒・赤・炎・燃・残・列・格・例・侍・武・制・末・父・石 等）で
      // 常に「あいての山札」が対象と確認済みのため、opponentSide固定でよい
      const cardIds = takeTopDeckIds(gameState, opponentSide, effect.count);
      if (cardIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: opponentSide,
            targetSide: opponentSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: effect.destination === 'exile' ? 'exile' : 'cemetery',
          },
        },
      ];
    }

    case 'trash_monster_mana': {
      // 'all'（相手モンスター全員の装備マナを全て墓地へ）のみ自動実行対象。
      // 'single'/'select' はどのモンスター・どのマナを対象にするか選択が必要なため未対応。
      if (effect.targetScope !== 'all') return null;
      const opponentMonsters = getPlayerState(gameState, opponentSide).monsters;
      const actions: GameAction[] = [];
      opponentMonsters.forEach((monster, monsterIndex) => {
        const manaIds = monster.equippedMana
          .filter((m): m is NonNullable<typeof m> => m !== null)
          .map((m) => m.id);
        if (manaIds.length > 0) {
          actions.push({
            type: 'TRASH_MANA',
            payload: {
              side: opponentSide,
              monsterIndex,
              manaCardIds: manaIds,
              destination: 'cemetery',
            },
          });
        }
      });
      return actions;
    }

    case 'graveyard_kanji_count_linear': {
      // 自分の墓地にある指定漢字の枚数＋bonusぶん、相手の山札を減らす（製・貨・剣）
      const count =
        countGraveyardKanji(gameState, ownerSide, effect.targetKanji) +
        effect.bonus;
      if (count <= 0) return [];
      const cardIds = takeTopDeckIds(gameState, opponentSide, count);
      if (cardIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: opponentSide,
            targetSide: opponentSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        },
      ];
    }

    case 'graveyard_kanji_count_threshold': {
      // 自分の墓地にある指定漢字群の合計枚数で該当する段階（threshold）を探し、その効果を適用（援・持・寺）
      const count = countGraveyardKanji(
        gameState,
        ownerSide,
        effect.targetKanji,
      );
      const tier = effect.thresholds.find(
        (t) => count >= t.min && count <= t.max,
      );
      if (!tier || tier.targetSide === null || tier.count <= 0) return [];
      const targetSide = resolveSide(tier.targetSide, ownerSide);
      const cardIds = takeTopDeckIds(gameState, targetSide, tier.count);
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

    case 'deck_keep_rest_trash': {
      // 山札の下からkeepCount枚を残し、残りを墓地/除外へ（極: keepCount固定値のため選択不要）
      const targetSide = resolveSide(effect.targetSide, ownerSide);
      const deck = getPlayerState(gameState, targetSide).deck;
      const trashCount = Math.max(0, deck.length - effect.keepCount);
      if (trashCount === 0) return [];
      const cardIds = deck.slice(0, trashCount).map((c) => c.id);
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: targetSide,
            targetSide: targetSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: effect.destination,
          },
        },
      ];
    }

    // 【追加】比・合: 両者の山札枚数を比較し、多い方をcount枚減らす。同数はtieBehavior('both'のみ
    // 現状定義)に従い両者とも減らす。選択要素が無いため完全自動解決の対象。
    case 'deck_compare_reduce': {
      const selfDeck = getPlayerState(gameState, ownerSide).deck;
      const oppDeck = getPlayerState(gameState, opponentSide).deck;
      const actions: GameAction[] = [];

      if (selfDeck.length === oppDeck.length) {
        const selfIds = selfDeck.slice(0, effect.count).map((c) => c.id);
        const oppIds = oppDeck.slice(0, effect.count).map((c) => c.id);
        if (selfIds.length > 0) {
          actions.push({
            type: 'MOVE_CARD_BETWEEN_ZONES',
            payload: {
              sourceSide: ownerSide,
              targetSide: ownerSide,
              cardIds: selfIds,
              sourceZone: 'deck',
              targetZone: 'cemetery',
            },
          });
        }
        if (oppIds.length > 0) {
          actions.push({
            type: 'MOVE_CARD_BETWEEN_ZONES',
            payload: {
              sourceSide: opponentSide,
              targetSide: opponentSide,
              cardIds: oppIds,
              sourceZone: 'deck',
              targetZone: 'cemetery',
            },
          });
        }
        return actions;
      }

      const largerSide =
        selfDeck.length > oppDeck.length ? ownerSide : opponentSide;
      const largerDeck = largerSide === ownerSide ? selfDeck : oppDeck;
      const cardIds = largerDeck.slice(0, effect.count).map((c) => c.id);
      if (cardIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: largerSide,
            targetSide: largerSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        },
      ];
    }

    // 【追加】誓・煉・初・朝: targetKanjiが指定済み(煉・初・朝)の場合のみここで完全自動解決する。
    // targetKanji未指定(誓)は発動時にプレイヤーが漢字を宣言する必要があるため、
    // effectSelection.ts側(KanjiTypePickerModal流用)へ誘導するためnullを返す。
    case 'deck_reveal_kanji_check': {
      if (effect.targetKanji === undefined) return null;
      const targetKanjiList = Array.isArray(effect.targetKanji)
        ? effect.targetKanji
        : [effect.targetKanji];
      return resolveRevealCheckActions(
        gameState,
        ownerSide,
        ownerSide, // 自分の山札固定（誓のカード原文で確認。型にside項目が無いのも同じ理由と推測）
        effect.revealCount,
        (card) => targetKanjiList.includes(card.kanji),
        effect.onMatch,
        effect.onMiss,
      );
    }

    // 【追加】戒: 相手の山札を1枚ずつ墓地へ送り、既出の種類数がmaxDistinctKanjiに達するか、
    // 累計枚数がmaxCountに達したら止める。山札の並び順は既知のため、プレイヤーの選択なしに
    // 何枚・どのカードが対象になるか一意に確定できる。
    case 'deck_iterative_reveal_until_condition': {
      const targetSide = resolveSide(effect.targetSide, ownerSide);
      const deck = getPlayerState(gameState, targetSide).deck;
      const seenKanji = new Set<string>();
      const movedIds: string[] = [];

      for (const card of deck) {
        movedIds.push(card.id);
        seenKanji.add(card.kanji);

        const hitDistinct =
          effect.stopConditions.maxDistinctKanji !== undefined &&
          seenKanji.size >= effect.stopConditions.maxDistinctKanji;
        const hitCount =
          effect.stopConditions.maxCount !== undefined &&
          movedIds.length >= effect.stopConditions.maxCount;

        if (hitDistinct || hitCount) break;
      }

      if (movedIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: targetSide,
            targetSide: targetSide,
            cardIds: movedIds,
            sourceZone: 'deck',
            targetZone: effect.destination,
          },
        },
      ];
    }

    case 'sequence': {
      // 独立した複数ステップを順番に解決する。いずれか1ステップでも選択が必要（null）なら
      // sequence全体を未対応として返す。中途半端に一部だけ自動実行してしまうと、
      // 選択待ちの間に状態が不整合になるため。
      const allActions: GameAction[] = [];
      for (const step of effect.steps) {
        const stepActions = resolveMonsterEffect(step, ctx);
        if (stepActions === null) return null;
        allActions.push(...stepActions);
      }
      return allActions;
    }

    case 'graveyard_select_recover': {
      // count:'all'の場合のみ選択不要(養で確認)。数値指定は選択が必要なためnull(effectSelection.ts側で対応)
      if (effect.count !== 'all') return null;
      const cemetery = getPlayerState(gameState, ownerSide).cemetery;
      const matches = effect.targetKanji
        ? cemetery.filter((c) => c.kanji === effect.targetKanji)
        : cemetery;
      if (matches.length === 0) return [];
      const cardIds = matches.map((c) => c.id);
      const actions: GameAction[] = [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: ownerSide,
            targetSide: ownerSide,
            cardIds,
            sourceZone: 'cemetery',
            targetZone: 'deck',
          },
        },
      ];
      if (effect.placement === 'top') {
        actions.push({
          type: 'REORDER_DECK',
          payload: { side: ownerSide, orderedCardIds: cardIds },
        });
      } else {
        // 'shuffle'または未指定はシャッフルする(要確認: 上記参照)
        actions.push({ type: 'SHUFFLE_DECK', payload: { side: ownerSide } });
      }
      return actions;
    }

    case 'swap_deck_and_graveyard': {
      // 自分の山札全体と墓地全体を、それぞれの現在の順序を保ったまま丸ごと入れ替える（逆）。
      // 既存のMOVE_CARD_BETWEEN_ZONESは「山札の先頭からN枚」等の部分移動しか想定しておらず、
      // 山札・墓地を丸ごと入れ替える操作を安全に組み立てられない。
      // 新規Action（例: SWAP_ZONES）の追加が必要なため、別途提案してから実装する
      // （llm_development_guideline.md 1.1章の既存Action変更ルールに準拠）。
      return null;
    }

    case 'deck_normalize_to_count': {
      // 山札が超過している場合のみ自動解決可能(上から超過分を送るだけで選択不要)。
      // 不足している場合は墓地からの選択が必要なためnullを返す。
      const deck = getPlayerState(gameState, ownerSide).deck;
      if (deck.length < effect.targetCount) return null;
      const trashCount = deck.length - effect.targetCount;
      const actions: GameAction[] = [];
      if (trashCount > 0) {
        const cardIds = deck.slice(0, trashCount).map((c) => c.id);
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: ownerSide,
            targetSide: ownerSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: effect.overDestination,
          },
        });
      }
      if (effect.shuffleAfter) {
        actions.push({ type: 'SHUFFLE_DECK', payload: { side: ownerSide } });
      }
      return actions;
    }

    // 【追加】忍で確認：山札の指定位置のカードに遅延効果をマークする。位置はカード固有の
    // 値であり選択を挟まないため完全自動解決の対象。実際の追加減少処理は
    // useGameState.tsのAUTO_DRAW内で、マークされたカードが引かれた時点に行う。
    case 'deck_mark_delayed_reduce': {
      const targetSide = resolveSide(effect.targetSide, ownerSide);
      const targetDeck = getPlayerState(gameState, targetSide).deck;
      const targetCard = targetDeck[effect.revealPosition - 1];
      if (!targetCard) return [];
      return [
        {
          type: 'SET_DECK_CARD_TRAP',
          payload: {
            side: targetSide,
            cardId: targetCard.id,
            reduceCount: effect.reduceCount,
            destination: effect.destination ?? 'cemetery',
          },
        },
      ];
    }

    // 以下、選択・外部システム（勝敗判定）接続・複雑な副作用のいずれかが必要なため未対応（null）。
    // 対応が必要になった時点で、既存UI（DeckModal/JankenModal/MoveDestinationSelector）との
    // 連携方式を別途設計すること（design_document.md 7.8章参照）。
    case 'janken_conditional_reduce': // 【フェーズ5後半】JankenModal連携でeffectSelection.ts側にて対応済み
    case 'deck_predict_reveal_reduce': // 同上（KanjiTypePickerModal流用でeffectSelection.ts側にて対応済み）
    case 'deck_compare_branch': // 同上（少ない方の判定＋graveyard_select_recover委譲でeffectSelection.ts側にて対応済み）
    case 'graveyard_select_equip':
    case 'deck_select_equip':
    case 'deck_kanji_purge':
    case 'deck_full_reorder':
    case 'choose_number_reduce_both':
    case 'choose_number_reduce':
    case 'choice_of_effects':
    case 'deck_count_win_or_reduce':
    case 'deck_or_graveyard_count_win_condition':
    case 'deck_count_tiered_effect':
    case 'deck_select_trash':
    case 'deck_partial_reorder':
    case 'deck_partial_to_reserve':
    case 'deck_kanji_search_equip':
    case 'graveyard_total_count_threshold_win':
    case 'mixed_zone_select_trash':
    case 'graveyard_recover_then_deck_trash_matching_count':
    case 'monster_remove_from_game':
    case 'draw_and_play_n':
    case 'deck_predict_full_composition_win':
    case 'deck_diff_threshold_win_or_reduce':
    case 'select_zone_move_one':
    case 'flip_monster_facedown':
    case 'swap_equipped_with_graveyard':
    case 'custom':
      return null;

    default: {
      // 網羅性チェック: 新しいeffectIdが追加されたのに上記switchへの反映を忘れると、
      // ここでTypeScriptのコンパイルエラーになる
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}
