# MIND CAVE — PRD 05 de 12
# Sobrevivência e Ciclo de Jogo (Vida, Dano, Fome, XP, Morte, Camas, Dia/Noite, Clima, Fogo, Efeitos, Modos e Dificuldade)

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–04 |
| Objetivo | Transformar o mundo em um **jogo de sobrevivência real**, com as regras da 1.8.9: vida de 20 pontos, todas as fontes de dano, fome e saturação, regeneração, experiência e níveis, morte e renascimento, camas, ciclo de dia e noite, clima com chuva/neve/tempestade e raios, fogo que se espalha, efeitos de status, modos de jogo e dificuldades. |
| Próximo | PRD 06 — Inventário, Crafting e Itens |

> Documento de requisitos. Toda regra deste PRD roda **no servidor** (autoritativo) e é replicada aos clientes. O HUD (PRD 02) passa a exibir os valores reais.

---

## 1. Modos de jogo

**MC05-RF-001 (P0) — Modos (1.8.9).**

| Modo | Regras |
|---|---|
| **Sobrevivência** | Vida, fome, dano, quebra com tempo e ferramentas, drops, XP |
| **Criativo** | Invulnerável (exceto vazio e `/kill`), voo (duplo Espaço liga/desliga; Espaço sobe, Shift desce), quebra instantânea (espadas não quebram blocos no criativo), blocos infinitos, inventário criativo (PRD 06), sem fome |
| **Aventura** | Como Sobrevivência, mas **não quebra nem coloca blocos**, exceto com itens que tenham a permissão `PodeDestruir`/`PodeColocarEm` (dados de item 1.8) — útil para mapas de desafio |
| **Espectador** | Atravessa blocos, invisível para outros (aparece como cabeça translúcida para outros espectadores), voa, não interage; clicar numa entidade "entra" nela e vê pela câmera dela (Shift sai); hotbar substituída por menu de teletransporte para jogadores |
| **Hardcore** | Sobrevivência travada em Difícil; ao morrer, o jogador vira Espectador naquele mundo (com opção "Excluir mundo" para o dono) |

Troca por `/gamemode`, pelo menu do host e por `/defaultgamemode`. A troca é imediata e sincronizada.

## 2. Dificuldade

**MC05-RF-010 (P0) — Efeitos por dificuldade.**

| Aspecto | Pacífico | Fácil | Normal | Difícil |
|---|---|---|---|---|
| Monstros hostis | Não nascem e os existentes somem | Sim | Sim | Sim |
| Regeneração | +1 HP a cada 20 ticks e a fome **não** cai | Normal | Normal | Normal |
| Dano de mobs | — | Reduzido (≈ metade + 1) | Base | 1,5× |
| Fome até a morte | — | Para em 10 HP | Para em 1 HP | Pode matar |
| Veneno de aranha da caverna | — | Não envenena | 7 s | 15 s |
| Zumbis quebram portas | — | Não | Não | Sim |
| Chance de reforço de zumbi | — | 0 | baixa | maior |

**MC05-RF-011 (P0) — Dificuldade local (regional).** Como na 1.8: valor entre 0 e ~6,75 por região, combinando dificuldade global, **tempo habitado do chunk** (soma do tempo em que jogadores ficaram ali, salvo por chunk) e **fase da lua** (lua cheia aumenta). Mostrar no F3 ("Dificuldade local: X"). Usado pelo PRD 08/09 para chance de mobs com armadura/armas, encantamentos, capacidade de pegar itens e frequência de zumbis tecnológicos.

---

## 3. Vida e dano

**MC05-RF-020 (P0) — Vida.** 20 HP (10 corações). Máximo alterável por efeitos (Vigor). Absorção como camada extra dourada que é consumida primeiro.

**MC05-RF-021 (P0) — Janela de invulnerabilidade.** Após receber dano, o alvo tem **10 ticks** em que novos danos só se aplicam se forem **maiores** que o último (e aplicam apenas a diferença) — regra 1.8 que impede "spam" de dano e define o ritmo do combate. Exceções que ignoram a janela: vazio, `/kill`, fome (aplica normalmente por timer).

**MC05-RF-022 (P0) — Fontes de dano (1.8.9).**

