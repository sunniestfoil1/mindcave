import React, { useRef, useLayoutEffect } from 'react';
import { useGui } from './GuiContext';
import { drawMcText, measureMcText } from '@/game/gui/font';

// Renders bitmap text on a canvas. Dimensions are measured synchronously
// during render and drawn in useLayoutEffect (before paint) to avoid
// any blank flash where buttons appear without their labels.
export default function GuiText({ text, color = '#E0E0E0', shadow = true, scale: scaleOverride, style, onClick }) {
  const gui = useGui();
  const scale = scaleOverride || gui?.scale || 1;
  const px = 8 * scale;
  const canvasRef = useRef(null);

  // Measure synchronously — no state, no async effect, no blank frame
  const w = text ? measureMcText(text, color, px) : 0;
  const h = Math.ceil(9 * scale);

  useLayoutEffect(() => {
    if (!text || w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
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
}