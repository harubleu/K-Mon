// src/components/DeckModal.tsx

import React, { useState } from 'react';
import type { ManaCard, MonsterCard, PlayerSide, ZoneType } from '../types';
import { Card } from './Card';
import { MonsterSummary } from './MonsterSummary';

interface DeckModalProps {
  isOpen: boolean;
  deck: ManaCard[];
  side: PlayerSide;
  monsters: MonsterCard[];
  label: string;
  onClose: () => void;
  // 山札から他の領域(墓地・除外)へ移動するハンドラー
  onMoveCards: (
    side: PlayerSide,
    cardIds: string[],
    sourceZone: ZoneType,
    toZone: ZoneType,
  ) => void;
  // 山札から指定モンスターへ直接装備するハンドラー
  onEquipSpecific: (
    side: PlayerSide,
    cardId: string,
    sourceZone: ZoneType,
    monsterIndex: number,
  ) => void;
}

export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  deck,
  monsters,
  side,
  label,
  onClose,
  onMoveCards,
  onEquipSpecific,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  // カードの選択/解除をトグル
  const handleToggleCard = (cardId: string) => {
    setSelectedIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  };

  // 選択したカードを墓地・または除外へ移動
  const handleMove = (toZone: ZoneType) => {
    if (selectedIds.length > 0) {
      onMoveCards(side, selectedIds, 'deck', toZone);
      setSelectedIds([]);
    }
  };

  // 選択した1枚のカードをモンスターに装備
  const handleEquip = (monsterIndex: number) => {
    if (selectedIds.length === 1) {
      onEquipSpecific(side, selectedIds[0], 'deck', monsterIndex);
      setSelectedIds([]);
    }
  };

  const handleClose = () => {
    setSelectedIds([]); // 閉じる際にも選択状態をリセット
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0 }}>
            {label}の山札確認・操作 ({deck.length}枚)
          </h3>
          <button onClick={handleClose} style={{ cursor: 'pointer' }}>
            閉じる
          </button>
        </div>

        <MonsterSummary
          monsters={monsters}
          label={label}
          side={side}
          idPrefix='modal_draw_summary'
        />

        {/* 山札カード一覧 */}
        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            margin: '16px 0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignContent: 'flex-start',
          }}
        >
          {deck.length === 0 ? (
            <p style={{ color: '#888' }}>山札にカードがありません。</p>
          ) : (
            deck.map((card) => {
              const isSelected = selectedIds.includes(card.id);
              return (
                <div
                  key={card.id}
                  onClick={() => handleToggleCard(card.id)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '3px solid #007bff' : '1px solid #ccc',
                    borderRadius: '6px',
                    padding: '4px',
                    backgroundColor: isSelected ? '#e6f0ff' : '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <Card card={card} />
                </div>
              );
            })
          )}
        </div>

        {/* 操作アクションエリア */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
            選択中のカード: {selectedIds.length}枚
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleMove('cemetery')}
              disabled={selectedIds.length === 0}
              style={{
                padding: '6px 12px',
                cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              墓地へ送る
            </button>
            <button
              onClick={() => handleMove('exile')}
              disabled={selectedIds.length === 0}
              style={{
                padding: '6px 12px',
                cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              除外する
            </button>

            <span
              style={{ borderLeft: '1px solid #ccc', margin: '0 4px' }}
            ></span>

            {/* 装備アクション (特定1枚のみ対応のため、選択数が1の時のみ有効) */}
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                onClick={() => handleEquip(index)}
                disabled={selectedIds.length !== 1}
                style={{
                  padding: '6px 12px',
                  cursor: selectedIds.length === 1 ? 'pointer' : 'not-allowed',
                }}
              >
                モンスター{index + 1}に装備
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
