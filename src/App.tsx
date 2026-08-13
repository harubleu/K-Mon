// src/App.tsx

import React, { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { PlayerZone } from './components/PlayerZone';
import { ActionArea } from './components/ActionArea';
import { DeckBuilder } from './components/DeckBuilder/DeckBuilder';
import { JankenModal } from './components/GameBoard/JankenModal';
import type { PlayerSide, ZoneType, MonsterCard, ManaCard } from './types'; // 必要な型を追加

export const App: React.FC = () => {
  const { gameState, dispatch, undo, canUndo, redo, canRedo } = useGameState();
  // 画面の切り替え状態を管理 (true: デッキ構築画面, false: 対戦画面)
  const [isBuildingDeck, setIsBuildingDeck] = useState(true);
  const [isJankenModalOpen, setIsJankenModalOpen] = useState(false);
  const [jankenPurpose, setJankenPurpose] = useState<'start' | 'battle'>(
    'start',
  );

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
    setJankenPurpose('start');
    setIsJankenModalOpen(true);
  };

  const handleJankenComplete = (firstPlayer?: PlayerSide) => {
    // start目的で、かつ結果がある場合のみターンプレイヤーをセット
    if (jankenPurpose === 'start' && firstPlayer) {
      dispatch({
        type: 'SET_TURN_PLAYER',
        payload: { turnPlayer: firstPlayer },
      });
    }
    setIsJankenModalOpen(false);
  };

  // 追加: バトル用じゃんけんモーダルを閉じる
  const handleJankenClose = () => {
    setIsJankenModalOpen(false);
  };

  // 追加: メインフェーズからのじゃんけん呼び出し
  const handleBattleJanken = () => {
    setJankenPurpose('battle');
    setIsJankenModalOpen(true);
  };

  const handleDeckMill = (targetSide: PlayerSide, count: number) => {
    const targetDeck = gameState[targetSide].deck;
    if (targetDeck.length === 0) return;

    // 山札の上（先頭）から指定枚数分のカードIDを取得
    const cardsToMove = targetDeck.slice(0, count).map((card) => card.id);

    // 既存の領域移動アクションを再利用して墓地へ送る
    dispatch({
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: {
        side: targetSide,
        cardIds: cardsToMove,
        sourceZone: 'deck',
        targetZone: 'cemetery',
      },
    });
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
        カンジモンスターズ 特訓用Webアプリ
      </h1>

      {/* じゃんけんモーダル */}
      <JankenModal
        isOpen={isJankenModalOpen}
        purpose={jankenPurpose} // 追加
        onComplete={handleJankenComplete}
        onClose={handleJankenClose} // 追加
      />

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
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
      />

      {/* [中段] アクション・情報表示エリア */}
      <ActionArea
        turnPlayer={gameState.turnPlayer}
        turnCount={gameState.turnCount}
        currentPhase={gameState.currentPhase}
        onNextPhase={handleNextPhase}
        onDamage={handleDamage}
        onJanken={handleBattleJanken} // 追加
        onDeckMill={handleDeckMill} // 追加
        onUndo={undo} // 追加
        canUndo={canUndo} // 追加
        onRedo={redo} // 追加
        canRedo={canRedo} // 追加
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
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
      />
    </div>
  );
};

export default App;
