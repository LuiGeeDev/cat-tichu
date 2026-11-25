/**
 * 티츄 게임 엔진 (서버 권위)
 * 모든 상태 전이는 이 파일에서만 일어난다. 클라이언트는 view 만 받는다.
 */

import { buildDeck, shuffle, sortHand, cardsPoints, cardLabel, KIND, RANK_LABEL } from './cards.js';
import { legalPlays, validatePlay, comboLabel, TYPE } from './combinations.js';

export const PHASE = {
  LOBBY: 'lobby',
  GRAND: 'grand', // 8장 배분, 그랜드 티츄 선언
  EXCHANGE: 'exchange', // 카드 3장 교환
  PLAYING: 'playing',
  DRAGON: 'dragon', // 용의 스틱을 상대에게 넘기는 중
  ROUND_END: 'roundEnd',
  GAME_OVER: 'gameOver',
};

export const TARGET_SCORE = 1000;

export class GameError extends Error {}

const fail = (message) => {
  throw new GameError(message);
};

const teamOf = (seat) => seat % 2;
const partnerOf = (seat) => (seat + 2) % 4;
const nextSeat = (seat) => (seat + 1) % 4;
const prevSeat = (seat) => (seat + 3) % 4;
const active = (state) => [0, 1, 2, 3].filter((s) => state.hands[s].length > 0);

let logSeq = 0;
function addLog(state, text, seat = null, kind = 'info') {
  logSeq += 1;
  state.log.push({ id: logSeq, text, seat, kind, at: Date.now() });
  if (state.log.length > 200) state.log.shift();
}

function nameOf(state, seat) {
  return state.players[seat]?.name ?? `${seat + 1}번`;
}

function requirePhase(state, ...phases) {
  if (!phases.includes(state.phase)) fail('지금은 할 수 없는 동작입니다.');
}

export function createGame(players) {
  const state = {
    version: 0,
    round: 0,
    phase: PHASE.LOBBY,
    target: TARGET_SCORE,
    scores: [0, 0],
    players: players.map((p) => ({ seat: p.seat, name: p.name, catId: p.catId })),
    hands: [[], [], [], []],
    piles: [[], [], [], []],
    calls: [null, null, null, null], // null | 'tichu' | 'grand'
    grandReady: [false, false, false, false],
    exchange: [null, null, null, null], // { left, partner, right }
    turn: null,
    table: null, // { combo, seat }
    trickCards: [],
    passes: 0,
    wish: null,
    wishBy: null,
    finishOrder: [],
    played: [false, false, false, false],
    log: [],
    roundResult: null,
    pendingGift: null,
    roundEnding: false,
    dealer: Math.floor(Math.random() * 4),
    deck: [],
    winner: null,
  };
  startRound(state);
  return state;
}

function startRound(state) {
  state.round += 1;
  state.phase = PHASE.GRAND;
  state.hands = [[], [], [], []];
  state.piles = [[], [], [], []];
  state.calls = [null, null, null, null];
  state.grandReady = [false, false, false, false];
  state.exchange = [null, null, null, null];
  state.turn = null;
  state.table = null;
  state.trickCards = [];
  state.passes = 0;
  state.wish = null;
  state.wishBy = null;
  state.finishOrder = [];
  state.played = [false, false, false, false];
  state.roundResult = null;
  state.pendingGift = null;
  state.roundEnding = false;
  state.winner = null;
  state.log = [];

  const deck = shuffle(buildDeck());
  for (let i = 0; i < 8; i += 1) {
    for (let s = 0; s < 4; s += 1) state.hands[s].push(deck.pop());
  }
  state.deck = deck;
  state.hands = state.hands.map(sortHand);

  addLog(state, `라운드 ${state.round} 시작! 각자 8장을 받았습니다.`, null, 'round');
  addLog(state, '그랜드 티츄를 선언할 수 있습니다. (성공 +200 / 실패 -200)', null, 'hint');
}

function dealRemaining(state) {
  for (let i = 0; i < 6; i += 1) {
    for (let s = 0; s < 4; s += 1) state.hands[s].push(state.deck.pop());
  }
  state.hands = state.hands.map(sortHand);
  state.phase = PHASE.EXCHANGE;
  addLog(state, '남은 6장을 나눠주었습니다. 이제 카드 3장을 교환합니다.', null, 'round');
}

