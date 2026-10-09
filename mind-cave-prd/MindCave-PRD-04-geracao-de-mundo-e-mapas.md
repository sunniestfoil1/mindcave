# MIND CAVE — PRD 04 de 12
# Geração de Mundo 1.8.9 (Biomas, Relevo, Cavernas, Minérios, Estruturas) e os Dois Mapas

| Campo | Valor |
|---|---|
| Depende de | PRD 01 (gerador plugável, chunks, seed determinístico), PRD 02 (todos os blocos, luz, líquidos), PRD 03 (configurações) |
| Objetivo | Substituir o gerador básico por um gerador com **a mesma lógica e o mesmo "feeling" do Minecraft 1.8.9** — biomas, relevo, rios, oceanos, cavernas, ravinas, minérios na distribuição correta, árvores e vegetação por bioma, estruturas — e entregar os **dois mapas** do jogo: **Mapa 1 — Mundo Aberto** e **Mapa 2 — Mundo Plano Criativo (Laboratório)**. |
| Próximo | PRD 05 — Sobrevivência e Ciclo de Jogo |

> Documento de requisitos. Os números de distribuição e as tabelas são **valores de referência da 1.8.9**; quando houver dúvida, conferir em tabelas de dados abertas da versão 1.8 (licença MIT). A implementação **não é livre**: biomas, relevo, superfície, estruturas e decoração devem ser **portados do código de referência** (seção 0), para que o mesmo seed produza o mesmo mundo do Minecraft 1.8.9 sempre que a referência permitir.

---

## 0. Fidelidade e código de referência (obrigatório)

**MC04-RF-000 (P0) — Gerar como o Minecraft 1.8.9.** O objetivo deste PRD é que um seed digitado no Mind Cave gere **os mesmos biomas e o mesmo relevo** que esse seed gera no Minecraft Java 1.8.9. Para isso, a IA executora deve portar para TypeScript (rodando nos workers de geração) os seguintes códigos da pasta "mind-cave-codigo-referencia/01-geracao-de-mundo", preservando a matemática exatamente:

| Etapa do gerador | Código a portar | Grau de fidelidade |
|---|---|---|
| Gerador aleatório, seeds de chunk e de região | seedfinding-mc_core_java | Exato (precisa reproduzir o LCG de 48 bits do Java) |
| Ruídos (Perlin em oitavas) | seedfinding-mc_noise_java | Exato |
| Camadas de bioma da 1.8 | seedfinding-mc_biome_java (pilha de camadas da versão 1.8) | Exato — conferir com cubiomes (MC 1.8.9) |
| Relevo (densidade 3D por bioma, interpolação) | seedfinding-mc_terrain_java (gerador do Overworld para 1.8) | Exato |
| Superfície por bioma (grama, areia, mesa em faixas, neve, micélio, podzol) | seedfinding-mc_terrain_java (gerador de superfície) + glowstone-generator/ground | Exato onde a referência cobre a 1.8; o restante segue o Glowstone |
| Posição das estruturas (vila, templos, cabana de bruxa, mina, fortaleza, monumento, fortaleza do Nether) e peças da fortaleza | seedfinding-mc_feature_java (apenas estruturas que existem na 1.8.9) | Posição exata; peças conforme a referência |
| Minérios, masmorras, lagos, árvores, plantas, gelo/neve (decoração por bioma) | glowstone-generator (populators, decorators, objects) + mc_feature_java (minérios, masmorra) | Fiel às regras e números da 1.8; posições exatas não garantidas |
| Cavernas e ravinas | cuberite-cavernas-ravinas | Aproximação aberta do sistema de túneis do jogo (o código original não é aberto) |
| Superplano, Nether e End | glowstone-generator (SuperflatGenerator, NetherGenerator, TheEndGenerator) + mc_terrain_java (Nether/End) | Fiel |

Regras do porte:
- Reproduzir o gerador aleatório do Java, inteiros de 32/64 bits com estouro e conversões de ponto flutuante exatamente (nunca usar o gerador aleatório do navegador, nunca aproximar).
- Seed em texto não numérico usa o mesmo hash de texto do Java (PRD 01 RF-005).
- Os valores das tabelas deste PRD (biomas, minérios, densidades) são o **resultado esperado** e servem como teste; se o código de referência divergir de uma tabela, **vale o código de referência** e a divergência é registrada.
- As camadas de bioma e o relevo rodam em workers; o resultado de cada estágio é cacheado por chunk.

