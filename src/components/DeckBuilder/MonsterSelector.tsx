// src/components/DeckBuilder/MonsterSelector.tsx

import React, { useState, useMemo } from 'react';
import { MONSTER_MASTER_LIST } from '../../data/masterData';

interface MonsterSelectorProps {
  selectedMonsterIds: string[];
  onToggleMonster: (id: string) => void;
  manaCounts: Record<string, number>;
}

export const MonsterSelector: React.FC<MonsterSelectorProps> = ({
  selectedMonsterIds,
  onToggleMonster,
  manaCounts,
}) => {
  const [activeFolder, setActiveFolder] = useState<string>('すべて');

  const folders = useMemo(() => {
    const folderNames = Array.from(
      new Set(MONSTER_MASTER_LIST.map((m) => m.folder || '未分類')),
    );
    return ['すべて', ...folderNames];
  }, []);

  const filteredMonsters = useMemo(() => {
    if (activeFolder === 'すべて') return MONSTER_MASTER_LIST;
    return MONSTER_MASTER_LIST.filter(
      (m) => (m.folder || '未分類') === activeFolder,
    );
  }, [activeFolder]);

  const hasSelectedMana = Object.values(manaCounts).some((count) => count > 0);

  return (
    <section>
      <h3 style={{ marginTop: 0 }}>1. モンスター選択（3体）</h3>

      {/* フォルダタブ */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          borderBottom: '2px solid #eee',
          paddingBottom: '8px',
        }}
      >
        {folders.map((folder) => (
          <button
            key={folder}
            onClick={() => setActiveFolder(folder)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: activeFolder === folder ? 'none' : '1px solid #ccc',
              backgroundColor:
                activeFolder === folder ? '#007bff' : 'transparent',
              color: activeFolder === folder ? '#fff' : '#333',
              cursor: 'pointer',
              fontWeight: activeFolder === folder ? 'bold' : 'normal',
            }}
          >
            {folder}
          </button>
        ))}
      </div>

      {/* モンスター一覧 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredMonsters.map((monster) => {
          const isSelected = selectedMonsterIds.includes(monster.id);
          let bgStyle = {
            backgroundColor: '#fff',
            boxShadow: 'none',
            border: '2px solid transparent',
          };

          if (isSelected) {
            bgStyle = {
              backgroundColor: '#e3f2fd',
              boxShadow: '0 0 0 2px #007bff',
              border: '2px solid #007bff',
            };
          } else if (hasSelectedMana) {
            const requiredKanji = monster.slots;
            // 選択しているマナ全てで構成できるか（モンスターのスロットが、選択中のマナ種類のサブセットか）
            const isAllCovered = requiredKanji.every((k) => manaCounts[k] > 0);
            // 一部でも選択中のマナを含むか
            const isPartiallyCovered = requiredKanji.some(
              (k) => manaCounts[k] > 0,
            );

            if (isAllCovered) {
              // 強い相関（黄色背景影）
              bgStyle = {
                backgroundColor: '#fff9c4',
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.6)',
                border: '2px solid transparent',
              };
            } else if (isPartiallyCovered) {
              // 弱い相関（白色背景影・視認性のため少しグレーに浮かせる）
              bgStyle = {
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                border: '2px solid transparent',
              };
            }
          }

          return (
            <div
              key={monster.id}
              onClick={() => onToggleMonster(monster.id)}
              style={{
                ...bgStyle,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                position: 'relative',
                padding: '4px',
              }}
              title={`${monster.name} / 必要スロット: ${monster.slots.join(', ')}`}
            >
              <img
                src={`${import.meta.env.BASE_URL}${monster.imageUrl?.replace(/^\//, '')}`}
                alt={monster.name}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '4px',
                  display: 'block',
                }}
              />
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