| Fonte | Dano | Detalhes |
|---|---|---|
| Queda | `teto(distânciaQueda − 3)` | Distância acumulada enquanto cai; zerada ao tocar água, teia, escada de mão/trepadeira, slime (quica), feno não reduz na 1.8. Pular em água rasa (1 bloco) anula. Salto alto com Super Pulo reduz pelo nível. Pena-leve (PRD 11) reduz. Particulas de poeira e som de impacto (pequeno < 5, grande ≥ 5) |
| Vazio | 4 a cada 10 ticks abaixo de Y = −64 | Ignora armadura e invulnerabilidade |
| Afogamento | 2 por segundo após o ar acabar | Ar: 300 ticks (10 bolhas). Recupera rápido fora d'água. Respiração (encantamento) retarda |
| Sufocamento | 1 a cada 10 ticks | Cabeça dentro de bloco sólido opaco |
| Lava | 4 a cada 10 ticks + põe fogo | Resistência ao fogo anula |
| Fogo (no bloco de fogo) | 1 a cada 10 ticks | — |
| Queimando (em chamas) | 1 por segundo | Duração: lava 15 s após sair; fogo 8 s; água/chuva apagam |
| Cacto | 1 a cada 10 ticks ao encostar | Também destrói itens soltos |
| Fome | 1 a cada 80 ticks com fome 0 | Limite por dificuldade |
| Explosões | Por raio e exposição (fórmula 1.8: `((1 − d/2P)·exposição)`, dano = `(i² + i)/2 · 7 · 2P + 1`, onde *i* é o impacto) | Exposição = fração de raios livres de blocos entre o centro e a entidade; arremessa entidades |
| Raio | 5 + põe fogo | — |
| Bloco caindo (bigorna) | 2 por bloco de queda (máx. 40) | Danifica a bigorna |
| Ataques (mobs/jogadores) | PRD 07/08/09 | — |
| Magia | Dano instantâneo (6 × 2^(nível−1)), Veneno, Wither | — |

**MC05-RF-023 (P0) — Redução por armadura (1.8.9).** `danoFinal = dano × (1 − min(20, pontosArmadura) / 25)` → cada ponto reduz 4%, máximo 80%. Aplicada a dano de ataques, explosões, projéteis, cacto, contato com fogo (armadura reduz contato com bloco de fogo, mas não o "queimando"), raio. Não reduz: queda (só Pena-leve), afogamento, sufocamento, fome, vazio, magia, veneno, wither. Cada dano absorvido gasta durabilidade da armadura (`max(1, dano/4)` por peça). Proteções de encantamento e efeito Resistência (20% por nível) aplicados depois (PRD 11 detalha encantamentos).

**MC05-RF-024 (P0) — Feedback de dano.**
- Modelo da entidade pisca **vermelho** por 10 ticks.
- Câmera do jogador atingido faz o **"hurt cam"** (inclinação lateral rápida na direção do golpe), escalável/desligável (PRD 03 Tremor de tela).
- Som de dano; som de armadura conforme material.
- Recuo (knockback) — regras no PRD 07.
- No HUD, os corações piscam (contorno branco) mostrando a perda.

---

## 4. Fome, saturação e exaustão

**MC05-RF-030 (P0) — Valores.** Fome 0–20 (10 coxas); saturação 0 até o valor atual de fome (inicial 5); exaustão acumula e a cada **4,0** reduz 1 de saturação (ou 1 de fome se a saturação for 0).

**MC05-RF-031 (P0) — Exaustão por ação (1.8.9).**

| Ação | Exaustão |
|---|---|
| Nadar | 0,015 por metro |
| Correr (sprint) | 0,1 por metro |
| Pular | 0,2 |
| Pular correndo | 0,8 |
| Atacar | 0,3 |
| Receber dano | 0,3 |
| Quebrar bloco | 0,025 |
| Efeito Fome | 0,025 por tick por nível |
| Regenerar 1 HP naturalmente | 3,0 |

Andar, agachar, subir escadas e ficar parado **não** gastam (1.8).

**MC05-RF-032 (P0) — Regeneração natural.** Se fome ≥ 18 (e `naturalRegeneration`), +1 HP a cada **80 ticks** (gasta 3,0 de exaustão). Abaixo de 18 não regenera. Fome = 0 causa dano de fome.

**MC05-RF-033 (P0) — Sprint.** Não é possível correr com fome ≤ 6 (3 coxas).

**MC05-RF-034 (P0) — Comer.** Segurar botão direito com comida e fome < 20 (exceto maçã dourada, que pode ser comida cheio): animação de comer (item subindo/descendo na tela + partículas do item + som), **32 ticks** (1,6 s). Ao concluir: soma fome e saturação (saturação limitada à fome). Comidas com efeito aplicam o efeito (tabela).

