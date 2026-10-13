import { createRequire } from 'module'; import { pathToFileURL } from 'url'; const { createServer } = await import(pathToFileURL(process.argv[2] + '/node_modules/vite/dist/node/index.js').href);
const root = process.argv[2];
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fail++; };
try {
  const M = await server.ssrLoadModule('/src/game/mining.js');
  const S = await server.ssrLoadModule('/src/game/survival.js');
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const idOf = (n) => Number(Object.keys(ITEMS).find(k => ITEMS[k].name === n));
  const woodPick = { id: idOf('wooden_pickaxe') }, ironPick = { id: idOf('iron_pickaxe') }, diaPick = { id: idOf('diamond_pickaxe') };
  const woodAxe = { id: idOf('wooden_axe') }, shovel = { id: idOf('wooden_shovel') };
  // ticks oficiais: ceil(1 / (vel/dureza/(30|100)))
  ok(M.getMiningTime(31, null) === 0, 'grama alta (dureza 0) quebra instantânea');
  ok(M.getMiningTime(3, null) === 15, `terra à mão = 15 ticks (0,75 s): ${M.getMiningTime(3, null)}`);
  ok(M.getMiningTime(3, shovel) === 8, `terra com pá de madeira = 8 ticks (0,4 s): ${M.getMiningTime(3, shovel)}`);
  ok(M.getMiningTime(17, null) === 60, `tronco à mão = 60 ticks (3 s): ${M.getMiningTime(17, null)}`);
  ok(M.getMiningTime(17, woodAxe) === 30, `tronco com machado de madeira = 30: ${M.getMiningTime(17, woodAxe)}`);
  ok(M.getMiningTime(1, null) === 150, `pedra à mão = 150 ticks (7,5 s): ${M.getMiningTime(1, null)}`);
  ok(M.getMiningTime(1, woodPick) === 23, `pedra com picareta de madeira = 23 (1,15 s): ${M.getMiningTime(1, woodPick)}`);
  ok(M.getMiningTime(49, diaPick) === 188, `obsidiana com diamante = 188 ticks (9,4 s): ${M.getMiningTime(49, diaPick)}`);
  ok(M.canHarvest(17, null) && M.canHarvest(3, null) && M.canHarvest(12, null) && M.canHarvest(5, null), 'madeira, terra, areia, tábuas dropam à mão');
  ok(!M.canHarvest(1, null) && !M.canHarvest(15, woodPick) && M.canHarvest(15, { id: idOf('stone_pickaxe') }), 'pedra exige picareta; ferro exige pedra');
  ok(M.getDrops(17, null).length === 1, 'tronco à mão dropa 1 item');
  // mortes
  ok(S.getDeathMessage('fall') === 'caiu de um lugar alto', 'queda');
  ok(S.getDeathMessage('kill') === 'caiu para fora do mundo', '/kill');
  ok(S.getDeathMessage('lava') === 'tentou nadar na lava' && S.getDeathMessage('drown') === 'se afogou', 'lava e afogamento');
  ok(S.getDeathMessage('attack', 'Zumbi') === 'foi morto por Zumbi', 'mob');
  ok(S.getDeathMessage('projectile', 'Esqueleto') === 'foi alvejado por Esqueleto', 'flecha');
  const p = S.createSurvivalState();
  p.gameMode = 'creative'; p.pos = { x: 0, y: 70, z: 0 };
  ok(S.applyDamage(p, 1e6, 'kill', { bypass: true }) && p.isDead && p.deathPending && p.lastDamageSource === 'kill', '/kill mata até no criativo e marca a causa "kill"');
} catch (e) { console.log('ERRO', e); fail++; }
await server.close();
process.exit(fail ? 1 : 0);
