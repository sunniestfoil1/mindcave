# MIND CAVE — PRD 07 de 12
# Combate 1.8.9 (Corpo a Corpo, Arco, Bloqueio, Críticos, Knockback) e Sistema de Animações (1ª e 3ª Pessoa)

| Campo | Valor |
|---|---|
| Depende de | PRDs 01–06 (física, dano, armaduras, itens, armas corpo a corpo) |
| Objetivo | Reproduzir o **combate da 1.8.9** com fidelidade (sem cooldown de ataque, ritmo por cliques, críticos, knockback com sprint, bloqueio com espada, arco com carga) com **registro de acertos justo em multiplayer**, e criar o **sistema de animações** completo do jogador e dos itens — mão em 1ª pessoa, balanço da espada, mineração, comer, bloquear, puxar arco, andar, correr, agachar, morrer — pronto para receber **animações de GLB** no PRD 10. |
| Próximo | PRD 08 — Mobs e IA |

> Regra de ouro deste PRD: **a lógica de combate é instantânea e independente da animação** (como no 1.8: o dano acontece no clique). Animações são só visuais e nunca atrasam ou bloqueiam um golpe.

---

## 1. Ataque corpo a corpo

**MC07-RF-001 (P0) — Sem cooldown.** Cada clique esquerdo em uma entidade ao alcance é um ataque com dano total. A cadência é limitada apenas pela janela de invulnerabilidade do alvo (10 ticks — PRD 05 RF-021). Segurar o botão **não** ataca repetidamente (cada ataque é um clique), mas ao segurar mirando blocos continua minerando.

**MC07-RF-002 (P0) — Alcance.**
- Sobrevivência/Aventura: **3,0 blocos** (dos olhos até a caixa do alvo).
- Criativo: **6,0 blocos** para entidades.
- Validação no servidor com tolerância (distância ao centro da caixa ≤ 6,0) para absorver latência; tentativas acima disso são descartadas e registradas.

**MC07-RF-003 (P0) — Detecção de alvo.** Raycast dos olhos na direção da câmera contra as caixas de colisão das entidades **expandidas em 0,1** (borda de colisão 1.8), escolhendo a mais próxima antes do primeiro bloco sólido no caminho. Atacar com o cursor sobre um bloco e uma entidade atrás: a entidade só é atingida se estiver antes do bloco.

**MC07-RF-004 (P0) — Cálculo do dano.**
1. Dano base do item (PRD 06 RF-070) + efeito Força/Fraqueza.
2. **Crítico** se: o atacante está **caindo** (velocidade Y < 0, distância de queda > 0), não está no chão, não está em escada de mão/trepadeira, não está na água, não tem Cegueira, não está montado. Na 1.8, **correr não impede crítico**. Dano × 1,5 (arredondado para baixo após somar). Partículas de crítico (estrelas/faíscas) em volta do alvo e som de crítico.
3. Encantamentos (Afiação +1,25 por nível; Julgamento/Ruína dos Artrópodes +2,5 por nível contra o tipo certo — PRD 11), com partículas mágicas azuis.
4. Armadura e efeitos do alvo (PRD 05 RF-023).
5. Gasta exaustão 0,3 (PRD 05) e durabilidade (PRD 06 RF-062).

**MC07-RF-005 (P0) — Knockback (1.8.9).**
- Todo golpe aplica impulso horizontal de ~0,4 na direção atacante→alvo e vertical de ~0,4 (limitado a ~0,4 de velocidade Y total), somado à metade da velocidade atual do alvo (fórmula 1.8: velocidade do alvo é dividida por 2 e somado o vetor do golpe).
- **Golpe correndo** (atacante em sprint no momento do clique) ou nível de Repulsão: knockback extra de +0,5 horizontal por nível (+1 nível pelo sprint) e +0,1 vertical. Depois do golpe correndo, o **sprint do atacante é interrompido** e a velocidade horizontal do atacante é multiplicada por 0,6 — isso cria a técnica de "W-tap" (soltar e apertar W para reativar o sprint), que precisa funcionar exatamente assim.
- Resistência a knockback (atributo de mob/armadura de futuras extensões) reduz proporcionalmente.
- O knockback no **jogador atingido** é aplicado pelo servidor e enviado com prioridade; o cliente do atingido aplica imediatamente ao receber (sem esperar reconciliação), para o golpe "sentir" na hora.

