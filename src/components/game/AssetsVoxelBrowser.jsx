import React, { useState, useMemo, useEffect } from "react";
import ModelScene from "./ModelScene";

const URL = "https://media.mindcaveApi.com/files/public/6ac3fe2840f638f998ba590c/0672e9a34_minecraft_assets_voxel.glb";

const MATS = { D: "Diamante", G: "Ouro", I: "Ferro", W: "Madeira", SK: "Pedra", R: "Outro" };

// Decodificação aproximada dos códigos do autor do modelo
export function decodeCode(rawName) {
  const m = rawName.match(/Minecraft__\d+_([A-Z]+)_\d+/);
  if (!m) return { code: rawName, cat: "Outros", label: rawName };
  const code = m[1];
  if (/BD$/.test(code) && code.length > 2) {
    const mat = code.replace(/BD$/, "");
    return { code, cat: "Peitoral", label: `Peitoral ${MATS[mat] || mat}` };
  }
  if (/H$/.test(code)) {
    const mat = code.replace(/H$/, "");
    return { code, cat: "Capacete", label: `Capacete ${MATS[mat] || mat}` };
  }
  if (/S$/.test(code) && code.length >= 2) {
    const mat = code.replace(/S$/, "");
    return { code, cat: "Espada", label: `Espada ${MATS[mat] || mat}` };
  }
  if (/^A/.test(code)) {
    const mat = code.slice(1);
    return { code, cat: "Machado", label: `Machado ${MATS[mat] || mat}` };
  }
  if (/^P/.test(code)) {
    const mat = code.slice(1);
    return { code, cat: "Picareta", label: `Picareta ${MATS[mat] || mat}` };
  }
  if (/^B/.test(code)) {
    const mat = code.slice(1);
    return { code, cat: "Botas", label: `Botas ${MATS[mat] || mat}` };
  }
  if (/^S/.test(code)) {
    const mat = code.slice(1);
    return { code, cat: "Pá", label: `Pá ${MATS[mat] || mat}` };
  }
  if (/T$/.test(code)) {
    const mat = code.replace(/T$/, "");
    return { code, cat: "Calças", label: `Calças ${MATS[mat] || mat}` };
  }
  return { code, cat: "Outros", label: code };
}

const CAT_ORDER = ["Capacete", "Peitoral", "Calças", "Botas", "Espada", "Machado", "Picareta", "Pá", "Outros"];

export default function AssetsVoxelBrowser() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);

  const decoded = useMemo(() => items.map((n) => ({ raw: n, ...decodeCode(n) })), [items]);

  const grouped = useMemo(() => {
    const map = {};
    decoded.forEach((d) => {
      (map[d.cat] = map[d.cat] || []).push(d);
    });
    return map;
  }, [decoded]);

  useEffect(() => {
    if (!selected && decoded.length) setSelected(decoded[0].raw);
  }, [decoded, selected]);

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      <div className="bg-card border border-border rounded-lg p-3 max-h-[420px] overflow-y-auto">
        <p className="text-xs text-muted-foreground mb-2">Decodificação aproximada dos códigos do modelo.</p>
        {CAT_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
          <div key={cat} className="mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {cat} ({grouped[cat].length})
            </h3>
            <div className="flex flex-col gap-0.5">
              {grouped[cat].map((d) => (
                <button
                  key={d.raw}
                  onClick={() => setSelected(d.raw)}
                  className={
                    "text-left px-2 py-1 text-sm rounded transition-colors " +
                    (selected === d.raw ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground")
                  }
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs opacity-60 ml-1">({d.code})</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div>
        <ModelScene url={URL} visibleNodeName={selected} colorize onItems={setItems} />
        <p className="mt-2 text-xs text-muted-foreground text-center truncate">
          {selected ? `Selecionado: ${decodeCode(selected).label}` : "Carregando itens..."}
        </p>
      </div>
    </div>
  );
}