**MC05-RF-035 (P0) — Tabela de comidas (1.8.9).**

| Comida | Fome | Saturação | Observação |
|---|---|---|---|
| Maçã | 4 | 2,4 | — |
| Maçã dourada | 4 | 9,6 | Regeneração II 5 s, Absorção 2 min |
| Maçã dourada encantada | 4 | 9,6 | Regeneração V 30 s, Absorção 2 min, Resistência 5 min, Resistência ao fogo 5 min |
| Pão | 5 | 6,0 | — |
| Batata assada | 5 | 6,0 | — |
| Batata | 1 | 0,6 | — |
| Batata venenosa | 2 | 1,2 | 60% Veneno 5 s |
| Cenoura | 3 | 3,6 | — |
| Cenoura dourada | 6 | 14,4 | — |
| Bife / Costeleta assada | 8 | 12,8 | — |
| Carne crua de vaca / porco | 3 | 1,8 | — |
| Frango assado | 6 | 7,2 | — |
| Frango cru | 2 | 1,2 | 30% Fome 30 s |
| Carneiro assado | 6 | 9,6 | — |
| Carneiro cru | 2 | 1,2 | — |
| Coelho assado | 5 | 6,0 | — |
| Coelho cru | 3 | 1,8 | — |
| Ensopado de coelho | 10 | 12,0 | — |
| Peixe assado (bacalhau) | 5 | 6,0 | — |
| Salmão assado | 6 | 9,6 | — |
| Peixe cru / salmão cru | 2 | 0,4 / 0,4 | — |
| Peixe-palhaço | 1 | 0,2 | — |
| Baiacu | 1 | 0,2 | Fome III 15 s, Náusea II 15 s, Veneno IV 1 min |
| Biscoito | 2 | 0,4 | — |
| Melancia (fatia) | 2 | 1,2 | — |
| Torta de abóbora | 8 | 4,8 | — |
| Ensopado de cogumelo | 6 | 7,2 | Devolve a tigela |
| Bolo (por fatia, comido colocado) | 2 | 0,4 | 7 fatias |
| Carne podre | 4 | 0,8 | 80% Fome 30 s |
| Olho de aranha | 2 | 3,2 | Veneno 5 s |

---

## 5. Experiência

**MC05-RF-040 (P0) — Orbes.** XP cai como **orbes** (entidades verdes brilhantes que pulsam, são atraídas ao jogador mais próximo num raio de 8 blocos, aceleram quando perto, coletadas ao encostar com som "plim" de pitch aleatório). Orbes se fundem quando próximos. Tamanhos visuais por valor (1–2, 3–6, 7–16, 17–36, 37–72…).

**MC05-RF-041 (P0) — Curva de níveis (1.8.9).** XP para passar do nível L para L+1:
- L 0–15: `2L + 7`
- L 16–30: `5L − 38`
- L ≥ 31: `9L − 158`

Barra de XP mostra a fração; número do nível no centro. Som de "level up" a cada 5 níveis.

**MC05-RF-042 (P0) — Fontes de XP.**

| Fonte | XP |
|---|---|
| Monstros comuns (zumbi, esqueleto, creeper, aranha, enderman…) | 5 (+1–3 por peça de equipamento) |
| Bebê zumbi | 12 |
| Animais | 1–3 |
| Reprodução de animais | 1–7 |
| Blaze, guardião | 10 |
| Dragão do End | 12.000 (1ª vez), 500 depois (PRD 11) |
| Minério de carvão | 0–2 |
| Minério de diamante / esmeralda | 3–7 |
| Minério de lápis / quartzo | 2–5 |
| Minério de redstone | 1–5 |
| Fundir na fornalha | Por item (ex.: ferro 0,7, ouro 1,0, comida 0,35, vidro 0,1 — fração arredondada probabilisticamente ao retirar) |
| Pesca | 1–6 |
| Garrafa de experiência | 3–11 |
| Comércio com aldeões | 3–6 (PRD 08) |
| Morte de jogador | O morto deixa `min(7 × nível, 100)` XP |

XP gasta em encantamento e bigorna (PRD 11).

---

## 6. Morte e renascimento

