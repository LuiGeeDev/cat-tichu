import { CATS } from '../cats.js';
import { CatAvatar, Paw, TeamChip } from './ui.jsx';
import { TARGET_OPTIONS } from '../../shared/tichu/engine.js';

export default function Lobby({ view, onAction, onLeave, onOpenRules, onCopyInvite, status }) {
  const me = view.players.find((p) => p.isMe);
  const usedCats = new Set(view.players.map((p) => p.catId));
  const emptyCount = 4 - view.players.length;
  const humans = view.players.filter((p) => !p.isBot).length;
  const canToggleBot = view.isHost && (humans === 3 || view.hasBot);
  const seats = [0, 1, 2, 3];

  return (
    <div className="screen lobby">
      <header className="lobby__head">
        <div className="lobby__code">
          <span className="eyebrow">초대 코드</span>
          <div className="code-pill">
            <strong>{view.roomCode}</strong>
            <button type="button" className="btn btn--mini" onClick={onCopyInvite}>
              링크 복사
            </button>
          </div>
        </div>
        <div className="lobby__head-actions">
          <button type="button" className="btn btn--mini btn--ghost" onClick={onOpenRules}>
            규칙
          </button>
          <button type="button" className="btn btn--mini btn--ghost" onClick={onLeave}>
            나가기
          </button>
        </div>
      </header>

      <section className="lobby__seats">
        {seats.map((seat) => {
          const player = view.players.find((p) => p.seat === seat);
          const team = seat % 2;
          if (!player) {
            return (
              <div key={seat} className={`seat-card seat-card--empty team-${team}`}>
                <div className="seat-card__empty">
                  <Paw size={26} />
                  <span>기다리는 중</span>
                </div>
                <span className="seat-card__team">
                  <TeamChip team={team} />
                </span>
              </div>
            );
          }
          return (
            <div
              key={seat}
              className={`seat-card team-${team} ${player.isMe ? 'is-me' : ''} ${
                player.connected ? '' : 'is-offline'
              }`}
            >
              <span className="seat-card__team">
                <TeamChip team={team} />
              </span>
              <CatAvatar catId={player.catId} size={78} dim={!player.connected} />
              <div className="seat-card__name">
                {player.name}
                {player.isMe && <span className="tag">나</span>}
                {player.isBot && <span className="tag tag--bot">봇</span>}
                {player.isHost && <span className="tag tag--host">방장</span>}
              </div>
              <div className="seat-card__status">
                {player.isBot ? (
                  <span className="bot-status">자동 플레이</span>
                ) : player.connected ? (
                  <span className="online">
                    <i /> 접속 중
                  </span>
                ) : (
                  <span className="offline">연결 끊김</span>
                )}
              </div>
              {view.isHost && !player.isMe && !player.isBot && (
                <button
                  type="button"
                  className="seat-card__kick"
                  onClick={() => onAction({ type: 'kick', seat })}
                  title="내보내기"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="panel lobby__cats">
        <div className="lobby__cats-head">
          <h2>내 고양이</h2>
          <p className="hint">다른 고양이는 친구가 고를 수 있어요.</p>
        </div>
        <div className="cat-grid">
          {CATS.map((cat) => {
            const owner = view.players.find((p) => p.catId === cat.id);
            const mine = owner?.isMe;
            const taken = Boolean(owner) && !mine;
            return (
              <button
                key={cat.id}
                type="button"
                className={`cat-choice ${mine ? 'is-selected' : ''}`}
                disabled={taken}
                onClick={() => onAction({ type: 'setCat', catId: cat.id })}
                title={taken ? `${owner.name}님이 선택함` : cat.name}
              >
                <CatAvatar catId={cat.id} size={52} dim={taken} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel lobby__target">
        <div className="lobby__target-head">
          <h2>목표 점수</h2>
          <span className="hint">
            {view.isHost ? '원하는 점수를 골라 주세요.' : '방장이 목표 점수를 정합니다.'}
          </span>
          <span className="target-badge">{view.target}점</span>
        </div>
        <div className="target-options">
          {TARGET_OPTIONS.map((score) => (
            <button
              key={score}
              type="button"
              className={`target-option ${view.target === score ? 'is-selected' : ''}`}
              disabled={!view.isHost}
              onClick={() => onAction({ type: 'setTarget', target: score })}
            >
              {score}점
            </button>
          ))}
        </div>
      </section>

      <footer className="lobby__footer">
        {canToggleBot && (
          <button
            type="button"
            className="btn btn--mini btn--ghost"
            onClick={() => onAction({ type: 'setBot', enabled: !view.hasBot })}
          >
            {view.hasBot ? '봇 제거' : '봇으로 채우기'}
          </button>
        )}
        {emptyCount > 0 ? (
          <div className="lobby__waiting">
            <span className="spinner" />
            <span>
              친구 <b>{emptyCount}명</b>을 기다리는 중
            </span>
            <button type="button" className="btn btn--mini btn--ghost" onClick={onCopyInvite}>
              초대 링크 복사
            </button>
          </div>
        ) : view.isHost ? (
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            onClick={() => onAction({ type: 'start' })}
          >
            게임 시작
          </button>
        ) : (
          <div className="lobby__waiting">
            <span className="spinner" />
            <span>방장이 시작하길 기다리는 중</span>
          </div>
        )}
        <p className="lobby__teams">
          마주 앉은 두 명이 한 팀입니다 · A팀 {me && me.seat % 2 === 0 ? '(나 포함)' : ''} / B팀
        </p>
        {status !== 'online' && <p className="hint hint--warn">연결을 복구하는 중입니다…</p>}
      </footer>
    </div>
  );
}
