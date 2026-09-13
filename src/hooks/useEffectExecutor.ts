// src/hooks/useEffectExecutor.ts
//
// フェーズ5: 効果発動の入口となるフック。
// 1. resolveMonsterEffect（即時実行可能な効果）を試す
// 2. だめならdescribeSelectionRequirement（選択誘導が必要な効果）を試す
// 3. どちらも該当しなければfalseを返す（まだ対応するUIがない効果）
//
// choice_of_effects対応: 選択肢が選ばれた後、その選択肢のeffectを
// 改めて上記1→2の手順で解決する必要があるため、共通処理をtryExecuteへ切り出した。
// executeMonsterEffect（発動ボタンからの入口）とconfirmSelection（選択肢確定後の再帰呼び出し）
// の両方がtryExecuteを経由する。
//
// 【追加・sequenceチェーン実行】sequenceのステップを1つずつ試し、選択が必要なステップに
// ぶつかったところでpendingSelectionをセットして停止、確定後に残りのステップへ進む。
// 各ステップの確定は即dispatchする(案A)。既存のpendingSelection.requirement.kind単位の
// UIルーティング(App.tsx/PlayerZone.tsx)は無改修で、ステップが切り替わるたびに
// pendingSelectionのrequirementが自動的に差し替わり、対応するモーダルへ遷移する。
//
// 【追加・永続パッシブ割り込みパイプライン グループ1+2の統一配線】dispatch直前の全箇所で
// dispatchWithPassivesヘルパーを経由する。①山札減少パイプライン(applyDeckReducePassives)
// →②TRASH_MANAパイプライン(applyManaTrashPassives)の順に通す。②がpickupTrigger(拾の発動条件
// 成立)を検知した場合、通常のActionをdispatchした後に拾のphase1(装備先モンスター選択)を
// pendingSelectionとしてセットする。sequence実行中に拾が割り込んだ場合は、残りステップを
// pickupResumeContextへ保存し、拾の確定後にtrySequenceFromで自動復帰する。

import { useState } from 'react';
import {
  resolveMonsterEffect,
  getOpponentSide,
  getPlayerState,
  applyDeckReducePassives,
  applyManaTrashPassives,
} from '../utils/effectExecutor';
import {
  describeSelectionRequirement,
  buildActionsFromSelection,
  type SelectionRequirement,
  type EffectSelectionAnswer,
} from '../utils/effectSelection';
import type {
  GameState,
  GameAction,
  MonsterEffect,
  PlayerSide,
} from '../types';

export interface PendingSelection {
  requirement: SelectionRequirement;
  effect: MonsterEffect; // 現在処理中の単体効果(sequence実行中は「現在のステップ」を指す)
  ownerSide: PlayerSide;
  sourceMonsterIndex?: number;
  // 【追加】sequence実行中の進行状態。sequence以外の単発効果ではundefined。
  sequenceContext?: {
    remainingSteps: MonsterEffect[]; // 現在のステップより後、まだ手をつけていない残り
    justTrashedCardIds?: string[]; // 直前ステップが実際に墓地送りにしたカードID
  };
  // 【追加・出の同数ケース専用】
  forcedSide?: PlayerSide; // このpendingSelectionの確定処理で使うforcedSide(2巡目のみ)
  deckCompareBranchPending?: PlayerSide; // 確定後、この側を対象に2巡目を続けて開始する(1巡目・同数時のみ)
  // 【追加・生方のexcludeSelf対応】phase2(graveyard_select)確定時にbuildActionsFromSelectionへ
  // 渡す装備先モンスターのindex。phase1(monster_select)確定時にセットされる。
  equipTargetMonsterIndex?: number;
  // 【追加・拾】このpendingSelectionが拾の割り込み反応であることを示すフラグ。
  // trueの場合、effectフィールドはダミー値(実際には参照されない)で、
  // confirmSelection側で専用分岐として処理する。
  isPickupReaction?: boolean;
  // 【追加・拾】phase1(装備先モンスター選択)確定後にphase2(pickup_select)へ渡す候補カード一覧。
  pickupCandidateCards?: { id: string; kanji: string; reading: string }[];
  // 【追加・拾】sequence実行中に拾が割り込んだ場合の復帰情報。
  pickupResumeContext?: {
    remainingSteps: MonsterEffect[];
    justTrashedCardIds?: string[];
    originalOwnerSide: PlayerSide;
    originalSourceMonsterIndex?: number;
  };
}

