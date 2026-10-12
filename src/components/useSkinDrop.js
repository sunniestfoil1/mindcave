import { useEffect, useRef } from 'react';

// Arrastar-e-soltar de arquivo enquanto a tela estiver montada.
// Sem isso o navegador abre a imagem em outra aba no lugar de aceitá-la.
export function useSkinDrop(onDropFile) {
  const cb = useRef(onDropFile);
  cb.current = onDropFile;
  useEffect(() => {
    const over = (e) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();
    };
    const drop = (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();
      cb.current?.(file);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);
}
