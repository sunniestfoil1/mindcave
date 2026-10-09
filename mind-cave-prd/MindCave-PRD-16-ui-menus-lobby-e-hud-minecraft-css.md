# MIND CAVE — PRD 16 — ⚠️ REVOGADO PELO PRD 19

> **Não aplicar.** O Minecraft-CSS imita a interface Bedrock. A interface oficial do Mind Cave é a da Java 1.8.9, definida no PRD 19. Este arquivo fica só como histórico.

# Interface com o Minecraft-CSS: Menus, Lobby, Telas do Jogo e Textos do HUD usando os Valores Exatos do Projeto

| Campo | Valor |
|---|---|
| Depende de | PRDs 02 (UI), 03 (Opções), 10 (Studio), 12 (polimento), 15 (online e lobby) |
| Tipo | **PRD de interface, prioritário para tudo que é tela/menu.** Onde contradizer o estilo visual descrito no PRD 02 (RF-070 a RF-072) e no PRD 03 (princípio 5), **vale este PRD**. |
| Fonte única do visual | Projeto **Minecraft-CSS** (github.com/Jiyath5516F/Minecraft-CSS, autor 0x4a4b, licença MPL-2.0), copiado integralmente em "mind-cave-codigo-referencia/12-ui-minecraft-css". |
| Objetivo | Toda a interface do Mind Cave (lobby, menus, telas de jogo, Studio e os textos/painéis do HUD) usa **os arquivos, classes, cores, fontes, bordas, sombras e espaçamentos do Minecraft-CSS, sem reinventar**. O que o projeto não tem é montado **apenas** combinando os tokens e padrões dele, seguindo as regras da seção 5. |

> Documento de requisitos. Não descreve código; descreve o que cada tela deve usar do Minecraft-CSS e como verificar.

---

## 0. O que é o Minecraft-CSS (análise do projeto)

Framework CSS pequeno (≈ 20 arquivos) com visual de interface do Minecraft (estilo do launcher e da edição Bedrock: botões com relevo, verde/roxo/cinza, cantos retos). Conteúdo:

| Pasta | Arquivos | O que oferece |
|---|---|---|
| base | reset, typography, colors, variables, fonts | Reset de margens, fontes **MinecraftRegular** (texto) e **MinecraftTen** (títulos), paleta de cores, variáveis de tamanho e espaçamento, raio de borda 0 |
| components | buttons, cards, forms, modals, navigation | Botões **primary** (verde), **secondary** (roxo), **tertiary** (cinza-claro), **normal** (cinza estilo Java); cartões; campos de formulário; modal centralizado; barra de navegação |
| layout | grid, container | Grade de 12 colunas responsiva; containers com larguras por breakpoint |
| utilities | colors, spacing, typography, visibility | Classes de cor de texto/fundo, margens e paddings (xs a xl), alinhamento de texto, mostrar/ocultar |
| icons | icons | Ícone quadrado de 24 px |
| fonts | Minecraft-Regular.otf, Minecraft-Ten.ttf | As duas fontes |
| dist | arquivo compilado | **Não usar** (ver RF-003) |

O que o projeto **não** tem: slots de inventário, hotbar, corações/fome/XP, sliders, abas, barras de progresso, tooltips, interruptores, listas roláveis estilizadas, notificações. Esses são compostos pelas regras da seção 5 ou continuam vindo das texturas do jogo (seção 6).

---

## 1. Como o projeto entra no app

**MC16-RF-001 (P0) — Arquivos usados como estão.** Os arquivos CSS de "12-ui-minecraft-css/src" são incluídos no app **sem editar o conteúdo** (mantendo o aviso de licença MPL-2.0). Qualquer ajuste necessário vai num arquivo separado de "ajustes Mind Cave", que só pode **usar** os tokens do projeto, nunca redefinir cores, fontes ou bordas.

