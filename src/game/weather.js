// Clima: chuva, neve, tempestade, raios — PRD 05 RF-080..083
import * as THREE from 'three';
import { Precipitation } from './precipitation';
import { mulberry32, hash3 } from './prng';
import { getBiome } from './biomes';

const RAIN_CLEAR_MIN = 12000, RAIN_CLEAR_MAX = 168000;
const RAIN_DURATION_MIN = 12000, RAIN_DURATION_MAX = 24000;
const LIGHTNING_CHANCE = 1 / 100000;

export class WeatherSystem {
  constructor(scene, seed, initialState) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.raining = false;
    this.thundering = false;
    // Minecraft 1.8.9 WorldInfo: tempo inicial sem chuva = 168000 ticks (~7 dias de jogo limpos)
    this.rainTime = 168000;
    this.thunderTime = 168000;
    this.lightningFlash = 0;
    this.lightningPos = null;
    this._rng = mulberry32(seed ^ 0x9e3779);
    if (initialState) this.loadState(initialState);
    this.createRainParticles();
  }

  loadState(s) {
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = {}; } }
    this.raining = !!s.raining;
    this.thundering = !!s.thundering;
    this.rainTime = s.rainTime || 0;
    this.thunderTime = s.thunderTime || 0;
  }

  serialize() {
    return JSON.stringify({
      raining: this.raining, thundering: this.thundering,
      rainTime: this.rainTime, thunderTime: this.thunderTime,
    });
  }

  // Chuva/neve instanciadas, em cores neutras (PRD 23 RF-022)
  createRainParticles() {
    this.precip = new Precipitation(this.scene, this.seed);
  }

  tick(worldTime, player, world, gameRules) {
    if (gameRules.doWeatherCycle === false) {
      this.raining = false;
      this.thundering = false;
      return;
    }

    if (this.rainTime > 0) this.rainTime--;
    else {
      this.raining = !this.raining;
      this.rainTime = this.raining
        ? RAIN_DURATION_MIN + Math.floor(this._rng() * (RAIN_DURATION_MAX - RAIN_DURATION_MIN))
        : RAIN_CLEAR_MIN + Math.floor(this._rng() * (RAIN_CLEAR_MAX - RAIN_CLEAR_MIN));
    }

    if (this.thunderTime > 0) this.thunderTime--;
    else {
      this.thundering = !this.thundering;
      this.thunderTime = this.thundering
        ? RAIN_DURATION_MIN + Math.floor(this._rng() * (RAIN_DURATION_MAX - RAIN_DURATION_MIN))
        : RAIN_CLEAR_MIN + Math.floor(this._rng() * (RAIN_CLEAR_MAX - RAIN_CLEAR_MIN));
    }

    const effectiveThunder = this.thundering && this.raining;

    if (effectiveThunder && world.chunks.size > 0) {
      for (const chunk of world.chunks.values()) {
        if (this._rng() < LIGHTNING_CHANCE) {
          const lx = chunk.baseX + Math.floor(this._rng() * 16);
          const lz = chunk.baseZ + Math.floor(this._rng() * 16);
          let ly = 255;
          for (let y = 255; y >= 0; y--) {
            const s = world.getBlock(lx, y, lz);
            if (s !== 0) { ly = y; break; }
          }
          this.strikeLightning(lx, ly, lz, player);
          break;
        }
      }
    }

    if (this.lightningFlash > 0) this.lightningFlash--;
  }

  strikeLightning(x, y, z, player) {
    this.lightningFlash = 5;
    this.lightningPos = { x, y, z };
    if (player) {
      const dx = player.pos.x - x, dy = player.pos.y - y, dz = player.pos.z - z;
      if (dx * dx + dy * dy + dz * dz < 9) player._lightningHit = true;
    }
  }

  isRaining() { return this.raining; }
  isThundering() { return this.thundering && this.raining; }

  getSkyDarkness() {
    if (!this.raining) return 0;
    return this.thundering ? 5 : 3;
  }

  isRainingAt(x, z, world) {
    if (!this.raining) return false;
    const biome = world.getBiomeAt ? world.getBiomeAt(x, z) : getBiome(3);
    if (!biome) return false;
    if (biome.hum !== undefined && biome.hum <= 0.0) return false;
    if (biome.temp !== undefined && biome.temp >= 1.0) return false;
    return true;
  }

  isSnowingAt(x, z, world, y = 64) {
    if (!this.raining) return false;
    if (!this.isRainingAt(x, z, world)) return false;
    const biome = world.getBiomeAt ? world.getBiomeAt(x, z) : getBiome(3);
    if (!biome) return false;
    let temp = biome.temp ?? 0.5;
    if (y > 64) temp -= (y - 64) * 0.001666;
    return temp < 0.15;
  }

  updateVisuals(camera, world) {
    const px = camera.position.x, py = camera.position.y, pz = camera.position.z;
    const isRain = this.isRainingAt(px, pz, world);
    const isSnow = this.isSnowingAt(px, pz, world, Math.floor(py));

    this.precip.update(px, py, pz, isRain && !isSnow ? 1 : (isSnow ? 2 : 0));
  }

  extinguishExposed(world, player) {
    if (!this.raining) return;
    if (player.fireTicks > 0) {
      const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
      if (this.isRainingAt(px, pz, world)) player.fireTicks = 0;
    }
  }

  dispose() {
    this.precip.dispose();
  }
}