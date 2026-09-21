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
  | {
      effectId: 'deck_select_equip';
      count: number;
      // 【今回追加】graveyard_select_equipと同じ意味(令: 装備先を選べる・自分自身も可)。
      monsterTargetMode?: 'exclude_self' | 'include_self';
    }
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
      // 【今回変更】excludeSelf(boolean)からgraveyard_select_equip/deck_select_equipと同じ
      // monsterTargetModeへ統合(草は'exclude_self': 装備先を選べるが発動元自身は除外)。
      monsterTargetMode?: 'exclude_self' | 'include_self';
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
  | { effectId: 'graveyard_partial_to_reserve'; count: number }
  // 【追加】操(m00015)で確認：相手のモンスターを1体選び、そのモンスターのeffectを
  // 操の発動者(ownerSide)視点で(sourceMonsterIndexは操自身のまま)発動する。custom→専用effectIdへ昇格。
  // パラメータ不要(常に相手全モンスターが候補、制限なし)。
  | { effectId: 'copy_opponent_monster_effect' }
  // 【追加】政(m00117)で確認：自分の墓地から、相手のデッキ構成(山札/装備中/保持/墓地/除外の
  // 全領域合計)に存在しない漢字種類のマナを1~4枚選び、相手の山札に混入してシャッフルする。
  // 混入したカード実体にseededByタグを付け、own_turn_startパイプライン側で
  // 「相手の墓地にそのカードがあるか」を毎自ターン開始時チェックし続ける(要:勝敗システム接続)。
  // custom→専用effectIdへ昇格。
  | { effectId: 'deck_seed_mana_win_condition'; maxCount: number };

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
      // 【今回追加】trueなら「じぶんのカードの効果で」自分の山札が減るときのみ発動する(扱)。
      // 未指定(false)は、相手のカードの効果で自分の山札が減るときにも発動する(敵・返・圧。
      // 公式QA: 泣の例で、相手の泣に対して敵が発動する)。
      ownEffectOnly?: boolean;
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
  | { trigger: 'negate_own_mana_trash_by_opponent' }
  // 【追加】政(m00117)で確認：deck_seed_mana_win_conditionで相手の山札へ混入したマナ
  // (ManaCard.seededByでタグ付け)が、政の所有者の自ターン開始時点で相手の墓地に
  // 存在するかを判定する。混入後、相手が引いて墓地送りにするまで毎自ターン開始時に
  // チェックし続ける(消費・回数制限の概念なし)。要:勝敗システム接続。
  | { trigger: 'seeded_mana_return_win_condition' };

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
  // 【追加】政(deck_seed_mana_win_condition)が相手の山札へ混入したカードに付けるマーク。
  // 忍のtrapEffectと同じ「カード実体に直接タグを持たせ、位置変動(シャッフル等)に頑健にする」
  // パターン。own_turn_startパイプライン側で「seededByを持つカードが所有側の墓地にあるか」を
  // 判定するために使う(判定側であるside=政の所有者を記録)。
  seededBy?: { side: PlayerSide };
  // 【今回追加・詳】deck_partial_reorderのfaceUp:trueで山札に戻された際に、表向きのまま
  // 保持するためのマーク。忍のtrapEffect・政のseededByと同じ「カード実体タグ」パターン。
  // シャッフルされた側の山札で一括解除される（忍・詳とも位置ベースではなくid参照のため、
  // シャッフルされても本来は消える理由がないが、詳は原文に明記が無いため他カードの慣例
  // 〈政と同種のタグは基本シャッフルで解除〉に倣いSHUFFLE_DECK側で解除する）。
  faceUpMarker?: boolean;
  // 【今回追加】仁・花のdraw_replace(DRAW_REPLACE_FROM_GRAVEYARD)経由でpendingDrawCardsに
  // 入ったカードに付与するマーク。忍のtrapEffect・政のseededByと同じ「カード実体タグ」
  // パターン。「1枚ドロー確認」モーダルのキャンセル時、本来の送り元(墓地)へ正しく
  // 戻すために使う。通常のAUTO_DRAW由来のカードには付与されない(undefined=山札由来)。
  pendingDrawSource?: 'graveyard';
  // 【今回追加・花】屮(mana_kanji_wildcardの対象)が、花が表向きの間だけ持てる色の指定。
  // 指定した漢字のマナとして扱う。undefined=指定なし(素のkanji)。装備時はつけたスロットの
  // 漢字に自動で指定され、墓地・山札等の屮は手動で指定する(いつでも・指定し直し可能)。
  // 花が裏向きになる(または取り除かれる)と、他の色の代わりについていた屮は墓地へ行き、
  // 残る指定もクリアされる。
  designatedKanji?: string;
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
  // 【追加・激】own_turn_end_predict_win用。このモンスターの所有者が「次に相手が引くマナ」
  // として予想中の漢字。未確定の間は`undefined`。ドロー発生時に判定され、的中・不的中を
  // 問わず判定後はクリアされる(「次にひく」一回限りの予想のため)。
  predictedDrawKanji?: string;
  // 【今回追加・泊】このモンスターの所有者が泊を発動中の場合の残りターン数。
  // FLIP_MONSTERで表向きにした瞬間に3をセットし、相手のターンが終了するたびに1減らす
  // (原文「次のあいてのターンを1と数えて、3回あいてのターンがくるまで」＋FAQ「3回めの
  // 相手ターンが終わった直後(自ターンが始まる前)に裏向きに戻る」)。0になった時点で
  // FLIP_MONSTERを発火して裏向きに戻し、このフィールドはundefinedに戻す。
  // 泊を持たないモンスターがFLIP_MONSTERされても、このフィールドとは無関係
  // (disable_opponent_monster_effectsを持つモンスターが表向きになった時のみセットする)。
  disabledOpponentTurnsRemaining?: number;
  // 【今回追加・囲/政】前準備発動(MonsterEffect)を1回限りにするための「発動済み」マーク。
  // 従来(7.39章)は発動時にFLIP_MONSTERで裏向き化して1回限りを表現していたが、
  // 「このカードはおもてむきのままにする」という原文と矛盾し、政の勝利条件監視
  // (!isFlipped)が止まる・囲のバッファ切れ時トグルが逆転する不具合を生んだため、
  // 表裏(isFlipped)とは独立したこのフラグで管理する方式に改めた。
  // 裏向きに戻った時点(FLIP_MONSTERでisFlipped:trueになる時)にクリアされ、
  // 再び表向きにすれば前準備を再度発動できる。保は対象外(従来通り繰り返し発動可)。
  preparationUsed?: boolean;
}

