# MIND CAVE — PRD 20
# Tela de Opções 100% Funcional (Telas da Java 1.8.9 + Extras Mind Cave, Cada Opção Ligada ao Sistema que Ela Controla)

| Campo | Valor |
|---|---|
| Depende de | PRD 03 (lista de opções), PRD 19 (visual Java 1.8.9), PRDs 02, 07, 12, 13, 15 (sistemas controlados pelas opções) |
| Tipo | **PRD corretivo.** O PRD 03 descreveu as opções; este PRD exige que **cada uma funcione de verdade**, define as telas no layout da 1.8.9 e cria testes que provam o efeito de cada opção. Onde contradizer o PRD 03, vale este. |
| Problema | Telas de opções que só mudam o texto do botão e não alteram o jogo, teclas fixas no código, opções que só funcionam depois de recarregar, valores que não são salvos. |
| Código de referência | "mind-cave-codigo-referencia/14-opcoes-funcionais/minecraft-web-client": armazenamento de opções, **observadores que aplicam cada opção ao vivo**, esquema das telas de opções, tela de teclas, slider e botão Java |

---

## 1. Regras de funcionamento (valem para todas as opções)

**MC20-RF-001 (P0) — Um único armazenamento de opções.** Todas as opções vivem num armazenamento central reativo (cada opção: chave, valor padrão, faixa, escopo, rótulo, texto de ajuda). Telas **só** leem e escrevem nele. Nenhum sistema do jogo guarda cópia própria do valor.

**MC20-RF-002 (P0) — Cada opção tem um consumidor.** Para cada opção existe um "observador" que, quando o valor muda, aplica o efeito no sistema certo (render, áudio, entrada, rede, servidor, HUD) **em até 1 segundo, sem recarregar a página nem sair do mundo**. As poucas que exigem reconstruir algo (ex.: luz suave, mipmap) disparam a reconstrução progressiva sozinhas. A tabela da seção 3 define o consumidor e a prova de cada opção.

**MC20-RF-003 (P0) — Teclas nunca fixas no código.** Toda ação do jogo (andar, pular, atacar, inventário, chat, F-teclas, hotbar 1–9, emotes, recarregar…) é lida **pelo mapa de teclas**. Procurar e remover qualquer verificação direta de tecla fora do sistema de entrada. Trocar uma tecla nas opções funciona imediatamente, inclusive com botões do mouse e roda.

**MC20-RF-004 (P0) — Salvamento.** Mudou → salva localmente na hora e sincroniza com a entity GameSettings do Base44 em até 2 s (escopos do PRD 03: dispositivo, usuário, mundo). Ao abrir o jogo, as opções são carregadas **antes** do primeiro quadro e aplicadas por todos os observadores.

**MC20-RF-005 (P0) — Compatível com o options.txt da 1.8.9.** Exportar e importar as opções no formato do arquivo options.txt da Java 1.8.9 (linhas "chave:valor", mesmas chaves e mesmas escalas — tabela da seção 4), além do JSON completo do Mind Cave. Importar o options.txt do próprio Minecraft dos devs aplica sensibilidade, FOV, teclas, volumes, vídeo e chat.

**MC20-RF-006 (P0) — Mesmo comportamento de botões da Java.** Botões de alternância: clique esquerdo avança o valor, Shift+clique volta. Sliders arrastam e mostram "Nome: valor" dentro. "Pronto" volta à tela anterior. Esc = Pronto. Visual e medidas do PRD 19.

---

## 2. Telas (layout e conteúdo da Java 1.8.9 + extras)

### 2.1 Opções (tela principal)

Título "Opções". Linha 1: slider **Campo de visão** e botão **Dificuldade** (com cadeado, só para o host dentro do mundo). Depois botões de 150 px em duas colunas:

| Coluna esquerda | Coluna direita |
|---|---|
| Personalização de skin... | Músicas e sons... |
| Configurações de vídeo... | Controles... |
| Idioma... | Configurações do chat... |
| Pacotes de recursos... | Multijogador e rede... |
| Shaders... (Mind Cave) | Desempenho... (Mind Cave) |
| Acessibilidade... (Mind Cave) | Perfis de qualidade... (Mind Cave) |
| Configurações do mundo... (Mind Cave, host) | Importar/Exportar... (Mind Cave) |

