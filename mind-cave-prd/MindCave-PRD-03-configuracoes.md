# MIND CAVE — PRD 03 de 12
# Configurações Completas (Vídeo, Shaders, Sombras, Controles, Mouse, Áudio, Skin, Chat, Rede, Mundo, Acessibilidade, Desempenho)

| Campo | Valor |
|---|---|
| Depende de | PRD 01 (fundação) e PRD 02 (render, shaders, UI, sons) |
| Objetivo | Dar ao jogador **controle total** sobre o jogo: cada recurso visual, cada tecla, cada volume, qualidade, sombras ligadas/desligadas, e as regras do mundo — com a mesma organização de telas da 1.8.9 e extensões úteis (ajustes avançados de performance e shaders). As configurações são salvas, sincronizadas e aplicadas **ao vivo** sempre que possível. |
| Próximo | PRD 04 — Geração de Mundo e os 2 Mapas |

> Documento de requisitos. Define telas, opções, valores, padrões, efeitos e persistência. A organização interna do código é decisão da IA executora.

---

## 1. Princípios das configurações

1. **Fonte única de verdade:** um *store* central de configurações tipado (cada opção tem chave, tipo, valor padrão, faixa válida, escopo, se requer reinício/remeshing, e texto de ajuda). Toda tela lê e escreve nesse store. Nenhuma opção existe "solta" no código.
2. **Aplicação ao vivo:** ao mudar uma opção, o efeito aparece em ≤ 1 s, **sem recarregar a página** e sem sair do mundo, exceto quando marcado como "requer recarregar mundo" (aviso explícito na opção).
3. **Escopos:**
   - **Por dispositivo** (padrão para vídeo, shaders, desempenho, tela cheia, dispositivo de áudio): cada computador tem seus próprios valores, porque os dois jogadores têm PCs diferentes.
   - **Por usuário** (sincronizado na nuvem): controles, sensibilidade, áudio por categoria, skin, chat, acessibilidade, idioma.
   - **Por mundo** (definido pelo host, salvo no mundo): dificuldade, regras do jogo, PvP, armas, etc.
4. **Persistência:** salvar localmente na hora (armazenamento do navegador) e sincronizar com a entity `GameSettings` do Base44 com *debounce* de 2 s. Na primeira execução num dispositivo novo, os valores "por usuário" vêm da nuvem e os "por dispositivo" vêm da detecção automática (PRD 02 RF-064).
5. **Visual:** interface Java 1.8.9 do PRD 19 (botões de widgets, fundo de terra, fonte bitmap); organização das telas no estilo da 1.8.9 (grade de botões em 2 colunas, 150×20 px virtuais cada, botões que alternam valores ao clicar, sliders com o valor escrito dentro, "Concluído" embaixo). Extensões: **campo de busca** no topo de cada tela, **tooltip** ao passar o mouse com explicação + impacto de desempenho (Nenhum / Baixo / Médio / Alto) e botão **"Restaurar padrão"** por tela.
6. **Clique esquerdo** avança o valor de um botão de alternância; **clique direito** (ou Shift+clique) volta. Rolagem do mouse sobre slider ajusta fino.
7. **Idioma:** todo texto vem de arquivos de tradução (chaves). Idiomas: Português (Brasil) padrão e Inglês.

---

## 2. Mapa de telas

Tela **Opções…** com os itens: Campo de visão (slider), Dificuldade (host), Personalização de skin, Música e sons, Configurações de vídeo, Controles, Configurações de shaders, Idioma, Pacotes de assets (PRD 10), Configurações de chat, Multijogador e rede, Acessibilidade, Desempenho avançado, Configurações do mundo (host), Perfis de qualidade, Importar/Exportar configurações, Sobre o build e Concluído.

O menu Opções é acessível no menu principal e no menu de pausa (no jogo, opções "do mundo" só aparecem para o host; para o convidado aparecem em modo somente leitura).

---

## 3. Tela principal de Opções

