// Ruído Perlin 2D determinístico por seed + fractal (oitavas).
import { javaRandom } from './prng';

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + (b - a) * t; }
function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function makePerm(seed) {
  const r = javaRandom(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = r.nextInt(i + 1);
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  return p;
}

export function perlin2(seed) {
  const p = makePerm(seed);
  return (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];
    return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
  };
}

export function fractal2(seed, octaves = 4, persistence = 0.5, lacunarity = 2, scale = 0.0125) {
  const base = perlin2(seed);
  return (x, y) => {
    let amp = 1, freq = scale, sum = 0, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += base(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return sum / max; // -1..1
  };
}

// === Perlin 3D (para cavernas e densidade) ===
function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export function perlin3(seed) {
  const p = makePerm(seed);
  return (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad3(p[AA], xf, yf, zf), grad3(p[BA], xf - 1, yf, zf), u),
        lerp(grad3(p[AB], xf, yf - 1, zf), grad3(p[BB], xf - 1, yf - 1, zf), u), v),
      lerp(
        lerp(grad3(p[AA + 1], xf, yf, zf - 1), grad3(p[BA + 1], xf - 1, yf, zf - 1), u),
        lerp(grad3(p[AB + 1], xf, yf - 1, zf - 1), grad3(p[BB + 1], xf - 1, yf - 1, zf - 1), u), v),
      w);
  };
}

export function fractal3(seed, octaves = 4, persistence = 0.5, lacunarity = 2, scale = 0.05) {
  const base = perlin3(seed);
  return (x, y, z) => {
    let amp = 1, freq = scale, sum = 0, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += base(x * freq, y * freq, z * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return sum / max;
  };
}