# MIND CAVE — PRD 21
# Anti-Travamento: Diagnóstico, Entrada no Mundo sem Congelar, Orçamento por Quadro e as Causas de Lag de um Minecraft no Navegador

| Campo | Valor |
|---|---|
| Depende de | PRD 13 (render por seções e pacotes), PRD 14 (geração), PRD 20 (opções) |
| Tipo | **PRD corretivo e prioritário.** Complementa o PRD 13. Onde houver conflito sobre desempenho, vale este. |
| Problema relatado | Ao entrar no mundo o jogo **trava muito** (congela, engasga, FPS cai), e continua engasgando ao andar. |
| Objetivo | Achar com medição **onde** o tempo está indo, eliminar os travamentos da entrada no mundo e garantir que nenhum quadro passe do orçamento — aplicando as técnicas que os otimizadores do Minecraft (como o Sodium: preparo de chunks em várias threads, desenho em lote, grafo de visibilidade) e os motores voxel no navegador usam. |

> Documento de requisitos. Regra de ouro: **medir antes de mudar**. Cada correção deste PRD tem uma métrica que prova que funcionou.

---

## 0. Por que um Minecraft no navegador trava (lista de causas a investigar)

| # | Causa | Sintoma típico |
|---|---|---|
| 1 | **Navegador sem aceleração de hardware** (render por software) | Tudo lento desde o menu; F3 mostra renderizador "SwiftShader", "llvmpipe" ou "Microsoft Basic Render" |
| 2 | **App rodando em modo de desenvolvimento** (prévia do Base44, React em modo estrito, sem minificação) | Lento só na prévia; build publicado mais rápido |
| 3 | **Muitos chunks preparados de uma vez ao entrar** | Congelamento de vários segundos ao entrar |
| 4 | **Geração, luz ou meshing na thread principal** | Engasgos sempre que chunks novos chegam |
| 5 | **Muitas malhas enviadas à GPU no mesmo quadro** (upload sem orçamento) | Picos de 100+ ms ao andar |
| 6 | **Compilação de shaders no meio do jogo** | Travadinha na primeira vez que algo aparece (água, folhas, um mob, shaders) |
| 7 | **Coleta de lixo** (criar arrays/objetos/vetores por bloco ou por quadro) | Engasgos periódicos mesmo parado |
| 8 | **React re-renderizando o HUD a cada quadro** | FPS baixo constante, CPU alta |
| 9 | **Um objeto da cena por bloco/por chunk sem culling** | Milhares de draw calls; FPS baixo constante |
| 10 | **Servidor integrado no mesmo thread do render** | Engasgos a cada tick, piora com mobs |
| 11 | **Chamadas ao Base44/IndexedDB esperadas dentro do loop** (save, sinalização) | Congela a cada autosave (45 s) |
| 12 | **Decodificação de pacotes de rede e descompactação de chunks na thread principal** | Engasgos quando o amigo entra ou anda |
| 13 | **Resolução de render alta demais** (tela 4K, devicePixelRatio 2–3) e sombras/pós-processamento ligados por padrão | FPS baixo em notebook |
| 14 | **Partículas, luzes dinâmicas ou sombras de muitas entidades** | Quedas perto de mobs/tochas |

O trabalho deste PRD é passar por cada item, medir e corrigir.

---

## 1. Diagnóstico primeiro

**MC21-RF-001 (P0) — Painel de desempenho (F3 + Shift, ou Opções → Desempenho → Gráfico).** Mostrar ao vivo:
- Gráfico de tempo de quadro (últimos 240 quadros) com linhas de 16,7 ms e 33 ms; quadros acima de 50 ms em vermelho.
- Tempo por etapa no quadro: entrada, física/predição, interpolação de entidades, atualização da cena, **upload de malhas**, render do mundo, render de entidades, partículas, HUD, pós-processamento.
- Filas: seções esperando geração / luz / meshing / upload; chunks na fila de rede.
- Memória JS e estimativa de memória de GPU; número de **coletas de lixo longas** detectadas.
- Tempo de tick do servidor (médio, máximo) e TPS.
- Renderizador da GPU e aviso se for render por software (RF-010).

**MC21-RF-002 (P0) — Detector de travamentos.** Toda vez que um quadro passar de **50 ms** (ou houver uma "tarefa longa" do navegador), registrar o que estava acontecendo (etapas do quadro, filas, eventos de rede/save, compilação de shader, coleta de lixo provável) num log "Travamentos" copiável. Esse log é o primeiro anexo para a IA corrigir qualquer lag.

**MC21-RF-003 (P0) — Teste de entrada padronizado.** Comando de dev "benchmark de entrada": cria/abre um mundo de seed fixa, mede do clique em "Jogar" até o jogador poder andar, e grava: tempo total, maior quadro, quantidade de quadros acima de 50 ms nos primeiros 30 s, e FPS médio parado e andando. Resultado salvo por build para comparar.

