# MIND CAVE — PRD 23
# Correção Final de Desempenho — baseada na medição real da build (monitor F12)

| Campo | Valor |
|---|---|
| Tipo | **Hotfix definitivo. Aplicar antes de tudo.** Substitui o PRD 22 (que era baseado só no print). |
| Build medida | minecraft-do-brazil.base44.app · arquivo index-BpPXY8hX.js · 07/10/2026 |
| Máquina | GPU **AMD Radeon RX 6600** (aceleração de hardware OK, WebGL2, multi-draw disponível) |
| Conclusão em uma frase | A placa de vídeo está ociosa (≈ 10 draw calls e ≈ 2.000 triângulos por quadro). **Uma única função — `loop`, o callback do requestAnimationFrame — leva ~1.000 ms em todo quadro**, enviando ~44 mensagens para os workers por quadro e gerando ~100 MB de lixo por segundo, enquanto a fila de malhas fica **travada em 311** e nunca esvazia. |

---

## 1. O que a medição provou

| Medida | Valor | O que significa |
|---|---|---|
| Função que mais travou | `loop` (FrameRequestCallback) — **44.746 ms em 54 chamadas** (~830 ms cada) | Todo o tempo perdido está dentro do loop principal do jogo |
| Tempo por quadro (céu, andando, girando) | mediana **~840 ms**, pior 1.128 ms → FPS 1 | Não depende da câmera nem do que está na tela |
| Draw calls / triângulos por quadro | 7–11 / 1.400–3.300 | GPU sem trabalho: **o problema não é render** |
| Mensagens para workers | **~44 por quadro** (2.402 no total, todas com transferência de buffer) | O loop despacha dezenas de tarefas de meshing **a cada quadro** |
| MESH_Q | 312 → 311 → 311 → 311 durante 40 s | A fila **não anda**: tarefas são despachadas de novo e de novo, e o resultado não volta (ou é descartado) |
| Buffers WebGL criados | 437 nos primeiros 10 s, **0 depois** | Malhas pararam de chegar dos workers por volta de 10 s; daí em diante o jogo só reenvia trabalho |
| Memória JS | oscilando ~90 → ~200 MB a cada 1–2 s | ~100 MB de arrays temporários criados por segundo (cópias de dados de chunk para enviar aos workers) |
| Fase "parado" (início) | mediana 5,6 ms (rápido) com picos de 1 s | No começo o jogo roda a 170 FPS; ele **degrada** quando a fila emperra |
| CHUNKS | 121 com RD 3 | Raio errado (deveria ser ≤ 49) |
| Névoa | FOG_N 1.000.000 / FOG_F 10.000.000 | Desligada |
| Console | 0 erros, **109 avisos** | Avisos provavelmente dos workers/pipeline (ver RF-005) |
| Jogador | POS fixa em −4,5 / 72,075 / −4,5 durante "andando" | Com 1 FPS o movimento não é processado (física presa ao quadro) |

**Diagnóstico:** a cada quadro, o `loop` percorre a fila de malhas pendentes, **monta de novo os dados de cada seção com os vizinhos** (arrays novos) e envia para os workers. Os resultados não retornam ou são ignorados (versão/ID não confere, worker com erro, fila não marca "em processamento"), então as mesmas ~311 seções são reenviadas indefinidamente. Isso consome ~1 s de CPU por quadro e produz a montanha de lixo.

---

## 2. Correções obrigatórias (na ordem)

### 2.1 Pipeline de meshing com estados (a causa principal)

**MC23-RF-001 (P0) — Estado por seção.** Cada seção tem estado: **limpa → suja → enviada → pronta → enviada à GPU**. Só seções **sujas** podem ser enviadas a um worker; ao enviar, viram **enviadas** e nunca são reenviadas enquanto estiverem nesse estado. Quando o resultado chega, viram **prontas** (ou **sujas** de novo, se o bloco mudou nesse meio-tempo — controlado por um número de versão da seção).

**MC23-RF-002 (P0) — Limite de tarefas em voo.** No máximo **2 tarefas por worker** ao mesmo tempo (ex.: 4 workers → 8 tarefas em voo). O loop **não** despacha mais nada se esse limite estiver cheio. Nunca 44 envios por quadro.

**MC23-RF-003 (P0) — Despacho fora do custo do quadro.** O despacho é feito por um agendador com orçamento de **≤ 1 ms por quadro**; montar os dados de envio não pode ser feito para dezenas de seções por quadro.

