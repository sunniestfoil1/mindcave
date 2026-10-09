# MIND CAVE — PRD 08 de 12
# Mobs e Inteligência Artificial (Animais, Zumbis, Creepers, Esqueletos, Aranhas, Endermen e mais), Spawn, Pathfinding, Reprodução e Domesticação

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–07 (entidades, física, dano, itens, combate, animações) |
| Objetivo | Popular o mundo com os **mobs do Overworld da 1.8.9**, cada um com comportamento, atributos, sons, drops e animações próprias; implementar um **sistema de IA por objetivos** (goals) com prioridades, **pathfinding A\*** em grade de blocos, **regras de spawn 1.8** (luz, limites, distâncias, despawn), geradores de monstros, reprodução, domesticação e interação com itens. Mobs do Nether e do End são registrados aqui e ativados no PRD 11. Variantes tecnológicas de zumbi: PRD 09. |
| Próximo | PRD 09 — Tecnologia e Armas de Fogo |

> Documento de requisitos. Toda IA roda no **servidor** (Web Worker do host) a 20 TPS; os clientes recebem estados e interpolam.

---

## 1. Arquitetura de entidades vivas

**MC08-RF-001 (P0) — Registro de mobs (data-driven).** Cada tipo de mob é uma entrada com: id, nome, categoria de spawn (`hostil`, `passivo`, `ambiente`, `aquático`), dimensões da caixa (largura × altura), altura dos olhos, vida máxima, armadura natural, velocidade de movimento, alcance de seguimento (follow range), dano de ataque, resistência a knockback, imunidades (fogo, queda, afogamento), se é morto-vivo (afetado por Julgamento e cura/dano invertidos), se queima ao sol, tabela de drops, XP, lista de objetivos de IA com prioridades, sons (ambiente, dano, morte, passo, especiais), modelo/animações (procedural ou GLB — PRD 10), regras de spawn.

**MC08-RF-002 (P0) — Sistema de objetivos (goals).** Dois conjuntos por mob: **objetivos de ação** e **objetivos de alvo**, cada um com prioridade e "máscara" de exclusão (movimento, olhar, pulo). A cada tick, os objetivos podem começar se `podeIniciar()` e nenhum de prioridade maior com máscara conflitante estiver ativo; objetivos ativos continuam enquanto `podeContinuar()`. Biblioteca mínima de objetivos (comportamentos equivalentes ao 1.8):

| Objetivo | Descrição |
|---|---|
| Nadar | Na água, pula para não afundar |
| Pânico | Ao levar dano, corre aleatoriamente (passivos) |
| Acasalar | Procura parceiro em modo amor |
| Tentação | Segue jogador segurando o item favorito (para quando o jogador se move bruscamente — galinha/porco/vaca 1.8) |
| Seguir pai | Filhotes seguem o adulto |
| Vaguear | Caminha a um ponto aleatório próximo (preferindo blocos mais claros/baixos conforme o mob) |
| Olhar para jogador | Olha para o jogador mais próximo em até 8 blocos |
| Olhar aleatório | Gira a cabeça ocioso |
| Atacar corpo a corpo | Persegue o alvo e ataca ao alcance (largura × 2 + largura do alvo), cadência de 20 ticks |
| Ataque à distância | Mantém distância e atira (esqueleto) |
| Alvo mais próximo | Escolhe jogador/entidade alvo visível dentro do alcance de seguimento (com chance de checagem a cada N ticks) |
| Revidar | Ataca quem o feriu (e chama aliados, ex.: porcos-zumbi, lobos) |
| Evitar entidade | Foge de um tipo (creeper foge de jaguatirica/gato; aldeão foge de zumbi) |
| Restringir sol / Fugir do sol | Mortos-vivos procuram sombra/água de dia |
| Quebrar porta | Zumbis no Difícil |
| Abrir/fechar porta | Aldeões |
| Mover para vila | Ficar perto da vila |
| Saltar no alvo | Aranhas/lobos |
| Comer grama | Ovelhas (regenera lã, transforma grama em terra) |
| Sentar / Seguir dono / Implorar | Mobs domesticados |
| Inchar (creeper) | Contagem regressiva de explosão |

