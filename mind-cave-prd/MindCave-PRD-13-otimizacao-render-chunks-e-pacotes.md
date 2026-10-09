# MIND CAVE — PRD 13
# Otimização Total: Mundo em Números, Renderização por Seções (como o Minecraft), Texturas, Culling e Pacotes de Rede

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–12 já aplicados |
| Tipo | **PRD corretivo e prioritário.** Onde este documento contradizer a implementação atual ou um PRD anterior sobre render, armazenamento de chunks, texturas ou envio de chunks/entidades pela rede, **vale este PRD**. |
| Objetivo | Fazer o jogo armazenar e desenhar o mundo **do mesmo jeito que o Minecraft 1.8.9**: o mundo é uma grade de **números** (IDs de bloco) em arrays compactos; a tela desenha **uma malha por seção de 16×16×16** construída em segundo plano, só com as faces visíveis, com texturas corretas; e a rede envia chunks e entidades no **formato e no ritmo de pacotes do Minecraft**. Resultado: jogo leve, chão texturizado e sem linhas, FPS alto. |
| Próximo | PRD 14 — Geração de Mundo Corrigida |

> Documento de requisitos. Descreve o que o sistema final precisa fazer e os números que precisa atingir. O código de referência para portar está em "mind-cave-codigo-referencia/10-otimizacao-chunks-e-pacotes" e "09-renderizacao-e-meshing".

---

## 0. Diagnóstico da build atual (a partir do print enviado)

| Sintoma visto | Causa mais provável | Correção exigida (seção) |
|---|---|---|
| Jogo **muito pesado** | Cada bloco existe como objeto/malha própria (ou um cubo instanciado por bloco), inclusive blocos enterrados que ninguém vê; milhares de draw calls; geometria refeita na thread principal | Seções 1, 2 e 3 |
| Chão **branco/azulado com linhas de grade** em todo bloco | Texturas não aplicadas (atlas não carregado antes do meshing, UV errado, cor ou espaço de cor errado) + bordas desenhadas em cada cubo (linhas/contorno por bloco ou faces vizinhas duplicadas com z-fighting e vãos entre cubos) | Seções 2.4 e 4 |
| Tudo parece "solto", sem a lógica de números do Minecraft | O mundo não é guardado como arrays de IDs por seção, e sim como lista de objetos | Seção 1 |
| **Nuvens** formando um teto baixo e gigante | Nuvens fora de escala e de altura | Seção 4.5 |
| **Partículas roxas** espalhadas pelo céu | Emissor de partículas de portal/ambiente ativo sem motivo | Seção 4.5 |
| Árvores em grade e flutuando, terreno plano | Geração de mundo | PRD 14 |

**MC13-RF-000 (P0) — Remoção do caminho antigo.** Todo código que cria um objeto 3D, uma malha, um cubo instanciado, um contorno ou uma linha **por bloco** deve ser removido. O único jeito permitido de desenhar terreno é o pipeline de seções deste PRD. O contorno preto existe **apenas** no bloco mirado (PRD 01 RF-040).

---

## 1. O mundo como números (armazenamento igual ao Minecraft 1.8)

**MC13-RF-001 (P0) — Estado de bloco numérico.** Cada posição do mundo guarda **um número de 16 bits**: o estado do bloco, formado pelo ID do bloco (0–4095) e o metadado (0–15), exatamente como na 1.8 (estado = ID × 16 + meta). Ar = 0. Nenhuma posição guarda objeto, string ou referência — só o número. Nome, textura, dureza e forma vêm do **registro**, consultado pelo número.

**MC13-RF-002 (P0) — Seção (16×16×16).** Cada seção guarda:
- **Blocos:** um array tipado de **4.096 inteiros de 16 bits** (um por posição), indexado pela posição: Y vezes 256, mais Z vezes 16, mais X (mesma ordem da 1.8).
- **Luz de bloco** e **luz do céu:** dois arrays de **2.048 bytes** cada (4 bits por posição, dois valores por byte — "nibble arrays").
- **Contadores:** quantidade de blocos não-ar e quantidade de blocos que recebem tick aleatório (para pular seções vazias ou inertes rapidamente).
Seção inteira de ar **não existe** (não aloca nada).

**MC13-RF-003 (P0) — Coluna (chunk) 16×256×16.** Até 16 seções + **mapa de altura** (256 valores: o Y do bloco opaco mais alto de cada coluna) + **biomas** (256 bytes) + lista de blocos com dados extras (baús, placas, fornalhas) + lista de entidades. O mundo carregado é um mapa de colunas indexado por uma **chave numérica** derivada de (cx, cz) — nunca por texto montado a cada consulta.