function applyExchange(state) {
  const oldHands = state.hands.map((h) => [...h]);
  const nextHands = state.hands.map((h) => [...h]);

  for (let s = 0; s < 4; s += 1) {
    const ex = state.exchange[s];
    const remove = new Set([ex.left, ex.partner, ex.right]);
    nextHands[s] = nextHands[s].filter((c) => !remove.has(c.id));
  }

  for (let s = 0; s < 4; s += 1) {
    const ex = state.exchange[s];
    const give = (id, to) => {
      const card = oldHands[s].find((c) => c.id === id);
      if (!card) fail('교환할 카드를 찾을 수 없습니다.');
      nextHands[to].push(card);
    };
    give(ex.left, prevSeat(s)); // 왼쪽 상대
    give(ex.partner, partnerOf(s)); // 파트너
    give(ex.right, nextSeat(s)); // 오른쪽 상대
  }

  state.hands = nextHands.map(sortHand);
  state.phase = PHASE.PLAYING;
  addLog(state, '카드 교환이 끝났습니다. 마작을 가진 사람이 먼저 냅니다.', null, 'round');

  const mjSeat = [0, 1, 2, 3].find((s) => state.hands[s].some((c) => c.kind === KIND.MAHJONG));
  state.turn = mjSeat ?? 0;
  addLog(state, `${nameOf(state, state.turn)}님의 선입니다.`, state.turn, 'turn');
}

function nextSeatWithCards(state, from) {
  for (let i = 1; i <= 4; i += 1) {
    const s = (from + i) % 4;
    if (state.hands[s].length > 0) return s;
  }
  return null;
}

function passesNeeded(state) {
  const count = active(state).length;
  const tableSeatHasCards = state.table && state.hands[state.table.seat].length > 0;
  return Math.max(0, count - (tableSeatHasCards ? 1 : 0));
}

function describeCombo(combo) {
  if (!combo) return '';
  if (combo.type === TYPE.SINGLE) {
    if (combo.dragon) return '용';
    if (combo.phoenix) return '봉새';
    return cardLabel(combo.cards[0]);
  }
  if (combo.type === TYPE.BOMB) {
    return combo.bombKind === 'straightFlush' ? '스트레이트 플러시 폭탄' : `${RANK_LABEL[combo.rank]} 포카드 폭탄`;
  }
  const label = comboLabel(combo);
  if (combo.type === TYPE.DOG) return '개';
  if (combo.rank && combo.rank <= 14) return `${label} · ${RANK_LABEL[combo.rank]}`;
  return label;
}

function finishSeat(state, seat) {
  state.finishOrder.push(seat);
  const place = state.finishOrder.length;
  addLog(state, `${nameOf(state, seat)}님 ${place}등으로 아웃!`, seat, 'out');
}

/** 스틱 종료: 마지막으로 낸 사람이 스틱을 가져간다 (용은 예외) */
function endTrick(state) {
  const table = state.table;
  const cards = [...state.trickCards];
  state.table = null;
  state.trickCards = [];
  state.passes = 0;
  if (!table) return;

  if (table.combo.dragon) {
    state.phase = PHASE.DRAGON;
    state.pendingGift = { by: table.seat, cards };
    addLog(state, `${nameOf(state, table.seat)}님이 용으로 스틱을 이겼습니다. 상대에게 넘길 상대를 선택하세요.`, table.seat, 'dragon');
    return;
  }

  state.piles[table.seat].push(...cards);
  addLog(state, `${nameOf(state, table.seat)}님이 스틱을 가져갔습니다.`, table.seat, 'trick');

  if (state.hands[table.seat].length > 0) {
    state.turn = table.seat;
  } else {
    state.turn = nextSeatWithCards(state, table.seat);
  }
}

/** 라운드 종료 직전, 마지막 스틱을 정리하고 점수를 계산한다 */
function concludeRound(state) {
  const table = state.table;
  if (table) {
    const cards = [...state.trickCards];
    state.table = null;
    state.trickCards = [];
    state.passes = 0;
    if (table.combo.dragon) {
      state.phase = PHASE.DRAGON;
      state.roundEnding = true;
      state.pendingGift = { by: table.seat, cards };
      return;
    }
    state.piles[table.seat].push(...cards);
  }
  finishRound(state);
}

