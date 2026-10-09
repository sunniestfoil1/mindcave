# MIND CAVE — PRD 01 de 12
# Fundação, Arquitetura e Primeiro Jogo Jogável de Ponta a Ponta

| Campo | Valor |
|---|---|
| Produto | **Mind Cave** — jogo sandbox voxel 3D de sobrevivência/construção, multiplayer "estilo LAN" pela internet |
| Referência de comportamento | Minecraft Java Edition **1.8.9** (mecânicas, números, sensação de jogo) |
| Plataforma de construção | **Base44** (app React + Vite, Entities com realtime `subscribe`, Backend Functions em Deno, upload de arquivos) |
| Público | 2 jogadores (o dono do projeto e um amigo desenvolvedor). Ambiente de desenvolvimento permanente. Nunca vai a produção pública. |
| Este documento | PRD 01 — base técnica + versão mínima jogável com TODAS as camadas funcionando |
| Depende de | Nada (é o primeiro) |
| Próximo | PRD 02 — Blocos, Renderização, Água, Iluminação, Shaders e UI |

> **Como usar:** este documento é um **documento de requisitos**, não um passo a passo de arquivos. Ele descreve **o que o sistema final precisa ter e como precisa se comportar**. A IA que implementa decide a organização interna do código, desde que respeite os requisitos, os contratos, os números e os critérios de aceite. Os 12 PRDs serão aplicados em sequência; cada um assume que os anteriores estão implementados e **não pode quebrar** nada que já funciona.

---

## 0. Visão do produto (vale para os 12 PRDs)

Mind Cave é a reconstrução, do zero, de um jogo de mundo voxel com a mesma **sensação** do Minecraft 1.8.9: mesmo ritmo de mineração, mesmo pulo, mesma física, mesmo combate sem cooldown, mesmo ciclo de dia e noite de 20 minutos, mesma lógica de luz de 0 a 15, mesmos tipos de mobs, mesmo sistema de crafting em grade. Não é um "clone genérico inspirado": o objetivo é **paridade de comportamento** com a 1.8.9 sempre que possível, e extensões próprias quando o PRD disser (ex.: armas de fogo, zumbis tecnológicos, editor GLB).

O jogo roda no navegador, com renderização 3D real (WebGL2), e permite que dois jogadores joguem **juntos em tempo real**, como quando alguém abre o mundo para LAN no Minecraft original: um jogador **hospeda** (o navegador dele roda o servidor do mundo) e o outro **entra**. O mundo fica salvo na nuvem (Base44), então qualquer um dos dois pode hospedar o mesmo mundo depois.

Os modelos 3D finais (blocos especiais, itens, mobs, skin) serão **enviados depois em GLB** pelo dono. Até lá, o jogo precisa funcionar com **assets gerados por código** (texturas de blocos procedurais 16×16, modelos de cubos para mobs e jogador, ícones gerados). Todo asset gerado por código deve ser **substituível** por um GLB/PNG enviado, sem mexer na lógica do jogo.

### 0.1 Roteiro dos 12 PRDs

| # | Tema | Resultado esperado ao final |
|---|---|---|
| 01 | Fundação e arquitetura (este) | Jogo jogável de ponta a ponta: mundo infinito simples, andar, pular, quebrar/colocar blocos, hotbar, salvar na nuvem, 2 jogadores juntos |
| 02 | Blocos, renderização, água/lava, iluminação, shaders, UI | Visual completo estilo 1.8.9 + modo Shaders com predefinições + HUD e menus completos |
| 03 | Configurações | Tela de opções completa: vídeo, shaders, controles, mouse, áudio, skin, multiplayer, acessibilidade, perfis de qualidade |
| 04 | Geração de mundo e os 2 mapas | Biomas 1.8.9, cavernas, minérios, estruturas; Mapa 1 (Mundo Aberto) e Mapa 2 (Mundo Plano Criativo/Laboratório) |
| 05 | Sobrevivência e ciclo de jogo | Vida, fome, XP, dano, morte/respawn, dia/noite, clima, modos de jogo, dificuldade, efeitos |
| 06 | Inventário, crafting e itens | Inventário 1.8.9, bancada de trabalho 3×3, fornalha, baú, todas as ferramentas/armaduras, mineração exata |
| 07 | Combate e animações | PvP/PvE 1.8.9 (sem cooldown, bloqueio com espada, crítico, knockback), animações 1ª e 3ª pessoa, arco |
| 08 | Mobs e IA | Animais, zumbis, creepers, esqueletos, aranhas, endermen etc., pathfinding, spawn, drops |
| 09 | Tecnologia e armas de fogo | Pólvora + ferro → armas, munição, balística, bancada de armeiro; zumbis com tecnologia |
| 10 | Mind Cave Studio (editor/visualizador GLB) | Upload, visualização, ajuste e vinculação de GLB a blocos/itens/mobs/skin; criação de itens novos (picareta, espada) com animações |
| 11 | Sistemas avançados | Redstone, agricultura/pecuária, encantamento, bigorna, poções, Nether e The End |
| 12 | Multiplayer avançado, qualidade e polimento | Rede robusta, reconexão, comandos, debug F3 completo, performance, testes, polimento final |
| 13 | Otimização de render, chunks e pacotes (corretivo) | Mundo guardado em arrays numéricos, malha por seção com culling, texturas certas, oclusão de cavernas, pacotes de chunk/entidade como a 1.8 |
| 14 | Geração de mundo corrigida (corretivo) | Pipeline exato do gerador 1.8.9, seeds por chunk, árvores e plantas no chão, ferramentas de verificação |
| 15 | Online, LAN e chat | Abrir mundo para todos ou por código, lista de mundos online, etapas de conexão, permissões, chat completo |
| 16 | ~~Interface com Minecraft-CSS~~ (revogado) | Substituído pelo PRD 19 |
| 19 | Correção da interface para Java 1.8.9 | Botões de widgets, fundo de terra, fonte bitmap, layouts exatos das telas da 1.8.9 |
| 20 | Tela de opções 100% funcional | Telas de opções da 1.8.9 + extras, cada opção ligada ao sistema que controla, options.txt, autoteste |
| 21 | Anti-travamento | Diagnóstico de lag, entrada no mundo sem congelar, orçamento por quadro, tudo pesado em workers, sem coleta de lixo |
| 22 | Correção emergencial de FPS | Hotfix: meshing fora da thread principal, fila que esvazia, descarregar chunks fora do raio, névoa, sem partículas roxas |
| 23 | Correção final de desempenho (medida) | Pipeline de meshing com estados e limite de tarefas, loop ≤ 8 ms, física em passo fixo, sem lixo por quadro |
| 24 | Picos, plantas, colisão, luz, HUD e céu | Teto de mensagens aos workers, plantas em cruz sem colisão, sair de dentro de blocos, tinta de bioma, HUD/céu do pacote Old Default 1.8.9 com recortes exatos |

### 0.2 Princípios inegociáveis (valem para todos os PRDs)

