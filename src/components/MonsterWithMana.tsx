// src/components/MonsterWithMana.tsx

import React from 'react';
import type { MonsterCard } from '../types';
import { Card } from './Card';

interface MonsterWithManaProps {
  monster: MonsterCard;
  selectedManaIds?: string[];
  onManaClick?: (manaId: string) => void;
  style?: React.CSSProperties;
}

export const MonsterWithMana: React.FC<MonsterWithManaProps> = ({
  monster,
  selectedManaIds = [],
  onManaClick,
  style,
}) => {
  return (
    <div
      style={{
        display: 'grid', // 方針2: CSS Gridを用いた重ね合わせ
        width: '100%',
        aspectRatio: '63 / 88',
        ...style,
      }}
    >
      {/* 1. 背面：モンスター画像本体 */}
      <div
        style={{
          gridArea: '1 / 1', // Gridの同じセルに配置して重ねる
          zIndex: 1, // 画像を奥に配置
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#f0f0f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {monster.imageUrl && (
          <img
            src={`${import.meta.env.BASE_URL}${(monster.isFlipped && monster.flippedImageUrl ? monster.flippedImageUrl : monster.imageUrl).replace(/^\//, '')}`}
            alt={monster.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
      </div>

      {/* 2. 前面：装備中のマナ一覧（オーバーレイ） */}
      <div
        style={{
          gridArea: '1 / 1', // Gridの同じセルに配置して重ねる
          position: 'relative', // 子要素の絶対配置の基準を維持
          zIndex: 2, // マナを手前に配置
          pointerEvents: 'none', // マナ以外の空白部分のクリックを透過させる
        }}
      >
        {monster.equippedMana.map((mana, mIndex) => {
          const positionClass =
            monster.slotPositions && monster.slotPositions[mIndex]
              ? monster.slotPositions[mIndex]
              : 'slot-left-single'; // fallback

          const isSelected = selectedManaIds.includes(mana.id);

          return (
            <div
              key={mana.id}
              className={`slot-item ${positionClass}`}
              onClick={(e) => {
                if (onManaClick) {
                  e.stopPropagation();
                  onManaClick(mana.id);
                }
              }}
              style={{
                pointerEvents: 'auto', // マナカード自体はクリック可能にする
                cursor: onManaClick ? 'pointer' : 'default',
                outline: isSelected ? '3px solid #ff4d4f' : 'none',
                borderRadius: '4px',
                transform: isSelected ? 'scale(1.05)' : undefined,
                transition: 'transform 0.1s, outline 0.1s',
              }}
              title={onManaClick ? 'クリックして選択/解除' : undefined}
            >
              <Card card={mana} size='sm' />
            </div>
          );
        })}
      </div>
    </div>
  );
};
