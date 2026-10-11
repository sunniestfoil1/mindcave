# Otimização de renderização voxel — estado e referências

Arquivo novo, escrito sem tocar em código (outra IA está editando `src/`).

## 1. O que já existe no projeto

| Técnica | Situação | Onde |
|---|---|---|
| Greedy meshing | Já implementado | `src/game/mesher.js` — `mergeMask`, "Pass 2" (~linha 330) |
| Face culling | Já implementado | `mesher.js` ~linha 358: face some se o vizinho é opaco (`isOpaque`) ou é o mesmo fluido/translúcido |
| Seções 16³ (cubic chunks) | Já implementado | `mesher.js` (`SS = 16`), commit `77f3048` |
| Chave do greedy inclui luz + oclusão | Já implementado | `aoPattern`, `lightByte` — nunca funde área de luz diferente |
| Buffers compactos (Uint8 para cor/luz/ao) | Já implementado | cabeçalho do `mesher.js` |
| Mesher em worker | Não verificado | olhar `src/game/meshCore.js` e `engine.js` |

Conclusão: o item 1 do texto recebido (greedy + culling) **já está aplicado**. Não reescrevi, para não duplicar nem sobrescrever o trabalho da outra IA.

## 2. Referências baixadas

Pasta: `referencias-render/` (fora do git, em `.git/info/exclude`).

| Repositório do texto | Resultado |
|---|---|
| `robertmikhayelyan/GreedyMeshing` | **Não existe** (404). Link inventado no texto. |
| `skyrising/patchwork` | **Não existe** (404). |
| `Embeddedt/Embeddium` | Baixado (3,9 MB, clone raso). Fork do Sodium, é mod Java para Minecraft moderno, não para 1.8.9. |

Nada foi inventado para suprir os dois que faltam. Se quiser uma referência de greedy meshing, o artigo de Mikola Lysenko ("Meshing in a Minecraft Game", 0fps.net) é a fonte clássica; é preciso confirmar o link antes de baixar.

## 3. Próximos ganhos possíveis (não aplicados)

1. Conferir se o meshing roda em Web Worker (`meshCore.js`) e, se não, mover.
2. Medir antes de mexer: tempo de mesh por seção e triângulos por quadro (`PerformancePanel.jsx` já existe).
3. Do Embeddium vale estudar só o conceito: buffers contíguos grandes por região, em vez de um buffer por seção.

## 4. Regra para quem editar depois

Uma IA por vez em `src/game/mesher.js`. Conferir `git status` antes de editar.

## 5. Medição (2026-10-11)

Como: Node + Vite SSR, `MeshMirror` real (`meshCore.js`), seed 12345, gerador `open_legacy`, grade 7x7 chunks, malhando os 5x5 centrais (16 seções cada). Aquecimento de 2 rodadas. Tiles falsos (só afetam UV). Máquina de desenvolvimento, uma thread.

| Medida | Resultado |
|---|---|
| Geração de terreno | 2,98 ms por chunk |
| Cálculo de luz | 1,25 ms por chunk |
| Mesh por seção 16³ (terreno real) | média 1,29 ms · p50 1,40 · p95 1,71 · máx 2,19 |
| Seções com malha / vazias | 52 / 348 (as vazias saem de graça) |
| Memória das malhas | 0,67 MB para 52 seções (≈13 KB por seção) |
| Pior caso (xadrez pedra/ar, anti-greedy) | 23,6 ms por seção, 1,7 MB |

Não medido: FPS e custo de GPU (precisa de navegador), tempo no worker real, picos ao quebrar bloco.

Leitura: mesh de terreno normal custa ~1,3 ms. Um port do binary-greedy-meshing não se paga. O mesher já roda em worker (`workers/meshWorker.js`, `meshPool.js`).
