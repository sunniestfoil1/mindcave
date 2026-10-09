import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DEVS = ['Desenvolvedor 1', 'Desenvolvedor 2'];
const LIBS = [
  { name: 'Three.js', license: 'MIT', url: 'https://threejs.org' },
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
  { name: 'shadcn/ui', license: 'MIT', url: 'https://ui.shadcn.com' },
  { name: 'lucide-react', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'Supabase JS', license: 'MIT', url: 'https://supabase.com' },
  { name: 'date-fns', license: 'MIT', url: 'https://date-fns.org' },
  { name: 'recharts', license: 'MIT', url: 'https://recharts.org' },
  { name: 'framer-motion', license: 'MIT', url: 'https://www.framer.com/motion' },
  { name: 'react-leaflet', license: 'MIT', url: 'https://react-leaflet.js.org' },
];

export default function CreditsScreen({ onClose }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setScrollY(y => {
        if (y > 600) return -100;
        return y + 0.5;
      });
    }, 30);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center overflow-hidden">
      <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white z-10">
        <X size={24} />
      </button>
      <div className="text-center" style={{ transform: `translateY(${-scrollY}px)`, marginTop: '100vh' }}>
        <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'monospace' }}>MIND CAVE</h1>
        <p className="text-yellow-300 text-sm mb-8">dev-build</p>

        <h2 className="text-xl text-white/80 font-semibold mb-4">Desenvolvedores</h2>
        {DEVS.map(d => <p key={d} className="text-white/60 text-sm mb-1">{d}</p>)}

        <div className="h-8" />
        <h2 className="text-xl text-white/80 font-semibold mb-4">Bibliotecas</h2>
        {LIBS.map(l => (
          <div key={l.name} className="mb-2">
            <span className="text-white/70 text-sm">{l.name}</span>
            <span className="text-white/40 text-xs ml-2">{l.license}</span>
          </div>
        ))}

        <div className="h-8" />
        <h2 className="text-xl text-white/80 font-semibold mb-4">Atribuições de Assets</h2>
        <p className="text-white/50 text-sm">Texturas, modelos e sons gerados proceduralmente ou criados pelos desenvolvedores.</p>
        <p className="text-white/40 text-xs mt-2">Atribuições específicas são geradas automaticamente a partir das licenças cadastradas no Studio.</p>

        <div className="h-8" />
        <p className="text-white/30 text-xs">Obrigado por jogar Mind Cave.</p>
        <div className="h-[100vh]" />
      </div>
    </div>
  );
}