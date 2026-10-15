// Definições de opções para telas data-driven (PRD 03)

const isShaders = (store) => store.get('device.shaderMode') === 'shaders';

export const VIDEO_SECTIONS = (store) => [
  {
    name: 'Gráficos',
    options: [
      { type: 'button', key: 'device.graphics', label: 'Gráficos', options: [
        { value: 'fast', label: 'Rápidos' }, { value: 'fancy', label: 'Detalhados' }
      ], tooltip: 'Rápidos: folhas opacas, nuvens 2D, sem vinheta. Detalhados: visual clássico completo.', perfImpact: 'medium' },
      { type: 'slider', key: 'device.renderDistance', label: 'Distância de visão', min: 2, max: 32, step: 1,
        format: v => `${v} chunks${v > 16 ? ' (Experimental)' : ''}`,
        tooltip: 'Raio de carregamento de chunks ao redor do jogador. Valores altos exigem mais GPU/memória.', perfImpact: 'high' },
      { type: 'button', key: 'device.smoothLighting', label: 'Iluminação suave', options: [
        { value: 'off', label: 'Desligada' }, { value: 'min', label: 'Mínima' }, { value: 'max', label: 'Máxima' }
      ], tooltip: 'Iluminação suave entre blocos. Requer remeshing progressivo ao mudar.', perfImpact: 'medium' },
      { type: 'button', key: 'device.maxFps', label: 'FPS máximo', options: [
        { value: '30', label: '30' }, { value: '60', label: '60' }, { value: '120', label: '120' },
        { value: '260', label: '260' }, { value: 'vsync', label: 'VSync' }, { value: 'unlimited', label: 'Ilimitado' }
      ], tooltip: 'Limita a taxa de quadros. Em menus fora do jogo, limita a 30 para economizar.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.vsync', label: 'Sincronização vertical', tooltip: 'Evita tearing. Integra com FPS máximo.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.anaglyph3d', label: '3D anáglifo', tooltip: 'Render estéreo vermelho/ciano (experimental).', perfImpact: 'high', disabled: true, disabledReason: 'Em breve' },
      { type: 'toggle', key: 'user.viewBobbing', label: 'Balanço da visão', tooltip: 'Balanço da câmera ao andar.', perfImpact: 'none' },
      { type: 'button', key: 'device.guiScale', label: 'Escala da interface', options: [
        { value: 'auto', label: 'Auto' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }
      ], tooltip: 'Tamanho dos elementos da interface.', perfImpact: 'none' },
    ],
  },
  {
    name: 'Ambiente',
    options: [
      { type: 'slider', key: 'device.brightness', label: 'Brilho', min: 0, max: 100, step: 5,
        format: v => v === 0 ? 'Escuro' : v === 100 ? 'Claro' : `${v}%`,
        tooltip: 'Ajuste de gamma no lightmap. Clareia áreas escuras.', perfImpact: 'none' },
      { type: 'button', key: 'device.clouds', label: 'Nuvens', options: [
        { value: 'off', label: 'Desligadas' }, { value: 'fast', label: 'Rápidas' }, { value: 'fancy', label: 'Detalhadas' }
      ], tooltip: 'Nuvens 2D rápidas ou volumétricas detalhadas.', perfImpact: 'low' },
      { type: 'button', key: 'device.particles', label: 'Partículas', options: [
        { value: 'all', label: 'Todas' }, { value: 'decreased', label: 'Reduzidas' }, { value: 'minimal', label: 'Mínimas' }
      ], tooltip: 'Mínimas ainda mostra partículas essenciais.', perfImpact: 'low' },
      { type: 'slider', key: 'device.mipmaps', label: 'Níveis de mipmap', min: 0, max: 4, step: 1,
        format: v => v === 0 ? 'Sem mipmap' : `${v}`,
        tooltip: 'Texturas suavizadas à distância. 0 = mais serrilhado.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.entityShadows', label: 'Sombras de entidades', tooltip: 'Sombra redonda escura sob jogadores e mobs.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.alternatingBlocks', label: 'Blocos alternativos', tooltip: 'Variação aleatória de textura/rotação.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.fullscreen', label: 'Tela cheia', tooltip: 'Modo tela cheia (F11).', perfImpact: 'none' },
    ],
  },
  {
    name: 'Detalhes',
    options: [
      { type: 'slider', key: 'device.resolutionScale', label: 'Escala de resolução', min: 50, max: 200, step: 5,
        format: v => `${v}%`, tooltip: 'Render interno em resolução menor/maior. Mais eficaz para GPUs fracas.', perfImpact: 'high' },
      { type: 'button', key: 'device.anisotropicFiltering', label: 'Filtragem anisotrópica', options: [
        { value: 0, label: 'Desl.' }, { value: 2, label: '2×' }, { value: 4, label: '4×' }, { value: 8, label: '8×' }, { value: 16, label: '16×' }
      ], tooltip: 'Texturas nítidas em ângulo rasante.', perfImpact: 'low' },
      { type: 'button', key: 'device.leaves', label: 'Folhas', options: [
        { value: 'default', label: 'Padrão' }, { value: 'fast', label: 'Rápidas' }, { value: 'fancy', label: 'Detalhadas' }, { value: 'smart', label: 'Inteligentes' }
      ], tooltip: 'Inteligentes: detalhadas na borda, opacas no interior.', perfImpact: 'medium' },
      { type: 'button', key: 'device.betterGrass', label: 'Grama melhorada', options: [
        { value: 'off', label: 'Desl.' }, { value: 'fast', label: 'Rápida' }, { value: 'fancy', label: 'Detalhada' }
      ], tooltip: 'Lado do bloco de grama mostra textura do topo.', perfImpact: 'low' },
      { type: 'button', key: 'device.fog', label: 'Névoa', options: [
        { value: 'off', label: 'Desl.' }, { value: 'fast', label: 'Rápida' }, { value: 'fancy', label: 'Detalhada' }
      ], tooltip: 'Desligar mostra a borda de chunks.', perfImpact: 'none' },
      { type: 'slider', key: 'device.fogStart', label: 'Início da névoa', min: 20, max: 80, step: 5, format: v => `${v}%`, tooltip: 'Distância onde a névoa começa.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.sky', label: 'Céu', tooltip: 'Renderiza o céu.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.customSky', label: 'Céu personalizado', tooltip: 'Usa o céu do pacote de textura (OptiFine/CEU.zip). Se desativado, usa o céu padrão procedural.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.sun', label: 'Sol e lua', tooltip: 'Renderiza sol e lua.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.stars', label: 'Estrelas', tooltip: 'Renderiza estrelas à noite.', perfImpact: 'low' },
      { type: 'button', key: 'device.animatedTextures', label: 'Texturas animadas', options: [
        { value: 'all', label: 'Todas' }, { value: 'dynamic', label: 'Dinâmicas' }, { value: 'off', label: 'Desligadas' }
      ], tooltip: 'Desligar fixa no primeiro quadro.', perfImpact: 'low' },
      { type: 'button', key: 'device.dynamicLights', label: 'Luzes dinâmicas', options: [
        { value: 'off', label: 'Desl.' }, { value: 'fast', label: 'Rápida (500ms)' }, { value: 'detailed', label: 'Detalhada (por quadro)' }
      ], tooltip: 'Item luminoso na mão emite luz. Apenas visual.', perfImpact: 'medium' },
      { type: 'slider', key: 'device.entityDistance', label: 'Distância de entidades', min: 50, max: 500, step: 10, format: v => `${v}%`, tooltip: 'Multiplica a distância de renderização de mobs/itens.', perfImpact: 'medium' },
      { type: 'slider', key: 'device.chunkUpdatesPerFrame', label: 'Atualizações de chunk por quadro', min: 1, max: 8, step: 1, tooltip: 'Troca entre suavidade e velocidade de carregamento.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.smoothCamera', label: 'Câmera suave', tooltip: 'Suavização do mouse (modo cinemático). F8 para alternar.', perfImpact: 'none' },
      { type: 'slider', key: 'device.fovEffects', label: 'Efeitos de FOV', min: 0, max: 100, step: 5, format: v => `${v}%`, tooltip: 'Variação de FOV por sprint, voo, etc.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.showFps', label: 'Mostrar FPS no canto', tooltip: 'Contador pequeno sem abrir o F3.', perfImpact: 'none' },
      { type: 'slider', key: 'device.screenShake', label: 'Tremor de tela', min: 0, max: 100, step: 5, format: v => `${v}%`, tooltip: 'Escala tremores de explosão e recuo.', perfImpact: 'none' },
    ],
  },
];

