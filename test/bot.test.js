import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeck, KIND } from '../shared/tichu/cards.js';
import { botNeedsAction, decideBotAction } from '../server/bot.js';

const deck = buildDeck();
const byId = new Map(deck.map((c) => [c.id, c]));
const card = (id) => byId.get(id);

const players = (mySeat = 3) =>
  [0, 1, 2, 3].map((seat) => ({
    seat,
    name: `p${seat}`,
    catId: seat + 1,
    handCount: 7,
    out: false,
    calls: null,
    isBot: seat === mySeat,
  }));

function view(extra = {}) {
  return {
    phase: 'playing',
    mySeat: 3,
    hand: [],
    table: null,
    wish: null,
    players: players(),
    isMyTurn: true,
    canCallTichu: false,
    canCallGrand: false,
    myExchange: null,
    pendingGift: null,
    ...extra,
  };
}

test('봇은 자기 차례에만 행동한다', () => {
  assert.equal(botNeedsAction(view({ isMyTurn: true })), true);
  assert.equal(botNeedsAction(view({ isMyTurn: false })), false);
  assert.equal(botNeedsAction(view({ phase: 'grand', isMyTurn: false })), true);
  assert.equal(botNeedsAction(view({ phase: 'roundEnd' })), false);
  assert.equal(botNeedsAction(view({ phase: 'dragon', isMyTurn: false, pendingGift: { by: 3 } })), true);
});

test('강한 손이면 그랜드 티츄를 선언한다', () => {
  const strong = view({
    phase: 'grand',
    isMyTurn: false,
    hand: ['dragon', 'phoenix', 'jade-14', 'sword-14', 'star-13', 'pagoda-13', 'jade-2', 'sword-3'].map(card),
    canCallGrand: true,
  });
  assert.equal(decideBotAction(strong).type, 'callGrand');

  const weak = view({
    phase: 'grand',
    isMyTurn: false,
    hand: ['jade-2', 'sword-2', 'star-3', 'pagoda-4', 'jade-5', 'sword-6', 'star-7', 'pagoda-8'].map(card),
    canCallGrand: true,
  });
  assert.equal(decideBotAction(weak).type, 'grandReady');
});

test('교환에서는 낮은 카드를 내고 파트너에게 가장 나은 카드를 준다', () => {
  const v = view({
    phase: 'exchange',
    isMyTurn: false,
    hand: ['jade-2', 'sword-3', 'star-4', 'jade-14', 'dragon'].map(card),
  });
  const action = decideBotAction(v);
  assert.equal(action.type, 'exchange');
  const given = [action.left, action.partner, action.right];
  assert.deepEqual(new Set(given), new Set(['jade-2', 'sword-3', 'star-4']));
  assert.equal(action.partner, 'star-4');
});

test('낼 수 없으면 패스하고, 선일 때는 카드를 낸다', () => {
  const lead = view({ hand: ['jade-2', 'sword-3', 'star-4', 'pagoda-5', 'jade-9'].map(card) });
  const play = decideBotAction(lead);
  assert.equal(play.type, 'play');
  assert.ok(play.cards.length > 0);

  const follow = view({
    hand: ['jade-2', 'sword-3'].map(card),
    table: { cards: [card('jade-14')], rank: 14, type: 'single', seat: 0 },
  });
  assert.equal(decideBotAction(follow).type, 'pass');
});

test('용을 이겼을 때 티츄 선언이 없는 상대에게 트릭을 넘긴다', () => {
  const ps = players();
  ps[0].calls = 'tichu'; // 3번의 상대는 0과 2
  ps[0].handCount = 9;
  ps[2].handCount = 5;
  const v = view({ phase: 'dragon', isMyTurn: false, players: ps, pendingGift: { by: 3 } });
  const action = decideBotAction(v);
  assert.equal(action.type, 'giftDragon');
  assert.equal(action.targetSeat, 2, '선언이 없는 상대 2번에게 넘긴다');
});

test('봇은 참새를 낼 때 소원을 걸지 않는다', () => {
  const v = view({ hand: [card('mahjong'), card('jade-3'), card('sword-4'), card('star-5'), card('pagoda-6')] });
  const action = decideBotAction(v);
  assert.equal(action.type, 'play');
  assert.equal(action.wish, null);
  assert.ok(action.cards.includes('mahjong'));
});