// dispatch済みのGameAction群から、「墓地へ送られたカードID」を抽出する。
// sourceRestriction:'just_trashed_by_this_effect'(方)向けの下ごしらえ(今回は未配線)。
function extractTrashedCardIds(actions: GameAction[]): string[] {
  const ids: string[] = [];
  for (const action of actions) {
    if (
      action.type === 'MOVE_CARD_BETWEEN_ZONES' &&
      action.payload.targetZone === 'cemetery'
    ) {
      ids.push(...action.payload.cardIds);
    }
    if (
      action.type === 'TRASH_MANA' &&
      action.payload.destination === 'cemetery' &&
      action.payload.manaCardIds !== 'all'
    ) {
      ids.push(...action.payload.manaCardIds);
    }
  }
  return ids;
}

export const useEffectExecutor = (
  gameState: GameState,
  dispatch: (action: GameAction) => void,
) => {
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);

  const canAutoExecute = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
  ): boolean => {
    return resolveMonsterEffect(effect, { ownerSide, gameState }) !== null;
  };

  // 発動ボタンの活性/非活性判定用。選択待ち中は常にfalse(多重発動ガード)。
  const isEffectSupported = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
    sourceMonsterIndex?: number,
  ): boolean => {
    if (pendingSelection) return false;
    return isSubEffectSupported(effect, ownerSide, sourceMonsterIndex);
  };

  // pendingSelectionガードを含まない判定。choice_of_effectsの各選択肢が
  // 対応済みかどうかをUI側(App.tsx)で個別に判定する用途で使う。
  //
  // 【追加】sequenceの場合、全体をresolveMonsterEffect/describeSelectionRequirementに
  // 直接通すのではなく、各ステップが個別に(自動解決 or 選択誘導)対応済みかを検査する。
  // 「ステップ2以降がchoice_of_effects的な選択を必要とする」構造のため、sequence全体としては
  // resolveMonsterEffectが必ずnullを返す(ステップ2以降で選択要のため)一方、describeSelectionRequirement
  // 側もsequence自体には対応ケースが無い(各ステップの中身を知らないと判定できないため)。
  const isSubEffectSupported = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
    sourceMonsterIndex?: number,
  ): boolean => {
    const ctx = { ownerSide, gameState, sourceMonsterIndex };
    if (resolveMonsterEffect(effect, ctx) !== null) return true;

    if (effect.effectId === 'sequence') {
      return effect.steps.every(
        (step) =>
          resolveMonsterEffect(step, ctx) !== null ||
          describeSelectionRequirement(step, ctx) !== null,
      );
    }

    return describeSelectionRequirement(effect, ctx) !== null;
  };

  // 【追加・囲/拾統合ヘルパー】山札減少パイプライン→TRASH_MANAパイプラインの順に通し、
  // dispatchする。pickupTriggerが得られた場合、通常のdispatch後にpendingSelectionとして
  // phase1(装備先モンスター選択)をセットする(拾自身の選択フローを開始する)。
  // resumeContext: 拾の割り込み元がsequence実行中だった場合、その残りステップと発動元情報を
  // 保持しておき、拾のphase1→phase2確定後にtrySequenceFromで自動的に元のsequenceへ
  // 復帰できるようにする。
  // 戻り値: このヘルパーがpendingSelectionをセットしたかどうか(true = 呼び出し元は
  // 追加でsetPendingSelection(null)しないよう注意する)。
  const dispatchWithPassives = (
    actions: GameAction[],
    actingSide: PlayerSide,
    resumeContext?: {
      remainingSteps: MonsterEffect[];
      justTrashedCardIds?: string[];
      sourceMonsterIndex?: number;
    },
  ): boolean => {
    const deckReduced = applyDeckReducePassives(actions, actingSide, gameState);
    const { actions: finalActions, pickupTrigger } = applyManaTrashPassives(
      deckReduced,
      actingSide,
      gameState,
    );
    finalActions.forEach((action) => dispatch(action));

    if (pickupTrigger) {
      setPendingSelection({
        requirement: {
          kind: 'monster_select',
          side: pickupTrigger.side,
          constraint: { min: 1, max: 1 },
        },
        effect: { effectId: 'custom', handlerKey: 'pickup_reaction_phase1' }, // ダミー(参照されない)
        ownerSide: pickupTrigger.side,
        isPickupReaction: true,
        pickupCandidateCards: pickupTrigger.trashedCards.map((c) => ({
          id: c.id,
          kanji: c.kanji,
          reading: c.reading,
        })),
        pickupResumeContext: resumeContext
          ? {
              remainingSteps: resumeContext.remainingSteps,
              justTrashedCardIds: resumeContext.justTrashedCardIds,
              originalOwnerSide: actingSide,
              originalSourceMonsterIndex: resumeContext.sourceMonsterIndex,
            }
          : undefined,
      });
      return true;
    }
    return false;
  };

  // 【追加】sequenceのステップを先頭から順に試す。
  // - 自動解決できるステップは即dispatchして次のステップへ進む(再帰)
  // - 選択が必要なステップに当たったらpendingSelectionをセットして停止
  // - どちらも対応できないステップに当たったら、sequence全体を打ち切る(false)
  // - 【追加・拾】自動解決ステップのdispatch時に拾が割り込んだ場合、sequenceは一旦停止する
  //   (拾の確定後、pickupResumeContext経由でtrySequenceFromへ自動復帰する)。
  const trySequenceFrom = (
    steps: MonsterEffect[],
    ownerSide: PlayerSide,
    sourceMonsterIndex: number | undefined,
    justTrashedCardIds: string[] | undefined,
  ): boolean => {
    if (steps.length === 0) {
      setPendingSelection(null);
      return true; // 全ステップ完了
    }

    const [currentStep, ...rest] = steps;
    const ctx = {
      ownerSide,
      gameState,
      sourceMonsterIndex,
      justTrashedCardIds,
    };

    const actions = resolveMonsterEffect(currentStep, ctx);
    if (actions !== null) {
      const pickupStarted = dispatchWithPassives(actions, ownerSide, {
        remainingSteps: rest,
        justTrashedCardIds,
        sourceMonsterIndex,
      });
      if (pickupStarted) return true; // 拾が割り込んだ場合、sequenceは一旦停止(拾確定後に復帰)
      const trashedIds = extractTrashedCardIds(actions);
      return trySequenceFrom(rest, ownerSide, sourceMonsterIndex, trashedIds);
    }

    const requirement = describeSelectionRequirement(currentStep, ctx);
    if (requirement === null) {
      // このステップに対応する手段が無い場合、sequence全体を打ち切る
      // (中途半端に一部のステップだけ実行済みの状態になる点は、既存のresolveMonsterEffectの
      // sequenceケースのコメントと同じ考え方: 全ステップ揃って初めて「対応可能」と判断すべきだが、
      // 発動ボタンの活性判定(isSubEffectSupported)で事前にガードしているため、実運用では
      // ここに到達すること自体が想定外のケースとなる)
      setPendingSelection(null);
      return false;
    }

    setPendingSelection({
      requirement,
      effect: currentStep,
      ownerSide,
      sourceMonsterIndex,
      sequenceContext: { remainingSteps: rest, justTrashedCardIds },
    });
    return true;
  };

  // 即時解決→選択誘導の順に試す共通処理。
  // 【追加】単体効果としてのsequenceがresolveMonsterEffectで丸ごと自動解決できなかった場合、
  // trySequenceFromによるステップ単位のチェーン実行に切り替える。
  const tryExecute = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
    sourceMonsterIndex?: number,
  ): boolean => {
    const ctx = { ownerSide, gameState, sourceMonsterIndex };

    const actions = resolveMonsterEffect(effect, ctx);
    if (actions !== null) {
      const pickupStarted = dispatchWithPassives(actions, ownerSide);
      if (!pickupStarted) setPendingSelection(null);
      return true;
    }

    // 【追加】出(deck_compare_branch)の同数判定は、dispatch前の最新状態で行う必要がある
    // (回復すると山札枚数が変わり、後から再判定すると同数でなくなってしまうため)。
    // ここで同数と分かった場合のみ、確定後に2巡目(相手側)へつながるようマークする。
    if (effect.effectId === 'deck_compare_branch') {
      const selfDeck = getPlayerState(gameState, ownerSide).deck;
      const oppDeck = getPlayerState(
        gameState,
        getOpponentSide(ownerSide),
      ).deck;
      const isTie = selfDeck.length === oppDeck.length;
      const requirement = describeSelectionRequirement(effect, ctx);
      if (requirement === null) {
        setPendingSelection(null);
        return false;
      }
      setPendingSelection({
        requirement,
        effect,
        ownerSide,
        sourceMonsterIndex,
        deckCompareBranchPending: isTie
          ? getOpponentSide(ownerSide)
          : undefined,
      });
      return true;
    }

    if (effect.effectId === 'sequence') {
      return trySequenceFrom(
        effect.steps,
        ownerSide,
        sourceMonsterIndex,
        undefined,
      );
    }

    const requirement = describeSelectionRequirement(effect, ctx);
    if (requirement === null) {
      setPendingSelection(null);
      return false;
    }

    setPendingSelection({ requirement, effect, ownerSide, sourceMonsterIndex });
    return true;
  };

  // 効果発動の入口。true = 何らかの形で処理を開始できた（即時dispatch、または選択UIへの誘導）。
  // false = 選択待ち中、またはまだ対応するUIがない効果。
  const executeMonsterEffect = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
    sourceMonsterIndex?: number,
  ): boolean => {
    if (pendingSelection) return false; // 多重発動ガード
    return tryExecute(effect, ownerSide, sourceMonsterIndex);
  };

  const confirmSelection = (answer: EffectSelectionAnswer) => {
    if (!pendingSelection) return;

    // 【追加・拾】phase1(装備先モンスター選択)確定時: まだActionを組み立てず、
    // 選ばれたモンスターのindexを載せてphase2(拾われたカードからの選択)へ進む。
    if (
      pendingSelection.isPickupReaction &&
      pendingSelection.requirement.kind === 'monster_select' &&
      answer.kind === 'monster_select'
    ) {
      const equipTargetMonsterIndex = answer.selectedMonsterIndexes[0];
      if (equipTargetMonsterIndex === undefined) {
        setPendingSelection(null);
        return;
      }
      setPendingSelection({
        ...pendingSelection,
        requirement: {
          kind: 'pickup_select',
          side: pendingSelection.ownerSide,
          candidates: pendingSelection.pickupCandidateCards ?? [],
        },
        equipTargetMonsterIndex,
      });
      return;
    }

    // 【追加・拾】phase2(カード選択)確定時: 装備+ターン打ち切りをdispatchし、
    // pickupResumeContextがあれば元のsequenceへ自動復帰する。
    if (
      pendingSelection.isPickupReaction &&
      pendingSelection.requirement.kind === 'pickup_select' &&
      answer.kind === 'pickup_select'
    ) {
      const { ownerSide: side, equipTargetMonsterIndex } = pendingSelection;
      if (equipTargetMonsterIndex !== undefined) {
        dispatch({
          type: 'EQUIP_SPECIFIC_MANA',
          payload: {
            side,
            monsterIndex: equipTargetMonsterIndex,
            sourceZone: 'cemetery',
            manaCardId: answer.selectedCardId,
          },
        });
        dispatch({ type: 'FORCE_END_OPPONENT_TURN', payload: { side } });
      }

      const resume = pendingSelection.pickupResumeContext;
      setPendingSelection(null);
      if (resume) {
        trySequenceFrom(
          resume.remainingSteps,
          resume.originalOwnerSide,
          resume.originalSourceMonsterIndex,
          resume.justTrashedCardIds,
        );
      }
      return;
    }

    // choice_of_effectsの場合: 選ばれた選択肢のeffectを改めてtryExecuteに通す。
    if (
      pendingSelection.effect.effectId === 'choice_of_effects' &&
      answer.kind === 'choice_of_effects_select'
    ) {
      const chosen = pendingSelection.effect.options[answer.selectedIndex];
      if (!chosen) {
        setPendingSelection(null);
        return;
      }
      tryExecute(
        chosen.effect,
        pendingSelection.ownerSide,
        pendingSelection.sourceMonsterIndex,
      );
      return;
    }

    // 【追加・操】選ばれた相手モンスターのeffectを、操の発動者(ownerSide)・
    // 操自身(sourceMonsterIndex)を基準に改めてtryExecuteへ通す(choice_of_effectsと同じ設計)。
    // 選ばれたモンスターがeffectを持たない場合は不発として扱う(候補には出すが選ぶと不発、
    // というユーザー確認済みの仕様)。
    if (
      pendingSelection.effect.effectId === 'copy_opponent_monster_effect' &&
      answer.kind === 'monster_select'
    ) {
      const targetMonsterIndex = answer.selectedMonsterIndexes[0];
      const opponentSide = getOpponentSide(pendingSelection.ownerSide);
      const targetMonster =
        targetMonsterIndex !== undefined
          ? getPlayerState(gameState, opponentSide).monsters[targetMonsterIndex]
          : undefined;
      setPendingSelection(null);
      if (!targetMonster?.effect) return; // 不発(effect未定義)
      tryExecute(
        targetMonster.effect,
        pendingSelection.ownerSide,
        pendingSelection.sourceMonsterIndex,
      );
      return;
    }

    // 【追加】graveyard_select_equip(excludeSelf)のphase1確定時。まだActionを組み立てず、
    // 選ばれた装備先モンスターのindexを載せてphase2(墓地カード選択)へ進む。
    // sequenceContextが存在する場合(生・方のように外側sequenceのstep2として発動している場合)は
    // そのまま引き継ぎ、sequence自体はまだ進めない(phase2の確定を待つ)。
    if (
      pendingSelection.effect.effectId === 'graveyard_select_equip' &&
      pendingSelection.requirement.kind === 'monster_select' &&
      answer.kind === 'monster_select'
    ) {
      const chosenMonsterIndex = answer.selectedMonsterIndexes[0];
      if (chosenMonsterIndex === undefined) {
        setPendingSelection(null);
        return;
      }
      const phase2Ctx = {
        ownerSide: pendingSelection.ownerSide,
        gameState,
        sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
        justTrashedCardIds:
          pendingSelection.sequenceContext?.justTrashedCardIds,
        equipTargetMonsterIndex: chosenMonsterIndex,
      };
      const phase2Requirement = describeSelectionRequirement(
        pendingSelection.effect,
        phase2Ctx,
      );
      if (phase2Requirement === null) {
        setPendingSelection(null);
        return;
      }
      setPendingSelection({
        requirement: phase2Requirement,
        effect: pendingSelection.effect,
        ownerSide: pendingSelection.ownerSide,
        sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
        sequenceContext: pendingSelection.sequenceContext,
        equipTargetMonsterIndex: chosenMonsterIndex,
      });
      return;
    }

    const ctx = {
      ownerSide: pendingSelection.ownerSide,
      gameState,
      sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
      justTrashedCardIds: pendingSelection.sequenceContext?.justTrashedCardIds,
      forcedSide: pendingSelection.forcedSide,
      equipTargetMonsterIndex: pendingSelection.equipTargetMonsterIndex,
    };
    const actions = buildActionsFromSelection(
      pendingSelection.effect,
      ctx,
      answer,
    );

    // 【追加】sequence実行中の場合、このステップのActionをdispatchしてから
    // 残りのステップへ進む(案A: ステップ確定ごとに即dispatch)。
    // 【追加・拾】拾が割り込んだ場合、sequenceは一旦停止する(拾確定後にpickupResumeContext
    // 経由で自動復帰する)。
    if (pendingSelection.sequenceContext) {
      const trashedIds = actions ? extractTrashedCardIds(actions) : undefined;
      const pickupStarted = actions
        ? dispatchWithPassives(actions, pendingSelection.ownerSide, {
            remainingSteps: pendingSelection.sequenceContext.remainingSteps,
            justTrashedCardIds: trashedIds,
            sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
          })
        : false;
      if (pickupStarted) return;
      trySequenceFrom(
        pendingSelection.sequenceContext.remainingSteps,
        pendingSelection.ownerSide,
        pendingSelection.sourceMonsterIndex,
        trashedIds,
      );
      return;
    }

    // 【追加】出の同数ケース、1巡目確定後の処理。dispatchしてから、相手側を対象に2巡目を開始する。
    if (pendingSelection.deckCompareBranchPending) {
      if (actions) dispatchWithPassives(actions, pendingSelection.ownerSide);
      const nextSide = pendingSelection.deckCompareBranchPending;
      const nextCtx = {
        ownerSide: pendingSelection.ownerSide,
        gameState,
        sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
        forcedSide: nextSide,
      };
      const nextRequirement = describeSelectionRequirement(
        pendingSelection.effect,
        nextCtx,
      );
      if (nextRequirement === null) {
        setPendingSelection(null);
        return;
      }
      setPendingSelection({
        requirement: nextRequirement,
        effect: pendingSelection.effect,
        ownerSide: pendingSelection.ownerSide,
        sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
        forcedSide: nextSide,
      });
      return;
    }

    if (actions) {
      const pickupStarted = dispatchWithPassives(
        actions,
        pendingSelection.ownerSide,
      );
      if (!pickupStarted) setPendingSelection(null);
    } else {
      setPendingSelection(null);
    }
  };

  const cancelSelection = () => setPendingSelection(null);

  return {
    canAutoExecute,
    isEffectSupported,
    isSubEffectSupported,
    executeMonsterEffect,
    pendingSelection,
    confirmSelection,
    cancelSelection,
  };
};
