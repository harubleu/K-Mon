import React, { useState } from 'react';
import type { PlayerSide, GamePhase } from '../types';

interface ActionAreaProps {
  turnPlayer: PlayerSide;
  turnCount: number;
  currentPhase: GamePhase;
  onNextPhase: () => void;
  onAutoDraw: (player: PlayerSide) => void;
  onDamage: (amount: number) => void;
}

export const ActionArea: React.FC<ActionAreaProps> = ({
  turnPlayer,
  turnCount,
  currentPhase,
  onNextPhase,
  onDamage,
}) => {
  const [damageAmount, setDamageAmount] = useState<number>(1);

  // フェーズの日本語表示用マッピング
  const phaseLabels: Record<GamePhase, string> = {
    start: 'スタートフェーズ',
    draw: 'ドローフェーズ',
    main: 'メインフェーズ',
    end: 'エンドフェーズ',
  };

  return (
    <div
      style={{
        padding: '12px',
        border: '1px solid #bbb',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
        margin: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* ターン情報表示エリア */}
      <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
        <span
          style={{ color: turnPlayer === 'player' ? '#2563eb' : '#dc2626' }}
        >
          {turnPlayer === 'player' ? '自分' : '相手'}のターン
        </span>
        <span style={{ margin: '0 12px' }}>|</span>
        <span>ターン {turnCount}</span>
        <span style={{ margin: '0 12px' }}>|</span>
        <span>{phaseLabels[currentPhase]}</span>
      </div>

      {/* アクションボタンエリア */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* フェーズ進行ボタン */}
        <button
          onClick={onNextPhase}
          style={{
            padding: '6px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {currentPhase === 'end' ? 'ターンを終了する' : '次のフェーズへ'}
        </button>

        {/* 手動アクションエリア (フェーズ1) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderLeft: '1px solid #ccc',
            paddingLeft: '16px',
          }}
        >
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
    </div>
  );
};