**MC16-RF-002 (P0) — Ordem de carregamento.** reset → variables → colors → fonts → typography (base) → buttons, cards, forms, modals, navigation (components) → container, grid (layout) → icons → colors, spacing, typography, visibility (utilities) → ajustes Mind Cave. Nessa ordem, o espaçamento efetivo é o da pasta utilities: **xs 4 px, sm 8 px, md 16 px, lg 32 px, xl 64 px** (a pasta base define valores em rem que são sobrescritos — comportamento original do projeto).

**MC16-RF-003 (P0) — Não usar o arquivo da pasta dist.** O CSS compilado do repositório aponta para arquivos que não existem (temas escuro/claro e um utilitário de texto) e não carrega as fontes; usá-lo quebra a interface. Usar somente os arquivos de "src".

**MC16-RF-004 (P0) — Fontes servidas corretamente.** As fontes Minecraft-Regular.otf e Minecraft-Ten.ttf são servidas pelo app no caminho que as declarações de fonte do projeto esperam (relativo à pasta base → pasta fonts) ou o caminho é ajustado no arquivo de ajustes. A tela de carregamento só termina depois que as duas fontes carregaram (sem "piscar" fonte padrão).

**MC16-RF-005 (P0) — Conflito com o padrão do Base44.** O Base44 gera apps com Tailwind e componentes shadcn. Nas telas do jogo:
- não usar estilos de componentes shadcn (botões, cards, inputs, diálogos, tabs) — os elementos usam as classes do Minecraft-CSS;
- o reset do Tailwind não pode sobrescrever os estilos do Minecraft-CSS (a interface do jogo fica dentro de um contêiner raiz próprio e o Minecraft-CSS é carregado depois do Tailwind, ou o reset do Tailwind é desligado nas rotas do jogo);
- utilitários do Tailwind só podem ser usados para posicionamento/layout que o Minecraft-CSS não cobre, nunca para cores, fontes, bordas ou sombras.

---

## 2. Tokens oficiais (usar exatamente estes valores)

### 2.1 Cores base

| Token | Valor | Uso no Mind Cave |
|---|---|---|
| primary-color | #313233 | Fundo das telas e painéis escuros |
| secondary-color | #48494A | Fundo de cartões e áreas secundárias |
| accent-color | #D0D1D4 | Destaques claros, separadores claros |
| background-color | #48494A | Fundo de cartões e modais |
| text-color | #FFFFFF | Texto padrão |
| text-dark-color | #000000 | Texto sobre fundos claros (navbar, botão tertiary) |
| link-color | #007BFF | Links |
| error-color | #DC3545 | Erros (falha de conexão, senha errada, "Versão diferente") |
| success-color | #28A745 | Sucesso (conectado, salvo) |
| warning-color | #FFC107 | Avisos (conexão instável, saves pendentes) |
| info-color | #17A2B8 | Informações (rota TURN, dicas) |
| selected-color | #48494A | Item selecionado em listas |
| hr-top-color / hr-bottom-color | #333334 / #5A5B5C | Divisor de duas cores |
| Cursor de texto (caret) | #3C8527 | Campos de texto |

### 2.2 Botões (4 variantes)

| Variante | Fundo | Hover | Sombra interna inferior | Borda externa | Brilho cima/esq. | Sombra baixo/dir. | Texto | Fonte |
|---|---|---|---|---|---|---|---|---|
| **primary** | #3C8527 | #2A641C | #1D4D13 | 3 px #1E1E1F | #4F913C (75%) | #639D52 | #FFFFFF, negrito, espaçamento 2 px, sombra 2,5 px | MinecraftTen |
| **secondary** | #7345E5 | #5D2CC6 | #4A1CAC | 3 px #1E1E1F | #A264F2 (75%) | #8E49EB | #FFFFFF | MinecraftRegular |
| **tertiary** | #D0D1D4 | #B1B2B5 | #58585A | 3 px #1E1E1F | #ECEDEE (75%) | #E3E3E5 | #000000 | MinecraftRegular |
| **normal** | #C6C6C6 | #218306 (texto branco, borda branca, brilhos #17CD07 / #004E00) | — | 1,5 px #131313 | #F7F7F7 (75%) | #656465 | #4C4C4C | MinecraftRegular |

