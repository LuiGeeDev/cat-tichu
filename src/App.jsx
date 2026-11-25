import { useCallback, useEffect, useRef, useState } from 'react';
import { TichuClient } from './net.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import Rules from './components/Rules.jsx';
import { Modal } from './components/Modal.jsx';
import { CatAvatar, Paw } from './components/ui.jsx';

const SESSION_KEY = 'cat-tichu.session';

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readInviteCode() {
  const match = window.location.hash.match(/room\/([a-zA-Z0-9]{5})/);
  return match ? match[1].toUpperCase() : '';
}

function writeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export default function App() {
  const [view, setView] = useState(null);
  const [status, setStatus] = useState('offline');
  const [toast, setToast] = useState(null);
  const [fatal, setFatal] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [session, setSession] = useState(readSession);
  const [inviteCode, setInviteCode] = useState(readInviteCode);

  const clientRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const goHome = useCallback(() => {
    writeSession(null);
    setSession(null);
    setView(null);
    setFatal('');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    const client = new TichuClient({
      onStatus: (next) => setStatus(next),
      onState: (nextView) => setView(nextView),
      onJoined: (msg) => {
        const next = { code: msg.code, token: msg.token, name: msg.name };
        writeSession(next);
        setSession(next);
        setFatal('');
        setInviteCode('');
        window.history.replaceState(null, '', `#/room/${msg.code}`);
      },
      onLeft: () => {
        goHome();
        setStatus('offline');
      },
      onError: (message, isFatal) => {
        showToast(message);
        if (isFatal) {
          writeSession(null);
          setSession(null);
          setView(null);
          setFatal(message);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      },
      onInfo: (message) => showToast(message),
    });
    clientRef.current = client;

    const stored = readSession();
    if (stored?.code && stored?.token) {
      client.join({ code: stored.code, token: stored.token, name: stored.name || '고양이' });
    }

    return () => client.destroy();
  }, [goHome, showToast]);

  useEffect(() => {
    const onHash = () => setInviteCode(readInviteCode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const reconnect = () => clientRef.current?.reconnectNow();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reconnect();
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', () => setStatus('reconnecting'));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const createRoom = useCallback((name) => {
    localStorage.setItem('cat-tichu.name', name);
    setFatal('');
    clientRef.current?.create({ name });
  }, []);

  const joinRoom = useCallback((code, name) => {
    localStorage.setItem('cat-tichu.name', name);
    setFatal('');
    clientRef.current?.join({ code, name });
  }, []);

  const action = useCallback((payload) => {
    clientRef.current?.action(payload);
  }, []);

  const leave = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    if (status === 'online') {
      client.action({ type: 'leave' });
      setTimeout(() => {
        if (!readSession()) return;
        // 응답이 없으면 로컬에서 정리한다.
        client.destroy();
        goHome();
        setStatus('offline');
      }, 2000);
    } else {
      client.destroy();
      goHome();
      setStatus('offline');
    }
  }, [goHome, status]);

  const copyInvite = useCallback(async () => {
    const code = view?.roomCode;
    if (!code) return;
    const link = `${window.location.origin}${window.location.pathname}#/room/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('초대 링크를 복사했습니다. 친구에게 보내 주세요!');
    } catch {
      const area = document.createElement('textarea');
      area.value = link;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        showToast('초대 링크를 복사했습니다.');
      } catch {
        showToast(`초대 코드: ${code}`);
      }
      document.body.removeChild(area);
    }
  }, [showToast, view?.roomCode]);

  const retry = useCallback(() => {
    clientRef.current?.reconnectNow();
  }, []);

  const waiting = !view && Boolean(session);

  return (
    <>
      {view ? (
        view.phase === 'lobby' ? (
          <Lobby
            view={view}
            onAction={action}
            onLeave={leave}
            onOpenRules={() => setRulesOpen(true)}
            onCopyInvite={copyInvite}
            status={status}
          />
        ) : (
          <Game
            view={view}
            onAction={action}
            onOpenRules={() => setRulesOpen(true)}
            onCopyInvite={copyInvite}
            status={status}
          />
        )
      ) : waiting ? (
        <div className="screen splash">
          <div className="splash__cats">
            <CatAvatar catId={2} size={96} />
            <span className="splash__paw">
              <Paw size={26} />
            </span>
          </div>
          <h1>고양이 티츄</h1>
          {status === 'offline' ? (
            <>
              <p className="splash__text">서버에 연결할 수 없습니다.</p>
              <div className="splash__actions">
                <button type="button" className="btn btn--primary" onClick={retry}>
                  다시 시도
                </button>
                <button type="button" className="btn btn--text" onClick={goHome}>
                  처음으로
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="splash__text">
                <span className="spinner" /> 방에 다시 연결하는 중…
              </p>
              <button type="button" className="btn btn--text" onClick={goHome}>
                처음으로
              </button>
            </>
          )}
        </div>
      ) : (
        <Home
          onCreate={createRoom}
          onJoin={joinRoom}
          inviteCode={inviteCode}
          error={fatal}
          onOpenRules={() => setRulesOpen(true)}
        />
      )}

      <Modal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title="티츄 규칙"
        subtitle="Fata Morgana 공식 4인 룰을 한국어로 정리했습니다."
        className="modal--rules"
      >
        <Rules />
      </Modal>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
