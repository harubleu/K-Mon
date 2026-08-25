// src/components/MonsterZone.tsx

import React from 'react';
import type { MonsterCard, PlayerSide } from '../types';
import { MonsterWithMana } from './MonsterWithMana';

interface MonsterZoneProps {
  monsters: MonsterCard[];
  side: PlayerSide;
  isDropDisabled?: boolean;
  selectedManaIds: string[];
  onToggleSelectMana: (manaId: string) => void;
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
  isDropDisabled = false,
  selectedManaIds,
  onToggleSelectMana,
  onTrashMana,
  onFlipMonster,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '140px',
        justifyContent: 'center',
        flexGrow: 1,
        padding: '20px 0',
        boxSizing: 'border-box',
        paddingLeft: '90px',
        paddingRight: '90px',
      }}
    >
      {monsters.map((monster, index) => (
        <div
          key={`monster-card-${monster.id}-${index}`}
          style={{
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '8px',
            width: '180px',
            backgroundColor: monster.isFlipped ? '#e0e0e0' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <div style={{ marginBottom: '80px', marginTop: '50px' }}>
            <MonsterWithMana
              monster={monster}
              selectedManaIds={selectedManaIds}
              onManaClick={onToggleSelectMana}
              side={side}
              monsterIndex={index}
              isDroppable={!isDropDisabled}
              idPrefix='main_zone'
              hideEmptySlotVisual
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => onFlipMonster(side, index)}
              style={{ fontSize: '0.75rem', padding: '4px', cursor: 'pointer' }}
            >
              反転
            </button>

            {/* 【削除】選択破棄・選択除外ボタン → PlayerZone.tsx側の墓地/除外パネルに集約 */}

            <button
              onClick={() => onTrashMana(side, index, 'all', 'cemetery')}
              disabled={
                monster.equippedMana.filter((m) => m !== null).length === 0
              }
              style={{ fontSize: '0.7rem', padding: '4px', cursor: 'pointer' }}
            >
              全マナ破棄(墓地)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