**MC13-RF-004 (P0) — Acesso rápido.** Ler/gravar um bloco por coordenada do mundo é O(1): coluna pela chave, seção por Y ÷ 16, posição pelo índice. Funções de leitura em massa (meshing, luz, física) trabalham direto sobre os arrays, sem criar objetos por bloco.

**MC13-RF-005 (P0) — Mesmo formato em todo lugar.** Esse formato de seção é usado igual no servidor, no cliente, nos workers de geração e meshing, no save e na rede. Arrays são passados entre threads como **memória transferível** (sem cópia), nunca convertidos em JSON.

**MC13-RF-006 (P0) — Referência.** Portar o modelo de coluna/seção e a serialização da pasta "10-otimizacao-chunks-e-pacotes/prismarine-chunk" (implementação aberta do formato de chunk da 1.8).

---

## 2. Renderização por seções (como o RenderGlobal/RenderChunk da 1.8)

### 2.1 Unidade de render

**MC13-RF-010 (P0) — Uma malha por seção por camada.** O terreno é desenhado em **seções de render de 16×16×16**. Cada seção tem no máximo **uma geometria por camada de render**:

| Camada | Conteúdo | Modo |
|---|---|---|
| Sólida | Cubos opacos (pedra, terra, tábuas…) | Sem transparência, escreve profundidade |
| Recorte com mipmap | Grama alta, plantações | Alpha-teste com mipmap |
| Recorte | Folhas (Detalhado), vidro, flores, tochas, grades | Alpha-teste sem mipmap |
| Translúcida | Água, vidro tingido, gelo | Mistura alfa, ordenada de trás para frente |

Com distância 8 (≈ 17×17 colunas visíveis × poucas seções com conteúdo), o número de draw calls do terreno deve ficar na casa de **centenas**, nunca de milhares ou dezenas de milhares.

### 2.2 Construção da malha (meshing) fora da thread principal

**MC13-RF-020 (P0) — Workers de meshing.** A malha de cada seção é construída em **Web Workers** (2 a 4, conforme núcleos), recebendo os arrays da seção **e** uma borda de 1 bloco das 26 seções vizinhas (necessária para culling de faces e luz suave nas bordas). O worker devolve buffers prontos (memória transferível) e a thread principal só cria/atualiza a geometria.

**MC13-RF-021 (P0) — Culling de faces (o mais importante).** Para cada bloco não-ar, desenhar **somente as faces cujo vizinho naquela direção não esconde a face**: vizinho opaco cheio esconde; vizinho ar, transparente ou de forma parcial não esconde; água ao lado de água não desenha face interna; folhas no modo Rápido escondem como opaco. Blocos totalmente cercados de opacos geram **zero** geometria. Num terreno plano típico, só a camada de cima aparece — por isso o chão de um chunk de 16×16 deve gerar ~256 faces visíveis no topo, e não 6 × (todos os blocos).

**MC13-RF-022 (P0) — Formato de vértice compacto.** Cada vértice ocupa no máximo **16 bytes** (o Minecraft usa 28): posição relativa à seção em inteiros pequenos, índice da textura (camada do array de texturas), coordenada de textura, luz do céu + luz de bloco (4 bits cada), oclusão ambiente (2 bits), cor de tinta (bioma) e normal codificada. Índices em 16 bits (cada seção cabe). Nada de geometrias genéricas com atributos em ponto flutuante de 32 bits por vértice para o terreno.

**MC13-RF-023 (P1) — Mesclagem de faces (greedy meshing).** Opcional e ligável (PRD 03): faces adjacentes coplanares com mesma textura, luz, tinta e AO podem virar um só retângulo (com repetição de textura via array de texturas). Nunca deve mudar o visual.

**MC13-RF-024 (P0) — Fila de reconstrução.** Seções ficam "sujas" quando um bloco muda nelas ou na borda de uma vizinha. A fila de reconstrução é **ordenada por distância à câmera** (mais perto primeiro) e com **prioridade máxima** para seções alteradas pelo jogador. Orçamento por quadro de **uploads para a GPU** (padrão 2, opção "Atualizações de chunk por quadro" — PRD 03). Seção reconstruída substitui a antiga sem piscar (manter a antiga até a nova estar pronta).

**MC13-RF-025 (P0) — Liberação de memória.** Seção descarregada ou reconstruída libera a geometria antiga na GPU. Buffers de vértices são reaproveitados de um **pool** por tamanho para evitar coleta de lixo.

### 2.3 O que desenhar: frustum e oclusão de cavernas

