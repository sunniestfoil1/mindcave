# Blocos do jogo

O registro cobre os **198 blocos do Minecraft 1.8.9** (`node scripts/compare-real.mjs` confere contra os dados reais em `data/mc-1.8.9/`)
mais dois blocos próprios do Mind Cave (175 Tijolos de Pedra Musgosos e 177 Bancada de Armeiro).

## Onde mexer

| Quero… | Arquivo |
|---|---|
| mudar dureza, ferramenta ou nível de colheita de um bloco | `src/game/blockCatalog.js` é **gerado** (`node scripts/gen-block-catalog.mjs`); o que o jogo usa de verdade vive em `mining.js` (`HARVEST`, `DROP_TABLE`) |
| trocar a textura, os nomes ou as variações (cores, madeiras, pedras) de um bloco | `src/game/blocksMore.js` (blocos novos e variações) ou `src/game/blocks.js` (os que já existiam) |
| carregar uma textura nova do pacote | `src/game/tilesMore.js` (nome do arquivo em `textures/blocks/`); as que vêm de arquivo de entidade (baús, cabeça) são montadas em `textures.js` (`composeChest`) |
| mudar a forma de um bloco (caixas, ligações com vizinhos) | `src/game/blocksMore.js` (modelo `multi`: função que devolve as caixas) e `src/game/shapes.js` (trilho, cerca, portão, escada…) |
| mudar como o bloco é desenhado (tocha inclinada, repetidor, vidro translúcido) | `src/game/mesher.js` |
| mudar onde um bloco pode ser colocado (parede, chão, teto) | `placeSpecial` em `src/game/shapes.js` |
| mudar o que cai quando o bloco que segura é quebrado | `supportOffset` em `src/game/fallingBlocks.js` |
| mudar o clique direito (alavanca, botão, bolo, portas, baús) | `interactBlock` em `src/game/engine.js` |
| mudar o item que vira bloco (placa, caldeirão, porta de pinheiro…) | `ITEM_TO_BLOCK` e `DOOR_ITEMS` no topo da seção de formas em `src/game/engine.js` |
| mudar o que aparece no inventário do criativo | `CreativeUI.jsx` lista todo bloco com `variantNames`; esconder = `hiddenInCreative: true` |
| mudar receitas | `scripts/gen-recipes.mjs` (importa as reais do 1.8.9) e depois `node scripts/gen-recipes.mjs` |

## Como cada bloco é testado

`npm run test:e2e` roda dois testes de bloco, os dois com o motor real no Chrome:

- `scripts/e2e/blocks.mjs` — para **cada bloco e cada variação** (hoje 387 estados): põe o item na mão, mira o chão (ou a parede, para o que
  prende na parede) e coloca pelo mesmo caminho do clique (`engine.placeBlock`), confere o que ficou no mundo, tira a folha de contato
  (`scripts/e2e/out/blocos-N.png`, 3 linhas por foto; com `--perto` a câmera fica quase de cima) e quebra pelo clique de quebrar
  (`engine.breakBlock`) conferindo que sumiu e que o drop é um item que existe. Falha se algum estado não coloca ou não quebra.
- `scripts/e2e/blocks-cenas.mjs` — o que a folha não mostra: trilhos que se ligam (reta, curva, subida), vidraça/grade/muro/cerca ligando nos
  vizinhos, tochas e alavancas nos quatro lados, estados (bolo, caldeirão, bigorna, repetidor), e o jogador usando: alavanca liga e desliga,
  botão solta sozinho, bolo some em 7 fatias, porta de pinheiro abre e fecha, baú do Ender é um só, criativo quebra bedrock, quebrar a parede
  derruba o que estava preso, colheita por ferramenta (pedra à mão não larga nada, bloco de lápis só com picareta de pedra…).

## O que ainda não funciona como no 1.8.9

- **Sem tela**: mesa de encantamento, bigorna, suporte de poções, ejetor, largador, funil, sinalizador e jukebox (disco). O clique avisa no chat
  e não coloca bloco ao lado.
- **Pistões** só existem como bloco; não empurram nem puxam. **Trilhos** são só o bloco (não há vagonete).
- **Placa**: não há texto. **Cabeça**: só a de esqueleto (o tipo no 1.8.9 fica na entidade do bloco, que o jogo não tem).
- **Vaso de flor** não recebe planta; **bolo** não tem velas (não existem no 1.8.9).
- **Placa de pressão** só liga a energia pelo bloco (nada pisa nela ainda); as de peso (ouro e ferro) são só decoração.
- **Bloco de notas** troca o tom a cada clique, mas só toca a harpa (o instrumento pelo bloco de baixo não existe).
- **Bloco infestado** não solta peixe-de-prata (não solta nada).
- **Árvores novas** (bétula, pinheiro, selva, acácia, carvalho escuro): ver `src/game/trees.js`; ainda sem teste visual próprio.