**MC07-RF-006 (P0) — Bloqueio com espada.** Segurar botão direito com espada:
- Pose de bloqueio (espada atravessada na frente) em 1ª e 3ª pessoa.
- Dano de ataques corpo a corpo, projéteis e explosões **reduzido à metade** (`(1 + dano) × 0,5` — regra 1.8), não reduz dano de queda/fogo/afogamento.
- Velocidade de movimento como "usando item" (≈ 20%); não pode correr enquanto bloqueia.
- Pode alternar bloqueio e ataque rapidamente ("block-hit"): soltar o direito e clicar o esquerdo no mesmo tick deve funcionar.

**MC07-RF-007 (P0) — Mãos vazias e outros itens.** Soco = 1 de dano. Atacar com bloco/item comum = 1. Ferramentas causam o dano da tabela e gastam 2 de durabilidade.

**MC07-RF-008 (P0) — PvP.** Respeitar a regra `PvP` do host e `friendlyFire` (PRD 03). Mensagens de morte com o nome do atacante e da arma ("Fulano foi morto por Ciclano usando [Espada de Diamante]").

---

## 2. Registro de acertos em multiplayer (justiça)

**MC07-RF-010 (P0) — Compensação de latência.** O servidor mantém um histórico das posições/caixas de todas as entidades dos últimos **500 ms** (a cada tick). Ao receber um ataque, **retrocede** as caixas dos alvos para o instante que o atacante via (tempo do servidor − ping/2 − atraso de interpolação do cliente, limitado a 200 ms) e valida o raycast e o alcance nesse estado. Configurável pelo host (Liga/Desliga, máximo de retrocesso).

**MC07-RF-011 (P0) — Previsão visual do atacante.** Ao clicar, o cliente do atacante mostra imediatamente o balanço do braço e, se o raycast local acertar, o **piscar vermelho** e partículas no alvo (efeito previsto); o dano/knockback reais vêm do servidor. Se o servidor recusar, nenhum efeito persistente fica (o piscar já terminou).

**MC07-RF-012 (P1) — Medidor de CPS (dev).** No Laboratório, o boneco de treino (seção 6) mostra CPS e dano recebido; F3 mostra CPS do jogador local.

---

## 3. Arco e flechas

**MC07-RF-020 (P0) — Puxar o arco.** Segurar botão direito com arco e pelo menos 1 flecha (ou criativo/Infinidade). Carga de 0 a 1 em **20 ticks** (fórmula 1.8: com f = ticks puxando ÷ 20, a carga é (f² + 2f) ÷ 3, limitada a 1). Ao soltar com carga ≥ 0,1 dispara. Movimento lento durante a puxada (como usar item); **FOV reduz** conforme a carga (respeitando "Efeitos de FOV"). No máximo de carga, o arco "treme" levemente na mão.

**MC07-RF-021 (P0) — Física da flecha.** Velocidade inicial = carga × 3 blocos/tick na direção olhada (com pequena dispersão aleatória 1.8), herdando a velocidade do atirador; gravidade 0,05/tick; arrasto 0,99 no ar e 0,6 na água (com bolhas). Colisão por varredura (raycast entre posição atual e próxima a cada tick) para não atravessar alvos/blocos.

**MC07-RF-022 (P0) — Dano da flecha.** `dano = teto(velocidade × 2,0)`; carga cheia vira **crítico** (partículas de rastro de crítico e dano extra aleatório até +50% de forma que o máximo fica em 10). Força (encantamento) adiciona +25% × (nível+1) (PRD 11). Chama (encantamento) incendeia.

**MC07-RF-023 (P0) — Comportamento ao acertar.**
- Entidade: aplica dano + knockback na direção da flecha; o som "ding" toca para o atirador quando acerta um **jogador**; a flecha "gruda" no corpo do jogador (contador de flechas presas, renderizadas saindo do modelo, somem com o tempo).
- Bloco: crava (fica tremendo um instante), pode ser recolhida (se não for de Infinidade/de esqueleto), some após 1.200 ticks.
- Atravessa nada; quica em entidades invulneráveis (ex.: alvo no frame de invulnerabilidade a flecha cai).
- Flechas em chamas acendem TNT ao acertá-la.