**MC04-CA-00 (P0) — Teste de fidelidade.** Para 3 seeds fixos, o bioma em 1.000 coordenadas aleatórias do Mind Cave é igual ao calculado pelo cubiomes para MC 1.8.9 (100% de acerto), e a altura do terreno em 200 colunas é igual à do gerador de referência.

## 1. Arquitetura do gerador

**MC04-RF-001 (P0) — Etapas do chunk.** Cada chunk passa por estágios, e o servidor acompanha o estágio de cada um:

| Estágio | O que faz | Precisa dos vizinhos? |
|---|---|---|
| 1. Biomas | Calcula o bioma de cada coluna (16×16) | Não |
| 2. Relevo (noise) | Densidade 3D → pedra/ar/água | Não |
| 3. Superfície | Troca topo por grama/areia/neve/etc. conforme o bioma; bedrock | Não |
| 4. Escavação | Cavernas e ravinas (podem atravessar chunks — o carver de um chunk considera "túneis" originados em chunks num raio de 8) | Não (determinístico por origem) |
| 5. Estruturas (início) | Decide quais estruturas começam/atravessam este chunk e coloca suas peças | Não (determinístico por grade) |
| 6. Decoração (populate) | Lagos, masmorras, minérios, árvores, plantas, neve/gelo | **Sim**: decora a área deslocada em +8/+8 (como o 1.8), então exige os chunks (x+1), (z+1) e (x+1,z+1) no estágio 5 |
| 7. Luz inicial | Luz do céu e de blocos calculada | Sim (bordas) |
| 8. Pronto | Pode ser enviado aos jogadores | — |

**MC04-RF-002 (P0) — Determinismo.** Seeds derivados por chunk/estágio por hash do seed do mundo + coordenadas + id do estágio (nunca depender da ordem em que os chunks foram gerados). Gerar o mesmo chunk duas vezes (em máquinas diferentes, em ordens diferentes) deve produzir bytes idênticos. Teste automatizado obrigatório (hash dos chunks 0..15 × 0..15 para 3 seeds fixos, comparado com valores salvos de referência após a primeira implementação).

**MC04-RF-003 (P0) — Performance.** Geração em workers dedicados no host. Alvo: ≤ 15 ms por chunk em média para estágios 1–5 e ≤ 10 ms para decoração. Amostrar o ruído 3D em grade grossa (ex.: células 4×8×4) e **interpolar trilinearmente**, como o 1.8 — mais rápido e produz o mesmo tipo de relevo.

**MC04-RF-004 (P0) — Registro de geradores.** Cada mapa/tipo de mundo é uma entrada no registro de geradores, com: id, nome, parâmetros, função de geração, regras de spawn de jogador, dimensões suportadas. Mundos já salvos com o gerador básico do PRD 01 continuam abrindo com ele ("Mundo Aberto (legado)").

---

## 2. Biomas

**MC04-RF-010 (P0) — Distribuição de biomas em camadas.** Gerar o mapa de biomas com uma abordagem em camadas de zoom (como a 1.8): continentes/oceanos grandes → zonas de clima (quente/temperado/frio/gelado) → biomas → variantes de colina e "M" → bordas (ex.: Selva → Borda da selva, Colinas extremas → Borda) → praias e margens → rios (sistema separado, cortando continentes) → suavização. Características obrigatórias:
- Oceanos ocupam grande parte do mundo; oceanos profundos longe da costa.
- Climas vizinhos coerentes: deserto não encosta direto em planície de gelo (inserir transição).
- Biomas de tamanho típico de 1.8 (ordem de centenas de blocos); opção **Biomas Grandes** multiplica a escala por 4.
- Rios estreitos (~5–8 blocos), contínuos, chegando ao oceano; rio congelado em biomas gelados.
- Ilha de cogumelos rara, sempre cercada de oceano.

**MC04-RF-011 (P0) — Tabela de biomas (1.8.9, referência).**
Altura base / variação controlam o relevo (valores negativos = abaixo do mar). Temperatura e umidade controlam cor de grama/folhas, neve e chuva (PRD 05).

