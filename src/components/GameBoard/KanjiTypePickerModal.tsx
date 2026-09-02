// src/components/GameBoard/KanjiTypePickerModal.tsx
//
// フェーズ5: deck_kanji_purge(械・泣)用。山札を公開せず、全漢字種類から選ばせる軽量モーダル。
// 特定の山札を表示する必要が無いため、DeckModalとは独立して動作する。

import React, { useState } from 'react';
import { MANA_MASTER_LIST } from '../../data/masterData';
import { Card } from '../Card';

interface KanjiTypePickerModalProps {
  isOpen: boolean;
  kanjiCount: number;
  onConfirm: (selectedKanji: string[]) => void;
  onCancel: () => void;
}

export const KanjiTypePickerModal: React.FC<KanjiTypePickerModalProps> = ({
  isOpen,
  kanjiCount,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleToggle = (kanji: string) => {
    setSelected((prev) =>
      prev.includes(kanji) ? prev.filter((k) => k !== kanji) : [...prev, kanji],
    );
  };

  const handleConfirm = () => {
    onConfirm(selected);
    setSelected([]);
  };

  const handleCancel = () => {
    setSelected([]);
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
          maxWidth: '600px',
          width: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ margin: 0 }}>
          漢字の種類を{kanjiCount}つ選択してください（現在: {selected.length}/
          {kanjiCount}）
        </h3>

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
          {MANA_MASTER_LIST.map((mana) => {
            const isSelected = selected.includes(mana.kanji);
            return (
              <div
                key={mana.kanji}
                onClick={() => handleToggle(mana.kanji)}
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '3px solid #007bff' : '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '4px',
                  backgroundColor: isSelected ? '#e6f0ff' : '#fff',
                  boxSizing: 'border-box',
                }}
              >
                {/* Cardはid付きのManaCardを要求するため、kanjiをidとして代用する（MANA_MASTER_LIST内で一意） */}
                <Card
                  card={{
                    id: mana.kanji,
                    hexColor: mana.hexColor,
                    kanji: mana.kanji,
                    reading: mana.reading,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleConfirm}
            disabled={selected.length !== kanjiCount}
            style={{
              padding: '6px 14px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor:
                selected.length === kanjiCount ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
            }}
          >
            選択した種類を墓地へ送る
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