export const SHADOW_SECTIONS = (store) => [
  {
    name: 'Sombras',
    options: [
      { type: 'toggle', key: 'device.entityBlobShadows', label: 'Sombras de entidades (blob)', tooltip: 'Sombra redonda escura sob jogadores, mobs e itens.', perfImpact: 'low' },
      { type: 'button', key: 'device.sunShadows', label: 'Sombras dinâmicas do sol/lua', options: [
        { value: 'off', label: 'Desligadas' }, { value: 'low', label: 'Baixa' }, { value: 'medium', label: 'Média' },
        { value: 'high', label: 'Alta' }, { value: 'ultra', label: 'Ultra' }
      ], tooltip: 'Sombras projetadas pelo sol/lua. Requer modo Shaders.', perfImpact: 'high',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'button', key: 'device.shadowResolution', label: 'Resolução do mapa de sombra', options: [
        { value: 512, label: '512' }, { value: 1024, label: '1024' }, { value: 2048, label: '2048' }, { value: 4096, label: '4096' }
      ], tooltip: 'Resolução do shadow map. Maior = mais nítido.', perfImpact: 'high',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'slider', key: 'device.shadowDistance', label: 'Distância das sombras', min: 32, max: 192, step: 16, format: v => `${v} blocos`, tooltip: 'Alcance das sombras dinâmicas.', perfImpact: 'high',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'slider', key: 'device.shadowCascades', label: 'Número de cascatas', min: 1, max: 4, step: 1, tooltip: 'Cascatas melhoram a qualidade perto do jogador.', perfImpact: 'high',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'button', key: 'device.shadowSmoothness', label: 'Suavidade', options: [
        { value: 'hard', label: 'Dura' }, { value: 'pcf', label: 'PCF' }, { value: 'pcf_soft', label: 'PCF suave' }, { value: 'pcss', label: 'PCSS' }
      ], tooltip: 'Algoritmo de suavização de bordas das sombras.', perfImpact: 'medium',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'toggle', key: 'device.foliageShadows', label: 'Sombras de folhagem', tooltip: 'Folhas projetam sombra com alpha-teste.', perfImpact: 'medium',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'toggle', key: 'device.entityShadowCast', label: 'Sombras de entidades dinâmicas', tooltip: 'Mobs/jogadores projetam sombra real.', perfImpact: 'medium',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'toggle', key: 'device.cloudShadows', label: 'Sombras de nuvens', tooltip: 'Nuvens projetam sombra no terreno.', perfImpact: 'medium',
        disabled: !isShaders(store), disabledReason: 'Ative o modo Shaders' },
      { type: 'button', key: 'device.ambientOcclusion', label: 'Oclusão ambiente', options: [
        { value: 'off', label: 'Desl.' }, { value: 'vertex', label: 'Só vértice (clássico)' }, { value: 'ssao', label: 'SSAO' }, { value: 'gtao', label: 'GTAO' }
      ], tooltip: 'SSAO/GTAO só em modo Shaders.', perfImpact: 'medium' },
    ],
  },
];

