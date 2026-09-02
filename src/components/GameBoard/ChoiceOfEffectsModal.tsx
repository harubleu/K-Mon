// src/components/GameBoard/ChoiceOfEffectsModal.tsx
//
// フェーズ5: choice_of_effects(二・三)用。選択肢から1つ選ばせる軽量モーダル。
// 選ばれた後の実際の効果解決はuseEffectExecutor.ts側で再帰的に行われるため、
// このモーダルはラベルの提示とインデックスの返却のみを担当する。

import React from 'react';

interface ChoiceOfEffectsModalProps {
  isOpen: boolean;
  options: { label: string; supported: boolean }[];
  onConfirm: (selectedIndex: number) => void;
  onCancel: () => void;
}

export const ChoiceOfEffectsModal: React.FC<ChoiceOfEffectsModalProps> = ({
  isOpen,
  options,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

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
          maxWidth: '500px',
          width: '90%',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0' }}>効果を1つ選んでください</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => option.supported && onConfirm(index)}
              disabled={!option.supported}
              style={{
                padding: '10px',
                cursor: option.supported ? 'pointer' : 'not-allowed',
                opacity: option.supported ? 1 : 0.4,
                border: '1px solid #ccc',
                borderRadius: '6px',
                backgroundColor: '#fff',
                textAlign: 'left',
              }}
            >
              {option.label}
              {!option.supported && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#888',
                    marginLeft: '8px',
                  }}
                >
                  (現在非対応)
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={onCancel}
            style={{ padding: '6px 14px', cursor: 'pointer' }}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
