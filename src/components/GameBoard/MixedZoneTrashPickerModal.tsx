// src/components/GameBoard/MixedZoneTrashPickerModal.tsx
//
// フェーズ5: mixed_zone_select_trash(斧)用。装備マナ＋山札の混在候補から
// ちょうどN枚選ばせる。KanjiTypePickerModalと同じく単一インスタンスで動作する。

import React, { useState } from 'react';
import type { ManaCard } from '../../types';
import { Card } from '../Card';

interface MixedZoneTrashPickerModalProps {
  isOpen: boolean;
  deckCards?: ManaCard[];
  equippedManaCandidates?: { card: ManaCard; monsterLabel: string }[];
  constraint: { min: number; max: number };
  onConfirm: (selectedCardIds: string[]) => void;
  onCancel: () => void;
}

export const MixedZoneTrashPickerModal: React.FC<
  MixedZoneTrashPickerModalProps
> = ({
  isOpen,
  deckCards = [],
  equippedManaCandidates = [],
  constraint,
  onConfirm,
  onCancel,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    setSelectedIds([]);
  };

  const handleCancel = () => {
    setSelectedIds([]);
    onCancel();
  };

  const renderCard = (id: string, card: ManaCard, label?: string) => {
    const isSelected = selectedIds.includes(id);
    return (
      <div
        key={id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <div
          onClick={() => toggle(id)}
          style={{
            cursor: 'pointer',
            border: isSelected ? '3px solid #007bff' : '1px solid #ccc',
            borderRadius: '6px',
            padding: '4px',
            backgroundColor: isSelected ? '#e6f0ff' : '#fff',
          }}
        >
          <Card card={card} />
        </div>
        {label && (
          <span style={{ fontSize: '0.7rem', color: '#666' }}>{label}</span>
        )}
      </div>
    );
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
          overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0' }}>
          {constraint.min === constraint.max
            ? `${constraint.max}枚`
            : `最大${constraint.max}枚`}
          選択してください （現在: {selectedIds.length}枚）
        </h3>

        {equippedManaCandidates.length > 0 && (
          <>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 'bold',
                margin: '8px 0 4px',
              }}
            >
              装備中のマナ
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {equippedManaCandidates.map((c) =>
                renderCard(c.card.id, c.card, c.monsterLabel),
              )}
            </div>
          </>
        )}

        {deckCards.length > 0 && (
          <>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 'bold',
                margin: '16px 0 4px',
              }}
            >
              山札
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {deckCards.map((c) => renderCard(c.id, c))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleConfirm}
            disabled={
              selectedIds.length < constraint.min ||
              selectedIds.length > constraint.max
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
            選択したカードを送る
          </button>
          <button
            onClick={handleCancel}
            style={{ padding: '6px 14px', cursor: 'pointer' }}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