Relevo dos botões primary/secondary/tertiary: sombra interna inferior de 6 px + brilho de 3 px em cima/esquerda + sombra de 3 px à direita e 9 px embaixo; ao **pressionar**, o botão desce 2 px e a sombra inferior some (efeito de clique do projeto). Botão normal: brilho e sombra de 1,5 px.

### 2.3 Formulários, cartões, modal e navegação

| Componente | Valores do projeto |
|---|---|
| Campo de texto | Altura 40 px, fundo #313233, borda 3 px #1E1E1F, sombra interna superior 6 px #242425, texto branco, sem contorno de foco |
| Botão de formulário | Igual ao botão normal |
| Cartão | Fundo #48494A, borda 1 px #48494A, padding 16 px, sombra leve; cabeçalho 1,25 rem negrito; rodapé alinhado à direita |
| Modal | Centralizado, largura 400 px, fundo #48494A; cabeçalho com fundo #313233 e texto branco; corpo e rodapé com padding 16 px; camada acima de tudo |
| Barra de navegação | Fundo #E6E8EB, sombra interna inferior 6 px #B1B2B5, borda inferior 3 px #151516, fonte MinecraftTen, marca 1,5 rem na cor primary, links pretos |
| Divisor | Linha dupla 2,5 px #333334 em cima e 2,5 px #5A5B5C embaixo, ocupando toda a largura do cartão |
| Ícone | 24 × 24 px |

### 2.4 Tipografia e tamanhos

| Item | Valor |
|---|---|
| Fonte do texto | MinecraftRegular, 16 px base, altura de linha 1,6 |
| Fonte de títulos | MinecraftTen, negrito |
| Títulos h1 a h6 | 2,5 / 2 / 1,75 / 1,5 / 1,25 / 1 rem |
| Texto pequeno / grande | 14 px / 18 px |
| Raio de borda | 0 (tudo com cantos retos) |
| Breakpoints | 480, 576, 768, 992, 1200 px |
| Container | Largura máxima 540 / 720 / 960 / 1140 px conforme a tela, padding lateral 16 px |
| Grade | 12 colunas, espaço de 16 px |

---

## 3. Mapa de uso: cada tela do jogo → componentes do Minecraft-CSS

### 3.1 Lobby e menu principal

