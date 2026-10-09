# MIND CAVE — PRD 15
# Online: Abrir Mundo para LAN (Aberto para Todos), Lista de Mundos Online, Conexão, Permissões e Chat Completo

| Campo | Valor |
|---|---|
| Depende de | PRD 01 (§5.6 multiplayer básico), PRD 03 (§10 rede), PRD 12 (reconexão, troca de host), PRD 13 (pacotes) |
| Tipo | Consolida e completa tudo que é "online". Onde houver diferença com PRDs anteriores sobre salas, entrada no mundo ou chat, **vale este PRD**. |
| Objetivo | Deixar o online com a mesma experiência do Minecraft 1.8.9 ("Abrir para LAN" e lista de servidores), só que funcionando pela internet: qualquer mundo pode ser **aberto para todos** os usuários do app, aparece sozinho na lista "Mundos online", entra com um clique, e o chat funciona igual ao do Minecraft com extras úteis para dois amigos. |

> Documento de requisitos. Código de referência em "mind-cave-codigo-referencia/11-conexao-webrtc-e-chat" (conexão WebRTC e "abrir servidor local para outros", lista de servidores e chat) e "05-hud-e-ui" (chat com formatação).

---

## 0. Como o online funciona (visão geral)

1. **Quem abre o mundo é o host.** O navegador do host roda o servidor do mundo (o "servidor integrado", igual ao Minecraft quando você abre para LAN).
2. **O Base44 é o saguão (lobby).** Quando o mundo é aberto, ele vira um registro **Sala** no Base44 com nome, host, jogadores, versão e status. Como as Entities do Base44 têm atualização em tempo real, a lista "Mundos online" de todos os usuários atualiza sozinha.
3. **A conexão em si é direta (P2P).** Ao clicar em Entrar, os dois navegadores trocam uma "apresentação" (oferta, resposta e candidatos de rede) pelo Base44 e depois falam **direto** por WebRTC — o jogo (movimento, blocos, chat, entidades) não passa mais pelo Base44. Se a internet de algum dos dois bloquear conexão direta (CGNAT), o tráfego passa por um servidor **TURN** (PRD 01 §3.2).
4. **O mundo continua salvo na nuvem.** O host salva no Base44; quando ele sai, o mundo fecha (como a LAN), e qualquer um com acesso pode reabrir depois — ou assumir na hora (troca de host, PRD 12).

---

## 1. Visibilidade de um mundo

**MC15-RF-001 (P0) — Três níveis de visibilidade.**

| Visibilidade | Quem vê na lista "Mundos online" | Como entra |
|---|---|---|
| **Privado** | Ninguém (mundo não é aberto) | — |
| **Somente com código** | Ninguém na lista | Digitando o código de 6 caracteres |
| **Aberto para todos (LAN pública)** | **Todos os usuários do app** | Clicando na lista (ou pelo código) |

Opcional em qualquer nível aberto: **senha do mundo** (pedida ao entrar) e **lista de permitidos** (só usuários escolhidos).

---

## 2. Onde se abre um mundo

**MC15-RF-010 (P0) — Ao criar o mundo.** A tela "Criar novo mundo" ganha a aba **Multijogador** com:
- Visibilidade ao abrir: Privado / Somente com código / Aberto para todos (padrão: **Aberto para todos**).
- **Abrir automaticamente ao entrar** (sim/não; padrão sim) — o mundo já vira sala assim que carrega.
- Modo de jogo dos convidados: Sobrevivência / Criativo / Aventura / Espectador / "Igual ao meu".
- Permitir comandos para convidados (sim/não).
- PvP (sim/não), máximo de jogadores (1–16, padrão 8), senha (opcional).
- Mensagem do mundo (MOTD) — uma linha com cores § mostrada na lista.

