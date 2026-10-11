import React, { useState, useEffect } from "react";
import { itemColor, getItem, ITEMS } from "@/game/items";
import { BLOCKS } from "@/game/blocks";
import { getDurabilityRatio } from "@/game/mining";
import { getPackUrl, MC } from "@/game/pack";

const blockCanvasCache = new Map();

function get3DBlockDataUrl(topImg, sideImg) {
  const cacheKey = (topImg?.src || '') + '|' + (sideImg?.src || '');
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

export default function ItemSlot({ item, onClick, onRightClick, onShiftClick, onHover, size = 44, highlight = false, transparent = false }) {
  const [hover, setHover] = useState(false);
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    if (!item || !item.id) {
      setImgUrl(null);
      return;
    }
    const isBlock = item.id < 256;
    if (isBlock) {
      const b = BLOCKS[item.id];
      if (b && (b.model === 'cube' || !b.model)) {
        const topTex = typeof b.faces === 'string' ? b.faces : (b.faces?.top || b.faces?.all || b.name);
        const sideTex = typeof b.faces === 'string' ? b.faces : (b.faces?.side || b.faces?.front || b.faces?.all || b.name);
        Promise.all([
          getPackUrl(MC + 'textures/blocks/' + topTex + '.png'),
          getPackUrl(MC + 'textures/blocks/' + sideTex + '.png')
        ]).then(([topUrl, sideUrl]) => {
          if (!topUrl) { setImgUrl(null); return; }
          const topImg = new Image();
          const sideImg = new Image();
          topImg.crossOrigin = 'Anonymous';
          sideImg.crossOrigin = 'Anonymous';
          topImg.src = topUrl;
          sideImg.src = sideUrl || topUrl;
          let loaded = 0;
          const onDone = () => {
            loaded++;
            if (loaded >= 2) {
              const iso3D = get3DBlockDataUrl(topImg, sideImg);
              setImgUrl(iso3D);
            }
          };
          topImg.onload = onDone;
          sideImg.onload = onDone;
          topImg.onerror = () => setImgUrl(topUrl);
          sideImg.onerror = () => setImgUrl(topUrl);
        });
      } else if (b) {
        const texName = typeof b.faces === 'string' ? b.faces : (b.faces?.all || b.faces?.side || b.faces?.front || b.faces?.top || b.name);
        getPackUrl(MC + 'textures/blocks/' + texName + '.png').then(url => setImgUrl(url || null));
      }
    } else {
      const it = ITEMS[item.id];
      if (it) {
        getPackUrl(MC + 'textures/items/' + it.name + '.png').then(url => setImgUrl(url || null));
      } else {
        setImgUrl(null);
      }
    }
  }, [item?.id]);

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
              className="w-3/4 h-3/4 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="w-3/4 h-3/4 rounded-sm" style={{ background: bg }} />
          )}

          {/* Contagem */}
          {item.count > 1 && (
            <span className="absolute bottom-0 right-0.5 text-xs text-white font-bold" style={{ textShadow: "1px 1px 1px black, -1px -1px 1px black" }}>
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