# MIND CAVE — PRD 25
# Multiplayer Visual: Lista de Jogadores (TAB), Ping/Latência, Render de Remotos e Scoreboard

| Campo | Valor |
|---|---|
| Depende de | PRD 15 (Online/LAN/Chat), PRD 03 (Teclas/Rede), PRD 12 (F3+R), PRD 07 (Animações) |
| Tipo | **Funcional. Corrige lacunas que fazem o multiplayer não parecer Minecraft.** Onde este PRD conflitar com PRDs anteriores sobre TAB, ping ou lista de jogadores, **vale este.** |
| Objetivo | Ao segurar TAB aparecer a lista de jogadores igual à 1.8.9 (cabeça + nome + ping), a latência ser medida de verdade, os outros jogadores aparecerem no mundo como bonecos (não fantasmas), e um scoreboard mínimo funcionar na lateral. |

> Codigo de referencia: `src/game/net/webrtc.js` (RTT/rota), `src/game/net/netManager.js` (move/BLOCK_CHANGE), `src/game/engine.js` (HUD/F3/onKey), `src/components/game/GameHud.jsx` (hotbar/F3), `src/game/settingsDefaults.js` (keys.playerList, device.showPing).

---

## 1. Lista de jogadores no TAB (MC25-RF-010 a 014)

**MC25-RF-010 (P0) — TAB segura = overlay da lista.**
- Segurar a tecla mapeada em `user.keys.playerList` (padrão `Tab`) mostra a lista; soltar esconde. Não é toggle.
- Impedir o TAB padrão do navegador (foco) enquanto no jogo. Ignorar se chat aberto ou inventário/pausa visível.
- Tecla remapeável em Opções → Controles → Multijogador → "Lista de jogadores" (já existe em `settingsDefaults.js:220`). Ao remapear, o overlay passa a responder à nova tecla.

**MC25-RF-011 (P0) — Layout fiel 1.8.9.**
- Fundo: retângulo semi-transparente escuro centralizado, largura até 80% da tela, com título no topo: `§e` + `worldName || "Mundo"` (ou MOTD se houver) + `§7 — TAB`.
- Cabeçalho em §7 logo abaixo: `Jogadores (N/M)` onde N = conectados, M = `room.maxPlayers`.
- Grade de nomes em colunas: 1 coluna até 10 jogadores, 2 colunas até 20, senão scroll vertical. Cada linha = cabeça 16×16 (face da skin 8×8 ampliada com `imageRendering: pixelated`) + nome em branco (§f) + barras de ping à direita.
- Ordem: host primeiro (com coroa `♔` ou `§6[HOST]§r`), depois alfabética.
- Offline/desconectado não aparece (sem "fantasma").

**MC25-RF-012 (P0) — Barras de ping (5 níveis).**
- Usar o sprite `gui/icons.png` 256×256, região `x=0..50, y=176, w=10, h=8` por nível (como no print do PRD 24).
- Mapeamento por RTT medido (ver RF-020):
  - 0 barras (cinza/x): sem medida ou > 600 ms / desconectado
  - 1 barra (vermelho): 300–600 ms
  - 2 barras (amarelo): 150–300 ms
  - 3 barras (amarelo claro): 75–150 ms
  - 4 barras (verde): 25–75 ms
  - 5 barras (verde cheio): ≤ 25 ms
- Animar barras "medindo..." (alternância 0→5) enquanto sem medida nos primeiros 3 s após entrar.
- `device.showPing` (padrão `true` em `settingsDefaults.js:89`): se `false`, esconder barras no TAB mas manter RTT medido para `F3+R`.

**MC25-RF-013 (P0) — Respeitar chat/pause.**
- Lista não abre se `engine.chatOpen === true` ou `engine.paused` com overlay de pausa, nem se `document.pointerLockElement !== canvas` e há GUI aberta. Soltar TAB fecha sempre.

**MC25-RF-014 (P1) — Sem lista = offline.**
- Sem `netManager` (mundo singleplayer sem sala aberta): segurar TAB não mostra nada (igual Minecraft singleplayer sem LAN). Não mostrar "0/8".

---

## 2. Medição real de ping/latência (MC25-RF-020 a 024)

**MC25-RF-020 (P0) — Ping/Pong no DataChannel confiável.**
- Cada peer envia `{ t: 'ping', id, ts }` a cada **1 s** pelo canal confiável (`reliableDc`). O outro responde imediatamente `{ t: 'pong', id, ts }` sem processamento.
- Ao receber `pong`, calcular `rtt = Date.now() - ts`. Guardar em `peer.rtt` + histórico de 10 amostras com **média móvel + mediana** (descartar maior/menor). Expor `peer.pingMs = Math.round(mediana)`.
- Sem resposta em 4 s: marcar `pingMs = null` (barras cinza). Reconectou → retomar 1 s.