export const SHADERS_SECTIONS = (store) => [
  {
    name: 'Modo de render',
    options: [
      { type: 'button', key: 'device.shaderMode', label: 'Modo de render', options: [
        { value: 'classic', label: 'Clássico' }, { value: 'shaders', label: 'Shaders' }
      ], tooltip: 'Clássico: renderização tradicional. Shaders: pós-processamento e efeitos avançados.', perfImpact: 'high' },
      { type: 'button', key: 'device.shaderPreset', label: 'Predefinição', options: [
        { value: 'off', label: 'Desligado' }, { value: 'light', label: 'Leve' }, { value: 'medium', label: 'Médio' },
        { value: 'high', label: 'Alto' }, { value: 'ultra', label: 'Ultra' }, { value: 'cinematic', label: 'Cinemático' }, { value: 'custom', label: 'Personalizado' }
      ], tooltip: 'Mudar um parâmetro individual transforma em "Personalizado".', perfImpact: 'high' },
    ],
  },
  {
    name: 'Iluminação',
    options: [
      { type: 'slider', key: 'device.sunIntensity', label: 'Intensidade do sol', min: 0, max: 200, step: 5, format: v => `${v}%`, tooltip: 'Brilho da luz solar.', perfImpact: 'none' },
      { type: 'slider', key: 'device.blockLightIntensity', label: 'Intensidade da luz de bloco', min: 0, max: 200, step: 5, format: v => `${v}%`, tooltip: 'Brilho de tochas, lava, glowstone.', perfImpact: 'none' },
      { type: 'button', key: 'device.blockLightColor', label: 'Cor da luz de bloco', options: [
        { value: 'warm', label: 'Quente' }, { value: 'neutral', label: 'Neutra' }, { value: 'cold', label: 'Fria' }
      ], tooltip: 'Temperatura de cor da luz de bloco.', perfImpact: 'none' },
      { type: 'slider', key: 'device.nightBrightness', label: 'Brilho ambiente noturno', min: 0, max: 20, step: 1, tooltip: 'Iluminação mínima à noite.', perfImpact: 'none' },
      { type: 'slider', key: 'device.exposure', label: 'Exposição', min: 0, max: 200, step: 5, format: v => `${v}%`, tooltip: 'Exposição geral da cena.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.autoExposure', label: 'Adaptação automática', tooltip: 'Ajusta exposição automaticamente.', perfImpact: 'low' },
      { type: 'button', key: 'device.tonemapping', label: 'Tonemapping', options: [
        { value: 'aces', label: 'ACES' }, { value: 'agx', label: 'AgX' }, { value: 'off', label: 'Desligado' }
      ], tooltip: 'Operador de mapeamento de tons.', perfImpact: 'low' },
    ],
  },
  {
    name: 'Água',
    options: [
      { type: 'button', key: 'device.waterWaves', label: 'Ondas', options: [
        { value: 'off', label: 'Desl.' }, { value: 'low', label: 'Baixa' }, { value: 'high', label: 'Alta' }
      ], tooltip: 'Ondas na superfície da água.', perfImpact: 'medium' },
      { type: 'slider', key: 'device.waveHeight', label: 'Altura das ondas', min: 0, max: 100, step: 5, format: v => `${v}%`, perfImpact: 'low' },
      { type: 'button', key: 'device.waterReflections', label: 'Reflexos', options: [
        { value: 'off', label: 'Desl.' }, { value: 'sky', label: 'Céu' }, { value: 'ssr_low', label: 'SSR baixo' }, { value: 'ssr_high', label: 'SSR alto' }
      ], tooltip: 'Reflexos na água. SSR = screen-space reflections.', perfImpact: 'high' },
      { type: 'toggle', key: 'device.waterRefraction', label: 'Refração', tooltip: 'Distorção ao olhar através da água.', perfImpact: 'medium' },
      { type: 'toggle', key: 'device.waterCaustics', label: 'Cáusticas', tooltip: 'Padrões de luz no fundo da água.', perfImpact: 'medium' },
      { type: 'toggle', key: 'device.waterFoam', label: 'Espuma', tooltip: 'Espuma nas bordas da água.', perfImpact: 'low' },
    ],
  },
  {
    name: 'Pós-processamento',
    options: [
      { type: 'slider', key: 'device.bloom', label: 'Bloom', min: 0, max: 100, step: 5, format: v => v === 0 ? 'Desl.' : `${v}%`, tooltip: 'Brilho em torno de fontes de luz.', perfImpact: 'medium' },
      { type: 'slider', key: 'device.vignette', label: 'Vinheta', min: 0, max: 100, step: 5, format: v => v === 0 ? 'Desl.' : `${v}%`, tooltip: 'Escurecimento nas bordas da tela.', perfImpact: 'low' },
      { type: 'slider', key: 'device.saturation', label: 'Saturação', min: 0, max: 200, step: 5, format: v => `${v}%`, tooltip: 'Intensidade das cores.', perfImpact: 'low' },
      { type: 'slider', key: 'device.contrast', label: 'Contraste', min: 0, max: 200, step: 5, format: v => `${v}%`, perfImpact: 'low' },
      { type: 'slider', key: 'device.colorTemp', label: 'Temperatura de cor', min: -100, max: 100, step: 5, format: v => `${v}`, tooltip: 'Negativo = mais frio, positivo = mais quente.', perfImpact: 'low' },
      { type: 'slider', key: 'device.chromaticAberration', label: 'Aberração cromática', min: 0, max: 100, step: 5, format: v => v === 0 ? '0' : `${v}%`, perfImpact: 'low' },
      { type: 'slider', key: 'device.grain', label: 'Granulação', min: 0, max: 100, step: 5, format: v => v === 0 ? '0' : `${v}%`, perfImpact: 'low' },
      { type: 'slider', key: 'device.sharpness', label: 'Nitidez', min: 0, max: 100, step: 5, format: v => v === 0 ? 'Desl.' : `${v}%`, perfImpact: 'low' },
      { type: 'button', key: 'device.antialiasing', label: 'Antisserrilhamento', options: [
        { value: 'off', label: 'Desl.' }, { value: 'fxaa', label: 'FXAA' }, { value: 'smaa', label: 'SMAA' }, { value: 'taa', label: 'TAA' }
      ], tooltip: 'Suavização de bordas.', perfImpact: 'medium' },
    ],
  },
];