**MC05-RF-050 (P0) — Morte.**
- Animação: o modelo tomba para o lado em 20 ticks, fica vermelho, solta "fumaça" e some.
- Drops: todo o inventário, armadura e o item do cursor espalham ao redor (velocidades aleatórias), exceto com `keepInventory`. XP conforme RF-042.
- **Mensagem de morte** no chat para todos (se `showDeathMessages`), traduzida e com o mesmo padrão da 1.8 ("Fulano caiu de um lugar alto", "Fulano foi explodido por Creeper", "Fulano tentou nadar na lava", "Fulano se afogou", "Fulano morreu de fome", "Fulano foi morto por Zumbi", "Fulano foi baleado por Fulano usando [Rifle]" etc.), com a "última fonte de dano" considerada (ex.: "foi derrubado de um lugar alto por Zumbi").
- **Tela de morte:** fundo avermelhado, título "Você morreu!", motivo, "Pontuação: N", botões **Renascer** e **Tela de título**. No Hardcore: "Fim de jogo!" e botões **Espectar o mundo** / **Excluir mundo e voltar** (somente dono).

**MC05-RF-051 (P0) — Renascimento.** No ponto de spawn da cama (se válida e desobstruída) ou no spawn do mundo (raio de 10). Vida cheia, fome 20, saturação 5, sem efeitos, XP zerada (se não `keepInventory`). Se a cama sumiu: "Sua cama estava ausente ou obstruída".

---

## 7. Camas e sono

**MC05-RF-060 (P0) — Regras (1.8.9).**
- Usar a cama: só entre **ticks 12541 e 23458** ou durante tempestade; fora disso "Você só pode dormir à noite".
- Monstros hostis a até **8 blocos horizontais e 5 verticais** impedem: "Você não pode descansar agora; há monstros por perto".
- O ponto de renascimento é definido **somente quando o jogador consegue deitar** (regra 1.8); tentar dormir de dia ou com monstros perto não altera o spawn.
- Deitado: câmera baixa na cama, tela escurece gradualmente; botão "Sair da cama".
- **Pular a noite:** quando **todos** os jogadores (não espectadores) estiverem dormindo por 100 ticks, o tempo avança para a manhã (tick 0 do dia seguinte), a chuva/tempestade termina, todos acordam. Mensagem para quem não está dormindo: "*Fulano* está tentando dormir" (extensão útil para 2 jogadores).
- No Nether/End a cama **explode** (potência 5, com fogo) — PRD 11.

---

## 8. Dia, noite e tempo

**MC05-RF-070 (P0) — Tempo do mundo.** `worldTime` (total, nunca volta) e `dayTime` (0–23999). Marcos: 0 nascer do sol (06:00 do relógio), 6000 meio-dia, 12000 pôr do sol, 13000 noite, 18000 meia-noite, 23000 amanhecer. Comandos: `/time set day|night|<n>`, `/time add <n>`, `/time query daytime|gametime`. O tempo é sincronizado com os convidados a cada 20 ticks (correção suave). Fase da lua = `(worldTime / 24000) mod 8`.

**MC05-RF-071 (P0) — Itens de tempo (render).** Relógio e bússola funcionais nas mãos/inventário (PRD 06 cria os itens; aqui a lógica): relógio mostra a posição do sol/lua; bússola aponta para o spawn do mundo; ambos giram aleatoriamente no Nether/End.

---

## 9. Clima

**MC05-RF-080 (P0) — Estados e durações (1.8.9).** Limpo → Chuva → (Tempestade) controlados por dois temporizadores independentes:
- Chuva: limpo dura 12.000–180.000 ticks; chuva dura 12.000–24.000 ticks.
- Trovoada: idem, mas só ocorre de fato quando também está chovendo.
Comandos `/weather clear|rain|thunder [segundos]` e `/toggledownfall`. Opção de regra Mind Cave `doWeatherCycle` (extensão; padrão true; Laboratório false).

**MC05-RF-081 (P0) — Precipitação por bioma.**
- Biomas com temperatura ajustada pela altitude < 0,15 → **neve** (partículas de flocos lentos), acumula camadas de neve no chão exposto (1 camada por tick aleatório) e congela água exposta.
- Deserto, savana, mesa (umidade 0) → **sem precipitação** (mas o céu escurece).
- Demais → **chuva** (gotas em linhas, respingos no chão, som de chuva ambiente que muda quando o jogador está abrigado — "sob teto" detectado pelo heightmap).
- Precipitação renderizada como colunas em volta do jogador (raio ~10), parando no primeiro bloco que bloqueia chuva, com transição suave entre bioma de chuva/neve.