1. **Paridade 1.8.9 por padrão.** Quando um PRD não especificar um número, usar o valor do Minecraft Java 1.8.9. Quando houver conflito entre "parecer bonito" e "comportar igual", vence "comportar igual" (exceto no modo Shaders, que é visual).
2. **Data-driven.** Blocos, itens, receitas, mobs, biomas, sons e animações são **dados em registros**, não `if/else` espalhados. Adicionar um bloco novo = adicionar uma entrada no registro (+ asset opcional).
3. **Servidor autoritativo.** Toda regra de jogo (quebrar bloco, dano, inventário, drops, spawn) é decidida pelo **servidor do mundo** (que roda no navegador do host). O cliente só prevê o próprio movimento e mostra.
4. **Singleplayer = multiplayer com 1 jogador.** Igual ao Minecraft (servidor integrado): jogar sozinho usa o mesmo servidor, só que sem conexão remota. Não pode existir "lógica de singleplayer" separada.
5. **Assets substituíveis.** Todo visual tem um *fallback* gerado por código e uma "porta" para o asset real (GLB/PNG/OGG) que será enviado depois.
6. **Nada de travar a thread principal.** Geração de terreno, construção de malhas (meshing) e simulação do servidor rodam fora da thread de renderização (Web Workers).
7. **Determinismo por seed.** O mesmo seed gera exatamente o mesmo mundo nos dois computadores.
8. **Só salvar o que mudou.** O terreno é regenerado a partir do seed; a nuvem guarda apenas os chunks modificados e o estado de entidades/jogadores.

---

## 1. Escopo deste PRD

### 1.1 Dentro do escopo (precisa estar funcionando ao final do PRD 01)
- Arquitetura completa em camadas (cliente, servidor integrado, rede, persistência, assets).
- Sistema de coordenadas, chunks, seções, registro de blocos com IDs numéricos.
- Geração de terreno **simples porém real** (ruído com colinas, grama/terra/pedra/bedrock, água no nível do mar, árvores simples). O PRD 04 vai substituir por biomas completos — a interface do gerador precisa permitir isso.
- Renderização de chunks com culling de faces ocultas, texturas procedurais 16×16 com filtro *nearest* (pixel art nítido), céu simples, névoa por distância.
- Jogador em 1ª pessoa com física 1.8.9 (andar, correr, agachar, pular, gravidade, colisão AABB, não cair de bordas agachado).
- Mira (crosshair), raycast de bloco com contorno preto do bloco mirado, quebrar bloco (com tempo de quebra simplificado nesta fase: modo criativo instantâneo e sobrevivência com tempo base por dureza), colocar bloco.
- Hotbar de 9 slots com os blocos básicos, troca por rolagem do mouse e teclas 1–9.
- Modelo de jogador visível em 3ª pessoa (F5) e para o outro jogador: humanoide de cubos com skin genérica gerada por código.
- Menu principal, lista de mundos, criar mundo (nome, seed, mapa), hospedar, entrar por código de sala, pausa (Esc), sair salvando.
- Multiplayer de 2 jogadores em tempo real via **WebRTC (P2P) com sinalização pelo Base44**, com o host rodando o servidor.
- Persistência na nuvem: mundos, chunks modificados, posição/inventário dos jogadores, autosave a cada 45 s.
- Chat de texto simples (tecla T) e lista de jogadores (Tab).
- Overlay de debug mínimo (F3): FPS, XYZ, chunk, direção, bloco mirado, ping, TPS do servidor.

### 1.2 Fora do escopo (vem nos próximos PRDs)
Biomas, cavernas, minérios completos (04) · água corrente, lava, iluminação por luz de bloco/céu, AO suave, shaders (02) · tela de opções completa (03) · vida/fome/dano/morte (05) · inventário completo e crafting (06) · combate e animações de ataque (07) · mobs (08) · armas (09) · editor GLB (10) · redstone/dimensões (11) · rede robusta/reconexão/comandos completos (12).

> Mesmo fora do escopo, a arquitetura deste PRD **deve prever os pontos de extensão** (ver seção 4) para que esses sistemas entrem depois sem reescrever a base.

---

## 2. Glossário e convenções

| Termo | Definição |
|---|---|
| Bloco | Cubo de 1×1×1 metro. **1 unidade de mundo = 1 bloco = 1 metro.** |
| Tick | Passo da simulação do servidor. **20 ticks por segundo (TPS), 50 ms cada.** Toda regra de jogo é expressa em ticks. |
| Chunk | Coluna de 16 (X) × 256 (Y) × 16 (Z) blocos. |
| Seção (section) | Fatia de 16×16×16 de um chunk. Um chunk tem 16 seções (Y 0–255). Seções totalmente vazias (ar) não ocupam memória. |
| Região | Agrupamento de 32×32 chunks, usado para persistência em lote. |
| Coordenadas | Y para cima. +X = leste, −X = oeste, +Z = sul, −Z = norte (igual ao Minecraft). Yaw 0 = olhando para +Z (sul), cresce no sentido horário visto de cima (90 = oeste, 180 = norte, 270 = leste). Pitch −90 = olhando para cima, +90 = para baixo. |
| Coordenada de chunk | `cx = floor(x / 16)`, `cz = floor(z / 16)`. Coordenada local = `x mod 16` (sempre positiva, inclusive para coordenadas negativas). |
| ID de bloco | Inteiro 0–4095 + metadado 0–15 (modelo 1.8: ID + meta). Internamente pode ser representado como *block state* único de 16 bits. ID 0 = ar. |
| Host | Jogador cujo navegador roda o servidor integrado do mundo. |
| Cliente | Parte do jogo que renderiza, lê input e prevê movimento. Todo jogador (inclusive o host) tem um cliente. |
| Servidor integrado | Simulação autoritativa do mundo rodando em um Web Worker no navegador do host. |
| Sala (room) | Sessão multiplayer ativa de um mundo, identificada por um código curto. |
| Registro (registry) | Tabela de dados de blocos/itens/entidades/sons/etc. com IDs estáveis. |

**Identificadores de requisito:** `MC01-RF-xxx` (funcional), `MC01-RNF-xxx` (não funcional), `MC01-CA-xxx` (critério de aceite). Prioridade: **P0** (obrigatório para o PRD fechar), **P1** (deve ter), **P2** (desejável).

---

## 3. Stack e restrições técnicas

### 3.1 Restrições da plataforma Base44 (conhecidas)
- Frontend em React (Vite). Entities com operações CRUD, filtros e **assinatura realtime** (`subscribe`) que dispara em criação/atualização/remoção de registros.
- Backend Functions em Deno (serverless, sem conexão persistente; tempo máximo de execução limitado a minutos). **Não existe servidor de jogo sempre ligado** no Base44.
- Upload de arquivos via integração de upload (retorna URL do arquivo).
- Autenticação nativa de usuários.

### 3.2 Decisão de arquitetura de rede (obrigatória)
Escrever no banco 20 vezes por segundo por jogador para sincronizar movimento é **inviável** (latência alta, limites de taxa, custo). Por isso:

- **Tempo real do jogo (movimento, blocos, chat, entidades):** WebRTC **DataChannels** direto entre o navegador do host e o do convidado (P2P), exatamente como uma LAN.
- **Sinalização (troca de oferta/resposta SDP e candidatos ICE):** feita através de Entities do Base44 + `subscribe`. É pouca informação, poucas mensagens, uma vez por conexão.
- **Atravessar NAT/CGNAT:** muitos provedores brasileiros usam CGNAT, o que pode impedir conexão P2P direta. Obrigatório suportar servidores **STUN** (públicos) e **TURN** configuráveis (lista de URLs + credenciais nas configurações do app). Opções viáveis: TURN gerenciado com cota gratuita (ex.: Cloudflare Realtime TURN, que tem 1.000 GB/mês gratuitos) ou TURN próprio (ex.: coturn) num servidor do dono. A conexão deve tentar direto → STUN → TURN automaticamente.
- **Persistência:** Entities do Base44 (metadados, jogadores, chunks modificados) + upload de arquivos para blobs grandes (regiões compactadas, assets).
- **Fallback de emergência (P2):** se WebRTC falhar totalmente, um modo "Relay Base44" degradado que sincroniza apenas blocos alterados, chat e posições a ~4 Hz via Entities. Deve ser claramente sinalizado como "modo de baixa qualidade".

