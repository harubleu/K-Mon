// src/types/index.ts
// --- フェーズ定義 ---
export type GamePhase = 'start' | 'draw' | 'main' | 'end';

// ============================================================
// フェーズ5: モンスター効果ショートカット化
// ============================================================

// masterDataの効果定義専用の相対的な向き。PlayerSide（ゲーム状態の絶対的なキー）とは別物。
// executorが効果解決時に「そのモンスターの所有者」を基準にPlayerSideへ変換する。
// （MonsterEffect/PassiveEffectより前で宣言し、参照順を明確にする）
export type RelativeSide = 'self' | 'opponent';

// --- 1回起動型の効果 ---
export type MonsterEffect =
  | {
      effectId: 'deck_reduce_fixed';
      count: number;
      destination?: 'cemetery' | 'exile';
    }
  | {
      effectId: 'janken_conditional_reduce';
      winCount?: number;
      tieCount?: number;
      loseCount?: number;
      restrictOpponentHands?: ('rock' | 'scissors' | 'paper')[];
    }
  | {
      effectId: 'graveyard_select_equip';
      count: number;
      // 【変更】excludeSelf(boolean)から統合。装備先モンスターを選ばせる場合の
      // 除外/包含を1つのフィールドで表現する。
      // undefined: モンスター選択フェーズ無し。従来通り発動元自身へ自動装備
      // 'exclude_self': 装備先を選べるが、発動元自身は除外(生・方)
      // 'include_self': 装備先を選べる。発動元自身も選択可(兄)
      monsterTargetMode?: 'exclude_self' | 'include_self';
      sourceRestriction?: 'just_trashed_by_this_effect';
    }
  | { effectId: 'deck_select_equip'; count: number }
  | {
      effectId: 'graveyard_select_recover';
      count: number | 'all';
      placement?: 'shuffle' | 'top';
      targetKanji?: string;
    }
  | {
      effectId: 'trash_monster_mana';
      targetScope: 'single' | 'all' | 'select';
      count?: number;
    }
  | {
      effectId: 'deck_kanji_purge';
      // 【変更】targetKanjiを削除。実データ4件(械・泣・検・派)を確認した結果、
      // 対象の漢字種類はカード固定ではなく常に発動時にプレイヤーが選ぶ仕様と判明したため。
      kanjiCount?: number; // 選ぶ漢字種類の数(未指定なら1)
      count?: number; // 1種類あたり何枚まで墓地へ送るか(未指定なら無制限=該当分すべて)
      // 【変更】revealCount(number)から変更。
      // undefined: 公開せず、候補の漢字種類を制限しない(械・泣。山札に無い色も選択可能)
      // 'full'   : 山札全体を公開し、実在する色のみに候補を制限する(検)
      // number   : 山札の上からN枚のみを公開し、そのN枚に実在する色のみに候補を制限する(派)
      revealScope?: 'full' | number;
      shuffleAfter: boolean;
    }
  | {
      effectId: 'graveyard_kanji_count_threshold';
      targetKanji: string[];
      thresholds: {
        min: number;
        max: number;
        targetSide: RelativeSide | null;
        count: number;
      }[];
    }
  | {
      effectId: 'graveyard_kanji_count_linear';
      targetKanji: string[] | 'all';
      bonus: number;
    }
  | {
      effectId: 'deck_full_reorder';
      targetSide?: RelativeSide | 'both';
      count?: number;
    }
  | { effectId: 'swap_equipped_with_graveyard'; maxCount: number }
  | { effectId: 'deck_compare_reduce'; count: number; tieBehavior: 'both' }
  | { effectId: 'deck_compare_branch'; fewerSideEffect: MonsterEffect }
  | {
      effectId: 'deck_predict_reveal_reduce';
      predictSide: RelativeSide;
      revealCount?: number;
      onHit: { targetSide: RelativeSide; count: number };
      onMiss: { targetSide: RelativeSide; count: number } | null;
    }
  | {
      effectId: 'deck_reveal_kanji_check';
      revealCount: number;
      targetKanji?: string | string[];
      onMatch: { targetSide: RelativeSide; count: number };
      // 【追加】煉で確認：「外れ」時にも効果が発生するケース
      onMiss?: { targetSide: RelativeSide; count: number } | null;
    }
  | {
      effectId: 'deck_keep_rest_trash';
      targetSide: RelativeSide;
      keepCount: number;
      destination: 'cemetery' | 'exile';
    }
  | { effectId: 'choose_number_reduce_both'; maxNumber: number }
  | {
      effectId: 'choose_number_reduce';
      maxNumber: number;
      targetScope: 'both' | 'opponent_only';
    }
  | {
      effectId: 'choice_of_effects';
      options: { label: string; effect: MonsterEffect }[];
    }
  | {
      effectId: 'deck_count_win_or_reduce';
      winCondition: { count: number };
      otherwise: { count: number };
    }
  | {
      effectId: 'deck_or_graveyard_count_win_condition';
      targetValues: number[];
      scope: 'either_player_either_zone';
    }
  | {
      effectId: 'deck_count_tiered_effect';
      tiers: {
        min: number;
        max: number;
        effect?: { targetSide: RelativeSide; count: number };
        win?: boolean;
      }[];
    }
  | {
      effectId: 'deck_select_trash';
      targetSide: RelativeSide;
      count?: number;
      maxCount?: number;
      destination: 'cemetery' | 'exile';
      shuffleAfter?: boolean;
    }
  | {
      effectId: 'deck_partial_reorder';
      targetSide: RelativeSide | 'both' | 'choose';
      count: number;
      faceUp?: boolean;
    }
  | {
      effectId: 'deck_kanji_search_equip';
      targetKanji: string;
      maxCount: number;
      excludeSelf: boolean;
    }
  | {
      effectId: 'deck_normalize_to_count';
      targetCount: number;
      overDestination: 'cemetery' | 'exile';
      underSource: 'graveyard_select';
      shuffleAfter: boolean;
    }
  | {
      effectId: 'graveyard_total_count_threshold_win';
      threshold: number;
      scope: 'combined' | 'self' | 'opponent';
    }
  | {
      effectId: 'mixed_zone_select_trash';
      targetSide: RelativeSide;
      sources: ('monster_mana' | 'deck')[];
      count: number;
      destination: 'cemetery' | 'exile';
    }
  | {
      effectId: 'graveyard_recover_then_deck_trash_matching_count';
      recoverKanji: string;
      maxRecoverCount: number;
      trashExcludeKanji: string;
    }
  | {
      effectId: 'deck_iterative_reveal_until_condition';
      targetSide: RelativeSide;
      destination: 'cemetery' | 'exile';
      stopConditions: { maxDistinctKanji?: number; maxCount?: number };
    }
  | { effectId: 'monster_remove_from_game'; count: number }
  // 【追加】走で確認：山札から連続でN枚めくってプレイするだけの軽量パターン
  | { effectId: 'draw_and_play_n'; count: number }
  // 【追加】逆で確認：自分の山札と墓地を、順序維持のまま丸ごと入れ替え
  | { effectId: 'swap_deck_and_graveyard' }
  // 【追加】究で確認：相手山札の構成を丸ごと予想する型。要:勝敗システム接続
  | {
      effectId: 'deck_predict_full_composition_win';
      onMiss: { shuffleAfter: boolean };
    }
  // 【追加】敗で確認：両者の山札枚数差がしきい値を超えたら勝敗、それ以外は両者減少。要:勝敗システム接続
  | {
      effectId: 'deck_diff_threshold_win_or_reduce';
      threshold: number;
      otherwiseCount: number;
    }
  // 【追加】然で確認：相手の山札上/墓地から1枚選んで除外する汎用ゾーン移動
  | {
      effectId: 'select_zone_move_one';
      targetSide: RelativeSide;
      sourceOptions: ('deck_top' | 'graveyard')[];
      destination: 'exile';
    }
  // 【追加】反で確認：単発の1回起動効果（永続効果ではないためPassiveEffectから移動）
  | {
      effectId: 'flip_monster_facedown';
      targetSide: RelativeSide;
      count: number;
    }
  | { effectId: 'sequence'; steps: MonsterEffect[] }
  | { effectId: 'custom'; handlerKey: string }
  | { effectId: 'deck_partial_to_reserve'; destination: 'reservedCards' }
  // 【追加】忍(m00067)で確認：山札の指定位置のカードに遅延効果をマークし、
  // 実際にそのカードがドローされた時点で追加の山札減少が発動する。
  | {
      effectId: 'deck_mark_delayed_reduce';
      targetSide: RelativeSide;
      revealPosition: number; // 上から何枚目にマークするか(1始まり。忍は3)
      reduceCount: number; // ドロー時に追加で山札から減らす枚数(忍は7)
      destination?: 'cemetery' | 'exile'; // 未指定ならcemetery
    }
  // 【追加】電(m00073)で確認：相手の山札を固定数減らした上で、もう一度自分のターンを行う。
  // 選択を挟まず完全自動解決。ターン進行への介入はGameState.pendingExtraTurn経由で行う。
  | {
      effectId: 'deck_reduce_grant_extra_turn';
      count: number;
    }
  // 【追加】明(m00092)で確認：自分・相手両方の山札トップを、シャッフルするまで公開し続ける。
  // パラメータ不要(常に両陣営が対象、固定)。custom→専用effectIdへ昇格。
  | { effectId: 'reveal_both_top_until_shuffle' }
  // 【追加】採(m00115)で確認：自分のモンスターを1体選び(自分自身は除外)、そのモンスターの
  // 空きスロットに対応する漢字種類を1色につき1枚ずつ、墓地から自動装備する。
  // パラメータ不要(monsterTargetModeはexclude_self固定、マナの選定は完全自動)。
  | { effectId: 'graveyard_auto_equip_by_target_slots' }
  // 【追加】育(m00065)で確認：このモンスターの発動回数(試合を通じて累積)によって
  // 相手の山札の減少量が変わる。tiersはmaxCount昇順で並べ、最初に条件を満たした
  // (発動後の累計回数 <= maxCount)ものを採用する。最後の要素で残り全てを受け止める想定。
  | {
      effectId: 'deck_reduce_scaling_by_activation_count';
      tiers: { maxCount: number; reduceCount: number }[];
    }
  // 【追加】囲(m00119)で確認：墓地からマナを2枚選び、reservedCardsへ並べる（保持ゾーンの充填）。
  // 保(deck_partial_to_reserve、山札→reservedCards)とは向きが逆（墓地→reservedCards）。
  | { effectId: 'graveyard_partial_to_reserve'; count: number };