function finishRound(state) {
  for (const s of [0, 1, 2, 3]) {
    if (!state.finishOrder.includes(s)) state.finishOrder.push(s);
  }
  const first = state.finishOrder[0];
  const last = state.finishOrder[3];

  // 마지막 사람의 남은 카드는 상대 팀에게, 자신이 모은 스틱은 1등에게 간다.
  const piles = state.piles.map((p) => [...p]);
  const lastHand = state.hands[last];
  const oppSeat = nextSeat(last);
  piles[oppSeat].push(...lastHand);
  piles[first].push(...piles[last]);
  piles[last] = [];

  const pilePoints = [0, 0, 0, 0];
  for (let s = 0; s < 4; s += 1) pilePoints[s] = cardsPoints(piles[s]);

  const cardPointsByTeam = [0, 0];
  for (let s = 0; s < 4; s += 1) cardPointsByTeam[teamOf(s)] += pilePoints[s];

  const doubleVictory = teamOf(first) === teamOf(state.finishOrder[1]);
  const deltas = [0, 0];
  const tichuDetails = [];

  for (let s = 0; s < 4; s += 1) {
    const call = state.calls[s];
    if (!call) continue;
    const value = call === 'grand' ? 200 : 100;
    const success = first === s;
    const delta = success ? value : -value;
    deltas[teamOf(s)] += delta;
    tichuDetails.push({ seat: s, call, success, delta });
  }

  if (doubleVictory) {
    deltas[teamOf(first)] += 200;
  } else {
    deltas[0] += cardPointsByTeam[0];
    deltas[1] += cardPointsByTeam[1];
  }

  const before = [...state.scores];
  state.scores = [state.scores[0] + deltas[0], state.scores[1] + deltas[1]];

  state.roundResult = {
    round: state.round,
    finishOrder: [...state.finishOrder],
    first,
    last,
    doubleVictory,
    cardPointsByTeam,
    pilePoints,
    tichuDetails,
    deltas,
    before,
    after: [...state.scores],
    winnerTeam: doubleVictory ? teamOf(first) : null,
  };

  const winnerTeam = doubleVictory ? teamOf(first) : null;
  addLog(
    state,
    doubleVictory
      ? `더블 승리! ${winnerTeam === 0 ? 'A팀' : 'B팀'} +200점 (카드 점수 계산 없음)`
      : `카드 점수 A팀 ${cardPointsByTeam[0]} : B팀 ${cardPointsByTeam[1]}`,
    null,
    'score',
  );

  state.phase = PHASE.ROUND_END;
  state.turn = null;

  const top = Math.max(state.scores[0], state.scores[1]);
  if (top >= state.target && state.scores[0] !== state.scores[1]) {
    state.phase = PHASE.GAME_OVER;
    state.winner = state.scores[0] > state.scores[1] ? 0 : 1;
    addLog(state, `${state.winner === 0 ? 'A팀' : 'B팀'} 승리! ${state.scores[state.winner]}점`, null, 'gameover');
  }
}

function playCards(state, seat, cardIds, wish) {
  const hand = state.hands[seat];
  const target = state.table ? state.table.combo : null;
  const result = validatePlay(hand, cardIds, target, state.wish);
  if (!result.ok) fail(result.error);

  const combo = result.combo;
  const containsMahjong = combo.cards.some((c) => c.kind === KIND.MAHJONG);

  if (wish != null) {
    if (!containsMahjong) fail('마작을 낼 때만 소원을 빌 수 있습니다.');
    if (!Number.isInteger(wish) || wish < 2 || wish > 14) fail('소원은 2부터 A까지 가능합니다.');
  }

  // 기존 소원 이행 확인
  if (state.wish != null && combo.cards.some((c) => c.rank === state.wish)) {
    addLog(state, `소원 ${RANK_LABEL[state.wish]}이(가) 이루어졌습니다.`, seat, 'wish');
    state.wish = null;
    state.wishBy = null;
  }

  const ids = new Set(combo.cards.map((c) => c.id));
  state.hands[seat] = hand.filter((c) => !ids.has(c.id));
  state.played[seat] = true;

  if (containsMahjong && wish != null) {
    state.wish = wish;
    state.wishBy = seat;
    addLog(state, `${nameOf(state, seat)}님이 ${RANK_LABEL[wish]}을(를) 소원했습니다.`, seat, 'wish');
  }

  if (combo.type === TYPE.DOG) {
    state.piles[seat].push(...combo.cards);
    addLog(state, `${nameOf(state, seat)}님이 개를 냈습니다. 선이 파트너에게 넘어갑니다.`, seat, 'play');
    if (state.hands[seat].length === 0) finishSeat(state, seat);
    if (state.finishOrder.length >= 3) {
      concludeRound(state);
      return;
    }
    const partner = partnerOf(seat);
    state.turn = state.hands[partner].length > 0 ? partner : nextSeatWithCards(state, partner);
    addLog(state, `${nameOf(state, state.turn)}님이 선을 잡았습니다.`, state.turn, 'turn');
    return;
  }

  state.table = { combo, seat };
  state.trickCards.push(...combo.cards);
  state.passes = 0;
  addLog(state, `${nameOf(state, seat)}: ${describeCombo(combo)}`, seat, 'play');

  if (state.hands[seat].length === 0) finishSeat(state, seat);

  if (state.finishOrder.length >= 3) {
    concludeRound(state);
    return;
  }

  state.turn = nextSeatWithCards(state, seat);
}