| Opção | Tipo | Padrão | Faixa / Valores | Efeito |
|---|---|---|---|---|
| **Campo de visão (FOV)** | Slider | 70 ("Normal") | 30–110 (110 = "Quake Pro") | FOV vertical da câmera de mundo. Não altera a mão em 1ª pessoa (FOV fixo da mão). |
| **Dificuldade** | Botão | Normal | Pacífico, Fácil, Normal, Difícil | Host apenas. Efeitos reais no PRD 05/08. Botão de cadeado "Travar dificuldade" (como no 1.8). |

---

## 4. Configurações de vídeo

### 4.1 Opções equivalentes à 1.8.9

| Opção | Padrão | Valores | Efeito / Observações | Escopo |
|---|---|---|---|---|
| **Gráficos** | Detalhados | Rápidos / Detalhados | Rápidos: folhas opacas, nuvens 2D, sem vinheta, grama lateral simplificada, água sem faces internas extras, sombras de entidade desligadas por padrão. Detalhados: tudo do PRD 02 no visual clássico. | Dispositivo |
| **Distância de visão** | 8 (auto-detectado) | 2–32 chunks | Muda o raio de carregamento enviado ao servidor. Para o convidado, o host pode limitar o máximo (seção 10). Acima de 16 marcar "Experimental". | Dispositivo |
| **Iluminação suave** | Máxima | Desligada / Mínima / Máxima | PRD 02 RF-023. Requer remeshing progressivo. | Dispositivo |
| **FPS máximo** | VSync | 10–260 em passos de 10, Ilimitado, VSync | Limita a taxa de quadros (com `requestAnimationFrame` + controle de tempo). Ao entrar em menus fora do jogo, limitar a 30 para economizar. | Dispositivo |
| **3D anáglifo** | Desligado | Liga/Desliga | Render estéreo vermelho/ciano (P2). | Dispositivo |
| **Balanço da visão (view bobbing)** | Ligado | Liga/Desliga | Balanço da câmera ao andar. | Usuário |
| **Escala da interface** | Auto | Auto, 1, 2, 3, 4 | PRD 02 RF-071. | Dispositivo |
| **Brilho** | 0% ("Escuro") | 0–100% ("Escuro" → "Claro") | Ajuste de gamma no lightmap. | Dispositivo |
| **Nuvens** | Detalhadas | Desligadas / Rápidas / Detalhadas | PRD 02 RF-042. | Dispositivo |
| **Tela cheia** | Desligada | Liga/Desliga (F11) | Fullscreen API. | Dispositivo |
| **Partículas** | Todas | Todas / Reduzidas / Mínimas | Limites do PRD 02 RF-050. Mínimas ainda mostra partículas essenciais (quebra de bloco reduzida). | Dispositivo |
| **Sincronização vertical** | Ligada | Liga/Desliga | Integra com "FPS máximo". | Dispositivo |
| **Níveis de mipmap** | 4 | 0–4 | Gera mipmaps do array de texturas; 0 = sem mipmap (mais serrilhado ao longe). | Dispositivo |
| **Sombras de entidades** | Ligadas | Liga/Desliga | Sombra redonda escura sob jogadores, mobs e itens no modo clássico (decal no chão, raio proporcional ao tamanho, some com a altura). | Dispositivo |
| **Blocos alternativos** | Ligado | Liga/Desliga | Liga a variação aleatória de textura/rotação (PRD 02 RF-012). | Dispositivo |

### 4.2 Extensões Mind Cave (seção "Detalhes" dentro de Vídeo)

