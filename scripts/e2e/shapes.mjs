import { pathToFileURL } from 'url';
const { createServer } = await import(pathToFileURL(process.argv[2] + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root: process.argv[2], server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
try {
  const Sh = await server.ssrLoadModule('/src/game/shapes.js');
  const Ph = await server.ssrLoadModule('/src/game/physics.js');
  const M = await server.ssrLoadModule('/src/game/mining.js');
  const R = await server.ssrLoadModule('/src/game/recipes.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const { packState: ps } = await server.ssrLoadModule('/src/game/chunk.js');
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');

  const mk = () => { const m = new Map(); return { set(x, y, z, id, meta = 0) { m.set(`${x},${y},${z}`, ps(id, meta)); }, getBlock(x, y, z) { return m.get(`${x},${y},${z}`) || 0; } }; };
  const gb = (w) => w.getBlock.bind(w);

  // --- escadas: formas ---
  ok(same(Sh.stairBoxes(0), [[0, 0, 0, 1, 0.5, 1], [0.5, 0.5, 0, 1, 1, 1]]), 'escada leste: degrau no lado +x');
  ok(same(Sh.stairBoxes(3), [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]]), 'escada norte: degrau no lado -z');
  ok(same(Sh.stairBoxes(4)[0], [0, 0.5, 0, 1, 1, 1]) && same(Sh.stairBoxes(4)[1], [0.5, 0, 0, 1, 0.5, 1]), 'escada invertida: base em cima, degrau embaixo');
  let w = mk(); w.set(0, 0, 0, 53, 3); w.set(0, 0, -1, 53, 1);
  ok(Sh.stairShape(gb(w), 0, 0, 0) === 'outer_left', `canto externo (vizinha a frente sobe p/ oeste): ${Sh.stairShape(gb(w), 0, 0, 0)}`);
  const ob = Sh.stairBoxes(3, 'outer_left');
  ok(ob.length === 2 && same(ob[1], [0, 0.5, 0, 0.5, 1, 0.5]), `outer_left norte = quarto noroeste: ${JSON.stringify(ob[1])}`);
  w = mk(); w.set(0, 0, 0, 53, 3); w.set(0, 0, 1, 53, 1);
  ok(Sh.stairShape(gb(w), 0, 0, 0) === 'inner_left', `canto interno: ${Sh.stairShape(gb(w), 0, 0, 0)}`);
  const ib = Sh.stairBoxes(3, 'inner_left');
  ok(ib.length === 3 && same(ib[2], [0, 0.5, 0.5, 0.5, 1, 1]), `inner_left norte = metade norte + quarto sudoeste: ${JSON.stringify(ib[2])}`);
  w = mk(); w.set(0, 0, 0, 53, 3); w.set(0, 0, -1, 53, 3);
  ok(Sh.stairShape(gb(w), 0, 0, 0) === 'straight', 'vizinha na mesma direcao continua reta');
  w = mk(); w.set(0, 0, 0, 53, 3); w.set(0, 0, -1, 53, 5);
  ok(Sh.stairShape(gb(w), 0, 0, 0) === 'straight', 'vizinha invertida nao forma canto');
  // --- lajes / registro ---
  ok(same(Sh.slabBox(0), [0, 0, 0, 1, 0.5, 1]) && same(Sh.slabBox(8), [0, 0.5, 0, 1, 1, 1]), 'laje de baixo/de cima');
  ok(BLOCKS[44].model === 'slab' && BLOCKS[43].singleId === 44 && BLOCKS[43].model === 'cube', 'registro: laje 44, dupla 43 (cubo)');
  ok([53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164, 180].every(i => BLOCKS[i]?.model === 'stairs'), '13 escadas registradas');
  ok(BLOCKS[44].solid && !BLOCKS[44].opaque && BLOCKS[53].solid && !BLOCKS[53].opaque, 'lajes/escadas: solidas e nao opacas');
  // --- raio ---
  const hit = Sh.rayBox(0.5, 2, 0.5, 0, -1, 0, [0, 0, 0, 1, 0.5, 1], 5);
  ok(hit && Math.abs(hit.t - 1.5) < 1e-9 && hit.ny === 1, `raio de cima acerta o topo da laje de baixo (t=1,5): t=${hit?.t} ny=${hit?.ny}`);
  ok(Sh.rayBox(0.5, 2, 0.5, 0, -1, 0, [0, 0.5, 0, 1, 1, 1], 5).t === 1, 'laje de cima: topo em t=1');
  ok(Sh.rayBox(2, 0.75, 0.5, -1, 0, 0, [0, 0, 0, 1, 0.5, 1], 5) === null, 'raio no vao acima da laje de baixo passa direto');

  // --- fisica ---
  const body = (x, y, z) => ({ pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 } });
  const fall = (b, w) => { for (let i = 0; i < 60; i++) { b.vel.y -= 0.08; b.vel.y *= 0.98; Ph.moveEntity(b.pos, b.vel, w, 1, { onGround: false }); } };
  w = mk(); for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) w.set(x, 0, z, 1);
  w.set(0, 1, 0, 44, 0);
  let b = body(0.5, 5, 0.5); fall(b, w);
  ok(Math.abs(b.pos.y - 1.5) < 1e-6, `pousa sobre a laje de baixo em y=1,5: ${b.pos.y}`);
  w.set(2, 1, 0, 44, 8);
  b = body(2.5, 5, 0.5); fall(b, w);
  ok(Math.abs(b.pos.y - 2) < 1e-6, `pousa sobre a laje de cima em y=2: ${b.pos.y}`);
  // escada: degrau baixo (0,5) sobe sozinho
  w = mk(); for (let x = -5; x <= 6; x++) for (let z = -3; z <= 3; z++) w.set(x, 0, z, 1);
  w.set(2, 1, 0, 53, 0); // sobe para leste: base 0,5 e degrau 1,0 em x>=2,5
  w.set(3, 1, 0, 1); w.set(3, 2, 0, 1); // parede de 2 blocos logo depois
  b = body(0.5, 1, 0.5);
  let onGround = true, maxY = 0, seen15 = false;
  for (let i = 0; i < 40; i++) {
    b.vel.x = 0.2; b.vel.y -= 0.08; b.vel.y *= 0.98;
    const r = Ph.moveEntity(b.pos, b.vel, w, 1, { onGround }); onGround = r.onGround;
    maxY = Math.max(maxY, b.pos.y);
    if (Math.abs(b.pos.y - 1.5) < 1e-6 && b.pos.x > 2) seen15 = true;
  }
  ok(seen15 && Math.abs(b.pos.y - 2) < 1e-6, `sobe o 1o degrau (y=1,5) e o 2o (y=2,0) andando: final y=${b.pos.y.toFixed(2)}`);
  ok(b.pos.x < 3 - 0.3 + 1e-6 && b.pos.x > 2.6, `parede de 2 blocos barra em x~2,7: x=${b.pos.x.toFixed(3)}`);

  // --- drops ---
  const idOf = (n) => Number(Object.keys(ITEMS).find(k => ITEMS[k].name === n));
  const woodPick = { id: idOf('wooden_pickaxe') };
  const d1 = M.getDrops(44, woodPick, 3), d2 = M.getDrops(44, woodPick, 11), d3 = M.getDrops(43, woodPick, 5), d4 = M.getDrops(44, null, 3);
  ok(same(d1, [{ id: 44, count: 1, meta: 3 }]) && same(d2, [{ id: 44, count: 1, meta: 3 }]), 'laje simples dropa 1 do mesmo tipo (sem o bit metade de cima)');
  ok(same(d3, [{ id: 44, count: 2, meta: 5 }]), 'laje dupla dropa 2 lajes do tipo');
  ok(d4.length === 0, 'laje de pedra sem picareta nao dropa');
  ok(M.getDrops(53, null, 2).length === 1 && M.getDrops(53, null, 2)[0].id === 53, 'escada de madeira dropa a escada, mesmo a mao');
  ok(M.getDrops(67, null, 0).length === 0 && M.getDrops(67, woodPick, 0).length === 1, 'escada de pedregulho exige picareta');
  // --- receitas ---
  let rr = R.matchRecipe([{ id: 4 }, null, null, { id: 4 }, { id: 4 }, null, { id: 4 }, { id: 4 }, { id: 4 }], 3);
  ok(rr && rr.result.id === 67 && rr.result.count === 4, 'receita: 6 pedregulhos em degraus -> 4 escadas de pedregulho');
  rr = R.matchRecipe([null, null, { id: 5 }, null, { id: 5 }, { id: 5 }, { id: 5 }, { id: 5 }, { id: 5 }], 3);
  ok(rr && rr.result.id === 53 && rr.result.count === 4, 'receita espelhada: tabuas -> escadas de carvalho');
  rr = R.matchRecipe([null, null, null, { id: 98 }, { id: 98 }, { id: 98 }, null, null, null], 3);
  ok(rr && rr.result.id === 44 && rr.result.meta === 5 && rr.result.count === 6, 'receita: 3 tijolos de pedra -> 6 lajes (meta 5)');
  // --- colocacao ---
  const none = () => 0;
  const slab = BLOCKS[44], stairs = BLOCKS[53];
  let pl = Sh.computePlacement(slab, 3, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, 0, none);
  ok(pl && pl.x === 0 && pl.y === 1 && pl.id === 44 && pl.meta === 3, 'laje clicada no chao: fica embaixo (meta 3)');
  pl = Sh.computePlacement(slab, 3, { x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0, hy: 0.8 }, 0, none);
  ok(pl.x === 1 && pl.meta === 11, 'clique na metade de cima da lateral: laje de cima (meta 3|8)');
  pl = Sh.computePlacement(slab, 3, { x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0, hy: 0.3 }, 0, none);
  ok(pl.meta === 3, 'clique na metade de baixo da lateral: laje de baixo');
  pl = Sh.computePlacement(slab, 0, { x: 0, y: 5, z: 0, nx: 0, ny: -1, nz: 0, hy: 5 }, 0, none);
  ok(pl.y === 4 && pl.meta === 8, 'clique embaixo de um bloco: laje de cima');
  const get = (m) => (x, y, z) => (x === 0 && y === 0 && z === 0 ? ps(44, m) : 0);
  pl = Sh.computePlacement(slab, 3, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 0.5 }, 0, get(3));
  ok(pl.id === 43 && pl.meta === 3 && pl.y === 0, 'laje igual clicada por cima da de baixo: vira laje dupla no mesmo lugar');
  pl = Sh.computePlacement(slab, 3, { x: 0, y: 0, z: 0, nx: 0, ny: -1, nz: 0, hy: 0.5 }, 0, get(11));
  ok(pl.id === 43 && pl.y === 0, 'laje igual clicada por baixo da de cima: vira laje dupla');
  pl = Sh.computePlacement(slab, 4, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 0.5 }, 0, get(3));
  ok(pl.id === 44 && pl.y === 1, 'tipo diferente nao vira laje dupla: coloca em cima');
  pl = Sh.computePlacement(slab, 3, { x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0, hy: 0.8 }, 0, (x, y, z) => (x === 1 && y === 0 && z === 0 ? ps(44, 3) : 0));
  ok(pl.id === 43 && pl.x === 1, 'colocar laje de cima onde ja existe a de baixo igual: vira dupla');
  const facing = (yaw) => Sh.computePlacement(stairs, 0, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, yaw, none).meta;
  ok(facing(0) === 2 && facing(Math.PI / 2) === 1 && facing(Math.PI) === 3 && facing(-Math.PI / 2) === 0, 'escada sobe na direcao do olhar (sul=2, oeste=1, norte=3, leste=0)');
  pl = Sh.computePlacement(stairs, 0, { x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0, hy: 0.9 }, 0, none);
  ok(pl.meta === (2 | 4), 'escada clicada na metade de cima da lateral: invertida');
  pl = Sh.computePlacement(stairs, 0, { x: 0, y: 3, z: 0, nx: 0, ny: -1, nz: 0, hy: 3 }, 0, none);
  ok(pl.meta === (2 | 4), 'escada clicada embaixo de um bloco: invertida');
} catch (e) { console.log('ERRO', e); fail++; }
await server.close();
process.exit(fail ? 1 : 0);
