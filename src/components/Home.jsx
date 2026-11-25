import { useEffect, useState } from 'react';
import { CATS } from '../cats.js';
import { CatAvatar, Paw } from './ui.jsx';

export default function Home({ onCreate, onJoin, inviteCode, error, onOpenRules }) {
  const [name, setName] = useState(() => localStorage.getItem('cat-tichu.name') ?? '');
  const [code, setCode] = useState(inviteCode ?? '');

  useEffect(() => {
    setCode(inviteCode ?? '');
  }, [inviteCode]);

  const cleanName = name.trim().slice(0, 12);

  const create = () => onCreate(cleanName || '고양이');
  const join = () => {
    if (code.trim().length !== 5) return;
    onJoin(code.trim().toUpperCase(), cleanName || '고양이');
  };

  // 초대 코드가 채워져 있으면 Enter는 참가, 없으면 새 방 만들기
  const submitOnEnter = () => {
    if (code.trim().length === 5) join();
    else create();
  };

  return (
    <div className="screen home">
      <div className="home__glow home__glow--a" />
      <div className="home__glow home__glow--b" />

      <header className="home__hero">
        <div className="home__cats" aria-hidden="true">
          {CATS.map((cat, index) => (
            <span
              key={cat.id}
              className={`home__cat home__cat--${index + 1}`}
              style={{ animationDelay: `${index * 0.35}s` }}
            >
              <CatAvatar catId={cat.id} size={index % 2 === 0 ? 66 : 56} />
            </span>
          ))}
        </div>
        <div className="home__logo">
          <span className="home__paw">
            <Paw size={30} />
          </span>
          <h1>고양이 티츄</h1>
        </div>
        <p className="home__tagline">네 마리 고양이가 둘씩 짝을 지어 겨루는 카드 게임</p>
      </header>

      <main className="panel home__panel">
        {error && (
          <div className="banner banner--error" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span className="field__label">닉네임</span>
          <input
            className="input"
            value={name}
            maxLength={12}
            placeholder="예: 츄르대장"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitOnEnter();
            }}
            autoComplete="nickname"
          />
        </label>

        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={create}>
          새 방 만들기
        </button>

        <div className="or">
          <span>또는 초대받은 방에 참가</span>
        </div>

        <div className="join-row">
          <input
            className="input input--code"
            value={code}
            maxLength={5}
            placeholder="초대 코드"
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') join();
            }}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={join}
            disabled={code.trim().length !== 5}
          >
            참가
          </button>
        </div>

        {inviteCode && (
          <p className="hint hint--center">
            <b>{inviteCode}</b> 방에 초대받았습니다. 닉네임을 정하고 참가하세요.
          </p>
        )}
      </main>

      <footer className="home__footer">
        <button type="button" className="btn btn--text" onClick={onOpenRules}>
          티츄 규칙 보기
        </button>
        <p className="home__credit">공식 룰 © Fata Morgana · 4인 파트너십 티츄</p>
      </footer>
    </div>
  );
}
