// src/data/monsterEffects.ts

import type { MonsterEffect, PassiveEffect } from '../types';

// キー: masterData.ts の id ('m00001' 等)。各エントリの直前コメントに元のモンスター名を残す。
export interface MonsterEffectEntry {
  effect?: MonsterEffect;
  passiveEffect?: PassiveEffect | PassiveEffect[];
}

export const MONSTER_EFFECTS: Record<string, MonsterEffectEntry> = {
  // ============================================================
  // 第1弾_キホンのキ（18/18）
  // ============================================================
  // 言（ゲン）
  m00001: {
    effect: {
      effectId: 'janken_conditional_reduce',
      winCount: 6,
      loseCount: 1,
    },
  },
  // 信（シン）
  m00002: {
    effect: {
      effectId: 'janken_conditional_reduce',
      winCount: 10,
      loseCount: 2,
    },
  },
  // 兄（ケイ）
  m00003: { effect: { effectId: 'graveyard_select_equip', count: 1 } },
  // 残（ザン）
  m00004: { effect: { effectId: 'deck_reduce_fixed', count: 6 } },
  // 列（レツ）
  m00005: { effect: { effectId: 'deck_reduce_fixed', count: 3 } },
  // 友（ユウ）
  m00006: { effect: { effectId: 'graveyard_select_recover', count: 3 } },
  // 兵（ヘイ）
  m00007: { effect: { effectId: 'trash_monster_mana', targetScope: 'all' } },
  // 折（セツ）
  m00008: { effect: { effectId: 'trash_monster_mana', targetScope: 'single' } },
  // 械: targetKanji未指定＝発動時にユーザーが山札を見て種類を選択する想定
  // 械（カイ）
  m00009: { effect: { effectId: 'deck_kanji_purge', shuffleAfter: false } },
  // 格（カク）
  m00010: { effect: { effectId: 'deck_reduce_fixed', count: 5 } },
  // 各（カク）
  m00011: { effect: { effectId: 'graveyard_select_equip', count: 1 } },
  // 告（コク）
  m00012: {
    effect: {
      effectId: 'deck_predict_reveal_reduce',
      predictSide: 'self',
      onHit: { targetSide: 'opponent', count: 6 },
      onMiss: null,
    },
  },
  // 先（セン）
  m00013: { effect: { effectId: 'deck_full_reorder', targetSide: 'self' } },
  // 比（ヒ）
  m00014: {
    effect: { effectId: 'deck_compare_reduce', count: 5, tieBehavior: 'both' },
  },
  // 操: 着手後回し方針（design_document.md 7.3節・7.5節参照）。handlerKeyは仮置き
  // 操（ソウ）
  m00015: {
    effect: { effectId: 'custom', handlerKey: 'sou_copy_opponent_effect' },
  },
  // 品（ヒン）
  m00016: { effect: { effectId: 'graveyard_select_recover', count: 5 } },
  // 例（レイ）
  m00017: { effect: { effectId: 'deck_reduce_fixed', count: 5 } },
  // 競（キョウ）
  m00018: {
    effect: {
      effectId: 'janken_conditional_reduce',
      winCount: 20,
      loseCount: 3,
    },
  },

  // ============================================================
  // 第2弾_プラスオレンジ（8/8）
  // ============================================================
  // 招（ショウ）
  m00019: { effect: { effectId: 'janken_conditional_reduce', winCount: 8 } },
  // 右（ウ）
  m00020: { effect: { effectId: 'janken_conditional_reduce', winCount: 5 } },
  // 共（キョウ）
  m00021: { effect: { effectId: 'graveyard_select_equip', count: 1 } },
  // 援（エン）
  m00022: {
    effect: {
      effectId: 'graveyard_kanji_count_threshold',
      targetKanji: ['手'],
      thresholds: [
        { min: 9, max: 20, targetSide: 'opponent', count: 12 },
        { min: 1, max: 8, targetSide: null, count: 0 },
      ],
    },
  },
  // 侍（ジ）
  m00023: { effect: { effectId: 'deck_reduce_fixed', count: 5 } },
  // 代（ダイ）
  m00024: { effect: { effectId: 'swap_equipped_with_graveyard', maxCount: 3 } },
  // 武（ブ）
  m00025: { effect: { effectId: 'deck_reduce_fixed', count: 3 } },
  // 呪（ジュ）
  m00026: {
    effect: {
      effectId: 'deck_predict_reveal_reduce',
      predictSide: 'opponent',
      onHit: { targetSide: 'opponent', count: 8 },
      onMiss: null,
    },
  },

  // ============================================================
  // 第3弾_プラスピーチ（12/12）
  // ============================================================
  // 極（キョク）
  m00027: {
    effect: {
      effectId: 'deck_keep_rest_trash',
      targetSide: 'self',
      keepCount: 2,
      destination: 'cemetery',
    },
  },
  // 誓: targetKanji未指定＝発動時にユーザーが種類を宣言する想定
  // 誓（セイ）
  m00028: {
    effect: {
      effectId: 'deck_reveal_kanji_check',
      revealCount: 2,
      onMatch: { targetSide: 'opponent', count: 12 },
    },
  },
  // 森（シン）
  m00029: { effect: { effectId: 'graveyard_select_recover', count: 5 } },
  // 哲（テツ）
  m00030: {
    effect: {
      effectId: 'janken_conditional_reduce',
      winCount: 9,
      tieCount: 3,
      loseCount: 5,
      restrictOpponentHands: ['scissors', 'paper'],
    },
  },
  // 制（セイ）
  m00031: { effect: { effectId: 'deck_reduce_fixed', count: 6 } },
  // 仁: sourceKanji未指定＝ドロー元を毎回自由選択する想定
  // 仁（ジン）
  m00032: { passiveEffect: { trigger: 'draw_replace' } },
  // 末（マツ）
  m00033: { effect: { effectId: 'deck_reduce_fixed', count: 3 } },
  // 二（ニ）
  m00034: {
    effect: {
      effectId: 'choice_of_effects',
      options: [
        {
          label: 'こうげき',
          effect: { effectId: 'deck_reduce_fixed', count: 2 },
        },
        {
          label: 'かいふく',
          effect: { effectId: 'graveyard_select_recover', count: 2 },
        },
      ],
    },
  },
  // 三（サン）
  m00036: {
    effect: {
      effectId: 'choice_of_effects',
      options: [
        {
          label: 'こうげき',
          effect: { effectId: 'deck_reduce_fixed', count: 3 },
        },
        {
          label: 'かいふく',
          effect: { effectId: 'graveyard_select_recover', count: 3 },
        },
        {
          label: 'じゃま',
          effect: {
            effectId: 'trash_monster_mana',
            targetScope: 'select',
            count: 3,
          },
        },
      ],
    },
  },
  // 林（リン）
  m00035: { effect: { effectId: 'graveyard_select_recover', count: 3 } },
  // 音（オン）
  m00037: { passiveEffect: { trigger: 'janken_auto_win' } },
  // 本: 要:勝敗システム接続（design_document.md 6章参照）
  // 本（ホン）
  m00038: {
    effect: {
      effectId: 'deck_count_win_or_reduce',
      winCondition: { count: 0 },
      otherwise: { count: 5 },
    },
  },

  // ============================================================
  // 第4弾_プラスチェリー（12/12）
  // ============================================================
  // 剣: graveyard_kanji_count_linear（targetKanji:'all', bonus:0）へ統合済み
  // 剣（ケン）
  m00039: {
    effect: {
      effectId: 'graveyard_kanji_count_linear',
      targetKanji: 'all',
      bonus: 0,
    },
  },
  // 屍（シ）
  m00040: { effect: { effectId: 'choose_number_reduce_both', maxNumber: 8 } },
  // 詩（シ）
  m00041: {
    passiveEffect: {
      trigger: 'own_turn_start',
      action: { effectId: 'janken_conditional_reduce', winCount: 4 },
    },
  },
  // 持（ジ）
  m00042: {
    effect: {
      effectId: 'graveyard_kanji_count_threshold',
      targetKanji: ['手', '止'],
      thresholds: [
        { min: 10, max: 20, targetSide: 'opponent', count: 7 },
        { min: 1, max: 9, targetSide: 'opponent', count: 3 },
      ],
    },
  },
  // 抑（ヨク）
  m00043: { passiveEffect: { trigger: 'block_next_deck_reduce_effect' } },
  // 命（メイ）
  m00044: { passiveEffect: { trigger: 'draw_count_override', count: 2 } },
  // 死（シ）
  m00045: { effect: { effectId: 'choose_number_reduce_both', maxNumber: 5 } },
  // 寺（ジ）
  m00046: {
    effect: {
      effectId: 'graveyard_kanji_count_threshold',
      targetKanji: ['手', '止'],
      thresholds: [
        { min: 7, max: 20, targetSide: 'opponent', count: 4 },
        { min: 1, max: 6, targetSide: 'opponent', count: 2 },
      ],
    },
  },
  // 歩（ホ）
  m00047: {
    passiveEffect: {
      trigger: 'own_turn_start',
      action: { effectId: 'deck_reduce_fixed', count: 1 },
    },
  },
  // 令（レイ）
  m00048: { effect: { effectId: 'deck_select_equip', count: 1 } },
  // 合（ゴウ）
  m00049: {
    effect: { effectId: 'deck_compare_reduce', count: 5, tieBehavior: 'both' },
  },
  // 出（シュツ）
  m00050: {
    effect: {
      effectId: 'deck_compare_branch',
      fewerSideEffect: { effectId: 'graveyard_select_recover', count: 4 },
    },
  },

  // ============================================================
  // 第5弾_ファイヤーレッド（18/18）
  // ============================================================
  // 黒（コク）
  m00051: {
    effect: { effectId: 'deck_reduce_fixed', count: 2, destination: 'exile' },
  },
  // 煉（レン）
  m00052: {
    effect: {
      effectId: 'deck_reveal_kanji_check',
      revealCount: 1,
      targetKanji: ['火', '東'],
      onMatch: { targetSide: 'opponent', count: 5 },
      onMiss: { targetSide: 'self', count: 2 },
    },
  },
  // 重（ジュウ）
  m00053: {
    passiveEffect: { trigger: 'boost_own_deck_reduce_effect', extraCount: 1 },
  },
  // 並（ヘイ）
  m00054: {
    effect: { effectId: 'deck_full_reorder', targetSide: 'both', count: 10 },
  },
  // 走（ソウ）
  m00055: { effect: { effectId: 'draw_and_play_n', count: 2 } },
  // 逆（ギャク）
  m00056: { effect: { effectId: 'swap_deck_and_graveyard' } },
  // 浮（フ）
  m00057: {
    passiveEffect: { trigger: 'mitigate_deck_reduce_effect', amount: 3 },
  },
  // 泣: targetKanji未指定＝発動時にユーザーが色を選択する想定
  // 泣（キュウ）
  m00058: {
    effect: { effectId: 'deck_kanji_purge', count: 4, shuffleAfter: true },
  },
  // 光（コウ）
  m00059: {
    effect: {
      effectId: 'graveyard_select_recover',
      count: 2,
      placement: 'top',
    },
  },
  // 赤（セキ）
  m00060: {
    effect: { effectId: 'deck_reduce_fixed', count: 2, destination: 'exile' },
  },
  // 注: 浮との発動順依存の置換効果。custom（design_document.md 7.5節参照）
  // 注（チュウ）
  m00061: {
    effect: {
      effectId: 'custom',
      handlerKey: 'chu_redirect_own_reduce_to_opponent',
    },
  },
  // 脈（ミャク）
  m00062: {
    passiveEffect: {
      trigger: 'own_turn_start',
      action: { effectId: 'deck_reduce_fixed', count: 2 },
    },
  },
  // 製（セイ）
  m00063: {
    effect: {
      effectId: 'graveyard_kanji_count_linear',
      targetKanji: ['衣', '刀'],
      bonus: 4,
    },
  },
  // 初（ハツ）
  m00064: {
    effect: {
      effectId: 'deck_reveal_kanji_check',
      revealCount: 1,
      targetKanji: ['衣', '刀'],
      onMatch: { targetSide: 'opponent', count: 5 },
    },
  },
  // 育: 発動回数カウンタの型設計が未決定のため暫定custom（未解決論点9参照）
  // 育（イク）
  m00065: {
    effect: {
      effectId: 'custom',
      handlerKey: 'iku_scaling_by_activation_count',
    },
  },
  // 認（ニン）
  m00066: { effect: { effectId: 'monster_remove_from_game', count: 2 } },
  // 忍: 本・政と同系統のManaCardタグ付けが必要な遅延発動効果
  // 忍（ニン）
  m00067: {
    effect: {
      effectId: 'deck_mark_delayed_reduce',
      targetSide: 'opponent',
      revealPosition: 3,
      reduceCount: 7,
      destination: 'cemetery',
    },
  },
  // 刃（ジン）
  m00068: {
    effect: {
      effectId: 'choose_number_reduce',
      targetScope: 'opponent_only',
      maxNumber: 2,
    },
  },

  // ============================================================
  // 第6弾_サンダーイエロー（18/18）
  // ============================================================
  // 進（シン）
  m00069: {
    effect: {
      effectId: 'sequence',
      steps: [
        { effectId: 'deck_reduce_fixed', count: 4 },
        { effectId: 'trash_monster_mana', targetScope: 'select', count: 1 },
      ],
    },
  },
  // 集（シュウ）
  m00070: {
    effect: {
      effectId: 'graveyard_select_recover',
      count: 2,
      placement: 'top',
    },
  },
  // 推（スイ）
  m00071: {
    effect: {
      effectId: 'deck_predict_reveal_reduce',
      predictSide: 'self',
      onHit: { targetSide: 'opponent', count: 6 },
      onMiss: null,
    },
  },
  // 神（シン）
  m00072: {
    effect: { effectId: 'trash_monster_mana', targetScope: 'select', count: 2 },
  },
  // 電: ターン進行システムへの介入が必要（未解決論点、design_document.md 6章参照）。暫定custom
  // 電（デン）
  m00073: {
    effect: {
      effectId: 'custom',
      handlerKey: 'den_deck_reduce_and_extra_turn',
    },
  },
  // 伸（シン）
  m00074: {
    passiveEffect: {
      trigger: 'boost_own_deck_reduce_effect',
      extraCount: 1,
      scope: ['deck', 'monster_mana'],
    },
  },
  // 竜（リュウ）
  m00075: {
    effect: {
      effectId: 'deck_predict_reveal_reduce',
      predictSide: 'opponent',
      onHit: { targetSide: 'opponent', count: 4 },
      onMiss: null,
    },
  },
  // 究: 要:勝敗システム接続
  // 究（キュウ）
  m00076: {
    effect: {
      effectId: 'deck_predict_full_composition_win',
      onMiss: { shuffleAfter: true },
    },
  },
  // 雲（ウン）
  m00077: {
    effect: { effectId: 'deck_full_reorder', targetSide: 'opponent', count: 5 },
  },
  // 検（ケン）
  m00078: {
    effect: {
      effectId: 'deck_kanji_purge',
      kanjiCount: 2,
      revealScope: 'full',
      shuffleAfter: false,
    },
  },
  // 拾: own_kanji_to_graveyard_reaction（養）とは別物。自分のマナが墓地送りにされた直後に選んで装備
  // 拾（シュウ）
  m00079: {
    passiveEffect: {
      trigger: 'own_mana_trashed_by_opponent_reaction',
      selectAndEquipCount: 1,
    },
  },
  // 貨（カ）
  m00080: {
    effect: {
      effectId: 'graveyard_kanji_count_linear',
      targetKanji: ['貝'],
      bonus: 0,
    },
  },
  // 得（トク）
  m00081: {
    effect: {
      effectId: 'sequence',
      steps: [
        { effectId: 'deck_reduce_fixed', count: 3 },
        {
          effectId: 'graveyard_select_recover',
          count: 3,
          placement: 'shuffle',
        },
      ],
    },
  },
  // 負（フ）
  m00082: {
    effect: {
      effectId: 'deck_select_trash',
      targetSide: 'self',
      maxCount: 4,
      destination: 'cemetery',
    },
  },
  // 敗: 要:勝敗システム接続
  // 敗（ハイ）
  m00083: {
    effect: {
      effectId: 'deck_diff_threshold_win_or_reduce',
      threshold: 10,
      otherwiseCount: 3,
    },
  },
  // 敵（テキ）
  m00084: {
    passiveEffect: {
      trigger: 'redirect_own_deck_reduce',
      scope: { minCount: 1, maxCount: 6 },
      consumeAfterUse: false,
    },
  },
  // 識（シキ）
  m00085: {
    effect: {
      effectId: 'sequence',
      steps: [
        {
          effectId: 'deck_select_trash',
          targetSide: 'opponent',
          count: 8,
          destination: 'cemetery',
        },
        { effectId: 'deck_full_reorder', targetSide: 'opponent' }, // count未指定=残り全体
      ],
    },
  },
  // 吸: 抑と同系統の実行パイプライン割り込み（装備マナの墓地送り無効化）
  // 吸（キュウ）
  m00086: {
    effect: { effectId: 'custom', handlerKey: 'kyu_negate_own_mana_trash' },
  },

  // ============================================================
  // 限定カード（9/9）
  // ============================================================
  // 斧（フ）
  m00123: {
    effect: {
      effectId: 'mixed_zone_select_trash',
      targetSide: 'opponent',
      sources: ['monster_mana', 'deck'],
      count: 4,
      destination: 'cemetery',
    },
  },
  // 父（フ）
  m00124: { effect: { effectId: 'deck_reduce_fixed', count: 3 } },
  // 化（カ）
  m00125: {
    effect: {
      effectId: 'graveyard_recover_then_deck_trash_matching_count',
      recoverKanji: '人',
      maxRecoverCount: 5,
      trashExcludeKanji: '人',
    },
  },
  // 獄（ゴク）
  m00126: { effect: { effectId: 'monster_remove_from_game', count: 1 } },
  // 詳（ショウ）
  m00127: {
    effect: {
      effectId: 'deck_partial_reorder',
      targetSide: 'both',
      count: 5,
      faceUp: true,
    },
  },
  // 善（ゼン）
  m00128: {
    effect: {
      effectId: 'deck_predict_reveal_reduce',
      predictSide: 'self',
      revealCount: 2,
      onHit: { targetSide: 'opponent', count: 20 },
      onMiss: null,
    },
  },
  // 伏（フク）
  m00129: {
    effect: {
      effectId: 'graveyard_select_recover',
      count: 2,
      placement: 'top',
    },
  },
  // 扱（キュウ）
  m00130: {
    passiveEffect: {
      trigger: 'redirect_own_deck_reduce',
      scope: { fixedCount: 5 },
      consumeAfterUse: true,
    },
  },
  // 戒（カイ）
  m00131: {
    effect: {
      effectId: 'deck_iterative_reveal_until_condition',
      targetSide: 'opponent',
      destination: 'cemetery',
      stopConditions: { maxDistinctKanji: 3, maxCount: 9 },
    },
  },

  // ============================================================
  // 第7弾_ライフグリーン（18/18）
  // ============================================================
  // 草（ソウ）
  m00087: {
    effect: {
      effectId: 'deck_kanji_search_equip',
      targetKanji: '屮',
      maxCount: 3,
      excludeSelf: true,
    },
  },
  // 花: 同時に2つの永続効果を持つため配列で表現
  // 花（カ）
  m00088: {
    passiveEffect: [
      { trigger: 'mana_kanji_wildcard', targetKanji: '屮' },
      { trigger: 'draw_replace', sourceZone: 'graveyard', sourceKanji: '屮' },
    ],
  },
  // 生（セイ）
  m00089: {
    effect: {
      effectId: 'sequence',
      steps: [
        {
          effectId: 'deck_select_trash',
          targetSide: 'self',
          count: 2,
          destination: 'cemetery',
          shuffleAfter: true,
        },
        { effectId: 'graveyard_select_equip', count: 2, excludeSelf: true },
      ],
    },
  },
  // 星（セイ）
  m00090: {
    passiveEffect: {
      trigger: 'on_draw',
      targetKanji: ['日', '月'],
      onMatch: { targetSide: 'opponent', count: 3 },
    },
  },
  // 朝（チョウ）
  m00091: {
    effect: {
      effectId: 'deck_reveal_kanji_check',
      revealCount: 1,
      targetKanji: ['日', '月'],
      onMatch: { targetSide: 'opponent', count: 11 },
    },
  },
  // 明: 両者山札の最上位を常時公開するグローバル可視性ルール変更
  // 明（メイ）
  m00092: {
    effect: { effectId: 'custom', handlerKey: 'mei_flip_both_decks_visible' },
  },
  // 名（メイ）
  m00093: {
    effect: {
      effectId: 'deck_predict_reveal_reduce',
      predictSide: 'self',
      onHit: { targetSide: 'opponent', count: 6 },
      onMiss: null,
    },
  },
  // 葬（ソウ）
  m00094: { effect: { effectId: 'choose_number_reduce_both', maxNumber: 14 } },
  // 墓: 要:勝敗システム接続
  // 墓（ボ）
  m00095: {
    effect: {
      effectId: 'graveyard_total_count_threshold_win',
      threshold: 15,
      scope: 'combined',
    },
  },
  // 暮: 要:勝敗システム接続
  // 暮（ボ）
  m00096: {
    passiveEffect: {
      trigger: 'graveyard_kanji_threshold_win',
      targetKanji: '日',
      threshold: 5,
    },
  },
  // 石（セキ）
  m00097: { effect: { effectId: 'deck_reduce_fixed', count: 5 } },
  // 反（ハン）
  m00098: {
    effect: {
      effectId: 'flip_monster_facedown',
      targetSide: 'opponent',
      count: 1,
    },
  },
  // 返（ヘン）
  m00099: {
    passiveEffect: {
      trigger: 'redirect_own_deck_reduce',
      scope: { fixedCount: 8 },
      consumeAfterUse: true,
    },
  },
  // 圧（アツ）
  m00100: {
    passiveEffect: {
      trigger: 'redirect_own_deck_reduce',
      scope: { fixedCount: 12 },
      consumeAfterUse: true,
    },
  },
  // 吐（ト）
  m00101: {
    effect: {
      effectId: 'deck_select_trash',
      targetSide: 'self',
      maxCount: 4,
      destination: 'cemetery',
      shuffleAfter: true,
    },
  },
  // 炎（エン）
  m00102: {
    effect: { effectId: 'deck_reduce_fixed', count: 2, destination: 'exile' },
  },
  // 然（ゼン）
  m00103: {
    passiveEffect: {
      trigger: 'own_turn_start',
      action: {
        effectId: 'select_zone_move_one',
        targetSide: 'opponent',
        sourceOptions: ['deck_top', 'graveyard'],
        destination: 'exile',
      },
    },
  },
  // 燃（ネン）
  m00104: {
    effect: { effectId: 'deck_reduce_fixed', count: 7, destination: 'exile' },
  },

  // ============================================================
  // 第8弾_ウォーターブルー（18/18）
  // ============================================================
  // 流（リュウ）
  m00105: {
    passiveEffect: { trigger: 'on_opponent_draw_predict', onHit: { count: 2 } },
  },
  // 保: 保持ゾーンメカニクス。囲との共通化は保留（未解決論点8参照）
  // 保（ホ）
  m00106: {
    effect: {
      effectId: 'deck_partial_to_reserve',
      destination: 'reservedCards',
    },
  },
  // 派: 発動時にユーザーが上位8枚から色を選択する想定
  // 派（ハ）
  m00107: {
    effect: {
      effectId: 'deck_kanji_purge',
      revealScope: 8,
      shuffleAfter: true,
    },
  },
  // 養（ヨウ）
  m00108: {
    effect: {
      effectId: 'graveyard_select_recover',
      targetKanji: '羊',
      count: 'all',
      placement: 'shuffle',
    },
    passiveEffect: {
      trigger: 'own_kanji_to_graveyard_reaction',
      targetKanji: '羊',
      onTrigger: { targetSide: 'opponent', count: 1 },
    },
  },
  // 洋（ヨウ）
  m00109: {
    effect: { effectId: 'trash_monster_mana', targetScope: 'select', count: 2 },
  },
  // 美（ビ）
  m00110: {
    effect: {
      effectId: 'deck_partial_reorder',
      targetSide: 'choose',
      count: 3,
    },
  },
  // 浅: 要:勝敗システム接続
  // 浅（セン）
  m00111: {
    passiveEffect: {
      trigger: 'own_turn_start_win_condition',
      comparator: 'less_than',
      threshold: 5,
      targetSide: 'opponent',
    },
  },
  // 国: 要:勝敗システム接続
  // 国（コク）
  m00112: {
    effect: {
      effectId: 'deck_or_graveyard_count_win_condition',
      targetValues: [1, 9],
      scope: 'either_player_either_zone',
    },
  },
  // 或（ワク）
  m00113: {
    effect: {
      effectId: 'deck_normalize_to_count',
      targetCount: 10,
      overDestination: 'cemetery',
      underSource: 'graveyard_select',
      shuffleAfter: true,
    },
  },
  // 探（タン）
  m00114: {
    effect: {
      effectId: 'deck_select_trash',
      targetSide: 'opponent',
      count: 6,
      destination: 'cemetery',
      shuffleAfter: false,
    },
  },
  // 採: 他モンスターのslotsデータを実行時に参照する必要がある
  // 採（サイ）
  m00115: {
    effect: { effectId: 'custom', handlerKey: 'sai_auto_equip_from_slots' },
  },
  // 深: 最下段（0-1枚）は要:勝敗システム接続
  // 深（シン）
  m00116: {
    effect: {
      effectId: 'deck_count_tiered_effect',
      tiers: [
        { min: 11, max: 20, effect: { targetSide: 'opponent', count: 4 } },
        { min: 2, max: 10, effect: { targetSide: 'opponent', count: 7 } },
        { min: 0, max: 1, win: true },
      ],
    },
  },
  // 政: 要:勝敗システム接続、ManaCardへのIDタグ付け＋「未使用マナ」制約の監視が必要
  // 政（セイ）
  m00117: {
    effect: { effectId: 'custom', handlerKey: 'sei_seeded_mana_win_condition' },
  },
  // 正: 【修正】deck_select_equip類似→deck_select_trashが正しい分類
  // 正（セイ）
  m00118: {
    effect: {
      effectId: 'deck_select_trash',
      targetSide: 'opponent',
      count: 1,
      destination: 'cemetery',
      shuffleAfter: false,
    },
  },
  // 囲（イ）
  m00119: {
    passiveEffect: {
      trigger: 'shield_counter_deck_protection',
      bufferSize: 2,
      bufferSource: 'graveyard',
    },
  },
  // 激: 要:勝敗システム接続
  // 激（ゲキ）
  m00120: {
    passiveEffect: {
      trigger: 'own_turn_end_predict_win',
      predictTarget: 'opponent_next_draw',
      includeGraveyardDraw: true,
    },
  },
  // 方（ホウ）
  m00121: {
    effect: {
      effectId: 'sequence',
      steps: [
        {
          effectId: 'deck_select_trash',
          targetSide: 'self',
          maxCount: 4,
          destination: 'cemetery',
        },
        {
          effectId: 'graveyard_select_equip',
          count: 3,
          excludeSelf: true,
          sourceRestriction: 'just_trashed_by_this_effect',
        },
      ],
    },
  },
  // 泊（ハク）
  m00122: {
    passiveEffect: {
      trigger: 'disable_opponent_monster_effects',
      duration: { opponentTurns: 3 },
      consumeAfterUse: true,
    },
  },
};
