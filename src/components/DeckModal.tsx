// src/components/DeckModal.tsx

import React, { useState } from 'react';
import type { ManaCard, MonsterCard, PlayerSide, ZoneType } from '../types';
import { Card } from './Card';
import { MonsterSummary } from './MonsterSummary';
import { DraggableMana } from './GameBoard/DraggableMana';
import { SortableDeckCard } from './GameBoard/SortableDeckCard';
import { MoveDestinationSelector } from './MoveDestinationSelector';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

export interface DeckModalProps {
  isOpen: boolean;
  deck: ManaCard[];
  side: PlayerSide;
  monsters: MonsterCard[];
  label: string;
  onClose: () => void;
  onMoveCards: (params: {
    sourceSide: PlayerSide;
    targetSide: PlayerSide;
    cardIds: string[];
    sourceZone: ZoneType;
    targetZone: ZoneType;
  }) => void;
  onEquipSpecific: (
    side: PlayerSide,
    cardId: string,
    sourceZone: ZoneType,
    monsterIndex: number,
  ) => void;
  onShuffleDeck: (side: PlayerSide) => void;
  onReorderDeck: (side: PlayerSide, orderedCardIds: string[]) => void;
  effectSelection?: {
    constraint: { min: number; max: number };
    kanjiFilter?: string[];
    actionLabel: string;
    onConfirm: (selectedCardIds: string[]) => void;
    onCancel: () => void;
  } | null;
  effectReorder?: {
    scope: 'full' | { partialTopCount: number };
    onConfirm: (orderedCardIds: string[]) => void;
    onCancel: () => void;
  } | null;
  effectKanjiSelect?: {
    revealScope: 'full' | number;
    kanjiCount: number;
    onConfirm: (selectedKanji: string[]) => void;
    onCancel: () => void;
  } | null;
}

