// Conquistas (PRD 12 RF-030) — registro data-driven + tracking

export const ACHIEVEMENTS = [
  { id: 'open_inventory', name: 'Abrindo a Mente', desc: 'Abra seu inventário', icon: '🎒', cat: 'core' },
  { id: 'get_wood', name: 'Conseguindo Madeira', desc: 'Destrua uma árvore e colete madeira', icon: '🪵', cat: 'core' },
  { id: 'crafting_table', name: 'Bancada de Trabalho', desc: 'Crie uma bancada de trabalho', icon: '🛠️', cat: 'core' },
  { id: 'wooden_pickaxe', name: 'Hora de Minerar!', desc: 'Faça uma picareta de madeira', icon: '⛏️', cat: 'core' },
  { id: 'stone_pickaxe', name: 'Tecnologia de Ponta', desc: 'Faça uma picareta de pedra', icon: '🔨', cat: 'core' },
  { id: 'furnace', name: 'Fogão a Lenha', desc: 'Faça uma fornalha', icon: '🔥', cat: 'core' },
  { id: 'iron_ingot', name: 'Não é Ferro Velho', desc: 'Obtenha um bloco de ferro', icon: '⛓️', cat: 'core' },
  { id: 'iron_sword', name: 'A Espada da Verdade', desc: 'Forje uma espada de ferro', icon: '⚔️', cat: 'core' },
  { id: 'bread', name: 'Pão Nosso', desc: 'Faça pão', icon: '🍞', cat: 'core' },
  { id: 'kill_monster', name: 'Caçador de Monstros', desc: 'Mate um monstro hostil', icon: '💀', cat: 'combat' },
  { id: 'diamonds', name: 'Um Mero Início', desc: 'Obtenha diamantes', icon: '💎', cat: 'core' },
  { id: 'survive_night', name: 'Sobrevivente da Noite', desc: 'Sobreviva à primeira noite', icon: '🌙', cat: 'survival' },
  { id: 'redstone_engineer', name: 'Engenheiro de Redstone', desc: 'Coloque 10 blocos de redstone', icon: '🔴', cat: 'tech' },
  { id: 'farmer', name: 'Agricultor', desc: 'Plante e colha uma plantação', icon: '🌾', cat: 'survival' },
  // Mind Cave
  { id: 'gunsmith_bench', name: 'Engenheiro de Guerra', desc: 'Crie uma Bancada de Armeiro', icon: '🏭', cat: 'mindcave' },
  { id: 'first_shot', name: 'Primeiro Disparo', desc: 'Dispare uma arma de fogo', icon: '🔫', cat: 'mindcave' },
  { id: 'headshot', name: 'Tiro na Cabeça', desc: 'Acerte um tiro na cabeça', icon: '🎯', cat: 'mindcave' },
  { id: 'elite_hunter', name: 'Caçador de Elite', desc: 'Mate um Atirador de Elite', icon: '🎖️', cat: 'mindcave' },
  { id: 'studio_open', name: 'Estúdio Aberto', desc: 'Vincule seu primeiro asset no Studio', icon: '🎨', cat: 'mindcave' },
  { id: 'creator', name: 'Criador', desc: 'Publique um item customizado', icon: '✨', cat: 'mindcave' },
  { id: 'lab_complete', name: 'Laboratório Completo', desc: 'Visite todas as áreas do Laboratório', icon: '🧪', cat: 'mindcave' },
];

export const ACHIEVEMENT_MAP = {};
for (const a of ACHIEVEMENTS) ACHIEVEMENT_MAP[a.id] = a;

export function createAchievementState() {
  return { unlocked: [], pendingToast: null };
}

export function serializeAchievements(state) {
  return JSON.stringify(state.unlocked || []);
}

export function deserializeAchievements(str) {
  try { const arr = JSON.parse(str); return { unlocked: Array.isArray(arr) ? arr : [], pendingToast: null }; }
  catch { return createAchievementState(); }
}

// Tenta desbloquear uma conquista; retorna true se foi desbloqueada agora
export function tryUnlock(state, id) {
  if (!ACHIEVEMENT_MAP[id]) return false;
  if (state.unlocked.includes(id)) return false;
  state.unlocked.push(id);
  state.pendingToast = ACHIEVEMENT_MAP[id];
  return true;
}

// Verifica conquistas baseadas em stats
export function checkStatAchievements(state, stats) {
  if (stats.blocksMined >= 1 && stats.woodMined >= 1) tryUnlock(state, 'get_wood');
  if (stats.crafts >= 1) tryUnlock(state, 'crafting_table');
  if (stats.ironCollected >= 1) tryUnlock(state, 'iron_ingot');
  if (stats.diamondsCollected >= 1) tryUnlock(state, 'diamonds');
  if (stats.mobsKilled >= 1) tryUnlock(state, 'kill_monster');
  if (stats.shotsFired >= 1) tryUnlock(state, 'first_shot');
  if (stats.headshots >= 1) tryUnlock(state, 'headshot');
  if (stats.redstonePlaced >= 10) tryUnlock(state, 'redstone_engineer');
  if (stats.cropsHarvested >= 1) tryUnlock(state, 'farmer');
  if (stats.survivedNight) tryUnlock(state, 'survive_night');
  if (stats.eliteKilled >= 1) tryUnlock(state, 'elite_hunter');
  if (stats.gunsmithBenchCrafted) tryUnlock(state, 'gunsmith_bench');
}

export function getAchievementProgress(state) {
  return { unlocked: state.unlocked.length, total: ACHIEVEMENTS.length };
}