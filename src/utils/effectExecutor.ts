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
import { getEffectiveKanji } from './manaKanji';

// --- 汎用ヘルパー ---

export function getOpponentSide(side: PlayerSide): PlayerSide {
  return side === 'player' ? 'opponent' : 'player';
}

// 【追加・本/敗/墓/深】ログメッセージ用の簡易ラベル。useGameState.tsのgetSideLabelと同じ
// 対応関係だが、utils層からhooks層への逆依存を避けるためこのファイル内で完結させる。
// 【今回追加・星/流/養の専用ログ】drawFlow.ts・graveyardReactions.tsからも
// 同じ日本語ラベルを使ってlogNoteを組み立てられるようexport化した。
export function sideLabel(side: PlayerSide): string {
  return side === 'player' ? '自分' : '相手';
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

// 【今回追加・泊】ownerSide(効果を発動しようとしている側)が、相手の泊によって
// 現在無効化されているかを判定する。泊は相手モンスターの表向き固定の永続効果で
// あり、disabledOpponentTurnsRemainingが立っている(FLIP_MONSTER時にセットされ、
// NEXT_PHASE毎に消費される)間、ownerSide側のモンスター効果は原文通り「発動は
// するが効果は無効」になる(ユーザー確認済みQA)。相手が複数の泊を持っていても、
// 1体でも無効化中なら丸ごと無効とする(原文・FAQに複数泊の重複効果の記載が無いため
// 単純な「いずれかが有効なら無効化」で扱う)。
export function isMonsterEffectsDisabledByOpponentBan(
  gameState: GameState,
  ownerSide: PlayerSide,
): boolean {
  const opponentMonsters = getPlayerState(
    gameState,
    getOpponentSide(ownerSide),
  ).monsters;
  return opponentMonsters.some(
    (m) => !m.isFlipped && (m.disabledOpponentTurnsRemaining ?? 0) > 0,
  );
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
  return cemetery.filter((c) => targetKanji.includes(getEffectiveKanji(c)))
    .length;
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

// 【追加・永続パッシブ割り込みパイプライン(グループ1: mitigate/boost/block/redirect)】
//
// 対象: mitigate_deck_reduce_effect(浮)・boost_own_deck_reduce_effect(重・m00074)・
// block_next_deck_reduce_effect(抑)・redirect_own_deck_reduce(扱・返・圧・敵)。
//
// 設計方針: resolveMonsterEffect/buildActionsFromSelectionが返すActionを個別に書き換えるのではなく、
// dispatch直前(useEffectExecutor.ts側)で一括ラップする(案A)。既存30種類超のeffectIdケースには
// 一切手を入れない。山札減少は DAMAGE と MOVE_CARD_BETWEEN_ZONES(deck→自陣cemetery/exile) の
// 2種類のActionで表現されているため、両方から共通の意図(DeckReduceIntent)を抽出して処理する。
//
// 適用順序: ①boost(発動元自身の加算) → ②redirect(自分の山札が減る効果のみ対象) →
// ③mitigate(実際に減る側の軽減) → ④block(実際に減る側の全ブロック)。
// 浮のFAQ「浮を先に発動させた場合、注は発動できない」は、③の結果amountが0になることで、
// 後続の注(replace_own_effect_opponent_reduce、別タスク)の発動条件が自然に満たされなくなる形で再現される。

interface DeckReduceIntent {
  targetSide: PlayerSide;
  amount: number;
  destination: 'cemetery' | 'exile';
  // 【今回追加・星/流/養の専用ログ】DAMAGE/MOVE_CARD_BETWEEN_ZONESのlogNoteをそのまま
  // 引き継ぐ。パイプライン内で転嫁・注により中身が書き換わっても、発生源(星/流/養)の
  // 注記は保持したいため、intentの一部として運ぶ。
  logNote?: string;
  // 【今回追加・化の戻す位置UI】特定条件に合うカードを優先的に選びたい効果向けの
  // 候補IDリスト(指定順)。転嫁でtargetSideが変わった場合は意味を失うため、
  // originalTargetSideと現在のtargetSideが一致する場合のみbuildDeckReduceActionで採用する。
  preferredCardIds?: string[];
  originalTargetSide?: PlayerSide;
}

// passiveEffectは単体/配列どちらもあり得るため配列に正規化する
// 【変更】暮/浅/政/激の勝敗接続、および仁/花のdraw_replaceからも参照するためexportする。
// 【今回追加・isRemovedFromGame横断フィルタ】ゲームから取り除かれたモンスター
// (isRemovedFromGame:true)は、装備マナが全て墓地送りになった時点で盤面から実質的に
// 「いなくなった」ものとして扱うべきであり、以後どの永続パッシブも判定対象から
// 除外する。この関数を全ての永続パッシブ参照箇所(勝敗接続系・割り込みパイプライン・
// own_turn_start判定・draw_replace探索等)が共通で経由するため、ここ1箇所に
// ガードを集約するだけで全箇所に波及する(個別箇所へのisRemovedFromGameチェック
// 追加を避け、対応漏れのリスクを無くす設計)。
export function getPassiveList(monster: MonsterCard): PassiveEffect[] {
  if (monster.isRemovedFromGame) return [];
  if (!monster.passiveEffect) return [];
  return Array.isArray(monster.passiveEffect)
    ? monster.passiveEffect
    : [monster.passiveEffect];
}

// 【今回追加・泊】山札減少/マナ破棄の永続パッシブ割り込みパイプライン
// (applyDeckReducePassives/applyManaTrashPassives内の各判定関数)専用のゲート付き版。
// side(そのモンスターの所有側)が相手の泊で無効化されている間は、getPassiveListと
// 同じisRemovedFromGameガードに加えて空配列を返す(「発動はするが効果は無効」)。
// 【対象外(意図的)】以下は泊の無効化対象に含めない:
//   - getActivatableEffect(発動ボタンの活性判定自体): ユーザー確認済みの方針
//     「発動ボタン自体は押せる」により、通常のgetPassiveListのまま変更しない。
//   - own_turn_start判定・勝敗接続系(暮/浅/政/激)・draw_replace(仁/花)探索:
//     Q&Aで言及された範囲は「山札を減らす/マナが墓地へ送られる」割り込み
//     パイプラインのみのため、今回はそのスコープに限定する(継続課題として6章に
//     記録: 泊の無効化範囲をこれら他の永続効果にも広げるかは未確認)。
//   - FLIP_MONSTER内の泊自身の発動判定: 泊自身がこのゲートの対象になると、
//     泊が永遠に発動できなくなる自己言及的な矛盾が生じるため対象外。
//
// 【今回追加・表向きガード】割り込み対象の永続効果は原文が揃って「このカードは
// おもてむきのままにする」で始まる表向き固定の効果のため、裏向き(isFlipped:true、
// ゲーム開始時の初期状態)の間は割り込みに関与させない。従来この確認が無く、
// 裏向きのまま盤面に置いてあるだけで浮・抑・扱・囲等が効いていた。
// 扱・返・圧・抑の消費時FLIP_MONSTER(トグル)は「表→裏」を前提にしており、裏向きのまま
// 割り込むと逆に表向きになってしまう不具合も、このガードで同時に解消される。
// getPassiveList自体には入れない(FLIP_MONSTERの泊検出は「裏→表になる瞬間」に読むため、
// 常に空配列になり泊が発動できなくなる)。返す配列の並びは元と同じで、
// passiveIndex/consumedPassiveIndexesとの対応はずれない。
export function getPassiveListGatedByBan(
  monster: MonsterCard,
  gameState: GameState,
  side: PlayerSide,
): PassiveEffect[] {
  if (monster.isFlipped) return [];
  if (isMonsterEffectsDisabledByOpponentBan(gameState, side)) return [];
  return getPassiveList(monster);
}

function isPassiveConsumed(
  monster: MonsterCard,
  passiveIndex: number,
): boolean {
  return monster.consumedPassiveIndexes?.includes(passiveIndex) ?? false;
}

// boost_own_deck_reduce_effect: 発動元自身の所有モンスターの加算値を合算する。
// scopeが指定されている場合、'deck'を含まないスコープ(monster_mana限定等)は対象外
// (現時点ではdeck起点の減少のみを扱うため。monster_mana側の対応は別タスク)。
function sumBoostAmount(gameState: GameState, actingSide: PlayerSide): number {
  const monsters = getPlayerState(gameState, actingSide).monsters;
  let total = 0;
  monsters.forEach((monster) => {
    getPassiveListGatedByBan(monster, gameState, actingSide).forEach(
      (passive) => {
        if (passive.trigger !== 'boost_own_deck_reduce_effect') return;
        if (passive.scope && !passive.scope.includes('deck')) return;
        total += passive.extraCount;
      },
    );
  });
  return total;
}

// mitigate_deck_reduce_effect: 実際に減少を受ける側(targetSide)の所有モンスターの軽減値を合算する。
// 浮のFAQ通り、発動元が自分/相手のどちらであっても適用対象になる(sideを問わない)。
function sumMitigateAmount(
  gameState: GameState,
  targetSide: PlayerSide,
): number {
  const monsters = getPlayerState(gameState, targetSide).monsters;
  let total = 0;
  monsters.forEach((monster) => {
    getPassiveListGatedByBan(monster, gameState, targetSide).forEach(
      (passive) => {
        if (passive.trigger === 'mitigate_deck_reduce_effect')
          total += passive.amount;
      },
    );
  });
  return total;
}

interface RedirectMatch {
  monsterIndex: number;
  passiveIndex: number;
  fixedCount?: number;
  consumeAfterUse: boolean;
  // 消費されない転嫁(敵)が、同じ連鎖の中で再び発動しようとした=永遠に転嫁し合う状態
  loop?: boolean;
}

// redirect_own_deck_reduce: 山札が減る側(ownerSide)の未消費の転嫁を1件だけ採用する。
// 【今回改訂】従来は「自分の効果で自分の山札が減る」場合(ownerSide===actingSide)しか見ておらず、
// 相手の効果で自分の山札が減るときの敵・返・圧が発動しなかった(公式QA: 相手の泣に対して
// 敵が発動する)。ownEffectOnly(扱)だけは自分の効果のときに限る。
// fixedCount指定は常に適用。minCount/maxCount指定は元のamountがその範囲内の場合のみ適用し、
// 適用時はamountをそのまま(同数)相手へ転嫁する(敵のケース)。
// usedは、この連鎖(転嫁の応酬)で既に使った転嫁のキー。消費される転嫁(返・圧)は使用済みなら
// 裏向きに戻っているため候補から外し、消費されない転嫁(敵)が再び候補になったときはloopを返す
// (公式QA: 敵と敵が表向きなら永遠に発動し合い、ダメージは無効になる)。
function findApplicableRedirect(
  gameState: GameState,
  ownerSide: PlayerSide,
  actingSide: PlayerSide,
  amount: number,
  used: Set<string>,
): RedirectMatch | null {
  const monsters = getPlayerState(gameState, ownerSide).monsters;
  for (let monsterIndex = 0; monsterIndex < monsters.length; monsterIndex++) {
    const monster = monsters[monsterIndex];
    const passives = getPassiveListGatedByBan(monster, gameState, ownerSide);
    for (let passiveIndex = 0; passiveIndex < passives.length; passiveIndex++) {
      const passive = passives[passiveIndex];
      if (passive.trigger !== 'redirect_own_deck_reduce') continue;
      if (isPassiveConsumed(monster, passiveIndex)) continue;
      if (passive.ownEffectOnly && ownerSide !== actingSide) continue;
      const { minCount, maxCount, fixedCount } = passive.scope;
      const inRange =
        fixedCount !== undefined ||
        ((minCount === undefined || amount >= minCount) &&
          (maxCount === undefined || amount <= maxCount));
      if (!inRange) continue;
      const key = `${ownerSide}:${monsterIndex}:${passiveIndex}`;
      if (used.has(key)) {
        if (passive.consumeAfterUse) continue;
        return {
          monsterIndex,
          passiveIndex,
          fixedCount,
          consumeAfterUse: passive.consumeAfterUse,
          loop: true,
        };
      }
      return {
        monsterIndex,
        passiveIndex,
        fixedCount,
        consumeAfterUse: passive.consumeAfterUse,
      };
    }
  }
  return null;
}

interface BlockMatch {
  monsterIndex: number;
  passiveIndex: number;
}

// block_next_deck_reduce_effect: 実際に減少を受ける側(targetSide)の未消費の1件を採用し、amountを0にする。
// 「次の1回」を意味する効果のため、常に1回発動で消費済み扱いにする(フィールドにconsumeAfterUseは
// 存在しないが、トリガー名自体が一度きりを意味するため無条件で消費対象とする)。
function findApplicableBlock(
  gameState: GameState,
  targetSide: PlayerSide,
): BlockMatch | null {
  const monsters = getPlayerState(gameState, targetSide).monsters;
  for (let monsterIndex = 0; monsterIndex < monsters.length; monsterIndex++) {
    const monster = monsters[monsterIndex];
    const passives = getPassiveListGatedByBan(monster, gameState, targetSide);
    for (let passiveIndex = 0; passiveIndex < passives.length; passiveIndex++) {
      if (passives[passiveIndex].trigger !== 'block_next_deck_reduce_effect')
        continue;
      if (isPassiveConsumed(monster, passiveIndex)) continue;
      return { monsterIndex, passiveIndex };
    }
  }
  return null;
}

interface ReplaceMatch {
  selfCost: number;
  opponentCount: number;
}

// replace_own_effect_opponent_reduce（注）: 発動元(actingSide)自身が持つ場合、
// 「自分の効果が相手の山札を減らす」という結果を丸ごと「自分-selfCost・相手-opponentCount」へ置換する。
// consumeAfterUseに相当する概念が無いため常時発動対象(未消費管理は不要)。複数所持していても
// 先頭の1件のみ採用する(重複適用は原文に記載が無いため対象外)。
function findApplicableReplace(
  gameState: GameState,
  actingSide: PlayerSide,
): ReplaceMatch | null {
  const monsters = getPlayerState(gameState, actingSide).monsters;
  for (const monster of monsters) {
    for (const passive of getPassiveListGatedByBan(
      monster,
      gameState,
      actingSide,
    )) {
      if (passive.trigger === 'replace_own_effect_opponent_reduce') {
        return {
          selfCost: passive.selfCost,
          opponentCount: passive.opponentCount,
        };
      }
    }
  }
  return null;
}

// DAMAGE、または「山札→自陣cemetery/exile」を表すMOVE_CARD_BETWEEN_ZONESから
// 共通の意図(DeckReduceIntent)を抽出する。対象外のActionはnullを返しそのまま素通りさせる。
function extractDeckReduceIntent(action: GameAction): DeckReduceIntent | null {
  if (action.type === 'DAMAGE') {
    const targetSide = action.payload.targetSide ?? action.payload.side;
    if (!targetSide) return null;
    return {
      targetSide,
      amount: action.payload.amount,
      destination: 'cemetery',
      logNote: action.payload.logNote,
    };
  }
  if (
    action.type === 'MOVE_CARD_BETWEEN_ZONES' &&
    action.payload.sourceZone === 'deck' &&
    action.payload.sourceSide === action.payload.targetSide &&
    (action.payload.targetZone === 'cemetery' ||
      action.payload.targetZone === 'exile')
  ) {
    return {
      targetSide: action.payload.targetSide,
      amount: action.payload.cardIds.length,
      destination: action.payload.targetZone,
      logNote: action.payload.logNote,
      preferredCardIds: action.payload.preferredCardIds,
      originalTargetSide: action.payload.targetSide,
    };
  }
  return null;
}

// 書き換え後のDeckReduceIntentから、MOVE_CARD_BETWEEN_ZONES Actionを再構築する。
// amountが0以下、または対象の山札が既に0枚ならAction自体を発生させない(null)。
// 【今回追加】intent.logNoteをそのまま引き継ぐ(星/流/養の専用ログ用)。
// 【今回追加・化の戻す位置UI】intent.preferredCardIdsが指定されており、かつtargetSideが
// 転嫁等で変化していない(originalTargetSide===targetSide)場合、単純な「上からN枚」
// (takeTopDeckIds)ではなく、指定されたID群を優先的に(現在の山札に実在するものだけ、
// 指定順に)採用する。amountがpreferredの件数を上回る場合(boost等で増えた場合)は、
// 既に選ばれたIDを除いた上で通常どおり上から不足分を補う。
function buildDeckReduceAction(
  gameState: GameState,
  intent: DeckReduceIntent,
): GameAction | null {
  if (intent.amount <= 0) return null;
  const deck = getPlayerState(gameState, intent.targetSide).deck;

  let cardIds: string[];
  if (
    intent.preferredCardIds &&
    intent.preferredCardIds.length > 0 &&
    intent.originalTargetSide === intent.targetSide
  ) {
    const deckIds = new Set(deck.map((c) => c.id));
    const preferred = intent.preferredCardIds.filter((id) => deckIds.has(id));
    const selected = preferred.slice(0, intent.amount);
    if (selected.length < intent.amount) {
      const selectedSet = new Set(selected);
      const remaining = deck
        .filter((c) => !selectedSet.has(c.id))
        .slice(0, intent.amount - selected.length)
        .map((c) => c.id);
      selected.push(...remaining);
    }
    cardIds = selected;
  } else {
    cardIds = takeTopDeckIds(gameState, intent.targetSide, intent.amount);
  }

  if (cardIds.length === 0) return null;
  return {
    type: 'MOVE_CARD_BETWEEN_ZONES',
    payload: {
      sourceSide: intent.targetSide,
      targetSide: intent.targetSide,
      cardIds,
      sourceZone: 'deck',
      targetZone: intent.destination,
      logNote: intent.logNote,
    },
  };
}

// 【今回改訂・重大】囲(shield_counter_deck_protection)を山札減少パイプラインへ追加し、
// 処理順序を「①boost→②抑(強制・相手の効果限定)→③囲(相手の効果限定・1枚消費で全量ブロック)
// →④転嫁(敵・返・圧・扱)→⑤浮(実際に減る側の軽減)→⑥注」に確定した(design書7.3章5番の
// 暫定案「抑＞囲＞リダイレクト系＞浮」をそのまま実装)。従来は抑・浮が転嫁の後(かつ抑は浮の後)に
// 判定されており、原文の優先順位と逆順だった。あわせて、抑・囲とも原文「あいてのモンスターの
// 効果で」に従い、転嫁前の元の対象(targetSide)が自分自身の効果で山札を減らす場合
// (targetSide===actingSide、負・吐・極・或等の自山札減少)には発動しないガードを追加した
// (従来の抑は自分の効果による自山札減少も誤ってブロックしていた)。
//
// 【今回改訂】抑・囲は転嫁の「前」の元の対象に対して一度だけ判定し、転嫁ループの各ホップでは
// 再判定しない(抑・囲はいずれも「次の1回」を丸ごと防ぐ効果のため、転嫁が発生する余地自体を
// 消してしまう設計。転嫁の応酬に割り込む囲・抑の存在は原文・FAQに記載が無いため、今回はこの
// 単純化した設計で確定した)。
//
// 【今回改訂・転嫁の応酬とactingSideの扱い】「転嫁したモンスターの持ち主を、その後の発動者と
// みなす」(ユーザー確認済み)。転嫁が発生するたびにcurrentActingSideを転嫁元の持ち主(redirectOwner)
// へ更新し、次のホップのfindApplicableRedirect(扱のownEffectOnly判定)に渡す。
//
// 【今回改訂・装備マナ側の囲を撤去】従来applyManaTrashPassives(TRASH_MANA専用)にも囲の判定が
// 入っていたが、原文「じぶんの山札がへるとき」は山札減少のみを対象としており、装備マナの破棄を
// 守る記載が無い(装備マナを守るのは吸の役目)。二重実装だったため、山札減少側(本関数)に一本化し、
// applyManaTrashPassives側からは撤去した。
export function applyDeckReducePassives(
  actions: GameAction[],
  actingSide: PlayerSide,
  gameState: GameState,
): GameAction[] {
  const result: GameAction[] = [];
  const consumptions: GameAction[] = [];

  for (const action of actions) {
    const intent = extractDeckReduceIntent(action);
    if (!intent) {
      result.push(action);
      continue;
    }

    let targetSide = intent.targetSide;
    // 【今回改訂・重大】原文「あいての山札をへらすとき」に従い、boost(重・伸)は転嫁前の
    // 元の対象(intent.targetSide)が相手側の場合のみ適用する。従来はtargetSideを問わず
    // 無条件で加算しており、自分自身の山札を減らす効果(負・吐・生・方のstep1、化の墓地送り、
    // 或の超過分送り等)にも重・伸が誤って乗ってしまっていた。
    let amount =
      intent.amount +
      (intent.targetSide !== actingSide
        ? sumBoostAmount(gameState, actingSide)
        : 0);
    let currentActingSide = actingSide;
    let blockedOrShielded = false;

    // ①抑(block_next_deck_reduce_effect): 「あいてのモンスターの効果で」に従い、
    // 転嫁前の元の対象が自分自身の効果で山札を減らす場合は対象外。強制発動・次の1回を防ぐ。
    if (targetSide !== currentActingSide) {
      const block = findApplicableBlock(gameState, targetSide);
      if (block) {
        amount = 0;
        blockedOrShielded = true;
        consumptions.push({
          type: 'CONSUME_PASSIVE_EFFECT',
          payload: {
            side: targetSide,
            monsterIndex: block.monsterIndex,
            passiveIndex: block.passiveIndex,
          },
        });
        // 抑の原文「このカードを、うらむきにもどす」対応。
        consumptions.push({
          type: 'FLIP_MONSTER',
          payload: { side: targetSide, monsterIndex: block.monsterIndex },
        });
      }
    }

    // ②囲(shield_counter_deck_protection): 抑と同じく「あいてのカードの効果で」限定。
    // 抑が既に発動していれば判定しない(抑で丸ごと防がれた減少に、囲のバッファを消費する
    // 必要は無いため)。
    if (!blockedOrShielded && targetSide !== currentActingSide) {
      const shield = findApplicableShield(gameState, targetSide);
      if (shield) {
        amount = 0;
        blockedOrShielded = true;
        const shieldMonster = getPlayerState(gameState, targetSide).monsters[
          shield.monsterIndex
        ];
        const remainingBuffer = (shieldMonster.reservedCards ?? []).filter(
          (c) => c.id !== shield.bufferCardId,
        );
        consumptions.push({
          type: 'CONSUME_RESERVED_CARD',
          payload: {
            side: targetSide,
            monsterIndex: shield.monsterIndex,
            cardId: shield.bufferCardId,
          },
        });
        if (remainingBuffer.length === 0) {
          consumptions.push({
            type: 'FLIP_MONSTER',
            payload: { side: targetSide, monsterIndex: shield.monsterIndex },
          });
        }
      }
    }

    // ③転嫁(敵・返・圧・扱)。抑・囲で防がれていた場合はスキップする(転嫁の余地自体が無い)。
    // 山札が減る側(targetSide)が持つ転嫁を、転嫁先の側が持つ転嫁で更に転嫁し返す応酬まで
    // 扱う(上限あり)。敵と敵など、消費されない転嫁どうしが永遠に発動し合う場合は、
    // ダメージ自体を無効にする(公式QA)。
    if (!blockedOrShielded) {
      const usedRedirects = new Set<string>();
      for (let hop = 0; hop < 8; hop++) {
        const redirect = findApplicableRedirect(
          gameState,
          targetSide,
          currentActingSide,
          amount,
          usedRedirects,
        );
        if (!redirect) break;
        if (redirect.loop) {
          amount = 0;
          break;
        }
        const redirectOwner = targetSide;
        usedRedirects.add(
          `${redirectOwner}:${redirect.monsterIndex}:${redirect.passiveIndex}`,
        );
        amount = redirect.fixedCount ?? amount;
        targetSide = getOpponentSide(redirectOwner);
        // 【今回追加】転嫁したモンスターの持ち主を、その後の発動者とみなす。
        currentActingSide = redirectOwner;
        if (redirect.consumeAfterUse) {
          consumptions.push({
            type: 'CONSUME_PASSIVE_EFFECT',
            payload: {
              side: redirectOwner,
              monsterIndex: redirect.monsterIndex,
              passiveIndex: redirect.passiveIndex,
            },
          });
          // 扱・返・圧の原文「このカードをうらむきにもどす」対応。
          consumptions.push({
            type: 'FLIP_MONSTER',
            payload: {
              side: redirectOwner,
              monsterIndex: redirect.monsterIndex,
            },
          });
        }
      }
    }

    // ④浮(mitigate_deck_reduce_effect): 最終的な対象側の軽減。
    amount = Math.max(0, amount - sumMitigateAmount(gameState, targetSide));

    // 【追加・注】ここまでの結果、相手側の山札が実際に減る状態が残っている場合のみ判定する。
    // 浮のmitigateや抑・囲で既に0になっていれば、この時点でamount<=0のため発動しない
    // (FAQ「浮を先に発動させた場合、注は発動できない」を自然に再現)。
    if (amount > 0 && targetSide === getOpponentSide(actingSide)) {
      const replace = findApplicableReplace(gameState, actingSide);
      if (replace) {
        // 注のselfCost(自分-1)は、自分側が浮等のmitigateを持っていても軽減対象にしない
        // (原文に記載が無いため固定値のまま、design書6章の既存方針を踏襲)。
        const selfAction = buildDeckReduceAction(gameState, {
          targetSide: actingSide,
          amount: replace.selfCost,
          destination: intent.destination,
        });
        if (selfAction) result.push(selfAction);

        // 注の発動によって生じる相手側への減少(opponentCount)も、「山札を減らす効果」の
        // 一種として扱い、改めて相手側のmitigate/block/shieldを適用する(ユーザー確認済み)。
        // 直前のsumMitigateAmount/findApplicableBlockは「注が発動する前の、置換前の
        // 山札減少」に対する判定であり、注が生み出す「新しい山札減少(opponentCount)」には
        // まだ一切適用されていないため、ここで改めて適用しても二重軽減・二重消費にはならない。
        amount = Math.max(
          0,
          replace.opponentCount - sumMitigateAmount(gameState, targetSide),
        );
        if (amount > 0) {
          const block2 = findApplicableBlock(gameState, targetSide);
          if (block2) {
            amount = 0;
            consumptions.push({
              type: 'CONSUME_PASSIVE_EFFECT',
              payload: {
                side: targetSide,
                monsterIndex: block2.monsterIndex,
                passiveIndex: block2.passiveIndex,
              },
            });
            consumptions.push({
              type: 'FLIP_MONSTER',
              payload: {
                side: targetSide,
                monsterIndex: block2.monsterIndex,
              },
            });
          } else {
            // 【今回追加】注の二次減少(opponentCount)にも囲の一貫性を保つため、
            // 抑と同様に囲の判定を追加した(注の対象は常にtargetSide!==actingSideのため
            // 相手限定チェックは不要)。
            const shield2 = findApplicableShield(gameState, targetSide);
            if (shield2) {
              amount = 0;
              const shieldMonster2 = getPlayerState(gameState, targetSide)
                .monsters[shield2.monsterIndex];
              const remainingBuffer2 = (
                shieldMonster2.reservedCards ?? []
              ).filter((c) => c.id !== shield2.bufferCardId);
              consumptions.push({
                type: 'CONSUME_RESERVED_CARD',
                payload: {
                  side: targetSide,
                  monsterIndex: shield2.monsterIndex,
                  cardId: shield2.bufferCardId,
                },
              });
              if (remainingBuffer2.length === 0) {
                consumptions.push({
                  type: 'FLIP_MONSTER',
                  payload: {
                    side: targetSide,
                    monsterIndex: shield2.monsterIndex,
                  },
                });
              }
            }
          }
        }
      }
    }

    const rebuilt = buildDeckReduceAction(gameState, {
      targetSide,
      amount,
      destination: intent.destination,
      logNote: intent.logNote,
      preferredCardIds: intent.preferredCardIds,
      originalTargetSide: intent.originalTargetSide,
    });
    if (rebuilt) result.push(rebuilt);
  }

  return [...result, ...consumptions];
}

// 【追加・永続パッシブ割り込みパイプライン(グループ2: TRASH_MANA対応)】
//
// 対象: negate_own_mana_trash_by_opponent(吸)。
// applyDeckReducePassivesとは別関数とする(対象Actionの種類が異なるため)。
// 山札減少(DAMAGE/MOVE_CARD_BETWEEN_ZONES)ではなくTRASH_MANA(装備マナの破棄)のみを対象とする。
//
// 適用対象: 「相手の効果による」TRASH_MANAのみ(actingSide !== 対象マナの所有側の場合)。
// 手動操作(全マナ破棄ボタン等)・認/獄の随伴処理(REMOVE_MONSTER_FROM_GAMEに伴うTRASH_MANA)は
// 呼び出し側(useEffectExecutor.ts)で「効果解決経由のdispatchのみ」に絞ることで対象外とする。
//
// 適用順序: ①吸(negate_own_mana_trash_by_opponent、無条件で全量無効化)
// → ②拾(own_mana_trashed_by_opponent_reaction)の発動条件検知(無効化されなかった場合のみ)。
//
// 【今回改訂・重大】囲(shield_counter_deck_protection)は本関数から撤去した。原文「あいてのカードの
// 効果でじぶんの山札がへるとき」は山札減少のみが対象であり、装備マナの破棄(TRASH_MANA)を
// 守る記載が無い(装備マナを守るのは吸の役目)。従来は山札減少側(applyDeckReducePassives)に
// 囲が未配線だったための代替として、ここにも囲の判定が誤って残っていた。今回、山札減少側に
// 囲を正式配線したことで、こちらの重複実装は不要と判断し撤去した。囲の`shield_counter_deck_protection`
// トリガー・findApplicableShieldヘルパー自体はapplyDeckReducePassives側で引き続き使用する
// (function宣言のためホイスティングにより、テキスト上の定義位置に関わらず参照可能)。
//
// 【設計注記】戻り値をGameAction[]ではなく{actions, pickupTrigger?}に拡張している。
// 純粋関数であるこの層から、状態を持つuseEffectExecutor.ts側へ「拾の発動条件が成立したこと」を
// 伝える必要があるため(applyDeckReducePassivesのような単純な書き換えだけでは完結しない)。

interface ShieldMatch {
  monsterIndex: number;
  bufferCardId: string; // 消費するreservedCardsの1枚
}

// shield_counter_deck_protection: 対象側(targetSide、山札が減る側)の
// reservedCardsが1枚以上残っている未消費のものを先頭から1件採用する。
// 【今回改訂】呼び出し元をapplyManaTrashPassives(TRASH_MANA)からapplyDeckReducePassives
// (山札減少)へ変更した(装備マナ側の囲は撤去。上記コメント参照)。
function findApplicableShield(
  gameState: GameState,
  targetSide: PlayerSide,
): ShieldMatch | null {
  const monsters = getPlayerState(gameState, targetSide).monsters;
  for (let monsterIndex = 0; monsterIndex < monsters.length; monsterIndex++) {
    const monster = monsters[monsterIndex];
    const hasShieldPassive = getPassiveListGatedByBan(
      monster,
      gameState,
      targetSide,
    ).some((p) => p.trigger === 'shield_counter_deck_protection');
    if (!hasShieldPassive) continue;
    const buffer = monster.reservedCards ?? [];
    if (buffer.length === 0) continue;
    return { monsterIndex, bufferCardId: buffer[0].id };
  }
  return null;
}

// negate_own_mana_trash_by_opponent: 対象側(targetSide)が持つ未消費のものを1件採用する。
// consumeAfterUse相当の概念が無いため常時発動(毎回同じモンスターが対象になり得る)。
function hasApplicableNegate(
  gameState: GameState,
  targetSide: PlayerSide,
): boolean {
  const monsters = getPlayerState(gameState, targetSide).monsters;
  return monsters.some((monster) =>
    getPassiveListGatedByBan(monster, gameState, targetSide).some(
      (p) => p.trigger === 'negate_own_mana_trash_by_opponent',
    ),
  );
}

export interface ManaTrashPassiveResult {
  actions: GameAction[];
  // 【追加・拾】相手の効果によるTRASH_MANAが吸で無効化されず実際に発生した場合、
  // 拾を持つモンスターがあればその発動トリガー情報を載せる。呼び出し側(useEffectExecutor.ts)が
  // これを見てpendingSelectionへpickup_select要求を追加する。
  pickupTrigger?: {
    side: PlayerSide;
    monsterIndex: number;
    trashedCards: ManaCard[];
  };
}

// dispatch直前にTRASH_MANA Actionをこの関数へ通すことで、囲・吸の2トリガーを適用し、
// 拾の発動条件成立を検知する。TRASH_MANAを表さないActionはそのまま通す。
// actingSideは効果の発動者、対象マナの所有側との比較で「相手の効果によるTRASH_MANAか」を判定する
// (自分自身の効果によるTRASH_MANAは対象外)。
export function applyManaTrashPassives(
  actions: GameAction[],
  actingSide: PlayerSide,
  gameState: GameState,
): ManaTrashPassiveResult {
  const result: GameAction[] = [];
  const consumptions: GameAction[] = [];
  let pickupTrigger: ManaTrashPassiveResult['pickupTrigger'];

  for (const action of actions) {
    if (action.type !== 'TRASH_MANA') {
      result.push(action);
      continue;
    }

    const targetSide = action.payload.side;
    // 自分自身の効果による自分のTRASH_MANAは対象外(囲・吸とも「あいての効果」限定のため)
    if (targetSide === actingSide) {
      result.push(action);
      continue;
    }

    // 【今回改訂・重大】囲(shield_counter_deck_protection)の判定はここから撤去した
    // (装備マナ側の囲を撤去。関数冒頭のコメント参照)。

    if (hasApplicableNegate(gameState, targetSide)) {
      continue; // 吸: 無条件で無効化(このTRASH_MANA自体を発生させない)
    }

    // 【追加・拾】ブロックも無効化もされなかった＝実際にTRASH_MANAが発生する。
    // targetSide側に拾を持つモンスターがいれば、実際に墓地送りになるカードの実体を控えておく。
    const pickupMonsterIndex = getPlayerState(
      gameState,
      targetSide,
    ).monsters.findIndex((monster) =>
      getPassiveListGatedByBan(monster, gameState, targetSide).some(
        (p) => p.trigger === 'own_mana_trashed_by_opponent_reaction',
      ),
    );
    if (pickupMonsterIndex !== -1 && !pickupTrigger) {
      const targetMonster = getPlayerState(gameState, targetSide).monsters[
        action.payload.monsterIndex
      ];
      const trashedCards =
        action.payload.manaCardIds === 'all'
          ? targetMonster.equippedMana.filter((m): m is ManaCard => m !== null)
          : targetMonster.equippedMana.filter(
              (m): m is ManaCard =>
                m !== null && action.payload.manaCardIds.includes(m.id),
            );
      if (trashedCards.length > 0) {
        pickupTrigger = {
          side: targetSide,
          monsterIndex: pickupMonsterIndex,
          trashedCards,
        };
      }
    }

    result.push(action);
  }

  return { actions: [...result, ...consumptions], pickupTrigger };
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

  // 【今回追加・表向きガード】詩・歩・脈・然の原文は「このカードはおもてむきのままにする」で
  // 始まる表向き固定の永続効果のため、裏向き(isFlipped:true)の間は発動対象にしない。
  if (isOwnStartPhase && !monster.isFlipped) {
    const startTrigger = getPassiveList(monster).find(
      (p): p is Extract<PassiveEffect, { trigger: 'own_turn_start' }> =>
        p.trigger === 'own_turn_start',
    );
    if (startTrigger) return startTrigger.action;
  }

  // 【今回追加・isRemovedFromGame横断フィルタ】取り除かれたモンスター自身の発動ボタンは
  // 既にMonsterZone.tsx側でdisabled化されているが(design書3.2章)、念のためgetActivatableEffect
  // 自体でも二重にガードしておく(呼び出し元が将来増えた場合の安全策)。
  if (monster.isRemovedFromGame) return null;

  // 【表面固定永続効果の発動ガード】囲・政は「このカードはおもてむきの
  // ままにする」永続効果を持ち、monster.effectは前準備発動として1回限りである
  // 【今回改訂】1回限りの管理は、従来のFLIP_MONSTER(発動時に裏向き化)ではなく
  // MonsterCard.preparationUsed(effectSelection.tsのMARK_PREPARATION_USEDで立てる)で行う。
  // 裏向き化すると「おもてむきのままにする」という原文と矛盾し、政の勝利条件監視
  // (!isFlipped)停止・囲のバッファ切れ時トグル逆転の不具合を生んだため。
  // 次の場合、effectを発動対象から除外する:
  //   - preparationUsed:true(発動済み。裏向きに戻ればFLIP_MONSTER側でクリアされる)
  //   - isFlipped:true(裏向き。前準備は表向きの状態でのみ発動できる)
  // 【保は対象外】保も同種の永続効果だが、山札0枚時の自動返却処理
  // (useGameState.tsのreturnReservedCardsIfDeckEmpty)が「!m.isFlipped(表向き)」を
  // 対象探索の条件にしているため、発動時に裏向き化すると自動返却が機能しなくなる
  // 致命的な矛盾が生じる。そのため保は従来通り「発動後も表向きのまま」を維持し、
  // 発動ガードの対象から意図的に除外している(ユーザー確認済み、継続課題として
  // 6章に記録: 保の発動ボタン自体は繰り返し押せる状態が残る)。
  const FACE_UP_LOCKED_EFFECT_IDS = new Set<string>([
    'graveyard_partial_to_reserve', // 囲
    'deck_seed_mana_win_condition', // 政
  ]);
  if (
    monster.effect &&
    FACE_UP_LOCKED_EFFECT_IDS.has(monster.effect.effectId) &&
    (monster.isFlipped || monster.preparationUsed)
  ) {
    return null;
  }
  return monster.effect ?? null;
}

// 【今回追加】装備先モンスターの空きスロットの漢字(重複あり、スロット順)。
// equippedManaはgenerateGameCards直後は[]で始まりnullで埋められていなかったため、
// `=== null`で判定すると初期状態のモンスターが常に「空き無し」扱いになっていた。
// SET_INITIAL_STATEでnull埋めに正規化した現在も、undefinedを空きとして扱う防御は残す。
export function getOpenSlotKanji(monster: MonsterCard): string[] {
  return monster.slots.filter((_, i) => !monster.equippedMana[i]);
}

// 【今回追加・命】ターン開始のドローで引く枚数。表向き(泊で無効化中でない)の命
// (draw_count_override)がいればその枚数、いなければ1枚。
export function getTurnStartDrawCount(
  gameState: GameState,
  side: PlayerSide,
): number {
  let count = 1;
  getPlayerState(gameState, side).monsters.forEach((monster) => {
    getPassiveListGatedByBan(monster, gameState, side).forEach((p) => {
      if (p.trigger === 'draw_count_override') count = Math.max(count, p.count);
    });
  });
  return count;
}

// 【今回追加・星/走】山札の上からn枚を順に引いたときに実際に引かれるカードを返す
// (AUTO_DRAWの忍トラップ処理を再現: 引いたカードにtrapEffectがあれば、その直後に山札の上から
// reduceCount枚が失われるため、以降に引かれるカードが変わる)。山札が尽きれば途中で打ち切る。
export function simulateDeckDraws(deck: ManaCard[], n: number): ManaCard[] {
  const remaining = [...deck];
  const drawn: ManaCard[] = [];
  for (let i = 0; i < n && remaining.length > 0; i++) {
    const card = remaining.shift()!;
    drawn.push(card);
    if (card.trapEffect) remaining.splice(0, card.trapEffect.reduceCount);
  }
  return drawn;
}

// 【今回追加・星】on_draw(星): 「山札をひくときに発動する。日か月ならあいての山札を3まい墓地へ」。
// drawerSide(星の所有者)が引いたカードの漢字(drawnKanji。複数枚可)を受け取り、対象となる
// 山札減少を表すDAMAGE Actionを返す(効果による山札減少のため、呼び出し側で
// applyDeckReducePassives(重・浮・抑・注等)を通すこと)。表向きで泊に無効化されていない星のみ
// 有効。複数枚が一致する場合は、同じ対象への減少を1つのActionに合算する。
export function getStarReactionActions(
  gameState: GameState,
  drawerSide: PlayerSide,
  drawnKanji: string[],
): GameAction[] {
  const totals: Partial<Record<PlayerSide, number>> = {};
  getPlayerState(gameState, drawerSide).monsters.forEach((monster) => {
    getPassiveListGatedByBan(monster, gameState, drawerSide).forEach((p) => {
      if (p.trigger !== 'on_draw') return;
      const hits = drawnKanji.filter((k) => p.targetKanji.includes(k)).length;
      if (hits === 0) return;
      const target = resolveSide(p.onMatch.targetSide, drawerSide);
      totals[target] = (totals[target] ?? 0) + hits * p.onMatch.count;
    });
  });
  const logNote = `${sideLabel(drawerSide)}の星`;
  return (Object.entries(totals) as [PlayerSide, number][]).map(
    ([targetSide, amount]): GameAction => ({
      type: 'DAMAGE',
      payload: { targetSide, amount, logNote },
    }),
  );
}

// 【今回追加・流】on_opponent_draw_predict(流): drawerSideが山札から引く際に予想を行う、
// 表向きで泊に無効化されていない流(drawerSideの相手側が所有)を探し、的中時に墓地へ送る枚数
// (引いたマナを含む)を返す。いなければnull。
export function getFlowWatcher(
  gameState: GameState,
  drawerSide: PlayerSide,
): { watcherSide: PlayerSide; hitCount: number } | null {
  const watcherSide = getOpponentSide(drawerSide);
  for (const monster of getPlayerState(gameState, watcherSide).monsters) {
    for (const p of getPassiveListGatedByBan(monster, gameState, watcherSide)) {
      if (p.trigger === 'on_opponent_draw_predict') {
        return { watcherSide, hitCount: p.onHit.count };
      }
    }
  }
  return null;
}

// 【今回追加・花】side側の、表向きで泊に無効化されていない花(mana_kanji_wildcard)の対象漢字
// (屮)を返す。いなければnull。色の新規指定・装備時の自動指定・選択候補の拡張に使う。
export function getWildcardKanji(
  gameState: GameState,
  side: PlayerSide,
): string | null {
  for (const monster of getPlayerState(gameState, side).monsters) {
    for (const p of getPassiveListGatedByBan(monster, gameState, side)) {
      if (p.trigger === 'mana_kanji_wildcard') return p.targetKanji;
    }
  }
  return null;
}

// 【今回追加・仁/花】墓地のマナ(card)を、side側のいずれかのモンスターにつけられるか。
// 公式QA: 仁・花は「つけられるマナが墓地にないときは山札から引く」。判定は、取り除かれて
// いないモンスターに、そのマナの漢字と同じ空きスロットがあること。表向きの花
// (mana_kanji_wildcard)がいるときは、その対象漢字のマナはどの空きスロットにもつけられる
// (万能マナ。花の色指定機構そのものは未実装だが、置き換え判定が不当に外れないよう考慮する)。
function isManaAttachableToOwnMonster(
  gameState: GameState,
  side: PlayerSide,
  card: ManaCard,
): boolean {
  const monsters = getPlayerState(gameState, side).monsters;
  const isWildcard = monsters.some((m) =>
    getPassiveListGatedByBan(m, gameState, side).some(
      (p) =>
        p.trigger === 'mana_kanji_wildcard' && p.targetKanji === card.kanji,
    ),
  );
  return monsters.some((m) => {
    if (m.isRemovedFromGame) return false;
    const open = getOpenSlotKanji(m);
    return isWildcard
      ? open.length > 0
      : open.includes(getEffectiveKanji(card));
  });
}

// 【今回改訂・仁/花のdraw_replace】ドローボタン起点の割り込み判定(App.tsx handleAutoDraw)から
// 呼ばれる。従来のfindDrawReplacePassiveを置き換えた。公式QAに基づく変更点:
//   - 相手の泊で無効化中(getPassiveListGatedByBan)なら置き換えない(通常どおり山札から引く)
//   - つけられるマナが墓地に無ければ置き換えない(山札から引く。意図的に避けることはできない)
//   - 仁の候補は「つけられるマナ」に限定する
//   - 仁と花が両方表向きなら、どちらか一方を選ぶだけで2枚にはならない。仁の自由選択は
//     花(屮固定)を包含するため、仁を優先する
export type DrawReplacePlan =
  | { kind: 'none' }
  | { kind: 'auto'; cardId: string } // 花: 選択UI不要で自動採用
  | { kind: 'choose'; candidateIds: string[] }; // 仁: 候補から1枚を選ばせる

export function resolveDrawReplace(
  gameState: GameState,
  side: PlayerSide,
): DrawReplacePlan {
  const playerState = getPlayerState(gameState, side);
  const passives = playerState.monsters
    .flatMap((m) => getPassiveListGatedByBan(m, gameState, side))
    .filter(
      (p): p is Extract<PassiveEffect, { trigger: 'draw_replace' }> =>
        p.trigger === 'draw_replace',
    );
  if (passives.length === 0) return { kind: 'none' };

  const attachable = playerState.cemetery.filter((c) =>
    isManaAttachableToOwnMonster(gameState, side, c),
  );

  if (passives.some((p) => !p.sourceKanji)) {
    return attachable.length > 0
      ? { kind: 'choose', candidateIds: attachable.map((c) => c.id) }
      : { kind: 'none' };
  }

  const fixedKanji = passives[0].sourceKanji;
  const card = attachable.find((c) => c.kanji === fixedKanji);
  return card ? { kind: 'auto', cardId: card.id } : { kind: 'none' };
}

// 【追加・激】own_turn_end_predict_winを持つ、表向きのモンスターのindexを探す。
// 「ターンを終了」ボタン押下時の割り込み判定(App.tsx handleNextPhase)から呼ばれる。
// 見つからなければ-1(通常のflip_monster_facedown等と同じ「見つからない」規約に合わせる)。
export function findOwnTurnEndPredictWinMonsterIndex(
  monsters: MonsterCard[],
): number {
  return monsters.findIndex(
    (monster) =>
      !monster.isFlipped &&
      getPassiveList(monster).some(
        (p) => p.trigger === 'own_turn_end_predict_win',
      ),
  );
}

// 【今回追加・音】janken_auto_win(音): 「じゃんけんが必要になったとき、勝ったことになる」。
// 効果由来のじゃんけん(言・信・競・招・右・哲・詩)を解決する際、発動者(ownerSide)側・相手側の
// 表向きの音(泊で無効化中のものは除く)を確認し、じゃんけん自体を省略して結果を確定できるか返す。
//   - 発動者側のみ音あり → 'win'
//   - 相手側のみ音あり   → 'lose'(相手が勝ったことになる。両者の音が同じ扱いで効くことは
//                          公式QA「音と音が両方表向きなら効果をかき消す」から裏付けられる)
//   - 両者とも音あり     → null(音の効果をかき消し、通常のじゃんけん。公式QA 2026年6月時点)
//   - どちらも無し       → null(通常のじゃんけん)
// 先攻後攻決定じゃんけん(全モンスターが裏向きで開始)と手動のじゃんけんツールは対象外。
export function getJankenAutoOutcome(
  gameState: GameState,
  ownerSide: PlayerSide,
): 'win' | 'lose' | null {
  const hasAutoWin = (side: PlayerSide): boolean =>
    getPlayerState(gameState, side).monsters.some((monster) =>
      getPassiveListGatedByBan(monster, gameState, side).some(
        (p) => p.trigger === 'janken_auto_win',
      ),
    );
  const own = hasAutoWin(ownerSide);
  const opp = hasAutoWin(getOpponentSide(ownerSide));
  if (own && !opp) return 'win';
  if (!own && opp) return 'lose';
  return null;
}

// じゃんけんの決着結果(win/tie/lose)から、dispatchすべきActionを組み立てる。
// JankenModalの結果を受けるbuildActionsFromSelectionと、音による自動決着
// (resolveMonsterEffect)の両方から使う共通処理。
export function buildJankenOutcomeActions(
  effect: Extract<MonsterEffect, { effectId: 'janken_conditional_reduce' }>,
  ownerSide: PlayerSide,
  gameState: GameState,
  outcome: 'win' | 'tie' | 'lose',
): GameAction[] {
  let targetSide: PlayerSide;
  let count: number;
  if (outcome === 'win') {
    targetSide = getOpponentSide(ownerSide);
    count = effect.winCount ?? 0;
  } else if (outcome === 'tie') {
    targetSide = getOpponentSide(ownerSide);
    count = effect.tieCount ?? 0;
  } else {
    targetSide = ownerSide;
    count = effect.loseCount ?? 0;
  }
  if (count <= 0) return [];
  const cardIds = takeTopDeckIds(gameState, targetSide, count);
  if (cardIds.length === 0) return [];
  return [
    {
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: {
        sourceSide: targetSide,
        targetSide,
        cardIds,
        sourceZone: 'deck',
        targetZone: 'cemetery',
      },
    },
  ];
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
  // 【今回追加・美】targetSide:'choose'のphase1(zone_target_select、2択)で選ばれた対象side。
  // phase2(deck_reorder本体)ではこちらをsideとして使う。
  reorderTargetSide?: PlayerSide;
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

  // 【今回追加・泊】相手の泊で無効化中の場合、「発動はするが効果は無効」
  // (ユーザー確認済みQA)。選択が不要な効果(resolveMonsterEffectの対象)は、
  // 発動ボタンは押せる(getActivatableEffectは変更しない)が、実際のGameActionは
  // 空にする。nullではなく空配列[]を返す点に注意(nullは選択UIへの誘導を意味する
  // 既存の意味論のため、無効化時にnullを返すと誤って選択誘導フローに乗ってしまう)。
  if (isMonsterEffectsDisabledByOpponentBan(gameState, ownerSide)) {
    // 【今回追加・育】公式QA: 泊で無効にされても育の発動回数はカウントされる(発動はしている、
    // ダメージはない)。カウンタのインクリメントだけは行う。
    if (
      effect.effectId === 'deck_reduce_scaling_by_activation_count' &&
      ctx.sourceMonsterIndex !== undefined
    ) {
      return [
        {
          type: 'INCREMENT_ACTIVATION_COUNT',
          payload: { side: ownerSide, monsterIndex: ctx.sourceMonsterIndex },
        },
      ];
    }
    return [];
  }

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

    case 'deck_reduce_scaling_by_activation_count': {
      // 育: このモンスター自身の発動回数(試合内で累積)によって相手の山札の減少量が変わる。
      // 選択不要のため完全自動解決。sourceMonsterIndexが無ければ判定できないためnull。
      if (ctx.sourceMonsterIndex === undefined) return null;
      const monster = getPlayerState(gameState, ownerSide).monsters[
        ctx.sourceMonsterIndex
      ];
      if (!monster) return null;

      const newCount = (monster.activationCount ?? 0) + 1;
      const tier =
        effect.tiers.find((t) => newCount <= t.maxCount) ??
        effect.tiers[effect.tiers.length - 1];
      if (!tier) return null;

      const cardIds = takeTopDeckIds(gameState, opponentSide, tier.reduceCount);
      const actions: GameAction[] = [];
      if (cardIds.length > 0) {
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: opponentSide,
            targetSide: opponentSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        });
      }
      actions.push({
        type: 'INCREMENT_ACTIVATION_COUNT',
        payload: { side: ownerSide, monsterIndex: ctx.sourceMonsterIndex },
      });
      return actions;
    }

    case 'reveal_both_top_until_shuffle': {
      // 明: 自分・相手両方の山札トップをシャッフルまで公開し続ける。選択不要のため完全自動解決。
      // 既にどちらか/両方が公開済みでも、再発動は無害(reducer側は単純にtrueを立て直すだけ)。
      return [
        {
          type: 'SET_DECK_TOP_REVEALED',
          payload: { side: ownerSide, revealed: true },
        },
        {
          type: 'SET_DECK_TOP_REVEALED',
          payload: { side: opponentSide, revealed: true },
        },
      ];
    }

    case 'deck_reduce_grant_extra_turn': {
      // 電: 相手の山札を固定数減らし、もう一度自分のターンを行う。選択不要のため完全自動解決。
      // 2つ目のActionでpendingExtraTurnを立て、NEXT_PHASE側でターン交代をスキップする。
      const cardIds = takeTopDeckIds(gameState, opponentSide, effect.count);
      const actions: GameAction[] = [];
      if (cardIds.length > 0) {
        actions.push({
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: opponentSide,
            targetSide: opponentSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        });
      }
      actions.push({ type: 'GRANT_EXTRA_TURN' });
      return actions;
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
        (card) => targetKanjiList.includes(getEffectiveKanji(card)),
        effect.onMatch,
        effect.onMiss,
      );
    }

    // 【追加】戒: 相手の山札を1枚ずつ墓地へ送り、既出の種類数がmaxDistinctKanjiに達するか、
    // 累計枚数がmaxCountに達したら止める。山札の並び順は既知のため、プレイヤーの選択なしに
    // 何枚・どのカードが対象になるか一意に確定できる。
    case 'deck_iterative_reveal_until_condition': {
      const targetSide = resolveSide(effect.targetSide, ownerSide);
      // 【今回追加・戒×浮】公式QA: 1枚ずつ送るたびに浮が発動して1枚も送れない(=1回あたりの
      // 枚数が0以下になる)と、いつまでも終わらないため効果を終了する(何も送らない)。
      const perStep =
        1 +
        (targetSide !== ownerSide ? sumBoostAmount(gameState, ownerSide) : 0) -
        sumMitigateAmount(gameState, targetSide);
      if (perStep <= 0) return [];
      const deck = getPlayerState(gameState, targetSide).deck;
      const seenKanji = new Set<string>();
      const movedIds: string[] = [];

      for (const card of deck) {
        movedIds.push(card.id);
        seenKanji.add(getEffectiveKanji(card));

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

    // 【今回追加・音】表向きの音でじゃんけんの結果が確定する場合のみ、ここで自動解決する
    // (JankenModalを開かない)。音が関与しない通常のケースはnullを返し、従来どおり
    // effectSelection.tsのjanken_select(JankenModal)へ誘導される。
    case 'janken_conditional_reduce': {
      const auto = getJankenAutoOutcome(gameState, ownerSide);
      if (auto === null) return null;
      return buildJankenOutcomeActions(effect, ownerSide, gameState, auto);
    }

    case 'graveyard_select_recover': {
      // count:'all'の場合のみ選択不要(養で確認)。数値指定は選択が必要なためnull(effectSelection.ts側で対応)
      if (effect.count !== 'all') return null;
      const cemetery = getPlayerState(gameState, ownerSide).cemetery;
      const matches = effect.targetKanji
        ? cemetery.filter((c) => getEffectiveKanji(c) === effect.targetKanji)
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

    // 【今回追加・走】山札から2枚(count)めくってプレイする。めくり自体はAUTO_DRAWを直接
    // 発行する(ターン開始のドローではないため、仁・花の置き換えの対象外。公式QA)。
    // 山札が足りず引ききれなかった分は残りドロー回数(kind:'effect')として保持し、山札が
    // 回復したあとにドローボタンで引き直せる(FAQ「1枚目のプレイで山札が回復すれば2枚目も
    // プレイ可能」)。忍のトラップはAUTO_DRAW内で処理されるため、FAQの順
    // (めくる → 忍 → めくる)が自然に再現される。
    case 'draw_and_play_n': {
      const available = getPlayerState(gameState, ownerSide).deck.length;
      const drawCount = Math.min(effect.count, available);
      if (drawCount === 0) return [];
      const shortage = effect.count - drawCount;
      const draws = Array.from(
        { length: drawCount },
        (_, i): GameAction => ({
          type: 'AUTO_DRAW',
          payload: {
            player: ownerSide,
            ...(i === drawCount - 1 && shortage > 0
              ? {
                  remainingDrawsAfter: {
                    count: shortage,
                    kind: 'effect' as const,
                  },
                }
              : {}),
          },
        }),
      );
      // 【今回追加・星】走のめくりも「山札をひく」として星の反応を判定する(忍のトラップと
      // 同じ扱い)。山札減少はdispatchWithPassivesが通すapplyDeckReducePassivesで軽減・ブロック
      // 等が適用される。流は予想の入力が必要なため走のめくりには適用しない(既知の限界)。
      const drawnKanji = simulateDeckDraws(
        getPlayerState(gameState, ownerSide).deck,
        drawCount,
      ).map((c) => getEffectiveKanji(c));
      return [
        ...draws,
        ...getStarReactionActions(gameState, ownerSide, drawnKanji),
      ];
    }

    case 'swap_deck_and_graveyard': {
      // 【今回実装】自分の山札全体と墓地全体を、それぞれの現在の順序を保ったまま
      // 丸ごと入れ替える(逆)。新規Action SWAP_ZONESで実装(型定義・reducer側の反転処理は
      // useGameState.tsのSWAP_ZONESケースを参照)。
      // FAQ確定事項:「逆による増減は効果による墓地送りとして扱わない」ため、本来は
      // 永続パッシブ割り込みパイプラインを経由してはならない。ただしSWAP_ZONESは
      // extractDeckReduceIntent/applyManaTrashPassivesのどちらの対象Action型
      // (DAMAGE/MOVE_CARD_BETWEEN_ZONES/TRASH_MANA)にも該当しないため、
      // 両パイプラインとも自動的に素通りする(実質的に対応済み、追加のガード不要)。
      return [{ type: 'SWAP_ZONES', payload: { side: ownerSide } }];
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

    // 【追加・本】自分の山札が0枚なら勝ち、それ以外は自分の山札をotherwise.count枚へらす。
    // 選択不要のため完全自動解決の対象。要:勝敗接続だったが、SET_GAME_STATUSの新設により対応。
    case 'deck_count_win_or_reduce': {
      const selfDeck = getPlayerState(gameState, ownerSide).deck;
      if (selfDeck.length === effect.winCondition.count) {
        return [
          {
            type: 'SET_GAME_STATUS',
            payload: {
              status: ownerSide === 'player' ? 'player_win' : 'opponent_win',
              logMessage: `${sideLabel(ownerSide)}の本の勝利条件が成立しました。`,
            },
          },
        ];
      }
      const cardIds = takeTopDeckIds(
        gameState,
        ownerSide,
        effect.otherwise.count,
      );
      if (cardIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: ownerSide,
            targetSide: ownerSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        },
      ];
    }

    // 【追加・敗】両者の山札差がthreshold以上なら少ない方が負け、それ未満(threshold-1以下)は
    // 両者をotherwiseCount枚ずつへらす。原文「10まいより大きい／9まいより小さい」は、
    // このカード群の言い回しの傾向として「10以上／9以下」の意で書かれている(ユーザー確認済み)。
    // 10と9で隙間なく綺麗に分割されるため、単一のthresholdフィールドに対する
    // diff >= threshold(決着) / diff < threshold(両者減少) の二分岐として実装する。
    case 'deck_diff_threshold_win_or_reduce': {
      const opponentSide = getOpponentSide(ownerSide);
      const selfDeck = getPlayerState(gameState, ownerSide).deck;
      const oppDeck = getPlayerState(gameState, opponentSide).deck;
      const diff = Math.abs(selfDeck.length - oppDeck.length);

      if (diff >= effect.threshold) {
        const loserSide =
          selfDeck.length < oppDeck.length ? ownerSide : opponentSide;
        const winnerSide = getOpponentSide(loserSide);
        return [
          {
            type: 'SET_GAME_STATUS',
            payload: {
              status: winnerSide === 'player' ? 'player_win' : 'opponent_win',
              logMessage: `${sideLabel(loserSide)}の山札が少なく、敗の勝利条件が成立しました。`,
            },
          },
        ];
      }

      const actions: GameAction[] = [];
      for (const side of [ownerSide, opponentSide]) {
        const cardIds = takeTopDeckIds(gameState, side, effect.otherwiseCount);
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

    // 【追加・墓】両者の墓地合計がthresholdより多ければ発動者の勝ち、それ以外は何も起きない。
    // 現状データ(m00095)はscope:'combined'のみのため、それ以外のscopeは将来拡張用として未対応のまま残す。
    case 'graveyard_total_count_threshold_win': {
      if (effect.scope !== 'combined') return null;
      const opponentSide = getOpponentSide(ownerSide);
      const combined =
        getPlayerState(gameState, ownerSide).cemetery.length +
        getPlayerState(gameState, opponentSide).cemetery.length;
      if (combined > effect.threshold) {
        return [
          {
            type: 'SET_GAME_STATUS',
            payload: {
              status: ownerSide === 'player' ? 'player_win' : 'opponent_win',
              logMessage: `${sideLabel(ownerSide)}の墓の勝利条件が成立しました（墓地合計${combined}枚）。`,
            },
          },
        ];
      }
      return [];
    }

    // 【追加・深】自分の山札枚数に応じた段階(tiers)を判定する。最下段(0〜1枚)は勝利、
    // それ以外の段は相手の山札を固定数へらす。選択不要のため完全自動解決の対象。
    case 'deck_count_tiered_effect': {
      const selfCount = getPlayerState(gameState, ownerSide).deck.length;
      const tier = effect.tiers.find(
        (t) => selfCount >= t.min && selfCount <= t.max,
      );
      if (!tier) return [];
      if (tier.win) {
        return [
          {
            type: 'SET_GAME_STATUS',
            payload: {
              status: ownerSide === 'player' ? 'player_win' : 'opponent_win',
              logMessage: `${sideLabel(ownerSide)}の深の勝利条件が成立しました。`,
            },
          },
        ];
      }
      if (!tier.effect) return [];
      const targetSide = resolveSide(tier.effect.targetSide, ownerSide);
      const cardIds = takeTopDeckIds(gameState, targetSide, tier.effect.count);
      if (cardIds.length === 0) return [];
      return [
        {
          type: 'MOVE_CARD_BETWEEN_ZONES',
          payload: {
            sourceSide: targetSide,
            targetSide,
            cardIds,
            sourceZone: 'deck',
            targetZone: 'cemetery',
          },
        },
      ];
    }

    // 以下、選択・外部システム（勝敗判定）接続・複雑な副作用のいずれかが必要なため未対応（null）。
    // 対応が必要になった時点で、既存UI（DeckModal/JankenModal/MoveDestinationSelector）との
    // 連携方式を別途設計すること（design_document.md 7.8章参照）。
    case 'deck_predict_reveal_reduce': // 同上（KanjiTypePickerModal流用でeffectSelection.ts側にて対応済み）
    case 'deck_compare_branch': // 同上（少ない方の判定＋graveyard_select_recover委譲でeffectSelection.ts側にて対応済み）
    case 'graveyard_select_equip':
    case 'deck_select_equip':
    case 'deck_kanji_purge':
    case 'deck_iterative_select_trash':
    case 'deck_full_reorder':
    case 'choose_number_reduce_both':
    case 'choose_number_reduce':
    case 'choice_of_effects':
    case 'deck_or_graveyard_count_win_condition': // 原文の解釈(発動時選択か該当時発動か)が未確定のため保留(design書6章12番)
    case 'deck_select_trash':
    case 'deck_partial_reorder':
    case 'deck_partial_to_reserve':
    case 'deck_kanji_search_equip':
    case 'mixed_zone_select_trash':
    case 'graveyard_recover_then_deck_trash_matching_count':
    case 'monster_remove_from_game':
    case 'deck_predict_full_composition_win': // 相手山札の構成を丸ごと予想する新規UIが未設計のため保留
    case 'select_zone_move_one':
    case 'flip_monster_facedown':
    case 'swap_equipped_with_graveyard':
    case 'graveyard_auto_equip_by_target_slots':
    case 'graveyard_partial_to_reserve': // 選択要のためeffectSelection.ts側で対応
    case 'copy_opponent_monster_effect': // 選択要(monster_select)のためeffectSelection.ts側で対応
    case 'deck_seed_mana_win_condition': // 選択要(graveyard_select)のためeffectSelection.ts側で対応
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