Embaixo: **Pronto** (200 px). A tela é a mesma no menu principal e na pausa (no menu principal, Dificuldade e Configurações do mundo ficam desativados).

### 2.2 Configurações de vídeo (lista da 1.8.9, duas colunas, nesta ordem)

Gráficos · Distância de renderização · Iluminação suave · Taxa de quadros máxima · 3D anáglifo · Balanço da visão · Tamanho da interface · Brilho · Nuvens · Tela cheia · Partículas · Usar VSync · Usar VBOs · Níveis de mipmap · Blocos alternativos · Sombras de entidades — e, abaixo de um separador "Mind Cave": Escala de resolução · Filtragem anisotrópica · Folhas · Grama melhorada · Névoa · Início da névoa · Céu · Sol e lua · Estrelas · Texturas animadas · Luzes dinâmicas · Distância de entidades · Atualizações de chunk por quadro · Câmera suave · Zoom (FOV) · Efeitos de FOV · Mostrar FPS · Tremor de tela · Mistura de bioma · Greedy meshing.

### 2.3 Músicas e sons

Volume geral (slider largo no topo) e, em duas colunas: Música · Toca-discos/blocos musicais · Clima · Blocos · Criaturas hostis · Criaturas amigáveis · Jogadores · Ambiente — mais (Mind Cave) Armas · Interface · Legendas · Áudio sem foco · Dispositivo de saída.

### 2.4 Controles

No topo, em duas colunas: **Inverter mouse**, **Sensibilidade** (slider), **Entrada bruta**, **Rolagem discreta**, **Sensibilidade ao mirar**, **Sensibilidade no zoom**, **Agachar: Segurar/Alternar**, **Correr: Segurar/Alternar**. Abaixo, a **lista de teclas** agrupada por categoria (Movimento, Jogabilidade, Inventário, Multijogador, Diversos, Mind Cave): nome da ação à esquerda, botão da tecla (75 px) à direita, botão "Redefinir" por linha; ao clicar, o botão mostra "> ??? <" esperando a tecla; conflito em vermelho. Embaixo: **Redefinir teclas** e **Pronto**.

### 2.5 Configurações do chat

Chat (Visível / Só comandos / Oculto) · Cores · Links da web · Confirmar links · Opacidade · Escala · Largura · Altura (focado) · Altura (sem foco) · Informações de debug reduzidas — mais (Mind Cave) Carimbo de hora · Tempo visível · Notificar menções.

### 2.6 Personalização de skin

Capa · Jaqueta · Manga esquerda · Manga direita · Perna esquerda da calça · Perna direita da calça · Chapéu (Ligado/Desligado) — mais (Mind Cave) **Skin...** (escolha de skin/GLB com prévia 3D girável) e **Modelo do braço: Clássico/Fino**.

### 2.7 Idioma e pacotes de recursos

- Idioma: lista (Português (Brasil), English), botão **Forçar fonte Unicode** e Pronto. Troca o texto de todas as telas na hora.
- Pacotes de recursos: duas listas como a 1.8.9 ("Disponíveis" à esquerda, "Selecionados" à direita, setas para mover e reordenar), botão **Abrir importador** (PRD 10 RF-075) e Pronto. Selecionar aplica texturas, fonte, sons e interface na hora (reconstrução progressiva das malhas).

### 2.8 Telas extras Mind Cave

Shaders (PRD 03 §5), Desempenho (PRD 03 §12), Multijogador e rede (PRD 03 §10 + PRD 15), Acessibilidade (PRD 03 §11), Perfis de qualidade (PRD 03 §13), Configurações do mundo (PRD 03 §14 — regras do jogo), Importar/Exportar (RF-005). Todas com o visual Java e as regras da seção 1.

---

## 3. Tabela de funcionamento — o que cada opção faz e como provar

Cada linha precisa funcionar exatamente assim. A coluna "Prova" é o teste manual; os testes automáticos estão na seção 5.

### 3.1 Principal, vídeo e desempenho

