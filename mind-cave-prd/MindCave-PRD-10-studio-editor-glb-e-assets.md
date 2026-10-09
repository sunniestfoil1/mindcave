# MIND CAVE — PRD 10 de 12
# Mind Cave Studio: Editor e Visualizador de GLB, Pipeline de Assets, Criador de Itens (Picareta, Espada, Armas) e Pacotes

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–09 (porta de assets do PRD 01, modelos/texturas/sons do PRD 02, itens/receitas do PRD 06, animações do PRD 07, mobs do PRD 08, armas do PRD 09) |
| Objetivo | Criar o **Mind Cave Studio**, a área de trabalho de desenvolvimento dentro do próprio jogo, onde os dois devs **enviam, visualizam, inspecionam, ajustam e vinculam** modelos GLB, texturas PNG e sons a blocos, itens, mobs, armas e à skin do jogador — e onde podem **criar itens novos** (picaretas, espadas, armas, comidas, blocos) com estatísticas, ícone, modelo, animações e receita, que passam a existir no jogo **em tempo real** para os dois jogadores. |
| Próximo | PRD 11 — Sistemas Avançados (Redstone, Agricultura, Encantamento, Poções, Nether, End) |

> Documento de requisitos. Este PRD substitui progressivamente os visuais procedurais pelos **assets reais que o dono vai enviar**. Nada da lógica de jogo depende de um asset existir: sem asset, o procedural continua (fallback obrigatório).

---

## 1. Acesso e estrutura do Studio

**MC10-RF-001 (P0) — Entradas.** Botão **Mind Cave Studio** no menu principal (habilitado agora), tecla **F7** dentro do mundo (com regra `devTools` ligada; abre o Studio por cima do jogo, o mundo continua rodando para o outro jogador) e botão "Abrir no Studio" ao interagir com a Vitrine de assets do Laboratório (PRD 04).

**MC10-RF-002 (P0) — Áreas do Studio.**

| Área | Função |
|---|---|
| **Biblioteca** | Todos os assets enviados (GLB, PNG, áudio), com busca, filtros por tipo/tag/licença/autor, miniaturas geradas, versões |
| **Visualizador** | Cena 3D de inspeção e edição do asset selecionado |
| **Animações** | Linha do tempo, clipes, recortes, eventos, mapeamento para estados do jogo |
| **Vínculos** | Ligar assets a alvos do jogo (bloco/item/mob/jogador/projétil/partícula/som/música/UI) |
| **Criador de itens** | Assistente para criar itens novos com estatísticas, receita e visual |
| **Criador de blocos** (P1) | Assistente para criar blocos novos |
| **Editor de texturas** (P1) | Pixel art 16×–128× com pré-visualização 3D |
| **Sons** | Envio, pré-escuta e vínculo a eventos sonoros |
| **Pacotes** | Agrupar vínculos em pacotes ativáveis, ordenar, exportar/importar |
| **Validação** | Relatório de problemas de todos os assets e vínculos |

Layout de ferramenta de desenvolvimento (não precisa ser pixel art): painel esquerdo (navegação/biblioteca), centro (viewport 3D), direito (propriedades), inferior (linha do tempo/console). Tema escuro. Atalhos: Ctrl+Z/Ctrl+Y (desfazer/refazer em todas as edições), Ctrl+S (salvar), F (enquadrar), G/R/S (mover/girar/escalar com gizmo), Espaço (play/pause de animação).

