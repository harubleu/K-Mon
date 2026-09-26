// src/components/GameBoard/GraveyardEquipModal.tsx
//
// 【今回新設】兄・各・共・生・方(graveyard_select_equip、monsterTargetMode指定時)用。
// 従来は「①装備先モンスターを1体選ぶ→②そのモンスターに入る墓地カードを選ぶ→
// ③選んだカード全部をそのモンスターへ装備」という単一モンスター前提の2段階選択だったが、
// 生(カードごとに別々のモンスターへ装備できる)の挙動と食い違っていた。
// 本モーダルは「墓地のカードと、装備先モンスターの空きスロットを1組ずつタップ、または
// ドラッグ&ドロップでペアリングする」単一画面のUIに統一し、生(複数モンスターに分散)・
// 方(1体にまとめて)のどちらも同じ操作の結果として自然に表現する。タップ順は
// 「カード→スロット」「スロット→カード」のどちらでもよい。pairCountちょうどのペアが
// 揃うまで確定ボタンは押せない(部分確定は許容しない)。

import React, { useState } from 'react';
import type { ManaCard, MonsterCard, PlayerSide } from '../../types';
import { Card } from '../Card';
import { getEffectiveKanji, matchesKanjiFilter } from '../../utils/manaKanji';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

export interface GraveyardEquipPair {
  cardId: string;
  monsterIndex: number;
  slotIndex: number;
}

type Pending =
  | { type: 'card'; cardId: string }
  | { type: 'slot'; monsterIndex: number; slotIndex: number }
  | null;

export interface GraveyardEquipModalProps {
  isOpen: boolean;
  side: PlayerSide;
  cemetery: ManaCard[];
  monsters: MonsterCard[];
  pairCount: number;
  kanjiFilter?: string[];
  cardIdFilter?: string[];
  excludeMonsterIndex?: number;
  disabledMonsters?: { index: number; reason: 'removed_from_game' }[];
  wildcardKanji?: string | null;
  // 【今回追加・方】trueの場合、1組目で選んだモンスター以外は選択不可にする。
  singleMonster?: boolean;
  onConfirm: (pairs: GraveyardEquipPair[]) => void;
  onCancel: () => void;
}

// 【追加】ドラッグ元カード用のラッパー。コンポーネント本体の外側で定義し、
// isOpen===falseの早期returnより後に呼ばれるhooks(useDraggable)がコンポーネント本体側の
// 条件分岐に巻き込まれないようにする。
const DraggableCemeteryCard: React.FC<{
  card: ManaCard;
  disabled: boolean;
  children: React.ReactNode;
}> = ({ card, disabled, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `modal_card_${card.id}`,
    data: { cardId: card.id },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
    >
      {children}
    </div>
  );
};

// 【追加】ドロップ先スロット用のラッパー。
const DroppableMonsterSlot: React.FC<{
  monsterIndex: number;
  slotIndex: number;
  disabled: boolean;
  children: React.ReactNode;
}> = ({ monsterIndex, slotIndex, disabled, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `modal_slot_${monsterIndex}_${slotIndex}`,
    data: { monsterIndex, slotIndex },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ outline: isOver && !disabled ? '2px solid #007bff' : 'none' }}
    >
      {children}
    </div>
  );
};

