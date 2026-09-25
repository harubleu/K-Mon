// src/components/GameBoard/WildcardDesignationModal.tsx
//
// 花(mana_kanji_wildcard)の色指定UI。表向きの花がいる間、屮(万能マナ)を他の色として使うために
// 指定する。公式QA: 使う時に一つの色を指定する。墓地の屮も含めて、いつでも指定・指定し直しが可能。
// 装備時はつけたスロットの漢字へ自動で指定される(reducer側)。このモーダルは、墓地・山札・
// 保留領域・装備中の屮への手動指定用(墓地の枚数を数える効果や、相手の検から逃れる指定等に使う)。

import React from 'react';
import type { ManaCard } from '../../types';
import { MANA_MASTER_LIST } from '../../data/masterData';
import { Card } from '../Card';

export interface WildcardCandidate {
  card: ManaCard;
  zoneLabel: string;
}

interface WildcardDesignationModalProps {
  isOpen: boolean;
  wildcardKanji: string;
  candidates: WildcardCandidate[];
  onDesignate: (cardId: string, kanji: string | null) => void;
  onClose: () => void;
}

export const WildcardDesignationModal: React.FC<
  WildcardDesignationModalProps
> = ({ isOpen, wildcardKanji, candidates, onDesignate, onClose }) => {
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
        // 【今回改訂・検×花の指定UI】DeckModal(effectKanjiSelect実行中)から開かれた場合、
        // その上に重ねて表示する必要があるため、他モーダル(zIndex:1000)より高くする。
        zIndex: 1100,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '640px',
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0' }}>
          花の色指定（{wildcardKanji}を他のマナとして使う）
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 12px 0' }}>
          {wildcardKanji}
          は1枚ごとに1つの色を指定できます。いつでも指定し直せます。花が裏向きになると、
          他の色としてつけていた{wildcardKanji}は墓地へ行きます。
        </p>

        {candidates.length === 0 ? (
          <p style={{ color: '#888' }}>指定できる{wildcardKanji}がありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {candidates.map(({ card, zoneLabel }) => (
              <div
                key={card.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  border: '1px solid #eee',
                  borderRadius: '4px',
                }}
              >
                <Card card={card} />
                <span style={{ fontSize: '0.75rem', color: '#666', width: '90px' }}>
                  {zoneLabel}
                </span>
                <select
                  value={card.designatedKanji ?? wildcardKanji}
                  onChange={(e) =>
                    onDesignate(
                      card.id,
                      e.target.value === wildcardKanji ? null : e.target.value,
                    )
                  }
                  style={{ padding: '4px' }}
                >
                  <option value={wildcardKanji}>{wildcardKanji}（指定なし）</option>
                  {MANA_MASTER_LIST.filter((m) => m.kanji !== wildcardKanji).map(
                    (m) => (
                      <option key={m.kanji} value={m.kanji}>
                        {m.kanji}（{m.reading}）
                      </option>
                    ),
                  )}
                </select>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', cursor: 'pointer' }}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
