# MIND CAVE — PRD 09 de 12
# Tecnologia e Armas de Fogo (Ferro + Pólvora), Bancada de Armeiro, Balística e Zumbis Tecnológicos

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–08 (itens, crafting, projéteis, combate, animações, mobs e IA) |
| Objetivo | Criar a **expansão própria do Mind Cave**: uma árvore de tecnologia que usa **ferro, pólvora, ouro, redstone e madeira** para fabricar **armas de fogo, munição, granadas e acessórios** numa nova **Bancada de Armeiro**, com balística, recuo, mira (ADS), recarga, modos de disparo, sons e animações; e os **zumbis com tecnologia** — variantes de zumbi que usam armas, cavam, explodem barreiras, chamam reforços e vestem blindagem. Tudo ligável/desligável pelas regras `gunsEnabled` e `techZombies` (PRD 03). |
| Próximo | PRD 10 — Mind Cave Studio (editor/visualizador GLB) |

> Este PRD **não** é paridade com a 1.8.9 (o jogo original não tem armas). Ele deve **se encaixar** no estilo 1.8.9: mesmos materiais, mesma grade de crafting, mesmo ritmo de progressão (armas só depois de ferro), mesma lógica de servidor autoritativo, mesmo sistema de projéteis do PRD 07.

---

## 1. Princípios de design

1. **Progressão:** armas exigem ferro em quantidade, pólvora (de creepers, masmorras, templos, bruxas) e ouro para os cartuchos — são itens de meio/fim de jogo, não de primeiro dia.
2. **Munição é recurso:** cada tiro consome munição fabricada; isso limita o poder das armas.
3. **Risco/retorno:** disparos fazem barulho e **atraem mobs hostis** num raio de 32 blocos (16 com silenciador).
4. **Legibilidade:** todo tiro tem rastro visível, clarão e som claro; o jogador atingido sempre sabe de onde veio (indicador de direção de dano — extensão desta expansão).
5. **Mesmo motor:** armas usam o sistema genérico de projéteis (PRD 07 RF-034), o mesmo registro de itens (PRD 06) e o mesmo controlador de animações (PRD 07 RF-040), com clipes GLB substituíveis (PRD 10).

---

## 2. Novos materiais e blocos

**MC09-RF-001 (P0) — Itens novos de material.**

| Item | Obtenção | Pilha |
|---|---|---|
| Pepita de ferro | 1 lingote de ferro → 9 pepitas (bancada); 9 pepitas → 1 lingote | 64 |
| Cano de ferro | Bancada de Armeiro (seção 4) | 16 |
| Mecanismo de disparo | Bancada de Armeiro | 16 |
| Coronha de madeira | Bancada de Armeiro | 16 |
| Empunhadura | Bancada de Armeiro | 16 |
| Mola | Bancada de Armeiro | 64 |

**MC09-RF-002 (P0) — Bancada de Armeiro (bloco).** Bloco orientável (modelo próprio: bancada de madeira com morsa de ferro e ferramentas na parede de trás — procedural, substituível por GLB). Receita na bancada comum: linha de cima **3 lingotes de ferro**; linha do meio **tábua, bancada de trabalho, tábua**; linha de baixo **3 tábuas**. Dureza 2,5, ferramenta machado, luz 0.

---

## 3. Catálogo de armas, munição e explosivos

**MC09-RF-010 (P0) — Munições.**

| Munição | Usada por | Receita (Bancada de Armeiro) | Rendimento |
|---|---|---|---|
| **Munição leve** | Pistola, Carabina | 1 pepita de ferro + 1 pólvora + 1 pepita de ouro (sem formato) | 8 |
| **Munição pesada** | Rifle de ferrolho | 2 pepitas de ferro + 2 pólvoras + 1 pepita de ouro (sem formato) | 4 |
| **Cartucho de escopeta** | Escopeta | 1 papel + 1 pólvora + 3 pepitas de ferro (sem formato) | 4 |

**MC09-RF-011 (P0) — Armas (valores iniciais de balanceamento).**

