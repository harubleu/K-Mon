// src/components/MonsterSummary.tsx

import React from 'react';
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
        {monsters.map((monster, index) => (
          <div
            key={monster.id || index}
            style={{
              flex: 1,
            }}
          >
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
              {/* モンスター名と面状態 */}
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                }}
              >
                {monster.name} {monster.isFlipped ? '(裏面)' : ''}
              </div>

              {/* スロット情報のテキスト表示 */}
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

              {/* 共通コンポーネントを使用した画像とマナの重ね合わせ */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '130px',
                  marginBottom: '8px',
                }}
              >
                <MonsterWithMana
                  monster={monster}
                  side={side}
                  monsterIndex={index}
                  isDroppable={true}
                  idPrefix={idPrefix}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