| Bioma | Temp. | Umid. | Altura base / var. | Superfície | Vegetação principal |
|---|---|---|---|---|---|
| Oceano | 0,5 | 0,5 | −1,0 / 0,1 | cascalho/areia no fundo | — |
| Oceano profundo | 0,5 | 0,5 | −1,8 / 0,1 | cascalho | Monumentos oceânicos |
| Oceano congelado | 0,0 | 0,5 | −1,0 / 0,1 | gelo na superfície | — |
| Planícies | 0,8 | 0,4 | 0,125 / 0,05 | grama | grama alta, flores, raras árvores, vilas |
| Planícies de girassol (M) | 0,8 | 0,4 | 0,125 / 0,05 | grama | girassóis |
| Deserto | 2,0 | 0,0 | 0,125 / 0,05 | areia + arenito | cactos, arbustos mortos, templos, vilas |
| Colinas do deserto | 2,0 | 0,0 | 0,45 / 0,3 | areia | — |
| Colinas extremas | 0,2 | 0,3 | 1,0 / 0,5 | grama/pedra | abetos/carvalhos esparsos, esmeralda, traça |
| Colinas extremas+ | 0,2 | 0,3 | 1,0 / 0,5 | grama | mais árvores |
| Borda das colinas extremas | 0,2 | 0,3 | 0,8 / 0,3 | grama | — |
| Floresta | 0,7 | 0,8 | 0,1 / 0,2 | grama | carvalho, bétula, carvalho grande |
| Floresta de flores (M) | 0,7 | 0,8 | 0,1 / 0,4 | grama | muitas flores |
| Colinas da floresta | 0,7 | 0,8 | 0,45 / 0,3 | grama | — |
| Floresta de bétulas | 0,6 | 0,6 | 0,1 / 0,2 | grama | bétulas (M: bétulas altas) |
| Floresta escura (roofed) | 0,7 | 0,8 | 0,1 / 0,2 | grama | carvalho escuro 2×2, cogumelos gigantes |
| Taiga | 0,25 | 0,8 | 0,2 / 0,2 | grama | abetos, samambaias, lobos |
| Taiga fria | −0,5 | 0,4 | 0,2 / 0,2 | grama + neve | abetos, neve |
| Mega taiga | 0,3 | 0,8 | 0,2 / 0,2 | podzol, terra grossa | abetos 2×2, rochas musgosas |
| Pântano | 0,8 | 0,9 | −0,2 / 0,1 | grama escura | carvalhos com trepadeira, vitórias-régias, cabanas de bruxa, slimes |
| Rio / Rio congelado | 0,5 / 0,0 | 0,5 | −0,5 / 0,0 | areia/terra | cana |
| Planícies de gelo | 0,0 | 0,5 | 0,125 / 0,05 | neve | raros abetos |
| Picos de gelo (M) | 0,0 | 0,5 | 0,425 / 0,45 | neve | espinhos de gelo compactado |
| Montanhas de gelo | 0,0 | 0,5 | 0,45 / 0,3 | neve | — |
| Ilha de cogumelos | 0,9 | 1,0 | 0,2 / 0,3 | micélio | cogumelos gigantes, vaquinhas-cogumelo |
| Praia | 0,8 | 0,4 | 0,0 / 0,025 | areia | — |
| Praia de pedra | 0,2 | 0,3 | 0,1 / 0,8 | pedra | — |
| Praia fria | 0,05 | 0,3 | 0,0 / 0,025 | areia + neve | — |
| Selva | 0,95 | 0,9 | 0,1 / 0,2 | grama | árvores grandes de selva, arbustos, melancias, cacau, trepadeiras, templos |
| Colinas da selva | 0,95 | 0,9 | 0,45 / 0,3 | grama | — |
| Borda da selva | 0,95 | 0,8 | 0,1 / 0,2 | grama | árvores menores |
| Savana | 1,2 | 0,0 | 0,125 / 0,05 | grama | acácias, cavalos, vilas de savana |
| Planalto da savana | 1,0 | 0,0 | 1,5 / 0,025 | grama | — |
| Mesa (Badlands) | 2,0 | 0,0 | 0,1 / 0,2 | areia vermelha + faixas de argila tingida | arbustos mortos, cactos, ouro extra |
| Planalto da mesa / Planalto F | 2,0 | 0,0 | 1,5 / 0,025 | argila em faixas (F: grama/carvalhos no topo) | — |

