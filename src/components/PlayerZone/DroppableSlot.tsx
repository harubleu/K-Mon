// src/components/PlayerZone/DroppableSlot.tsx

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { PlayerSide } from '../../types';

interface DroppableSlotProps {
  side: PlayerSide;
  monsterIndex: number;
  slotIndex: number;
  slotName: string;
  disabled?: boolean; // モーダル表示中などに無効化するためのプロパティ
  idPrefix?: string;
  children?: React.ReactNode;
}

export const DroppableSlot: React.FC<DroppableSlotProps> = ({
  side,
  monsterIndex,
  slotIndex,
  slotName,
  disabled = false,
  idPrefix = 'slot', // ← デフォルト設定
  children,
}) => {
  const droppableId = `${idPrefix}_${side}_${monsterIndex}_${slotIndex}`;

  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: {
      side,
      monsterIndex,
      slotIndex,
      disabled, // ドロップ可能かどうかの情報を渡す
    },
    disabled,
  });

  const highlightStyle: React.CSSProperties = {
    border: isOver ? '3px solid #4CAF50' : '3px solid transparent',
    backgroundColor: isOver ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
    transition: 'all 0.2s ease',
    borderRadius: '8px',
    height: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      ref={setNodeRef}
      style={highlightStyle}
      className='droppable-slot-target'
    >
      <span className='slot-label'>{slotName}</span>
      {children}
    </div>
  );
};
