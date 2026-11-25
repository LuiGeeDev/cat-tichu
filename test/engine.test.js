import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeck, cardsPoints, KIND, sortHand } from '../shared/tichu/cards.js';
import { analyze, beats, legalPlays, validatePlay, TYPE } from '../shared/tichu/combinations.js';
import { applyAction, createGame, PHASE } from '../shared/tichu/engine.js';

const deck = buildDeck();
const byId = new Map(deck.map((c) => [c.id, c]));
const card = (id) => {
  const c = byId.get(id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const hand = (...ids) => ids.map(card);
const combo = (ids) => {
  const results = analyze(hand(...ids));
  assert.ok(results.length > 0, `expected a combo for ${ids.join(',')}`);
  return results[0];
};

test('덱은 56장이고 총점은 100점이다', () => {
  assert.equal(deck.length, 56);
  assert.equal(cardsPoints(deck), 100);
  assert.equal(new Set(deck.map((c) => c.id)).size, 56);
});

test('기본 조합 판정', () => {
  assert.equal(combo(['jade-5']).type, TYPE.SINGLE);
  assert.equal(combo(['jade-5', 'sword-5']).type, TYPE.PAIR);
  assert.equal(combo(['jade-5', 'sword-5', 'star-5']).type, TYPE.TRIPLE);
  assert.equal(combo(['jade-5', 'sword-5', 'star-5', 'pagoda-9', 'jade-9']).type, TYPE.FULLHOUSE);
  assert.equal(combo(['jade-3', 'sword-4', 'star-5', 'pagoda-6', 'jade-7']).type, TYPE.STRAIGHT);
  assert.equal(combo(['jade-3', 'jade-3', 'sword-4', 'sword-4']).type, TYPE.STAIRS);
  assert.equal(combo(['jade-3', 'jade-3', 'sword-4', 'sword-4', 'star-5', 'star-5']).size, 6);
});

test('폭탄 판정', () => {
  const quad = combo(['jade-9', 'sword-9', 'star-9', 'pagoda-9']);
  assert.equal(quad.type, TYPE.BOMB);
  assert.equal(quad.bombKind, 'quad');

  const flush = combo(['jade-5', 'jade-6', 'jade-7', 'jade-8', 'jade-9']);
  assert.equal(flush.type, TYPE.BOMB);
  assert.equal(flush.bombKind, 'straightFlush');
});

test('마작은 1로 스트레이트에 들어간다', () => {
  const c = combo(['mahjong', 'jade-2', 'sword-3', 'star-4', 'pagoda-5']);
  assert.equal(c.type, TYPE.STRAIGHT);
  assert.equal(c.rank, 5);
});

test('봉새는 와일드 카드로 쓰인다', () => {
  const pair = combo(['phoenix', 'jade-8']);
  assert.equal(pair.type, TYPE.PAIR);
  assert.equal(pair.rank, 8);

  const straight = combo(['phoenix', 'jade-5', 'sword-6', 'star-7', 'pagoda-9']);
  assert.equal(straight.type, TYPE.STRAIGHT);
  assert.equal(straight.rank, 9);

  const full = combo(['phoenix', 'jade-5', 'sword-5', 'star-5', 'pagoda-9']);
  assert.equal(full.type, TYPE.FULLHOUSE);
  assert.equal(full.rank, 5);

  // 봉새로는 폭탄을 만들 수 없다
  assert.equal(analyze(hand('phoenix', 'jade-9', 'sword-9', 'star-9')).length, 0);
});

test('봉새 싱글은 앞 카드보다 0.5 높다', () => {
  const phoenix = combo(['phoenix']);
  const ace = combo(['jade-14']);
  const dragon = combo(['dragon']);
  assert.equal(beats(phoenix, ace), true);
  assert.equal(beats(ace, phoenix), false);
  assert.equal(beats(dragon, phoenix), true);
  assert.equal(beats(phoenix, dragon), false);
});

test('조합 비교 규칙', () => {
  const s8 = combo(['jade-8']);
  const s9 = combo(['sword-9']);
  assert.equal(beats(s9, s8), true);
  assert.equal(beats(s8, s9), false);

  const straight5 = combo(['jade-3', 'sword-4', 'star-5', 'pagoda-6', 'jade-7']);
  const straight6 = combo(['jade-4', 'sword-5', 'star-6', 'pagoda-7', 'jade-8', 'sword-9']);
  assert.equal(beats(straight6, straight5), false, '길이가 다르면 못 덮는다');

  const bomb = combo(['jade-9', 'sword-9', 'star-9', 'pagoda-9']);
  const flushBomb = combo(['jade-5', 'jade-6', 'jade-7', 'jade-8', 'jade-9']);
  assert.equal(beats(bomb, straight5), true);
  assert.equal(beats(flushBomb, bomb), true, '5장 폭탄 > 4장 폭탄');
  assert.equal(beats(bomb, flushBomb), false);
});

test('개는 선으로만 낼 수 있다', () => {
  const dog = combo(['dog']);
  assert.equal(dog.type, TYPE.DOG);
  const pair = combo(['jade-5', 'sword-5']);
  assert.equal(beats(dog, pair), false);
});

test('소원을 지킬 수 있으면 소원 카드가 포함된 수만 허용된다', () => {
  const myHand = hand('jade-8', 'sword-3');
  const table = combo(['jade-5']);
  const { plays, mustFulfill } = legalPlays(myHand, table, 8);
  assert.equal(mustFulfill, true);
  assert.ok(plays.every((p) => p.cards.some((c) => c.rank === 8)));
  assert.equal(validatePlay(myHand, ['sword-3'], table, 8).ok, false);
  assert.equal(validatePlay(myHand, ['jade-8'], table, 8).ok, true);
});

test('게임 시작: 8장 배분 → 그랜드 티츄 → 6장 배분 → 교환', () => {
  const game = createGame([
    { seat: 0, name: 'A', catId: 1 },
    { seat: 1, name: 'B', catId: 2 },
    { seat: 2, name: 'C', catId: 3 },
    { seat: 3, name: 'D', catId: 4 },
  ]);

  assert.equal(game.phase, PHASE.GRAND);
  assert.ok(game.hands.every((h) => h.length === 8));
  assert.equal(game.hands.flat().length, 32);

  applyAction(game, 0, { type: 'callGrand' });
  assert.equal(game.calls[0], 'grand');

  for (let s = 0; s < 4; s += 1) applyAction(game, s, { type: 'grandReady' });
  assert.equal(game.phase, PHASE.EXCHANGE);
  assert.ok(game.hands.every((h) => h.length === 14));

  for (let s = 0; s < 4; s += 1) {
    const picks = game.hands[s].slice(0, 3).map((c) => c.id);
    applyAction(game, s, { type: 'exchange', left: picks[0], partner: picks[1], right: picks[2] });
  }

  assert.equal(game.phase, PHASE.PLAYING);
  assert.ok(game.hands.every((h) => h.length === 14));
  const mjSeat = [0, 1, 2, 3].find((s) => game.hands[s].some((c) => c.kind === KIND.MAHJONG));
  assert.equal(game.turn, mjSeat);
});

function gameInPlay(handsBySeat, extra = {}) {
  const game = createGame([
    { seat: 0, name: 'A', catId: 1 },
    { seat: 1, name: 'B', catId: 2 },
    { seat: 2, name: 'C', catId: 3 },
    { seat: 3, name: 'D', catId: 4 },
  ]);
  game.phase = PHASE.PLAYING;
  game.hands = handsBySeat.map((ids) => sortHand(hand(...ids)));
  game.deck = [];
  game.table = null;
  game.trickCards = [];
  game.passes = 0;
  game.finishOrder = [];
  game.piles = [[], [], [], []];
  game.calls = [null, null, null, null];
  game.turn = 0;
  Object.assign(game, extra);
  return game;
}

test('라운드 종료 점수 계산', () => {
  const game = gameInPlay(
    [[], [], [], ['jade-2']],
    {
      finishOrder: [0, 1, 2],
      piles: [
        hand('jade-5', 'sword-5'),
        hand('jade-10'),
        [],
        [],
      ],
      turn: 3,
    },
  );

  applyAction(game, 3, { type: 'play', cards: ['jade-2'] });

  assert.equal(game.phase, PHASE.ROUND_END);
  assert.deepEqual(game.scores, [10, 10]);
  assert.equal(game.roundResult.finishOrder[3], 3);
});

test('더블 승리는 200점, 카드 점수는 계산하지 않는다', () => {
  const game = gameInPlay(
    [[], ['jade-2'], [], []],
    {
      finishOrder: [0, 2, 3],
      piles: [hand('jade-10'), [], hand('jade-5'), []],
      turn: 1,
    },
  );

  applyAction(game, 1, { type: 'play', cards: ['jade-2'] });

  assert.equal(game.phase, PHASE.ROUND_END);
  assert.equal(game.roundResult.doubleVictory, true);
  assert.deepEqual(game.scores, [200, 0]);
});

test('티츄 성공/실패 점수', () => {
  const game = gameInPlay(
    [[], [], [], ['jade-2']],
    {
      finishOrder: [0, 1, 2],
      calls: ['tichu', 'tichu', null, null],
      turn: 3,
    },
  );

  applyAction(game, 3, { type: 'play', cards: ['jade-2'] });

  // A(0) 성공 +100, B(1) 실패 -100 → 카드 점수는 0:0
  assert.deepEqual(game.scores, [100, -100]);
});

test('용으로 스틱을 이기면 상대에게 넘긴다', () => {
  const game = gameInPlay([['dragon'], ['jade-2'], ['jade-3'], ['jade-4']], { turn: 0 });

  applyAction(game, 0, { type: 'play', cards: ['dragon'] });
  applyAction(game, 1, { type: 'pass' });
  applyAction(game, 2, { type: 'pass' });
  applyAction(game, 3, { type: 'pass' });

  assert.equal(game.phase, PHASE.DRAGON);
  assert.equal(game.pendingGift.by, 0);

  // 파트너(2)에게는 넘길 수 없다
  assert.throws(() => applyAction(game, 0, { type: 'giftDragon', targetSeat: 2 }), /상대 팀/);

  applyAction(game, 0, { type: 'giftDragon', targetSeat: 1 });
  assert.equal(game.phase, PHASE.PLAYING);
  assert.equal(game.piles[1].length, 1);
  assert.equal(game.turn, 1, '용을 낸 사람이 아웃이면 다음 사람이 선을 잡는다');
});

test('개는 파트너에게 선을 넘긴다', () => {
  const game = gameInPlay([['dog', 'jade-2'], ['jade-3'], ['jade-4'], ['jade-5']], { turn: 0 });

  applyAction(game, 0, { type: 'play', cards: ['dog'] });
  assert.equal(game.turn, 2);
  assert.equal(game.hands[0].length, 1);
});

test('세 번 패스하면 스틱이 끝난다', () => {
  const game = gameInPlay(
    [['jade-14', 'jade-2'], ['jade-3'], ['jade-4'], ['jade-5']],
    { turn: 0 },
  );

  applyAction(game, 0, { type: 'play', cards: ['jade-14'] });
  applyAction(game, 1, { type: 'pass' });
  applyAction(game, 2, { type: 'pass' });
  applyAction(game, 3, { type: 'pass' });

  assert.equal(game.piles[0].length, 1);
  assert.equal(game.turn, 0, '스틱을 가져간 사람이 다시 선');
  assert.equal(game.table, null);
});