**MC08-RF-003 (P0) — Pathfinding.** A\* em grade de blocos com tipos de nó: caminhável, aberto, bloqueado, água, lava/fogo/cacto (perigo, evitado), porta (aberta/fechada; madeira só para quem abre), cerca/muro (altura 1,5 — intransponível), trilho, escada de mão (só aranhas sobem paredes, demais não). Regras: subir no máximo 1 bloco por pulo, cair no máximo 3 blocos voluntariamente (mais se o alvo estiver lá e a vida permitir), não andar em bordas para o vazio, nadar na superfície. Limite de nós por busca (ex.: 200–400) e **orçamento de buscas por tick** (fila; recalcular caminho a cada 10–40 ticks ou quando o alvo se mover > 1 bloco). Caminho seguido com controle de movimento (virar suavemente, pular quando o próximo nó for 1 acima, frear em curvas). Aranhas escalam paredes; mobs voadores (morcego, ghast, blaze) usam navegação 3D simples.

**MC08-RF-004 (P0) — Física e combate dos mobs.** Mesmo motor de física do jogador (caixas, gravidade, água, knockback). Recebem dano das mesmas fontes (PRD 05), com janela de invulnerabilidade de 10 ticks, piscar vermelho, morte com tombo e fumaça, drops e XP (apenas se a última fonte de dano foi um jogador nos últimos 100 ticks, para drops raros e XP — regra 1.8).

**MC08-RF-005 (P0) — Replicação.** Estado enviado aos clientes no alcance de rastreamento (padrão: 80 blocos para mobs, 64 para itens soltos, sempre dentro da distância de visão), em 20 Hz com compressão delta (posição quantizada, rotação em bytes, flags de estado: em chamas, agachado, inchando, carregado, bebê, com sela, cor, montado). Interpolação no cliente (PRD 01). Mobs fora de chunks carregados ficam congelados e são salvos no chunk.

---

## 2. Spawn natural (1.8.9)

**MC08-RF-010 (P0) — Limites e ciclo.**

| Categoria | Limite (por 17×17 chunks de cada jogador, combinados) | Frequência de tentativa |
|---|---|---|
| Hostis | 70 | Todo tick |
| Passivos | 10 | A cada 400 ticks |
| Ambiente (morcegos) | 15 | Todo tick |
| Aquáticos (lulas) | 5 | Todo tick |

Tentativas em chunks aleatórios dentro de 8 chunks do jogador, escolhendo coluna e altura aleatórias até o heightmap; tentativas de **grupo** (até 4 por pacote, raio 6, salvo exceções: lobos 4, coelhos 2–3, cavalos 2–6).

**MC08-RF-011 (P0) — Condições.**
- Hostis: luz de bloco **e** luz do céu efetiva ≤ **7** (considerando escurecimento pela hora/clima), bloco de baixo com topo sólido (não vale vidro, folhas, lajes de baixo nem blocos transparentes), espaço livre para a caixa do mob, **≥ 24 blocos** de qualquer jogador, não em Pacífico.
- Passivos: em grama, luz ≥ 9, ≥ 24 blocos.
- Morcegos: luz ≤ 3 (≤ 6 perto do Halloween — opcional), abaixo de Y=63.
- Lulas: água, entre Y 46 e 62.
- Slimes: pântano (Y 51–69, mais em lua cheia, luz ≤ 7) e **chunks de slime** (1 em 10 determinado pelo seed), abaixo de Y=40.
- Ao gerar um chunk novo, **animais** são colocados de acordo com o bioma (spawn de mundo — principal fonte de animais na 1.8).

**MC08-RF-012 (P0) — Despawn.** Mobs não persistentes: somem instantaneamente se nenhum jogador estiver a ≤ 128 blocos; entre 32–128 blocos, após 600 ticks sem atividade, chance 1/800 por tick. Persistentes: nomeados com etiqueta, domesticados, que pegaram itens, com sela, animais (na 1.8 os passivos não somem), bebês de aldeão etc.

