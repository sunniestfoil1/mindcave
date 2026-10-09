# MIND CAVE — PRD 11 de 12
# Sistemas Avançados: Redstone, Pistões, Funis, Explosões, Agricultura, Encantamento, Bigorna, Poções, Sinalizador, Carrinhos, Nether, The End e Chefes

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–10 |
| Objetivo | Completar o "Minecraft de verdade" com os sistemas de profundidade da 1.8.9: **redstone** completa (fios, tochas, repetidores, comparadores, pistões, ejetores, funis, trilhos), **explosões e TNT**, **agricultura** (plantações, mudas, cana, cacto, abóbora/melancia, verruga), **encantamento e bigorna**, **poções e suporte de poções**, **sinalizador**, **carrinhos**, e as dimensões **Nether** e **The End** com seus mobs, estruturas e os chefes **Wither** e **Dragão do Ender**. |
| Próximo | PRD 12 — Multiplayer Avançado, Qualidade e Polimento |

> Documento de requisitos. Tudo roda no servidor (autoritativo) com tempos em ticks. "Tick de redstone" = 2 ticks de jogo (0,1 s).

---

## 1. Redstone

### 1.1 Modelo de energia

**MC11-RF-001 (P0) — Níveis e tipos de energização (1.8.9).**
- Sinal de 0 a 15.
- Bloco **fortemente energizado** (por fonte acoplada: tocha embaixo, alavanca/botão presos nele, repetidor/comparador apontando para ele) energiza fios adjacentes e componentes.
- Bloco **fracamente energizado** (por fio apontando para ele ou fio em cima) ativa componentes adjacentes, mas **não** energiza fios.
- Blocos transparentes (vidro, lajes, escadas, folhas, glowstone) não conduzem energia.
- Atualizações de vizinhança disparam reavaliação; o motor deve ser **determinístico** (mesma ordem de atualização sempre), com proteção contra laços infinitos (orçamento de atualizações por tick com registro de "circuito excessivo").

**MC11-RF-002 (P0) — Fio de redstone.** Perde 1 de força por bloco; conecta-se a componentes, sobe/desce degraus de 1 bloco (exceto quando o bloco de cima corta a conexão diagonal); aponta para um bloco quando termina nele (forma de linha); um fio **isolado** tem formato de "+" e, como no Java 1.8, energiza os 4 blocos laterais e o bloco de baixo. Cor varia de vermelho escuro (0) a vermelho vivo (15), partículas quando ativo.

**MC11-RF-003 (P0) — Fontes.**

| Fonte | Comportamento 1.8.9 |
|---|---|
| Alavanca | Liga/desliga; força 15; energiza fortemente o bloco onde está presa |
| Botão de pedra | Pulso de 20 ticks (10 ticks de redstone) |
| Botão de madeira | Pulso de 30 ticks; também ativado por **flechas** (fica pressionado enquanto a flecha estiver nele) |
| Placa de pressão de pedra | Ativa com jogadores e mobs; força 15 |
| Placa de pressão de madeira | Qualquer entidade (incluindo itens e flechas) |
| Placa leve (ouro) / pesada (ferro) | Força proporcional ao número de entidades (leve: 1 por entidade até 15; pesada: 1 a cada 10 entidades) |
| Tocha de redstone | Força 15; **inversora** (apaga quando o bloco em que está fica energizado); atraso 1 tick de redstone; **queima** se alternar mais de 8 vezes em 60 ticks (para por um tempo, com fumaça e som) |
| Bloco de redstone | Fonte permanente 15 (energiza fios/componentes vizinhos; move-se com pistões) |
| Sensor de luz | Força pela luz do céu e hora do dia; modo invertido (clique) |
| Gancho de armadilha + fio | Força 15 enquanto uma entidade toca o fio; tesoura corta sem acionar |
| Trilho detector | Força 15 com carrinho em cima; comparador lê conteúdo do carrinho |
| Baú armadilha | Força = número de jogadores com ele aberto |
| Minério de redstone | Acende ao ser tocado/clicado (luz 9), não emite sinal |

