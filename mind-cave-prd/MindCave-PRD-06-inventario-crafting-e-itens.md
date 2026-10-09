# MIND CAVE — PRD 06 de 12
# Inventário, Bancada de Trabalho (Crafting), Fornalha, Baús, Itens, Ferramentas, Armaduras e Mineração Exata

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–05 (registros, UI de containers do PRD 02, sobrevivência do PRD 05) |
| Objetivo | Entregar o **sistema de itens completo da 1.8.9**: inventário com todas as regras de clique, criativo com abas e busca, **bancada de trabalho 3×3** com receitas data-driven, fornalha, baús (simples, duplo, do Ender, armadilha), todas as ferramentas, armas corpo a corpo, armaduras, materiais, comidas e utilitários, e a **fórmula exata de mineração** (tempo, ferramenta certa, nível de colheita, durabilidade, drops). |
| Próximo | PRD 07 — Combate e Animações |

> Documento de requisitos. Toda transação de inventário é **validada pelo servidor**; o cliente faz previsão visual e é ressincronizado em caso de divergência.

---

## 1. Modelo de item

**MC06-RF-001 (P0) — Pilha de itens (ItemStack).** Cada pilha tem id do item, quantidade, dano/metadado e dados extras, onde os dados extras são um objeto estruturado opcional (equivalente às tags do 1.8): nome personalizado, descrição (lore), encantamentos, cor (couro tingido), conteúdo de livro, `PodeDestruir`/`PodeColocarEm` (modo Aventura), flags de ocultar atributos, dados de arma (PRD 09: munição carregada, modo de disparo), referência de asset personalizado (PRD 10). Duas pilhas só se empilham se id, dano e dados extras forem iguais.

**MC06-RF-002 (P0) — Registro de itens.** Cada item: id numérico (blocos usam o próprio ID; itens a partir de 256, numeração clássica como referência), nome interno, nome exibido (PT-BR/EN), **tamanho máximo de pilha** (64 padrão; 16 para ovos, bolas de neve, placas, pérolas do Ender, baldes vazios, estandartes; 1 para ferramentas, armas, armaduras, baldes cheios, poções, ensopados, livros escritos, discos, selas, barcos, carrinhos, bolos e camas; portas empilham 64 na 1.8), durabilidade máxima, categoria criativa, tipo de render (bloco 3D / sprite extrudado / modelo especial), propriedades de ferramenta/arma/armadura/comida/combustível, ação de uso (comer, beber, mirar arco, bloquear com espada, lançar, colocar, usar em bloco, usar em entidade), raridade (cor do nome: comum branco, incomum amarelo, raro ciano, épico magenta).

**MC06-RF-003 (P0) — Itens da 1.8.9.** Registrar todos os itens do Apêndice A com ícone procedural (sprite 16×16 gerado por código no mesmo estilo do PRD 02) e comportamento.

---

## 2. Inventário do jogador

**MC06-RF-010 (P0) — Layout (1.8.9).** Tela de 176×166 px virtuais: 4 slots de armadura (capacete, peitoral, calças, botas — só aceitam a peça correta e mostram silhueta vazia), **pré-visualização do jogador** (modelo 3D cuja cabeça e corpo seguem a posição do mouse), grade de **crafting 2×2** + resultado, inventário principal 27 slots (3×9), hotbar 9 slots. À esquerda, lista de **efeitos ativos** (ícone, nome, nível, tempo restante). Abrir/fechar com E (ou Esc para fechar).

**MC06-RF-011 (P0) — Regras de clique (1.8.9, idênticas).**

| Ação | Resultado |
|---|---|
| Clique esquerdo em slot com item, cursor vazio | Pega a pilha inteira |
| Clique esquerdo com item no cursor | Coloca tudo; se o slot tem item igual, soma até o máximo; se diferente, **troca** |
| Clique direito em slot, cursor vazio | Pega metade (arredonda para cima) |
| Clique direito com item no cursor | Coloca **1** (em slot vazio ou igual) |
| Shift + clique | Move rapidamente entre seções (hotbar ↔ principal; inventário ↔ container; armadura vai direto ao slot de armadura; resultado de crafting cria o máximo possível) |
| Teclas 1–9 sobre um slot | Troca o item do slot com o slot correspondente da hotbar |
| Duplo clique | Junta no cursor todos os itens iguais (até o máximo da pilha) |
| Arrastar com esquerdo | Distribui igualmente o cursor entre os slots arrastados (sobra fica no cursor) |
| Arrastar com direito | Coloca 1 em cada slot arrastado |
| Clique do meio (criativo) | Pega uma pilha cheia do item |
| Q sobre slot / Ctrl+Q | Solta 1 / solta a pilha |
| Clique fora da janela | Solta o que está no cursor (esquerdo: tudo; direito: 1) |
| Fechar a tela | Itens no cursor e na grade de crafting voltam ao inventário (ou caem no chão se não couber) |