---

## 4. Outros projéteis e efeitos de combate

- **MC07-RF-030 (P0)** Bolas de neve e ovos: 0 de dano em jogadores, mas aplicam **knockback** (técnica 1.8); bola de neve causa 3 a blazes (PRD 11).
- **MC07-RF-031 (P0)** Vara de pescar: a boia que atinge uma entidade aplica knockback e "puxa" ao recolher (técnica de PvP 1.8 de usar a vara para combo).
- **MC07-RF-032 (P0)** Pérola do Ender: 5 de dano ao teleportar.
- **MC07-RF-033 (P0)** Projéteis de mobs (flecha de esqueleto, bola de fogo de ghast/blaze — PRD 08/11) usam o mesmo sistema de projéteis.
- **MC07-RF-034 (P0)** Sistema de projéteis genérico e data-driven (massa/gravidade/arrasto/dano/efeitos ao acertar/tempo de vida/aparência) — o PRD 09 usa a mesma base para balas.

---

## 5. Sistema de animações

### 5.1 Arquitetura

**MC07-RF-040 (P0) — Camadas de animação.** Cada modelo animável (jogador agora; mobs no PRD 08; GLB no PRD 10) tem um **controlador** com camadas misturadas:
1. **Locomoção** (corpo inteiro): parado, andar, correr, agachar, cair, nadar (na 1.8 é o mesmo andar com braços), montado, dormindo, morto.
2. **Ação** (parte superior, sobrepõe braços/tronco): balançar (ataque/mineração/usar), bloquear, puxar arco, comer/beber, arremessar, segurar item, mirar arma (PRD 09), recarregar (PRD 09).
3. **Aditivos**: respiração, olhar (cabeça segue pitch/yaw), piscar vermelho de dano, tremor do arco.
4. **Pós-procedural**: balanço da capa, oscilação de itens pendurados.

**MC07-RF-041 (P0) — Duas fontes de animação.** O controlador aceita:
- **Procedural** (padrão para o modelo de cubos): funções do tempo e da velocidade (balanço de membros por seno com amplitude ∝ velocidade, como o 1.8: ângulo do membro = cosseno(fase do passo × 0,6662) × 1,4 × amplitude).
- **Clipes de keyframes** (GLB, PRD 10): mapeados por nome de estado ("idle", "walk", "run", "sneak", "attack", "use", "block", "bow_draw", "eat", "death"...). Se um clipe não existir no GLB, usar o procedural correspondente como **fallback por estado**.
Velocidade de reprodução de clipes de locomoção sincronizada com a velocidade real (pés não "deslizam").

**MC07-RF-042 (P0) — Mesmo resultado para todos.** As variáveis que dirigem as animações (velocidade, agachado, estado de uso, item na mão, contador de balanço) são **replicadas**; cada cliente anima localmente. O outro jogador vê os mesmos estados (balanço da espada, bloqueio, arco puxado, comendo).

**MC07-RF-043 (P0) — Código de referência das animações.** Não criar animações do zero. Portar de "mind-cave-codigo-referencia/07-animacoes-jogador-e-armaduras":
- Modelo do jogador (skin 64×64, camadas externas, capa) e animações parado, andar, correr, agachar, golpe e acenar: skinview3d.
- Mão em 1ª pessoa, item na mão, balanço, equipar, uso de itens, tremor de câmera e animações de entidades: minecraft-renderer (hand, holdingBlock, animations, cameraShake).
- Modelos de armadura no corpo: minecraft-renderer (armorModels).
- Nadar e voar: na 1.8.9 o jogador nada com a mesma animação de andar e não há pose de natação; usar a animação de voo da referência apenas no Criativo/Espectador.
Os números das tabelas deste PRD são o resultado esperado; se a referência divergir, vale a referência e a divergência é registrada.

### 5.2 Primeira pessoa

**MC07-RF-050 (P0) — Render da mão.** Pass separado (PRD 02) com FOV fixo (~70) e profundidade própria, não afetado pelo FOV do jogador nem por zoom; braço com a skin do jogador (modelo clássico/fino); iluminado pela luz do bloco onde o jogador está (luz céu/bloco), com o lightmap.

**MC07-RF-051 (P0) — Animações em 1ª pessoa (comportamento 1.8.9).**

