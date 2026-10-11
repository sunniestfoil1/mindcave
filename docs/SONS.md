# Sons do jogo

Os sons vêm de `public/assets/sounds`. O arquivo `sounds.json` mapeia 1462 eventos (por exemplo `entity.zombie.hurt`) para os 5981 `.ogg`; todos os arquivos citados existem. O jogo toca por evento com `playEvent(evento, { pos, volume })` em `src/game/sounds.js`.

## O que toca hoje

| Ação | Onde | Evento ou arquivo |
|---|---|---|
| Passo, escavar, quebrar e colocar bloco | `engine.js` | `step/*`, `dig/*` por material do bloco |
| Jogador toma dano | `engine.js` (`hurtSeq`) | `damage/hit1-3`; queda: `damage/fallsmall` ou `fallbig` |
| Morte do jogador | `engine.js` | `entity.player.death` |
| Mob: dano, morte, som ambiente, passo | `MobEntity.onSound` → `playMobSound` | `entity.<mob>.hurt/death/ambient/step` |
| Creeper começa a inflar | `aiGoals.js` | `entity.creeper.primed` |
| Enderman: olhar, grito, teleporte | `aiGoals.js`, `mobEntity.js` | `entity.enderman.stare/scream/teleport` |
| Explosão (creeper, TNT) | `engine.detonate` | `entity.generic.explode` |
| Entrar na água | `engine.js` | `entity.generic.splash` |
| Comer e arrotar | `engine.js` | `random/eat1-3`, `random/burp` |
| Disparar arco | `engine.js` | `random/bow` |
| Chuva | `engine.js` | `ambient/weather/rain1` em laço |
| Abrir baú | `Game.jsx` | `block.chest.open` |
| Clique em interface, subir de nível, pegar item | vários | `random/click`, `random/levelup`, `random/pop` |
| Trilha sonora | `musicManager.js` | `music/game/*` (só faixas C418; sem som sintético) |

## O que existe e ainda não toca

Fechar baú, portas, equipar e quebrar armadura (funções prontas em `sounds.js`, sem chamada), acertar flecha, ambiente de caverna, de água e do Nether, alavancas, botões, pistões, fornalha, bigorna e mesa de encantamento. Para ligar um deles, chame `playEvent('<evento>', { pos })` no ponto do código onde a ação acontece.

## Mobs

`MOB_SOUND_NAME` em `sounds.js` liga o tipo do mob ao nome usado nos eventos. Mob sem esse nome fica mudo.
