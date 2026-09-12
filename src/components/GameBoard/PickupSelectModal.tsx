// src/components/GameBoard/PickupSelectModal.tsx
//
// フェーズ5: 拾（own_mana_trashed_by_opponent_reaction）用。
// 相手の効果で墓地送りになった自分のマナカード（実体）の中から1枚選ばせ、
// 事前に選択済みの装備先モンスターへ装備する。KanjiTypePickerModal等と同じく
// App.tsx直下の単一インスタンスで、特定のPlayerZoneに紐付かない。
//
// 候補はCemeteryAndExileModal等と同様、Cardコンポーネントを並べてクリック選択させる形式。

import React, { useState } from 'react';
import type { ManaCard } from '../../types';
import { Card } from '../Card';

interface PickupSelectModalProps {
  isOpen: boolean;
  candidates: { id: string; kanji: string; reading: string }[];
  onConfirm: (selectedCardId: string) => void;
  onCancel: () => void;
}

export const PickupSelectModal: React.FC<PickupSelectModalProps> = ({
  isOpen,
  candidates,
  onConfirm,
  onCancel,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) setSelectedId(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
    setSelectedId(null);
  };

  const handleCancel = () => {
    setSelectedId(null);
    onCancel();
  };

  // Cardコンポーネントはid付きのManaCardを要求するため、最小限のダミーフィールドを補う
  const toDisplayCard = (c: {
    id: string;
    kanji: string;
    reading: string;
  }): ManaCard => ({
    id: c.id,
    kanji: c.kanji,
    reading: c.reading,
    hexColor: '#888888',
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '480px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>拾の発動：装備するマナを選択</h2>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          相手の効果で墓地へ送られたマナカードの中から1枚選び、装備します。
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          {candidates.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.85rem' }}>
              候補がありません。
            </p>
          ) : (
            candidates.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  cursor: 'pointer',
                  border:
                    selectedId === c.id
                      ? '3px solid #007bff'
                      : '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '4px',
                  backgroundColor: selectedId === c.id ? '#e6f0ff' : '#fff',
                }}
              >
                <Card card={toDisplayCard(c)} />
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#eee',
              color: '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedId ? '#1976d2' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedId ? 'pointer' : 'not-allowed',
            }}
          >
            このマナを装備する
          </button>
        </div>
      </div>
    </div>
  );
};