**MC10-RF-003 (P0) — Botão flutuante do Visualizador rápido.** Durante o jogo (e nos menus), com `devTools` ligado, um **botãozinho discreto no canto superior direito** (ícone de cubo; atalho Shift+F7) abre um painel compacto por cima do jogo, sem sair do mundo. O painel mostra o que está em foco — o item na mão, o bloco mirado ou a entidade mirada — e oferece:
- **Visualização 3D** do modelo (girar, aproximar), com troca rápida entre o GLB vinculado e o procedural.
- **Hitboxes:** liga/desliga caixas de colisão e seleção do objeto, do jogador e dos mobs próximos, alcance de ataque, região da cabeça e das costas, e pontos de encaixe.
- **Visão do jogador:** prévia exatamente como o jogador vê — 1ª pessoa com a mão segurando o item, 3ª pessoa por trás e pela frente, ícone no inventário e item no chão — com gizmo para mover/girar/escalar o item **e ver o resultado ao vivo no jogo** (a mão real do jogador atualiza na hora).
- **Copiar JSON:** copia para a área de transferência um JSON com tudo o que define o objeto em foco (id do alvo, asset vinculado, transformações por contexto, pivô e escala, pontos de encaixe, caixas e regiões, mapeamento de animações, recortes e eventos, materiais e parâmetros da câmera da prévia), pronto para colar numa conversa com a IA. **Colar JSON** aplica de volta um JSON nesse formato (com prévia das diferenças antes de confirmar).
- **Abrir no Studio completo** no mesmo item.

---

## 2. Envio e armazenamento de assets

**MC10-RF-010 (P0) — Formatos.**

| Tipo | Formatos | Observações |
|---|---|---|
| Modelo 3D | **.glb** (preferido), .gltf com recursos embutidos | Suporte a compressão Draco e Meshopt (decoders carregados sob demanda); KTX2 opcional |
| Textura | .png (preferido), .webp | Pixel art: filtro nearest por padrão |
| Áudio | .ogg (preferido), .mp3, .wav | Normalização de volume opcional |
| Skin | .png 64×64 (ou 64×32 legado) | Layout padrão de skin humanoide |
| Pacote | .zip com `manifesto.json` + arquivos | Exportado pelo próprio Studio |
| P2 | .vox (MagicaVoxel), .bbmodel | Conversão para GLB no navegador |

Ferramenta de modelagem recomendada aos devs: um editor low-poly/voxel que exporte **glTF/GLB com animações** (ex.: Blockbench). O Studio deve aceitar GLBs exportados dessas ferramentas sem ajuste manual sempre que possível (detectar escala "1 bloco = 16 unidades" e oferecer correção — RF-022).

**MC10-RF-011 (P0) — Upload.** Arrastar e soltar (vários arquivos), barra de progresso, envio ao armazenamento de arquivos do Base44, cálculo de **hash** do conteúdo para deduplicar, extração de metadados no navegador (para GLB: malhas, triângulos, vértices, materiais, texturas e tamanhos, ossos, clipes e durações, nós/empties, extensões usadas, caixa delimitadora). Registro na entity **Asset**:

| Campo | Descrição |
|---|---|
| nome, tipo, tags | Organização |
| url, hash, tamanho | Arquivo |
| metadados | JSON extraído |
| licença, origem | Ex.: "CC0 — Kenney", "Autoral", "CC-BY — autor X (link)". Obrigatório informar; atribuições CC-BY aparecem automaticamente em Opções → Sobre |
| versão, versões anteriores | Histórico; reverter para versão anterior |
| enviadoPor, atualizadoEm | Auditoria |
| bloqueadoPor | Trava leve de edição (evita os dois editarem o mesmo asset ao mesmo tempo; mostra "Fulano está editando") |

**MC10-RF-012 (P0) — Cache e sincronização.** Assets baixados ficam em cache local (IndexedDB) por hash. Quando um dev salva um vínculo, um evento é propagado (subscribe do Base44 + mensagem na sala multiplayer, se houver) e o outro jogador **baixa e aplica** sem recarregar. Ao entrar numa sala, o convidado recebe a lista de pacotes/vínculos ativos do host e baixa o que faltar ("Baixando assets do host… 12/30") — em paralelo, com fallback procedural até concluir.

---

## 3. Visualizador

**MC10-RF-020 (P0) — Cena de inspeção.** Controles de órbita (girar/pan/zoom), perspectiva/ortográfica, vistas rápidas (frente, lado, topo, isométrica do ícone), **grade do chão em blocos** (1 célula = 1 bloco, subdivisão em 16 "pixels"), **silhuetas de referência** opcionais lado a lado (jogador 0,6×1,8, bloco 1×1×1, zumbi, creeper) para conferir escala, eixos.