**MC04-RF-012 (P0) — Cores de bioma.** Cor de grama e folhagem calculada pela temperatura e umidade (gradiente triangular de *colormap* gerado proceduralmente, ou o colormap de grama/folhagem do pacote de recursos importado — PRD 10), com casos fixos: pântano (grama/folhas marrom-esverdeadas escuras), floresta escura (tom mais escuro), mesa (grama/folhas amarronzadas), abeto e bétula com cor de folha fixa (abeto verde-azulado, bétula verde-amarelado). **Mistura suave** de cor entre colunas vizinhas (média em raio de 1–2 blocos, configurável em Vídeo como "Mistura de bioma": desl./3×3/5×5).

---

## 3. Relevo

**MC04-RF-020 (P0) — Densidade 3D.** Relevo gerado por campo de densidade 3D: combinação de ruídos (dois ruídos de "limite" alto/baixo + ruído seletor + ruído de profundidade/altura), modulado pela **altura base** e **variação** dos biomas (média ponderada num raio 5×5 de colunas com peso parabólico, como o 1.8, para transições suaves). Densidade > 0 = pedra; ≤ 0 = ar (ou água se Y ≤ 62). Isso produz saliências, arcos e penhascos (não apenas um heightmap 2D).

**MC04-RF-021 (P0) — Tipos de mundo do Mapa 1.**
- **Padrão:** como acima.
- **Biomas Grandes:** escala de bioma ×4.
- **Amplificado:** altura/variação de biomas positivos multiplicadas (picos até ~Y 250), terreno dramático. Aviso de desempenho.
- **Personalizado:** parâmetros expostos (seção 7.2).

**MC04-RF-022 (P0) — Superfície por bioma.** Bloco de topo e de enchimento (3–4 blocos, variando com ruído de profundidade) por bioma: grama/terra; areia/arenito (deserto: areia 3–4 + arenito por baixo); areia vermelha/argila em faixas (mesa: faixas de argila tingida laranja, amarela, branca, marrom, vermelha seguindo um padrão ondulado determinístico); neve em biomas frios (camada de neve em cima da grama, gelo sobre água parada); micélio; podzol/terra grossa (mega taiga); fundo de oceano com areia/cascalho/argila; praias de areia; praias de pedra. **Bedrock** em Y=0 e aleatoriamente Y 1–4.

---

## 4. Cavernas, ravinas e subterrâneo

**MC04-RF-030 (P0) — Cavernas (estilo 1.8, "túneis de minhoca").** Sistemas de túneis gerados a partir de pontos de origem determinísticos: cada origem lança 1+ túneis que serpenteiam (yaw/pitch variando suavemente), com raio variável (1,5–4+ blocos), bifurcações ocasionais e **salões** (esferas grandes). Raio de influência: um túnel originado até 8 chunks de distância pode escavar este chunk. Abaixo de **Y=10**, o ar das cavernas vira **lava** (camada de lava típica do 1.8). Cavernas **não** escavam através da água do oceano (pular blocos adjacentes a água) e raramente abrem na superfície (aberturas acontecem naturalmente).

**MC04-RF-031 (P0) — Ravinas.** Cortes profundos e estreitos (até ~3 por 50 chunks, raros), longos, com paredes verticais irregulares; também submarinas. Fundo com lava se abaixo de Y=10.

**MC04-RF-032 (P0) — Lagos e fontes.**
- Lagos de água na superfície (≈ 1 a cada 4 chunks, chance), lagos de lava (mais raros, maioria subterrânea; na superfície muito raros), com borda de pedra quando de lava.
- Fontes isoladas (1 bloco de água/lava em paredes de cavernas): ~50 de água e ~20 de lava por chunk como tentativa (só colocadas onde houver parede exposta com exatamente uma face aberta).

**MC04-RF-033 (P0) — Masmorras (dungeons).** ~8 tentativas por chunk; sala 7–9 × 5 × 7–9 de pedregulho e pedregulho musgoso, só válida se tiver 1–5 aberturas para cavernas; **gerador** (spawner) no centro com zumbi (50%), esqueleto (25%) ou aranha (25%); 0–2 baús com tesouro (tabela de loot — Apêndice B). O spawner funciona de verdade a partir do PRD 08.

---

## 5. Minérios e veios

**MC04-RF-040 (P0) — Distribuição (1.8.9, por chunk).**

