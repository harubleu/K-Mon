// src/components/DeckBuilder/PresetDeckPanel.tsx

import React, { useState, useMemo } from 'react';
import { PRESET_DECKS } from '../../data/presetDecks';
import type { PresetDeck } from '../../types';

interface PresetDeckPanelProps {
  onLoadPreset: (preset: PresetDeck) => void;
  onClearDeck: () => void;
}

export const PresetDeckPanel: React.FC<PresetDeckPanelProps> = ({
  onLoadPreset,
  onClearDeck,
}) => {
  const folders = useMemo(
    () => Array.from(new Set(PRESET_DECKS.map((p) => p.folder))),
    [],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>(folders[0]);

  const filteredPresets = useMemo(
    () => PRESET_DECKS.filter((p) => p.folder === activeFolder),
    [activeFolder],
  );

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '12px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #ccc',
        width: '100%',
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
        <h3 style={{ margin: 0, fontSize: '1rem' }}>
          オススメデッキ（プリセット）から選ぶ
        </h3>
        <span style={{ fontSize: '0.85rem', color: '#555' }}>
          {isOpen ? '▲ 閉じる' : '▼ 開く'}
        </span>
      </div>

      {isOpen && (
        <div style={{ marginTop: '12px' }}>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '12px',
              borderBottom: '2px solid #eee',
              paddingBottom: '8px',
            }}
          >
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: activeFolder === folder ? 'none' : '1px solid #ccc',
                  backgroundColor:
                    activeFolder === folder ? '#007bff' : 'transparent',
                  color: activeFolder === folder ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontWeight: activeFolder === folder ? 'bold' : 'normal',
                  fontSize: '0.85rem',
                }}
              >
                {folder}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onLoadPreset(preset)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              >
                {preset.name}
              </button>
            ))}
            <button
              onClick={onClearDeck}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                borderRadius: '4px',
                border: '1px solid #dc3545',
                color: '#dc3545',
                marginLeft: 'auto',
              }}
            >
              全てクリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