### 3.3 Bibliotecas
- Renderização: **three.js** (WebGL2). O motor 3D é **imperativo**, montado dentro de um componente React que só hospeda o `<canvas>`. React **não** pode controlar objetos 3D por estado/re-render (proibido usar re-render de React por frame). React é usado apenas para menus, HUD e overlays.
- Ruído: implementação de Simplex/Perlin determinística por seed (biblioteca pequena ou implementação própria). Proibido usar `Math.random()` em qualquer coisa que dependa do seed — usar PRNG seedável (ex.: xoroshiro/mulberry/sfc32 ou equivalente ao `java.util.Random` LCG para manter "sensação" 1.8).
- Compressão: compressão rápida para chunks (ex.: deflate via `CompressionStream` nativo do navegador, ou lib equivalente).
- Pós-processamento (a partir do PRD 02): biblioteca de pós-processamento compatível com three.js.
- Proibido: engines voxel prontas que impeçam controle total do pipeline (podem ser **referência de estudo**, ver seção 12).

### 3.4 Requisitos de navegador
- Chrome/Edge atuais (alvo principal), Firefox (suportado). WebGL2 obrigatório; se ausente, mostrar tela de erro clara.
- Pointer Lock API para captura do mouse; Fullscreen API opcional.
- Teclado + mouse. Controle (gamepad) é P2 e fica para o PRD 03.

---

## 4. Arquitetura em camadas

| Camada | Onde roda | Conteúdo |
|---|---|---|
| UI | Navegador de cada jogador (React) | Menus, HUD, chat, telas, overlays. Recebe do jogo apenas estado resumido (no máximo ~10 atualizações por segundo) |
| Cliente do jogo | Navegador de cada jogador (thread principal) | Loop de render, input, câmera, predição do jogador local, interpolação de entidades remotas, cache de chunks, fila de meshing |
| Workers de meshing | Navegador de cada jogador (1 a 4 workers) | Recebem uma seção e seus vizinhos e devolvem a geometria pronta |
| Transporte | Entre cliente e servidor | Na memória (loopback) para o próprio host; WebRTC para o convidado |
| Servidor integrado | Somente no navegador do host (Web Worker) | Loop de 20 TPS, mundo autoritativo, geração (workers de terreno), entidades, regras, persistência (autosave no Base44) |
| Base44 | Nuvem | Entities (World, WorldPlayer, ChunkDelta, Room, Signal, AssetBinding…), arquivos (regiões compactadas, GLB/PNG/OGG enviados), Backend Functions (validações, limpeza de salas expiradas, locks). Usado para sinalização da conexão e persistência, nunca para o tempo real do jogo |

### 4.1 Módulos lógicos obrigatórios
A IA define nomes e organização de pastas, mas os seguintes **módulos com responsabilidade única** precisam existir e ser claramente separados:

| Módulo | Responsabilidade | Roda em |
|---|---|---|
| Núcleo compartilhado | Tipos, constantes (seção 6), registros, matemática de vetores/AABB, PRNG, formato de chunk, protocolo de mensagens | Todos |
| Registro de blocos | Definição data-driven de cada bloco (seção 7) | Todos |
| Gerador de mundo | Função pura: o mesmo seed e as mesmas coordenadas de chunk produzem sempre o mesmo chunk. Plugável por "tipo de mapa" | Workers de terreno |
| Mundo do servidor | Armazena chunks carregados, aplica mudanças, gerencia carregamento/descarregamento por proximidade dos jogadores | Servidor |
| Loop do servidor | 20 TPS fixos, com acumulador; se atrasar, até 10 ticks de recuperação por quadro, depois descarta e registra "servidor sobrecarregado" | Servidor |
| Gerenciador de entidades | Jogadores agora; mobs, itens soltos, projéteis depois. Componentes: posição, velocidade, AABB, rotação, tipo, dados | Servidor + espelho no cliente |
| Física | Colisão AABB contra blocos, gravidade, atrito, passo de subida (0,5 para escadas/lajes no futuro — 0,6 é a regra 1.8 de *step height*), agachar na borda | Compartilhado (servidor e predição do cliente usam o **mesmo código**) |
| Rede | Transporte abstrato com 2 implementações: loopback (memória) e WebRTC. Serialização binária | Cliente e servidor |
| Sinalização | Cria/entra em salas e troca SDP/ICE via Base44 | Cliente (thread principal) |
| Persistência | Serializa/deserializa mundo, jogadores e chunks modificados; autosave; save ao sair | Servidor (host) |
| Renderizador | Cena three.js, malhas de chunk, céu, névoa, contorno de bloco, modelo de jogadores | Cliente |
| Mesher | Construção de geometria de seção com culling de faces e (a partir do PRD 02) luz/AO | Workers de meshing |
| Gerenciador de assets | Resolve "qual visual usar" para cada bloco/item/entidade: asset enviado se existir, senão o procedural | Cliente |
| Input | Mapeamento de teclas/mouse configurável (o PRD 03 expande) | Cliente |
| UI | Menus, HUD, chat, debug | Cliente (React) |

### 4.2 Pontos de extensão que precisam existir desde já
- **Registro de itens** separado do registro de blocos (blocos colocáveis têm um item correspondente).
- **Registro de entidades** (mesmo que só "jogador" exista agora).
- **Registro de tipos de mapa / geradores** (agora: "Mundo Aberto (básico)"; PRD 04 adiciona os definitivos).
- **Registro de dimensões** (agora só Overworld; PRD 11 adiciona Nether e End).
- **Sistema de eventos do servidor** (ex.: `blockBroken`, `blockPlaced`, `entityDamaged`, `playerJoined`) para sistemas futuros se plugarem sem alterar o núcleo.
- **Tick de blocos agendado** (*scheduled tick*) e **tick aleatório** (*random tick*, 3 blocos por seção por tick em 1.8.9) — a estrutura existe agora, mesmo que só a grama use (ver RF-030).
- **Pipeline de render em passes** (para o PRD 02 inserir sombras, água translúcida e pós-processamento).

---

## 5. Requisitos funcionais

### 5.1 Inicialização e menus

**MC01-RF-001 (P0) — Tela de carregamento inicial.** Ao abrir o app: tela com o logo "MIND CAVE" (texto estilizado em fonte pixel), barra de progresso real (registro carregado, texturas procedurais geradas, workers prontos). Duração alvo < 3 s em máquina comum.

**MC01-RF-002 (P0) — Login.** Usar a autenticação do Base44. O nome exibido no jogo é o "nome de jogador" (3–16 caracteres, letras, números e `_`, igual ao Minecraft), definido no primeiro acesso e editável depois.

**MC01-RF-003 (P0) — Menu principal.** Fundo: panorama do mundo girando lentamente (pode ser uma cena 3D real de um chunk gerado com seed fixo, câmera orbitando) com leve desfoque. Botões: **Um Jogador**, **Multijogador**, **Mind Cave Studio** (desabilitado com "em breve" até o PRD 10), **Opções…**, **Sair**. Texto amarelo "splash" girando/pulsando ao lado do logo com frases curtas aleatórias próprias (ex.: "Agora com picaretas!", "Feito por dois devs!"). Rodapé: "Mind Cave dev-build" + versão do build.

