// src/components/GameStatusAlertModal.tsx

import React from 'react';
import type { GameStatus } from '../types';

interface GameStatusAlertModalProps {
  status: GameStatus;
  onRestart: () => void;
  onBackToTitle: () => void;
}

export const GameStatusAlertModal: React.FC<GameStatusAlertModalProps> = ({
  status,
  onRestart,
  onBackToTitle,
}) => {
  if (status === 'playing') return null;

  const getStatusMessage = () => {
    switch (status) {
      case 'player_win':
        return { title: 'YOU WIN!', color: 'text-blue-600' };
      case 'opponent_win':
        return { title: 'YOU LOSE', color: 'text-red-600' };
      case 'draw':
        return { title: 'DRAW', color: 'text-gray-600' };
      default:
        return { title: 'GAME OVER', color: 'text-gray-800' };
    }
  };

  const { title, color } = getStatusMessage();

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white p-8 rounded-lg shadow-xl text-center max-w-sm w-full mx-4'>
        <h2 className={`text-4xl font-black mb-6 ${color}`}>{title}</h2>
        <div className='space-y-4 flex flex-col'>
          <button
            onClick={onRestart}
            className='w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-colors'
          >
            もう一度対戦する
          </button>
          <button
            onClick={onBackToTitle}
            className='w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded transition-colors'
          >
            タイトルに戻る
          </button>
        </div>
      </div>
    </div>
  );
};
