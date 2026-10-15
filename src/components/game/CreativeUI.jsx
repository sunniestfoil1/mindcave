import React, { useState, useEffect, useMemo, useRef } from "react";
import ItemSlot from "./ItemSlot";
import { ITEMS } from "@/game/items";
import { BLOCKS } from "@/game/blocks";
import { FOODS } from "@/game/survival";
import { leftClick, rightClick, addItem } from "@/game/inventory";
import { playClickSound } from "@/game/sounds";
import ItemTooltip from "./ItemTooltip";
import PlayerPreview, { PREVIEW_CREATIVE } from "./PlayerPreview";
import { Sprite, McText, usePackTexture, useGuiScaleValue } from "./GuiSprite";
import { settingsStore } from "@/game/settingsStore";

const ARMOR_GHOST = [
  'textures/items/empty_armor_slot_helmet.png',
  'textures/items/empty_armor_slot_chestplate.png',
  'textures/items/empty_armor_slot_leggings.png',
  'textures/items/empty_armor_slot_boots.png',
];

function ArmorGhostIcon({ path, S }) {
  const url = usePackTexture(path);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: 16 * S,
        height: 16 * S,
        imageRendering: 'pixelated',
        pointerEvents: 'none',
        opacity: 0.5,
      }}
    />
  );
}

const REDSTONE_IDS = new Set([
  46, 55, 69, 70, 72, 75, 76, 77, 93, 94, 123, 124, 149, 150, 151, 152, 154, 331, 356, 404,
]);
const DECOR_IDS = new Set([
  6, 18, 19, 30, 31, 32, 37, 38, 39, 40, 47, 50, 51, 54, 58, 61, 62, 65, 81, 83, 86, 89, 91, 99, 100, 103, 106, 111, 116, 117, 130, 145, 161, 171, 175, 321, 323, 355, 389, 390,
]);
const TRANSPORT_IDS = new Set([27, 28, 66, 157, 328, 333, 342, 343, 407, 408]);
const FOOD_IDS = new Set([
  260, 282, 297, 319, 320, 322, 349, 350, 357, 360, 363, 364, 365, 366, 367, 375, 391, 392, 393, 396, 400, 411, 412, 413, 423, 424,
]);
const TOOL_IDS = new Set([
  256, 257, 258, 259, 269, 270, 271, 273, 274, 275, 277, 278, 279, 284, 285, 286, 290, 291, 292, 293, 294, 346, 347, 359,
]);
const COMBAT_IDS = new Set([
  261, 262, 267, 268, 272, 276, 283, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317,
]);
const MATERIAL_IDS = new Set([
  263, 264, 265, 266, 318, 334, 336, 337, 339, 340, 341, 348, 351, 352, 353, 370, 371, 372, 377, 378, 388, 399,
]);

const TOP_TABS = [
  { id: 'building', name: 'Blocos de Construção', item: { id: 45, count: 1 } },
  { id: 'decor', name: 'Blocos Decorativos', item: { id: 38, count: 1 } },
  { id: 'redstone', name: 'Redstone', item: { id: 331, count: 1 } },
  { id: 'transport', name: 'Transporte', item: { id: 27, count: 1 } },
  { id: 'misc', name: 'Diversos', item: { id: 327, count: 1 } },
  { id: 'search', name: 'Buscar Itens', item: { id: 345, count: 1 } },
];

const BOTTOM_TABS = [
  { id: 'food', name: 'Alimentos', item: { id: 260, count: 1 } },
  { id: 'tools', name: 'Ferramentas', item: { id: 257, count: 1 } },
  { id: 'combat', name: 'Combate', item: { id: 276, count: 1 } },
  { id: 'materials', name: 'Materiais', item: { id: 264, count: 1 } },
  { id: 'technology', name: 'Tecnologia', item: { id: 450, count: 1 } },
  { id: 'survival', name: 'Inventário de Sobrevivência', item: { id: 54, count: 1 } },
];

function getItemCategories(id, isBlock, def) {
  const cats = new Set();
  if (REDSTONE_IDS.has(id) || def?.category === 'redstone') cats.add('redstone');
  if (TRANSPORT_IDS.has(id) || def?.category === 'transport') cats.add('transport');
  if (FOOD_IDS.has(id) || FOODS[id] || def?.food) cats.add('food');
  if (TOOL_IDS.has(id) || def?.tool) cats.add('tools');
  if (COMBAT_IDS.has(id) || def?.weapon || def?.armor) cats.add('combat');
  if (MATERIAL_IDS.has(id) || def?.category === 'materials') cats.add('materials');
  if (def?.gun || def?.accessory || (id >= 450 && id <= 468)) {
    cats.add('technology');
    cats.add('combat');
  }
  if (DECOR_IDS.has(id) || def?.category === 'decor' || (isBlock && (id === 18 || id === 19 || id === 35 || id === 47))) {
    cats.add('decor');
  }
  if (isBlock) {
    if (!DECOR_IDS.has(id) && !REDSTONE_IDS.has(id) && !TRANSPORT_IDS.has(id)) {
      cats.add('building');
    }
  }
  if (cats.size === 0) cats.add('misc');
  return Array.from(cats);
}

