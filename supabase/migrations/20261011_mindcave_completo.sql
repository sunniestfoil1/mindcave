-- Mind Cave: cargos, registro de mortes, estado completo do jogador e membros por mundo.
-- Aplicar no projeto do jogo (ddwdgwaliywymcatdekg): Supabase > SQL Editor > colar e executar. É idempotente.
-- O jogo funciona antes e depois de aplicar: todo acesso às novas colunas/tabelas está em try/catch.

-- 1) Cargo e estatísticas por perfil (TAB mostra [DONO] [ADMIN] [MOD] [VIP] [JOGADOR])
alter table public.profiles
  add column if not exists rank text not null default 'player' check (rank in ('owner','admin','mod','vip','player')),
  add column if not exists skin_kind text not null default 'steve' check (skin_kind in ('steve','alex','custom')),
  add column if not exists total_deaths integer not null default 0,
  add column if not exists play_seconds bigint not null default 0,
  add column if not exists last_seen_at timestamptz;

-- 2) Estado completo do jogador por mundo (além de posição/hotbar/inventário que já existem)
alter table public.players
  add column if not exists health real,
  add column if not exists hunger real,
  add column if not exists xp_level integer,
  add column if not exists is_dead boolean not null default false,
  add column if not exists spawn_x double precision,
  add column if not exists spawn_y double precision,
  add column if not exists spawn_z double precision,
  add column if not exists has_bed_spawn boolean not null default false,
  add column if not exists deaths integer not null default 0,
  add column if not exists last_death_at timestamptz;

-- 3) Registro de mortes: causa, quem matou, onde e o que foi perdido
create table if not exists public.player_deaths (
  id uuid primary key default gen_random_uuid(),
  world_id text not null,
  user_id text not null,
  player_name text not null,
  message text not null,            -- texto exibido no chat
  cause text,                       -- fall, lava, drown, attack, projectile, explosion, kill...
  killer text,                      -- nome do mob/jogador, quando houver
  x double precision, y double precision, z double precision,
  items_lost jsonb not null default '[]'::jsonb,
  xp_level integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists player_deaths_world_idx on public.player_deaths (world_id, created_at desc);
create index if not exists player_deaths_user_idx on public.player_deaths (user_id, created_at desc);

-- 4) Papéis por mundo (dono, operadores, membros)
create table if not exists public.world_members (
  world_id text not null,
  user_id text not null,
  role text not null default 'member' check (role in ('owner','op','member')),
  joined_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

-- RLS nas tabelas novas. O jogo usa chave anon com identidade de convidado (profiles.id = guest id), então a política
-- é aberta para leitura/inserção; endurecer quando o login por conta for obrigatório.
alter table public.player_deaths enable row level security;
alter table public.world_members enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='player_deaths' and policyname='player_deaths_read') then
    create policy player_deaths_read on public.player_deaths for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='player_deaths' and policyname='player_deaths_insert') then
    create policy player_deaths_insert on public.player_deaths for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='world_members' and policyname='world_members_read') then
    create policy world_members_read on public.world_members for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='world_members' and policyname='world_members_write') then
    create policy world_members_write on public.world_members for all using (true) with check (true);
  end if;
end $$;
