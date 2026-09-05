// src/components/GameBoard/MonsterSelectModal.tsx
//
// フェーズ5: flip_monster_facedown(反)用。対象側のモンスターから選ばせる軽量モーダル。

import React, { useState } from 'react';
import type { MonsterCard } from '../../types';

interface MonsterSelectModalProps {
  isOpen: boolean;
  monsters: MonsterCard[];
  constraint: { min: number; max: number };
  // 【追加】生・方の「このカードにはつけられない」用。このindexのモンスターは選択不可にする
  excludeMonsterIndex?: number;
  onConfirm: (selectedMonsterIndexes: number[]) => void;
  onCancel: () => void;
}

export const MonsterSelectModal: React.FC<MonsterSelectModalProps> = ({
  isOpen,
  monsters,
  constraint,
  excludeMonsterIndex,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState<number[]>([]);

  if (!isOpen) return null;

  const toggle = (index: number) => {
    if (index === excludeMonsterIndex) return;
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
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
          maxWidth: '500px',
          width: '90%',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0' }}>
          {constraint.min === constraint.max
            ? `モンスターを${constraint.max}体選択してください`
            : `モンスターを最大${constraint.max}体選択してください`}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {monsters.map((monster, index) => {
            const isSelected = selected.includes(index);
            const isExcluded = index === excludeMonsterIndex;
            return (
              <button
                key={monster.id}
                onClick={() => toggle(index)}
                disabled={isExcluded}
                style={{
                  padding: '10px',
                  cursor: isExcluded ? 'not-allowed' : 'pointer',
                  border: isSelected ? '3px solid #007bff' : '1px solid #ccc',
                  borderRadius: '6px',
                  backgroundColor: isExcluded
                    ? '#f0f0f0'
                    : isSelected
                      ? '#e6f0ff'
                      : '#fff',
                  opacity: isExcluded ? 0.5 : 1,
                  textAlign: 'left',
                }}
              >
                {monster.name || `モンスター${index + 1}`}
                {monster.isFlipped && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#888',
                      marginLeft: '8px',
                    }}
                  >
                    (すでに裏面)
                  </span>
                )}
                {isExcluded && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#c00',
                      marginLeft: '8px',
                    }}
                  >
                    (このカードにはつけられない)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleConfirm}
            disabled={
              selected.length < constraint.min ||
              selected.length > constraint.max
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