| Arma | Dano por projétil | Cadência | Carregador | Recarga | Alcance efetivo / queda de dano | Dispersão (quadril / ADS) | Recuo vertical | Durabilidade | Munição |
|---|---|---|---|---|---|---|---|---|---|
| **Pistola** | 5 | semi, máx. 4 tiros/s | 12 | 30 ticks | 32 blocos → 60% em 64 | 1,5° / 0,3° | 2° | 600 tiros | Leve |
| **Escopeta (pump)** | 8 chumbos × 2,5 | 1 tiro a cada 16 ticks | 6 | cartucho a cartucho, 12 ticks cada (interrompível atirando) | 12 → 20% em 24 | 6° fixos (cone) | 6° | 400 | Cartucho |
| **Rifle de ferrolho** | 16 (penetra 40% da armadura) | 1 tiro a cada 25 ticks (ferrolho) | 5 | 50 ticks | 128 → 80% em 192 | 2,5° / 0° | 8° | 300 | Pesada |
| **Carabina** | 3 | automático 8 tiros/s; rajada de 3; semi | 24 | 40 ticks | 48 → 50% em 96 | 2° / 0,6° | 1,2° por tiro em padrão crescente | 800 | Leve |
| **Granada de mão** | Explosão potência 2,5 | arremesso (como bola de neve, velocidade 1,0) | — | — | Pavio 60 ticks, quica | — | — | consumível | — |

**MC09-RF-012 (P0) — Receitas de armas e acessórios (Bancada de Armeiro).**

| Resultado | Ingredientes |
|---|---|
| Cano de ferro | 3 lingotes de ferro em linha horizontal |
| Mola (×4) | 4 pepitas de ferro em zigue-zague |
| Mecanismo de disparo | 2 lingotes de ferro + 1 pó de redstone + 1 sílex + 1 mola |
| Coronha de madeira | 3 tábuas em "L" |
| Empunhadura | 2 tábuas + 1 couro |
| Pistola | 1 cano + 1 mecanismo + 1 empunhadura |
| Escopeta | 2 canos (lado a lado) + 1 mecanismo + 1 coronha |
| Rifle de ferrolho | 2 canos (em linha) + 1 mecanismo + 1 coronha + 1 diamante |
| Carabina | 1 cano + 2 mecanismos + 1 coronha + 1 empunhadura + 1 lingote de ouro |
| Granada (×2) | 1 lingote de ferro + 4 pólvoras + 1 sílex |
| Mira telescópica (4×) | 2 painéis de vidro + 2 lingotes de ferro + 1 pó de glowstone |
| Silenciador | 2 lingotes de ferro + 3 lãs |
| Lanterna tática | 1 glowstone + 1 lingote de ferro + 1 vidro |
| Carregador estendido | 3 lingotes de ferro + 1 mola |

Todas as receitas ficam no registro de receitas (data-driven) com a categoria "Armeiro" e são editáveis no Studio (PRD 10).

**MC09-RF-013 (P0) — Acessórios.** Encaixados na Bancada de Armeiro (aba "Modificar"):

| Acessório | Compatível | Efeito |
|---|---|---|
| Mira telescópica | Rifle, Carabina | ADS com zoom 4× e overlay de luneta (preto em volta, retículo); oscilação da mira (respiração) que estabiliza segurando Shift por até 3 s |
| Silenciador | Pistola, Carabina, Rifle | Som de tiro muito mais baixo, raio de atração de mobs 16, sem clarão visível de longe; −10% de dano |
| Lanterna tática | Todas | Liga/desliga com a tecla "Modo de disparo" segurada; projeta cone de luz dinâmica (visual, PRD 03 luzes dinâmicas) |
| Carregador estendido | Pistola (18), Carabina (36) | +50% de carregador, +20% de tempo de recarga |

---

## 4. Bancada de Armeiro (tela)

**MC09-RF-020 (P0) — Abas.**
- **Fabricar:** grade 3×3 + resultado (mesmo motor de receitas do PRD 06, aceitando só receitas da categoria Armeiro e as comuns de pepitas), lista lateral de receitas pesquisável (sempre ligada nesta bancada, por ser conteúdo novo), pré-visualização **3D girável** do resultado.
- **Modificar:** slot da arma no centro e slots de acessórios em volta (cano/silenciador, topo/mira, trilho/lanterna, carregador); pré-visualização 3D mostrando os acessórios montados nos **pontos de encaixe** do modelo (PRD 10); estatísticas comparativas (antes → depois) em barras.
- **Reparar:** arma + lingotes de ferro → recupera 25% da durabilidade por lingote (custo de XP 1 nível por operação, como bigorna simplificada).

