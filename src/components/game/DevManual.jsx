import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Adicionar um Bloco',
    content: `1. Abra src/game/blocks.js
2. Adicione uma entrada no objeto BLOCKS com o ID, nome, textura e propriedades:
   B(id, 'meu_bloco', 'Meu Bloco', { hardness: 1.5, faces: { all: 'stone' }, drop: id })
3. Se o bloco precisa de um modelo especial (cruz, tocha, carpete), defina model: 'cross'|'torch'|'carpete'.
4. Para emitir luz, adicione lightEmission: 15.
5. Se não é sólido (plantas, fios), defina solid: false e replaceable: true.
6. Adicione a textura em src/game/textures.js no objeto TILES.
7. Para aparecer no inventário criativo, adicione em src/game/items.js.`,
  },
  {
    title: 'Adicionar um Item',
    content: `1. Abra src/game/items.js
2. Adicione uma entrada no objeto ITEMS:
   I(id, 'meu_item', 'Meu Item', { color: 0xff0000, category: 'materials', maxStack: 64 })
3. Para ferramentas/armas, defina tool: true ou weapon: true com material.
4. Para comida, defina food: { hunger: 4, saturation: 2.4 }.
5. Para armadura, defina armor: { points: 2, material: 'iron' }.`,
  },
  {
    title: 'Adicionar uma Receita',
    content: `1. Abra src/game/recipes.js
2. Receitas de bancada (crafting):
   Adicione um padrão 3x3 com ingredientes e resultado.
   Use IDs numéricos dos itens/blocos.
3. Receitas de fornalha:
   Adicione em FURNACE_RECIPES: { input: id, output: id, xp: 0.1 }.
4. Teste abrindo a bancada no jogo e verificando o resultado.`,
  },
  {
    title: 'Adicionar um Mob',
    content: `1. Abra src/game/mobRegistry.js para registrar o tipo do mob.
2. Abra src/game/mobModels.js para criar o modelo 3D procedural.
3. Abra src/game/aiGoals.js para definir o comportamento (goals).
4. Abra src/game/mobSpawn.js para regras de spawn (bioma, luz, probabilidade).
5. Abra src/game/mobEntity.js para drops e serialização.
6. Teste com /summon <tipo> no chat.`,
  },
  {
    title: 'Adicionar um Som',
    content: `1. Faça upload do arquivo de áudio pelo Studio (asset type: 'audio').
2. Crie um vínculo (AssetBinding) com targetType: 'sound' e o targetId apropriado.
3. No código, use o assetResolver para obter a URL do som.
4. Reproduza com new Audio(url).play() ou via Web Audio API.`,
  },
  {
    title: 'Adicionar um Bioma',
    content: `1. Abra src/game/biomes.js para registrar o bioma.
2. Abra src/game/biomeGen.js para a geração de relevo e temperatura.
3. Abra src/game/vegetation.js para árvores e plantas do bioma.
4. Abra src/game/terrain.js para integrar na geração de chunks.
5. Teste criando um mundo novo e explorando.`,
  },
  {
    title: 'Adicionar um Comando',
    content: `1. Abra src/game/commands.js
2. Adicione uma entrada no objeto COMMANDS:
   { name: 'meucomando', desc: 'Descrição', usage: '/meucomando <args>', op: false,
     exec: (engine, args) => { ... } }
3. Use engine.world, engine.player, engine.entities para interagir.
4. Use parseCoord para coordenadas relativas (~).
5. Teste digitando /meucomando no chat do jogo.`,
  },
  {
    title: 'Onde Ficam as Constantes',
    content: `• src/game/constants.js — timing, física, jogador, dificuldade, game rules
• src/game/blocks.js — registros e propriedades de blocos
• src/game/items.js — registros e propriedades de itens
• src/game/survival.js — fome, vida, XP, dano
• src/game/combat.js — dano, alcance, knockback
• src/game/mining.js — tempos de mineração, drops
• src/game/settingsDefaults.js — configurações padrão`,
  },
  {
    title: 'Rodar Testes e Benchmark',
    content: `• Testes automatizados: npx vitest run
• Benchmark: no jogo, digite /benchmark no chat
• Build de produção: npx vite build
• Verificação de tipos: npx tsc --noEmit
• Os testes estão em src/game/__tests__/`,
  },
  {
    title: 'Gerar um Backup',
    content: `• No menu de pausa (Esc dentro do jogo), clique em "Fazer backup agora".
• Na lista de mundos (menu principal), cada mundo tem botão de backup.
• Os backups ficam no armazenamento de arquivos do Base44.
• Para restaurar: vá na lista de mundos → "Backups do mundo" → selecionar → "Restaurar".`,
  },
  {
    title: 'Configurar TURN',
    content: `• O TURN é necessário para conexões P2P que não funcionam via STUN direto.
• Credenciais TURN de curta duração são geradas por Backend Function.
• Nunca coloque credenciais TURN fixas no código cliente.
• Configure o servidor TURN nas configurações do app (Dashboard → Integrations).`,
  },
];

export default function DevManual({ onClose }) {
  const [search, setSearch] = useState('');
  const filtered = SECTIONS.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 border border-white/20 rounded-lg w-[800px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h2 className="text-xl font-bold text-white">Manual do Desenvolvedor</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2 top-2 text-white/30" size={16} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar no manual..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white outline-none focus:border-green-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filtered.map(s => (
            <div key={s.title} className="bg-white/5 rounded-lg p-3">
              <h3 className="text-green-400 font-semibold text-sm mb-2">{s.title}</h3>
              <pre className="text-white/70 text-xs whitespace-pre-wrap font-mono">{s.content}</pre>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-white/40 text-sm">Nenhum resultado.</p>}
        </div>
      </div>
    </div>
  );
}