export type LogType = 'draw' | 'mana' | 'attack' | 'system' | 'alert';

export interface ActionLog {
  id: string;
  timestamp: string;
  type: LogType;
  message: string;
}

export type GameStatus = 'playing' | 'player_win' | 'opponent_win' | 'draw';

// 【今回追加・命/走】未消化のドロー(残りドロー回数)。命の2枚目・走で山札が足りずに引けなかった
// 分を、ドローボタンで1枚ずつ引き直せるように保持する。ターン終了(NEXT_PHASE/FORCE_END)で破棄する。
//   kind:'turn_start' … 命の2枚目。ターン開始のドロー扱い(仁・花の置き換えの対象)
//   kind:'effect'     … 走の残り。効果によるめくり扱い(仁・花の置き換えの対象外)
export interface PendingDraws {
  count: number;
  kind: 'turn_start' | 'effect';
}

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
  // 【今回追加・命/走】残りドロー回数。ターン終了で破棄される。
  remainingDraws?: PendingDraws;
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
  // 【今回追加・命/仁/花】現在のターンで、ターン開始のドローを既に行ったか。currentPhaseが
  // 実際には'start'から進まないため、「ターンのはじめのドロー」を判定するために新設した。
  // NEXT_PHASE(電の追加ターン含む)・FORCE_END_OPPONENT_TURN・SET_INITIAL_STATEでfalseに戻る。
  hasDrawnThisTurn?: boolean;
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
  payload: {
    side: PlayerSide;
    orderedCardIds: string[];
    // 【今回追加・詳】trueの場合、orderedCardIdsに含まれるカードにfaceUpMarkerを立てる
    faceUp?: boolean;
  };
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

// 【追加・政】相手の山札に混入したカードにseededByタグを付与するAction。
// SET_DECK_CARD_TRAP(忍)と同じ「カード実体に直接タグを持たせる」パターン。
// side: タグを付ける対象カードが今いる側(=相手側)。markedBySide: 政の所有者(判定時に使う)。
export type SetManaSeededMarkerAction = {
  type: 'SET_MANA_SEEDED_MARKER';
  payload: { side: PlayerSide; cardIds: string[]; markedBySide: PlayerSide };
};