---

## 5. Mecânica de tiro

**MC09-RF-030 (P0) — Controles.** Com arma na mão: clique esquerdo **atira** (segurar = automático se o modo for auto), botão direito **mira (ADS)** (segurar ou alternar — PRD 03), **R** recarrega, **B** troca o modo de disparo, segurar **B** liga/desliga a lanterna. A arma **não** quebra blocos nem ataca corpo a corpo com o clique esquerdo; para coronhada, usar a tecla "Atacar" com Shift (golpe de 3 de dano, knockback alto, cadência 1 por segundo).

**MC09-RF-031 (P0) — Projéteis.** Cada disparo cria projéteis de alta velocidade (bala: 20 blocos/tick; chumbo: 15; gravidade 0,01/tick; sem arrasto até o alcance máximo, depois some) no sistema genérico, com varredura (raycast por tick) para nunca atravessar alvos. Rastro visível (linha brilhante curta, *tracer*) em 1 de cada N tiros (todos na carabina com 1 a cada 3).

**MC09-RF-032 (P0) — Dano e regras.**
- Queda de dano linear entre o alcance efetivo e o alcance final da tabela.
- **Tiro na cabeça:** região da cabeça definida por mob no registro (jogador: 0,5 superior da caixa ≈ 1,3–1,8 de altura) → ×1,5 (rifle ×2). Marcador de acerto especial.
- Armadura reduz normalmente (PRD 05), exceto a penetração indicada.
- **Janela de invulnerabilidade:** projéteis de arma de fogo **não respeitam nem iniciam** a janela de 10 ticks (cada bala conta) — necessário para armas automáticas fazerem sentido. Os valores de dano da tabela já consideram isso. A regra `gunDamageMultiplier` (padrão 1,0; extensão do PRD 03) permite rebalancear.
- Knockback pequeno por bala (0,1), maior por chumbo de escopeta somado.
- Blocos: balas **quebram** apenas blocos de vidro (vidro, painéis e vidros tingidos) e acendem TNT (somente se `explosionsBreakBlocks`); demais blocos geram partículas de impacto com a textura do bloco e **marca de bala** temporária (decalque, some em 30 s, máximo 64 no mundo por cliente).
- Água: projétil perde 80% da velocidade por tick dentro d'água (para em ~2 blocos), com bolhas.
- PvP/`friendlyFire` respeitados.

**MC09-RF-033 (P0) — Precisão e recuo.**
- Dispersão base (tabela) × multiplicadores: parado 1,0; andando 1,5; correndo 2,5 (e não pode atirar correndo: o sprint é interrompido ao atirar); no ar 3,0; agachado 0,7; ADS = valor de ADS.
- Recuo: cada tiro empurra a câmera para cima (valor da tabela) e para o lado aleatório (±30% do vertical); recuperação suave de 70% em ~6 ticks se o jogador não compensar. Carabina tem padrão de recuo crescente nos primeiros 8 tiros.
- **Mira dinâmica** (extensão): ao segurar arma, o retículo clássico vira 4 traços que se afastam conforme a dispersão atual (opção para manter a mira clássica).

**MC09-RF-034 (P0) — Recarga.** Tecla R ou automática ao tentar atirar com carregador vazio (som de "clique seco" primeiro). Consome munição do inventário; recarga parcial possível; trocar de item cancela a recarga (sem perder munição). Escopeta: cartucho a cartucho; atirar interrompe. Barra de progresso de recarga discreta abaixo da mira. Não é possível recarregar sem munição (aviso na barra de ação).

**MC09-RF-035 (P0) — HUD.** Na barra de ação (PRD 02): `PISTOLA  ▸ 9 / 47  [SEMI]` (munição no carregador / total no inventário / modo). Indicador de dano direcional (arco vermelho na borda da tela apontando para a origem do tiro recebido). Marcador de acerto (X branco na mira; vermelho em abate; amarelo em tiro na cabeça) + som curto, **confirmado pelo servidor**.

