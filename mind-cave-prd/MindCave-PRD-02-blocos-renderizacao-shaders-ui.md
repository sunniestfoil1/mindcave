# MIND CAVE — PRD 02 de 12
# Blocos Completos, Renderização, Água e Lava, Iluminação, Modo Shaders e Interface

| Campo | Valor |
|---|---|
| Depende de | PRD 01 (arquitetura, registros, meshing em workers, servidor integrado, persistência, multiplayer) |
| Objetivo | Deixar o mundo com a **aparência e o comportamento visual completos da 1.8.9** (todos os blocos, todas as formas, luz real 0–15, água/lava corrente, céu, nuvens, partículas) e adicionar um **Modo Shaders** opcional com predefinições de qualidade para gráficos bonitos. Entregar também o **sistema de UI completo** (HUD, containers, telas, fontes, escalas). |
| Próximo | PRD 03 — Configurações |

> Documento de requisitos. Descreve o resultado esperado, regras, números e critérios de aceite. A organização do código é decisão da IA executora, respeitando a arquitetura do PRD 01 (registros data-driven, meshing em workers, servidor autoritativo, nenhum re-render React por quadro).

---

## 1. Escopo

### 1.1 Dentro
1. Registro de **todos os blocos da 1.8.9** (Apêndice A) com propriedades, formas (modelos) e texturas procedurais.
2. Sistema de **modelos de bloco** (cubo, cruz, laje, escada, cerca, painel, tocha, porta, alçapão, trilho, líquido, camada, etc.) e **camadas de render** (sólida, recorte, recorte com mipmap, translúcida).
3. **Iluminação real**: luz do céu e luz de bloco 0–15 com propagação por BFS, atualização incremental, iluminação suave (smooth lighting) e oclusão ambiente por vértice, *lightmap* dia/noite.
4. **Água e lava** com fluxo, níveis, fontes infinitas, interação (obsidiana/pedregulho/pedra), renderização com altura por canto e direção de fluxo, física de nado e correnteza.
5. **Céu**: sol, lua com 8 fases, estrelas, gradientes de nascer/pôr do sol, cor do céu por bioma, névoa, nuvens rápidas/detalhadas.
6. **Partículas** (sistema genérico + tipos 1.8.9 desta fase).
7. **Modo Shaders** com pipeline de pós-processamento e predefinições (Desligado, Leve, Médio, Alto, Ultra, Cinemático).
8. **UI completa**: fonte pixel, escala de GUI, HUD completo (incluindo espaços de vida/fome/armadura/XP usados no PRD 05), framework de telas de container (usado no PRD 06), overlays de tela, tooltips, renderização de itens em GUI e na mão.
9. Conexão dos **sons por categoria** (reprodução real a partir de arquivos enviados; fallback com sons sintetizados simples).

### 1.2 Fora
Lógica de redstone (PRD 11 — aqui só a **aparência** dos blocos de redstone), crafting/inventário funcional (PRD 06), mobs (PRD 08), dimensões Nether/End (PRD 11 — mas os blocos delas já são registrados aqui), clima com chuva/neve (PRD 05 — o renderer deve deixar o "pass de clima" pronto).

---

## 2. Registro de blocos completo

**MC02-RF-001 (P0) — Todos os blocos.** Registrar todos os blocos do Apêndice A com seus metadados/variantes. Para cada bloco, além das propriedades do PRD 01 (RF-021), adicionar:

| Propriedade | Descrição |
|---|---|
| `modelo` | Tipo de forma (seção 3) + parâmetros |
| `camadaRender` | `solida`, `recorte`, `recorteMip`, `translucida` |
| `opacidadeLuz` | 0–15: quanto reduz a luz que passa (opacos = 15; folhas = 1; água/gelo = 3; teia = 1; ar/vidro = 0) |
| `emissaoLuz` | 0–15 (tabela 4.3) |
| `caixasColisao` | Lista de AABB (pode ser vazia: flores, grama alta, tochas) e pode depender do estado (portas, alçapões, cercas conectadas) |
| `caixasSelecao` | Contorno mostrado ao mirar (pode diferir da colisão — ex.: tocha) |
| `tintura` | Nenhuma, `grama`, `folhagem`, `água`, `fixa(cor)` — cor aplicada por vértice a partir do bioma |
| `faceOclusaoCompleta` | Por face: se essa face esconde totalmente a face vizinha (cubos sim; lajes só a de baixo/cima; escadas parcialmente) |
| `estadosVisuais` | Propriedades derivadas da vizinhança só para render (conexão de cerca, painel, muro, fio de redstone, grama com neve em cima) — calculadas no meshing, sem salvar no chunk |
| `animacaoTextura` | Quadros + duração por quadro (água, lava, fogo, portal, gema de prismarinho, lâmpada de mar) |
| `somCategoria` | pedra, madeira, cascalho, grama, metal, vidro, lã, areia, neve, escada, bigorna, slime |
| `escorregamento` | 0,6 padrão; gelo e gelo compactado 0,98; slime 0,8 |
| `fatorVelocidade` | Areia da alma 0,4 (multiplica o movimento); teia reduz muito (0,25 horizontal, 0,05 vertical) |
| `substituivel` | Pode ser substituído ao colocar outro bloco (ar, água, lava, grama alta, neve camada 1, fogo, trepadeira, arbusto morto) |

