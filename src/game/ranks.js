// Cargos exibidos na lista do TAB. O dono do mundo (host) é sempre DONO; os demais vêm de profiles.rank no Supabase
// (coluna criada por supabase/migrations/20261011_mindcave_completo.sql); sem ela, todos são JOGADOR.
export const RANKS = {
  owner:  { tag: 'DONO',    color: '#FFAA00', order: 0 },
  admin:  { tag: 'ADMIN',   color: '#FF5555', order: 1 },
  mod:    { tag: 'MOD',     color: '#FF55FF', order: 2 },
  vip:    { tag: 'VIP',     color: '#55FFFF', order: 3 },
  player: { tag: 'JOGADOR', color: '#AAAAAA', order: 4 },
};

export function getRank(id) { return RANKS[id] || RANKS.player; }
