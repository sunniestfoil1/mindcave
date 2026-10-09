# MIND CAVE — PRD 19
# Correção da Interface: Trocar o Visual Bedrock pelo Visual Java 1.8.9 (Menus, Lobby, Telas, Chat e Tooltips)

| Campo | Valor |
|---|---|
| Tipo | **PRD corretivo.** Revoga o PRD 16 (Minecraft-CSS). Onde contradizer PRD 02, 03, 15 ou 16 sobre aparência de telas, **vale este PRD**. |
| Problema | A build atual usa o Minecraft-CSS, que imita a interface **Bedrock/launcher** (botões verde e roxo, fonte MinecraftTen em caixa alta, cartões). A Java 1.8.9 não é assim. |
| Objetivo | Toda a interface com o **visual e o layout exatos da Java Edition 1.8.9**: botões cinza de pedra desenhados a partir da textura de widgets, fundo de terra, fonte bitmap do Minecraft com sombra, telas com as mesmas posições e tamanhos do jogo, e textos em português como na tradução oficial da 1.8.9. |
| Código de referência | "mind-cave-codigo-referencia/13-ui-java-1.8.9/minecraft-web-client" (botões, telas, fundo de terra, sliders, campos, listas e fontes já no estilo Java) |

> Documento de requisitos. Medidas em **pixels de GUI** (antes de multiplicar pela escala da interface). Cores em hexadecimal como no jogo.

---

## 0. O que remover da build atual

**MC19-RF-000 (P0) — Desfazer o PRD 16.**
- Remover todos os arquivos e classes do Minecraft-CSS, as fontes MinecraftTen/MinecraftRegular, os botões verde/roxo/cinza-claro, cartões, navbar e modais do Bedrock.
- Remover a barra superior "MIND CAVE" no estilo navbar, o subtítulo em caixa alta e os botões em caixa alta (ex.: "CRIAR MUNDO", "JOGAR").
- Remover a lista de mundos de dentro do menu principal: na 1.8.9 ela fica numa tela própria ("Selecionar mundo").
- Remover a linha de ajuda de teclas do rodapé do menu (a Java não tem; as dicas vão para as telas de carregamento).

---

## 1. Base visual da Java 1.8.9

### 1.1 Texturas usadas pela interface