**MC06-RF-012 (P0) — Autoridade e sincronização.** Cada clique vira uma mensagem ao servidor com janela, slot, botão, modo, id da transação e o item que o cliente previu. O servidor aplica, confirma ou rejeita; ao rejeitar, envia o estado completo da janela. Janelas compartilhadas (baú aberto pelos dois) atualizam os slots em tempo real para ambos. Proteção contra duplicação: o servidor é a única fonte; testes de "dupe" (clicar rápido enquanto o outro jogador mexe no mesmo baú, fechar a janela durante lag, desconectar com item no cursor) não podem gerar itens.

**MC06-RF-013 (P0) — Hotbar.** Rolagem e teclas 1–9; nome do item ao trocar (PRD 02); item ativo mostrado na mão para todos.

**MC06-RF-014 (P0) — Soltar e coletar.** Q solta 1 (Ctrl+Q a pilha) na direção do olhar com velocidade de arremesso 1.8; atraso de coleta 40 ticks para o item jogado (10 para drops de bloco). Itens no chão: se fundem com pilhas iguais num raio de 0,5 bloco, boiam na água, são levados pela correnteza, destruídos por lava/fogo/cacto/explosões, somem em 6.000 ticks. Coleta com animação do item voando até o jogador e som "pop".

---

## 3. Inventário criativo

**MC06-RF-020 (P0) — Abas (1.8.9 + Mind Cave).** Blocos de construção, Decoração, Redstone, Transporte, Diversos, **Pesquisar**, Comidas, Ferramentas, Combate, Poções, Materiais, Inventário de sobrevivência, e duas abas novas: **Tecnologia** (PRD 09) e **Studio** (itens personalizados do PRD 10). Grade 9×5 com rolagem, hotbar abaixo, lixeira (slot "Destruir item"; Shift+clique na lixeira limpa o inventário inteiro). Busca filtra por nome PT-BR, EN e nome interno.

**MC06-RF-021 (P0) — Regras do criativo.** Clicar num item da aba coloca a pilha no cursor (esquerdo: 1 pilha cheia com Shift; direito: 1 unidade conforme 1.8); colocar blocos não consome; quebrar não dropa; o criativo também pode ver variantes (meta) como itens separados (ex.: todas as cores de lã).

---

## 4. Bancada de trabalho e receitas

**MC06-RF-030 (P0) — Bancada de trabalho (área de trabalho 3×3).** Clique direito na bancada abre a tela: grade 3×3, slot de resultado, inventário e hotbar. Mais de um jogador pode usar **bancadas diferentes** ao mesmo tempo; a grade é por jogador (não é armazenada no bloco), como no 1.8.

**MC06-RF-031 (P0) — Motor de receitas data-driven.** Registro de receitas com tipos:
- **Com formato (shaped):** padrão de até 3×3 com chaves → itens (aceita "qualquer metadado" de um item, ex.: qualquer tábua); o padrão pode estar em qualquer posição da grade; **espelhamento horizontal** é aceito (como o 1.8).
- **Sem formato (shapeless):** lista de ingredientes em qualquer posição.
- **Especiais (código):** tingir armadura de couro, cópia de livro, mapas, fogos de artifício, estandartes com padrões, reparo de ferramentas iguais na grade (soma durabilidades + 5% de bônus, remove encantamentos — regra 1.8).
Receitas que cabem em 2×2 funcionam também no inventário. O resultado aparece em tempo real ao montar; ao retirar, consome **1 de cada ingrediente** (itens com "item de retorno" devolvem: balde de leite → balde vazio no bolo).

**MC06-RF-032 (P0) — Shift no resultado.** Cria o máximo possível de uma vez, respeitando espaço no inventário.