function passTurn(state, seat) {
  if (!state.table) fail('선을 잡았을 때는 패스할 수 없습니다.');
  const { mustFulfill } = legalPlays(state.hands[seat], state.table.combo, state.wish);
  if (mustFulfill) fail('마작 소원을 지켜야 합니다. 소원 카드가 포함된 조합을 내야 합니다.');

  state.passes += 1;
  addLog(state, `${nameOf(state, seat)}님 패스`, seat, 'pass');

  if (state.passes >= passesNeeded(state)) {
    endTrick(state);
    if (state.phase === PHASE.PLAYING) {
      addLog(state, `${nameOf(state, state.turn)}님의 선입니다.`, state.turn, 'turn');
    }
  } else {
    state.turn = nextSeatWithCards(state, seat);
  }
}

function giveDragon(state, seat, targetSeat) {
  const gift = state.pendingGift;
  if (!gift) fail('넘길 스틱이 없습니다.');
  if (gift.by !== seat) fail('용을 낸 사람만 스틱을 넘길 수 있습니다.');
  if (targetSeat !== nextSeat(seat) && targetSeat !== prevSeat(seat)) {
    fail('상대 팀에게만 스틱을 넘길 수 있습니다.');
  }

  state.piles[targetSeat].push(...gift.cards);
  state.pendingGift = null;
  addLog(state, `${nameOf(state, seat)}님이 스틱을 ${nameOf(state, targetSeat)}님에게 넘겼습니다.`, seat, 'dragon');

  if (state.roundEnding) {
    state.roundEnding = false;
    finishRound(state);
    return;
  }

  state.phase = PHASE.PLAYING;
  state.turn = state.hands[seat].length > 0 ? seat : nextSeatWithCards(state, seat);
  addLog(state, `${nameOf(state, state.turn)}님의 선입니다.`, state.turn, 'turn');
}