**MC10-RF-021 (P0) — Modos de visualização.** Sombreado, sem iluminação (albedo), wireframe, normais, **esqueleto** (ossos e nomes), checker de UV, mapa de pesos por osso (P1), caixa delimitadora, pontos de encaixe, caixas de colisão, transparência. Predefinições de luz: **Estúdio**, **Dia no jogo**, **Noite**, **Caverna com tocha**, **Modo Shaders (predefinição atual)** — esta última usa o renderer real do jogo, para ver o asset exatamente como vai aparecer.

**MC10-RF-022 (P0) — Normalização automática.** Ao importar: detectar eixo para cima, unidade (se a caixa sugerir escala 16× ou 100×, sugerir correção com um clique), apoiar a base no chão, aplicar transformações pendentes, converter materiais para o pipeline do jogo (iluminado pelo lightmap céu/bloco + modo Shaders), forçar filtro nearest em texturas ≤ 128 px (configurável). Nada é destrutivo: correções viram parâmetros do vínculo, o arquivo original fica intacto.

**MC10-RF-023 (P0) — Estatísticas e orçamento.** Painel com triângulos, vértices, draw calls, materiais, texturas (resolução e memória estimada na GPU), ossos, clipes. **Orçamentos** por tipo de alvo (avisos amarelos/vermelhos, nunca bloqueios):

| Alvo | Triângulos recomendados | Textura máx. recomendada | Ossos |
|---|---|---|---|
| Item na mão / arma | ≤ 3.000 | 512 px | ≤ 32 |
| Mob comum | ≤ 8.000 | 1024 px | ≤ 64 |
| Jogador (GLB) | ≤ 12.000 | 1024 px | ≤ 64 |
| Bloco especial (instanciado) | ≤ 1.000 | 256 px | 0 (animação por nó, P1) |
| Estrutura/decoração grande | ≤ 20.000 | 2048 px | — |
| Arquivo GLB | aviso acima de 10 MB | — | — |

**MC10-RF-024 (P0) — Validação.** Lista de problemas com botão "corrigir" quando possível: escala fora do esperado, nós sem nome, ossos duplicados, texturas não potência de 2 (aviso de mipmap), filtro linear em pixel art, normais invertidas, transparência desnecessária, animação com deslocamento da raiz em mob/jogador (oferecer "remover deslocamento da raiz"), clipe sem quadros, ossos esperados ausentes para o alvo escolhido (RF-041), pontos de encaixe faltando em armas.

---

## 4. Edição de transformações e materiais

**MC10-RF-030 (P0) — Transformações por contexto.** Para itens e armas: editar posição/rotação/escala por contexto (`primeira_pessoa_direita`, `terceira_pessoa_direita`, `gui`, `chão`, `moldura`, `cabeça` — PRD 07 RF-052) com **quatro pré-visualizações ao vivo** lado a lado: (a) 1ª pessoa com a mão do jogador, mira e HUD simulado; (b) jogador em 3ª pessoa segurando o item; (c) ícone no slot 18×18 em escala de GUI 2; (d) item no chão girando. Gizmos com snap (1 px = 1/16 de bloco; 15°), campos numéricos, botão "copiar de outro item" (ex.: copiar as transformações da picareta de ferro procedural).

**MC10-RF-031 (P0) — Pivô e escala global.** Ajustar pivô, escala global e deslocamento base sem alterar o arquivo.

**MC10-RF-032 (P0) — Materiais.** Por material: filtro (nearest/linear), modo alfa (opaco/recorte com limiar/translúcido), dupla face, emissivo (cor/intensidade — entra no bloom do modo Shaders e pode **emitir luz dinâmica**), aceitar **tinta** do jogo (couro tingido, grama por bioma), brilho de encantamento permitido, substituir textura por outra PNG da biblioteca, mapas PBR (normal/especular) para o modo Shaders.

**MC10-RF-033 (P0) — Pontos de encaixe (sockets).** Criar/editar pontos nomeados presos a um osso/nó:
- Armas: `boca_do_cano`, `ejecao`, `carregador`, `trilho_superior`, `trilho_inferior`, `mao_esquerda`, `mao_direita` (PRD 09 RF-041).
- Jogador: `mao_direita`, `mao_esquerda`, `cabeca`, `costas` (capa), `peito`.
- Mobs: `mao_direita` (zumbis com armas — PRD 09), `cabeca` (capacete/lanterna), `montaria` (jóquei).
Gizmo de visualização e teste "anexar item de teste".

