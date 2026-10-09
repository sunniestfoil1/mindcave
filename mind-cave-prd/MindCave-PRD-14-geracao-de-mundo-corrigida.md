# MIND CAVE — PRD 14
# Geração de Mundo Corrigida: o Pipeline Exato do Minecraft 1.8.9, Seeds por Chunk, Decoração no Lugar Certo e Ferramentas de Verificação

| Campo | Valor |
|---|---|
| Depende de | PRD 13 (formato numérico de chunk e render por seções) e PRD 04 (biomas, tabelas e os dois mapas) |
| Tipo | **PRD corretivo e prioritário.** Substitui a implementação atual do gerador. Onde contradizer o PRD 04, **vale este PRD**; as tabelas do PRD 04 continuam como resultado esperado. |
| Objetivo | Fazer o Mundo Aberto ser gerado **na mesma ordem, com as mesmas seeds e as mesmas fórmulas do gerador do Minecraft 1.8.9**: relevo com colinas, montanhas, oceanos e rios; superfície por bioma; cavernas; estruturas; e árvores/plantas/minérios espalhados de forma natural, **apoiados no chão** — nunca em grade, nunca flutuando. E dar aos devs ferramentas para enxergar e conferir cada etapa. |

> Documento de requisitos. O código a portar está em "mind-cave-codigo-referencia/01-geracao-de-mundo" (tabela da seção 9). Valores marcados como "1.8" são os padrões do gerador da 1.8.9.

---

## 0. Diagnóstico da build atual (print enviado)

| Sintoma | Causa provável | Correção |
|---|---|---|
| Terreno **plano**, sem colinas, oceanos nem rios | O campo de densidade/ruído não está sendo usado, ou a altura do bioma é constante | Seções 2 e 3 |
| Árvores em **grade/espiral regular** | O aleatório da decoração não é derivado do seed do mundo + coordenadas do chunk (usa a mesma sequência em todo chunk, um contador global ou um "hash" com padrão) | Seção 1 |
| Árvores **flutuando** | A árvore é colocada numa altura fixa ou antes do terreno existir, em vez de no bloco mais alto do chão daquela coluna | Seções 5 e 6 |
| Mundo "sem sentido" | Etapas fora de ordem, sem biomas reais e sem as regras de onde cada coisa pode nascer | Seções 2 a 7 |

**MC14-RF-000 (P0) — Recomeçar o gerador.** A implementação atual do gerador do Mundo Aberto é descartada e refeita com o pipeline deste PRD. Mundos de teste criados com o gerador antigo podem ser apagados (ou abertos com o rótulo "legado").

---

## 1. Aleatoriedade igual à do Minecraft

**MC14-RF-001 (P0) — Gerador aleatório do Java.** Toda a geração usa um gerador idêntico ao `java.util.Random` (congruencial linear de 48 bits: multiplicador 0x5DEECE66D, incremento 11, com as mesmas funções de próximo inteiro, inteiro limitado, longo, double, float e booleano). Precisa ser bit a bit igual (usar inteiros de 64 bits — BigInt — ou aritmética exata equivalente). Proibido usar o aleatório do navegador em qualquer parte da geração.

**MC14-RF-002 (P0) — Seed do chunk para o relevo (1.8).** Antes de gerar o terreno de um chunk (cx, cz), o aleatório recebe o seed: **cx × 341873128712 + cz × 132897987541** (aritmética de 64 bits com estouro, como o Java). Esse aleatório é usado para bedrock e para a profundidade da superfície.

**MC14-RF-003 (P0) — Seed de decoração do chunk (1.8).** Para decorar o chunk (cx, cz):
1. iniciar o aleatório com o seed do mundo;
2. sortear A = (próximo longo ÷ 2) × 2 + 1 e B = (próximo longo ÷ 2) × 2 + 1 (divisão inteira; o resultado é sempre ímpar);
3. reiniciar o aleatório com o seed (cx × A + cz × B) XOR seed do mundo.
Toda a decoração daquele chunk (lagos, masmorras, minérios, árvores, flores, grama, cana, abóboras, cactos, fontes) consome esse mesmo aleatório **na ordem da seção 6**. É isso que faz cada chunk ter posições diferentes e naturais — e o mesmo seed sempre dar o mesmo resultado.