| Opção | Valores (1.8.9) | Efeito real (consumidor) | Prova |
|---|---|---|---|
| Campo de visão | 30–110 ("Normal" = 70, "Quake Pro" = 110) | FOV da câmera do mundo (não muda a mão) | Arrastar o slider e ver o campo de visão mudar na hora |
| Dificuldade | Pacífico/Fácil/Normal/Difícil + cadeado | Servidor: spawn de hostis, dano, fome (PRD 05) | Pacífico remove hostis existentes |
| Gráficos | Rápidos/Detalhados | Folhas opacas ou transparentes, nuvens 2D/3D, vinheta | Folhas viram blocos opacos ao trocar |
| Distância de renderização | 2–16 (até 32 com memória) | Raio pedido ao servidor e desenhado; descarrega o que saiu | F3 mostra a quantidade de chunks mudando; névoa acompanha |
| Iluminação suave | Desligada/Mínima/Máxima | Mesher refaz seções com luz por face, suave ou suave + AO | Cantos internos escurecem só em Máxima |
| Taxa de quadros máxima | 10–250 (passos de 10) ou Ilimitada | Limitador do loop de render | F3 mostra o FPS travado no valor |
| 3D anáglifo | Ligado/Desligado | Render estéreo vermelho/ciano | Imagem fica com contorno vermelho/ciano |
| Balanço da visão | Ligado/Desligado | Balanço da câmera e da mão ao andar | Andar sem balanço quando desligado |
| Tamanho da interface | Auto/Pequena/Normal/Grande | Fator de escala da GUI (regra 320×240 do PRD 19) | Toda a interface muda de tamanho na hora |
| Brilho | 0–100% ("Sombrio" a "Claro") | Gamma no lightmap | Caverna fica mais clara em 100% |
| Nuvens | Desligadas/Rápidas/Detalhadas | Camada de nuvens | Nuvens somem / ficam planas / 3D |
| Tela cheia | Ligada/Desligada (F11) | Tela cheia do navegador | Entra e sai de tela cheia |
| Partículas | Todas/Reduzidas/Mínimas | Limite e emissores de partículas | Quebrar bloco gera menos fragmentos |
| Usar VSync | Ligado/Desligado | Sincronia de quadros | FPS limitado à taxa do monitor quando ligado |
| Usar VBOs | Ligado/Desligado | Sem efeito visual no navegador; mantido por compatibilidade com o options.txt (sempre usa buffers na GPU) | Valor salvo e exportado |
| Níveis de mipmap | 0–4 | Mipmaps do array de texturas | Chão distante serrilhado em 0, suave em 4 |
| Blocos alternativos | Ligado/Desligado | Rotação aleatória de textura (grama/terra/areia) | Topo da grama vira repetitivo ao desligar |
| Sombras de entidades | Ligado/Desligado | Sombra redonda sob jogadores/mobs/itens | Sombra some |
| Escala de resolução | 50–200% | Resolução interna do render | Imagem pixelada em 50%, FPS sobe |
| Filtragem anisotrópica | Desl./2×/4×/8×/16× | Filtro das texturas | Chão em ângulo fica nítido em 16× |
| Folhas | Rápidas/Detalhadas/Inteligentes | Modo das folhas | Inteligente: borda transparente, interior opaco |
| Grama melhorada | Desl./Rápida/Detalhada | Lateral da grama | Encostas ficam verdes contínuas |
| Névoa / Início da névoa | Desl./Rápida/Detalhada; 20–80% | Névoa do mundo | Borda dos chunks aparece sem névoa |
| Céu / Sol e lua / Estrelas | Ligado/Desligado cada | Elementos do céu | Cada um some ao desligar |
| Texturas animadas | Todas/Dinâmicas/Desligadas + água, lava, fogo, portal | Animação de texturas | Água para de animar |
| Luzes dinâmicas | Desl./Rápida/Detalhada | Luz da tocha na mão | Segurar tocha ilumina a caverna |
| Distância de entidades | 50–500% | Distância de render de mobs/itens | Mobs distantes somem em 50% |
| Atualizações de chunk por quadro | 1–8 | Orçamento de upload de malhas (PRD 13) | Terreno carrega mais rápido em 8 |
| Câmera suave | Ligada/Desligada (F8) | Suavização do mouse | Câmera "desliza" |
| Zoom (FOV) | 10–30° | FOV ao segurar a tecla de zoom | Segurar C aproxima |
| Efeitos de FOV | 0–100% | Variação de FOV por correr/voar/arco | Correr não muda FOV em 0% |
| Mostrar FPS | Ligado/Desligado | Contador no canto | Contador aparece |
| Tremor de tela | 0–100% | Tremor de dano/explosão/recuo | Explosão não treme em 0% |
| Mistura de bioma | Desl./3×3/5×5 | Suavização da cor da grama entre biomas | Fronteira de bioma fica dura em Desl. |
| Greedy meshing | Auto/Ligado/Desligado | Mesher (PRD 13) | F3 mostra menos triângulos ligado |
| Workers, memória, ritmo de carregamento, pausar render oculto, economia, gráfico de desempenho, limpar cache | PRD 03 §12 | Sistemas de desempenho | Cada um com efeito visível no F3 ou no comportamento |