export function applyAction(state, seat, action = {}) {
  if (!state) fail('게임이 시작되지 않았습니다.');
  const type = action.type;

  switch (type) {
    case 'grandReady': {
      requirePhase(state, PHASE.GRAND);
      if (state.grandReady[seat]) return state;
      state.grandReady[seat] = true;
      if (state.grandReady.every(Boolean)) {
        dealRemaining(state);
      } else {
        addLog(state, `${nameOf(state, seat)}님 준비 완료`, seat, 'ready');
      }
      break;
    }

    case 'callGrand': {
      requirePhase(state, PHASE.GRAND);
      if (state.grandReady[seat]) fail('이미 준비를 마쳤습니다.');
      if (state.calls[seat] === 'grand') fail('이미 그랜드 티츄를 선언했습니다.');
      state.calls[seat] = 'grand';
      addLog(state, `${nameOf(state, seat)}님 그랜드 티츄 선언! (+200 / -200)`, seat, 'tichu');
      break;
    }

    case 'callTichu': {
      requirePhase(state, PHASE.GRAND, PHASE.EXCHANGE, PHASE.PLAYING);
      if (state.calls[seat] === 'tichu') fail('이미 티츄를 선언했습니다.');
      if (state.played[seat]) fail('카드를 낸 뒤에는 티츄를 선언할 수 없습니다.');
      state.calls[seat] = 'tichu';
      addLog(state, `${nameOf(state, seat)}님 티츄 선언! (+100 / -100)`, seat, 'tichu');
      break;
    }

    case 'exchange': {
      requirePhase(state, PHASE.EXCHANGE);
      if (state.exchange[seat]) fail('이미 카드를 건넸습니다.');
      const picks = [action.left, action.partner, action.right];
      if (picks.some((id) => !id)) fail('카드 3장을 모두 골라야 합니다.');
      if (new Set(picks).size !== 3) fail('서로 다른 카드 3장을 골라야 합니다.');
      for (const id of picks) {
        if (!state.hands[seat].some((c) => c.id === id)) fail('손에 없는 카드입니다.');
      }
      state.exchange[seat] = { left: action.left, partner: action.partner, right: action.right };
      addLog(state, `${nameOf(state, seat)}님 카드 교환 완료`, seat, 'ready');
      if (state.exchange.every(Boolean)) applyExchange(state);
      break;
    }

    case 'play': {
      requirePhase(state, PHASE.PLAYING);
      if (state.turn !== seat) fail('당신의 차례가 아닙니다.');
      playCards(state, seat, action.cards, action.wish ?? null);
      break;
    }

    case 'pass': {
      requirePhase(state, PHASE.PLAYING);
      if (state.turn !== seat) fail('당신의 차례가 아닙니다.');
      passTurn(state, seat);
      break;
    }

    case 'giftDragon': {
      requirePhase(state, PHASE.DRAGON);
      giveDragon(state, seat, action.targetSeat);
      break;
    }

    case 'nextRound': {
      requirePhase(state, PHASE.ROUND_END);
      startRound(state);
      break;
    }

    case 'newGame': {
      requirePhase(state, PHASE.GAME_OVER);
      state.scores = [0, 0];
      state.round = 0;
      startRound(state);
      break;
    }

    default:
      fail('알 수 없는 동작입니다.');
  }

  state.version += 1;
  return state;
}

/** 플레이어별 시야 (다른 사람 손패는 절대 포함하지 않는다) */
export function viewFor(state, seat) {
  const hand = sortHand(state.hands[seat]);
  const target = state.table ? state.table.combo : null;
  const wishInfo =
    state.phase === PHASE.PLAYING && state.turn === seat && state.wish != null
      ? legalPlays(hand, target, state.wish)
      : { mustFulfill: false };

  return {
    version: state.version,
    phase: state.phase,
    round: state.round,
    target: state.target,
    scores: [...state.scores],
    winner: state.winner,
    dealer: state.dealer,
    turn: state.turn,
    table: state.table
      ? {
          cards: state.table.combo.cards,
          type: state.table.combo.type,
          size: state.table.combo.size,
          bomb: state.table.combo.bomb,
          dragon: !!state.table.combo.dragon,
          phoenix: !!state.table.combo.phoenix,
          rank: state.table.combo.rank,
          seat: state.table.seat,
          label: comboLabel(state.table.combo),
        }
      : null,
    trickCards: [...state.trickCards],
    wish: state.wish,
    wishBy: state.wishBy,
    passes: state.passes,
    finishOrder: [...state.finishOrder],
    players: state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      catId: p.catId,
      handCount: state.hands[i].length,
      out: state.finishOrder.includes(i),
      place: state.finishOrder.indexOf(i) >= 0 ? state.finishOrder.indexOf(i) + 1 : null,
      calls: state.calls[i],
      ready: state.grandReady[i],
      exchangeDone: !!state.exchange[i],
      pileCount: state.piles[i].length,
      pilePoints: cardsPoints(state.piles[i]),
    })),
    hand,
    mySeat: seat,
    myCall: state.calls[seat],
    hasPlayed: state.played[seat],
    canCallGrand: state.phase === PHASE.GRAND && !state.grandReady[seat] && state.calls[seat] !== 'grand',
    canCallTichu:
      [PHASE.GRAND, PHASE.EXCHANGE, PHASE.PLAYING].includes(state.phase) &&
      !state.played[seat] &&
      state.calls[seat] !== 'tichu',
    mustFulfill: wishInfo.mustFulfill,
    myExchange: state.exchange[seat],
    exchangeCount: state.exchange.filter(Boolean).length,
    pendingGift: state.pendingGift ? { by: state.pendingGift.by } : null,
    roundResult: state.roundResult,
    log: state.log.slice(-60),
    isMyTurn: state.phase === PHASE.PLAYING && state.turn === seat,
  };
}