**MC10-RF-034 (P0) — Caixas de colisão e regiões.** Para blocos e mobs **customizados**, editar AABBs de colisão/seleção (em pixels de 1/16) e **regiões de dano** (cabeça, corpo, costas) usadas por tiro na cabeça e pelo ponto fraco do Zumbi Blindado (PRD 09). Para blocos/mobs vanilla, as caixas lógicas **continuam as do registro** (paridade 1.8.9): o Studio as mostra como referência para ajustar o modelo a elas, mas não as altera.

---

## 5. Animações

**MC10-RF-040 (P0) — Linha do tempo.** Lista de clipes do GLB com duração e quadros; play/pausa/loop/velocidade (0,1×–3×); arrastar o cursor (scrub); quadro a quadro; pré-visualizar **mistura** entre dois clipes com duração ajustável; ver o modelo no contexto (1ª pessoa, 3ª pessoa, numa esteira na velocidade real do jogo para clipes de locomoção).

**MC10-RF-041 (P0) — Mapeamento para estados do jogo.** Para cada tipo de alvo, o Studio lista os **estados esperados** (PRD 07 RF-041, PRD 08 RF-041, PRD 09 RF-040) e permite associar um clipe a cada um, com status: ✔ mapeado / ⚠ usando procedural / ✖ obrigatório faltando.

| Alvo | Estados |
|---|---|
| Jogador | parado, andar, correr, agachar, agachar_andar, cair, balançar, minerar, usar, bloquear, arco_puxar, comer, arremessar, dormir, montado, morrer, segurar_arma_1mao, segurar_arma_2maos, mirar, atirar, recarregar |
| Braços em 1ª pessoa (opcional) | ocioso, equipar, balançar, minerar, comer, bloquear, arco_puxar |
| Item corpo a corpo (picareta, espada, machado…) | balançar (opcional; senão o balanço padrão 1.8), equipar, ocioso, inspecionar |
| Arma de fogo | equipar, ocioso, correr, mirar, atirar, recarregar, recarregar_vazio, ferrolho/pump, coronhada, inspecionar |
| Mob | parado, andar, correr, atacar, dano (aditivo), morrer + específicos (inchar, carregar_bloco, escalar, comer_grama, sentar, arremessar, atirar, cavar, plantar_carga, rádio) |
| Bloco especial | abrir, fechar, ativo (loop) — ex.: baú, porta, fornalha acesa |

**MC10-RF-042 (P0) — Recortar clipes.** Muitos GLBs vêm com **uma única animação longa**. Permitir criar **subclipes** marcando início/fim, nomear e marcar como loop. Os recortes são parâmetros (não alteram o arquivo).

**MC10-RF-043 (P0) — Eventos de animação.** Marcadores nomeados na linha do tempo (ex.: `passo`, `soltar_carregador`, `inserir_carregador`, `ejetar_capsula`, `som_ferrolho`, `impacto`) que disparam **efeitos visuais e sons** no momento certo. Regra do PRD 07: eventos **nunca** decidem lógica de jogo (dano e recarga são decididos pelo servidor pelos tempos do registro). Para armas, o Studio mostra o tempo de recarga do registro e oferece "ajustar duração do clipe ao tempo de recarga".

**MC10-RF-044 (P1) — Ajustes de reprodução.** Velocidade por clipe, remover deslocamento da raiz, espelhar (mão esquerda), camada (corpo inteiro / só parte superior com máscara de ossos), sincronizar locomoção com a velocidade (distância por ciclo de passo).

---

## 6. Vínculos (ligar assets ao jogo)

**MC10-RF-050 (P0) — Entity AssetBinding.** Campos: tipo do alvo, id do alvo, variante/meta, asset, parâmetros (transformações por contexto, mapeamento de clipes, recortes, eventos, sockets, materiais, normalização, regiões), pacote, ativo e prioridade. O gerenciador de assets do PRD 01 passa a consultar os vínculos dos **pacotes ativos**, respeitando prioridade; se o asset falhar ao carregar, usa o procedural e registra aviso no console do Studio.