### 3.2 Som

| Opção | Valores | Efeito | Prova |
|---|---|---|---|
| Volume geral e cada categoria | 0–100% | Ganho de cada categoria no motor de áudio | Zerar "Blocos" silencia passos e quebra, mantém o resto |
| Legendas | Ligado/Desligado | Painel de legendas | Sons aparecem escritos com direção |
| Áudio sem foco | Silenciar/Reduzir/Manter | Volume quando a aba perde o foco | Trocar de aba silencia |
| Dispositivo de saída | Lista | Saída de áudio (quando o navegador permite) | Som sai no dispositivo escolhido |

### 3.3 Controles

| Opção | Valores (1.8.9) | Efeito | Prova |
|---|---|---|---|
| Sensibilidade | 0% ("*bocejo*") a 200% ("HIPERVELOCIDADE!!!"), padrão 100% | Fórmula da 1.8: fator = (s × 0,6 + 0,2)³ × 8 sobre o movimento do mouse | Mesma distância física de mouse gira o mesmo ângulo em qualquer FPS |
| Inverter mouse | Ligado/Desligado | Eixo Y invertido | Mouse para cima olha para baixo |
| Entrada bruta | Ligada/Desligada | Movimento sem aceleração do sistema | Movimentos lentos e rápidos com a mesma proporção |
| Rolagem discreta / Sensibilidade de rolagem | — | Troca de slot pela roda | 1 "dente" = 1 slot |
| Sensibilidade ao mirar / no zoom | 10–200% / 10–100% | Multiplicadores no ADS e zoom | Mira mais lenta ao mirar |
| Agachar/Correr: Segurar/Alternar | — | Modo da tecla | Um toque mantém agachado em Alternar |
| Cada tecla | Qualquer tecla, botão do mouse ou roda | Mapa de teclas (RF-003) | Trocar Pular para J: J pula, Espaço não |

### 3.4 Chat, skin, idioma, pacotes, rede, acessibilidade, mundo

| Grupo | Efeito exigido | Prova |
|---|---|---|
| Chat | Visibilidade, cores §, links, opacidade, escala, largura, alturas, carimbo, tempo visível aplicados ao chat na hora | Ocultar chat esconde mensagens; largura muda a quebra de linha |
| Informações de debug reduzidas | F3 sem coordenadas | F3 não mostra XYZ |
| Skin | Partes ligam/desligam no modelo **para os dois jogadores** na hora; troca de skin/GLB e braço fino/clássico | O amigo vê a jaqueta sumir |
| Idioma | Todos os textos mudam de idioma na hora | Menu fica em inglês |
| Forçar fonte Unicode | Usa a fonte Unicode em toda a interface | Texto muda de fonte |
| Pacotes de recursos | Aplicar/remover/reordenar muda texturas, sons, fonte e interface | Botões viram os do pacote importado |
| Multijogador e rede | STUN/TURN, forçar TURN, testar conectividade, relay, interpolação, ping, opções do host (máx. jogadores, distância de convidados, PvP, modo dos convidados, comandos) | "Testar conectividade" mostra resultado; PvP desligado impede dano entre jogadores |
| Acessibilidade | Legendas, reduzir flashes, fundo do texto, mira de alto contraste, filtros de daltonismo, ocultar distorção | Filtro de daltonismo muda as cores da tela inteira |
| Configurações do mundo (host) | Cada regra do jogo (PRD 03 §14) aplicada no servidor e enviada ao convidado | doDaylightCycle desligado para o sol para os dois |
| Shaders e Perfis | Predefinições e cada parâmetro mudam o render ao vivo (PRD 02 §8); perfil muda várias opções de uma vez e marca "Personalizado" ao mexer em uma | Sombras aparecem ao escolher Ultra |

---

## 4. Chaves do options.txt da 1.8.9 (para importar/exportar)