// --- 永続効果（表向き固定、盤面に残り続けて以後の処理に割り込む） ---
export type PassiveEffect =
  | {
      trigger: 'draw_replace';
      sourceKanji?: string;
      sourceZone?: 'deck' | 'graveyard';
    }
  | { trigger: 'draw_count_override'; count: number }
  | { trigger: 'janken_auto_win' }
  | { trigger: 'own_turn_start'; action: MonsterEffect }
  | { trigger: 'own_turn_end'; action: MonsterEffect }
  | {
      trigger: 'on_draw';
      targetKanji: string[];
      onMatch: { targetSide: RelativeSide; count: number };
    }
  | { trigger: 'mana_kanji_wildcard'; targetKanji: string }
  | {
      trigger: 'own_kanji_to_graveyard_reaction';
      targetKanji: string;
      onTrigger: { targetSide: RelativeSide; count: number };
    }
  | {
      trigger: 'own_turn_start_win_condition';
      comparator: 'less_than' | 'greater_than';
      threshold: number;
      targetSide: RelativeSide;
    }
  | {
      trigger: 'own_turn_end_predict_win';
      predictTarget: 'opponent_next_draw';
      includeGraveyardDraw: boolean;
    }
  | { trigger: 'on_opponent_draw_predict'; onHit: { count: number } }
  | {
      trigger: 'graveyard_kanji_threshold_win';
      targetKanji: string;
      threshold: number;
    }
  | {
      trigger: 'disable_opponent_monster_effects';
      duration: { opponentTurns: number };
      consumeAfterUse: boolean;
    }
  | {
      trigger: 'boost_own_deck_reduce_effect';
      extraCount: number;
      scope?: ('deck' | 'monster_mana')[];
    }
  | { trigger: 'block_next_deck_reduce_effect' }
  | {
      trigger: 'shield_counter_deck_protection';
      bufferSize: number;
      bufferSource: 'graveyard';
    }
  | {
      trigger: 'redirect_own_deck_reduce';
      scope: { minCount?: number; maxCount?: number; fixedCount?: number };
      consumeAfterUse: boolean;
    }
  | { trigger: 'mitigate_deck_reduce_effect'; amount: number }
  // 【追加】拾で確認：own_kanji_to_graveyard_reaction（養）とは別物。
  // 自分のマナが「相手の効果で」墓地送りにされた直後に、そのカードから1枚選んで装備する
  | {
      trigger: 'own_mana_trashed_by_opponent_reaction';
      selectAndEquipCount: number;
    }
  // 【追加】注(m00061)で確認：MonsterEffectのcustomから移設。当初「発動ボタンで起動する
  // 効果」として登録されていたが、実態は浮・抑・重・扱・返・圧・敵と同種の常時パッシブと判明したため。
  // 自分のモンスター効果が相手の山札を減らす瞬間に割り込み、その結果を「自分-selfCost・
  // 相手-opponentCount」の2つに丸ごと置き換える。consumeAfterUseに相当する概念は無く常時発動。
  | {
      trigger: 'replace_own_effect_opponent_reduce';
      selfCost: number;
      opponentCount: number;
    }
  // 【追加】吸(m00086)で確認：抑と同系統だが対象はTRASH_MANA(装備中のマナカードの破棄)限定。
  // 「あいてのカードの効果により」自分の装備マナが墓地送りになる直前に割り込み、無効化する。
  // consumeAfterUseに相当する概念は無く常時発動(原文に回数制限の記載なし)。
  | { trigger: 'negate_own_mana_trash_by_opponent' };