export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  deck,
  monsters,
  side,
  label,
  onClose,
  onMoveCards,
  onEquipSpecific,
  onShuffleDeck,
  onReorderDeck,
  effectSelection = null, // 【追加】
  effectReorder = null, // 【追加】
  effectKanjiSelect = null,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedKanji, setSelectedKanji] = useState<string[]>([]);
  // 【変更】並び替えモード用の状態。クリックで順序を選ぶ方式から、
  // 現在の山札のスナップショットをD&Dで直接並び替える方式に変更したため、
  // reorderSequence(選んだ順序の部分配列)ではなく、常に「完全な並び」を保持する。
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [orderedDeck, setOrderedDeck] = useState<ManaCard[]>([]);

  React.useEffect(() => {
    if (!effectReorder) return;
    setSelectedIds([]);
    const snapshot =
      effectReorder.scope === 'full'
        ? deck
        : deck.slice(0, effectReorder.scope.partialTopCount);
    setOrderedDeck(snapshot);
    setIsReorderMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectReorder]);

  // 【追加】並び替え専用センサー。バトル画面本体のD&Dとは独立している。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  );

  if (!isOpen) return null;

  // 【追加】effectKanjiSelectがある場合、表示対象を公開範囲に限定する(派: 上から8枚のみ)
  const displayedDeck = effectKanjiSelect
    ? effectKanjiSelect.revealScope === 'full'
      ? deck
      : deck.slice(0, effectKanjiSelect.revealScope)
    : deck;

  const handleToggleCard = (cardId: string) => {
    setSelectedIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  };

  const handleEquip = (monsterIndex: number) => {
    if (selectedIds.length === 1) {
      onEquipSpecific(side, selectedIds[0], 'deck', monsterIndex);
      setSelectedIds([]);
    }
  };

  const handleStartReorder = () => {
    setSelectedIds([]);
    setOrderedDeck(deck); // 現在の並びをスナップショットとして取り込む
    setIsReorderMode(true);
  };

  const handleConfirmReorder = () => {
    if (effectReorder) {
      effectReorder.onConfirm(orderedDeck.map((c) => c.id));
      setIsReorderMode(false);
      return;
    }
    onReorderDeck(
      side,
      orderedDeck.map((c) => c.id),
    );
    setIsReorderMode(false);
  };

  const handleCancelReorder = () => {
    if (effectReorder) {
      effectReorder.onCancel();
    }
    setIsReorderMode(false);
  };

  const handleDragEndReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedDeck((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleClose = () => {
    setSelectedIds([]);
    setSelectedKanji([]);
    setIsReorderMode(false);
    onClose();
  };

  const handleShuffleAndClose = () => {
    onShuffleDeck(side);
    handleClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0 }}>
            {label}の山札確認・操作 ({deck.length}枚)
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isReorderMode && !effectSelection && !effectReorder && (
              <button
                onClick={handleShuffleAndClose}
                style={{ cursor: 'pointer', padding: '4px 10px' }}
              >
                🔀 シャッフルして閉じる
              </button>
            )}
            <button onClick={handleClose} style={{ cursor: 'pointer' }}>
              閉じる
            </button>
          </div>
        </div>

        <MonsterSummary
          monsters={monsters}
          label={label}
          side={side}
          idPrefix='modal_draw_summary'
        />

        {effectKanjiSelect && effectKanjiSelect.revealScope !== 'full' && (
          <div
            style={{ fontSize: '0.8rem', color: '#6366f1', margin: '4px 0' }}
          >
            山札の上から{effectKanjiSelect.revealScope}枚を公開しています
          </div>
        )}

        {/* 山札カード一覧 */}
        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            margin: '16px 0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignContent: 'flex-start',
          }}
        >
          {deck.length === 0 ? (
            <p style={{ color: '#888' }}>山札にカードがありません。</p>
          ) : isReorderMode ? (
            // 【修正】D&Dによる並び替え表示
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndReorder}
            >
              <SortableContext
                items={orderedDeck.map((c) => c.id)}
                strategy={rectSortingStrategy}
              >
                {orderedDeck.map((card, index) => (
                  <SortableDeckCard key={card.id} card={card} order={index} />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            // 通常モードの描画。effectKanjiSelect時は漢字単位でのハイライトに切り替える
            displayedDeck.map((card) => {
              const isSelected = effectKanjiSelect
                ? selectedKanji.includes(card.kanji)
                : selectedIds.includes(card.id);
              const isSelectable =
                effectKanjiSelect ||
                !effectSelection?.kanjiFilter ||
                effectSelection.kanjiFilter.includes(card.kanji);
              // 【追加・忍】deck_mark_delayed_reduceで仕込まれたトラップの可視化
              const isTrapped = !!card.trapEffect;
              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (!isSelectable) return;
                    if (effectKanjiSelect) {
                      setSelectedKanji((prev) =>
                        prev.includes(card.kanji)
                          ? prev.filter((k) => k !== card.kanji)
                          : [...prev, card.kanji],
                      );
                    } else {
                      handleToggleCard(card.id);
                    }
                  }}
                  style={{
                    cursor: isSelectable ? 'pointer' : 'not-allowed',
                    opacity: isSelectable ? 1 : 0.35,
                    border: isSelected ? '3px solid #007bff' : '1px solid #ccc',
                    borderRadius: '6px',
                    padding: '4px',
                    backgroundColor: isSelected ? '#e6f0ff' : '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  {isTrapped && (
                    <span
                      title={`ドロー時に山札を${card.trapEffect?.reduceCount}枚失うトラップが仕込まれています`}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        zIndex: 1,
                      }}
                    >
                      !
                    </span>
                  )}
                  <DraggableMana mana={card} side={side} sourceZone='deck'>
                    <Card card={card} />
                  </DraggableMana>
                </div>
              );
            })
          )}
        </div>

        {/* 操作アクションエリア */}
        {isReorderMode ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '8px',
              backgroundColor: '#fff7ed',
              borderRadius: '4px',
              border: '1px solid #f59e0b',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
              カードをドラッグして好きな順番に並び替えてください。
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleConfirmReorder}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                この順番で確定
              </button>
              <button
                onClick={handleCancelReorder}
                style={{ padding: '6px 14px', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : effectKanjiSelect ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '8px',
              backgroundColor: '#eef2ff',
              borderRadius: '4px',
              border: '1px solid #6366f1',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
              漢字の種類を{effectKanjiSelect.kanjiCount}
              つ選択してください（現在: {selectedKanji.length}/
              {effectKanjiSelect.kanjiCount}）
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  effectKanjiSelect.onConfirm(selectedKanji);
                  setSelectedKanji([]);
                }}
                disabled={selectedKanji.length !== effectKanjiSelect.kanjiCount}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                選択した種類を墓地へ送る
              </button>
              <button
                onClick={() => {
                  effectKanjiSelect.onCancel();
                  setSelectedKanji([]);
                }}
                style={{ padding: '6px 14px', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : effectSelection ? (
          // 【追加】効果解決モード用パネル
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '8px',
              backgroundColor: '#eef2ff',
              borderRadius: '4px',
              border: '1px solid #6366f1',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
              {effectSelection.constraint.min === effectSelection.constraint.max
                ? `${effectSelection.constraint.max}枚選択してください`
                : `最大${effectSelection.constraint.max}枚まで選択できます`}
              （現在: {selectedIds.length}枚）
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  effectSelection.onConfirm(selectedIds);
                  setSelectedIds([]);
                }}
                disabled={
                  selectedIds.length < effectSelection.constraint.min ||
                  selectedIds.length > effectSelection.constraint.max
                }
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {effectSelection.actionLabel}
              </button>
              <button
                onClick={() => {
                  effectSelection.onCancel();
                  setSelectedIds([]);
                }}
                style={{ padding: '6px 14px', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '8px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
              選択中のカード: {selectedIds.length}枚
            </div>

            <MoveDestinationSelector
              currentSide={side}
              currentZone='deck'
              selectedCount={selectedIds.length}
              onExecute={(targetSide, targetZone) => {
                onMoveCards({
                  sourceSide: side,
                  targetSide,
                  cardIds: selectedIds,
                  sourceZone: 'deck',
                  targetZone,
                });
                setSelectedIds([]);
              }}
            />

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  borderLeft: '1px solid #ccc',
                  margin: '0 4px',
                  height: '24px',
                }}
              ></span>

              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  onClick={() => handleEquip(index)}
                  disabled={selectedIds.length !== 1}
                  style={{
                    padding: '6px 12px',
                    cursor:
                      selectedIds.length === 1 ? 'pointer' : 'not-allowed',
                  }}
                >
                  モンスター{index + 1}に装備
                </button>
              ))}

              <button
                onClick={handleStartReorder}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  border: '1px solid #f59e0b',
                  color: '#f59e0b',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                }}
              >
                並び替えモード
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