// 【追加・激】ターン終了時に宣言した予想漢字をモンスターへ保存するAction。
// 「ターンを終了」ボタン押下時の割り込みフロー(App.tsx)から、NEXT_PHASEの前に発火される。
export type SetPredictedDrawKanjiAction = {
  type: 'SET_PREDICTED_DRAW_KANJI';
  payload: { side: PlayerSide; monsterIndex: number; kanji: string };
};

// 【追加・仁/花】draw_replace用。山札の代わりに、指定した墓地のカードをpendingDrawCardsへ
// 移動する。AUTO_DRAWと同じ「1枚をpendingへ」という結果になるが、移動元が墓地である点が異なる。
export type DrawReplaceFromGraveyardAction = {
  type: 'DRAW_REPLACE_FROM_GRAVEYARD';
  payload: {
    side: PlayerSide;
    cardId: string;
    // 【今回追加】AutoDrawActionと同じ意味(下記参照)。
    isTurnStartDraw?: boolean;
    remainingDrawsAfter?: PendingDraws | null;
  };
};

// 【今回改訂】従来はGameActionのunion内にインラインで定義していたAUTO_DRAWを、命・走の
// 残りドロー回数の管理用フィールド(任意)を追加するため名前付き型へ切り出した。
//   isTurnStartDraw: trueで、ドローした側がturnPlayerなら hasDrawnThisTurn を立てる
//   remainingDrawsAfter: 指定時のみ、ドロー後の残りドロー回数を上書きする(nullで解除)。
//                        ドローが成立しなかった(山札0枚)場合は適用されない
export type AutoDrawAction = {
  type: 'AUTO_DRAW';
  payload: {
    player: PlayerSide;
    isTurnStartDraw?: boolean;
    remainingDrawsAfter?: PendingDraws | null;
  };
};

// 【追加・暮/浅/政/激の勝敗接続共通】カード効果由来の勝利条件が成立した際に、gameStatusを
// 直接更新する汎用Action。既に決着済み(gameStatus!=='playing')の場合はreducer側で無視する
// (evaluateGameStatusの「すでに決着している場合はスキップ」と同じ防御方針)。
export type SetGameStatusAction = {
  type: 'SET_GAME_STATUS';
  payload: { status: GameStatus; logMessage?: string };
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

// 【今回追加・逆】山札全体と墓地全体を「今の順番のまま」丸ごと入れ替えるAction。
// MOVE_CARD_BETWEEN_ZONESでは表現できない(1枚単位の移動を前提とした型のため)ため新設。
// FAQにより、この入れ替えによる山札の増減は「効果による墓地送り」として扱わない
// (敵等のredirect_own_deck_reduce系が誤発動しない)ことが確定しているため、
// 永続パッシブ割り込みパイプライン(applyDeckReducePassives/applyManaTrashPassives)を
// 経由しない特別な発行経路(素のdispatch)で扱う。
export type SwapZonesAction = {
  type: 'SWAP_ZONES';
  payload: { side: PlayerSide };
};

// 【今回追加・囲/政】前準備発動済みマーク(MonsterCard.preparationUsed)を立てるAction。
// FLIP_MONSTER(トグル)の代わりに、表裏を変えずに「1回限り」を表現するために使う。
export type MarkPreparationUsedAction = {
  type: 'MARK_PREPARATION_USED';
  payload: { side: PlayerSide; monsterIndex: number };
};

// 【今回追加・花】屮の色指定を設定・解除するAction(kanji:nullまたは屮自身の漢字で解除)。
// 花が表向きで泊に無効化されていない側のみ有効。指定できるのは屮のみ。
export type SetManaDesignationAction = {
  type: 'SET_MANA_DESIGNATION';
  payload: { side: PlayerSide; cardId: string; kanji: string | null };
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
  | SetManaSeededMarkerAction
  | SetPredictedDrawKanjiAction
  | DrawReplaceFromGraveyardAction
  | SetGameStatusAction
  | SwapZonesAction
  | MarkPreparationUsedAction
  | SetManaDesignationAction
  | { type: 'NEXT_PHASE' }
  | AutoDrawAction
  | { type: 'SET_TURN_PLAYER'; payload: { turnPlayer: PlayerSide } }
  | { type: 'RESTORE_STATE'; payload: GameState };