**MC08-RF-013 (P0) — Tabela de spawn por bioma (referência 1.8).** Hostis comuns em quase todos os biomas do Overworld com pesos: aranha 100, zumbi 100 (com 5% aldeão-zumbi), esqueleto 100, creeper 100, slime 100 (só nas condições), enderman 10, bruxa 5. Pântano: slimes. Ilha de cogumelos: **nenhum hostil**, apenas vacas-cogumelo. Passivos por bioma: em geral vacas, porcos, ovelhas e galinhas em todos os biomas com grama; extras — Planícies e Savana (cavalos), Floresta e Taiga (lobos), Taiga e biomas frios (coelhos, brancos nos nevados), Selva (jaguatiricas), Deserto (coelhos; sem os demais passivos).

**MC08-RF-014 (P0) — Gerador de monstros (spawner).** Funciona quando um jogador está a ≤ 16 blocos; atraso 200–800 ticks entre ciclos; até 4 mobs por ciclo numa área 9×3×9 em volta (com luz ≤ 11 para hostis), máximo de 6 do tipo nas proximidades; render: gaiola com mini-mob girando dentro (velocidade aumenta perto do spawn) e chamas. Quebrar dá XP 15–43.

---

## 3. Mobs do Overworld (1.8.9)

### 3.1 Passivos e neutros

| Mob | Vida | Comportamento-chave | Drops / produtos |
|---|---|---|---|
| **Porco** | 10 | Tentado por cenoura, batata; sela + cenoura na vara para montar e guiar; raio → porco-zumbi | Costeleta 1–3 (assada se morto queimando) |
| **Vaca** | 10 | Tentada por trigo; balde → leite | Couro 0–2, carne 1–3 |
| **Vaca-cogumelo** | 10 | Tigela → ensopado; tesoura → vira vaca + 5 cogumelos | Igual vaca |
| **Ovelha** | 8 | Tentada por trigo; come grama (recupera lã); tesoura 1–3 lã; tingível com corante; cores naturais: branca ~81,8%, cinza/cinza-claro/preta 5% cada, marrom 3%, rosa 0,164% | Lã 1 (se não tosquiada), carneiro 1–2 |
| **Galinha** | 4 | Sementes; bota ovo a cada 6.000–12.000 ticks; cai devagar (bate asas) | Pena 0–2, frango 1 |
| **Coelho** | 3 | Pula; tipos por bioma (marrom, branco, preto, malhado, dourado, sal e pimenta); come cenouras plantadas; raro "coelho assassino" hostil (opcional, só por comando) | Pele 0–1, carne 0–1, pé de coelho (raro) |
| **Lula** | 10 | Nada na água; tinta ao ser atingida | Bolsa de tinta 1–3 |
| **Morcego** | 6 | Voa em cavernas, pendura no teto, foge | — |
| **Lobo** | 8 (20 domesticado) | Neutro; domesticar com osso (1/3); senta/segue/teleporta para o dono; ataca o alvo do dono; coleira tingível; vida exibida pela cauda; fica bravo (olhos vermelhos) e chama a matilha se atacado | — |
| **Jaguatirica** | 10 | Foge; domesticar com peixe cru (paciência, aproximação lenta) → gato (3 variantes); creepers fogem de gatos; senta em baús/camas | — |
| **Cavalo / Burro / Mula** (P1) | 15–30 | Domesticar montando repetidamente; sela; armadura de cavalo; atributos aleatórios (velocidade, pulo, vida); burro/mula com baú; reprodução cavalo+burro = mula | Couro 0–2 |
| **Aldeão** (P1) | 20 | Profissões (fazendeiro, bibliotecário, padre, ferreiro, açougueiro) com cores de roupa; abrem portas; vão para casa à noite; fogem de zumbis; **comércio** em esmeraldas com níveis de ofertas da 1.8 (tela de troca); reprodução quando "dispostos" e há portas sobrando | — |
| **Golem de ferro** | 100 | Nasce em vilas (≥ 10 aldeões e ≥ 21 portas) ou construído (4 blocos de ferro em T + abóbora); defende aldeões, ataca hostis (arremessa para cima); neutro com jogadores (hostil se atacado) | Lingotes 3–5, papoulas 0–2 |
| **Golem de neve** | 4 | Construído (2 blocos de neve + abóbora); atira bolas de neve em hostis; deixa rastro de neve; derrete em biomas quentes e na chuva | Bolas de neve 0–15 |

