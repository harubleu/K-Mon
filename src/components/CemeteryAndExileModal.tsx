// src/components/CemeteryAndExileModal.tsx

import React, { useState, useEffect } from 'react';
import type { ManaCard, MonsterCard, PlayerSide, ZoneType } from '../types';
import { Card } from './Card';
import { MonsterSummary } from './MonsterSummary';
import { DraggableMana } from './GameBoard/DraggableMana';
import { DroppableSlot } from './PlayerZone/DroppableSlot';
import { MoveDestinationSelector } from './MoveDestinationSelector';

interface CemeteryAndExileModalProps {
  isOpen: boolean;
  cemetery: ManaCard[];
  exile: ManaCard[];
  monsters: MonsterCard[];
  side: PlayerSide;
  label: string;
  onClose: () => void;
  // 【注記】このモーダルからの「山札に戻す(回復)」呼び出しは、汎用セレクターへの
  // 統合により行わなくなりました。onRecoverは現在このファイル内では未使用ですが、
  // 呼び出し元(PlayerZone.tsx/App.tsx)のprops構造を壊さないためprops自体は残しています。
  // 完全に不要であれば、propsごと削除しても問題ありません。
  onRecover: (side: PlayerSide, manaIds: string[]) => void;
  onMoveCards: (params: {
    sourceSide: PlayerSide;
    targetSide: PlayerSide;
    cardIds: string[];
    sourceZone: ZoneType;
    targetZone: ZoneType;
  }) => void;
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
  onMoveCards,
  onEquipSpecific,
}) => {
  const [activeTab, setActiveTab] = useState<'cemetery' | 'exile'>('cemetery');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
          idPrefix='modal_cemetery_summary'
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
                  <DraggableMana mana={card} side={side} sourceZone={activeTab}>
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

          {/* 【修正】タブごとに出し分けていた3つのボタンを汎用セレクターに置き換え */}
          <MoveDestinationSelector
            currentSide={side}
            currentZone={activeTab}
            selectedCount={selectedIds.length}
            onExecute={(targetSide, targetZone) => {
              onMoveCards({
                sourceSide: side,
                targetSide,
                cardIds: selectedIds,
                sourceZone: activeTab,
                targetZone,
              });
              setSelectedIds([]);
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                borderLeft: '1px solid #ccc',
                margin: '0 4px',
                height: '24px',
              }}
            ></span>

            {[0, 1, 2].map((index) => (
              <DroppableSlot
                key={index}
                side={side}
                monsterIndex={index}
                slotIndex={0}
                slotName=''
                idPrefix='modal_cemetery'
                style={{ aspectRatio: 'auto' }}
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