**MC14-RF-004 (P0) — Seed em texto.** Seed digitado como número usa o número (64 bits). Texto não numérico usa o hash de texto do Java (resultado de 32 bits). Vazio = número aleatório de 64 bits sorteado uma vez e salvo.

---

## 2. Biomas (camadas da 1.8)

**MC14-RF-010 (P0) — Pilha de camadas exata.** O bioma de cada coluna vem da pilha de camadas da 1.8 (ilhas/continentes → zoom → adicionar ilhas → remover oceano excessivo → neve/clima → bordas de clima → zoom → ilha de cogumelos → oceano profundo → bioma → zoom → bordas de bioma → colinas e variantes "M" → rios (ramo separado) → zoom → praias e bordas → suavização → mistura de rio → Voronoi para a resolução de 1 bloco), portada de "seedfinding-mc_biome_java" (versão 1.8) com conferência pelo **cubiomes** em MC 1.8.9.

**MC14-RF-011 (P0) — Duas resoluções.** O relevo usa os biomas em resolução de **1 a cada 4 blocos** (grade 10×10 cobrindo o chunk e a borda, para a média ponderada); a superfície, a decoração e as cores usam a resolução de **1 bloco** (após o Voronoi). Ambas vêm da mesma pilha.

**MC14-RF-012 (P0) — Biomas Grandes.** Mesma pilha com 2 zooms extras (tamanho ×4), como a opção da 1.8.

---

## 3. Relevo (densidade 3D da 1.8)

**MC14-RF-020 (P0) — Grade de densidade.** Para cada chunk, calcular a densidade numa grade de **5 × 33 × 5** pontos (um ponto a cada 4 blocos em X e Z e a cada 8 blocos em Y) e **interpolar trilinearmente** para os 16 × 256 × 16 blocos. Densidade > 0 = pedra; caso contrário, ar — e ar abaixo de Y = 63 vira **água** (em biomas gelados, a camada de cima vira gelo na etapa de neve).

**MC14-RF-021 (P0) — Ruídos.** Seis geradores de ruído em oitavas, todos criados a partir do aleatório iniciado com o seed do mundo, na mesma ordem da 1.8: limite mínimo (16 oitavas), limite máximo (16 oitavas), ruído principal/seletor (8 oitavas), ruído de superfície (4 oitavas), ruído de escala (10 oitavas, sem uso no relevo) e ruído de profundidade (16 oitavas). A ordem de criação importa, porque cada um consome o aleatório.

**MC14-RF-022 (P0) — Parâmetros padrão da 1.8 (mundo Padrão).**

| Parâmetro | Valor |
|---|---|
| Escala de coordenadas | 684,412 |
| Escala de altura | 684,412 |
| Escala do ruído principal X / Y / Z | 80 / 160 / 80 |
| Escala do ruído de profundidade X / Z | 200 / 200 |
| Expoente do ruído de profundidade | 0,5 |
| Tamanho base | 8,5 |
| Esticamento em Y | 12 |
| Escala do limite inferior / superior | 512 / 512 |
| Peso / deslocamento da profundidade do bioma | 1 / 0 |
| Peso / deslocamento da escala do bioma | 1 / 0 |
| Nível do mar | 63 |

Esses são exatamente os valores que a tela "Personalizado" (PRD 04 RF-072) expõe e altera.

**MC14-RF-023 (P0) — Influência dos biomas.** Em cada ponto da grade, a altura base e a variação usadas são a **média ponderada dos biomas num quadrado de 5×5** pontos em volta, com peso parabólico (maior no centro, 10 ÷ raiz(distância² + 0,2)) e peso **reduzido à metade** quando o bioma vizinho é mais alto que o do centro. Isso cria transições suaves entre planície, colina, montanha e oceano. Valores de altura/variação por bioma: tabela do PRD 04 RF-011.