**MC10-RF-051 (P0) — Alvos suportados e regras.**

| Alvo | O que pode ser vinculado | Regras |
|---|---|---|
| **Bloco de cubo comum** (terra, pedra, madeira…) | **Texturas PNG** por face (e quadros de animação) | Cubos continuam sendo desenhados pelo mesher voxel (desempenho); **não** usar GLB para cubos comuns |
| **Bloco especial** (baú, fornalha, bancada, bancada de armeiro, bigorna, porta, placa…) | GLB (instância por posição, com LOD) ou modelo de elementos | A colisão continua a do registro |
| **Item** | GLB (na mão/no chão/moldura) + ícone (gerado do GLB ou PNG) | Transformações por contexto (com padrões) |
| **Arma** (PRD 09) | GLB com sockets e clipes | Sockets obrigatórios validados |
| **Mob** | GLB com mapeamento de ossos + clipes | RF-052 |
| **Jogador** | PNG de skin (modelo de cubos) **ou** GLB humanoide | RF-053 |
| **Armadura** | GLB/PNG por material e peça | Encaixe nos ossos do jogador |
| **Projétil / partícula** | GLB pequeno ou sprite PNG | Flecha, bala, granada, rastro, cápsula |
| **Som / música** | Arquivo(s) de áudio por evento | RF-070 |
| **UI** (P1) | PNG de ícones, HUD, widgets | Substitui as texturas procedurais de UI |

**MC10-RF-052 (P0) — Mobs em GLB.** Mapeamento de ossos do GLB para as partes lógicas do mob (cabeça, corpo, perna_fd, perna_fe, perna_td, perna_te, braço_d, braço_e, asas, cauda…) com **auto-mapeamento por nome** (heurística: "head", "cabeca", "Head", "leg_front_right"…) e ajuste manual; estados sem clipe recebem a animação procedural do PRD 08 aplicada aos ossos mapeados. Botão "ajustar à caixa oficial do mob". Variantes (cores de ovelha, tipos de coelho, variantes de zumbi tecnológico) podem ter assets próprios ou só troca de textura.

**MC10-RF-053 (P0) — Jogador em GLB.** Rig humanoide com mapeamento de ossos (cabeça, tronco, braço_d, braço_e, perna_d, perna_e; opcionais: mãos, dedos). Requisitos: altura ≈ 1,8 (ajustável), olhos a 1,62 (ajuste do ponto de câmera), escolha de quais malhas/ossos aparecem como **mão em 1ª pessoa**, sockets de mão/cabeça/costas, camadas de armadura. Cada jogador escolhe seu GLB/skin em Opções → Personalização de skin (PRD 03); a escolha é replicada ao outro jogador. A skin genérica "Explorador" continua como padrão até um GLB ser vinculado.

---

## 7. Criador de itens ("criar uma picareta, uma espada e tudo mais")

**MC10-RF-060 (P0) — Assistente passo a passo.**

1. **Tipo base:** Picareta, Machado, Pá, Enxada, Espada, Arma de fogo (pistola/escopeta/rifle/carabina como base), Arremessável, Comida, Material, Ferramenta utilitária, Armadura (peça), Bloco (abre o Criador de blocos).
2. **Identidade:** nome PT-BR e EN, id interno (`mindcave:picareta_de_obsidiana`), descrição/lore, raridade (cor do nome), aba criativa, pilha máxima.
3. **Estatísticas** (campos conforme o tipo, com valores sugeridos a partir de um "nível de material" existente para não quebrar o balanço):
   - Ferramentas: velocidade de mineração, nível de colheita (0–3, ou 4 novo), durabilidade, dano corpo a corpo, encantabilidade, material de reparo.
   - Espada: dano, durabilidade, pode bloquear, velocidade em teia.
   - Arma de fogo: todos os campos do PRD 09 (dano, cadência, carregador, recarga, alcance, dispersão, recuo, penetração, munição, modos de disparo, acessórios compatíveis).
   - Comida: fome, saturação, tempo para comer, efeitos com chance.
   - Armadura: slot, pontos, durabilidade, tingível.
