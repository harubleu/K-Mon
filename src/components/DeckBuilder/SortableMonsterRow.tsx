// src/components/DeckBuilder/SortableMonsterRow.tsx

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MONSTER_MASTER_LIST } from '../../data/masterData';

interface SortableMonsterRowProps {
  monsterId: string;
  order: number; // 0-indexed
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const SortableMonsterRow: React.FC<SortableMonsterRowProps> = ({
  monsterId,
  order,
  total,
  onMoveUp,
  onMoveDown,
}) => {
  const master = MONSTER_MASTER_LIST.find((m) => m.id === monsterId);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: monsterId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px dashed #ccc',
        borderRadius: '6px',
        padding: '6px',
        minHeight: '60px',
        backgroundColor: '#fff',
      }}
    >
      {/* ドラッグハンドル */}
      <span
        {...attributes}
        {...listeners}
        title='ドラッグで並び替え'
        style={{
          cursor: 'grab',
          color: '#bbb',
          fontSize: '1rem',
          touchAction: 'none', // モバイルでのスクロール競合防止
          padding: '0 2px',
        }}
      >
        ⠿
      </span>

      {/* 上下矢印＋番号バッジ（数字の上下に薄いグレーの矢印） */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        <button
          onClick={onMoveUp}
          disabled={order === 0}
          title='上へ'
          style={{
            border: 'none',
            background: 'none',
            color: order === 0 ? '#e5e5e5' : '#aaa',
            cursor: order === 0 ? 'default' : 'pointer',
            fontSize: '0.6rem',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ▲
        </button>
        <span
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#007bff',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {order + 1}
        </span>
        <button
          onClick={onMoveDown}
          disabled={order === total - 1}
          title='下へ'
          style={{
            border: 'none',
            background: 'none',
            color: order === total - 1 ? '#e5e5e5' : '#aaa',
            cursor: order === total - 1 ? 'default' : 'pointer',
            fontSize: '0.6rem',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ▼
        </button>
      </div>

      {master ? (
        <>
          {/* 【注記】画像幅(40px)はSelectionSidebar.tsx側でご調整済みのサイズに合わせてください */}
          <img
            src={`${import.meta.env.BASE_URL}${master.imageUrl.replace(/^\//, '')}`}
            alt={`${master.name}（表）`}
            style={{ width: '100px', borderRadius: '4px' }}
          />
          {master.flippedImageUrl && (
            <img
              src={`${import.meta.env.BASE_URL}${master.flippedImageUrl.replace(/^\//, '')}`}
              alt={`${master.name}（裏）`}
              style={{ width: '100px', borderRadius: '4px' }}
            />
          )}
          <span style={{ fontSize: '0.75rem' }}>{master.name}</span>
        </>
      ) : (
        <span style={{ fontSize: '0.75rem', color: '#999' }}>未選択</span>
      )}
    </div>
  );
};
