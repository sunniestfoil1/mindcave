// Malha das folhas (mesher.js, sem navegador): textura da face de baixo na direção certa nos retângulos mesclados e
// faces internas entre folhas conforme a opção Folhas (Detalhadas = desenha, Rápidas/Inteligentes = esconde).
import { pathToFileURL } from 'url';
const root = process.argv[2] || process.cwd();
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { buildSectionMesh, setLeafMode } = await server.ssrLoadModule('/src/game/mesher.js');
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);

const tile = { u0: 0, v0: 1, u1: 1, v1: 0 };
const tiles = new Proxy({}, { get: () => tile });
const LEAF = (18 << 4);
// tira de folhas de 4 blocos em x (z = 0, y = 5) dentro da seção 0 do chunk 0,0
function mesh(blocks) {
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const m = new Map(blocks.map(([x, y, z, s]) => [key(x, y, z), s]));
  const abs = (x, y, z) => m.get(key(x, y, z)) || 0;
  return buildSectionMesh((x, y, z) => abs(x, y, z), 0, 0, 0, abs, () => ({ sky: 15, block: 0 }), tiles, null);
}
const strip = [0, 1, 2, 3].map((x) => [x, 5, 0, LEAF]);

// quads por direção: normal pelo produto vetorial dos 3 primeiros vértices de cada quad
function quads(geo) {
  const p = geo.opaque.positions, uv = geo.opaque.uvs, res = [];
  for (let q = 0; q < p.length / 12; q++) {
    const v = (i) => [p[(q * 4 + i) * 3], p[(q * 4 + i) * 3 + 1], p[(q * 4 + i) * 3 + 2]];
    const a = v(0), b = v(1), c = v(2);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const us = [0, 1, 2, 3].map((i) => uv[(q * 4 + i) * 2]), vs = [0, 1, 2, 3].map((i) => uv[(q * 4 + i) * 2 + 1]);
    res.push({ n, du: Math.max(...us) - Math.min(...us), dv: Math.max(...vs) - Math.min(...vs) });
  }
  return res;
}
const dirOf = (q) => (Math.abs(q.n[1]) > Math.abs(q.n[0]) && Math.abs(q.n[1]) > Math.abs(q.n[2]) ? (q.n[1] > 0 ? 'cima' : 'baixo') : Math.abs(q.n[0]) > Math.abs(q.n[2]) ? 'x' : 'z');

// "Detalhadas": todas as faces
setLeafMode('fancy');
let qs = quads(mesh(strip));
const baixo = qs.filter((q) => dirOf(q) === 'baixo'), cima = qs.filter((q) => dirOf(q) === 'cima');
ok(baixo.length === 1 && cima.length === 1, `face de cima e de baixo viram 1 retângulo mesclado cada (${cima.length} / ${baixo.length})`);
ok(cima[0] && Math.round(cima[0].du) === 4 && Math.round(cima[0].dv) === 1, `topo: textura repete 4× ao longo do comprimento (u=${cima[0]?.du}, v=${cima[0]?.dv})`);
ok(baixo[0] && Math.round(baixo[0].du) === 1 && Math.round(baixo[0].dv) === 4, `base: textura repete 4× ao longo do comprimento, não esticada (u=${baixo[0]?.du}, v=${baixo[0]?.dv})`);
const xFaces = qs.filter((q) => dirOf(q) === 'x').length;
ok(xFaces === 8, `Detalhadas: cada uma das 4 folhas tem as 2 faces em x, inclusive nas emendas (8, vieram ${xFaces})`);

// "Rápidas"/"Inteligentes": sem faces internas
for (const modo of ['fast', 'smart']) {
  setLeafMode(modo);
  qs = quads(mesh(strip));
  const n = qs.filter((q) => dirOf(q) === 'x').length;
  ok(n === 2, `${modo}: só as 2 pontas da tira têm face em x (${n})`);
}
setLeafMode('default');
qs = quads(mesh(strip));
ok(qs.filter((q) => dirOf(q) === 'x').length === 8, 'padrão = Detalhadas');

// lados também certos (norte/sul e leste/oeste) num retângulo 1×4 em z
setLeafMode('fancy');
const wall = [0, 1, 2, 3].map((z) => [0, 5, z, LEAF]);
qs = quads(mesh(wall));
const lado = qs.filter((q) => dirOf(q) === 'x');
ok(lado.length === 2 && lado.every((q) => Math.round(q.du) === 4 && Math.round(q.dv) === 1), 'faces leste/oeste de 4 de comprimento: u=4, v=1');
console.log(out.join('\n'));
await server.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
