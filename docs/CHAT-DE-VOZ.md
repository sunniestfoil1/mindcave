# Chat de voz por aproximação

## Como o jogador usa

- Esc → **Ativar Chat de Voz por Aproximação** (vira **Desativar...** quando ligado). O navegador pede a permissão do microfone.
- O quadrado com o microfone ao lado do botão muta e desmuta. Em jogo, a tecla **V** (configurável em Controles > Multijogador) faz o mesmo.
- O botão só existe no menu de pausa. Jogando, fica só um ícone pequeno no canto de cima da tela mostrando o estado do próprio microfone.
- Em cima do nome de cada jogador aparece o ícone: **microfone** quando está falando (cor = tom: azul claro baixo, branco médio, amarelo alto) e **microfone cortado** quando está mutado.

## Alcance pelo tom de voz

| Tom | Alcance |
| --- | --- |
| Baixo (sussurro) | 8 blocos |
| Médio (fala normal) | 18 blocos |
| Alto (voz alta) | 24 blocos |

- Quem fala mede o próprio volume no microfone (sem ganho automático, que apagaria a diferença entre sussurro e grito). O tom é o volume em relação ao volume **habitual da pessoa** (abaixo de 55% = baixo, acima de 170% = alto), então não depende do ganho do microfone. O "habitual" acompanha a pessoa devagar (~20 s).
- O tom segue no campo `v` da mensagem de movimento (0 desligado, 1 mutado, 2 ligado, 3/4/5 falando em tom baixo/médio/alto). Quem ouve ajusta o alcance do `PannerNode` daquele jogador: volume cheio até 55% do alcance e queda linear até o limite.
- A trilha de áudio de saída existe desde o início da conexão (silenciosa até o microfone ligar), então ligar o chat de voz depois de entrar na sala funciona sem renegociar o WebRTC.

## Onde mexer

| Quero mudar | Arquivo |
| --- | --- |
| Alcances, limites de tom, sensibilidade do portão de ruído | `src/game/net/voiceChat.js` (`VOICE_RANGES`, `classifyTier`, `_startSpeechDetection`) |
| Botão e textos do menu de pausa | `src/components/game/GameHud.jsx` (`PauseMenuContent`) |
| Ícone em cima do nome | `src/game/voiceIcon.js` e `src/game/engine.js` (`updateRemotePlayers`) |
| Tecla de mutar | `voiceMute` em `src/game/settingsDefaults.js` |
| Estado enviado na rede | `v` em `src/game/engine.js` (mensagem `move`) e `src/game/net/netManager.js` |

## Créditos

Os ícones `public/assets/ui/mic.svg` e `mic-muted.svg` são os desenhos em pixel art do `VoiceMicrophone.tsx` do projeto PrismarineJS/minecraft-web-client (licença MIT).

## Testes

`npm run test:e2e` roda `scripts/e2e/voice.mjs` (alcances por tom, estado enviado, trilha de saída, ligar/mutar/desligar com o microfone falso do Chrome).