### 3.2 Hostis

| Mob | Vida | Atributos/regras 1.8.9 | Drops |
|---|---|---|---|
| **Zumbi** | 20 | Armadura natural 2; velocidade 0,23; seguimento **40 blocos**; ataque 2,5/3/4,5 (Fácil/Normal/Difícil); queima ao sol (sem capacete); 5% bebês (menores, bem mais rápidos, também queimam ao sol sem capacete, 12 XP); 5% zumbi-aldeão; 5% dos bebês montam galinhas (jóquei); pode pegar itens e armaduras do chão (chance por dificuldade local); **reforços** ao ser atacado (chance de chamar outro zumbi por perto); quebra portas de madeira no Difícil (rachaduras progressivas); persegue aldeões | Carne podre 0–2; raros (2,5%): lingote de ferro, cenoura, batata; equipamento com chance |
| **Aldeão-zumbi** | 20 | Como zumbi; **curável** com poção de fraqueza arremessável + maçã dourada (conversão 3–5 min, tremendo) — PRD 11 | Igual zumbi |
| **Esqueleto** | 20 | Arco; mantém distância ~15 blocos, atira a cada 20–60 ticks (mais rápido no Difícil), flechas com dispersão menor em dificuldades maiores; queima ao sol e procura sombra; pode nascer com armadura | Ossos 0–2, flechas 0–2; arco raro; **disco de música** quando um creeper é morto por flecha de esqueleto |
| **Creeper** | 20 | Silencioso; persegue; ao chegar a ≤ 3 blocos começa a **inchar** (piscar branco, chiado) por **30 ticks**; cancela se o jogador se afastar > 7 blocos (desinfla); explode com potência **3** (carregado: **6**, com aura azul elétrica); explosão não deixa drops de 100% (explosões de creeper dropam blocos com 1/potência de chance — regra 1.8 por distância); foge de jaguatiricas/gatos; acendível com pederneira (explode na hora); `mobGriefing=false` não quebra blocos | Pólvora 0–2; disco (morto por esqueleto); cabeça de creeper se morto por creeper carregado |
| **Aranha** | 16 | Escala paredes; salta no alvo; **neutra sob luz ≥ 12** (fica hostil se atacada); 1% jóquei-aranha (esqueleto montado); pode ter efeitos aleatórios no Difícil (velocidade, força, regeneração, invisibilidade); larga 1,4 × 0,9 (cabe em vãos de 1 bloco de altura) | Linha 0–2, olho de aranha (1/3, só por jogador) |
| **Aranha da caverna** | 12 | Menor (0,7 × 0,5), passa em vãos 1×1; **veneno** (7 s Normal, 15 s Difícil); só de geradores em minas | Igual aranha |
| **Enderman** | 40 | Neutro; fica hostil se o jogador **olhar para a cabeça dele** (mira centrada, distância até 64) sem abóbora na cabeça, ou se atacado; teleporta (até 32 blocos) ao levar dano, em contato com água/chuva e aleatoriamente; **pega e coloca blocos** (grama, terra, areia, cascalho, flores, cogumelos, abóboras, melancias, TNT, argila, micélio, cacto) se `mobGriefing`; projéteis o atravessam (teleporta antes); 2,9 de altura; olhos roxos brilhantes; partículas de portal | Pérola do Ender 0–1; o bloco que carrega |
| **Slime** | 16 / 4 / 1 | Pula; divide ao morrer (grande → 2–4 médios → 2–4 pequenos); pequenos não causam dano | Bola de slime (só pequenos) 0–2 |
| **Bruxa** | 26 | Arremessa poções (lentidão, veneno, fraqueza, dano) e bebe poções (cura, resistência ao fogo, respiração, velocidade); nasce em cabanas e por raio em aldeão | Garrafas, pó de glowstone, pólvora, redstone, olho de aranha, açúcar, gravetos (0–6 de 1–3 tipos) |
| **Traça** | 8 | Sai de blocos infestados; ao ser atacada chama outras traças escondidas; some entrando em pedra | — |
| **Endermite** | 8 | 5% ao lançar pérola; endermen atacam endermites | — |
| **Guardião** | 30 | Monumentos; **laser** carregado (~2 s, raio fino que cresce), espinhos (dano de volta ao atacante corpo a corpo); nada | Fragmento de prismarinho, peixe, cristais |
| **Guardião ancião** | 80 | 3 por monumento; aplica **Fadiga de mineração III** em jogadores próximos a cada minuto (aparição fantasma na tela) | Esponja molhada + itens |

