import React, { useState, useEffect } from "react";
import { itemColor, ITEMS } from "@/game/items";
import { BLOCKS, tileForFace } from "@/game/blocks";
import { getDurabilityRatio } from "@/game/mining";
import { getPackUrl, MC, isPackReady, onPackReady } from "@/game/pack";
import { getAtlasTileCanvas, getAtlasVersion } from "@/game/textures";
import { itemIconFile, itemBlockTile, ICON_TINT } from "@/game/gui/iconNames";
import { hasGlint } from "@/game/glint";
import { drawIsoBoxes, ICON_SLAB, ICON_STAIRS, ICON_FENCE, ICON_GATE, ICON_CHEST } from "@/game/gui/isoIcon";

const blockCanvasCache = new Map();
const flatCanvasCache = new Map();
const itemUrlCache = new Map();

function canvasToOptimizedDataUrl(canvas) {
  try {
    const webp = canvas.toDataURL('image/webp', 0.9);
    if (webp && webp.startsWith('data:image/webp')) return webp;
  } catch {}
  return canvas.toDataURL();
}

function get3DBlockDataUrl(topImg, sideImg, cacheKey) {
  if (blockCanvasCache.has(cacheKey)) return blockCanvasCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageRendering = 'pixelated';

  const side = sideImg || topImg;

  // Face Superior (Top) - 100% brilho
  if (topImg) {
    ctx.save();
    ctx.setTransform(0.75, 0.4375, -0.75, 0.4375, 16, 2);
    ctx.drawImage(topImg, 0, 0, 16, 16);
    ctx.restore();
  }

  // Face Esquerda (Left) - 85% brilho (sombra sutil)
  if (side) {
    ctx.save();
    ctx.setTransform(0.75, 0.375, 0, 0.875, 4, 9);
    ctx.drawImage(side, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();

    // Face Direita (Right) - 65% brilho (sombra lateral)
    ctx.save();
    ctx.setTransform(0.75, -0.375, 0, 0.875, 16, 15);
    ctx.drawImage(side, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();
  }

  const dataUrl = canvasToOptimizedDataUrl(canvas);
  blockCanvasCache.set(cacheKey, dataUrl);
  return dataUrl;
}

// fill: o ícone ocupa o slot inteiro (slots de container de 16×16 px de GUI); guiScale: fator inteiro para o tamanho do número
let glintUrlCache = null;
function useGlintUrl(active) {
  const [url, setUrl] = useState(glintUrlCache);
  useEffect(() => {
    if (!active || glintUrlCache) return;
    getPackUrl(MC + 'textures/misc/enchanted_item_glint.png').then((u) => { if (u) { glintUrlCache = u; setUrl(u); } });
  }, [active]);
  return url;
}

export default function ItemSlot({ item, onClick, onRightClick, onShiftClick, onHover, size = 44, highlight = false, transparent = false, fill = false, guiScale = 0, ...rest }) {

  const [hover, setHover] = useState(false);
  const glintOn = !!item && hasGlint(item);
  const glintUrl = useGlintUrl(glintOn);
  const [imgUrl, setImgUrl] = useState(null);
  const atlasVer = getAtlasVersion(); // o ícone é refeito quando as texturas reais terminam de carregar
  const [packVer, setPackVer] = useState(isPackReady() ? 1 : 0);
  useEffect(() => {
    return onPackReady(() => setPackVer(v => v + 1));
  }, []);

  const hasItem = Boolean(item && item.id && item.id > 0);

  useEffect(() => {
    if (!hasItem) {
      setImgUrl(null);
      return;
    }
    // Ícone de um ladrilho do atlas (já com as texturas do pacote), com tinta de bioma quando o bloco é tingido
    const tile = (name, tint) => {
      const cv = name ? getAtlasTileCanvas(name) : null;
      if (!cv || !tint) return cv;
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      const x = c.getContext('2d');
      x.drawImage(cv, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = ICON_TINT[tint];
      x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(cv, 0, 0);
      return c;
    };
    const showBlock = (b) => {
      const meta = item.meta || 0;
      const f = b.faces;
      // lajes mudam de textura conforme o tipo (meta); o resto usa as faces fixas do bloco
      const top = b.variants ? tileForFace(b, 'top', meta) : (typeof f === 'string' ? f : (f?.top || f?.all || f?.side || b.name));
      const side = b.variants ? tileForFace(b, 'side', meta) : (typeof f === 'string' ? f : (f?.side || f?.front || f?.all || top));
      const tint = b.tint === 'grass' || b.tint === 'foliage' ? b.tint : null;
      if (b.model === 'slab' || b.model === 'stairs' || b.model === 'fence' || b.model === 'gate' || b.model === 'chest') {
        const t = tile(top, null), sd = tile(side, null);
        if (t && sd) {
          const key = `${b.model}|${top}|${side}`;
          if (!blockCanvasCache.has(key)) {
            const c = document.createElement('canvas');
            c.width = 32; c.height = 32;
            drawIsoBoxes(c.getContext('2d'), { slab: ICON_SLAB, stairs: ICON_STAIRS, fence: ICON_FENCE, gate: ICON_GATE, chest: ICON_CHEST }[b.model], t, sd, null, b.model === 'chest' ? tile('chest_front', null) : null);
            blockCanvasCache.set(key, canvasToOptimizedDataUrl(c));
          }
          setImgUrl(blockCanvasCache.get(key));
          return true;
        }
      }
      if (b.model === 'cube' || !b.model) {
        const t = tile(top, tint);
        const sd = tile(side, tint && side === top ? tint : null);
        if (t && sd) { setImgUrl(get3DBlockDataUrl(t, sd, `${top}|${side}|${tint}`)); return true; }
      } else {
        const flatKey = `${side || top}|${tint}`;
        if (flatCanvasCache.has(flatKey)) {
          setImgUrl(flatCanvasCache.get(flatKey));
          return true;
        }
        const flat = tile(side || top, tint);
        if (flat) {
          const u = canvasToOptimizedDataUrl(flat);
          flatCanvasCache.set(flatKey, u);
          setImgUrl(u);
          return true;
        }
      }
      return false;
    };
    const isBlock = item.id < 256;
    const b = isBlock ? BLOCKS[item.id] : null;
    if (b) {
      if (!showBlock(b)) setImgUrl(null);
      return;
    }
    const it = ITEMS[item.id];
    if (!it) { setImgUrl(null); return; }

    const itemKey = it.name;
    if (itemUrlCache.has(itemKey)) {
      setImgUrl(itemUrlCache.get(itemKey));
      return;
    }

    getPackUrl(MC + 'textures/items/' + itemIconFile(it.name) + '.png').then((url) => {
      if (url) {
        itemUrlCache.set(itemKey, url);
        setImgUrl(url);
        return;
      }
      const blockTile = itemBlockTile(it.name);
      if (blockTile && flatCanvasCache.has(blockTile)) {
        setImgUrl(flatCanvasCache.get(blockTile));
        return;
      }
      const flat = blockTile ? tile(blockTile) : null;
      if (flat) {
        const u = flat.toDataURL();
        flatCanvasCache.set(blockTile, u);
        setImgUrl(u);
      } else {
        setImgUrl(null);
      }
    });
  }, [item?.id, item?.meta, atlasVer, packVer, hasItem]);

  const handleClick = (e) => {
    e.preventDefault();
    if (e.shiftKey && onShiftClick) { onShiftClick(); return; }
    if (e.button === 2 && onRightClick) { onRightClick(); return; }
    if (onClick) onClick();
  };

  const handleContext = (e) => {
    e.preventDefault();
    if (onRightClick) onRightClick();
  };

  const handleMouseEnter = (e) => {
    setHover(true);
    if (onHover) onHover(hasItem ? item : null, e);
    if (rest.onMouseEnter) rest.onMouseEnter(e);
  };
  const handleMouseLeave = (e) => {
    setHover(false);
    if (onHover) onHover(null, e);
    if (rest.onMouseLeave) rest.onMouseLeave(e);
  };


  const bg = hasItem ? itemColor(item.id) : undefined;
  const durRatio = hasItem ? getDurabilityRatio(item) : 1;
  const showDur = hasItem && (ITEMS[item.id]?.durability) && durRatio < 1;
  const durColor = durRatio > 0.5 ? "bg-green-500" : durRatio > 0.25 ? "bg-yellow-500" : "bg-red-500";

  const baseBorder = transparent ? "" : "border border-black/40 rounded-sm";
  const hoverClass = highlight || hover ? "bg-white/25" : "";

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContext}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className={`relative flex items-center justify-center cursor-pointer transition-colors select-none ${baseBorder} ${hoverClass}`}
      style={{
        width: size,
        height: size,
        userSelect: 'none',
        background: (!transparent && hasItem && !imgUrl) ? bg : undefined,
      }}
    >
      {hasItem && (
        <>
          {/* Imagem real ou cor fallback */}
          {imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={fill ? "w-full h-full object-contain pointer-events-none select-none" : "w-3/4 h-3/4 object-contain pointer-events-none select-none"}
              style={{ imageRendering: 'pixelated', userSelect: 'none' }}
            />
          ) : (
            !transparent && <div className={fill ? "w-full h-full rounded-sm" : "w-3/4 h-3/4 rounded-sm"} style={{ background: bg }} />
          )}

          {/* Brilho de encantamento: a textura oficial corre em duas camadas, só sobre os pixels opacos do ícone */}
          {glintOn && imgUrl && glintUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <div
                className={fill ? "w-full h-full mc-glint" : "w-3/4 h-3/4 mc-glint"}
                style={{
                  WebkitMaskImage: `url(${imgUrl})`, maskImage: `url(${imgUrl})`,
                  WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center', maskPosition: 'center',
                  backgroundImage: `url(${glintUrl}), url(${glintUrl})`,
                  imageRendering: 'pixelated',
                }}
              />
            </div>
          )}

          {/* Contagem */}
          {item.count > 1 && (
            <span
              className="absolute text-white pointer-events-none select-none"
              style={guiScale
                ? { right: -guiScale, bottom: -guiScale, fontSize: 8 * guiScale, lineHeight: 1, fontFamily: "'Minecraft', monospace", textShadow: `${guiScale}px ${guiScale}px 0 #3f3f3f`, pointerEvents: 'none', zIndex: 2 }
                : { right: 2, bottom: 0, fontSize: 12, fontWeight: 700, textShadow: "1px 1px 1px black, -1px -1px 1px black", pointerEvents: 'none' }}
            >
              {item.count}
            </span>
          )}
          {/* Barra de durabilidade */}
          {showDur && (
            <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-black/50 rounded-full overflow-hidden pointer-events-none">
              <div className={"h-full " + durColor} style={{ width: `${durRatio * 100}%` }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}