**MC13-RF-030 (P0) — Frustum culling por seção.** Cada seção tem uma caixa (16³); seções fora do campo de visão não são desenhadas nem ordenadas.

**MC13-RF-031 (P0) — Grafo de visibilidade (VisGraph, como a 1.8).** Ao construir a malha de uma seção, o worker também calcula **quais faces da seção se enxergam através dela**: faz flood fill pelas posições não-opacas; se uma região de ar toca a face Norte e a face Leste, então Norte↔Leste estão conectadas. Resultado: uma tabela de 6×6 conexões por seção (seção toda opaca = nenhuma; seção toda de ar = todas).

**MC13-RF-032 (P0) — Busca a partir da câmera.** A cada quadro em que a câmera muda de seção (ou o mundo muda), fazer uma busca em largura a partir da seção da câmera: só se avança para a seção vizinha pela face X se, na seção atual, a face de entrada estiver conectada à face X, e nunca voltando na direção oposta à do caminho. Só seções alcançadas são desenhadas. Efeito: cavernas e túneis escondidos atrás de pedra **não são desenhados** quando o jogador está na superfície, e vice-versa. Referência: "10-otimizacao-chunks-e-pacotes/minecraft-renderer/occlusion".

**MC13-RF-033 (P0) — Translúcidos.** A ordenação das faces translúcidas dentro de uma seção é refeita **somente** quando a câmera anda mais de 1 bloco ou muda de seção, e em worker.

### 2.4 Sem linhas, sem vãos, sem z-fighting

**MC13-RF-040 (P0) — Geometria fechada.** Vértices de faces vizinhas usam exatamente as mesmas coordenadas inteiras (sem encolher cubos, sem espaçamento). Nenhuma face é desenhada duas vezes no mesmo lugar. Nenhuma linha, contorno ou "wireframe" no terreno.

**MC13-RF-041 (P0) — Sem sangramento de textura.** Com array de texturas (uma camada por textura), não há sangramento entre texturas. Se for usado atlas, cada textura tem margem (padding) duplicando a borda e os mipmaps são gerados respeitando a margem.

**MC13-RF-042 (P0) — Precisão.** Malhas posicionadas relativas à origem da seção e câmera em origem flutuante (PRD 01 RNF-007), para não haver tremedeira longe de (0,0).

### 2.5 Distância de visão e névoa

**MC13-RF-050 (P0)** Carregar/desenhar em **espiral** a partir do jogador até a distância de visão. A névoa termina exatamente na borda da distância, escondendo seções ainda não carregadas. Opção de distância aplicada ao vivo (descarrega o que saiu do raio).

---

## 3. Orçamentos e metas de desempenho

**MC13-RF-060 (P0) — Metas (perfil Médio, Clássico, distância 8).**

| Métrica | Meta |
|---|---|
| FPS em notebook com GPU integrada | ≥ 60 estáveis |
| Draw calls do terreno | ≤ 600 |
| Triângulos do terreno na tela | ≤ 1,5 milhão (num terreno típico) |
| Tempo de meshing por seção no worker | ≤ 4 ms em média |
| Tempo da thread principal por quadro | ≤ 8 ms |
| Memória de geometria do terreno | ≤ 300 MB |
| Tempo para aparecer o terreno ao entrar no mundo | ≤ 5 s |
| Pico de quadro ao andar e carregar chunks | ≤ 33 ms |

**MC13-RF-061 (P0) — Contadores no F3 (como o Minecraft).** Linha de render com: seções desenhadas / seções carregadas, seções na fila de reconstrução, uploads neste quadro, draw calls, triângulos, memória de geometria, e "culling: frustum X / oclusão Y". Linha de servidor com chunks carregados, chunks na fila de envio e tempo médio de tick.

**MC13-RF-062 (P0) — Modo de diagnóstico visual (dev).** F3+V (Mind Cave) alterna sobreposições: bordas de seção coloridas pelo tempo de meshing, seções escondidas pela oclusão (contorno vermelho), "checker" de UV no terreno, e contador de faces por seção. Serve para provar que o culling funciona.

---

## 4. Texturas corretas

**MC13-RF-070 (P0) — Carregamento antes do meshing.** O array de texturas (ou atlas) é montado e enviado à GPU **antes** do primeiro chunk ser desenhado; cada textura do registro tem um índice fixo usado pelo mesher. A tela de carregamento só termina com as texturas prontas.

**MC13-RF-071 (P0) — Configuração da textura.** Filtro de ampliação **nearest** (pixel nítido), filtro de redução com mipmap nearest/linear conforme opção, espaço de cor sRGB correto (sem texturas "lavadas"/esbranquiçadas), wrap de repetição só quando houver greedy meshing.