**MC15-RF-011 (P0) — No menu de pausa: "Abrir para LAN".** Igual à tela do 1.8.9 ("Configurações do mundo para outros jogadores"): **Modo de jogo para os outros jogadores**, **Permitir comandos**, botão **"Abrir mundo"** e **Cancelar** — mais os campos Mind Cave: Visibilidade, Senha, Máximo de jogadores, MOTD. Ao abrir: mensagem no chat "Mundo aberto. Código: **XXXXXX** — visível para todos" (clicável para copiar). Enquanto aberto, o botão vira **"Configurações da sala"** (alterar tudo ao vivo) e **"Fechar para outros"** (desconecta convidados com aviso de 10 s, salva os dados deles).

**MC15-RF-012 (P0) — Nas Opções: Multijogador.** Novas opções por usuário (PRD 03 §10):
- **Abrir meus mundos automaticamente** (padrão: ligado) com a visibilidade padrão.
- **Aparecer como online** (presença no menu: "Fulano está online / jogando 'Mundo X'").
- **Notificar quando um amigo abrir um mundo** (notificação no menu e, se a aba estiver em segundo plano, notificação do navegador).

**MC15-RF-013 (P0) — Comando `/publish`.** O comando da 1.8.9 para abrir para LAN também funciona (abre com as configurações padrão), além de `/close` (Mind Cave) para fechar.

---

## 3. Tela "Multijogador" (lista de mundos online)

**MC15-RF-020 (P0) — Layout como a lista de servidores da 1.8.9.** Cada linha mostra:
- **Ícone 64×64** do mundo (captura automática da visão do host ao abrir, atualizada a cada 10 min);
- **Nome do mundo** e **MOTD** (2 linhas, com cores §);
- **Host** (nome e skin pequena), **modo de jogo**, **jogadores x/máx** (passar o mouse mostra os nomes);
- **Barras de ping** (medidas por uma troca rápida de mensagens com o host quando a lista abre; enquanto mede, barras animadas como na 1.8);
- Selos: 🔒 senha, "Cheio", "Versão diferente" (vermelho, não deixa entrar), "Hardcore".

**MC15-RF-021 (P0) — Seções da tela.**
- **Mundos online** — todas as salas abertas para todos (e as de amigos permitidos), atualização em tempo real; some da lista em ≤ 45 s se o host cair (heartbeat a cada 15 s, PRD 01).
- **Meus favoritos** — mundos salvos com "Adicionar favorito" (por mundo, não por sala: se o mundo reabrir com outro código, continua o mesmo favorito).
- Botões: **Entrar**, **Entrar com código**, **Atualizar**, **Adicionar favorito / Remover**, **Testar conexão** (PRD 03 RF-090), **Voltar**.
- Duplo clique numa linha = Entrar.

**MC15-RF-022 (P1) — Presença no menu principal.** Pequeno painel no canto do menu: amigos online e o que estão fazendo ("no menu", "jogando 'Mundo X' — Entrar"), com botão para entrar direto.

---

## 4. Entrar num mundo (fluxo e mensagens)

**MC15-RF-030 (P0) — Tela de conexão com etapas visíveis.**
1. "Conectando ao host…" (cria a apresentação no Base44)
2. "Negociando conexão… (direta / STUN / TURN)" — mostra a rota quando definida
3. "Fazendo login…" (versão do build, senha, permissões)
4. "Baixando assets do host… 12/30" (PRD 10 RF-012, em paralelo)
5. "Carregando terreno…" (chunks em espiral, PRD 13)
Botão **Cancelar** em qualquer etapa.

**MC15-RF-031 (P0) — Erros com mensagem clara (PT-BR).**

| Situação | Mensagem |
|---|---|
| Host fechou o mundo antes | "Este mundo não está mais aberto." |
| Sem resposta em 15 s | "Não foi possível conectar ao host. Tente novamente ou verifique o servidor TURN nas Opções → Multijogador." |
| Versão diferente | "Versões diferentes: o host está no build X e você no Y. Atualizem a página." |
| Senha errada | "Senha incorreta." (3 tentativas por minuto) |
| Sala cheia | "O mundo está cheio (8/8)." |
| Não permitido | "Você não está na lista de permitidos deste mundo." |
| Banido | "Você foi banido deste mundo: motivo." |
| Conexão caiu durante o jogo | Tela de reconexão do PRD 12 RF-001 |