// --- マナカード ---
export interface ManaCard {
  id: string;
  hexColor: string; // 個別のUI描画用HEXカラーコード
  kanji: string; // マナの漢字
  reading: string; // マナの読み
  imageUrl?: string;
  // 【追加】忍等の「ドローされた瞬間に追加効果が発動する」トラップマーク。
  // deck_mark_delayed_reduceが仕込み、AUTO_DRAW側で検知・消費する。
  trapEffect?: { reduceCount: number; destination: 'cemetery' | 'exile' };
}

// --- モンスターカード ---
export interface MonsterCard {
  id: string;
  name: string;
  slots: string[];
  slotPositions?: string[];
  equippedMana: (ManaCard | null)[];
  isFlipped: boolean;
  imageUrl?: string;
  flippedImageUrl?: string;
  // 保・囲用の保持ゾーン。equippedManaとは別概念（装備ではなく一時保管）。
  // 消費条件・返却条件はPassiveEffect側のパラメータで書き分ける
  reservedCards?: ManaCard[];
  // 認・獄用のゲーム除外状態フラグ
  isRemovedFromGame?: boolean;
  // 【追加】redirect_own_deck_reduce(consumeAfterUse:true)・block_next_deck_reduce_effect用の
  // 消費済み管理。passiveEffectが配列の場合のindexに対応する。単体の場合は常にindex 0。
  consumedPassiveIndexes?: number[];
  // 【追加】masterDataからコピーされる効果データ（generateGameCards内でmaster.idをキーに引いてコピー）
  effect?: MonsterEffect;
  // 【追加】花のように同時に複数の永続効果を持つケースがあるため配列も許容
  passiveEffect?: PassiveEffect | PassiveEffect[];
  // 【追加・育】発動回数によって結果が変わる効果用のカウンタ。試合内で累積し、
  // リセットされない。育のexecutor内でのみインクリメントする(汎用フラグではない)。
  activationCount?: number;
}

