# Pacotes de recursos e mira

## Como funciona

1. **Opções > Pacotes de recursos...** lista os pacotes do catálogo (hoje só o `SunniFPSBOOST.zip`) no estilo do `GuiScreenResourcePacks` do 1.8.9.
2. Clicar no ícone de um pacote disponível **baixa** o zip (se ainda não estiver no cache) e move para a lista de selecionados.
3. **Pronto** grava a escolha no `localStorage` (`mc.resourcePacks.v1`, do menos para o mais prioritário, como o `options.txt`) e **recarrega a página**: texturas, modelos, céu e HUD leem o pacote novo de uma vez. **Esc** sai sem aplicar.
4. O pacote vale **por cima** do pacote base: cada arquivo é procurado primeiro nos pacotes escolhidos e, se não existir, no base (`src/game/pack.js`, função `resolveEntry`).
5. Texturas de outro tamanho (o SunniFPSBOOST traz `coal_ore` 512×512, `icons.png` 1024×1024...) são reduzidas para o ladrilho do atlas, que é 16×16.

## Cache sem baixar de novo

- Zip salvo na Cache API (`mc-resourcepacks-v1`) com o tamanho e o ETag da versão baixada.
- Antes de usar, um `HEAD` compara tamanho (e ETag, quando o navegador o expõe). Igual = usa o cache. Diferente = baixa de novo.
- Sem rede: usa o que está no cache.
- No boot (`src/main.jsx`) os pacotes escolhidos entram **direto do cache, sem rede**; a conferência de versão roda 3 s depois, em segundo plano, e uma versão nova vale na abertura seguinte.

## Modo Otimizado

Os botões "Modo Otimizado" (menu principal) e "Otimizado (máx. desempenho)" (Perfis de qualidade) aplicam o perfil e, se o pacote otimizado ainda não está escolhido, perguntam se o jogador quer baixá-lo. Baixou? Pergunta se aplica agora (recarrega) ou depois.

## Mira

Desenhada pelo motor (`src/game/crosshair.js`), igual ao `GuiIngame.renderGameOverlay`: sprite 16×16 do `icons.png` em `(i/2 - 7, j/2 - 7)` da GUI, mistura `ONE_MINUS_DST_COLOR / ONE_MINUS_SRC_COLOR` (inverte a cor do fundo). Um quad no mesmo canvas, sem DOM. Some com F3, F1, pausa, chat e qualquer tela aberta.

## Onde mexer

| Quero mudar | Arquivo |
| --- | --- |
| Incluir outro pacote no catálogo | `PACK_CATALOG` em `src/game/resourcePacks.js` (e subir o zip para `game-assets/resourcepacks/` no Storage do Supabase) |
| Qual pacote o Modo Otimizado oferece | `OPTIMIZED_PACK_ID` em `src/game/resourcePacks.js` |
| Cache, download, conferência de versão | `src/game/resourcePacks.js` |
| Ordem de prioridade dos arquivos (pacote por cima do base) | `src/game/pack.js` (`resolveEntry`, `setOverlays`) |
| Layout da tela de pacotes | `src/components/options/ResourcePacksPage.jsx` |
| Pergunta do Modo Otimizado | `src/components/options/OptimizedPackDialog.jsx` |
| Textos da tela (pt, en, es, fr, de) | chaves `resourcePack.*` e `optpack.*` em `src/game/i18n.js` |
| Posição, escala ou regra de quando a mira aparece | `src/game/crosshair.js` e a chamada em `src/game/engine.js` |

## Testes

`npm run test:e2e` roda `scripts/e2e/packs.mjs` (escolher, baixar, aplicar, cache sem novo download, atlas diferente) e `scripts/e2e/crosshair.mjs` (cada pixel da cruz 9×9 é o fundo invertido, nada fora dela muda).