**MC06-RF-033 (P0) — Conteúdo.** Todas as receitas da 1.8.9 (≈ 300+), carregadas do arquivo de receitas da pasta "04-dados-1.8.9/minecraft-data" (assim como blocos, itens, comidas, materiais e janelas de inventário). Apêndice B lista as essenciais que precisam ser testadas manualmente. O registro de receitas é extensível pelo PRD 09 (armas) e PRD 10 (itens criados no Studio).

**MC06-RF-034 (P1) — Ajuda de receitas (extensão Mind Cave).** Botão "?" na tela da bancada abre um **livro de receitas** pesquisável (não existia na 1.8, mas ajuda no desenvolvimento): mostra receitas conhecidas, clicar preenche a grade com os itens do inventário se houver. Desligável nas opções (padrão: ligado no Laboratório, desligado no Mundo Aberto).

---

## 5. Fornalha

**MC06-RF-040 (P0) — Funcionamento (1.8.9).** Slots: entrada (cima), combustível (baixo), saída (direita). Cada item leva **200 ticks** (10 s). A fornalha "acende" (bloco vira fornalha acesa: luz 13, partículas de fumaça e chamas na frente, som de crepitar) enquanto queima. Combustível é consumido quando começa a queimar e dura seu tempo; se a entrada acabar, o combustível atual continua queimando até o fim. Barra de chama (combustível restante) e seta de progresso. XP acumulada liberada ao retirar a saída. **Continua funcionando com a tela fechada e com ninguém por perto** enquanto o chunk estiver carregado (tick de entidade de bloco). Hoppers interagem no PRD 11.

**MC06-RF-041 (P0) — Combustíveis.**

| Combustível | Ticks | Itens fundidos |
|---|---|---|
| Balde de lava | 20.000 | 100 |
| Bloco de carvão | 16.000 | 80 |
| Vara de blaze | 2.400 | 12 |
| Carvão / carvão vegetal | 1.600 | 8 |
| Itens de madeira (troncos, tábuas, escadas, cercas, portões, bancada, baú, baú armadilha, estante, alçapão, toca-discos, bloco musical, cogumelos gigantes de bloco, sensor de luz, estandarte) | 300 | 1,5 |
| Lajes de madeira | 150 | 0,75 |
| Ferramentas/espadas de madeira | 200 | 1 |
| Gravetos, mudas | 100 | 0,5 |

**MC06-RF-042 (P0) — Receitas de fornalha.** Minério de ferro → lingote de ferro (0,7 XP), ouro → lingote de ouro (1,0), areia → vidro (0,1), pedregulho → pedra (0,1), argila (bola) → tijolo (0,3), bloco de argila → argila endurecida (0,35), tronco → carvão vegetal (0,15), cacto → corante verde (1,0), carnes cruas → assadas (0,35), batata → assada (0,35), peixes → assados (0,35), minério de diamante → diamante (1,0), minério de esmeralda → esmeralda (1,0), lápis → lápis (0,2), redstone → redstone (0,7), carvão → carvão (0,1), quartzo do Nether → quartzo (0,2), tijolo de pedra → tijolo de pedra rachado (0,1), netherrack → tijolo do Nether (0,1), esponja molhada → esponja (0,15), ferramentas/armaduras não fundem na 1.8.

---

## 6. Baús e outros containers

**MC06-RF-050 (P0) — Baú.** 27 slots. Dois baús lado a lado viram **baú duplo** (54 slots, modelo largo). Não é possível abrir se houver bloco opaco em cima (ou jaguatirica sentada — PRD 08). Tampa anima ao abrir/fechar (visível para todos), som de abrir/fechar. Ao quebrar, derrama o conteúdo. **Baú armadilha** (emite redstone proporcional a quantos estão vendo — PRD 11). **Baú do Ender**: inventário de 27 slots **por jogador**, compartilhado entre todos os baús do Ender do mundo; quebrar sem toque de seda dá 8 obsidianas.

**MC06-RF-051 (P0) — Outros containers registrados aqui com a tela** (lógica completa nos PRDs indicados): ejetor e liberador 3×3 (PRD 11), funil 5 slots (PRD 11), suporte de poções (PRD 11), mesa de encantamento (PRD 11), bigorna (PRD 11), sinalizador (PRD 11), carrinho com baú/funil (PRD 11).

