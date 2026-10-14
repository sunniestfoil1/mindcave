# Mind Client

Menu aberto **só** com o **Shift direito** (o Shift esquerdo continua agachando). O mundo segue rodando com o menu aberto; Esc ou Shift direito fecham, sem abrir o menu de pausa.

Clicar no cartão liga/desliga o módulo. A engrenagem do cartão abre os ajustes. A busca filtra pelo nome. Estado e ajustes ficam no `localStorage` (`mc.client.v1`).

## Módulos

| Módulo | O que faz | Onde está o efeito |
| --- | --- | --- |
| FPS, CPS, Coordinates, Direction Hud, Memory, Ping Display | texto no HUD (fonte do jogo) | `src/components/client/ClientHud.jsx` |
| Keystrokes | W A S D, mouse e espaço, lidos do motor a cada quadro | `ClientHud.jsx` (`Keystrokes`) |
| Armor HUD | peças de armadura vestidas e durabilidade | `ClientHud.jsx` (`ArmorHud`) |
| Hitbox | caixas de colisão (igual ao F3 + B) | `engine.showHitboxes` |
| Hit Color | cor do flash de dano dos mobs: vermelho (padrão do jogo), RGB (tabela de 256 cores calculada uma vez) ou personalizada, com intensidade | `src/game/hitFlash.js`, `mobManager.renderUpdate` |
| Item Physics | item solto cai girando e fica deitado no chão | `itemEntity.js` (`update`) |
| Nametags | nome dos outros jogadores e, na 3ª pessoa, o seu | `engine.js` (`updateRemotePlayers`, `updatePlayerModel`) |
| Particles | quantidade de partículas de bloco, respingo e fumaça | `particles.js` |
| Perspective | segurar **ALT** olha em volta sem virar o corpo; soltar volta | `engine.js` (`startFreeLook`, `endFreeLook`) |
| Tab | liga/desliga a lista de jogadores do Tab | `engine.js` (`onKey`) |
| Fullbright | luz máxima em todo lugar, de dia e de noite (uniforme `uFullbright` no shader) | `materials.js`, `engine.js` |

Ligados por padrão: Hit Color, Nametags, Particles, Perspective, Tab (o comportamento normal do jogo). Os de HUD, Hitbox, Item Physics e Fullbright começam desligados.

## Fora do menu, de propósito

Boss Bar, Combo Display, Play Time, Potion Counter, Potion Effects, Reach Display, Old Animations, Time Changer, TNT Timer e Wavey Capes foram retirados a pedido. O item na mão já usa as animações do jogo original por padrão.

## Ainda sem implementação ("Em breve", cartão apagado)

Pack Overlay, InputFix, Motion Blur, Shiny Pots e Skins aparecem no menu como no cliente de referência, mas não ligam: nenhum deles tem efeito no jogo ainda. A edição de posição dos widgets de HUD (o lápis da barra lateral do cliente de referência) também não foi feita; os widgets ficam em posições fixas.

## Onde mexer

| Quero mudar | Arquivo |
| --- | --- |
| Incluir ou tirar módulo, nome, ícone, ajustes, padrão | `src/game/client/modules.js` |
| Estado, persistência, cor do RGB | `src/game/client/clientStore.js` |
| Visual do menu | `src/components/client/MindClientMenu.jsx` |
| Widgets de HUD | `src/components/client/ClientHud.jsx` |
| Abrir/fechar o menu (tecla e telas) | `engine.js` (`onKey`, `ShiftRight`) e `src/pages/Game.jsx` (`onToggleClientMenu`) |

## Testes

`npm run test:e2e`: `scripts/e2e/client.mjs` (motor: Shift direito, ALT, Fullbright, Hit Color, Item Physics, Particles, Hitbox, Tab, Nametags) e `scripts/e2e/page.mjs` (menu aberto na página: módulos, ligar FPS, Esc, mundo rodando).