**MC25-RF-021 (P0) — Onde a latência aparece.**
- (a) Barras do TAB (RF-012).
- (b) Lista "Mundos online" (`src/pages/Multiplayer.jsx`): cada linha já tem barras — preencher com `pingMs` medido por uma troca rápida ao listar (1 ping de prova).
- (c) `F3+R` (PRD 12 RF-004): linha `Ping: N ms · Jitter: J ms · Perda: P% · Rota: direct/stun/turn` — usar `webrtc.js:_checkRoute()` + RTT medido.
- (d) Tooltip opcional no TAB: `title="{pingMs} ms"` ao hover no nome.

**MC25-RF-022 (P0) — Sem overhead.**
- Mensagens `ping/pong` ≤ 40 bytes cada. Não entrar no snapshot delta nem no `bufferedAmount` do jogo. Se `reliableDc.bufferedAmount > 64 KiB`, pular o ping daquele segundo.
- Não medir ping pelo canal não confiável.

**MC25-RF-023 (P1) — Host também mede.**
- `NetHost.peers` guarda `rtt/pingMs` por peer. Host vê ping de cada convidado no TAB (host = `0 ms` local com coroa).

**MC25-RF-024 (P1) — API para o engine.**
- `netManager.getPing(peerId?) → number|null` e `netManager.getAllPings() → Map<peerId, pingMs>`. Usado pelo HUD e por `ChatUI` se quiser `Tab` autocomplete com latência.

---

## 3. Outros jogadores no mundo (MC25-RF-030 a 034)

**MC25-RF-030 (P0) — Boneco visível por peer.**
- Para cada `remotePlayer` (peer conectado), criar um `THREE.Group` com `buildPlayerModel()` (`src/game/playerModel.js`) na cena do `engine`. Reusar `applyThirdPersonPose()` e `SkinObject` (cabeça + corpo). Descartar GLB externo — usar procedural fiel.
- Posição: lerp suave `pos += (target - pos) * 0.3` por tick já existente em `netManager.js:316` — manter. Interpolação com `interpolationDelay` (device.*) quando configurado.
- Nome acima da cabeça: `createNametag(name)` (`src/game/nametag.js`) com fundo semi-transparente. Ocultar nametag do jogador local.
- Remover boneco ao desconectar (`peer close/failed`).

**MC25-RF-031 (P0) — Sincronia mínima.**
- Mensagem `move` já existe (`netManager.js:371` unreliable: `{ t:'move', x,y,z, yaw, pitch }`). Manter a cada **50 ms** (20 Hz) quando há movimento > 0.01 bloco ou rotação > 1°. Sem movimento: não enviar.
- Mensagem `BLOCK_CHANGE` já existe — manter. Adicionar `t:'anim', kind:'swing'|'hurt'` quando `startSwing`/dano, para o boneco remoto balançar braço/piscar vermelho.

**MC25-RF-032 (P0) — Colisão/leveza.**
- Entidades remotas não colidem com o jogador local nem bloqueiam colocação de bloco (`intersectsPlayer` ignora peers). Servem só como visuais. Não consomem `mob` AI.
- Distância de render de peers: respeitar `device.entityDistance` (0–500%).

**MC25-RF-033 (P1) — Estados visuais.**
- Agachado: se `sneaking` vier no `move`, aplicar `PLAYER.eyeSneak` no nametag e `crouch` no pose.
- Correndo/voando: se `sprinting/flying` vier, refletir no pose (pernas/parado).
- Morte: se `isDead` recebido, deitar modelo 90° e ocultar após 2 s (ou até respawn).

**MC25-RF-034 (P2) — Limite.**
- O host vê até `maxPlayers - 1` bonecos. Se houver mais peers que o limite (reconexão), os extras aparecem na lista mas sem boneco até liberar vaga (mensagem `§cSala cheia` já existe).

---

## 4. Scoreboard lateral mínimo (MC25-RF-040 a 043)

**MC25-RF-040 (P1) — Estrutura.**
- Objeto `world.scoreboard = { objective: string|null, display: 'sidebar'|null, lines: Array<{ name: string, score: number }> }` (máx. 15 linhas, nome até 32 chars, score inteiro).
- Render: coluna à direita da tela, sobre o mundo, fundo `rgba(0,0,0,0.35)` com título em §e + linhas `name: score` em branco, ordenadas por `score` desc (igual 1.8.9 `sidebar`).
- Escondido quando vazio ou `scoreboard` é `null`.

**MC25-RF-041 (P1) — Comandos.**
- `/scoreboard objectives add <nome> <criteria> [displayName]` — só `dummy` por enquanto; cria objetivo.
- `/scoreboard objectives setdisplay sidebar <nome>` — mostra. Sem nome = limpa.
- `/scoreboard players set <player> <objetivo> <score>` — define linha.
- `/scoreboard players reset <player> <objetivo>` — remove linha.
- `/scoreboard objectives remove <nome>` — remove tudo.
- Todos sincronizam via `{ t:'scoreboard', ... }` quando em multiplayer (host autoritário; convidados só renderizam).

**MC25-RF-042 (P2) — Sincronia multiplayer.**
- Host mantém `world.scoreboard`. Ao entrar, enviar snapshot `scoreboard` no pacote `init` (`netManager.js:113`). Mudanças difundidas com `broadcast({ t:'scoreboard', op, ... })`.
- Convidados não executam comandos de scoreboard sem `ops` (respeitar `room.ops` + `allowCommands`).

