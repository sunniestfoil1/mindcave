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
| Pular (grande, canto inferior direito) | Segurar = Espaço apertado (toque duplo = voar no criativo, como no teclado) |
| Botas (acima do Pular) | Agachar: alterna e fica **aceso** (visual de destaque do jogo) enquanto estiver agachado |
| Baú (acima do Pular) | Inventário |
| Livro e pena / Pausa (canto superior direito) | Chat e menu do jogo (só o ícone de pausa, o mesmo do rádio) |
| Menu de pausa > Mind Client | Abre o Mind Client (o celular não tem Shift direito) |

O 1.8.9 não tem ícone próprio de agachar nem de chat: os botões usam texturas oficiais de item como símbolo (botas, livro e pena, baú) dentro do botão do jogo (`GuiButton`, `widgets.png`). Para trocar, é só mudar o `id` do item em `TouchControls.jsx`.

Os botões usam as teclas que o jogador configurou, pelas mesmas rotas do teclado e do mouse (`engine.touch*`). Margem de 16 px de GUI das bordas (a barra do navegador e o indicador do iPhone comem os cantos).

## Tela sempre deitada, sem aviso

- Em pé: no primeiro toque o jogo pede tela cheia e trava em paisagem (Android). Antes disso, e onde não há essa API (iOS), a página inteira é girada 90° por CSS (`html.mc-rotate`), então o jogo já nasce deitado.
- Tamanho da tela e posição do dedo passam por `viewSize()` e `gameXY()`, que levam a rotação em conta.
- **Escala da GUI no celular (Auto):** o HUD e os inventários usam no mínimo 2 (a conta do 1.8.9 dá 1 em ~360 px de altura e a hotbar ficaria com slots de 20 px); as **telas de menu** (principal, opções, pausa) usam passos de 0,25 até a tela ter 240 de altura de GUI, que é o que o layout delas exige (com 2 os textos ficavam por cima dos botões). `getGuiScale` (HUD) e `getMenuScale` (menus) em `src/game/gui/scale.js`.
- **Teclado virtual (chat):** com o campo de texto em foco o navegador encolhe a janela, mas a GUI não acompanha (`viewSize()` guarda o tamanho de antes do teclado); senão todos os botões encolhiam.
- **iOS:** segurar o dedo não seleciona texto/imagem nem abre menu de contexto (`selectstart` e `contextmenu` bloqueados, `user-select: none`); `html`/`body` pretos e fixos (sem barra branca); o botão só fica "aceso" pelo mouse, nunca pelo hover falso do toque; o buffer do WebGL acompanha o tamanho real do canvas (`ResizeObserver`) para a imagem não sair esticada.

## Zoom travado

`meta viewport` sem escala (`user-scalable=no`, `maximum-scale=1`), `touch-action: manipulation` (sem zoom por toque duplo) e bloqueio do gesto de pinça (`gesturestart`, `touchmove` com 2 dedos) para o iOS.

## Sensibilidade (Opções > Controles, só no celular)

| Ajuste | Faixa | Efeito |
| --- | --- | --- |
| Câmera (toque) | 10–300% (padrão 100%) | 0,5°/px a 100%, linear (0,25 ficou lento no teste em iPhone) |
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
- O inventário criativo (195 de GUI de altura × 2) pode ficar cortado em celulares com menos de ~390 px de altura.
- Nada disto foi testado em iPhone real: os testes usam Chrome emulado com toque. A barra branca, o hover grudado e o teclado foram corrigidos pela causa que os prints indicam; falta conferir no aparelho.
- O menu do Mind Client (Shift direito) não tem botão de toque.
