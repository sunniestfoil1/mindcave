# Celular (toque)

O jogo detecta celular/tablet sozinho (ponteiro principal "grosso" + toque) e liga os controles de toque por cima do HUD de sempre. Nada do gráfico foi mexido.

## Como joga

| Controle | O que faz |
| --- | --- |
| Joystick (canto esquerdo) | Anda. Empurrado até o fim para a frente, corre. |
| Arrastar o dedo no resto da tela | Olha em volta |
| Toque rápido na tela | Usa/coloca bloco; bate, se há mob na mira |
| Dedo parado (250 ms) | Quebra/bate enquanto estiver na tela. Com comida ou arco na mão, segurar é usar |
| Slots da hotbar | Tocar seleciona |
| Pular | Segurar = Espaço apertado (toque duplo = voar no criativo, como no teclado) |
| Agachar | Alterna |
| Inv, Chat, Pausa | Inventário, chat e menu do jogo (botões do jogo, `widgets.png`) |

Os botões usam as teclas que o jogador configurou, pelas mesmas rotas do teclado e do mouse (`engine.touch*`).

## Tela sempre deitada, sem aviso

- Em pé: no primeiro toque o jogo pede tela cheia e trava em paisagem (Android). Antes disso, e onde não há essa API (iOS), a página inteira é girada 90° por CSS (`html.mc-rotate`), então o jogo já nasce deitado.
- Tamanho da tela e posição do dedo passam por `viewSize()` e `gameXY()`, que levam a rotação em conta.
- GUI em "Auto" tem escala mínima 2 no celular (a conta do 1.8.9 dá 1 em ~360 px de altura e a hotbar ficaria com slots de 20 px).

## Zoom travado

`meta viewport` sem escala (`user-scalable=no`, `maximum-scale=1`), `touch-action: manipulation` (sem zoom por toque duplo) e bloqueio do gesto de pinça (`gesturestart`, `touchmove` com 2 dedos) para o iOS.

## Sensibilidade (Opções > Controles, só no celular)

| Ajuste | Faixa | Efeito |
| --- | --- | --- |
| Câmera (toque) | 10–300% (padrão 100%) | 0,25°/px a 100%, linear |
| Joystick | 25–200% (padrão 100%) | Quanto o joystick precisa ser empurrado para andar: 25% pede empurrão longo, 200% anda com toque leve |

## Onde mexer

| Quero mudar | Arquivo |
| --- | --- |
| Botões, joystick, gestos, posições | `src/components/game/TouchControls.jsx` |
| Entrada de toque no motor (`touchLook`, `touchKey`, `touchMove`...) | `src/game/engine.js` |
| Detecção, rotação por CSS, zoom, click fantasma | `src/game/touch.js` e regras `mc-*` em `src/index.css` |
| Viewport | `index.html` |
| Sliders de sensibilidade | `src/components/options/KeybindsPage.jsx`, padrões em `src/game/settingsDefaults.js` |

## Testes

`scripts/e2e/touch.mjs` (celular emulado, paisagem e em pé): joystick, câmera e as duas sensibilidades, toque rápido x segurar, hotbar, Pular, Agachar, Inv, Pausa e Voltar ao jogo, rotação e zoom.

## Limites conhecidos

- Com a página girada por CSS (iOS), itens "na mão do cursor" do inventário e o tooltip usam a posição do dedo sem a rotação.
- Telas com mais de ~330 px de altura de GUI (o inventário criativo) podem ficar cortadas em celulares com menos de ~390 px de altura.
- O menu do Mind Client (Shift direito) não tem botão de toque.