| Animação | Comportamento |
|---|---|
| Ocioso | Leve balanço acompanhando o view bobbing; mão "atrasa" levemente ao girar a câmera (inércia de rotação 1.8) |
| Equipar | Ao trocar de item, o novo item **sobe** da parte de baixo da tela (progresso de equipamento); trocar rapidamente não "pisca" |
| Balanço (ataque/mineração) | Duração **6 ticks**; arco do braço/item da direita para o centro com rotação; pode ser reiniciado a cada clique (spam de cliques reinicia o balanço, como no 1.8) |
| Minerando | Balanço contínuo em loop enquanto segura o botão sobre um bloco |
| Colocar bloco / usar | Meio balanço curto |
| Comer/beber | Item vai até a "boca" e sobe/desce rapidamente (bob a cada 4 ticks), partículas do item caindo; nos últimos ticks o movimento acelera |
| Bloquear com espada | Espada gira e fica atravessada na frente, levemente para cima |
| Puxar arco | Arco aproximado do centro, puxando para trás proporcional à carga; tremor no máximo |
| Arremessar | Balanço |
| Mão vazia | Braço visível no canto inferior direito |
| Mapa | Segurado com as duas mãos no centro (P2) |

**MC07-RF-052 (P0) — Transformações de exibição por contexto.** Cada item (procedural ou GLB) tem transformações (posição, rotação, escala) para os contextos: `primeira_pessoa_direita`, `terceira_pessoa_direita`, `gui`, `chão`, `moldura`, `cabeça`. Valores padrão equivalentes ao 1.8 para blocos, ferramentas (inclinadas ~45° na mão) e itens planos. O PRD 10 permite editar visualmente.

### 5.3 Terceira pessoa (modelo do jogador)

**MC07-RF-060 (P0) — Rig e poses (1.8.9).**

| Estado | Pose |
|---|---|
| Parado | Braços com leve "respiração" (oscilação lenta) |
| Andando | Braços e pernas em oposição, amplitude ∝ velocidade |
| Correndo | Amplitude maior |
| Agachado | Tronco inclinado ~0,5 rad para frente, cabeça abaixada, pernas recuadas, nome escondido atrás de blocos |
| Caindo/pulando | Mesma locomoção sem passos (amplitude decai) |
| Balançar | Braço direito em arco de cima para frente + leve torção do tronco |
| Bloquear | Braço direito levantado com a espada inclinada |
| Arco | Ambos os braços estendidos à frente na direção do olhar |
| Comer/beber | Braço direito até a boca com oscilação |
| Segurando item | Braço direito levemente à frente |
| Dormindo | Deitado na cama |
| Montado | Pernas abertas para frente |
| Morto | Tomba para o lado em 20 ticks |
| Dano | Pisca vermelho |

**MC07-RF-061 (P0) — Cabeça e corpo.** A cabeça segue yaw/pitch do jogador; o corpo segue o yaw da cabeça quando a diferença passa de ~50° ou quando o jogador anda (rotação suave), como no 1.8.

**MC07-RF-062 (P0) — Itens e armadura no modelo.** Item da mão direita renderizado no punho com a transformação de 3ª pessoa; armadura e brilho de encantamento visíveis; flechas presas no corpo; capa com física simples (balança com a velocidade e inclina ao agachar).

---

## 6. Ferramentas de teste de combate (Laboratório)

**MC07-RF-070 (P1) — Boneco de treino.** Entidade "Boneco" (modelo de cubos de palha, não se move, 1.000 HP regenerando, sem IA) que mostra **números de dano flutuantes** (crítico em amarelo), knockback visível (desliza e volta), e um painel acima com: dano do último golpe, CPS, maior combo, distância do último golpe. Disponível no inventário criativo (aba Studio/Combate) e no Estande de tiro do Laboratório. Aceita armadura para testar redução.

**MC07-RF-071 (P1) — Sobreposição de hitbox.** F3+B (PRD 01) mostra também a linha de visão (azul) e a caixa expandida de ataque.

---

## 6b. Emotes (extensão Mind Cave)

**MC07-RF-090 (P0) — Roda de emotes.** Tecla **P** abre uma barra/roda de emotes no centro inferior da tela com 9 espaços numerados; teclas **1 a 9** (ou clique) escolhem o emote; P de novo ou Esc fecha. Enquanto a roda está aberta, as teclas 1–9 não trocam o slot da hotbar.

