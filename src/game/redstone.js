// Sistema de Redstone — PRD 11 §1 (paridade 1.8.9)
// Modelo de energia 0-15, fios, fontes, repetidores, comparadores, lâmpadas, TNT.
// Determinístico (ordem ordenada por posição), com orçamento de atualizações.
// tickCount = contador de ticks de redstone (1 a cada 2 game ticks). Nunca usa this.tick.
import { stateId, stateMeta, packState } from './chunk';
import { getBlock, isSolid, isWater } from './blocks';

// IDs de blocos
const WIRE = 55, LEVER = 69, STONE_PLATE = 70, WOOD_PLATE = 72;
const TORCH_OFF = 75, TORCH_ON = 76, STONE_BUTTON = 77;
const REPEATER_OFF = 93, REPEATER_ON = 94;
const LAMP_OFF = 123, LAMP_ON = 124;
const DAYLIGHT_SENSOR = 151, REDSTONE_BLOCK = 152;
const COMPARATOR_OFF = 149, COMPARATOR_ON = 150;
const TNT = 46;

// Direções
const DIRS6 = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const DIRS4 = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];

// Facing: 0=Sul(+Z), 1=Oeste(-X), 2=Norte(-Z), 3=Leste(+X)
const FACING = [
  { ox: 0, oz: 1 }, { ox: -1, oz: 0 }, { ox: 0, oz: -1 }, { ox: 1, oz: 0 },
];

// Fontes que emitem 15 diretamente (bloco fortemente energizado)
const SOURCE_BLOCKS = new Set([REDSTONE_BLOCK, TORCH_ON, REPEATER_ON, COMPARATOR_ON]);

// Offset do bloco onde a tocha está presa, conforme meta (1.8.9)
function torchAttachOffset(meta) {
  switch (meta & 7) {
    case 1: return [-1, 0, 0]; // voltada p/ leste → presa na parede oeste
    case 2: return [1, 0, 0];  // voltada p/ oeste → presa na parede leste
    case 3: return [0, 0, -1]; // voltada p/ sul → presa na parede norte
    case 4: return [0, 0, 1];  // voltada p/ norte → presa na parede sul
    case 5: default: return [0, -1, 0]; // para cima → presa no chão
  }
}

export class RedstoneSystem {
  constructor(world) {
    this.world = world;
    this.dirty = new Set();
    // Transições pendentes: key → { fireAt: tickCount, kind: 'repeater'|'comparator'|'torch', targetOn: bool }
    this.pending = new Map();
    this.tickCount = 0;
    this.budget = 8000;
    this.overloaded = false;
    this.onTNTActivate = null;
  }

  key(x, y, z) { return x + ',' + y + ',' + z; }

  markDirty(x, y, z) {
    const k = this.key(x, y, z);
    this.dirty.add(k);
    for (const [dx, dy, dz] of DIRS6) this.dirty.add(this.key(x+dx, y+dy, z+dz));
    // Quasi-conectividade: bloco acima também reavalia
    this.dirty.add(this.key(x, y+1, z));
  }

  onBlockChange(x, y, z) { this.markDirty(x, y, z); }

  scheduleTransition(x, y, z, delay, kind, targetOn) {
    const k = this.key(x, y, z);
    const existing = this.pending.get(k);
    // Já tem uma transição pendente para o mesmo alvo — não reagenda
    if (existing && existing.targetOn === targetOn) return;
    this.pending.set(k, { fireAt: this.tickCount + delay, kind, targetOn });
  }

  // Verifica se um bloco recebe energia (para lâmpadas, pistões, etc.)
  isPowered(x, y, z) { return this.getReceivedPower(x, y, z) > 0; }

