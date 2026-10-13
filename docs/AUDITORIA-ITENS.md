# Auditoria de itens e blocos

Gerada por `npm run audit:itens` (estática), `scripts/audit-render.mjs` (renderização no navegador) e `npm run test:e2e` (funcional).
Os dados completos ficam em `docs/AUDITORIA-ITENS.json` e `docs/AUDITORIA-RENDER.json`.

## O que renderiza (verificado com o ItemSlot, o mesher e o item caído reais)
- 326 entradas (itens, blocos e cada tipo de laje): **todas** têm ícone, **nenhuma** malha usa a textura de erro e **todo** item caído monta.
- Exceção conhecida: as 18 peças/armas de fogo custom (ids 450–468) não existem no pacote 1.8.9 e aparecem como caixa colorida.
- Todas as texturas de bloco vêm do pacote oficial (o baú é composto a partir de `textures/entity/chest/normal.png`).

## O que funciona (testado no motor)
- **Blocos:** todo bloco quebrável dropa um item que existe e tem tempo de quebra finito; colocar, quebrar e drops de lajes, escadas, portas, cercas, portão, cama, baú, escada de mão e alçapão.
- **Comida:** as 31 comidas são comidas pelo botão direito (aumentam a fome e gastam 1).
- **Ferramentas:** picareta/machado/pá/tesoura mais rápidas que a mão no alvo certo; ordem madeira < pedra < ferro < diamante; minério de ferro exige pedra, diamante exige ferro, obsidiana exige diamante.
- **Armas:** espadas 5 < 6 < 7 < 8 por material; arco puxa a corda, consome flecha e desgasta (no criativo é livre).
- **Armaduras:** as 20 peças protegem; couro 7, malha 12, ferro 15, diamante 20 (couro e malha estavam errados).
- **Uso:** balde (água/lava), enxada, sementes, pederneira e aço, farinha de osso, tesoura em ovelha (lã volta ao comer grama), portas/portão/alçapão, redstone em porta.

## Itens que existem mas NÃO têm função (inertes)
Saddle, olho de aranha fermentado, suporte de poções, melão brilhante, moldura, livro e pena, livro assinado, cenoura no palito, fogos de artifício, tijolo do nether (item), cristais de prismarinho, suporte de armadura, guia, estandarte e os 12 discos de música.
Também sem função embora o item exista: bússola, relógio, mapa, poções e frasco, garrafa de XP, barco, carrinho de mina, placa, quadro, pesca com vara.

## Corrigidos nesta auditoria
Baú (nunca existiu como bloco), escada de mão, alçapão, tigela (as receitas apontavam para itens inexistentes), arco que nunca puxava a corda (era tratado como espada), arco sem consumo de flecha e sem desgaste, tabela de armadura (couro e malha), receita de baú.
