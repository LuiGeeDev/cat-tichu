/**
 * 티츄 카드 정의
 * 공식 룰(Fata Morgana, Tichu Nanking 4인) 기준 56장 덱.
 * - 일반 카드 52장: 4무늬(옥/검/탑/별) × 2~A
 * - 특수 카드 4장: 참새(Mah Jong), 개(Dog), 봉황(Phoenix), 용(Dragon)
 */

export const SUITS = ['jade', 'sword', 'pagoda', 'star'];

export const SUIT_LABEL = {
  jade: '옥',
  sword: '검',
  pagoda: '탑',
  star: '별',
};

export const RANK_LABEL = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const KIND = {
  NORMAL: 'normal',
  MAHJONG: 'mahjong',
  DOG: 'dog',
  PHOENIX: 'phoenix',
  DRAGON: 'dragon',
};

export const SPECIAL_LABEL = {
  [KIND.MAHJONG]: '참새',
  [KIND.DOG]: '개',
  [KIND.PHOENIX]: '봉황',
  [KIND.DRAGON]: '용',
};

/** 덱 56장 생성 */
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank += 1) {
      deck.push({ id: `${suit}-${rank}`, kind: KIND.NORMAL, suit, rank });
    }
  }
  deck.push({ id: 'mahjong', kind: KIND.MAHJONG, suit: null, rank: 1 });
  deck.push({ id: 'dog', kind: KIND.DOG, suit: null, rank: null });
  deck.push({ id: 'phoenix', kind: KIND.PHOENIX, suit: null, rank: null });
  deck.push({ id: 'dragon', kind: KIND.DRAGON, suit: null, rank: null });
  return deck;
}

/** 카드 점수: 5=5, 10=10, K=10, 용=25, 봉황=-25 */
export function cardPoints(card) {
  if (!card) return 0;
  if (card.kind === KIND.DRAGON) return 25;
  if (card.kind === KIND.PHOENIX) return -25;
  if (card.rank === 5) return 5;
  if (card.rank === 10 || card.rank === 13) return 10;
  return 0;
}

export function cardsPoints(cards = []) {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

/** 손패 정렬: 2~A, 그 뒤에 특수 카드 */
const KIND_ORDER = {
  [KIND.NORMAL]: 0,
  [KIND.MAHJONG]: 1,
  [KIND.PHOENIX]: 2,
  [KIND.DRAGON]: 3,
  [KIND.DOG]: 4,
};

export function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    const ra = a.rank ?? 0;
    const rb = b.rank ?? 0;
    if (ra !== rb) return ra - rb;
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

/** 화면에 보여줄 카드 이름 */
export function cardLabel(card) {
  if (!card) return '';
  if (card.kind !== KIND.NORMAL) return SPECIAL_LABEL[card.kind] ?? '';
  return `${SUIT_LABEL[card.suit]}${RANK_LABEL[card.rank]}`;
}

/** 균등 셔플 (Fisher-Yates) */
export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