**MC09-RF-036 (P0) — Som e efeitos.** Disparo (alto, audível até 96 blocos com atenuação; silenciado até 24), cauda do disparo diferente em ambiente fechado (cavernas: mais reverberação, estimada pela quantidade de blocos sólidos em volta), recarga (etapas), ferrolho/pump, clique seco, ricochete aleatório em pedra/ferro, granada (pino, quique, explosão). Clarão do cano (sprite + luz dinâmica de 2 quadros, respeitando "Reduzir flashes"), fumaça leve, **cápsulas ejetadas** (partícula física pequena que quica e some em 3 s; Escopeta: ejeta no pump), tremor de câmera leve (escalável — PRD 03).

**MC09-RF-037 (P0) — Rede e autoridade.** O cliente envia ao servidor um evento de disparo com número de sequência, arma, origem, direção, semente de dispersão e tempo do cliente; o servidor valida (cadência, munição, posição, distância), simula os projéteis com **compensação de latência** (PRD 07 RF-010) e difunde aos outros clientes para render de rastros/sons. O cliente do atirador prevê localmente clarão, som, recuo, munição e rastro, e é corrigido se o servidor recusar (ex.: munição divergente).

**MC09-RF-038 (P0) — Barulho atrai mobs.** Cada disparo emite um "evento de ruído" no servidor; mobs hostis em 32 blocos (16 silenciado) ganham um objetivo temporário "investigar ruído" (andar até a origem) se ainda não tiverem alvo — novo objetivo de IA registrado no sistema do PRD 08.

**MC09-RF-039 (P0) — Granada.** Arremesso com Botão esquerdo (longo) ou direito (curto, metade da velocidade); quica com perda de 60% da velocidade por impacto, rola; pavio de 60 ticks iniciado ao arremessar (segurar o botão "cozinha" a granada — o pavio corre na mão; soltar após 60 ticks explode na mão); explosão potência 2,5 (quebra blocos se `explosionsBreakBlocks`); indicador de granada próxima (ícone na tela apontando a direção) para quem está a ≤ 8 blocos.

---

## 6. Animações e modelos das armas

**MC09-RF-040 (P0) — Estados de animação (1ª e 3ª pessoa).** `equipar`, `ocioso`, `andar` (balanço da arma), `correr` (arma abaixada/inclinada), `mirar` (transição 6 ticks para o centro da tela alinhando a mira do modelo com o centro), `atirar` (coice do modelo + retorno), `recarregar` e `recarregar_vazio` (diferentes: o vazio inclui puxar o ferrolho/ação), `ferrolho`/`pump`, `inspecionar` (tecla de inspecionar — extensão, P2), `coronhada`, `granada_puxar_pino`/`arremessar`. Em 3ª pessoa: pose de duas mãos para escopeta/rifle/carabina, uma mão para pistola, cabeça e braços seguindo o pitch.

**MC09-RF-041 (P0) — Modelos procedurais.** Cada arma tem um modelo procedural de "voxels" (pequenos cubos estilo item 3D) com cores de ferro escuro, madeira e ouro, com **pontos de encaixe** nomeados: `boca_do_cano`, `ejecao`, `carregador`, `trilho_superior`, `trilho_inferior`, `mao_esquerda` (alvo de IK para a mão de apoio), `mao_direita`. Substituíveis por GLB no PRD 10 (o GLB deve conter "empties"/ossos com esses nomes; o Studio permite criar/ajustar os pontos se faltarem).

**MC09-RF-042 (P0) — Visual na mão em 1ª pessoa.** O FOV da mão (PRD 07) muda levemente ao mirar; a mão esquerda segura a arma (2 braços visíveis) quando a arma é de duas mãos; com mira telescópica no ADS, o modelo some e aparece o overlay de luneta.

---

## 7. Zumbis com tecnologia

> Interpretação adotada para "zumbis têm que ter tecnologia": além dos zumbis normais da 1.8.9, existem **variantes tecnológicas** que usam as mesmas armas e ferramentas dos jogadores, ou equipamentos improvisados, e que tornam as noites mais táticas. Elas usam a mesma base de IA do zumbi (PRD 08) com objetivos extras.

