// Animação de andar do 1.8.9 (ModelBiped + limbSwing): a fase anda com a distância percorrida e a amplitude sobe/desce suave; parado, as pernas
// ficam retas e só os braços balançam de leve. Lógica pura (sem navegador): simula ticks de movimento e lê os ângulos do modelo.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const A = await server.ssrLoadModule('/src/game/animation.js');
  const rot = () => ({ rotation: { x: 0, y: 0, z: 0, set() {} }, position: { x: 0, y: 0, z: 0 } });
  const model = { rotation: { x: 0, y: 0, z: 0 }, userData: { armL: rot(), armR: rot(), legL: rot(), legR: rot(), head: rot(), body: rot() } };
  const u = model.userData;
  const anim = A.createAnimationState();
  const player = { pos: { x: 0, y: 64, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, sneaking: false, sprinting: false, isDead: false };
  const run = (perTick, ticks, sprint = false) => {
    const legs = [], arms = [];
    for (let i = 0; i < ticks; i++) {
      player.pos.z += perTick; player.vel.z = perTick; player.sprinting = sprint;
      A.tickAnimation(anim, player, i);
      A.applyThirdPersonPose(model, anim, player, i, 0);
      legs.push(u.legR.rotation.x); arms.push(u.armL.rotation.x);
    }
    return { legs, arms };
  };
  const mx = (a) => Math.max(...a.map(Math.abs));
  // parado
  run(0, 30);
  ok(Math.abs(u.legR.rotation.x) < 1e-6 && Math.abs(u.legL.rotation.x) < 1e-6, 'parado: as pernas ficam retas');
  ok(Math.abs(u.armR.rotation.x) <= 0.051, `parado: os braços só balançam de leve (${u.armR.rotation.x.toFixed(3)} rad, máx 0,05)`);
  // andando 4,317 blocos/s = 0,2159/tick
  const w = run(4.317 / 20, 80);
  const tail = w.legs.slice(40);
  ok(Math.abs(mx(tail) - 1.4 * Math.min(1, 4.317 / 20 * 4)) < 0.05, `andando: a perna balança até ±${mx(tail).toFixed(2)} rad (vanilla 1,4 × 0,863 = 1,21)`);
  // período: cruzamentos por zero da perna
  let cross = 0; for (let i = 1; i < tail.length; i++) if ((tail[i - 1] < 0) !== (tail[i] < 0)) cross++;
  const expected = (40 * 0.863 * 0.6662) / Math.PI;
  ok(Math.abs(cross - expected) <= 1.5, `andando: ${cross} trocas de perna em 40 ticks (vanilla ≈ ${expected.toFixed(1)}: a fase anda com a distância)`);
  // perna e braço opostos: a perna direita e o braço esquerdo balançam juntos
  let same = 0; for (let i = 0; i < tail.length; i++) if (Math.sign(w.legs.slice(40)[i]) === Math.sign(w.arms.slice(40)[i])) same++;
  ok(same > tail.length * 0.9, `braço esquerdo acompanha a perna direita (${same}/${tail.length} ticks com o mesmo sinal)`);
  // correndo: amplitude máxima 1,4
  const r = run(5.612 / 20, 60, true);
  ok(Math.abs(mx(r.legs.slice(30)) - 1.4) < 0.05, `correndo: perna até ±${mx(r.legs.slice(30)).toFixed(2)} rad (vanilla 1,4)`);
  // volta a parar: a amplitude cai suave (não corta de uma vez) e zera
  const st = run(0, 1); const first = Math.abs(st.legs[0]);
  const st2 = run(0, 40);
  ok(first > 0.3 && mx(st2.legs.slice(20)) < 0.01, `ao parar a amplitude cai suave (1º tick ${first.toFixed(2)} rad) e zera`);
  // a cabeça não balança ao andar
  ok(Math.abs(u.head.rotation.y) < 1e-9, 'a cabeça não balança de lado ao andar (o 1.8.9 só gira com o olhar)');
} catch (e) { out.push('FALHA erro: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
