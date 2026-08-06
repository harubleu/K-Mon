// src/components/ActionArea.tsx

import React, { useState } from 'react';

interface ActionAreaProps {
  onDamage: (amount: number) => void;
}

export const ActionArea: React.FC<ActionAreaProps> = ({ onDamage }) => {
  const [damageAmount, setDamageAmount] = useState<number>(1);

  return (
    <div
      style={{
        padding: '12px',
        border: '1px solid #bbb',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
        margin: '8px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: '16px',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#555' }}>
        手動アクションエリア (フェーズ1)
      </div>

      {/* ダメージアクション */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.85rem' }}>相手にダメージ:</span>
        <input
          type='number'
          min='1'
          value={damageAmount}
          onChange={(e) =>
            setDamageAmount(Math.max(1, parseInt(e.target.value) || 1))
          }
          style={{ width: '50px', padding: '4px', textAlign: 'center' }}
        />
        <span style={{ fontSize: '0.85rem' }}>枚</span>
        <button
          onClick={() => onDamage(damageAmount)}
          style={{
            padding: '4px 12px',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          実行
        </button>
      </div>
    </div>
  );
};
