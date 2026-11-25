/**
 * 방(room) 관리: 좌석, 재접속 토큰, 액션 라우팅
 */

import crypto from 'node:crypto';
import { createGame, applyAction, viewFor, PHASE } from '../shared/tichu/engine.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL = 1000 * 60 * 60 * 6; // 6시간
const MAX_PLAYERS = 4;

export class StoreError extends Error {}

function makeCode(existing) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  throw new StoreError('방 코드를 만들 수 없습니다. 다시 시도해 주세요.');
}

function sanitizeName(name) {
  const cleaned = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 12);
  return cleaned;
}

const CAT_IDS = [1, 2, 3, 4, 5, 6, 7];

export class RoomStore {
  constructor() {
    this.rooms = new Map();
  }

  get roomCount() {
    return this.rooms.size;
  }

  getRoom(code) {
    return this.rooms.get(String(code ?? '').toUpperCase()) ?? null;
  }

  newPlayer(room, { name, catId }) {
    const seat = room.players.length;
    const usedCats = new Set(room.players.map((p) => p.catId));
    const fallbackCat = CAT_IDS.find((id) => !usedCats.has(id)) ?? CAT_IDS[seat % CAT_IDS.length];
    const player = {
      token: crypto.randomUUID(),
      seat,
      name: sanitizeName(name) || `고양이${seat + 1}`,
      catId: usedCats.has(Number(catId)) ? fallbackCat : Number(catId) || fallbackCat,
      connected: false,
      socket: null,
      lastSeen: Date.now(),
      actionIds: [],
    };
    room.players.push(player);
    return player;
  }

