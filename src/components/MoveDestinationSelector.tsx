// src/components/MoveDestinationSelector.tsx

import React, { useState } from 'react';
import type { PlayerSide } from '../types';

type MovableZone = 'deck' | 'cemetery' | 'exile';

interface MoveDestinationSelectorProps {
  currentSide: PlayerSide; // 現在このモーダル/タブが表示しているプレイヤー
  currentZone: MovableZone; // 現在このモーダル/タブが表示している領域
  selectedCount: number;
  onExecute: (targetSide: PlayerSide, targetZone: MovableZone) => void;
}

const ZONE_LABELS: Record<MovableZone, string> = {
  deck: '山札へ',
  cemetery: '墓地へ',
  exile: '除外へ',
};

// 現在の領域から見て、最もよく使われそうな移動先をデフォルトにする
const DEFAULT_TARGET_ZONE: Record<MovableZone, MovableZone> = {
  deck: 'cemetery',
  cemetery: 'deck',
  exile: 'cemetery',
};

export const MoveDestinationSelector: React.FC<
  MoveDestinationSelectorProps
> = ({ currentSide, currentZone, selectedCount, onExecute }) => {
  const [targetSide, setTargetSide] = useState<PlayerSide>(currentSide);
  const [targetZone, setTargetZone] = useState<MovableZone>(
    DEFAULT_TARGET_ZONE[currentZone],
  );

  // 移動先が「今まさに表示している領域」と完全一致する場合は無意味な操作なので禁止する
  const isSameLocation =
    targetSide === currentSide && targetZone === currentZone;
  const isDisabled = selectedCount === 0 || isSameLocation;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '8px',
        backgroundColor: '#f0f4f8',
        borderRadius: '4px',
      }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
        選択したカードを
      </span>
      <select
        value={targetSide}
        onChange={(e) => setTargetSide(e.target.value as PlayerSide)}
        style={{ padding: '4px', fontSize: '0.85rem' }}
      >
        <option value='player'>自分</option>
        <option value='opponent'>相手</option>
      </select>
      <span style={{ fontSize: '0.85rem' }}>の</span>
      <select
        value={targetZone}
        onChange={(e) => setTargetZone(e.target.value as MovableZone)}
        style={{ padding: '4px', fontSize: '0.85rem' }}
      >
        <option value='deck'>{ZONE_LABELS.deck}</option>
        <option value='cemetery'>{ZONE_LABELS.cemetery}</option>
        <option value='exile'>{ZONE_LABELS.exile}</option>
      </select>
      <button
        onClick={() => onExecute(targetSide, targetZone)}
        disabled={isDisabled}
        style={{
          padding: '6px 14px',
          fontSize: '0.85rem',
          backgroundColor: isDisabled ? '#ccc' : '#059669',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        移動 ({selectedCount}枚)
      </button>
      {isSameLocation && (
        <span style={{ fontSize: '0.75rem', color: '#dc3545' }}>
          ※現在表示中の領域と同じです
        </span>
      )}
    </div>
  );
};
