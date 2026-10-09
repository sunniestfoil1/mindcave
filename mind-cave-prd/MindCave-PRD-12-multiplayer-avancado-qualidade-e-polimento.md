# MIND CAVE — PRD 12 de 12
# Multiplayer Avançado, Persistência Robusta, Comandos Completos, Conquistas e Estatísticas, Debug, Desempenho, Testes e Polimento Final

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–11 (todo o jogo) |
| Objetivo | Transformar o jogo completo num produto **estável, rápido e agradável de jogar a dois por horas**: rede resiliente (reconexão, troca de host, perda de pacotes), saves à prova de falhas (diário, backups, restauração), sistema de comandos completo da 1.8.9, conquistas e estatísticas, debug F3 completo e ferramentas de diagnóstico, otimizações de desempenho, suíte de testes automatizados e de regressão, tratamento de erros e polimento de UX. |
| Próximo | PRD 13 — Otimização de render, chunks e pacotes (corretivo) e PRD 14 — Geração de mundo corrigida |

> Documento de requisitos. Este PRD **não adiciona mecânicas grandes**: ele endurece, mede, testa e lapida tudo o que os PRDs 01–11 entregaram. Nenhuma mudança aqui pode alterar números de jogabilidade definidos antes.

---

## 1. Rede resiliente

**MC12-RF-001 (P0) — Reconexão transparente.** Se o canal WebRTC cair (troca de Wi-Fi, oscilação), o convidado vê "Reconectando… (n s)" por até **60 s**, com o mundo congelado visualmente; o host mantém a entidade do jogador **no mundo** (imóvel, invulnerável durante a janela) e, ao reconectar (nova negociação ICE pela sinalização do Base44), a sessão continua no mesmo estado (inventário, posição, janela aberta fechada com segurança). Após 60 s, desconexão normal com save.

**MC12-RF-002 (P1) — Troca de host (host migration).** Se o host sair ou cair, o convidado recebe "O host saiu. Assumir o mundo como host?" Ao aceitar: o jogo garante que o último save do host terminou (verifica a versão do `World`/chunks e o diário — RF-011), adquire o *lock* do mundo, abre o servidor integrado localmente com o estado salvo mais recente, cria nova sala e notifica o ex-host (que pode entrar como convidado ao voltar). Perda máxima aceitável: até o último autosave (45 s), reduzida pelo diário de operações.

**MC12-RF-003 (P0) — Qualidade de conexão.**
- Sincronização de relógio (estimativa de offset e RTT por pings a cada 2 s com filtro).
- Buffer de interpolação adaptativo ao *jitter* (50–300 ms).
- Extrapolação curta (até 200 ms) para entidades quando faltam pacotes, com correção suave.
- Detecção de perda no canal não confiável; estados críticos (dano, inventário, blocos) sempre no confiável.
- Compressão e **snapshots delta** de entidades (só campos que mudaram), quantização de posição/rotação, agregação de mensagens por tick num único pacote.
- Controle de fluxo: se a fila de envio do DataChannel passar de um limite (`bufferedAmount`), reduzir prioridade de chunks e entidades distantes antes de atrasar o jogador.
- **Gerência de interesse:** só enviar entidades/eventos relevantes para a distância e dimensão de cada convidado.

**MC12-RF-004 (P0) — Indicadores.** Ping no Tab (PRD 01), gráfico F3+R (ping, jitter, perda, banda in/out, tamanho da fila), aviso "Conexão instável" no canto quando perda > 5% ou jitter > 80 ms por 5 s, e a rota usada (direta/STUN/TURN).

**MC12-RF-005 (P1) — Simulador de rede (dev).** Com `devTools`: injetar latência, jitter, perda e limite de banda artificiais no transporte para testar o jogo em condições ruins (usado pelos testes da seção 9).

**MC12-RF-006 (P2) — Chat de voz por proximidade.** Áudio WebRTC entre os jogadores com volume pela distância no mundo (silêncio além de 48 blocos), abafado através de paredes (estimativa simples por blocos sólidos na linha), push-to-talk (tecla reservada no PRD 03) ou detecção de voz, indicador de quem está falando no Tab e sobre a cabeça. Desligável.

---

## 2. Persistência à prova de falhas

**MC12-RF-010 (P0) — Escrita atômica e versionada.** Todo save de chunk/jogador/mundo usa número de versão crescente e checksum; a leitura rejeita dados corrompidos (checksum inválido) e usa a versão anterior válida (manter **2 versões** de cada registro crítico: atual + anterior).

