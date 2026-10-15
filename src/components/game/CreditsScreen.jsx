import React, { useEffect, useState } from 'react';
import { GuiScreen, GuiButton, GuiText, useGui } from '@/components/java';

const DEVS = ['Junior', 'Deyvid'];
const LIBS = [
  { name: 'Three.js', license: 'MIT' },
  { name: 'React', license: 'MIT' },
  { name: 'Tailwind CSS', license: 'MIT' },
  { name: 'shadcn/ui', license: 'MIT' },
  { name: 'Supabase JS', license: 'MIT' },
];

function CreditsContent({ onClose }) {
  const { guiHeight, scale } = useGui();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setScrollY((y) => (y > 420 ? -80 : y + 0.5));
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const Line = ({ text, color = '#FFFFFF', s = scale, gap = 6 }) => (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: gap * scale }}>
      <GuiText text={text} color={color} shadow scale={s} />
    </div>
  );

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          bottom: 36 * scale,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: `translateY(${(guiHeight - 40 - scrollY) * scale}px)`, textAlign: 'center' }}>
          <Line text="=== MIND CAVE ===" color="#FFFF55" s={scale * 1.5} gap={10} />
          <Line text="Minecraft 1.8.9 Web Edition" color="#A0A0A0" gap={16} />

          <Line text="Desenvolvedores" color="#55FFFF" gap={6} />
          {DEVS.map((d) => (
            <Line key={d} text={d} color="#FFFFFF" gap={4} />
          ))}

          <div style={{ height: 14 * scale }} />
          <Line text="Tecnologias & Bibliotecas" color="#55FFFF" gap={6} />
          {LIBS.map((l) => (
            <Line key={l.name} text={`${l.name} (${l.license})`} color="#CCCCCC" gap={4} />
          ))}

          <div style={{ height: 14 * scale }} />
          <Line text="Atribuições de Assets" color="#55FFFF" gap={6} />
          <Line text="Interface, texturas e modelos baseados no Minecraft 1.8.9" color="#A0A0A0" gap={4} />
          <Line text="Trilha sonora original por C418" color="#A0A0A0" gap={16} />

          <Line text="Obrigado por jogar Mind Cave!" color="#55FF55" gap={12} />
        </div>
      </div>

      <GuiButton x={-100} y={guiHeight - 28} width={200} label="Concluído" onClick={onClose} />
    </>
  );
}

export default function CreditsScreen({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <GuiScreen background="dirt">
        <CreditsContent onClose={onClose} />
      </GuiScreen>
    </div>
  );
}