  // Potência recebida por um bloco: strong + weak
  getReceivedPower(x, y, z) {
    let max = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x+dx, ny = y+dy, nz = z+dz;
      const p = this.getDirectionalOutput(nx, ny, nz, x, y, z);
      if (p > max) max = p;
    }
    // Weak power de fios adjacentes
    for (const [dx, dy, dz] of DIRS6) {
      const st = this.world.getBlock(x+dx, y+dy, z+dz);
      const id = stateId(st);
      if (id === WIRE) {
        const wp = stateMeta(st);
        if (wp > max) max = wp;
      }
    }
    return max;
  }

  // Saída de uma fonte (strong power para o bloco adjacente)
  getSourceOutput(x, y, z) {
    const st = this.world.getBlock(x, y, z);
    const id = stateId(st);
    const meta = stateMeta(st);

    if (id === REDSTONE_BLOCK) return 15;
    if (id === LEVER && (meta & 8)) return 15;
    if (id === STONE_PLATE && (meta & 1)) return 15;
    if (id === WOOD_PLATE && (meta & 1)) return 15;
    if (id === STONE_BUTTON && (meta & 8)) return 15;
    if (id === DAYLIGHT_SENSOR) return meta;
    if (id === TORCH_ON) return 15;
    if (id === REPEATER_ON || id === COMPARATOR_ON) return 15;
    return 0;
  }

  // Saída direcional: repeater/comparator só energizam o bloco à frente (facing)
  getDirectionalOutput(x, y, z, towardX, towardY, towardZ) {
    const st = this.world.getBlock(x, y, z);
    const id = stateId(st);
    const meta = stateMeta(st);

    if (id === REPEATER_ON || id === COMPARATOR_ON) {
      const facing = meta & 3;
      const f = FACING[facing];
      // Saída só na direção de facing
      if (x + f.ox === towardX && z + f.oz === towardZ) return 15;
      return 0;
    }
    return this.getSourceOutput(x, y, z);
  }

  tick() {
    this.tickCount++;

    // Processar transições pendentes (repeater/comparator/torch com delay)
    for (const [k, t] of this.pending) {
      if (t.fireAt <= this.tickCount) {
        const p = k.split(',');
        this.applyTransition(+p[0], +p[1], +p[2], t);
        this.pending.delete(k);
      }
    }

    // Iteração de ponto fixo
    let processed = 0;
    for (let iter = 0; iter < 8 && this.dirty.size > 0 && processed < this.budget; iter++) {
      const batch = Array.from(this.dirty).sort();
      this.dirty.clear();
      for (const k of batch) {
        if (processed >= this.budget) { this.dirty.add(k); break; }
        const p = k.split(',');
        this.evaluate(+p[0], +p[1], +p[2]);
        processed++;
      }
    }

    if (this.dirty.size > 0) {
      this.overloaded = true;
      this.dirty.clear();
    } else {
      this.overloaded = false;
    }
  }

  applyTransition(x, y, z, t) {
    const st = this.world.getBlock(x, y, z);
    const id = stateId(st);
    const meta = stateMeta(st);

    if (t.kind === 'repeater') {
      // Re-verifica se ainda deve mudar (input pode ter voltado)
      const f = FACING[meta & 3];
      const backX = x - f.ox, backZ = z - f.oz;
      const input = this.getReceivedPower(backX, y, backZ);
      const shouldOn = input > 0;
      if (shouldOn !== t.targetOn) return; // Condição mudou — cancela
      // Re-verifica locking
      if (this.isRepeaterLocked(x, y, z, meta)) return;
      const newId = t.targetOn ? REPEATER_ON : REPEATER_OFF;
      if (id !== newId) {
        this.world.setBlock(x, y, z, packState(newId, meta));
        this.markDirty(x, y, z);
      }
    } else if (t.kind === 'comparator') {
      const f = FACING[meta & 3];
      const backX = x - f.ox, backZ = z - f.oz;
      const back = this.getReceivedPower(backX, y, backZ);
      const sideMax = this.getComparatorSidePower(x, y, z, meta);
      const subtract = (meta & 4) !== 0;
      const out = subtract ? Math.max(0, back - sideMax) : (back >= sideMax ? back : 0);
      const shouldOn = out > 0;
      if (shouldOn !== t.targetOn) return;
      const newId = t.targetOn ? COMPARATOR_ON : COMPARATOR_OFF;
      if (id !== newId) {
        this.world.setBlock(x, y, z, packState(newId, meta));
        this.markDirty(x, y, z);
      }
    } else if (t.kind === 'torch') {
      const [ax, ay, az] = torchAttachOffset(meta);
      const attachPowered = this.isBlockPowered(x + ax, y + ay, z + az);
      const shouldOn = !attachPowered;
      if (shouldOn !== t.targetOn) return;
      const newId = t.targetOn ? TORCH_ON : TORCH_OFF;
      if (id !== newId) {
        this.world.setBlock(x, y, z, packState(newId, meta));
        this.markDirty(x, y, z);
      }
    }
  }

  evaluate(x, y, z) {
    const st = this.world.getBlock(x, y, z);
    const id = stateId(st);
    const meta = stateMeta(st);

    if (id === WIRE) this.evalWire(x, y, z, meta);
    else if (id === TORCH_ON || id === TORCH_OFF) this.evalTorch(x, y, z, meta, id);
    else if (id === REPEATER_OFF || id === REPEATER_ON) this.evalRepeater(x, y, z, meta, id);
    else if (id === COMPARATOR_OFF || id === COMPARATOR_ON) this.evalComparator(x, y, z, meta, id);
    else if (id === LAMP_OFF || id === LAMP_ON) this.evalLamp(x, y, z);
    else if (id === TNT) this.evalTNT(x, y, z);
  }

  // Verifica se um bloco sólido está energizado (strong + weak)
  isBlockPowered(x, y, z) {
    return this.getBlockStrongPower(x, y, z) > 0 || this.getBlockWeakPower(x, y, z) > 0;
  }

  // Energiza um bloco sólido adjacente (weak power de fio)
  getBlockWeakPower(x, y, z) {
    let max = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x+dx, ny = y+dy, nz = z+dz;
      const st = this.world.getBlock(nx, ny, nz);
      const nid = stateId(st);
      const nmeta = stateMeta(st);
      if (nid === WIRE && nmeta > 0) max = Math.max(max, nmeta);
    }
    return max;
  }

  // Strong power que um bloco recebe de fontes adjacentes
  getBlockStrongPower(x, y, z) {
    let max = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const p = this.getSourceOutput(x+dx, y+dy, z+dz);
      if (p > max) max = p;
    }
    return max;
  }

  evalWire(x, y, z, meta) {
    let maxIn = 0;
    // Horizontal + vertical: fios recebem energia de fios e fontes adjacentes
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x+dx, ny = y+dy, nz = z+dz;
      const st = this.world.getBlock(nx, ny, nz);
      const nid = stateId(st);
      const nmeta = stateMeta(st);

      if (nid === WIRE) {
        maxIn = Math.max(maxIn, nmeta);
      } else if (SOURCE_BLOCKS.has(nid)) {
        // Fonte direta — repeater/comparator só energiza na direção de facing
        if (nid === REPEATER_ON || nid === COMPARATOR_ON) {
          const facing = nmeta & 3;
          const f = FACING[facing];
          if (nx + f.ox === x && nz + f.oz === z) maxIn = Math.max(maxIn, 15);
        } else {
          maxIn = Math.max(maxIn, 15);
        }
      } else if (nid === LEVER && (nmeta & 8)) {
        maxIn = Math.max(maxIn, 15);
      } else if (nid === STONE_PLATE && (nmeta & 1)) {
        maxIn = Math.max(maxIn, 15);
      } else if (nid === WOOD_PLATE && (nmeta & 1)) {
        maxIn = Math.max(maxIn, 15);
      } else if (nid === STONE_BUTTON && (nmeta & 8)) {
        maxIn = Math.max(maxIn, 15);
      } else if (nid === DAYLIGHT_SENSOR) {
        maxIn = Math.max(maxIn, nmeta);
      } else if (isSolid(nid)) {
        // Weak power do bloco sólido
        const wp = this.getBlockWeakPower(nx, ny, nz);
        if (wp > 0) maxIn = Math.max(maxIn, wp - 1);
        // Strong power de fonte no bloco sólido
        const sp = this.getBlockStrongPower(nx, ny, nz);
        if (sp > 0) maxIn = Math.max(maxIn, sp);
      }
    }

    const newPower = maxIn > 0 ? maxIn - 1 : 0;
    if (newPower !== meta) {
      this.world.setBlock(x, y, z, packState(WIRE, newPower));
      this.markDirty(x, y, z);
    }
  }

  evalTorch(x, y, z, meta, id) {
    // 1.8.9: tocha apaga quando o bloco onde está presa é energizado
    const [ax, ay, az] = torchAttachOffset(meta);
    const attachPowered = this.isBlockPowered(x + ax, y + ay, z + az);

    const shouldOn = !attachPowered;
    const isOn = id === TORCH_ON;

    if (shouldOn !== isOn) {
      // 1.8.9: 1 tick de redstone de delay na transição da tocha
      this.scheduleTransition(x, y, z, 1, 'torch', shouldOn);
    }
  }

  evalRepeater(x, y, z, meta, id) {
    const k = this.key(x, y, z);

    // 1.8.9: repeater locked não muda de estado
    if (this.isRepeaterLocked(x, y, z, meta)) {
      // Se já estava mudando, cancela a transição pendente
      this.pending.delete(k);
      return;
    }

    const facing = meta & 3;
    const delay = ((meta >> 2) & 3) + 1; // 1-4 ticks de redstone
    const f = FACING[facing];
    const backX = x - f.ox, backZ = z - f.oz;
    const input = this.getReceivedPower(backX, y, backZ);

    const shouldOn = input > 0;
    const isOn = id === REPEATER_ON;

    if (shouldOn !== isOn) {
      // Agenda a transição após `delay` ticks de redstone (ambas as direções)
      this.scheduleTransition(x, y, z, delay, 'repeater', shouldOn);
    }
  }

  // 1.8.9: repeater é locked quando outro repeater ligado aponta para seu lado
  isRepeaterLocked(x, y, z, meta) {
    const facing = meta & 3;
    const f = FACING[facing];
    // Direções laterais (perpendiculares ao facing)
    const sides = [[f.oz, f.ox], [-f.oz, -f.ox]];
    for (const [dx, dz] of sides) {
      const st = this.world.getBlock(x + dx, y, z + dz);
      const sid = stateId(st);
      if (sid === REPEATER_ON) {
        const smeta = stateMeta(st);
        const sf = FACING[smeta & 3];
        // O repeater lateral deve apontar em nossa direção
        if (sf.ox === -dx && sf.oz === -dz) return true;
      }
    }
    return false;
  }

  evalComparator(x, y, z, meta, id) {
    const facing = meta & 3;
    const subtract = (meta & 4) !== 0;
    const f = FACING[facing];
    const backX = x - f.ox, backZ = z - f.oz;
    const back = this.getReceivedPower(backX, y, backZ);
    const sideMax = this.getComparatorSidePower(x, y, z, meta);

    const out = subtract ? Math.max(0, back - sideMax) : (back >= sideMax ? back : 0);

    const shouldOn = out > 0;
    const isOn = id === COMPARATOR_ON;

    if (shouldOn !== isOn) {
      // 1.8.9: 1 tick de redstone de delay na transição do comparator
      this.scheduleTransition(x, y, z, 1, 'comparator', shouldOn);
    }
  }

  getComparatorSidePower(x, y, z, meta) {
    const f = FACING[meta & 3];
    const side1 = this.getReceivedPower(x + f.oz, y, z + f.ox);
    const side2 = this.getReceivedPower(x - f.oz, y, z - f.ox);
    return Math.max(side1, side2);
  }

  evalLamp(x, y, z) {
    const st = this.world.getBlock(x, y, z);
    const id = stateId(st);
    const powered = this.isPowered(x, y, z);
    if (powered && id === LAMP_OFF) {
      this.world.setBlock(x, y, z, packState(LAMP_ON, 0));
      this.markDirty(x, y, z);
    } else if (!powered && id === LAMP_ON) {
      this.world.setBlock(x, y, z, packState(LAMP_OFF, 0));
      this.markDirty(x, y, z);
    }
  }

  evalTNT(x, y, z) {
    if (this.isPowered(x, y, z)) {
      this.world.setBlock(x, y, z, 0);
      if (this.onTNTActivate) this.onTNTActivate(x + 0.5, y + 0.5, z + 0.5);
    }
  }

  // Atualiza sensor de luz diurna
  updateDaylightSensor(x, y, z, skyLight) {
    const st = this.world.getBlock(x, y, z);
    if (stateId(st) !== DAYLIGHT_SENSOR) return;
    const oldMeta = stateMeta(st);
    const newMeta = Math.floor(skyLight / 15 * 15);
    if (newMeta !== oldMeta) {
      this.world.setBlock(x, y, z, packState(DAYLIGHT_SENSOR, newMeta));
      this.markDirty(x, y, z);
    }
  }
}