**MC05-RF-082 (P0) — Efeitos da chuva.** Céu e névoa acinzentados; luz do céu reduzida (escurecimento extra — chuva até ~ −3, tempestade até ~ −5 níveis efetivos de luz do céu, o que **permite mobs hostis nascerem durante tempestades de dia**, regra 1.8); apaga fogo exposto e entidades em chamas expostas; hidrata terra arada; enche caldeirão gradualmente (P2); endermen tomam dano (PRD 08).

**MC05-RF-083 (P0) — Raios.** Durante tempestade, raios caem aleatoriamente em chunks carregados (chance por chunk por tick ~1/100.000), atingindo o bloco mais alto exposto; clarão no céu, som de trovão (atraso realista pela distância é P2), dano 5 + fogo em entidades num raio de 3 blocos, acendem fogo no bloco (dificuldade ≥ Normal). Transformações: porco → porco-zumbi, aldeão → bruxa, creeper → **creeper carregado** (PRD 08). No modo Shaders, o clarão ilumina a cena brevemente (respeitando "Reduzir flashes").

---

## 10. Fogo

**MC05-RF-090 (P0) — Fogo (1.8.9).**
- Fogo existe sobre/ao lado de blocos; precisa de bloco sólido abaixo ou bloco inflamável adjacente, senão some.
- Tick agendado a cada 30 + aleatório(0–9) ticks. Idade 0–15; envelhece; com idade alta e sem bloco inflamável embaixo, apaga.
- **Espalhamento:** para blocos de ar vizinhos de blocos inflamáveis num volume de 3×6×3 (de −1 a +4 em Y), com chance proporcional à "chance de pegar fogo" (encouragement) dos blocos vizinhos; **queima** (destrói) blocos inflamáveis adjacentes segundo a "inflamabilidade" de cada um. Valores por bloco no registro (ex.: tábuas 5/20, troncos 5/5, folhas 30/60, lã 30/60, estante 30/20, TNT 15/100 — TNT queimando **detona**, grama alta 60/100, trepadeira 15/100, carvão bloco 5/5, feno 60/20, tapete 60/20).
- Netherrack: fogo infinito em cima. Rocha-base: fogo infinito no End (PRD 11).
- Chuva apaga fogo exposto; dificuldade Pacífico ainda tem fogo.
- `doFireTick=false` congela o fogo (não espalha nem apaga).
- Render: fogo animado (2 camadas cruzadas + faces nos lados quando nas paredes), luz 15, som de crepitar, partículas de fumaça.
- Entidades: andar sobre fogo põe em chamas; entidade em chamas mostra o overlay de chamas no modelo (e na tela em 1ª pessoa).
- Isqueiro (pederneira e aço) e carga de fogo acendem (PRD 06).

---

## 11. Efeitos de status (1.8.9)

**MC05-RF-100 (P0) — Sistema genérico.** Cada entidade viva tem lista de efeitos (tipo, amplificador, duração em ticks, ambiente (de farol), mostrar partículas). Partículas espirais coloridas pela mistura das cores dos efeitos (menos visíveis se "ambiente"). Ícones e tempo restante na tela de inventário (lado esquerdo). Leite remove todos (PRD 06). `/effect <jogador> <efeito> [segundos] [amplificador] [ocultarPartículas]` e `/effect <jogador> clear`.

**MC05-RF-101 (P0) — Efeitos.**

| Efeito | Comportamento |
|---|---|
| Velocidade | +20% velocidade por nível (FOV aumenta) |
| Lentidão | −15% por nível (FOV diminui) |
| Pressa | +20% velocidade de mineração e de animação de braço por nível |
| Fadiga de mineração | Mineração drasticamente mais lenta (×0,3 por nível de forma composta) |
| Força | +130% de dano corpo a corpo por nível (fórmula 1.8: multiplicativa) |
| Cura instantânea | +4 × 2^(nível−1) HP (dano para mortos-vivos) |
| Dano instantâneo | 6 × 2^(nível−1) (cura mortos-vivos) |
| Super pulo | +0,1 de impulso de pulo por nível; reduz dano de queda |
| Náusea | Distorção ondulante da visão (ou tom verde com acessibilidade) |
| Regeneração | +1 HP a cada 50 ticks (nível I), período dividido por 2 a cada nível |
| Resistência | −20% de dano por nível (V = imune, exceto vazio) |
| Resistência ao fogo | Imune a fogo e lava |
| Respiração aquática | Sem perda de ar |
| Invisibilidade | Modelo invisível (armadura/itens visíveis), alcance de detecção de mobs reduzido |
| Cegueira | Névoa preta a ~5 blocos, impede sprint e críticos |
| Visão noturna | Luz mínima máxima (pisca nos últimos 10 s) |
| Fome | Exaustão contínua |
| Fraqueza | −0,5 de dano por nível (1.8) |
| Veneno | 1 HP a cada 25 ticks (I), não mata (para em 1 HP); corações verdes |
| Wither | 1 HP a cada 40 ticks (I), pode matar; corações pretos |
| Vigor (health boost) | +4 HP máximos por nível |
| Absorção | +4 HP de absorção por nível |
| Saturação | +nível de fome e saturação por tick |

