import { supabase, mindcaveApi } from '@/api/supabaseClient';

const GUEST_ID_KEY = 'mc_guest_id';
const NICKNAME_KEY = 'mc_nickname';

export function getGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id || id.startsWith('guest_')) {
    id = crypto.randomUUID?.() || ('55d44ac9-e93e-49ff-8748-' + Math.random().toString(16).slice(2, 14));
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getNickname() {
  let nick = null;
  try { nick = localStorage.getItem(NICKNAME_KEY); } catch { /* sem localStorage */ }
  if (nick) return nick;
  // um nome sorteado precisa FICAR: antes cada chamada sorteava outro (a lista de salas, o TAB e o chat mostravam nomes diferentes do mesmo jogador)
  nick = 'Player' + Math.floor(Math.random() * 9999);
  try { localStorage.setItem(NICKNAME_KEY, nick); } catch { /* sem localStorage */ }
  return nick;
}

export function setNickname(name) {
  const clean = name.trim().slice(0, 16) || 'Player';
  localStorage.setItem(NICKNAME_KEY, clean);
  const guestId = getGuestId();
  // Persiste nickname diretamente no Supabase na tabela profiles
  supabase.from('profiles').upsert({ id: guestId, full_name: clean, updated_at: new Date().toISOString() })
    .then(({ error }) => { if (error) console.warn('[Supabase Profile]', error.message); })
    .catch(() => {});
  return clean;
}

export async function resolveUser() {
  try {
    const user = await mindcaveApi.auth.me();
    if (user) return { user, isGuest: false };
  } catch {}
  const guestId = getGuestId();
  let nick = getNickname();
  try {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', guestId).maybeSingle();
    if (data?.full_name) nick = data.full_name;
  } catch {}
  return {
    user: { id: guestId, full_name: nick, email: null, isGuest: true },
    isGuest: true,
  };
}