| Chave | Significado | Escala no arquivo |
|---|---|---|
| invertYMouse | Inverter mouse | true/false |
| mouseSensitivity | Sensibilidade | 0,0–1,0 (0,5 = 100%) |
| fov | Campo de visão | −1,0 a 1,0 (0 = 70; FOV = 70 + valor × 40) |
| gamma | Brilho | 0,0–1,0 |
| renderDistance | Distância | 2–32 |
| guiScale | Tamanho da interface | 0 Auto, 1 Pequena, 2 Normal, 3 Grande |
| particles | Partículas | 0 Todas, 1 Reduzidas, 2 Mínimas |
| bobView | Balanço | true/false |
| anaglyph3d | Anáglifo | true/false |
| maxFps | Taxa máxima | 10–260 (260 = Ilimitada) |
| difficulty | Dificuldade | 0–3 |
| fancyGraphics | Gráficos detalhados | true/false |
| ao | Iluminação suave | 0 Desl., 1 Mínima, 2 Máxima |
| renderClouds | Nuvens | false / fast / true |
| fullscreen, enableVsync, useVbo, entityShadows, allowBlockAlternatives, forceUnicodeFont, reducedDebugInfo, advancedItemTooltips, pauseOnLostFocus | Alternâncias | true/false |
| mipmapLevels | Mipmap | 0–4 |
| lang | Idioma | pt_BR / en_US |
| resourcePacks | Pacotes ativos | lista |
| chatVisibility | Chat | 0 Visível, 1 Só comandos, 2 Oculto |
| chatColors, chatLinks, chatLinksPrompt | Chat | true/false |
| chatOpacity, chatScale, chatWidth, chatHeightFocused, chatHeightUnfocused | Chat | 0,0–1,0 |
| soundCategory_master / music / record / weather / block / hostile / neutral / player / ambient | Volumes | 0,0–1,0 |
| modelPart_cape / jacket / left_sleeve / right_sleeve / left_pants_leg / right_pants_leg / hat | Partes da skin | true/false |
| key_key.attack, key_key.use, key_key.forward … key_key.hotbar.9 | Teclas | códigos de tecla da 1.8.9 (mouse: −100 esquerdo, −99 direito, −98 meio) convertidos para os códigos do navegador |

Opções que só existem no Mind Cave são exportadas com o prefixo "mindcave_" (o Minecraft ignora chaves desconhecidas).

---

## 5. Prova automática

**MC20-RF-050 (P0) — Autoteste de opções (dev).** Em Opções → Desempenho → "Testar todas as opções" (ou comando de dev): o jogo percorre as opções testáveis automaticamente, muda o valor, verifica o estado do sistema consumidor e restaura o valor original. Exemplos de verificação: FOV da câmera igual ao valor; raio de chunks pedido igual à distância; volume da categoria igual ao slider; folhas no modo certo no mesher; escala da GUI aplicada no contêiner raiz; mapa de teclas com a nova tecla; idioma dos textos trocado. Resultado: lista "OK / FALHOU" por opção, copiável. **Nenhuma opção pode ficar sem consumidor** — opção sem observador registrado aparece como "SEM EFEITO".

**MC20-RF-051 (P0) — Inventário de opções.** O autoteste também lista opções existentes no armazenamento que não aparecem em nenhuma tela e botões de tela que não estão ligados a nenhuma opção (ambos são erro).

---

## 6. Critérios de aceite

- **MC20-CA-01** O autoteste roda com 100% "OK" (exceto as que exigem ação manual, marcadas como "verificar manualmente").
- **MC20-CA-02** Toda a tabela da seção 3 passa no teste manual, dentro do mundo, sem recarregar a página.
- **MC20-CA-03** Trocar qualquer tecla funciona na hora; nenhuma ação do jogo ignora o mapa de teclas.
- **MC20-CA-04** Fechar e reabrir o navegador mantém todas as opções; em outro computador com o mesmo usuário, controles, sons, skin, chat e idioma vêm junto e vídeo não.
- **MC20-CA-05** Importar o options.txt real de um Minecraft 1.8.9 aplica sensibilidade, FOV, teclas, volumes e vídeo corretamente; exportar e reimportar devolve os mesmos valores.
- **MC20-CA-06** Todas as telas de opções seguem o visual e o layout Java do PRD 19, com textos em PT-BR.
