// src/components/PlayerZone/DroppableSlot.tsx

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { PlayerSide } from '../../types';

interface DroppableSlotProps {
  id?: string; // 外部からの明示的なID指定
  side?: PlayerSide;
  monsterIndex?: number;
  slotIndex?: number;
  slotName?: string;
  disabled?: boolean; // モーダル表示中などに無効化するためのプロパティ
  idPrefix?: string;
  positionClass?: string; // 配置用のCSSクラスを受け取る
  style?: React.CSSProperties; // 外部からのインラインスタイル指定
  children?: React.ReactNode;
  hideIdleBorder?: boolean; // 通常時は枠線・背景を消し、ドラッグオーバー時だけ表示する
}

export const DroppableSlot: React.FC<DroppableSlotProps> = ({
  id,
  side,
  monsterIndex,
  slotIndex,
  slotName = '',
  disabled = false,
  idPrefix = 'slot', // ← デフォルト設定
  positionClass = '',
  style,
  children,
  hideIdleBorder = false,
}) => {
  const droppableId = id || `${idPrefix}_${side}_${monsterIndex}_${slotIndex}`;

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
    ...style,
    border: children
      ? 'none'
      : isOver && !disabled
        ? '3px solid rgba(255, 215, 0, 1)'
        : hideIdleBorder
          ? 'none'
          : '2px dashed rgba(255, 255, 255, 0.5)',
    backgroundColor:
      isOver && !disabled ? 'rgba(255, 215, 0, 0.4)' : 'transparent',
    transition: 'all 0.2s ease',
    borderRadius: '8px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto', // 親要素が pointer-events: none の場合でも、枠自身はD&D対象として反応させる
    aspectRatio: style?.aspectRatio || '1 / 1', // styleでaspectRatioが指定されている場合はそちらを優先
  };

  return (
    <div
      ref={setNodeRef}
      style={highlightStyle}
      className={`droppable-slot-target ${positionClass}`}
    >
      {/* マナが装備されていない時だけラベルを表示 */}
      {!children && (
        <span
          className='slot-label'
          style={{
            fontSize: '0.7rem',
            color: '#fff',
            textShadow: '1px 1px 2px #000',
          }}
        >
          {slotName}
        </span>
      )}

      {/* 装備されたマナカードを枠いっぱいに広げるコンテナ */}
      {children}
    </div>
  );
};