**MC07-RF-091 (P0) — Execução.** Ao iniciar um emote: o jogador para; a câmera passa automaticamente para 3ª pessoa (opção "manter 1ª pessoa"); o modelo executa a animação de corpo inteiro (com música/som quando o emote tiver áudio). Andar, pular, atacar, levar dano ou abrir inventário **cancela** o emote com transição suave. Emotes em loop continuam até cancelar.

**MC07-RF-092 (P0) — Sincronização.** O início/fim do emote é enviado pela rede; o outro jogador vê o mesmo emote, sincronizado no tempo, com o mesmo áudio posicional. Emotes não afetam a física nem a caixa de colisão.

**MC07-RF-093 (P0) — Formato e motor.** Os emotes usam o formato do Emotecraft (keyframes por parte do corpo com easing) tocados por um motor portado de "08-emotes/playerAnimator-MIT". Já vêm instalados os emotes de "08-emotes/emotecraft-emotes-GPL3" (backflip, caramell dance, palmas, club penguin dance, choro, "aqui", kazotsky kick, let's groove, facepalm, apontar, roblox potion dance, take the L, twerk, acenar), com ícones. O Studio (PRD 10) permite importar mais emotes nesse formato ou como clipes de GLB, e escolher quais ficam nos 9 espaços da roda (por jogador).

**MC07-RF-094 (P1) — Emotes em GLB.** Se o jogador usa um personagem GLB (PRD 10), os emotes em formato Emotecraft são aplicados aos ossos mapeados (cabeça, tronco, braços, pernas); clipes de dança do próprio GLB também podem ser marcados como emote.

**MC07-CA-09** Pressionar P, depois 3, executa o terceiro emote; o amigo vê a mesma dança no mesmo ritmo; andar cancela.

## 7. Sons e partículas de combate

- **MC07-RF-080 (P0)** Sons: golpe (variações), crítico, dano do jogador, dano por material de armadura, arco puxando/disparando, flecha acertando bloco/entidade, "ding" de acerto em jogador, quebra de ferramenta, bloqueio (som abafado).
- **MC07-RF-081 (P0)** Partículas: crítico, crítico mágico (encantamento), rastro de flecha carregada, poeira ao cair, fumaça na morte.

---

## 8. Requisitos não funcionais

- **MC07-RNF-001 (P0)** Latência visual do golpe (clique → balanço) = 0 quadros; clique → knockback visível no outro jogador ≤ ping + 1 tick.
- **MC07-RNF-002 (P0)** Animações de 10 jogadores/mobs com custo de CPU < 1 ms por quadro (procedural) e GLB com *skinning* em GPU.
- **MC07-RNF-003 (P0)** A lógica de combate roda por tick do servidor (20 TPS) e não depende do FPS de nenhum cliente.

---

## 9. Critérios de aceite

- **MC07-CA-01** Cliques rápidos (10 CPS) num boneco aplicam dano apenas quando a janela de invulnerabilidade termina (máx. 2 golpes completos por segundo com o mesmo dano), igual ao 1.8.
- **MC07-CA-02** Golpe caindo de um pulo mostra partículas de crítico e causa 1,5× (espada de diamante: 8 → 12).
- **MC07-CA-03** Golpe correndo empurra visivelmente mais longe; o atacante perde o sprint; W-tap restaura.
- **MC07-CA-04** Bloquear com espada reduz pela metade o dano de um zumbi (verificar no boneco/F3).
- **MC07-CA-05** Arco: tiro rápido (carga baixa) cai perto e dá pouco dano; carga cheia faz arco longo, crítico, até 10 de dano; flecha crava no bloco e pode ser recolhida.
- **MC07-CA-06** Com ping simulado de 150 ms, acertar o amigo correndo de lado continua consistente (compensação de latência ligada) e incoerente quando desligada (prova que a compensação funciona).
- **MC07-CA-07** Em 3ª pessoa e para o outro jogador: andar, correr, agachar, balançar, bloquear, puxar arco e comer são visíveis com as poses descritas.
- **MC07-CA-08** Trocar de item mostra a animação de equipar; spam de cliques reinicia o balanço.
