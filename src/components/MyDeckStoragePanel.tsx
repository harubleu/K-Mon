// src/components/MyDeckStoragePanel.tsx

import React, { useState } from 'react';
import { useDeckStorage, type SavedDeck } from '../hooks/useDeckStorage';

interface MyDeckStoragePanelProps {
  currentMonsterIds: string[];
  currentManaCounts: Record<string, number>;
  onLoadDeck: (deck: SavedDeck) => void;
}

export const MyDeckStoragePanel: React.FC<MyDeckStoragePanelProps> = ({
  currentMonsterIds,
  currentManaCounts,
  onLoadDeck,
}) => {
  const { savedDecks, saveDeck, deleteDeck, exportDeckCode, importDeckCode } =
    useDeckStorage();

  const [deckName, setDeckName] = useState('');
  const [importCode, setImportCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = () => {
    if (!deckName.trim()) {
      setErrorMsg('デッキ名を入力してください');
      return;
    }
    if (currentMonsterIds.length === 0) {
      setErrorMsg('モンスターが選択されていません');
      return;
    }
    saveDeck(deckName, currentMonsterIds, currentManaCounts);
    setDeckName('');
    setErrorMsg('');
  };

  const handleImport = () => {
    const imported = importDeckCode(importCode);
    if (imported) {
      // 仮想のSavedDeckとして読み込ませる
      onLoadDeck({
        id: `imported_${Date.now()}`,
        name: 'インポートされたデッキ',
        updatedAt: new Date().toISOString(),
        monsterIds: imported.monsterIds,
        manaCounts: imported.manaCounts,
      });
      setImportCode('');
      setErrorMsg('');
    } else {
      setErrorMsg('無効なデッキコードです');
    }
  };

  const handleCopyCode = () => {
    const code = exportDeckCode(currentMonsterIds, currentManaCounts);
    navigator.clipboard.writeText(code).then(() => {
      alert('デッキコードをクリップボードにコピーしました');
    });
  };

  return (
    <div className='bg-white p-4 border rounded shadow-sm flex flex-col space-y-6 text-sm'>
      {errorMsg && <p className='text-red-500 font-bold'>{errorMsg}</p>}

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* 保存済みデッキ一覧 */}
        <div
          className='space-y-2'
          style={{
            flex: '1',
          }}
        >
          <h3
            className='font-bold text-gray-700'
            style={{ margin: 0, fontSize: '1rem' }}
          >
            保存済みデッキ一覧
          </h3>
          {savedDecks.length === 0 ? (
            <p className='text-gray-400'>保存されたデッキはありません</p>
          ) : (
            <ul className='space-y-2 max-h-48 overflow-y-auto'>
              {savedDecks.map((deck) => (
                <li
                  key={deck.id}
                  className='flex justify-between items-center border p-2 rounded bg-gray-50'
                >
                  <div className='font-medium truncate mr-2'>
                    <span
                      style={{
                        padding: '24px',
                        fontSize: '0.85rem',
                      }}
                    >
                      {deck.name}
                    </span>
                    <button
                      onClick={() => onLoadDeck(deck)}
                      className='bg-blue-500 text-white px-3 py-1 rounded text-xs'
                    >
                      展開
                    </button>
                    <button
                      onClick={() => deleteDeck(deck.id)}
                      className='bg-red-500 text-white px-3 py-1 rounded text-xs'
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 保存・エクスポートエリア */}
        <div
          className='space-y-2 border-b pb-4'
          style={{
            flex: '1',
          }}
        >
          <h3
            className='font-bold text-gray-700'
            style={{ margin: 0, fontSize: '1rem' }}
          >
            現在のデッキを保存
          </h3>
          <div className='flex space-x-2'>
            <input
              type='text'
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder='デッキ名'
              className='border p-2 rounded flex-1'
            />
            <button
              onClick={handleSave}
              className='bg-green-600 text-white px-4 py-2 rounded'
            >
              保存
            </button>
          </div>
          <button
            onClick={handleCopyCode}
            className='w-full mt-2 bg-gray-100 text-gray-700 border px-4 py-2 rounded'
          >
            現在のデッキコードをコピー
          </button>
        </div>

        {/* インポートエリア */}
        <div
          className='space-y-2 border-b pb-4'
          style={{
            flex: '1',
          }}
        >
          <h3
            className='font-bold text-gray-700'
            style={{ margin: 0, fontSize: '1rem' }}
          >
            デッキコードからインポート
          </h3>
          <div className='flex space-x-2'>
            <input
              type='text'
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder='デッキコードを貼り付け'
              className='border p-2 rounded flex-1'
            />
            <button
              onClick={handleImport}
              className='bg-blue-600 text-white px-4 py-2 rounded'
            >
              読込
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
