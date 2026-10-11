import React, { useState, useEffect } from "react";
import { itemColor, ITEMS } from "@/game/items";
import { BLOCKS } from "@/game/blocks";
import { getDurabilityRatio } from "@/game/mining";
import { getPackUrl, MC } from "@/game/pack";
import { getAtlasTileCanvas, getAtlasVersion } from "@/game/textures";
import { itemIconFile, itemBlockTile, ICON_TINT } from "@/game/gui/iconNames";

const blockCanvasCache = new Map();

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

  const dataUrl = canvas.toDataURL();
  blockCanvasCache.set(cacheKey, dataUrl);
  return dataUrl;
}

// fill: o ícone ocupa o slot inteiro (slots de container de 16×16 px de GUI); guiScale: fator inteiro para o tamanho do número
export default function ItemSlot({ item, onClick, onRightClick, onShiftClick, onHover, size = 44, highlight = false, transparent = false, fill = false, guiScale = 0 }) {
  const [hover, setHover] = useState(false);
  const [imgUrl, setImgUrl] = useState(null);
  const atlasVer = getAtlasVersion(); // o ícone é refeito quando as texturas reais terminam de carregar

  useEffect(() => {
    if (!item || !item.id) {
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
      const f = b.faces;
      const top = typeof f === 'string' ? f : (f?.top || f?.all || f?.side || b.name);
      const side = typeof f === 'string' ? f : (f?.side || f?.front || f?.all || top);
      const tint = b.tint === 'grass' || b.tint === 'foliage' ? b.tint : null;
      if (b.model === 'cube' || !b.model) {
        const t = tile(top, tint);
        const sd = tile(side, tint && side === top ? tint : null);
        if (t && sd) { setImgUrl(get3DBlockDataUrl(t, sd, `${top}|${side}|${tint}`)); return true; }
      } else {
        const flat = tile(side || top, tint);
        if (flat) { setImgUrl(flat.toDataURL()); return true; }
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
    getPackUrl(MC + 'textures/items/' + itemIconFile(it.name) + '.png').then((url) => {
      if (url) { setImgUrl(url); return; }
      const blockTile = itemBlockTile(it.name);
      const flat = blockTile ? tile(blockTile) : null;
      setImgUrl(flat ? flat.toDataURL() : null);
    });
  }, [item?.id, atlasVer]);

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

  const handleMouseEnter = (e) => { setHover(true); if (onHover) onHover(item, e); };
  const handleMouseLeave = (e) => { setHover(false); if (onHover) onHover(null, e); };

  const bg = item ? itemColor(item.id) : "rgba(139,139,139,0.15)";
  const durRatio = item ? getDurabilityRatio(item) : 1;
  const showDur = item && (ITEMS[item.id]?.durability) && durRatio < 1;
  const durColor = durRatio > 0.5 ? "bg-green-500" : durRatio > 0.25 ? "bg-yellow-500" : "bg-red-500";

  const baseBorder = transparent ? "" : "border border-black/40 rounded-sm";
  const hoverClass = highlight || hover ? "bg-white/25" : "";

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContext}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-center justify-center cursor-pointer transition-colors ${baseBorder} ${hoverClass}`}
      style={{
        width: size,
        height: size,
        background: (!transparent && item && !imgUrl) ? bg : undefined,
      }}
    >
      {item && (
        <>
          {/* Imagem real ou cor fallback */}
          {imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              className={fill ? "w-full h-full object-contain" : "w-3/4 h-3/4 object-contain"}
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className={fill ? "w-full h-full rounded-sm" : "w-3/4 h-3/4 rounded-sm"} style={{ background: bg }} />
          )}

          {/* Contagem */}
          {item.count > 1 && (
            <span
              className="absolute text-white"
              style={guiScale
                ? { right: -guiScale, bottom: -guiScale, fontSize: 8 * guiScale, lineHeight: 1, fontFamily: "'Minecraft', monospace", textShadow: `${guiScale}px ${guiScale}px 0 #3f3f3f`, pointerEvents: 'none', zIndex: 2 }
                : { right: 2, bottom: 0, fontSize: 12, fontWeight: 700, textShadow: "1px 1px 1px black, -1px -1px 1px black" }}
            >
              {item.count}
            </span>
          )}
          {/* Barra de durabilidade */}
          {showDur && (
            <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-black/50 rounded-full overflow-hidden">
              <div className={"h-full " + durColor} style={{ width: `${durRatio * 100}%` }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}