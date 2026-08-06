// src/App.tsx

import React from "react";
import { useGameState } from "./hooks/useGameState";
import { PlayerZone } from "./components/PlayerZone";
import { ActionArea } from "./components/ActionArea";
import type { PlayerSide, ZoneType } from "./types";

export const App: React.FC = () => {
  const { gameState, dispatch } = useGameState();

  // --- 手動アクションのハンドラー群 ---
  // 1. マナ装備処理（山札の先頭から装備）
  const handleEquipMana = (side: PlayerSide, monsterIndex: number) => {
    dispatch({
      type: "EQUIP_MANA",
      payload: { side, monsterIndex },
    });
  };

  // 2. マナ破棄・除外処理
  const handleTrashMana = (
    side: PlayerSide,
    monsterIndex: number,
    manaCardIds: "all" | string[],
    destination: "cemetery" | "exile",
  ) => {
    dispatch({
      type: "TRASH_MANA",
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
      type: "FLIP_MONSTER",
      payload: { side, monsterIndex },
    });
  };

  const handleDamage = (amount: number) => {
    dispatch({
      type: "DAMAGE",
      payload: { targetSide: "opponent", amount }, // 中央エリアからの操作は相手へのダメージを基本とする
    });
  };

  const handleRecover = (side: PlayerSide, manaIds: string[]) => {
    dispatch({
      type: "RECOVER",
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
      type: "MOVE_CARD_BETWEEN_ZONES",
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
      type: "EQUIP_SPECIFIC_MANA",
      payload: { side, monsterIndex, sourceZone, manaCardId },
    });
  };

  const handleShuffleDeck = (side: PlayerSide) => {
    dispatch({
      type: "SHUFFLE_DECK",
      payload: { side },
    });
  };

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "16px",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "1.25rem",
          textAlign: "center",
          marginBottom: "16px",
        }}
      >
        カンジモンスターズ 特訓用Webアプリ (フェーズ1: 手動操作サンドボックス)
      </h1>

      {/* [上段] Opponent (相手) エリア */}
      <PlayerZone
        playerState={gameState.opponent}
        side="opponent"
        label="相手"
        onEquipMana={handleEquipMana}
        onTrashMana={handleTrashMana}
        onFlipMonster={handleFlipMonster}
        onRecover={handleRecover}
        onMoveCards={handleMoveCards}
        onEquipSpecific={handleEquipSpecific}
        onShuffleDeck={handleShuffleDeck}
      />

      {/* [中段] アクション・情報表示エリア */}
      <ActionArea onDamage={handleDamage} />

      {/* [下段] Player (自分) エリア */}
      <PlayerZone
        playerState={gameState.player}
        side="player"
        label="自分"
        onEquipMana={handleEquipMana}
        onTrashMana={handleTrashMana}
        onFlipMonster={handleFlipMonster}
        onRecover={handleRecover}
        onMoveCards={handleMoveCards}
        onEquipSpecific={handleEquipSpecific}
        onShuffleDeck={handleShuffleDeck}
      />
    </div>
  );
};

export default App;
