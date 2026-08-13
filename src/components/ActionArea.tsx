import React, { useState } from 'react';
import type { PlayerSide, GamePhase } from '../types';

interface ActionAreaProps {
  turnPlayer: PlayerSide;
  turnCount: number;
  currentPhase: GamePhase;
  onNextPhase: () => void;
  onDamage: (amount: number) => void;
  onRecover?: (side: PlayerSide, manaIds: string[]) => void;
  onJanken?: () => void;
  onDeckMill?: (side: PlayerSide, count: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void; // 追加
  canRedo?: boolean; // 追加
}

export const ActionArea: React.FC<ActionAreaProps> = ({
  turnPlayer,
  turnCount,
  currentPhase,
  onNextPhase,
  onDamage,
  onJanken,
  onDeckMill,
  onUndo,
  canUndo,
  onRedo, // 追加
  canRedo, // 追加
}) => {
  const [damageAmount, setDamageAmount] = useState<number>(1);
  const [millCount, setMillCount] = useState<number>(1); // 山札削り枚数
  const [millTarget, setMillTarget] = useState<PlayerSide>('opponent'); // 山札削り対象

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
        {/* 修正: Undo / Redo ボタンをまとめたエリア */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              style={{
                padding: '6px 12px',
                backgroundColor: canUndo ? '#6b7280' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              ↩ 1手戻す
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              style={{
                padding: '6px 12px',
                backgroundColor: canRedo ? '#6b7280' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: canRedo ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              やり直す ↪
            </button>
          )}
        </div>
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

        {/* 追加: メインフェーズ用のじゃんけん呼び出しボタン */}
        {currentPhase === 'main' && onJanken && (
          <button
            onClick={onJanken}
            style={{
              padding: '6px 16px',
              backgroundColor: '#9333ea', // 紫色のボタン
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

        {/* 追加: 汎用山札操作ツール（メインフェーズのみ表示） */}
        {currentPhase === 'main' && onDeckMill && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
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
            <span style={{ fontSize: '0.85rem' }}>枚墓地へ</span>
            <button
              onClick={() => onDeckMill(millTarget, millCount)}
              style={{
                padding: '4px 12px',
                fontSize: '0.85rem',
                backgroundColor: '#059669', // 緑系のボタンで区別
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