4. **Visual:** escolher GLB da biblioteca (ou enviar), ajustar transformações (seção 4), **ícone** renderizado do GLB (ângulo ajustável, 32/64 px, fundo transparente) ou PNG enviado; brilho permanente (sim/não).
5. **Animações e sons:** balanço padrão 1.8 ou clipes do GLB; sons de uso/acerto/quebra/disparo/recarga.
6. **Receita:** **editor visual** — grade 3×3 (ou 2×2) onde se arrastam itens do catálogo, com/sem formato, estação (bancada de trabalho, bancada de armeiro, fornalha com XP e tempo), quantidade produzida; aviso de conflito com receita existente.
7. **Testar:** "Testar no mundo" coloca o item no inventário do dev (criativo) ou leva ao estande certo do Laboratório; **"Publicar"** registra para todos.

**MC10-RF-061 (P0) — Registro dinâmico e sincronizado.** Itens criados são salvos na entity **CustomItem** (definição completa em dados) e registrados **em tempo de execução** nos registros de itens e receitas do servidor e dos clientes, com ids numéricos de faixa reservada (ex.: 4096+) e ids textuais com prefixo `mindcave:`. Ao conectar, o host envia o **hash do registro**; se divergir, envia as definições faltantes antes do login terminar. Remover um item customizado com cópias existentes no mundo: elas viram "Item desconhecido (id)" preservando os dados e voltam a funcionar se a definição for restaurada — nada é apagado silenciosamente.

**MC10-RF-062 (P1) — Criador de blocos.** Mesmo fluxo para blocos: texturas por face ou GLB especial, forma (cubo/laje/escada/cruz/modelo), dureza, resistência a explosão, ferramenta e nível, drops (tabela com chances), emissão de luz, transparência, inflamabilidade, sons, receita.

**MC10-RF-063 (P0) — Itens vanilla.** O Studio **não** altera estatísticas de itens vanilla (paridade 1.8.9); só troca visual/sons. Para variar estatísticas, cria-se um item novo.

---

## 8. Editor de texturas (P1)

**MC10-RF-065 (P1)** Editor pixel art de 16×16 a 128×128: lápis, borracha, balde, conta-gotas, linha, retângulo, espelho X/Y, seleção e mover, paleta (inclusive extraída das texturas procedurais), camadas simples, quadros de animação com tempo por quadro, **pré-visualização 3D ao vivo** num cubo/item/modelo, comparação com a versão procedural. Exporta PNG para a biblioteca.

---

## 9. Sons e música

**MC10-RF-070 (P0) — Vínculo de sons.** Lista de **todos os eventos sonoros** do registro (blocos por categoria, passos, mobs por tipo e ação, jogador, combate, armas por etapa, UI, ambiente, clima, música por contexto) com: arquivos vinculados (vários = variações sorteadas), volume, faixa de pitch, distância de atenuação, categoria de volume (PRD 03). Pré-escuta, inclusive **posicional** (o som orbitando a câmera). Eventos sem arquivo usam o sintetizado (PRD 02).

**MC10-RF-071 (P0) — Música.** Listas por contexto (menu, dia, noite, criativo, subaquático, Nether, End, créditos) e para os discos de música (12 slots + discos customizados criados no Criador de itens).

---

## 9b. Importação de pacote de recursos 1.8.9 e de emotes

**MC10-RF-075 (P0) — Importar pacote de recursos.** Os devs podem importar os assets da **própria instalação do Minecraft 1.8.9** (arquivo .jar da versão, que é um zip) ou de qualquer pacote de recursos no formato 1.8 (pasta ou .zip com pack.mcmeta). O importador lê e vincula automaticamente, pelos nomes internos do registro (os mesmos das tabelas de "04-dados-1.8.9"):
- Texturas de blocos e itens (incluindo quadros de animação definidos em .mcmeta), texturas de entidades (mobs, skin padrão, armaduras), partículas, ambiente (sol, lua, nuvens, chuva, neve), destruição de bloco.
- Interface: widgets da hotbar e botões, ícones do HUD (corações, fome, armadura, ar, XP), telas de inventário, fundo de menus, fonte bitmap.
- Modelos de bloco e item no formato JSON da 1.8 (convertidos para o formato de modelo do PRD 02).
- Sons (eventos e arquivos .ogg) e traduções PT-BR/EN.
O resultado vira um **pacote** na lista de pacotes (seção 10), com prioridade sobre o procedural, ativável e desativável a qualquer momento. Os arquivos ficam no armazenamento privado do app (projeto privado, só os dois devs). Relatório final: quantos itens foram vinculados, quais ficaram sem correspondência.

