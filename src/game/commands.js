// Processador de comandos — PRD 05 RF-001/010/013 + lote oficial 1.8.9
import { Effect, EFFECT_BY_NAME, addEffect, removeEffect, clearEffects } from './effects';
import { BLOCK_NAMES, BLOCKS, packState } from './blocks';
import { FOODS, FOOD_NAMES, addXP, xpForNextLevel, applyDamage } from './survival';
import { MOB_TYPES } from './mobRegistry';
import { executeScoreboardCommand } from './scoreboard';
import { ITEM_NAMES } from './items';
import { addItem, stack } from './inventory';
import { playEvent } from './sounds';
import { ACHIEVEMENTS } from './achievements';
import { stateId } from './chunk';
import { fillRegion, cloneRegion, regionVolume, MAX_REGION } from './net/regionOps';

// Quando o host executa um comando de CONVIDADO (netManager), a resposta volta para o convidado, não para o chat do host
const say = (engine, text) => (engine._cmdReply
  ? engine._cmdReply(text)
  : engine.onChatMessage?.({ type: 'system', text, timestamp: Date.now() }));

// Quem executa onde (multiplayer): comandos que mudam o MUNDO rodam no host; os que mudam o JOGADOR rodam no próprio convidado
export const WORLD_COMMANDS = new Set(['fill', 'clone', 'setblock', 'time', 'weather', 'toggledownfall', 'summon', 'gamerule', 'difficulty', 'setworldspawn', 'seed']);
export const PLAYER_COMMANDS = new Set(['give', 'clear', 'tp', 'teleport', 'gamemode', 'effect', 'xp', 'experience', 'xplev', 'enchant', 'heal', 'feed', 'kill', 'spawnpoint', 'achievement', 'title', 'playsound', 'particle', 'spreadplayers', 'help', '?']);

// Encantamentos 1.8.9 (sem underscores; combat.js lê sharpness/knockback)
const ENCHANT_NAMES = [
  'sharpness', 'smite', 'baneofarthropods', 'knockback', 'fireaspect', 'looting', 'sweepingedge',
  'efficiency', 'silk touch', 'silktouch', 'fortune', 'unbreaking',
  'power', 'punch', 'flame', 'infinity',
  'protection', 'fireprotection', 'blastprotection', 'projectileprotection',
  'featherfalling', 'respiration', 'aquaaffinity', 'thorns', 'depthstrider',
];

const COMMAND_LIST = [
  '/gamemode <survival|creative|adventure|spectator> [jogador]',
  '/difficulty <peaceful|easy|normal|hard>',
  '/time set <day|night|noon|midnight|ticks> | add <n> | query [daytime|gametime]',
  '/weather <clear|rain|thunder> [segundos]',
  '/gamerule <regra> [valor]  (sem valor = mostra)',
  '/tp <x> <y> <z> | /tp <jogador>',
  '/kill [@e|@e[type=x]|@p]',
  '/summon <mob> [x y z]',
  '/give <jogador|item> <item> [qtd] [data]',
  '/clear [item]',
  '/setblock <x> <y> <z> <bloco> [data] [replace|keep|destroy]',
  '/fill <x1> <y1> <z1> <x2> <y2> <z2> <bloco> [data] [modo]  (máx 32768)',
  '/clone <x1> <y1> <z1> <x2> <y2> <z2> <x> <y> <z>  (máx 32768)',
  '/effect <@p> <efeito> [segundos] [amplificador] | clear',
  '/enchant <encantamento> [nível]  (no item em mãos)',
  '/xp <n> | /xp <n>L',
  '/achievement get|award <id>',
  '/spreadplayers <x> <z> <dist> <max>',
  '/playsound <evento> [x y z] [volume] [pitch]',
  '/particle <nome> <x> <y> <z> [qtd]',
  '/title <@p> title|subtitle|clear|reset <texto>',
  '/say <mensagem>',
  '/me <ação>',
  '/tell <jogador> <mensagem>  (aliases: /msg /w)',
  '/list',
  '/seed',
  '/help',
  '/spawnpoint [x y z]',
  '/setworldspawn [x y z]',
  '/scoreboard ...',
];

