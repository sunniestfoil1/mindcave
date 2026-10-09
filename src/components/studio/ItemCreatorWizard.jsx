// Assistente de criação de itens customizados — PRD 10 RF-060..061
import React, { useState, useCallback } from "react";
import { Check, ChevronRight, ChevronLeft, Wand2 } from "lucide-react";
import { createCustomItem, getNextCustomId } from "@/studio/customItemRegistry";
import { ITEMS, ITEM_NAMES } from "@/game/items";
import { BLOCKS } from "@/game/blocks";

const ITEM_TYPES = [
  { value: 'tool', label: 'Picareta/Machado/Pá/Enxada', icon: '⛏️' },
  { value: 'weapon', label: 'Espada', icon: '⚔️' },
  { value: 'gun', label: 'Arma de Fogo', icon: '🔫' },
  { value: 'food', label: 'Comida', icon: '🍎' },
  { value: 'armor', label: 'Armadura', icon: '🛡️' },
  { value: 'material', label: 'Material', icon: '📦' },
  { value: 'throwable', label: 'Arremessável', icon: '🧨' },
  { value: 'block', label: 'Bloco', icon: '🧱' },
];

const RARITIES = [
  { value: 'common', label: 'Comum', color: '#ffffff' },
  { value: 'uncommon', label: 'Incomum', color: '#ffff55' },
  { value: 'rare', label: 'Raro', color: '#55ffff' },
  { value: 'epic', label: 'Épico', color: '#ff55ff' },
];

const STATIONS = [
  { value: 'crafting', label: 'Bancada de Trabalho' },
  { value: 'gunsmith', label: 'Bancada de Armeiro' },
  { value: 'furnace', label: 'Fornalha' },
];

const STEPS = ['Tipo', 'Identidade', 'Estatísticas', 'Visual', 'Receita', 'Publicar'];