| Bloco | Tamanho do veio | Tentativas/chunk | Faixa de Y |
|---|---|---|---|
| Terra | 33 | 10 | 0–255 |
| Cascalho | 33 | 8 | 0–255 |
| Granito | 33 | 10 | 0–79 |
| Diorito | 33 | 10 | 0–79 |
| Andesito | 33 | 10 | 0–79 |
| Carvão | 17 | 20 | 0–127 |
| Ferro | 9 | 20 | 0–63 |
| Ouro | 9 | 2 | 0–31 |
| Ouro (Mesa, extra) | 9 | 20 | 32–79 |
| Redstone | 8 | 8 | 0–15 |
| Diamante | 8 | 1 | 0–15 |
| Lápis-lazúli | 7 | 1 | distribuição triangular centrada em 16 (±16) |
| Esmeralda (Colinas extremas) | 1 bloco | 3–8 | 4–31 |
| Pedra infestada (Colinas extremas) | 9 | 7 | 0–63 |

O formato do veio é a "elipse ao longo de um segmento" clássica (veio alongado com seções esféricas), substituindo **apenas pedra**.

---

## 6. Vegetação e decoração por bioma

**MC04-RF-050 (P0) — Árvores (formas).**

| Árvore | Forma |
|---|---|
| Carvalho | Tronco 4–6, copa padrão (PRD 01) |
| Carvalho grande | Galhos em várias direções, copas esféricas espalhadas, até ~16 de altura (10% das árvores de floresta/planície) |
| Carvalho de pântano | Carvalho com copa larga, trepadeiras penduradas, pode nascer na água rasa |
| Bétula | Tronco 5–7, copa como carvalho; variante alta (floresta de bétulas M) |
| Abeto | Cônico em anéis alternados (2 tipos: "pinheiro" com copa alta e "abeto" em camadas) |
| Abeto gigante (mega taiga) | Tronco 2×2, até ~30 de altura, cobertura de podzol embaixo |
| Selva grande | Tronco 2×2 até ~30, galhos com copas, trepadeiras e cacau |
| Arbusto de selva | 1 tronco + folhas em montinho |
| Acácia | Tronco que se curva diagonalmente com 1–2 copas planas |
| Carvalho escuro | Tronco 2×2 curto, copa larga e baixa, cobre o chão (floresta escura) |
| Cogumelo gigante | Marrom (chapéu plano) e vermelho (chapéu em domo) |

Árvores só nascem em grama/terra/podzol com espaço vertical livre; respeitam a decoração deslocada +8 para cruzar bordas sem cortes.

**MC04-RF-051 (P0) — Densidades por bioma (referência).** Árvores por chunk: Floresta ~10, Selva ~50 (incluindo arbustos), Taiga ~10, Floresta escura (grade densa), Planícies ~0,05 (rara), Savana ~1, Colinas extremas ~0–1, Pântano ~2, Deserto 0. Grama alta: Planícies alta, Savana muito alta, Selva alta, Floresta média. Flores: Planícies e Floresta de flores alta. Cactos: deserto ~10 tentativas (1–3 de altura, nunca encostados em blocos), Mesa ~5. Cana-de-açúcar: ~10 tentativas ao lado de água (1–3 de altura). Abóboras: 1/32 por chunk em grupos. Melancias: selva. Vitórias-régias: pântano ~4. Cogumelos: pequenos em locais escuros e pântanos/taigas.

**MC04-RF-052 (P0) — Neve e gelo.** Na última etapa, em colunas com temperatura < 0,15 (considerando a altitude: temperatura cai com Y acima de 64 — montanhas altas ganham neve mesmo em biomas temperados, como o 1.8): água parada exposta ao céu vira gelo; superfície sólida exposta ganha camada de neve (1 camada).

---

## 7. Estruturas

**MC04-RF-060 (P0) — Estruturas da 1.8.9 a gerar.** Posicionamento por **grade com espaçamento e separação** determinísticos (como o 1.8: região de N chunks, escolhe um chunk aleatório dentro da região com margem mínima), verificação de bioma válido, e peças montadas a partir de **modelos de dados** (peças definidas como listas de blocos/“templates” procedurais, não arquivos copiados).

