import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, MapPin, MousePointerClick, Compass, BarChart3, Keyboard, Cpu, Layers, Wifi, Box, Palette, Languages, Apple, Wind, Tag,
  Sparkles, RefreshCcw, FlaskConical, List, Sun, XCircle, Home, Settings, Info, Search, ChevronLeft,
} from 'lucide-react';
import { MODULES } from '@/game/client/modules';
import { clientStore, useClientStore } from '@/game/client/clientStore';

// Menu do Mind Client (Shift direito): painel azul-marinho com barra lateral, busca e cartões de módulo no estilo do cliente de
// referência. Clicar no cartão liga/desliga; a engrenagem abre os ajustes do módulo. Módulos "em breve" ficam apagados.
const ICONS = { Shield, MapPin, MousePointerClick, Compass, BarChart3, Keyboard, Cpu, Layers, Wifi, Box, Palette, Languages, Apple, Wind, Tag, Sparkles, RefreshCcw, FlaskConical, List, Sun };

const C = {
  panel: '#1c273b', search: '#111824', on: '#333c4e', onBorder: '#b7b8bb', border: 'rgba(255,255,255,0.28)',
  text: '#c4cad5', textOn: '#ffffff', muted: 'rgba(255,255,255,0.55)',
};
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

function Toggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ width: 46, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: on ? '#3fb27f' : '#46526a', transition: 'background .12s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left .12s' }} />
    </button>
  );
}