  createRoom({ name, catId }) {
    const code = makeCode(this.rooms);
    const room = {
      code,
      players: [],
      game: null,
      hostSeat: 0,
      banned: new Set(),
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    this.rooms.set(code, room);
    const player = this.newPlayer(room, { name, catId });
    return { room, player };
  }

  joinRoom({ code, name, token, catId }) {
    const room = this.getRoom(code);
    if (!room) throw new StoreError('방을 찾을 수 없습니다. 초대 링크를 다시 확인해 주세요.');
    if (token && room.banned?.has(token)) {
      throw new StoreError('이 방에서 내보내졌습니다.');
    }

    if (token) {
      const existing = room.players.find((p) => p.token === token);
      if (existing) {
        room.lastActive = Date.now();
        return { room, player: existing, reconnected: true };
      }
    }

    if (room.game) throw new StoreError('이미 게임이 시작된 방입니다.');
    if (room.players.length >= MAX_PLAYERS) throw new StoreError('방이 가득 찼습니다.');

    const player = this.newPlayer(room, { name, catId });
    room.lastActive = Date.now();
    return { room, player, reconnected: false };
  }

  bindSocket(room, player, socket) {
    if (player.socket && player.socket !== socket) {
      try {
        player.socket.close(4001, '다른 곳에서 접속했습니다.');
      } catch {
        /* ignore */
      }
    }
    player.socket = socket;
    player.connected = true;
    player.lastSeen = Date.now();
    room.lastActive = Date.now();
  }

  disconnect(room, player) {
    if (!room || !player) return;
    if (player.socket) {
      try {
        player.socket.close();
      } catch {
        /* ignore */
      }
    }
    player.socket = null;
    player.connected = false;
    player.lastSeen = Date.now();
    room.lastActive = Date.now();

    // 방장이 나갔으면 남아있는 사람에게 위임
    if (room.hostSeat === player.seat) {
      const next = room.players.find((p) => p.connected && p.seat !== player.seat);
      if (next) room.hostSeat = next.seat;
    }
  }

  leave(room, player) {
    if (!room || room.game) throw new StoreError('게임 중에는 나갈 수 없습니다.');
    const idx = room.players.indexOf(player);
    if (idx < 0) return;
    room.players.splice(idx, 1);
    room.players.forEach((p, i) => {
      p.seat = i;
    });
    if (room.hostSeat >= room.players.length) room.hostSeat = 0;
    room.lastActive = Date.now();
  }

  /** 방장 여부 확인 */
  requireHost(room, player) {
    if (room.hostSeat !== player.seat) throw new StoreError('방장만 할 수 있습니다.');
  }

  syncGamePlayers(room) {
    if (!room.game) return;
    room.game.players = room.players.map((p) => ({ seat: p.seat, name: p.name, catId: p.catId }));
  }

  handleAction(room, player, action = {}) {
    if (action.actionId) {
      if (player.actionIds.includes(action.actionId)) return { duplicate: true };
      player.actionIds.push(action.actionId);
      if (player.actionIds.length > 30) player.actionIds.shift();
    }

    room.lastActive = Date.now();

    switch (action.type) {
      case 'setCat': {
        if (room.game) throw new StoreError('게임 중에는 고양이를 바꿀 수 없습니다.');
        const catId = Number(action.catId);
        if (!CAT_IDS.includes(catId)) throw new StoreError('없는 고양이입니다.');
        if (room.players.some((p) => p !== player && p.catId === catId)) {
          throw new StoreError('다른 사람이 이미 고른 고양이입니다.');
        }
        player.catId = catId;
        break;
      }

      case 'start': {
        this.requireHost(room, player);
        if (room.game) throw new StoreError('이미 시작했습니다.');
        if (room.players.length !== MAX_PLAYERS) throw new StoreError('4명이 모여야 시작할 수 있습니다.');
        room.game = createGame(room.players.map((p) => ({ seat: p.seat, name: p.name, catId: p.catId })));
        break;
      }

      case 'nextRound': {
        this.requireHost(room, player);
        if (!room.game) throw new StoreError('게임이 없습니다.');
        if (room.game.phase !== PHASE.ROUND_END) throw new StoreError('아직 라운드가 끝나지 않았습니다.');
        applyAction(room.game, player.seat, { type: 'nextRound' });
        break;
      }

      case 'newGame': {
        this.requireHost(room, player);
        if (!room.game) throw new StoreError('게임이 없습니다.');
        if (room.game.phase !== PHASE.GAME_OVER) throw new StoreError('게임이 끝난 뒤에만 새 게임을 시작할 수 있습니다.');
        applyAction(room.game, player.seat, { type: 'newGame' });
        break;
      }

      case 'kick': {
        this.requireHost(room, player);
        if (room.game) throw new StoreError('게임 중에는 내보낼 수 없습니다.');
        const target = room.players[Number(action.seat)];
        if (!target) throw new StoreError('없는 자리입니다.');
        if (target === player) throw new StoreError('자신은 내보낼 수 없습니다.');
        room.banned.add(target.token);
        if (target.socket) {
          try {
            target.socket.close(4003, 'kicked');
          } catch {
            /* ignore */
          }
        }
        this.leave(room, target);
        break;
      }

      case 'leave': {
        this.leave(room, player);
        break;
      }

      default: {
        if (!room.game) throw new StoreError('아직 게임이 시작되지 않았습니다.');
        applyAction(room.game, player.seat, action);
        break;
      }
    }

    return { ok: true };
  }

  serialize(room, player) {
    if (!room.game) {
      return {
        phase: PHASE.LOBBY,
        roomCode: room.code,
        mySeat: player.seat,
        isHost: room.hostSeat === player.seat,
        hostSeat: room.hostSeat,
        canStart: room.players.length === MAX_PLAYERS,
        players: room.players.map((p) => ({
          seat: p.seat,
          name: p.name,
          catId: p.catId,
          connected: p.connected,
          isHost: room.hostSeat === p.seat,
          isMe: p.seat === player.seat,
        })),
        log: [],
      };
    }

    const view = viewFor(room.game, player.seat);
    view.players.forEach((p, i) => {
      p.connected = room.players[i]?.connected ?? false;
    });
    view.roomCode = room.code;
    view.isHost = room.hostSeat === player.seat;
    view.myName = player.name;
    view.hostSeat = room.hostSeat;
    return view;
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const anyConnected = room.players.some((p) => p.connected);
      if (!anyConnected && now - room.lastActive > ROOM_TTL) {
        this.rooms.delete(code);
      }
    }
  }
}
