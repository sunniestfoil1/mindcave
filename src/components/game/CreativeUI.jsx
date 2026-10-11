import React, { useState, useEffect, useMemo, useRef } from "react";
import ItemSlot from "./ItemSlot";
import { ITEMS, ITEM_NAMES, itemColor, CREATIVE_TABS, TOOL_MATERIALS, ARMOR_MATERIALS } from "@/game/items";
import { BLOCKS } from "@/game/blocks";
import { GUNS, ACCESSORIES, AMMO_TYPES } from "@/game/guns/registry";
import { FOODS } from "@/game/survival";
import { leftClick, rightClick, shiftClick, addItem } from "@/game/inventory";

// Mapeamento semântico de blocos por categoria do Criativo
const REDSTONE_BLOCK_IDS = new Set([46, 55, 69, 70, 72, 75, 76, 77, 93, 94, 123, 124, 149, 150, 151, 152, 154]);
const DECOR_BLOCK_IDS = new Set([18, 19, 30, 31, 37, 38, 39, 40, 47, 50, 51, 58, 61, 81, 83, 86, 89, 99, 100, 103, 106, 111, 143, 161, 171, 175]);
const TRANSPORT_BLOCK_IDS = new Set([27, 28, 66, 157]);
const TECH_BLOCK_IDS = new Set([177]);

// Retorna as categorias aplicáveis para um bloco ou item
function getItemCategories(id, isBlock, def) {
  const cats = new Set();
  if (isBlock) {
    if (REDSTONE_BLOCK_IDS.has(id)) cats.add('redstone');
    if (DECOR_BLOCK_IDS.has(id)) cats.add('decor');
    if (TRANSPORT_BLOCK_IDS.has(id)) cats.add('transport');
    if (TECH_BLOCK_IDS.has(id)) cats.add('technology');
    if (cats.size === 0) cats.add('building');
  } else {
    // Itens
    if (def.category) cats.add(def.category);
    if (def.gun || def.accessory || (id >= 450 && id <= 468)) {
      cats.add('technology');
      cats.add('combat');
    }
    if (def.weapon || def.armor) cats.add('combat');
    if (def.tool) cats.add('tools');
    if (def.food || FOODS[id]) cats.add('food');
    if (def.category === 'redstone' || id === 331 || id === 356 || id === 404) cats.add('redstone');
    if (def.category === 'transport') cats.add('transport');
    if (def.category === 'decor') cats.add('decor');
    if (def.category === 'materials') cats.add('materials');
    if (cats.size === 0) cats.add('misc');
  }
  return Array.from(cats);
}