---

## 7. Mineração exata (1.8.9)

**MC06-RF-060 (P0) — Fórmula do tempo de quebra.** A cada tick segurando o botão:
1. `velocidade = multiplicadorFerramenta` se a ferramenta é **adequada** ao bloco, senão 1.
2. Se adequada e com Eficiência N: `velocidade += N² + 1`.
3. Pressa N: `velocidade × (1 + 0,2·N)`. Fadiga de mineração: `× 0,3^nível` (aprox. 1.8).
4. Debaixo d'água sem Afinidade aquática: `÷ 5`. Sem estar no chão (pulando/voando/nadando): `÷ 5`.
5. `progressoPorTick = velocidade / dureza / (podeColher ? 30 : 100)`.
6. Quebra quando a soma ≥ 1. Se o primeiro tick já ≥ 1 → quebra instantânea.
7. Após quebrar em Sobrevivência, **5 ticks** de pausa antes de começar o próximo bloco.
8. Dureza −1 (bedrock, portal, barreira, bloco de comando) = inquebrável em Sobrevivência.

**MC06-RF-061 (P0) — Multiplicadores e níveis.**

| Material | Velocidade | Nível de colheita | Durabilidade |
|---|---|---|---|
| Madeira | 2 | 0 | 59 |
| Pedra | 4 | 1 | 131 |
| Ferro | 6 | 2 | 250 |
| Diamante | 8 | 3 | 1.561 |
| Ouro | 12 | 0 | 32 |
| Tesoura | 1,5 (teia 15, folhas 15, lã 5) | — | 238 |
| Espada | 1,5 em plantas/abóboras/folhas; 15 em teia | — | (ver tabela de armas) |

Níveis exigidos (sem eles, o bloco quebra devagar e **não dropa**): pedra, pedregulho, minério de carvão, arenito, tijolos, fornalha etc. → picareta qualquer (0); minério de ferro e lápis → pedra (1)+; ouro, diamante, esmeralda, redstone → ferro (2)+; obsidiana → diamante (3). Pás: terra, grama, areia, cascalho, argila, neve, micélio, terra arada, areia das almas. Machados: madeira, tábuas, baús, bancada, estantes, abóboras, melancias, escadas de mão, placas, portas de madeira. Blocos sem ferramenta exigida (terra, madeira) dropam com a mão.

**MC06-RF-062 (P0) — Desgaste.** Ferramenta adequada ou não: −1 de durabilidade por bloco quebrado (exceto blocos de dureza 0, como flores e tochas). Espadas: −2 por bloco. Usar ferramenta para **atacar**: espadas −1, outras ferramentas −2. Enxada: −1 ao arar. Quando a durabilidade chega a 0, a ferramenta quebra (som, partículas do item). Barra de durabilidade sob o ícone (verde → amarelo → vermelho), aparece só após o primeiro uso.

**MC06-RF-063 (P0) — Drops especiais (1.8.9).** Tabela de drops por bloco no registro, com sorte (Fortuna) e toque de seda (PRD 11) como modificadores:
pedra → pedregulho; grama/micélio/podzol → terra; minério de carvão → carvão; diamante → diamante; esmeralda → esmeralda; redstone → 4–5 pó; lápis → 4–8; quartzo → quartzo; glowstone → 2–4 pó; cascalho → 10% sílex; folhas → mudas (1/20; selva 1/40) e maçã (carvalho/carvalho escuro 1/200), e o próprio bloco de folhas só com tesoura; grama alta → 1/8 sementes (com tesoura dropa a grama); arbusto morto → 0–2 gravetos; vidro/painel/gelo → nada (gelo vira água se houver bloco embaixo); estante → 3 livros; melancia → 3–7 fatias; argila → 4 bolas; bloco de neve → 4 bolas; camada de neve → bolas só com pá; cogumelo gigante → 0–2 cogumelos; baú do Ender → 8 obsidianas; teia → linha (com espada) ou o bloco (tesoura); trepadeira → só com tesoura; bloco infestado → nada (solta traça — PRD 08); plantações → produto + sementes conforme estágio; cacau → 1–3 sementes de cacau; trigo maduro → 1 trigo + 0–3 sementes.

---

