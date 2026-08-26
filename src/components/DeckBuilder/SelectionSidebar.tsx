// src/components/DeckBuilder/SelectionSidebar.tsx

import React from 'react';
import { MANA_MASTER_LIST } from '../../data/masterData';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SortableMonsterRow } from './SortableMonsterRow';

interface SelectionSidebarProps {
  monsterIds: string[]; // 選択順を保持した配列（最大3件）
  manaCounts: Record<string, number>;
  onUpdateCount: (kanji: string, delta: number) => void;
  onClearMonsters: () => void; // 【追加】
  onClearMana: () => void; // 【追加】
  onReorderMonsters: (newOrder: string[]) => void; // 【追加】
}

export const SelectionSidebar: React.FC<SelectionSidebarProps> = ({
  monsterIds,
  manaCounts,
  onUpdateCount,
  onClearMonsters, // 【追加】
  onClearMana, // 【追加】
  onReorderMonsters, // 【追加】
}) => {
  const selectedMana = Object.entries(manaCounts).filter(
    ([, count]) => count > 0,
  );

  // 【追加】モンスター並び替え専用のセンサー。既存のバトル画面D&Dとは完全に独立させる。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = monsterIds.indexOf(String(active.id));
    const newIndex = monsterIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderMonsters(arrayMove(monsterIds, oldIndex, newIndex));
  };

  const moveMonster = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= monsterIds.length) return;
    onReorderMonsters(arrayMove(monsterIds, index, targetIndex));
  };

  return (
    <div
      style={{
        width: '400px',
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>選択中のモンスター</h4>
          <button
            onClick={onClearMonsters}
            disabled={monsterIds.length === 0}
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              cursor: monsterIds.length === 0 ? 'not-allowed' : 'pointer',
              color: monsterIds.length === 0 ? '#ccc' : '#dc3545',
              border: `1px solid ${monsterIds.length === 0 ? '#eee' : '#dc3545'}`,
              borderRadius: '4px',
              backgroundColor: '#fff',
            }}
          >
            クリア
          </button>
        </div>

        {/* 【修正前】{[0, 1, 2].map((slotIndex) => { ... })} の代わりに以下に置き換え */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <SortableContext
              items={monsterIds}
              strategy={verticalListSortingStrategy}
            >
              {monsterIds.map((monsterId, index) => (
                <SortableMonsterRow
                  key={monsterId}
                  monsterId={monsterId}
                  order={index}
                  total={monsterIds.length}
                  onMoveUp={() => moveMonster(index, -1)}
                  onMoveDown={() => moveMonster(index, 1)}
                />
              ))}
            </SortableContext>

            {/* 未選択の残り枠（並び替え対象外） */}
            {Array.from({ length: 3 - monsterIds.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
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
                    backgroundColor: '#ccc',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {monsterIds.length + i + 1}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#999' }}>
                  未選択
                </span>
              </div>
            ))}
          </div>
        </DndContext>
      </div>

      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>選択中のマナ</h4>
          <button
            onClick={onClearMana}
            disabled={selectedMana.length === 0}
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              cursor: selectedMana.length === 0 ? 'not-allowed' : 'pointer',
              color: selectedMana.length === 0 ? '#ccc' : '#dc3545',
              border: `1px solid ${selectedMana.length === 0 ? '#eee' : '#dc3545'}`,
              borderRadius: '4px',
              backgroundColor: '#fff',
            }}
          >
            クリア
          </button>
        </div>
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
                      // ManaSelector.tsxの漢字バッジと同じpadding/fontSizeに統一
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      flexGrow: 1,
                    }}
                  >
                    {kanji}{' '}
                    {/* ManaSelectorと同様、読みも併記して見た目を完全に一致させる */}
                    <span style={{ fontSize: '0.8rem' }}>
                      ({master?.reading})
                    </span>
                  </span>
                  <button
                    onClick={() => onUpdateCount(kanji, -1)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      fontSize: '1.0rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontSize: '1.0rem',
                      minWidth: '24px',
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                  <button
                    onClick={() => onUpdateCount(kanji, 1)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      fontSize: '1.0rem',
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