**MC11-RF-004 (P0) — Repetidor.** Atraso configurável 1–4 ticks de redstone (clique direito alterna); restaura o sinal para 15; só transmite numa direção; **trava** quando outro repetidor/comparador energizado aponta para sua lateral (barra de travamento visual). Pulsos menores que o atraso são estendidos ao atraso.

**MC11-RF-005 (P0) — Comparador.** Modo comparar (saída = traseira se traseira ≥ maior lateral, senão 0) e subtrair (traseira − maior lateral); alterna com clique (luz da frente). Leitura de blocos atrás (diretamente ou através de 1 bloco sólido): containers (`piso(1 + (fração cheia × 14))` se houver qualquer item, 0 se vazio), bolo (fatias × 2), caldeirão (nível), moldura do portal do End com olho (15), toca-discos (número do disco), bloco de comando (resultado). Atraso 1 tick de redstone.

### 1.2 Componentes acionados

**MC11-RF-010 (P0) — Pistões.**
- Empurra até **12 blocos** em linha; não empurra: obsidiana, bedrock, blocos com dados (baús, fornalhas, ejetores, funis, placas, gerador…), pistões estendidos, portais, blocos com mais de dureza −1; blocos "frágeis" (tochas, flores, plantas, fio…) quebram e dropam.
- **Pistão grudento** puxa o bloco da frente ao retrair (pulso de 1 tick de redstone solta o bloco — comportamento 1.8).
- **Blocos de slime (1.8):** movem junto todos os blocos encostados (respeitando o limite de 12), não grudam em obsidiana/bedrock/blocos imóveis; entidades em cima são lançadas.
- **Quasi-conectividade** (comportamento Java): pistões, ejetores e liberadores também são ativados por energia no bloco **acima** deles, mas só reavaliam quando recebem uma atualização de vizinhança (comportamento "BUD"). Precisa existir porque circuitos de jogadores dependem dele.
- Animação de extensão/retração em 2 ticks de jogo (blocos em movimento como entidade de render), entidades empurradas junto.

**MC11-RF-011 (P0) — Ejetor (dispenser).** Ao receber pulso (borda de subida), escolhe um slot aleatório e: dispara flechas, ovos, bolas de neve, cargas de fogo (pegam fogo), poções arremessáveis, garrafas de XP; coloca/pega água e lava com balde; coloca **TNT acesa**; usa pederneira (acende fogo); usa farinha de osso; equipa armadura num jogador à frente; coloca barcos/carrinhos; usa ovos de spawn; demais itens são **soltos** como liberador. **Regra Mind Cave:** ejetores **não disparam armas de fogo** (evita torretas automáticas sem custo de munição); granadas colocadas num ejetor são arremessadas já ativadas.

**MC11-RF-012 (P0) — Liberador (dropper).** Solta 1 item; se houver container à frente, transfere para ele (cadeias de liberadores).

**MC11-RF-013 (P0) — Funil (hopper).** 5 slots; a cada **8 ticks** puxa 1 item do container acima (ou item solto em cima) e empurra 1 item para o container para onde aponta; **travado** quando energizado; interage com baús, baús duplos, fornalhas (cima → entrada; lateral → combustível; embaixo puxa a saída), suportes de poções, ejetores, liberadores, carrinhos com baú/funil.

**MC11-RF-014 (P0) — Outros componentes.** Lâmpada de redstone (luz 15; desliga com atraso de 2 ticks de redstone), bloco musical (25 tons ao clicar; instrumento pelo bloco embaixo: madeira = baixo, pedra = bumbo, areia = caixa, vidro = clique, outros = piano; toca ao receber pulso; partícula de nota colorida), toca-discos, portas/alçapões/portões (incluindo porta e alçapão de ferro só por redstone), trilhos energizados/ativadores, TNT (ativa com sinal).

**MC11-RF-015 (P2) — Bloco de comando.** Só criativo + `devTools`; executa o comando ao receber pulso; saída de sucesso para comparador; interface de edição.

**MC11-RF-016 (P0) — Desempenho.** Relógios rápidos de redstone (ex.: tocha queimando, repetidores em loop) não podem derrubar o TPS: orçamento de atualizações, agendamento por tick com fila de prioridade e deduplicação. Circuitos em chunks fora da distância de simulação ficam congelados.