export const AUDIO_SECTIONS = [
  {
    name: 'Volume',
    options: [
      { type: 'slider', key: 'user.volumeMaster', label: 'Volume mestre', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeMusic', label: 'Música', min: 0, max: 100, step: 1, format: v => `${v}%`, tooltip: 'Música de fundo.', perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeRecords', label: 'Discos', min: 0, max: 100, step: 1, format: v => `${v}%`, tooltip: 'Toca-discos.', perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeWeather', label: 'Clima', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeBlocks', label: 'Blocos', min: 0, max: 100, step: 1, format: v => `${v}%`, tooltip: 'Sons de quebrar/colocar blocos.', perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeHostile', label: 'Criaturas hostis', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeNeutral', label: 'Criaturas amigáveis', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumePlayers', label: 'Jogadores', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeAmbient', label: 'Ambiente/Cavernas', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeWeapons', label: 'Armas (Mind Cave)', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.volumeUi', label: 'Interface', min: 0, max: 100, step: 1, format: v => `${v}%`, perfImpact: 'none' },
    ],
  },
  {
    name: 'Dispositivo',
    options: [
      { type: 'button', key: 'user.audioDevice', label: 'Dispositivo de saída', options: [{ value: 'default', label: 'Padrão do sistema' }], tooltip: 'Lista de saídas quando o navegador permitir.', perfImpact: 'none' },
      { type: 'button', key: 'user.audioOnFocusLoss', label: 'Áudio quando a janela perde o foco', options: [
        { value: 'mute', label: 'Silenciar' }, { value: 'reduce', label: 'Reduzir 50%' }, { value: 'keep', label: 'Manter' }
      ], tooltip: 'Comportamento ao trocar de aba/janela.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.subtitles', label: 'Legendas', tooltip: 'Legendas de sons no canto (acessibilidade).', perfImpact: 'none' },
    ],
  },
];

