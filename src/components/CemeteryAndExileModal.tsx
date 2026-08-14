// src/components/CemeteryAndExileModal.tsx

import React, { useState, useEffect } from 'react';
import type { ManaCard, MonsterCard, PlayerSide, ZoneType } from '../types';
import { Card } from './Card';
import { MonsterSummary } from './MonsterSummary';
import { DraggableMana } from './GameBoard/DraggableMana';
import { DroppableSlot } from './PlayerZone/DroppableSlot';

interface CemeteryAndExileModalProps {
  isOpen: boolean;
  cemetery: ManaCard[];
  exile: ManaCard[];
  monsters: MonsterCard[];
  side: PlayerSide;
  label: string;
  onClose: () => void;
  onRecover: (side: PlayerSide, manaIds: string[]) => void;
  onMoveCards: (
    side: PlayerSide,
    cardIds: string[],
    sourceZone: ZoneType,
    toZone: ZoneType,
  ) => void;
  onEquipSpecific: (
    side: PlayerSide,
    cardId: string,
    sourceZone: ZoneType,
    monsterIndex: number,
  ) => void;
}

export const CemeteryAndExileModal: React.FC<CemeteryAndExileModalProps> = ({
  isOpen,
  cemetery,
  exile,
  monsters,
  side,
  label,
  onClose,
  onRecover,
  onMoveCards,
  onEquipSpecific,
}) => {
  const [activeTab, setActiveTab] = useState<'cemetery' | 'exile'>('cemetery');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // タブ切り替え時や閉じた時に選択状態をリセット
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  const currentCards = activeTab === 'cemetery' ? cemetery : exile;

  const handleToggleCard = (cardId: string) => {
    setSelectedIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  };

  const handleAction = (
    actionType: 'recover' | 'moveToExile' | 'moveToCemetery',
  ) => {
    if (selectedIds.length === 0) return;

    if (actionType === 'recover') {
      onRecover(side, selectedIds);
    } else if (actionType === 'moveToExile') {
      onMoveCards(side, selectedIds, 'cemetery', 'exile');
    } else if (actionType === 'moveToCemetery') {
      onMoveCards(side, selectedIds, 'exile', 'cemetery');
    }
    setSelectedIds([]);
  };

  const handleEquip = (monsterIndex: number) => {
    if (selectedIds.length === 1) {
      onEquipSpecific(side, selectedIds[0], activeTab, monsterIndex);
      setSelectedIds([]);
    }
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
          maxWidth: '700px',
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
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: 0 }}>{label} の墓地・除外確認</h3>
          <button onClick={onClose} style={{ cursor: 'pointer' }}>
            閉じる
          </button>
        </div>

        {/* タブ切り替え */}
        <div
          style={{
            display: 'flex',
            borderBottom: '2px solid #ddd',
            marginBottom: '16px',
          }}
        >
          <div
            onClick={() => setActiveTab('cemetery')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderBottom:
                activeTab === 'cemetery' ? '3px solid #007bff' : 'none',
              color: activeTab === 'cemetery' ? '#007bff' : '#555',
            }}
          >
            墓地 ({cemetery.length}枚)
          </div>
          <div
            onClick={() => setActiveTab('exile')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderBottom:
                activeTab === 'exile' ? '3px solid #dc3545' : 'none',
              color: activeTab === 'exile' ? '#dc3545' : '#555',
            }}
          >
            除外 ({exile.length}枚)
          </div>
        </div>

        <MonsterSummary
          monsters={monsters}
          label={label}
          side={side}
          idPrefix='modal_draw_summary'
        />

        {/* カード一覧 */}
        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignContent: 'flex-start',
          }}
        >
          {currentCards.length === 0 ? (
            <p style={{ color: '#888' }}>カードがありません。</p>
          ) : (
            currentCards.map((card) => {
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
                  }}
                >
                  <DraggableMana
                    mana={card}
                    side={side}
                    sourceZone={activeTab} // 現在のタブ ('cemetery' | 'exile') を sourceZone として渡す
                  >
                    <Card card={card} />
                  </DraggableMana>
                </div>
              );
            })
          )}
        </div>

        {/* アクション領域 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            marginTop: '16px',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
            選択中のカード: {selectedIds.length}枚
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab === 'cemetery' && (
              <>
                <button
                  onClick={() => handleAction('recover')}
                  disabled={selectedIds.length === 0}
                  style={{ padding: '6px 12px' }}
                >
                  山札に戻す(回復)
                </button>
                <button
                  onClick={() => handleAction('moveToExile')}
                  disabled={selectedIds.length === 0}
                  style={{ padding: '6px 12px' }}
                >
                  除外する
                </button>
              </>
            )}
            {activeTab === 'exile' && (
              <button
                onClick={() => handleAction('moveToCemetery')}
                disabled={selectedIds.length === 0}
                style={{ padding: '6px 12px' }}
              >
                墓地に戻す
              </button>
            )}

            <span
              style={{ borderLeft: '1px solid #ccc', margin: '0 4px' }}
            ></span>

            {[0, 1, 2].map((index) => (
              <DroppableSlot
                key={index}
                side={side}
                monsterIndex={index}
                slotIndex={0}
                slotName=''
                idPrefix='modal_cemetery' // モーダル専用IDプレフィックス
              >
                <button
                  key={index}
                  onClick={() => handleEquip(index)}
                  disabled={selectedIds.length !== 1}
                  style={{
                    padding: '6px 12px',
                    cursor:
                      selectedIds.length === 1 ? 'pointer' : 'not-allowed',
                  }}
                >
                  モンスター{index + 1}に装備
                </button>
              </DroppableSlot>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
