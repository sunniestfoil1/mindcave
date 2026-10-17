// Gerador do Aether (lógica pura): determinístico, ilhas de grama/terra/pedra sagrada flutuando sobre o vazio, nuvens, sem blocos do mundo normal fora do
// previsto, árvores inteiras dentro do chunk, ilhas contínuas na fronteira entre chunks e sem chão perto de y=0 (queda no vazio).
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const G = await server.ssrLoadModule('/src/game/aetherGen.js');
  const { chunkIndex, stateId } = await server.ssrLoadModule('/src/game/chunk.js');
  const { GENERATORS } = await server.ssrLoadModule('/src/game/generators.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const seed = 123456;
  ok(!!GENERATORS.aether && GENERATORS.aether.id === 'aether', 'o gerador "aether" está registrado');
  const a = G.generateAetherChunk(seed, 3, -2), b = G.generateAetherChunk(seed, 3, -2);
  ok(a.every((v, i) => v === b[i]), 'mesmo seed e mesmo chunk geram exatamente os mesmos blocos');
  const c = G.generateAetherChunk(seed + 1, 3, -2);
  ok(a.some((v, i) => v !== c[i]), 'outro seed gera outro desenho');

  // varredura de 11×11 chunks: contagem por bloco
  const counts = {}; const ids = new Set(); let chunksWithGrass = 0, bedrock = 0, lowest = 999;
  for (let cx = -5; cx <= 5; cx++) for (let cz = -5; cz <= 5; cz++) {
    const d = G.generateAetherChunk(seed, cx, cz); let grass = 0;
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 256; y++) {
      const id = stateId(d[chunkIndex(lx, y, lz)]); if (!id) continue;
      counts[id] = (counts[id] || 0) + 1; ids.add(id); if (id === 210) grass++; if (id === 7) bedrock++;
      if ((id === 210 || id === 211 || id === 3) && y < lowest) lowest = y;
    }
    if (grass) chunksWithGrass++;
  }
  ok(counts[210] > 3000 && counts[211] > 3000 && counts[3] > 3000, `ilhas com grama (${counts[210]}), pedra sagrada (${counts[211]}) e terra (${counts[3]})`);
  ok(counts[212] > 100 && counts[213] > 100 && counts[214] > 10, `nuvens: frias ${counts[212]}, azuis ${counts[213]}, douradas ${counts[214]}`);
  ok(counts[17] > 20 && counts[18] > 100, `árvores claras: ${counts[17]} troncos e ${counts[18]} folhas`);
  ok(counts[31] > 200 && counts[38] > 5, `capim (${counts[31]}) e flores brancas (${counts[38]}) sobre a grama`);
  ok(chunksWithGrass > 10 && chunksWithGrass < 85, `ilhas flutuantes não cobrem tudo: ${chunksWithGrass} de 121 chunks têm grama`);
  ok(lowest > 20 && bedrock === 0, `o vazio embaixo é real: o bloco de terra mais baixo está em y=${lowest}, sem bedrock (${bedrock})`);
  const allowed = new Set([210, 211, 212, 213, 214, 3, 17, 18, 31, 38]);
  ok([...ids].every((i) => allowed.has(i)), `só nascem blocos do Aether e vegetação (ids: ${[...ids].sort((x, y) => x - y).join(',')})`);
  ok([...ids].every((i) => BLOCKS[i]), 'todo bloco gerado existe no registro');

  // ilhas sem corte na fronteira de chunk: a altura do topo de grama em x=15 (chunk A) e x=16 (chunk B) difere pouco
  let seams = 0, bad = 0;
  const topAt = (d, lx, lz) => { for (let y = 255; y >= 0; y--) { const id = stateId(d[chunkIndex(lx, y, lz)]); if (id === 210) return y; } return -1; };
  for (let cx = -4; cx <= 3; cx++) for (let cz = -4; cz <= 3; cz++) {
    const A = G.generateAetherChunk(seed, cx, cz), B = G.generateAetherChunk(seed, cx + 1, cz);
    for (let lz = 0; lz < 16; lz++) { const ta = topAt(A, 15, lz), tb = topAt(B, 0, lz); if (ta >= 0 && tb >= 0) { seams++; if (Math.abs(ta - tb) > 4) bad++; } }
  }
  ok(seams > 100 && bad / seams < 0.05, `a ilha continua do outro lado da fronteira entre chunks (${seams} colunas comparadas, ${bad} com salto > 4 blocos)`);

  // árvore inteira dentro do chunk: nenhuma folha encosta na borda do chunk com tronco de outro chunk (folhas só até 2 do tronco, tronco entre 2 e 13)
  let treesCut = 0;
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
    const d = G.generateAetherChunk(seed, cx, cz);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 255; y++) {
      if (stateId(d[chunkIndex(lx, y, lz)]) === 17 && (lx < 2 || lx > 13 || lz < 2 || lz > 13)) treesCut++;
    }
  }
  ok(treesCut === 0, `nenhum tronco perto da borda do chunk (árvore nunca é cortada ao meio): ${treesCut}`);

  // findAetherFloor acha chão numa coluna de ilha e devolve -1 num vazio
  const d0 = G.generateAetherChunk(seed, 0, 0);
  const get = (cx, cz) => { const d = G.generateAetherChunk(seed, cx, cz); return d; };
  let found = -1, voidOk = false;
  for (let cx = -5; cx <= 5 && found < 0; cx++) for (let cz = -5; cz <= 5 && found < 0; cz++) {
    const d = get(cx, cz);
    for (let lx = 4; lx < 12 && found < 0; lx++) for (let lz = 4; lz < 12 && found < 0; lz++) {
      const f = G.findAetherFloor((x, y, z) => stateId(d[chunkIndex(((x % 16) + 16) % 16, y, ((z % 16) + 16) % 16)]), lx, lz, 200);
      if (f > 0 && stateId(d[chunkIndex(lx, f - 1, lz)]) !== 0) found = f;
    }
  }
  ok(found > 30, `findAetherFloor acha o chão de uma ilha (y=${found})`);
  ok(G.findAetherFloor(() => 0, 5, 5, 200) === -1, 'findAetherFloor devolve -1 quando a coluna é só vazio'); void voidOk; void d0;
} catch (e) { ok(false, 'exceção: ' + (e.stack || e)); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
