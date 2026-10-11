// Processador de comandos — PRD 05 RF-001/010/013 + comandos de PRDs anteriores
import { Effect, EFFECT_BY_NAME, addEffect, removeEffect, clearEffects } from './effects';
import { BLOCK_NAMES, BLOCKS, packState } from './blocks';
import { FOODS, FOOD_NAMES, addXP, xpForNextLevel, applyDamage } from './survival';
import { MOB_TYPES } from './mobRegistry';
import { executeScoreboardCommand } from './scoreboard';

export function processCommand(engine, text) {
  if (!text.startsWith('/')) return;
  const parts = text.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const p = engine.player;

  const setGameMode = (mode) => {
    p.gameMode = mode;
    if (mode === 'creative') { p.flying = false; p.health = 20; p.hunger = 20; }
    if (mode === 'spectator') { p.flying = true; }
    engine.emitHud();
  };

  switch (cmd) {
    case 'gamemode': {
      const mode = parts[1]?.toLowerCase();
      if (mode === 'creative' || mode === 'survival' || mode === 'adventure' || mode === 'spectator' || mode === '0' || mode === '1' || mode === '2' || mode === '3') {
        const map = { '0': 'survival', '1': 'creative', '2': 'adventure', '3': 'spectator' };
        setGameMode(map[mode] || mode);
      }
      break;
    }
    case 'defaultgamemode': {
      const mode = parts[1]?.toLowerCase();
      if (mode === 'creative' || mode === 'survival' || mode === 'adventure' || mode === 'spectator') {
        if (engine.world) engine.world.defaultGameMode = mode;
      }
      break;
    }
    case 'difficulty': {
      const d = parts[1]?.toLowerCase();
      if (d === 'peaceful' || d === 'easy' || d === 'normal' || d === 'hard' || d === '0' || d === '1' || d === '2' || d === '3') {
        const map = { '0': 'peaceful', '1': 'easy', '2': 'normal', '3': 'hard' };
        engine.difficulty = map[d] || d;
        if (engine.gameRules) engine.gameRules._difficulty = engine.difficulty;
      }
      break;
    }
    case 'time': {
      if (parts[1] === 'set') {
        if (parts[2] === 'day') engine.worldTime = 1000;
        else if (parts[2] === 'night') engine.worldTime = 13000;
        else engine.worldTime = parseInt(parts[2]) || 0;
      } else if (parts[1] === 'add') {
        engine.worldTime += parseInt(parts[2]) || 0;
      } else if (parts[1] === 'query') {
        // query — no-op visual (F3 já mostra)
      }
      break;
    }
    case 'weather': {
      if (engine.weather) {
        const w = parts[1]?.toLowerCase();
        const duration = parts[2] ? parseInt(parts[2]) * 20 : undefined;
        if (w === 'clear') { engine.weather.raining = false; engine.weather.thundering = false; }
        else if (w === 'rain') { engine.weather.raining = true; engine.weather.rainTime = duration || 6000; }
        else if (w === 'thunder') { engine.weather.raining = true; engine.weather.thundering = true; engine.weather.rainTime = duration || 6000; engine.weather.thunderTime = duration || 6000; }
      }
      break;
    }
    case 'toggledownfall': {
      if (engine.weather) { engine.weather.raining = !engine.weather.raining; }
      break;
    }
    case 'effect': {
      const target = parts[1]; // @p — self only for now
      const effName = parts[2]?.toLowerCase();
      if (effName === 'clear') { clearEffects(p); break; }
      const effId = EFFECT_BY_NAME[effName];
      if (effId === undefined) break;
      const seconds = parseInt(parts[3]) || 30;
      const amplifier = (parseInt(parts[4]) || 0) - 1;
      const hideParticles = parts[5] === 'true';
      addEffect(p, effId, seconds * 20, amplifier, false, !hideParticles);
      break;
    }
    case 'kill': {
      const target = parts[1];
      if (target === '@e' || target === '@e[type=!Player]') {
        if (engine.mobs) engine.mobs.killAll();
      } else if (target?.startsWith('@e[type=')) {
        const match = target.match(/@e\[type=([^\]]+)\]/);
        if (match) { if (engine.mobs) engine.mobs.killAll(match[1].toLowerCase()); }
      } else {
        applyDamage(p, 1e6, 'kill', { bypass: true });
      }
      break;
    }
    case 'summon': {
      const typeId = (parts[1] || '').toLowerCase();
      if (!MOB_TYPES[typeId]) break;
      const x = parts[2] ? engine.parseCoord(parts[2], p.pos.x) : p.pos.x;
      const y = parts[3] ? engine.parseCoord(parts[3], p.pos.y) : p.pos.y;
      const z = parts[4] ? engine.parseCoord(parts[4], p.pos.z) : p.pos.z;
      if (engine.mobs) engine.mobs.summon(typeId, { x, y, z });
      break;
    }
    case 'xp':
    case 'experience':
    case 'xplev': {
      const amount = parseInt(parts[1]) || 0;
      const isLevels = parts[1]?.endsWith('L') || parts[1]?.endsWith('l');
      if (isLevels) {
        p.xpLevel += amount;
      } else {
        addXP(p, amount);
      }
      break;
    }
    case 'spawnpoint': {
      const x = parts[2] ? engine.parseCoord(parts[2], p.pos.x) : p.pos.x;
      const y = parts[3] ? engine.parseCoord(parts[3], p.pos.y) : p.pos.y;
      const z = parts[4] ? engine.parseCoord(parts[4], p.pos.z) : p.pos.z;
      p.spawnX = Math.floor(x);
      p.spawnY = Math.floor(y);
      p.spawnZ = Math.floor(z);
      p.hasBedSpawn = true;
      break;
    }
    case 'setworldspawn': {
      if (engine.world) {
        engine.world.spawnX = parts[1] ? parseInt(parts[1]) : Math.floor(p.pos.x);
        engine.world.spawnY = parts[2] ? parseInt(parts[2]) : Math.floor(p.pos.y);
        engine.world.spawnZ = parts[3] ? parseInt(parts[3]) : Math.floor(p.pos.z);
      }
      break;
    }
    case 'gamerule': {
      const rule = parts[1];
      if (!rule) break;
      let val = parts[2];
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(parseInt(val))) val = parseInt(val);
      engine.gameRules[rule] = val;
      break;
    }
    case 'give': {
      const name = (parts[1] || '').toLowerCase();
      const blockId = BLOCK_NAMES[name];
      const foodId = FOOD_NAMES[name];
      const id = blockId || foodId || parseInt(name);
      if (id) p.hotbar[p.selectedSlot] = { id, meta: 0 };
      break;
    }
    case 'setblock': {
      const x = engine.parseCoord(parts[1], p.pos.x);
      const y = engine.parseCoord(parts[2], p.pos.y);
      const z = engine.parseCoord(parts[3], p.pos.z);
      const name = (parts[4] || '').toLowerCase();
      const id = BLOCK_NAMES[name] || parseInt(name);
      if (id) engine.world.setBlock(Math.floor(x), Math.floor(y), Math.floor(z), packState(id, 0));
      break;
    }
    case 'heal': {
      p.health = Math.min(p.maxHealth, p.health + (parseInt(parts[1]) || 20));
      break;
    }
    case 'feed': {
      p.hunger = 20;
      p.saturation = 5;
      p.exhaustion = 0;
      break;
    }
    case 'clear': {
      for (let i = 0; i < 9; i++) p.hotbar[i] = { id: 0, meta: 0 };
      break;
    }
    case 'scoreboard': {
      executeScoreboardCommand(engine, text, engine.netManager);
      break;
    }
    default:
      break;
  }
  engine.emitHud();
}