---

## 2. TNT e explosões

**MC11-RF-020 (P0) — TNT.** Acesa por fogo, pederneira, redstone, flecha em chamas, explosão (pavio aleatório 10–30 ticks em reação em cadeia) ou ejetor. Vira **entidade de TNT acesa** com física (cai, é empurrada pela água — sem destruir blocos se explodir **dentro da água**), pisca branco, pavio **80 ticks**, potência **4**.

**MC11-RF-021 (P0) — Algoritmo de explosão (1.8.9).** Raios a partir do centro em grade 16×16×16 (só a "casca"), cada um com intensidade `potência × (0,7 a 1,3)` reduzida a cada passo de 0,3 bloco por `(resistênciaDoBloco + 0,3) × 0,3` e por 0,225 fixo; blocos alcançados com intensidade > 0 são destruídos (se a regra permitir — `explosionsBreakBlocks`/`mobGriefing` para creepers e Sapadores). Drops dos blocos destruídos com chance `1/potência`. Fogo opcional (cargas de fogo, camas no Nether, ghasts). Dano e arremesso de entidades pela fórmula do PRD 05. Partículas (grande explosão + fumaça) e som. Explosões de TNT na água não destroem blocos, mas ferem.

---

## 3. Agricultura e plantas

**MC11-RF-030 (P0) — Terra arada.** Hidratada se houver água num raio de **4 blocos** horizontais no mesmo nível ou 1 acima (textura mais escura); sem água e sem plantação vira terra; **pisoteio**: entidade que cai/pula em cima pode transformá-la em terra (sempre que o jogador pula sobre ela no 1.8; mobs também, exceto se `mobGriefing=false`).

**MC11-RF-031 (P0) — Plantações (trigo, cenoura, batata).** 8 estágios; crescem por **tick aleatório** com chance baseada na hidratação e na disposição das plantações vizinhas (fileiras alternadas crescem mais rápido — fórmula 1.8 de "pontos"); exigem luz ≥ 9 no bloco acima; quebram se a terra arada sumir. Colheita: trigo (1 trigo + 0–3 sementes), cenoura (1–4), batata (1–4 + 2% batata venenosa).

**MC11-RF-032 (P0) — Outras plantas.**
- Mudas: crescem em árvore por tick aleatório (2 estágios) com luz ≥ 9 e espaço; selva/abeto/carvalho escuro em **2×2** geram árvores gigantes; carvalho escuro só cresce em 2×2.
- Cana-de-açúcar: em areia/terra/grama ao lado de água, cresce até 3 de altura.
- Cacto: em areia, até 3 de altura, quebra se houver bloco ao lado.
- Abóbora/melancia: caule cresce 8 estágios e gera o fruto num bloco vizinho livre de terra/grama/terra arada.
- Verruga do Nether: em areia das almas, 4 estágios, sem luz exigida.
- Cogumelos: se espalham em baixa luz (≤ 12) até 5 num raio; cogumelo gigante com farinha de osso.
- Cacau: em tronco de selva, 3 estágios.
- Trepadeiras: se espalham lateralmente e para baixo.
- Grama e micélio: espalham (PRD 02).
- **Farinha de osso:** acelera estágios (aleatório 2–5 em plantações 1.8), faz mudas crescerem (45% por uso), gera grama alta e flores em volta ao usar na grama, faz cogumelo gigante (40%).

---

## 4. Encantamento e bigorna

**MC11-RF-040 (P0) — Mesa de encantamento (1.8.9).** Modelo com livro flutuante que abre/vira quando um jogador está perto; partículas de glifos das estantes próximas. Interface: slot do item, slot de **lápis-lazúli** (novo na 1.8), 3 opções com custo exibido (nível exigido) e **dica** de um encantamento por opção ao passar o mouse. Custo real: 1/2/3 níveis e 1/2/3 lápis para as opções de cima, meio e baixo. Nível exigido máximo 30 com **15 estantes** a 2 blocos de distância com ar entre elas. Semente de encantamento **por jogador** (muda só ao encantar). Encantabilidade por material (madeira 15, pedra 5, ferro 14/armadura 9, ouro 22/25, diamante 10, couro 15, malha 12, livro 1).

