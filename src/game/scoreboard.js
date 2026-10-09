// Gerenciamento de Scoreboard (PRD 25 MC25-RF-040..043)
export function createScoreboard() {
  return {
    objective: null,
    displayName: '',
    display: null, // 'sidebar' | null
    lines: [], // Array de { name, score }
  };
}

export function executeScoreboardCommand(engine, text, netManager = null) {
  if (!text || typeof text !== 'string') return;
  const parts = text.trim().split(/\s+/);
  if (parts[0].toLowerCase() !== '/scoreboard') return;

  const world = engine.world;
  if (!world) return;
  if (!world.scoreboard) {
    world.scoreboard = createScoreboard();
  }
  const sb = world.scoreboard;

  const sub = parts[1]?.toLowerCase();
  if (sub === 'objectives') {
    const action = parts[2]?.toLowerCase();
    if (action === 'add') {
      const name = parts[3];
      const criteria = parts[4]?.toLowerCase();
      const displayName = parts.slice(5).join(' ') || name;
      if (name && criteria === 'dummy') {
        sb.objective = name;
        sb.displayName = displayName;
        engine.emitHud();
        syncScoreboard(netManager, sb);
      }
    } else if (action === 'setdisplay') {
      const slot = parts[3]?.toLowerCase();
      const name = parts[4];
      if (slot === 'sidebar') {
        if (!name || name === sb.objective) {
          sb.display = 'sidebar';
        } else {
          sb.display = null;
        }
        engine.emitHud();
        syncScoreboard(netManager, sb);
      }
    } else if (action === 'remove') {
      const name = parts[3];
      if (name === sb.objective || !name) {
        sb.objective = null;
        sb.display = null;
        sb.lines = [];
        engine.emitHud();
        syncScoreboard(netManager, sb);
      }
    }
  } else if (sub === 'players') {
    const action = parts[2]?.toLowerCase();
    if (action === 'set') {
      const player = parts[3];
      const objName = parts[4];
      const score = parseInt(parts[5]) || 0;
      if (player && objName === sb.objective) {
        const idx = sb.lines.findIndex(l => l.name === player);
        if (idx >= 0) {
          sb.lines[idx].score = score;
        } else {
          sb.lines.push({ name: player, score });
        }
        // Ordena por score desc
        sb.lines.sort((a, b) => b.score - a.score);
        if (sb.lines.length > 15) sb.lines = sb.lines.slice(0, 15);
        engine.emitHud();
        syncScoreboard(netManager, sb);
      }
    } else if (action === 'reset') {
      const player = parts[3];
      if (player) {
        sb.lines = sb.lines.filter(l => l.name !== player);
        engine.emitHud();
        syncScoreboard(netManager, sb);
      }
    }
  }
}

function syncScoreboard(netManager, scoreboard) {
  if (netManager && typeof netManager.broadcast === 'function') {
    netManager.broadcast({ t: 'scoreboard', scoreboard });
  }
}
