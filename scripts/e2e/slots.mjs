// Lógica de slots (shift-click, armadura, duplo clique, arrastar) sem navegador
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const S = await server.ssrLoadModule('/src/game/slotOps.js');
  const { createInventory } = await server.ssrLoadModule('/src/game/inventory.js');
  const mk = () => {
    const inv = createInventory();
    const refs = {
      hotbar: inv.hotbar.map((_, i) => S.arrRef(inv.hotbar, i, { group: 'hotbar' })),
      main: inv.main.map((_, i) => S.arrRef(inv.main, i, { group: 'main' })),
      armor: inv.armor.map((_, i) => S.arrRef(inv.armor, i, { group: 'armor', armorSlot: i })),
      grid: inv.crafting.map((_, i) => S.arrRef(inv.crafting, i, { group: 'grid' })),
    };
    return { inv, refs, player: [...refs.hotbar, ...refs.main] };
  };
  // armadura só aceita a peça certa
  {
    const { inv, refs } = mk(); inv.cursor = { id: 1, count: 5, meta: 0 };
    ok(S.leftClick(inv, refs.armor[0]) === false && !inv.armor[0], 'pedra NÃO entra no slot de capacete');
    inv.cursor = { id: 298, count: 1, meta: 0 }; // capacete de couro
    ok(S.leftClick(inv, refs.armor[0]) && inv.armor[0]?.id === 298, 'capacete entra no slot de capacete');
    inv.cursor = { id: 299, count: 1, meta: 0 }; // peitoral no slot do capacete
    ok(S.leftClick(inv, refs.armor[0]) === false && inv.armor[0].id === 298, 'peitoral NÃO troca com o capacete');
  }
  // shift-click: madeira da grade vai para a hotbar; sem espaço, vai para o inventário de cima
  {
    const { inv, refs, player } = mk(); inv.crafting[0] = { id: 5, count: 3, meta: 0 };
    S.shiftMove(inv, refs.grid[0], player);
    ok(inv.hotbar[0]?.id === 5 && inv.hotbar[0].count === 3 && !inv.crafting[0], 'shift na grade de fabricação leva o item para a hotbar');
    for (let i = 0; i < 9; i++) inv.hotbar[i] = { id: 4, count: 64, meta: 0 };
    inv.crafting[1] = { id: 5, count: 2, meta: 0 };
    S.shiftMove(inv, refs.grid[1], player);
    ok(inv.main[0]?.id === 5 && inv.main[0].count === 2, 'hotbar cheia: o item vai para o inventário de cima');
  }
  // shift no resultado: fabrica enquanto couber
  {
    const { inv, player } = mk(); let n = 3;
    const res = { get: () => (n > 0 ? { id: 58, count: 1, meta: 0 } : null), set: () => {}, output: true, repeatable: true, afterTake: () => { n--; } };
    S.shiftMove(inv, res, player);
    ok(n === 0 && inv.hotbar[0]?.id === 58 && inv.hotbar[0].count === 3, 'shift no resultado fabrica 3 vezes e empilha');
  }
  // peça de armadura vai direto para o slot de armadura livre
  {
    const { inv, refs } = mk(); inv.main[0] = { id: 299, count: 1, meta: 0 };
    S.shiftMove(inv, refs.main[0], [...refs.hotbar], (slot) => refs.armor[slot]);
    ok(inv.armor[1]?.id === 299 && !inv.main[0], 'shift em peitoral equipa no slot certo');
  }
  // duplo clique junta tudo
  {
    const { inv, refs, player } = mk(); inv.main[0] = { id: 4, count: 10, meta: 0 }; inv.main[5] = { id: 4, count: 20, meta: 0 }; inv.hotbar[2] = { id: 4, count: 30, meta: 0 };
    S.leftClick(inv, refs.main[0]); S.collectAll(inv, player);
    ok(inv.cursor?.count === 60 && !inv.main[5] && !inv.hotbar[2], 'duplo clique junta todas as pilhas iguais no cursor (60)');
  }
  // arrastar: esquerdo divide, direito põe 1
  {
    const { inv, refs } = mk(); inv.cursor = { id: 4, count: 10, meta: 0 };
    S.applyDrag(inv, [refs.main[0], refs.main[1], refs.main[2]], 0);
    ok(inv.main[0].count === 3 && inv.main[1].count === 3 && inv.main[2].count === 3 && inv.cursor.count === 1, 'arrastar com o esquerdo divide 10 em 3+3+3 e sobra 1');
    inv.cursor = { id: 4, count: 5, meta: 0 };
    S.applyDrag(inv, [refs.main[3], refs.main[4], refs.main[5]], 2);
    ok(inv.main[3].count === 1 && inv.main[4].count === 1 && inv.main[5].count === 1 && inv.cursor.count === 2, 'arrastar com o direito põe 1 em cada');
  }
} catch (e) { out.push('ERRO ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some(l => l.startsWith('FALHA') || l.startsWith('ERRO')) ? 1 : 0);
