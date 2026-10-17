# Partículas

`src/game/particles.js`. Bloco quebrado solta quadrados que olham para a câmera, cada um com um **recorte de 4×4 pixels da textura do próprio bloco** (como o `EntityDiggingFX` do 1.8.9): brilho 0,6, tinta de folhagem nas folhas, grama solta pedaços de terra, luz do local. Respingo, fumaça e `/particle` usam cor lisa.

## Desempenho

- Estado em arrays tipados (nada de objeto por partícula) e um único desenho instanciado; a CPU não faz conta de matriz.
- Por quadro só as partículas vivas são copiadas para o buffer da GPU e só esse trecho sobe.
- Capacidade de 8192: 300 blocos quebrados no mesmo segundo (~3700 partículas) cabem sem descartar nenhuma. Medido no teste: criar 3,7 mil partículas ≈ 4 ms; por quadro, física ≈ 1,2 ms e cópia para a GPU ≈ 0,3 ms.
- Partícula parada no chão só envelhece (sem consulta ao mundo).

## Onde mexer

| Quero mudar | Onde |
| --- | --- |
| Quantidade (módulo Particles do Mind Client) | `clientStore.particleScale()` |
| Qual textura cada bloco usa | `PARTICLE_TILE` e `_tileFor` |
| Brilho, tamanho, vida | constantes e `spawnBlockBreak` |
| Capacidade | `CAP` |

Teste: `scripts/e2e/particles.mjs`.
