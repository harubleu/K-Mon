// src/App.tsx

import React, { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { PlayerZone } from './components/PlayerZone';
import { ActionArea } from './components/ActionArea';
import { DeckBuilder } from './components/DeckBuilder/DeckBuilder';
import { JankenModal } from './components/GameBoard/JankenModal';
import type { PlayerSide, ZoneType, MonsterCard, ManaCard } from './types'; // 必要な型を追加
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

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
    const setFlipped = (monsters: MonsterCard[]) =>
      monsters.map((m) => ({ ...m, isFlipped: true }));
    dispatch({
      type: 'SET_INITIAL_STATE',
      payload: {
        player: { monsters: setFlipped(playerMonsters), deck: playerDeck },
        opponent: {
          monsters: setFlipped(opponentMonsters),
          deck: opponentDeck,
        },
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

  const handleDeckMill = (
    targetSide: PlayerSide,
    count: number,
    destination: ZoneType = 'cemetery',
  ) => {
    const targetDeck = gameState[targetSide].deck;
    if (targetDeck.length === 0) return;

    const cardsToMove = targetDeck.slice(0, count).map((card) => card.id);

    dispatch({
      type: 'MOVE_CARD_BETWEEN_ZONES',
      payload: {
        side: targetSide,
        cardIds: cardsToMove,
        sourceZone: 'deck',
        targetZone: destination,
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

  // 1. D&D用センサーの設定（ボタンクリック動作と誤判定されないよう5pxの遊びを設定）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  // 2. ドラッグ終了時のハンドラー
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as
      | {
          manaCardId: string;
          side: PlayerSide;
          sourceZone: ZoneType;
        }
      | undefined;

    const overData = over.data.current as
      | {
          side: PlayerSide;
          monsterIndex: number;
          slotIndex: number;
        }
      | undefined;

    if (activeData && overData) {
      dispatch({
        type: 'EQUIP_SPECIFIC_MANA',
        payload: {
          side: overData.side,
          monsterIndex: overData.monsterIndex,
          sourceZone: activeData.sourceZone,
          manaCardId: activeData.manaCardId,
          targetSlotIndex: overData.slotIndex,
        },
      });
    }
  };

  // --- デッキ構築画面のレンダリング ---
  if (isBuildingDeck) {
    return <DeckBuilder onStartGame={handleStartGame} />;
  }

  // --- 対戦画面 (サンドボックス) のレンダリング ---
  return (
    // 3. 対戦画面全体を <DndContext> で包む
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 16px 16px 16px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 画面上部 固定ヘッダー */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: '#ffffff',
            borderBottom: '2px solid #e5e7eb',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={undo}
              disabled={!canUndo}
              style={{
                padding: '6px 12px',
                backgroundColor: canUndo ? '#4b5563' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              ↩ 1手戻す
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              style={{
                padding: '6px 12px',
                backgroundColor: canRedo ? '#4b5563' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: canRedo ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              やり直す ↪
            </button>
          </div>

          <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>
            カンジモンスターズ 特訓用Webアプリ
          </h1>
        </header>

        {/* じゃんけんモーダル */}
        <JankenModal
          isOpen={isJankenModalOpen}
          purpose={jankenPurpose}
          onComplete={handleJankenComplete}
          onClose={handleJankenClose}
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
        />

        {/* [中段] アクション・情報表示エリア */}
        <ActionArea
          turnPlayer={gameState.turnPlayer}
          turnCount={gameState.turnCount}
          onSwitchTurn={handleNextPhase}
          onDraw={handleAutoDraw}
          onJanken={handleBattleJanken}
          onDeckMill={handleDeckMill}
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
    </DndContext>
  );
};

export default App;