| Textura (caminho no pacote 1.8.9) | Uso |
|---|---|
| gui/widgets.png (256×256) | Botões, botão de idioma, hotbar e seletor |
| gui/options_background.png (16×16) | Fundo de terra de todos os menus fora do jogo |
| gui/icons.png | Mira, corações, fome, armadura, ar, XP, **barras de ping** da lista de servidores e do Tab |
| font/ascii.png | Fonte bitmap |
| gui/title/minecraft.png | Logo (no Mind Cave: logo próprio no mesmo estilo — RF-030) |
| gui/title/background/panorama_0..5.png | Panorama do menu (no Mind Cave: panorama 3D real do PRD 12) |
| gui/container/*.png | Inventário, bancada, baú, fornalha etc. |

Fonte das texturas, em ordem: pacote de recursos 1.8.9 importado pelos devs (PRD 10 RF-075) → texturas procedurais equivalentes (RF-005). A interface **não pode** depender de cores CSS para desenhar botões e fundos: ela desenha recortes dessas texturas, como o jogo.

### 1.2 Escala da interface (como o jogo calcula)

**MC19-RF-001 (P0)** Fator de escala: começa em 1 e sobe enquanto (largura ÷ (fator+1)) ≥ 320 e (altura ÷ (fator+1)) ≥ 240, até o limite escolhido (1, 2, 3, 4 ou Auto = sem limite). Toda a interface é desenhada em pixels de GUI × fator, com pixel nítido (sem suavização).

### 1.3 Fonte e cores de texto

**MC19-RF-002 (P0) — Fonte bitmap.** Glifos de 8 px de altura, linha de 9 px, largura variável por caractere (como o ascii.png), com acentos do português. **Sombra:** cópia do texto deslocada 1 px para baixo e para a direita, com a cor do texto dividida por 4 (25% do brilho). Se o pacote de recursos não estiver importado, usar a fonte "mojangles" da pasta de referência (recriação do bitmap do Minecraft). **Nunca** usar MinecraftTen, caixa alta forçada ou fonte do sistema.

**MC19-RF-003 (P0) — Cores dos códigos §.**

| Código | Cor | Código | Cor |
|---|---|---|---|
| §0 | #000000 | §8 | #555555 |
| §1 | #0000AA | §9 | #5555FF |
| §2 | #00AA00 | §a | #55FF55 |
| §3 | #00AAAA | §b | #55FFFF |
| §4 | #AA0000 | §c | #FF5555 |
| §5 | #AA00AA | §d | #FF55FF |
| §6 | #FFAA00 | §e | #FFFF55 |
| §7 | #AAAAAA | §f | #FFFFFF |

### 1.4 Botão (igual ao da 1.8.9)

**MC19-RF-004 (P0)**
- Tamanho padrão **200 × 20**; botões menores com a largura da tela (98, 150, 100, 72, 70, 20…), altura sempre 20.
- Desenho: recorte de gui/widgets.png na faixa vertical de 20 px conforme o estado — **desativado** começa em y = 46, **normal** em y = 66, **hover** em y = 86. O botão é desenhado em duas metades: a esquerda pega a largura/2 a partir de x = 0 do recorte; a direita pega a largura/2 terminando em x = 200 (assim qualquer largura mantém as bordas certas).
- Texto centralizado, com sombra: normal **#E0E0E0**, hover **#FFFFA0** (amarelo-claro), desativado **#A0A0A0**.
- Clique: som de clique do jogo. Não há animação de "afundar".
- Botão de idioma: quadrado 20×20 com o ícone do globo (widgets.png, recorte logo abaixo dos botões).

**MC19-RF-005 (P0) — Fallback procedural.** Sem pacote importado, gerar uma textura de widgets no **mesmo layout** (mesmas posições e tamanhos dos recortes), com botão de pedra cinza, borda preta de 1 px, brilho claro em cima/esquerda e sombra escura embaixo/direita; hover com borda/realce azulado-claro; desativado escurecido. A referência usa cinza base rgb(114,114,114) quando a textura não carregou.

### 1.5 Fundos

**MC19-RF-006 (P0)**
- **Fora do mundo** (menus): textura de terra repetida em blocos de **32 px de GUI**, escurecida para cor **#404040** (multiplicada por 64/255).
- **Dentro do mundo** (pausa, opções, inventário sobre o jogo): sem terra — gradiente vertical por cima do jogo de **#C0101010** (topo) a **#D0101010** (base).
- **Listas roláveis** (mundos, servidores, pacotes): área da lista com terra mais escura (#202020); faixas de cima (até y = 32) e de baixo (a partir de altura − 64) com terra #404040; sombras de 4 px em degradê preto nas bordas da lista.

### 1.6 Campo de texto

**MC19-RF-007 (P0)** Fundo preto, borda de 1 px **#A0A0A0**, texto **#E0E0E0** (desativado **#707070**), cursor piscando (underline "_" no fim do texto, barra vertical **#D0D0D0** no meio), seleção com cor invertida. Tamanho padrão 200 × 20.

### 1.7 Slider (opções)

**MC19-RF-008 (P0)** Fundo do slider = botão no estado **desativado** (recorte y = 46) com a largura do slider; pegador = botão **normal** (y = 66) com **8 px** de largura (4 px de cada borda do recorte); texto "Nome: valor" centralizado no slider, cor #E0E0E0.

### 1.8 Tooltip

**MC19-RF-009 (P0)** Fundo **#F0100010** (quase preto-roxo), borda de 1 px em degradê de **#505000FF** (topo) a **#5028007F** (base), padding de 3 px, posição no mouse +12 px à direita e −12 px acima, 2 px extras de espaço depois da primeira linha (nome do item).

### 1.9 Lista com seleção e barra de rolagem

**MC19-RF-010 (P0)** Item selecionado: retângulo com borda **#808080** e interior preto, largura 220. Barra de rolagem de 6 px à direita da lista: trilho preto, polegar **#808080** com realce **#C0C0C0**. Roda do mouse rola; duplo clique executa a ação principal.

---

## 2. Telas — layout exato (x relativo ao centro da tela; y em pixels de GUI)

### 2.1 Menu principal (tela de título)

**MC19-RF-020 (P0)** Base j = altura ÷ 4 + 48.

| Elemento | Posição e tamanho | Texto (PT-BR) |
|---|---|---|
| Logo | Centro, y = 30, 274 px de largura | "MIND CAVE" (RF-030) |
| Frase amarela (splash) | Ao lado direito do logo (centro + 90, y = 70), girada −20°, cor **#FFFF00**, pulsando de tamanho | Frases próprias |
| Botão | −100, y = j, 200 | Um jogador |
| Botão | −100, y = j + 24, 200 | Multijogador |
| Botão (no lugar do Realms) | −100, y = j + 48, 200 | Mind Cave Studio |
| Botão idioma | −124, y = j + 84, 20×20 | (ícone) |
| Botão | −100, y = j + 84, 98 | Opções... |
| Botão | +2, y = j + 84, 98 | Sair do jogo |
| Canto inferior esquerdo | x = 2, y = altura − 10, branco | "Mind Cave 1.8.9-dev (build)" |
| Canto inferior direito | alinhado à direita, y = altura − 10, branco | "Mind Cave — feito por dois devs" |
| Fundo | Panorama 3D girando devagar, desfocado, com degradês branco-transparente (em cima) e preto-transparente (embaixo) | — |

### 2.2 Selecionar mundo ("Um jogador")

**MC19-RF-021 (P0)**
- Título "Selecionar mundo" branco centralizado em y = 20.
- Lista de y = 32 até altura − 64, cada mundo com **36 px** de altura: 1ª linha nome (branco); 2ª linha nome da pasta/código + data do último acesso (#808080); 3ª linha modo de jogo e detalhes (#808080) — no Mind Cave: "Criativo, Aberto para todos, seed …".
- Botões (linha de cima em altura − 52; de baixo em altura − 28):

| Botão | x | Largura | Linha |
|---|---|---|---|
| Jogar mundo selecionado | −154 | 150 | cima |
| Criar novo mundo | +4 | 150 | cima |
| Renomear | −154 | 72 | baixo |
| Apagar | −76 | 72 | baixo |
| Recriar | +4 | 72 | baixo |
| Cancelar | +82 | 72 | baixo |

Botões que dependem de seleção ficam **desativados** sem mundo selecionado. Apagar abre a confirmação no estilo Java (texto em duas linhas + botões "Apagar" e "Cancelar", fundo de terra).

### 2.3 Criar novo mundo

**MC19-RF-022 (P0)** Layout da 1.8.9: título "Criar novo mundo"; campo "Nome do mundo" (200×20, centro −100, y = 60) com a linha "Será salvo em: …" em cinza; botão "Modo de jogo: Sobrevivência" (centro −75, y = 115, 150) com as duas linhas de descrição do modo abaixo; botão "Mais opções de mundo..." (centro −75, y = 187, 150); botões "Criar novo mundo" (centro −155, altura − 28, 150) e "Cancelar" (centro +5, altura − 28, 150). Na tela de mais opções: campo "Semente do gerador de mundo", botões "Gerar estruturas", "Tipo de mundo" (Padrão / Plano / Biomas grandes / Amplificado / Personalizado), "Permitir comandos", "Baú bônus", e os botões Mind Cave **"Multijogador: Aberto para todos / Só com código / Privado"** e **"Abrir ao entrar: Sim/Não"** (PRD 15), todos 150×20 em duas colunas como a tela original.

### 2.4 Multijogador (lista de mundos online — PRD 15)

**MC19-RF-023 (P0)** Estilo da tela "Jogar multijogador" da 1.8.9:
- Título branco em y = 20; lista de y = 32 até altura − 64, linhas de 36 px.
- Cada mundo: ícone 32×32 à esquerda; nome em branco; 2 linhas de mensagem do mundo (MOTD) em cinza com cores §; à direita, "jogadores/máximo" em cinza e **ícone de ping** de gui/icons.png (5 barras; animado enquanto mede; "X" vermelho se offline).
- Seção "Mundos abertos na rede" no fim da lista (equivalente à "Procurando jogos na sua rede local" da 1.8), com o texto animado enquanto busca.
- Botões, linha de cima (altura − 52): "Entrar no servidor" (−154, 100), "Conexão direta" (−50, 100) = entrar com código, "Adicionar servidor" (+54, 100) = favoritar. Linha de baixo (altura − 28): "Editar" (−154, 70), "Remover" (−74, 70), "Atualizar" (+4, 70), "Cancelar" (+80, 75).

### 2.5 Telas de conexão e carregamento

**MC19-RF-024 (P0)** Fundo de terra; texto branco centralizado (ex.: "Conectando ao host...", "Negociando conexão (TURN)...", "Carregando terreno"); barra de progresso de **100 × 2 px** centralizada abaixo do texto: trilho **#808080**, preenchimento **#80FF80**. Erro de conexão: tela "Falha ao conectar ao servidor" com o motivo em cinza e botão "Voltar ao menu" (200). Dicas do Mind Cave em cinza abaixo da barra.

### 2.6 Menu de pausa

**MC19-RF-025 (P0)** Título "Menu do jogo" em y = 40; fundo de gradiente sobre o jogo (RF-006). Com k = altura ÷ 4 − 16:

| Botão | x | y | Largura |
|---|---|---|---|
| Voltar ao jogo | −100 | k + 24 | 200 |
| Conquistas | −100 | k + 48 | 98 |
| Estatísticas | +2 | k + 48 | 98 |
| Opções... | −100 | k + 96 | 98 |
| Abrir para LAN | +2 | k + 96 | 98 |
| Salvar e sair para o título (convidado: "Desconectar") | −100 | k + 120 | 200 |

"Abrir para LAN" abre a tela da 1.8.9 ("Configurações do mundo para outros jogadores": botões "Modo de jogo: …", "Permitir comandos: …", "Iniciar mundo LAN", "Cancelar") com os botões extras do PRD 15 no mesmo estilo.

### 2.7 Opções e subtelas

**MC19-RF-026 (P0)** Tela "Opções" (título em y = 15): primeira linha com o slider "Campo de visão" (−155, altura÷6 − 12, 150) e "Dificuldade" (+5, mesma linha, 150, com o cadeado 20×20 ao lado); depois botões de 150 em duas colunas (x = −155 e +5), linhas a cada 24 px a partir de altura÷6 + 42: Personalização de skin… / Músicas e sons…, Configurações de vídeo… / Controles…, Idioma… / Configurações do chat…, Pacotes de recursos… / (no lugar de "Snooper") Multijogador e rede…; botões extras Mind Cave (Shaders, Desempenho, Acessibilidade, Perfis, Mundo) continuam a grade; "Pronto" (−100, altura÷6 + 168, 200) — deslocado para baixo se a grade crescer.
**Subtelas** (vídeo, som, chat, skin, shaders…): lista rolável de opções em **duas colunas de 150 px** (botões e sliders), título no topo e "Pronto" embaixo, exatamente como as telas de opções de vídeo da 1.8.9. Teclas: lista com o nome da ação à esquerda e o botão da tecla (75 px) à direita, conflito com texto vermelho (§c), "Redefinir tudo" e "Pronto" embaixo.

### 2.8 Tela de morte

**MC19-RF-027 (P0)** Fundo em gradiente vermelho (**#60500000** em cima a **#A0803030** embaixo) sobre o jogo; "Você morreu!" com tamanho 2× em y = 30 (centro); motivo e "Pontuação: §e N" abaixo; botões "Renascer" (−100, altura÷4 + 72, 200) e "Tela de título" (−100, altura÷4 + 96, 200), **desativados durante o primeiro segundo**.

### 2.9 Chat e Tab (HUD de texto)

**MC19-RF-028 (P0)**
- Chat: largura padrão 320 px, linhas de 9 px no canto inferior esquerdo; cada linha com fundo preto com metade da opacidade configurada; mensagens somem após **200 ticks** (10 s), desvanecendo nos últimos 20. Ao abrir (T): faixa preta 50% (#80000000) de x = 2 até largura − 2, entre altura − 14 e altura − 2, com o texto digitado em x = 4 sem caixa.
- Tab: painel com fundo **#80000000**, cada nome numa faixa **#20FFFFFF**, cabeçalho/rodapé em cima e embaixo, ícone de ping de gui/icons.png à direita de cada nome.
- F3: texto branco com fundo cinza translúcido por linha (como a 1.8.9).

### 2.10 Inventários e containers

**MC19-RF-029 (P0)** Telas desenhadas com as texturas de gui/container (inventário 176×166 etc.); título do container em **#404040** em (8, 6) e "Inventário" em (8, altura do painel − 94); slot sob o mouse com realce **#80FFFFFF**; contagem de itens em branco com sombra; tooltip RF-009.

### 2.11 Logo "MIND CAVE"

**MC19-RF-030 (P0)** O logo segue o estilo do logo do Minecraft da 1.8.9: letras em blocos com textura de pedra, contorno escuro e relevo 3D, 274 px de largura no menu. Pode ser um PNG enviado no Studio; sem ele, é gerado por código nesse estilo (nunca texto de fonte comum).

---

## 3. Textos em português

**MC19-RF-040 (P0)** Usar os rótulos da tradução PT-BR da 1.8.9 sempre que existirem (ex.: "Um jogador", "Multijogador", "Opções...", "Sair do jogo", "Selecionar mundo", "Jogar mundo selecionado", "Criar novo mundo", "Renomear", "Apagar", "Recriar", "Cancelar", "Menu do jogo", "Voltar ao jogo", "Conquistas", "Estatísticas", "Abrir para LAN", "Salvar e sair para o título", "Você morreu!", "Renascer", "Tela de título", "Pronto"). Se o pacote de recursos importado trouxer o arquivo de idioma pt_BR, os textos vêm dele. Primeira letra maiúscula e o resto como na tradução — **sem caixa alta forçada**.

---

## 4. Telas novas do Mind Cave no estilo Java

**MC19-RF-050 (P0)** Telas que não existem na 1.8.9 (Studio, Shaders, Bancada de armeiro, roda de emotes, chat do saguão, amigos online, visualizador rápido de GLB) usam **apenas** os elementos deste PRD: fundo de terra ou gradiente, botões de widgets, campos de texto pretos, sliders, listas com seleção, tooltips e a fonte bitmap. Exceção permitida: o **Mind Cave Studio** pode usar um layout de ferramenta (painéis lado a lado) — mas com esses mesmos elementos e cores.

---

## 5. Código de referência

| O que | Arquivo em "13-ui-java-1.8.9/minecraft-web-client" |
|---|---|
| Botão com recorte de widgets.png (estados 46/66/86, duas metades) | src/react/Button.tsx e button.module.css |
| Fundo de terra e fontes | src/styles.css, src/screens.css, src/react/Screen.tsx, assets/mojangles.ttf, assets/minecraftia.woff |
| Escala da interface | src/scaleInterface.ts |
| Menu principal | src/react/MainMenu.tsx e mainMenu.module.css |
| Lista de mundos e criar mundo | src/react/Singleplayer.tsx, CreateWorld.tsx e seus .css |
| Lista de servidores | src/react/ServersList.tsx, AddServerOrConnect.tsx |
| Pausa, morte, carregamento | PauseScreen.tsx, DeathScreen.tsx, AppStatus.tsx, LoadingChunks.tsx |
| Opções, slider, campo, abas, seleção, teclas | OptionsGroup.tsx, OptionsItems.tsx, optionsGuiScheme.tsx, Slider.tsx, Input.tsx, Tabs.tsx, Select.tsx, KeybindingsScreen.tsx |
| Texto com códigos § | MessageFormatted.tsx, MessageFormattedString.tsx |

Portar a lógica e os valores; as texturas vêm do pacote 1.8.9 importado ou do fallback procedural.

---

## 6. Critérios de aceite

- **MC19-CA-01** Nenhum resto do Minecraft-CSS: nenhum botão verde/roxo, nenhuma fonte MinecraftTen, nenhum texto em caixa alta forçada.
- **MC19-CA-02** Com o pacote 1.8.9 importado, o menu principal fica visualmente igual ao da Java 1.8.9 (botões, posições, fonte, splash amarela girada), trocando apenas o logo e o botão Realms por "Mind Cave Studio".
- **MC19-CA-03** Passar o mouse num botão deixa o texto amarelo-claro (#FFFFA0) e troca o recorte para o de hover; botão desativado fica escuro com texto #A0A0A0.
- **MC19-CA-04** Menus fora do jogo têm fundo de terra escurecida; pausa e opções dentro do jogo mostram o jogo atrás com gradiente escuro.
- **MC19-CA-05** "Um jogador" abre a tela "Selecionar mundo" com a lista de 36 px por mundo e os 6 botões nas posições da 1.8.9.
- **MC19-CA-06** Tooltip, chat, Tab, tela de morte e barra de carregamento com as cores e medidas deste PRD (conferir com conta-gotas).
- **MC19-CA-07** Escala da interface Auto/1/2/3/4 segue a regra de 320×240 e o texto fica nítido.
- **MC19-CA-08** Sem pacote importado, o fallback procedural mantém o mesmo layout e a mesma aparência geral (botões de pedra cinza, fundo de terra, fonte bitmap).