## 8. Ferramentas, armas e armaduras

**MC06-RF-070 (P0) — Dano corpo a corpo (1.8.9; já inclui o 1 da mão).**

| Item | Madeira | Ouro | Pedra | Ferro | Diamante |
|---|---|---|---|---|---|
| Espada | 5 | 5 | 6 | 7 | 8 |
| Machado | 4 | 4 | 5 | 6 | 7 |
| Picareta | 3 | 3 | 4 | 5 | 6 |
| Pá | 2 | 2 | 3 | 4 | 5 |
| Enxada / mão / outros itens | 1 | 1 | 1 | 1 | 1 |

Tooltips mostram "+N Dano de ataque" em azul (como o 1.8).

**MC06-RF-071 (P0) — Armaduras (pontos e durabilidade 1.8.9).**

| Material | Capacete | Peitoral | Calças | Botas | Total |
|---|---|---|---|---|---|
| Couro (tingível) | 1 / 55 | 3 / 80 | 2 / 75 | 1 / 65 | 7 |
| Ouro | 2 / 77 | 5 / 112 | 3 / 105 | 1 / 91 | 11 |
| Malha (só por comércio/loot) | 2 / 165 | 5 / 240 | 4 / 225 | 1 / 195 | 12 |
| Ferro | 2 / 165 | 6 / 240 | 5 / 225 | 2 / 195 | 15 |
| Diamante | 3 / 363 | 8 / 528 | 6 / 495 | 3 / 429 | 20 |

Modelos e encaixe das armaduras no corpo do jogador: portar de "07-animacoes-jogador-e-armaduras/minecraft-renderer" (modelos de armadura); a barra de armadura do HUD vem de "05-hud-e-ui". Vestir: arrastar para o slot, Shift+clique, ou **clique direito com a peça na mão** (equipa direto, regra 1.8). Armadura aparece no modelo do jogador (camada sobre a skin, com tingimento do couro e brilho de encantamento). Abóbora pode ser usada na cabeça (overlay do PRD 02, e endermen não ficam bravos — PRD 08). Cabeças de mob também.

**MC06-RF-072 (P0) — Outras ferramentas e utilitários (comportamento).**

| Item | Uso |
|---|---|
| Balde | Pega fonte de água/lava; balde de água coloca fonte (no Nether evapora — PRD 11); balde de lava coloca lava; ordenhar vaca → balde de leite (beber remove efeitos) |
| Pederneira e aço | Acende fogo na face; acende TNT; acende portal do Nether (PRD 11); 64 usos |
| Tesoura | Tosquia ovelha (1–3 lã), corta folhas/teia/trepadeira/grama alta/fio de armadilha sem acioná-lo |
| Enxada | Terra/grama → terra arada (só com ar em cima) |
| Farinha de osso | Cresce plantações/mudas/grama/flores instantaneamente (estágios aleatórios — PRD 11) |
| Vara de pescar | Lança a boia (física de linha); puxa entidades; pesca (P1: tempo de espera 5–45 s, bolhas na água vindo à boia, tabela: peixes 85%, lixo 10%, tesouro 5%) |
| Arco e flechas | PRD 07 |
| Bola de neve, ovo | Arremesso; ovo 1/8 chance de pintinho (1/256 de 4) — PRD 08 |
| Pérola do Ender | Teleporta para onde cair, 5 de dano |
| Placa | Coloca e abre a tela de edição (4 linhas, até 15 caracteres cada, texto simples; cores só via comandos/dados) |
| Quadro (pintura) | Coloca uma pintura aleatória que caiba no espaço (tamanhos 1×1 a 4×4). Arte gerada por código, enviada no Studio ou vinda do pacote de recursos importado (PRD 10). |
| Moldura (item frame) | Mostra item; clique gira o item em 8 posições |
| Suporte de armadura | Entidade que veste armadura (1.8) |
| Barco | Entidade montável na água (P1: física de barco 1.8, quebra ao bater rápido) |
| Carrinhos | PRD 11 |
| Livro e pena | Editor de livro (até 50 páginas); assinar vira livro escrito com autor |
| Mapa | P2: mapa 128×128 desenhado a partir do terreno explorado, escala 1:1 a 1:16 |
| Bússola, relógio | PRD 05 RF-071 |
| Etiqueta (name tag), guia (lead), sela, cenoura na vara | PRD 08 (mobs) |
| Ovos de spawn | PRD 08 |
| Disco de música | Toca-discos toca a faixa (arquivos enviados no PRD 10; sem arquivo, toca um tom sintetizado curto) |

