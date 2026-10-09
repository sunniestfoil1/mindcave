// Sistema de ruído de tiros que atrai mobs — PRD 09 RF-038
import { hasLineOfSight } from '../pathfinding';

export class NoiseSystem {
  constructor() {
    this.events = []; // { x, y, z, radius, time }
  }

  emit(pos, radius) {
    this.events.push({ x: pos.x, y: pos.y, z: pos.z, radius, time: 200 });
    // Limpar eventos antigos
    if (this.events.length > 20) this.events.shift();
  }

  tick() {
    for (let i = this.events.length - 1; i >= 0; i--) {
      this.events[i].time--;
      if (this.events[i].time <= 0) this.events.splice(i, 1);
    }
  }

  // Verifica se uma posição tem ruído ativo
  getNoiseAt(pos, world) {
    for (const e of this.events) {
      const dist = Math.hypot(e.x - pos.x, e.y - pos.y, e.z - pos.z);
      if (dist <= e.radius) return { x: e.x, y: e.y, z: e.z, dist };
    }
    return null;
  }

  hasNoiseNear(pos, radius) {
    for (const e of this.events) {
      const dist = Math.hypot(e.x - pos.x, e.y - pos.y, e.z - pos.z);
      if (dist <= radius) return true;
    }
    return false;
  }
}