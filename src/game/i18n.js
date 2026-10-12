// i18n — PRD 03 §7 e PRD 20 §2.7: todo texto de tela vem de chaves.
// 5 idiomas no total, com Português (Brasil) e English primeiro.
// Valores de chaves oficiais do Minecraft copiados de assets/minecraft/lang/*.lang
// (pacote 1.8.9); textos próprios do Mind Cave traduzidos manualmente.
// Chave ausente no idioma cai para o pt; chave desconhecida volta como está.
import { settingsStore, useSettings } from './settingsStore';

// Ordem dos arrays de tradução = ordem deste lista
export const LANGS = [
  { id: 'pt_BR', name: 'Português (Brasil)' },
  { id: 'en_US', name: 'English' },
  { id: 'es_ES', name: 'Español (España)' },
  { id: 'fr_FR', name: 'Français (France)' },
  { id: 'de_DE', name: 'Deutsch (Deutschland)' },
];

const LANG_IDS = LANGS.map(l => l.id);
const DEFAULT_LANG = 'pt_BR';

// [pt, en, es, fr, de]
const S = {
  // Menu principal (chaves oficiais menu.*)
  'menu.singleplayer': ['Um jogador', 'Singleplayer', 'Un jugador', 'Solo', 'Einzelspieler'],
  'menu.multiplayer': ['Multijogador', 'Multiplayer', 'Multijugador', 'Multijoueur', 'Mehrspieler'],
  'menu.options': ['Opções...', 'Options...', 'Opciones...', 'Options...', 'Optionen ...'],

  // Opções (chaves oficiais options.*)
  'options.title': ['Opções', 'Options', 'Opciones', 'Options', 'Optionen'],
  'options.fov': ['Campo de visão', 'FOV', 'Campo de visión', 'Champ de vision', 'Sichtfeld (FOV)'],
  'options.fov.min': ['Normal', 'Normal', 'Normal', 'Normal', 'Normal'],
  'options.fov.max': ['Quake Pro', 'Quake Pro', 'Quake Pro', 'Quake Pro', 'Quake Pro'],
  'options.difficulty': ['Dificuldade', 'Difficulty', 'Dificultad', 'Difficulté', 'Schwierigkeit'],
  'options.language': ['Idioma...', 'Language...', 'Idioma...', 'Langue...', 'Sprache ...'],
  'options.languageTitle': ['Idioma', 'Language', 'Idioma', 'Langue', 'Sprache'],
  'options.languageWarning': [
    'As traduções podem não ser 100% corretas',
    'Language translations may not be 100% accurate',
    'Algunas traducciones pueden contener errores',
    'Certaines traductions peuvent être inexactes',
    'Die Übersetzungen sind möglicherweise nicht zu 100% korrekt',
  ],
  'options.sounds': ['Músicas e sons...', 'Music & Sounds...', 'Música y sonido...', 'Musique & sons...', 'Musik & Geräusche ...'],
  'options.sounds.title': ['Música e Sons', 'Music & Sound Options', 'Opciones de música y sonido', 'Options pour la musique et les sons', 'Musik- & Geräuschoptionen'],
  'options.video': ['Configurações de vídeo...', 'Video Settings...', 'Ajustes de vídeo...', 'Options graphiques...', 'Grafikeinstellungen ...'],
  'options.videoTitle': ['Configurações de Vídeo', 'Video Settings', 'Ajustes de vídeo', 'Options graphiques', 'Grafikeinstellungen'],
  'options.controls': ['Controles...', 'Controls...', 'Controles...', 'Contrôles...', 'Steuerung ...'],
  'options.chat.title': ['Configurações do chat...', 'Chat Settings...', 'Ajustes de chat...', 'Options de discussion...', 'Chateinstellungen ...'],
  'options.chatTitle': ['Configurações de Chat', 'Chat Settings', 'Ajustes de chat', 'Options de discussion', 'Chateinstellungen'],
  'options.resourcepack': ['Pacotes de recursos...', 'Resource Packs...', 'Paquetes de recursos...', 'Packs de ressources...', 'Ressourcenpakete ...'],
  'options.multiplayer.title': ['Multijogador e rede...', 'Multiplayer Settings...', 'Ajustes de multijugador...', 'Paramètres multijoueur...', 'Mehrspielereinstellungen ...'],
  'options.multiplayerTitle': ['Multijogador e Rede', 'Multiplayer Settings', 'Ajustes de multijugador', 'Paramètres multijoueur', 'Mehrspielereinstellungen'],
  'options.skinCustomisation': ['Personalização de skin...', 'Skin Customization...', 'Personalizar el aspecto...', 'Personnalisation du skin...', 'Skin-Anpassung ...'],

  // Botões de tela (chaves oficiais gui.*)
  'gui.done': ['Pronto', 'Done', 'Hecho', 'Terminé', 'Fertig'],
  'gui.back': ['Voltar', 'Back', 'Atrás', 'Retour', 'Zurück'],
  'gui.reset': ['Restaurar', 'Reset', 'Restablecer', 'Réinitialiser', 'Zurücksetzen'],

  // Tela de morte (oficiais deathScreen.*)
  'deathScreen.title': ['Você morreu!', 'You died!', '¡Has muerto!', 'Vous êtes mort(e) !', 'Du bist gestorben!'],
  'deathScreen.respawn': ['Renascer', 'Respawn', 'Reaparecer', 'Ressusciter', 'Wiederbeleben'],

  // Itens próprios do Mind Cave
  'main.personalize': ['Personalizar Skin / Nick', 'Customize Skin / Nick', 'Personalizar Skin / Apodo', 'Personnaliser Skin / Pseudo', 'Skin / Nick anpassen'],
  'main.optimized': ['Modo Otimizado', 'Optimized Mode', 'Modo optimizado', 'Mode optimisé', 'Optimierter Modus'],
  'main.optimizedApplied': ['✓ Otimizado aplicado!', '✓ Optimized applied!', '✓ ¡Modo optimizado aplicado!', '✓ Mode optimisé activé !', '✓ Optimierter Modus aktiviert!'],
  'main.byDevs': ['Mind Cave — feito por dois devs', 'Mind Cave — made by two devs', 'Mind Cave — hecho por dos desarrolladores', 'Mind Cave — fait par deux développeurs', 'Mind Cave — erstellt von zwei Entwicklern'],
  'opt.shaders': ['Shaders...', 'Shaders...', 'Shaders...', 'Shaders...', 'Shaders ...'],
  'opt.shadersTitle': ['Configurações de Shaders', 'Shader Settings', 'Ajustes de shaders', 'Paramètres des shaders', 'Shader-Einstellungen'],
  'opt.performance': ['Desempenho...', 'Performance...', 'Rendimiento...', 'Performances...', 'Leistung ...'],
  'opt.performanceTitle': ['Desempenho Avançado', 'Advanced Performance', 'Rendimiento avanzado', 'Performances avancées', 'Erweiterte Leistung'],
  'opt.accessibility': ['Acessibilidade...', 'Accessibility...', 'Accesibilidad...', 'Accessibilité...', 'Barrierefreiheit ...'],
  'opt.accessibilityTitle': ['Acessibilidade', 'Accessibility', 'Accesibilidad', 'Accessibilité', 'Barrierefreiheit'],
  'opt.quality': ['Perfis de qualidade...', 'Quality Profiles...', 'Perfiles de calidad...', 'Profils de qualité...', 'Qualitätsprofile ...'],
  'opt.world': ['Configurações do mundo...', 'World Settings...', 'Ajustes del mundo...', 'Paramètres du monde...', 'Welteinstellungen ...'],
  'opt.importexport': ['Importar/Exportar...', 'Import/Export...', 'Importar/Exportar...', 'Importer/Exporter...', 'Importieren/Exportieren ...'],
  'opt.about': ['Sobre o build', 'About the build', 'Acerca de la compilación', 'À propos du build', 'Über den Build'],
  'opt.credits': ['Créditos', 'Credits', 'Créditos', 'Crédits', 'Credits'],
  'opt.devmanual': ['Manual do Desenvolvedor', 'Developer Manual', 'Manual del desarrollador', 'Manuel du développeur', 'Entwicklerhandbuch'],
};

export function getLang() {
  const l = settingsStore.get('user.lang');
  return LANG_IDS.includes(l) ? l : DEFAULT_LANG;
}

export function setLang(id) {
  if (LANG_IDS.includes(id)) settingsStore.set('user.lang', id);
}

export function t(key) {
  const row = S[key];
  if (!row) return key;
  const i = LANG_IDS.indexOf(getLang());
  return row[i] !== undefined ? row[i] : row[0];
}

// Hook: assina o settingsStore — troca de idioma re-renderiza na hora
export function useT() {
  useSettings();
  return t;
}
