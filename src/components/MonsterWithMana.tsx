// src/components/MonsterWithMana.tsx

import React from 'react';
import type { MonsterCard, PlayerSide } from '../types';
import { DroppableSlot } from './PlayerZone/DroppableSlot';

interface MonsterWithManaProps {
  monster: MonsterCard;
  selectedManaIds?: string[];
  onManaClick?: (manaId: string) => void;
  style?: React.CSSProperties;
  side?: PlayerSide;
  monsterIndex?: number;
  isDroppable?: boolean;
  idPrefix?: string;
}

export const MonsterWithMana: React.FC<MonsterWithManaProps> = ({
  monster,
  selectedManaIds = [],
  onManaClick,
  style,
  side,
  monsterIndex,
  isDroppable = false,
  idPrefix = 'slot',
}) => {
  const slotCount = Math.max(
    monster.slots?.length || 0,
    monster.equippedMana.length,
  );
  const slotsArray = Array.from({ length: slotCount });

  // BASE_URLを考慮した安全な画像URL生成ヘルパー
  const getSafeImageUrl = (url?: string) => {
    if (!url) return '';
    // 既にhttp等の外部URL指定ならそのまま返す
    if (url.startsWith('http') || url.startsWith('data:')) return url;

    const baseUrl = import.meta.env.BASE_URL || '/';
    // 重複するスラッシュを防ぐための処理
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return baseUrl.endsWith('/')
      ? `${baseUrl}${cleanUrl}`
      : `${baseUrl}/${cleanUrl}`;
  };

  // 反転状態に応じた画像URLを解決
  const currentImageUrl = monster.isFlipped
    ? monster.flippedImageUrl
    : monster.imageUrl;
  const resolvedImageUrl = getSafeImageUrl(currentImageUrl);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        userSelect: 'none',
        ...style, // 未使用だった Props の style をルート要素に適用
      }}
    >
      {/* 1. モンスター画像 */}
      {resolvedImageUrl ? (
        <img
          src={resolvedImageUrl}
          alt={monster.name}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          draggable={false}
        />
      ) : (
        /* 画像がない場合のフォールバック（デバッグ用） */
        <div
          style={{
            width: '100%',
            aspectRatio: '2.5/3.5',
            backgroundColor: '#333',
          }}
        />
      )}

      {/* 2. 各装備スロットの配置 */}
      {/* monster.slots ではなく、超過分も考慮した slotsArray を基準に展開する */}
      {slotsArray.map((_, index) => {
        // マスターデータの必須漢字。超過スロットの場合は '汎' などのフォールバック表示（または空文字）とする
        const requiredKanji = monster.slots[index] || '汎';
        const mana = monster.equippedMana[index];

        // App.css に定義された位置クラスを取得（デフォルトは slot-center-middle）
        // 超過スロットの場合は位置データがないため、中央に重なるかたちでフォールバックされる
        const rawSlotClass = (
          monster.slotPositions?.[index] || 'slot-center-middle'
        ).replace(/^\./, '');

        // slot-inside-〇〇 クラスは absolute と独自サイズを持っているため slot-item と分けます
        const slotClassName = rawSlotClass.startsWith('slot-inside-')
          ? rawSlotClass
          : `slot-item ${rawSlotClass}`;

        const isSelected = mana && selectedManaIds.includes(mana.id);

        return (
          <div key={`${monster.id}-slot-${index}`} className={slotClassName}>
            <DroppableSlot
              id={`${idPrefix}-${side}-${monsterIndex}-${index}`}
              side={side}
              monsterIndex={monsterIndex}
              slotIndex={index}
              disabled={!isDroppable}
              style={{ width: '100%', height: '100%' }}
            >
              {mana ? (
                /* --- 装備済みマナの描画 --- */
                <div
                  className='mana-fit-to-slot'
                  onClick={() => onManaClick?.(mana.id)}
                  style={{
                    cursor: onManaClick ? 'pointer' : 'default',
                    boxShadow: isSelected ? '0 0 8px 4px #ff0' : 'none',
                    transition: 'transform 0.15s ease',
                    transform: isSelected ? 'scale(1.1)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: mana.hexColor,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                    }}
                  >
                    <span
                      style={{
                        color: '#fff',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px #000',
                      }}
                    >
                      {mana.kanji}
                    </span>
                  </div>
                </div>
              ) : (
                /* --- 未装備スロット（点線枠）の描画 --- */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    border: '2px dashed rgba(255, 255, 255, 0.8)',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 2px #000',
                    boxSizing: 'border-box',
                  }}
                >
                  {requiredKanji}
                </div>
              )}
            </DroppableSlot>
          </div>
        );
      })}
    </div>
  );
};
