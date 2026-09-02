// src/components/GameBoard/EquipSwapPickerModal.tsx
//
// フェーズ5: swap_equipped_with_graveyard(代)用。案A(1組のみ)の実装。
// 装備マナ(全モンスター横断)と墓地カードを1画面に並べ、それぞれ1枚ずつ選ばせる。
// KanjiTypePickerModalと同じく特定のPlayerZoneに紐付かず単一インスタンスで動作する。

import React, { useState } from 'react';
import type { ManaCard } from '../../types';
import { Card } from '../Card';

interface EquipManaCandidate {
  card: ManaCard;
  monsterLabel: string;
}

interface EquipSwapPickerModalProps {
  isOpen: boolean;
  equippedManaCandidates: EquipManaCandidate[];
  graveyardCards: ManaCard[];
  onConfirm: (equippedManaId: string, graveyardCardId: string) => void;
  onCancel: () => void;
}

export const EquipSwapPickerModal: React.FC<EquipSwapPickerModalProps> = ({
  isOpen,
  equippedManaCandidates,
  graveyardCards,
  onConfirm,
  onCancel,
}) => {
  const [selectedManaId, setSelectedManaId] = useState<string | null>(null);
  const [selectedGraveId, setSelectedGraveId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedManaId || !selectedGraveId) return;
    onConfirm(selectedManaId, selectedGraveId);
    setSelectedManaId(null);
    setSelectedGraveId(null);
  };

  const handleCancel = () => {
    setSelectedManaId(null);
    setSelectedGraveId(null);
    onCancel();
  };

  const renderList = (
    items: { id: string; card: ManaCard; label?: string }[],
    selectedId: string | null,
    onSelect: (id: string) => void,
  ) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {items.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.85rem' }}>候補がありません。</p>
      ) : (
        items.map(({ id, card, label }) => (
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
              onClick={() => onSelect(id)}
              style={{
                cursor: 'pointer',
                border:
                  selectedId === id ? '3px solid #007bff' : '1px solid #ccc',
                borderRadius: '6px',
                padding: '4px',
                backgroundColor: selectedId === id ? '#e6f0ff' : '#fff',
              }}
            >
              <Card card={card} />
            </div>
            {label && (
              <span style={{ fontSize: '0.7rem', color: '#666' }}>{label}</span>
            )}
          </div>
        ))
      )}
    </div>
  );

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
          装備マナと墓地のカードを1枚ずつ選んで入れ替えてください
        </h3>

        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            margin: '8px 0 4px',
          }}
        >
          ① 装備中のマナ
        </div>
        {renderList(
          equippedManaCandidates.map((c) => ({
            id: c.card.id,
            card: c.card,
            label: c.monsterLabel,
          })),
          selectedManaId,
          setSelectedManaId,
        )}

        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            margin: '16px 0 4px',
          }}
        >
          ② 墓地のカード
        </div>
        {renderList(
          graveyardCards.map((c) => ({ id: c.id, card: c })),
          selectedGraveId,
          setSelectedGraveId,
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleConfirm}
            disabled={!selectedManaId || !selectedGraveId}
            style={{
              padding: '6px 14px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor:
                selectedManaId && selectedGraveId ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
            }}
          >
            入れ替える
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