**MC11-RF-041 (P0) — Encantamentos (1.8.9).**

| Encantamento | Máx. | Itens | Efeito |
|---|---|---|---|
| Proteção | IV | Armadura | Reduz dano geral (EPF) |
| Proteção contra fogo | IV | Armadura | Reduz fogo e tempo em chamas |
| Peso-pena | IV | Botas | Reduz dano de queda |
| Proteção contra explosões | IV | Armadura | Reduz explosões e o arremesso |
| Proteção contra projéteis | IV | Armadura | Reduz projéteis (inclui balas — extensão) |
| Respiração | III | Capacete | +15 s de ar por nível e chance de não perder ar |
| Afinidade aquática | I | Capacete | Remove a penalidade de mineração na água |
| Espinhos | III | Armadura | Chance de devolver dano ao atacante (gasta durabilidade extra) |
| Passos profundos | III | Botas | Reduz a lentidão na água (novo na 1.8) |
| Afiação | V | Espada, machado | +1,25 de dano por nível |
| Julgamento | V | Espada, machado | +2,5 por nível contra mortos-vivos |
| Ruína dos artrópodes | V | Espada, machado | +2,5 contra aranhas/traças/endermites + Lentidão IV |
| Repulsão | II | Espada | Knockback extra |
| Aspecto flamejante | II | Espada | Põe o alvo em chamas (4 s por nível) |
| Saque | III | Espada | +1 drop máximo por nível e mais chance de drops raros |
| Eficiência | V | Ferramentas | Mineração mais rápida (PRD 06) |
| Toque suave | I | Ferramentas | Dropa o próprio bloco |
| Inquebrável | III | Tudo com durabilidade | Chance de não gastar durabilidade (`1/(nível+1)`; armadura: `60% + 40%/(nível+1)`) |
| Fortuna | III | Ferramentas | Mais drops de minérios/plantas (multiplicador aleatório) |
| Força | V | Arco | +25% × (nível+1) de dano |
| Impacto | II | Arco | Knockback extra da flecha |
| Chama | I | Arco | Flechas incendeiam |
| Infinidade | I | Arco | Não consome flechas (precisa de 1) |
| Sorte do mar | III | Vara | Mais tesouros |
| Isca | III | Vara | Menos espera |

Fórmula de proteção 1.8: soma de EPF de todas as peças (máx. 25), multiplicada por um fator aleatório de 50–100%, limitada a 20 → cada ponto reduz 4% (após a armadura).

**MC11-RF-042 (P1) — Encantamentos de armas de fogo (extensão Mind Cave).** Disponíveis só por **livro** encontrado em Postos avançados (PRD 09) e aplicáveis na bigorna: **Calibre** (III, +8% de dano por nível), **Estabilidade** (III, −15% de recuo por nível), **Mão rápida** (III, −12% de tempo de recarga por nível), **Economia** (III, chance de 10%/nível de não gastar munição). Desligados se `gunsEnabled=false`.

**MC11-RF-043 (P0) — Bigorna (1.8.9).** Renomear (custo base), reparar com material (cada unidade repara 25%), combinar dois itens iguais (somar durabilidade + 12% e mesclar encantamentos, aumentando níveis iguais) ou item + livro encantado. **Penalidade de trabalho anterior** que dobra a cada uso no item. Acima de **40 níveis**: "Caro demais!" (sobrevivência). Cada uso tem **12%** de chance de danificar a bigorna (intacta → lascada → muito danificada → quebra). Bigorna cai como areia e causa dano (PRD 05).

---

## 5. Poções

**MC11-RF-050 (P0) — Suporte de poções (1.8.9).** 3 slots de garrafa + 1 de ingrediente; cada preparo leva **400 ticks** (20 s); na 1.8 **não usa combustível**. Bolhas animadas; garrafas visíveis no modelo. Funciona com tela fechada; funis interagem.

**MC11-RF-051 (P0) — Receitas.**
- Garrafa de água (de caldeirão ou fonte) + verruga do Nether → **Estranha** (base).
- Estranha + ingrediente:

