# Laboratório (só desenvolvimento)

Página de teste que usa o **mesmo código do jogo** (`src/game`), sem carregar mapa. Não entra no build de produção.

## Como abrir

```bash
npm run dev
```

Depois abra `http://localhost:5173/lab/index.html`. Para um painel só, em tamanho grande: `?view=f5`, `?view=hand` ou `?view=grass`.

## O que cada painel valida

| Painel | O que confere | Onde mexer se estiver errado |
|---|---|---|
| Terceira pessoa (F5) | O modelo encara a direção do olhar (a seta ciano é o olhar). O botão "rodar verificações" testa 7 ângulos. | `src/game/viewMath.js` (convenção de ângulos), `placePlayerModel` em `src/game/playerModel.js`, poses em `src/game/animation.js` |
| Mão em 1ª pessoa | Braço vazio como na 1.8.9: ombro fora da tela, mão no canto inferior direito, apontando para frente e para cima. Sliders de golpe, velocidade e item. | `src/game/firstPersonHand.js` (cadeia de matrizes do `ItemRenderer`) |
| Grama | Malha real do mesher com o atlas e o shader do jogo, com plantas e folhas, para ver contorno nas bordas. Sliders de distância, ângulo e inclinação. | `src/game/materials.js` (shader), `src/game/textures.js` (atlas) |

## Animação de andar

É procedural, por cálculo (`applyThirdPersonPose` em `src/game/animation.js`). Para ajustar, mude a fórmula e veja o resultado nos sliders de velocidade, correndo e agachado do painel F5.

## Verificação automática

No console da página: `__lab.runChecks()` devolve `{ facing, hand }` e escreve o resultado no painel de texto.
