// src/App.tsx

import './App.css';

import React, { useState, useRef, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { useDeckBuilder } from './hooks/useDeckBuilder';
import { useEffectExecutor } from './hooks/useEffectExecutor';
import { KanjiTypePickerModal } from './components/GameBoard/KanjiTypePickerModal';
import { PlayerZone } from './components/PlayerZone';
import { ActionArea } from './components/ActionArea';
import { DeckBuilder } from './components/DeckBuilder/DeckBuilder';
import { JankenModal } from './components/GameBoard/JankenModal';
import { Card } from './components/Card'; // DragOverlay用
import type {
  PlayerSide,
  ZoneType,
  MonsterCard,
  ManaCard,
  PendingDraws,
} from './types'; // 必要な型を追加
import { createPortal } from 'react-dom';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  pointerWithin,
} from '@dnd-kit/core';
import { planDraw, buildDeckDrawActions } from './utils/drawFlow';
import { getWildcardKanji } from './utils/effectExecutor';
import { ActionLogPanel } from './components/ActionLogPanel';
import { GameStatusAlertModal } from './components/GameStatusAlertModal';
import { EquipSwapPickerModal } from './components/GameBoard/EquipSwapPickerModal';
import { MixedZoneTrashPickerModal } from './components/GameBoard/MixedZoneTrashPickerModal';
import { MonsterSelectModal } from './components/GameBoard/MonsterSelectModal';
import { PickupSelectModal } from './components/GameBoard/PickupSelectModal';
import { NumberPickerModal } from './components/GameBoard/NumberPickerModal';
import { ChoiceOfEffectsModal } from './components/GameBoard/ChoiceOfEffectsModal';
import { ZoneMoveSelectModal } from './components/GameBoard/ZoneMoveSelectModal';
import type { ZoneMoveCandidate } from './components/GameBoard/ZoneMoveSelectModal';
import { DeckCompositionPredictModal } from './components/GameBoard/DeckCompositionPredictModal';
import { GraveyardEquipModal } from './components/GameBoard/GraveyardEquipModal';
import { DeckIterativeSelectModal } from './components/GameBoard/DeckIterativeSelectModal';
import {
  getActivatableEffect,
  findOwnTurnEndPredictWinMonsterIndex,
  getOpponentSide,
} from './utils/effectExecutor';

