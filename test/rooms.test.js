import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomStore } from '../server/rooms.js';

test('빈 자리가 있으면 언제든 봇을 추가할 수 있다', () => {
  const store = new RoomStore();
  const { room, player: host } = store.createRoom({ name: '방장', catId: 1 });

  store.handleAction(room, host, { type: 'setBot', enabled: true });
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].isBot, true);
  assert.equal(room.players[1].name, '봇');
  assert.equal(room.players[1].connected, true);

  store.joinRoom({ code: room.code, name: '손님1', catId: 2 });
  store.joinRoom({ code: room.code, name: '손님2', catId: 3 });
  assert.equal(room.players.length, 4);

  // 이미 봇이 있으면 같은 요청은 무시된다.
  store.handleAction(room, host, { type: 'setBot', enabled: true });
  assert.equal(room.players.length, 4);

  store.handleAction(room, host, { type: 'setBot', enabled: false });
  assert.equal(room.players.length, 3);
  assert.equal(room.players.some((p) => p.isBot), false);
});

test('네 명이 꽉 찬 방에는 봇을 넣을 수 없다', () => {
  const store = new RoomStore();
  const { room, player: host } = store.createRoom({ name: '방장', catId: 1 });
  for (let i = 0; i < 3; i += 1) {
    store.joinRoom({ code: room.code, name: `손님${i}`, catId: i + 2 });
  }
  assert.throws(
    () => store.handleAction(room, host, { type: 'setBot', enabled: true }),
    /빈 자리/,
  );
});

test('봇이 있어도 남은 자리에는 사람이 참가할 수 있다', () => {
  const store = new RoomStore();
  const { room, player: host } = store.createRoom({ name: '방장', catId: 1 });
  store.handleAction(room, host, { type: 'setBot', enabled: true });
  const guest = store.joinRoom({ code: room.code, name: '손님', catId: 2 });
  assert.equal(guest.player.seat, 2);
  assert.equal(room.players.length, 3);
});