**MC15-RF-032 (P0) — Primeiro login num mundo.** O convidado nasce no spawn do mundo (raio de 10) com o modo definido pelo host; nas próximas vezes volta onde estava (dados por jogador no mundo). Mensagem para todos: "*Fulano* entrou no jogo" (amarelo).

---

## 5. Permissões, operadores e moderação

**MC15-RF-040 (P0) — Papéis.** **Host** (dono da sessão, operador nível 4), **operadores** (definidos pelo host), **convidados**. Convidados só usam comandos se "Permitir comandos" estiver ligado ou se forem operadores.

**MC15-RF-041 (P0) — Comandos de servidor da 1.8.9.** `/list`, `/kick <jogador> [motivo]`, `/ban <jogador> [motivo]`, `/pardon <jogador>`, `/banlist`, `/whitelist on|off|add|remove|list`, `/op <jogador>`, `/deop <jogador>`, `/publish`, `/save-all`, `/save-on`, `/save-off`, `/setidletimeout <minutos>`, `/defaultgamemode`. Listas (ops, banidos, permitidos) salvas **no mundo**.

**MC15-RF-042 (P0) — Menu de jogador.** Na lista Tab, clique direito no nome (host/op): Teleportar até, Trazer até mim, Mudar modo de jogo, Tornar operador, Expulsar, Banir, Silenciar no chat.

---

## 6. Chat completo

### 6.1 Comportamento igual à 1.8.9

