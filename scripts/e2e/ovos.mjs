// Ovos de spawn e sumiço de mobs. Lógica pura (Node):
//  - todo ovo aponta para um mob que existe, tem nome e cores, e aparece no catálogo como variação do item 383 (meta = id da entidade do 1.8.9)
//  - despawn natural como no EntityLiving.despawnEntity: longe (>128) some na hora; entre 32 e 128 só depois de 600 ticks e por sorteio;
//    perto (<32) nunca; animais, mobs de ovo/summon e mortos nunca somem
import { pathToFileURL } from 'url';
import fs from 'fs';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const { SPAWN_EGGS, SPAWN_EGG_NAMES } = await server.ssrLoadModule('/src/game/spawnEggData.js');
  const { MOB_TYPES } = await server.ssrLoadModule('/src/game/mobRegistry.js');
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
  const { MobManager } = await server.ssrLoadModule('/src/game/mobManager.js');

  const eggs = Object.entries(SPAWN_EGGS);
  ok(eggs.length >= 14, `${eggs.length} ovos de spawn`);
  ok(eggs.every(([, e]) => MOB_TYPES[e.mob]), `todo ovo aponta para um mob que existe (sem mob: ${eggs.filter(([, e]) => !MOB_TYPES[e.mob]).map(([m]) => m).join(',') || 'nenhum'})`);
  ok(eggs.every(([, e]) => Number.isInteger(e.c1) && Number.isInteger(e.c2) && e.c1 >= 0 && e.c1 <= 0xffffff && e.c2 >= 0 && e.c2 <= 0xffffff), 'todo ovo tem as duas cores RGB');
  ok(new Set(eggs.map(([, e]) => e.mob)).size === eggs.length, 'cada mob tem um ovo só');
  ok(ITEMS[383] && ITEMS[383].name === 'spawn_egg' && Object.keys(ITEMS[383].variantNames).length === eggs.length && eggs.every(([m]) => ITEMS[383].variantNames[m]), 'o item 383 lista uma variação por ovo (índice = id da entidade)');
  ok(SPAWN_EGG_NAMES[54] === 'Ovo de Zumbi' && SPAWN_EGG_NAMES[50] === 'Ovo de Creeper', 'nomes: Ovo de Zumbi, Ovo de Creeper');
  ok(SPAWN_EGGS[54].c1 === 44975 && SPAWN_EGGS[54].c2 === 7969893 && SPAWN_EGGS[50].c1 === 894731, 'cores do zumbi e do creeper iguais às do registro oficial');

  const player = { pos: { x: 0, y: 64, z: 0 } };
  const mgr = new MobManager({ add() {}, remove() {} }, { hasChunkAt: () => true });
  const mk = (typeId, d, extra = {}) => ({ typeId, pos: { x: d, y: 64, z: 0 }, isDead: false, ...extra });
  const rep = (mob, n) => { let gone = 0; for (let i = 0; i < n; i++) if (mgr._shouldNaturallyDespawn(mob, player)) { gone = i + 1; break; } return gone; };
  ok(mgr._shouldNaturallyDespawn(mk('zombie', 129), player) === true, 'zumbi a 129 blocos some na hora');
  ok(rep(mk('zombie', 20), 5000) === 0, 'zumbi a 20 blocos nunca some (5000 ticks)');
  const z60 = mk('zombie', 60);
  ok(rep(z60, 600) === 0, 'zumbi a 60 blocos não some antes de 600 ticks');
  const z60b = mk('zombie', 60); const t = rep(z60b, 100000);
  ok(t > 600 && t < 20000, `zumbi a 60 blocos some depois dos 600 ticks, por sorteio (sumiu no tick ${t})`);
  ok(rep(mk('zombie', 129, { persistent: true }), 100) === 0 && rep(mk('zombie', 60, { persistent: true }), 100000) === 0, 'mob de ovo/summon (persistente) nunca some, nem longe');
  ok(['pig', 'cow', 'sheep', 'chicken', 'wolf'].every((m) => rep(mk(m, 200), 50) === 0), 'animais nunca somem, nem a 200 blocos');
  ok(rep(mk('zombie', 200, { isDead: true }), 50) === 0, 'mob morto fica para a animação de morte (não é tratado como despawn)');
  const near = mk('zombie', 60); for (let i = 0; i < 590; i++) mgr._shouldNaturallyDespawn(near, player);
  near.pos.x = 10; mgr._shouldNaturallyDespawn(near, player); ok(near._idle === 0, 'chegar a menos de 32 blocos zera o relógio');
  // MobEntity monta o modelo com canvas (não existe em Node): a persistência é conferida na serialização e no código do summon
  mgr.mobs.push({ typeId: 'zombie', pos: { x: 3, y: 64, z: 3 }, yaw: 0, pitch: 0, health: 20, isBaby: false, persistent: true, isDead: false });
  ok(mgr.serialize()[0].persistent === true, 'a persistência do mob vai para o arquivo do mundo');
  ok(/summon\(typeId, pos\) \{[^}]*persistent = true/.test(fs.readFileSync(root + '/src/game/mobManager.js', 'utf8')), '/summon fixa o mob (persistent = true)');
  ok(/if \(item\.persistent\) mob\.persistent = true/.test(fs.readFileSync(root + '/src/game/mobManager.js', 'utf8')), 'ao carregar o mundo o mob volta persistente');
  mgr.mobs.length = 0;
  mgr.dispose();
} catch (e) { ok(false, 'exceção: ' + (e.stack || e)); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
