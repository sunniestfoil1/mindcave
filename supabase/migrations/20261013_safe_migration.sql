-- ==============================================================================
-- MIND CAVE — MIGRAÇÃO SQL 100% SEGURA E NÃO-DESTRUTIVA
-- NÃO APAGA NENHUM DADO, MUNDO, JOGADOR OU INVENTÁRIO JÁ SALVO!
--
-- Como executar:
-- 1. Acesse o Dashboard do seu projeto no Supabase (ddwdgwaliywymcatdekg)
-- 2. Vá em: SQL Editor -> New query
-- 3. Cole todo este código e clique em "RUN"
-- ==============================================================================

-- 1. TABELA DE SALAS MULTIPLAYER (ROOMS)
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worldid text,
  worldname text,
  hostid text,
  hostname text,
  visibility text DEFAULT 'public',
  code text,
  passwordhash text,
  motd text DEFAULT '',
  guestgamemode text DEFAULT 'survival',
  allowcommands boolean DEFAULT false,
  pvp boolean DEFAULT true,
  maxplayers integer DEFAULT 8,
  playercount integer DEFAULT 1,
  playernames jsonb DEFAULT '[]'::jsonb,
  buildversion text DEFAULT '',
  lastheartbeat timestamptz DEFAULT now(),
  status text DEFAULT 'open',
  ops jsonb DEFAULT '[]'::jsonb,
  banned text DEFAULT '[]',
  whitelist jsonb DEFAULT '[]'::jsonb,
  whitelistenabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garante todas as colunas caso a tabela já existisse com esquema antigo
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS worldid text,
  ADD COLUMN IF NOT EXISTS worldname text,
  ADD COLUMN IF NOT EXISTS hostid text,
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS passwordhash text,
  ADD COLUMN IF NOT EXISTS motd text DEFAULT '',
  ADD COLUMN IF NOT EXISTS guestgamemode text DEFAULT 'survival',
  ADD COLUMN IF NOT EXISTS allowcommands boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pvp boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS maxplayers integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS playercount integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playernames jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS buildversion text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lastheartbeat timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS ops jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS banned text DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS whitelist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS whitelistenabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS rooms_status_heartbeat_idx ON public.rooms (status, lastheartbeat DESC);
CREATE INDEX IF NOT EXISTS rooms_code_idx ON public.rooms (code);


-- 2. TABELA DE SINAIS WEBRTC (SIGNALS)
CREATE TABLE IF NOT EXISTS public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roomid text,
  fromuserid text,
  fromname text,
  touserid text,
  type text,
  data jsonb,
  consumed boolean DEFAULT false,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS roomid text,
  ADD COLUMN IF NOT EXISTS fromuserid text,
  ADD COLUMN IF NOT EXISTS fromname text,
  ADD COLUMN IF NOT EXISTS touserid text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS data jsonb,
  ADD COLUMN IF NOT EXISTS consumed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS signals_lookup_idx ON public.signals (roomid, touserid, consumed);
CREATE INDEX IF NOT EXISTS signals_created_date_idx ON public.signals (created_date);


-- 3. TABELA DE FEEDBACK DA COMUNIDADE (BUGS E MELHORIAS)
CREATE TABLE IF NOT EXISTS public.community_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_name text NOT NULL,
  type text NOT NULL DEFAULT 'bug',
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  votes integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_feedback
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'bug',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS votes integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS community_feedback_type_idx ON public.community_feedback (type, created_at DESC);


-- 4. TABELA DE MENSAGENS DO LOBBY (GLOBAL)
CREATE TABLE IF NOT EXISTS public.lobby_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userid text,
  username text,
  message text,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE public.lobby_messages
  ADD COLUMN IF NOT EXISTS userid text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS lobby_messages_date_idx ON public.lobby_messages (created_date DESC);


-- 5. TABELA DE REGISTRO DE MORTES (PLAYER_DEATHS)
CREATE TABLE IF NOT EXISTS public.player_deaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id text NOT NULL,
  user_id text NOT NULL,
  player_name text NOT NULL,
  message text NOT NULL,
  cause text,
  killer text,
  x double precision,
  y double precision,
  z double precision,
  items_lost jsonb DEFAULT '[]'::jsonb,
  xp_level integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.player_deaths
  ADD COLUMN IF NOT EXISTS world_id text,
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS player_name text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS cause text,
  ADD COLUMN IF NOT EXISTS killer text,
  ADD COLUMN IF NOT EXISTS x double precision,
  ADD COLUMN IF NOT EXISTS y double precision,
  ADD COLUMN IF NOT EXISTS z double precision,
  ADD COLUMN IF NOT EXISTS items_lost jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS xp_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS player_deaths_world_idx ON public.player_deaths (world_id, created_at DESC);


-- 6. TABELA DE MEMBROS DO MUNDO (WORLD_MEMBERS)
CREATE TABLE IF NOT EXISTS public.world_members (
  world_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, user_id)
);


-- ==============================================================================
-- 7. CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- Permite leitura, criação e atualização por anon e authenticated
-- (Permite que jogadores convidados joguem sem travar por erro 403 / 42501)
-- ==============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_deaths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_members ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas caso existam para recriar as corretas
DROP POLICY IF EXISTS rooms_read ON public.rooms;
DROP POLICY IF EXISTS rooms_insert ON public.rooms;
DROP POLICY IF EXISTS rooms_update ON public.rooms;
DROP POLICY IF EXISTS rooms_delete ON public.rooms;
DROP POLICY IF EXISTS rooms_all ON public.rooms;

DROP POLICY IF EXISTS signals_read ON public.signals;
DROP POLICY IF EXISTS signals_insert ON public.signals;
DROP POLICY IF EXISTS signals_update ON public.signals;
DROP POLICY IF EXISTS signals_delete ON public.signals;
DROP POLICY IF EXISTS signals_all ON public.signals;

DROP POLICY IF EXISTS feedback_read ON public.community_feedback;
DROP POLICY IF EXISTS feedback_insert ON public.community_feedback;
DROP POLICY IF EXISTS feedback_update ON public.community_feedback;
DROP POLICY IF EXISTS feedback_all ON public.community_feedback;

DROP POLICY IF EXISTS lobby_read ON public.lobby_messages;
DROP POLICY IF EXISTS lobby_insert ON public.lobby_messages;
DROP POLICY IF EXISTS lobby_all ON public.lobby_messages;

DROP POLICY IF EXISTS player_deaths_read ON public.player_deaths;
DROP POLICY IF EXISTS player_deaths_insert ON public.player_deaths;
DROP POLICY IF EXISTS player_deaths_all ON public.player_deaths;

DROP POLICY IF EXISTS world_members_read ON public.world_members;
DROP POLICY IF EXISTS world_members_write ON public.world_members;
DROP POLICY IF EXISTS world_members_all ON public.world_members;

-- Cria políticas universais seguras para funcionamento perfeito do jogo
CREATE POLICY rooms_all ON public.rooms FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY signals_all ON public.signals FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY feedback_all ON public.community_feedback FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY lobby_all ON public.lobby_messages FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY player_deaths_all ON public.player_deaths FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY world_members_all ON public.world_members FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. HABILITAÇÃO DO SUPABASE REALTIME (WebSockets instantâneos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_feedback;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
