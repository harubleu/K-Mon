// src/components/GameBoard/NumberPickerModal.tsx
//
// フェーズ5: choose_number_reduce/choose_number_reduce_both(刃・屍・死・葬)用。
// minNumber〜maxNumberの範囲で数値を1つ選ばせる軽量モーダル。

import React, { useState } from 'react';

interface NumberPickerModalProps {
  isOpen: boolean;
  minNumber: number;
  maxNumber: number;
  onConfirm: (selectedNumber: number) => void;
  onCancel: () => void;
}

export const NumberPickerModal: React.FC<NumberPickerModalProps> = ({
  isOpen,
  minNumber,
  maxNumber,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selected === null) return;
    onConfirm(selected);
    setSelected(null);
  };

  const handleCancel = () => {
    setSelected(null);
    onCancel();
  };

  const numbers = Array.from(
    { length: maxNumber - minNumber + 1 },
    (_, i) => minNumber + i,
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
          maxWidth: '500px',
          width: '90%',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0' }}>
          {minNumber}〜{maxNumber}の数字を選んでください
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {numbers.map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              style={{
                width: '44px',
                height: '44px',
                cursor: 'pointer',
                border: selected === n ? '3px solid #007bff' : '1px solid #ccc',
                borderRadius: '6px',
                backgroundColor: selected === n ? '#e6f0ff' : '#fff',
                fontWeight: 'bold',
              }}
            >
              {n}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleConfirm}
            disabled={selected === null}
            style={{
              padding: '6px 14px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selected !== null ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
            }}
          >
            決定
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
