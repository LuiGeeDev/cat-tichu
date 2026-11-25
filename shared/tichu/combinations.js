/**
 * 티츄 조합 판정 / 비교 / 합법 수 생성
 *
 * 공식 룰 요약
 * - 낼 수 있는 조합: 싱글, 페어, 트리플, 풀하우스(3+2), 스트레이트(5장 이상 연속),
 *   연속 페어(2쌍 이상), 폭탄(같은 숫자 4장 / 같은 무늬 5장 이상 연속)
 * - 같은 종류·같은 길이의 더 높은 조합으로만 덮을 수 있다. (폭탄은 예외)
 * - 봉새: 조합 안에서는 2~A 와일드, 싱글로 낼 때는 앞 카드보다 0.5 높음(선일 때 1.5)
 * - 용: 싱글 전용, 가장 강함, 이기면 스틱을 상대에게 준다.
 * - 개: 선으로만 낼 수 있고, 파트너에게 선을 넘긴다. (폭탄 불가)
 * - 마작: 1로 취급, 스트레이트에 포함 가능, 낼 때 소원을 빌 수 있다.
 */

import { KIND, RANK_LABEL } from './cards.js';

export const TYPE = {
  SINGLE: 'single',
  PAIR: 'pair',
  TRIPLE: 'triple',
  FULLHOUSE: 'fullhouse',
  STRAIGHT: 'straight',
  STAIRS: 'stairs',
  DOG: 'dog',
  BOMB: 'bomb',
};

export const TYPE_LABEL = {
  [TYPE.SINGLE]: '싱글',
  [TYPE.PAIR]: '페어',
  [TYPE.TRIPLE]: '트리플',
  [TYPE.FULLHOUSE]: '풀하우스',
  [TYPE.STRAIGHT]: '스트레이트',
  [TYPE.STAIRS]: '연속 페어',
  [TYPE.DOG]: '개',
  [TYPE.BOMB]: '폭탄',
};

const RANK_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function makeCombo(type, cards, rank, extra = {}) {
  return {
    type,
    cards: [...cards].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    rank,
    size: cards.length,
    bomb: type === TYPE.BOMB,
    ...extra,
  };
}

function isFlush(baseCards) {
  if (!baseCards.length) return false;
  if (baseCards.some((c) => c.kind !== KIND.NORMAL)) return false;
  const suit = baseCards[0].suit;
  return baseCards.every((c) => c.suit === suit);
}

