import { useEffect, useMemo, useState } from 'react';
import { Card } from './Card.jsx';
import { CatAvatar, Paw, TeamChip } from './ui.jsx';
import { Modal } from './Modal.jsx';
import { analyze, beats, legalPlays, comboLabel, TYPE } from '../../shared/tichu/combinations.js';
import { KIND, RANK_LABEL } from '../../shared/tichu/cards.js';

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SLOTS = ['left', 'partner', 'right'];
const SLOT_LABEL = { left: '왼쪽 상대', partner: '파트너', right: '오른쪽 상대' };

function checkSelection(hand, ids, table, wish) {
  if (!ids.length) return { ok: false, empty: true };
  const cards = ids.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  if (cards.length !== ids.length) return { ok: false, reason: '카드를 다시 선택하세요' };

  const combos = analyze(cards);
  if (!combos.length) return { ok: false, reason: '조합이 아닙니다' };

  const legal = combos.filter((combo) =>
    combo.type === TYPE.DOG ? !table : beats(combo, table),
  );
  if (!legal.length) {
    return { ok: false, reason: table ? '지금 조합을 덮을 수 없습니다' : '낼 수 없는 조합입니다' };
  }

  if (wish != null && !cards.some((c) => c.rank === wish)) {
    const { mustFulfill } = legalPlays(hand, table, wish);
    if (mustFulfill) return { ok: false, reason: `소원 ${RANK_LABEL[wish]} 카드가 포함되어야 합니다` };
  }

  const best = [...legal].sort((a, b) => {
    if (a.bomb !== b.bomb) return a.bomb ? -1 : 1;
    return (b.rank ?? 0) - (a.rank ?? 0);
  })[0];

  return { ok: true, combo: best, label: comboLabel(best) };
}

