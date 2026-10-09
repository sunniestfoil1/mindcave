# Mapeamento de Sons do Minecraft 1.8.9 (Sound Discovery & Mapping)

Este documento registra a descoberta, categorização e mapeamento de gatilhos de áudio 3D / Web Audio API no Mind Cave.

---

## 🔊 Status de Implementação e Pré-Aquecimento Web Audio

- [x] **Zero-Latency Audio Stream (Keep-Alive):** Loop senoidal contínuo inaudível (`0.00001` gain) ativado em `initAudio()` para impedir suspensão do hardware de som pelo navegador.
- [x] **Atenuação e Panning 3D:** Suporte a `PannerNode` posicional (distância > 3 blocos) e reprodução direta estéreo para sons próximos ao jogador.
- [x] **Variação de Pitch Dinâmica:** Pitch aleatório (`0.9x - 1.1x`) simulando o comportamento nativo do Minecraft 1.8.9 Java Edition.

---

## 📂 Mapeamento de Arquivos de Som (`public/assets/sounds/`)

### 🦶 Passos (Footsteps)
- [x] `step/grass1.ogg` .. `grass6.ogg` — Grama / Terra / Folhas
- [x] `step/wood1.ogg` .. `wood6.ogg` — Tábuas de Madeira / Troncos / Bancadas
- [x] `step/stone1.ogg` .. `stone6.ogg` — Pedra / Minérios / Pedregulho
- [x] `step/sand1.ogg` .. `sand5.ogg` — Areia
- [x] `step/gravel1.ogg` .. `gravel4.ogg` — Cascalho
- [x] `step/snow1.ogg` .. `snow4.ogg` — Neve / Gelo
- [x] `step/ladder1.ogg` .. `ladder5.ogg` — Escada

### ⛏️ Mineração e Blocos (Dig & Break & Place)
- [x] `dig/grass1.ogg` .. `grass4.ogg` — Mineração de grama
- [x] `dig/wood1.ogg` .. `wood4.ogg` — Mineração de madeira
- [x] `dig/stone1.ogg` .. `stone4.ogg` — Mineração de pedra
- [x] `dig/sand1.ogg` .. `sand4.ogg` — Mineração de areia
- [x] `dig/gravel1.ogg` .. `gravel4.ogg` — Mineração de cascalho
- [x] `dig/snow1.ogg` .. `snow4.ogg` — Mineração de neve

### ⚔️ Combate e Dano (Combat & Player Hurt)
- [x] `damage/hit1.ogg` .. `hit3.ogg` — Dano no jogador / Impacto de espada
- [x] `random/bow.ogg` — Disparo de Arco
- [x] `random/bowhit.ogg` — Impacto da flecha
- [x] `random/break.ogg` — Quebra de armadura / Escudo

### 🛡️ Armadura (Armor Equip & Break)
- [x] `item/armor/equip_generic.ogg` — Armadura genérica
- [x] `item/armor/equip_iron.ogg` — Armadura de ferro
- [x] `item/armor/equip_diamond.ogg` — Armadura de diamante
- [x] `item/armor/equip_leather.ogg` — Armadura de couro
- [x] `item/armor/equip_gold.ogg` — Armadura de ouro
- [x] `item/armor/equip_chain.ogg` — Armadura de cota de malha
- [x] `random/break.ogg` — Destruição de armadura

### 🍖 Consumíveis & Mecânicas (Food & Environment)
- [x] `random/eat1.ogg` .. `eat3.ogg` — Mastigação de alimentos
- [x] `random/burp.ogg` — Eructação ao terminar de comer
- [x] `random/fuse.ogg` — Fusível da TNT
- [x] `random/explode.ogg` — Explosão da TNT
- [x] `game/neutral/swim/splash.ogg` — Respingo na água
- [x] `ambient/weather/rain1.ogg` — Loop de chuva ambiente

### 🏆 UI, Conquistas & Inventário
- [x] `random/click.ogg` — Botões do Menu e GuiButton
- [x] `random/pop.ogg` — Coleta de itens / Descarte
- [x] `random/levelup.ogg` — Ganho de Nível / Desafio Completo
- [x] `random/chestopen.ogg` / `chestclosed.ogg` — Abertura e fechamento de Baú
- [x] `random/door_open.ogg` / `door_close.ogg` — Abertura e fechamento de Porta
