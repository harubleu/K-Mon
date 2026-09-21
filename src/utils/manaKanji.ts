// src/utils/manaKanji.ts
//
// 【花の万能化】マナカードの「実効的な漢字」。花(mana_kanji_wildcard)が表向きのとき、屮は
// 1つの色を指定して他のマナとして使える(公式QA: 使う時に一つの色を指定する。表向きの間は
// 墓地の屮も含めていつでも指定・指定し直しができる)。指定はカード実体(designatedKanji)に
// 持たせ、カード効果が漢字を判定する箇所は、このヘルパー経由で実効的な漢字を参照する。
// 例外: 究(deck_predict_full_composition_win)は指定で回避できない(公式QA)ため、
// 素のkanjiのまま比較する。

import type { ManaCard } from '../types';
import { MANA_MASTER_LIST } from '../data/masterData';

export function getEffectiveKanji(card: ManaCard): string {
  return card.designatedKanji ?? card.kanji;
}

// 【今回追加】色指定されたマナの表示色。指定なしは元のhexColor。
export function getDisplayColor(card: ManaCard): string {
  if (card.designatedKanji === undefined) return card.hexColor;
  return (
    MANA_MASTER_LIST.find((m) => m.kanji === card.designatedKanji)?.hexColor ??
    card.hexColor
  );
}

// 【今回追加】選択UIの漢字絞り込み。実効的な漢字、または素のkanji(万能マナは装備時に色が
// 指定されるため、素の屮も対象に含める)のいずれかが絞り込みに含まれていればtrue。
export function matchesKanjiFilter(card: ManaCard, filter: string[]): boolean {
  return filter.includes(getEffectiveKanji(card)) || filter.includes(card.kanji);
}
