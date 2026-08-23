// src/components/PlayerZone.tsx

import React, { useState } from 'react';
import type { PlayerState, PlayerSide, ZoneType, ManaCard } from '../types'; // 【修正】ManaCardを追加
import { MonsterZone } from './MonsterZone';
import { Card } from './Card';
import { CemeteryAndExileModal } from './CemeteryAndExileModal';
import { DeckModal } from './DeckModal';
import { MonsterSummary } from './MonsterSummary';
import { DraggableMana } from './GameBoard/DraggableMana';
import { DroppableSlot } from './PlayerZone/DroppableSlot';

interface PlayerZoneProps {
  playerState: PlayerState;
  side: PlayerSide;
  label: string;
  onEquipMana: (side: PlayerSide, monsterIndex: number) => void;
  onTrashMana: (
    side: PlayerSide,
    monsterIndex: number,
    manaCardIds: 'all' | string[],
    destination: 'cemetery' | 'exile',
  ) => void;
  onFlipMonster: (side: PlayerSide, monsterIndex: number) => void;
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
  onShuffleDeck: (side: PlayerSide) => void;
  onDraw: (side: PlayerSide) => void;
}

export const PlayerZone: React.FC<PlayerZoneProps> = ({
  playerState,
  side,
  label,
  onEquipMana,
  onTrashMana,
  onFlipMonster,
  onRecover,
  onMoveCards,
  onEquipSpecific,
  onShuffleDeck,
  onDraw,
}) => {
  // モーダルの開閉状態を保持
  const [isCemeteryModalOpen, setIsCemeteryModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);

  // 【修正】ここに正しく移動。propsのplayerState/side/onTrashManaを参照できる
  const [selectedManaIds, setSelectedManaIds] = useState<string[]>([]);

  const handleToggleSelectMana = (manaId: string) => {
    setSelectedManaIds((prev) =>
      prev.includes(manaId)
        ? prev.filter((id) => id !== manaId)
        : [...prev, manaId],
    );
  };

  // 全モンスターを横断して選択中マナを一括で墓地/除外へ送る
  const handleBulkMoveSelectedMana = (destination: 'cemetery' | 'exile') => {
    playerState.monsters.forEach((monster, index) => {
      const monsterManaIds = monster.equippedMana
        .filter((m): m is ManaCard => m !== null)
        .map((m) => m.id);
      const targetIds = selectedManaIds.filter((id) =>
        monsterManaIds.includes(id),
      );
      if (targetIds.length > 0) {
        onTrashMana(side, index, targetIds, destination);
      }
    });
    setSelectedManaIds([]);
  };

  const topCemeteryCard = playerState.cemetery[playerState.cemetery.length - 1];
  const isAnyModalOpen =
    isCemeteryModalOpen ||
    isDeckModalOpen ||
    playerState.pendingDrawCards.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        margin: '8px 0',
      }}
    >
      {/* 左側: 山札 */}
      <div
        style={{
          width: '120px',
          textAlign: 'center',
          padding: '16px 8px',
          border: '1px dashed #888',
          borderRadius: '6px',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
          {label}山札
        </div>
        <div style={{ fontSize: '1.2rem', marginTop: '8px' }}>
          🎴 {playerState.deck.length}枚
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginTop: '8px',
          }}
        >
          <button
            onClick={() => setIsDeckModalOpen(true)}
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            山札確認/操作
          </button>
          <button
            onClick={() => onShuffleDeck(side)}
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            シャッフル
          </button>
          <button
            onClick={() => onDraw(side)}
            disabled={playerState.deck.length === 0}
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            1枚ドロー確認
          </button>
        </div>
      </div>

      {/* 中央: モンスター3枠 */}
      <div style={{ display: 'flex', justifyContent: 'center', flexGrow: 1 }}>
        <MonsterZone
          monsters={playerState.monsters}
          side={side}
          isDropDisabled={isAnyModalOpen}
          selectedManaIds={selectedManaIds}
          onToggleSelectMana={handleToggleSelectMana}
          onTrashMana={onTrashMana}
          onFlipMonster={onFlipMonster}
        />
      </div>

      {/* 右側: 墓地 / 除外 */}
      <div
        style={{
          width: '120px',
          textAlign: 'center',
          padding: '12px 8px',
          border: '1px dashed #888',
          borderRadius: '6px',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
          {label}墓地/除外
        </div>
        <div style={{ fontSize: '1.2rem', margin: '4px 0' }}>
          🪦 {playerState.cemetery.length} / 🌌 {playerState.exile.length}
        </div>
        <div style={{ minHeight: '30px', marginBottom: '6px' }}>
          {topCemeteryCard && (
            <DraggableMana
              mana={topCemeteryCard}
              side={side}
              sourceZone='cemetery'
            >
              <Card card={topCemeteryCard} size='sm' />
            </DraggableMana>
          )}
        </div>
        <button
          onClick={() => setIsCemeteryModalOpen(true)}
          style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer' }}
        >
          墓地・除外確認
        </button>
        <button
          onClick={() => handleBulkMoveSelectedMana('cemetery')}
          disabled={selectedManaIds.length === 0}
        >
          選択中マナを墓地へ ({selectedManaIds.length})
        </button>
        <button
          onClick={() => handleBulkMoveSelectedMana('exile')}
          disabled={selectedManaIds.length === 0}
        >
          選択中マナを除外へ
        </button>
      </div>

      {/* 墓地・除外一覧・操作モーダル */}
      <CemeteryAndExileModal
        isOpen={isCemeteryModalOpen}
        cemetery={playerState.cemetery}
        exile={playerState.exile}
        monsters={playerState.monsters}
        side={side}
        label={label}
        onClose={() => setIsCemeteryModalOpen(false)}
        onRecover={onRecover}
        onMoveCards={onMoveCards}
        onEquipSpecific={onEquipSpecific}
      />

      {/* 山札確認・操作モーダル */}
      <DeckModal
        isOpen={isDeckModalOpen}
        deck={playerState.deck}
        monsters={playerState.monsters}
        side={side}
        label={label}
        onClose={() => setIsDeckModalOpen(false)}
        onMoveCards={onMoveCards}
        onEquipSpecific={onEquipSpecific}
      />

      {/* ドロー確認モーダル */}
      {playerState.pendingDrawCards.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ marginTop: 0 }}>1枚ドロー確認 ({label})</h3>

            <MonsterSummary
              monsters={playerState.monsters}
              label={label}
              side={side}
              idPrefix='modal_pendingdraw_summary'
            />

            <div
              style={{
                marginBottom: '16px',
                fontSize: '1.2rem',
                textAlign: 'center',
                padding: '12px',
                border: '1px solid #ccc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '0.9rem', color: '#555' }}>
                引いたマナ:
              </span>
              <DraggableMana
                mana={playerState.pendingDrawCards[0]}
                side={side}
                sourceZone='pending'
              >
                <Card card={playerState.pendingDrawCards[0]} />
              </DraggableMana>
            </div>

            <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
              どのアクションを実行しますか？
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {playerState.monsters.map((monster, index) => (
                <DroppableSlot
                  key={monster.id}
                  side={side}
                  monsterIndex={index}
                  slotIndex={0}
                  slotName=''
                  idPrefix='modal_draw'
                  style={{ aspectRatio: 'auto', width: '100%' }}
                >
                  <button
                    key={monster.id}
                    onClick={() => {
                      onEquipSpecific(
                        side,
                        playerState.pendingDrawCards[0].id,
                        'pending',
                        index,
                      );
                    }}
                    style={{ padding: '8px', cursor: 'pointer' }}
                  >
                    {monster.name || `モンスター枠 ${index + 1}`} に装備
                  </button>
                </DroppableSlot>
              ))}

              <hr style={{ margin: '8px 0', width: '100%' }} />

              <button
                onClick={() => {
                  onMoveCards(
                    side,
                    [playerState.pendingDrawCards[0].id],
                    'pending',
                    'cemetery',
                  );
                }}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                墓地に送る
              </button>

              <button
                onClick={() => {
                  onMoveCards(
                    side,
                    [playerState.pendingDrawCards[0].id],
                    'pending',
                    'exile',
                  );
                }}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                除外に送る
              </button>

              <button
                onClick={() => {
                  onMoveCards(
                    side,
                    [playerState.pendingDrawCards[0].id],
                    'pending',
                    'deck',
                  );
                }}
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: '#6b7280',
                  color: '#fff',
                  border: '1px solid #4b5563',
                  fontWeight: 'bold',
                }}
              >
                キャンセル（山札の上に戻す）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