function SettingRow({ moduleId, setting }) {
  useClientStore();
  const value = clientStore.get(moduleId, setting.key);
  const set = (v) => clientStore.set(moduleId, setting.key, v);
  let control = null;
  if (setting.type === 'toggle') control = <Toggle on={!!value} onChange={set} />;
  else if (setting.type === 'slider') {
    control = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="range" min={setting.min} max={setting.max} step={setting.step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: 200, accentColor: '#8fb3ff' }} />
        <span style={{ width: 56, textAlign: 'right', color: C.text, fontSize: 15 }}>{setting.format ? setting.format(value) : value}</span>
      </div>
    );
  } else if (setting.type === 'cycle') {
    control = (
      <div style={{ display: 'flex', gap: 6 }}>
        {setting.options.map((o) => (
          <button key={String(o.value)} type="button" onClick={() => set(o.value)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${value === o.value ? C.onBorder : C.border}`, background: value === o.value ? C.on : 'transparent', color: value === o.value ? '#fff' : C.text, cursor: 'pointer', fontSize: 15, fontFamily: FONT }}>
            {o.label}
          </button>
        ))}
      </div>
    );
  } else if (setting.type === 'color') {
    control = <input type="color" value={value} onChange={(e) => set(e.target.value)} style={{ width: 54, height: 30, border: 'none', background: 'transparent', cursor: 'pointer' }} />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ color: C.textOn, fontSize: 17 }}>{setting.label}</span>
      {control}
    </div>
  );
}

function ModuleSettings({ module, onBack }) {
  useClientStore();
  const on = clientStore.isOn(module.id);
  const Icon = ICONS[module.icon];
  return (
    <div style={{ padding: '24px 40px', overflowY: 'auto', flex: 1 }}>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.text, cursor: 'pointer', fontSize: 16, fontFamily: FONT, marginBottom: 18 }}>
        <ChevronLeft size={20} /> Voltar aos módulos
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
        {Icon && <Icon size={34} color="#fff" strokeWidth={1.6} />}
        <h2 style={{ margin: 0, color: '#fff', fontSize: 28, fontWeight: 600, flex: 1 }}>{module.name}</h2>
        <Toggle on={on} onChange={(v) => clientStore.setOn(module.id, v)} />
      </div>
      <p style={{ margin: '0 0 18px 50px', color: C.muted, fontSize: 15 }}>{module.desc}</p>
      {(module.settings || []).length === 0 && <p style={{ color: C.muted, fontSize: 15 }}>Este módulo não tem ajustes.</p>}
      {(module.settings || []).filter((s) => !s.showIf || s.showIf((k) => clientStore.get(module.id, k))).map((s) => <SettingRow key={s.key} moduleId={module.id} setting={s} />)}
    </div>
  );
}

function Card({ module, onOpenSettings }) {
  useClientStore();
  const soon = module.kind === 'soon';
  const on = clientStore.isOn(module.id);
  const Icon = ICONS[module.icon];
  return (
    <div
      role="button" aria-pressed={on} aria-disabled={soon} data-module={module.id} tabIndex={0}
      title={module.desc}
      onClick={() => { if (!soon) clientStore.toggle(module.id); }}
      onKeyDown={(e) => { if (!soon && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); clientStore.toggle(module.id); } }}
      style={{
        position: 'relative', height: 70, borderRadius: 22, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px',
        border: `2px solid ${on ? C.onBorder : C.border}`, background: on ? C.on : 'transparent', cursor: soon ? 'not-allowed' : 'pointer',
        opacity: soon ? 0.4 : 1, userSelect: 'none', transition: 'background .1s, border-color .1s',
      }}
    >
      <span style={{ width: 40, display: 'flex', justifyContent: 'center' }}>{Icon && <Icon size={34} color={on ? '#fff' : '#d3d8e2'} strokeWidth={1.6} />}</span>
      <span style={{ width: 2, height: 30, background: 'rgba(255,255,255,0.55)', borderRadius: 1 }} />
      <span style={{ fontSize: 21, fontWeight: 500, color: on ? C.textOn : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{module.name}</span>
      {soon
        ? <span style={{ position: 'absolute', right: 14, bottom: 6, fontSize: 11, color: C.muted }}>Em breve</span>
        : (
          <button type="button" aria-label={`Ajustes de ${module.name}`} onClick={(e) => { e.stopPropagation(); onOpenSettings(module); }}
            style={{ position: 'absolute', right: 10, bottom: 6, background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: C.muted, display: 'flex' }}>
            <Settings size={18} />
          </button>
        )}
    </div>
  );
}

function SideButton({ label, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#cfd6e4', cursor: 'pointer', borderRadius: 8 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#cfd6e4'; e.currentTarget.style.background = 'none'; }}>
      {children}
    </button>
  );
}

export default function MindClientMenu({ onClose }) {
  const [view, setView] = useState('modules'); // modules | settings | about
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);      // módulo com a tela de ajustes aberta
  useClientStore();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? MODULES.filter((m) => m.name.toLowerCase().includes(q)) : MODULES;
  }, [query]);

  const content = open
    ? <ModuleSettings module={open} onBack={() => setOpen(null)} />
    : view === 'about'
      ? (
        <div style={{ padding: '32px 48px', color: C.text, fontSize: 17, lineHeight: 1.6 }}>
          <h2 style={{ color: '#fff', marginTop: 0 }}>Mind Client</h2>
          <p>Menu aberto com o <b>Shift direito</b>. Clique num cartão para ligar ou desligar o módulo e na engrenagem para ajustar.</p>
          <p>Perspective: segure <b>ALT</b> para olhar em volta sem virar o corpo.</p>
          <p>Módulos apagados marcados "Em breve" ainda não têm implementação.</p>
        </div>
      )
      : view === 'settings'
        ? (
          <div style={{ padding: '32px 48px', color: C.text, fontSize: 17 }}>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Configurações</h2>
            <p>Restaura todos os módulos e ajustes para o padrão.</p>
            <button type="button" onClick={() => clientStore.reset()}
              style={{ padding: '10px 22px', borderRadius: 10, border: `1.5px solid ${C.onBorder}`, background: C.on, color: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: FONT }}>
              Restaurar padrão
            </button>
          </div>
        )
        : (
          <div style={{ padding: '14px 40px 24px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '30px 56px', paddingTop: 22 }}>
              {list.map((m) => <Card key={m.id} module={m} onOpenSettings={setOpen} />)}
            </div>
            {list.length === 0 && <p style={{ color: C.muted, textAlign: 'center', marginTop: 60 }}>Nenhum módulo com esse nome.</p>}
          </div>
        );

  return (
    <div
      data-client-menu
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,14,28,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}
    >
      <div style={{ display: 'flex', gap: 6, width: 'min(1280px, 96vw)', height: 'min(720px, 88vh)' }}>
        <div style={{ width: 48, background: C.panel, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SideButton label="Fechar" onClick={onClose}><XCircle size={22} /></SideButton>
            <SideButton label="Módulos" onClick={() => { setView('modules'); setOpen(null); }}><Home size={21} /></SideButton>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SideButton label="Configurações" onClick={() => { setView('settings'); setOpen(null); }}><Settings size={21} /></SideButton>
            <SideButton label="Sobre" onClick={() => { setView('about'); setOpen(null); }}><Info size={21} /></SideButton>
          </div>
        </div>
        <div style={{ flex: 1, background: C.panel, borderRadius: 14, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 22px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.search, borderRadius: 8, padding: '0 12px', height: 34, width: 'min(300px, 60%)' }}>
              <Search size={17} color="#cfd6e4" />
              <span style={{ width: 2, height: 18, background: 'rgba(255,255,255,0.4)' }} />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setView('modules'); setOpen(null); }}
                onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
                placeholder="Buscar..."
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: FONT }}
              />
            </label>
          </div>
          {content}
        </div>
      </div>
    </div>
  );
}
