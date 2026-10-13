// Portas, cercas e portões: formas, conexão, colisão (cerca = 1,5 de altura), porta aberta/fechada, redstone.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
try {
  const Sh = await server.ssrLoadModule('/src/game/shapes.js');
  const Ph = await server.ssrLoadModule('/src/game/physics.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const { packState: ps, stateId } = await server.ssrLoadModule('/src/game/chunk.js');
  const Mining = await server.ssrLoadModule('/src/game/mining.js');
  const R = await server.ssrLoadModule('/src/game/recipes.js');
  const Rs = await server.ssrLoadModule('/src/game/redstone.js');
  const mk = () => { const m = new Map(); return { m, set(x, y, z, id, meta = 0) { m.set(`${x},${y},${z}`, ps(id, meta)); }, getBlock(x, y, z) { return m.get(`${x},${y},${z}`) || 0; }, setBlock(x, y, z, s) { m.set(`${x},${y},${z}`, s); } }; };
  const gb = (w) => w.getBlock.bind(w);
  const floor = (w) => { for (let x = -6; x <= 8; x++) for (let z = -6; z <= 8; z++) w.set(x, 0, z, 1); };

  // ---- registro ----
  ok(BLOCKS[64].model === 'door' && BLOCKS[71].model === 'door' && BLOCKS[85].model === 'fence' && BLOCKS[113].model === 'fence' && BLOCKS[107].model === 'gate', 'blocos 64, 71, 85, 113 e 107 registrados');
  ok(BLOCKS[64].drop === 324 && BLOCKS[71].drop === 330, 'portas dropam os itens 324/330');
  // ---- cerca: conexões ----
  let w = mk(); floor(w); w.set(0, 1, 0, 85); w.set(1, 1, 0, 85); w.set(0, 1, 1, 1);
  let c = Sh.fenceConnections(85, gb(w), 0, 1, 0);
  ok(same(c, [false, false, true, true]), `cerca conecta com cerca (leste) e bloco cheio (sul): ${JSON.stringify(c)}`);
  w.set(-1, 1, 0, 113);
  ok(Sh.fenceConnections(85, gb(w), 0, 1, 0)[0] === false, 'cerca de carvalho NÃO conecta com a do nether');
  ok(Sh.fenceConnections(113, gb(w), -1, 1, 0).every(x => !x), 'cerca do nether sozinha não conecta');
  w.set(0, 1, -1, 18); // folhas (não opacas)
  ok(Sh.fenceConnections(85, gb(w), 0, 1, 0)[1] === false, 'cerca não conecta com folhas');
  // portão: conecta só se o vão aponta para a cerca
  w = mk(); floor(w); w.set(0, 1, 0, 85); w.set(1, 1, 0, 107, 1); // portão olhando norte: barras ao longo de X
  ok(Sh.fenceConnections(85, gb(w), 0, 1, 0)[2] === true, 'cerca conecta com portão cujas barras apontam para ela');
  w.set(1, 1, 0, 107, 0); // olhando oeste: barras ao longo de Z
  ok(Sh.fenceConnections(85, gb(w), 0, 1, 0)[2] === false, 'e não com portão de lado');
  // ---- cerca: caixas ----
  const post = Sh.fenceBoxes([false, false, false, false], 'collide');
  ok(post.length === 1 && post[0][4] === 1.5, 'colisão da cerca tem 1,5 de altura');
  ok(Sh.fenceBoxes([false, false, false, false], 'select')[0][4] === 1, 'contorno/mira da cerca tem altura 1');
  ok(Sh.fenceBoxes([true, false, true, false], 'render').length === 1 + 2 * 2, 'malha: poste + 2 barras por lado conectado');

  // ---- física: não dá para pular a cerca (1,5 > pulo de 1,25) e o portão fechado também ----
  const jumpAt = (world, x0) => {
    const pos = { x: x0, y: 1, z: 0.5 }, vel = { x: 0, y: 0, z: 0 }; let onGround = true;
    for (let t = 0; t < 70; t++) {
      if (onGround && t % 10 === 0) vel.y = 0.42;          // pula sem parar
      vel.x = 0.2; vel.y -= 0.08; vel.y *= 0.98;
      const r = Ph.moveEntity(pos, vel, world, 1, { onGround }); onGround = r.onGround;
    }
    return pos;
  };
  w = mk(); floor(w); w.set(3, 1, 0, 85);
  let p = jumpAt(w, 0.5);
  ok(p.x <= 3.375 - 0.3 + 1e-6 && p.y < 1.3, `pulando sem parar, o jogador NÃO passa pela cerca (x=${p.x.toFixed(2)} y=${p.y.toFixed(2)})`);
  w.set(3, 1, 0, 107, 0);                                  // portão olhando oeste: barras ao longo de Z (bloqueia andar em X)
  p = jumpAt(w, 0.5);
  ok(p.x <= 3.375 - 0.3 + 1e-6, `portão fechado bloqueia (x=${p.x.toFixed(2)})`);
  w.set(3, 1, 0, 107, 4);                                  // aberto
  p = jumpAt(w, 0.5);
  ok(p.x > 4, `portão aberto deixa passar (x=${p.x.toFixed(2)})`);

  // ---- porta ----
  // olhando norte (facing 1): placa fecha no lado SUL (perto de quem colocou); aberta com dobradiça à esquerda → parede OESTE
  w = mk(); floor(w); w.set(0, 1, 0, 64, 1); w.set(0, 2, 0, 64, 8);
  let info = Sh.doorInfo(w.getBlock(0, 2, 0), gb(w), 0, 2, 0);
  ok(info.upper && info.facing === 1 && !info.open && !info.hingeRight, 'metade de cima lê direção/aberta da de baixo');
  let b0 = Sh.blockBoxes(w.getBlock(0, 1, 0), gb(w), 0, 1, 0, 'collide');
  ok(same(b0, [[0, 0, 0.8125, 1, 1, 1]]), `fechada olhando norte: placa no lado sul ${JSON.stringify(b0)}`);
  w.set(0, 1, 0, 64, 1 | 4);
  b0 = Sh.blockBoxes(w.getBlock(0, 1, 0), gb(w), 0, 1, 0, 'collide');
  ok(same(b0, [[0, 0, 0, 0.1875, 1, 1]]), `aberta (dobradiça esquerda): placa na parede oeste ${JSON.stringify(b0)}`);
  const b1 = Sh.blockBoxes(w.getBlock(0, 2, 0), gb(w), 0, 2, 0, 'collide');
  ok(same(b1, b0), 'a metade de cima acompanha a de baixo (aberta)');
  w.set(0, 2, 0, 64, 8 | 1); // dobradiça direita
  ok(same(Sh.blockBoxes(w.getBlock(0, 1, 0), gb(w), 0, 1, 0, 'collide'), [[0.8125, 0, 0, 1, 1, 1]]), 'dobradiça direita: placa na parede leste');
  // física: porta fechada bloqueia, aberta deixa passar pelo vão
  w = mk(); floor(w); w.set(3, 1, 0, 64, 2); w.set(3, 2, 0, 64, 8); // olhando leste: placa no lado oeste do bloco, bloqueia andar em X
  p = jumpAt(w, 0.5);
  ok(p.x < 3 + 1e-6, `porta fechada bloqueia (x=${p.x.toFixed(2)})`);
  w.set(3, 1, 0, 64, 2 | 4); // aberta: placa vai para a parede (norte ou sul), o vão fica livre
  p = jumpAt(w, 0.5);
  ok(p.x > 4, `porta aberta deixa passar (x=${p.x.toFixed(2)})`);

  // ---- mineração, receitas ----
  ok(Mining.getDrops(64, null, 0)[0]?.id === 324 && Mining.getDrops(64, null, 8)[0]?.id === 324, 'porta de madeira dropa 1 item mesmo a mão (qualquer metade)');
  ok(Mining.getDrops(71, null, 0).length === 0, 'porta de ferro exige picareta');
  ok(Mining.getDrops(85, null, 0)[0]?.id === 85, 'cerca dropa ela mesma');
  let rr = R.matchRecipe([{ id: 5 }, { id: 280 }, { id: 5 }, { id: 5 }, { id: 280 }, { id: 5 }, null, null, null], 3);
  ok(rr && rr.result.id === 85 && rr.result.count === 2, 'receita: 4 tábuas + 2 gravetos → 2 cercas');
  rr = R.matchRecipe([{ id: 280 }, { id: 5 }, { id: 280 }, { id: 280 }, { id: 5 }, { id: 280 }, null, null, null], 3);
  ok(rr && rr.result.id === 107, 'receita: portão de carvalho');
  rr = R.matchRecipe([{ id: 112 }, { id: 112 }, { id: 112 }, { id: 112 }, { id: 112 }, { id: 112 }, null, null, null], 3);
  ok(rr && rr.result.id === 113 && rr.result.count === 6, 'receita: 6 tijolos do nether → 6 cercas do nether');

  // ---- colocação do portão ----
  const gate = BLOCKS[107];
  const pl = (yaw) => Sh.computePlacement(gate, 0, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, yaw, () => 0);
  ok(pl(0).meta === 3 && pl(Math.PI / 2).meta === 0 && pl(Math.PI).meta === 1 && pl(-Math.PI / 2).meta === 2, 'portão olha para onde o jogador olha (sul=3, oeste=0, norte=1, leste=2)');
  ok(Sh.computePlacement(BLOCKS[85], 0, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, 0, () => 0) === null, 'cerca usa a colocação comum');

  // ---- redstone: porta reage à MUDANÇA de energia ----
  w = mk(); floor(w); w.set(0, 1, 0, 64, 1); w.set(0, 2, 0, 64, 8);
  const rs = new Rs.RedstoneSystem(w);
  let power = false; rs.isPowered = () => power;
  const open = () => (w.getBlock(0, 1, 0) & 4) !== 0;
  rs.evaluate(0, 1, 0); ok(!open(), 'sem energia: continua fechada');
  power = true; rs.evaluate(0, 2, 0); ok(open(), 'recebe energia (avaliando a metade de cima): abre');
  power = false; rs.evaluate(0, 1, 0); ok(!open(), 'perde a energia: fecha');
  w.set(0, 1, 0, 64, 1 | 4); rs.evaluate(0, 1, 0); ok(open(), 'aberta à mão sem energia: a redstone vizinha NÃO a fecha');

  // ---- baú, escada de mão, alçapão ----
  const idItems = (await server.ssrLoadModule('/src/game/items.js')).ITEMS;
  ok(BLOCKS[54]?.model === 'chest' && BLOCKS[65]?.model === 'ladder' && BLOCKS[96]?.model === 'trapdoor' && !!idItems[281], 'baú (54), escada de mão (65), alçapão (96) e tigela (281) existem');
  ok(BLOCKS[65].climbable === true, 'escada de mão é escalável');
  ok(same(Sh.ladderBox(3), [0, 0, 0, 1, 1, 0.125]) && same(Sh.ladderBox(1), [0, 0, 0.875, 1, 1, 1]) && same(Sh.ladderBox(0), [0.875, 0, 0, 1, 1, 1]) && same(Sh.ladderBox(2), [0, 0, 0, 0.125, 1, 1]), 'escada de mão: placa encostada na parede oposta à direção em que olha');
  ok(same(Sh.trapdoorBox(0), [0, 0, 0, 1, 0.1875, 1]) && same(Sh.trapdoorBox(8), [0, 0.8125, 0, 1, 1, 1]), 'alçapão fechado: placa no chão ou no teto');
  ok(same(Sh.trapdoorBox(0 | 4), [0, 0, 0, 0.1875, 1, 1]) && same(Sh.trapdoorBox(2 | 4), [0.8125, 0, 0, 1, 1, 1]), 'alçapão aberto: placa vertical na parede da dobradiça');
  const hitWall = (nx, nz) => ({ x: 0, y: 0, z: 0, nx, ny: 0, nz, hy: 0.3 });
  const wallState = (x, y, z) => (x === 0 && y === 0 && z === 0 ? ps(1, 0) : 0);
  let lp = Sh.computePlacement(BLOCKS[65], 0, hitWall(1, 0), 0, wallState);
  ok(lp && lp.x === 1 && lp.meta === 2, `escada de mão na face leste de um bloco olha para leste (meta ${lp?.meta})`);
  ok(Sh.computePlacement(BLOCKS[65], 0, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, 0, wallState).invalid === true, 'escada de mão não se coloca em cima de bloco');
  ok(Sh.computePlacement(BLOCKS[65], 0, hitWall(1, 0), 0, () => ps(18, 0)).invalid === true, 'nem em folhas (não é parede cheia)');
  lp = Sh.computePlacement(BLOCKS[96], 0, { x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0, hy: 0.8 }, 0, wallState);
  ok(lp.meta === (0 | 8), `alçapão na metade de cima da parede: dobradiça na parede, metade de cima (meta ${lp.meta})`);
  lp = Sh.computePlacement(BLOCKS[54], 0, { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, hy: 1 }, 0, () => 0);
  ok(lp.meta === 1, `baú olhando para o sul (yaw 0) fica com a frente para o norte (meta ${lp.meta})`);
  // física: a escada de mão é uma placa fina; o jogador a atravessa pelo vão da célula mas não a placa
  w = mk(); floor(w); w.set(3, 1, 0, 65, 0); // olha para oeste: placa no lado leste (x 0.875-1)
  ok(Sh.blockBoxes(w.getBlock(3, 1, 0), gb(w), 3, 1, 0, 'collide')[0][0] === 0.875, 'colisão da escada de mão = placa de 2/16');
} catch (e) { console.log('ERRO', e.message, (e.stack || '').split(String.fromCharCode(10)).slice(0, 5).join(' | ')); fail++; }
await server.close();
process.exit(fail ? 1 : 0);