**MC02-RF-002 (P0) — Orientação e estados.** Blocos com estado orientável (escadas, fornalhas, baús, troncos, portas, alçapões, botões, alavancas, tochas de parede, abóboras, repetidores, comparadores, pistões, distribuidores, liberadores, funis, trilhos, camas, placas, escadas de mão, portões) recebem orientação a partir da posição/olhar do jogador ao colocar, com as **mesmas regras da 1.8.9**:
- Escadas: viradas para a direção do jogador; metade superior se colocada na metade de cima de uma face lateral ou embaixo de um bloco; **formas de canto** (interno/externo) calculadas pela vizinhança.
- Lajes: metade de cima/baixo pela posição do clique; duas lajes iguais no mesmo bloco viram laje dupla.
- Portas: 2 blocos de altura, dobradiça à esquerda/direita conforme portas vizinhas e blocos sólidos, abre/fecha com clique (porta de ferro só por redstone — PRD 11).
- Alçapões: metade de cima/baixo, abre com clique.
- Tochas: em face superior ou lateral (não em baixo); somem se o suporte some.
- Troncos: eixo pela face.
- Fornalhas/baús/abóboras/distribuidores: face frontal voltada para o jogador.
- Cama: 2 blocos (cabeceira na direção do olhar).

**MC02-RF-003 (P0) — Atualizações de vizinhança.** Ao mudar um bloco, notificar os 6 vizinhos (`neighborChanged`). Blocos que dependem de suporte (tochas, flores, plantas, trilhos, placas, botões, portas, neve camada, cacto, cana, escada de mão, tapete) se quebram e dropam quando perdem o suporte. Areia, areia vermelha, cascalho e bigorna **caem** (entidade de bloco caindo, com física, aterrissa e vira bloco; se cair em bloco não sólido como tocha, vira item). Grama vira terra se ficar com bloco opaco em cima (por tick aleatório) e se espalha para terra adjacente com luz ≥ 9 no bloco acima (regra 1.8: alcance ±1 horizontal, −3 a +1 vertical).

---

## 3. Modelos de bloco (formas)

**MC02-RF-010 (P0) — Tipos de modelo obrigatórios.**

