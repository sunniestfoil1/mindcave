import React, { useState, useEffect, useMemo, useRef } from "react";
import ItemSlot from "./ItemSlot";
import { ITEMS, itemColor, TOOL_MATERIALS, ARMOR_MATERIALS } from "@/game/items";
import { BLOCKS } from "@/game/blocks";
import { GUNS, ACCESSORIES, AMMO_TYPES } from "@/game/guns/registry";
import { FOODS } from "@/game/survival";
import { leftClick, rightClick, shiftClick, addItem } from "@/game/inventory";
import { getPackUrl, MC } from "@/game/pack";
import { playClickSound } from "@/game/sounds";

// Categorização rica e abrangente para todos os blocos e itens do jogo
const REDSTONE_IDS = new Set([
  46, 55, 69, 70, 72, 75, 76, 77, 93, 94, 123, 124, 149, 150, 151, 152, 154, 331, 356, 404
]);

const DECOR_IDS = new Set([
  6, 18, 19, 30, 31, 32, 37, 38, 39, 40, 47, 50, 51, 54, 58, 61, 62, 65, 81, 83, 86, 89, 91, 99, 100, 103, 106, 111, 116, 117, 130, 143, 145, 161, 171, 175, 321, 323, 355, 389, 390
]);

const TRANSPORT_IDS = new Set([
  27, 28, 66, 157, 328, 333, 342, 343, 407, 408
]);

const FOOD_IDS = new Set([
  260, 282, 297, 319, 320, 322, 349, 350, 354, 357, 360, 363, 364, 365, 366, 367, 375, 391, 392, 393, 396, 400, 411, 412, 413, 423, 424
]);

const TOOL_IDS = new Set([
  256, 257, 258, 259, 269, 270, 271, 273, 274, 275, 277, 278, 279, 284, 285, 286, 290, 291, 292, 293, 294, 346, 347, 359
]);

const COMBAT_IDS = new Set([
  261, 262, 267, 268, 272, 276, 283, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317
]);

const MATERIAL_IDS = new Set([
  263, 264, 265, 266, 318, 334, 336, 337, 341, 348, 351, 352, 353, 370, 371, 372, 377, 378, 388, 399
]);

// Abas autênticas do Minecraft Java com os ícones de blocos/itens reais
const TOP_TABS = [
  { id: 'building', name: 'Construção', item: { id: 45, count: 1 } },
  { id: 'decor', name: 'Decoração', item: { id: 38, count: 1 } },
  { id: 'redstone', name: 'Redstone', item: { id: 331, count: 1 } },
  { id: 'transport', name: 'Transporte', item: { id: 27, count: 1 } },
  { id: 'misc', name: 'Diversos', item: { id: 327, count: 1 } },
  { id: 'search', name: 'Pesquisar', item: { id: 345, count: 1 } },
];

