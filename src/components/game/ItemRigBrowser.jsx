import React, { useState, useMemo, useEffect } from "react";
import ModelScene from "./ModelScene";

const URL = "https://media.mindcaveApi.com/files/public/6ac3fe2840f638f998ba590c/986d1c820_minecraft_item_rig.glb";

const NOISE = /^(Enchanting_Particle|Particle\.|Plane\.?|Cube\.|Armature|Sun$)/i;

export function categorizeItem(name) {
  const n = name.toLowerCase();
  if (/(helmet|chestplate|leg|boot|waist|cap|tunic|pants|horse-armor|armour|armor)/.test(n)) return "Armaduras";
  if (/(sword|bow|arrow|fire-charge|snowball|trident|shield)/.test(n)) return "Armas";
  if (/(pickaxe|axe|shovel|hoe|shears|fishing|flint|bucket|rod)/.test(n)) return "Ferramentas";
  if (/(apple|bread|cake|porkchop|beef|steak|fish|chicken|cookie|melon|carrot|potato|rabbit|mutton|mushroom|beetroot|soup|stew|pie|sugar|egg)/.test(n)) return "Comida";
  if (/(ingot|dust|coal|charcoal|redstone|lapis|quartz|slime|clay|brick|paper|leather|feather|string|bone|gunpowder|blaze|ghast|ender|magma|spider|nether-wart|nether-brick|prismarine|dye|ink|bone-meal|gold-nugget|emerald|ruby|nether-star|tear|hide|foot|shard|crystal)/.test(n)) return "Materiais";
  if (/(block|bed|door|sign|cauldron|hopper|brewing|tnt|command|chest|furnace|minecart-with|boat|saddle)/.test(n)) return "Blocos & Transporte";
  if (/(skull|head|skeleton|zombie|creeper|wither)/.test(n)) return "Cabeças";
  if (/(painting|map|book|clock|compass|firework|lead|name-tag|item-frame|music-disc|elytra|potion|bottle|eye-of-ender|enchant|sun|particle|plane|cube|pot)/.test(n)) return "Diversos";
  return "Diversos";
}

const CAT_ORDER = ["Armaduras", "Armas", "Ferramentas", "Comida", "Materiais", "Blocos & Transporte", "Cabeças", "Diversos"];

export default function ItemRigBrowser() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => items.filter((n) => !NOISE.test(n)), [items]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((name) => {
      const cat = categorizeItem(name);
      (map[cat] = map[cat] || []).push(name);
    });
    return map;
  }, [filtered]);

  const q = query.trim().toLowerCase();
  const searchMatches = useMemo(() => (q ? filtered.filter((n) => n.toLowerCase().includes(q)) : null), [filtered, q]);

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
  }, [filtered, selected]);

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      <div className="bg-card border border-border rounded-lg p-3 max-h-[420px] overflow-y-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar item..."
          className="w-full mb-3 px-3 py-2 text-sm rounded-md bg-background border border-border outline-none focus:ring-2 focus:ring-ring"
        />
        {searchMatches ? (
          <ItemGroup title={`Resultados (${searchMatches.length})`} items={searchMatches} selected={selected} onSelect={setSelected} />
        ) : (
          CAT_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
            <ItemGroup key={cat} title={`${cat} (${grouped[cat].length})`} items={grouped[cat]} selected={selected} onSelect={setSelected} />
          ))
        )}
      </div>
      <div>
        <ModelScene url={URL} visibleNodeName={selected} wireTextures colorize onItems={setItems} />
        <p className="mt-2 text-xs text-muted-foreground text-center truncate">
          {selected ? `Selecionado: ${selected}` : "Carregando itens..."}
        </p>
      </div>
    </div>
  );
}

function ItemGroup({ title, items, selected, onSelect }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{title}</h3>
      <div className="flex flex-col gap-0.5">
        {items.map((name) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className={
              "text-left px-2 py-1 text-sm rounded transition-colors " +
              (selected === name ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground")
            }
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}