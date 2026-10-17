# Carregamento do mundo

## Tela "Carregando mundo"

Igual à do 1.8.9 (`LoadingScreen.jsx`): fundo de terra escurecido (`dirt.png`, tile de 32 px de GUI), título e mensagem em branco com a fonte do jogo e a barra de 100×2 px (cinza, preenchida de verde).

A barra é **real**: `engine.start()` soma o andamento de quatro etapas, cada uma com a própria fração medida.

| Etapa | Peso | Fração medida |
| --- | --- | --- |
| Pacote de recursos | 30 | bytes baixados / total (do cache local vai direto a 100%) |
| Texturas | 20 | texturas decodificadas / total do atlas |
| Chunks | 42 | chunks prontos / 25 da área de spawn (mensagem "Preparando área de spawn: N%") |
| GPU | 8 | shaders compilados e atlas na placa de vídeo |

Texturas e chunks andam ao mesmo tempo; a GPU é aquecida por último (`_warmGpu`: compila os shaders da cena e das partículas, sobe o atlas e desenha um quadro) para o primeiro quadro, o primeiro bloco quebrado e a primeira mão não engasgarem. A barra só sobe, nunca volta.

Marcas de tempo (`performance.getEntriesByType('mark')`, nomes `mc:*`): `renderer`, `pack`, `textures`, `chunks`, `gpu`.

## Aviso no HUD

- "Carregando texturas..." só aparece enquanto há download de verdade do pacote (`isPackDownloading`); ler do cache local não conta.
- "Carregando chunks..." aparece enquanto a distância de renderização ainda está crescendo até o valor das opções.

## Recarga da página

- O pacote de recursos vem da Cache API (`mc-assets-v2`): nenhum download de novo (testado).
- As chamadas ao banco saem em paralelo (usuário, mundo, deltas, jogador, estatísticas); antes eram 6 idas e voltas em fila.
- A nuvem de `chunk_deltas` sai junto com a leitura local, só com as colunas usadas, e espera no máximo 2,5 s (o local manda; a nuvem só completa o que falta).
- Sons de uso imediato (quebrar, colocar, passos) são decodificados em segundo plano depois que o mundo abre (`prewarmEvents`).
- Chunks **não** são guardados em cache de memória: pesa mais do que ajuda.

## Onde mexer

| Quero mudar | Arquivo |
| --- | --- |
| Visual da tela | `src/components/game/LoadingScreen.jsx` |
| Pesos, etapas, mensagens, aquecimento da GPU | `src/game/engine.js` (`start`, `_warmGpu`) |
| Ordem das chamadas ao banco | `src/pages/Game.jsx` (primeiro `useEffect`) e `src/game/save.js` (`loadDeltas`) |
| Aviso do HUD | `src/game/engine.js` (`loadingNote`) e `GameHud.jsx` |

## Testes

`scripts/e2e/loading.mjs`: barra monótona e começando em zero, etapas, marcas de tempo, sem aviso de texturas depois de carregar, recarga sem baixar o pacote e com chamadas em paralelo.
