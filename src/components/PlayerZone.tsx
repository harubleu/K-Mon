// src/components/PlayerZone.tsx

import React, { useState } from 'react';
import type { PlayerState, PlayerSide, ZoneType } from '../types';
import { MonsterZone } from './MonsterZone';
import { Card } from './Card';
import { CemeteryAndExileModal } from './CemeteryAndExileModal';
import { DeckModal } from './DeckModal'; // DeckModalをインポート

interface PlayerZoneProps {
  playerState: PlayerState;
  side: PlayerSide;
  label: string;
  onEquipMana: (side: PlayerSide, monsterIndex: number) => void;
  onTrashMana: (
    side: PlayerSide,
    monsterIndex: number,
    manaCardIds: 'all' | string[],
    destination: 'cemetery' | 'exile'
  ) => void;
  onFlipMonster: (side: PlayerSide, monsterIndex: number) => void;
  onRecover: (side: PlayerSide, manaIds: string[]) => void;
  onMoveCards: (side: PlayerSide, cardIds: string[], sourceZone: ZoneType, toZone: ZoneType) => void; // 修正
  onEquipSpecific: (side: PlayerSide, cardId: string, sourceZone: ZoneType, monsterIndex: number) => void; // 修正
  onShuffleDeck: (side: PlayerSide) => void;
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
}) => {
  // モーダルの開閉状態を保持
  const [isCemeteryModalOpen, setIsCemeteryModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false); // 山札モーダルの状態
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false); // ドロー確認モーダルの開閉状態

  const topCemeteryCard = playerState.cemetery[playerState.cemetery.length - 1];

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
      {/* 左側: 山札 (裏向きカードアイコン ＋ 枚数表示) */}
      <div
        style={{
          width: '120px',
          textAlign: 'center',
          padding: '16px 8px',
          border: '1px dashed #888',
          borderRadius: '6px',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{label}山札</div>
        <div style={{ fontSize: '1.2rem', marginTop: '8px' }}>
          🎴 {playerState.deck.length}枚
        </div>
        {/* 山札操作ボタンエリアをフレックスボックスで縦並びに変更 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
          <button
            onClick={() => setIsDeckModalOpen(true)}
            style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer' }}
          >
            山札確認/操作
          </button>
          <button
            onClick={() => onShuffleDeck(side)}
            style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer' }}
          >
            シャッフル
          </button>
          <button
            onClick={() => setIsDrawModalOpen(true)}
            disabled={playerState.deck.length === 0}
            style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer' }}
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
          onEquipMana={onEquipMana}
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
        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{label}墓地/除外</div>
        <div style={{ fontSize: '1.2rem', margin: '4px 0' }}>
          🪦 {playerState.cemetery.length} / 🌌 {playerState.exile.length}
        </div>
        <div style={{ minHeight: '30px', marginBottom: '6px' }}>
          {topCemeteryCard && <Card card={topCemeteryCard} size="sm" />}
        </div>
        <button
          onClick={() => setIsCemeteryModalOpen(true)}
          style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer' }}
        >
          墓地・除外確認
        </button>
      </div>

      {/* 墓地・除外一覧・操作モーダル */}
      <CemeteryAndExileModal
        isOpen={isCemeteryModalOpen}
        cemetery={playerState.cemetery}
        exile={playerState.exile}
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
        side={side}
        label={label}
        onClose={() => setIsDeckModalOpen(false)}
        onMoveCards={onMoveCards}
        onEquipSpecific={onEquipSpecific}
      />

      {/* ドロー確認モーダル */}
      {isDrawModalOpen && playerState.deck.length > 0 && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}
        >
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', minWidth: '300px' }}>
            <h3 style={{ marginTop: 0 }}>1枚ドロー確認</h3>
            
            {/* 先頭カードの情報を表示 */}
            <div style={{ marginBottom: '20px', fontSize: '1.2rem', textAlign: 'center', padding: '16px', border: '1px solid #ccc' }}>
              カード色: <strong>{playerState.deck[0].color}</strong>
            </div>
            
            <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>どのアクションを実行しますか？</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* 各モンスターへの装備ボタン */}
              {playerState.monsters.map((monster, index) => (
                <button
                  key={monster.id}
                  onClick={() => {
                    onEquipSpecific(side, playerState.deck[0].id, 'deck', index);
                    setIsDrawModalOpen(false);
                  }}
                  style={{ padding: '8px', cursor: 'pointer' }}
                >
                  {monster.name || `モンスター枠 ${index + 1}`} に装備
                </button>
              ))}
              
              <hr style={{ margin: '8px 0', width: '100%' }} />
              
              {/* 墓地 / 除外 への移動ボタン */}
              <button
                onClick={() => {
                  onMoveCards(side, [playerState.deck[0].id], 'deck', 'cemetery');
                  setIsDrawModalOpen(false);
                }}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                墓地に送る
              </button>
              
              <button
                onClick={() => {
                  onMoveCards(side, [playerState.deck[0].id], 'deck', 'exile');
                  setIsDrawModalOpen(false);
                }}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                除外に送る
              </button>
              
              {/* キャンセルボタン (状態を変更せずに閉じる) */}
              <button
                onClick={() => setIsDrawModalOpen(false)}
                style={{ marginTop: '16px', padding: '8px', cursor: 'pointer', backgroundColor: '#eee', border: 'none' }}
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