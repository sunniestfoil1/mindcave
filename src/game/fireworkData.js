// Dados dos fogos de artifício (sem dependências): usados pelo registro de itens e pelo motor de fogos.
// ItemDye.dyeColors do 1.8.9
export const DYE_RGB = [1908001, 11743532, 3887386, 5320730, 2437522, 8073150, 2651799, 11250603, 4408131, 14188952, 4312372, 14602026, 6719955, 12801229, 15435844, 15790320];
const [, RED, GREEN, , BLUE, PURPLE, , , , PINK, LIME, YELLOW, LIGHT_BLUE, MAGENTA, ORANGE, WHITE] = DYE_RGB;

// type: 0 bola pequena, 1 bola grande, 2 estrela, 3 creeper, 4 explosão. A meta do item (fogos e estrela) é o índice desta lista.
export const FIREWORK_PRESETS = [
  { name: 'Bola Pequena Vermelha', flight: 1, ex: { type: 0, colors: [RED], fade: [], trail: false, twinkle: false } },
  { name: 'Bola Grande Azul', flight: 2, ex: { type: 1, colors: [BLUE], fade: [LIGHT_BLUE], trail: false, twinkle: false } },
  { name: 'Estrela Amarela', flight: 2, ex: { type: 2, colors: [YELLOW, ORANGE], fade: [], trail: true, twinkle: false } },
  { name: 'Creeper Verde', flight: 2, ex: { type: 3, colors: [GREEN, LIME], fade: [], trail: false, twinkle: false } },
  { name: 'Explosão Branca', flight: 3, ex: { type: 4, colors: [WHITE, LIGHT_BLUE, PINK], fade: [WHITE], trail: false, twinkle: true } },
  { name: 'Bola Grande Colorida com Rastro', flight: 3, ex: { type: 1, colors: [RED, YELLOW, LIME, BLUE], fade: [MAGENTA], trail: true, twinkle: true } },
  { name: 'Estrela Rosa e Roxa', flight: 2, ex: { type: 2, colors: [PINK, MAGENTA], fade: [PURPLE], trail: false, twinkle: true } },
  { name: 'Foguete sem Explosão', flight: 1, ex: null },
];
export const FIREWORK_NAMES = FIREWORK_PRESETS.map((p) => 'Fogos de Artifício: ' + p.name);
// esparso: só os presets com explosão viram estrela (o índice é a meta do item)
export const STAR_NAMES = [];
FIREWORK_PRESETS.forEach((p, i) => { if (p.ex) STAR_NAMES[i] = 'Estrela de Fogos: ' + p.name; });