---

## 9. Detalhes de UX

- **MC06-RF-080 (P0) — Tooltips avançados** (F3+H): mostram ID numérico/nome interno, durabilidade "Durabilidade: x / y", dados.
- **MC06-RF-081 (P0) — Escolher bloco em Sobrevivência:** se o item está no inventário, traz para a hotbar (troca com o slot atual); se não está, nada acontece.
- **MC06-RF-082 (P0) — Contadores:** quantidade em branco com sombra no canto inferior direito; quantidade > máximo (comandos) em vermelho.
- **MC06-RF-083 (P0) — Brilho de encantamento:** itens encantados (e maçã dourada encantada, estrela do Nether, livro encantado, garrafa de XP) têm o efeito de brilho animado roxo (*glint*) no ícone, na mão, no chão e na armadura vestida.

---

## 10. Comandos

`/give <jogador> <item> [qtd] [dano] [dadosJSON]`, `/clear <jogador> [item] [dano] [máx]`, `/replaceitem` (P2), `/enchant` (PRD 11). Itens aceitos por nome interno (`diamond_sword`), nome com prefixo (`minecraft:diamond_sword` aceito por compatibilidade de dados) ou ID numérico.

---

## 11. Requisitos não funcionais

- **MC06-RNF-001 (P0)** Abrir inventário/container em ≤ 1 quadro; resposta visual ao clique imediata (previsão local).
- **MC06-RNF-002 (P0)** Nenhuma duplicação de itens nos testes de estresse (seção 12).
- **MC06-RNF-003 (P0)** Fornalhas e baús salvos como dados do bloco (block entity) junto com o chunk.
- **MC06-RNF-004 (P0)** Receitas carregadas de dados; adicionar receita nova não exige alterar o motor.

---

## 12. Critérios de aceite

- **MC06-CA-01** Sequência clássica de sobrevivência completa sem comandos: socar árvore → tábuas → bancada → gravetos → picareta de madeira → pedregulho → picareta de pedra → fornalha → carvão → tochas → ferro → picareta de ferro → diamante.
- **MC06-CA-02** Tempos de quebra conferem: terra com a mão ≈ 0,75 s; pedra com a mão ≈ 7,5 s sem drop; pedra com picareta de madeira ≈ 1,15 s; pedra com picareta de diamante ≈ 0,3 s; obsidiana com diamante ≈ 9,4 s.
- **MC06-CA-03** Todas as regras de clique da tabela RF-011 funcionam (teste por linha).
- **MC06-CA-04** Dois jogadores mexendo no mesmo baú ao mesmo tempo, com lag simulado de 300 ms, por 2 min, sem itens duplicados ou perdidos (contagem total antes/depois).
- **MC06-CA-05** Fornalha com 64 de ferro e 8 carvões continua funcionando enquanto o jogador se afasta (dentro da distância de simulação) e produz 64 lingotes.
- **MC06-CA-06** Baú duplo, baú do Ender (inventário separado por jogador) e baú armadilha funcionando.
- **MC06-CA-07** Armadura completa de ferro mostra 15 pontos no HUD e aparece no modelo para o outro jogador.
- **MC06-CA-08** Ferramenta de ouro quebra após 32 usos; barra de durabilidade correta.
- **MC06-CA-09** Inventário criativo com busca encontra "tocha" e "torch".

---

## Apêndice A — Itens da 1.8.9 a registrar (agrupado)

