// src/App.tsx

import React, { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { PlayerZone } from './components/PlayerZone';
import { ActionArea } from './components/ActionArea';
import { DeckBuilder } from './components/DeckBuilder/DeckBuilder';
import type { PlayerSide, ZoneType, MonsterCard, ManaCard } from './types'; // 必要な型を追加

export const App: React.FC = () => {
  const { gameState, dispatch } = useGameState();
  // 画面の切り替え状態を管理 (true: デッキ構築画面, false: 対戦画面)
  const [isBuildingDeck, setIsBuildingDeck] = useState(true);

  // デッキ構築完了時のハンドラー
  const handleStartGame = (
    playerMonsters: MonsterCard[],
    playerDeck: ManaCard[],
    opponentMonsters: MonsterCard[],
    opponentDeck: ManaCard[],
  ) => {
    dispatch({
      type: 'SET_INITIAL_STATE',
      payload: {
        player: { monsters: playerMonsters, deck: playerDeck },
        opponent: { monsters: opponentMonsters, deck: opponentDeck },
      },
    });
    setIsBuildingDeck(false);
  };

  // --- 手動アクションのハンドラー群 ---
  // 1. マナ装備処理（山札の先頭から装備）
  const handleEquipMana = (side: PlayerSide, monsterIndex: number) => {
    dispatch({
      type: 'EQUIP_MANA',
      payload: { side, monsterIndex },
    });
  };

  // 2. マナ破棄・除外処理
  const handleTrashMana = (
    side: PlayerSide,
    monsterIndex: number,
    manaCardIds: 'all' | string[],
    destination: 'cemetery' | 'exile',
  ) => {
    dispatch({
      type: 'TRASH_MANA',
      payload: {
        side,
        monsterIndex,
        manaCardIds,
        destination,
      },
    });
  };

  // 3. モンスター反転処理
  const handleFlipMonster = (side: PlayerSide, monsterIndex: number) => {
    dispatch({
      type: 'FLIP_MONSTER',
      payload: { side, monsterIndex },
    });
  };

  const handleDamage = (amount: number) => {
    dispatch({
      type: 'DAMAGE',
      payload: { targetSide: 'opponent', amount }, // 中央エリアからの操作は相手へのダメージを基本とする
    });
  };

  const handleRecover = (side: PlayerSide, manaIds: string[]) => {
    dispatch({
      type: 'RECOVER',
      payload: { side, manaCardIds: manaIds },
    });
  };

  const handleMoveCards = (
    side: PlayerSide,
    cardIds: string[],
    sourceZone: ZoneType,
    targetZone: ZoneType,
  ) => {
    dispatch({
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: { side, cardIds, sourceZone, targetZone },
    });
  };

  const handleEquipSpecific = (
    side: PlayerSide,
    manaCardId: string,
    sourceZone: ZoneType,
    monsterIndex: number,
  ) => {
    dispatch({
      type: 'EQUIP_SPECIFIC_MANA',
      payload: { side, monsterIndex, sourceZone, manaCardId },
    });
  };

  const handleShuffleDeck = (side: PlayerSide) => {
    dispatch({
      type: 'SHUFFLE_DECK',
      payload: { side },
    });
  };
  const handleNextPhase = () => {
    dispatch({ type: 'NEXT_PHASE' });
  };

  const handleAutoDraw = (player: PlayerSide) => {
    dispatch({
      type: 'AUTO_DRAW',
      payload: { player },
    });
    // ※今後、ここに「1枚ドロー確認」モーダル等を開く処理を追加します
  };
  // --- デッキ構築画面のレンダリング ---
  if (isBuildingDeck) {
    return <DeckBuilder onStartGame={handleStartGame} />;
  }

  // --- 対戦画面 (サンドボックス) のレンダリング ---
  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '16px',
        fontFamily: 'sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: '1.25rem',
          textAlign: 'center',
          marginBottom: '16px',
        }}
      >
        カンジモンスターズ 特訓用Webアプリ (フェーズ1: 手動操作サンドボックス)
      </h1>

      {/* [上段] Opponent (相手) エリア */}
      <PlayerZone
        playerState={gameState.opponent}
        side='opponent'
        label='相手'
        onEquipMana={handleEquipMana}
        onTrashMana={handleTrashMana}
        onFlipMonster={handleFlipMonster}
        onRecover={handleRecover}
        onMoveCards={handleMoveCards}
        onEquipSpecific={handleEquipSpecific}
        onShuffleDeck={handleShuffleDeck}
        onDraw={handleAutoDraw}
      />

      {/* [中段] アクション・情報表示エリア */}
      <ActionArea
        turnPlayer={gameState.turnPlayer}
        turnCount={gameState.turnCount}
        currentPhase={gameState.currentPhase}
        onNextPhase={handleNextPhase}
        onAutoDraw={handleAutoDraw}
        onDamage={handleDamage}
      />

      {/* [下段] Player (自分) エリア */}
      <PlayerZone
        playerState={gameState.player}
        side='player'
        label='自分'
        onEquipMana={handleEquipMana}
        onTrashMana={handleTrashMana}
        onFlipMonster={handleFlipMonster}
        onRecover={handleRecover}
        onMoveCards={handleMoveCards}
        onEquipSpecific={handleEquipSpecific}
        onShuffleDeck={handleShuffleDeck}
        onDraw={handleAutoDraw}
      />
    </div>
  );
};

export default App;
