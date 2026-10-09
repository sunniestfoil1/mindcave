import React, { createContext, useContext, useState, useEffect } from 'react';
import { getGuiScale } from '@/game/gui/scale';
import { settingsStore } from '@/game/settingsStore';

const GuiContext = createContext({ scale: 1, guiWidth: 0, guiHeight: 0 });

export function useGui() { return useContext(GuiContext); }

export function GuiProvider({ children }) {
  const [dims, setDims] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  useEffect(() => {
    const onResize = () => setDims({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const guiScaleSetting = settingsStore.get('device.guiScale');
  const maxFactor = guiScaleSetting === 'auto' || !guiScaleSetting ? 0 : parseInt(guiScaleSetting);
  const scale = getGuiScale(dims.width, dims.height, maxFactor);
  const guiWidth = Math.floor(dims.width / scale);
  const guiHeight = Math.floor(dims.height / scale);

  return (
    <GuiContext.Provider value={{ scale, guiWidth, guiHeight, screenWidth: dims.width, screenHeight: dims.height }}>
      {children}
    </GuiContext.Provider>
  );
}

export default GuiContext;