const BOTTOM_TABS = [
  { id: 'food', name: 'Comidas', item: { id: 260, count: 1 } },
  { id: 'tools', name: 'Ferramentas', item: { id: 257, count: 1 } },
  { id: 'combat', name: 'Combate', item: { id: 276, count: 1 } },
  { id: 'materials', name: 'Materiais', item: { id: 264, count: 1 } },
  { id: 'technology', name: 'Tecnologia', item: { id: 450, count: 1 } },
  { id: 'survival', name: 'Inventário', item: { id: 54, count: 1 } },
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

// Tooltip oficial Java 1.8.9 com cores e raridades
function MinecraftTooltip({ item, mousePos }) {
  if (!item || !item.id) return null;

  const isBlock = item.id < 256;
  const blockDef = isBlock ? BLOCKS[item.id] : null;
  const itemDef = !isBlock ? ITEMS[item.id] : null;

  const namePt = item.name || blockDef?.namePt || itemDef?.namePt || `Item #${item.id}`;
  const nameEn = item.nameEn || blockDef?.name || itemDef?.name || '';
  const rarity = itemDef?.rarity || (item.id === 399 || item.id === 466 ? 'epic' : item.id === 322 || item.id === 384 ? 'rare' : 'common');

  let nameColor = '#FFFFFF';
  if (rarity === 'epic') nameColor = '#FF55FF';
  else if (rarity === 'rare') nameColor = '#55FFFF';
  else if (itemDef?.weapon || itemDef?.gun) nameColor = '#FFAA00';
  else if (itemDef?.tool?.material === 'diamond' || itemDef?.armor?.material === 'diamond') nameColor = '#55FFFF';
  else if (itemDef?.tool?.material === 'gold' || itemDef?.armor?.material === 'gold') nameColor = '#FFFF55';

  const foodData = FOODS[item.id];
  const gunKey = itemDef?.gun;
  const gunDef = gunKey && GUNS[gunKey] ? GUNS[gunKey] : null;

  let posX = mousePos.x + 14;
  let posY = mousePos.y - 12;

  if (typeof window !== 'undefined') {
    if (posX + 260 > window.innerWidth) posX = mousePos.x - 270;
    if (posY + 200 > window.innerHeight) posY = window.innerHeight - 210;
  }

  return (
    <div
      className="fixed z-[100] pointer-events-none px-3 py-2 text-xs font-minecraft select-none shadow-2xl"
      style={{
        left: posX,
        top: posY,
        backgroundColor: '#100010',
        border: '2px solid #280048',
        borderRadius: '3px',
        maxWidth: '300px',
        color: '#FFFFFF',
        textShadow: '1px 1px 0 #3f3f3f',
      }}
    >
      <div className="font-bold text-sm tracking-wide" style={{ color: nameColor }}>
        {namePt}
      </div>
      {nameEn && nameEn !== namePt && (
        <div className="text-stone-400 text-[11px] italic mb-1">{nameEn}</div>
      )}

      {itemDef?.weaponDamage && (
        <div className="text-[#55FF55] font-semibold mt-1">
          +{itemDef.weaponDamage} Dano de Ataque
        </div>
      )}

      {gunDef && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px]">
          <div className="text-[#FFAA00]">Arma: {gunDef.name} ({gunDef.type.toUpperCase()})</div>
          <div className="text-stone-300">Dano por Tiro: {gunDef.damage}</div>
          <div className="text-stone-300">Capacidade: {gunDef.magCapacity} disparos</div>
        </div>
      )}

      {foodData && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px]">
          <div className="text-[#FFAA00] font-semibold">+{foodData.hunger} Pontos de Fome</div>
          <div className="text-stone-300">Saturação: +{foodData.saturation.toFixed(1)}</div>
        </div>
      )}

      <div className="mt-1 pt-1 border-t border-purple-900/40 text-[10px] text-stone-500">
        #{item.id} ({isBlock ? 'Bloco' : 'Item'})
      </div>
    </div>
  );
}