**MC01-RF-004 (P0) — Lista de mundos ("Um Jogador").** Lista os mundos do usuário (e mundos compartilhados com ele) vindos do Base44: nome, mapa, modo, data do último acesso, quem é o dono. Ações: **Jogar mundo selecionado**, **Criar novo mundo**, **Editar** (renomear), **Excluir** (com confirmação digitando o nome), **Recriar** (mesmo seed, mundo novo). Ao jogar, o próprio usuário vira host com servidor integrado; se marcar "Abrir para amigo", a sala é criada (ver 5.6).

**MC01-RF-005 (P0) — Criar novo mundo.** Campos: Nome do mundo; Seed (texto livre; vazio = aleatório; texto não numérico é convertido por hash de string estilo Java `String.hashCode()` para manter a convenção); **Mapa** (nesta fase: "Mundo Aberto (básico)"; PRD 04 adiciona "Mundo Aberto" definitivo e "Mundo Plano Criativo"); Modo de jogo (Sobrevivência/Criativo — a diferença real chega no PRD 05; agora: criativo = quebra instantânea e voo com duplo-espaço); "Permitir comandos" (sim/não). Botão "Criar mundo".

**MC01-RF-006 (P0) — Tela de carregamento do mundo.** "Gerando terreno…" com porcentagem real dos chunks iniciais (raio de spawn: 5×5 chunks em volta do spawn precisam estar prontos e com malha antes de soltar o jogador). Depois "Construindo terreno…" e entra no jogo.

**MC01-RF-007 (P0) — Menu de pausa (Esc).** Fundo escurecido, jogo **continua rodando** se houver outro jogador conectado (igual LAN); pausa a simulação apenas se for singleplayer sem sala aberta. Botões: **Voltar ao jogo**, **Abrir para amigo** (cria sala e mostra o código), **Opções…**, **Estatísticas** (desabilitado até PRD 12), **Salvar e sair para o título**.

### 5.2 Mundo e chunks

**MC01-RF-010 (P0) — Formato de chunk.** 16×256×16, dividido em 16 seções de 16³. Cada seção armazena o estado dos blocos de forma compacta (paleta + índices com bits variáveis **ou** array de 16 bits; a IA escolhe, desde que: seção vazia não aloque memória, acesso por `(x,y,z)` local seja O(1)). Reservar desde já, por seção, arrays de **luz do céu** e **luz de bloco** (4 bits cada, 0–15) — preenchidos de verdade no PRD 02; agora podem ficar com céu = 15 acima do terreno e 0 abaixo, para não quebrar o formato depois. Reservar também o **mapa de altura** (heightmap) por coluna e o **bioma** por coluna (1 byte, 16×16).

**MC01-RF-011 (P0) — Carregamento por distância.** O servidor mantém carregados os chunks dentro da **distância de visão** (render distance) de cada jogador conectado + 1 de margem. Padrão: 8 chunks; nesta fase permitir 2–16 por uma opção simples no menu de pausa (o PRD 03 move para a tela de vídeo). Chunks fora do alcance de todos os jogadores são salvos (se modificados) e descarregados.

**MC01-RF-012 (P0) — Ordem de geração e envio.** Gerar/enviar chunks em espiral a partir do chunk do jogador, priorizando os que estão no cone de visão da câmera. Limite de envio por tick por jogador (ex.: até 4 chunks/tick) para não engasgar a rede/meshing.

**MC01-RF-013 (P0) — Gerador básico (temporário até o PRD 04).**
- Altura do terreno: ruído 2D fractal (4–6 oitavas) mapeado para Y entre ~56 e ~90, com nível do mar em **Y=63** (água preenche de Y≤62 até a superfície nas áreas abaixo do mar — convenção 1.8: superfície do mar fica em 62/63).
- Camadas: **bedrock** em Y=0 sempre e aleatoriamente em Y=1–4 (padrão irregular 1.8); **pedra** até 4 blocos abaixo da superfície; **terra** 3–4 blocos; **grama** no topo se acima do nível do mar; **areia** na beira d'água (topo entre Y=60 e 64 junto à água); **cascalho** em parte do fundo do mar.
- **Árvores simples (carvalho):** tronco de 4–6 blocos, copa de folhas no formato 1.8 (duas camadas 5×5 com cantos aleatoriamente removidos + duas camadas 3×3 no topo em "+"). Densidade baixa e determinística por seed/chunk. Árvores que cruzam borda de chunk precisam ser geradas corretamente (técnica: decorar um chunk só quando os vizinhos existem, ou gerar decorações a partir de chunks vizinhos de forma determinística).
- Minérios simples: carvão e ferro espalhados na pedra (o PRD 04 refaz com a distribuição exata).

**MC01-RF-014 (P0) — Limites do mundo.** Não pode construir acima de Y=255 nem abaixo de Y=0. Abaixo de Y=0 é "o vazio": nesta fase, o jogador que cair abaixo de Y=−64 é teleportado ao spawn (o PRD 05 troca por dano de vazio). Limite horizontal: ±30.000.000 (só garantir que nada quebra numericamente até ±1.000.000; acima disso, aceitável ter imprecisão visual — usar renderização relativa à câmera, ver RNF-007).

**MC01-RF-015 (P0) — Spawn do mundo.** Ponto de spawn escolhido perto de (0,0) em terra firme (não água), procurando em espiral. Jogadores novos nascem em um raio aleatório de até 10 blocos do spawn (comportamento 1.8 de *spawn radius*), sempre em superfície sólida.

### 5.3 Blocos desta fase

**MC01-RF-020 (P0) — Blocos mínimos registrados** (todos com textura procedural própria, ver PRD 02 para o restante): Ar (0), Pedra (1), Grama (2), Terra (3), Pedregulho (4), Tábuas de carvalho (5), Bedrock (7), Água parada (9), Areia (12), Cascalho (13), Minério de ferro (15), Minério de carvão (16), Tronco de carvalho (17, com eixo Y/X/Z pela face clicada), Folhas de carvalho (18), Vidro (20), Tijolos de pedra (98), Lã branca (35:0) + 15 cores de lã (35:1–15). Usar a **numeração clássica de IDs** como referência para facilitar migração de dados e consulta a tabelas públicas.

**MC01-RF-021 (P0) — Propriedades por bloco no registro (mínimo).** `id`, `meta` válidos, `nomeInterno` (ex.: `grass`), `nomeExibido` (PT-BR), `dureza` (tempo de quebra), `resistênciaExplosão`, `sólido` (colide), `opaco` (bloqueia luz e esconde faces vizinhas), `transparência` (`opaco` | `recorte` (folhas, vidro: alpha teste) | `translúcido` (água, vidro colorido)), `texturas por face` (topo, base, lados ou por direção), `som de passo/quebra/colocação` (categoria: pedra, madeira, grama, areia, cascalho, vidro, lã — sons reais chegam no PRD 02/10), `drop` (o que cai — nesta fase: o próprio bloco; exceções 1.8: pedra dropa pedregulho, grama dropa terra, folhas não dropam (mudas/maçã no PRD 06), vidro não dropa), `inflamável` (reservado), `emissão de luz` (reservado, 0 por padrão), `ferramenta preferida` e `nível mínimo` (reservado para PRD 06).

**MC01-RF-022 (P0) — Folhas.** Renderizadas com alpha-teste (estilo "Fancy" do 1.8: vê-se através, faces internas entre folhas vizinhas **são** desenhadas). No PRD 03 a opção Gráficos Rápidos/Detalhados alterna para folhas opacas.

