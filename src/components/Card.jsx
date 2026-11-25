import { KIND, RANK_LABEL, cardPoints } from '../../shared/tichu/cards.js';
import { SuitGlyph, Paw } from './ui.jsx';

const SPECIAL = {
  [KIND.MAHJONG]: { emoji: '🐦', name: '참새' },
  [KIND.DOG]: { emoji: '🐕', name: '개' },
  [KIND.PHOENIX]: { emoji: '🔥', name: '봉황' },
  [KIND.DRAGON]: { emoji: '🐉', name: '용' },
};

export function Card({
  card,
  size = 'md',
  selected = false,
  dim = false,
  onClick,
  back = false,
  className = '',
  style,
}) {
  if (back) {
    return (
      <div className={`card card--back card--${size} ${className}`} style={style} aria-hidden="true">
        <Paw />
      </div>
    );
  }
  if (!card) return null;

  const special = card.kind !== KIND.NORMAL;
  const points = cardPoints(card);
  const rank = special ? '' : RANK_LABEL[card.rank];
  const suit = card.suit ?? card.kind;
  const label = special ? SPECIAL[card.kind].name : `${RANK_LABEL[card.rank]} ${card.suit}`;

  return (
    <div
      className={`card card--${size} card--${suit} ${special ? 'is-special' : ''} ${
        selected ? 'is-selected' : ''
      } ${dim ? 'is-dim' : ''} ${onClick ? 'is-clickable' : ''} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={label}
      aria-pressed={onClick ? selected : undefined}
    >
      {special ? (
        <>
          <span className="card__emoji" aria-hidden="true">
            {SPECIAL[card.kind].emoji}
          </span>
          <span className="card__special-name">{SPECIAL[card.kind].name}</span>
          {card.kind === KIND.MAHJONG && <span className="card__mj-rank">1</span>}
        </>
      ) : (
        <>
          <span className="card__corner card__corner--tl">
            <span className={card.rank === 10 ? 'is-ten' : ''}>{rank}</span>
            <SuitGlyph suit={card.suit} />
          </span>
          <span className="card__pip">
            <SuitGlyph suit={card.suit} />
          </span>
          <span className="card__corner card__corner--br">
            <span className={card.rank === 10 ? 'is-ten' : ''}>{rank}</span>
            <SuitGlyph suit={card.suit} />
          </span>
        </>
      )}
      {points !== 0 && (
        <span className={`card__points ${points < 0 ? 'is-negative' : ''}`}>
          {points > 0 ? `+${points}` : points}
        </span>
      )}
    </div>
  );
}