| Opção | Padrão | Valores | Efeito |
|---|---|---|---|
| **Escala de resolução** | 100% | 50–200% | Render interno em resolução menor/maior, depois escalado (nearest para pixel art em <100%, linear opcional). Opção mais eficaz para GPUs fracas. |
| **Filtragem anisotrópica** | 4× | Desl., 2×, 4×, 8×, 16× | Texturas nítidas em ângulo rasante. |
| **Folhas** | Padrão (segue Gráficos) | Rápidas / Detalhadas / Inteligentes | Inteligentes: detalhadas na borda da copa, opacas no interior. |
| **Grama melhorada** | Desligada | Desl. / Rápida / Detalhada | Lado do bloco de grama mostra a textura do topo quando há grama vizinha abaixo (visual de "tapete contínuo"). |
| **Névoa** | Ligada | Desl. / Rápida / Detalhada; Início da névoa 20–80% | Desligar a névoa mostra a borda de chunks (aviso). |
| **Céu / Sol e lua / Estrelas** | Ligados | Liga/Desliga cada | — |
| **Texturas animadas** | Todas | Todas / Dinâmicas / Desligadas + individuais: água, lava, fogo, portal | Desligar fixa no primeiro quadro. |
| **Luzes dinâmicas** | Desligada | Desl. / Rápida (atualiza a cada 500 ms) / Detalhada (a cada quadro) | Item luminoso na mão (tocha, glowstone, lava) ou caído no chão **emite luz** em volta do portador. Implementação visual apenas (não altera a luz do servidor nem o spawn de mobs). |
| **Distância de entidades** | 100% | 50–500% | Multiplica a distância em que mobs/itens são renderizados. |
| **Distância da névoa de clima** | — | — | (reservado PRD 05) |
| **Atualizações de chunk por quadro** | 2 | 1–8 | Quantas malhas prontas são enviadas à GPU por quadro (troca entre suavidade e velocidade de carregamento). |
| **Câmera suave** | Desligada | Liga/Desliga (F8) | Câmera cinematográfica com suavização do mouse (equivalente ao modo cinemático do 1.8). |
| **Zoom** | Tecla C | FOV de zoom 10–30° | Segurar a tecla reduz o FOV e a sensibilidade proporcionalmente. |
| **Efeitos de FOV** | 100% | 0–100% | Escala a variação de FOV por sprint, voo, arco puxado, efeitos de velocidade/lentidão. |
| **Mostrar FPS no canto** | Desligado | Liga/Desliga | Contador pequeno sem abrir o F3. |
| **Tremor de tela** | 100% | 0–100% | Escala tremores de explosão e do recuo de armas (PRD 09). |

### 4.3 Sombras (requisito explícito)

O jogador precisa poder escolher claramente **com sombra / sem sombra** e o nível. Reunir numa subseção "Sombras" (presente tanto em Vídeo quanto em Shaders, apontando para o mesmo store):

| Opção | Valores | Disponível em |
|---|---|---|
| **Sombras de entidades (blob)** | Liga/Desliga | Clássico e Shaders |
| **Sombras dinâmicas do sol/lua** | Desligadas / Baixa / Média / Alta / Ultra | Somente modo Shaders (no Clássico aparece desabilitado com tooltip "Ative o modo Shaders") |
| **Resolução do mapa de sombra** | 512, 1024, 2048, 4096 | Shaders |
| **Distância das sombras** | 32–192 blocos | Shaders |
| **Número de cascatas** | 1–4 | Shaders |
| **Suavidade** | Dura / PCF / PCF suave / PCSS | Shaders |
| **Sombras de folhagem** | Liga/Desliga | Shaders (folhas projetam sombra com alpha-teste) |
| **Sombras de entidades dinâmicas** | Liga/Desliga | Shaders (mobs/jogadores projetam sombra real; se desligado, só blob) |
| **Sombras de nuvens** | Liga/Desliga | Shaders, Alto+ |
| **Oclusão ambiente** | Desl. / Só vértice (clássico) / SSAO / GTAO | Ambos (SSAO/GTAO só em Shaders) |

---

## 5. Configurações de shaders

**MC03-RF-050 (P0) — Tela de Shaders.** Seletor no topo: **Modo de render**: Clássico / Shaders. Abaixo, **Predefinição**: Desligado, Leve, Médio, Alto, Ultra, Cinemático, Personalizado (PRD 02 RF-062). Mudar qualquer parâmetro individual transforma a predefinição em "Personalizado (baseado em X)".

