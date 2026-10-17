// Flecha: física igual ao 1.8.9 (anda, depois arrasto 0,99 e gravidade 0,05 por tick; velocidade 3 × carga), carga do arco, orientação do modelo
// (a ponta aponta para onde voa) e recolher a flecha cravada (sobrevivência recolhe, criativo só no criativo).
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) { if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); } else r.continue(); });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const r = await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null);
  const { ProjectileManager } = await import('/src/game/projectiles.js');
  const { computeBowCharge, getArrowVelocity } = await import('/src/game/combat.js');
  const { addItem, createInventory } = await import('/src/game/inventory.js');
  const res = {};
  // mundo vazio com chão de pedra em y < 64
  const world = { getBlock: (x, y, z) => (y < 64 ? (1 << 4) : 0) };
  const scene = { add() {}, remove() {} };
  const pm = new ProjectileManager(scene, world);
  // 1) carga: 0 ticks → 0; 10 ticks → (0,25 + 1)/3; 20+ → 1
  res.carga = [computeBowCharge(0), computeBowCharge(10), computeBowCharge(20), computeBowCharge(60)];
  // 2) velocidade inicial: 3 × carga, olhando reto para o sul (z+)
  const v = getArrowVelocity(1, { x: 0, y: 0, z: 1 }, null);
  res.vel0 = Math.hypot(v.x, v.y, v.z);
  // 3) física: dispara horizontal de y = 70 e compara com a recorrência do 1.8.9 em 30 ticks
  const shooter = { id: 's', pos: { x: 0, y: 70 - 1.62, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, nomeJogador: 'T' };
  const p = pm.spawnArrow(shooter, 1, { eye: { x: 0, y: 70, z: 0 }, lookDir: { x: 0, y: 0, z: 1 } });
  p.vel = { x: 0, y: 0, z: 3 };
  let ex = { x: 0, y: 70, z: 0 }, ev = { x: 0, y: 0, z: 3 }, maxErr = 0, ticks = 0;
  for (; ticks < 80 && !p.inGround; ticks++) {
    pm.tick([], null);
    ex = { x: ex.x + ev.x, y: ex.y + ev.y, z: ex.z + ev.z };      // andar
    ev = { x: ev.x * 0.99, y: ev.y * 0.99, z: ev.z * 0.99 };      // arrasto
    ev.y -= 0.05;                                                  // gravidade
    if (!p.inGround) maxErr = Math.max(maxErr, Math.hypot(p.pos.x - ex.x, p.pos.y - ex.y, p.pos.z - ex.z));
  }
  res.fisica = { maxErr, ticks, alcance: +p.pos.z.toFixed(2), caiuEm: p.inGround };
  // 4) orientação: o +z do modelo aponta para onde a flecha vai
  const p2 = pm.spawnArrow(shooter, 1, { eye: { x: 0, y: 80, z: 0 }, lookDir: { x: 0.6, y: 0.3, z: 0.74 } });
  p2.vel = { x: 1.2, y: 0.6, z: 1.5 };
  pm.tick([], null);
  const m = p2.mesh; m.updateMatrixWorld(true);
  const fwd = new m.position.constructor(0, 0, 1).transformDirection(m.matrixWorld);
  const dir = new m.position.constructor(p2.vel.x, p2.vel.y, p2.vel.z).normalize();
  res.orient = +fwd.dot(dir).toFixed(4);
  // a ponta (maior z da geometria) fica à frente e a placa de penas atrás
  const pos = m.children[0].geometry.attributes.position; let zmin = 1e9, zmax = -1e9;
  for (let i = 0; i < pos.count; i++) { zmin = Math.min(zmin, pos.getZ(i)); zmax = Math.max(zmax, pos.getZ(i)); }
  res.geo = { zmin: +zmin.toFixed(3), zmax: +zmax.toFixed(3) };
  // 5) recolher: flecha cravada ao lado do jogador
  const inv = createInventory();
  let given = 0;
  pm.onPickup = (pr, probe) => { if (probe) return true; given++; return true; };
  const pl = { pos: { x: 10, y: 64, z: 10 }, isDead: false, gameMode: 'survival', vel: { x: 0, y: 0, z: 0 } };
  const p3 = pm.spawn('arrow', { pos: { x: 10.4, y: 64.5, z: 10 }, vel: { x: 0, y: 0, z: 0 }, shooterId: 'pl' });
  p3.inGround = true;
  let ticksPick = -1;
  for (let t = 0; t < 30; t++) { pm.tick([], pl); if (pm.projectiles.indexOf(p3) < 0) { ticksPick = t + 1; break; } }
  res.pickup = { ticksPick, given };
  void inv; void addItem; void THREE;
  return res;
});
ok(Math.abs(r.carga[0]) < 1e-9 && Math.abs(r.carga[1] - (0.25 + 1) / 3) < 1e-6 && r.carga[2] === 1 && r.carga[3] === 1, `carga do arco: ${r.carga.map((x) => x.toFixed(3)).join(' / ')} (0 / 0,417 / 1 / 1)`);
ok(Math.abs(r.vel0 - 3) < 0.02, `velocidade inicial da flecha na carga máxima: ${r.vel0.toFixed(3)} blocos/tick (vanilla 3,0)`);
ok(r.fisica.maxErr < 1e-9 && r.fisica.caiuEm, `trajetória igual à recorrência do 1.8.9 (erro máx ${r.fisica.maxErr}), tiro reto de 70 de altura cai a ${r.fisica.alcance} blocos em ${r.fisica.ticks} ticks`);
ok(r.orient > 0.999, `o modelo da flecha aponta para onde ela voa (cos = ${r.orient})`);
ok(r.geo.zmax > 0 && r.geo.zmin < -0.5 && Math.abs(r.geo.zmax - 0.225) < 0.01, `geometria: ponta em +${r.geo.zmax}, penas em ${r.geo.zmin} (vanilla +0,225 / −0,675)`);
ok(r.pickup.given === 1 && r.pickup.ticksPick > 0 && r.pickup.ticksPick <= 14, `flecha cravada perto do jogador voa até ele e é recolhida (${r.pickup.ticksPick} ticks, ${r.pickup.given} item)`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