| Ingrediente | Poção | Duração base / estendida (redstone) / nível II (glowstone) |
|---|---|---|
| Açúcar | Velocidade | 3:00 / 8:00 / II 1:30 |
| Pé de coelho | Salto | 3:00 / 8:00 / II 1:30 |
| Melancia reluzente | Cura instantânea | — / — / II |
| Olho de aranha | Veneno | 0:45 / 2:00 / II 0:22 |
| Lágrima de ghast | Regeneração | 0:45 / 2:00 / II 0:22 |
| Pó de blaze | Força | 3:00 / 8:00 / II 1:30 |
| Creme de magma | Resistência ao fogo | 3:00 / 8:00 / — |
| Cenoura dourada | Visão noturna | 3:00 / 8:00 / — |
| Baiacu | Respiração aquática | 3:00 / 8:00 / — |

- **Olho de aranha fermentado** (corrompe): Velocidade/Salto → Lentidão (1:30 / 4:00); Cura/Veneno → Dano instantâneo (I/II); Visão noturna → Invisibilidade (3:00 / 8:00); água → Fraqueza (1:30 / 4:00).
- **Redstone** estende; **glowstone** amplifica (as duas não se somam; aplicar uma substitui a outra); **pólvora** transforma em **arremessável** (efeito em área com intensidade pelo afastamento do centro, até ~4 blocos; duração ×0,75).
- Poções "mundanas"/"espessas" (ingredientes sem base estranha) existem e não têm efeito.

**MC11-RF-052 (P0) — Uso.** Beber (32 ticks, devolve garrafa vazia); arremessáveis (arco de lançamento, partículas coloridas ao quebrar, afetam mobs e jogadores — cura/dano invertidos em mortos-vivos). **Curar aldeão-zumbi**: poção arremessável de Fraqueza + maçã dourada (PRD 08).

**MC11-RF-053 (P0) — Caldeirão.** 3 níveis de água; enche com balde, chuva (P2); garrafa tira 1 nível; lava armadura de couro tingida; apaga entidades em chamas.

---

## 6. Sinalizador (farol)

**MC11-RF-060 (P0) — Funcionamento.** Precisa de visão do céu e de uma **pirâmide** de 1 a 4 camadas de blocos de ferro/ouro/esmeralda/diamante (misturáveis). Feixe vertical colorido (vidro tingido em cima mistura a cor). Interface: pagar com 1 lingote de ferro/ouro, esmeralda ou diamante para escolher efeitos — camada 1: Velocidade ou Pressa; 2: Resistência ou Super pulo; 3: Força; 4: Regeneração (secundário) ou nível II do primário. Alcance 20/30/40/50 blocos (+ toda a altura), reaplicado a cada 80 ticks (efeito "ambiente").

---

## 7. Carrinhos e trilhos

**MC11-RF-070 (P0) — Carrinhos (1.8.9).** Física sobre trilhos (curvas, inclinações, colisão entre carrinhos e com entidades), velocidade máxima 8 blocos/s, atrito; **trilho energizado** acelera (desligado freia), **detector** emite sinal, **ativador** aciona carrinho de TNT (explode) e trava carrinho com funil; jogador e mobs montam (Shift desce); variantes: com baú (27 slots), com fornalha (empurra com carvão), com TNT (explode ao cair rápido ou ativado), com funil (puxa itens de cima, interage com containers), com bloco de comando (P2). Mobs entram em carrinhos que passam por eles. Sincronização suave para o outro jogador (interpolação + previsão quando o jogador local está montado).

**MC11-RF-071 (P1) — Barcos.** Física 1.8: rápido na água, quebra ao bater forte em terra (dropa tábuas e gravetos), lento em terra.

---

## 8. Nether

