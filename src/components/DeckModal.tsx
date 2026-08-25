// src/components/DeckModal.tsx

import React, { useState } from 'react';
import type { ManaCard, MonsterCard, PlayerSide, ZoneType } from '../types';
import { Card } from './Card';
import { MonsterSummary } from './MonsterSummary';
import { DraggableMana } from './GameBoard/DraggableMana';
import { MoveDestinationSelector } from './MoveDestinationSelector';

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
  onShuffleDeck: (side: PlayerSide) => void; // 【追加】
  onReorderDeck: (side: PlayerSide, orderedCardIds: string[]) => void; // 【追加】
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

  // 【追加】並び替えモード用の状態
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderSequence, setReorderSequence] = useState<string[]>([]);

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

  // 【追加】並び替えモード関連ハンドラー
  const handleToggleReorder = (cardId: string) => {
    setReorderSequence((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  };

  const handleStartReorder = () => {
    setSelectedIds([]); // 通常モードの選択はクリアしておく
    setIsReorderMode(true);
  };

  const handleConfirmReorder = () => {
    if (reorderSequence.length > 0) {
      onReorderDeck(side, reorderSequence);
    }
    setReorderSequence([]);
    setIsReorderMode(false);
  };

  const handleCancelReorder = () => {
    setReorderSequence([]);
    setIsReorderMode(false);
  };

  const handleClose = () => {
    setSelectedIds([]);
    setReorderSequence([]);
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
            {/* 【追加】シャッフルして閉じる（並び替え中は誤操作防止のため非表示） */}
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
          ) : (
            deck.map((card) => {
              // 【追加】並び替えモード時のカード描画
              if (isReorderMode) {
                const orderIndex = reorderSequence.indexOf(card.id);
                const isPicked = orderIndex !== -1;
                return (
                  <div
                    key={card.id}
                    onClick={() => handleToggleReorder(card.id)}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: isPicked ? '3px solid #f59e0b' : '1px solid #ccc',
                      borderRadius: '6px',
                      padding: '4px',
                      backgroundColor: isPicked ? '#fff7ed' : '#fff',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Card card={card} />
                    {isPicked && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          backgroundColor: '#f59e0b',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {orderIndex + 1}
                      </span>
                    )}
                  </div>
                );
              }

              // 通常モードの描画（従来通り）
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
          // 【追加】並び替えモード用の操作パネル
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
              先頭に持ってきたい順にカードをクリックしてください（
              {reorderSequence.length}枚選択中）。
              クリックしなかったカードは、元の順序のままその後ろに続きます。
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleConfirmReorder}
                disabled={reorderSequence.length === 0}
                style={{
                  padding: '6px 14px',
                  backgroundColor:
                    reorderSequence.length === 0 ? '#ccc' : '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor:
                    reorderSequence.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                この順番で確定
              </button>
              <button
                onClick={() => setReorderSequence([])}
                style={{ padding: '6px 14px', cursor: 'pointer' }}
              >
                クリア
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

            {/* 【修正】従来の「墓地へ送る」「除外する」ボタンを汎用セレクターに置き換え */}
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

              {/* 【追加】並び替えモードへの入り口 */}
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