**MC13-RF-072 (P0) — Textura ausente visível.** Se um bloco não tiver textura, usar a textura de erro do Minecraft: **xadrez magenta e preto** 16×16 — nunca branco. Assim o erro aparece na hora.

**MC13-RF-073 (P0) — Faces certas.** Grama: topo verde tingido pelo bioma, laterais terra + faixa verde, base terra. Troncos: anéis em cima/embaixo, casca nos lados. Respeitar a tabela de texturas por face do registro (PRD 02).

**MC13-RF-074 (P0) — Fonte das texturas.** Prioridade: pacote de recursos 1.8.9 importado (PRD 10 RF-075) → assets do Studio → procedural (PRD 02 seção 11). Trocar a fonte reconstrói o array de texturas e refaz as malhas progressivamente.

### 4.5 Céu, nuvens e partículas

**MC13-RF-080 (P0) — Nuvens.** Camada a **Y = 128** (acima da maior parte do terreno), células de nuvem de 12×12 blocos de área e 4 blocos de espessura (modo Detalhado), desenhadas como poucas malhas grandes (não como milhares de cubos), com névoa aplicada, deslocamento ao longo de X pelo tempo do mundo (PRD 02 RF-042).

**MC13-RF-081 (P0) — Partículas.** Nenhum emissor de partículas de ambiente fica ativo por padrão. Partículas roxas existem só perto de portais do Nether/End e de endermen. Limite global do PRD 02.

---

## 5. Entidades e partículas leves

- **MC13-RF-090 (P0)** Mobs, itens soltos e jogadores usam modelos compartilhados por tipo (uma geometria por tipo), com instancing quando houver muitos iguais; nada de recriar geometria por quadro.
- **MC13-RF-091 (P0)** Entidades fora do frustum ou além da "Distância de entidades" não são animadas nem desenhadas.
- **MC13-RF-092 (P0)** HUD em React lê estado em no máximo 10 atualizações por segundo; nenhum componente React re-renderiza a cada quadro.

---

## 6. Pacotes de rede como o Minecraft 1.8

O host conversa com o convidado por mensagens binárias que seguem a **mesma lógica dos pacotes da 1.8**.

### 6.1 Chunks

**MC13-RF-100 (P0) — Pacote de dados de chunk.** Envia uma coluna com: coordenadas, se é coluna completa, **máscara de bits** das seções presentes (bit N = seção N existe), e para cada seção presente, em ordem: os 4.096 estados de bloco (2 bytes cada = 8.192 bytes), a luz de bloco (2.048 bytes) e a luz do céu (2.048 bytes, só no Overworld); ao final, os 256 bytes de bioma. Tudo **compactado** antes de enviar.

**MC13-RF-101 (P0) — Envio em lote.** Os chunks que o convidado precisa entram numa fila ordenada por distância (espiral) e saem em **lotes de até 10 chunks por tick** (como o pacote de chunks em lote da 1.8), respeitando o limite de banda (PRD 12 RF-003).

**MC13-RF-102 (P0) — Descarregar chunk.** Quando sai do raio do convidado, o host envia o mesmo pacote de chunk com máscara 0 (coluna vazia) e o cliente libera tudo daquela coluna.

**MC13-RF-103 (P0) — Mudanças de bloco.** Um bloco alterado = pacote de **mudança de bloco** (posição + estado). Vários blocos alterados no mesmo chunk no mesmo tick = pacote de **mudança múltipla** (chunk + lista de posições locais compactadas e estados). Mais de 64 mudanças num chunk no mesmo tick (ex.: explosão grande) = reenviar o chunk inteiro.

**MC13-RF-104 (P0) — Compactação.** Mensagens acima de **256 bytes** são compactadas (limiar padrão do Minecraft); menores vão cruas.

### 6.2 Entidades (rastreador de entidades da 1.8)

**MC13-RF-110 (P0) — Alcance e frequência por tipo.**

| Tipo | Alcance de rastreamento | Atualização a cada |
|---|---|---|
| Jogadores | 512 blocos (limitado pela distância de visão) | 2 ticks |
| Mobs e animais | 80 blocos | 3 ticks |
| Morcego, lula, carrinho, barco | 64–80 blocos | 3 ticks |
| Itens soltos | 64 blocos | 20 ticks |
| Flechas | 64 blocos | 20 ticks |
| Bolas de fogo, bolas de neve, pérolas, ovos, poções | 64 blocos | 10 ticks |
| TNT acesa | 160 blocos | 10 ticks |
| Blocos caindo | 160 blocos | 20 ticks |
| Orbes de XP | 160 blocos | 20 ticks |
| Dragão do Ender | 160 blocos | 3 ticks |
| Balas e granadas (PRD 09) | 128 blocos | evento de disparo + 10 ticks |