**MC12-RF-011 (P0) — Diário local (journal).** No host, cada mudança relevante desde o último autosave (blocos alterados, inventários, entidades com dados) é anotada num diário em IndexedDB. Se a aba fechar ou travar antes do autosave, ao reabrir o mundo o jogo **reaplica o diário** e envia para a nuvem ("Recuperando alterações não salvas… 132"). O diário é limpo após o save confirmado.

**MC12-RF-012 (P0) — Fila de saves com retentativa.** Falhas de rede/limite do Base44 não perdem dados: fila persistente, retentativa com *backoff* exponencial, indicador "Saves pendentes: N" no menu de pausa, bloqueio de "Sair" com aviso se houver pendências (com opção "Sair mesmo assim — salvar ao voltar").

**MC12-RF-013 (P0) — Backups.** Botão "Fazer backup agora" na lista de mundos e no menu de pausa; backup automático diário (ao primeiro acesso do dia) mantendo os **7 últimos**; backup = arquivo compactado (metadados + regiões modificadas + jogadores + vínculos de assets do mundo) enviado ao armazenamento de arquivos. Tela "Backups do mundo": listar, baixar, restaurar (cria uma cópia "Restaurado de <data>", nunca sobrescreve o atual sem confirmação), excluir.

**MC12-RF-014 (P1) — Exportar/importar mundo.** Exportar como `.zip` para o computador e importar de volta (útil para guardar versões fora do Base44). Versão de formato verificada e migrada.

**MC12-RF-015 (P0) — Migrações de formato.** Cada mudança de formato (chunk, jogador, configurações, itens customizados) tem migração explícita de `formatVersion` N → N+1, testada; mundos antigos abrem sem perda.

---

## 3. Comandos completos (1.8.9 + Mind Cave)

**MC12-RF-020 (P0) — Infraestrutura.** Analisador com tipos de argumento (coordenadas absolutas/relativas `~`, seletores, nomes de bloco/item/entidade com e sem `minecraft:`, JSON de dados, números com faixas), **autocompletar com Tab** (sugestões no chat), mensagens de erro claras em PT-BR, histórico, permissões (host = operador; convidados conforme a opção do PRD 03), registro em log (`logAdminCommands`).

**MC12-RF-021 (P0) — Seletores completos.** `@p`, `@a`, `@r`, `@e` com argumentos 1.8: `x,y,z`, `r`, `rm`, `dx,dy,dz`, `m` (modo), `c` (quantidade), `l`/`lm` (nível), `type` (com `!`), `name` (com `!`), `rx/rxm/ry/rym` (rotação), `team`, `score_<obj>`/`score_<obj>_min`.

**MC12-RF-022 (P0) — Lista de comandos.**

| Comando | Função |
|---|---|
| `/help [comando]` | Ajuda paginada |
| `/tp`, `/spreadplayers` | Teleporte / espalhar jogadores |
| `/gamemode`, `/defaultgamemode`, `/difficulty`, `/gamerule` | Modo, dificuldade e regras |
| `/time`, `/weather`, `/toggledownfall` | Tempo e clima |
| `/give`, `/clear`, `/replaceitem`, `/enchant`, `/xp` | Itens e experiência |
| `/effect`, `/kill`, `/summon`, `/entitydata` | Entidades |
| `/setblock`, `/fill`, `/clone`, `/testforblock`, `/testforblocks` | Blocos |
| `/spawnpoint`, `/setworldspawn` | Spawn |
| `/say`, `/me`, `/tell` (`/msg`, `/w`), `/tellraw`, `/title` | Mensagens e títulos |
| `/playsound`, `/particle` | Sons e partículas em posição |
| `/execute`, `/testfor`, `/stats`, `/trigger` | Execução condicional (1.8) |
| `/scoreboard` (P2) | Objetivos, times, exibição na lateral/Tab/abaixo do nome |
| `/worldborder` | Borda do mundo (1.8): centro, tamanho, transição no tempo, dano e aviso; render da borda como parede listrada translúcida quando perto |
| `/achievement give|take` | Conquistas |
| `/seed`, `/list` | Informações |
| `/locate`, `/lab …`, `/dragon respawn`, `/asset reload`, `/registry dump`, `/net sim …`, `/perf …`, `/backup` | Extensões Mind Cave (só com `devTools`) |

---

## 4. Conquistas e estatísticas

