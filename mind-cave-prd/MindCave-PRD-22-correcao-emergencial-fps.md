# MIND CAVE — PRD 22
# Correção Emergencial: FPS 2 Olhando para o Céu

| Campo | Valor |
|---|---|
| Tipo | **Hotfix — aplicar antes de qualquer outra coisa.** Não adiciona funcionalidade; corrige a build atual. |
| Depende de | PRD 13 e PRD 21 (as regras completas estão lá; este PRD lista o que está quebrado agora) |
| Evidência (F3 da build atual) | POS −16,2 / 73,1 / 20,7 · CHUNKS: 121 · MESH_Q: 319 · FPS: 2 · RD: 3 · FOG_N: 1000000 · FOG_F: 10000000 · câmera olhando para o céu · centenas de quadrados roxos espalhados pela tela |

> Olhando para o céu quase nada do terreno está na tela. Se mesmo assim o FPS é 2, o problema **não é o desenho**: algo trava a thread principal em todo quadro. Este PRD diz o que é e como provar a correção.

---

## 1. Diagnóstico pelos números

| Sinal no F3 | O que significa | Correção |
|---|---|---|
| **FPS 2 olhando para o céu** | Mais de 400 ms de trabalho de CPU por quadro, independente da câmera | Seções 2 e 3 |
| **MESH_Q: 319** | 319 seções esperando malha. A fila está sendo processada na thread principal (ou várias por quadro), ou não anda e é reprocessada a cada quadro | Seção 2 |
| **RD 3 com CHUNKS 121** | Com distância 3 o máximo é 7 × 7 = 49 colunas. 121 = 11 × 11: os chunks fora do raio **não estão sendo descarregados** (ou o raio usado internamente não é o da opção) | Seção 4 |
| **FOG_N 1000000 / FOG_F 10000000** | Névoa desligada na prática: a borda dos chunks fica visível e o céu vira um plano infinito | Seção 5 |
| **Quadrados roxos por toda a tela** | Emissor de partículas de ambiente ligado sem motivo. Provavelmente cada quadrado é um objeto 3D próprio | Seção 6 |

---

## 2. Meshing: tirar da thread principal e fazer a fila andar

**MC22-RF-001 (P0) — Nenhuma malha montada na thread principal.** Procurar e remover todo código que monta geometria de seção/chunk na thread principal (inclusive "só para o spawn" ou "só quando o worker não respondeu"). Toda malha é montada em Web Worker (PRD 13 RF-020). A thread principal só recebe os buffers prontos e cria/atualiza a geometria.

**MC22-RF-002 (P0) — A fila precisa diminuir.** Com o jogador parado, **MESH_Q tem que chegar a 0 em poucos segundos**. Verificar e corrigir:
- seção que já tem malha atualizada não pode voltar para a fila;
- seção vazia (só ar) e seção totalmente cercada não entram na fila;
- receber um chunk vizinho marca só a borda afetada, uma vez, não todas as seções de novo;
- várias marcações da mesma seção viram **um** pedido (sem duplicatas na fila);
- seções fora do raio saem da fila (cancelamento);
- a fila não é reordenada a cada quadro inteira (ordenar ao inserir ou só quando a câmera muda de chunk).

**MC22-RF-003 (P0) — Orçamento de upload.** Por quadro, no máximo **2 ms** ou o número da opção "Atualizações de chunk por quadro" (padrão 2) de malhas prontas enviadas à GPU (PRD 21 RF-031).

**MC22-RF-004 (P0) — F3 mais claro.** Separar MESH_Q em: **na fila**, **em processamento nos workers**, **prontas para upload**, e mostrar quantos workers de meshing estão ativos. Se "workers ativos" for 0, há um erro.

---

## 3. Achar o resto do tempo da CPU

**MC22-RF-010 (P0) — Medir antes de seguir.** Ligar o painel de desempenho do PRD 21 RF-001 (tempo por etapa do quadro). Toda etapa que passar de **4 ms** por quadro precisa de explicação e correção. Suspeitos a checar nesta build:
- loop que percorre **todos os blocos** de todos os chunks a cada quadro (para colisão, raycast, luz, F3 "BLOCK_BELOW" ou contagem de chunks) — trocar por acesso direto ao bloco pela coordenada (PRD 13 RF-004);
- recalcular luz de chunks inteiros a cada quadro;
- geração de terreno ou decoração rodando na thread principal;
- React re-renderizando o HUD ou o F3 a cada quadro (PRD 21 RF-050) — o F3 atualiza o texto no máximo 4 vezes por segundo;
- criação de objetos/arrays a cada quadro (coleta de lixo — PRD 21 §5).

**MC22-RF-011 (P0) — Registro do travamento.** Ativar o detector de quadros acima de 50 ms (PRD 21 RF-002) e deixar o log copiável, para provar qual etapa consumia o tempo antes e depois.

---

## 4. Distância de renderização e descarregamento

**MC22-RF-020 (P0) — Raio correto.** A opção "Distância de renderização" é a única fonte do raio. Com RD = N, o cliente mantém no máximo **(2N + 1)²** colunas, e o servidor envia só essas (+1 de margem no servidor, nunca no cliente desenhado).

**MC22-RF-021 (P0) — Descarregar de verdade.** Colunas que saem do raio são removidas: malhas liberadas da GPU, arrays liberados, entradas da fila de meshing canceladas, entidades daquela coluna removidas. Teste: RD 3 → CHUNKS ≤ 49; mudar para RD 8 e voltar para 3 → volta a ≤ 49 em poucos segundos.

---

## 5. Névoa

**MC22-RF-030 (P0)** A névoa começa em ~75% e termina em 100% da distância de renderização em blocos (RD × 16), na cor do céu (PRD 02 RF-041). Com RD 3: início ≈ 36 e fim = 48 blocos. A opção "Névoa" (PRD 20) pode desligar, mas o padrão é ligada. Remover os valores fixos de 1.000.000 / 10.000.000.

---

## 6. Partículas roxas

**MC22-RF-040 (P0)** Remover o emissor de partículas de ambiente que gera os quadrados roxos (PRD 13 RF-081). Partículas roxas só perto de portais e endermen. Todo sistema de partículas usa **um único desenho instanciado por tipo** (PRD 02 RF-050), nunca um objeto 3D por partícula.

---

## 7. Teste de aceite (com o F3)

| Situação | Resultado exigido |
|---|---|
| Parado no spawn, RD 3, olhando para o céu | **≥ 60 FPS**; MESH_Q chega a 0 em ≤ 5 s; CHUNKS ≤ 49 |
| Parado, RD 8, olhando para o horizonte | ≥ 60 FPS em PC comum; CHUNKS ≤ 289 |
| Andando em linha reta por 1 minuto, RD 8 | Nenhum quadro acima de 50 ms no log; MESH_Q sobe e desce, não cresce sem parar |
| Névoa com RD 3 | Borda dos chunks escondida pela névoa |
| Céu | Sem quadrados roxos |
| Painel de desempenho | Nenhuma etapa acima de 4 ms por quadro; meshing com 0 ms na thread principal |

Depois de aplicar, mandar um novo print com o F3 aberto e o log de travamentos.