export const CHAT_SECTIONS = [
  {
    name: 'Chat',
    options: [
      { type: 'button', key: 'user.chat', label: 'Chat', options: [
        { value: 'visible', label: 'Visível' }, { value: 'commands_only', label: 'Somente comandos' }, { value: 'hidden', label: 'Oculto' }
      ], tooltip: 'Controla a visibilidade do chat.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.chatColors', label: 'Cores', tooltip: 'Remove códigos § quando desligado.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.webLinks', label: 'Links da web', tooltip: 'Torna URLs clicáveis.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.confirmLinks', label: 'Confirmar ao abrir links', perfImpact: 'none' },
      { type: 'slider', key: 'user.textOpacity', label: 'Opacidade do texto', min: 10, max: 100, step: 5, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.bgOpacity', label: 'Opacidade do fundo', min: 0, max: 100, step: 5, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.chatScale', label: 'Escala', min: 0, max: 100, step: 5, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'slider', key: 'user.chatWidth', label: 'Largura', min: 40, max: 320, step: 10, format: v => `${v}px`, perfImpact: 'none' },
      { type: 'slider', key: 'user.chatHeightFocused', label: 'Altura (focado)', min: 20, max: 180, step: 10, format: v => `${v}px`, perfImpact: 'none' },
      { type: 'slider', key: 'user.chatHeightUnfocused', label: 'Altura (não focado)', min: 20, max: 180, step: 10, format: v => `${v}px`, perfImpact: 'none' },
      { type: 'slider', key: 'user.chatVisibleTime', label: 'Tempo visível', min: 2, max: 60, step: 1, format: v => `${v}s`, perfImpact: 'none' },
      { type: 'toggle', key: 'user.reducedDebugInfo', label: 'Informações de debug reduzidas', tooltip: 'Esconde coordenadas no F3.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.chatTimestamp', label: 'Carimbo de hora', tooltip: 'Mostra horário em cada mensagem (extensão).', perfImpact: 'none' },
    ],
  },
];