export const App: React.FC = () => {
  const playerBuilder = useDeckBuilder();
  const opponentBuilder = useDeckBuilder();
  const { gameState, dispatch, undo, canUndo, redo, canRedo } = useGameState();
  const {
    pendingSelection,
    confirmSelection,
    cancelSelection,
    executeMonsterEffect,
    isEffectSupported,
    isSubEffectSupported,
  } = useEffectExecutor(gameState, dispatch);
  // 画面の切り替え状態を管理 (true: デッキ構築画面, false: 対戦画面)
  const [isBuildingDeck, setIsBuildingDeck] = useState(true);
  const [isJankenModalOpen, setIsJankenModalOpen] = useState(false);
  const [jankenPurpose, setJankenPurpose] = useState<'start' | 'battle'>(
    'start',
  );
  // 【追加・仁】ドローボタン割り込み用。free-choice(仁)の場合のみ選択UIを開く必要があるため
  // 保持する(花はkanji固定のため選択UI自体が不要で、このstateは使わない)。
  // 【今回改訂】選択候補(つけられるマナに限定済みのカードID)も保持する。
  // ドロー簿記(ターン開始ドローの済みフラグ・残りドロー回数)も保持し、確定時のdispatchに引き継ぐ。
  const [pendingDrawReplace, setPendingDrawReplace] = useState<{
    side: PlayerSide;
    candidateIds: string[];
    remainingDrawsAfter: PendingDraws | null;
  } | null>(null);
  // 【今回追加・流】ドローボタン割り込み用。流の所有者(ドローする側の相手)が予想する漢字を
  // 選ぶモーダルを開くために、ドローする側とドローの簿記を保持する。
  const [pendingFlowPrediction, setPendingFlowPrediction] = useState<{
    side: PlayerSide;
  } | null>(null);
  // 【追加・激】「ターンを終了」ボタン割り込み用。予想する漢字を選ぶモーダルを開くために保持する。
  const [pendingTurnEndPrediction, setPendingTurnEndPrediction] = useState<{
    side: PlayerSide;
    monsterIndex: number;
  } | null>(null);

  const [activeDragData, setActiveDragData] = useState<{
    manaCardId: string;
    side: PlayerSide;
    sourceZone: ZoneType;
    mana?: ManaCard;
  } | null>(null);

  // 追加: 位置更新専用（stateを使わずrefで直接DOM操作する）
  const overlayNodeRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // 初回マウント時のちらつき防止用（更新はしない、初期値のみ）
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // デッキ構築完了時のハンドラー
  const handleStartGame = (
    playerMonsters: MonsterCard[],
    playerDeck: ManaCard[],
    opponentMonsters: MonsterCard[],
    opponentDeck: ManaCard[],
  ) => {
    const setFlipped = (monsters: MonsterCard[]) =>
      monsters.map((m) => ({ ...m, isFlipped: true }));
    dispatch({
      type: 'SET_INITIAL_STATE',
      payload: {
        player: { monsters: setFlipped(playerMonsters), deck: playerDeck },
        opponent: {
          monsters: setFlipped(opponentMonsters),
          deck: opponentDeck,
        },
      },
    });
    setIsBuildingDeck(false);
    setJankenPurpose('start');
    setIsJankenModalOpen(true);
  };

  // 【追加】pendingSelectionを、DeckModalの effectSelection prop用の形に変換する。
  // kind !== 'deck_select' の場合はnullを返す(=DeckModalのカード選択UIは不要)。
  const deckSelectionProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'deck_select') return null;
    const req = pendingSelection.requirement; // ここでDeckSelectRequirementに絞り込まれる
    return {
      constraint: req.constraint,
      kanjiFilter: req.kanjiFilter,
      actionLabel: req.actionLabel,
      onConfirm: (selectedCardIds: string[]) =>
        confirmSelection({ kind: 'deck_select', selectedCardIds }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】pendingSelectionを、DeckModalの effectReorder prop用の形に変換する。
  const deckReorderProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'deck_reorder') return null;
    const req = pendingSelection.requirement; // ここでDeckReorderRequirementに絞り込まれる
    return {
      scope: req.scope,
      onConfirm: (orderedCardIds: string[]) =>
        confirmSelection({ kind: 'deck_reorder', orderedCardIds }),
      onCancel: cancelSelection,
    };
  })();

  // 【更新】発動ボタンから呼ばれる入口。monster.effectとpassiveEffect.own_turn_start.actionの
  // どちらを対象にすべきかをgetActivatableEffectが判定する(own_turn_startパイプライン)。
  const handleActivateEffect = (
    side: PlayerSide,
    monsterIndex: number,
  ): boolean => {
    const monster = gameState[side].monsters[monsterIndex];
    const effect = getActivatableEffect(monster, side, gameState);
    if (!effect) return false;
    return executeMonsterEffect(effect, side, monsterIndex);
  };

  // 【更新】発動ボタンの活性/非活性判定用。上記と同じ判定ロジックを使う
  const canActivateEffect = (
    side: PlayerSide,
    monsterIndex: number,
  ): boolean => {
    const monster = gameState[side].monsters[monsterIndex];
    const effect = getActivatableEffect(monster, side, gameState);
    if (!effect) return false;
    return isEffectSupported(effect, side, monsterIndex);
  };

  const handleJankenComplete = (firstPlayer?: PlayerSide) => {
    // start目的で、かつ結果がある場合のみターンプレイヤーをセット
    if (jankenPurpose === 'start' && firstPlayer) {
      dispatch({
        type: 'SET_TURN_PLAYER',
        payload: { turnPlayer: firstPlayer },
      });
    }
    setIsJankenModalOpen(false);
  };

  // 追加: バトル用じゃんけんモーダルを閉じる
  const handleJankenClose = () => {
    setIsJankenModalOpen(false);
  };

  // 追加: メインフェーズからのじゃんけん呼び出し
  const handleBattleJanken = () => {
    setJankenPurpose('battle');
    setIsJankenModalOpen(true);
  };

  const handleDeckMill = (
    targetSide: PlayerSide,
    count: number,
    destination: ZoneType = 'cemetery',
  ) => {
    const targetDeck = gameState[targetSide].deck;
    if (targetDeck.length === 0) return;

    const cardsToMove = targetDeck.slice(0, count).map((card) => card.id);

    dispatch({
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: {
        sourceSide: targetSide,
        targetSide: targetSide,
        cardIds: cardsToMove,
        sourceZone: 'deck',
        targetZone: destination,
      },
    });
  };

  // --- 手動アクションのハンドラー群 ---
  // 1. マナ装備処理（山札の先頭から装備）
  const handleEquipMana = (side: PlayerSide, monsterIndex: number) => {
    dispatch({
      type: 'EQUIP_MANA',
      payload: { side, monsterIndex },
    });
  };

  // 2. マナ破棄・除外処理
  const handleTrashMana = (
    side: PlayerSide,
    monsterIndex: number,
    manaCardIds: 'all' | string[],
    destination: 'cemetery' | 'exile',
  ) => {
    dispatch({
      type: 'TRASH_MANA',
      payload: {
        side,
        monsterIndex,
        manaCardIds,
        destination,
      },
    });
  };

  // 3. モンスター反転処理
  const handleFlipMonster = (side: PlayerSide, monsterIndex: number) => {
    dispatch({
      type: 'FLIP_MONSTER',
      payload: { side, monsterIndex },
    });
  };

  // 【今回追加・花】屮の色指定
  const handleDesignateMana = (
    side: PlayerSide,
    cardId: string,
    kanji: string | null,
  ) => {
    dispatch({
      type: 'SET_MANA_DESIGNATION',
      payload: { side, cardId, kanji },
    });
  };

  const handleRecover = (side: PlayerSide, manaIds: string[]) => {
    dispatch({
      type: 'RECOVER',
      payload: { side, manaCardIds: manaIds },
    });
  };

  const handleMoveCards = (params: {
    sourceSide: PlayerSide;
    targetSide: PlayerSide;
    cardIds: string[];
    sourceZone: ZoneType;
    targetZone: ZoneType;
  }) => {
    dispatch({
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: params,
    });
  };

  const handleReorderDeck = (side: PlayerSide, orderedCardIds: string[]) => {
    dispatch({
      type: 'REORDER_DECK',
      payload: { side, orderedCardIds },
    });
  };

  const handleEquipSpecific = (
    side: PlayerSide,
    manaCardId: string,
    sourceZone: ZoneType,
    monsterIndex: number,
  ) => {
    dispatch({
      type: 'EQUIP_SPECIFIC_MANA',
      payload: { side, monsterIndex, sourceZone, manaCardId },
    });
  };

  const handleShuffleDeck = (side: PlayerSide) => {
    dispatch({
      type: 'SHUFFLE_DECK',
      payload: { side },
    });
  };
  const handleNextPhase = () => {
    // 他の効果解決中(pendingSelection)は多重発動ガードに準じてターン終了割り込みを避ける。
    if (pendingSelection) {
      dispatch({ type: 'NEXT_PHASE' });
      return;
    }

    const side = gameState.turnPlayer;
    const monsterIndex = findOwnTurnEndPredictWinMonsterIndex(
      gameState[side].monsters,
    );
    if (monsterIndex !== -1) {
      setPendingTurnEndPrediction({ side, monsterIndex });
      return;
    }
    dispatch({ type: 'NEXT_PHASE' });
  };

  // 【追加・激】予想する漢字の宣言確定時のハンドラー。予想を保存してからNEXT_PHASEをdispatchする。
  const handleConfirmTurnEndPrediction = (selectedKanji: string[]) => {
    if (pendingTurnEndPrediction && selectedKanji[0]) {
      dispatch({
        type: 'SET_PREDICTED_DRAW_KANJI',
        payload: {
          side: pendingTurnEndPrediction.side,
          monsterIndex: pendingTurnEndPrediction.monsterIndex,
          kanji: selectedKanji[0],
        },
      });
    }
    setPendingTurnEndPrediction(null);
    dispatch({ type: 'NEXT_PHASE' });
  };

  // 【今回改訂・裁定確定】予想の宣言をキャンセルした場合、ターン終了自体も取りやめる。
  // 従来は「宣言なしでターン終了を続行する」設計だったが、宣言せずにターンが終わってしまう
  // 事故を防ぐため、流(予想キャンセル=ドローしない)と同じ「キャンセル=その場の操作全体を
  // 取りやめる」挙動に統一した。ターン終了ボタンを再度押せば、改めて予想モーダルが開く。
  const handleCancelTurnEndPrediction = () => {
    setPendingTurnEndPrediction(null);
  };

  const handleAutoDraw = (player: PlayerSide) => {
    // 【注記】他の効果解決中(pendingSelection)は、二重にモーダルが開く事故を避けるため
    // 新規の割り込み判定自体はスキップする(handleNextPhaseと同じ考え方)。ただし、これは
    // 従来からdraw系ボタン自体がpendingSelectionでガードされていなかった挙動を変更しない
    // ための配慮であり、AUTO_DRAWのdispatch自体は従来通り常に行われる。
    // 【今回改訂・命/走】ドローの種類と簿記の判定はplanDraw(utils/drawFlow.ts)に切り出した。
    const plan = planDraw(gameState, player, {
      suppressReplace: !!pendingSelection,
    });
    if (plan.kind === 'graveyard_auto') {
      // 花: 漢字固定のため選択UI不要。つけられる屮があれば自動採用する。
      dispatch({
        type: 'DRAW_REPLACE_FROM_GRAVEYARD',
        payload: { side: player, cardId: plan.cardId, ...plan.bookkeeping },
      });
      return;
    }
    if (plan.kind === 'graveyard_choose') {
      // 仁: つけられるマナの中から1枚を選ばせる。
      setPendingDrawReplace({
        side: player,
        candidateIds: plan.candidateIds,
        remainingDrawsAfter: plan.remainingDrawsAfter,
      });
      return;
    }

    // 山札からのドロー。流(表向き)がいる場合は、ドローの前に予想の入力を求める。
    if (plan.needsPrediction) {
      setPendingFlowPrediction({ side: player });
      return;
    }
    buildDeckDrawActions(gameState, player, plan).forEach(dispatch);
  };

  // 【今回追加・流】予想の確定。予想を受けて、ドローと星・流の反応をまとめてdispatchする。
  const handleConfirmFlowPrediction = (selectedKanji: string[]) => {
    if (!pendingFlowPrediction || !selectedKanji[0]) return;
    const side = pendingFlowPrediction.side;
    setPendingFlowPrediction(null);
    // 予想モーダルを開いている間に盤面は変わらないため、ここで改めてplanDrawを取り直す
    const plan = planDraw(gameState, side);
    if (plan.kind !== 'deck') return;
    buildDeckDrawActions(gameState, side, plan, selectedKanji[0]).forEach(
      dispatch,
    );
  };

  // 【今回追加・流】予想は必須のため、キャンセルした場合はドローを行わずに閉じる
  // (仁の選択キャンセルと同じ扱い。押し直せば再度ドローできる)。
  const handleCancelFlowPrediction = () => {
    setPendingFlowPrediction(null);
  };

  // 【追加・仁】墓地からのドロー代替、選択確定時のハンドラー
  const handleConfirmDrawReplace = (selectedCardId: string) => {
    if (pendingDrawReplace) {
      dispatch({
        type: 'DRAW_REPLACE_FROM_GRAVEYARD',
        payload: {
          side: pendingDrawReplace.side,
          cardId: selectedCardId,
          isTurnStartDraw: true,
          remainingDrawsAfter: pendingDrawReplace.remainingDrawsAfter,
        },
      });
    }
    setPendingDrawReplace(null);
  };

  // 【今回改訂】仁の選択をキャンセルした場合は、ドロー自体を行わない(何も起きずに閉じる)。
  // 公式QA: 仁は意図的に避けて山札から引くことはできない。従来はキャンセルすると通常の
  // 山札ドローにフォールバックしており、仁を回避できてしまっていた。
  const handleCancelDrawReplace = () => {
    setPendingDrawReplace(null);
  };

  // 1. D&D用センサーの設定（ボタンクリック動作と誤判定されないよう5pxの遊びを設定）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 5から3に変更し、末尾要素でも即座に正しくドラッグを検知させる
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active, activatorEvent } = event;
    const data = active.data.current as any;
    if (data && data.manaCardId) {
      setActiveDragData(data);
    }

    const rect = active.rect.current.initial;
    const nativeEvent = activatorEvent as PointerEvent;
    const clientX = nativeEvent.clientX ?? 0;
    const clientY = nativeEvent.clientY ?? 0;

    if (rect) {
      dragOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }
    setDragStartPos({ x: clientX, y: clientY }); // 初期表示位置のみ。以降はrefで更新
  };

  useEffect(() => {
    if (!activeDragData) return;

    const handlePointerMove = (e: PointerEvent) => {
      const node = overlayNodeRef.current;
      if (!node) return;
      const { x: offsetX, y: offsetY } = dragOffsetRef.current;
      node.style.transform = `translate3d(${e.clientX - offsetX}px, ${
        e.clientY - offsetY
      }px, 0)`;
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [activeDragData]);

  const handleDragCancel = () => {
    setActiveDragData(null);
    setDragStartPos(null);
  };

  // 2. ドラッグ終了時のハンドラー
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null); // ドラッグ状態をリセット
    setDragStartPos(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as
      | {
          manaCardId: string;
          side: PlayerSide;
          sourceZone: ZoneType;
        }
      | undefined;

    const overData = over.data.current as
      | {
          side: PlayerSide;
          monsterIndex: number;
          slotIndex: number;
        }
      | undefined;

    if (
      activeData &&
      overData &&
      overData.side &&
      overData.monsterIndex !== undefined
    ) {
      dispatch({
        type: 'EQUIP_SPECIFIC_MANA',
        payload: {
          side: overData.side,
          monsterIndex: overData.monsterIndex,
          sourceZone: activeData.sourceZone,
          manaCardId: activeData.manaCardId,
          targetSlotIndex: overData.slotIndex,
        },
      });
    } else if (activeData || overData) {
      console.warn(
        '[handleDragEnd] side/monsterIndexが不足しているため中断しました。over.id:',
        over.id,
        'overData:',
        overData,
        'activeData:',
        activeData,
      );
    }
  };

  // 追加: ゲームリセット（再戦）ハンドラー
  const handleRestartGame = () => {
    const pData = playerBuilder.generateGameCards();
    const oData = opponentBuilder.generateGameCards();
    const setFlipped = (monsters: MonsterCard[]) =>
      monsters.map((m) => ({ ...m, isFlipped: true }));

    dispatch({
      type: 'SET_INITIAL_STATE',
      payload: {
        player: { monsters: setFlipped(pData.monsters), deck: pData.deck },
        opponent: { monsters: setFlipped(oData.monsters), deck: oData.deck },
      },
    });
    setJankenPurpose('start');
    setIsJankenModalOpen(true);
  };

  // 【追加】械・泣用(山札非公開)
  const kanjiTypeSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'kanji_type_select') return null;
    const req = pendingSelection.requirement;
    return {
      kanjiCount: req.kanjiCount,
      onConfirm: (selectedKanji: string[]) =>
        confirmSelection({ kind: 'kanji_type_select', selectedKanji }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】検・派用(山札の一部を公開)
  const deckKanjiSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'deck_kanji_reveal_select')
      return null;
    const req = pendingSelection.requirement;
    return {
      revealScope: req.revealScope,
      kanjiCount: req.kanjiCount,
      allowAnyKanji: req.allowAnyKanji,
      onConfirm: (selectedKanji: string[]) =>
        confirmSelection({ kind: 'deck_kanji_reveal_select', selectedKanji }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】graveyard_select_recover/graveyard_select_equip用
  const graveyardSelectionProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'graveyard_select') return null;
    const req = pendingSelection.requirement;
    return {
      constraint: req.constraint,
      kanjiFilter: req.kanjiFilter,
      cardIdFilter: req.cardIdFilter, // 【追加】方のsourceRestriction用
      actionLabel: req.actionLabel,
      onConfirm: (selectedCardIds: string[]) =>
        confirmSelection({ kind: 'graveyard_select', selectedCardIds }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】代用: 装備マナ⇔墓地カードの1組スワップ
  const equipSwapProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'equip_swap_select') return null;
    const req = pendingSelection.requirement;
    const targetState = gameState[req.side];
    return {
      equippedManaCandidates: targetState.monsters.flatMap((m, mi) =>
        m.equippedMana
          .filter((mana): mana is NonNullable<typeof mana> => mana !== null)
          .map((mana) => ({ card: mana, monsterLabel: `モンスター${mi + 1}` })),
      ),
      graveyardCards: targetState.cemetery,
      onConfirm: (equippedManaId: string, graveyardCardId: string) =>
        confirmSelection({
          kind: 'equip_swap_select',
          equippedManaId,
          graveyardCardId,
        }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】斧用: 装備マナ＋山札の混在選択
  const mixedZoneTrashProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'mixed_zone_trash_select')
      return null;
    const req = pendingSelection.requirement;
    const targetState = gameState[req.side];
    return {
      deckCards: req.sources.includes('deck') ? targetState.deck : undefined,
      equippedManaCandidates: req.sources.includes('monster_mana')
        ? targetState.monsters.flatMap((m, mi) =>
            m.equippedMana
              .filter((mana): mana is NonNullable<typeof mana> => mana !== null)
              .map((mana) => ({
                card: mana,
                monsterLabel: `モンスター${mi + 1}`,
              })),
          )
        : undefined,
      constraint: req.constraint,
      onConfirm: (selectedCardIds: string[]) =>
        confirmSelection({ kind: 'mixed_zone_trash_select', selectedCardIds }),
      onCancel: cancelSelection,
    };
  })();

  // 【更新】反用＋生方のexcludeSelf(phase1)用。excludeMonsterIndexが指定されている場合、
  // MonsterSelectModal側でそのindexだけ選択不可にする(配列自体は絞らない。絞るとindexが
  // ずれてonConfirmのselectedMonsterIndexesが実際の配列と食い違うため)。
  const monsterSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'monster_select') return null;
    const req = pendingSelection.requirement;
    return {
      monsters: gameState[req.side].monsters,
      constraint: req.constraint,
      excludeMonsterIndex: req.excludeMonsterIndex,
      disabledMonsters: req.disabledMonsters,
      onConfirm: (selectedMonsterIndexes: number[]) =>
        confirmSelection({ kind: 'monster_select', selectedMonsterIndexes }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】兄・各・共・生・方用(graveyard_equip_select)
  const graveyardEquipSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'graveyard_equip_select')
      return null;
    const req = pendingSelection.requirement;
    return {
      side: req.side,
      cemetery: gameState[req.side].cemetery,
      monsters: gameState[req.side].monsters,
      pairCount: req.pairCount,
      kanjiFilter: req.kanjiFilter,
      cardIdFilter: req.cardIdFilter,
      excludeMonsterIndex: req.excludeMonsterIndex,
      disabledMonsters: req.disabledMonsters,
      wildcardKanji: getWildcardKanji(gameState, req.side),
      singleMonster: req.singleMonster,
      onConfirm: (
        pairs: {
          cardId: string;
          monsterIndex: number;
          slotIndex: number;
        }[],
      ) => confirmSelection({ kind: 'graveyard_equip_select', pairs }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】方用: deck_iterative_select
  const deckIterativeSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'deck_iterative_select')
      return null;
    const req = pendingSelection.requirement;
    const deck = gameState[req.side].deck;
    const card = deck[0] ?? null;
    const canContinue = req.sentCount + 1 < req.maxCount && deck.length > 1;
    return {
      card,
      sentCount: req.sentCount,
      maxCount: req.maxCount,
      canContinue,
      onDecision: (action: 'stop' | 'continue') =>
        confirmSelection({ kind: 'deck_iterative_select', action }),
    };
  })();

  // 【追加・拾】pickup_select用(phase2: 拾ったカードからの選択)
  const pickupSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'pickup_select') return null;
    const req = pendingSelection.requirement;
    return {
      candidates: req.candidates,
      onConfirm: (selectedCardId: string) =>
        confirmSelection({ kind: 'pickup_select', selectedCardId }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】刃・屍・死・葬用
  const numberSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'number_select') return null;
    const req = pendingSelection.requirement;
    return {
      minNumber: req.minNumber,
      maxNumber: req.maxNumber,
      onConfirm: (selectedNumber: number) =>
        confirmSelection({ kind: 'number_select', selectedNumber }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】二・三用
  const choiceOfEffectsProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'choice_of_effects_select')
      return null;
    const effect = pendingSelection.effect;
    if (effect.effectId !== 'choice_of_effects') return null; // 型安全のため(理論上到達しない)
    const req = pendingSelection.requirement;
    return {
      options: req.options.map((label, i) => ({
        label,
        supported: isSubEffectSupported(
          effect.options[i].effect,
          pendingSelection.ownerSide,
          pendingSelection.sourceMonsterIndex,
        ),
      })),
      onConfirm: (selectedIndex: number) =>
        confirmSelection({ kind: 'choice_of_effects_select', selectedIndex }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】言・信・競・招・右・哲(janken_conditional_reduce)用
  const jankenSelectionProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'janken_select') return null;
    const req = pendingSelection.requirement;
    return {
      restrictOpponentHands: req.restrictOpponentHands,
      resolveTieAsOutcome: req.resolveTieAsOutcome,
      onBattleResult: (outcome: 'win' | 'tie' | 'lose') =>
        confirmSelection({ kind: 'janken_select', outcome }),
    };
  })();

  // 【追加】然(select_zone_move_one)用。山札1番上＋墓地の合算候補を、確定時点ではなく
  // 表示時点のgameStateから毎回組み立てる(表示中に盤面が変わる可能性は低いが、
  // 念のためbuildActionsFromSelection側でも改めて最新状態から再判定している。1.3章参照)。
  const zoneMoveSelectionProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'zone_move_select') return null;
    const req = pendingSelection.requirement;
    const playerState = gameState[req.side];
    const candidates: ZoneMoveCandidate[] = [];
    if (req.sourceOptions.includes('deck_top') && playerState.deck.length > 0) {
      const top = playerState.deck[0];
      candidates.push({
        cardId: top.id,
        kanji: top.kanji,
        reading: top.reading,
        sourceZone: 'deck',
      });
    }
    if (req.sourceOptions.includes('graveyard')) {
      playerState.cemetery.forEach((c) =>
        candidates.push({
          cardId: c.id,
          kanji: c.kanji,
          reading: c.reading,
          sourceZone: 'cemetery',
        }),
      );
    }
    return { candidates };
  })();

  // 【追加】国用。ChoiceOfEffectsModalを流用するが、choice_of_effects(二・三)とは別kind
  // (zone_target_select)から発行されるため、choiceOfEffectsPropsとは独立して導出する。
  // 4択は常に自動判定できる(サブ効果の選択ではない)ため、supportedは常にtrueで固定する。
  const zoneTargetSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'zone_target_select') return null;
    const req = pendingSelection.requirement;
    return {
      options: req.options.map((label) => ({ label, supported: true })),
      onConfirm: (selectedIndex: number) =>
        confirmSelection({ kind: 'zone_target_select', selectedIndex }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】究用。相手の山札の合計枚数のみ参考表示し、内訳は見せない。
  const deckCompositionPredictProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'deck_composition_predict')
      return null;
    const opponentSide = getOpponentSide(pendingSelection.ownerSide);
    return {
      opponentDeckCount: gameState[opponentSide].deck.length,
      onConfirm: (composition: Record<string, number>) =>
        confirmSelection({ kind: 'deck_composition_predict', composition }),
      onCancel: cancelSelection,
    };
  })();

  // 【追加】どちら側のPlayerZoneにDeckModalを開かせるべきか
  const pendingSelectionSide =
    pendingSelection &&
    (pendingSelection.requirement.kind === 'deck_select' ||
      pendingSelection.requirement.kind === 'deck_reorder' ||
      pendingSelection.requirement.kind === 'deck_kanji_reveal_select' ||
      pendingSelection.requirement.kind === 'graveyard_select')
      ? pendingSelection.requirement.side
      : null;

  // --- デッキ構築画面のレンダリング ---
  if (isBuildingDeck) {
    return (
      <DeckBuilder
        playerBuilder={playerBuilder}
        opponentBuilder={opponentBuilder}
        onStartGame={handleStartGame}
      />
    );
  }

  // --- 対戦画面 (サンドボックス) のレンダリング ---
  return (
    // 3. 対戦画面全体を <DndContext> で包む
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.BeforeDragging,
        },
      }}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
    >
      <div
        style={{
          display: 'flex',
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '0 16px 16px 16px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            flex: 1,
            padding: '0 16px 16px 16px',
          }}
        >
          <GameStatusAlertModal
            status={gameState.gameStatus}
            onRestart={handleRestartGame}
            onBackToTitle={() => setIsBuildingDeck(true)}
          />
          {/* 画面上部 固定ヘッダー */}
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 100,
              backgroundColor: '#ffffff',
              borderBottom: '2px solid #e5e7eb',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <button onClick={() => setIsBuildingDeck(true)}>
              ← デッキ構築に戻る
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={undo}
                disabled={!canUndo}
                style={{
                  padding: '6px 12px',
                  backgroundColor: canUndo ? '#4b5563' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canUndo ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                ↩ 1手戻す
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                style={{
                  padding: '6px 12px',
                  backgroundColor: canRedo ? '#4b5563' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canRedo ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                やり直す ↪
              </button>
            </div>

            <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>
              カンジモンスターズ 特訓用Webアプリ
            </h1>
          </header>

          {/* じゃんけんモーダル。jankenSelectionProps(効果解決由来)が存在する間は
              強制的に開き、purposeも'battle'に固定する */}
          <JankenModal
            isOpen={!!jankenSelectionProps || isJankenModalOpen}
            purpose={jankenSelectionProps ? 'battle' : jankenPurpose}
            restrictOpponentHands={jankenSelectionProps?.restrictOpponentHands}
            resolveTieAsOutcome={jankenSelectionProps?.resolveTieAsOutcome}
            onBattleResult={jankenSelectionProps?.onBattleResult}
            onComplete={handleJankenComplete}
            onClose={jankenSelectionProps ? cancelSelection : handleJankenClose}
          />

          {/* 【追加】漢字種類選択モーダル(械・泣用。特定の山札に紐付かないためsideのルーティング不要) */}
          <KanjiTypePickerModal
            isOpen={!!kanjiTypeSelectProps}
            kanjiCount={kanjiTypeSelectProps?.kanjiCount ?? 1}
            onConfirm={kanjiTypeSelectProps?.onConfirm ?? (() => {})}
            onCancel={kanjiTypeSelectProps?.onCancel ?? (() => {})}
          />

          {/* 【追加】代用 */}
          <EquipSwapPickerModal
            isOpen={!!equipSwapProps}
            equippedManaCandidates={
              equipSwapProps?.equippedManaCandidates ?? []
            }
            graveyardCards={equipSwapProps?.graveyardCards ?? []}
            onConfirm={equipSwapProps?.onConfirm ?? (() => {})}
            onCancel={equipSwapProps?.onCancel ?? (() => {})}
          />

          {/* 【追加】斧用 */}
          <MixedZoneTrashPickerModal
            isOpen={!!mixedZoneTrashProps}
            deckCards={mixedZoneTrashProps?.deckCards}
            equippedManaCandidates={mixedZoneTrashProps?.equippedManaCandidates}
            constraint={mixedZoneTrashProps?.constraint ?? { min: 0, max: 0 }}
            onConfirm={mixedZoneTrashProps?.onConfirm ?? (() => {})}
            onCancel={mixedZoneTrashProps?.onCancel ?? (() => {})}
          />

          {/* 【追加】反用 */}
          <MonsterSelectModal
            isOpen={!!monsterSelectProps}
            monsters={monsterSelectProps?.monsters ?? []}
            constraint={monsterSelectProps?.constraint ?? { min: 0, max: 0 }}
            excludeMonsterIndex={monsterSelectProps?.excludeMonsterIndex}
            disabledMonsters={monsterSelectProps?.disabledMonsters}
            onConfirm={monsterSelectProps?.onConfirm ?? (() => {})}
            onCancel={monsterSelectProps?.onCancel ?? (() => {})}
          />

          {/* 【追加】兄・各・共・生・方用 */}
          <GraveyardEquipModal
            isOpen={!!graveyardEquipSelectProps}
            side={graveyardEquipSelectProps?.side ?? 'player'}
            cemetery={graveyardEquipSelectProps?.cemetery ?? []}
            monsters={graveyardEquipSelectProps?.monsters ?? []}
            pairCount={graveyardEquipSelectProps?.pairCount ?? 0}
            kanjiFilter={graveyardEquipSelectProps?.kanjiFilter}
            cardIdFilter={graveyardEquipSelectProps?.cardIdFilter}
            excludeMonsterIndex={graveyardEquipSelectProps?.excludeMonsterIndex}
            disabledMonsters={graveyardEquipSelectProps?.disabledMonsters}
            wildcardKanji={graveyardEquipSelectProps?.wildcardKanji}
            singleMonster={graveyardEquipSelectProps?.singleMonster}
            onConfirm={graveyardEquipSelectProps?.onConfirm ?? (() => {})}
            onCancel={graveyardEquipSelectProps?.onCancel ?? (() => {})}
          />

          <DeckIterativeSelectModal
            isOpen={!!deckIterativeSelectProps}
            card={deckIterativeSelectProps?.card ?? null}
            sentCount={deckIterativeSelectProps?.sentCount ?? 0}
            maxCount={deckIterativeSelectProps?.maxCount ?? 0}
            canContinue={deckIterativeSelectProps?.canContinue ?? false}
            onDecision={deckIterativeSelectProps?.onDecision ?? (() => {})}
          />

          {/* 【追加】拾用 */}
          <PickupSelectModal
            isOpen={!!pickupSelectProps}
            candidates={pickupSelectProps?.candidates ?? []}
            onConfirm={pickupSelectProps?.onConfirm ?? (() => {})}
            onCancel={pickupSelectProps?.onCancel ?? (() => {})}
          />

          {/* 【追加・激】「ターンを終了」ボタン割り込み由来の予想宣言モーダル。
              KanjiTypePickerModalを流用(既存のkanjiTypeSelectPropsとは別系統の独立したstate)。 */}
          <KanjiTypePickerModal
            isOpen={!!pendingTurnEndPrediction}
            kanjiCount={1}
            onConfirm={handleConfirmTurnEndPrediction}
            onCancel={handleCancelTurnEndPrediction}
          />

          {/* 【今回追加・流】ドローボタン割り込み由来の予想宣言モーダル。KanjiTypePickerModalを流用
              (激・械泣用とは別state系統)。予想するのは流の所有者だが、ドローする側は相手。 */}
          <KanjiTypePickerModal
            isOpen={!!pendingFlowPrediction}
            kanjiCount={1}
            title='相手が次に引くマナの種類を予想してください（流）'
            confirmLabel='この種類で予想する'
            onConfirm={handleConfirmFlowPrediction}
            onCancel={handleCancelFlowPrediction}
          />

          {/* 【追加・仁】ドローボタン割り込み由来の、墓地からドローするマナの選択モーダル。
              PickupSelectModal(拾用)をtitle/description/confirmLabelで文言を差し替えて流用する。 */}
          <PickupSelectModal
            isOpen={!!pendingDrawReplace}
            candidates={
              pendingDrawReplace
                ? gameState[pendingDrawReplace.side].cemetery
                    .filter((c) =>
                      pendingDrawReplace.candidateIds.includes(c.id),
                    )
                    .map((c) => ({
                      id: c.id,
                      kanji: c.kanji,
                      reading: c.reading,
                    }))
                : []
            }
            title='仁の発動：ドローするマナを選択'
            description='山札の代わりに、墓地からモンスターにつけられるマナを1枚選んでドローします（キャンセルするとドローしません）。'
            confirmLabel='このマナをドローする'
            onConfirm={handleConfirmDrawReplace}
            onCancel={handleCancelDrawReplace}
          />

          {/* 【追加】刃・屍・死・葬用 */}
          <NumberPickerModal
            isOpen={!!numberSelectProps}
            minNumber={numberSelectProps?.minNumber ?? 1}
            maxNumber={numberSelectProps?.maxNumber ?? 1}
            onConfirm={numberSelectProps?.onConfirm ?? (() => {})}
            onCancel={numberSelectProps?.onCancel ?? (() => {})}
          />

          {/* 【追加】二・三用 */}
          <ChoiceOfEffectsModal
            isOpen={!!choiceOfEffectsProps}
            options={choiceOfEffectsProps?.options ?? []}
            onConfirm={choiceOfEffectsProps?.onConfirm ?? (() => {})}
            onCancel={choiceOfEffectsProps?.onCancel ?? (() => {})}
          />

          <ZoneMoveSelectModal
            isOpen={!!zoneMoveSelectionProps}
            candidates={zoneMoveSelectionProps?.candidates ?? []}
            onConfirm={(selectedCardId) =>
              confirmSelection({ kind: 'zone_move_select', selectedCardId })
            }
            onCancel={cancelSelection}
          />

          {/* 【追加】国用。ChoiceOfEffectsModalを流用(二・三用のインスタンスとは別state系統)。 */}
          <ChoiceOfEffectsModal
            isOpen={!!zoneTargetSelectProps}
            options={zoneTargetSelectProps?.options ?? []}
            onConfirm={zoneTargetSelectProps?.onConfirm ?? (() => {})}
            onCancel={zoneTargetSelectProps?.onCancel ?? (() => {})}
          />

          {/* 【追加】究用。相手の山札構成を丸ごと申告させる専用モーダル。 */}
          <DeckCompositionPredictModal
            isOpen={!!deckCompositionPredictProps}
            opponentDeckCount={
              deckCompositionPredictProps?.opponentDeckCount ?? 0
            }
            onConfirm={deckCompositionPredictProps?.onConfirm ?? (() => {})}
            onCancel={deckCompositionPredictProps?.onCancel ?? (() => {})}
          />

          {/* [上段] Opponent (相手) エリア */}
          <PlayerZone
            playerState={gameState.opponent}
            side='opponent'
            label='相手'
            onEquipMana={handleEquipMana}
            onTrashMana={handleTrashMana}
            onFlipMonster={handleFlipMonster}
            onRecover={handleRecover}
            onMoveCards={handleMoveCards}
            onEquipSpecific={handleEquipSpecific}
            onShuffleDeck={handleShuffleDeck}
            onDraw={handleAutoDraw}
            onReorderDeck={handleReorderDeck}
            effectSelection={
              pendingSelectionSide === 'opponent' ? deckSelectionProps : null
            }
            effectReorder={
              pendingSelectionSide === 'opponent' ? deckReorderProps : null
            }
            effectKanjiSelect={
              pendingSelectionSide === 'opponent' ? deckKanjiSelectProps : null
            }
            effectGraveyardSelection={
              pendingSelectionSide === 'opponent'
                ? graveyardSelectionProps
                : null
            }
            onActivateEffect={handleActivateEffect}
            canActivateEffect={canActivateEffect}
            wildcardKanji={getWildcardKanji(gameState, 'opponent')}
            onDesignateMana={handleDesignateMana}
          />

          {/* [中段] アクション・情報表示エリア */}
          <div
            style={{
              display: 'grid',
              gap: '16px',
              margin: '16px 0',
            }}
          >
            <ActionArea
              turnPlayer={gameState.turnPlayer}
              turnCount={gameState.turnCount}
              onSwitchTurn={handleNextPhase}
              onDraw={handleAutoDraw}
              remainingDraws={
                gameState[gameState.turnPlayer].remainingDraws?.count
              }
              onJanken={handleBattleJanken}
              onDeckMill={handleDeckMill}
            />
          </div>

          {/* [下段] Player (自分) エリア */}
          <PlayerZone
            playerState={gameState.player}
            side='player'
            label='自分'
            onEquipMana={handleEquipMana}
            onTrashMana={handleTrashMana}
            onFlipMonster={handleFlipMonster}
            onRecover={handleRecover}
            onMoveCards={handleMoveCards}
            onEquipSpecific={handleEquipSpecific}
            onShuffleDeck={handleShuffleDeck}
            onDraw={handleAutoDraw}
            onReorderDeck={handleReorderDeck}
            effectSelection={
              pendingSelectionSide === 'player' ? deckSelectionProps : null
            }
            effectReorder={
              pendingSelectionSide === 'player' ? deckReorderProps : null
            }
            effectKanjiSelect={
              pendingSelectionSide === 'player' ? deckKanjiSelectProps : null
            }
            effectGraveyardSelection={
              pendingSelectionSide === 'player' ? graveyardSelectionProps : null
            }
            onActivateEffect={handleActivateEffect}
            canActivateEffect={canActivateEffect}
            wildcardKanji={getWildcardKanji(gameState, 'player')}
            onDesignateMana={handleDesignateMana}
          />
        </div>

        {/* 追加: リアルタイム対戦ログ表示パネル */}
        <ActionLogPanel logs={gameState.logs} />
      </div>

      {activeDragData &&
        activeDragData.mana &&
        dragStartPos &&
        createPortal(
          <div
            ref={overlayNodeRef}
            style={{
              position: 'fixed',
              top: -15,
              left: -20,
              transform: `translate3d(${
                dragStartPos.x - dragOffsetRef.current.x
              }px, ${dragStartPos.y - dragOffsetRef.current.y}px, 0)`,
              pointerEvents: 'none',
              zIndex: 9999,
              willChange: 'transform',
            }}
          >
            <Card card={activeDragData.mana} />
          </div>,
          document.body,
        )}
    </DndContext>
  );
};

export default App;