---

## 12. Ambientes e pequenas regras de sobrevivência

- **MC05-RF-110 (P0)** Teia: velocidade ×0,25 e anula queda. Areia das almas: velocidade ×0,4. Gelo: escorregadio 0,98. Bloco de slime: quica (inverte velocidade vertical ×1, sem dano de queda; agachar evita). Escada de mão/trepadeira: subir 0,2 bloco/tick (≈ 2,35 b/s), descer lento, agachado fica parado; anula queda.
- **MC05-RF-111 (P0)** Bloco de neve camada impede pouco o movimento; camadas ≥ 8 = bloco cheio.
- **MC05-RF-112 (P0)** Nível do vazio mostra partículas de "névoa do vazio" perto de Y < 8 em locais escuros (P2).
- **MC05-RF-113 (P0)** Estatísticas são **registradas desde já** (PRD 12 mostra a tela): blocos minerados por tipo, itens usados/criados, mobs mortos por tipo, mortes, dano dado/recebido, distância andada/corrida/nadada/voada/caída, saltos, tempo jogado, tempo desde a última morte, itens coletados/jogados, vezes que dormiu.

---

## 13. Comandos adicionados neste PRD

`/gamemode`, `/defaultgamemode`, `/difficulty`, `/time`, `/weather`, `/toggledownfall`, `/effect`, `/kill [alvo]`, `/xp <qtd>[L] [jogador]`, `/spawnpoint [jogador] [x y z]`, `/setworldspawn [x y z]`, `/gamerule`. Seletores de alvo `@p`, `@a`, `@r`, `@e` com argumentos básicos (`r`, `type`, `name`, `c`) — PRD 12 completa.

---

## 14. Requisitos não funcionais

- **MC05-RNF-001 (P0)** Todos os cálculos de sobrevivência no servidor; o cliente só exibe. Um cliente adulterado não consegue ficar imortal nem com fome cheia.
- **MC05-RNF-002 (P0)** Valores de vida/fome/ar/XP chegam ao HUD do jogador em ≤ 1 tick após mudar; para o outro jogador, a vida só é visível se ele estiver olhando (não é necessário mostrar a vida alheia).
- **MC05-RNF-003 (P0)** Espalhamento de fogo numa floresta grande não derruba o TPS abaixo de 18.
- **MC05-RNF-004 (P0)** Tudo salvo no `WorldPlayer` (dados extras) e no mundo (clima, temporizadores, tempo).

---

## 15. Critérios de aceite

- **MC05-CA-01** Cair de 4 blocos não dá dano; de 5 dá 2 HP (1 coração) — `teto(5−3)`; de 23 mata quem está com 20 HP sem armadura.
- **MC05-CA-02** Com armadura completa de diamante (20 pontos), um golpe de 10 de dano causa 2.
- **MC05-CA-03** Correr gasta fome visivelmente; com 3 coxas não é possível correr; com ≥ 9 coxas regenera.
- **MC05-CA-04** Morrer espalha o inventário, mostra a mensagem correta no chat e a tela de morte; renascer na cama funciona.
- **MC05-CA-05** Os dois jogadores deitando à noite pulam para a manhã; com monstro perto aparece a mensagem de bloqueio.
- **MC05-CA-06** Chuva em planície, neve em taiga fria e céu seco no deserto, no mesmo momento, para jogadores em biomas diferentes.
- **MC05-CA-07** Raio transforma creeper em carregado (verificável no PRD 08) e porco em porco-zumbi.
- **MC05-CA-08** Fogo numa casa de madeira se espalha e queima; chuva apaga fogo exposto.
- **MC05-CA-09** Cada efeito da tabela aplicável por `/effect` com o comportamento descrito.
- **MC05-CA-10** Hardcore: morrer leva ao modo Espectador e o dono pode excluir o mundo pela tela.
