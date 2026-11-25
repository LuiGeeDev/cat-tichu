export const CATS = [
  { id: 1, name: '삼색이', color: '#C58F6E' },
  { id: 2, name: '치즈', color: '#E7B45C' },
  { id: 3, name: '회색이', color: '#9E9E9E' },
  { id: 4, name: '까망이', color: '#6F6F6F' },
  { id: 5, name: '고등어', color: '#A9805F' },
  { id: 6, name: '흰둥이', color: '#8FBFD6' },
  { id: 7, name: '하양이', color: '#C9C9C9' },
];

export const catById = (id) => CATS.find((c) => c.id === Number(id)) ?? CATS[0];

export const TEAM_LABEL = ['A팀', 'B팀'];
export const TEAM_ICON = ['🍊', '🫐'];