**MC01-RF-023 (P1) — Grama tingida por bioma.** A textura de topo da grama e das folhas é em tons de cinza e recebe uma **cor de tinta** (colormap) por coluna. Nesta fase, uma cor fixa verde típica de planície; o PRD 04 liga ao bioma.

### 5.4 Jogador, câmera e física (paridade 1.8.9)

**MC01-RF-030 (P0) — Constantes do jogador.** Implementação obrigatória: portar a física de "02-fisica/prismarine-physics" (seção 12.1); a tabela abaixo é o resultado esperado e serve de teste.

| Grandeza | Valor 1.8.9 |
|---|---|
| Caixa de colisão | 0,6 de largura × 1,8 de altura |
| Altura dos olhos | 1,62 (agachado: 1,54; a altura da caixa **não muda** ao agachar na 1.8) |
| Velocidade andando | ≈ 4,317 blocos/s |
| Velocidade correndo (sprint) | ≈ 5,612 blocos/s (+30%) |
| Velocidade agachado | ≈ 1,31 blocos/s (30% da caminhada) |
| Gravidade | 0,08 blocos/tick² |
| Arrasto vertical | velocidade Y × 0,98 por tick |
| Atrito horizontal no chão | 0,6 (escorregadio do bloco) × 0,91 = 0,546; no ar 0,91 |
| Impulso de pulo | 0,42 blocos/tick (altura máxima ≈ 1,2522 bloco) |
| Bônus de pulo correndo | +0,2 na direção olhada no momento do pulo |
| Altura de degrau (step) | 0,6 bloco (sobe automaticamente lajes/bordas até 0,6) |
| Voo criativo | ≈ 10,92 blocos/s; com sprint ≈ 21,6 blocos/s |
| FOV padrão | 70° (sprint aumenta FOV em ~15% com transição suave; configurável no PRD 03) |
| Alcance de bloco | 4,5 (sobrevivência) / 5,0 (criativo) |

Gelo (0,98 de escorregamento) e areia movediça de alma ficam reservados.

**MC01-RF-031 (P0) — Movimento.** WASD relativo ao yaw. Movimento diagonal **não** é mais rápido (normalizar). Sprint por Ctrl ou duplo toque em W (janela de 7 ticks); sprint para ao bater em parede, ao agachar, ao soltar W. Agachar (Shift) impede cair de bordas (o jogador não sai de cima de um bloco se a queda for > 0,6 enquanto agachado). Pulo com Espaço; segurar Espaço repete o pulo ao tocar o chão. Na água (nesta fase só "água parada"): velocidade reduzida, Espaço sobe, gravidade reduzida (o PRD 02 refina com correnteza e o PRD 05 com afogamento).

**MC01-RF-032 (P0) — Colisão.** Resolver colisão AABB eixo por eixo (Y primeiro, depois X e Z, depois *step-up* se aplicável — mesma ordem do 1.8). Nunca atravessar blocos mesmo com quedas rápidas (sub-steps se a velocidade passar de 0,5 bloco/tick). Colidir com bordas de chunks não carregados como se fossem sólidos (o jogador nunca cai no vazio porque um chunk não chegou).

**MC01-RF-033 (P0) — Câmera.** Pointer lock ao clicar no jogo. Sensibilidade padrão equivalente a 100% (PRD 03 configura). Pitch limitado a ±90°. **View bobbing** (balanço ao andar) ligado por padrão, com o mesmo padrão do 1.8 (oscilação lateral + vertical sincronizada com o passo). F5 alterna: 1ª pessoa → 3ª pessoa por trás → 3ª pessoa pela frente. Em 3ª pessoa a câmera fica a 4 blocos e encurta se bater em bloco.

**MC01-RF-034 (P0) — Predição e reconciliação.** O cliente aplica o próprio input imediatamente usando o mesmo código de física do servidor. Cada input enviado tem número de sequência. O servidor processa, responde com a posição autoritativa + último número de sequência processado; o cliente reaplica os inputs pendentes. Correções pequenas (< 0,1 bloco) são suavizadas; grandes geram *snap*. O jogador nunca deve sentir "elástico" em condições normais (ping < 150 ms).

### 5.5 Interação com blocos

**MC01-RF-040 (P0) — Raycast.** A cada quadro, raycast (algoritmo DDA voxel) a partir dos olhos na direção da câmera até o alcance. O bloco mirado ganha **contorno preto fino** (linhas, ~40% de opacidade, levemente maior que o bloco para evitar *z-fighting*). Folhas, vidro e blocos não sólidos com forma (no futuro: flores, tochas) são miráveis; ar e água não (água só com balde — PRD 06).

**MC01-RF-041 (P0) — Quebrar bloco.**
- Criativo: clique esquerdo quebra instantaneamente; segurar quebra um bloco a cada **5 ticks** (cadência 1.8).
- Sobrevivência (provisório até PRD 06): tempo = `dureza × 1,5` segundos com a mão (usar a fórmula completa no PRD 06). Mostrar **rachaduras progressivas** (10 estágios) sobre o bloco. Soltar o botão ou mudar o alvo reinicia o progresso. Bedrock é inquebrável em sobrevivência.
- Ao quebrar: partículas de pedaços do bloco (usando a textura do bloco), som da categoria, e em sobrevivência um **item solto** (entidade simples: mini-cubo girando e flutuando, coletado automaticamente ao encostar — raio 1 bloco — após 10 ticks de atraso de coleta; some após 5 min = 6000 ticks).

**MC01-RF-042 (P0) — Colocar bloco.** Clique direito coloca o bloco da hotbar na face mirada. Não pode colocar se a caixa do bloco intersectar algum jogador (inclusive o próprio). Cadência ao segurar: 1 bloco a cada **4 ticks**. Troncos assumem eixo pela face clicada. Colocar em água substitui a água.

**MC01-RF-043 (P0) — Escolher bloco (Pick Block).** Clique do meio copia o bloco mirado para a hotbar (criativo: cria o item; sobrevivência: seleciona se já houver na hotbar — completo no PRD 06).

**MC01-RF-044 (P0) — Autoridade.** Toda quebra/colocação é **pedido** ao servidor. O cliente pode mostrar o resultado imediatamente (otimista), mas se o servidor negar (alvo longe demais > alcance + 1, bloco mudou, posição inválida), o cliente reverte. O servidor difunde a mudança a todos os jogadores que têm aquele chunk.

### 5.6 Multiplayer "estilo LAN" pela internet

**MC01-RF-050 (P0) — Abrir para amigo.** Do menu de pausa (ou ao iniciar o mundo), o host clica "Abrir para amigo". O sistema cria uma **Sala** no Base44 com um **código de 6 caracteres** (alfanumérico sem caracteres ambíguos: sem 0/O/1/I/L), mostra o código grande com botão "copiar" e uma mensagem no chat: "Mundo aberto para amigo. Código: XXXXXX". A sala tem estado `aberta`, `id do mundo`, `id do host`, `versão do jogo` (build), `criada em`, `última atividade` (heartbeat a cada 15 s).

**MC01-RF-051 (P0) — Multijogador (tela).** Lista "Salas dos meus amigos" (salas abertas por usuários que compartilharam mundo com você ou por todos os usuários do app — já que o app só terá 2 usuários, listar todas as salas abertas com heartbeat < 45 s) + campo "Entrar com código". Mostrar nome do mundo, nome do host, jogadores conectados/limite, ping estimado após conectar.

