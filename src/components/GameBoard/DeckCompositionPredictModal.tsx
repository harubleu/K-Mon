// src/components/GameBoard/DeckCompositionPredictModal.tsx
//
// フェーズ5: 究(deck_predict_full_composition_win)用。相手の山札のマナの種類と数を
// すべて申告させる新規モーダル。App.tsx直下の単一インスタンスとして動作する
// (KanjiTypePickerModal等と同じ設計方針。特定のPlayerZoneに紐付かない)。
//
// 山札の中身は非公開のまま(械等と同様、内訳は一切表示しない)。参考情報として
// 相手の山札の「合計枚数」のみ表示し、申告側の合計と見比べられるようにする。

import React, { useState } from 'react';
import { MANA_MASTER_LIST } from '../../data/masterData';

interface DeckCompositionPredictModalProps {
  isOpen: boolean;
  opponentDeckCount: number;
  onConfirm: (composition: Record<string, number>) => void;
  onCancel: () => void;
}

export const DeckCompositionPredictModal: React.FC<
  DeckCompositionPredictModalProps
> = ({ isOpen, opponentDeckCount, onConfirm, onCancel }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const updateCount = (kanji: string, delta: number) => {
    setCounts((prev) => {
      const next = Math.max(0, (prev[kanji] ?? 0) + delta);
      return { ...prev, [kanji]: next };
    });
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const handleConfirm = () => {
    onConfirm(counts);
    setCounts({});
  };

  const handleCancel = () => {
    setCounts({});
    onCancel();
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
        <h3 style={{ margin: '0 0 8px 0' }}>
          相手の山札の構成をすべて予想してください
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 12px 0' }}>
          相手の山札は現在{opponentDeckCount}
          枚です。マナの種類ごとに枚数を指定し、
          実際の構成と完全に一致すれば勝利します（申告した合計: {total}枚）。
        </p>

        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {MANA_MASTER_LIST.map((mana) => {
            const count = counts[mana.kanji] || 0;
            return (
              <div
                key={mana.kanji}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #eee',
                  backgroundColor: count > 0 ? '#e3f2fd' : '#fff',
                }}
              >
                <span
                  style={{
                    backgroundColor: mana.hexColor,
                    color: '#fff',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    textShadow: '1px 1px 2px #000',
                    fontWeight: 'bold',
                  }}
                >
                  {mana.kanji}{' '}
                  <span style={{ fontSize: '0.75rem' }}>({mana.reading})</span>
                </span>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <button
                    onClick={() => updateCount(mana.kanji, -1)}
                    disabled={count === 0}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      cursor: count === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    -
                  </button>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '20px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {count}
                  </span>
                  <button
                    onClick={() => updateCount(mana.kanji, 1)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleConfirm}
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
            この構成で予想を確定する
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