**MC14-RF-024 (P0) — Referência.** Portar o gerador de relevo do Overworld para 1.8 de "seedfinding-mc_terrain_java" e os ruídos de "seedfinding-mc_noise_java". Resultado esperado: o mesmo seed dá a mesma altura de terreno do Minecraft 1.8.9.

---

## 4. Superfície por bioma

**MC14-RF-030 (P0) — Substituição da superfície (1.8).** Para cada coluna, de cima para baixo:
- Profundidade da superfície = parte inteira de (ruído de superfície ÷ 3 + 3 + aleatório × 0,25).
- Primeiros blocos sólidos: bloco de **topo** do bioma (grama, areia, micélio, neve…) e depois a camada de **enchimento** (terra, areia, arenito…) com a profundidade calculada.
- Abaixo do nível do mar, o topo vira o enchimento (terra/areia/cascalho no fundo do mar).
- Deserto e praias: areia por cima e arenito logo abaixo da camada de areia.
- Mesa: faixas de argila tingida na sequência fixa gerada pelo seed; Colinas extremas com pedra exposta; Mega taiga com podzol e terra grossa; Pântano com poças rasas (comportamento da 1.8 pela referência).
- **Bedrock:** em cada coluna, para Y de 0 a 4, coloca bedrock se Y ≤ (aleatório inteiro de 0 a 4) — o padrão irregular clássico.

**MC14-RF-031 (P0) — Referência.** Gerador de superfície de "seedfinding-mc_terrain_java" e os geradores de solo de "glowstone-generator/ground" (mesa, nevado, arenoso, rochoso, micélio).

---

## 5. Escavação: cavernas e ravinas

**MC14-RF-040 (P0) — Ordem.** Logo após a superfície, antes de qualquer decoração: **cavernas**, depois **ravinas**. Cada chunk considera túneis que nascem em chunks num raio de 8, usando um aleatório derivado do seed do mundo e das coordenadas do chunk de origem (assim um túnel atravessa vários chunks sem cortes).

**MC14-RF-041 (P0) — Regras.** Túneis serpenteantes com salões, raio variável; abaixo de **Y = 10**, o espaço escavado vira lava; nunca abrir buraco através de água (oceanos e rios não "vazam" para as cavernas); grama/terra exposta pela escavação na superfície é mantida coerente (topo vira grama se estava sob grama). Referência: "cuberite-cavernas-ravinas" (aproximação aberta) com os parâmetros ajustados para a densidade de cavernas da 1.8.

---

## 6. Decoração (populate) — onde estava o erro das árvores

**MC14-RF-050 (P0) — Decoração com vizinhos prontos.** Um chunk só é decorado quando ele **e** os chunks (cx+1, cz), (cx, cz+1) e (cx+1, cz+1) já têm relevo, superfície e escavação. A decoração do chunk (cx, cz) acontece na área **deslocada em +8 blocos** em X e Z (do meio deste chunk ao meio dos vizinhos), exatamente como a 1.8. Assim árvores e lagos nas bordas não são cortados.

**MC14-RF-051 (P0) — Ordem exata da decoração (1.8).** Com o aleatório da RF-003, nesta ordem:
1. Estruturas que passam pelo chunk (minas, vilas, fortaleza, templos, monumento) colocam suas peças.
2. **Lago de água:** se o bioma não for deserto e não houver vila, chance 1 em 4.
3. **Lago de lava:** chance 1 em 8 de tentar; altura sorteada com viés para baixo; na superfície só com chance extra pequena.
4. **Masmorras:** 8 tentativas.
5. **Decorador do bioma**, na ordem: minérios (terra, cascalho, granito, diorito, andesito, carvão, ferro, ouro, redstone, diamante, lápis — PRD 04 RF-040), discos de areia, argila e cascalho no fundo d'água, **árvores**, cogumelos gigantes, flores, grama alta, arbustos mortos, vitórias-régias, cogumelos, cana-de-açúcar, abóboras, cactos, fontes de água (50 tentativas) e de lava (20 tentativas).
6. **Animais iniciais** do bioma (PRD 08 RF-011).
7. **Neve e gelo:** em toda coluna da área decorada, gelo na água exposta e neve no chão exposto onde a temperatura (ajustada pela altura) for baixa.

