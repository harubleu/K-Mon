// src/components/ActionLogPanel.tsx

import React from 'react';
import type { ActionLog } from '../types';

interface ActionLogPanelProps {
  logs: ActionLog[];
}

export const ActionLogPanel: React.FC<ActionLogPanelProps> = ({ logs }) => {
  const getLogColor = (type: ActionLog['type']) => {
    switch (type) {
      case 'system':
        return 'text-gray-600 bg-gray-50';
      case 'mana':
        return 'text-blue-700 bg-blue-50';
      case 'draw':
        return 'text-green-700 bg-green-50';
      case 'attack':
        return 'text-red-700 bg-red-50';
      case 'alert':
        return 'text-orange-800 bg-orange-100 font-bold border-orange-300 border';
      default:
        return 'text-gray-800 bg-white';
    }
  };

  return (
    <div className='flex flex-col h-full bg-white border border-gray-300 rounded shadow-sm'>
      <div
        className='px-3 py-2 bg-gray-100 border-b border-gray-300 font-bold text-sm text-gray-700'
        style={{ fontSize: '1rem' }}
      >
        対戦ログ
      </div>
      <div
        className='flex-1 overflow-y-auto p-2 space-y-2'
        style={{ fontSize: '0.8rem', textAlign: 'left' }}
      >
        {logs.length === 0 ? (
          <p className='text-gray-400 text-sm text-center py-4'>
            ログはありません
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`text-sm p-2 rounded ${getLogColor(log.type)}`}
            >
              <span className='text-xs text-gray-500 mr-2'>
                [{log.timestamp}]
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