**MC11-RF-080 (P0) — Portal.** Moldura de obsidiana retangular de dentro mínimo 2×3 até 21×21; acesa com pederneira/carga de fogo/fogo → blocos de portal roxos (luz 11, partículas, som ambiente). Ficar **80 ticks** dentro (sobrevivência; instantâneo no criativo) com overlay de distorção roxa (respeitando acessibilidade) → teleporte. Coordenadas **1:8** (Overworld ÷ 8 = Nether). Ao chegar: procura um portal existente num raio (128 blocos no Overworld, 16 no Nether, em coordenadas do destino); se não houver, **cria** um portal com plataforma de obsidiana no ponto seguro mais próximo. Recarga de 300 ticks antes de poder voltar sem sair do portal.

**MC11-RF-081 (P0) — Dimensão Nether.** Altura 0–127 com teto de bedrock (Y 123–127 e 0–4), terreno de netherrack com cavernas grandes, **oceano de lava em Y=31**, depósitos de areia das almas e cascalho, aglomerados de glowstone pendurados no teto, minério de quartzo, fogo espalhado, lagos/quedas de lava, **sem água** (balde evapora com fumaça), **camas explodem** (potência 5 com fogo), bússolas e relógios giram, sem ciclo dia/noite e sem clima, névoa avermelhada densa (distância fixa curta), luz ambiente mínima mais alta (nunca preto total), lava rápida (10 ticks, 7 blocos), música/ambiente próprios.

**MC11-RF-082 (P0) — Fortaleza do Nether.** Estrutura de tijolo do Nether com pontes, corredores e torres; plantações de verruga do Nether com escadas; **geradores de blaze**; baús (diamantes, ferro, ouro, selas, armaduras de cavalo, verruga, pederneira); esqueletos Wither e blazes nascem dentro da área da fortaleza.

**MC11-RF-083 (P0) — Mobs do Nether.**

| Mob | Vida | Comportamento | Drops |
|---|---|---|---|
| Porco-zumbi | 20 | Neutro, espada de ouro; atacar um enfurece todos num raio grande por um tempo; não queima | Carne podre, pepita de ouro, lingote raro, espada |
| Ghast | 10 | Flutua, chora, atira **bolas de fogo** (explosão potência 1 com fogo) a até ~64 blocos; bolas podem ser **rebatidas** com golpe/flecha | Lágrima de ghast, pólvora |
| Blaze | 20 | Voa baixo, rajada de **3 cargas de fogo**, imune a fogo, levam dano de água/neve/chuva | Vara de blaze (só por jogador) |
| Cubo de magma | 16/4/1 | Como slime, pula mais alto, imune a fogo/lava | Creme de magma (exceto o menor) |
| Esqueleto Wither | 20 | 2,4 de altura, espada de pedra, aplica **Wither** (10 s), imune a fogo | Carvão, ossos, **cabeça de esqueleto Wither (2,5%)** |

---

## 9. The End

**MC11-RF-090 (P0) — Olho do Ender e fortaleza.** Arremessar o olho: ele voa ~12 blocos na direção da fortaleza mais próxima (PRD 04), sobe, para e cai como item (80%) ou se quebra (20%). Na sala do portal, colocar olhos nas 12 molduras ativa o **portal do End** (som característico, blocos de portal pretos estrelados, luz 15).

**MC11-RF-091 (P0) — Dimensão End.** Ilha principal de pedra do End flutuando no vazio, ilhas não existem além da principal na 1.8; céu preto com textura estrelada estática; sem dia/noite; **pilares de obsidiana** com **cristais do Ender** no topo (alguns protegidos por grades de ferro); jogadores chegam numa **plataforma de obsidiana 5×5** em (100, 48, 0) (recriada a cada entrada); endermen numerosos; cair no vazio mata.

**MC11-RF-092 (P0) — Dragão do Ender.** 200 HP; barra de chefe no topo; voa em padrões (circular pelos pilares, investidas no jogador, pousos curtos no portal central de bedrock); **cristais curam** o dragão com feixe (destruir cristais com flecha/golpe causa explosão); destrói blocos que atravessa (exceto obsidiana, pedra do End, bedrock, grade de ferro); arremessa jogadores ao bater; dano por golpe dividido conforme a parte atingida (cabeça recebe dano integral). Morte: raios de luz, desintegração, **12.000 XP** (primeira vez) caindo como chuva de orbes, **portal de saída** de bedrock com o **ovo do dragão** em cima (ovo teleporta ao ser clicado; colhível com pistão/queda). Entrar no portal de saída leva à tela de **créditos do Mind Cave** (texto próprio — nomes dos dois devs editáveis, agradecimentos, licenças de assets — **sem reproduzir textos do jogo original**) e depois ao spawn. Na 1.8 o dragão não renasce (manter; comando de dev `/dragon respawn` opcional).

