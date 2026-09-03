// src/components/GameBoard/JankenModal.tsx
//
// 【フェーズ5後半で拡張】従来の'start'(先攻後攻決定)・'battle'(手動汎用ツール)に加え、
// じゃんけん系モンスター効果(言・信・競・招・右・哲)の決着UIとしても流用する。
// - あいこの扱い: resolveTieAsOutcomeがtrue(=tieCountが定義された効果。現状は哲のみ)の場合、
//   あいこも決着として扱いonBattleResultで通知する。false/未指定なら従来通り再戦。
// - restrictOpponentHands: 哲(あいてはチョキ・パーのみ)のように、CPU側の手を制限する効果に対応。
// - onBattleResult: 決着結果(win/tie/lose)を呼び出し元(効果解決)へ通知する。

import React, { useState } from 'react';
import type { PlayerSide } from '../../types';

type Hand = 'rock' | 'scissors' | 'paper';
type Outcome = 'win' | 'tie' | 'lose';

interface JankenModalProps {
  isOpen: boolean;
  purpose: 'start' | 'battle';
  onComplete: (firstPlayer?: PlayerSide) => void;
  onClose: () => void;
  // 【追加】効果解決連携用(未指定なら従来通りのフリーツール動作)
  restrictOpponentHands?: Hand[];
  resolveTieAsOutcome?: boolean;
  onBattleResult?: (outcome: Outcome) => void;
}

const HAND_LABELS: Record<Hand, string> = {
  rock: 'グー ✊',
  scissors: 'チョキ ✌️',
  paper: 'パー ✋',
};

const ALL_HANDS: Hand[] = ['rock', 'scissors', 'paper'];

export const JankenModal: React.FC<JankenModalProps> = ({
  isOpen,
  purpose,
  onComplete,
  onClose,
  restrictOpponentHands,
  resolveTieAsOutcome = false,
  onBattleResult,
}) => {
  const [playerHand, setPlayerHand] = useState<Hand | null>(null);
  const [cpuHand, setCpuHand] = useState<Hand | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  // 【変更】isWinner(boolean|null) → outcome(tri-state)。tieが独立した決着になり得るため。
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPlayerHand(null);
      setCpuHand(null);
      setResultMessage(null);
      setOutcome(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // battle目的かつ「tieCountが定義された効果」の場合のみ、あいこを決着として扱う。
  // start目的(先攻後攻決定)は常に再戦(コイントスの性質上、あいこに意味を持たせる必要がないため)。
  const tieIsDecisive = purpose === 'battle' && resolveTieAsOutcome;

  const handleJanken = (hand: Hand) => {
    const pool =
      restrictOpponentHands && restrictOpponentHands.length > 0
        ? restrictOpponentHands
        : ALL_HANDS;
    const randomCpuHand = pool[Math.floor(Math.random() * pool.length)];
    setPlayerHand(hand);
    setCpuHand(randomCpuHand);

    let result: Outcome;
    if (hand === randomCpuHand) {
      result = 'tie';
    } else if (
      (hand === 'rock' && randomCpuHand === 'scissors') ||
      (hand === 'scissors' && randomCpuHand === 'paper') ||
      (hand === 'paper' && randomCpuHand === 'rock')
    ) {
      result = 'win';
    } else {
      result = 'lose';
    }

    if (result === 'tie' && !tieIsDecisive) {
      // あいこ＝再戦(決着していない状態に戻す)
      setResultMessage('あいこです！もう一度手を選んでください。');
      setOutcome(null);
      return;
    }

    setOutcome(result);
    if (result === 'win') {
      setResultMessage(
        purpose === 'start'
          ? '勝利！先攻・後攻を選択してください。'
          : 'じゃんけんに勝利しました！',
      );
    } else if (result === 'lose') {
      setResultMessage(
        purpose === 'start'
          ? '敗北... 相手（CP）が先攻になります。'
          : 'じゃんけんに敗北しました...',
      );
    } else {
      // tie かつ 決着扱い(battle purposeでresolveTieAsOutcome時のみ到達)
      setResultMessage('あいこでした。');
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

  const handleConfirmBattleResult = () => {
    if (outcome) onBattleResult?.(outcome);
    onClose();
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
          {outcome === null && (
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
                {ALL_HANDS.map((hand) => (
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
                    outcome === 'win'
                      ? '#2e7d32'
                      : outcome === 'lose'
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
          {purpose === 'start' && outcome === 'win' && (
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
          {purpose === 'start' && outcome === 'lose' && (
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

          {/* purpose === 'battle' の場合、決着済み(win/lose、またはtieが決着扱い)の時のみ確認ボタンを表示。
              【修正】従来は resultMessage の有無だけで判定しており、あいこ＝再戦待ちの状態でも
              このボタンが同時に表示されてしまっていた(効果解決に転用すると未決着のまま確定できてしまう
              事故につながるバグだったため、outcomeが決着値を持つ場合のみに修正)。 */}
          {purpose === 'battle' &&
            (outcome === 'win' ||
              outcome === 'lose' ||
              (outcome === 'tie' && tieIsDecisive)) && (
              <button
                onClick={handleConfirmBattleResult}
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
