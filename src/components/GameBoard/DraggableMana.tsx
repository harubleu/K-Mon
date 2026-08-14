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

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: draggableId,
      data: {
        manaCardId: mana.id,
        side,
        sourceZone,
      },
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    zIndex: isDragging ? 1000 : 'auto',
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
