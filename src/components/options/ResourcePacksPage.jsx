import React, { useEffect, useState } from 'react';
import { GuiButton, useGui } from '@/components/java';
import { Sprite, McText, usePackTexture } from '@/components/game/GuiSprite';
import { measureMcText } from '@/game/gui/font';
import { loadPack } from '@/game/pack';
import { useT } from '@/game/i18n';
import {
  PACK_CATALOG, getSelectedPackIds, setSelectedPackIds, ensurePackBuffer, getCachedPackBuffer, readPackInfo,
} from '@/game/resourcePacks';

// Tela de pacotes de recursos (GuiScreenResourcePacks do 1.8.9): duas listas de 200 px, entradas de 36 px com ícone 32×32,
// setas do resource_packs.png sobre o ícone quando o mouse está na linha, "Padrão" fixo no fim da lista de selecionados.
// Pronto grava a escolha e recarrega a página para todas as texturas, sons e modelos lerem o pacote novo (o jogo faz o mesmo
// com refreshResources). Esc sai sem aplicar.
const LIST_W_MAX = 200; // no jogo as listas são sempre de 200 px; em janela estreita (GUI grande) encolhem para caberem as duas
const ROW_H = 36;

function trim(text, color, textW) {
  if (measureMcText(text, color, 8) <= textW) return text;
  let s = text;
  while (s.length > 1 && measureMcText(s + '...', color, 8) > textW) s = s.slice(0, -1);
  return s + '...';
}

// Quebra em até 2 linhas da largura do texto (157 px com a lista de 200)
function wrap2(text, color, textW) {
  const lines = [];
  let cur = '';
  for (const word of String(text).split(' ')) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && measureMcText(next, color, 8) > textW) { lines.push(cur); cur = word; } else cur = next;
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  return lines.map((l) => trim(l, color, textW));
}

function Entry({ S, listW, x, y, kind, name, desc, iconUrl, arrowsUrl, canUp, canDown, busy, onRight, onLeft, onUp, onDown }) {
  const [m, setM] = useState(null); // mouse relativo à linha, em px de GUI
  const interactive = kind !== 'default';
  const pos = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { j: Math.floor((e.clientX - r.left) / S), k: Math.floor((e.clientY - r.top) / S) };
  };
  const click = (e) => {
    if (!interactive || busy) return;
    const { j, k } = pos(e);
    if (j > 32) return;
    if (kind === 'available') onRight();
    else if (j < 16) onLeft();
    else if (k < 16 && canUp) onUp();
    else if (k > 16 && canDown) onDown();
  };
  const textW = listW - 43;
  const lines = busy ? [`${busy.label} ${busy.percent}%`] : wrap2(desc, '#808080', textW);
  const arrow = (u, hot) => <Sprite url={arrowsUrl} u={u} v={hot ? 32 : 0} w={32} h={32} S={S} x={0} y={0} />;
  return (
    <div
      style={{ position: 'absolute', left: x * S, top: y * S, width: (listW - 4) * S, height: 32 * S, cursor: interactive && !busy ? 'pointer' : 'default' }}
      onMouseMove={interactive ? (e) => setM(pos(e)) : undefined}
      onMouseLeave={() => setM(null)}
      onClick={click}
    >
      <img src={iconUrl} alt="" draggable={false} style={{ position: 'absolute', left: 0, top: 0, width: 32 * S, height: 32 * S, imageRendering: 'pixelated' }} />
      {m && interactive && (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 32 * S, height: 32 * S, background: 'rgba(144,144,144,0.627)' }} />
          {kind === 'available' && arrow(0, m.j < 32)}
          {kind === 'selected' && (
            <>
              {arrow(32, m.j < 16)}
              {canUp && arrow(96, m.j < 32 && m.j > 16 && m.k < 16)}
              {canDown && arrow(64, m.j < 32 && m.j > 16 && m.k > 16)}
            </>
          )}
        </>
      )}
      <McText text={trim(name, '#FFFFFF', textW)} x={34} y={1} S={S} color="#FFFFFF" shadow />
      {lines.map((l, i) => <McText key={i} text={l} x={34} y={12 + 10 * i} S={S} color="#808080" shadow />)}
    </div>
  );
}

function ListPanel({ S, listW, x, top, bottom, title, children }) {
  return (
    <div style={{ position: 'absolute', left: x * S, top: top * S, width: listW * S, height: (bottom - top) * S, background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4 * S, background: 'linear-gradient(to bottom, #000, transparent)', zIndex: 2 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 * S, background: 'linear-gradient(to top, #000, transparent)', zIndex: 2 }} />
      <McText text={title} x={listW / 2} y={3} S={S} color="#FFFFFF" shadow align="center" z={3} />
      <div style={{ position: 'absolute', left: (listW - measureMcText(title, '#FFFFFF', 8)) / 2 * S, width: measureMcText(title, '#FFFFFF', 8) * S, top: 12 * S, height: S, background: '#fff', zIndex: 3 }} />
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  );
}

