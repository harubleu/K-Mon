// src/components/GameBoard/DeckIterativeSelectModal.tsx
//
// 方(deck_iterative_select_trash)専用。山札の上から1枚ずつ公開し、その都度
// 「この1枚を送って終わりにする」か「この1枚を送ってもう1枚めくる」かを選ばせる。
// App.tsx直下の単一インスタンスとして動作する(KanjiTypePickerModal等と同じ設計方針)。
// 一度発動すると必ず1枚以上を送る前提のため、キャンセルボタンは設けていない。

import React from 'react';
import type { ManaCard } from '../../types';
import { Card } from '../Card';

interface DeckIterativeSelectModalProps {
  isOpen: boolean;
  card: ManaCard | null;
  sentCount: number;
  maxCount: number;
  canContinue: boolean;
  onDecision: (action: 'stop' | 'continue') => void;
}

export const DeckIterativeSelectModal: React.FC<
  DeckIterativeSelectModalProps
> = ({ isOpen, card, sentCount, maxCount, canContinue, onDecision }) => {
  if (!isOpen || !card) return null;

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
          maxWidth: '420px',
          width: '90%',
          textAlign: 'center',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0' }}>
          山札の上から{sentCount + 1}枚目（最大{maxCount}枚まで）
        </h3>
        <div style={{ margin: '16px 0' }}>
          <Card card={card} />
        </div>
        <p style={{ fontSize: '0.85rem', color: '#666' }}>
          このカードは墓地へ送られます。続けてもう1枚めくりますか？
        </p>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginTop: '16px',
          }}
        >
          <button
            onClick={() => onDecision('stop')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            送って終わりにする
          </button>
          <button
            onClick={() => onDecision('continue')}
            disabled={!canContinue}
            style={{
              padding: '8px 16px',
              backgroundColor: canContinue ? '#f59e0b' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: canContinue ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
            }}
          >
            送ってもう1枚めくる
          </button>
        </div>
      </div>
    </div>
  );
};
