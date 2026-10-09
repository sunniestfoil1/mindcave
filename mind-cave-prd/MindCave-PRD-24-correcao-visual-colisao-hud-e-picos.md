# MIND CAVE — PRD 24
# Correção: Picos de 2–4 s, Plantas como Blocos, Jogador Preso, Iluminação Escura, HUD e Céu com o Pacote "Old Default 1.8.9"

| Campo | Valor |
|---|---|
| Tipo | **Hotfix. Aplicar inteiro, na ordem das seções.** Continua o PRD 23. |
| Evidências | (1) Relatório do monitor F12 de 07/10 14:58 (build index-DbkFzToT.js). (2) Print: terreno escuro azul-acinzentado, grama alta e flores virando cubos, jogador preso sob terra sem conseguir subir, linha de contorno gigante no céu, HUD sem as texturas do jogo. (3) Pacote enviado: **"Old Default 1.8.9"** (pack_format 1, 2.998 arquivos). |

---

## 1. Desempenho: o que melhorou e o que falta

### 1.1 Medição atual

| Medida | PRD 23 (antes) | Agora | Leitura |
|---|---|---|---|
| Quadro típico (mediana) | 840 ms | **5,6 ms (~170 FPS)** | O loop normal está ótimo |
| Pior quadro | 1.128 ms | **4.272 ms** | Ainda há **congelamentos de 2–4 s** de tempos em tempos |
| Função culpada | `loop` | `loop` (34.602 ms em 26 chamadas) | Os picos estão dentro do loop principal |
| Mensagens para workers por quadro (fase céu) | 44 | **670** | Inundação de mensagens |
| Mensagens **sem** transferência de buffer | 0 | **13.095** | Dados copiados (clonados) a cada envio |
| Memória JS | serrote 90–200 MB | **subindo até 1.090 MB** e caindo para 150 MB | Fila de mensagens/clones acumulando; coleta de lixo gigante |
| Erros | — | 6× "[MeshWorker] tarefa sem resposta em 5 s" | Workers afogados na fila de mensagens |
| Buffers WebGL criados (girando) | — | **7.350** criados / 3.913 apagados | Geometria recriada em vez de reaproveitada |

**Diagnóstico:** o loop envia centenas de mensagens por quadro aos workers, clonando dados (não transfere). Os workers não dão conta, a fila deles cresce (memória chega a 1 GB), tarefas estouram o tempo de 5 s, e o tratamento de tempo esgotado ou o processamento do lote de respostas acontece **de uma vez dentro do loop**, congelando 2–4 s.

### 1.2 Correções

**MC24-RF-001 (P0) — Teto de mensagens.** Somando todos os tipos (meshing, luz, geração, atualização de bloco, sincronização de chunk), no máximo **8 mensagens por quadro** para workers em regime e **0 parado** com tudo pronto. Atualizações de bloco do mesmo chunk no mesmo quadro viram **uma** mensagem em lote.

**MC24-RF-002 (P0) — Nunca clonar dados grandes.** Arrays de chunk/seção são enviados **uma vez** ao worker com transferência (ou memória compartilhada) e o worker guarda sua cópia (PRD 23 RF-004). Mensagens de tarefa só levam IDs e números. Meta no monitor: "noTransfer" só para mensagens pequenas (< 1 KB).

**MC24-RF-003 (P0) — Tarefa com tempo esgotado não pode travar.** Ao estourar 5 s: cancelar e reenviar **depois**, pelo agendador normal. Proibido refazer a malha na thread principal como "plano B". Proibido processar todas as respostas acumuladas no mesmo quadro: aplicar respostas com orçamento de **2 ms por quadro** (as demais ficam para os próximos).

**MC24-RF-004 (P0) — Reaproveitar geometria.** Atualizar uma seção reescreve o buffer existente (ou o bloco dela no buffer grande — PRD 21 RF-033). Meta: buffers criados ≈ 0 depois da carga inicial.

