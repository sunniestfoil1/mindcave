// Módulos do Mind Client (menu no Shift direito). Cada módulo ligado tem efeito real no jogo (HUD, câmera, luz, partículas...).
// kind 'soon' = ainda sem implementação: aparece no menu (como no cliente de referência) mas fica apagado e não liga.
// Tipos de ajuste: toggle, slider, cycle, color. showIf(get) esconde o ajuste quando não se aplica.
export const MODULES = [
  { id: 'armorhud', name: 'Armor HUD', icon: 'Shield', kind: 'hud', defaultOn: false, desc: 'Mostra a armadura que você veste, com a durabilidade.',
    settings: [{ key: 'durability', type: 'toggle', label: 'Mostrar durabilidade', def: true }, { key: 'scale', type: 'slider', label: 'Tamanho', min: 50, max: 200, step: 10, def: 100, format: (v) => `${v}%` }] },
  { id: 'coordinates', name: 'Coordinates', icon: 'MapPin', kind: 'hud', defaultOn: false, desc: 'Posição XYZ do jogador.',
    settings: [{ key: 'decimals', type: 'cycle', label: 'Casas decimais', options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }], def: 0 }] },
  { id: 'cps', name: 'CPS', icon: 'MousePointerClick', kind: 'hud', defaultOn: false, desc: 'Cliques de ataque por segundo.', settings: [] },
  { id: 'direction', name: 'Direction Hud', icon: 'Compass', kind: 'hud', defaultOn: false, desc: 'Para onde você está olhando (N, L, S, O).', settings: [] },
  { id: 'fps', name: 'FPS', icon: 'BarChart3', kind: 'hud', defaultOn: false, desc: 'Quadros por segundo.', settings: [] },
  { id: 'keystrokes', name: 'Keystrokes', icon: 'Keyboard', kind: 'hud', defaultOn: false, desc: 'Teclas e botões do mouse apertados agora.',
    settings: [{ key: 'mouse', type: 'toggle', label: 'Botões do mouse', def: true }, { key: 'space', type: 'toggle', label: 'Barra de espaço', def: true }] },
  { id: 'memory', name: 'Memory', icon: 'Cpu', kind: 'hud', defaultOn: false, desc: 'Memória do navegador usada pelo jogo.', settings: [] },
  { id: 'packoverlay', name: 'Pack Overlay', icon: 'Layers', kind: 'hud', defaultOn: false, desc: 'Mostra o pacote de recursos ativo no canto superior esquerdo.', settings: [] },
  { id: 'ping', name: 'Ping Display', icon: 'Wifi', kind: 'hud', defaultOn: false, desc: 'Ping do multijogador (só aparece online).', settings: [] },
  { id: 'hitbox', name: 'Hitbox', icon: 'Box', kind: 'engine', defaultOn: false, desc: 'Mostra a caixa de colisão de mobs e jogadores (F3 + B).', settings: [] },
  { id: 'hitcolor', name: 'Hit Color', icon: 'Palette', kind: 'engine', defaultOn: true, desc: 'Cor que o mob pisca ao tomar dano.',
    settings: [
      { key: 'mode', type: 'cycle', label: 'Modo', options: [{ value: 'red', label: 'Vermelho' }, { value: 'rgb', label: 'RGB' }, { value: 'custom', label: 'Personalizada' }], def: 'red' },
      { key: 'color', type: 'color', label: 'Cor personalizada', def: '#ff3030', showIf: (get) => get('mode') === 'custom' },
      { key: 'intensity', type: 'slider', label: 'Intensidade', min: 10, max: 90, step: 5, def: 30, format: (v) => `${v}%` },
    ] },
  { id: 'inputfix', name: 'InputFix', icon: 'Languages', kind: 'engine', defaultOn: true, desc: 'Suporte aprimorado para caracteres acentuados, UTF-8 e colagem rápida.', settings: [] },
  { id: 'itemphysics', name: 'Item Physics', icon: 'Apple', kind: 'engine', defaultOn: false, desc: 'Itens soltos giram no ar e ficam deitados no chão.', settings: [] },
  { id: 'motionblur', name: 'Motion Blur', icon: 'Wind', kind: 'engine', defaultOn: false, desc: 'Desfoque de movimento suave ao girar a câmera (estilo Lunar/Badlion).',
    settings: [{ key: 'amount', type: 'slider', label: 'Intensidade', min: 1, max: 10, step: 1, def: 4, format: (v) => `${v}` }] },
  { id: 'nametags', name: 'Nametags', icon: 'Tag', kind: 'engine', defaultOn: true, desc: 'Nomes em cima dos jogadores.',
    settings: [{ key: 'others', type: 'toggle', label: 'Nome dos outros jogadores', def: true }, { key: 'own', type: 'toggle', label: 'Seu nome na 3ª pessoa', def: false }] },
  { id: 'particles', name: 'Particles', icon: 'Sparkles', kind: 'engine', defaultOn: true, desc: 'Partículas de bloco quebrado, respingo e fumaça.',
    settings: [{ key: 'amount', type: 'slider', label: 'Quantidade', min: 10, max: 100, step: 10, def: 100, format: (v) => `${v}%` }] },
  { id: 'perspective', name: 'Perspective', icon: 'RefreshCcw', kind: 'engine', defaultOn: true, desc: 'Segure ALT para olhar em volta sem virar o corpo.',
    settings: [] },
  { id: 'shinypots', name: 'Shiny Pots', icon: 'FlaskConical', kind: 'engine', defaultOn: true, desc: 'Efeito de brilho encantado (glint 1.8.9) nas poções e frascos.', settings: [] },
  { id: 'skins', name: 'Skins', icon: 'Box', kind: 'action', defaultOn: true, desc: 'Personalização de Skin, Capa e modelo (Steve / Alex / Custom / Nick).' },
  { id: 'tab', name: 'Tab', icon: 'List', kind: 'engine', defaultOn: true, desc: 'Lista de jogadores ao segurar Tab.', settings: [] },
  { id: 'fullbright', name: 'Fullbright', icon: 'Sun', kind: 'engine', defaultOn: false, desc: 'Luz máxima em todo lugar, de dia e de noite.', settings: [] },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));
