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
  // 【修正】初期タブを「すべて」ではなく最初の弾にする
  const [activeFolder, setActiveFolder] = useState<string>('第1弾_キホンのキ');

  // 【追加】プレビュー用の反転状態（実ゲーム状態には影響しない、選択画面だけのローカル状態）
  const [previewFlippedIds, setPreviewFlippedIds] = useState<Set<string>>(
    new Set(),
  );
  const [allFlipped, setAllFlipped] = useState(false);

  const toggleGlobalFlip = () => {
    setAllFlipped((prev) => !prev);
    setPreviewFlippedIds(new Set()); // 個別上書きをリセットし、全体設定を優先させる
  };

  const toggleIndividualFlip = (e: React.MouseEvent, monsterId: string) => {
    e.stopPropagation(); // 親divのonToggleMonsterと競合しないようにする
    setPreviewFlippedIds((prev) => {
      const next = new Set(prev);
      next.has(monsterId) ? next.delete(monsterId) : next.add(monsterId);
      return next;
    });
  };

  const isPreviewFlipped = (monsterId: string) =>
    previewFlippedIds.has(monsterId) ? !allFlipped : allFlipped;

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ margin: 0 }}>1. モンスター選択（3体）</h3>
        {/* 【追加】一括反転ボタン */}
        <button
          onClick={toggleGlobalFlip}
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        >
          {allFlipped ? 'すべて表面に戻す' : 'すべて裏面で確認'}
        </button>
      </div>

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
          const selectionOrder = selectedMonsterIds.indexOf(monster.id); // -1 = 未選択
          const isSelected = selectionOrder !== -1;
          const isFlippedPreview = isPreviewFlipped(monster.id);

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
            const isAllCovered = requiredKanji.every((k) => manaCounts[k] > 0);
            const isPartiallyCovered = requiredKanji.some(
              (k) => manaCounts[k] > 0,
            );

            if (isAllCovered) {
              bgStyle = {
                backgroundColor: '#fff9c4',
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.6)',
                border: '2px solid transparent',
              };
            } else if (isPartiallyCovered) {
              bgStyle = {
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                border: '2px solid transparent',
              };
            }
          }

          const currentImageUrl = isFlippedPreview
            ? monster.flippedImageUrl
            : monster.imageUrl;

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
                src={`${import.meta.env.BASE_URL}${currentImageUrl?.replace(/^\//, '')}`}
                alt={monster.name}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '4px',
                  display: 'block',
                }}
              />

              {/* 【追加】反転専用アイコン（左上、クリックイベントを親から分離） */}
              <button
                onClick={(e) => toggleIndividualFlip(e, monster.id)}
                title='表裏を切り替え'
                style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '-8px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#555',
                  color: '#fff',
                  border: '2px solid #fff',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ⟳
              </button>

              {/* 【修正】✓ではなく選択順の番号を表示 */}
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
                    fontSize: '0.85rem',
                  }}
                >
                  {selectionOrder + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