**MC12-RF-030 (P0) — Conquistas.** Árvore de conquistas no estilo da 1.8 (ícones ligados por linhas, tela rolável, desbloqueio com aviso "Conquista obtida!" no canto superior e mensagem no chat de todos). Conteúdo: **as metas equivalentes às da 1.8.9** (abrir inventário, coletar madeira, fazer bancada, picareta, fornalha, ferro, enxada, pão, bolo, picareta melhor, peixe, carrinho, espada, matar monstro, vaca, porco montando no penhasco, duelo de arco a 50 blocos, diamantes, ir ao Nether, devolver bola de fogo ao ghast, vara de blaze, suporte de poções, ir ao End, matar o dragão, mesa de encantamento, dar 9 corações de dano de uma vez, estantes, visitar todos os biomas, invocar e derrotar o Wither, sinalizador completo, reproduzir vacas, dar diamantes a outro jogador, maçã dourada encantada) — **com títulos e descrições escritos por nós em PT-BR**, mais conquistas Mind Cave: "Engenheiro de Guerra" (Bancada de Armeiro), "Primeiro Disparo", "Tiro na Cabeça", "Desarmando o Sapador", "Caçador de Elite" (matar Atirador de elite), "Estúdio Aberto" (primeiro asset vinculado), "Criador" (primeiro item customizado publicado), "Laboratório Completo" (visitar todas as áreas do Mapa 2). Por jogador e por mundo; persistidas.

**MC12-RF-031 (P0) — Tela de estatísticas.** Abas **Geral** (tempo jogado, distâncias por tipo, saltos, mortes, dano, mobs mortos, tempo desde a morte…), **Blocos** (minerados/usados/criados por bloco, ordenável), **Itens** (criados/usados/quebrados/coletados/jogados), **Mobs** (mortos por/mortos pelo), **Tecnologia** (PRD 09). Dados coletados desde o PRD 05. Comparação lado a lado com o outro jogador (extensão).

---

## 5. Debug e diagnóstico

**MC12-RF-040 (P0) — F3 completo.** Todas as linhas do PRD 01 + luz (céu/bloco/efetiva), bioma, dificuldade local, dimensão, tempo do dia/dia do mundo, fase da lua, contagem de entidades por tipo, partículas ativas, chunks em fila de geração/meshing/envio, memória da GPU estimada, draw calls e triângulos, modo de render/predefinição de shader, TPS e tempo médio de tick (min/méd/máx), pacotes/s in/out, rota de rede, build e PRDs implementados. Opção "Informações reduzidas" (PRD 03) esconde coordenadas.

**MC12-RF-041 (P0) — Atalhos F3 (1.8.9 + Mind Cave).**

| Atalho | Ação |
|---|---|
| F3+A | Recarregar todos os chunks (remeshing) |
| F3+B | Caixas de colisão (+ linha de visão) |
| F3+D | Limpar chat |
| F3+F | Alternar distância de visão (Shift+F3+F diminui) |
| F3+G | Bordas de chunk |
| F3+H | Tooltips avançados |
| F3+N | Alternar Criativo ↔ Espectador (operador) |
| F3+P | Pausar ao perder o foco (liga/desliga) |
| F3+T | Recarregar texturas/assets/pacotes |
| F3+Q | Lista de atalhos |
| F3+I | Debug de IA dos mobs (PRD 08) |
| F3+L | Debug de luz (sobreposição numérica de níveis de luz nos blocos próximos) |
| F3+R | Gráfico de rede (RF-004) |
| F3+S | Tempos por pass de render/shaders |
| Shift+F3 | Gráfico de pizza do perfilador (tempo de tick por sistema: entidades, IA/pathfinding, redstone, fluidos, luz, geração, rede, save) + gráfico de tempo de quadro |