**MC09-RF-050 (P0) — Regras de spawn.** Quando a regra `techZombies` está ligada, cada zumbi que nasceria naturalmente tem chance `techZombieChance` (padrão 15%, multiplicado por `0,5 + dificuldadeLocal/4`) de virar uma variante, sorteada entre as **liberadas pela dificuldade local** (PRD 05 RF-011):

| Variante | Liberada a partir de dificuldade local | Dificuldade global mínima |
|---|---|---|
| Zumbi Soldado | 1,5 | Fácil |
| Zumbi Minerador | 1,5 | Fácil |
| Zumbi Batedor (rádio) | 2,0 | Normal |
| Zumbi Sapador | 2,5 | Normal |
| Zumbi Blindado | 2,5 | Normal |
| Zumbi Atirador de elite | 3,5 | Difícil |

Nunca em Pacífico; nunca de dia (eles também queimam ao sol, exceto Blindado/Soldado com capacete). Geradores de monstros não criam variantes (exceto o "Posto avançado", RF-060).

**MC09-RF-051 (P0) — Variantes.**

| Variante | Vida / armadura | Equipamento visual | Comportamento | Drops extras |
|---|---|---|---|---|
| **Zumbi Soldado** | 24 / 4 (capacete + colete) | Capacete militar, colete, pistola | Persegue; com linha de visão a ≤ 16 blocos para e atira **rajadas de 2–3 tiros** com dispersão alta (3°) e intervalo 40–60 ticks; usa corpo a corpo se o alvo chegar a 2 blocos; munição infinita | Munição leve 2–6 (30%), pistola danificada (4%, com 10–40% de durabilidade) |
| **Zumbi Minerador** | 20 / 2 | Capacete com **lanterna** (luz dinâmica visível), picareta de ferro | Quando o caminho até o alvo está **bloqueado**, **cava** em linha reta até ele, quebrando blocos com o tempo de mineração de uma picareta de ferro (respeita `mobGriefing`; não quebra obsidiana/bedrock); é o contra-ataque a bunkers | Carvão/ferro bruto 1–3 (25%), picareta de ferro danificada (5%) |
| **Zumbi Batedor** | 16 / 0 | Mochila com **rádio** e antena piscando | Rápido (velocidade 0,30); ao avistar um jogador, para, emite som de rádio + sinalizador de fumaça vermelha e **chama reforços**: 2–4 zumbis (podendo incluir variantes) surgem a 12–24 blocos, fora da visão; recarga 600 ticks; foge se perder metade da vida | Redstone 1–3, pó de glowstone (10%) |
| **Zumbi Sapador** | 20 / 2 | Colete de **cargas** (TNT presas), detonador | Procura paredes/portas entre ele e o alvo; ao chegar, planta uma **carga** (TNT acesa com pavio de 40 ticks) e recua; se morrer com fogo/explosão, as cargas detonam (potência 3); se o jogador estiver a ≤ 2 blocos e não houver parede, detona a si mesmo como um creeper (pavio 30 ticks, sinal sonoro de bipes acelerando) | Pólvora 2–5, TNT (10%) |
| **Zumbi Blindado** | 40 / 12 (placas de ferro) | Placas de aço pesadas, elmo fechado | Lento (0,18), **resistência a knockback 0,8**, imune ao fogo do sol (protegido), ataque 6 (Normal); **ponto fraco nas costas** (dano ×2 vindo de trás, regra de região); balas sem penetração causam 50% | Lingotes de ferro 2–5, bloco de ferro (5%) |
| **Zumbi Atirador de elite** | 20 / 2 | Capuz, rifle com mira | Mantém distância de 30–60 blocos em terreno alto; antes de atirar, mostra **laser vermelho** apontado ao alvo por 30 ticks (telegrafia visível e som de "travar mira"), depois dispara (dano do rifle × 0,6); reposiciona após cada tiro | Munição pesada 1–4 (30%), mira telescópica (3%), rifle danificado (2%) |

**MC09-RF-052 (P0) — IA nova (objetivos registrados no sistema do PRD 08).** `AtirarComArma` (linha de visão, distância ideal, rajadas, precisão por dificuldade), `CavarAteAlvo`, `ChamarReforços`, `PlantarCarga`, `ManterDistânciaDeElite`, `InvestigarRuído` (RF-038), `ProtegerCostas` (Blindado vira de frente para o atacante mais próximo). Os projéteis dos zumbis usam o mesmo sistema e as mesmas regras de dano/armadura das armas dos jogadores.

