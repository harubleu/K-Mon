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
import type { PlayerSide, ZoneType, MonsterCard, ManaCard } from './types'; // 必要な型を追加
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
import { ActionLogPanel } from './components/ActionLogPanel';
import { GameStatusAlertModal } from './components/GameStatusAlertModal';
import { EquipSwapPickerModal } from './components/GameBoard/EquipSwapPickerModal';
import { MixedZoneTrashPickerModal } from './components/GameBoard/MixedZoneTrashPickerModal';
import { MonsterSelectModal } from './components/GameBoard/MonsterSelectModal';
import { NumberPickerModal } from './components/GameBoard/NumberPickerModal';
import { ChoiceOfEffectsModal } from './components/GameBoard/ChoiceOfEffectsModal';

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
  // 【追加】発動ボタンから呼ばれる入口。monsterのeffectを引いて実行する。
  const handleActivateEffect = (
    side: PlayerSide,
    monsterIndex: number,
  ): boolean => {
    const monster = gameState[side].monsters[monsterIndex];
    if (!monster.effect) return false;
    return executeMonsterEffect(monster.effect, side, monsterIndex);
  };

  // 【追加】発動ボタンの活性/非活性判定用
  const canActivateEffect = (
    side: PlayerSide,
    monsterIndex: number,
  ): boolean => {
    const monster = gameState[side].monsters[monsterIndex];
    if (!monster.effect) return false;
    return isEffectSupported(monster.effect, side, monsterIndex);
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
    dispatch({ type: 'NEXT_PHASE' });
  };

  const handleAutoDraw = (player: PlayerSide) => {
    dispatch({
      type: 'AUTO_DRAW',
      payload: { player },
    });
    // ※今後、ここに「1枚ドロー確認」モーダル等を開く処理を追加します
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

  // 【追加】反用
  const monsterSelectProps = (() => {
    if (!pendingSelection) return null;
    if (pendingSelection.requirement.kind !== 'monster_select') return null;
    const req = pendingSelection.requirement;
    return {
      monsters: gameState[req.side].monsters,
      constraint: req.constraint,
      onConfirm: (selectedMonsterIndexes: number[]) =>
        confirmSelection({ kind: 'monster_select', selectedMonsterIndexes }),
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

          {/* じゃんけんモーダル */}
          <JankenModal
            isOpen={isJankenModalOpen}
            purpose={jankenPurpose}
            onComplete={handleJankenComplete}
            onClose={handleJankenClose}
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
            onConfirm={monsterSelectProps?.onConfirm ?? (() => {})}
            onCancel={monsterSelectProps?.onCancel ?? (() => {})}
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
