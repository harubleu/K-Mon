// src/components/DeckBuilder/SelectionSidebar.tsx

import React from 'react';
import { MONSTER_MASTER_LIST, MANA_MASTER_LIST } from '../../data/masterData';

interface SelectionSidebarProps {
  monsterIds: string[]; // 選択順を保持した配列（最大3件）
  manaCounts: Record<string, number>;
  onUpdateCount: (kanji: string, delta: number) => void;
}

export const SelectionSidebar: React.FC<SelectionSidebarProps> = ({
  monsterIds,
  manaCounts,
  onUpdateCount,
}) => {
  const selectedMana = Object.entries(manaCounts).filter(
    ([, count]) => count > 0,
  );

  return (
    <div
      style={{
        width: '220px',
        flexShrink: 0,
        position: 'sticky',
        top: '16px',
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: '#fff',
        }}
      >
        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
          選択中のモンスター
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map((slotIndex) => {
            const monsterId = monsterIds[slotIndex];
            const master = monsterId
              ? MONSTER_MASTER_LIST.find((m) => m.id === monsterId)
              : undefined;

            return (
              <div
                key={slotIndex}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px dashed #ccc',
                  borderRadius: '6px',
                  padding: '6px',
                  minHeight: '60px',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: master ? '#007bff' : '#ccc',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {slotIndex + 1}
                </span>
                {master ? (
                  <>
                    <img
                      src={`${import.meta.env.BASE_URL}${master.imageUrl.replace(/^\//, '')}`}
                      alt={`${master.name}（表）`}
                      style={{ width: '40px', borderRadius: '4px' }}
                    />
                    {master.flippedImageUrl && (
                      <img
                        src={`${import.meta.env.BASE_URL}${master.flippedImageUrl.replace(/^\//, '')}`}
                        alt={`${master.name}（裏）`}
                        style={{ width: '40px', borderRadius: '4px' }}
                      />
                    )}
                    <span style={{ fontSize: '0.75rem' }}>{master.name}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    未選択
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: '#fff',
        }}
      >
        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>選択中のマナ</h4>
        {selectedMana.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: '#999', margin: 0 }}>
            未選択
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedMana.map(([kanji, count]) => {
              const master = MANA_MASTER_LIST.find((m) => m.kanji === kanji);
              return (
                <div
                  key={kanji}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span
                    style={{
                      backgroundColor: master?.hexColor || '#ccc',
                      color: '#fff',
                      textShadow: '1px 1px 2px #000',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      flexGrow: 1,
                    }}
                  >
                    {kanji}
                  </span>
                  <button
                    onClick={() => onUpdateCount(kanji, -1)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      minWidth: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                  <button
                    onClick={() => onUpdateCount(kanji, 1)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ＋
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
