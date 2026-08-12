// src/components/MonsterZone.tsx

import React, { useState } from 'react';
import type { MonsterCard, PlayerSide } from '../types';
import { Card } from './Card';

interface MonsterZoneProps {
  monsters: MonsterCard[];
  side: PlayerSide;
  onEquipMana: (side: PlayerSide, monsterIndex: number) => void;
  onTrashMana: (
    side: PlayerSide,
    monsterIndex: number,
    manaCardIds: 'all' | string[],
    destination: 'cemetery' | 'exile',
  ) => void;
  onFlipMonster: (side: PlayerSide, monsterIndex: number) => void;
}

export const MonsterZone: React.FC<MonsterZoneProps> = ({
  monsters,
  side,
  onEquipMana,
  onTrashMana,
  onFlipMonster,
}) => {
  // 選択中のマナカードID一覧
  const [selectedManaIds, setSelectedManaIds] = useState<string[]>([]);

  // マナカードの選択トグル
  const handleToggleSelectMana = (manaId: string) => {
    setSelectedManaIds((prev) =>
      prev.includes(manaId)
        ? prev.filter((id) => id !== manaId)
        : [...prev, manaId],
    );
  };

  // 選択されたマナを指定の領域へ移動
  const handleMoveSelectedMana = (
    monsterIndex: number,
    destination: 'cemetery' | 'exile',
  ) => {
    const monsterManaIds = monsters[monsterIndex].equippedMana.map((m) => m.id);
    const targetIds = selectedManaIds.filter((id) =>
      monsterManaIds.includes(id),
    );

    if (targetIds.length === 0) return;

    onTrashMana(side, monsterIndex, targetIds, destination);
    // 移動したカードを選択解除
    setSelectedManaIds((prev) => prev.filter((id) => !targetIds.includes(id)));
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        flexGrow: 1,
      }}
    >
      {monsters.map((monster, index) => {
        // このモンスターに装備されているマナのうち、選択されているもののID
        const monsterManaIds = monster.equippedMana.map((m) => m.id);
        const selectedInThisMonster = selectedManaIds.filter((id) =>
          monsterManaIds.includes(id),
        );

        return (
          <div
            key={monster.id || index}
            style={{
              border: '2px solid #333',
              borderRadius: '8px',
              padding: '8px',
              width: '180px',
              backgroundColor: monster.isFlipped ? '#e0e0e0' : '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* モンスターヘッダー情報 */}
            <div>
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  marginBottom: '4px',
                }}
              >
                {monster.name} {monster.isFlipped ? '(裏面)' : ''}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#666',
                  marginBottom: '8px',
                }}
              >
                スロット: {monster.slots.join(', ')}
              </div>
            </div>

            {/* --- モンスター画像の表示領域 --- */}
            <div style={{ marginBottom: '8px', textAlign: 'center' }}>
              {monster.imageUrl && (
                <img
                  src={`${import.meta.env.BASE_URL}${(monster.isFlipped && monster.flippedImageUrl ? monster.flippedImageUrl : monster.imageUrl).replace(/^\//, '')}`}
                  alt={monster.name}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '4px',
                  }}
                />
              )}
            </div>
            {/* -------------------------------------- */}

            {/* 装備中のマナ一覧 */}
            <div style={{ minHeight: '60px', marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  marginBottom: '4px',
                }}
              >
                装備マナ ({monster.equippedMana.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {monster.equippedMana.map((mana) => {
                  const isSelected = selectedManaIds.includes(mana.id);
                  return (
                    <div
                      key={mana.id}
                      onClick={() => handleToggleSelectMana(mana.id)}
                      style={{
                        cursor: 'pointer',
                        outline: isSelected ? '3px solid #ff4d4f' : 'none',
                        borderRadius: '4px',
                        transform: isSelected ? 'scale(1.05)' : 'none',
                        transition: 'transform 0.1s, outline 0.1s',
                      }}
                      title='クリックして選択/解除'
                    >
                      <Card card={mana} size='sm' />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 操作ボタンエリア */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => onEquipMana(side, index)}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  山札から装備
                </button>
                <button
                  onClick={() => onFlipMonster(side, index)}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  反転
                </button>
              </div>

              {/* 選択中のマナ操作ボタン */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleMoveSelectedMana(index, 'cemetery')}
                  disabled={selectedInThisMonster.length === 0}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  選択破棄
                </button>
                <button
                  onClick={() => handleMoveSelectedMana(index, 'exile')}
                  disabled={selectedInThisMonster.length === 0}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  選択除外
                </button>
              </div>

              <button
                onClick={() => onTrashMana(side, index, 'all', 'cemetery')}
                disabled={monster.equippedMana.length === 0}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px',
                  cursor: 'pointer',
                }}
              >
                全マナ破棄(墓地)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