**MC25-RF-043 (P2) — Sem critério automático.**
- Só `dummy` (manual por comandos). Não implementar `health/deathCount/playerKillCount` neste PRD (isso vira PRD futuro).

---

## 5. Integracao com HUD/F3 e navegação (MC25-RF-050 a 052)

**MC25-RF-050 (P0) — `engine.onKey` passa a tratar TAB.**
- Em `engine.js:onKey(e, down)`, ao detectar `code === playerList` (de `settingsStore.get('user.keys').playerList`): `engine.playerListOpen = down; engine.emitHud();` e `e.preventDefault()`. Soltar zera.
- Incluir no `emitHud()`: `{ playerListOpen, players: netManager?.getAllPings() ?? [], pings: Map, scoreboard: world.scoreboard }` para o `GameHud` renderizar.

**MC25-RF-051 (P0) — `GameHud.jsx` renderiza os dois overlays.**
- `PlayerListOverlay` (condicional `hud.playerListOpen`) acima do crosshair/hotbar, sem bloquear cliques (`pointerEvents: none` exceto links). `ScoreboardSidebar` sempre no canto direito quando há dados.
- Ambos usam fonte `gui/font` do pacote quando disponível, senão fallback `font-mono`.

**MC25-RF-052 (P1) — F3 detalhado.**
- `F3` esquerdo já tem `XYZ/Block/Chunk/Facing/Light/Biome` — manter. Adicionar linha `Multiplayer: N jogadores · Ping host→você: P ms` quando `netManager` existir.
- `F3+R` (ou `F3` + área extra) mostra `Rota: direct/stun/turn` + `Jitter/Ping` quando `device.showNetIndicator` (já existe). Não mexer em `F3+A/B/G` existentes.

---

## 6. Testes e aceitacao (MC25-RF-060 a 064)

**MC25-RF-060 (P0) — Cenário TAB.**
1) Offline: segurar TAB → nada aparece. 2) Host + 1 convidado: ambos seguram TAB → veem 2 nomes, host com `[HOST]`, barras preenchidas após 1–2 s. Soltar esconde. Remapear TAB para `KeyY` → Y abre, TAB volta a tabular o navegador fora do canvas.

**MC25-RF-061 (P0) — Cenário ping.**
1) Abrir "Mundos online": barras preenchem após probe. 2) Durante o jogo, `F3` mostra `Ping: N ms`. 3) Desligar rede 5 s → barras ficam cinza, depois voltam.

**MC25-RF-062 (P0) — Cenário boneco remoto.**
1) Convidado anda/pula: host vê boneco se movendo com nametag. Bloco quebrado pelo convidado some para o host. Swing do convidado anima braço.

**MC25-RF-063 (P1) — Cenário scoreboard.**
`/scoreboard objectives add pontos dummy Pontos` → `/scoreboard objectives setdisplay sidebar pontos` → sidebar aparece com título. `/scoreboard players set Steve pontos 10` → linha `Steve: 10`. Convidado entra depois: já vê o scoreboard.

**MC25-RF-064 (P0) — Sem regressão.**
CT-ST-558 (movimento), CT-008 (chat) e CT-044 (LAN) continuam passando. Sem `console.error` novo ao segurar TAB ou desconectar.

---

## 7. Arquivos tocados

- `src/game/net/webrtc.js` — ping/pong + `getStats` rota já existe, só estender.
- `src/game/net/netManager.js` — `NetHost/NetClient` com `rtt/pingMs`, `getPing/getAllPings`, `broadcast scoreboard`, `send move` já existe.
- `src/game/engine.js` — `isAction('playerList')`, `playerListOpen`, `emitHud()` com players/pings/scoreboard.
- `src/components/game/GameHud.jsx` — compor `PlayerListOverlay` + `ScoreboardSidebar`.
- `src/components/game/PlayerListOverlay.jsx` — **novo** (TAB).
- `src/components/game/ScoreboardSidebar.jsx` — **novo** (sidebar).
- `src/game/scoreboard.js` — **novo** (estado + comandos).
- `src/game/commands.js` — rotear `scoreboard` subcomandos.
- `src/pages/Multiplayer.jsx` — barras de ping reais (reusar `getPing`).
- `mind-cave-prd/MindCave-PRD-25-multiplayer-visual-scoreboard-tab-ping.md` — este arquivo.

## 8. Fora do escopo (não fazer neste PRD)

- Critérios automáticos de scoreboard (`health`, `deathCount`).
- Bossbar, `belowName`, `list` display.
- Voice chat (PRD 12 RF-006).
- Skins reais por peer (usar procedural com cor por nome).
- Altura/latência por peer em ms no TAB além da barra (só `title` hover é OK).

---

## 9. Estimativa

| Fase | Esforço |
|---|---|
| TAB + ping (RF-010..024) | 30–45 min |
| Boneco remoto (RF-030..034) | 45–60 min |
| Scoreboard (RF-040..043) | 30–40 min |
| HUD/F3 + testes | 20–30 min |
| **Total** | **~2h30–3h** |