**MC24-RF-005 (P0) — Sem acúmulo.** A memória JS em 50 s de jogo fica abaixo de **400 MB** e sem subida contínua.

**Metas do monitor (rodar com a emulação de celular do DevTools DESLIGADA):** pior quadro **≤ 50 ms** em todas as fases; quadros acima de 50 ms **≤ 1 por fase**; msgs_para_workers ≤ 8; memória < 400 MB; zero erros "[MeshWorker]".

---

## 2. Plantas e blocos não-cubo (grama alta, flores, mudas)

O print mostra a grama alta e as flores desenhadas como **cubos inteiros** e o jogador colidindo com elas.

**MC24-RF-010 (P0) — Forma vem do modelo.** A forma de cada bloco vem do **modelo JSON** do pacote (pasta assets/minecraft/models/block) através do blockstate (assets/minecraft/blockstates), como o Minecraft faz:
- grama alta, samambaia, arbusto morto, flores, mudas, cogumelos, cana, teia → modelo **"cross"** (dois planos cruzados a 45°, sem sombreamento, sem oclusão ambiente). No pacote, a grama alta usa o modelo de cruz **com tinta** (tintindex 0);
- plantações → modelo "crop" (quatro planos);
- plantas de 2 blocos (double_plant_*) → metade de baixo e de cima.

**MC24-RF-011 (P0) — Sem colisão e sem esconder vizinhos.** Esses blocos: **caixa de colisão vazia** (o jogador atravessa), caixa de seleção pequena (como a 1.8), **não** escondem faces dos blocos vizinhos (não são opacos), camada de render "recorte" (alpha-teste nos pixels transparentes — a grama alta tem 93 pixels transparentes de 256), e são substituíveis ao colocar um bloco.

**MC24-RF-012 (P0) — Registro corrigido.** Revisar no registro de blocos: todo bloco com modelo não-cubo tem "sólido = não", "opaco = não", colisão própria (vazia, laje, escada, cerca etc.) e oclusão de faces conforme o modelo. O mesher e a física leem essas propriedades do registro — nunca assumem "todo bloco é cubo".

---

## 3. Colisão: jogador preso embaixo da terra

**MC24-RF-020 (P0) — Física portada, sem atalho.** Usar a física de "02-fisica/prismarine-physics" (PRD 01 §12.1) com as formas de colisão de "02-fisica/minecraft-data-1.8" (blockCollisionShapes): pulo 0,42, gravidade 0,08, degrau 0,6, colisão eixo a eixo (Y, depois X, depois Z).

**MC24-RF-021 (P0) — Nunca nascer/ficar dentro de bloco.** Ao entrar no mundo, renascer, teleportar ou após carregar o chunk sob o jogador: se a caixa do jogador intersecta um bloco sólido, procurar a posição livre mais próxima acima (até a superfície) e colocar o jogador lá. Antes do chunk existir, o jogador fica parado (não cai nem colide com "nada").

**MC24-RF-022 (P0) — Empurrar para fora (1.8).** Se o jogador estiver parcialmente dentro de um bloco sólido (ex.: um bloco colocado nele ou terreno chegando depois), aplicar o empurrão para o lado livre mais próximo como na 1.8 (0,1 bloco por tick), e o dano de sufocamento só se a **cabeça** estiver dentro de bloco opaco (PRD 05).

**MC24-RF-023 (P0) — Teste.** Jogador cercado por 1 bloco de altura consegue pular e subir; abaixo de um teto de 2 blocos não "gruda" no teto; anda por cima de grama alta e flores sem parar.

---

## 4. Iluminação e cores (mundo escuro azul-acinzentado)

**MC24-RF-030 (P0) — Luz do céu correta.** Blocos com visão do céu têm luz do céu 15 (PRD 02 RF-020). De dia (tempo 06:05 no print), superfície com brilho total. Verificar: luz calculada antes de enviar a malha; luz lida pelo shader na faixa 0–15 (não 0–1 duas vezes); lightmap dia/noite correto; sombreamento por face da 1.8 (topo 100%, norte/sul 80%, leste/oeste 60%, base 50%).

