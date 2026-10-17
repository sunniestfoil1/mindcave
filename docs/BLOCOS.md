# Blocos do jogo

O registro cobre os **198 blocos do Minecraft 1.8.9** (`node scripts/compare-real.mjs` confere contra os dados reais em `data/mc-1.8.9/`)
mais a Bancada de Armeiro (177) e os 6 blocos do Aether (210–215).

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
| mexer no Aether (blocos, ilhas, nuvens, portal) | blocos em `src/game/blocksAether.js` (ids 210–215), gerador em `src/game/aetherGen.js`, texturas montadas em `textures.js` (`composeAether`), moldura/portal em `src/game/portal.js` (`KINDS`) |
| mudar a moldura ou a ativação de um portal | `src/game/portal.js`: `KINDS.nether` (obsidiana + pederneira) e `KINDS.aether` (glowstone + balde de água, em `useHeldItem` no `engine.js`) |
| fazer um bloco brilhar no máximo (glowstone, lanterna do mar) | `glow: true` no fim de `src/game/blocks.js`; o mesher ignora luz e sombra nas faces dele |
| trocar cores ou mobs dos ovos de spawn | `src/game/spawnEggData.js` (a meta do item 383 é o id da entidade do 1.8.9) |
| trocar os fogos de artifício (cores, formato, voo) | `src/game/fireworkData.js` (presets) e `src/game/fireworks.js` (foguete e explosões) |
| mudar quando os mobs somem sozinhos | `_shouldNaturallyDespawn` em `src/game/mobManager.js` (hostil longe some; animal, ovo e `/summon` ficam) |
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

- **Sem tela**: mesa de encantamento, bigorna, suporte de poções, ejetor, largador, funil e sinalizador. O clique avisa no chat e não coloca
  bloco ao lado. (Jukebox, placa com texto, cabeças, vaso de flor e placas de pressão já funcionam.)
- **Pistões** só existem como bloco; não empurram nem puxam. **Trilhos** são só o bloco (não há vagonete).
- **Bloco de notas** troca o tom a cada clique, mas só toca a harpa (o instrumento pelo bloco de baixo não existe).
- **Bloco infestado** não solta peixe-de-prata (não solta nada). **Estandartes** (ids 176/177 do 1.8.9) não existem.
- **Mobs no online**: o host simula (IA, vida, dano, drops) e manda os mobs a até 96 blocos de cada convidado 10×/s (`src/game/net/mobSync.js`);
  o convidado vê cópias suaves e manda golpes, tesoura e ovos ao host. Limite: mobs só existem onde o **host** tem chunks carregados, então um
  convidado muito longe do host não vê mobs; cada um fica no seu mundo (Nether/Aether não são sincronizados entre jogadores).
- **Aether**: só ilhas, nuvens, árvores claras e animais comuns. Não tem os mobs, a masmorra, o ouro-do-Aether nem a luz própria do mod; as
  árvores usam tronco e folha de bétula. Não é salvo no arquivo do mundo (como o Nether, vale só durante a sessão).
- **Discos 5, otherside e Pigstep** vêm de versões novas: tocam no jukebox, mas o ícone do item é o de um disco parecido.
- **Árvores novas** (bétula, pinheiro, selva, acácia, carvalho escuro): ver `src/game/trees.js`.
