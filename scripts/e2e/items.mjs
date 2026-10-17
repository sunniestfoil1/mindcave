// Auditoria FUNCIONAL por categoria (lógica pura): todo bloco quebra e dropa algo válido, toda comida alimenta, toda ferramenta é mais
// rápida que a mão no que deveria, toda arma bate mais que o punho, toda armadura protege, toda receita usa itens que existem.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fail++; };
try {
  const { ITEMS, TOOL_MATERIALS } = await server.ssrLoadModule('/src/game/items.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const Mining = await server.ssrLoadModule('/src/game/mining.js');
  const Surv = await server.ssrLoadModule('/src/game/survival.js');
  const Combat = await server.ssrLoadModule('/src/game/combat.js');
  const idOf = (n) => Number(Object.keys(ITEMS).find(k => ITEMS[k].name === n));
  const exists = (id) => !!(ITEMS[id] || BLOCKS[id]);

  // ---- blocos: dropam e são obtíveis ----
  const best = [idOf('diamond_pickaxe'), idOf('diamond_axe'), idOf('diamond_shovel'), 359, idOf('diamond_sword')].map(id => ({ id }));
  const noDropOk = new Set(['air', 'bedrock', 'glass', 'stained_glass', 'ice', 'fire', 'water', 'flowing_water', 'lava', 'flowing_lava', 'snow_layer', 'leaves', 'monster_egg', 'mob_spawner', 'glowstone_dust', 'web',
    // no 1.8.9 também não largam nada (ou largam ao acaso, como os cogumelos gigantes, que podem dar 0)
    'piston_head', 'cake', 'glass_pane', 'stained_glass_pane', 'packed_ice', 'barrier', 'brown_mushroom_block', 'red_mushroom_block']);
  const semDrop = [], dropInvalido = [], semTempo = [];
  for (const [k, b] of Object.entries(BLOCKS)) {
    const id = Number(k);
    if (id === 0 || b.hardness < 0 || [8, 9, 10, 11, 51].includes(id)) continue;
    let drops = [];
    for (const tool of [null, ...best]) { drops = Mining.getDrops(id, tool, b.variants ? 0 : 0); if (drops.length) break; }
    if (!drops.length && !noDropOk.has(b.name)) semDrop.push(`${id} ${b.name}`);
    for (const d of drops) if (!exists(d.id)) dropInvalido.push(`${id} ${b.name} → ${d.id}`);
    const t = Mining.getMiningTime(id, best[0], [], false, true);
    if (!(t < Infinity)) semTempo.push(`${id} ${b.name}`);
  }
  ok(semDrop.length === 0, `todo bloco quebrável dropa algo com a melhor ferramenta${semDrop.length ? ': ' + semDrop.join(', ') : ''}`);
  ok(dropInvalido.length === 0, `todo drop é um item que existe${dropInvalido.length ? ': ' + dropInvalido.join(', ') : ''}`);
  ok(semTempo.length === 0, `todo bloco quebrável tem tempo de quebra finito${semTempo.length ? ': ' + semTempo.join(', ') : ''}`);

  // ---- comida ----
  const foods = Object.entries(Surv.FOODS);
  const foodBad = foods.filter(([id, f]) => !ITEMS[id] || !(f.hunger > 0) || f.saturation === undefined).map(([id]) => id);
  const foodNoFlag = Object.entries(ITEMS).filter(([id, it]) => it.food && !Surv.FOODS[id]).map(([id, it]) => `${id} ${it.name}`);
  ok(foodBad.length === 0, `toda comida de FOODS é item real e dá fome${foodBad.length ? ': ' + foodBad : ''} (${foods.length} comidas)`);
  ok(foodNoFlag.length === 0, `todo item marcado "food" tem entrada em FOODS (senão não dá para comer)${foodNoFlag.length ? ': ' + foodNoFlag.join(', ') : ''}`);
  const p = Surv.createSurvivalState('survival'); p.hunger = 10; p.saturation = 0;
  let eaten = 0; for (const [id] of foods) { p.hunger = 10; if (Surv.canEat(p, Number(id))) { Surv.eatFood(p, Number(id)); if (p.hunger > 10) eaten++; } }
  ok(eaten >= foods.length - 3, `comer aumenta a fome (${eaten}/${foods.length}; as 'always' dão efeito mesmo cheio)`);

  // ---- ferramentas: mais rápidas que a mão ----
  const target = { pickaxe: 1, axe: 5, shovel: 3, shears: 18, sword: 30 };
  const toolBad = [];
  for (const [id, it] of Object.entries(ITEMS)) {
    if (!it.tool || it.tool.type === 'hoe') continue;
    const tgt = target[it.tool.type];
    if (!tgt) continue;
    const hand = Mining.getMiningTime(tgt, null, [], false, true), withT = Mining.getMiningTime(tgt, { id: Number(id) }, [], false, true);
    if (!(withT < hand)) toolBad.push(`${id} ${it.name} (${withT} ≥ mão ${hand})`);
  }
  ok(toolBad.length === 0, `toda picareta/machado/pá/tesoura é mais rápida que a mão no alvo certo${toolBad.length ? ': ' + toolBad.join(', ') : ''}`);
  // ordem de material: madeira < pedra < ferro < diamante na pedra
  const tPick = (m) => Mining.getMiningTime(1, { id: idOf(m + '_pickaxe') }, [], false, true);
  ok(tPick('wooden') > tPick('stone') && tPick('stone') > tPick('iron') && tPick('iron') > tPick('diamond'), `picaretas: madeira ${tPick('wooden')} > pedra ${tPick('stone')} > ferro ${tPick('iron')} > diamante ${tPick('diamond')} ticks na pedra`);
  const ironOre = 15, diaOre = 56, obs = 49;
  ok(Mining.getDrops(ironOre, { id: idOf('wooden_pickaxe') }, 0).length === 0 && Mining.getDrops(ironOre, { id: idOf('stone_pickaxe') }, 0).length === 1, 'minério de ferro exige picareta de pedra');
  ok(Mining.getDrops(diaOre, { id: idOf('stone_pickaxe') }, 0).length === 0 && Mining.getDrops(diaOre, { id: idOf('iron_pickaxe') }, 0).length === 1, 'diamante exige ferro');
  ok(Mining.getDrops(obs, { id: idOf('iron_pickaxe') }, 0).length === 0 && Mining.getDrops(obs, { id: idOf('diamond_pickaxe') }, 0).length === 1, 'obsidiana exige diamante');

  // ---- armas ----
  const attacker = { pos: { x: 0, y: 0, z: 0 }, onGround: true, sprinting: false, fallDistance: 0, vel: { x: 0, y: 0, z: 0 } };
  const dmgOf = (id) => Combat.getAttackDamage(attacker, id ? { id, count: 1 } : null);
  const fist = dmgOf(null);
  // enxada e arco batem 1 como o punho (oficial); armas de fogo causam dano pelo tiro, não pela pancada
  const weapons = Object.entries(ITEMS).filter(([, it]) => (it.weapon || (it.tool && it.weaponDamage)) && it.tool?.type !== 'hoe' && it.name !== 'bow' && !it.gun);
  const weakW = weapons.filter(([id]) => !(dmgOf(Number(id)) > fist)).map(([id, it]) => `${id} ${it.name} (${dmgOf(Number(id))})`);
  ok(weakW.length === 0, `toda espada/ferramenta de ataque bate mais que o punho (${fist})${weakW.length ? ': ' + weakW.join(', ') : ''} — ${weapons.length} armas`);
  ok(dmgOf(idOf('diamond_sword')) > dmgOf(idOf('iron_sword')) && dmgOf(idOf('iron_sword')) > dmgOf(idOf('stone_sword')) && dmgOf(idOf('stone_sword')) > dmgOf(idOf('wooden_sword')), `espadas por material: ${['wooden', 'stone', 'iron', 'diamond'].map(m => dmgOf(idOf(m + '_sword'))).join(' < ')}`);

  // ---- armaduras ----
  const armors = Object.entries(ITEMS).filter(([, it]) => it.armor);
  const armorBad = armors.filter(([id]) => !((Surv.computeArmorPoints({ armor: [{ id: Number(id) }, null, null, null] })) > 0)).map(([id, it]) => `${id} ${it.name}`);
  ok(armorBad.length === 0, `toda peça de armadura dá pontos de proteção${armorBad.length ? ': ' + armorBad.join(', ') : ''} (${armors.length} peças)`);
  const { ARMOR_MATERIALS } = await server.ssrLoadModule('/src/game/items.js');
  const mismatch = armors.filter(([id, it]) => Surv.computeArmorPoints({ armor: [{ id: Number(id) }] }) !== ARMOR_MATERIALS[it.armor.material].points[it.armor.slot]).map(([id, it]) => `${id} ${it.name}`);
  ok(mismatch.length === 0, `pontos de cada peça batem com ARMOR_MATERIALS${mismatch.length ? ': ' + mismatch.join(', ') : ''}`);
  const full = (m) => Surv.computeArmorPoints({ armor: ['helmet', 'chestplate', 'leggings', 'boots'].map(s => ({ id: idOf((m === 'chain' ? 'chainmail' : m) + '_' + s) })) });
  ok(full('leather') === 7 && full('chain') === 12 && full('iron') === 15 && full('diamond') === 20, `conjuntos completos: couro ${full('leather')} (7), malha ${full('chain')} (12), ferro ${full('iron')} (15), diamante ${full('diamond')} (20)`);
  const noDur = Object.entries(ITEMS).filter(([, it]) => (it.tool || it.armor || it.weapon) && !it.durability).map(([id, it]) => `${id} ${it.name}`);
  ok(noDur.length === 0, `toda ferramenta/arma/armadura tem durabilidade${noDur.length ? ': ' + noDur.join(', ') : ''}`);
} catch (e) { console.log('ERRO', e.message, (e.stack || '').split(String.fromCharCode(10)).slice(0, 5).join(' | ')); fail++; }
await server.close();
process.exit(fail ? 1 : 0);
