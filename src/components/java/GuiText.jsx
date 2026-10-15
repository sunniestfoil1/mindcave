import React, { useRef, useLayoutEffect } from 'react';
import { useGui } from './GuiContext';
import { drawMcText, measureMcText } from '@/game/gui/font';

const GuiText = React.memo(function GuiText({
  text, color = '#E0E0E0', shadow = true, scale: scaleOverride, style, onClick,
}) {
  const gui = useGui();
  const scale = scaleOverride || gui?.scale || 1;
  const px = 8 * scale;
  const canvasRef = useRef(null);
  const w = text ? measureMcText(text, color, px) : 0;
  const h = Math.ceil(9 * scale);

  useLayoutEffect(() => {
    if (!text || w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = false;
    drawMcText(ctx, text, 0, 0, color, shadow, px);
  }, [text, color, shadow, px, w, h]);

  if (!text || w === 0) return null;
  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{
        width: w,
        height: h,
        cursor: onClick ? 'pointer' : 'inherit',
        ...style,
      }}
    />
  );
});

export default GuiText;