**MC01-RF-052 (P0) — Handshake.** Fluxo: convidado cria registro de sinal `offer` → host recebe via subscribe → responde `answer` → ambos trocam candidatos ICE → DataChannels abertos. Mensagens de sinalização expiram em 60 s e são apagadas após conexão. Tempo alvo de conexão < 5 s. Se falhar em 15 s: mensagem clara ("Não foi possível conectar diretamente. Verifique o servidor TURN nas configurações.") com botão "Tentar novamente" e, se habilitado, "Usar modo Relay (baixa qualidade)".

**MC01-RF-053 (P0) — Canais.** No mínimo dois DataChannels: **confiável/ordenado** (blocos, chat, inventário, entrada/saída de jogadores, envio de chunks) e **não-confiável/não-ordenado** (movimento e estados de entidades de alta frequência, sem retransmissão; maxRetransmits = 0). Mensagens em **binário** com cabeçalho de tipo (1 byte) + payload compacto; chunks enviados compactados.

**MC01-RF-054 (P0) — Login no servidor.** Ao abrir o canal, o convidado envia uma mensagem de login com nome do jogador, id do usuário, versão do build e referência da skin. O servidor valida versão (build diferente = recusa com mensagem "Versões diferentes: host X, você Y"), carrega os dados salvos daquele jogador naquele mundo (ou cria no spawn) e responde com a confirmação contendo id da entidade, posição, modo de jogo, tempo do mundo, seed (se permitido) e configurações do mundo. Em seguida, envia os chunks em volta e a lista de entidades visíveis. Mensagem no chat de todos: "*fulano* entrou no jogo" (amarelo).

**MC01-RF-055 (P0) — Replicação de outros jogadores.** Cada jogador vê o outro como modelo humanoide com a skin dele, nome flutuando acima da cabeça (placa com fundo semitransparente, visível através de blocos com opacidade menor quando ocluso, oculto quando o jogador está agachado e atrás de bloco — regra 1.8), animação de andar (braços e pernas balançando proporcionalmente à velocidade), agachar (corpo inclinado), olhar (cabeça segue pitch/yaw; corpo segue com atraso). Posições remotas são **interpoladas** com buffer de ~100 ms para movimento suave.

**MC01-RF-056 (P0) — Saída e queda.** Convidado sai: "*fulano* saiu do jogo", dados salvos. Host sai/fecha a aba: convidado vê tela "Conexão perdida: o host encerrou o mundo" e volta ao menu; o mundo é salvo pelo host antes (save no evento de saída + autosave). Detecção de queda por timeout: 15 s sem pacotes.

**MC01-RF-057 (P0) — Limite.** Máximo de jogadores por sala: configurável, padrão **8** (o uso real é 2, mas não deve haver suposição rígida de "apenas 2" no código).

**MC01-RF-058 (P0) — Lock do mundo.** Um mundo só pode ter **um host ativo** por vez. Ao iniciar como host, criar/renovar um *lock* no Base44 (com heartbeat). Se outro usuário tentar hospedar o mesmo mundo com lock ativo (< 45 s), mostrar "Este mundo já está aberto por *fulano* — entrar como convidado?".

### 5.7 Persistência

**MC01-RF-060 (P0) — Entities no Base44 (modelo mínimo).**

| Entity | Campos principais | Observações |
|---|---|---|
| **World** | nome, seed (string), mapType, gameMode padrão, dificuldade (reservado), allowCommands, spawn (x,y,z), worldTime (ticks), dayTime, ownerId, sharedWith (lista de userIds), createdAt, lastPlayedAt, buildVersion, formatVersion | `formatVersion` permite migrações futuras |
| **WorldPlayer** | worldId, userId, nomeJogador, posição, rotação, dimensão, gameMode, hotbar/inventário (serializado), slot selecionado, dados extras (JSON para PRDs futuros: vida, fome, XP, efeitos…) | Um registro por jogador por mundo |
| **ChunkDelta** | worldId, dimensão, cx, cz, dados (binário compactado em base64), versão, atualizadoEm | Só chunks **modificados** em relação ao gerado. Se o payload ficar grande demais para um registro, migrar o chunk para arquivo (ver RF-062) |
| **Room** | código, worldId, hostUserId, status, buildVersion, maxPlayers, players (lista resumida), lastHeartbeat | Limpa salas sem heartbeat > 2 min |
| **Signal** | roomCode, fromUserId, toUserId, tipo (offer/answer/ice/bye), payload, expiraEm | Apagado após uso |
| **WorldLock** | worldId, holderUserId, lastHeartbeat | |
| **GameSettings** | userId, JSON de opções | Expandido no PRD 03 |
| **AssetBinding** | (reservado para o PRD 10) | Criar a entity vazia já, para o gerenciador de assets consultar |

Permissões: só o dono e os usuários em `sharedWith` leem/escrevem um mundo e seus chunks. Como só existem 2 usuários, aceitar compartilhamento simples por "Compartilhar mundo com…" (lista de usuários do app).

**MC01-RF-061 (P0) — Formato de salvamento de chunk.** Serialização binária: versão do formato, lista de seções não vazias (índice Y, paleta, índices), luzes (a partir do PRD 02), dados extras de blocos com estado (baús, placas — reservado: "block entities" como lista JSON), entidades que estão no chunk (reservado). Compactar antes de salvar.

**MC01-RF-062 (P1) — Regiões em arquivo.** Para mundos grandes, agrupar chunks modificados de uma região 32×32 em um arquivo compactado enviado ao armazenamento de arquivos, e manter na entity apenas o índice (região → URL + hash). O carregamento lê a região inteira uma vez e mantém cache. A IA escolhe o limiar (ex.: > 64 chunks modificados numa região passa a usar arquivo).

**MC01-RF-063 (P0) — Autosave.** A cada **900 ticks (45 s)**, como o 1.8.9: salva chunks "sujos" (modificados desde o último save) e todos os jogadores. Salvamento em lote, sem travar o servidor (incremental: no máx. N chunks por tick). Indicador discreto no canto ("Salvando…") durante o save. Também salva ao: sair para o título, host encerrar sala, convidado desconectar (dados do jogador).

**MC01-RF-064 (P1) — Cache local.** Cache em IndexedDB dos chunks modificados e dos assets baixados, invalidado por versão/hash, para acelerar reentrada. A nuvem é sempre a fonte da verdade.

### 5.8 HUD, chat e debug (versão mínima; o PRD 02 refina o visual)

**MC01-RF-070 (P0) — HUD.** Mira (cruz branca com blend de inversão de cor, 9×9 px na escala de GUI 2). Hotbar centralizada embaixo (9 slots, slot selecionado destacado), ícones 3D isométricos dos blocos (gerados renderizando o bloco numa textura) com contagem. Escala de GUI: Automática (padrão), 1, 2, 3, 4 — fonte pixel nítida, sem borrões (renderizar UI em múltiplos inteiros).

**MC01-RF-071 (P0) — Chat.** T abre; `/` abre com barra já digitada. Até 100 mensagens de histórico, mostra as últimas 10 por 10 s e depois desvanece; com o chat aberto mostra até 20 com rolagem. Setas ↑/↓ navegam pelo histórico do que você digitou. Limite de 100 caracteres por mensagem (1.8). Formato: `<nome> mensagem`. Mensagens de sistema em amarelo/cinza.

**MC01-RF-072 (P0) — Comandos mínimos** (se "Permitir comandos" ou host): `/tp x y z`, `/tp <jogador>`, `/gamemode <0|1|survival|creative> [jogador]`, `/time set <day|night|valor>`, `/seed`, `/give <jogador> <bloco> [qtd]`, `/help`. Coordenadas relativas com `~`. O PRD 12 completa o sistema de comandos.

