// src/components/GameBoard/ZoneMoveSelectModal.tsx
//
// 然（select_zone_move_one）専用モーダル。
// 「相手の山札1番上」（常に0〜1枚）と「相手の墓地」（0枚以上）を合算候補として提示し、
// その中から1枚を選ばせる。App.tsx直下の単一インスタンスとして動作する
// (KanjiTypePickerModal等と同じ設計方針。特定のPlayerZoneに紐付かない)。

import React, { useState } from 'react';

export interface ZoneMoveCandidate {
  cardId: string;
  kanji: string;
  reading: string;
  sourceZone: 'deck' | 'cemetery';
}

interface ZoneMoveSelectModalProps {
  isOpen: boolean;
  candidates: ZoneMoveCandidate[];
  onConfirm: (selectedCardId: string) => void;
  onCancel: () => void;
}

export const ZoneMoveSelectModal: React.FC<ZoneMoveSelectModalProps> = ({
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

  const deckTopCandidates = candidates.filter((c) => c.sourceZone === 'deck');
  const graveyardCandidates = candidates.filter(
    (c) => c.sourceZone === 'cemetery',
  );

  const renderCandidateButton = (c: ZoneMoveCandidate) => (
    <button
      key={c.cardId}
      onClick={() => setSelectedId(c.cardId)}
      style={{
        padding: '10px 14px',
        borderRadius: '6px',
        border:
          selectedId === c.cardId ? '2px solid #1976d2' : '1px solid #ccc',
        backgroundColor: selectedId === c.cardId ? '#e3f2fd' : '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {c.kanji}（{c.reading}）
    </button>
  );

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
        <h2 style={{ marginTop: 0 }}>対象を1枚選択</h2>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          相手の山札1番上、または相手の墓地から1枚を選んで除外します。
        </p>

        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#555' }}>
            相手の山札の1番上
          </h3>
          {deckTopCandidates.length > 0 ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {deckTopCandidates.map(renderCandidateButton)}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#999' }}>
              （相手の山札が空のため候補なし）
            </p>
          )}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#555' }}>相手の墓地</h3>
          {graveyardCandidates.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {graveyardCandidates.map(renderCandidateButton)}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#999' }}>
              （相手の墓地が空のため候補なし）
            </p>
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
            onClick={onCancel}
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
            onClick={() => selectedId && onConfirm(selectedId)}
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
            この1枚を除外する
          </button>
        </div>
      </div>
    </div>
  );
};
