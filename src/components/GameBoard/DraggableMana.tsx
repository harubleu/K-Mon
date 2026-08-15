// src/components/GameBoard/DraggableMana.tsx

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { ManaCard, PlayerSide, ZoneType } from '../../types';

interface DraggableManaProps {
  mana: ManaCard;
  side: PlayerSide;
  sourceZone: ZoneType;
  children?: React.ReactNode;
}

export const DraggableMana: React.FC<DraggableManaProps> = ({
  mana,
  side,
  sourceZone,
  children,
}) => {
  const draggableId = `${sourceZone}_${side}_${mana.id}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    data: {
      manaCardId: mana.id,
      side,
      sourceZone,
      mana,
    },
  });

  const style: React.CSSProperties = {
    // 自身は移動せず、元の位置にプレースホルダーとして薄く残す
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none', // モバイルブラウザ等でのスクロール競合防止
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className='draggable-mana-item'
    >
      {children || (
        <div
          className='mana-card'
          style={{ backgroundColor: mana.hexColor || '#ccc' }}
        >
          <span>{mana.kanji}</span>
        </div>
      )}
    </div>
  );
};
