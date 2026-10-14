// Flash de dano dos mobs (RendererLivingEntity.setBrightness do 1.8.9: sobreposição vermelha de 30% enquanto hurtTime > 0).
// Módulo Hit Color do Mind Client: cor vermelha, arco-íris (tabela de 256 cores calculada uma vez) ou personalizada, e a intensidade.
// Cada material do mob ganha uma variante "machucada" (cache por material); trocar a variante é o único custo por mob ferido.
const variants = new Map();   // material base -> variante

function variantFor(base) {
  let v = variants.get(base);
  if (!v) { v = base.clone(); variants.set(base, v); }
  return v;
}

function collect(model) {
  const list = [];
  model.traverse((o) => {
    if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.color) { o.userData._baseMat = o.material; list.push(o); }
  });
  model.userData._flashMeshes = list;
  return list;
}

// flash = clientStore.hitFlash(agora) calculado uma vez por quadro; mob.hurtTime vem do tick (10 → 0)
export function applyHitFlash(model, hurt, flash) {
  if (!model) return;
  const meshes = model.userData._flashMeshes || collect(model);
  const active = hurt && flash;
  for (const m of meshes) {
    const base = m.userData._baseMat;
    if (!active) { if (m.material !== base) m.material = base; continue; }
    const v = variantFor(base);
    const [r, g, b] = flash.rgb, k = flash.mix;
    if (v.emissive) {
      // mistura com a textura: (1−k)·textura + k·cor (a emissão soma a cor, a base escurece a textura)
      v.color.setRGB(1 - k, 1 - k, 1 - k);
      v.emissive.setRGB(r * k, g * k, b * k);
    } else {
      v.color.setRGB(1 - k + r * k, 1 - k + g * k, 1 - k + b * k);
    }
    if (m.material !== v) m.material = v;
  }
}

