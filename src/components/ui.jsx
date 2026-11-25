import { catById } from '../cats.js';

export function Paw({ className = '', size }) {
  return (
    <svg
      className={`paw ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="15.4" rx="5.6" ry="4.7" />
      <ellipse cx="5.6" cy="9.6" rx="2.2" ry="2.9" transform="rotate(-18 5.6 9.6)" />
      <ellipse cx="10.2" cy="6.4" rx="2.2" ry="3" />
      <ellipse cx="15.6" cy="6.4" rx="2.2" ry="3" />
      <ellipse cx="19.4" cy="9.6" rx="2.2" ry="2.9" transform="rotate(18 19.4 9.6)" />
    </svg>
  );
}

export function SuitGlyph({ suit, className = '' }) {
  const common = { className: `suit-glyph ${className}`, viewBox: '0 0 24 24', 'aria-hidden': 'true' };
  switch (suit) {
    case 'jade':
      return (
        <svg {...common}>
          <path d="M12 2.4 20 9.2 12 21.6 4 9.2Z" fill="currentColor" />
          <path d="M4 9.2h16M12 2.4 8.6 9.2l3.4 12.4 3.4-12.4Z" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.1" />
        </svg>
      );
    case 'sword':
      return (
        <svg {...common}>
          <path d="M12 1.8 14.4 13.4 12 16.4 9.6 13.4Z" fill="currentColor" />
          <rect x="7.4" y="15.6" width="9.2" height="2.2" rx="1.1" fill="currentColor" />
          <rect x="10.9" y="17.4" width="2.2" height="5" rx="1.1" fill="currentColor" />
        </svg>
      );
    case 'pagoda':
      return (
        <svg {...common}>
          <path d="M12 1.8 18.4 8H5.6Z" fill="currentColor" />
          <path d="M8.2 9.4h7.6l-1 4.2H9.2Z" fill="currentColor" />
          <path d="M6.4 15h11.2l-1.3 5.4H7.7Z" fill="currentColor" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 2.2 14.9 8.4l6.6.8-4.9 4.5 1.3 6.5L12 17.1 6.1 20.2l1.3-6.5L2.5 9.2l6.6-.8Z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export function CatAvatar({ catId, size = 56, className = '', dim = false }) {
  const cat = catById(catId);
  return (
    <span
      className={`cat-avatar ${dim ? 'is-dim' : ''} ${className}`}
      style={{ '--cat-size': `${size}px`, '--cat-color': cat.color }}
      title={cat.name}
    >
      <img src={`/cats/cat-${cat.id}.png`} alt={cat.name} draggable="false" />
    </span>
  );
}

export function TeamChip({ team }) {
  return (
    <span className={`team-chip team-chip--${team}`}>
      <span className="team-chip__dot" />
      {team === 0 ? 'A팀' : 'B팀'}
    </span>
  );
}