**MC03-RF-051 (P0) — Parâmetros individuais (agrupados em abas).**
- **Iluminação:** intensidade do sol, intensidade da luz de bloco, cor da luz de bloco (quente/neutra/fria), brilho ambiente noturno, exposição, adaptação automática (liga/vel.), tonemapping (ACES/AgX/Desligado).
- **Sombras:** (seção 4.3).
- **Água:** ondas (desl./baixa/alta), altura das ondas, reflexos (desl./céu/SSR baixo/SSR alto), refração, cáusticas, espuma, cor da água (seguir bioma / personalizada), transparência.
- **Céu e atmosfera:** atmosfera física (liga), tamanho do sol, halo, estrelas brilho, nuvens volumétricas (desl./baixa/média/alta), cobertura de nuvens, altura das nuvens.
- **Efeitos volumétricos:** raios de luz (desl./baixo/alto), névoa volumétrica em cavernas/água.
- **Vegetação:** folhas ondulantes, grama ondulante, plantações ondulantes, intensidade do vento, rajadas.
- **Pós-processamento:** bloom (intensidade/limiar), vinheta, saturação, contraste, temperatura de cor, aberração cromática (0 padrão), granulação (0 padrão), nitidez, antisserrilhamento (desl./FXAA/SMAA/TAA), profundidade de campo (Cinemático), desfoque de movimento.
- **Materiais:** normais geradas a partir da textura (liga/intensidade), usar mapas PBR enviados (liga), brilho especular em metais/água/gelo.

**MC03-RF-052 (P0) — Predefinições personalizadas.** "Salvar como…" cria uma predefinição nomeada (salva por usuário, aplicável em qualquer dispositivo). Lista com renomear/excluir/duplicar.

**MC03-RF-053 (P1) — Pré-visualização dividida.** Botão "Comparar" que mostra metade da tela com o modo Clássico e metade com o Shaders (linha vertical arrastável), para ajustar.

**MC03-RF-054 (P1) — Medidor de custo.** Na tela de shaders, um painel com FPS atual, tempo de GPU por pass (quando a consulta de timer estiver disponível) e recomendação automática.

---

## 6. Controles

### 6.1 Mouse

| Opção | Padrão | Valores |
|---|---|---|
| **Sensibilidade** | 100% | 0% ("Bocejo") – 200% ("HIPERVELOCIDADE!!!") — curva equivalente à 1.8: fator = (sensibilidade × 0,6 + 0,2)³ × 8, multiplicado pelo deslocamento do mouse em pixels |
| **Inverter mouse** | Desligado | Liga/Desliga (eixo Y) |
| **Entrada bruta (raw input)** | Ligada | Usa `unadjustedMovement` do Pointer Lock quando o navegador suportar (sem aceleração do SO) |
| **Sensibilidade de rolagem** | 1,0 | 0,1–10 |
| **Rolagem discreta** | Desligada | Cada "notch" troca exatamente 1 slot |
| **Sensibilidade ao mirar (ADS)** | 100% | 10–200% — multiplicador ao mirar com arma (PRD 09) ou arco puxado |
| **Sensibilidade no zoom** | 50% | 10–100% |

### 6.2 Teclas (atribuíveis)

**MC03-RF-060 (P0) — Lista de ações com padrão 1.8.9 + extensões.**

