// src/components/DeckBuilder/DeckBuilder.tsx

import React, { useState } from 'react';
import { useDeckBuilder } from '../../hooks/useDeckBuilder';
import { MonsterSelector } from './MonsterSelector';
import { ManaSelector } from './ManaSelector';
import type { ManaCard, MonsterCard } from '../../types';
import { PresetDeckPanel } from './PresetDeckPanel';
import { SelectionSidebar } from './SelectionSidebar';
import { MyDeckStoragePanel } from '../MyDeckStoragePanel';
import { useDeckStorage } from '../../hooks/useDeckStorage';

interface DeckBuilderProps {
  playerBuilder: ReturnType<typeof useDeckBuilder>;
  opponentBuilder: ReturnType<typeof useDeckBuilder>;
  onStartGame: (
    playerMonsters: MonsterCard[],
    playerDeck: ManaCard[],
    opponentMonsters: MonsterCard[],
    opponentDeck: ManaCard[],
  ) => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  playerBuilder,
  opponentBuilder,
  onStartGame,
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'opponent'>('player');
  const [isOpen, setIsOpen] = useState(false);
  const currentBuilder =
    activeTab === 'player' ? playerBuilder : opponentBuilder;

  // デッキ保存・読み込み用フックの呼び出し
  const deckStorage = useDeckStorage();

  const handleStart = () => {
    if (
      playerBuilder.recipe.monsterIds.length !== 3 ||
      opponentBuilder.recipe.monsterIds.length !== 3
    ) {
      alert('自分と相手の両方でモンスターを3体ずつ選択してください。');
      return;
    }
    if (
      playerBuilder.totalManaCount !== 20 ||
      opponentBuilder.totalManaCount !== 20
    ) {
      alert('自分と相手の両方でマナを20枚ずつにしてください。');
      return;
    }

    const pData = playerBuilder.generateGameCards();
    const oData = opponentBuilder.generateGameCards();
    onStartGame(pData.monsters, pData.deck, oData.monsters, oData.deck);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h2>デッキ構築（一人回し準備）</h2>
        <button
          onClick={handleStart}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.1rem',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          このデッキで対戦を開始する
        </button>
      </div>

      {/* プレイヤー/相手 切り替えタブ */}
      <div
        style={{
          display: 'flex',
          marginBottom: '20px',
          borderBottom: '2px solid #ccc',
        }}
      >
        <button
          onClick={() => setActiveTab('player')}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '1.2rem',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'player' ? '#e9ecef' : 'transparent',
            fontWeight: activeTab === 'player' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
          }}
        >
          自分のデッキ {playerBuilder.recipe.monsterIds.length}/3体 -{' '}
          {playerBuilder.totalManaCount}/20枚
        </button>
        <button
          onClick={() => setActiveTab('opponent')}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '1.2rem',
            cursor: 'pointer',
            border: 'none',
            backgroundColor:
              activeTab === 'opponent' ? '#e9ecef' : 'transparent',
            fontWeight: activeTab === 'opponent' ? 'bold' : 'normal',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
          }}
        >
          相手のデッキ {opponentBuilder.recipe.monsterIds.length}/3体 -{' '}
          {opponentBuilder.totalManaCount}/20枚
        </button>
      </div>

      <div
        style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '0 0 8px 8px',
          border: '1px solid #dee2e6',
        }}
      >
        <PresetDeckPanel
          onLoadPreset={currentBuilder.loadPreset}
          onClearDeck={currentBuilder.clearDeck}
        />

        {/* 追加: マイデッキ保存・デッキコード管理パネル */}
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #ccc',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            onClick={() => setIsOpen((prev) => !prev)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem' }}>マイデッキ保存</h3>
            <span style={{ fontSize: '0.85rem', color: '#555' }}>
              {isOpen ? '▲ 閉じる' : '▼ 開く'}
            </span>
          </div>
          {isOpen && (
            <div style={{ marginTop: '12px' }}>
              <MyDeckStoragePanel
                currentMonsterIds={currentBuilder.recipe.monsterIds}
                currentManaCounts={currentBuilder.manaCounts}
                onLoadDeck={(deck) =>
                  currentBuilder.loadPreset(deckStorage.toPresetDeck(deck))
                }
              />
            </div>
          )}
        </div>

        {/* 左右3分割レイアウト */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div
            style={{
              flex: '3.5',
              backgroundColor: '#fff',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
          >
            <MonsterSelector
              selectedMonsterIds={currentBuilder.recipe.monsterIds}
              onToggleMonster={currentBuilder.toggleMonster}
              manaCounts={currentBuilder.manaCounts}
            />
          </div>

          <div
            style={{
              flex: '1.3',
              backgroundColor: '#fff',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
          >
            <ManaSelector
              manaCounts={currentBuilder.manaCounts}
              onUpdateCount={currentBuilder.updateManaCount}
              onAutoFill={currentBuilder.autoFillMana}
              isAutoFillDisabled={currentBuilder.recipe.monsterIds.length === 0}
              selectedMonsterIds={currentBuilder.recipe.monsterIds}
            />
          </div>

          {/* 選択状況サイドパネル */}
          <SelectionSidebar
            monsterIds={currentBuilder.recipe.monsterIds}
            manaCounts={currentBuilder.manaCounts}
            onUpdateCount={currentBuilder.updateManaCount}
            onClearMonsters={currentBuilder.clearMonsters}
            onClearMana={currentBuilder.clearMana}
            onReorderMonsters={currentBuilder.reorderMonsters}
          />
        </div>
      </div>
    </div>
  );
};
