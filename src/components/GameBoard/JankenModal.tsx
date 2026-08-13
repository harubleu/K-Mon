// src/components/GameBoard/JankenModal.tsx

import React, { useState } from 'react';
import type { PlayerSide } from '../../types';

interface JankenModalProps {
  isOpen: boolean;
  purpose: 'start' | 'battle'; // 追加: 'start' = 先攻後攻決定用, 'battle' = 効果処理用
  onComplete: (firstPlayer?: PlayerSide) => void; // 任意パラメータに変更
  onClose: () => void; // 追加: バトル用閉じる処理
}

type Hand = 'rock' | 'scissors' | 'paper';

const HAND_LABELS: Record<Hand, string> = {
  rock: 'グー ✊',
  scissors: 'チョキ ✌️',
  paper: 'パー ✋',
};

export const JankenModal: React.FC<JankenModalProps> = ({
  isOpen,
  purpose,
  onComplete,
  onClose,
}) => {
  const [playerHand, setPlayerHand] = useState<Hand | null>(null);
  const [cpuHand, setCpuHand] = useState<Hand | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);

  // 追加: モーダルが開かれるたびに状態をリセットする処理
  React.useEffect(() => {
    if (isOpen) {
      setPlayerHand(null);
      setCpuHand(null);
      setResultMessage(null);
      setIsWinner(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJanken = (hand: Hand) => {
    const hands: Hand[] = ['rock', 'scissors', 'paper'];
    const randomCpuHand = hands[Math.floor(Math.random() * hands.length)];
    setPlayerHand(hand);
    setCpuHand(randomCpuHand);

    if (hand === randomCpuHand) {
      setResultMessage('あいこです！もう一度手を選んでください。');
      setIsWinner(null);
    } else if (
      (hand === 'rock' && randomCpuHand === 'scissors') ||
      (hand === 'scissors' && randomCpuHand === 'paper') ||
      (hand === 'paper' && randomCpuHand === 'rock')
    ) {
      setResultMessage(
        purpose === 'start'
          ? '勝利！先攻・後攻を選択してください。'
          : 'じゃんけんに勝利しました！',
      );
      setIsWinner(true);
    } else {
      setResultMessage(
        purpose === 'start'
          ? '敗北... 相手（CP）が先攻になります。'
          : 'じゃんけんに敗北しました...',
      );
      setIsWinner(false);
    }
  };

  const handleDirectSelect = (side: PlayerSide | 'random') => {
    if (side === 'random') {
      const randomSide: PlayerSide =
        Math.random() < 0.5 ? 'player' : 'opponent';
      onComplete(randomSide);
    } else {
      onComplete(side);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '480px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {purpose === 'start' ? '先攻・後攻の決定' : 'じゃんけん勝負'}
        </h2>

        {/* じゃんけん勝負エリア */}
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
          }}
        >
          {isWinner === null && (
            <div>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                手を選択してください
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                {(['rock', 'scissors', 'paper'] as Hand[]).map((hand) => (
                  <button
                    key={hand}
                    onClick={() => handleJanken(hand)}
                    style={{
                      padding: '10px 16px',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                    }}
                  >
                    {HAND_LABELS[hand]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultMessage && (
            <div style={{ marginTop: '12px' }}>
              {playerHand && cpuHand && (
                <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
                  あなた: {HAND_LABELS[playerHand]} vs 相手:{' '}
                  {HAND_LABELS[cpuHand]}
                </p>
              )}
              <p
                style={{
                  color:
                    isWinner === true
                      ? '#2e7d32'
                      : isWinner === false
                        ? '#c62828'
                        : '#e65100',
                  fontWeight: 'bold',
                }}
              >
                {resultMessage}
              </p>
            </div>
          )}

          {/* purpose === 'start' の場合のみ先攻後攻の選択ボタンを表示 */}
          {purpose === 'start' && isWinner === true && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '16px',
              }}
            >
              <button
                onClick={() => onComplete('player')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                自分が先攻
              </button>
              <button
                onClick={() => onComplete('opponent')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#757575',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                相手が先攻
              </button>
            </div>
          )}
          {purpose === 'start' && isWinner === false && (
            <button
              onClick={() => onComplete('opponent')}
              style={{
                padding: '8px 16px',
                marginTop: '12px',
                backgroundColor: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              対戦を開始する（相手先攻）
            </button>
          )}

          {/* purpose === 'battle' の場合は結果確認用の閉じるボタンを表示 */}
          {purpose === 'battle' && resultMessage && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                marginTop: '16px',
                backgroundColor: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              確認して閉じる
            </button>
          )}
        </div>

        {/* ダイレクト選択エリアは 'start' の時のみ表示 */}
        {purpose === 'start' && (
          <>
            <hr
              style={{
                border: 'none',
                borderTop: '1px solid #e0e0e0',
                margin: '16px 0',
              }}
            />
            <div>
              <h3 style={{ marginTop: 0, fontSize: '1.0rem', color: '#555' }}>
                直接選択（スキップ）
              </h3>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '12px',
                }}
              >
                <button
                  onClick={() => handleDirectSelect('player')}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#e3f2fd',
                    color: '#0d47a1',
                    border: '1px solid #90caf9',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  自分先攻
                </button>
                <button
                  onClick={() => handleDirectSelect('opponent')}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#fbe9e7',
                    color: '#b71c1c',
                    border: '1px solid #ffab91',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  相手先攻
                </button>
                <button
                  onClick={() => handleDirectSelect('random')}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f3e5f5',
                    color: '#4a148c',
                    border: '1px solid #ce93d8',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ランダム
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