**MC24-RF-031 (P0) — Tinta de bioma obrigatória.** No pacote, **grass_top, tallgrass e leaves_* são 100% cinza**: precisam ser multiplicados pela cor do bioma lida dos mapas **colormap/grass.png** e **colormap/foliage.png** (256×256), na posição dada pela temperatura e umidade do bioma (PRD 04). A face lateral da grama = grass_side + grass_side_overlay tingido. Sem tinta, aparece cinza-azulado (como no print).

**MC24-RF-032 (P0) — Espaço de cor.** Texturas em sRGB e saída do render em sRGB, sem conversão dupla (que escurece/lava as cores).

---

## 5. Usar o pacote "Old Default 1.8.9" de verdade

O pacote enviado tem a estrutura padrão da 1.8 (assets/minecraft/…). O importador (PRD 10 RF-075) deve mapear **por estes caminhos exatos**:

### 5.1 HUD (gui/icons.png e gui/widgets.png, ambos 256×256)

| Elemento | Arquivo | Recorte (x, y, largura × altura) |
|---|---|---|
| Hotbar | gui/widgets.png | 0, 0, 182 × 22 |
| Seletor da hotbar | gui/widgets.png | 0, 22, 24 × 24 |
| Botão desativado / normal / hover | gui/widgets.png | 0, 46 / 0, 66 / 0, 86 — 200 × 20 |
| Mira | gui/icons.png | 0, 0, 15 × 15 (mistura de inversão de cor) |
| Coração: contorno / cheio / metade | gui/icons.png | 16, 0 / 52, 0 / 61, 0 — 9 × 9 |
| Coração piscando (contorno claro) | gui/icons.png | 25, 0 — 9 × 9 |
| Coração envenenado cheio / metade | gui/icons.png | 88, 0 / 97, 0 |
| Coração wither cheio / metade | gui/icons.png | 124, 0 / 133, 0 |
| Coração de absorção cheio / metade | gui/icons.png | 160, 0 / 169, 0 |
| Corações hardcore | gui/icons.png | mesma coluna, y = 45 |
| Armadura: vazia / metade / cheia | gui/icons.png | 16, 9 / 25, 9 / 34, 9 — 9 × 9 |
| Bolha de ar: cheia / estourando | gui/icons.png | 16, 18 / 25, 18 — 9 × 9 |
| Fome: contorno / cheia / metade | gui/icons.png | 16, 27 / 52, 27 / 61, 27 — 9 × 9 |
| Fome com efeito Fome: cheia / metade | gui/icons.png | 88, 27 / 97, 27 |
| Barra de XP: vazia / cheia | gui/icons.png | 0, 64 / 0, 69 — 182 × 5 |
| Ping (Tab e lista de servidores) | gui/icons.png | 0, 176 em diante, 10 × 8 por nível |

Posições na tela (1.8.9, pixels de GUI): hotbar centralizada a 22 px da base; corações à esquerda acima da hotbar (x = centro − 91, y = base − 39); fome à direita (x = centro + 91 − 9 × i, mesma linha); armadura acima dos corações; ar acima da fome; barra de XP em y = base − 29; nível de XP em verde **#80FF20** com contorno preto. Itens da hotbar com contagem em branco e sombra.

### 5.2 Telas, fontes e textos

