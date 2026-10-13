// Auditoria de RENDERIZAÇÃO no navegador (Chrome headless, Supabase bloqueado): para TODO item e bloco confere
//  1) ícone do inventário (ItemSlot real) — imagem carregada e não vazia
//  2) malha do bloco no mundo (mesher real) — gera geometria e não usa a textura de erro
//  3) item caído (createItemMesh) — monta sem erro
// Uso: node scripts/audit-render.mjs <raiz> <porta>   (precisa do Vite rodando na porta)
import { pathToFileURL } from 'url';
import fs from 'fs';
const root = process.argv[2], port = process.argv[3] || '5191';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errors = [];
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${port}/lab/hud.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000)); // pacote + texturas reais
const result = await page.evaluate(async () => {
  const { ITEMS } = await import('/src/game/items.js');
  const { BLOCKS, tileForFace } = await import('/src/game/blocks.js');
  const { loadPack } = await import('/src/game/pack.js');
  const { loadRealTextures, makeAtlas, getAtlasTileCanvas } = await import('/src/game/textures.js');
  await loadPack(); await loadRealTextures();
  // importa o React pré-empacotado pelo próprio Vite (a mesma instância que o ItemSlot usa)
  const dev = (await (await fetch('/src/components/game/ItemSlot.jsx')).text()).match(/\/node_modules\/\.vite\/deps\/react\.js\?v=[0-9a-f]+/)[0];
  const React = (await import(dev)).default;
  const rdc = await import(dev.replace('react.js', 'react-dom_client.js')); const createRoot = rdc.createRoot || (rdc.default && rdc.default.createRoot);
  const ItemSlot = (await import('/src/components/game/ItemSlot.jsx')).default;
  const ids = new Set([...Object.keys(ITEMS), ...Object.keys(BLOCKS)].map(Number).filter(n => n > 0));
  // lista de entradas: blocos com variantes viram uma entrada por variante
  const entries = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const b = BLOCKS[id];
    if (b && b.variants && b.model === 'slab') b.variants.forEach((_, m) => entries.push({ id, meta: m }));
    else entries.push({ id, meta: 0 });
  }
  // ---- 1) ícones: ItemSlot real ----
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:1300px;display:flex;flex-wrap:wrap;background:#333;z-index:99999';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(React.Fragment, null, entries.map((e, i) => React.createElement('div', { key: i, 'data-id': e.id, 'data-meta': e.meta, style: { width: 40, height: 40 } },
    React.createElement(ItemSlot, { item: { id: e.id, count: 1, meta: e.meta }, size: 40, transparent: true })))));
  await new Promise(r => setTimeout(r, 5000));
  const iconRes = {};
  for (const el of host.querySelectorAll('div[data-id]')) {
    const id = Number(el.dataset.id), meta = Number(el.dataset.meta);
    const img = el.querySelector('img');
    let state = 'SEM IMAGEM';
    if (img && img.complete && img.naturalWidth > 0) {
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data; let a = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) a++;
      state = a > 8 ? 'ok' : 'IMAGEM VAZIA';
    }
    iconRes[`${id}:${meta}`] = state;
  }
  root.unmount(); host.remove();
  // ---- 2) malha do bloco ----
  const { buildSectionMesh } = await import('/src/game/mesher.js');
  const { packState } = await import('/src/game/chunk.js');
  const atlas = makeAtlas(); const tiles = atlas.tiles; const err = tiles.error;
  const tint = new Uint8Array(256 * 9); for (let i = 0; i < 256; i++) tint.set([124, 189, 107, 72, 181, 24, 63, 118, 228], i * 9);
  const meshRes = {};
  for (const id of Object.keys(BLOCKS).map(Number)) {
    if (id === 0) continue;
    const b = BLOCKS[id];
    const metas = b.variants && b.model === 'slab' ? b.variants.map((_, m) => m) : [0];
    for (const meta of metas) {
      const st = new Map();
      const put = (x, y, z, s) => st.set(`${x},${y},${z}`, s);
      // o bloco no centro da seção; portas/camas precisam da outra metade
      put(8, 8, 8, packState(id, meta));
      if (b.model === 'door') put(8, 9, 8, packState(id, 8));
      if (b.model === 'bed') put(8, 8, 9, packState(id, 8));
      const get = (x, y, z) => st.get(`${x},${y},${z}`) || 0;
      try {
        const g = buildSectionMesh((x, ly, z) => get(x, ly, z), 0, 0, 0, get, () => ({ block: 0, sky: 15 }), tiles, tint);
        const geo = g.opaque || g.water;
        if (!geo) { meshRes[`${id}:${meta}`] = b.model === 'none' ? 'ok(sem malha)' : 'SEM GEOMETRIA'; continue; }
        let bad = 0; const to = geo.tileOrigins;
        for (let i = 0; i < to.length; i += 2) if (Math.abs(to[i] - err.u0) < 1e-6 && Math.abs(to[i + 1] - err.v0) < 1e-6) bad++;
        meshRes[`${id}:${meta}`] = bad ? `TEXTURA DE ERRO (${bad} vértices)` : 'ok';
      } catch (e) { meshRes[`${id}:${meta}`] = 'ERRO: ' + e.message; }
    }
  }
  // ---- 3) item caído ----
  const { createItemMesh } = await import('/src/game/itemEntity.js');
  const dropRes = {};
  for (const id of [...ids]) { try { const g = createItemMesh({ id, meta: 0 }, 1, atlas); dropRes[id] = g && g.children.length ? 'ok' : 'VAZIO'; } catch (e) { dropRes[id] = 'ERRO: ' + e.message; } }
  return { iconRes, meshRes, dropRes, names: Object.fromEntries(entries.map(e => [`${e.id}:${e.meta}`, (BLOCKS[e.id] || ITEMS[e.id]).name])) };
});
await browser.close();
const bad = (o, ok = (v) => v === 'ok' || v === 'ok(sem malha)') => Object.entries(o).filter(([, v]) => !ok(v)).map(([k, v]) => `${k} ${result.names[k] || ''} → ${v}`);
const rep = {
  total: Object.keys(result.iconRes).length,
  iconesComProblema: bad(result.iconRes),
  malhasComProblema: bad(result.meshRes),
  itensCaidosComProblema: Object.entries(result.dropRes).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} → ${v}`),
  errosPagina: errors.slice(0, 10),
};
// as armas de fogo/peças custom (450-468) não têm arte no pacote 1.8.9: ficam como aviso (caixa colorida), não como falha
const customSemIcone = rep.iconesComProblema.filter(l => { const n = Number(l.split(':')[0]); return n >= 450 && n <= 468; });
rep.iconesComProblema = rep.iconesComProblema.filter(l => !customSemIcone.includes(l));
rep.avisoSemIconeCustom = customSemIcone.length;
fs.writeFileSync(root + '/docs/AUDITORIA-RENDER.json', JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep, null, 1));
process.exit(rep.iconesComProblema.length || rep.malhasComProblema.length || rep.itensCaidosComProblema.length || rep.errosPagina.length ? 1 : 0);
