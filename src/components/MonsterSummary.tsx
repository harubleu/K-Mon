// src/components/MonsterSummary.tsx

import React from 'react';
import type { MonsterCard, PlayerSide } from '../types';
import { Card } from './Card';
import { DroppableSlot } from './PlayerZone/DroppableSlot';

interface MonsterSummaryProps {
  monsters: MonsterCard[];
  label: string;
  side: PlayerSide;
  idPrefix?: string;
}

export const MonsterSummary: React.FC<MonsterSummaryProps> = ({
  monsters,
  label,
  side,
  idPrefix = 'modal_summary',
}) => {
  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f0f4f8',
        borderRadius: '6px',
      }}
    >
      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 'bold',
          marginBottom: '12px',
        }}
      >
        {label}の盤面状況（モンスター＆装備マナ）
      </div>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
        }}
      >
        {monsters.map((monster, index) => (
          <div
            key={monster.id || index}
            style={{
              flex: 1,
            }}
          >
            <DroppableSlot
              side={side}
              monsterIndex={index}
              slotIndex={0} // モンスター全体をドロップ対象とするため0を指定
              slotName=''
              idPrefix={idPrefix}
            >
              <div
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '8px',
                  backgroundColor: '#fff',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {/* モンスター名と面状態 */}
                <div
                  style={{
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  {monster.name} {monster.isFlipped ? '(裏面)' : ''}
                </div>

                {/* 修正: スロット情報のテキスト表示を追加 */}
                <div
                  style={{
                    color: '#555',
                    fontSize: '0.7rem',
                    marginBottom: '8px',
                    textAlign: 'center',
                  }}
                >
                  スロット:{' '}
                  {monster.slots.length > 0 ? monster.slots.join(', ') : 'なし'}
                </div>

                {/* 修正: 画像とマナの重ね合わせコンテナ (TCG風の見た目) */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '130px',
                    minHeight: '160px', // 画像が縮まないよう高さを確保
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '8px',
                  }}
                >
                  {monster.imageUrl ? (
                    <img
                      src={`${import.meta.env.BASE_URL}${(monster.isFlipped && monster.flippedImageUrl ? monster.flippedImageUrl : monster.imageUrl).replace(/^\//, '')}`}
                      alt={monster.name}
                      style={{
                        width: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        borderRadius: '4px',
                        position: 'absolute', // 背景として奥に配置
                        top: 0,
                        zIndex: 1,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: '140px',
                        width: '100%',
                        backgroundColor: '#eee',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      NO IMAGE
                    </div>
                  )}

                  {/* 重ねて表示する装備マナ */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-15px', // モンスター画像の手前下部に少しはみ出すように配置
                      zIndex: 2, // 画像より手前に出す
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: '4px',
                      width: '110%',
                    }}
                  >
                    {monster.equippedMana.length === 0 ? (
                      <span
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.85)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          color: '#666',
                          fontSize: '0.7rem',
                          border: '1px dashed #ccc',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      >
                        装備なし
                      </span>
                    ) : (
                      monster.equippedMana.map((mana) => (
                        // マナカードに影をつけて立体感を出す
                        <div
                          key={mana.id}
                          style={{
                            boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                            borderRadius: '4px',
                          }}
                        >
                          <Card card={mana} size='sm' />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DroppableSlot>
          </div>
        ))}
      </div>
    </div>
  );
};