---

## 2. Ambiente: o que verificar antes de otimizar código

**MC21-RF-010 (P0) — GPU certa.** Ler o nome do renderizador da GPU. Se for render por software, mostrar aviso claro: "Seu navegador está sem aceleração de hardware. Ative 'Usar aceleração gráfica quando disponível' nas configurações do navegador." Em notebooks com duas GPUs, pedir o contexto WebGL com **preferência de alto desempenho**.

**MC21-RF-011 (P0) — Build de produção.** O jogo precisa ser testado e jogado no **app publicado** (build otimizado), não só na prévia do editor. No modo de desenvolvimento: sem modo estrito do React dentro do canvas do jogo (ele monta componentes duas vezes) e sem ferramentas de depuração ativas por padrão. Registrar no F3 se a build é de desenvolvimento.

**MC21-RF-012 (P0) — Resolução e efeitos padrão leves.** Na primeira execução: limitar a razão de pixels do dispositivo a no máximo **1,5** (opção "Escala de resolução", PRD 20); modo Shaders **desligado**; distância **8**; partículas "Todas" mas com o limite do PRD 02; sombras dinâmicas desligadas. O perfil sugerido pelo benchmark do PRD 02 só sobe a qualidade se o FPS medido permitir.

---

## 3. Entrada no mundo sem congelar

**MC21-RF-020 (P0) — Carregamento em fases, com tela de carregamento viva.** A tela de carregamento (que continua animando) só termina quando:
1. texturas/array de texturas enviados à GPU;
2. **todos os shaders pré-compilados** (RF-030);
3. a área inicial pronta: **5×5 chunks** em volta do spawn gerados, iluminados e com malha enviada;
4. os sons básicos decodificados.
O resto do raio de visão carrega **depois**, em segundo plano, aos poucos (RF-021). Nada pesado acontece no primeiro quadro jogável.

**MC21-RF-021 (P0) — Carregamento progressivo do raio.** Após entrar, os chunks restantes chegam em espiral do mais perto para o mais longe, respeitando os orçamentos da seção 4. É aceitável o horizonte "aparecer" aos poucos atrás da névoa; não é aceitável o quadro travar.

**MC21-RF-022 (P0) — Mundo já gerado primeiro do cache.** Chunks já gerados/salvos vêm do cache local (IndexedDB) e do save antes de gerar de novo; geração só para chunks inexistentes.

---

## 4. Orçamento por quadro (nada passa do limite)

**MC21-RF-030 (P0) — Pré-compilar shaders.** Todos os materiais que podem aparecer (terreno sólido/recorte/translúcido, água, lava, céu, nuvens, entidades, mão, partículas, HUD 3D e, se ligados, os passes do modo Shaders) são compilados **durante a tela de carregamento** usando a compilação assíncrona do three.js, numa cena de aquecimento com um exemplo de cada. Trocar a predefinição de shaders compila em segundo plano antes de aplicar (PRD 02 RF-063).

**MC21-RF-031 (P0) — Orçamento de tempo da thread principal.** Meta: **≤ 8 ms** de trabalho de CPU por quadro na thread principal. Tarefas fatiadas com limite de tempo por quadro:

| Tarefa | Limite por quadro |
|---|---|
| Upload de malhas de seção para a GPU | até **2 ms** ou o número da opção "Atualizações de chunk por quadro" (o que vier primeiro) |
| Remover malhas de chunks descarregados | até 1 ms |
| Criar/atualizar entidades novas | até 1 ms |
| Aplicar pacotes de rede já decodificados | até 2 ms |
| Atualizar texto do HUD (React) | no máximo 10 vezes por segundo |

O que sobrar fica para o próximo quadro. Medido pelo painel (RF-001).

**MC21-RF-032 (P0) — Tudo pesado fora da thread principal.** Em Web Workers: geração de terreno, luz, meshing, **descompactação e decodificação de chunks** recebidos pela rede, compressão para salvar, e o **servidor integrado inteiro** (PRD 01). A comunicação usa arrays transferíveis (sem cópia, sem JSON). Proibido: gerar, iluminar ou montar malha de chunk na thread principal "só para o spawn".

**MC21-RF-033 (P0) — Malhas sem recriar objetos (estilo Sodium).** Em vez de criar e destruir geometrias a cada atualização de seção:
- um **grande buffer de vértices por camada de render** dividido em blocos reaproveitáveis (alocador por regiões); a seção grava no seu bloco;
- quando o navegador suportar desenho múltiplo (extensão de multi-draw do WebGL), desenhar **todas as seções visíveis de uma camada em uma única chamada**; sem suporte, uma chamada por seção, mas sem objetos de cena por seção;
- matrizes não recalculadas automaticamente para objetos parados; culling feito pelo nosso grafo de visibilidade (PRD 13), não pelo three.js objeto a objeto.
Referência: "10-otimizacao-chunks-e-pacotes/minecraft-renderer" (buffer global de blocos, multi-draw, culling de seções).