**MC15-RF-050 (P0) — Base.**
- **T** abre, **/** abre com a barra, **Esc** fecha, **Enter** envia; até **100 caracteres** por mensagem.
- Mensagens aparecem no canto inferior esquerdo, ficam **10 s** e desvanecem; com o chat aberto, histórico rolável (**100 mensagens**), roda do mouse rola.
- **↑/↓** navegam pelas mensagens que você enviou.
- **Tab** autocompleta nomes de jogadores e comandos/argumentos (PRD 12 RF-020).
- Formatação **§** e cores; links da web clicáveis com confirmação (opções do PRD 03 §9).
- Clicar no nome de um jogador numa mensagem preenche `/tell Nome `.
- Mensagens de sistema: entrou/saiu, mortes, conquistas, resultados de comandos (cinza), avisos do servidor.

**MC15-RF-051 (P0) — Comandos de chat da 1.8.9.** `/tell` (`/msg`, `/w`) mensagem privada (cinza-itálico "Fulano sussurra para você: …"), `/me` (ação em terceira pessoa "* Fulano dança"), `/say` (mensagem do servidor, só operadores), `/tellraw` e `/title` (PRD 12).

### 6.2 Extras Mind Cave (pensados para dois amigos)

| Recurso | Comportamento |
|---|---|
| **Responder** | `/r mensagem` responde ao último sussurro |
| **Menção** | Escrever o nome do outro (ou @nome) destaca a mensagem em amarelo para ele e toca um "ding" |
| **Digitando…** | Indicador discreto "Fulano está digitando…" acima do chat |
| **Mensagem com coordenadas** | Botão/atalho que insere "[X, Y, Z]" clicável — clicar mostra um marcador temporário no mundo (waypoint por 60 s) |
| **Item na mensagem** | Shift+clique num item do inventário com o chat aberto insere o nome do item; passar o mouse mostra o tooltip |
| **Horário** | Carimbo de hora opcional (PRD 03) |
| **Notificação** | Aba em segundo plano: título da aba pisca e (opcional) notificação do navegador para menções e sussurros |
| **Silenciar** | `/ignore <jogador>` e `/unignore` (local) |
| **Anti-flood** | Mais de 5 mensagens em 2 s: aviso "Calma aí!" e bloqueio de 3 s (sem expulsar) |
| **Histórico do mundo** | As últimas 500 mensagens públicas de cada mundo são salvas; ao entrar de novo, aparecem as últimas 20 em cinza ("antes de você entrar") |
| **Emotes no chat** | Usar um emote (PRD 07 §6b) gera opcionalmente "* Fulano fez Twerk" |

**MC15-RF-052 (P1) — Chat do saguão.** No menu Multijogador, um chat simples entre os usuários do app **fora de qualquer mundo** (para combinar "abre o mundo aí"), feito com Entities do Base44 em tempo real (mensagens curtas, guardadas por 7 dias). Não passa pelo WebRTC.

**MC15-RF-053 (P0) — Rede do chat.** Dentro do mundo, o chat viaja pelo canal confiável do WebRTC (PRD 01 RF-053) e é validado pelo servidor (tamanho, flood, permissões de comando); o servidor difunde a todos e registra no log. Mensagens nunca são perdidas numa reconexão curta (fila de reenvio).

---

## 7. Rede: requisitos de conexão

- **MC15-RF-060 (P0)** Sinalização pelo Base44 com expiração (60 s), limite de taxa e limpeza automática (PRD 12 RF-071).
- **MC15-RF-061 (P0)** Ordem de tentativa: direta → STUN → TURN, com a rota usada mostrada na tela de conexão, no Tab e no F3.
- **MC15-RF-062 (P0)** Dois canais: confiável/ordenado (chat, blocos, inventário, chunks) e não confiável (movimento) — PRD 01 RF-053; formato e ritmo de pacotes do PRD 13 §6.
- **MC15-RF-063 (P0)** Vários convidados: o host mantém uma conexão por convidado (até o máximo da sala); o servidor difunde a cada um só o que está no raio dele.
- **MC15-RF-064 (P0)** Referência: "11-conexao-webrtc-e-chat/simple-peer" (conexão WebRTC com troca de sinais) e "11-conexao-webrtc-e-chat/minecraft-web-client" (abrir o servidor local para outros jogadores, lista de servidores, chat).

---

## 8. Entities do Base44 envolvidas

| Entity | Uso neste PRD |
|---|---|
| **Room** | + visibilidade, senha (hash), MOTD, ícone (URL), modo dos convidados, permitir comandos, PvP, jogadores (nomes), máximo, versão, último heartbeat |
| **Signal** | Apresentação WebRTC (oferta, resposta, candidatos) com expiração |
| **Presence** | Usuário, status (menu / jogando), mundo atual, último sinal de vida |
| **WorldServerLists** (dentro do mundo) | Operadores, banidos (com motivo), permitidos |
| **LobbyMessage** | Chat do saguão (7 dias) |
| **WorldChatLog** | Últimas 500 mensagens públicas por mundo |

Regras de acesso: salas "Aberto para todos" legíveis por todos os usuários do app; demais só por permitidos/dono. Senhas nunca guardadas em texto puro.

---

## 9. Critérios de aceite

- **MC15-CA-01** Criar um mundo com "Aberto para todos" e "Abrir automaticamente": o amigo vê o mundo aparecer na lista "Mundos online" em ≤ 3 s, com ícone, MOTD, ping e 1/8 jogadores, e entra com um clique.
- **MC15-CA-02** Num mundo privado, Esc → "Abrir para LAN" → escolher Criativo para os outros e Permitir comandos → o amigo entra em Criativo e consegue usar comandos.
- **MC15-CA-03** Mundo "Somente com código" não aparece na lista, mas o código funciona; com senha, a senha errada é recusada.
- **MC15-CA-04** "Fechar para outros" desconecta o amigo com aviso e salva os dados dele; o mundo some da lista em ≤ 45 s se o host fechar a aba.
- **MC15-CA-05** Chat: mensagens, `/tell`, `/r`, `/me`, menção com som, Tab para autocompletar, histórico com ↑/↓, links clicáveis e cores § funcionando para os dois.
- **MC15-CA-06** `/kick`, `/ban`, `/pardon`, `/whitelist`, `/op` funcionam e persistem no mundo.
- **MC15-CA-07** Entrar mostra as etapas da conexão e a rota (direta/STUN/TURN); com TURN configurado, a conexão funciona mesmo em rede com CGNAT.
- **MC15-CA-08** Chat do saguão funciona entre os dois sem nenhum mundo aberto.