| Categoria | Ação | Padrão |
|---|---|---|
| Movimento | Frente / Esquerda / Trás / Direita | W / A / S / D |
| Movimento | Pular | Espaço |
| Movimento | Agachar | Shift esquerdo |
| Movimento | Correr | Ctrl esquerdo |
| Jogabilidade | Atacar/Destruir | Botão esquerdo |
| Jogabilidade | Usar item/Colocar bloco | Botão direito |
| Jogabilidade | Escolher bloco | Botão do meio |
| Jogabilidade | Soltar item (Ctrl+tecla solta a pilha) | Q |
| Inventário | Abrir inventário | E |
| Inventário | Slots 1–9 da hotbar | 1–9 |
| Multijogador | Abrir chat | T |
| Multijogador | Abrir comando | / |
| Multijogador | Lista de jogadores | Tab |
| Diversos | Captura de tela | F2 |
| Diversos | Alternar perspectiva | F5 |
| Diversos | Câmera suave | F8 |
| Diversos | Tela cheia | F11 |
| Diversos | Ocultar HUD | F1 |
| Diversos | Tela de debug | F3 (e combinações F3+B/G/A/H/T/N/P — PRD 12 completa) |
| Mind Cave | Recarregar arma | R |
| Mind Cave | Mirar (ADS) | Botão direito (com arma) |
| Mind Cave | Modo de disparo | B |
| Mind Cave | Zoom | C |
| Mind Cave | Abrir Mind Cave Studio (dev) | F7 |
| Mind Cave | Roda de emotes (PRD 07) | P |
| Mind Cave | Console de desenvolvedor (PRD 12) | ` |
| Mind Cave | Push-to-talk | (reservado, sem padrão) |

**MC03-RF-060a (P0) — Lista completa e código de referência.** A lista completa de ações da 1.8.9 (incluindo as teclas de transmissão da época, que não serão usadas) e a equivalência com os códigos de tecla do navegador está no índice da pasta "mind-cave-codigo-referencia" (00-LEIA-ME). A tela e o sistema de atribuição devem ser portados de "06-teclas-e-controles/minecraft-web-client". Todas as ações da tabela precisam funcionar de fato, incluindo hotbar de 1 a 9.

**MC03-RF-061 (P0) — Tela de teclas.** Lista rolável agrupada por categoria; clicar numa ação e pressionar tecla/botão do mouse/roda atribui; Esc cancela; Backspace/Delete remove a atribuição. **Conflitos** mostrados em vermelho (exceto conflitos permitidos por contexto: "Mirar" e "Usar item" no botão direito). Botão "Redefinir" por ação e "Redefinir tudo". Suporte a **modificadores** (Ctrl/Shift/Alt + tecla) para ações extras. Usar `KeyboardEvent.code` (posição física) para funcionar em teclado ABNT2 sem quebrar WASD; mostrar o rótulo da tecla no layout do usuário.

**MC03-RF-062 (P0) — Modos de segurar/alternar.** Para Agachar, Correr e Mirar (ADS): "Segurar" (padrão 1.8.9) ou "Alternar". Para Correr: "Correr automático" opcional (sempre corre ao andar para frente se houver fome suficiente — PRD 05).

**MC03-RF-063 (P0) — Prevenção de atalhos do navegador.** Durante o jogo, impedir que Ctrl+W, Ctrl+S, Ctrl+D, F5 (recarregar), Espaço (rolar), etc. disparem ações do navegador quando possível; Como Ctrl+W (fechar aba) não pode ser bloqueado em todos os navegadores fora da tela cheia, o tooltip de "Correr" deve avisar o risco e sugerir outra tecla; em tela cheia, usar a Keyboard Lock API (quando suportada) para capturar essas teclas. Fechar a aba acidentalmente deve ser protegido por um diálogo de confirmação do navegador (`beforeunload`) enquanto houver mundo aberto.

### 6.3 Controle (gamepad) — P2

**MC03-RF-064 (P2)** Suporte via Gamepad API: analógico esquerdo move, direito olha (curva de resposta e zona morta configuráveis), gatilhos atacar/usar, bumpers trocam slot, layout atribuível, sensibilidade separada, vibração em dano/tiro (quando suportada).

---

## 7. Música e sons

| Opção | Padrão | Faixa |
|---|---|---|
| Volume mestre | 100% | 0–100% |
| Música | 100% | 0–100% |
| Discos (toca-discos) | 100% | 0–100% |
| Clima | 100% | 0–100% |
| Blocos | 100% | 0–100% |
| Criaturas hostis | 100% | 0–100% |
| Criaturas amigáveis | 100% | 0–100% |
| Jogadores | 100% | 0–100% |
| Ambiente/Cavernas | 100% | 0–100% |
| Armas (Mind Cave) | 100% | 0–100% |
| Interface | 100% | 0–100% |
| Dispositivo de saída | Padrão do sistema | Lista (quando o navegador permitir escolher a saída) |
| Áudio quando a janela perde o foco | Silenciar | Silenciar / Reduzir 50% / Manter |
| Legendas | Desligadas | Liga/Desliga (acessibilidade, seção 11) |

**MC03-RF-070 (P0)** Música de fundo: tocar faixas enviadas (PRD 10) em intervalos aleatórios de 10–20 min (comportamento 1.8: silêncio longo entre faixas), com listas separadas para menu, jogo (dia/noite), criativo, subaquático e dimensões (PRD 11). Sem arquivos, nenhuma música (não sintetizar música).

---

## 8. Personalização de skin

**MC03-RF-080 (P0) — Partes visíveis (1.8.9).** Liga/Desliga: Capa, Jaqueta, Manga esquerda, Manga direita, Calça esquerda, Calça direita, Chapéu. Mudanças sincronizadas em tempo real com o outro jogador.

**MC03-RF-081 (P0) — Escolha da skin.** Lista: skin padrão "Explorador" + 4 variações de cor + skins enviadas no Studio (PNG 64×64 / 64×32 legado, ou modelo GLB de personagem — PRD 10). Modelo de braço: **Clássico (4 px)** ou **Fino (3 px)**. Pré-visualização 3D girável do personagem (arrastar para girar, animação de andar/parado).

**MC03-RF-082 (P1) — Capa.** Escolher capa enviada (PNG) ou nenhuma. Física simples de capa (balança com o movimento).

---

## 9. Chat

| Opção | Padrão | Valores |
|---|---|---|
| Chat | Visível | Visível / Somente comandos / Oculto |
| Cores | Ligadas | Liga/Desliga (remove códigos §) |
| Links da web | Ligados | Liga/Desliga |
| Confirmar ao abrir links | Ligado | Liga/Desliga |
| Opacidade do texto | 100% | 10–100% |
| Opacidade do fundo | 50% | 0–100% |
| Escala | 100% | 0–100% |
| Largura | 320 px | 40–320 |
| Altura (focado) | 180 px | 20–180 |
| Altura (não focado) | 90 px | 20–180 |
| Tempo visível | 10 s | 2–60 s |
| Informações de debug reduzidas | Desligado | Liga/Desliga (esconde coordenadas no F3 — útil para jogar "sério") |
| Carimbo de hora | Desligado | Liga/Desliga (extensão) |

---

## 10. Multijogador e rede

**MC03-RF-090 (P0) — Rede.**

| Opção | Padrão | Descrição |
|---|---|---|
| Servidores STUN | Lista pública padrão | Editável (adicionar/remover URLs) |
| Servidores TURN | Vazio | URL, usuário, credencial — ou "Obter credenciais automaticamente" via Backend Function quando configurada |
| Forçar uso de TURN | Desligado | Para testar/contornar CGNAT |
| Testar conectividade | Botão | Mostra: tipo de NAT detectado (estimado), se STUN responde, se TURN autentica, latência até o TURN |
| Modo Relay Base44 (emergência) | Desligado | PRD 01 §3.2 — avisa que é baixa qualidade |
| Atraso de interpolação | Automático (100 ms) | 50–300 ms; automático ajusta pelo *jitter* |
| Mostrar ping na lista | Ligado | — |
| Mostrar indicador de rede | Desligado | Pequeno gráfico de ping/perda no canto |

**MC03-RF-091 (P0) — Opções do host (por mundo/sala).**

| Opção | Padrão | Descrição |
|---|---|---|
| Máximo de jogadores | 8 | 1–16 |
| Distância de visão máxima para convidados | 12 | Limita o raio que o servidor envia (protege o host) |
| Distância de simulação | 6 | Raio (chunks) em que o servidor faz ticks de entidades e blocos em volta de cada jogador |
| PvP | Ligado | Jogadores podem se ferir |
| Modo de jogo padrão para quem entra | Do mundo | Sobrevivência/Criativo/Aventura/Espectador |
| Permitir comandos para convidados | Desligado | Host sempre tem |
| Lista de permitidos | Todos os usuários do app | Opcional |

---

## 11. Acessibilidade

| Opção | Padrão | Efeito |
|---|---|---|
| Legendas de sons | Desligadas | Lista no canto inferior direito com o nome do som e uma seta da direção ("‹ Zumbi gemendo") |
| Reduzir flashes | Desligado | Suaviza o clarão de dano, relâmpagos (PRD 05), clarão de disparo (PRD 09) |
| Fundo do texto | Só no chat | Só chat / Todo texto |
| Opacidade do fundo do texto | 50% | 0–100% |
| Mira de alto contraste | Desligada | Mira com contorno |
| Filtro de daltonismo | Nenhum | Protanopia / Deuteranopia / Tritanopia (filtro de cor pós) |
| Tamanho mínimo de texto | — | Força escala de GUI ≥ N para texto |
| Tremor de tela / Efeitos de FOV | (ver vídeo) | — |
| Ocultar efeito de distorção (náusea/portal) | Desligado | Substitui por tom esverdeado (PRD 11) |

---

## 12. Desempenho avançado

| Opção | Padrão | Descrição |
|---|---|---|
| Workers de meshing | Auto (núcleos−2, 1–4) | 1–8 |
| Workers de geração (host) | Auto (1–2) | 1–4 |
| Orçamento de memória | Auto | Limita chunks em cache no cliente (descarrega os mais distantes primeiro) |
| Ritmo de carregamento | Equilibrado | Suave (menos chunks/quadro, sem engasgos) / Equilibrado / Rápido |
| Greedy meshing | Auto | Liga/Desliga (PRD 02 trade-off) |
| Pausar render quando a aba está oculta | Ligado | O servidor do host **continua** rodando (Worker); só o render para |
| Economia de energia | Desligado | Limita a 30 FPS e reduz distância em 2 quando na bateria (quando o navegador informar) |
| Gráfico de desempenho | Desligado | Gráfico de tempo de quadro (CPU/GPU) e TPS (como o "pie chart" do F3) |
| Limpar cache local | Botão | Apaga texturas geradas e chunks em cache (não apaga mundos na nuvem) |

---

## 13. Perfis de qualidade (atalho)

**MC03-RF-130 (P0) — Perfis.** Tela com 5 cartões + Personalizado. Selecionar um perfil ajusta **de uma vez** várias opções de Vídeo e Shaders:

| Perfil | Distância | Gráficos | Luz suave | Partículas | Mipmap | Escala res. | Shaders |
|---|---|---|---|---|---|---|---|
| **Mínimo** | 4 | Rápidos | Desligada | Mínimas | 0 | 75% | Clássico |
| **Baixo** | 6 | Rápidos | Mínima | Reduzidas | 2 | 100% | Clássico |
| **Médio** | 8 | Detalhados | Máxima | Todas | 4 | 100% | Clássico (ou Leve) |
| **Alto** | 12 | Detalhados | Máxima | Todas | 4 | 100% | Shaders Médio/Alto |
| **Ultra** | 16 | Detalhados | Máxima | Todas | 4 | 100–125% | Shaders Ultra |
| **Personalizado** | — | — | — | — | — | — | Valores atuais |

Mostrar FPS estimado (pela medição de benchmark do PRD 02) em cada cartão. Mudar uma opção avulsa marca "Personalizado".

---

## 14. Configurações do mundo (host)

**MC03-RF-140 (P0) — Regras do jogo (game rules 1.8.9).** Tela com interruptores e campos, também acessíveis por `/gamerule`:

| Regra | Padrão | Efeito |
|---|---|---|
| `doDaylightCycle` | true | Ciclo dia/noite avança |
| `doMobSpawning` | true | Mobs nascem naturalmente |
| `doMobLoot` | true | Mobs dropam itens |
| `doTileDrops` | true | Blocos quebrados dropam |
| `doEntityDrops` | true | Entidades não-mob (barcos, carrinhos, quadros) dropam |
| `doFireTick` | true | Fogo se espalha/apaga |
| `keepInventory` | false | Mantém inventário ao morrer |
| `mobGriefing` | true | Creepers destroem blocos, endermen pegam blocos, zumbis quebram portas |
| `naturalRegeneration` | true | Regeneração por fome |
| `randomTickSpeed` | 3 | Blocos por seção por tick |
| `showDeathMessages` | true | Mensagens de morte no chat |
| `sendCommandFeedback` | true | Retorno de comandos |
| `commandBlockOutput` | true | Saída de blocos de comando |
| `logAdminCommands` | true | Registrar comandos de operador |
| `reducedDebugInfo` | false | Força F3 reduzido para todos |

**MC03-RF-141 (P0) — Regras Mind Cave (extensões).**

| Regra | Padrão | Efeito |
|---|---|---|
| `gunsEnabled` | true | Habilita receitas e uso de armas de fogo (PRD 09) |
| `techZombies` | true | Habilita variantes de zumbi com tecnologia (PRD 09) |
| `techZombieChance` | 15% | Chance de um zumbi nascer como variante tecnológica (escala com dificuldade) |
| `friendlyFire` | true | Disparos/flechas acertam o outro jogador |
| `explosionsBreakBlocks` | true | Separado de `mobGriefing`, vale para TNT e armas explosivas |
| `devTools` | true | Libera F7 (Studio) e comandos de depuração |

---

## 15. Importar / exportar e sobre

**MC03-RF-150 (P1)** Exportar todas as configurações (usuário + dispositivo + predefinições de shader + teclas) para um arquivo JSON; importar com pré-visualização das diferenças e escolha do que aplicar.

**MC03-RF-151 (P0) — Sobre o build.** Versão do build, PRDs implementados (checklist), navegador/GPU detectados, recursos suportados (WebGL2, texture arrays, timer query, keyboard lock, raw input), licenças de bibliotecas e assets de terceiros usados (lista automática).

---

## 16. Requisitos não funcionais

- **MC03-RNF-001 (P0)** Abrir qualquer tela de opções em < 100 ms; nenhuma queda de FPS perceptível com a tela aberta no jogo.
- **MC03-RNF-002 (P0)** Validação de faixa e tipo em todo valor carregado (configuração corrompida ou de versão antiga nunca quebra o jogo — valores inválidos voltam ao padrão com log).
- **MC03-RNF-003 (P0)** Migração: o store tem `versão`; ao adicionar opções novas em PRDs futuros, valores antigos são preservados.
- **MC03-RNF-004 (P0)** Mudanças "por mundo" feitas pelo host são enviadas aos convidados imediatamente e salvas no mundo.

---

## 17. Critérios de aceite

- **MC03-CA-01** Cada opção listada neste PRD existe, tem tooltip e funciona (checklist manual).
- **MC03-CA-02** Alternar sombras desligadas ↔ Ultra muda o visual na hora, sem recarregar.
- **MC03-CA-03** Trocar a tecla de pular para "J" e o ataque para o botão lateral do mouse funciona e persiste após recarregar a página e em outro computador logado com o mesmo usuário.
- **MC03-CA-04** Configurações de vídeo do computador A não sobrescrevem as do computador B.
- **MC03-CA-05** Perfil "Mínimo" num notebook fraco mantém ≥ 60 FPS; "Ultra" no PC forte ativa tudo.
- **MC03-CA-06** Com `doDaylightCycle=false`, o sol para para ambos os jogadores.
- **MC03-CA-07** Sensibilidade 100% reproduz a curva do 1.8 (girar 360° exige o mesmo deslocamento físico de mouse em qualquer FPS — rotação independente do framerate).
- **MC03-CA-08** Importar um JSON de configurações de outra pessoa mostra o diff e aplica só o escolhido.