| Elemento | Componente |
|---|---|
| Barra superior com "MIND CAVE", amigos online (PRD 15), versão do build | Barra de navegação (marca em MinecraftTen) |
| Botão principal **Um Jogador** | Botão primary (grande, largura total da coluna central) |
| **Multijogador** | Botão secondary |
| **Mind Cave Studio**, **Opções** | Botão tertiary |
| **Sair**, ações menores | Botão normal |
| Frase "splash" amarela | Texto MinecraftTen com a cor de aviso (#FFC107) — único uso de amarelo, como destaque |
| Fundo | Panorama 3D (PRD 12) com camada escura na cor primary com transparência |
| Painel "Amigos online" e chat do saguão (PRD 15) | Cartão + campo de texto + botão normal "Enviar" |

### 3.2 Um Jogador, Multijogador e Criar mundo

| Tela | Componentes |
|---|---|
| Lista de mundos / Mundos online | Container + grade de 12 colunas; cada mundo é um **cartão** (cabeçalho: nome; corpo: MOTD, host, jogadores, ping; rodapé: ações). Mundo selecionado com fundo selected-color e borda de 3 px #1E1E1F |
| Ações da lista | Entrar/Jogar = primary; Criar novo mundo / Entrar com código = secondary; Editar/Favoritar/Atualizar = tertiary; Excluir/Voltar = normal |
| Selos (senha, cheio, versão diferente, hardcore) | Texto pequeno com as cores de status (erro/aviso/informação) sobre fundo primary |
| Criar novo mundo e "Abrir para LAN" | Cartão com grupos de formulário (rótulo + campo); abas da seção 5 |
| Confirmar exclusão, senha do mundo, erros de conexão | Modal (cabeçalho, corpo, rodapé com botões) |
| Tela de conexão com etapas (PRD 15 RF-030) | Cartão central com a barra de progresso da seção 5 e botão normal "Cancelar" |

### 3.3 Telas dentro do jogo

| Tela | Componentes |
|---|---|
| Menu de pausa | Cartão central; **Voltar ao jogo** = primary; Abrir para LAN = secondary; Opções e Estatísticas = tertiary; Salvar e sair = normal |
| Opções (todas as telas do PRD 03) | Cartão por grupo, divisor entre grupos, botões normal para alternâncias, campo de texto para valores, slider e interruptor da seção 5, botão primary "Concluído" |
| Teclas | Lista em cartões; tecla atribuída em botão normal; conflito com error-color |
| Tela de morte | Cartão com título MinecraftTen; Renascer = primary; Tela de título = normal; fundo vermelho translúcido do PRD 05 por trás |
| Conquistas e estatísticas | Cartões e grade; abas da seção 5 |
| Bancada de armeiro, criador de itens, modais do Studio (PRD 09/10) | Cartões, formulários, modais e botões do projeto |
| Mind Cave Studio inteiro | Barra de navegação no topo, cartões para painéis, formulários para propriedades, botões das 4 variantes |

### 3.4 Textos e painéis do HUD

| Elemento | Componentes |
|---|---|
| Chat (mensagens e campo) | Texto MinecraftRegular branco; fundo das linhas e do campo na cor primary com a opacidade das Opções (PRD 03 §9); campo de texto do projeto ao digitar |
| Lista de jogadores (Tab) | Painel na cor primary com transparência, nomes MinecraftRegular, divisor entre cabeçalho e lista |
| Tela F3 | Texto MinecraftRegular com fundo primary translúcido por linha |
| Títulos e subtítulos, barra de ação, nome do item selecionado | MinecraftTen (títulos) e MinecraftRegular (demais), sombra de texto de 2,5 px como nos botões |
| Barra de chefe (texto), legendas de som, notificações ("Conquista obtida!", "Salvando…", "Conexão instável") | Cartão/toast da seção 5 com cores de status |
| Roda de emotes (PRD 07) | Botões normal numerados 1–9 sobre painel primary |
| Botão flutuante do visualizador (PRD 10 RF-003) | Botão tertiary pequeno com ícone de 24 px |

---

## 4. Escala da interface e pixel

**MC16-RF-040 (P0)** A opção "Escala da interface" (PRD 03) escala **toda a interface por igual** (fator aplicado ao contêiner raiz), sem alterar nenhum valor do Minecraft-CSS. Auto = escolhe o fator que faz a interface caber na tela (mínimo 1).

**MC16-RF-041 (P0)** Texto renderizado nítido (sem desfoque); bordas e sombras em pixels inteiros após a escala.

---

## 5. Componentes que o projeto não tem — composição permitida

Regra: compor **somente** com tokens da seção 2 e com o mesmo padrão de relevo do projeto (borda externa escura + brilho em cima/esquerda + sombra embaixo/direita). Nenhuma cor, fonte, raio ou sombra nova.

| Componente | Composição obrigatória |
|---|---|
| **Abas** | Botões normal lado a lado; aba ativa com o visual de hover do botão normal (verde #218306, texto branco) |
| **Slider** | Trilho = campo de texto do projeto (fundo #313233, borda 3 px #1E1E1F, sombra interna); pegador = botão normal; o valor escrito dentro do trilho ("Sensibilidade: 100%") em MinecraftRegular branco |
| **Interruptor liga/desliga** | Botão normal que mostra "LIGADO" (hover verde fixo) ou "DESLIGADO" (normal), clique alterna |
| **Caixa de seleção / lista suspensa** | Campo de texto do projeto + lista em cartão; item com hover = selected-color |
| **Barra de progresso** | Fundo = campo de texto do projeto; preenchimento = cor do botão primary (#3C8527) com a sombra interna inferior #1D4D13 |
| **Tooltip** | Cartão compacto (fundo #48494A, borda 3 px #1E1E1F, padding 8 px), título MinecraftTen, linhas MinecraftRegular |
| **Notificação (toast)** | Cartão com faixa lateral na cor de status (sucesso/aviso/erro/informação) |
| **Barra de rolagem** | Trilho #313233, polegar no estilo do botão normal |
| **Slot de inventário (18×18 virtual)** | Fundo #313233 com sombra interna de 3 px (como o campo de texto), borda #1E1E1F; slot sob o mouse com brilho #F7F7F7 a 50% — usado quando o pacote de recursos não tiver a textura de inventário |
| **Painel de tela grande** (opções longas) | Cartão dentro de container; o modal de 400 px é só para confirmações curtas |

---

## 6. O que continua vindo das texturas do jogo

O Minecraft-CSS não desenha sprites do HUD. Continuam vindo do pacote de recursos 1.8.9 importado (PRD 10 RF-075) ou do procedural (PRD 02 §11): hotbar e seletor, corações, fome, armadura, ar, barra de XP, mira, telas de inventário/baú/fornalha quando houver textura, ícones de efeitos e itens. Os **números e textos** desses elementos (contagem de itens, nível de XP, munição) usam a fonte MinecraftRegular com a sombra de texto do projeto.

---

## 7. Sons e interação

- **MC16-RF-070 (P0)** Todo botão toca o som de clique (PRD 02 RF-091) ao ser pressionado, sincronizado com o efeito de "afundar 2 px" do projeto.
- **MC16-RF-071 (P0)** Navegação por teclado em todas as telas (Tab/setas/Enter/Esc), com foco visível usando o visual de hover do botão.

---

## 8. Licença e créditos

- **MC16-RF-080 (P0)** O Minecraft-CSS é MPL-2.0: os arquivos dele ficam com o aviso de licença; mudanças só no arquivo de ajustes separado. Crédito "Minecraft.CSS por 0x4a4b" na tela Sobre/Créditos (PRD 12).
- As fontes Minecraft-Regular e Minecraft-Ten vêm junto com o projeto; como o Mind Cave é privado (só os dois devs), o uso é permitido nesse contexto.

---

## 9. Código de referência

Pasta "mind-cave-codigo-referencia/12-ui-minecraft-css": o projeto inteiro (src, fontes, página de demonstração index.html, README e licença). A página de demonstração mostra todos os componentes juntos e serve de comparação visual.

---

## 10. Critérios de aceite

- **MC16-CA-01** Lobby, Um Jogador, Multijogador, Criar mundo, Abrir para LAN, Pausa, Opções (todas), Morte, Conquistas, Estatísticas e Studio usam só componentes do Minecraft-CSS ou as composições da seção 5 — nenhum botão, card, input ou diálogo com estilo shadcn/Tailwind padrão.
- **MC16-CA-02** Conta-gotas nas telas: botão primary #3C8527 (hover #2A641C), secondary #7345E5, tertiary #D0D1D4, normal #C6C6C6 (hover #218306), campo de texto #313233, cartão #48494A, fundo #313233.
- **MC16-CA-03** Títulos em MinecraftTen e textos em MinecraftRegular em todas as telas e no chat/Tab/F3; nenhuma fonte padrão do navegador aparece.
- **MC16-CA-04** Botões afundam 2 px ao clicar e perdem a sombra inferior, exatamente como na página de demonstração do projeto.
- **MC16-CA-05** Comparando a página de demonstração (12-ui-minecraft-css/index.html) com o lobby, botões, cartões, campos, divisores e barra de navegação são visualmente idênticos.
- **MC16-CA-06** Escala da interface 1–4 e Auto aumentam a interface inteira sem mudar proporções nem cores.
- **MC16-CA-07** Nenhum arquivo do Minecraft-CSS foi editado; ajustes estão só no arquivo separado e usam apenas tokens do projeto.
