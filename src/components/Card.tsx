// src/components/Card.tsx

import React from 'react';
import type { ManaCard, ManaColor } from '../types';

interface CardProps {
  card: ManaCard;
  size?: 'sm' | 'md';
}

// 色に応じた記号/文字の表示ヘルパー
const getManaSymbol = (color: ManaColor): string => {
  switch (color) {
    case 'red':
      return '火';
    case 'blue':
      return '水';
    case 'yellow':
      return '辛';
    case 'green':
      return '木';
    case 'white':
      return '口';
    case 'orange':
      return '手';
    case 'moon':
      return '月';
    case 'sun':
      return '日';
    default:
      return color;
  }
};

export const Card: React.FC<CardProps> = ({ card, size = 'md' }) => {
  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isSmall ? '2px 6px' : '4px 8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: isSmall ? '0.75rem' : '0.875rem',
        margin: '2px',
      }}
    >
      {getManaSymbol(card.color)}
    </span>
  );
};