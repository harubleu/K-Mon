// src/components/MonsterZone.tsx

import React, { useState } from 'react';
import type { MonsterCard, PlayerSide } from '../types';
import { Card } from './Card';
import { DroppableSlot } from './PlayerZone/DroppableSlot';

interface MonsterZoneProps {
  monsters: MonsterCard[];
  side: PlayerSide;
  isDropDisabled?: boolean;
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
  isDropDisabled = false,
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
        gap: '24px', // はみ出しマナが重なり合わないよう少し間隔を広げる
        justifyContent: 'center',
        flexGrow: 1,
        padding: '20px 0',
      }}
    >
      {monsters.map((monster, index) => {
        // このモンスターに装備されているマナのうち、選択されているもののID
        const monsterManaIds = monster.equippedMana.map((m) => m.id);
        const selectedInThisMonster = selectedManaIds.filter((id) =>
          monsterManaIds.includes(id),
        );

        return (
          <DroppableSlot
            key={monster.id || index}
            side={side}
            monsterIndex={index}
            slotIndex={0} // 仮置き: 今回はモンスター全体をターゲット(Index 0)とする
            slotName='' // 既存のUIレイアウトを維持するため空文字を指定
            disabled={isDropDisabled} // モーダル表示中などにドロップを無効化
          >
            <div
              style={{
                border: '2px solid #333',
                borderRadius: '8px',
                padding: '8px',
                width: '180px',
                backgroundColor: monster.isFlipped ? '#e0e0e0' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%', // 追加: DroppableSlot内で高さを適切に維持するため
              }}
            >
              {/* --- モンスター画像と装備マナの重ね合わせ表示領域 --- */}
              <div
                style={{
                  position: 'relative', // 絶対配置の基準
                  width: '100%',
                  aspectRatio: '63 / 88',
                  marginBottom: '16px',
                  marginTop: '8px',
                }}
              >
                {/* 1. 背面：モンスター画像本体 */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1, // 画像を奥に
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: '#f0f0f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {monster.imageUrl && (
                    <img
                      src={`${import.meta.env.BASE_URL}${(monster.isFlipped && monster.flippedImageUrl ? monster.flippedImageUrl : monster.imageUrl).replace(/^\//, '')}`}
                      alt={monster.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                </div>

                {/* 2. 前面：装備中のマナ一覧（はみ出し絶対配置） */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2, // マナを手前に配置
                    pointerEvents: 'none', // マナ以外の空白部分のクリックを透過させる
                  }}
                >
                  {monster.equippedMana.map((mana, mIndex) => {
                    // マスターデータ等で定義された position クラス（未定義の場合はデフォルトで左上等にフォールバック）
                    const positionClass =
                      monster.slotPositions && monster.slotPositions[mIndex]
                        ? monster.slotPositions[mIndex]
                        : 'slot-left-single';

                    const isSelected = selectedManaIds.includes(mana.id);

                    return (
                      <div
                        key={mana.id}
                        className={`slot-item ${positionClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectMana(mana.id);
                        }}
                        style={{
                          pointerEvents: 'auto', // マナカード自体はクリック可能にする
                          cursor: 'pointer',
                          outline: isSelected ? '3px solid #ff4d4f' : 'none',
                          borderRadius: '4px',
                          transform: isSelected ? 'scale(1.05)' : undefined, // 各 CSS クラス内の transform と併用する場合は CSS 側で調整
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
              {/* -------------------------------------------------- */}

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
          </DroppableSlot>
        );
      })}
    </div>
  );
};
