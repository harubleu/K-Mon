// src/data/presetDecks.ts

import type { PresetDeck } from '../types';

export const PRESET_DECKS: PresetDeck[] = [
  {
    id: 'preset_01',
    name: '神チーム',
    monsterIds: ['m00002', 'm00001', 'm00003'],
    manaCounts: {
      辛: 6,
      口: 8,
      人: 6,
    },
  },
  {
    id: 'preset_02',
    name: '死神チーム',
    monsterIds: ['m00004', 'm00005', 'm00006'],
    manaCounts: {
      戈: 4,
      歹: 8,
      刀: 6,
      手: 2,
    },
  },
  {
    id: 'preset_03',
    name: 'おじゃまチーム',
    monsterIds: ['m00007', 'm00008', 'm00009'],
    manaCounts: {
      斤: 6,
      木: 4,
      戈: 2,
      手: 8,
    },
  },
  {
    id: 'preset_04',
    name: 'つよいチーム',
    monsterIds: ['m00010', 'm00011', 'm00012'],
    manaCounts: {
      止: 6,
      木: 6,
      口: 8,
    },
  },
  {
    id: 'preset_05',
    name: 'へんなチーム',
    monsterIds: ['m00013', 'm00012', 'm00014'],
    manaCounts: {
      人: 6,
      木: 6,
      口: 6,
      止: 2,
    },
  },
];