| Modelo | Exemplos | Regras de geometria |
|---|---|---|
| Cubo | Pedra, terra, tábuas | 6 faces, culling contra vizinho com face de oclusão completa |
| Cubo com overlay | Grama (lado = terra + overlay verde tingido), grama com neve | Face lateral com 2 camadas (base + overlay tingido) |
| Cruz (X) | Flores, mudas, grama alta, teia, cogumelos, cana, arbusto morto | 2 planos diagonais, sem culling, com deslocamento aleatório XZ determinístico por posição para grama alta/samambaia (como no jogo) |
| Plantação (#) | Trigo, cenoura, batata, verruga do Nether | 4 planos formando "#", 4 px para dentro |
| Laje | Lajes de todos os materiais | Meia altura cima/baixo |
| Escada | Escadas de todos os materiais | Formas reta, canto interno, canto externo (cima/baixo) |
| Cerca/Muro/Grade/Painel | Cercas, muro de pedregulho, barras de ferro, painéis de vidro | Poste + braços conectando aos vizinhos compatíveis; muro tem poste alto quando não está em linha reta |
| Portão | Portões de cerca | Fechado/aberto, rebaixado quando entre muros |
| Tocha | Tocha, tocha de redstone | Haste 2×10 px; na parede inclinada |
| Porta | Portas | Placa de 3 px de espessura, 2 blocos |
| Alçapão | Alçapões | Placa de 3 px |
| Escada de mão / Trepadeira | Escada de mão, trepadeiras | Plano colado na face (trepadeira pode estar em várias faces e no teto) |
| Trilho | Trilhos (4 tipos) | Plano no chão; trilhos inclinados; curvas |
| Placa | Placa em pé (16 rotações) e de parede | Modelo com texto renderizado (4 linhas de até 15 caracteres) |
| Camada | Neve (1–8 camadas), tapete (1 px) | Altura variável |
| Líquido | Água, lava | Seção 5 |
| Cacto | Cacto | Faces laterais recuadas 1 px |
| Bolo | Bolo | 7 estados de fatias |
| Cama | Cama | 9 px de altura, cabeceira/pé |
| Baú | Baús (normal, armadilha, ender) e baú duplo | Modelo 14×14×14 com tampa que **anima** ao abrir (entidade de bloco renderizada à parte) |
| Bigorna, caldeirão, funil, mesa de encantamento, suporte de poções, farol, vaso de flor, cabeças, bandeiras, pistão, repetidor, comparador, sensor de luz, alavanca, botão, placas de pressão, gancho de armadilha, fio, fio de redstone, portal, moldura do portal do End, ovo do dragão, cacau, caule de abóbora/melancia, vitória-régia, fogo | — | Modelos específicos equivalentes à 1.8.9 (dimensões em pixels de 1/16) |

**MC02-RF-011 (P0) — Modelos como dados.** Cada modelo é descrito por **lista de elementos em caixas** (de/até em pixels 0–16, faces com UV, rotação opcional de 22,5°/45° em um eixo, direção de culling por face, tintIndex) — o mesmo conceito dos modelos JSON de bloco. Modelos especiais (líquidos, conexões) são geradores de código, mas também saem nesse formato intermediário. Isso permite ao PRD 10 (Studio) trocar o modelo de um bloco por GLB.

**MC02-RF-012 (P0) — Variação de textura.** Suporte a rotação aleatória determinística de textura por posição para grama (topo), terra, areia, pedra (desligável) para reduzir repetição — mesmo comportamento do jogo para o topo da grama.

---

## 4. Iluminação

**MC02-RF-020 (P0) — Dois canais de luz.** Cada bloco guarda **luz do céu** (0–15) e **luz de bloco** (0–15).
- Luz do céu: 15 em todo bloco com visão direta do céu (acima do heightmap de opacos); propaga para baixo **sem perder** em colunas abertas; para os lados e por baixo de coberturas perde 1 por bloco + `opacidadeLuz` do bloco.
- Luz de bloco: fontes com `emissaoLuz`; propaga em 6 direções perdendo 1 + `opacidadeLuz`.
- Luz efetiva para render = combinação via *lightmap* 16×16 (eixos céu × bloco) que considera hora do dia, brilho (gamma) e efeitos (visão noturna no PRD 11).

**MC02-RF-021 (P0) — Propagação incremental.** Algoritmo BFS com fila de adição e fila de remoção (ao remover fonte ou colocar bloco opaco: remover luz dependente e repropagar das bordas). Atualização entre chunks vizinhos. Deve rodar no servidor (autoritativo, salvo junto com o chunk) **e** poder ser recomputado no cliente ao receber chunk sem luz (opção: o servidor envia a luz pronta). Quebrar/colocar 1 bloco deve atualizar luz e malhas afetadas em < 2 quadros.

**MC02-RF-022 (P0) — Tabela de emissão (1.8.9).**

| Bloco | Luz |
|---|---|
| Glowstone, lanterna-de-abóbora, lava, fogo, lâmpada do mar, farol, portal do End, lâmpada de redstone acesa | 15 |
| Tocha | 14 |
| Fornalha acesa | 13 |
| Portal do Nether | 11 |
| Minério de redstone aceso | 9 |
| Tocha de redstone (acesa), baú do Ender | 7 |
| Cogumelo marrom, suporte de poções, ovo do dragão, moldura do portal do End | 1 |

**MC02-RF-023 (P0) — Iluminação suave e AO.** Opções: **Desligada** (luz por face plana, sombreamento direcional fixo: topo 100%, laterais N/S 80%, L/O 60%, base 50%), **Mínima** (luz suave sem AO) e **Máxima** (luz suave por vértice = média dos 4 blocos que tocam o vértice + **oclusão ambiente por vértice** dos 3 vizinhos; quando os dois laterais são opacos o canto fica com AO máxima). Inverter a diagonal do quad quando necessário para evitar artefato de interpolação (regra clássica de "flip" de quads com AO).

**MC02-RF-024 (P0) — Ciclo de luz do céu.** O multiplicador de luz do céu varia com a hora (dia claro ~ticks 0–12000; escurece no pôr do sol 12000–13800; noite 13800–22200; amanhece 22200–24000). Nível de "escurecimento do céu" de 0 (dia) a 11 (meia-noite), igual ao 1.8. Mudar a hora **não** exige remeshing: a luz vai para o shader via lightmap (texture lookup), não é "assada" na cor do vértice.

**MC02-RF-025 (P1) — Cintilação de tocha.** O lightmap da luz de bloco tem leve variação aleatória ao longo do tempo (flicker) e tom levemente quente (amarelado), como no 1.8.

---

## 5. Água e lava

**MC02-RF-030 (P0) — Simulação (servidor).**
- Níveis: fonte = 0; corrente = 1–7 (água) / em passos de 2 para lava no Overworld (alcance 3 blocos; no Nether lava alcança 7 e flui a cada 10 ticks — PRD 11).
- Água atualiza a cada **5 ticks**; lava a cada **30 ticks** (Overworld).
- Fluxo desce primeiro (cai como coluna de "queda" de nível 8); quando não pode descer, espalha horizontalmente na direção do(s) caminho(s) mais curto(s) para um declive num raio de busca de 4 blocos (comportamento 1.8); se nenhum, espalha para todos os lados.
- **Fonte infinita de água:** bloco de água corrente com ≥ 2 fontes horizontais adjacentes e bloco sólido ou fonte de água abaixo vira fonte.
- Remoção da fonte faz a corrente secar progressivamente.
- **Interações:** lava (fonte) tocada por água → **obsidiana**; lava corrente tocada por água → **pedregulho**; lava descendo sobre água → **pedra**. Som de "chiado" + partículas de fumaça.
- Líquidos destroem blocos "lavanáveis" (flores, tochas, grama alta, trilhos, fio de redstone, cana etc.) que viram drop (lava destrói sem drop).
- Lava incendeia blocos inflamáveis próximos (o fogo em si e sua propagação: PRD 05).

**MC02-RF-031 (P0) — Render de líquidos.** Superfície com **altura por canto** calculada pela média dos níveis vizinhos (fonte ≈ 8/9 de bloco de altura; quando há líquido em cima, altura cheia). Textura parada para superfícies planas e textura de fluxo orientada na direção da correnteza para superfícies inclinadas e laterais. Faces internas entre blocos de água não são desenhadas. Água é **translúcida** (camada própria, ordenada de trás para frente por seção), tingida por bioma (pântano mais escuro e esverdeado). Lava é opaca, emite luz 15 e tem animação lenta.

**MC02-RF-032 (P0) — Física em líquidos.**
- Dentro da água: gravidade reduzida (0,02/tick), arrasto 0,8, Espaço sobe (~0,04/tick de impulso), afundamento lento parado; correnteza empurra entidades (vetor de fluxo × 0,014/tick).
- Dentro da lava: arrasto 0,5, movimento muito lento.
- Sair da água pulando borda de 1 bloco deve ser possível segurando Espaço junto a uma parede (comportamento 1.8 de "pulinho" na borda).
- Neblina subaquática azulada (distância curta ~ 8–16 blocos ajustada por profundidade/luz), tela levemente azulada; dentro da lava: névoa laranja-avermelhada muito curta.
- Partículas de bolhas ao se mover sob a água; respingo ao entrar com velocidade.

---

## 6. Céu, névoa e nuvens

**MC02-RF-040 (P0) — Céu.** Domo/plano de céu com cor dependente do bioma (cor do céu 1.8 derivada da temperatura do bioma) e da hora; horizonte com névoa da mesma cor da névoa do mundo. Ao olhar para o lado do sol no nascer/pôr, gradiente alaranjado (cores do 1.8). **Sol** (quadrado texturizado) e **Lua** (8 fases, mudando a cada noite — o ciclo de fases afeta também mobs no PRD 08). **Estrelas**: ~1.500 pontos fixos gerados por seed fixo, aparecem gradualmente à noite. **Vazio**: abaixo do horizonte, cor escura.

**MC02-RF-041 (P0) — Névoa.** Névoa linear no fim da distância de visão (início ~75% da distância, fim = distância), cor = céu. Esconde a borda de carregamento de chunks. Névoa especial: água, lava, cegueira (PRD 11), Nether (PRD 11).

**MC02-RF-042 (P0) — Nuvens.** Altura Y=128, deslocando-se sempre ao longo do eixo X a velocidade constante (~0,03 bloco/tick), com a posição derivada do **tempo do mundo** para que os dois jogadores vejam exatamente as mesmas nuvens no mesmo lugar. Modo **Rápidas** (plano 2D) e **Detalhadas** (nuvens 3D em blocos de 12×4×12 px, com faces sombreadas). Padrão de nuvens gerado por textura de ruído determinística, substituído pela textura de nuvens do pacote de recursos quando houver um importado (PRD 10). Desligável (PRD 03).

---

## 7. Partículas

**MC02-RF-050 (P0) — Sistema genérico.** Pool de partículas com instancing (um draw por tipo/atlas), limite global configurável (Todas: 4.000, Reduzidas: 1.500, Mínimas: 300). Partículas de terreno colidem com blocos de forma simples. Ordenação para translúcidas.

**MC02-RF-051 (P0) — Tipos desta fase:** quebra de bloco (fragmentos da textura do bloco, ~64 por quebra em grade 4×4×4), rachando (ao minerar), passos (correndo sobre bloco), queda de grande altura (poeira do bloco ao aterrissar), chama e fumaça de tocha, gotejamento de água/lava sob blocos com líquido em cima, bolhas, respingo, fumaça de lava (cima da lava ocasional "pop"), portal (roxo), chiado (água+lava). Tipos de combate/mobs/explosão vêm nos PRDs 07–09 usando o mesmo sistema.

---

## 8. Modo Shaders

O jogo tem dois modos de render: **Clássico** (visual fiel ao 1.8.9) e **Shaders** (visual moderno inspirado em pacotes de shader populares). O modo Shaders é **puramente visual**: nada da lógica muda.

**MC02-RF-060 (P0) — Pipeline em passes.** O renderer deve ter um pipeline configurável:
1. Pass de sombras (mapas de sombra em cascata a partir do sol/lua).
2. G-buffer ou forward+ com dados para pós (profundidade, normais, luz céu/bloco, máscara de material: água, folhagem, emissivo, metálico).
3. Opacos → recorte → entidades → translúcidos (água/vidro) → partículas → clima → mão em 1ª pessoa (pass separado com FOV próprio e profundidade limpa).
4. Pós-processamento em cadeia.
No modo Clássico, os passes extras são desligados e o custo é igual ao PRD 01.

**MC02-RF-061 (P0) — Recursos do modo Shaders.**

| Recurso | Descrição | Parâmetros |
|---|---|---|
| Sombras dinâmicas | Cascaded Shadow Maps (2–4 cascatas) do sol/lua, ângulo do sol segue a hora; filtro PCF / suave (PCSS no Ultra) | Resolução (1024–4096), distância (32–192 blocos), nº de cascatas, suavidade |
| Luz colorida de bloco | Tochas/lava/fogo com tom quente; luz de bloco somada à luz direta | Intensidade, cor por fonte (do registro) |
| Água avançada | Ondas por normal map animado, reflexo do céu + SSR (reflexo em espaço de tela), refração do fundo, absorção por profundidade (cor azul-esverdeada), espuma nas bordas, cáusticas no fundo | Qualidade de reflexo (desl./céu/SSR), ondas |
| Folhagem e grama ondulantes | Animação de vértice: folhas, grama alta, flores, plantações, trepadeiras, superfície da água; vento global com rajadas | Intensidade do vento |
| Céu atmosférico | Espalhamento Rayleigh/Mie, sol com halo, nascer/pôr dramático, estrelas, lua com brilho | Liga/desliga |
| Nuvens volumétricas | Raymarching em camada (opcional; Alto/Ultra) | Qualidade, cobertura |
| Raios de luz (god rays) | Luz volumétrica do sol através de folhas/aberturas | Amostras |
| Oclusão ambiente em tela | SSAO/GTAO complementando o AO por vértice | Raio, intensidade |
| Bloom | Para emissivos (lava, glowstone, tochas) e sol | Limiar, intensidade |
| Tonemapping | ACES ou AgX + exposição | Exposição, adaptação automática |
| Correção de cor | Saturação, contraste, temperatura, vinheta | — |
| Antisserrilhamento | FXAA / SMAA / TAA | — |
| Profundidade de campo | Foco no bloco mirado (somente Cinemático) | Abertura |
| Desfoque de movimento | Opcional (Cinemático) | Intensidade |
| Mapas PBR | Se o asset enviado tiver normal map/specular (padrão tipo LabPBR), usar; senão, gerar normal sutil a partir da textura (relevo pelo brilho do pixel) | Liga/desliga normais geradas |

**MC02-RF-062 (P0) — Predefinições.**

| Predefinição | Sombras | Água | Ondulação | AO tela | Bloom | Volumetria | AA | Alvo |
|---|---|---|---|---|---|---|---|---|
| **Desligado** | — | clássica | — | — | — | — | — | Visual 1.8.9 puro |
| **Leve** | 1024, 2 cascatas, 48 blocos, PCF simples | reflexo do céu + ondas | folhas e grama | — | leve | — | FXAA | GPU integrada |
| **Médio** | 2048, 3 cascatas, 96 blocos | + refração | sim | SSAO meia resolução | sim | god rays baixo | SMAA | GPU de entrada |
| **Alto** | 2048, 4 cascatas, 128 blocos, PCF suave | + SSR | sim | GTAO | sim | god rays + nuvens volumétricas baixo | TAA | GPU intermediária |
| **Ultra** | 4096, 4 cascatas, 192 blocos, PCSS | SSR alta + cáusticas | sim | GTAO alta | sim | nuvens volumétricas alta | TAA | GPU forte |
| **Cinemático** | = Ultra | = Ultra | sim | = Ultra | forte | alta | TAA | + DoF + motion blur + barras 21:9 opcionais, para gravar vídeo/screenshot |

Cada recurso individual também é ajustável (PRD 03 cria a tela "Configurações de Shaders" com todos os parâmetros e permite salvar **predefinições personalizadas**).

**MC02-RF-063 (P0) — Troca em tempo real.** Alternar Clássico ↔ Shaders ou mudar predefinição **sem recarregar o mundo** (recompilar materiais em segundo plano, mostrar "Compilando shaders…" discreto). Nenhuma troca pode gerar remeshing de todos os chunks, exceto quando a opção exigir dados novos no vértice (nesse caso, remeshing progressivo).

**MC02-RF-064 (P1) — Detecção de capacidade.** Na primeira execução: medir rapidamente a GPU (consulta de timer se disponível + benchmark curto de 2 s numa cena fixa) e **sugerir** a predefinição. Se o FPS médio cair abaixo de 30 por mais de 10 s no modo Shaders, mostrar aviso não intrusivo sugerindo baixar a predefinição.

**MC02-RF-065 (P1) — Captura de tela.** F2 salva screenshot PNG na resolução atual (e em 2× no Cinemático, renderizando offscreen). Mostra mensagem no chat com link para download.

---

## 9. Interface (UI)

### 9.1 Base visual

**MC02-RF-070 (P0) — Fonte.** Fonte pixel bitmap legível com acentuação do português (á, é, í, ó, ú, ã, õ, ç, â, ê, ô, à) e caracteres de formatação. Usar fonte de licença livre (ex.: OFL) ou gerar uma fonte bitmap própria. Suporte a **códigos de formatação** `§0`–`§f` (16 cores), `§l` negrito, `§o` itálico, `§n` sublinhado, `§m` riscado, `§k` embaralhado, `§r` reset — usados no chat, nomes de itens, placas e títulos. Sombra de texto (deslocada 1 px, cor 25% da original).

**MC02-RF-071 (P0) — Escala de GUI.** Toda UI de jogo é desenhada em **pixels virtuais** multiplicados por um fator inteiro (1–4 ou Auto = maior fator que caiba em 320×240 virtuais). Sem borrões (desenho com `image-rendering: pixelated`/nearest). Menus fora do jogo podem usar React + CSS, mas com **o mesmo estilo pixel** e mesma escala.

**MC02-RF-072 (P0) — Estilo de componentes.** Substituído pelo PRD 19 (interface Java 1.8.9 com texturas de widgets); o texto abaixo vale só como histórico.
- Botão: retângulo com textura de pedra cinza procedural, borda escura, texto branco com sombra; *hover*: realce azulado + texto amarelo-claro; desabilitado: escurecido, texto cinza. Largura padrão 200 px virtuais, altura 20.
- Slider: mesmo fundo do botão, alça em pedra mais clara; o texto do valor fica dentro do slider ("Sensibilidade: 100%").
- Campo de texto: fundo preto, borda cinza-clara, cursor piscando, seleção, Ctrl+C/V/A.
- Fundo de menus fora do jogo: textura de terra escurecida em mosaico (gerada) ou o panorama 3D desfocado.
- Painéis de container: cinza claro com bordas chanfradas em 3 tons (claro em cima/esquerda, escuro embaixo/direita), slots 18×18 com interior rebaixado.
- Tooltip: fundo roxo-escuro quase opaco, borda gradiente roxa, nome do item + linhas extras.
- Sons de clique em botões.

**MC02-RF-073 (P0) — Framework de telas.** Pilha de telas (abrir sobre a outra, Esc volta). Toda tela pausa o input do jogo e libera o ponteiro. Telas de container (inventário, bancada, baú, fornalha… — conteúdo funcional no PRD 06) usam um componente comum: grade de slots, slot do cursor (item "segurado" segue o mouse), realce ao passar o mouse sobre slot (branco 50%), tooltips, contagem no canto inferior direito, barra de durabilidade (PRD 06). Os eventos de clique dos slots são **enviados ao servidor** (o PRD 06 define as regras de clique).

### 9.2 HUD completo

**MC02-RF-079 (P0) — Código de referência do HUD.** Os componentes do HUD (corações, fome, armadura, ar, XP, hotbar, mira, F3, Tab, chat com códigos §, títulos, barra de chefe, tela de morte, pausa, efeitos, escala de interface) devem ser **portados** de "05-hud-e-ui/minecraft-web-client", que já reproduz o layout, os tamanhos em pixels e o comportamento do HUD original em React. As imagens do HUD vêm, em ordem de prioridade: (1) do pacote de recursos 1.8.9 importado pelos devs (gui/widgets.png, gui/icons.png, fonte — PRD 10), (2) dos sprites procedurais (seção 11). O meshing e o render de mundo seguem "09-renderizacao-e-meshing".

**MC02-RF-080 (P0) — Layout do HUD (posições como no 1.8.9, em pixels virtuais).**
- **Hotbar:** 182×22 centralizada na base; seletor 24×24.
- **Vida:** 10 corações acima da hotbar à esquerda (meio coração = 1 HP). Variações (reservar sprites): cheio, metade, vazio, piscando ao levar dano, envenenado (verde), wither (preto), absorção (dourado, linha extra), modo hardcore. Corações "tremem" quando a vida ≤ 4 HP. Mais de 20 HP (efeitos) empilha em linhas.
- **Armadura:** 10 ícones acima dos corações, só aparece com armadura > 0.
- **Fome:** 10 coxas à direita acima da hotbar; tremem quando a saturação chega a 0; verde-acastanhado com efeito Fome.
- **Ar (bolhas):** acima da fome quando submerso.
- **Barra de XP:** 182×5 sobre a hotbar com o nível em verde no centro (texto com contorno preto).
- **Nome do item selecionado:** aparece acima da hotbar por 2 s ao trocar de slot e esmaece.
- **Barra de ação (action bar):** texto acima da hotbar (usado por armas no PRD 09 para munição).
- **Título/subtítulo:** texto grande no centro com tempos de fade in/permanência/fade out.
- **Barra de chefe:** topo central (dragão/wither — PRD 11).
- **Indicador de vida da montaria** (reservado).
- **Vinheta** de escuridão nas bordas (Gráficos Detalhados), mais forte em locais escuros.
Os elementos de vida/fome/ar/XP aparecem **apenas em Sobrevivência** (criativo mostra só a hotbar). Nesta fase eles leem valores fixos de placeholder; o PRD 05 liga aos sistemas reais.

**MC02-RF-081 (P0) — Overlays de tela.** Abóbora na cabeça (textura de máscara), dentro de bloco sólido (textura do bloco preenchendo a tela — sufocamento), fogo (chamas na parte de baixo da tela em 1ª pessoa), água (tom azul), portal (ondulação roxa — PRD 11), dano (inclinação de câmera — PRD 05), congelamento não existe na 1.8.

**MC02-RF-082 (P0) — Itens na mão (render base).** A mão/braço em 1ª pessoa usa a skin do jogador. Itens de bloco aparecem como mini-bloco 3D; itens planos (ferramentas, comida) como **sprite extrudado** com espessura de 1 px (fiel ao 1.8). Itens no chão: blocos 3D girando; itens planos extrudados girando; vários do mesmo tipo mostram 2–5 cópias empilhadas conforme a quantidade. Itens em quadros (*item frame* — reservado). Ícones de bloco em GUI: render isométrico 3D com sombreamento por face. Animações de uso/ataque detalhadas: PRD 07.

**MC02-RF-083 (P1) — Telas de carregamento e transição.** Fundo de terra, texto central, barra de progresso; transição entre dimensões (PRD 11) usa a mesma tela.

---

## 10. Sons

**MC02-RF-090 (P0) — Motor de áudio.** Web Audio com: som posicional 3D (atenuação linear até 16 blocos para a maioria; configurável por som), volume por categoria (Mestre, Música, Clima, Blocos, Criaturas hostis, Criaturas amigáveis, Jogadores, Ambiente — sliders no PRD 03), variações aleatórias (cada evento sorteia entre N arquivos e aplica variação de pitch 0,8–1,2 como no jogo), limite de vozes simultâneas (32) com prioridade.

**MC02-RF-091 (P0) — Eventos sonoros desta fase.** Por categoria de bloco: passo, quebra, colocação, batida (minerando), queda. Água: nadar, entrar/respingo, ambiente de água corrente. Lava: borbulhar, pop. Fogo (PRD 05). UI: clique. Porta/alçapão/portão/baú: abrir/fechar.

**MC02-RF-092 (P0) — Fallback.** Sem arquivos enviados, gerar sons simples por síntese (ruído filtrado para passos/quebra variando o filtro por categoria; "plop" senoidal para UI). O PRD 10 permite enviar OGG/MP3/WAV e vinculá-los a cada evento.

---

## 11. Texturas procedurais — requisitos do gerador

**MC02-RF-100 (P0) — Cobertura total.** Todas as texturas de todos os blocos do Apêndice A geradas por código em 16×16, com quadros de animação onde aplicável (água 32 quadros, lava 20, fogo 32, portal 32 — podem ser gerados por ruído animado em loop). Deve haver também texturas de: 10 estágios de rachadura, partículas, sol, lua (8 fases), nuvens, ícones de HUD (corações, coxas, armadura, bolhas, XP), widgets de UI.

**MC02-RF-101 (P0) — Diretrizes de estilo.** Pixel art com paletas de 4–8 tons por material; luz vinda de cima-esquerda; minérios com "pedra" de base idêntica à pedra + aglomerados de 3–6 pixels coloridos (carvão preto, ferro bege-rosado, ouro amarelo, redstone vermelho, lapis azul, diamante ciano, esmeralda verde); madeiras com 6 tons distintos (carvalho, abeto, bétula, selva, acácia, carvalho escuro) para tábuas, troncos (topo com anéis) e folhas; lã/argila/vidro em 16 cores (paleta de corantes padrão: branco, laranja, magenta, azul-claro, amarelo, lima, rosa, cinza, cinza-claro, ciano, roxo, azul, marrom, verde, vermelho, preto). Gerar com seed visual fixo e **cache** (IndexedDB) para não regenerar sempre.

**MC02-RF-102 (P0) — Substituição.** Qualquer textura pode ser substituída por PNG enviado (PRD 10), inclusive com resolução maior (32×, 64×, 128×), mantendo UVs. Atlas/array é refeito automaticamente.

---

## 12. Requisitos não funcionais

- **MC02-RNF-001 (P0)** Modo Clássico mantém as metas de FPS do PRD 01 com todos os blocos, luz suave máxima e água translúcida.
- **MC02-RNF-002 (P0)** Atualização de luz de 1 bloco (colocar tocha) termina, com malhas refeitas, em ≤ 50 ms.
- **MC02-RNF-003 (P0)** Ordenação de translúcidos por seção sem artefatos graves ao olhar através de 2 camadas de água/vidro.
- **MC02-RNF-004 (P0)** Fluxo de água simulando 500 blocos de corrente ao mesmo tempo sem derrubar o TPS abaixo de 19.
- **MC02-RNF-005 (P1)** Predefinição Leve ≥ 45 FPS em GPU integrada recente, distância 8.
- **MC02-RNF-006 (P0)** Sem vazamento de GPU ao alternar shaders 20 vezes seguidas.

---

## 13. Critérios de aceite

- **MC02-CA-01** Todos os blocos do Apêndice A colocáveis no criativo (lista temporária "todos os blocos" num inventário de teste ou `/give`) com forma, colisão, seleção e textura corretas.
- **MC02-CA-02** Escadas formam cantos automaticamente; cercas/painéis/muros conectam; portas de 2 blocos abrem e fecham sincronizadas para os dois jogadores.
- **MC02-CA-03** Colocar uma tocha numa caverna fechada ilumina com nível 14 decrescendo 1 por bloco (conferir no F3, que agora mostra `Luz: céu X, bloco Y`).
- **MC02-CA-04** Cavar um buraco 3×3 vertical expõe luz do céu até o fundo; cobrir o topo escurece.
- **MC02-CA-05** Balde é PRD 06, então testar água via `/setblock` (comando auxiliar adicionado aqui) ou colocando água no criativo: corrente alcança 7 blocos, desce cachoeiras, forma fonte infinita em 2×1, e lava+água gera obsidiana/pedregulho/pedra nos casos corretos.
- **MC02-CA-06** Dia/noite: a luz muda continuamente sem travar e sem remeshing (conferir FPS).
- **MC02-CA-07** Alternar Clássico → Shaders Ultra → Leve → Clássico sem recarregar mundo; sombras seguem o sol; água reflete o céu; folhas balançam.
- **MC02-CA-08** HUD em escala 1, 2, 3, 4 e Auto sem pixel borrado.
- **MC02-CA-09** Texto com acentos e códigos § renderiza corretamente no chat e nas placas.
- **MC02-CA-10** Areia e cascalho caem quando o suporte é removido e viram bloco ao aterrissar.

---

## 14. Riscos e trade-offs

| Tema | Decisão |
|---|---|
| Luz assada no vértice vs. lightmap | Guardar **nível de céu e de bloco** por vértice (2×4 bits) e resolver a cor no shader via lightmap → hora do dia não exige remeshing |
| Greedy meshing com luz suave | Só unir quads com textura, luz e AO idênticos nos 4 cantos; desligar greedy se causar artefato |
| Água translúcida e sombras | Água não projeta sombra opaca; no modo Shaders a água recebe sombra |
| SSR caro | SSR apenas Alto/Ultra; fallback reflexo de céu |
| TAA e pixel art | TAA pode borrar texturas 16×; aplicar nitidez pós-TAA e permitir trocar para SMAA |

---

## Apêndice A — Blocos da 1.8.9 a registrar (ID clássico : variantes)

Usar como checklist. Conferir valores de dureza/resistência/variantes com uma fonte de dados aberta da 1.8 (ex.: tabelas JSON da comunidade, licença MIT).

| ID | Bloco | Variantes / observações |
|---|---|---|
| 0 | Ar | — |
| 1 | Pedra | pedra, granito, granito polido, diorito, diorito polido, andesito, andesito polido |
| 2 | Grama | tingida; "com neve" se neve em cima |
| 3 | Terra | terra, terra grossa, podzol |
| 4 | Pedregulho | — |
| 5 | Tábuas | carvalho, abeto, bétula, selva, acácia, carvalho escuro |
| 6 | Muda | 6 madeiras |
| 7 | Bedrock | — |
| 8 / 9 | Água corrente / parada | — |
| 10 / 11 | Lava corrente / parada | — |
| 12 | Areia | areia, areia vermelha |
| 13 | Cascalho | — |
| 14 / 15 / 16 | Minério de ouro / ferro / carvão | — |
| 17 | Tronco | carvalho, abeto, bétula, selva × 3 eixos + "só casca" |
| 18 | Folhas | carvalho, abeto, bétula, selva (+ flags decaimento) |
| 19 | Esponja | seca, molhada |
| 20 | Vidro | — |
| 21 / 22 | Minério de lápis / bloco de lápis | — |
| 23 | Ejetor (dispenser) | 6 direções |
| 24 | Arenito | normal, talhado, liso |
| 25 | Bloco musical | — |
| 26 | Cama | — |
| 27 / 28 / 66 / 157 | Trilho energizado / detector / comum / ativador | — |
| 29 / 33 / 34 / 36 | Pistão grudento / pistão / cabeça / extensão | — |
| 30 | Teia | — |
| 31 | Grama alta | arbusto seco, grama, samambaia |
| 32 | Arbusto morto | — |
| 35 | Lã | 16 cores |
| 37 | Dente-de-leão | — |
| 38 | Flores | papoula, orquídea azul, alho, azure bluet, tulipas (vermelha, laranja, branca, rosa), margarida |
| 39 / 40 | Cogumelo marrom / vermelho | — |
| 41 / 42 / 57 / 133 / 152 / 173 | Blocos de ouro / ferro / diamante / esmeralda / redstone / carvão | — |
| 43 / 44 | Laje dupla / laje de pedra | pedra, arenito, (madeira antiga), pedregulho, tijolo, tijolo de pedra, tijolo do Nether, quartzo |
| 45 | Tijolos | — |
| 46 | TNT | — |
| 47 | Estante | — |
| 48 | Pedregulho musgoso | — |
| 49 | Obsidiana | — |
| 50 | Tocha | 5 posições |
| 51 | Fogo | — |
| 52 | Gerador de monstros | — |
| 53, 67, 108, 109, 114, 128, 134–136, 156, 163, 164, 180 | Escadas | carvalho, pedregulho, tijolo, tijolo de pedra, tijolo do Nether, arenito, abeto, bétula, selva, quartzo, acácia, carvalho escuro, arenito vermelho |
| 54 / 146 / 130 | Baú / baú armadilha / baú do Ender | — |
| 55 | Fio de redstone | 16 níveis (cor varia) |
| 56 | Minério de diamante | — |
| 58 | Bancada de trabalho | — |
| 59 / 141 / 142 / 115 | Trigo / cenouras / batatas / verruga do Nether | estágios de crescimento |
| 60 | Terra arada | seca/molhada (15/16 de altura) |
| 61 / 62 | Fornalha / acesa | — |
| 63 / 68 | Placa em pé / de parede | — |
| 64, 193–197 / 71 | Portas de madeira (6) / porta de ferro | — |
| 65 | Escada de mão | — |
| 69 | Alavanca | — |
| 70 / 72 / 147 / 148 | Placas de pressão (pedra, madeira, leve, pesada) | — |
| 73 / 74 | Minério de redstone / aceso | — |
| 75 / 76 | Tocha de redstone apagada / acesa | — |
| 77 / 143 | Botão de pedra / madeira | — |
| 78 / 80 | Neve (camada) / bloco de neve | — |
| 79 / 174 | Gelo / gelo compactado | — |
| 81 | Cacto | — |
| 82 / 172 / 159 | Argila / argila endurecida / argila tingida (16) | — |
| 83 | Cana-de-açúcar | — |
| 84 | Toca-discos | — |
| 85, 188–192 / 113 | Cercas de madeira (6) / cerca do Nether | — |
| 86 / 91 | Abóbora / lanterna de abóbora | — |
| 87 / 88 / 89 | Netherrack / areia das almas / glowstone | — |
| 90 | Portal do Nether | — |
| 92 | Bolo | — |
| 93 / 94 | Repetidor desligado/ligado | — |
| 95 / 160 / 102 | Vidro tingido (16) / painel tingido (16) / painel de vidro | — |
| 96 / 167 | Alçapão de madeira / de ferro | — |
| 97 | Bloco infestado | — |
| 98 | Tijolos de pedra | normal, musgoso, rachado, talhado |
| 99 / 100 | Bloco de cogumelo gigante marrom / vermelho | — |
| 101 | Barras de ferro | — |
| 103 / 104 / 105 | Melancia / caule abóbora / caule melancia | — |
| 106 | Trepadeira | — |
| 107, 183–187 | Portões (6 madeiras) | — |
| 110 | Micélio | — |
| 111 | Vitória-régia | — |
| 112 | Tijolo do Nether | — |
| 116 / 117 / 118 | Mesa de encantamento / suporte de poções / caldeirão | — |
| 119 / 120 / 121 / 122 | Portal do End / moldura / pedra do End / ovo do dragão | — |
| 123 / 124 | Lâmpada de redstone / acesa | — |
| 125 / 126 | Laje dupla de madeira / laje de madeira | 6 madeiras |
| 127 | Cacau | — |
| 129 | Minério de esmeralda | — |
| 131 / 132 | Gancho de armadilha / fio de armadilha | — |
| 137 | Bloco de comando | — |
| 138 | Sinalizador (farol) | — |
| 139 | Muro de pedregulho | normal, musgoso |
| 140 | Vaso de flor | — |
| 144 | Cabeça | — |
| 145 | Bigorna | intacta, lascada, muito danificada |
| 149 / 150 | Comparador desligado/ligado | — |
| 151 / 178 | Sensor de luz / invertido | — |
| 153 / 155 | Minério de quartzo do Nether / bloco de quartzo | liso, talhado, pilar |
| 154 | Funil | — |
| 158 | Liberador (dropper) | — |
| 161 / 162 | Folhas / tronco (acácia, carvalho escuro) | — |
| 165 | Bloco de slime | — |
| 166 | Barreira | invisível (visível no criativo segurando o item) |
| 168 / 169 | Prismarinho (normal, tijolos, escuro) / lanterna do mar | — |
| 170 | Fardo de feno | eixo |
| 171 | Tapete | 16 cores |
| 175 | Plantas altas | girassol, lilás, grama alta dupla, samambaia grande, roseira, peônia |
| 176 / 177 | Estandarte em pé / de parede | — |
| 179 / 181 / 182 | Arenito vermelho (3) / lajes de arenito vermelho | — |