| Uso | Arquivo |
|---|---|
| Fonte | font/ascii.png (128 × 128, grade 16 × 16 caracteres de 8 × 8; largura de cada caractere calculada pela última coluna não transparente) + font/unicode_page_XX.png para acentos quando necessário |
| Fundo de terra dos menus | gui/options_background.png |
| Logo / panorama | gui/title/minecraft.png (substituir por logo Mind Cave no mesmo estilo) / gui/title/background/panorama_0…5.png |
| Inventários | gui/container/*.png (inventory, crafting_table, furnace, generic_54, creative_inventory/*) |
| Splashes / créditos | texts/ (usar só como referência de formato; textos próprios) |

### 5.3 Céu e ambiente

| Elemento | Arquivo | Regra |
|---|---|---|
| Sol | environment/sun.png (32 × 32) | Quadrado com mistura aditiva, 30 unidades de tamanho a 100 de distância, girando com a hora |
| Lua | environment/moon_phases.png | Grade 4 × 2 (8 fases), fase = dia do mundo mod 8, tamanho 20 |
| Nuvens | environment/clouds.png | Cada pixel branco = célula de 12 × 12 blocos, altura Y 128, espessura 4 no modo Detalhado (PRD 13 RF-080) |
| Chuva / neve | environment/rain.png, environment/snow.png | Colunas em volta do jogador (PRD 05 RF-081) |
| Cor do céu e névoa | (calculadas, não textura) | Cor do céu pela temperatura do bioma e hora, névoa na mesma cor, nascer/pôr alaranjado (PRD 02 RF-040) |
| Estrelas | (geradas) | ~1.500 pontos à noite |

### 5.4 Blocos, itens, entidades, armaduras

| Uso | Caminho |
|---|---|
| Texturas de bloco | textures/blocks/*.png (382 arquivos; animação pelo .mcmeta ao lado, ex.: water_still.png = tira 16 × 512 com frametime 2) |
| Modelos e estados | models/block, models/item, blockstates (340 arquivos) |
| Mapas de cor | textures/colormap/grass.png, foliage.png |
| Itens | textures/items/*.png |
| Jogador (skin padrão) | textures/entity/steve.png (64 × 64) e alex.png |
| Mobs | textures/entity/** |
| Armaduras no corpo | textures/models/armor/*_layer_1.png e *_layer_2.png |
| Rachaduras de quebra | textures/blocks/destroy_stage_0…9.png |

**MC24-RF-040 (P0) — Importação completa e relatório.** Ao importar o .zip: ler pack.mcmeta, indexar todos os arquivos, ligar cada textura/modelo ao registro pelo nome interno da 1.8 (os mesmos nomes usados nas tabelas de "04-dados-1.8.9"), montar o array de texturas com as animações, e mostrar relatório "X vinculados / Y sem correspondência" com a lista dos não vinculados. O HUD, as telas, o céu e os blocos passam a usar o pacote **na hora**, sem recarregar.

**MC24-RF-041 (P0) — Prioridade.** Com o pacote ativo, **nenhuma** textura procedural é usada para algo que o pacote tem. O procedural só cobre o que não existe no pacote (itens do Mind Cave, armas, Studio).

---

## 6. Outros defeitos do print

- **MC24-RF-050 (P0)** Linha de contorno gigante no céu (canto superior direito): o contorno de seleção ou um ajudante de depuração está desenhado em escala/posição errada. O contorno só existe no bloco mirado, do tamanho da caixa de seleção do bloco, e some quando nada está mirado.
- **MC24-RF-051 (P0)** Mão em 1ª pessoa: braço com a skin (steve.png) e o item da hotbar, não um bloco cinza liso.
- **MC24-RF-052 (P0)** Água com a textura animada water_still/water_flow tingida pela cor de água do bioma, translúcida (PRD 02 RF-031).

---

## 7. Aceite

| Teste | Esperado |
|---|---|
| Monitor F12 (50 s, sem emulação de celular) | pior quadro ≤ 50 ms; msgs_para_workers ≤ 8; memória < 400 MB; 0 erros de MeshWorker |
| Campo de grama alta e flores | Planos cruzados tingidos de verde, atravessáveis, não escondem o chão |
| Jogador num buraco de 1 bloco | Pula e sai |
| Superfície ao meio-dia | Grama verde viva (colormap), sem tom azul-acinzentado |
| HUD | Hotbar, corações, fome, armadura e XP idênticos à 1.8.9 usando icons.png/widgets.png do pacote |
| Céu | Sol de sun.png, lua com fases, nuvens de clouds.png a Y 128 |
| Menus | Botões de widgets.png, fonte ascii.png, fundo options_background.png |
