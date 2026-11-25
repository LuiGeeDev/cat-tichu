/**
 * 안정적인 WebSocket 클라이언트
 * - 자동 재접속 (지수 백오프 + 지터)
 * - 앱 레벨 하트비트로 죽은 연결 감지
 * - 토큰 기반 세션 복구 (새로고침/네트워크 끊김에도 같은 자리로 복귀)
 * - 액션 재전송 대비 actionId 부여
 */

const RECONNECT_BASE = 700;
const RECONNECT_MAX = 8000;
const HEARTBEAT_MS = 12000;
const IDLE_LIMIT = 30000;

export class TichuClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.status = 'offline';
    this.intent = null;
    this.attempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastMessage = 0;
    this.closedByUser = false;
    this.joined = false;
    this.actionSeq = 0;
    this.queue = [];
  }

  setStatus(next) {
    if (this.status === next) return;
    this.status = next;
    this.handlers.onStatus?.(next);
  }

  get url() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  open() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByUser = false;
    this.setStatus(this.attempts > 0 ? 'reconnecting' : 'connecting');

    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.lastMessage = Date.now();
      this.startHeartbeat();
      if (this.intent) this.sendIntent();
    };

    ws.onmessage = (event) => {
      this.lastMessage = Date.now();
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handle(msg);
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.ws === ws) this.ws = null;
      if (this.closedByUser) {
        this.setStatus('offline');
        return;
      }
      this.joined = false;
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      /* onclose 에서 처리 */
    };
  }

  handle(msg) {
    switch (msg.t) {
      case 'joined': {
        this.attempts = 0;
        this.joined = true;
        this.intent = { t: 'join', code: msg.code, token: msg.token, name: msg.name };
        this.setStatus('online');
        this.handlers.onJoined?.(msg);
        this.flush();
        break;
      }
      case 'state': {
        this.handlers.onState?.(msg.view);
        break;
      }
      case 'left': {
        this.hardClose();
        this.handlers.onLeft?.();
        break;
      }
      case 'info': {
        this.handlers.onInfo?.(msg.message);
        break;
      }
      case 'error': {
        this.handlers.onError?.(msg.message, Boolean(msg.fatal));
        if (msg.fatal) {
          this.hardClose();
          this.intent = null;
        }
        break;
      }
      case 'pong':
        break;
      default:
        break;
    }
  }

  hardClose() {
    this.closedByUser = true;
    this.joined = false;
    this.queue = [];
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setStatus('offline');
  }

  scheduleReconnect() {
    if (this.closedByUser || !this.intent) return;
    if (this.reconnectTimer) return;
    this.attempts += 1;
    const delay = Math.min(RECONNECT_BASE * 2 ** (this.attempts - 1), RECONNECT_MAX);
    const jitter = Math.random() * 400;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay + jitter);
  }

  reconnectNow() {
    if (this.closedByUser) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.attempts = 0;
    this.open();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastMessage > IDLE_LIMIT) {
        // 응답이 없으면 연결을 끊고 재접속한다.
        try {
          this.ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      this.send({ t: 'ping' });
    }, HEARTBEAT_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  sendIntent() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(this.intent));
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  create({ name, catId }) {
    this.intent = { t: 'create', name, catId };
    this.attempts = 0;
    this.closedByUser = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.sendIntent();
    else this.open();
  }

  join({ code, name, token, catId }) {
    this.intent = { t: 'join', code: code?.toUpperCase(), name, token, catId };
    this.attempts = 0;
    this.closedByUser = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.sendIntent();
    else this.open();
  }

  action(action) {
    this.actionSeq += 1;
    const actionId = `${Date.now().toString(36)}-${this.actionSeq}`;
    const payload = { t: 'action', action: { ...action, actionId } };
    if (!this.joined) {
      this.queue.push(payload);
      if (this.queue.length > 20) this.queue.shift();
      this.reconnectNow();
      return;
    }
    this.send(payload);
  }

  flush() {
    if (!this.joined) return;
    const pending = this.queue;
    this.queue = [];
    for (const payload of pending) this.send(payload);
  }

  destroy() {
    this.hardClose();
    this.intent = null;
  }
}