**MC12-RF-042 (P0) — Console de desenvolvedor.** Tecla configurável (padrão `` ` ``) abre um console sobreposto com logs filtráveis por categoria/nível (`[Servidor]`, `[Rede]`, `[Mundo]`, `[Assets]`, `[IA]`, `[Redstone]`), execução de comandos e cópia de relatório.

**MC12-RF-043 (P0) — Tela de erro (crash) amigável.** Qualquer exceção não tratada no render, no worker do servidor ou na UI: (1) tenta **salvar o mundo** (host) e o diário; (2) mostra tela "Algo deu errado" com resumo, botão **"Copiar relatório"** (build, navegador, GPU, PRDs, últimas 200 linhas de log, pilha do erro, estado resumido do mundo) e **"Voltar ao menu"**; (3) o convidado recebe "O host teve um erro" e volta ao menu. Erros recuperáveis (asset falhou, mensagem malformada) nunca derrubam o jogo — só registram.

---

## 6. Desempenho

**MC12-RF-050 (P0) — Metas finais (com todos os sistemas ligados, 2 jogadores, mobs no limite).**

| Cenário | Meta |
|---|---|
| Notebook com GPU integrada, perfil Médio, distância 8, Clássico | ≥ 60 FPS médios, 1% low ≥ 40 |
| PC com GPU intermediária, perfil Alto, Shaders Alto, distância 12 | ≥ 60 FPS |
| Servidor do host com 2 jogadores, 150 mobs, redstone moderada | TPS 20, tick médio ≤ 25 ms |
| Memória do cliente após 2 h de jogo | Sem crescimento contínuo (vazamento) |
| Entrada no mundo (spawn pronto) | ≤ 8 s (Mundo Aberto) |

**MC12-RF-051 (P0) — Otimizações exigidas.**
- **Cave culling / grafo de visibilidade por seção** (como os mods de desempenho populares): pré-computar quais faces de cada seção 16³ "se enxergam" através de ar/transparentes e fazer busca em largura a partir da seção da câmera — não desenhar cavernas invisíveis.
- Frustum culling por seção e por entidade; ordenação de translúcidos só quando a câmera muda de seção.
- Pools de objetos/buffers (evitar alocação por quadro e picos de coleta de lixo).
- Upload de malhas à GPU com orçamento por quadro (PRD 03 "Atualizações de chunk por quadro").
- Instancing para mobs/itens/partículas iguais; atlas/array de texturas único para terreno.
- Simulação de entidades distantes com frequência reduzida (*tick throttling*) fora da distância de simulação de detalhes.
- Pathfinding com cache e orçamento; luz com fila em lote; fluidos com agendamento.
- Compressão e envio de chunks priorizados pelo cone de visão.
- (P2) **LOD de terreno distante** além da distância de visão (malhas simplificadas de baixa resolução só para silhueta), desligado por padrão.

**MC12-RF-052 (P0) — Benchmark embutido.** Comando/botão "Benchmark" que carrega um mundo de seed fixo, executa um voo de câmera gravado (60 s) com dia/noite, chuva, mobs e redstone, e gera um relatório (FPS médio, 1% low, tempo de quadro, tempo de tick, memória) para comparar builds — resultados guardados por build no Base44 para ver regressões.

---

## 7. Polimento de experiência

**MC12-RF-060 (P0) — Menus e transições.** Panorama do menu principal (cena 3D real do Mundo Aberto com seed bonita, trocando entre 3 locais), frases "splash" próprias (lista editável), telas de carregamento com **dicas** do Mind Cave, transições suaves (fade) entre menu/mundo/dimensões, sons de UI consistentes, foco de teclado/Esc coerente em todas as telas.

**MC12-RF-061 (P0) — Primeira execução.** Assistente rápido: escolher nome de jogador e skin, detectar desempenho (benchmark de 2 s do PRD 02), sugerir perfil de qualidade, testar conectividade (STUN/TURN) e explicar em uma tela os atalhos principais (inclui F7 Studio). Pode ser pulado.

**MC12-RF-062 (P0) — Créditos e "Sobre".** Tela de créditos (também usada após o Dragão — PRD 11) com nomes dos dois desenvolvedores (editáveis nas configurações do app), bibliotecas usadas e suas licenças, e **atribuições de assets** geradas automaticamente a partir das licenças cadastradas no Studio.

**MC12-RF-063 (P0) — Consistência de texto.** Todo texto visível vem dos arquivos de tradução (PT-BR completo, EN completo); revisão de termos (mesmo nome para o mesmo item em todo lugar), acentuação correta na fonte pixel.

**MC12-RF-064 (P1) — Acessibilidade revisada.** Checklist do PRD 03 aplicado a tudo que veio depois (legendas para sons de armas e chefes, "Reduzir flashes" para explosões, clarões de disparo e relâmpagos, filtros de daltonismo no HUD de munição e no indicador de dano).

**MC12-RF-065 (P0) — Manual do desenvolvedor no jogo.** Página "Manual do Dev" (dentro do Studio) explicando, com base no código real: como adicionar bloco, item, receita, mob, som, bioma, estrutura e comando; onde ficam as constantes; como rodar os testes e o benchmark; como gerar um backup; como configurar o TURN. Atualizada sempre que um sistema muda.

---

## 8. Segurança e privacidade (projeto privado)

- **MC12-RF-070 (P0)** App configurado como **privado** (apenas os usuários convidados do Base44 acessam). Regras de acesso das Entities revisadas: World, ChunkDelta, WorldPlayer, Backups e Assets legíveis só por dono + compartilhados.
- **MC12-RF-071 (P0)** Sinalização com limite de taxa e expiração; salas abandonadas limpas por Backend Function agendada.
- **MC12-RF-072 (P0)** Credenciais TURN de curta duração geradas por Backend Function (quando o provedor permitir), nunca fixas no código cliente.
- **MC12-RF-073 (P0)** Validação no servidor de todas as mensagens de rede (tamanhos, faixas, cadências) — mesmo entre amigos, para evitar que um bug num cliente corrompa o mundo.

---

## 9. Testes e garantia de qualidade

**MC12-RF-080 (P0) — Testes automatizados (unitários/integração).** Rodáveis por um comando de dev e no build:

| Grupo | O que verificar |
|---|---|
| Física | Altura do pulo ≈ 1,2522; velocidades de andar/correr/agachar; step 0,6; queda e dano `teto(d−3)` |
| Mineração | Tempos do PRD 06 CA-02 para combinações ferramenta × bloco × efeitos |
| Combate | Dano por arma, crítico ×1,5, armadura 4%/ponto, janela de invulnerabilidade de 10 ticks, knockback com sprint |
| Fome/XP | Exaustão por ação, curva de níveis, regeneração |
| Crafting | Todas as receitas do arquivo de dados produzem o resultado esperado; espelhamento |
| Geração | Hash de chunks fixos por seed (determinismo) |
| Luz | Cenários de tocha, buraco no céu, remoção de fonte |
| Fluidos | Alcance 7/3, fonte infinita, obsidiana/pedregulho/pedra |
| Redstone | Repetidor (atraso/trava), comparador (modos/leitura), tocha queimando, pistão 12 blocos, quasi-conectividade |
| Persistência | Salvar → carregar idêntico; migrações de formato; diário de recuperação |
| Rede | Serialização ida-e-volta de todas as mensagens; validação de mensagens inválidas |
| Itens/inventário | Todas as regras de clique; teste anti-duplicação com cliques concorrentes |
| Armas | Cadência, recarga, dispersão com semente, queda de dano |

**MC12-RF-081 (P0) — Testes de rede simulada.** Partida automatizada (dois clientes no mesmo navegador/abas, um como host) com latência 150 ms, jitter 40 ms e perda 3% por 10 minutos: zero dessincronização de blocos e inventários (comparação de hashes de estado ao final).

**MC12-RF-082 (P0) — Teste de resistência (soak).** 2 horas com dois jogadores (ou bots de teste que andam, mineram, constroem e lutam): sem vazamento de memória, TPS estável, saves contínuos.

**MC12-RF-083 (P0) — Checklist de regressão manual.** Documento vivo dentro do Manual do Dev com **todos os critérios de aceite dos PRDs 01–12**, marcáveis por build, para os dois devs passarem antes de considerar uma versão "boa".

**MC12-RF-084 (P0) — Bots de teste (dev).** `/bot spawn <comportamento>` cria um jogador falso controlado pelo servidor (andar aleatório, minerar túnel, construir torre, lutar com mobs) para testar multiplayer e desempenho sozinho.

---

## 10. Requisitos não funcionais

- **MC12-RNF-001 (P0)** Nenhum critério de aceite dos PRDs 01–11 pode regredir.
- **MC12-RNF-002 (P0)** Nenhum erro não tratado no console numa sessão de 1 h normal de jogo.
- **MC12-RNF-003 (P0)** Perda máxima de progresso em qualquer falha: zero com diário + save bem-sucedido; ≤ 45 s no pior caso documentado.
- **MC12-RNF-004 (P0)** Tempo de reconexão ≤ 10 s em condições normais.

---

## 11. Critério final de aceite do projeto ("Definition of Done" do Mind Cave)

- **MC12-CA-01 — Jornada completa a dois.** Os dois jogadores criam um Mundo Aberto em Sobrevivência Normal e, **em multiplayer**, sem comandos: sobrevivem à primeira noite, fazem ferramentas de ferro, encontram diamantes, fabricam armas na Bancada de Armeiro, enfrentam zumbis tecnológicos, constroem uma fazenda e uma porta de redstone, encantam e fazem poções, vão ao Nether e à fortaleza, localizam a fortaleza do End e **derrotam o Dragão do Ender** — com saves, reconexões e trocas de host acontecendo no meio, sem perda de progresso e sem bugs bloqueadores.
- **MC12-CA-02 — Laboratório.** No Mapa 2, os dois devs enviam um GLB novo, criam um item novo com receita e animações, testam no estande e veem tudo funcionar para ambos em tempo real.
- **MC12-CA-03 — Qualidade.** Testes automatizados passam; benchmark dentro das metas da RF-050; soak de 2 h sem vazamento.
- **MC12-CA-04 — Recuperação.** Fechar a aba do host no meio de uma construção e reabrir recupera tudo pelo diário; restaurar um backup de ontem gera uma cópia íntegra do mundo.

---

## 12. Fora do escopo (ideias para depois do PRD 12)

- Suporte a controle (gamepad) completo e versão para toque/celular.
- API de mods/plugins em JavaScript para os devs adicionarem conteúdo sem mexer no núcleo.
- Mais dimensões ou biomas próprios do Mind Cave; novos chefes tecnológicos.
- Servidor dedicado opcional (Node/Deno num servidor próprio) para manter o mundo ligado 24 h sem um host.
- Replays e câmera de gravação (*replay mod*).

---

## Apêndice — Matriz de rastreabilidade (onde cada pedido do projeto foi atendido)

| Pedido original | Onde |
|---|---|
| Base44 com banco de dados e tempo real | PRD 01 §3 (Entities + subscribe para sinalização/persistência; WebRTC P2P para o tempo real do jogo) |
| "Minecraft de verdade", versão 1.8.9 | Todos — princípio 0.2.1 do PRD 01; números 1.8.9 em cada PRD |
| Jogar com o amigo "como LAN", em tempo real | PRD 01 §5.6, PRD 07 §2, PRD 12 §1 |
| Dois mapas (mundo aberto + segundo mapa) | PRD 04 §8 (Mundo Aberto) e §9 (Mundo Plano Criativo / Laboratório) |
| Blocos de terra, grama, água etc. por código | PRD 01 §5.9, PRD 02 §2–5 e §11 |
| Modo shaders, predefinições, gráficos bonitos | PRD 02 §8, PRD 03 §5 |
| UI completa | PRD 02 §9 |
| Configurações de tudo (mouse, teclado, qualidade, com/sem sombra) | PRD 03 (inteiro; sombras em §4.3) |
| Área de trabalho / criar picareta, espada | PRD 06 (bancada de trabalho e ferramentas) + PRD 10 §7 (Criador de itens no Studio) |
| Animações da espada e movimentação | PRD 07 §5, PRD 10 §5 |
| Editor/visualizador de GLB, upar assets | PRD 10 |
| Skin genérica substituível por GLB | PRD 01 RF-081, PRD 03 §8, PRD 10 RF-053 |
| Armas com ferro e pólvora | PRD 09 §2–6 |
| Creepers, animais, zumbis | PRD 08 |
| Zumbis com tecnologia | PRD 09 §7 |
| Projetos open source como referência | PRD 01 §12 |
| Nome "Mind Cave" | Todos |
| Geração de mundo exata da 1.8.9 a partir de código aberto | PRD 04 seção 0 + pasta 01-geracao-de-mundo |
| Física exata (pulo, andar, correr) | PRD 01 seção 12.1 + pasta 02-fisica |
| Ticks e multiplayer sem jogador "bugado" | PRD 01 seção 12.1 + pasta 03-multiplayer-ticks-e-interpolacao |
| Todas as teclas e hotbar 1–9 | PRD 03 RF-060a + pasta 06-teclas-e-controles + tabela do 00-LEIA-ME |
| HUD oficial | PRD 02 RF-079 + pasta 05-hud-e-ui + importador do PRD 10 RF-075 |
| Animações do jogador e armaduras | PRD 07 RF-043 + pasta 07-animacoes-jogador-e-armaduras |
| Emotes estilo Fortnite na tecla P | PRD 07 seção 6b + pasta 08-emotes + PRD 10 RF-076 |
| Botão no canto para ver GLB, hitbox, visão do jogador e copiar JSON | PRD 10 RF-003 |
| Usar texturas originais do Minecraft | PRD 10 RF-075 (importação da própria instalação) |