**MC13-RF-111 (P0) — Movimento relativo.** Se a entidade andou menos de 4 blocos desde o último envio, enviar **movimento relativo** em ponto fixo de 1/32 de bloco (1 byte por eixo) + rotação em 1 byte (256 passos por volta). Se andou 4 blocos ou mais, ou a cada **400 ticks**, enviar **teleporte** com posição absoluta (correção de deriva). Rotação da cabeça em pacote próprio só quando muda. Velocidade enviada quando relevante (knockback, projéteis).

**MC13-RF-112 (P0) — Jogador local.** O cliente envia a cada tick: posição+rotação quando ambas mudaram, só posição ou só rotação quando só uma mudou, e um pacote mínimo de "no chão/no ar" quando nada mudou; posição completa pelo menos a cada 20 ticks. Referência: "03-multiplayer-ticks-e-interpolacao/mineflayer" (física por tick e envio).

**MC13-RF-113 (P0) — Keep-alive.** O host envia keep-alive a cada ~2 s; o convidado responde; 30 s sem resposta = desconexão (com a janela de reconexão do PRD 12).

**MC13-RF-114 (P0) — Interpolação.** O cliente interpola as entidades entre os dois últimos estados recebidos (3 ticks de atraso para mobs, como no Minecraft) e o PRD 12 RF-003 ajusta o buffer pelo jitter.

---

## 7. Servidor integrado leve

- **MC13-RF-120 (P0)** Chunks fora do raio de todos os jogadores são salvos (se mudaram) e descarregados em lotes por tick (não todos de uma vez).
- **MC13-RF-121 (P0)** Ticks aleatórios e de blocos só em seções com blocos que precisam de tick (contador da seção).
- **MC13-RF-122 (P0)** Geração e luz inicial em workers; o tick do servidor nunca espera a geração (chunk ainda não pronto simplesmente não é enviado).

---

## 8. Código de referência a portar

| Necessidade | Pasta |
|---|---|
| Formato de coluna/seção da 1.8 e serialização para o pacote de chunk | 10-otimizacao-chunks-e-pacotes/prismarine-chunk |
| Gerenciador de malhas de seção, buffers globais, culling de seção, oclusão por grafo de seções, gerenciador de texturas, monitor de desempenho | 10-otimizacao-chunks-e-pacotes/minecraft-renderer |
| Meshing em worker com culling de faces, modelos de bloco e atlas | 10-otimizacao-chunks-e-pacotes/prismarine-viewer e 09-renderizacao-e-meshing |
| Envio de posição por tick | 03-multiplayer-ticks-e-interpolacao/mineflayer |

---

## 9. Critérios de aceite

- **MC13-CA-01** Não existe nenhum objeto 3D por bloco: com F3 aberto, o número de draw calls do terreno na distância 8 fica ≤ 600 e o de triângulos coerente com só as faces visíveis.
- **MC13-CA-02** O chão aparece com textura de grama correta, sem nenhuma linha de grade, em qualquer distância e ângulo.
- **MC13-CA-03** Com um bloco sem textura definida de propósito, aparece o xadrez magenta/preto.
- **MC13-CA-04** Notebook com GPU integrada mantém ≥ 60 FPS na distância 8, andando e voando no criativo por 5 minutos.
- **MC13-CA-05** De pé na superfície, o modo de diagnóstico (F3+V) mostra cavernas subterrâneas marcadas como escondidas pela oclusão; dentro de uma caverna fechada, a superfície fica escondida.
- **MC13-CA-06** Quebrar e colocar blocos atualiza a malha na hora (próximo quadro), inclusive na borda de seções e chunks.
- **MC13-CA-07** Nuvens a Y=128 em células de 12×12, sem partículas roxas no céu.
- **MC13-CA-08** O convidado recebe os chunks em lotes de até 10 por tick, em espiral, e o terreno em volta dele aparece em ≤ 5 s com ping de 100 ms.
- **MC13-CA-09** Banda de um convidado parado com 50 mobs por perto ≤ 15 KB/s (movimentos relativos, frequências da tabela).
- **MC13-CA-10** O formato de seção (arrays de 16 bits + nibbles) é o mesmo no save, na rede e nos workers (verificado por inspeção do código e por teste de ida e volta).