export const ACCESSIBILITY_SECTIONS = [
  {
    name: 'Acessibilidade',
    options: [
      { type: 'toggle', key: 'user.soundCaptions', label: 'Legendas de sons', tooltip: 'Lista no canto com nome do som e direção.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.reduceFlashes', label: 'Reduzir flashes', tooltip: 'Suaviza clarão de dano, relâmpagos e disparos.', perfImpact: 'none' },
      { type: 'button', key: 'user.textBackground', label: 'Fundo do texto', options: [
        { value: 'chat', label: 'Só no chat' }, { value: 'all', label: 'Todo texto' }
      ], tooltip: 'Onde aplicar fundo atrás do texto.', perfImpact: 'none' },
      { type: 'slider', key: 'user.textBgOpacity', label: 'Opacidade do fundo do texto', min: 0, max: 100, step: 5, format: v => `${v}%`, perfImpact: 'none' },
      { type: 'toggle', key: 'user.highContrastCrosshair', label: 'Mira de alto contraste', tooltip: 'Mira com contorno.', perfImpact: 'none' },
      { type: 'button', key: 'user.colorBlindFilter', label: 'Filtro de daltonismo', options: [
        { value: 'none', label: 'Nenhum' }, { value: 'protanopia', label: 'Protanopia' },
        { value: 'deuteranopia', label: 'Deuteranopia' }, { value: 'tritanopia', label: 'Tritanopia' }
      ], tooltip: 'Filtro de cor pós-processamento.', perfImpact: 'low' },
      { type: 'slider', key: 'user.minTextScale', label: 'Tamanho mínimo de texto', min: 0, max: 4, step: 1, format: v => v === 0 ? 'Auto' : `${v}`, tooltip: 'Força escala de GUI ≥ N para texto.', perfImpact: 'none' },
      { type: 'toggle', key: 'user.hideDistortion', label: 'Ocultar efeito de distorção', tooltip: 'Substitui náusea/portal por tom esverdeado.', perfImpact: 'none' },
    ],
  },
];