**MC14-RF-052 (P0) — Árvores no chão, sempre.** Para cada árvore: sortear X e Z dentro da área decorada; **Y = altura do terreno naquela coluna** (o primeiro bloco livre acima do bloco sólido mais alto, usando o mapa de altura atualizado). A árvore só é colocada se o bloco de baixo for grama, terra ou podzol (ou o que a espécie aceitar) e houver espaço livre para o tronco e a copa; senão, a tentativa é descartada (não procurar outro lugar). O bloco de baixo do tronco vira terra. Quantidade por chunk = valor do bioma + 1 extra com chance de 1 em 10; espécie sorteada pela regra do bioma (ex.: floresta com carvalho, bétula e carvalho grande; taiga com abetos; selva com árvores grandes e arbustos). Referência: decoradores e objetos de árvore de "glowstone-generator" (TreeDecorator e objects/trees).

**MC14-RF-053 (P0) — Mesma regra para tudo que nasce no chão.** Flores, grama alta, cogumelos, abóboras, cactos, cana, arbustos e vitórias-régias usam a altura do terreno da coluna e checam o bloco de baixo e a luz (cogumelos no escuro, cana ao lado d'água, cacto só na areia sem vizinhos, vitória-régia sobre água). Nada é colocado no ar.

**MC14-RF-054 (P0) — Minérios.** Veios com o formato clássico (elipse ao longo de um segmento), substituindo **somente pedra**, nas quantidades e alturas da tabela do PRD 04 RF-040, sorteados com o aleatório da decoração. Referência: decoradores de minério de "seedfinding-mc_feature_java" e "glowstone-generator/populators".

**MC14-RF-055 (P0) — Estruturas.** Posições pela regra de grade da 1.8 (região, espaçamento, separação e seed específico de cada estrutura), portadas de "seedfinding-mc_feature_java", usando só as estruturas que existem na 1.8.9 (vila, templo do deserto, templo da selva, cabana de bruxa, mina, fortaleza, monumento oceânico; no Nether, a fortaleza).

---

## 7. Luz inicial e pronto para envio

**MC14-RF-060 (P0)** Após a decoração, calcular o mapa de altura final e a luz do céu (15 acima do terreno, propagada para dentro de cavernas abertas) e a luz de blocos emissores gerados (lava, etc.). Só então o chunk é marcado como pronto e pode ser enviado (PRD 13 seção 6).

---

## 8. Ferramentas de verificação (dev)

**MC14-RF-070 (P0) — Visualizador de geração.** Painel no Studio (e atalho F3+W com `devTools`) com:
- **Mapa 2D** ao redor do jogador (até 2.048 blocos): bioma, altura do terreno, oceanos/rios, estruturas, chunks de slime; clicar teleporta.
- **Etapas liga/desliga** para regenerar a área visível só até uma etapa: só relevo → + superfície → + cavernas → + decoração → + luz. Mostra onde está o erro.
- **Inspeção de chunk:** coordenadas, seed de relevo e seed de decoração calculados (RF-002/003), biomas presentes, contagem de árvores/minérios por tipo, tempo de cada etapa.
- **Regenerar chunk** (`/regen` com `devTools`) e "regenerar área" sem afetar construções em chunks modificados.

**MC14-RF-071 (P0) — Comparação com a referência.** Comando de dev que, para o seed atual, compara biomas e altura do terreno do Mind Cave com os calculados pelo código de referência portado (cubiomes para biomas 1.8.9) e mostra a porcentagem de acerto e as coordenadas divergentes.

**MC14-RF-072 (P0) — Testes automáticos de sanidade.** Em 100 chunks gerados com 3 seeds:
- nenhum tronco de árvore com ar embaixo (zero árvores flutuando);
- nenhuma flor/grama alta/cogumelo/cana/cacto com ar embaixo;
- as posições das árvores **não se repetem** entre chunks (nenhum par de chunks com o mesmo padrão de posições relativas);
- variação de altura do terreno coerente (planície varia poucos blocos; colinas extremas variam dezenas);
- água só abaixo de Y = 63 (exceto lagos e fontes);
- bedrock só entre Y = 0 e 4 e sempre presente em Y = 0.

---

## 9. Código de referência (o que portar)

| Etapa | Pasta em "01-geracao-de-mundo" |
|---|---|
| Aleatório do Java, seeds de chunk | seedfinding-mc_core_java |
| Ruídos em oitavas | seedfinding-mc_noise_java |
| Biomas 1.8 | seedfinding-mc_biome_java (conferir com cubiomes) |
| Relevo e superfície 1.8 | seedfinding-mc_terrain_java + glowstone-generator/ground |
| Cavernas e ravinas | cuberite-cavernas-ravinas |
| Decoração por bioma, árvores, plantas, lagos | glowstone-generator (populators, decorators, objects) |
| Minérios, masmorras, estruturas | seedfinding-mc_feature_java |
| Superplano (Mapa 2), Nether, End | glowstone-generator |

A IA deve **traduzir** esses algoritmos (Java/C) para TypeScript mantendo números, ordem de chamadas ao aleatório e aritmética inteira idênticos. Não simplificar, não trocar por outro ruído.

---

## 10. Mapa 2 (Laboratório) — conferência

**MC14-RF-080 (P0)** O superplano do Laboratório usa só as camadas configuradas (PRD 04 RF-080), **sem árvores, sem cavernas, sem decoração** (a não ser que a predefinição peça), com as áreas de teste do PRD 04 RF-081. É o lugar para testar o render do PRD 13 isolado da geração.

---

## 11. Desempenho

- **MC14-RNF-001 (P0)** Relevo + superfície + escavação ≤ 15 ms por chunk em worker; decoração ≤ 10 ms.
- **MC14-RNF-002 (P0)** Ruídos calculados só nos 5×33×5 pontos e interpolados (nunca ruído 3D por bloco).
- **MC14-RNF-003 (P0)** Biomas e ruídos com cache por região (LRU) nos workers.
- **MC14-RNF-004 (P0)** Spawn pronto (11×11 chunks gerados, decorados, iluminados e com malha) em ≤ 8 s.

---

## 12. Critérios de aceite

- **MC14-CA-01** Um mundo novo mostra colinas, vales, montanhas, oceanos com praias, rios contínuos e florestas com árvores espalhadas naturalmente — visualmente parecido com um mundo da 1.8.9.
- **MC14-CA-02** Zero árvores ou plantas flutuando (teste automático RF-072 e inspeção visual voando 2.000 blocos).
- **MC14-CA-03** Nenhum padrão de grade ou espiral na posição das árvores.
- **MC14-CA-04** Para 3 seeds, os biomas batem 100% com a referência (cubiomes 1.8.9) em 1.000 pontos e a altura do terreno bate com a referência portada em 200 colunas.
- **MC14-CA-05** O mesmo seed gera exatamente o mesmo mundo nos computadores dos dois jogadores e a cada recriação.
- **MC14-CA-06** O visualizador de geração mostra cada etapa e permite regenerar só até uma etapa.
- **MC14-CA-07** Cavernas com lava abaixo de Y = 10 e ravinas aparecem em ~5.000 blocos de exploração; oceanos não vazam para as cavernas.