| Estrutura | Biomas | Espaçamento (chunks) | Conteúdo |
|---|---|---|---|
| Vila | Planícies, Deserto, Savana | 32 (sep. 8) | Casas, poço, ferreiro (baú com loot), igreja, fazendas, caminhos de cascalho (arenito no deserto, acácia na savana); **marcadores de NPC** (aldeões, golem de ferro — PRD 08) |
| Templo do deserto | Deserto, Colinas do deserto | 32 (sep. 8) | Pirâmide de arenito, câmara secreta com **armadilha de TNT** sob placa de pressão, 4 baús |
| Templo da selva | Selva | 32 (sep. 8) | Pedregulho musgoso, alavancas, armadilha com fio + ejetores com flechas, 2 baús |
| Cabana de bruxa | Pântano | 32 (sep. 8) | Palafita de abeto com caldeirão e vaso; marcador de bruxa |
| Mina abandonada | Qualquer (subterrâneo) | Chance por chunk ~0,4% de início | Corredores com suportes de madeira, trilhos, teias, **carrinhos com baú**, gerador de aranha da caverna |
| Fortaleza (stronghold) | Subterrâneo | **3 fortalezas** em anel 640–1152 blocos da origem, ângulos espaçados 120° | Corredores, biblioteca, sala do **portal do End** (12 molduras, 10% de chance cada de ter olho), gerador de traça, baús |
| Monumento oceânico | Oceano profundo | 32 (sep. 5) | Prismarinho, lanternas do mar, 8 blocos de ouro no núcleo, esponjas molhadas; marcadores de guardiões e anciões (PRD 08) |
| Fortaleza do Nether | Nether (PRD 11) | — | Registrar o gerador; ativar no PRD 11 |

**MC04-RF-061 (P0) — Baú bônus.** Opção ao criar mundo: ao nascer, um baú perto do spawn com itens iniciais (tábuas, gravetos, machado/picareta de madeira ou pedra, maçãs, pão, troncos) — tabela no Apêndice B.

**MC04-RF-062 (P0) — Marcadores de entidades e blocos de estado.** Estruturas registram **marcadores** (tipo de entidade/bloco especial + posição + dados) no chunk. Enquanto o sistema correspondente não existir (ex.: mobs antes do PRD 08), os marcadores ficam salvos e são processados quando o sistema existir — sem regenerar o mundo.

**MC04-RF-063 (P1) — Localizar estruturas.** Comando `/locate <Vila|Templo|Fortaleza|Monumento|Mina>` (extensão útil para testes; não existia no 1.8 — liberar só com `devTools`).

---

## 8. MAPA 1 — "Mundo Aberto"

**MC04-RF-070 (P0) — Definição.** Mundo infinito (limitado só pelos ±30 milhões), com todos os biomas, relevo, cavernas, minérios e estruturas deste PRD, ciclo de dia e noite, mobs (a partir do PRD 08) e sobrevivência completa (PRD 05). É o mapa "de verdade" para jogar com o amigo.

**MC04-RF-071 (P0) — Opções ao criar.**

| Opção | Valores |
|---|---|
| Tipo de mundo | Padrão / Biomas Grandes / Amplificado / Personalizado |
| Gerar estruturas | Sim/Não |
| Baú bônus | Sim/Não |
| Modo de jogo | Sobrevivência / Criativo / Aventura / Hardcore (Hardcore = Sobrevivência difícil + mundo é excluído/trancado em espectador ao morrer — PRD 05) |
| Permitir comandos | Sim/Não |
| Seed | Texto |

**MC04-RF-072 (P0) — Personalizado.** Tela com sliders/inputs (com pré-visualização do mapa de biomas — RF-074) e predefinições salvas como texto/JSON compartilhável. Parâmetros mínimos: nível do mar (1–255), escala do relevo horizontal/vertical, profundidade/altura base, cavernas (liga/densidade), ravinas (liga), masmorras (liga/tentativas), lagos de água/lava (liga/raridade), estruturas individuais (liga cada), oceanos de lava (troca água por lava), tamanho de bioma (1–8), tamanho de rio (1–5), bioma único (escolher um bioma para o mundo todo), tabela de minérios editável (tamanho, tentativas, Y mín/máx para cada minério e pedra).

**MC04-RF-073 (P0) — Spawn.** Ponto de spawn procurado perto de (0,0) dentro de biomas "de spawn" (Floresta, Planícies, Taiga, Colinas da taiga, Colinas da floresta, Selva, Colinas da selva) em superfície de grama; se não encontrar em 256 blocos, usar o melhor ponto seco.

**MC04-RF-074 (P1) — Pré-visualização de seed.** Na tela de criação, um minimapa 2D gerado em background mostrando biomas (cores por bioma) e oceanos numa área de ~2048×2048 blocos em volta do spawn, com marcadores de vilas/templos. Atualiza ao mudar o seed ou o tipo.

---

## 9. MAPA 2 — "Mundo Plano Criativo (Laboratório)"