export const PERFORMANCE_SECTIONS = [
  {
    name: 'Desempenho avançado',
    options: [
      { type: 'button', key: 'device.meshingWorkers', label: 'Workers de meshing', options: [
        { value: 'auto', label: 'Auto' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 8, label: '8' }
      ], tooltip: 'Auto = núcleos−2. Workers constroem malhas em paralelo.', perfImpact: 'medium' },
      { type: 'button', key: 'device.genWorkers', label: 'Workers de geração (host)', options: [
        { value: 'auto', label: 'Auto' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }
      ], tooltip: 'Geração de terreno em paralelo.', perfImpact: 'medium' },
      { type: 'button', key: 'device.memoryBudget', label: 'Orçamento de memória', options: [
        { value: 'auto', label: 'Auto' }, { value: 256, label: '256 MB' }, { value: 512, label: '512 MB' }, { value: 1024, label: '1 GB' }, { value: 2048, label: '2 GB' }
      ], tooltip: 'Limita chunks em cache. Descarrega os mais distantes primeiro.', perfImpact: 'medium' },
      { type: 'button', key: 'device.loadPace', label: 'Ritmo de carregamento', options: [
        { value: 'smooth', label: 'Suave' }, { value: 'balanced', label: 'Equilibrado' }, { value: 'fast', label: 'Rápido' }
      ], tooltip: 'Suave = menos chunks/quadro, sem engasgos.', perfImpact: 'low' },
      { type: 'button', key: 'device.greedyMeshing', label: 'Greedy meshing', options: [
        { value: 'auto', label: 'Auto' }, { value: 'on', label: 'Ligado' }, { value: 'off', label: 'Desligado' }
      ], tooltip: 'Combina faces adjacentes. Menos vértices, mais processamento.', perfImpact: 'medium' },
      { type: 'toggle', key: 'device.pauseRenderWhenHidden', label: 'Pausar render quando a aba está oculta', tooltip: 'O servidor do host continua rodando; só o render para.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.powerSaver', label: 'Economia de energia', tooltip: 'Limita a 30 FPS e reduz distância em 2 quando na bateria.', perfImpact: 'low' },
      { type: 'toggle', key: 'device.perfGraph', label: 'Gráfico de desempenho', tooltip: 'Gráfico de tempo de quadro (CPU/GPU) e TPS.', perfImpact: 'low' },
    ],
  },
];

export const NETWORK_SECTIONS = [
  {
    name: 'Rede',
    options: [
      { type: 'button', key: 'device.interpolationDelay', label: 'Atraso de interpolação', options: [
        { value: 'auto', label: 'Automático (100ms)' },
        { value: 50, label: '50ms' }, { value: 100, label: '100ms' }, { value: 150, label: '150ms' }, { value: 300, label: '300ms' }
      ], tooltip: 'Automático ajusta pelo jitter. Menor = mais responsivo, maior = mais suave.', perfImpact: 'none' },
      { type: 'toggle', key: 'device.showPing', label: 'Mostrar ping na lista', perfImpact: 'none' },
      { type: 'toggle', key: 'device.showNetIndicator', label: 'Mostrar indicador de rede', tooltip: 'Pequeno gráfico de ping/perda no canto.', perfImpact: 'low' },
    ],
  },
];