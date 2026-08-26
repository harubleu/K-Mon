// src/components/DeckBuilder/MonsterSelector.tsx

import React, { useState, useMemo } from 'react';
import { MONSTER_MASTER_LIST } from '../../data/masterData';

interface MonsterSelectorProps {
  selectedMonsterIds: string[];
  onToggleMonster: (id: string) => void;
  manaCounts: Record<string, number>;
}

type CorrelationFilter = 'all' | 'strong' | 'weakOrStrong';

export const MonsterSelector: React.FC<MonsterSelectorProps> = ({
  selectedMonsterIds,
  onToggleMonster,
  manaCounts,
}) => {
  const [activeFolder, setActiveFolder] = useState<string>('第1弾_キホンのキ');

  // プレビュー用の反転状態（実ゲーム状態には影響しない、選択画面だけのローカル状態）
  const [previewFlippedIds, setPreviewFlippedIds] = useState<Set<string>>(
    new Set(),
  );
  const [allFlipped, setAllFlipped] = useState(false);

  // 相関フィルタの状態
  const [correlationFilter, setCorrelationFilter] =
    useState<CorrelationFilter>('all');

  const toggleGlobalFlip = () => {
    setAllFlipped((prev) => !prev);
    setPreviewFlippedIds(new Set());
  };

  const toggleIndividualFlip = (e: React.MouseEvent, monsterId: string) => {
    e.stopPropagation();
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

  // 【重要】hasSelectedMana と getCorrelationLevel は、
  // これらを利用する useMemo (folderFilteredMonsters等)より
  // 必ず前に置くこと。宣言順序を守らないと
  // "Cannot access ... before initialization" エラーになる。
  const hasSelectedMana = Object.values(manaCounts).some((count) => count > 0);

  const getCorrelationLevel = (
    monster: (typeof MONSTER_MASTER_LIST)[number],
  ): 'none' | 'weak' | 'strong' => {
    if (!hasSelectedMana) return 'none';
    const requiredKanji = monster.slots;
    const isAllCovered = requiredKanji.every((k) => manaCounts[k] > 0);
    const isPartiallyCovered = requiredKanji.some((k) => manaCounts[k] > 0);
    if (isAllCovered) return 'strong';
    if (isPartiallyCovered) return 'weak';
    return 'none';
  };

  const folderFilteredMonsters = useMemo(() => {
    if (activeFolder === 'すべて') return MONSTER_MASTER_LIST;
    return MONSTER_MASTER_LIST.filter(
      (m) => (m.folder || '未分類') === activeFolder,
    );
  }, [activeFolder]);

  const filteredMonsters = useMemo(() => {
    if (correlationFilter === 'all' || !hasSelectedMana)
      return folderFilteredMonsters;
    return folderFilteredMonsters.filter((m) => {
      const level = getCorrelationLevel(m);
      if (correlationFilter === 'strong') return level === 'strong';
      return level === 'strong' || level === 'weak';
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderFilteredMonsters, correlationFilter, manaCounts, hasSelectedMana]);

  return (
    <section>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <h3 style={{ margin: 0 }}>1. モンスター選択（3体）</h3>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={correlationFilter}
            onChange={(e) =>
              setCorrelationFilter(e.target.value as CorrelationFilter)
            }
            disabled={!hasSelectedMana}
            title={!hasSelectedMana ? 'マナを選択すると使えます' : ''}
            style={{
              padding: '6px 8px',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              cursor: hasSelectedMana ? 'pointer' : 'not-allowed',
            }}
          >
            <option value='all'>すべて表示</option>
            <option value='strong'>強い相関のみ</option>
            <option value='weakOrStrong'>相関あり（強・弱）</option>
          </select>

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
          const selectionOrder = selectedMonsterIds.indexOf(monster.id);
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
          } else {
            const level = getCorrelationLevel(monster);
            if (level === 'strong') {
              bgStyle = {
                backgroundColor: '#fff9c4',
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.6)',
                border: '2px solid transparent',
              };
            } else if (level === 'weak') {
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
