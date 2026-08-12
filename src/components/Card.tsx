// src/components/Card.tsx

import React from 'react';
import type { ManaCard } from '../types';

interface CardProps {
  card: ManaCard;
  size?: 'sm' | 'md';
}

// 色に応じた記号/文字の表示ヘルパー
export const Card: React.FC<CardProps> = ({ card, size = 'md' }) => {
  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isSmall ? '2px 6px' : '4px 8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: isSmall ? '0.75rem' : '0.875rem',
        margin: '2px',
        backgroundColor: card.hexColor, // マスターデータの色を反映
        color: '#fff', // 文字色は白をベース
        textShadow: '1px 1px 2px #000', // 白など明るい背景色でも文字が見えるように影をつける
        minWidth: isSmall ? '20px' : '28px',
      }}
      title={card.reading} // マウスホバーで読みガナを表示
    >
      {card.kanji}
    </span>
  );
};
