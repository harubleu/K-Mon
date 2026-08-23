// src/components/DeckBuilder/ManaSelector.tsx

import React, { useMemo } from 'react';
import { MANA_MASTER_LIST, MONSTER_MASTER_LIST } from '../../data/masterData';

interface ManaSelectorProps {
  manaCounts: Record<string, number>;
  onUpdateCount: (kanji: string, delta: number) => void;
  onAutoFill: () => void;
  isAutoFillDisabled: boolean;
  selectedMonsterIds: string[];
}

export const ManaSelector: React.FC<ManaSelectorProps> = ({
  manaCounts,
  onUpdateCount,
  onAutoFill,
  isAutoFillDisabled,
  selectedMonsterIds,
}) => {
  const requiredKanjiSet = useMemo(() => {
    const kanjiList = selectedMonsterIds.flatMap((id) => {
      const monster = MONSTER_MASTER_LIST.find((m) => m.id === id);
      return monster ? monster.slots : [];
    });
    return new Set(kanjiList);
  }, [selectedMonsterIds]);

  return (
    <section>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>2. マナ選択</h3>
        <button
          onClick={onAutoFill}
          disabled={isAutoFillDisabled}
          style={{
            padding: '6px 12px',
            backgroundColor: isAutoFillDisabled ? '#ccc' : '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isAutoFillDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          オートバランス
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {MANA_MASTER_LIST.map((mana) => {
          const count = manaCounts[mana.kanji] || 0;
          let bgStyle = { backgroundColor: '#fff', boxShadow: 'none' };

          if (count > 0) {
            bgStyle = {
              backgroundColor: '#e3f2fd',
              boxShadow: '0 0 0 2px #007bff',
            };
          } else if (requiredKanjiSet.has(mana.kanji)) {
            bgStyle = {
              backgroundColor: '#fff9c4',
              boxShadow: '0 2px 8px rgba(255, 215, 0, 0.5)',
            };
          }

          return (
            <div
              key={mana.kanji}
              style={{
                ...bgStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #eee',
                transition: 'all 0.2s',
              }}
            >
              <span
                style={{
                  backgroundColor: mana.hexColor,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  textShadow: '1px 1px 2px #000',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                }}
              >
                {mana.kanji}{' '}
                <span style={{ fontSize: '0.8rem' }}>({mana.reading})</span>
              </span>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <button
                  onClick={() => onUpdateCount(mana.kanji, -1)}
                  disabled={count === 0}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1px solid #ccc',
                    cursor: count === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  -
                </button>
                <span
                  style={{
                    display: 'inline-block',
                    width: '24px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {count}
                </span>
                <button
                  onClick={() => onUpdateCount(mana.kanji, 1)}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1px solid #ccc',
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