### 3.3 Nether e End (registrar aqui; comportamento ativado no PRD 11)
Porco-zumbi, Ghast, Blaze, Cubo de magma, Esqueleto Wither, Wither (chefe), Dragão do Ender (chefe).

---

## 4. Interações com mobs

- **MC08-RF-030 (P0) — Reprodução.** Alimentar dois adultos da mesma espécie com o item correto ativa o **modo amor** (corações, 600 ticks); eles se aproximam e geram um **filhote** (+1–7 XP orbes); recarga de **6.000 ticks** para os pais; filhotes crescem em **24.000 ticks** (alimentar acelera 10% do restante). Itens: vaca/vaca-cogumelo/ovelha → trigo; porco → cenoura/batata; galinha → sementes (trigo, abóbora, melancia, verruga do Nether); coelho → cenoura/cenoura dourada/dente-de-leão; lobo domesticado → qualquer carne; gato → peixe cru; cavalo → maçã dourada/cenoura dourada.
- **MC08-RF-031 (P0) — Itens em mobs.** Etiqueta (nomear, torna persistente, nome visível ao olhar), guia (prender em cerca, puxar — física de corda simples), sela (porco/cavalo), tesoura, balde (vaca), tigela (vaca-cogumelo), corante (ovelha, coleira), ovos de spawn (clicar em mob adulto gera filhote — 1.8).
- **MC08-RF-032 (P0) — Montaria.** Porco com sela (guiado por cenoura na vara), cavalo (WASD, pulo carregável), aranha-jóquei (esqueleto), galinha-jóquei (bebê zumbi), carrinhos/barcos (PRD 06/11). Câmera e animação de montado (PRD 07).

---

## 5. Aparência, animação e som dos mobs

**MC08-RF-040 (P0) — Modelos provisórios.** Cada mob tem um **modelo de cubos procedural** com partes nomeadas (cabeça, corpo, pernas, braços, asas, cauda etc.) e **textura procedural original** com a paleta e a silhueta característica do tipo (proporções de criatura quadrúpede, bípede, aranha de 8 patas, slime cúbico translúcido com núcleo, morcego com asas, lula com tentáculos). Esses modelos são **substituíveis por GLB** no PRD 10 (cada parte nomeada vira um "osso" esperado; se o GLB trouxer animações, usar; senão, aplicar o procedural sobre os ossos com nomes compatíveis).

**MC08-RF-041 (P0) — Animações procedurais por mob.** Quadrúpedes (pernas alternadas, cabeça baixa ao comer grama), bípedes mortos-vivos (braços estendidos à frente — zumbi; braços com arco — esqueleto), creeper (4 patas curtas alternadas; ao inchar escala ±10% e pisca branco), aranha (8 patas com fases desencontradas, sobe paredes com o corpo inclinado), enderman (braços longos balançando, boca aberta quando hostil, segurando bloco entre as mãos), slime (comprime e estica ao pular), galinha (asas batendo ao cair), lula (tentáculos ondulando), morcego (asas batendo; pendurado de cabeça para baixo), golem de ferro (braços longos, animação de arremesso, oferece papoula a aldeões), lobo (cauda cuja altura indica a vida; sentar; molhado se sacode). Olhar e cabeça seguem o alvo.