**MC01-RF-073 (P0) — Lista de jogadores (Tab).** Painel no topo com os nomes e ícone de ping (barras verdes por faixa: <150, <300, <600, <1000, ≥1000 ms).

**MC01-RF-074 (P0) — Debug F3 mínimo.** Texto branco com sombra, canto superior esquerdo: versão, FPS, chunks renderizados/carregados, entidades, `XYZ`, `Bloco` (inteiro), `Chunk` (local e cx/cz), `Facing` (norte/sul/leste/oeste + sinal do eixo), yaw/pitch, bloco mirado (nome + coordenadas), altura (heightmap), ping, TPS do servidor (host), memória JS aproximada. Canto direito: renderer (GPU via WEBGL_debug_renderer_info se disponível), resolução. `F3+B` mostra caixas de colisão; `F3+G` mostra bordas de chunk; `F3+A` recarrega todos os chunks (re-meshing).

### 5.9 Assets procedurais desta fase

**MC01-RF-080 (P0) — Texturas procedurais.** Um gerador de texturas em código cria, na inicialização, uma textura 16×16 para cada face de cada bloco registrado, com estilo pixel art coerente (paletas curtas de 4–8 tons, ruído pontilhado, padrões característicos: grama com borda lateral verde "escorrendo" sobre terra, pedra com manchas cinzas, tábuas com veios e divisões horizontais a cada 4 px, tronco com anéis no topo e casca vertical nos lados, minérios = pedra + manchas coloridas, folhas com buracos transparentes, vidro com moldura e reflexo diagonal, lã com textura de tecido). Mesmo seed visual sempre (não muda entre sessões). As texturas vão para um **atlas** ou **array de texturas** (preferível WebGL2 `TEXTURE_2D_ARRAY` para suportar greedy meshing e mipmaps sem sangramento).

**MC01-RF-081 (P0) — Skin genérica.** Gerar por código uma skin 64×64 no layout padrão de skins humanoides (cabeça 8×8×8, tronco 8×12×4, braços 4×12×4, pernas 4×12×4, com camada externa opcional). A skin padrão é um personagem **original** ("Explorador": cabelo castanho, camiseta azul-petróleo, calça cinza escuro, botas marrons) — **não** reproduzir personagens existentes. Cada jogador pode alternar entre 4 variações de cor para diferenciação. O modelo do jogador é montado com cubos com UV dessa skin e esqueleto simples (cabeça, corpo, braço D/E, perna D/E) — o PRD 10 permite substituir por GLB com animações.

**MC01-RF-082 (P0) — Porta de assets.** O gerenciador de assets expõe uma resolução única para qualquer visual: dado o tipo e o id do alvo, devolve qual fonte usar (asset enviado ou procedural) e os dados correspondentes. Nesta fase sempre retorna procedural; a consulta a `AssetBinding` já existe e é feita, retornando vazio.

---

## 6. Constantes globais (tabela de referência para todos os PRDs)

| Constante | Valor |
|---|---|
| TPS | 20 |
| Duração do dia | 24.000 ticks (20 min reais) |
| Altura do mundo | 0–255 |
| Nível do mar | 63 (água até Y=62 inclusive) |
| Tamanho do chunk | 16×256×16; seções 16³ |
| Random tick | 3 blocos aleatórios por seção carregada por tick |
| Autosave | 900 ticks |
| Distância de visão | 2–32 chunks (padrão 8; máximo prático no navegador 16, acima disso experimental) |
| Raio de spawn | 10 blocos |
| Tempo de vida de item solto | 6.000 ticks |
| Atraso de coleta de item | 10 ticks (40 ticks quando jogado pelo jogador — PRD 06) |
| Limite de caracteres de chat | 100 |

---

## 7. Requisitos não funcionais

**MC01-RNF-001 (P0) — Desempenho.** Em notebook intermediário (GPU integrada recente), distância 8: ≥ 60 FPS estáveis andando; picos de quadro < 33 ms ao carregar chunks novos. Em distância 12 com GPU dedicada: ≥ 60 FPS.

**MC01-RNF-002 (P0) — Meshing fora da thread principal.** Construir a malha de uma seção ≤ 4 ms no worker em média. Remeshing após quebrar/colocar bloco visível em ≤ 1 quadro de atraso perceptível (prioridade máxima na fila; remeshar também a seção vizinha quando o bloco está na borda).

**MC01-RNF-003 (P0) — Draw calls.** No máximo 1 malha por seção por "camada de render" (opaca, recorte, translúcida). Frustum culling por seção. Seções vazias ou totalmente cercadas não geram malha.

**MC01-RNF-004 (P0) — Memória.** Distância 8 com ~300 chunks carregados no cliente: uso de memória JS < 1,5 GB. Descarregar e liberar buffers da GPU (`dispose`) de malhas removidas — vazamento de geometria é bug P0.

**MC01-RNF-005 (P0) — Rede.** Banda de movimento ≤ 5 KB/s por jogador em regime. Envio inicial de chunks compactado. Latência de bloco quebrado aparecer para o outro jogador ≤ ping + 50 ms.

**MC01-RNF-006 (P0) — Robustez.** Mensagem de rede malformada nunca derruba o servidor (validar tamanho/tipo, descartar e registrar). Exceção em um sistema durante o tick é capturada e registrada; o servidor continua.

**MC01-RNF-007 (P0) — Precisão numérica.** Renderização relativa à câmera (origem flutuante): posições de malha relativas à origem do chunk e a câmera reposicionada para evitar tremedeira longe de (0,0).

**MC01-RNF-008 (P1) — Logs.** Painel de logs acessível por tecla (F12 do navegador já basta) com prefixos `[Servidor]`, `[Rede]`, `[Mundo]`, `[Assets]`. Nível de log configurável.

**MC01-RNF-009 (P0) — Versão de build.** Toda build tem um identificador (data/hora ou hash) mostrado no menu e no F3, usado na verificação de compatibilidade da sala.

**MC01-RNF-010 (P0) — Segurança mínima.** Mesmo sendo privado: regras de acesso das Entities impedem um usuário de ler mundos não compartilhados. Credenciais de TURN não são hardcoded no código cliente público se puderem ser geradas por Backend Function (credenciais temporárias); se não for possível, ficam em configuração privada do app.

---

## 8. Fluxos de ponta a ponta (devem funcionar ao final do PRD 01)

1. **Jogar sozinho:** abrir app → login → Um Jogador → Criar novo mundo (seed "teste") → carregar → andar, pular, correr, quebrar e colocar blocos → Esc → Salvar e sair → reabrir o mundo → tudo que foi construído está lá, jogador na mesma posição.
2. **Abrir para amigo:** host joga → Esc → Abrir para amigo → código aparece.
3. **Entrar:** amigo → Multijogador → vê a sala na lista ou digita código → conecta → aparece no mundo; ambos se veem, veem nome sobre a cabeça, andam e veem a animação do outro, quebram/colocam blocos e o outro vê em tempo real; conversam no chat.
4. **Hospedagem alternada:** host sai → no dia seguinte, o amigo abre o **mesmo** mundo como host (mundo compartilhado) → as construções do dia anterior estão lá.
5. **Seed determinístico:** dois mundos criados com o mesmo seed por usuários diferentes têm o terreno idêntico nas mesmas coordenadas.

---

## 9. Critérios de aceite (Definition of Done do PRD 01)

