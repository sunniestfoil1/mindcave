import React, { useState, useEffect, useMemo } from "react";
import { ITEMS, ITEM_NAMES, itemColor, CREATIVE_TABS } from "@/game/items";
import { BLOCKS } from "@/game/blocks";

export default function CreativeUI({ inv, onUpdate, onClose }) {
  const [tab, setTab] = useState('search');
  const [search, setSearch] = useState('');
  const [scroll, setScroll] = useState(0);
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    const kh = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        return;
      }
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', kh);
    return () => { window.removeEventListener('mousemove', h); window.removeEventListener('keydown', kh); };
  }, [onClose]);

  // Constrói a lista de itens por categoria
  const allItems = useMemo(() => {
    const items = [];
    // Blocos
    for (const id in BLOCKS) {
      const b = BLOCKS[id];
      if (b.id === 0) continue;
      items.push({ id: parseInt(id), name: b.namePt, nameEn: b.name, category: 'building', color: b.id });
    }
    // Itens
    for (const id in ITEMS) {
      const item = ITEMS[id];
      items.push({ id: parseInt(id), name: item.namePt, nameEn: item.name, category: item.category || 'misc', color: item.color });
    }
    return items;
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'search') {
      if (!search.trim()) return allItems;
      const q = search.toLowerCase().trim();
      return allItems.filter(i => i.name.toLowerCase().includes(q) || i.nameEn.toLowerCase().includes(q));
    }
    return allItems.filter(i => i.category === tab);
  }, [allItems, tab, search]);

  const pageSize = 45; // 5x9
  const maxScroll = Math.max(0, Math.ceil(filtered.length / 9) - 5);
  const pageItems = filtered.slice(scroll * 9, scroll * 9 + pageSize);

  const pickItem = (item, isShift) => {
    inv.cursor = { id: item.id, count: isShift ? 64 : 1, meta: 0 };
    refresh();
  };

  const placeBack = () => {
    if (inv.cursor) { inv.cursor = null; refresh(); }
  };

  const sz = 38;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-stone-800 border-2 border-stone-900 rounded-lg p-4 shadow-2xl" style={{ fontFamily: "monospace", width: 420 }}>
        <div className="text-white/80 text-sm mb-2 text-center">Inventário Criativo</div>

        {/* Abas */}
        <div className="flex flex-wrap gap-1 mb-3">
          {CREATIVE_TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setScroll(0); }}
              className={"px-2 py-1 text-xs rounded " + (tab === t.id ? "bg-stone-600 text-white" : "bg-stone-700 text-white/60 hover:bg-stone-600")}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Busca */}
        {tab === 'search' && (
          <input value={search} onChange={(e) => { setSearch(e.target.value); setScroll(0); }}
            placeholder="Pesquisar..."
            className="w-full mb-2 px-2 py-1 bg-stone-900 text-white text-sm rounded border border-stone-600" />
        )}

        {/* Grade de itens 5x9 */}
        <div className="relative">
          <div className="grid grid-cols-9 gap-1 mb-2 min-h-[200px]">
            {pageItems.map((item, i) => (
              <div key={i} onClick={(e) => pickItem(item, e.shiftKey)}
                className="flex items-center justify-center rounded-sm border border-black/40 cursor-pointer hover:bg-white/20"
                style={{ width: sz, height: sz, background: '#' + (item.color || 0x888888).toString(16).padStart(6, '0') }}
                title={item.name}>
              </div>
            ))}
            {/* Preenche vazios */}
            {Array.from({ length: pageSize - pageItems.length }).map((_, i) => (
              <div key={`e${i}`} className="rounded-sm border border-black/20" style={{ width: sz, height: sz, background: 'rgba(139,139,139,0.1)' }} />
            ))}
          </div>
          {/* Scroll */}
          {maxScroll > 0 && (
            <div className="absolute right-[-20px] top-0 bottom-0 w-3 bg-stone-700 rounded-full overflow-hidden">
              <div className="absolute w-full bg-stone-400 rounded-full" style={{ height: `${(5 / (maxScroll + 5)) * 100}%`, top: `${(scroll / maxScroll) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Botões de scroll */}
        <div className="flex justify-between mb-2">
          <button onClick={() => setScroll(Math.max(0, scroll - 1))} disabled={scroll === 0} className="px-2 py-0.5 text-xs bg-stone-700 text-white rounded disabled:opacity-30">▲</button>
          <button onClick={() => setScroll(Math.min(maxScroll, scroll + 1))} disabled={scroll >= maxScroll} className="px-2 py-0.5 text-xs bg-stone-700 text-white rounded disabled:opacity-30">▼</button>
        </div>

        {/* Hotbar */}
        <div className="grid grid-cols-9 gap-1 pt-2 border-t border-stone-700">
          {inv.hotbar.map((item, i) => (
            <div key={i} onClick={placeBack}
              className="flex items-center justify-center rounded-sm border border-black/40 cursor-pointer hover:bg-white/20"
              style={{ width: sz, height: sz, background: item ? itemColor(item.id) : 'rgba(139,139,139,0.1)' }}>
              {item && item.count > 1 && (
                <span className="absolute bottom-0 right-0.5 text-xs text-white font-bold" style={{ textShadow: "1px 1px 1px black" }}>{item.count}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {inv.cursor && (
        <div className="fixed pointer-events-none z-50" style={{ left: mouse.x - 16, top: mouse.y - 16 }}>
          <div className="w-8 h-8 rounded-sm border border-black/40" style={{ background: itemColor(inv.cursor.id) }}>
            {inv.cursor.count > 1 && <span className="absolute bottom-0 right-0.5 text-xs text-white font-bold" style={{ textShadow: "1px 1px 1px black" }}>{inv.cursor.count}</span>}
          </div>
        </div>
      )}
    </div>
  );
}