- **Ferramentas:** pá, picareta, machado, enxada (madeira, pedra, ferro, ouro, diamante); tesoura; pederneira e aço; vara de pescar; cenoura na vara; bússola; relógio; balde (vazio, água, lava, leite); guia; etiqueta.
- **Armas e munição:** espadas (5 materiais); arco; flecha.
- **Armaduras:** couro, malha, ferro, ouro, diamante (4 peças cada); armaduras de cavalo (ferro, ouro, diamante).
- **Materiais:** graveto, carvão, carvão vegetal, diamante, esmeralda, lingote de ferro, lingote de ouro, pepita de ouro, linha, pena, pólvora, sílex, couro, pele de coelho, pé de coelho, tijolo, bola de argila, papel, livro, bola de slime, ovo, osso, farinha de osso e os **16 corantes** (saco de tinta, rosa vermelha, verde de cacto, sementes de cacau, lápis-lazúli, roxo, ciano, cinza-claro, cinza, rosa, lima, amarelo, azul-claro, magenta, laranja, farinha de osso), açúcar, trigo, sementes (trigo, abóbora, melancia), pó de redstone, pó de glowstone, pérola do Ender, olho do Ender, vara de blaze, pó de blaze, lágrima de ghast, verruga do Nether, creme de magma, olho de aranha, olho de aranha fermentado, melancia reluzente, estrela do Nether, quartzo do Nether, tijolo do Nether (item), fragmento e cristais de prismarinho, garrafa de vidro, garrafa de experiência, carga de fogo.
- **Comidas:** tabela do PRD 05.
- **Colocáveis/decoração:** placa, portas (6 madeiras + ferro), cama, pintura, moldura, suporte de armadura, vaso de flor, cabeças (esqueleto, wither esqueleto, zumbi, jogador, creeper), estandarte (16 cores), bolo, suporte de poções, caldeirão, repetidor, comparador, cana-de-açúcar, verruga do Nether, sementes.
- **Transporte:** barco, carrinho, carrinho com baú, com fornalha, com TNT, com funil, com bloco de comando, sela.
- **Diversos:** livro e pena, livro escrito, livro encantado, mapa vazio, mapa, 12 discos de música, poções e poções arremessáveis (PRD 11), ovos de spawn (PRD 08), bola de neve, fogos de artifício e estrela de fogos.

## Apêndice B — Receitas essenciais para teste manual

| Resultado | Receita |
|---|---|
| 4 tábuas | 1 tronco (qualquer slot; tábua da mesma madeira) |
| 4 gravetos | 2 tábuas na vertical |
| Bancada de trabalho | 4 tábuas em 2×2 |
| Fornalha | 8 pedregulhos em anel |
| Baú | 8 tábuas em anel |
| 4 tochas | carvão/carvão vegetal sobre graveto |
| Picareta | 3 material em cima + 2 gravetos no meio |
| Machado | 3 material em "L" + 2 gravetos (espelhável) |
| Pá | 1 material + 2 gravetos |
| Enxada | 2 material + 2 gravetos |
| Espada | 2 material na vertical + 1 graveto |
| Capacete / Peitoral / Calças / Botas | 5 / 8 / 7 / 4 do material nos formatos padrão |
| Arco | 3 gravetos + 3 linhas |
| 4 flechas | sílex + graveto + pena (vertical) |
| Balde | 3 lingotes de ferro em "V" |
| Tesoura | 2 lingotes de ferro na diagonal |
| Pederneira e aço | lingote de ferro + sílex |
| Pão | 3 trigos em linha |
| 3 escadas de mão | 7 gravetos em "H" |
| 3 cercas (1.8) | 4 tábuas + 2 gravetos (tábua-graveto-tábua em 2 linhas) |
| 3 portas (1.8) | 6 tábuas em 2×3 |
| 3 placas | 6 tábuas + 1 graveto |
| Cama | 3 lãs + 3 tábuas |
| Barco | 5 tábuas em "U" |
| TNT | 5 pólvoras + 4 areias em xadrez |
| 4 escadas de pedregulho (1.8) | 6 pedregulhos em degrau |
| 6 lajes | 3 blocos em linha |
| Bloco de ferro/ouro/diamante/esmeralda/redstone/lápis/carvão | 9 do item (e o inverso) |
| Estante | 6 tábuas + 3 livros |
| Livro | 3 papéis + 1 couro (sem formato) |
| 3 papéis | 3 canas-de-açúcar em linha |
| Bússola | 4 ferros em cruz + redstone no meio |
| Relógio | 4 ouros em cruz + redstone no meio |
| Mesa de encantamento | livro, 2 diamantes, 4 obsidianas |
| Bigorna | 3 blocos de ferro + 4 lingotes |
| Olho do Ender | pérola do Ender + pó de blaze (sem formato) |
| Maçã dourada | maçã cercada por 8 lingotes de ouro (encantada: 8 blocos de ouro) |
