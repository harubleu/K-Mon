// src/components/GameBoard/SortableDeckCard.tsx

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ManaCard } from '../../types';
import { Card } from '../Card';

interface SortableDeckCardProps {
  card: ManaCard;
  order: number; // 0-indexed
}

export const SortableDeckCard: React.FC<SortableDeckCardProps> = ({
  card,
  order,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    cursor: 'grab',
    touchAction: 'none',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    padding: '4px',
    backgroundColor: '#fff7ed',
    boxSizing: 'border-box',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card card={card} />
      {/* 【追加・忍】deck_mark_delayed_reduceで仕込まれたトラップの可視化。
          並び順バッジ(右上)と衝突しないよう左上に配置 */}
      {card.trapEffect && (
        <span
          title={`ドロー時に山札を${card.trapEffect.reduceCount}枚失うトラップが仕込まれています`}
          style={{
            position: 'absolute',
            top: '-8px',
            left: '-8px',
            backgroundColor: '#dc2626',
            color: '#fff',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          !
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          backgroundColor: '#f59e0b',
          color: '#fff',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {order + 1}
      </span>
    </div>
  );
};