**MC08-RF-042 (P0) — Sons.** Ambiente com intervalos aleatórios (≈ a cada 80 ticks com chance), dano, morte, passos por mob; específicos: chiado do creeper, teleporte do enderman, "olhar" do enderman (som assustador quando irrita), quebra de porta do zumbi, flecha do esqueleto, chiado do slime (por tamanho). Sem arquivos enviados: sons sintetizados simples diferenciados por tipo.

---

## 6. Comandos e ferramentas

- `/summon <tipo> [x y z] [dadosJSON]` (ex.: `{"powered":true}`, `{"IsBaby":true}`, equipamento, efeitos, nome).
- `/kill @e[type=Zombie]`, `/kill @e[type=!Player]`.
- Ovos de spawn de todos os mobs na aba Diversos do criativo.
- Painel da **Arena de mobs** do Laboratório (PRD 04) com botões funcionais: spawnar cada mob, alternar IA ligada/desligada (mob "congelado" para inspecionar modelo/animação), alternar invulnerável, mostrar o caminho do pathfinding (linha de nós) e o objetivo de IA ativo acima da cabeça (F3+mob debug).
- **MC08-RF-050 (P0)** Debug de IA: com `devTools`, F3+I (Mind Cave) alterna rótulos sobre mobs com: tipo, vida, objetivo ativo, alvo, nós restantes do caminho.

---

## 7. Requisitos não funcionais

- **MC08-RNF-001 (P0)** Com 150 mobs ativos (limites cheios para 2 jogadores), o tick do servidor fica ≤ 25 ms (TPS ≥ 20) num PC médio; pathfinding com orçamento por tick e fila.
- **MC08-RNF-002 (P0)** Banda de rede com 150 mobs visíveis ≤ 40 KB/s por convidado.
- **MC08-RNF-003 (P0)** Mobs salvos com o chunk (posição, vida, efeitos, equipamento, idade, dono, nome, estado de amor/recarga, cor, sela).
- **MC08-RNF-004 (P0)** Render com instancing por tipo de mob quando houver muitos iguais (GLB com *skinning* em GPU).

---

## 8. Critérios de aceite

- **MC08-CA-01** À noite num Mundo Aberto em Normal, aparecem zumbis, esqueletos, creepers e aranhas em proporções equilibradas, nunca a menos de 24 blocos do jogador; de manhã zumbis e esqueletos pegam fogo e procuram sombra; aranhas ficam neutras.
- **MC08-CA-02** Creeper persegue, incha por 1,5 s, explode com cratera e dano coerentes; se o jogador se afasta rápido, ele desincha; raio o transforma em carregado (explosão maior, aura azul).
- **MC08-CA-03** Esqueleto mantém distância e atira; jogador bloqueando com espada reduz o dano.
- **MC08-CA-04** Enderman fica hostil ao ser encarado, não fica com abóbora na cabeça, teleporta na água e pega blocos de grama.
- **MC08-CA-05** Zumbi persegue até 40 blocos, desvia de obstáculos, sobe 1 bloco, não pula em lava; no Difícil quebra porta de madeira.
- **MC08-CA-06** Duas vacas com trigo geram um filhote que cresce em 20 min de jogo; recarga impede reprodução imediata.
- **MC08-CA-07** Domesticar lobo com ossos; ele segue, senta, teleporta e ataca o que o dono ataca.
- **MC08-CA-08** Gerador de masmorra gera até 4 mobs por ciclo apenas com jogador a ≤ 16 blocos.
- **MC08-CA-09** Os dois jogadores veem os mesmos mobs nas mesmas posições (diferença visual ≤ 0,3 bloco em movimento), com as mesmas animações.
- **MC08-CA-10** Em Pacífico, nenhum hostil existe.
