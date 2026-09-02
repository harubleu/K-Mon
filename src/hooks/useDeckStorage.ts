// src/hooks/useDeckStorage.ts

import { useState, useEffect, useCallback } from 'react';
import type { PresetDeck } from '../types';

export interface SavedDeck {
  id: string;
  name: string;
  updatedAt: string;
  monsterIds: string[];
  manaCounts: Record<string, number>;
}

const STORAGE_KEY = 'kmon_saved_decks';

export const useDeckStorage = () => {
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);

  // LocalStorageからの読み込み
  const loadDecks = useCallback(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        setSavedDecks(JSON.parse(data));
      }
    } catch (e) {
      console.error('Failed to load decks from localStorage:', e);
    }
  }, []);

  // 初回マウント時に読み込み
  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // デッキの保存（新規または上書き）
  const saveDeck = useCallback(
    (
      name: string,
      monsterIds: string[],
      manaCounts: Record<string, number>,
      id?: string,
    ) => {
      try {
        const current = [...savedDecks];
        const newDeck: SavedDeck = {
          id: id || `deck_${Date.now()}`,
          name,
          updatedAt: new Date().toISOString(),
          monsterIds,
          manaCounts,
        };

        const index = current.findIndex((d) => d.id === newDeck.id);
        if (index >= 0) {
          current[index] = newDeck;
        } else {
          current.push(newDeck);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        setSavedDecks(current);
        return newDeck.id;
      } catch (e) {
        console.error('Failed to save deck:', e);
        return null;
      }
    },
    [savedDecks],
  );

  // デッキの削除
  const deleteDeck = useCallback(
    (id: string) => {
      const filtered = savedDecks.filter((d) => d.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      setSavedDecks(filtered);
    },
    [savedDecks],
  );

  // デッキコードの生成（Base64エンコード）
  // URL等に含めやすいよう、容量削減のためキーを短縮(m: monsters, c: counts)してエンコードします
  const exportDeckCode = useCallback(
    (monsterIds: string[], manaCounts: Record<string, number>): string => {
      try {
        const payload = JSON.stringify({ m: monsterIds, c: manaCounts });
        return btoa(encodeURIComponent(payload));
      } catch (e) {
        console.error('Failed to export deck code:', e);
        return '';
      }
    },
    [],
  );

  // デッキコードからの復元
  const importDeckCode = useCallback(
    (
      code: string,
    ): { monsterIds: string[]; manaCounts: Record<string, number> } | null => {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(code)));
        if (Array.isArray(decoded.m) && typeof decoded.c === 'object') {
          return { monsterIds: decoded.m, manaCounts: decoded.c };
        }
        return null;
      } catch {
        console.error('Invalid deck code.');
        return null;
      }
    },
    [],
  );

  // PresetDeck型への変換ユーティリティ（構築画面で読み込むために使用）
  const toPresetDeck = useCallback((deck: SavedDeck): PresetDeck => {
    return {
      id: deck.id,
      name: deck.name,
      folder: 'マイデッキ', // 保存したデッキ用の特別なフォルダ分類
      monsterIds: deck.monsterIds,
      manaCounts: deck.manaCounts,
    };
  }, []);

  return {
    savedDecks,
    saveDeck,
    deleteDeck,
    exportDeckCode,
    importDeckCode,
    toPresetDeck,
  };
};
