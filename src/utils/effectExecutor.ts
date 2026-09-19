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

// 【追加・本/敗/墓/深】ログメッセージ用の簡易ラベル。useGameState.tsのgetSideLabelと同じ
// 対応関係だが、utils層からhooks層への逆依存を避けるためこのファイル内で完結させる。
function sideLabel(side: PlayerSide): string {
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
function getPassiveListGatedByBan(
  monster: MonsterCard,
  gameState: GameState,
  side: PlayerSide,
): PassiveEffect[] {
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
}

// redirect_own_deck_reduce: 「自分の効果で自分の山札が減る」場合のみ対象(呼び出し側でtargetSide===actingSideを確認済み)。
// fixedCount指定は常に適用。minCount/maxCount指定は元のamountがその範囲内の場合のみ適用し、
// 適用時はamountをそのまま(同数)相手へ転嫁する(敵のケース)。未消費のものを先頭から1件だけ採用する。
function findApplicableRedirect(
  gameState: GameState,
  actingSide: PlayerSide,
  amount: number,
): RedirectMatch | null {
  const monsters = getPlayerState(gameState, actingSide).monsters;
  for (let monsterIndex = 0; monsterIndex < monsters.length; monsterIndex++) {
    const monster = monsters[monsterIndex];
    const passives = getPassiveListGatedByBan(monster, gameState, actingSide);
    for (let passiveIndex = 0; passiveIndex < passives.length; passiveIndex++) {
      const passive = passives[passiveIndex];
      if (passive.trigger !== 'redirect_own_deck_reduce') continue;
      if (isPassiveConsumed(monster, passiveIndex)) continue;
      const { minCount, maxCount, fixedCount } = passive.scope;
      const inRange =
        fixedCount !== undefined ||
        ((minCount === undefined || amount >= minCount) &&
          (maxCount === undefined || amount <= maxCount));
      if (!inRange) continue;
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
    };
  }
  return null;
}

// 書き換え後のDeckReduceIntentから、MOVE_CARD_BETWEEN_ZONES Actionを再構築する。
// amountが0以下、または対象の山札が既に0枚ならAction自体を発生させない(null)。
function buildDeckReduceAction(
  gameState: GameState,
  intent: DeckReduceIntent,
): GameAction | null {
  if (intent.amount <= 0) return null;
  const cardIds = takeTopDeckIds(gameState, intent.targetSide, intent.amount);
  if (cardIds.length === 0) return null;
  return {
    type: 'MOVE_CARD_BETWEEN_ZONES',
    payload: {
      sourceSide: intent.targetSide,
      targetSide: intent.targetSide,
      cardIds,
      sourceZone: 'deck',
      targetZone: intent.destination,
    },
  };
}

// 効果解決で組み立てられたActions配列を、dispatch直前にこの関数へ通すことで
// mitigate/boost/block/redirectの4トリガーを適用する。山札減少を表さないActionはそのまま通す。
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
    let amount = intent.amount + sumBoostAmount(gameState, actingSide);

    if (targetSide === actingSide) {
      const redirect = findApplicableRedirect(gameState, actingSide, amount);
      if (redirect) {
        amount = redirect.fixedCount ?? amount;
        targetSide = getOpponentSide(actingSide);
        if (redirect.consumeAfterUse) {
          consumptions.push({
            type: 'CONSUME_PASSIVE_EFFECT',
            payload: {
              side: actingSide,
              monsterIndex: redirect.monsterIndex,
              passiveIndex: redirect.passiveIndex,
            },
          });
          // 【追加】扱・返・圧の原文「このカードをうらむきにもどす」対応。
          // これらは表向き固定(isFlipped:false)の永続カードのため、1回消費時に
          // FLIP_MONSTER(トグル)を1回発火させれば裏面(isFlipped:true)に切り替わる。
          consumptions.push({
            type: 'FLIP_MONSTER',
            payload: { side: actingSide, monsterIndex: redirect.monsterIndex },
          });
        }
      }
    }

    amount = Math.max(0, amount - sumMitigateAmount(gameState, targetSide));

    if (amount > 0) {
      const block = findApplicableBlock(gameState, targetSide);
      if (block) {
        amount = 0;
        consumptions.push({
          type: 'CONSUME_PASSIVE_EFFECT',
          payload: {
            side: targetSide,
            monsterIndex: block.monsterIndex,
            passiveIndex: block.passiveIndex,
          },
        });
        // 【追加】抑の原文「このカードを、うらむきにもどす」対応。redirectと同じくFLIP_MONSTER
        // (トグル)を1回発火させる。
        consumptions.push({
          type: 'FLIP_MONSTER',
          payload: { side: targetSide, monsterIndex: block.monsterIndex },
        });
      }
    }

    // 【追加・注】ここまでの結果、相手側の山札が実際に減る状態が残っている場合のみ判定する。
    // 浮のmitigateや抑のblockで既に0になっていれば、この時点でamount<=0のため発動しない
    // (FAQ「浮を先に発動させた場合、注は発動できない」を自然に再現)。
    if (amount > 0 && targetSide === getOpponentSide(actingSide)) {
      const replace = findApplicableReplace(gameState, actingSide);
      if (replace) {
        // 【今回改訂】注のselfCost(自分-1)は、自分側が浮等のmitigateを持っていても
        // 軽減対象にしない(原文に記載が無いため固定値のまま、design書6章の既存方針を踏襲)。
        const selfAction = buildDeckReduceAction(gameState, {
          targetSide: actingSide,
          amount: replace.selfCost,
          destination: intent.destination,
        });
        if (selfAction) result.push(selfAction);

        // 【今回改訂・重大】注の発動によって生じる相手側への減少(opponentCount)も、
        // 「山札を減らす効果」の一種として扱い、改めて相手側のmitigate/blockを適用する
        // (ユーザー確認済み)。直前(430行目以前)のsumMitigateAmount/findApplicableBlockは
        // 「注が発動する前の、置換前の山札減少」に対する判定であり、注が生み出す
        // 「新しい山札減少(opponentCount)」にはまだ一切適用されていないため、
        // ここで改めて適用しても二重軽減・二重消費にはならない。
        amount = Math.max(
          0,
          replace.opponentCount - sumMitigateAmount(gameState, targetSide),
        );
        if (amount > 0) {
          const block = findApplicableBlock(gameState, targetSide);
          if (block) {
            amount = 0;
            consumptions.push({
              type: 'CONSUME_PASSIVE_EFFECT',
              payload: {
                side: targetSide,
                monsterIndex: block.monsterIndex,
                passiveIndex: block.passiveIndex,
              },
            });
            consumptions.push({
              type: 'FLIP_MONSTER',
              payload: {
                side: targetSide,
                monsterIndex: block.monsterIndex,
              },
            });
          }
        }
      }
    }

    const rebuilt = buildDeckReduceAction(gameState, {
      targetSide,
      amount,
      destination: intent.destination,
    });
    if (rebuilt) result.push(rebuilt);
  }

  return [...result, ...consumptions];
}

