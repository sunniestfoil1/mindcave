// Gerenciador de salas (Room entity) — PRD 15 MC15-RF-001..013
import { mindcaveApi } from '@/api/supabaseClient';
import { BUILD_VERSION } from '../constants';

const CODE_CHARS = '0123456789';
const HEARTBEAT_TIMEOUT_MS = 45_000;

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

async function hashPassword(password) {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mindcave_v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function heartbeatCutoff() {
  return new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString();
}

function pageItems(res) { return res.items || res || []; }

export const roomManager = {
  HEARTBEAT_INTERVAL: 15_000,

  async openRoom(world, settings, user) {
    const code = generateCode();
    const passwordHash = settings.password ? await hashPassword(settings.password) : '';
    const room = await mindcaveApi.entities.Room.create({
      worldId: world.id,
      worldName: world.name,
      hostId: user.id,
      hostName: user.full_name || user.email || 'Host',
      visibility: settings.visibility || 'public',
      code,
      passwordHash,
      motd: settings.motd || '',
      guestGameMode: settings.guestGameMode || world.gameMode || 'survival',
      allowCommands: settings.allowCommands ?? false,
      pvp: settings.pvp ?? true,
      maxPlayers: settings.maxPlayers || 8,
      playerCount: 1,
      playerNames: [user.full_name || user.email || 'Host'],
      buildVersion: BUILD_VERSION,
      lastHeartbeat: new Date().toISOString(),
      status: 'open',
      ops: [user.id],
      banned: '[]',
      whitelist: settings.whitelist || [],
      whitelistEnabled: settings.whitelistEnabled || false,
    });
    return room;
  },

  async closeRoom(roomId) {
    await mindcaveApi.entities.Room.update(roomId, {
      status: 'closed',
      playerCount: 0,
      playerNames: [],
    });
  },

  async heartbeat(roomId) {
    await mindcaveApi.entities.Room.update(roomId, { lastHeartbeat: new Date().toISOString() });
  },

  async updatePlayerList(roomId, playerNames) {
    await mindcaveApi.entities.Room.update(roomId, {
      playerNames,
      playerCount: playerNames.length,
      lastHeartbeat: new Date().toISOString(),
    });
  },

  async updateSettings(roomId, settings) {
    const update = {};
    for (const [k, v] of Object.entries(settings)) {
      if (k === 'password') {
        update.passwordHash = v ? await hashPassword(v) : '';
      } else {
        update[k] = v;
      }
    }
    update.lastHeartbeat = new Date().toISOString();
    await mindcaveApi.entities.Room.update(roomId, update);
  },

  async listOpenRooms() {
    const res = await mindcaveApi.entities.Room.filter({
      status: 'open',
      visibility: 'public',
      lastHeartbeat: { $gte: heartbeatCutoff() },
    }, { sort: '-lastHeartbeat', limit: 50 });
    return pageItems(res);
  },

  async findByCode(code) {
    const res = await mindcaveApi.entities.Room.filter({
      code: code.toUpperCase().trim(),
      status: 'open',
      lastHeartbeat: { $gte: heartbeatCutoff() },
    }, { limit: 1 });
    return pageItems(res)[0] || null;
  },

  async getRoom(roomId) {
    return await mindcaveApi.entities.Room.get(roomId);
  },

  async getRoomForWorld(worldId) {
    const res = await mindcaveApi.entities.Room.filter({
      worldId, status: 'open',
      lastHeartbeat: { $gte: heartbeatCutoff() },
    }, { limit: 1 });
    return pageItems(res)[0] || null;
  },

  async verifyPassword(room, password) {
    if (!room.passwordHash) return true;
    const hash = await hashPassword(password || '');
    return hash === room.passwordHash;
  },

  // Server list helpers
  getBannedList(room) {
    try { return JSON.parse(room.banned || '[]'); } catch { return []; }
  },

  async addOp(room, userId) {
    const ops = [...(room.ops || [])];
    if (!ops.includes(userId)) ops.push(userId);
    await mindcaveApi.entities.Room.update(room.id, { ops });
    return ops;
  },

  async removeOp(room, userId) {
    const ops = (room.ops || []).filter(id => id !== userId);
    await mindcaveApi.entities.Room.update(room.id, { ops });
    return ops;
  },

  async addBan(room, userId, userName, reason) {
    const banned = roomManager.getBannedList(room);
    if (!banned.find(b => b.userId === userId)) {
      banned.push({ userId, userName, reason: reason || '' });
    }
    await mindcaveApi.entities.Room.update(room.id, { banned: JSON.stringify(banned) });
    return banned;
  },

  async removeBan(room, userId) {
    const banned = roomManager.getBannedList(room).filter(b => b.userId !== userId);
    await mindcaveApi.entities.Room.update(room.id, { banned: JSON.stringify(banned) });
    return banned;
  },

  async addWhitelist(room, userId) {
    const wl = [...(room.whitelist || [])];
    if (!wl.includes(userId)) wl.push(userId);
    await mindcaveApi.entities.Room.update(room.id, { whitelist: wl });
    return wl;
  },

  async removeWhitelist(room, userId) {
    const wl = (room.whitelist || []).filter(id => id !== userId);
    await mindcaveApi.entities.Room.update(room.id, { whitelist: wl });
    return wl;
  },

  subscribeToRooms(callback) {
    return mindcaveApi.entities.Room.subscribe((event) => callback(event));
  },
};