const WIN = { w: 195, h: 136 };
const SCROLL = { x: 175, y: 18, w: 12, h: 112 };
const TAB_FILES = {
  items: 'textures/gui/container/creative_inventory/tab_items.png',
  search: 'textures/gui/container/creative_inventory/tab_item_search.png',
  inventory: 'textures/gui/container/creative_inventory/tab_inventory.png',
  tabs: 'textures/gui/container/creative_inventory/tabs.png',
};

function tabRect(col, top) {
  const x = col === 5 ? WIN.w - 28 * (6 - col) + 2 : 28 * col + (col > 0 ? col : 0);
  return { x, y: top ? -28 : WIN.h - 4 };
}

export default function CreativeUI({ inv, onUpdate, onClose }) {
  const S = useGuiScaleValue();
  const [tab, setTab] = useState('building');
  const [search, setSearch] = useState('');
  const [scroll, setScroll] = useState(0);
  const [, forceUpdate] = useState(0);
  const refresh = () => {
    forceUpdate((n) => n + 1);
    onUpdate?.();
  };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState(null);
  const hoveredTargetRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef(null);

  const texItems = usePackTexture(TAB_FILES.items);
  const texSearch = usePackTexture(TAB_FILES.search);
  const texInventory = usePackTexture(TAB_FILES.inventory);
  const texTabs = usePackTexture(TAB_FILES.tabs);

  useEffect(() => {
    const handleMouse = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);

    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          onClose();
        }
        return;
      }
      const invKey = settingsStore.get('user.keys.inventory') || 'KeyE';
      if (
        e.key === 'Escape' ||
        e.code === invKey ||
        (invKey.startsWith('Key') && e.key.toLowerCase() === invKey.slice(3).toLowerCase())
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
        return;
      }

      // Atalho 1-9 (1.8.9): envia o item do catálogo sob o mouse direto para o slot correspondente da hotbar
      const num = parseInt(e.key, 10);
      const target = hoveredTargetRef.current;
      if (num >= 1 && num <= 9 && target && inv?.hotbar) {
        e.preventDefault();
        e.stopPropagation();
        const hbIndex = num - 1;
        if (target.kind === 'catalog' && target.item) {
          inv.hotbar[hbIndex] = {
            id: target.item.id,
            count: target.item.maxStack || 64,
            meta: target.item.meta || 0,
          };
          refresh();
        } else if (target.kind === 'slot' && target.arr) {
          const tmp = inv.hotbar[hbIndex];
          inv.hotbar[hbIndex] = target.arr[target.index];
          target.arr[target.index] = tmp;
          refresh();
        }
      }
    };

    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [onClose, inv]);

  const allItems = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const id in BLOCKS) {
      const numId = parseInt(id, 10);
      const b = BLOCKS[id];
      if (numId === 0 || !b) continue;
      if (b.singleId || b.hiddenInCreative) continue;
      if (b.variants && b.model === 'slab' && Array.isArray(b.variants)) {
        b.variants.forEach((_, meta) => {
          if (numId === 44 && meta === 2) return;
          const key = `b_${numId}_${meta}`;
          if (seen.has(key)) return;
          seen.add(key);
          const vName = (Array.isArray(b.variantNames) && b.variantNames[meta]) || b.namePt || b.name;
          list.push({
            id: numId,
            meta,
            name: vName,
            nameEn: b.name,
            isBlock: true,
            categories: getItemCategories(numId, true, b),
            maxStack: 64,
            block: b,
          });
        });
        continue;
      }
      const key = `b_${numId}_0`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: numId,
        name: b.namePt || b.name,
        nameEn: b.name,
        isBlock: true,
        categories: getItemCategories(numId, true, b),
        maxStack: 64,
        block: b,
      });
    }
    for (const id in ITEMS) {
      const numId = parseInt(id, 10);
      const it = ITEMS[id];
      if (!it) continue;
      const key = `i_${numId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: numId,
        name: it.namePt || it.name,
        nameEn: it.name,
        isBlock: false,
        categories: getItemCategories(numId, false, it),
        maxStack: it.maxStack || 64,
        item: it,
      });
    }
    return list;
  }, []);

  const filteredItems = useMemo(() => {
    if (tab === 'search') {
      if (!search.trim()) return allItems;
      const q = search.toLowerCase().trim();
      return allItems.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.nameEn.toLowerCase().includes(q) ||
          i.id.toString().includes(q)
      );
    }
    if (tab === 'survival') return [];
    return allItems.filter((i) => i.categories.includes(tab));
  }, [allItems, tab, search]);

  const totalRows = Math.ceil(filteredItems.length / 9);
  const maxScroll = Math.max(0, totalRows - 5);
  const pageItems = filteredItems.slice(scroll * 9, scroll * 9 + 45);

  const handleWheel = (e) => {
    if (maxScroll <= 0 || tab === 'survival') return;
    if (e.deltaY > 0) setScroll((s) => Math.min(maxScroll, s + 1));
    else if (e.deltaY < 0) setScroll((s) => Math.max(0, s - 1));
  };

  const pickItem = (itemData, isShift, isRight = false) => {
    const max = itemData.maxStack || 64;
    if (isShift) {
      addItem(inv, { id: itemData.id, count: max, meta: itemData.meta || 0 });
      refresh();
      return;
    }
    inv.cursor = { id: itemData.id, count: isRight ? 1 : max, meta: itemData.meta || 0 };
    refresh();
  };

  const slotAction = (arr, index, isLeft) => {
    const getSlot = () => arr[index];
    const setSlot = (val) => {
      arr[index] = val;
    };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const selectTab = (id) => {
    playClickSound();
    setTab(id);
    setScroll(0);
  };

  const scrollFromPointer = (clientY) => {
    if (maxScroll <= 0 || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const rel = (clientY - rect.top) / S - SCROLL.y - 7.5;
    setScroll(Math.max(0, Math.min(maxScroll, Math.round((rel / (SCROLL.h - 17)) * maxScroll))));
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const move = (e) => scrollFromPointer(e.clientY);
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  });

  const winTex = tab === 'search' ? texSearch : tab === 'survival' ? texInventory : texItems;
  const currentTabName = [...TOP_TABS, ...BOTTOM_TABS].find((t) => t.id === tab)?.name || 'Itens';
  const left = Math.max(0, Math.floor((window.innerWidth - WIN.w * S) / 2));
  const top = Math.max(0, Math.floor((window.innerHeight - WIN.h * S) / 2));

  const slot = (key, x, y, item, props = {}) => {
    const { ghost, hoverTarget, ...rest } = props;
    return (
      <div
        key={key}
        style={{ position: 'absolute', left: x * S, top: y * S, width: 16 * S, height: 16 * S }}
        onMouseEnter={() => {
          hoveredTargetRef.current = hoverTarget || null;
        }}
        onMouseLeave={() => {
          if (hoveredTargetRef.current === hoverTarget) hoveredTargetRef.current = null;
        }}
      >
        {!item && ghost && <ArmorGhostIcon path={ghost} S={S} />}
        <ItemSlot item={item} size={16 * S} transparent fill guiScale={S} onHover={(it) => setHoveredItem(it)} {...rest} />
      </div>
    );
  };

  const renderTab = (t, col, isTop) => {
    const sel = tab === t.id;
    const { x, y } = tabRect(col, isTop);
    const v = isTop ? (sel ? 32 : 0) : sel ? 96 : 64;
    return (
      <Sprite
        key={t.id}
        url={texTabs}
        u={28 * col}
        v={v}
        w={28}
        h={32}
        S={S}
        x={x}
        y={y}
        z={sel ? 3 : 1}
        title={t.name}
        onClick={() => selectTab(t.id)}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{
            position: 'absolute',
            left: 6 * S,
            top: (8 + (isTop ? 1 : -1)) * S,
            width: 16 * S,
            height: 16 * S,
            pointerEvents: 'none',
          }}
        >
          <ItemSlot item={t.item} size={16 * S} transparent fill guiScale={S} />
        </div>
      </Sprite>
    );
  };

  const handleDestroySlot = (e) => {
    if (!inv) return;
    if (e.shiftKey) {
      // Shift + Clique no X do Criativo 1.8.9 limpa todo o inventário
      if (Array.isArray(inv.main)) inv.main.fill(null);
      if (Array.isArray(inv.hotbar)) inv.hotbar.fill(null);
      if (Array.isArray(inv.armor)) inv.armor.fill(null);
      inv.cursor = null;
      refresh();
      return;
    }
    if (inv.cursor) {
      inv.cursor = null;
      refresh();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.65)', imageRendering: 'pixelated', userSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={handleWheel}
    >
      <div
        ref={rootRef}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{ position: 'absolute', left, top, width: WIN.w * S, height: WIN.h * S, userSelect: 'none' }}
      >
        {TOP_TABS.map((t, i) => renderTab(t, i, true))}
        {BOTTOM_TABS.map((t, i) => renderTab(t, i, false))}
        <Sprite url={winTex} u={0} v={0} w={WIN.w} h={WIN.h} S={S} z={2} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
          {tab === 'search' ? (
            <input
              type="text"
              autoFocus
              placeholder="Buscar..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setScroll(0);
              }}
              style={{
                position: 'absolute',
                left: 82 * S,
                top: 6 * S,
                width: 89 * S,
                height: 12 * S,
                padding: `0 ${2 * S}px`,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFFFFF',
                fontFamily: "'Minecraft', monospace",
                fontSize: 8 * S,
                lineHeight: `${12 * S}px`,
              }}
            />
          ) : null}
          <McText text={tab === 'search' ? 'Buscar Itens' : currentTabName} x={8} y={6} S={S} />

          {tab === 'survival' ? (
            <>
              <PlayerPreview S={S} preset={PREVIEW_CREATIVE} />
              {(Array.isArray(inv?.armor) ? inv.armor : new Array(4).fill(null)).map((item, i) =>
                slot('a' + i, 9 + Math.floor(i / 2) * 54, 6 + (i % 2) * 27, item, {
                  ghost: ARMOR_GHOST[i],
                  hoverTarget: { kind: 'slot', arr: inv?.armor, index: i },
                  onClick: () => inv?.armor && slotAction(inv.armor, i, true),
                  onRightClick: () => inv?.armor && slotAction(inv.armor, i, false),
                })
              )}
              {(Array.isArray(inv?.main) ? inv.main : new Array(27).fill(null)).map((item, i) =>
                slot('m' + i, 9 + (i % 9) * 18, 54 + Math.floor(i / 9) * 18, item, {
                  hoverTarget: { kind: 'slot', arr: inv?.main, index: i },
                  onClick: () => inv?.main && slotAction(inv.main, i, true),
                  onRightClick: () => inv?.main && slotAction(inv.main, i, false),
                })
              )}
              <div
                title="Destruir Item (Shift+Clique limpa o inventário)"
                onClick={handleDestroySlot}
                style={{
                  position: 'absolute',
                  left: 173 * S,
                  top: 112 * S,
                  width: 16 * S,
                  height: 16 * S,
                  cursor: 'pointer',
                }}
              />
            </>
          ) : (
            Array.from({ length: 45 }).map((_, idx) => {
              const itemData = pageItems[idx];
              return slot('g' + idx, 9 + (idx % 9) * 18, 18 + Math.floor(idx / 9) * 18, itemData, {
                hoverTarget: itemData ? { kind: 'catalog', item: itemData } : null,
                onClick: () => itemData && inv && pickItem(itemData, false, false),
                onRightClick: () => itemData && inv && pickItem(itemData, false, true),
                onShiftClick: () => itemData && inv && pickItem(itemData, true, false),
              });
            })
          )}

          {(Array.isArray(inv?.hotbar) ? inv.hotbar : new Array(9).fill(null)).map((item, i) =>
            slot('h' + i, 9 + i * 18, 112, item, {
              hoverTarget: { kind: 'slot', arr: inv?.hotbar, index: i },
              onClick: () => inv?.hotbar && slotAction(inv.hotbar, i, true),
              onRightClick: () => inv?.hotbar && slotAction(inv.hotbar, i, false),
              onShiftClick: () => inv?.hotbar && slotAction(inv.hotbar, i, true),
            })
          )}

          {tab !== 'survival' && (
            <div
              onMouseDown={(e) => {
                if (maxScroll > 0) {
                  setDragging(true);
                  scrollFromPointer(e.clientY);
                }
              }}
              style={{
                position: 'absolute',
                left: SCROLL.x * S,
                top: SCROLL.y * S,
                width: SCROLL.w * S,
                height: SCROLL.h * S,
                cursor: maxScroll > 0 ? 'pointer' : 'default',
              }}
            >
              <Sprite
                url={texTabs}
                u={maxScroll > 0 ? 232 : 244}
                v={0}
                w={12}
                h={15}
                S={S}
                y={maxScroll > 0 ? Math.round((SCROLL.h - 17) * (scroll / maxScroll)) : 0}
              />
            </div>
          )}
        </div>
      </div>

      {hoveredItem && !inv?.cursor && <ItemTooltip item={hoveredItem} mousePos={mouse} />}

      {inv?.cursor && (
        <div
          className="fixed pointer-events-none z-[120]"
          style={{ left: mouse.x - 8 * S, top: mouse.y - 8 * S, width: 16 * S, height: 16 * S }}
        >
          <ItemSlot item={inv.cursor} size={16 * S} transparent fill guiScale={S} />
        </div>
      )}
    </div>
  );
}
