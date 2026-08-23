// src/components/MonsterSummary.tsx

import React, { useState } from 'react';
import type { MonsterCard, PlayerSide } from '../types';
import { MonsterWithMana } from './MonsterWithMana';

interface MonsterSummaryProps {
  monsters: MonsterCard[];
  label: string;
  side: PlayerSide;
  idPrefix?: string;
}

export const MonsterSummary: React.FC<MonsterSummaryProps> = ({
  monsters,
  label,
  side,
  idPrefix = 'modal_summary',
}) => {
  // モーダル内だけのプレビュー用反転状態（実ゲーム状態には影響しない）
  const [previewFlipped, setPreviewFlipped] = useState<Record<string, boolean>>(
    {},
  );

  const toggleFlip = (monsterId: string) => {
    setPreviewFlipped((prev) => ({ ...prev, [monsterId]: !prev[monsterId] }));
  };

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f0f4f8',
        borderRadius: '6px',
      }}
    >
      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 'bold',
          marginBottom: '12px',
        }}
      >
        {label}の盤面状況（モンスター＆装備マナ）
      </div>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
        }}
      >
        {monsters.map((monster, index) => {
          // プレビュー上書きがあればそちらを優先、なければ実際の状態
          const isFlippedForPreview =
            previewFlipped[monster.id] ?? monster.isFlipped;
          const displayMonster = { ...monster, isFlipped: isFlippedForPreview };

          return (
            <div key={monster.id || index} style={{ flex: 1 }}>
              <div
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '8px',
                  backgroundColor: '#fff',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  {monster.name} {isFlippedForPreview ? '(裏面)' : ''}
                </div>

                <div
                  style={{
                    color: '#555',
                    fontSize: '0.7rem',
                    marginBottom: '8px',
                    textAlign: 'center',
                  }}
                >
                  スロット:{' '}
                  {monster.slots.length > 0 ? monster.slots.join(', ') : 'なし'}
                </div>

                <div
                  style={{
                    width: '100%',
                    maxWidth: '130px',
                    marginBottom: '8px',
                  }}
                >
                  <MonsterWithMana
                    monster={displayMonster}
                    side={side}
                    monsterIndex={index}
                    isDroppable={true}
                    idPrefix={idPrefix}
                  />
                </div>

                {/* 表裏切替ボタン */}
                <button
                  onClick={() => toggleFlip(monster.id)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 10px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                  }}
                >
                  表裏切替
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