export default function CreativeUI({ inv, onUpdate, onClose }) {
  const [tab, setTab] = useState('building');
  const [search, setSearch] = useState('');
  const [scroll, setScroll] = useState(0);
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState(null);

  const [bgTabItemsUrl, setBgTabItemsUrl] = useState(null);
  const [bgTabSearchUrl, setBgTabSearchUrl] = useState(null);
  const [bgTabsUrl, setBgTabsUrl] = useState(null);

  // Carregar texturas oficiais de GUI do Creative Inventory
  useEffect(() => {
    getPackUrl(MC + 'textures/gui/container/creative_inventory/tab_items.png').then(url => {
      if (url) setBgTabItemsUrl(url);
    });
    getPackUrl(MC + 'textures/gui/container/creative_inventory/tab_item_search.png').then(url => {
      if (url) setBgTabSearchUrl(url);
    });
    getPackUrl(MC + 'textures/gui/container/creative_inventory/tabs.png').then(url => {
      if (url) setBgTabsUrl(url);
    });
  }, []);

  // Captura estrita da tecla E e Escape
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
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [onClose]);

  const allItems = useMemo(() => {
    const list = [];
    for (const id in BLOCKS) {
      const numId = parseInt(id, 10);
      const b = BLOCKS[id];
      if (numId === 0 || !b) continue;
      const categories = getItemCategories(numId, true, b);
      list.push({
        id: numId,
        name: b.namePt || b.name,
        nameEn: b.name,
        isBlock: true,
        categories,
        maxStack: 64,
        block: b,
      });
    }
    for (const id in ITEMS) {
      const numId = parseInt(id, 10);
      const it = ITEMS[id];
      if (!it) continue;
      const categories = getItemCategories(numId, false, it);
      list.push({
        id: numId,
        name: it.namePt || it.name,
        nameEn: it.name,
        isBlock: false,
        categories,
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
      return allItems.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.nameEn.toLowerCase().includes(q) ||
        i.id.toString().includes(q)
      );
    }
    if (tab === 'survival') {
      return (inv?.main || []).filter(Boolean);
    }
    return allItems.filter(i => i.categories.includes(tab));
  }, [allItems, tab, search, inv]);

  // Grade oficial: 9 colunas × 5 linhas = 45 slots visíveis
  const pageSize = 45;
  const totalRows = Math.ceil(filteredItems.length / 9);
  const maxScroll = Math.max(0, totalRows - 5);
  const pageItems = filteredItems.slice(scroll * 9, scroll * 9 + pageSize);

  const handleWheel = (e) => {
    if (maxScroll <= 0) return;
    if (e.deltaY > 0) setScroll(s => Math.min(maxScroll, s + 1));
    else if (e.deltaY < 0) setScroll(s => Math.max(0, s - 1));
  };

  const pickItem = (itemData, isShift, isRight = false) => {
    const max = itemData.maxStack || 64;
    playClickSound();
    if (isShift) {
      const newItem = { id: itemData.id, count: max, meta: 0 };
      addItem(inv, newItem);
      refresh();
      return;
    }
    if (isRight) {
      inv.cursor = { id: itemData.id, count: 1, meta: 0 };
    } else {
      inv.cursor = { id: itemData.id, count: max, meta: 0 };
    }
    refresh();
  };

  const handleHotbarClick = (index, isLeft) => {
    playClickSound();
    const getSlot = () => inv.hotbar[index];
    const setSlot = (val) => { inv.hotbar[index] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const clearHotbar = () => {
    playClickSound();
    for (let i = 0; i < 9; i++) inv.hotbar[i] = null;
    refresh();
  };

  // Escala oficial Java 1.8.9 (janela grande e nítida)
  const scale = 2.75;
  const bgWidth = 195 * scale;
  const bgHeight = 136 * scale;
  const tabW = 28 * scale;
  const tabH = 32 * scale;
  const slotStep = 18 * scale;
  const slotItemSize = 16 * scale;

  const currentTabName = [...TOP_TABS, ...BOTTOM_TABS].find(t => t.id === tab)?.name || 'Itens';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 select-none pointer-events-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={handleWheel}
      style={{ imageRendering: 'pixelated' }}
    >
      <div className="relative" style={{ width: bgWidth, height: bgHeight + 50 * scale }}>
        
        {/* ABAS SUPERIORES (TOP TABS) */}
        <div className="absolute flex" style={{ top: 0, left: 0 }}>
          {TOP_TABS.map((t, idx) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { playClickSound(); setTab(t.id); setScroll(0); }}
                title={t.name}
                className="relative flex items-center justify-center transition-transform hover:brightness-110"
                style={{
                  width: tabW,
                  height: tabH,
                  marginLeft: idx === 0 ? 0 : -scale,
                  background: active ? '#C6C6C6' : '#9B9B9B',
                  borderTop: `${scale * 2}px solid ${active ? '#FFFFFF' : '#D0D0D0'}`,
                  borderLeft: `${scale * 2}px solid ${active ? '#FFFFFF' : '#D0D0D0'}`,
                  borderRight: `${scale * 2}px solid #373737`,
                  borderBottom: active ? 'none' : `${scale * 2}px solid #373737`,
                  borderTopLeftRadius: `${scale * 3}px`,
                  borderTopRightRadius: `${scale * 3}px`,
                  zIndex: active ? 20 : 10,
                  transform: active ? `translateY(${scale * 2}px)` : 'translateY(0)',
                }}
              >
                <div style={{ pointerEvents: 'none' }}>
                  <ItemSlot item={t.item} size={slotItemSize} transparent={true} />
                </div>
              </button>
            );
          })}
        </div>

        {/* CONTAINER PRINCIPAL (JANELA DO CRIATIVO) */}
        <div
          className="absolute shadow-2xl"
          style={{
            top: tabH - scale * 2,
            left: 0,
            width: bgWidth,
            height: bgHeight,
            backgroundColor: '#C6C6C6',
            backgroundImage: bgTabItemsUrl ? `url(${bgTabItemsUrl})` : undefined,
            backgroundSize: `${256 * scale}px ${256 * scale}px`,
            backgroundPosition: '0 0',
            backgroundRepeat: 'no-repeat',
            borderTop: `${scale * 2}px solid #FFFFFF`,
            borderLeft: `${scale * 2}px solid #FFFFFF`,
            borderRight: `${scale * 2}px solid #373737`,
            borderBottom: `${scale * 2}px solid #373737`,
            zIndex: 15,
          }}
        >
          {/* Título da Aba no Canto Superior Esquerdo */}
          <div
            className="absolute font-minecraft font-bold"
            style={{
              top: 6 * scale,
              left: 8 * scale,
              fontSize: `${8 * scale}px`,
              color: '#404040',
            }}
          >
            {currentTabName}
          </div>

          {/* Campo de Busca (se estiver na aba Pesquisar) */}
          {tab === 'search' && (
            <input
              type="text"
              autoFocus
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setScroll(0); }}
              className="absolute font-minecraft bg-[#8B8B8B] text-white px-2 outline-none border border-[#373737]"
              style={{
                top: 4 * scale,
                right: 32 * scale,
                width: 90 * scale,
                height: 12 * scale,
                fontSize: `${7 * scale}px`,
              }}
            />
          )}

          {/* MALHA INVISÍVEL DOS 45 SLOTS DO CRIATIVO (5 LINHAS × 9 COLUNAS) */}
          <div
            className="absolute"
            style={{
              top: 18 * scale,
              left: 9 * scale,
              width: 9 * slotStep,
              height: 5 * slotStep,
            }}
          >
            {Array.from({ length: 45 }).map((_, idx) => {
              const itemData = pageItems[idx];
              const col = idx % 9;
              const row = Math.floor(idx / 9);

              return (
                <div
                  key={idx}
                  className="absolute"
                  style={{
                    left: col * slotStep,
                    top: row * slotStep,
                    width: slotStep,
                    height: slotStep,
                  }}
                >
                  <ItemSlot
                    item={itemData}
                    size={slotStep}
                    transparent={true}
                    onHover={(it) => setHoveredItem(it)}
                    onClick={() => itemData && pickItem(itemData, false, false)}
                    onRightClick={() => itemData && pickItem(itemData, false, true)}
                    onShiftClick={() => itemData && pickItem(itemData, true, false)}
                  />
                </div>
              );
            })}
          </div>

          {/* TRACK DA BARRA DE ROLAGEM VERTICAL (SCROLLBAR) */}
          <div
            className="absolute cursor-pointer"
            style={{
              top: 18 * scale,
              left: 175 * scale,
              width: 12 * scale,
              height: 94 * scale,
              backgroundColor: bgTabItemsUrl ? 'transparent' : '#8B8B8B',
            }}
          >
            {/* Polegar de Rolagem (Thumb) */}
            <div
              className="absolute transition-transform bg-[#C6C6C6] border border-t-white border-l-white border-r-[#373737] border-b-[#373737]"
              style={{
                top: maxScroll > 0 ? (scroll / maxScroll) * (94 - 15) * scale : 0,
                left: 0,
                width: 12 * scale,
                height: 15 * scale,
                opacity: maxScroll > 0 ? 1 : 0.45,
              }}
            />
          </div>

          {/* MALHA INVISÍVEL DA HOTBAR (9 SLOTS INFERIORES) */}
          <div
            className="absolute"
            style={{
              top: 112 * scale,
              left: 9 * scale,
              width: 9 * slotStep,
              height: slotStep,
            }}
          >
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="absolute"
                style={{
                  left: idx * slotStep,
                  top: 0,
                  width: slotStep,
                  height: slotStep,
                }}
              >
                <ItemSlot
                  item={inv.hotbar[idx]}
                  size={slotStep}
                  transparent={true}
                  onHover={(it) => setHoveredItem(it)}
                  onClick={() => handleHotbarClick(idx, true)}
                  onRightClick={() => handleHotbarClick(idx, false)}
                  onShiftClick={() => handleHotbarClick(idx, true)}
                />
              </div>
            ))}
          </div>

          {/* Botão de Limpar Hotbar no Canto da Janela */}
          <button
            onClick={clearHotbar}
            title="Limpar Barra de Acesso Rápido"
            className="absolute flex items-center justify-center font-minecraft font-bold hover:brightness-125"
            style={{
              top: 113 * scale,
              left: 174 * scale,
              width: 14 * scale,
              height: 14 * scale,
              backgroundColor: '#B53333',
              border: `${scale}px solid #2B0000`,
              color: '#FFFFFF',
              fontSize: `${7 * scale}px`,
            }}
          >
            ✕
          </button>
        </div>

        {/* ABAS INFERIORES (BOTTOM TABS) */}
        <div
          className="absolute flex"
          style={{
            top: tabH + bgHeight - scale * 4,
            left: 0,
          }}
        >
          {BOTTOM_TABS.map((t, idx) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { playClickSound(); setTab(t.id); setScroll(0); }}
                title={t.name}
                className="relative flex items-center justify-center transition-transform hover:brightness-110"
                style={{
                  width: tabW,
                  height: tabH,
                  marginLeft: idx === 0 ? 0 : -scale,
                  background: active ? '#C6C6C6' : '#9B9B9B',
                  borderTop: active ? 'none' : `${scale * 2}px solid #373737`,
                  borderLeft: `${scale * 2}px solid ${active ? '#FFFFFF' : '#D0D0D0'}`,
                  borderRight: `${scale * 2}px solid #373737`,
                  borderBottom: `${scale * 2}px solid #373737`,
                  borderBottomLeftRadius: `${scale * 3}px`,
                  borderBottomRightRadius: `${scale * 3}px`,
                  zIndex: active ? 20 : 10,
                  transform: active ? `translateY(-${scale * 2}px)` : 'translateY(0)',
                }}
              >
                <div style={{ pointerEvents: 'none' }}>
                  <ItemSlot item={t.item} size={slotItemSize} transparent={true} />
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* TOOLTIP AUTÊNTICO JAVA 1.8.9 */}
      {hoveredItem && <MinecraftTooltip item={hoveredItem} mousePos={mouse} />}

      {/* ITEM SEGURADO NO CURSOR */}
      {inv?.cursor && (
        <div
          className="fixed pointer-events-none z-[120]"
          style={{
            left: mouse.x - slotItemSize / 2,
            top: mouse.y - slotItemSize / 2,
          }}
        >
          <ItemSlot item={inv.cursor} size={slotItemSize} transparent={true} />
        </div>
      )}
    </div>
  );
}