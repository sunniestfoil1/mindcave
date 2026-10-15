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

## Editar a posição do HUD

O lápis da barra lateral do menu esconde o painel e deixa os widgets ligados arrastáveis (contorno tracejado). Cada widget fica dentro da janela; os que estão sem dado na hora (Armor HUD sem armadura, Ping offline, Memory sem a API do navegador) ganham um espaço para você posicionar. **Esc** volta ao menu, **Concluir** sai da edição e **Restaurar posições** devolve tudo ao lugar padrão.

A posição é guardada como fração da janela (deslocamento em relação ao lugar padrão) em `mc.client.v1.__layout`, então vale em qualquer resolução.

## Armadura no modelo do jogador

A armadura do inventário aparece no modelo em 3ª pessoa (F5) e nos outros jogadores: capacete na cabeça, peitoral no corpo e braços, calça no corpo e pernas, botas nas pernas, com as texturas `textures/models/armor/*_layer_1/2.png` do pacote de recursos ativo (troca junto com o pacote). Couro sai na cor padrão A06540 mais a camada de tintura. Pela rede segue um número (`a` na mensagem `move`, 3 bits por peça). Brilho de encantamento na armadura ainda não existe.

## Onde mexer

| Quero mudar | Arquivo |
| --- | --- |
| Incluir ou tirar módulo, nome, ícone, ajustes, padrão | `src/game/client/modules.js` |
| Estado, persistência, cor do RGB | `src/game/client/clientStore.js` |
| Visual do menu | `src/components/client/MindClientMenu.jsx` |
| Widgets de HUD e arrasto (`useWidget`) | `src/components/client/ClientHud.jsx` |
| Posições salvas, modo de edição | `src/game/client/clientStore.js` (`getPos`, `setPos`, `setEditing`) |
| Armadura no modelo | `src/game/playerModel.js` (`setModelArmor`, `armorCodeFromSlots`) |
| Abrir/fechar o menu (tecla e telas) | `engine.js` (`onKey`, `ShiftRight`) e `src/pages/Game.jsx` (`onToggleClientMenu`) |

## Testes

`npm run test:e2e`: `scripts/e2e/client.mjs` (motor: Shift direito, ALT, Fullbright, Hit Color, Item Physics, Particles, Hitbox, Tab, Nametags) e `scripts/e2e/page.mjs` (menu aberto na página: módulos, ligar FPS, Esc, mundo rodando, edição e arrasto do HUD) e `scripts/e2e/armor.mjs` (armadura no modelo local e remoto, print em `scripts/e2e/out/armor.png`).