> Interpretação adotada: o segundo mapa é o **ambiente de desenvolvimento e testes** dos dois devs — plano, previsível, criativo por padrão, com áreas de teste prontas para validar blocos, assets GLB enviados, mobs, armas, redstone e luz. É também um mapa **superplano** clássico configurável (como o 1.8), para construir livremente.

**MC04-RF-080 (P0) — Superplano configurável.** Camadas definidas por lista (de baixo para cima) no formato texto compartilhável compatível com o conceito do 1.8 ("versão;camadas;bioma;estruturas"), ex.: `3;minecraft:bedrock,2*minecraft:dirt,minecraft:grass;1;village`. Predefinições:

| Predefinição | Camadas |
|---|---|
| Clássico plano | bedrock, 2 terra, grama (Planícies) |
| Sonho do minerador | bedrock, 230 pedra, 5 terra, grama (com cavernas e minérios) |
| Mundo d'água | bedrock, 5 pedra, 5 terra, 5 areia, 90 água |
| Laboratório Mind Cave (padrão) | bedrock, 3 pedra, 1 tijolos de pedra (chão de laboratório) + grade de linhas a cada 16 blocos em pedra polida diferente (marcação de chunk) |
| Vazio | 1 bloco de pedra no spawn, nada mais |

**MC04-RF-081 (P0) — Áreas de teste do Laboratório** (geradas automaticamente perto do spawn quando a predefinição "Laboratório Mind Cave" é usada; cada área tem uma **placa** com o nome e um bloco de luz). Layout em volta do spawn (0,0):

| Área | Posição aproximada | Conteúdo |
|---|---|---|
| **Praça central** | 0,0 | Ponto de spawn, placas indicando as direções |
| **Galeria de blocos** | Norte (z −20 a −80) | Todos os blocos do registro em grade, um por pedestal, em ordem de ID, com placa (ID:meta + nome). Atualiza automaticamente quando blocos novos são registrados (regenerar a galeria com um botão/comando `/lab rebuild`) |
| **Vitrine de assets** | Nordeste | Pedestais girando cada **item** registrado e cada **modelo GLB** vinculado (PRD 10), com iluminação de estúdio e fundo neutro; botão "abrir no Studio" ao interagir |
| **Arena de mobs** | Leste | Cercado 32×32 com portões, salas separadas por tipo, painel de botões para spawnar cada mob (funciona a partir do PRD 08) e "matar todos" |
| **Estande de tiro** | Sul | Pista de 100 blocos com alvos a 10/25/50/100 blocos, bonecos que mostram o dano recebido em números flutuantes (PRD 07/09) |
| **Sandbox de redstone** | Oeste | Placa grande lisa + kit de componentes em baús (PRD 11) |
| **Sala de luz** | Noroeste | Sala escura fechada com fontes de luz de cada nível para validar iluminação e shaders; janela com visão do céu |
| **Piscinas de líquidos** | Sudoeste | Piscina de água, poço de lava, cascata, área para testar fonte infinita |
| **Pista de física** | Sudeste | Obstáculos com degraus de 0,5 e 1, vãos de 1–5 blocos, escadas, escadas de mão, gelo, areia da alma, teias, blocos de slime |

**MC04-RF-082 (P0) — Padrões do Laboratório.** Criativo; `doDaylightCycle=false` com hora fixa ao meio-dia; `doMobSpawning=false`; `doWeatherCycle` desligado (PRD 05); clima limpo; PvP desligado. Tudo alterável pelo host.

**MC04-RF-083 (P1) — Comandos de laboratório** (com `devTools`): `/lab rebuild [área]`, `/lab clear [raio]`, `/lab tp <área>`, `/fill x1 y1 z1 x2 y2 z2 <bloco>` (até 32.768 blocos), `/clone` (P2).

---

## 10. Persistência e compatibilidade

- **MC04-RF-090 (P0)** O mundo guarda `generatorId`, `generatorVersion` e parâmetros. Mudanças futuras no gerador **não** podem alterar chunks já gerados de mundos existentes: chunks nunca modificados são regenerados com a versão do gerador do mundo; se uma versão antiga for removida, avisar e oferecer "converter" (gerar com a nova versão apenas chunks novos — haverá "cortes" nas bordas, o que é aceitável e documentado).
- **MC04-RF-091 (P0)** O baú bônus e as estruturas com tesouro registram estado (aberto/saqueado) como blocos com dados, salvos normalmente.

---

## 11. Requisitos não funcionais

