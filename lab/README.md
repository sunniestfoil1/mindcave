# Laboratório (só desenvolvimento)

Página de teste que usa o **mesmo código do jogo** (`src/game`), sem carregar mapa. Não entra no build de produção.

## Como abrir

```bash
npm run dev
```

Depois abra `http://localhost:5173/lab/index.html`. Para um painel só, em tamanho grande: `?view=f5`, `?view=hand`, `?view=grass`, `?view=sky` ou `?view=mobs`. A grama também aceita `&real=cx,cz` para ver chunks gerados pelo jogo (árvores incluídas).

O HUD e os inventários ficam em `/lab/hud.html?mode=hud|inventory|creative|crafting|furnace|chest`.

## O que cada painel valida

| Painel | O que confere | Onde mexer se estiver errado |
|---|---|---|
| Terceira pessoa (F5) | O modelo encara a direção do olhar (a seta ciano é o olhar). O botão "rodar verificações" testa 7 ângulos. | `src/game/viewMath.js` (convenção de ângulos), `placePlayerModel` em `src/game/playerModel.js`, poses em `src/game/animation.js` |
| Mão em 1ª pessoa | Braço vazio como na 1.8.9: ombro fora da tela, mão no canto inferior direito, apontando para frente e para cima. Sliders de golpe, velocidade e item. | `src/game/firstPersonHand.js` (cadeia de matrizes do `ItemRenderer`) |
| Grama | Malha real do mesher com o atlas e o shader do jogo, com plantas e folhas, para ver contorno nas bordas. Sliders de distância, ângulo e inclinação. | `src/game/materials.js` (shader), `src/game/textures.js` (atlas) |

| Céu | Skybox do CEU.zip com o mesmo `Sky` do jogo, slider de hora e de direção do olhar. | `src/game/sky.js`, `public/assets/sky/*.properties` |
| Mobs | Todos os modelos lado a lado com a caixa de colisão do registro. A verificação confere pés no chão e altura. | `src/game/mobModels.js`, `src/game/mobRegistry.js` |

## Animação de andar

É procedural, por cálculo (`applyThirdPersonPose` em `src/game/animation.js`). Para ajustar, mude a fórmula e veja o resultado nos sliders de velocidade, correndo e agachado do painel F5.

## Verificação automática

No console da página: `__lab.runChecks()` devolve `{ facing, hand, mobs }` e escreve o resultado no painel de texto.

- `lab/index.html?view=grass&shape=1&d=17&a=15&p=55&x=8&z=8` mostra lajes e escadas (todos os tipos, de cima/de baixo, duplas, invertidas, cantos) com a malha real; `d`, `a`, `p`, `x`, `z` = distância, ângulo, inclinação e alvo da câmera.