**MC11-RF-093 (P0) — Wither (chefe).** Invocado com **4 areias das almas em T + 3 cabeças de esqueleto Wither** em cima (em qualquer dimensão). Sequência de surgimento (cresce/carrega, explosão grande ao terminar), 300 HP com barra de chefe, voa, atira **crânios Wither** (pretos: explosão leve + Wither; azuis raros: destroem até obsidiana), regenera lentamente, abaixo de 50% ganha **armadura de Wither** (imune a flechas e balas — extensão), destrói blocos à sua volta ao levar dano. Drop: **estrela do Nether** (não queima, não some). Não é afetado por veneno/cura e é imune a fogo.

---

## 10. Multi-dimensão no servidor

**MC11-RF-100 (P0) — Mundos por dimensão.** O servidor mantém Overworld, Nether e End como mundos separados (chunks, entidades, tempo de simulação), carregando só as dimensões onde há jogadores (ou chunks forçados). Cada jogador está numa dimensão; o protocolo envia mudança de dimensão (tela de carregamento "Entrando no Nether…"), limpa o cache de chunks do cliente da dimensão anterior e reenvia. Os dois jogadores podem estar em dimensões diferentes ao mesmo tempo; o chat e a lista de jogadores continuam globais. Persistência separada por dimensão (`ChunkDelta.dimensão`). Entidades (itens, mobs) que atravessam portais mudam de dimensão.

---

## 11. Requisitos não funcionais

- **MC11-RNF-001 (P0)** Circuito de teste com 200 componentes (relógio de repetidores, portas de pistão 3×3, contador com comparadores) mantém TPS 20.
- **MC11-RNF-002 (P0)** Comportamento de redstone determinístico: o mesmo circuito, salvo e recarregado, produz o mesmo resultado; os dois jogadores veem o mesmo estado.
- **MC11-RNF-003 (P0)** Explosão de 50 TNTs encadeadas não trava o servidor por mais de 500 ms (processamento escalonado em vários ticks se necessário).
- **MC11-RNF-004 (P0)** Trocar de dimensão em < 3 s (spawn de chegada gerado e com malha).

---

## 12. Critérios de aceite

- **MC11-CA-01** Porta de pistão 2×2 com alavanca, fechadura com comparador, relógio de repetidores, lâmpada com sensor de luz e elevador de itens com funis funcionam igual ao 1.8.9.
- **MC11-CA-02** Pistão grudento + blocos de slime movem uma "máquina voadora" simples.
- **MC11-CA-03** Fazenda de trigo hidratada cresce em fileiras alternadas mais rápido; farinha de osso acelera; abóbora nasce ao lado do caule.
- **MC11-CA-04** Mesa com 15 estantes oferece nível 30; encantar gasta 3 níveis e 3 lápis; Toque suave em picareta dropa minério de diamante; Fortuna III dá mais diamantes.
- **MC11-CA-05** Bigorna: renomear, combinar duas espadas encantadas, reparar com diamantes; mensagem "Caro demais!" acima de 40.
- **MC11-CA-06** Cadeia completa de poção: Força II arremessável e Velocidade estendida funcionando; aldeão-zumbi curado.
- **MC11-CA-07** Portal do Nether construído e aceso; os dois jogadores vão ao Nether, achar fortaleza, matar blazes; coordenadas 1:8 corretas; voltar pelo mesmo portal.
- **MC11-CA-08** Olhos do Ender levam à fortaleza; portal do End ativado; os dois derrotam o Dragão; portal de saída e ovo aparecem; créditos próprios exibidos.
- **MC11-CA-09** Wither invocado, fase de armadura em 50%, drop da estrela do Nether.
- **MC11-CA-10** Um jogador no Nether e outro no Overworld ao mesmo tempo, sem erros e com TPS estável.
