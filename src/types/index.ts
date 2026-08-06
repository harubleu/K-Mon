// src/types/index.ts

export type ManaColor = 'red' | 'blue' | 'yellow' | 'green' | 'white' | 'orange' | 'sun' | 'moon';

export interface ManaCard {
  id: string;
  color: ManaColor;
}

export interface MonsterCard {
  id: string;
  name: string;
  slots: ManaColor[];
  equippedMana: ManaCard[];
  isFlipped: boolean;
}

// --- プレイヤー状態 (State) ---
  export interface PlayerState {
  deck: ManaCard[];
  cemetery: ManaCard[];
  exile: ManaCard[]; 
  monsters: MonsterCard[];
}

export interface GameState {
  player: PlayerState;
  opponent: PlayerState;
}

// --- Action Payload インターフェース ---

// プレイヤー識別子
export type PlayerSide = 'player' | 'opponent';

// 領域の識別子
export type ZoneType = 'deck' | 'cemetery' | 'exile';


// 1. マナ装備: 山札先頭からカードを取り出し、指定したモンスターに装備
export type EquipManaAction = {
  type: 'EQUIP_MANA';
  payload: { side: PlayerSide; monsterIndex: number };
};

// 2. マナ廃棄: 指定モンスターのマナを全体または特定指定で、墓地または除外に追加 (修正)
export type TrashManaAction = {
  type: 'TRASH_MANA';
  payload: {
    side: PlayerSide;
    monsterIndex: number;
    manaCardIds: 'all' | string[];
    destination: 'cemetery' | 'exile';
  };
};

// 3. ダメージ: 相手の山札から指定枚数を相手の墓地に追加
export type DamageAction = {
  type: 'DAMAGE';
  payload: { targetSide?: 'opponent' | 'player'; side?: PlayerSide; amount: number };
};

// 4. 回復: 自分の墓地から指定カードを自分の山札に戻し、シャッフル
export type RecoverAction = {
  type: 'RECOVER';
  payload: { side: PlayerSide; manaCardIds: string[] };
};

// 5. 裏返し: モンスターの isFlipped を反転
export type FlipMonsterAction = {
  type: 'FLIP_MONSTER';
  payload: { side: PlayerSide; monsterIndex: number };
};

// 6. 特定マナ装備: 指定した領域(山札/墓地/除外)から特定のカードを選択し、指定モンスターに装備
export type EquipSpecificManaAction = {
  type: 'EQUIP_SPECIFIC_MANA';
  payload: {
    side: PlayerSide;
    monsterIndex: number;
    sourceZone: ZoneType;
    manaCardId: string;
  };
};

// 7. 領域間移動: 山札・墓地・除外領域間で指定カードを移動させる
export type MoveCardBetweenZonesAction = {
  type: 'MOVE_CARD_BETWEEN_ZONES';
  payload: {
    side: PlayerSide;
    cardIds: string[];
    sourceZone: ZoneType;
    targetZone: ZoneType;
  };
};

// 8. 山札シャッフル: 指定プレイヤーの山札をシャッフルする
export type ShuffleDeckAction = {
  type: 'SHUFFLE_DECK';
  payload: { side: PlayerSide };
};

// --- ゲーム全体のGameActionユニオン型 ---
export type GameAction =
  | EquipManaAction
  | TrashManaAction
  | DamageAction
  | RecoverAction
  | FlipMonsterAction
  | EquipSpecificManaAction
  | MoveCardBetweenZonesAction
  | ShuffleDeckAction;