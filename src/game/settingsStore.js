// Store central de configurações (PRD 03 §1). Fonte única de verdade.
// Escopos: dispositivo (localStorage), usuário (localStorage + nuvem), mundo (World entity).
import { useEffect, useReducer } from 'react';
import { mindcaveApi } from '@/api/supabaseClient';
import { DEFAULT_DEVICE, DEFAULT_USER, DEFAULT_WORLD_RULES, QUALITY_PROFILES, SETTINGS_VERSION } from './settingsDefaults';

const LS_DEVICE = 'mc_device_v1';
const LS_USER = 'mc_user_v1';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function getByPath(obj, path) {
  if (!path) return obj;
  if (path === 'device.renderDistance') return obj.device?.renderDistance;
  if (path === 'device.maxFps') return obj.device?.maxFps;
  if (path === 'device.brightness') return obj.device?.brightness;
  if (path === 'device.pauseRenderWhenHidden') return obj.device?.pauseRenderWhenHidden;
  if (path === 'user.fov') return obj.user?.fov;
  if (path === 'user.viewBobbing') return obj.user?.viewBobbing;
  if (path === 'user.sprintMode') return obj.user?.sprintMode;
  if (path === 'user.volumeMaster') return obj.user?.volumeMaster;
  if (path === 'user.keys') return obj.user?.keys;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((o, k) => { o[k] = o[k] || {}; return o[k]; }, obj);
  target[last] = value;
}

function merge(base, override) {
  const out = clone(base);
  for (const k of Object.keys(override)) {
    if (out[k] !== undefined && typeof out[k] === 'object' && !Array.isArray(out[k]) && typeof override[k] === 'object' && !Array.isArray(override[k])) {
      out[k] = merge(out[k], override[k]);
    } else {
      out[k] = override[k];
    }
  }
  return out;
}

class SettingsStore {
  constructor() {
    this.data = {
      version: SETTINGS_VERSION,
      device: clone(DEFAULT_DEVICE),
      user: clone(DEFAULT_USER),
    };
    this.listeners = new Set();
    this._cloudTimer = null;
    this._user = null;
    this._cloudLoading = false;
    this._loadLocal();
  }

  _loadLocal() {
    try {
      const d = localStorage.getItem(LS_DEVICE);
      if (d) this.data.device = merge(DEFAULT_DEVICE, JSON.parse(d));
      const u = localStorage.getItem(LS_USER);
      if (u) {
        const parsed = JSON.parse(u);
        this.data.user = merge(DEFAULT_USER, parsed);
        if (!this.data.user.keys) this.data.user.keys = clone(DEFAULT_USER.keys);
        else this.data.user.keys = { ...clone(DEFAULT_USER.keys), ...this.data.user.keys };
      }
    } catch (e) { console.warn('[Settings] load failed', e); }
  }

  _saveLocal() {
    try {
      localStorage.setItem(LS_DEVICE, JSON.stringify(this.data.device));
      localStorage.setItem(LS_USER, JSON.stringify(this.data.user));
    } catch (e) { /* quota */ }
  }

  async initCloud(user) {
    if (this._user && this._user.id === user?.id) return;
    this._user = user;
    if (!user) return;
    this._cloudLoading = true;
    try {
      const res = await mindcaveApi.entities.GameSettings.filter({ userId: user.id }, { limit: 1 });
      const items = res.items || res;
      if (items.length > 0) {
        const cloud = JSON.parse(items[0].data || '{}');
        this.data.user = merge(DEFAULT_USER, cloud);
        if (!this.data.user.keys) this.data.user.keys = clone(DEFAULT_USER.keys);
        else this.data.user.keys = { ...clone(DEFAULT_USER.keys), ...this.data.user.keys };
        this._saveLocal();
        this._notify();
      }
    } catch (e) { /* not logged in or network error */ }
    this._cloudLoading = false;
  }

  get(path) { return getByPath(this.data, path); }

  set(path, value) {
    setByPath(this.data, path, value);
    this._saveLocal();
    this._notify();
    if (path.startsWith('user.')) this._scheduleCloud();
  }

  _scheduleCloud() {
    if (!this._user || this._cloudLoading) return;
    clearTimeout(this._cloudTimer);
    this._cloudTimer = setTimeout(() => this._saveCloud(), 2000);
  }

  async _saveCloud() {
    if (!this._user) return;
    try {
      const data = JSON.stringify(this.data.user);
      const res = await mindcaveApi.entities.GameSettings.filter({ userId: this._user.id }, { limit: 1, fields: ['id'] });
      const items = res.items || res;
      if (items.length > 0) {
        await mindcaveApi.entities.GameSettings.update(items[0].id, { data, version: this.data.version });
      } else {
        await mindcaveApi.entities.GameSettings.create({ userId: this._user.id, data, version: this.data.version, scope: 'user' });
      }
    } catch (e) { /* silent */ }
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  _notify() { this.listeners.forEach(cb => cb()); }

  applyProfile(name) {
    const p = QUALITY_PROFILES[name];
    if (!p) return;
    for (const [k, v] of Object.entries(p)) setByPath(this.data, 'device.' + k, v);
    this._saveLocal();
    this._notify();
    this._scheduleCloud();
  }

  applyOptimized() {
    this.applyProfile('potato');
    setByPath(this.data, 'user.viewBobbing', false);
    setByPath(this.data, 'user.fovEffects', 0);
    setByPath(this.data, 'user.mouseSensitivity', 100);
    this._saveLocal();
    this._notify();
    this._scheduleCloud();
  }

  detectProfile() {
    const d = this.data.device;
    for (const [name, p] of Object.entries(QUALITY_PROFILES)) {
      if (name === 'custom') continue;
      let match = true;
      for (const [k, v] of Object.entries(p)) {
        if (d[k] !== v) { match = false; break; }
      }
      if (match) return name;
    }
    return 'custom';
  }

  exportSettings() {
    return JSON.stringify({ version: this.data.version, device: this.data.device, user: this.data.user }, null, 2);
  }

  importSettings(jsonStr, { user = true, device = true } = {}) {
    const parsed = JSON.parse(jsonStr);
    if (user && parsed.user) this.data.user = merge(DEFAULT_USER, parsed.user);
    if (device && parsed.device) this.data.device = merge(DEFAULT_DEVICE, parsed.device);
    this._saveLocal();
    this._notify();
    this._scheduleCloud();
  }

  resetScope(scope) {
    if (scope === 'device') { this.data.device = clone(DEFAULT_DEVICE); this._saveLocal(); this._notify(); }
    else if (scope === 'user') {
      this.data.user = clone(DEFAULT_USER); this._saveLocal(); this._notify(); this._scheduleCloud();
    }
  }
}

export const settingsStore = new SettingsStore();

export function useSettings() {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => settingsStore.subscribe(force), []);
  return settingsStore;
}

export { DEFAULT_WORLD_RULES };