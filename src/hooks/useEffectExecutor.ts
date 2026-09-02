// src/hooks/useEffectExecutor.ts
//
// フェーズ5: 効果発動の入口となるフック。
// 1. resolveMonsterEffect（即時実行可能な効果）を試す
// 2. だめならdescribeSelectionRequirement（選択誘導が必要な効果）を試す
// 3. どちらも該当しなければfalseを返す（まだ対応するUIがない効果）
//
// 【追加】choice_of_effects対応: 選択肢が選ばれた後、その選択肢のeffectを
// 改めて上記1→2の手順で解決する必要があるため、共通処理をtryExecuteへ切り出した。
// executeMonsterEffect（発動ボタンからの入口）とconfirmSelection（選択肢確定後の再帰呼び出し）
// の両方がtryExecuteを経由する。

import { useState } from 'react';
import { resolveMonsterEffect } from '../utils/effectExecutor';
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
  effect: MonsterEffect;
  ownerSide: PlayerSide;
  sourceMonsterIndex?: number;
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

  // 【追加】pendingSelectionガードを含まない判定。choice_of_effectsの各選択肢が
  // 対応済みかどうかをUI側(App.tsx)で個別に判定する用途で使う
  // (この時点でpendingSelectionは既に存在している＝choice_of_effects自体の選択待ち中のため、
  // ガード込みのisEffectSupportedを使うと常にfalseになってしまう)。
  const isSubEffectSupported = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
    sourceMonsterIndex?: number,
  ): boolean => {
    const ctx = { ownerSide, gameState, sourceMonsterIndex };
    if (resolveMonsterEffect(effect, ctx) !== null) return true;
    return describeSelectionRequirement(effect, ctx) !== null;
  };

  // 即時解決→選択誘導の順に試す共通処理。
  const tryExecute = (
    effect: MonsterEffect,
    ownerSide: PlayerSide,
    sourceMonsterIndex?: number,
  ): boolean => {
    const ctx = { ownerSide, gameState, sourceMonsterIndex };

    const actions = resolveMonsterEffect(effect, ctx);
    if (actions !== null) {
      actions.forEach((action) => dispatch(action));
      setPendingSelection(null);
      return true;
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

    // 【追加】choice_of_effectsの場合: 選ばれた選択肢のeffectを改めてtryExecuteに通す。
    // 通常のbuildActionsFromSelectionは経由しない(「選択→即Action」ではなく
    // 「選択→もう一段階の解決」が必要なため)。
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

    const ctx = {
      ownerSide: pendingSelection.ownerSide,
      gameState,
      sourceMonsterIndex: pendingSelection.sourceMonsterIndex,
    };
    const actions = buildActionsFromSelection(
      pendingSelection.effect,
      ctx,
      answer,
    );
    if (actions) actions.forEach((action) => dispatch(action));
    setPendingSelection(null);
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
