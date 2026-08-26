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

interface DeckModalProps {
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
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 【変更】並び替えモード用の状態。クリックで順序を選ぶ方式から、
  // 現在の山札のスナップショットをD&Dで直接並び替える方式に変更したため、
  // reorderSequence(選んだ順序の部分配列)ではなく、常に「完全な並び」を保持する。
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [orderedDeck, setOrderedDeck] = useState<ManaCard[]>([]);

  // 【追加】並び替え専用センサー。バトル画面本体のD&Dとは独立している。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  );

  if (!isOpen) return null;

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
    onReorderDeck(
      side,
      orderedDeck.map((c) => c.id),
    );
    setIsReorderMode(false);
  };

  const handleCancelReorder = () => {
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
            {!isReorderMode && (
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
            // 通常モードの描画（従来通り）
            deck.map((card) => {
              const isSelected = selectedIds.includes(card.id);
              return (
                <div
                  key={card.id}
                  onClick={() => handleToggleCard(card.id)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '3px solid #007bff' : '1px solid #ccc',
                    borderRadius: '6px',
                    padding: '4px',
                    backgroundColor: isSelected ? '#e6f0ff' : '#fff',
                    boxSizing: 'border-box',
                  }}
                >
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