- **MC04-RNF-001 (P0)** Spawn pronto (área 11×11 chunks gerada e iluminada) em < 8 s num PC médio.
- **MC04-RNF-002 (P0)** Voando no criativo a 21 blocos/s em linha reta com distância 8, o terreno à frente aparece sem "buracos" por mais de 1 s.
- **MC04-RNF-003 (P0)** Uso de memória dos workers de geração limitado (cache de ruído com LRU).
- **MC04-RNF-004 (P0)** Teste de determinismo (RF-002) integrado e executável por comando de debug.

---

## 12. Critérios de aceite

- **MC04-CA-01** Explorando 5.000 blocos em várias direções, encontram-se pelo menos: 10 biomas diferentes, rio contínuo até um oceano, uma vila, um templo do deserto ou da selva, cavernas grandes com lava abaixo de Y=10.
- **MC04-CA-02** Minerando em Y=11–12 por 200 blocos de túnel, aparecem diamantes, redstone, ouro, ferro e carvão em proporções coerentes com a tabela.
- **MC04-CA-03** Árvores grandes cruzam bordas de chunk sem corte.
- **MC04-CA-04** O mesmo seed gera o mesmo mundo para os dois jogadores (comparação de hashes de chunk).
- **MC04-CA-05** Mapa 2 com predefinição Laboratório gera todas as áreas da tabela RF-081, com placas, e a Galeria de blocos contém todos os blocos do registro.
- **MC04-CA-06** Superplano com texto de predefinição personalizado gera exatamente as camadas pedidas.
- **MC04-CA-07** Neve aparece no topo de montanhas altas em biomas temperados e gelo cobre lagos em biomas gelados.
- **MC04-CA-08** Masmorras têm spawner e baús; o loot respeita o Apêndice B.

---

## Apêndice A — Biomas de spawn e cores de referência (para o minimapa)
Use uma paleta própria e distinguível por bioma (ex.: oceano azul-escuro, planícies verde-claro, deserto areia, floresta verde-escuro, taiga verde-azulado, pântano verde-oliva, selva verde-vivo, savana amarelo-esverdeado, mesa laranja-terra, gelo branco-azulado, cogumelo roxo, colinas extremas cinza-esverdeado, rio azul-claro, praia bege).

## Apêndice B — Tabelas de loot (resumo; refinar no PRD 06)

| Origem | Itens possíveis (quantidade) |
|---|---|
| Masmorra | Sela, maçã dourada (rara), maçã dourada encantada (muito rara), disco de música, livro com nome, lingotes de ferro (1–4), lingotes de ouro (1–4), pão, trigo (1–4), balde, pó de redstone (1–4), carvão (1–4), sementes de melancia/abóbora (2–4), armadura de cavalo (ferro/ouro/diamante), livro encantado, pólvora (1–4), osso (1–8), carne podre (1–8), linha (1–8) |
| Templo do deserto | Diamante (1–3), lingote de ferro (1–5), lingote de ouro (2–7), esmeralda (1–3), osso (4–6), olho de aranha (1–3), carne podre (3–7), sela, armaduras de cavalo, livro encantado, maçã dourada |
| Templo da selva | Diamante (1–3), lingote de ferro (1–5), lingote de ouro (2–7), esmeralda (1–3), osso (4–6), carne podre (3–7), sela, armaduras de cavalo, livro encantado |
| Mina abandonada | Lingote de ferro (1–5), lingote de ouro (1–3), redstone (4–9), lápis (4–9), diamante (1–2), carvão (3–8), pão (1–3), picareta de ferro, trilhos (4–8), trilhos energizados/detectores/ativadores (1–4), sementes, sela, livro encantado |
| Ferreiro da vila | Diamante (1–3), ferro (1–5), ouro (1–3), pão (1–3), maçã (1–3), picareta/espada de ferro, armadura de ferro, obsidiana (3–7), muda de carvalho (3–7), sela, armaduras de cavalo |
| Fortaleza (corredor/biblioteca) | Pérolas do Ender, diamantes, ferro, ouro, redstone, pão, maçãs, picareta/espada de ferro, armaduras de ferro, maçã dourada, sela, armaduras de cavalo; biblioteca: livros, papel, mapas vazios, bússola, livros encantados |
| Baú bônus | Gravetos (1–12), tábuas (1–12), troncos (1–3), machado e picareta de madeira ou pedra, maçãs (1–2), pão (1–2), salmão/bacalhau cru (1–2) |