function Seat({ player, position, isTurn, isPartner, compact }) {
  if (!player) return null;
  return (
    <div
      className={`seat seat--${position} team-${player.seat % 2} ${isTurn ? 'is-turn' : ''} ${
        player.connected ? '' : 'is-offline'
      } ${compact ? 'is-compact' : ''}`}
    >
      <div className="seat__avatar">
        <CatAvatar catId={player.catId} size={compact ? 42 : 58} dim={!player.connected} />
        {isPartner && <span className="seat__partner">파트너</span>}
        {isTurn && <span className="seat__turn">차례</span>}
      </div>
      <div className="seat__info">
        <div className="seat__top">
          <span className="seat__name">{player.name}</span>
          <span className="seat__count">
            <Paw size={11} />
            {player.handCount}
          </span>
        </div>
        <div className="seat__badges">
          {player.calls === 'grand' && <span className="badge badge--grand">그랜드</span>}
          {player.calls === 'tichu' && <span className="badge badge--tichu">티츄</span>}
          {player.place && <span className="badge badge--out">{player.place}등</span>}
          {!player.connected && <span className="badge badge--offline">끊김</span>}
          {player.pilePoints !== 0 && (
            <span className={`badge badge--points ${player.pilePoints < 0 ? 'is-negative' : ''}`}>
              {player.pilePoints > 0 ? `+${player.pilePoints}` : player.pilePoints}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Game({ view, onAction, onOpenRules, onCopyInvite, status }) {
  const me = view.mySeat;
  const partner = (me + 2) % 4;
  const right = (me + 1) % 4;
  const left = (me + 3) % 4;
  const players = view.players;
  const myTeam = me % 2;

  const [selected, setSelected] = useState([]);
  const [picks, setPicks] = useState({ left: null, partner: null, right: null });
  const [wishOpen, setWishOpen] = useState(false);
  const [tichuOpen, setTichuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const handKey = view.hand.map((c) => c.id).join(',');
  const isExchange = view.phase === 'exchange';
  const isPlaying = view.phase === 'playing';
  const canAct = isPlaying && view.isMyTurn;
  const submitted = view.myExchange;
  const shownPicks = submitted ?? picks;

  useEffect(() => {
    setSelected([]);
    setWishOpen(false);
  }, [handKey, view.phase, view.turn]);

  useEffect(() => {
    if (view.phase !== 'exchange') setPicks({ left: null, partner: null, right: null });
  }, [view.phase]);

  useEffect(() => {
    if (view.phase === 'roundEnd' || view.phase === 'gameOver') setResultOpen(true);
  }, [view.phase, view.round]);

  const selInfo = useMemo(
    () => checkSelection(view.hand, selected, view.table, view.wish),
    [selected, view.hand, view.table, view.wish],
  );

  const cardOf = (id) => view.hand.find((c) => c.id === id) ?? null;

  const toggleCard = (cardId) => {
    if (isExchange) {
      if (submitted) return;
      const existing = SLOTS.find((slot) => picks[slot] === cardId);
      if (existing) {
        setPicks((prev) => ({ ...prev, [existing]: null }));
        return;
      }
      const empty = SLOTS.find((slot) => !picks[slot]);
      if (!empty) return;
      setPicks((prev) => ({ ...prev, [empty]: cardId }));
      return;
    }
    if (!canAct) return;
    setSelected((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  };

  const play = (wish) => {
    if (!selInfo.ok) return;
    const hasMahjong = selected.some((id) => cardOf(id)?.kind === KIND.MAHJONG);
    if (hasMahjong && wish === undefined) {
      setWishOpen(true);
      return;
    }
    onAction({ type: 'play', cards: selected, wish: wish ?? null });
    setSelected([]);
    setWishOpen(false);
  };

  const exchangeReady = SLOTS.every((slot) => Boolean(picks[slot]));
  const submitExchange = () => {
    if (!exchangeReady) return;
    onAction({ type: 'exchange', left: picks.left, partner: picks.partner, right: picks.right });
  };

  const readyCount = players.filter((p) => p.ready).length;
  const myReady = players[me]?.ready;
  const rr = view.roundResult;
  const tichuTotals = [0, 0];
  if (rr) {
    for (const t of rr.tichuDetails) tichuTotals[t.seat % 2] += t.delta;
  }

  const handClickable = isExchange ? !submitted : canAct;
  const activeName = view.turn != null ? players[view.turn]?.name : null;

  return (
    <div className={`game phase-${view.phase}`}>
      <header className="game__bar">
        <button type="button" className="icon-btn" onClick={() => setLogOpen(true)} title="기록">
          <span aria-hidden="true">📜</span>
        </button>

        <div className="scorebar">
          <div className={`score score--0 ${myTeam === 0 ? 'is-mine' : ''}`}>
            <span className="score__team">A팀</span>
            <span className="score__value">{view.scores[0]}</span>
          </div>
          <div className="scorebar__mid">
            <span className="scorebar__round">라운드 {view.round}</span>
            <span className="scorebar__target">{view.target}점 목표</span>
          </div>
          <div className={`score score--1 ${myTeam === 1 ? 'is-mine' : ''}`}>
            <span className="score__team">B팀</span>
            <span className="score__value">{view.scores[1]}</span>
          </div>
        </div>

        <div className="game__bar-right">
          <button type="button" className="icon-btn" onClick={onCopyInvite} title="초대 링크 복사">
            <span aria-hidden="true">🔗</span>
          </button>
          <button type="button" className="icon-btn" onClick={onOpenRules} title="규칙">
            <span aria-hidden="true">?</span>
          </button>
        </div>
      </header>

      {status !== 'online' && (
        <div className="conn-banner" role="status">
          <span className="spinner" /> 연결을 복구하는 중입니다… 잠시만 기다려 주세요.
        </div>
      )}

      <main className="board">
        <Seat player={players[partner]} position="top" isTurn={view.turn === partner} isPartner />

        <div className="board__mid">
          <Seat player={players[left]} position="left" isTurn={view.turn === left} compact />
          <div className={`mat ${view.isMyTurn ? 'is-myturn' : ''} ${view.wish != null ? 'has-wish' : ''}`}>
            {view.table ? (
              <div className="mat__play" key={view.table.cards.map((c) => c.id).join('')}>
                <div className="mat__cards">
                  {view.table.cards.map((card) => (
                    <Card key={card.id} card={card} size="md" />
                  ))}
                </div>
                <div className="mat__caption">
                  <b>{players[view.table.seat]?.name}</b> · {view.table.label}
                </div>
              </div>
            ) : (
              <div className="mat__empty">
                <Paw size={26} />
                <span>{view.phase === 'playing' ? (view.isMyTurn ? '선을 잡았습니다' : '새 스틱') : '테이블'}</span>
              </div>
            )}

            <div className="mat__passes" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`pass-dot ${i < view.passes ? 'is-on' : ''}`} />
              ))}
            </div>

            {view.wish != null && (
              <div className="wish-badge">
                소원 <b>{RANK_LABEL[view.wish]}</b>
              </div>
            )}
          </div>
          <Seat player={players[right]} position="right" isTurn={view.turn === right} compact />
        </div>
      </main>

      <section className="playarea">
        <div className="playarea__top">
          <div className={`me-chip ${view.isMyTurn ? 'is-turn' : ''}`}>
            <CatAvatar catId={players[me].catId} size={34} />
            <span>{players[me].name}</span>
            <span className="me-chip__team">{myTeam === 0 ? 'A팀' : 'B팀'}</span>
            {players[me].calls && (
              <span className={`badge ${players[me].calls === 'grand' ? 'badge--grand' : 'badge--tichu'}`}>
                {players[me].calls === 'grand' ? '그랜드 티츄' : '티츄'}
              </span>
            )}
          </div>

          {isPlaying && (
            <div className="turn-hint">
              {view.isMyTurn ? (
                <span className="turn-hint__me">내 차례</span>
              ) : (
                <span>{activeName}님 차례</span>
              )}
              {view.mustFulfill && <span className="badge badge--wish">소원 지켜야 함</span>}
            </div>
          )}
        </div>

        {view.phase === 'grand' && (
          <div className="grand-panel">
            <div className="grand-panel__text">
              <b>그랜드 티츄</b>
              <p>8장을 보고 선언하세요. 성공 +200 · 실패 -200</p>
            </div>
            <div className="grand-panel__actions">
              {view.canCallGrand && (
                <button
                  type="button"
                  className="btn btn--grand"
                  onClick={() => onAction({ type: 'callGrand' })}
                >
                  그랜드 티츄!
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                disabled={myReady}
                onClick={() => onAction({ type: 'grandReady' })}
              >
                {myReady ? '준비 완료' : '준비'}
              </button>
            </div>
            <span className="grand-panel__progress">{readyCount}/4 준비</span>
          </div>
        )}

        {isExchange && (
          <div className="exchange">
            <div className="exchange__head">
              <b>카드 3장 건네기</b>
              <span className="hint">
                {submitted ? '교환 완료! 다른 고양이를 기다리는 중' : '카드를 누르면 순서대로 담깁니다'}
              </span>
              <span className="exchange__progress">{view.exchangeCount}/4</span>
            </div>
            <div className="exchange__slots">
              {SLOTS.map((slot) => {
                const card = cardOf(shownPicks[slot]);
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`slot ${card ? 'is-filled' : ''}`}
                    onClick={() => {
                      if (submitted) return;
                      setPicks((prev) => ({ ...prev, [slot]: null }));
                    }}
                    disabled={submitted}
                  >
                    <span className="slot__to">{SLOT_LABEL[slot]}</span>
                    {card ? (
                      <Card card={card} size="sm" />
                    ) : (
                      <span className="slot__empty">
                        <Paw size={18} />
                      </span>
                    )}
                    <span className="slot__name">{players[slot === 'left' ? left : slot === 'right' ? right : partner].name}</span>
                  </button>
                );
              })}
              {!submitted && (
                <button
                  type="button"
                  className="btn btn--primary exchange__submit"
                  disabled={!exchangeReady}
                  onClick={submitExchange}
                >
                  건네기
                </button>
              )}
            </div>
          </div>
        )}

        {isPlaying && (
          <div className="actionbar">
            <div className={`actionbar__hint ${selInfo.ok ? 'is-ok' : ''}`}>
              {selected.length === 0
                ? canAct
                  ? '카드를 선택하세요'
                  : view.mustFulfill
                    ? '소원 카드가 포함된 조합을 내야 합니다'
                    : '상대의 플레이를 기다리는 중'
                : selInfo.ok
                  ? `${selInfo.label} · 낼 수 있어요`
                  : selInfo.reason}
            </div>
            <div className="actionbar__buttons">
              {view.canCallTichu && (
                <button type="button" className="btn btn--tichu" onClick={() => setTichuOpen(true)}>
                  티츄!
                </button>
              )}
              {view.isMyTurn && (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!view.table || view.mustFulfill}
                    onClick={() => onAction({ type: 'pass' })}
                  >
                    패스
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!selInfo.ok}
                    onClick={() => play()}
                  >
                    내기
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {(view.phase === 'roundEnd' || view.phase === 'gameOver') && (
          <div className="actionbar">
            <div className="actionbar__hint is-ok">
              {view.phase === 'gameOver' ? '게임이 끝났습니다' : '라운드가 끝났습니다'}
            </div>
            <div className="actionbar__buttons">
              <button type="button" className="btn btn--primary" onClick={() => setResultOpen(true)}>
                결과 보기
              </button>
            </div>
          </div>
        )}

        <div className={`hand-wrap ${handClickable ? 'is-live' : ''}`}>
          <div className="hand" key={handKey}>
            {view.hand.map((card) => {
              const picked = isExchange
                ? SLOTS.some((slot) => shownPicks[slot] === card.id)
                : selected.includes(card.id);
              return (
                <Card
                  key={card.id}
                  card={card}
                  size="lg"
                  selected={picked}
                  onClick={handClickable ? () => toggleCard(card.id) : undefined}
                  className={isExchange && submitted ? 'is-dim' : ''}
                />
              );
            })}
          </div>
        </div>
      </section>

      <Modal
        open={wishOpen}
        onClose={() => setWishOpen(false)}
        title="마작 소원"
        subtitle="2부터 A까지 원하는 숫자를 소원할 수 있습니다."
      >
        <div className="rank-grid">
          {RANKS.map((rank) => (
            <button key={rank} type="button" className="rank-btn" onClick={() => play(rank)}>
              {RANK_LABEL[rank]}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => play(null)}>
          소원 없이 내기
        </button>
      </Modal>

      <Modal
        open={tichuOpen}
        onClose={() => setTichuOpen(false)}
        title="티츄를 선언할까요?"
        subtitle="이번 라운드에서 가장 먼저 아웃되면 +100, 아니면 -100점입니다."
      >
        <div className="modal__buttons">
          <button type="button" className="btn btn--ghost" onClick={() => setTichuOpen(false)}>
            취소
          </button>
          <button
            type="button"
            className="btn btn--tichu"
            onClick={() => {
              onAction({ type: 'callTichu' });
              setTichuOpen(false);
            }}
          >
            티츄 선언
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(view.pendingGift)}
        dismissable={false}
        title="용의 스틱"
        subtitle="용으로 이긴 스틱은 상대 한 명에게 넘겨야 합니다."
      >
        {view.pendingGift?.by === me ? (
          <div className="gift-options">
            {[left, right].map((seat) => (
              <button
                key={seat}
                type="button"
                className="gift-card"
                onClick={() => onAction({ type: 'giftDragon', targetSeat: seat })}
              >
                <CatAvatar catId={players[seat].catId} size={64} />
                <span>{players[seat].name}</span>
                <span className="hint">{seat % 2 === 0 ? 'A팀' : 'B팀'}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="waiting-block">
            <span className="spinner" />
            <p>{players[view.pendingGift?.by]?.name}님이 스틱을 넘길 상대를 고르는 중…</p>
          </div>
        )}
      </Modal>

      <Modal
        open={resultOpen && Boolean(rr) && (view.phase === 'roundEnd' || view.phase === 'gameOver')}
        onClose={() => setResultOpen(false)}
        title={view.phase === 'gameOver' ? '게임 종료' : `라운드 ${rr?.round ?? ''} 결과`}
        className="modal--result"
      >
        {rr && (
          <>
            {view.phase === 'gameOver' ? (
              <div className={`winner-banner winner-banner--${view.winner}`}>
                <div className="winner-banner__cats">
                  {[0, 2].map((offset) => {
                    const seat = (view.winner + offset) % 4;
                    return <CatAvatar key={seat} catId={players[seat].catId} size={62} />;
                  })}
                </div>
                <b>{view.winner === 0 ? 'A팀' : 'B팀'} 승리!</b>
                <span>
                  {rr.after[0]} : {rr.after[1]}
                </span>
              </div>
            ) : rr.doubleVictory ? (
              <div className="result__banner">더블 승리! {rr.winnerTeam === 0 ? 'A팀' : 'B팀'} +200</div>
            ) : null}

            <div className="result__grid">
              <div className={`result__col ${rr.deltas[0] >= 0 ? 'is-plus' : 'is-minus'}`}>
                <span className="result__team">A팀</span>
                <span className="result__delta">
                  {rr.deltas[0] > 0 ? '+' : ''}
                  {rr.deltas[0]}
                </span>
                <span className="result__detail">
                  {rr.doubleVictory && rr.winnerTeam === 0
                    ? '더블 승리 200'
                    : `카드 ${rr.cardPointsByTeam[0]}점`}
                  {tichuTotals[0] !== 0 && ` · 티츄 ${tichuTotals[0] > 0 ? '+' : ''}${tichuTotals[0]}`}
                </span>
              </div>
              <div className={`result__col ${rr.deltas[1] >= 0 ? 'is-plus' : 'is-minus'}`}>
                <span className="result__team">B팀</span>
                <span className="result__delta">
                  {rr.deltas[1] > 0 ? '+' : ''}
                  {rr.deltas[1]}
                </span>
                <span className="result__detail">
                  {rr.doubleVictory && rr.winnerTeam === 1
                    ? '더블 승리 200'
                    : `카드 ${rr.cardPointsByTeam[1]}점`}
                  {tichuTotals[1] !== 0 && ` · 티츄 ${tichuTotals[1] > 0 ? '+' : ''}${tichuTotals[1]}`}
                </span>
              </div>
            </div>

            <div className="result__order">
              {rr.finishOrder.map((seat, index) => (
                <div key={seat} className={`result__place ${index < 2 ? 'is-top' : ''}`}>
                  <span className="result__rank">{index + 1}등</span>
                  <CatAvatar catId={players[seat].catId} size={34} />
                  <span className="result__name">{players[seat].name}</span>
                  <TeamChip team={seat % 2} />
                </div>
              ))}
            </div>

            {rr.tichuDetails.length > 0 && (
              <ul className="result__tichu">
                {rr.tichuDetails.map((entry) => (
                  <li key={entry.seat}>
                    <b>{players[entry.seat].name}</b>
                    <span>{entry.call === 'grand' ? '그랜드 티츄' : '티츄'}</span>
                    <span className={entry.success ? 'is-win' : 'is-lose'}>
                      {entry.success ? '성공' : '실패'} {entry.delta > 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="result__total">
              <span>
                총점 <b className={myTeam === 0 ? 'is-mine' : ''}>A {rr.after[0]}</b>
              </span>
              <span>
                <b className={myTeam === 1 ? 'is-mine' : ''}>B {rr.after[1]}</b>
              </span>
            </div>

            <div className="modal__buttons">
              {view.phase === 'gameOver' ? (
                view.isHost ? (
                  <button type="button" className="btn btn--primary btn--block" onClick={() => onAction({ type: 'newGame' })}>
                    새 게임 시작
                  </button>
                ) : (
                  <p className="hint hint--center">방장이 새 게임을 시작하길 기다리는 중…</p>
                )
              ) : view.isHost ? (
                <button type="button" className="btn btn--primary btn--block" onClick={() => onAction({ type: 'nextRound' })}>
                  다음 라운드
                </button>
              ) : (
                <p className="hint hint--center">방장이 다음 라운드를 시작하길 기다리는 중…</p>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="게임 기록" className="modal--log">
        <ul className="log">
          {[...view.log].reverse().map((entry) => (
            <li key={entry.id} className={`log__item log__item--${entry.kind}`}>
              {entry.seat != null && <CatAvatar catId={players[entry.seat]?.catId} size={22} />}
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
