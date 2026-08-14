import React, { useState } from 'react';
import type { PlayerSide, ZoneType } from '../types';

interface ActionAreaProps {
  turnPlayer: PlayerSide;
  turnCount: number;
  onSwitchTurn: () => void;
  onDraw: (side: PlayerSide) => void;
  onJanken?: () => void;
  onDeckMill?: (side: PlayerSide, count: number, destination: ZoneType) => void;
}

export const ActionArea: React.FC<ActionAreaProps> = ({
  turnPlayer,
  turnCount,
  onSwitchTurn,
  onDraw,
  onJanken,
  onDeckMill,
}) => {
  const [millCount, setMillCount] = useState<number>(1);
  const [millTarget, setMillTarget] = useState<PlayerSide>('opponent');
  const [millDestination, setMillDestination] = useState<ZoneType>('cemetery');

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
        {/* ターン切り替えボタン */}
        <button
          onClick={onSwitchTurn}
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
          ターンを終了（交代）
        </button>

        {/* 山札1枚ドローボタン */}
        <button
          onClick={() => onDraw(turnPlayer)}
          style={{
            padding: '6px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          🎴 山札1枚ドロー ({turnPlayer === 'player' ? '自分' : '相手'})
        </button>

        {/* じゃんけん呼び出しボタン */}
        {onJanken && (
          <button
            onClick={onJanken}
            style={{
              padding: '6px 16px',
              backgroundColor: '#9333ea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            じゃんけんをする
          </button>
        )}

        {/* 汎用山札操作ツール（墓地 / 除外 の選択対応） */}
        {onDeckMill && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderLeft: '1px solid #ccc',
              paddingLeft: '16px',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
              汎用効果:
            </span>
            <select
              value={millTarget}
              onChange={(e) => setMillTarget(e.target.value as PlayerSide)}
              style={{ padding: '4px', fontSize: '0.85rem' }}
            >
              <option value='opponent'>相手の山札</option>
              <option value='player'>自分の山札</option>
            </select>
            <span style={{ fontSize: '0.85rem' }}>上から</span>
            <input
              type='number'
              min='1'
              value={millCount}
              onChange={(e) =>
                setMillCount(Math.max(1, parseInt(e.target.value) || 1))
              }
              style={{ width: '45px', padding: '4px', textAlign: 'center' }}
            />
            <span style={{ fontSize: '0.85rem' }}>枚を</span>
            <select
              value={millDestination}
              onChange={(e) => setMillDestination(e.target.value as ZoneType)}
              style={{ padding: '4px', fontSize: '0.85rem' }}
            >
              <option value='cemetery'>墓地へ</option>
              <option value='exile'>除外</option>
            </select>
            <button
              onClick={() => onDeckMill(millTarget, millCount, millDestination)}
              style={{
                padding: '4px 12px',
                fontSize: '0.85rem',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              実行
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