// 【追加・永続パッシブ割り込みパイプライン(グループ2: TRASH_MANA対応)】
//
// 対象: shield_counter_deck_protection(囲)・negate_own_mana_trash_by_opponent(吸)。
// applyDeckReducePassivesとは別関数とする(対象Actionの種類が異なるため)。
// 山札減少(DAMAGE/MOVE_CARD_BETWEEN_ZONES)ではなくTRASH_MANA(装備マナの破棄)のみを対象とする。
//
// 適用対象: 「相手の効果による」TRASH_MANAのみ(actingSide !== 対象マナの所有側の場合)。
// 手動操作(全マナ破棄ボタン等)・認/獄の随伴処理(REMOVE_MONSTER_FROM_GAMEに伴うTRASH_MANA)は
// 呼び出し側(useEffectExecutor.ts)で「効果解決経由のdispatchのみ」に絞ることで対象外とする。
//
// 適用順序: ①囲(shield_counter_deck_protection、reservedCards 1枚消費で全量ブロック)
// → ②吸(negate_own_mana_trash_by_opponent、無条件で全量無効化)
// → ③拾(own_mana_trashed_by_opponent_reaction)の発動条件検知(ブロックも無効化もされなかった場合のみ)。
// 抑の優先順位(抑＞囲、7.3章5番の暫定案)は山札減少専用のためこのパイプラインには影響しない。
//
// 【設計注記】戻り値をGameAction[]ではなく{actions, pickupTrigger?}に拡張している。
// 純粋関数であるこの層から、状態を持つuseEffectExecutor.ts側へ「拾の発動条件が成立したこと」を
// 伝える必要があるため(applyDeckReducePassivesのような単純な書き換えだけでは完結しない)。

interface ShieldMatch {
  monsterIndex: number;
  bufferCardId: string; // 消費するreservedCardsの1枚
}

// shield_counter_deck_protection: 対象側(targetSide、TRASH_MANAでマナを失う側)の
// reservedCardsが1枚以上残っている未消費のものを先頭から1件採用する。
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

    const shield = findApplicableShield(gameState, targetSide);
    if (shield) {
      // reservedCardsから1枚消費して全量ブロックする。バッファが尽きたら裏向きに戻す。
      const monster = getPlayerState(gameState, targetSide).monsters[
        shield.monsterIndex
      ];
      const remainingBuffer = (monster.reservedCards ?? []).filter(
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
      continue; // このTRASH_MANA自体は発生させない(ブロック)
    }

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

  if (isOwnStartPhase) {
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
  // (発動時にFLIP_MONSTERを伴わせる設計、effectSelection.ts参照)。
  // isFlipped:true(裏向き=発動済み)の間は、effectを発動対象から除外する。
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
    monster.isFlipped
  ) {
    return null;
  }
  return monster.effect ?? null;
}

// 【追加・仁/花】draw_replaceを持つ、表向きのモンスターを1体探し、そのpassiveEffectを返す。
// ドローボタン起点の割り込み判定(App.tsx handleAutoDraw)から呼ばれる。
export function findDrawReplacePassive(monsters: MonsterCard[]): {
  monsterIndex: number;
  passive: Extract<PassiveEffect, { trigger: 'draw_replace' }>;
} | null {
  for (let monsterIndex = 0; monsterIndex < monsters.length; monsterIndex++) {
    const monster = monsters[monsterIndex];
    if (monster.isFlipped) continue; // 表向き固定の永続効果のため、裏向きなら対象外
    const passive = getPassiveList(monster).find(
      (p): p is Extract<PassiveEffect, { trigger: 'draw_replace' }> =>
        p.trigger === 'draw_replace',
    );
    if (passive) return { monsterIndex, passive };
  }
  return null;
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
    case 'deck_or_graveyard_count_win_condition': // 原文の解釈(発動時選択か該当時発動か)が未確定のため保留(design書6章12番)
    case 'deck_select_trash':
    case 'deck_partial_reorder':
    case 'deck_partial_to_reserve':
    case 'deck_kanji_search_equip':
    case 'mixed_zone_select_trash':
    case 'graveyard_recover_then_deck_trash_matching_count':
    case 'monster_remove_from_game':
    case 'draw_and_play_n':
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
