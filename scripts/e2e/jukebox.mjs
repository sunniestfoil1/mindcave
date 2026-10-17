// Jukebox e rádio: todo disco tem arquivo de áudio, item registrado, meta única e faixa no rádio; o barramento do rádio só libera quando o último
// motivo sai; o disco que entra no jukebox é o que o item diz. Lógica pura (Node); o fluxo com o motor roda em interacoes.mjs.
import { pathToFileURL } from 'url';
import fs from 'fs';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const { DISCS, discMetaForItem } = await server.ssrLoadModule('/src/game/jukebox.js');
  const { radioBus } = await server.ssrLoadModule('/src/game/radioBus.js');
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
  const radioSrc = fs.readFileSync(root + '/src/components/game/RadioWidget.jsx', 'utf8');

  const discs = DISCS.slice(1);
  ok(DISCS[0] === null && discs.length === 15, `15 discos (meta 1–15), meta 0 = jukebox vazio (${discs.length})`);
  const missingFile = discs.filter((d) => !fs.existsSync(`${root}/public/assets/sounds/records/${d.file}.ogg`));
  ok(missingFile.length === 0, `todo disco tem o .ogg na pasta de áudio (faltando: ${missingFile.map((d) => d.file).join(',') || 'nenhum'})`);
  const missingItem = discs.filter((d) => !ITEMS[d.item]);
  ok(missingItem.length === 0, `todo disco tem o item registrado (faltando: ${missingItem.map((d) => d.item).join(',') || 'nenhum'})`);
  ok(new Set(discs.map((d) => d.item)).size === 15 && new Set(discs.map((d) => d.file)).size === 15, 'itens e arquivos dos discos são todos diferentes');
  ok(discs.every((d, i) => discMetaForItem(d.item) === i + 1), 'o item do disco vira a meta certa do jukebox (ida e volta)');
  ok(discMetaForItem(1) === 0 && discMetaForItem(0) === 0 && discMetaForItem(undefined) === 0, 'item que não é disco não entra no jukebox');
  const missingRadio = discs.filter((d) => !radioSrc.includes(`/assets/sounds/records/${d.file}.ogg`));
  ok(missingRadio.length === 0, `toda faixa de disco também está no rádio (faltando: ${missingRadio.map((d) => d.file).join(',') || 'nenhuma'})`);

  // barramento: dois motivos seguram o rádio abafado; só o último release libera
  radioBus.reset();
  const log = [];
  const off = radioBus.subscribe((d) => log.push(d));
  radioBus.duck('a'); radioBus.duck('b'); radioBus.release('a');
  ok(radioBus.isDucked() && log.join() === 'false,true', 'com dois motivos, soltar um só mantém o rádio abafado');
  radioBus.release('b'); radioBus.release('b');
  ok(!radioBus.isDucked() && log.join() === 'false,true,false', 'soltar o último volta o rádio; soltar de novo não repete o aviso');
  off(); radioBus.duck('c'); ok(log.length === 3, 'quem cancelou a inscrição não é avisado mais'); radioBus.reset();
} catch (e) { ok(false, 'exceção: ' + (e.stack || e)); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