- **MC01-CA-01** Todos os fluxos da seção 8 funcionam sem erros no console.
- **MC01-CA-02** A física bate com os valores da seção 5.4: pular sobe ~1,25 bloco (não sobe 2 blocos, sobe 1 bloco); correr-pular atravessa um vão de 4 blocos; andar agachado não cai de bordas.
- **MC01-CA-03** Quebrar e colocar blocos rapidamente, inclusive em bordas de chunk, nunca deixa "buracos" visuais nem faces faltando.
- **MC01-CA-04** Com dois jogadores, 10 minutos de jogo contínuo sem dessincronização de blocos (conferir com F3+A em ambos: mesmo mundo).
- **MC01-CA-05** FPS e memória dentro do RNF-001/004 após 10 minutos voando em linha reta no criativo.
- **MC01-CA-06** Matar a aba do host: convidado recebe a tela de conexão perdida em ≤ 15 s; ao reabrir, perda máxima de 45 s de progresso.
- **MC01-CA-07** Nenhum uso de `Math.random()` em geração de mundo (revisar).
- **MC01-CA-08** Nenhuma lógica de regra de jogo apenas no cliente (revisar: quebrar, colocar, inventário passam pelo servidor).
- **MC01-CA-09** Texturas procedurais nítidas (sem filtro linear) e coerentes em todos os blocos da lista RF-020.
- **MC01-CA-10** A estrutura de registros permite adicionar um bloco novo apenas com dados (testar adicionando "Tijolos" (45) sem tocar no mesher ou no gerador).

---

## 10. Plano de testes manuais rápidos

| Teste | Como | Esperado |
|---|---|---|
| Pulo | Pular parado ao lado de muro de 2 blocos | Não sobe |
| Degrau | Andar contra 1 bloco | Precisa pular (step 0,6 < 1) |
| Borda agachado | Andar agachado para fora de um pilar de 10 blocos | Não cai |
| Borda de chunk | F3+G, quebrar blocos na linha da borda | Faces vizinhas aparecem corretamente nos dois chunks |
| Quebra criativa | Segurar clique | 4 blocos por segundo |
| Persistência | Construir torre, sair, voltar | Torre lá |
| Rede | Amigo quebra bloco | Some para você em < ping+50 ms |
| Interpolação | Amigo corre em círculos | Movimento suave sem teletransportes |
| Coordenadas negativas | Ir a (−1000, y, −1000) e construir | Sem erros de índice; blocos no lugar certo |

---

## 11. Riscos e trade-offs

| Risco | Impacto | Mitigação exigida |
|---|---|---|
| CGNAT impede P2P | Amigo não conecta | TURN configurável obrigatório; teste de conectividade na tela Multijogador (mostra se o caminho foi direto, STUN ou TURN) |
| Limites de tamanho/taxa das Entities | Saves falham | Compressão, lote, migração para arquivos de região (RF-062), retry com backoff exponencial, fila persistente de saves pendentes |
| Host com máquina fraca | Servidor e cliente no mesmo navegador competem | Servidor em Worker separado; orçamento por tick; monitor de TPS no F3 |
| Base44 gerar código que re-renderiza React por quadro | FPS despenca | Regra explícita na seção 3.3; HUD lê estado em frequência limitada |
| Greedy meshing vs luz por vértice | Artefatos visuais no PRD 02 | Começar com culling por face + quads por face; greedy apenas como otimização opcional quando luz/AO/textura forem idênticas |
| Diferenças de ponto flutuante entre máquinas | Gerador diverge | Gerador usa apenas operações determinísticas; evitar dependência de `Math.sin` em hashes (usar hash inteiro) |

---

## 12. Referências de estudo (open source) — usar como inspiração, respeitando licenças

| Projeto | O que estudar | Licença |
|---|---|---|
| **noa-engine** (fenomas) | Organização de chunks, meshing, física voxel, raycast; usado em jogos multiplayer voxel no navegador | MIT |
| **minecraft-threejs** (vyse12138) | Estrutura simples de three.js + TypeScript com mundo infinito e save | Verificar no repositório |
| **Minecraft-Javascript-Edition** (ashish0kumar) | Chunks, picking de bloco e controles de câmera em three.js | MIT |
| **PrismarineJS / minecraft-data** | **Tabelas de dados da 1.8** (blocos, itens, receitas, entidades, biomas, materiais, efeitos) em JSON — fonte excelente para os números exatos | MIT |
| **Luanti (ex-Minetest)** | Arquitetura cliente/servidor de jogo voxel, mapgens, ABMs | LGPL (estudo apenas) |
| **Kenney Voxel Pack** | Texturas/itens/personagens para sandbox, alternativa inicial aos procedurais | CC0 |

**Política de assets:** o jogo não embute arquivos do jogo original no código. Os assets entram por três caminhos: (1) gerados por código (padrão), (2) enviados pelos devs no Studio (GLB/PNG/OGG), (3) **importados pelos próprios devs a partir da instalação deles do Minecraft 1.8.9** com o importador de pacote de recursos (PRD 10). Como o projeto é privado (só os dois jogam), os três caminhos são permitidos.

### 12.1 Código de referência obrigatório (pasta "mind-cave-codigo-referencia")
Junto com os PRDs existe uma pasta com **código-fonte original de projetos open source**, com as licenças. A IA executora **não deve reinventar** os sistemas abaixo: deve portar a lógica, os valores e a ordem de operações desses arquivos.

| Sistema deste PRD | Pasta de referência | Exigência |
|---|---|---|
| Física do jogador (RF-030 a RF-034) | 02-fisica | Portar a física completa por tick (gravidade, arrasto, atrito, pulo, step, água, lava, escadas, colisão com as formas reais dos blocos). O **mesmo código** roda no servidor e na predição do cliente |
| Loop de 20 ticks e envio de posição | 03-multiplayer-ticks-e-interpolacao (mineflayer) | Mesmo ritmo do cliente original: 1 passo de física por tick de 50 ms, envio de posição/rotação a cada tick quando mudou e a cada 20 ticks mesmo parado, aceitação de correção do servidor |
| Interpolação, predição e reconciliação (RF-034, RF-055) | 03-multiplayer-ticks-e-interpolacao (snapshot-interpolation e minecraft-renderer) | Buffer de snapshots com tempo do servidor, interpolação de entidades remotas, reconciliação do jogador local com reaplicação de inputs — é o que impede o outro jogador de aparecer "bugado" |
| Meshing e render (RF-010, RF-080, RNF-002/003) | 09-renderizacao-e-meshing | Meshing em Web Worker, oclusão de seções, origem flutuante |
| Formas de colisão e dados dos blocos | 04-dados-1.8.9 e 02-fisica/minecraft-data-1.8 | Usar as tabelas da 1.8 como fonte dos números |

---

## 13. Instruções para a IA executora

1. Leia este PRD inteiro antes de começar. Construa **todas as camadas** em versão mínima, de ponta a ponta, antes de polir qualquer uma.
2. Ordem sugerida de entrega interna: núcleo/registros → gerador básico → mundo do servidor + loop 20 TPS (loopback) → meshing em worker + render → jogador/física/predição → interação com blocos → persistência → UI/menus → WebRTC + sinalização → chat/comandos/F3.
3. Não crie atalhos que violem os princípios da seção 0.2 (ex.: aplicar quebra de bloco direto no cliente sem passar pelo servidor) "só para funcionar agora": os próximos 11 PRDs dependem disso.
4. Todo número desta especificação deve estar centralizado nas constantes/registros, nunca espalhado.
5. Ao final, deixe um painel "Sobre o build" (no menu Opções → Sobre ou no F3) que lista quais PRDs estão implementados: `PRD-01 ✔`.