**MC10-RF-076 (P0) — Importar emotes.** Área "Emotes" no Studio: importar arquivos de emote no formato Emotecraft (com ícone e áudio opcionais) ou marcar clipes de um GLB como emote; pré-visualizar no personagem; montar a roda de 9 emotes de cada jogador (PRD 07 seção 6b). Os emotes de "08-emotes" já vêm importados.

## 10. Pacotes de assets

**MC10-RF-080 (P0) — Pacotes.** Vínculos pertencem a um **pacote** (nome, descrição, autor, versão, ícone). Tela "Pacotes de assets" (Opções e Studio): pacotes disponíveis/ativos, **ordem de prioridade** (arrastar; o de cima vence), ativar/desativar ao vivo. Pacote "Procedural Mind Cave" sempre no fundo.

**MC10-RF-081 (P0) — Exportar/importar.** Exportar pacote para `.zip` (manifesto JSON com vínculos e definições + arquivos + licenças); importar com relatório (o que será adicionado/substituído, conflitos de ids).

**MC10-RF-082 (P0) — Pacotes do mundo.** Cada mundo pode fixar uma lista de pacotes obrigatórios; o host aplica aos convidados ao entrarem.

---

## 11. Requisitos não funcionais

- **MC10-RNF-001 (P0)** Carregar e mostrar um GLB de 5 MB no visualizador em < 2 s após o download.
- **MC10-RNF-002 (P0)** Mobs/itens em GLB usam *skinning* em GPU, instancing quando há vários iguais e **LOD** (P1: versão simplificada gerada ou fornecida; fallback para o modelo de cubos a grande distância).
- **MC10-RNF-003 (P0)** Aplicar um vínculo novo ao vivo não trava o jogo por mais de 100 ms (decodificação em worker quando possível).
- **MC10-RNF-004 (P0)** Memória de GPU liberada ao trocar/remover assets (dispose de geometrias, texturas e materiais).
- **MC10-RNF-005 (P0)** O Studio funciona sem mundo aberto e também por cima do mundo sem derrubar o TPS do host.

---

## 12. Critérios de aceite

- **MC10-CA-01** Enviar o GLB de uma espada → ajustar transformações nas 4 pré-visualizações → vincular à Espada de Diamante → aparecer na mão (1ª e 3ª pessoa), no chão e no inventário, **para os dois jogadores**, sem recarregar a página.
- **MC10-CA-02** Enviar o GLB de personagem com uma única animação longa → recortar "parado", "andar", "correr", "balançar" → mapear → jogar e ver as animações certas; estados sem clipe usam o procedural.
- **MC10-CA-03** Enviar o GLB de zumbi com nomes de ossos diferentes → auto-mapear + corrigir → ajustar à caixa → zumbis no mundo usam o modelo, andam, atacam e morrem com os clipes.
- **MC10-CA-04** Criar "Picareta de Obsidiana" (nível 4, durabilidade 3000, velocidade 9) com receita 3 obsidianas + 2 gravetos → aparece na aba Studio → craftável pelos dois jogadores → minera no tempo dado pela fórmula do PRD 06.
- **MC10-CA-05** Criar uma arma nova baseada em "Rifle" com GLB próprio, sockets e clipes, receita na Bancada de Armeiro → atira, recarrega e mostra efeitos nos sockets corretos (clarão na boca do cano, cápsula na ejeção).
- **MC10-CA-06** Vincular sons de passo em pedra e de disparo de pistola; ouvir posicionalmente; legendas mostram o evento.
- **MC10-CA-07** Exportar o pacote, apagar os vínculos, importar o zip → tudo volta igual.
- **MC10-CA-08** Asset corrompido ou URL indisponível → o jogo segue com o procedural e o Studio aponta o erro na Validação.