export default function ResourcePacksPage({ onBack }) {
  const t = useT();
  const { guiWidth: W, guiHeight: H, scale: S } = useGui();
  const arrowsUrl = usePackTexture('textures/gui/resource_packs.png');
  const unknownUrl = usePackTexture('textures/misc/unknown_pack.png');
  // do mais prioritário para o menos, como a lista do jogo (o armazenado vai do menos para o mais prioritário)
  const [selected, setSelected] = useState(() => getSelectedPackIds().slice().reverse());
  const [infos, setInfos] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => { loadPack(); }, []); // abrindo direto em /options ninguém carregou o pacote base ainda (setas, ícone "?")

  useEffect(() => {
    let off = false;
    PACK_CATALOG.forEach(async (pack) => {
      const buf = await getCachedPackBuffer(pack);
      if (!buf || off) return;
      const info = await readPackInfo(buf);
      if (!off) setInfos((p) => ({ ...p, [pack.id]: { cached: true, ...info } }));
    });
    return () => { off = true; };
  }, []);

  const select = async (pack) => {
    setError('');
    setBusy({ id: pack.id, percent: 0 });
    try {
      const buf = await ensurePackBuffer(pack, (percent) => setBusy({ id: pack.id, percent }));
      const info = await readPackInfo(buf);
      setInfos((p) => ({ ...p, [pack.id]: { cached: true, ...info } }));
      setSelected((s) => [pack.id, ...s.filter((id) => id !== pack.id)]);
      setChanged(true);
    } catch (e) {
      setError(`${t('resourcePack.failed')}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };
  const unselect = (id) => { setSelected((s) => s.filter((x) => x !== id)); setChanged(true); };
  const move = (i, d) => {
    setSelected((s) => { const a = s.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
    setChanged(true);
  };

  const done = () => {
    if (!changed) { onBack(); return; }
    setSelectedPackIds(selected.slice().reverse());
    setApplying(true);
    setTimeout(() => window.location.reload(), 150);
  };

  const mb = (n) => (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  const listW = Math.min(LIST_W_MAX, Math.floor(W / 2) - 8);
  const top = 32;
  const bottom = H - 51;
  const first = top + 4 + 13;
  const available = PACK_CATALOG.filter((p) => !selected.includes(p.id));
  const row = (i) => first + i * ROW_H;
  const common = (pack) => ({
    S, listW, name: pack.id, iconUrl: infos[pack.id]?.iconUrl || unknownUrl, arrowsUrl,
    desc: infos[pack.id]?.description || mb(pack.size),
    busy: busy?.id === pack.id ? { percent: busy.percent, label: t('resourcePack.download') } : null,
  });

  return (
    <>
      <McText text={t('resourcePack.title')} x={W / 2} y={16} S={S} color="#FFFFFF" shadow align="center" />

      <ListPanel S={S} listW={listW} x={W / 2 - 4 - listW} top={top} bottom={bottom} title={t('resourcePack.available.title')}>
        {available.map((pack, i) => (
          <Entry key={pack.id} {...common(pack)} x={2} y={row(i) - top} kind="available" onRight={() => select(pack)} />
        ))}
      </ListPanel>

      <ListPanel S={S} listW={listW} x={W / 2 + 4} top={top} bottom={bottom} title={t('resourcePack.selected.title')}>
        {selected.map((id, i) => {
          const pack = PACK_CATALOG.find((p) => p.id === id);
          return (
            <Entry key={id} {...common(pack)} x={2} y={row(i) - top} kind="selected"
              canUp={i > 0} canDown={i < selected.length - 1}
              onLeft={() => unselect(id)} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
          );
        })}
        <Entry S={S} listW={listW} x={2} y={row(selected.length) - top} kind="default" name="Default" iconUrl={unknownUrl} arrowsUrl={arrowsUrl} desc={t('resourcePack.default.desc')} />
      </ListPanel>

      <McText text={error || t('resourcePack.hint')} x={W / 2} y={H - 26} S={S} color={error ? '#FF5555' : '#808080'} shadow align="center" />

      <GuiButton x={-100} y={H - 48} width={200} label={applying ? t('resourcePack.applying') : t('gui.done')} disabled={applying} onClick={done} />
    </>
  );
}