export type LogType = 'draw' | 'mana' | 'attack' | 'system' | 'alert';

export interface ActionLog {
  id: string;
  timestamp: string;
  type: LogType;
  message: string;
}

export type GameStatus = 'playing' | 'player_win' | 'opponent_win' | 'draw';

// --- プレイヤー状態 (State) ---
export interface PlayerState {
  deck: ManaCard[];
  cemetery: ManaCard[];
  exile: ManaCard[];
  monsters: MonsterCard[];
  pendingDrawCards: ManaCard[];
  // 【追加・明】山札トップを常時公開する効果用のフラグ。プレイヤーごとに独立し、
  // そのプレイヤー自身がシャッフルした際にのみ解除される。
  deckTopRevealed?: boolean;
}

// --- ゲーム全体状態 (Root State)（ターン管理を追加） ---
export interface GameState {
  player: PlayerState;
  opponent: PlayerState;
  turnPlayer: PlayerSide;
  turnCount: number;
  currentPhase: GamePhase;
  logs: ActionLog[];
  gameStatus: GameStatus;
  // 【追加・電】もう一度自分のターンを付与する効果用のフラグ。NEXT_PHASEで消費される。
  pendingExtraTurn?: boolean;
}

// --- デッキ構築・プリセット用 ---
export interface PresetDeck {
  id: string;
  name: string;
  folder: string;
  monsterIds: string[];
  manaCounts: Record<string, number>;
}