**MC23-RF-004 (P0) — O worker busca os dados, o loop não copia.** Em vez de montar no loop um array novo com a seção + 26 vizinhas para cada tarefa:
- os workers mantêm sua própria cópia dos chunks (recebida uma vez quando o chunk chega ou muda, por transferência), **ou**
- os dados ficam em memória compartilhada (exige a página isolada — ver RF-011).
O envio de uma tarefa passa a ser só "seção (cx, sy, cz), versão N".

**MC23-RF-005 (P0) — Resultado sempre volta, erro sempre aparece.** Todo envio tem um ID; o worker responde com sucesso **ou** erro. Erro no worker vira **console.error** com a mensagem (não aviso silencioso) e a seção volta a "suja" com contagem de tentativas (máx. 3, depois marcada com a textura de erro e registrada no log). Tarefa sem resposta em 5 s é cancelada e reenviada uma vez. Verificar e explicar os **109 avisos** do console atual.

**MC23-RF-006 (P0) — Fila sem duplicatas e ordenada só quando preciso.** A fila é um conjunto (uma entrada por seção) ordenado por distância **somente** quando o jogador muda de chunk; seções fora do raio saem da fila; seções vazias/cercadas nunca entram.

**MC23-RF-007 (P0) — Upload com orçamento.** No máximo 2 malhas prontas enviadas à GPU por quadro (ou 2 ms), reaproveitando buffers (sem criar geometria nova por atualização — PRD 21 RF-033).

### 2.2 Loop principal enxuto

**MC23-RF-010 (P0) — Loop dividido e medido.** O `loop` é dividido em etapas nomeadas (entrada, física/predição, rede, despacho de meshing, upload, entidades, render, HUD), cada uma com tempo medido e mostrado no F3 (PRD 21 RF-001). Meta: **loop inteiro ≤ 8 ms**. Nenhuma etapa pode percorrer todos os chunks ou todas as seções a cada quadro.

**MC23-RF-011 (P1) — Isolamento da página (opcional, para memória compartilhada).** Se for usar memória compartilhada entre workers, servir o app com os cabeçalhos de isolamento de origem; hoje a página **não** é isolada.

**MC23-RF-012 (P0) — Física independente do FPS.** A física do jogador roda em passos fixos de 50 ms (20 TPS) acumulados, não "um passo por quadro" — com FPS baixo o jogador ainda anda (posição não congela).

**MC23-RF-013 (P0) — Zero lixo por quadro.** Proibido criar arrays/objetos no loop (PRD 21 §5). Com a correção do pipeline, a memória deve ficar estável (sem oscilar 100 MB/s).

### 2.3 Correções que já estavam pendentes

- **MC23-RF-020 (P0)** Raio: com RD = N, no máximo (2N+1)² colunas; descarregar o resto (PRD 22 RF-020/021).
- **MC23-RF-021 (P0)** Névoa ligada: de 75% a 100% de RD × 16 blocos (PRD 22 RF-030).
- **MC23-RF-022 (P0)** Remover as partículas roxas de ambiente; partículas instanciadas (PRD 22 RF-040).
- **MC23-RF-023 (P0)** Buracos no terreno (céu visto através do chão): consequência das seções presas na fila. Depois da correção, nenhuma seção visível pode ficar sem malha por mais de 2 s.
- **MC23-RF-024 (P0)** Cor da água / mundo azul: só aplicar a névoa e a tinta subaquáticas quando os **olhos** da câmera estiverem dentro de um bloco de água; água com textura e tinta do bioma (PRD 02 RF-031).

---

## 3. Como medir a correção

Rodar de novo o script **mindcave-monitor-f12.js** (com a emulação de celular do DevTools **desligada** — o teste atual rodou com o modo dispositivo "Nexus 5" ativo, janela 537×901).

| Métrica do relatório | Hoje | Meta |
|---|---|---|
| fps_medio (todas as fases) | 1 | **≥ 60** |
| frame_ms p95 | ~1.100 ms | **≤ 20 ms** |
| quadros acima de 50 ms (por fase) | 11–22 | **0–1** |
| `loop` em funcoes_que_mais_travaram | 44.746 ms | não aparecer (ou < 500 ms total) |
| msgs_para_workers por quadro | ~44 | **≤ 2** em regime, 0 parado com a fila vazia |
| MESH_Q no F3 | 311 fixo | **0** em ≤ 5 s parado |
| CHUNKS com RD 3 | 121 | **≤ 49** |
| Memória | serrote de ~100 MB/s | estável (variação < 30 MB em 10 s) |
| Avisos no console | 109 | 0 (ou explicados) |

---

## 4. Critério de aceite

O PRD só está concluído quando o relatório do monitor, rodado no app publicado, bate **todas** as metas da tabela acima, o jogador consegue andar normalmente e não há buracos no terreno.
