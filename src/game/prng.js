// PRNG determinístico — java.util.Random exato (48-bit LCG com BigInt)
// MC14-RF-001: congruencial linear de 48 bits, multiplicador 0x5DEECE66D, incremento 11.
// Bit a bit igual ao Java (usa BigInt para aritmética de 48 bits sem perda).

const MASK48 = (1n << 48n) - 1n; // 0xFFFFFFFFFFFF
const MULT = 0x5DEECE66Dn;
const INC = 0xBn;

export function javaRandom(seed) {
  // Java: this.seed = (seed ^ MULT) & MASK
  const seedBig = typeof seed === 'bigint' ? seed : BigInt(seed);
  let s = (seedBig ^ MULT) & MASK48;

  function next(bits) {
    s = (s * MULT + INC) & MASK48;
    return Number(s >> (48n - BigInt(bits)));
  }

  function nextInt(bound) {
    if (bound === undefined || bound === 0) return next(31);
    bound = bound >>> 0;
    if (bound === 0) return 0;
    // Power of 2 → shift
    if ((bound & -bound) === bound) {
      return Number((BigInt(bound) * BigInt(next(31))) >> 31n);
    }
    // General case — reject biased samples (overflow check com |0 para 32-bit signed)
    let bits, val;
    do {
      bits = next(31);
      val = bits % bound;
    } while (((bits - val + (bound - 1)) | 0) < 0);
    return val;
  }

  return {
    next,
    nextInt,
    nextLong() {
      const hi = BigInt(next(32));
      const lo = BigInt(next(32));
      return (hi << 32n) | lo;
    },
    nextFloat() { return next(24) / (1 << 24); },
    nextDouble() {
      const hi = BigInt(next(26));
      const lo = BigInt(next(27));
      return Number((hi << 27n) | lo) / Number(1n << 53n);
    },
    nextBoolean() { return next(1) !== 0; },
    nextGaussian() {
      // Box-Muller (não usado na geração de mundo, mas parte da API)
      if (this._hasGaussian) { this._hasGaussian = false; return this._gaussian; }
      let v1, v2, s;
      do {
        v1 = 2 * this.nextDouble() - 1;
        v2 = 2 * this.nextDouble() - 1;
        s = v1 * v1 + v2 * v2;
      } while (s >= 1 || s === 0);
      const mult = Math.sqrt(-2 * Math.log(s) / s);
      this._hasGaussian = true;
      this._gaussian = v2 * mult;
      return v1 * mult;
    },
    seed() { return s; },
    setSeed(newSeed) { s = (BigInt(newSeed) ^ MULT) & MASK48; },
  };
}

// MC14-RF-002: seed de relevo do chunk — cx × 341873128712 + cz × 132897987541 (64-bit)
export function terrainChunkSeed(worldSeed, cx, cz) {
  const ws = typeof worldSeed === 'bigint' ? worldSeed : BigInt(worldSeed);
  return BigInt(cx) * 341873128712n + BigInt(cz) * 132897987541n + ws;
}

// MC14-RF-003: seed de decoração do chunk
// 1. init random com seed do mundo
// 2. A = (nextLong / 2) * 2 + 1, B = (nextLong / 2) * 2 + 1 (sempre ímpar)
// 3. reiniciar com (cx * A + cz * B) XOR seed do mundo
export function decorationChunkSeed(worldSeed, cx, cz) {
  const ws = typeof worldSeed === 'bigint' ? worldSeed : BigInt(worldSeed);
  const rng = javaRandom(ws);
  const a = (rng.nextLong() / 2n) * 2n + 1n;
  const b = (rng.nextLong() / 2n) * 2n + 1n;
  return (BigInt(cx) * a + BigInt(cz) * b) ^ ws;
}

// Hash de texto do Java (String.hashCode) — 32 bits
export function javaHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// MC14-RF-004: seed a partir de texto — número usa o número, texto usa hash, vazio = aleatório
export function seedFromString(s) {
  if (s == null || s.trim() === '') return Math.floor(Math.random() * 1e15);
  const n = Number(s);
  if (!Number.isNaN(n) && Number.isFinite(n)) return Math.trunc(n);
  return javaHash(s);
}

// hash determinístico de coordenadas inteiras (para uso secundário, não na geração principal)
export function hash3(x, y, z, seed) {
  let h = seed >>> 0;
  h = (Math.imul(h ^ (x | 0), 0x85ebca6b) + 0xc2b2ae35) | 0;
  h = (Math.imul(h ^ (y | 0), 0x85ebca6b) + 0xc2b2ae35) | 0;
  h = (Math.imul(h ^ (z | 0), 0x85ebca6b) + 0xc2b2ae35) | 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0x27d4eb2f) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32 — PRNG rápido para uso secundário (não usado na geração de mundo principal)
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}