export default function ItemCreatorWizard({ user, onCreated, onClose }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    itemType: 'tool',
    namePt: '', nameEn: '', itemId: '', description: '',
    rarity: 'common', category: 'combat', maxStack: 1,
    stats: {},
    assetUrl: '', iconColor: 0x888888,
    recipe: null, recipeStation: 'crafting',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setStats = (key, val) => setForm(f => ({ ...f, stats: { ...f.stats, [key]: val } }));

  // Gerar itemId automático
  const generateItemId = () => {
    const base = (form.nameEn || form.namePt || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `mindcave:${base}`;
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const itemId = form.itemId || generateItemId();
      const record = await createCustomItem({
        ...form,
        itemId,
        nameEn: form.nameEn || form.namePt,
      }, user);
      onCreated?.(record);
      onClose?.();
    } catch (e) {
      alert('Erro ao criar item: ' + e.message);
    }
    setSaving(false);
  };

  // === Editor de receita visual ===
  const [recipeGrid, setRecipeGrid] = useState(new Array(9).fill(null));
  const [recipeResult, setRecipeResult] = useState({ id: 0, count: 1 });
  const [recipeSearch, setRecipeSearch] = useState('');

  const allRecipeItems = [
    ...Object.entries(BLOCKS).filter(([id]) => id !== '0').map(([id, b]) => ({ id: parseInt(id), name: b.namePt, color: b.id })),
    ...Object.entries(ITEMS).map(([id, item]) => ({ id: parseInt(id), name: item.namePt, color: item.color })),
  ].filter(i => i.id < 4096); // excluir itens customizados existentes

  const filteredRecipeItems = recipeSearch
    ? allRecipeItems.filter(i => i.name.toLowerCase().includes(recipeSearch.toLowerCase()))
    : allRecipeItems.slice(0, 30);

  const placeInGrid = (slot, item) => {
    const grid = [...recipeGrid];
    grid[slot] = grid[slot] && grid[slot].id === item.id ? null : { id: item.id, count: 1 };
    setRecipeGrid(grid);
  };

  const buildRecipe = () => {
    const ingredients = recipeGrid.filter(s => s && s.id);
    if (ingredients.length === 0) return null;
    return {
      type: 'shapeless',
      ingredients: ingredients.map(s => ({ id: s.id })),
      result: recipeResult,
    };
  };

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 max-w-2xl mx-auto" style={{ fontFamily: 'monospace' }}>
      {/* Steps indicator */}
      <div className="flex items-center gap-1 mb-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className={"flex items-center gap-1 px-2 py-1 rounded text-xs " + (i === step ? "bg-blue-600 text-white" : i < step ? "bg-green-700 text-white" : "bg-stone-700 text-stone-400")}>
              {i < step && <Check className="w-3 h-3" />}
              <span>{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-stone-600" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {/* Step 0: Tipo */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-2">
            {ITEM_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => set('itemType', t.value)}
                className={"flex items-center gap-2 p-3 rounded text-sm text-left " + (form.itemType === t.value ? "bg-blue-600 text-white" : "bg-stone-700 text-stone-300 hover:bg-stone-600")}
              >
                <span className="text-lg">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Identidade */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Nome (PT-BR)</label>
              <input value={form.namePt} onChange={e => set('namePt', e.target.value)} placeholder="Picareta de Obsidiana"
                className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Nome (EN)</label>
              <input value={form.nameEn} onChange={e => set('nameEn', e.target.value)} placeholder="Obsidian Pickaxe"
                className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">ID interno</label>
              <div className="flex gap-2">
                <input value={form.itemId || generateItemId()} onChange={e => set('itemId', e.target.value)} readOnly={!!form.itemId}
                  className="flex-1 px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none" />
                <button onClick={() => set('itemId', '')} className="px-2 py-1 text-xs bg-stone-700 text-stone-300 rounded hover:bg-stone-600">Auto</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Descrição/Lore</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-stone-400 block mb-1">Raridade</label>
                <select value={form.rarity} onChange={e => set('rarity', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none">
                  {RARITIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-400 block mb-1">Pilha máxima</label>
                <input type="number" value={form.maxStack} onChange={e => set('maxStack', parseInt(e.target.value) || 1)} min={1} max={64}
                  className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Aba criativa</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none">
                <option value="combat">Combate</option>
                <option value="tools">Ferramentas</option>
                <option value="food">Comidas</option>
                <option value="materials">Materiais</option>
                <option value="misc">Diversos</option>
                <option value="technology">Tecnologia</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Estatísticas */}
        {step === 2 && (
          <div className="space-y-3">
            {form.itemType === 'tool' && (
              <>
                <StatField label="Velocidade de mineração" value={form.stats.miningSpeed} onChange={v => setStats('miningSpeed', v)} placeholder="9" hint="Madeira=2, Pedra=4, Ferro=6, Diamante=8" />
                <StatField label="Nível de colheita" value={form.stats.harvestLevel} onChange={v => setStats('harvestLevel', v)} placeholder="4" hint="0-3 vanilla, 4+ custom" type="number" />
                <StatField label="Durabilidade" value={form.stats.durability} onChange={v => setStats('durability', v)} placeholder="3000" type="number" />
                <StatField label="Dano corpo a corpo" value={form.stats.weaponDamage} onChange={v => setStats('weaponDamage', v)} placeholder="5" type="number" />
              </>
            )}
            {form.itemType === 'weapon' && (
              <>
                <StatField label="Dano" value={form.stats.weaponDamage} onChange={v => setStats('weaponDamage', v)} placeholder="8" type="number" />
                <StatField label="Durabilidade" value={form.stats.durability} onChange={v => setStats('durability', v)} placeholder="1561" type="number" />
                <StatField label="Velocidade em teia" value={form.stats.webSpeed} onChange={v => setStats('webSpeed', v)} placeholder="15" type="number" />
              </>
            )}
            {form.itemType === 'gun' && (
              <>
                <StatField label="Dano por projétil" value={form.stats.damage} onChange={v => setStats('damage', v)} placeholder="5" type="number" />
                <StatField label="Cadência (tiros/s)" value={form.stats.fireRate} onChange={v => setStats('fireRate', v)} placeholder="4" type="number" />
                <StatField label="Carregador" value={form.stats.magSize} onChange={v => setStats('magSize', v)} placeholder="12" type="number" />
                <StatField label="Tempo de recarga (ticks)" value={form.stats.reloadTime} onChange={v => setStats('reloadTime', v)} placeholder="30" type="number" />
                <StatField label="Alcance efetivo (blocos)" value={form.stats.effectiveRange} onChange={v => setStats('effectiveRange', v)} placeholder="32" type="number" />
                <StatField label="Dispersão quadril (graus)" value={form.stats.spreadHip} onChange={v => setStats('spreadHip', v)} placeholder="1.5" />
                <StatField label="Recuo vertical (graus)" value={form.stats.recoilV} onChange={v => setStats('recoilV', v)} placeholder="2" type="number" />
              </>
            )}
            {form.itemType === 'food' && (
              <>
                <StatField label="Fome restaurada" value={form.stats.food} onChange={v => setStats('food', v)} placeholder="6" type="number" />
                <StatField label="Saturação" value={form.stats.saturation} onChange={v => setStats('saturation', v)} placeholder="0.6" />
                <StatField label="Tempo para comer (ticks)" value={form.stats.eatTime} onChange={v => setStats('eatTime', v)} placeholder="32" type="number" />
              </>
            )}
            {form.itemType === 'armor' && (
              <>
                <StatField label="Slot (0-3)" value={form.stats.armorSlot} onChange={v => setStats('armorSlot', v)} placeholder="1" type="number" hint="0=capacete, 1=peitoral, 2=calças, 3=botas" />
                <StatField label="Pontos de armadura" value={form.stats.armorPoints} onChange={v => setStats('armorPoints', v)} placeholder="6" type="number" />
                <StatField label="Durabilidade" value={form.stats.durability} onChange={v => setStats('durability', v)} placeholder="240" type="number" />
              </>
            )}
            {(form.itemType === 'material' || form.itemType === 'throwable') && (
              <p className="text-sm text-stone-400">Nenhuma estatística especial necessária para este tipo.</p>
            )}
          </div>
        )}

        {/* Step 3: Visual */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">URL do GLB (opcional)</label>
              <input value={form.assetUrl} onChange={e => set('assetUrl', e.target.value)} placeholder="https://..."
                className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none" />
              <p className="text-[10px] text-stone-500 mt-1">Se vazio, usa cor procedural.</p>
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Cor do ícone (hex)</label>
              <div className="flex items-center gap-2">
                <input type="color" value={'#' + (form.iconColor || 0x888888).toString(16).padStart(6, '0')}
                  onChange={e => set('iconColor', parseInt(e.target.value.slice(1), 16))}
                  className="w-10 h-8 rounded border border-stone-700 bg-stone-900" />
                <div className="w-12 h-12 rounded border-2 border-stone-600" style={{ background: '#' + (form.iconColor || 0x888888).toString(16).padStart(6, '0') }} />
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-stone-900 rounded">
              <div className="w-12 h-12 rounded border-2 border-stone-600 flex items-center justify-center" style={{ background: '#' + (form.iconColor || 0x888888).toString(16).padStart(6, '0') }}>
                <span className="text-xs text-black/70 font-bold">?</span>
              </div>
              <div className="text-xs text-stone-400">
                <div className="text-white font-medium">{form.namePt || 'Sem nome'}</div>
                <div>{getNextCustomId()} (ID numérico)</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Receita */}
        {step === 4 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Estação de crafting</label>
              <select value={form.recipeStation} onChange={e => set('recipeStation', e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none">
                {STATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Grade de crafting (clique para selecionar)</label>
              <div className="flex gap-4">
                {/* 3x3 grid */}
                <div className="grid grid-cols-3 gap-1">
                  {recipeGrid.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (!slot) { setRecipeSearch(''); return; }
                        placeInGrid(i, slot);
                      }}
                      className="w-10 h-10 rounded border-2 border-stone-600 flex items-center justify-center"
                      style={{ background: slot ? '#' + (allRecipeItems.find(it => it.id === slot.id)?.color || 0x888888).toString(16).padStart(6, '0') : 'rgba(0,0,0,0.3)' }}
                    />
                  ))}
                </div>
                <div className="text-2xl text-stone-500 self-center">→</div>
                {/* Result */}
                <div className="self-center">
                  <div className="w-12 h-12 rounded border-2 border-yellow-600 flex items-center justify-center" style={{ background: '#' + (form.iconColor || 0x888888).toString(16).padStart(6, '0') }}>
                    <span className="text-xs text-black/70 font-bold">{form.namePt?.[0] || '?'}</span>
                  </div>
                  <input type="number" value={recipeResult.count} onChange={e => setRecipeResult({ ...recipeResult, count: parseInt(e.target.value) || 1 })} min={1} max={64}
                    className="w-12 mt-1 px-1 py-0.5 text-xs bg-stone-900 text-white rounded border border-stone-700 text-center" />
                </div>
              </div>
            </div>
            {/* Item picker */}
            <div>
              <input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} placeholder="Buscar item para adicionar..."
                className="w-full px-2 py-1 text-xs bg-stone-900 text-white rounded border border-stone-700 outline-none" />
              <div className="grid grid-cols-8 gap-1 mt-2 max-h-32 overflow-y-auto">
                {filteredRecipeItems.slice(0, 32).map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      // Colocar no primeiro slot vazio
                      const emptyIdx = recipeGrid.findIndex(s => !s);
                      if (emptyIdx >= 0) placeInGrid(emptyIdx, item);
                    }}
                    className="w-9 h-9 rounded border border-stone-600"
                    style={{ background: '#' + (item.color || 0x888888).toString(16).padStart(6, '0') }}
                    title={item.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Publicar */}
        {step === 5 && (
          <div className="space-y-3">
            <div className="bg-stone-900 rounded p-3 space-y-1 text-xs">
              <div className="text-sm font-bold text-white mb-2">Resumo do item</div>
              <Row label="Tipo" value={ITEM_TYPES.find(t => t.value === form.itemType)?.label} />
              <Row label="Nome" value={`${form.namePt} (${form.nameEn || '—'})`} />
              <Row label="ID" value={form.itemId || generateItemId()} />
              <Row label="ID numérico" value={getNextCustomId()} />
              <Row label="Raridade" value={RARITIES.find(r => r.value === form.rarity)?.label} />
              <Row label="Pilha máx." value={form.maxStack} />
              <Row label="Aba" value={form.category} />
              {Object.entries(form.stats).length > 0 && (
                <div className="pt-1 border-t border-stone-700 mt-1">
                  <div className="text-stone-400 mb-1">Estatísticas:</div>
                  {Object.entries(form.stats).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                </div>
              )}
              <Row label="Estação" value={STATIONS.find(s => s.value === form.recipeStation)?.label} />
              <Row label="Tem receita" value={buildRecipe() ? 'Sim' : 'Não'} />
              <Row label="GLB" value={form.assetUrl ? 'Sim' : 'Procedural'} />
            </div>
            <button
              onClick={handlePublish}
              disabled={saving || !form.namePt}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              {saving ? 'Publicando...' : 'Publicar item'}
            </button>
            {!form.namePt && <p className="text-xs text-red-400 text-center">Nome é obrigatório.</p>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-4 pt-3 border-t border-stone-700">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-stone-700 text-stone-300 rounded disabled:opacity-30 hover:bg-stone-600"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatField({ label, value, onChange, placeholder, hint, type = 'text' }) {
  return (
    <div>
      <label className="text-xs text-stone-400 block mb-0.5">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-sm bg-stone-900 text-white rounded border border-stone-700 outline-none focus:border-blue-500"
      />
      {hint && <p className="text-[10px] text-stone-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}:</span>
      <span className="text-stone-300">{value ?? '—'}</span>
    </div>
  );
}