// --- Action Payload インターフェース ---

export type PlayerSide = 'player' | 'opponent';
export type ZoneType = 'deck' | 'cemetery' | 'exile' | 'pending';

export type EquipManaAction = {
  type: 'EQUIP_MANA';
  payload: { side: PlayerSide; monsterIndex: number };
};

export type TrashManaAction = {
  type: 'TRASH_MANA';
  payload: {
    side: PlayerSide;
    monsterIndex: number;
    manaCardIds: 'all' | string[];
    destination: 'cemetery' | 'exile';
  };
};

export type DamageAction = {
  type: 'DAMAGE';
  payload: {
    targetSide?: 'opponent' | 'player';
    side?: PlayerSide;
    amount: number;
  };
};

export type RecoverAction = {
  type: 'RECOVER';
  payload: { side: PlayerSide; manaCardIds: string[] };
};

export type FlipMonsterAction = {
  type: 'FLIP_MONSTER';
  payload: { side: PlayerSide; monsterIndex: number };
};

export type EquipSpecificManaAction = {
  type: 'EQUIP_SPECIFIC_MANA';
  payload: {
    side: PlayerSide;
    monsterIndex: number;
    sourceZone: ZoneType;
    manaCardId: string;
    targetSlotIndex?: number;
  };
};

export type MoveCardBetweenZonesAction = {
  type: 'MOVE_CARD_BETWEEN_ZONES';
  payload: {
    sourceSide: PlayerSide;
    targetSide: PlayerSide;
    cardIds: string[];
    sourceZone: ZoneType;
    targetZone: ZoneType;
  };
};

export type MoveCardToReserveAction = {
  type: 'MOVE_CARD_TO_RESERVE';
  payload: {
    side: PlayerSide;
    monsterIndex: number;
    cardIds: string[];
    // 【追加・囲】移動元ゾーン。未指定時は'deck'扱い（保の既存呼び出し箇所との後方互換のため）。
    sourceZone?: 'deck' | 'cemetery';
  };
};

export type ReorderDeckAction = {
  type: 'REORDER_DECK';
  payload: { side: PlayerSide; orderedCardIds: string[] };
};

export type ShuffleDeckAction = {
  type: 'SHUFFLE_DECK';
  payload: { side: PlayerSide };
};

export type SetInitialStateAction = {
  type: 'SET_INITIAL_STATE';
  payload: {
    player: { monsters: MonsterCard[]; deck: ManaCard[] };
    opponent: { monsters: MonsterCard[]; deck: ManaCard[] };
  };
};