**MC09-RF-053 (P0) — Telegrafia e justiça.** Toda ação perigosa de variante tem aviso audiovisual antes: Soldado (som de engatilhar 10 ticks antes da rajada), Sapador (bipes), Atirador (laser), Batedor (rádio). As legendas (PRD 03) mostram esses sons.

**MC09-RF-060 (P1) — Estrutura "Posto avançado abandonado".** Nova estrutura no Mundo Aberto (planícies, savana, taiga; espaçamento 48 chunks): pequena base de pedregulho/ferro com cercas, torre de vigia, **caixas de suprimento** (baús com loot de tecnologia: pepitas, pólvora, munições, peças, raramente uma arma danificada e plantas de receita), e um **gerador de Zumbi Soldado**. Registrada no gerador do PRD 04 como estrutura de extensão.

---

## 8. Integração com o resto do jogo

- **MC09-RF-070 (P0)** Aba criativa "Tecnologia" com todos os itens deste PRD.
- **MC09-RF-071 (P0)** Mensagens de morte: "Fulano foi baleado por Ciclano usando [Rifle de Ferrolho]", "Fulano foi baleado por Zumbi Soldado", "Fulano foi pelos ares pela carga de um Zumbi Sapador", "Fulano foi explodido por uma Granada de Ciclano".
- **MC09-RF-072 (P0)** Estatísticas: tiros disparados, acertos, tiros na cabeça, precisão %, munição fabricada, variantes de zumbi abatidas por tipo.
- **MC09-RF-073 (P0)** Laboratório (PRD 04): o **Estande de tiro** recebe alvos que mostram o ponto de impacto (placa com grade) e números de dano; botão para spawnar cada variante de zumbi congelada (para testar modelos/animações).
- **MC09-RF-074 (P0)** Com `gunsEnabled=false`: receitas da Bancada de Armeiro somem, armas existentes não atiram (aviso na barra de ação) e zumbis-soldado/atiradores não nascem.

---

## 9. Requisitos não funcionais

- **MC09-RNF-001 (P0)** Carabina em automático com dois jogadores atirando ao mesmo tempo mantém TPS 20 e FPS dentro das metas.
- **MC09-RNF-002 (P0)** Latência de feedback local do disparo (clique → som/clarão/recuo) = 0 quadros.
- **MC09-RNF-003 (P0)** Banda por disparo ≤ 40 bytes (eventos compactos; os rastros são reconstruídos a partir da semente de dispersão).
- **MC09-RNF-004 (P0)** Decalques e partículas com limite e reaproveitamento (pool); nenhum crescimento de memória após 10.000 disparos.

---

## 10. Critérios de aceite

- **MC09-CA-01** Do zero em sobrevivência: obter ferro, pólvora e ouro → criar Bancada de Armeiro → pistola + munição leve → atirar, recarregar, mirar; tudo funcionando para os dois jogadores.
- **MC09-CA-02** Valores da tabela RF-011 conferidos no boneco de treino (dano, queda por distância, tiro na cabeça, cadência máxima).
- **MC09-CA-03** Escopeta a 5 blocos acerta quase todos os chumbos; a 20 blocos, poucos e com dano reduzido.
- **MC09-CA-04** Rifle com mira telescópica mostra overlay, oscilação e estabilização com Shift; recuo forte; ferrolho entre tiros.
- **MC09-CA-05** Disparos atraem zumbis próximos (observável com o debug de IA mostrando "InvestigarRuído").
- **MC09-CA-06** Cada uma das 6 variantes de zumbi aparece (via `/summon` e naturalmente em dificuldade local adequada), com equipamento visual, comportamento e telegrafia descritos; o Minerador cava até o jogador escondido em casa de pedra; o Sapador abre buraco na parede com carga.
- **MC09-CA-07** Com `techZombies=false`, nenhuma variante nasce; com `gunsEnabled=false`, as armas não atiram.
- **MC09-CA-08** Granada quica, rola, explode após 3 s; "cozinhar" a granada funciona; indicador de granada aparece.
