/**
 * 봇 플레이어 결정 로직
 * - 무작위가 아니라 손패 강도/조합 비용/파트너 상황을 고려한 휴리스틱
 * - 서버에서만 사용하며, 일반 플레이어와 같은 action 인터페이스를 따른다.
 */

import { legalPlays } from '../shared/tichu/combinations.js';
import { KIND, cardPoints } from '../shared/tichu/cards.js';

const strength = (card) => {
  switch (card.kind) {
    case KIND.DRAGON:
      return 100;
    case KIND.PHOENIX:
      return 80;
    case KIND.MAHJONG:
      return 28;
    case KIND.DOG:
      return 18;
    default:
      return card.rank + (card.rank === 14 ? 8 : 0);
  }
};

const handPower = (hand = []) => hand.reduce((sum, card) => sum + strength(card), 0);
const trickValue = (cards = []) => cards.reduce((sum, card) => sum + cardPoints(card), 0);

export function botNeedsAction(view) {
  if (!view) return false;
  switch (view.phase) {
    case 'grand':
      return !view.players[view.mySeat]?.ready;
    case 'exchange':
      return !view.myExchange;
    case 'dragon':
      return view.pendingGift?.by === view.mySeat;
    case 'playing':
      return Boolean(view.isMyTurn);
    default:
      return false;
  }
}

function decideGrand(view) {
  const power = handPower(view.hand);
  const specials = view.hand.filter((c) => c.kind !== KIND.NORMAL);
  const strong =
    power >= 150 ||
    (specials.some((c) => c.kind === KIND.DRAGON) && specials.some((c) => c.kind === KIND.PHOENIX)) ||
    specials.filter((c) => c.rank === 14 || c.kind === KIND.DRAGON).length >= 3;
  if (view.canCallGrand && strong) return { type: 'callGrand' };
  return { type: 'grandReady' };
}

function decideExchange(view) {
  const sorted = [...view.hand].sort((a, b) => strength(a) - strength(b));
  const worst = sorted.slice(0, 3);
  // 파트너에게는 세 장 중 가장 괜찮은 카드를, 상대에게는 나쁜 카드를 건넨다.
  return {
    type: 'exchange',
    left: worst[0].id,
    partner: worst[2].id,
    right: worst[1].id,
  };
}

function choosePlay(view) {
  const { plays } = legalPlays(view.hand, view.table, view.wish);
  if (!plays.length) return null;

  const score = (combo) => {
    const cards = combo.cards;
    const dragon = cards.some((c) => c.kind === KIND.DRAGON);
    const phoenix = cards.some((c) => c.kind === KIND.PHOENIX);
    const value = trickValue(cards);
    if (view.table == null) {
      // 선일 때: 많은 카드를 처리하면서 낮은 숫자를 쓰고, 폭탄·용·봉황은 아낀다.
      return cards.length * 12 - (combo.rank ?? 0) * 0.7 - (combo.bomb ? 90 : 0) - (dragon ? 35 : 0) - (phoenix ? 12 : 0);
    }
    // 받을 때: 낮은 조합으로 덮고, 폭탄은 비용이 큰 판만 사용한다.
    return -(combo.rank ?? 0) * 3 - cards.length * 0.4 - (combo.bomb ? 60 : 0) - (phoenix ? 18 : 0) - (dragon ? 8 : 0) + value * 0.3;
  };

  const ranked = [...plays].sort((a, b) => score(b) - score(a));

  // 폭탄만 남았고 판이 작으면 패스해서 아낀다.
  if (view.table && ranked.every((p) => p.bomb) && trickValue(view.table.cards) < 10 && view.hand.length > 4) {
    return null;
  }
  return ranked[0];
}

function decidePlaying(view) {
  if (view.canCallTichu && handPower(view.hand) >= 175) return { type: 'callTichu' };

  const me = view.mySeat;
  const partner = view.players[(me + 2) % 4];
  const opponents = [view.players[(me + 1) % 4], view.players[(me + 3) % 4]];

  // 개: 파트너가 먼저 아웃에 가깝고 내가 선일 때 파트너에게 선을 넘긴다.
  if (view.table == null) {
    const dog = view.hand.find((c) => c.kind === KIND.DOG);
    if (
      dog &&
      partner &&
      !partner.out &&
      partner.handCount < Math.min(...opponents.map((o) => o.handCount))
    ) {
      return { type: 'play', cards: [dog.id] };
    }
  }

  const combo = choosePlay(view);
  if (!combo) return { type: 'pass' };
  return {
    type: 'play',
    cards: combo.cards.map((c) => c.id),
    wish: null,
  };
}

function decideDragon(view) {
  const opponents = [1, 3].map((offset) => (view.mySeat + offset) % 4);
  const sorted = opponents.sort((a, b) => {
    const pa = view.players[a];
    const pb = view.players[b];
    const paCall = pa.calls ? 1 : 0;
    const pbCall = pb.calls ? 1 : 0;
    if (paCall !== pbCall) return paCall - pbCall; // 선언 없는 상대에게
    return pb.handCount - pa.handCount; // 카드가 많은 상대에게
  });
  return { type: 'giftDragon', targetSeat: sorted[0] };
}

export function decideBotAction(view) {
  switch (view.phase) {
    case 'grand':
      return decideGrand(view);
    case 'exchange':
      return decideExchange(view);
    case 'dragon':
      return decideDragon(view);
    case 'playing':
      return decidePlaying(view);
    default:
      return null;
  }
}