export type SetDeckCardTrapAction = {
  type: 'SET_DECK_CARD_TRAP';
  payload: {
    side: PlayerSide;
    cardId: string;
    reduceCount: number;
    destination: 'cemetery' | 'exile';
  };
};

// 【追加】redirect_own_deck_reduce(consumeAfterUse:true)・block_next_deck_reduce_effectを
// 発動後に無効化するためのAction。MonsterCard.consumedPassiveIndexesへpassiveIndexを追記する。
export type ConsumePassiveEffectAction = {
  type: 'CONSUME_PASSIVE_EFFECT';
  payload: { side: PlayerSide; monsterIndex: number; passiveIndex: number };
};

// 【追加・電】もう一度自分のターンを付与するAction。payload不要(常にgameState.turnPlayer対象)。
export type GrantExtraTurnAction = {
  type: 'GRANT_EXTRA_TURN';
};

// 【追加・明】山札トップの常時公開フラグを切り替えるAction。SHUFFLE_DECKでも
// 同じ側のフラグをfalseに戻す(effectExecutor.ts側ではなくreducer内で完結させる)。
export type SetDeckTopRevealedAction = {
  type: 'SET_DECK_TOP_REVEALED';
  payload: { side: PlayerSide; revealed: boolean };
};

// 【追加・育】発動回数カウンタをインクリメントするAction。MonsterCard.activationCountを更新する。
export type IncrementActivationCountAction = {
  type: 'INCREMENT_ACTIVATION_COUNT';
  payload: { side: PlayerSide; monsterIndex: number };
};

// 【追加・認/獄】モンスターをゲームから取り除くAction。isRemovedFromGameを立てるのみ
// (配列からは削除しない。isFlippedと同じ「フラグで状態管理」パターンを踏襲)。
// 装備マナの墓地送りは既存のTRASH_MANA(manaCardIds:'all')を別途dispatchして対応する。
export type RemoveMonsterFromGameAction = {
  type: 'REMOVE_MONSTER_FROM_GAME';
  payload: { side: PlayerSide; monsterIndex: number };
};

// 【追加・囲】reservedCardsから指定1枚を取り除き、墓地へ送るAction。
// MOVE_CARD_TO_RESERVE(山札→reservedCards、追加方向)とは逆方向。
export type ConsumeReservedCardAction = {
  type: 'CONSUME_RESERVED_CARD';
  payload: { side: PlayerSide; monsterIndex: number; cardId: string };
};

// 【追加・拾】相手のターンを打ち切り、自分のターンをその場で開始するAction。
// NEXT_PHASEを経由せず即座にturnPlayer/currentPhaseを切り替える点がGRANT_EXTRA_TURN(電)と異なる
// (電は自分のNEXT_PHASE時に判定するが、拾は相手ターン中に割り込んで発動するため)。
export type ForceEndOpponentTurnAction = {
  type: 'FORCE_END_OPPONENT_TURN';
  payload: { side: PlayerSide }; // 自分のターンを開始する側
};

export type GameAction =
  | EquipManaAction
  | TrashManaAction
  | DamageAction
  | RecoverAction
  | FlipMonsterAction
  | EquipSpecificManaAction
  | MoveCardBetweenZonesAction
  | MoveCardToReserveAction
  | ReorderDeckAction
  | ShuffleDeckAction
  | SetInitialStateAction
  | SetDeckCardTrapAction
  | ConsumePassiveEffectAction
  | GrantExtraTurnAction
  | SetDeckTopRevealedAction
  | IncrementActivationCountAction
  | RemoveMonsterFromGameAction
  | ConsumeReservedCardAction
  | ForceEndOpponentTurnAction
  | { type: 'NEXT_PHASE' }
  | { type: 'AUTO_DRAW'; payload: { player: PlayerSide } }
  | { type: 'SET_TURN_PLAYER'; payload: { turnPlayer: PlayerSide } }
  | { type: 'RESTORE_STATE'; payload: GameState };