function isStairs(counts, pairCount) {
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  if (ranks.length !== pairCount) return false;
  for (let i = 0; i < ranks.length; i += 1) {
    if (counts.get(ranks[i]) !== 2) return false;
    if (i > 0 && ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function structure(ranks, cards, baseCards, usesPhoenix) {
  const n = ranks.length;
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const distinct = [...counts.keys()].sort((a, b) => a - b);

  if (n === 2 && distinct.length === 1) return makeCombo(TYPE.PAIR, cards, distinct[0]);
  if (n === 3 && distinct.length === 1) return makeCombo(TYPE.TRIPLE, cards, distinct[0]);

  if (n === 4) {
    if (distinct.length === 1) {
      // 봉새로는 폭탄을 만들 수 없다.
      if (usesPhoenix) return null;
      return makeCombo(TYPE.BOMB, cards, distinct[0], { bombKind: 'quad' });
    }
    if (isStairs(counts, 2)) return makeCombo(TYPE.STAIRS, cards, distinct[distinct.length - 1]);
    return null;
  }

  if (n === 5 && distinct.length === 2) {
    const [a, b] = distinct;
    const ca = counts.get(a);
    const cb = counts.get(b);
    if ((ca === 3 && cb === 2) || (ca === 2 && cb === 3)) {
      return makeCombo(TYPE.FULLHOUSE, cards, ca === 3 ? a : b);
    }
  }

  // 스트레이트 (5장 이상, 연속)
  if (n >= 5 && distinct.length === n && distinct[n - 1] - distinct[0] === n - 1) {
    const flush = !usesPhoenix && isFlush(baseCards);
    return makeCombo(flush ? TYPE.BOMB : TYPE.STRAIGHT, cards, distinct[n - 1], flush ? { bombKind: 'straightFlush' } : {});
  }

  // 연속 페어 (2쌍 이상)
  if (n >= 4 && n % 2 === 0 && isStairs(counts, n / 2)) {
    return makeCombo(TYPE.STAIRS, cards, distinct[distinct.length - 1]);
  }

  return null;
}

/**
 * 선택한 카드들이 만들 수 있는 모든 조합 해석을 반환한다.
 * (봉새는 여러 값으로 해석될 수 있으므로 복수 결과 가능)
 */
export function analyze(cards) {
  const results = [];
  if (!cards || cards.length === 0) return results;
  const n = cards.length;

  const hasDog = cards.some((c) => c.kind === KIND.DOG);
  const hasDragon = cards.some((c) => c.kind === KIND.DRAGON);
  const phoenix = cards.find((c) => c.kind === KIND.PHOENIX);

  if (hasDog || hasDragon) {
    if (n !== 1) return results;
    if (hasDog) results.push(makeCombo(TYPE.DOG, cards, 0));
    else results.push(makeCombo(TYPE.SINGLE, cards, Infinity, { dragon: true }));
    return results;
  }

  if (n === 1) {
    if (phoenix) results.push(makeCombo(TYPE.SINGLE, cards, null, { phoenix: true }));
    else results.push(makeCombo(TYPE.SINGLE, cards, cards[0].rank));
    return results;
  }

  const baseCards = cards.filter((c) => c.kind !== KIND.PHOENIX);
  const candidates = phoenix ? RANK_VALUES : [null];

  for (const value of candidates) {
    const ranks = baseCards.map((c) => c.rank);
    if (value !== null) ranks.push(value);
    ranks.sort((a, b) => a - b);
    const combo = structure(ranks, cards, baseCards, Boolean(phoenix));
    if (combo) results.push(combo);
  }

  const seen = new Set();
  return results.filter((c) => {
    const key = `${c.type}:${c.rank}:${c.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 조합의 강도 (표시/정렬용) */
export function power(combo) {
  if (!combo) return 0;
  if (combo.bomb) return 10000 + combo.size * 100 + (combo.rank ?? 0);
  return (combo.rank ?? 0) + (combo.dragon ? 1000 : 0) + (combo.phoenix ? 500 : 0);
}

/**
 * candidate 가 target 을 덮을 수 있는가?
 * target 이 null 이면 선(lead)이므로 어떤 조합이든 낼 수 있다.
 */
export function beats(candidate, target) {
  if (!candidate) return false;
  if (!target) return true;

  if (candidate.type === TYPE.DOG) return false;

  if (candidate.bomb) {
    if (!target.bomb) return true;
    if (candidate.size !== target.size) return candidate.size > target.size;
    return candidate.rank > target.rank;
  }
  if (target.bomb) return false;

  if (candidate.type !== target.type) return false;

  if (candidate.type === TYPE.SINGLE) {
    if (candidate.dragon) return true;
    if (target.dragon || target.phoenix) return false;
    if (candidate.phoenix) return true; // 앞 카드보다 0.5 높음
    return candidate.rank > target.rank;
  }

  if (candidate.type === TYPE.STRAIGHT || candidate.type === TYPE.STAIRS) {
    if (candidate.size !== target.size) return false;
  }

  return candidate.rank > target.rank;
}

export function comboLabel(combo) {
  if (!combo) return '';
  if (combo.type === TYPE.BOMB) {
    return combo.bombKind === 'straightFlush' ? `스트레이트 플러시 폭탄 (${combo.size}장)` : '포카드 폭탄';
  }
  const base = TYPE_LABEL[combo.type] ?? '조합';
  if (combo.type === TYPE.STRAIGHT || combo.type === TYPE.STAIRS) return `${base} ${combo.size}장`;
  if (combo.type === TYPE.SINGLE && combo.dragon) return '용';
  if (combo.type === TYPE.SINGLE && combo.phoenix) return '봉새';
  return base;
}

/**
 * 현재 손패에서 낼 수 있는 모든 조합을 찾는다.
 * wish 가 있으면, 소원을 이행할 수 있는 경우 소원 카드가 포함된 수만 남긴다.
 *
 * @returns {{ plays: Array, mustFulfill: boolean }}
 */
export function legalPlays(hand, target = null, wish = null) {
  const plays = [];
  const n = hand.length;
  if (n === 0) return { plays, mustFulfill: false };

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const subset = [];
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) subset.push(hand[i]);
    }
    const combos = analyze(subset);
    for (const combo of combos) {
      if (combo.type === TYPE.DOG) {
        if (!target) plays.push(combo);
        continue;
      }
      if (!target || beats(combo, target)) plays.push(combo);
    }
  }

  if (wish != null) {
    const fulfilling = plays.filter((p) => p.cards.some((c) => c.rank === wish));
    if (fulfilling.length > 0) return { plays: fulfilling, mustFulfill: true };
  }
  return { plays, mustFulfill: false };
}

const idsKey = (cards) =>
  cards
    .map((c) => c.id)
    .sort()
    .join('|');

/**
 * 실제 플레이 검증.
 * @returns {{ ok: boolean, combo?: object, error?: string }}
 */
export function validatePlay(hand, cardIds, target = null, wish = null) {
  const ids = Array.isArray(cardIds) ? cardIds : [];
  if (ids.length === 0) return { ok: false, error: '카드를 선택해 주세요.' };
  if (new Set(ids).size !== ids.length) return { ok: false, error: '같은 카드를 두 번 선택했습니다.' };

  const cards = [];
  for (const id of ids) {
    const card = hand.find((c) => c.id === id);
    if (!card) return { ok: false, error: '손에 없는 카드입니다.' };
    cards.push(card);
  }

  const { plays, mustFulfill } = legalPlays(hand, target, wish);
  const key = idsKey(cards);
  const candidates = plays.filter((p) => idsKey(p.cards) === key);

  if (candidates.length === 0) {
    if (mustFulfill) return { ok: false, error: '마작 소원을 먼저 지켜야 합니다.' };
    if (!target) return { ok: false, error: '낼 수 없는 조합입니다.' };
    return { ok: false, error: '지금 조합을 덮을 수 없습니다.' };
  }

  const best = [...candidates].sort((a, b) => power(b) - power(a))[0];
  return { ok: true, combo: best, mustFulfill };
}

/** 소원 이행이 강제되는지 */
export function wishForces(hand, target, wish) {
  if (wish == null) return false;
  return legalPlays(hand, target, wish).mustFulfill;
}

export function rankName(rank) {
  if (rank == null) return '';
  return RANK_LABEL[rank] ?? String(rank);
}