export const GraveyardEquipModal: React.FC<GraveyardEquipModalProps> = ({
  isOpen,
  cemetery,
  monsters,
  pairCount,
  kanjiFilter,
  cardIdFilter,
  excludeMonsterIndex,
  disabledMonsters,
  wildcardKanji = null,
  singleMonster = false,
  onConfirm,
  onCancel,
}) => {
  const [pairs, setPairs] = useState<GraveyardEquipPair[]>([]);
  const [pending, setPending] = useState<Pending>(null);

  // 【追加】ドラッグ&ドロップ用のローカルセンサー(本体のバトル画面D&Dとは独立)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  );

  React.useEffect(() => {
    if (isOpen) {
      setPairs([]);
      setPending(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pairedCardIds = new Set(pairs.map((p) => p.cardId));
  const pairedSlotKeys = new Set(
    pairs.map((p) => `${p.monsterIndex}:${p.slotIndex}`),
  );

  const isCardCandidate = (card: ManaCard): boolean => {
    if (cardIdFilter && !cardIdFilter.includes(card.id)) return false;
    if (kanjiFilter && !matchesKanjiFilter(card, kanjiFilter)) return false;
    return true;
  };

  // 【今回追加・方】singleMonster指定時、1組目で選んだモンスター以外を無効化する。
  const lockedMonsterIndex =
    singleMonster && pairs.length > 0 ? pairs[0].monsterIndex : null;

  const getMonsterDisabledReason = (
    monsterIndex: number,
  ):
    | 'exclude_self'
    | 'removed_from_game'
    | 'locked_to_other_monster'
    | null => {
    if (monsterIndex === excludeMonsterIndex) return 'exclude_self';
    const hit = disabledMonsters?.find((d) => d.index === monsterIndex);
    if (hit) return hit.reason;
    if (lockedMonsterIndex !== null && monsterIndex !== lockedMonsterIndex) {
      return 'locked_to_other_monster';
    }
    return null;
  };

  const isSlotOpen = (monster: MonsterCard, slotIndex: number): boolean =>
    !monster.equippedMana[slotIndex];

  const isCompatible = (
    card: ManaCard,
    monsterIndex: number,
    slotIndex: number,
  ): boolean => {
    const requiredKanji = monsters[monsterIndex].slots[slotIndex];
    if (getEffectiveKanji(card) === requiredKanji) return true;
    // 花の万能マナ(屮、未指定)は、開いているスロットになら何にでも入る
    return !!wildcardKanji && card.kanji === wildcardKanji;
  };

  const addPair = (cardId: string, monsterIndex: number, slotIndex: number) => {
    if (pairs.length >= pairCount) return;
    setPairs((prev) => [...prev, { cardId, monsterIndex, slotIndex }]);
    setPending(null);
  };

  const removePair = (index: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCardClick = (card: ManaCard) => {
    if (pairedCardIds.has(card.id) || !isCardCandidate(card)) return;
    if (
      pending?.type === 'slot' &&
      isCompatible(card, pending.monsterIndex, pending.slotIndex)
    ) {
      addPair(card.id, pending.monsterIndex, pending.slotIndex);
      return;
    }
    setPending((prev) =>
      prev?.type === 'card' && prev.cardId === card.id
        ? null
        : { type: 'card', cardId: card.id },
    );
  };

  const handleSlotClick = (monsterIndex: number, slotIndex: number) => {
    const monster = monsters[monsterIndex];
    if (
      getMonsterDisabledReason(monsterIndex) !== null ||
      pairedSlotKeys.has(`${monsterIndex}:${slotIndex}`) ||
      !isSlotOpen(monster, slotIndex)
    ) {
      return;
    }
    if (pending?.type === 'card') {
      const card = cemetery.find((c) => c.id === pending.cardId);
      if (card && isCompatible(card, monsterIndex, slotIndex)) {
        addPair(pending.cardId, monsterIndex, slotIndex);
        return;
      }
    }
    setPending((prev) =>
      prev?.type === 'slot' &&
      prev.monsterIndex === monsterIndex &&
      prev.slotIndex === slotIndex
        ? null
        : { type: 'slot', monsterIndex, slotIndex },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const cardId = (active.data.current as { cardId?: string })?.cardId;
    const slotData = over.data.current as
      | { monsterIndex: number; slotIndex: number }
      | undefined;
    if (!cardId || !slotData) return;
    const card = cemetery.find((c) => c.id === cardId);
    if (!card) return;
    if (
      pairedCardIds.has(cardId) ||
      !isCardCandidate(card) ||
      getMonsterDisabledReason(slotData.monsterIndex) !== null ||
      pairedSlotKeys.has(`${slotData.monsterIndex}:${slotData.slotIndex}`) ||
      !isSlotOpen(monsters[slotData.monsterIndex], slotData.slotIndex) ||
      !isCompatible(card, slotData.monsterIndex, slotData.slotIndex)
    ) {
      return;
    }
    addPair(cardId, slotData.monsterIndex, slotData.slotIndex);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '760px',
            width: '92%',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 4px 0' }}>
            墓地のカードと装備先を{pairCount}組ペアリングしてください（現在:{' '}
            {pairs.length}/{pairCount}）
          </h3>
          <p
            style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 12px 0' }}
          >
            カード→スロット、またはスロット→カードの順でタップ、もしくはカードをスロットへドラッグしてください。ペア済みの番号をタップすると解除できます。
          </p>

          <div
            style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: '4px 0' }}
          >
            ① 墓地のカード
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {cemetery.length === 0 && (
              <p style={{ color: '#888', fontSize: '0.85rem' }}>
                候補がありません。
              </p>
            )}
            {cemetery.map((card) => {
              const pairIndex = pairs.findIndex((p) => p.cardId === card.id);
              const isPaired = pairIndex !== -1;
              const isCandidate = isCardCandidate(card);
              const isPending =
                pending?.type === 'card' && pending.cardId === card.id;
              return (
                <DraggableCemeteryCard
                  key={card.id}
                  card={card}
                  disabled={isPaired || !isCandidate}
                >
                  <div
                    style={{ position: 'relative' }}
                    onClick={() =>
                      isPaired ? removePair(pairIndex) : handleCardClick(card)
                    }
                  >
                    <div
                      style={{
                        cursor:
                          isPaired || isCandidate ? 'pointer' : 'not-allowed',
                        opacity: isPaired ? 0.5 : isCandidate ? 1 : 0.3,
                        border: isPending
                          ? '3px solid #007bff'
                          : isPaired
                            ? '2px solid #28a745'
                            : '1px solid #ccc',
                        borderRadius: '6px',
                        padding: '4px',
                        backgroundColor: isPending ? '#e6f0ff' : '#fff',
                      }}
                    >
                      <Card card={card} />
                    </div>
                    {isPaired && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          backgroundColor: '#28a745',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {pairIndex + 1}
                      </span>
                    )}
                  </div>
                </DraggableCemeteryCard>
              );
            })}
          </div>

          <div
            style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: '4px 0' }}
          >
            ② 装備先モンスター
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {monsters.map((monster, monsterIndex) => {
              const disabledReason = getMonsterDisabledReason(monsterIndex);
              return (
                <div
                  key={monster.id}
                  style={{
                    flex: '1 1 200px',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    padding: '8px',
                    opacity: disabledReason ? 0.4 : 1,
                    backgroundColor: '#fafafa',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      marginBottom: '6px',
                    }}
                  >
                    {monster.name || `モンスター${monsterIndex + 1}`}
                    {disabledReason === 'exclude_self' &&
                      '（このカードにはつけられない）'}
                    {disabledReason === 'removed_from_game' &&
                      '（ゲームから取り除き済み）'}
                    {disabledReason === 'locked_to_other_monster' &&
                      '（他のマナと同じモンスターのみ選択できます）'}
                  </div>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                  >
                    {monster.slots.map((slotKanji, slotIndex) => {
                      if (disabledReason) {
                        return (
                          <div
                            key={slotIndex}
                            style={{
                              width: '36px',
                              height: '36px',
                              border: '1px dashed #ccc',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              color: '#aaa',
                            }}
                          >
                            {slotKanji}
                          </div>
                        );
                      }
                      const open = isSlotOpen(monster, slotIndex);
                      const pairIndex = pairs.findIndex(
                        (p) =>
                          p.monsterIndex === monsterIndex &&
                          p.slotIndex === slotIndex,
                      );
                      const isPaired = pairIndex !== -1;
                      const isPending =
                        pending?.type === 'slot' &&
                        pending.monsterIndex === monsterIndex &&
                        pending.slotIndex === slotIndex;
                      if (!open && !isPaired) {
                        return (
                          <div
                            key={slotIndex}
                            title='装備済み'
                            style={{
                              width: '36px',
                              height: '36px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              color: '#999',
                              backgroundColor: '#eee',
                            }}
                          >
                            {slotKanji}
                          </div>
                        );
                      }
                      return (
                        <DroppableMonsterSlot
                          key={slotIndex}
                          monsterIndex={monsterIndex}
                          slotIndex={slotIndex}
                          disabled={false}
                        >
                          <div
                            onClick={() =>
                              isPaired
                                ? removePair(pairIndex)
                                : handleSlotClick(monsterIndex, slotIndex)
                            }
                            style={{
                              position: 'relative',
                              width: '36px',
                              height: '36px',
                              cursor: 'pointer',
                              border: isPending
                                ? '3px solid #007bff'
                                : isPaired
                                  ? '2px solid #28a745'
                                  : '2px dashed #f59e0b',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              backgroundColor: isPending
                                ? '#e6f0ff'
                                : '#fff7ed',
                            }}
                          >
                            {slotKanji}
                            {isPaired && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  right: '-8px',
                                  backgroundColor: '#28a745',
                                  color: '#fff',
                                  borderRadius: '50%',
                                  width: '18px',
                                  height: '18px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem',
                                  fontWeight: 'bold',
                                }}
                              >
                                {pairIndex + 1}
                              </span>
                            )}
                          </div>
                        </DroppableMonsterSlot>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => onConfirm(pairs)}
              disabled={pairs.length !== pairCount}
              style={{
                padding: '6px 14px',
                backgroundColor:
                  pairs.length === pairCount ? '#6366f1' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: pairs.length === pairCount ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
              }}
            >
              この組み合わせで装備する
            </button>
            <button
              onClick={onCancel}
              style={{ padding: '6px 14px', cursor: 'pointer' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </DndContext>
  );
};