**MC21-RF-034 (P0) — Prioridade e cancelamento.** Fila de meshing ordenada por distância e direção da câmera; tarefas de seções que saíram do raio antes de terminar são **canceladas**; uma seção alterada várias vezes seguidas gera **uma** reconstrução (junta pedidos).

---

## 5. Sem coleta de lixo no meio do jogo

**MC21-RF-040 (P0) — Zero alocação por quadro no loop do jogo.** Vetores, matrizes, caixas de colisão e arrays temporários são reaproveitados (variáveis de rascunho e pools). Proibido no caminho quente (física, raycast, render, rede, meshing): criar objetos por bloco, montar chaves de texto para chunks ("x,z"), usar arrays dinâmicos crescendo e encolhendo. Chaves de chunk numéricas (PRD 13 RF-003).

**MC21-RF-041 (P0) — Pools.** Pools para buffers de vértices de meshing, partículas, entidades de rede, pacotes e mensagens entre workers.

**MC21-RF-042 (P0) — Medição.** O painel mostra a memória JS; durante 2 minutos andando, a curva não pode ter "serrote" com quedas grandes a cada poucos segundos (sinal de lixo excessivo).

---

## 6. HUD e React

**MC21-RF-050 (P0)** O canvas do jogo vive fora do ciclo de renderização do React (montado uma vez). Nenhum estado React muda a cada quadro. HUD (vida, fome, XP, hotbar, F3) atualizado no máximo 10×/s e só quando o valor muda. Chat, Tab e telas não re-renderizam com o movimento do jogador.

---

## 7. Servidor, save e rede sem travar

- **MC21-RF-060 (P0)** Servidor integrado em Worker próprio; o tick do servidor nunca espera geração, save ou rede.
- **MC21-RF-061 (P0)** Autosave fatiado: serializa poucos chunks por tick no worker e envia ao Base44 em segundo plano; **nenhuma** espera de rede ou banco dentro do loop de render ou do tick.
- **MC21-RF-062 (P0)** Pacotes de rede recebidos são decodificados em worker e aplicados com o orçamento do RF-031.
- **MC21-RF-063 (P0)** Entrada de um convidado não congela o host: os chunks dele são enviados aos poucos (lotes do PRD 13 RF-101).

---

## 8. Detalhes de render que pesam

| Item | Exigência |
|---|---|
| Sombras dinâmicas | Desligadas por padrão; quando ligadas, mapa de sombra atualizado só quando o sol move o suficiente ou a câmera muda de seção, não todo quadro |
| Pós-processamento | Desligado no modo Clássico (zero passes extras) |
| Luzes | Nenhuma luz dinâmica do three.js por tocha/bloco; luz vem do lightmap (PRD 02). Luzes dinâmicas (opção) com no máximo 8 fontes |
| Partículas | Instanciadas, um desenho por tipo, limite global |
| Entidades | Geometria compartilhada por tipo, instancing, sem animar fora da tela |
| Água/translúcidos | Ordenação só quando a câmera muda de seção, em worker |
| Texturas | Array de texturas único, mipmaps gerados uma vez; trocar pacote de recursos refaz em segundo plano |
| Nuvens | Poucas malhas grandes (PRD 13 RF-080) |
| Contorno do bloco mirado | Um único objeto reaproveitado |

---

## 9. Opções de desempenho ligadas a isso (PRD 20)

"Escala de resolução", "Atualizações de chunk por quadro", "Ritmo de carregamento" (Suave/Equilibrado/Rápido), "Workers de meshing", "Workers de geração", "Pausar render com aba oculta" e "Economia de energia" precisam ter efeito direto nos orçamentos e filas deste PRD.

---

## 10. Critérios de aceite

- **MC21-CA-01** Benchmark de entrada (RF-003) num notebook com GPU integrada, build publicado: do clique em "Jogar" até andar em **≤ 6 s**, **nenhum quadro acima de 100 ms** depois da tela de carregamento e **no máximo 3 quadros acima de 50 ms** nos primeiros 30 s.
- **MC21-CA-02** Andando e voando no criativo por 2 minutos na distância 8: 60 FPS médios e nenhum quadro acima de 50 ms no log de travamentos.
- **MC21-CA-03** Autosave, entrada do amigo no mundo e primeira aparição de água/mobs não geram travamento (log vazio nesses momentos).
- **MC21-CA-04** O painel de desempenho mostra a thread principal ≤ 8 ms por quadro em média e zero geração/luz/meshing nela.
- **MC21-CA-05** Navegador sem aceleração de hardware mostra o aviso; com aceleração, o F3 mostra o nome da GPU real.
- **MC21-CA-06** Memória JS sem "serrote" forte durante 2 minutos de jogo.