// Tooltip com estilo autêntico do Minecraft Java 1.8.9
function MinecraftTooltip({ item, mousePos }) {
  if (!item || !item.id) return null;

  const isBlock = item.id < 256;
  const blockDef = isBlock ? BLOCKS[item.id] : null;
  const itemDef = !isBlock ? ITEMS[item.id] : null;

  const namePt = item.name || blockDef?.namePt || itemDef?.namePt || `Item #${item.id}`;
  const nameEn = item.nameEn || blockDef?.name || itemDef?.name || '';
  const rarity = itemDef?.rarity || (item.id === 399 || item.id === 466 ? 'epic' : item.id === 322 || item.id === 384 ? 'rare' : 'common');

  // Cor do título baseada na raridade/material
  let nameColor = '#FFFFFF';
  if (rarity === 'epic') nameColor = '#FF55FF';
  else if (rarity === 'rare') nameColor = '#55FFFF';
  else if (itemDef?.weapon || itemDef?.gun) nameColor = '#FFAA00';
  else if (itemDef?.tool?.material === 'diamond' || itemDef?.armor?.material === 'diamond') nameColor = '#55FFFF';
  else if (itemDef?.tool?.material === 'gold' || itemDef?.armor?.material === 'gold') nameColor = '#FFFF55';

  // Stats de Ferramentas / Armas
  const weaponDamage = itemDef?.weaponDamage;
  const toolMat = itemDef?.tool ? TOOL_MATERIALS[itemDef.tool.material] : null;

  // Stats de Armadura
  let armorPoints = null;
  let armorSlotName = '';
  if (itemDef?.armor) {
    const mat = ARMOR_MATERIALS[itemDef.armor.material];
    armorPoints = mat ? mat.points[itemDef.armor.slot] : null;
    const slots = ['Na Cabeça (Capacete)', 'No Peito (Peitoral)', 'Nas Pernas (Calças)', 'Nos Pés (Botas)'];
    armorSlotName = slots[itemDef.armor.slot] || 'No Corpo';
  }

  // Stats de Comida
  const foodData = FOODS[item.id];

  // Stats de Armas de Fogo
  const gunKey = itemDef?.gun;
  const gunDef = gunKey && GUNS[gunKey] ? GUNS[gunKey] : null;
  const ammoDef = AMMO_TYPES[gunDef?.ammoType];

  // Acessórios
  const accDef = itemDef?.accessory && ACCESSORIES[itemDef.accessory] ? ACCESSORIES[itemDef.accessory] : null;

  // Ajusta posição para não vazar da tela
  const tooltipWidth = 260;
  const tooltipHeight = 220;
  let posX = mousePos.x + 14;
  let posY = mousePos.y - 12;

  if (typeof window !== 'undefined') {
    if (posX + tooltipWidth > window.innerWidth) posX = mousePos.x - tooltipWidth - 14;
    if (posY + tooltipHeight > window.innerHeight) posY = window.innerHeight - tooltipHeight - 10;
    if (posY < 10) posY = 10;
  }

  return (
    <div
      className="fixed pointer-events-none z-[100] rounded p-2.5 shadow-2xl select-none"
      style={{
        left: posX,
        top: posY,
        width: tooltipWidth,
        backgroundColor: 'rgba(16, 0, 24, 0.95)',
        border: '2px solid #28007F',
        boxShadow: '0 0 12px rgba(40, 0, 127, 0.7), 0 6px 20px rgba(0, 0, 0, 0.85)',
        fontFamily: "'Minecraft', monospace, sans-serif",
      }}
    >
      {/* Nome do Item */}
      <div className="font-bold text-sm tracking-wide" style={{ color: nameColor, textShadow: '1px 1px 1px #000000' }}>
        {namePt}
      </div>

      {/* Nome Técnico em Inglês */}
      {nameEn && (
        <div className="text-[11px] text-stone-400 italic mb-1">
          minecraft:{nameEn}
        </div>
      )}

      {/* Dano de Ataque */}
      {weaponDamage && (
        <div className="mt-1 pt-1 border-t border-purple-900/50">
          <div className="text-[11px] text-stone-400">Na Mão Principal:</div>
          <div className="text-[12px] font-semibold text-[#55FF55]">
            +{weaponDamage} de Dano de Ataque
          </div>
        </div>
      )}

      {/* Atributos de Ferramenta */}
      {toolMat && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px] text-stone-300">
          <div>Material: <span className="text-white font-semibold">{toolMat.name}</span></div>
          <div>Velocidade de Mineração: <span className="text-[#55FF55] font-semibold">{toolMat.speed}x</span></div>
          <div>Nível de Colheita: <span className="text-[#FFAA00] font-semibold">{toolMat.harvest}</span></div>
        </div>
      )}

      {/* Atributos de Armadura */}
      {armorPoints !== null && (
        <div className="mt-1 pt-1 border-t border-purple-900/50">
          <div className="text-[11px] text-stone-400">{armorSlotName}:</div>
          <div className="text-[12px] font-semibold text-[#55FFFF]">
            +{armorPoints} de Armadura
          </div>
        </div>
      )}

      {/* Atributos de Arma de Fogo */}
      {gunDef && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px] text-stone-300">
          <div className="text-[#FF5555] font-bold">Dano: {gunDef.damage} HP por disparo</div>
          <div>Cadência: <span className="text-[#55FF55]">{gunDef.fireRate} tiros/s</span></div>
          <div>Carregador: <span className="text-white font-bold">{gunDef.magSize} projéteis</span></div>
          <div>Alcance Efetivo: <span className="text-stone-200">{gunDef.effectiveRange}m ({gunDef.maxRange}m máx)</span></div>
          <div>Munição: <span className="text-[#FFAA00]">{ammoDef?.namePt || gunDef.ammoType}</span></div>
          <div>Disparo: <span className="text-stone-400 uppercase">{gunDef.fireModes.join(', ')}</span></div>
        </div>
      )}

      {/* Acessório Balístico */}
      {accDef && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px] text-stone-300">
          <div className="text-[#55FF55] font-semibold">Slot: {accDef.slot}</div>
          <div className="text-stone-400 text-[10px]">Compatível: {accDef.compatible.join(', ')}</div>
        </div>
      )}

      {/* Atributos de Comida */}
      {foodData && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px]">
          <div className="text-[#FFAA00] font-semibold">Restaura +{foodData.hunger} Pontos de Fome</div>
          <div className="text-stone-300 text-[10px]">Saturação: +{foodData.saturation.toFixed(1)}</div>
          {foodData.effects && (
            <div className="text-[#FF55FF] text-[10px] mt-0.5">★ Concede efeitos de status especiais</div>
          )}
        </div>
      )}

      {/* Combustível */}
      {itemDef?.fuel && (
        <div className="text-[11px] text-[#FFAA00] mt-0.5">
          Combustível: {itemDef.fuel} ticks na Fornalha
        </div>
      )}

      {/* Durabilidade Máxima */}
      {itemDef?.durability && (
        <div className="text-[11px] text-stone-400 mt-0.5">
          Durabilidade: {itemDef.durability} / {itemDef.durability}
        </div>
      )}

      {/* Atributos de Bloco */}
      {blockDef && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px] text-stone-300">
          <div>Dureza: <span className="text-white font-medium">{blockDef.hardness < 0 ? 'Indestrutível (Bedrock)' : blockDef.hardness}</span></div>
          {blockDef.lightEmission > 0 && (
            <div className="text-[#FFFF55] font-medium">Emissão de Luz: Nível {blockDef.lightEmission}</div>
          )}
          {blockDef.slipperiness > 0.6 && (
            <div className="text-[#55FFFF]">Gelo / Escorregadio: {blockDef.slipperiness}</div>
          )}
          {!blockDef.solid && (
            <div className="text-stone-400 italic">Atravessável / Não Sólido</div>
          )}
        </div>
      )}

      {/* Lore Técnico Minecraft F3+H */}
      <div className="mt-1.5 pt-1 border-t border-purple-900/40 text-[10px] text-stone-400">
        <div>#0{item.id.toString(16).padStart(4, '0').toUpperCase()} ({isBlock ? 'Bloco' : 'Item'})</div>
        <div>ID: #{item.id}</div>
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

  useEffect(() => {
    const handleMouse = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        return;
      }
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Monta a biblioteca completa de itens e blocos data-driven
  const allItems = useMemo(() => {
    const list = [];

    // Blocos do jogo (IDs 1-255)
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

    // Itens do jogo (IDs 256+)
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

  // Filtra itens com base na aba ou campo de pesquisa
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
    return allItems.filter(i => i.categories.includes(tab));
  }, [allItems, tab, search]);

  const pageSize = 45; // Grade 5x9 autêntica
  const maxScroll = Math.max(0, Math.ceil(filteredItems.length / 9) - 5);
  const pageItems = filteredItems.slice(scroll * 9, scroll * 9 + pageSize);

  // Ação de pegar item da grade criativa
  const pickItem = (itemData, isShift, isRight = false) => {
    const max = itemData.maxStack || 64;
    if (isShift) {
      // Shift-click coloca um stack cheio no primeiro slot vago da hotbar
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

  // Clique em slots da Hotbar
  const handleHotbarClick = (index, isLeft) => {
    const getSlot = () => inv.hotbar[index];
    const setSlot = (val) => { inv.hotbar[index] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const handleHotbarShift = (index) => {
    shiftClick(inv, 'hotbar', index);
    refresh();
  };

  // Limpar hotbar ou descartar item do cursor
  const clearHotbarOrCursor = () => {
    if (inv.cursor) {
      inv.cursor = null;
    } else {
      for (let i = 0; i < inv.hotbar.length; i++) {
        inv.hotbar[i] = null;
      }
    }
    refresh();
  };

  const slotSize = 38;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 select-none"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative bg-stone-800 border-2 border-stone-900 rounded-lg p-3.5 shadow-2xl"
        style={{ fontFamily: "'Minecraft', monospace, sans-serif", width: 440 }}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-white text-sm font-bold tracking-wide">Inventário Criativo</span>
          <button
            onClick={clearHotbarOrCursor}
            title={inv.cursor ? "Descartar item no cursor" : "Limpar toda a barra de atalhos"}
            className="px-2 py-0.5 text-[11px] bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700 rounded transition-colors"
          >
            {inv.cursor ? "🗑 Descartar" : "🗑 Limpar Barra"}
          </button>
        </div>

        {/* Abas do Criativo */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {CREATIVE_TABS.map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setScroll(0); }}
                className={
                  "px-2 py-1 text-[11px] rounded transition-colors font-medium " +
                  (isActive
                    ? "bg-amber-600 text-white shadow-inner font-bold"
                    : "bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-white")
                }
              >
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Campo de Pesquisa */}
        {tab === 'search' && (
          <div className="mb-2">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setScroll(0); }}
              placeholder="Pesquisar por nome ou ID..."
              className="w-full px-2.5 py-1.5 bg-stone-900 text-white text-xs rounded border border-stone-600 focus:outline-none focus:border-amber-500 placeholder-stone-500"
            />
          </div>
        )}

        {/* Grade de Itens 5x9 com Texturas Reais 3D / 2D */}
        <div className="relative bg-stone-900/90 p-1.5 rounded border border-stone-700/80 mb-2">
          <div className="grid grid-cols-9 gap-1 min-h-[200px]">
            {pageItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onMouseEnter={() => setHoveredItem(item)}
              >
                <ItemSlot
                  item={{ id: item.id, count: 1 }}
                  size={slotSize}
                  onClick={() => pickItem(item, false, false)}
                  onRightClick={() => pickItem(item, false, true)}
                  onShiftClick={() => pickItem(item, true, false)}
                  onHover={(it) => setHoveredItem(it ? item : null)}
                />
              </div>
            ))}

            {/* Espaços vazios preenchidos para manter proporção 5x9 */}
            {Array.from({ length: Math.max(0, pageSize - pageItems.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="rounded-sm border border-black/20"
                style={{ width: slotSize, height: slotSize, background: 'rgba(139, 139, 139, 0.08)' }}
              />
            ))}
          </div>

          {/* Indicador e Controle de Barra de Rolagem */}
          {maxScroll > 0 && (
            <div className="absolute right-[-14px] top-2 bottom-2 w-2.5 bg-stone-950 rounded-full overflow-hidden border border-stone-700">
              <div
                className="w-full bg-amber-500 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(15, (5 / (maxScroll + 5)) * 100)}%`,
                  top: `${(scroll / maxScroll) * (100 - Math.max(15, (5 / (maxScroll + 5)) * 100))}%`,
                  position: 'relative'
                }}
              />
            </div>
          )}
        </div>

        {/* Navegação de Página */}
        <div className="flex justify-between items-center mb-2 px-1 text-xs text-stone-400">
          <button
            onClick={() => setScroll(Math.max(0, scroll - 1))}
            disabled={scroll === 0}
            className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-white rounded disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            ▲ Anterior
          </button>
          <span>Página {scroll + 1} de {maxScroll + 1} ({filteredItems.length} itens)</span>
          <button
            onClick={() => setScroll(Math.min(maxScroll, scroll + 1))}
            disabled={scroll >= maxScroll}
            className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-white rounded disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Próxima ▼
          </button>
        </div>

        {/* Barra de Acesso Rápido (Hotbar) com Renderização Completa */}
        <div className="pt-2 border-t border-stone-700">
          <div className="text-[11px] text-stone-400 mb-1 px-1">Barra de Acesso Rápido:</div>
          <div className="grid grid-cols-9 gap-1 bg-stone-900/60 p-1.5 rounded border border-stone-700/60">
            {inv.hotbar.map((slotItem, i) => (
              <ItemSlot
                key={`hotbar-${i}`}
                item={slotItem}
                size={slotSize}
                onClick={() => handleHotbarClick(i, true)}
                onRightClick={() => handleHotbarClick(i, false)}
                onShiftClick={() => handleHotbarShift(i)}
                onHover={(it) => setHoveredItem(it)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Item flutuante no cursor */}
      {inv.cursor && (
        <div
          className="fixed pointer-events-none z-[120]"
          style={{ left: mouse.x - 18, top: mouse.y - 18 }}
        >
          <ItemSlot item={inv.cursor} size={36} />
        </div>
      )}

      {/* Tooltip Autêntico do Minecraft Java */}
      {hoveredItem && (
        <MinecraftTooltip item={hoveredItem} mousePos={mouse} />
      )}
    </div>
  );
}