function resolveItemId(name) {
  const n = String(name || '').toLowerCase();
  if (BLOCK_NAMES[n] !== undefined) return BLOCK_NAMES[n];
  if (FOOD_NAMES[n] !== undefined) return FOOD_NAMES[n];
  if (ITEM_NAMES[n] !== undefined) return ITEM_NAMES[n];
  const num = parseInt(n);
  return Number.isFinite(num) && num > 0 ? num : null;
}

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
    case 'tp':
    case 'teleport': {
      let targetX, targetY, targetZ;
      const findTarget = (name) => {
        if (!name) return null;
        const lower = name.toLowerCase();
        if (lower === '@p' || lower === '@s') return p.pos;
        if (engine.netManager?.remotePlayers) {
          for (const [id, rp] of engine.netManager.remotePlayers) {
            if ((rp.name && rp.name.toLowerCase() === lower) || id.toLowerCase() === lower) {
              return { x: rp.x ?? rp.targetX, y: rp.y ?? rp.targetY, z: rp.z ?? rp.targetZ };
            }
          }
        }
        return null;
      };

      if (parts.length >= 4) {
        if (parts.length >= 5) {
          targetX = engine.parseCoord(parts[2], p.pos.x);
          targetY = engine.parseCoord(parts[3], p.pos.y);
          targetZ = engine.parseCoord(parts[4], p.pos.z);
        } else {
          targetX = engine.parseCoord(parts[1], p.pos.x);
          targetY = engine.parseCoord(parts[2], p.pos.y);
          targetZ = engine.parseCoord(parts[3], p.pos.z);
        }
      } else if (parts.length === 2 || parts.length === 3) {
        const targetName = parts.length === 3 ? parts[2] : parts[1];
        const found = findTarget(targetName);
        if (found) {
          targetX = found.x;
          targetY = found.y;
          targetZ = found.z;
        } else {
          say(engine, `§cJogador '${targetName}' não encontrado.`);
          break;
        }
      }

      if (targetX !== undefined && targetY !== undefined && targetZ !== undefined && !isNaN(targetX) && !isNaN(targetY) && !isNaN(targetZ)) {
        p.pos.x = targetX;
        p.pos.y = targetY;
        p.pos.z = targetZ;
        if (p.vel) { p.vel.x = 0; p.vel.y = 0; p.vel.z = 0; }
        p.fallDistance = 0;
        say(engine, `§7Teleportado para §e${targetX.toFixed(1)}, ${targetY.toFixed(1)}, ${targetZ.toFixed(1)}`);
      } else {
        say(engine, '§cUso: /tp <x> <y> <z> ou /tp <jogador>');
      }
      break;
    }
    case 'time': {
      const sub = parts[1]?.toLowerCase();
      if (sub === 'set') {
        const v = parts[2]?.toLowerCase();
        if (v === 'day') engine.worldTime = 1000;
        else if (v === 'night') engine.worldTime = 13000;
        else if (v === 'noon') engine.worldTime = 6000;
        else if (v === 'midnight') engine.worldTime = 18000;
        else engine.worldTime = parseInt(parts[2]) || 0;
      } else if (sub === 'add') {
        engine.worldTime += parseInt(parts[2]) || 0;
      } else if (sub === 'query') {
        const what = parts[2]?.toLowerCase();
        if (what === 'gametime') say(engine, `§7gametime: ${engine.worldTime}`);
        else if (what === 'daytime' || what === 'day') say(engine, `§7daytime: ${engine.worldTime % 24000}`);
        else say(engine, `§7${engine.worldTime % 24000}`);
      }
      if (sub === 'set' || sub === 'add') engine.netManager?.broadcast?.({ t: 'time', worldTime: engine.worldTime });
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
      if (!rule) { say(engine, '§cUso: /gamerule <regra> [valor]'); break; }
      if (parts.length < 3) {
        const cur = engine.gameRules?.[rule];
        say(engine, cur === undefined ? `§cRegra desconhecida: ${rule}` : `§7${rule} = ${cur}`);
        break;
      }
      let val = parts[2];
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(parseInt(val))) val = parseInt(val);
      engine.gameRules[rule] = val;
      break;
    }
    case 'give': {
      // Vanilla: /give <jogador> <item> [qtd] [data] — legado: /give <item> [qtd]
      let itemName, count = 1, meta = 0;
      // /give diamond 3 é item + quantidade (legado): se o 1º argumento já é um item e o 2º é só número, não é jogador + item
      const legacy = resolveItemId(parts[1]) !== null && (parts[2] === undefined || /^\d+$/.test(parts[2]));
      if (!legacy && parts[2] && resolveItemId(parts[2]) !== null) {
        itemName = parts[2];
        count = parseInt(parts[3]) || 1;
        meta = parseInt(parts[4]) || 0;
      } else {
        itemName = parts[1];
        count = parseInt(parts[2]) || 1;
        meta = parseInt(parts[3]) || 0;
      }
      const id = resolveItemId(itemName);
      if (!id) { say(engine, `§cItem inválido: ${itemName || '(vazio)'}`); break; }
      const inv = engine.inventory || { hotbar: p.hotbar, main: [], crafting: [] };
      const leftover = addItem(inv, stack(id, Math.max(1, Math.min(999, count)), meta));
      if (leftover) say(engine, '§cInventário cheio.');
      break;
    }
    case 'setblock': {
      const x = Math.floor(engine.parseCoord(parts[1], p.pos.x));
      const y = Math.floor(engine.parseCoord(parts[2], p.pos.y));
      const z = Math.floor(engine.parseCoord(parts[3], p.pos.z));
      const name = (parts[4] || '').toLowerCase();
      const id = BLOCK_NAMES[name] !== undefined ? BLOCK_NAMES[name] : parseInt(name);
      if (!id) { say(engine, `§cBloco inválido: ${name || '(vazio)'}`); break; }
      const meta = parseInt(parts[5]) || 0;
      const mode = (parts[6] || 'replace').toLowerCase();
      const cur = stateId(engine.world.getBlock(x, y, z));
      if (mode === 'keep' && cur !== 0) { say(engine, '§cEspaço não vazio (modo keep).'); break; }
      const newState = packState(id, meta);
      engine.world.setBlock(x, y, z, newState);
      engine._cachedRaycastFrame = -1;
      engine.onBlockChange?.(x, y, z, newState);
      engine.netManager?.sendBlockChange?.(x, y, z, newState);
      if (mode === 'destroy' && engine.particles && cur) engine.particles.spawnBlockBreak(x, y, z, cur);
      break;
    }
    case 'fill': {
      const x1 = Math.floor(engine.parseCoord(parts[1], p.pos.x));
      const y1 = Math.floor(engine.parseCoord(parts[2], p.pos.y));
      const z1 = Math.floor(engine.parseCoord(parts[3], p.pos.z));
      const x2 = Math.floor(engine.parseCoord(parts[4], p.pos.x));
      const y2 = Math.floor(engine.parseCoord(parts[5], p.pos.y));
      const z2 = Math.floor(engine.parseCoord(parts[6], p.pos.z));
      const name = (parts[7] || '').toLowerCase();
      const id = resolveItemId(name);
      if (!id || BLOCK_NAMES[name] === undefined && isNaN(parseInt(name))) { say(engine, `§cBloco inválido: ${name || '(vazio)'}`); break; }
      const meta = parseInt(parts[8]) || 0;
      const mode = (parts[9] || 'replace').toLowerCase();
      const volume = regionVolume(x1, y1, z1, x2, y2, z2);
      if (volume > MAX_REGION) { say(engine, '§cRegião muito grande (máx 32768 blocos, como no 1.8.9).'); break; }
      const newState = packState(id, meta);
      const region = { x1, y1, z1, x2, y2, z2, blockState: newState, mode: mode === 'keep' ? 'keep' : 'replace' };
      const placed = fillRegion(engine.world, region, (bx, by, bz, st) => engine.onBlockChange?.(bx, by, bz, st));
      engine._cachedRaycastFrame = -1;
      engine.netManager?.broadcast?.({ t: 'FILL', ...region }); // convidados repetem a região (uma mensagem, não uma por bloco)
      say(engine, `§7/fill: ${placed} blocos colocados.`);
      break;
    }
    case 'clone': {
      const c = [];
      for (let i = 1; i <= 9; i++) c.push(Math.floor(engine.parseCoord(parts[i], i % 3 === 1 ? p.pos.x : i % 3 === 2 ? p.pos.y : p.pos.z)));
      const [x1, y1, z1, x2, y2, z2, dx, dy, dz] = c;
      if (c.some(isNaN)) { say(engine, '§cUso: /clone <x1 y1 z1> <x2 y2 z2> <x y z>'); break; }
      const volume = regionVolume(x1, y1, z1, x2, y2, z2);
      if (volume > MAX_REGION) { say(engine, '§cRegião muito grande (máx 32768 blocos).'); break; }
      const region = { x1, y1, z1, x2, y2, z2, dx, dy, dz };
      const copied = cloneRegion(engine.world, region, (bx, by, bz, st) => engine.onBlockChange?.(bx, by, bz, st));
      engine._cachedRaycastFrame = -1;
      engine.netManager?.broadcast?.({ t: 'CLONE', ...region });
      say(engine, `§7/clone: ${copied} blocos copiados.`);
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
      const inv = engine.inventory;
      if (!inv) break;
      const filterName = parts[2] ? parts[2].toLowerCase() : null;
      const filterId = filterName ? resolveItemId(filterName) : null;
      let removed = 0;
      for (const arr of [inv.hotbar, inv.main, inv.crafting]) {
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] && (filterId === null || arr[i].id === filterId)) {
            removed += arr[i].count || 1;
            arr[i] = null;
          }
        }
      }
      say(engine, `§7Removidos ${removed} itens do inventário.`);
      break;
    }
    case 'enchant': {
      const held = p.hotbar[p.selectedSlot];
      if (!held || !held.id) { say(engine, '§cSegure um item na mão para encantar.'); break; }
      const encName = String(parts[1] || '').toLowerCase().replace(/_/g, '');
      const level = Math.max(1, Math.min(5, parseInt(parts[2]) || 1));
      if (!ENCHANT_NAMES.includes(encName)) { say(engine, '§cEncantamento inválido (ex: sharpness, efficiency, protection).'); break; }
      held.enchants = { ...(held.enchants || {}), [encName]: level };
      say(engine, `§7${encName} ${level} aplicado no item em mãos.`);
      break;
    }
    case 'achievement': {
      const action = parts[1]?.toLowerCase();
      const id = (parts[2] || '').toLowerCase();
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (!def) { say(engine, '§cUso: /achievement get|award <id>  (ids: ' + ACHIEVEMENTS.map((a) => a.id).join(', ') + ')'); break; }
      const unlocked = !!p.achievements?.unlocked?.includes(def.id);
      if (action === 'get') {
        say(engine, unlocked ? `§aConquista desbloqueada: ${def.name}` : `§7Conquista pendente: ${def.name} — ${def.desc}`);
      } else if (action === 'award') {
        engine.unlockAchievement(def.id);
      } else {
        say(engine, '§cUso: /achievement get|award <id>');
      }
      break;
    }
    case 'spreadplayers': {
      const cx = parseFloat(parts[1]);
      const cz = parseFloat(parts[2]);
      const maxR = parseFloat(parts[4]) || 32;
      if (isNaN(cx) || isNaN(cz)) { say(engine, '§cUso: /spreadplayers <x> <z> <dist> <max>'); break; }
      let landed = false;
      for (let tries = 0; tries < 64 && !landed; tries++) {
        const x = cx + (Math.random() * 2 - 1) * maxR;
        const z = cz + (Math.random() * 2 - 1) * maxR;
        for (let y = 120; y > 1; y--) {
          const id = stateId(engine.world.getBlock(Math.floor(x), y, Math.floor(z)));
          const above = stateId(engine.world.getBlock(Math.floor(x), y + 1, Math.floor(z)));
          if (id !== 0 && above === 0) {
            p.pos.x = x; p.pos.y = y + 1; p.pos.z = z;
            if (p.vel) { p.vel.x = 0; p.vel.y = 0; p.vel.z = 0; }
            p.fallDistance = 0;
            landed = true;
            break;
          }
        }
      }
      if (landed) say(engine, `§7Espalhado para §e${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)}`);
      else say(engine, '§cNão foi possível encontrar chão seguro.');
      break;
    }
    case 'playsound': {
      const event = (parts[1] || '').toLowerCase();
      if (!event) { say(engine, '§cUso: /playsound <evento> [x y z] [volume] [pitch]'); break; }
      const x = parts[2] !== undefined ? engine.parseCoord(parts[2], p.pos.x) : p.pos.x;
      const y = parts[3] !== undefined ? engine.parseCoord(parts[3], p.pos.y) : p.pos.y;
      const z = parts[4] !== undefined ? engine.parseCoord(parts[4], p.pos.z) : p.pos.z;
      const volume = parseFloat(parts[5]) || 1;
      const pitch = parseFloat(parts[6]) || 1;
      playEvent(event, { pos: { x, y, z }, volume, pitch });
      break;
    }
    case 'particle': {
      const name = (parts[1] || '').toLowerCase();
      const x = engine.parseCoord(parts[2], p.pos.x);
      const y = engine.parseCoord(parts[3], p.pos.y);
      const z = engine.parseCoord(parts[4], p.pos.z);
      if (!name || isNaN(x) || isNaN(y) || isNaN(z)) { say(engine, '§cUso: /particle <nome> <x> <y> <z> [qtd]'); break; }
      const count = Math.min(50, parseInt(parts[7]) || parseInt(parts[5]) || 10);
      if (engine.particles?.spawnNamed) engine.particles.spawnNamed(name, x, y, z, count);
      break;
    }
    case 'title': {
      const target = String(parts[1] || '').toLowerCase();
      if (target !== '@s' && target !== '@p' && target !== '@a' && target !== (p.nomeJogador || '').toLowerCase()) {
        say(engine, '§cUso: /title <@p> title|subtitle|clear|reset <texto>');
        break;
      }
      const action = parts[2]?.toLowerCase();
      const text = parts.slice(3).join(' ');
      if (action === 'title') { engine.titleText = text; engine.titleTicks = 60; }
      else if (action === 'subtitle') { engine.subtitleText = text; if (!engine.titleTicks) engine.titleTicks = 60; }
      else if (action === 'clear') { engine.titleText = null; engine.titleTicks = 0; }
      else if (action === 'reset') { engine.titleText = null; engine.subtitleText = null; engine.titleTicks = 0; }
      else if (action === 'times') { /* fade fixo 60 ticks */ }
      else say(engine, '§cUso: /title <@p> title|subtitle|clear|reset <texto>');
      break;
    }
    case 'say': {
      const msg = parts.slice(1).join(' ');
      if (!msg) { say(engine, '§cUso: /say <mensagem>'); break; }
      const name = p.nomeJogador || 'Host';
      engine.onChatMessage?.({ type: 'chat', user: name, text: msg, timestamp: Date.now() });
      engine.netManager?.broadcast?.({ t: 'chat', u: name, m: msg });
      break;
    }
    case 'me': {
      const action = parts.slice(1).join(' ');
      if (!action) { say(engine, '§cUso: /me <ação>'); break; }
      const name = p.nomeJogador || 'Host';
      const line = `§d* ${name} ${action}`;
      engine.onChatMessage?.({ type: 'system', text: line, timestamp: Date.now() });
      engine.netManager?.broadcast?.({ t: 'chat', system: true, text: line });
      break;
    }
    case 'tell':
    case 'msg':
    case 'w': {
      const target = parts[1];
      const msg = parts.slice(2).join(' ');
      if (!target || !msg) { say(engine, '§cUso: /tell <jogador> <mensagem>'); break; }
      const name = p.nomeJogador || 'Host';
      const lower = target.toLowerCase();
      if (lower === '@s' || lower === '@p' || lower === name.toLowerCase()) {
        say(engine, '§cVocê não pode sussurrar para si mesmo.');
        break;
      }
      const ok = engine.netManager?.sendWhisper?.(target, msg);
      if (!ok) say(engine, `§cJogador '${target}' não encontrado.`);
      break;
    }
    case 'list': {
      const names = [p.nomeJogador || 'Host'];
      if (engine.netManager?.remotePlayers) {
        for (const rp of engine.netManager.remotePlayers.values()) if (rp?.name) names.push(rp.name);
      } else if (engine.netManager?.playerNames) {
        names.push(...engine.netManager.playerNames);
      }
      say(engine, `§7Jogadores (${names.length}): §f${names.join('§7, §f')}`);
      break;
    }
    case 'seed': {
      say(engine, `§7Seed: §f${engine.world?.seed ?? '—'}`);
      break;
    }
    case 'help':
    case '?': {
      say(engine, '§e=== Comandos Mind Cave (1.8.9) ===');
      for (const line of COMMAND_LIST) say(engine, '§7' + line);
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
