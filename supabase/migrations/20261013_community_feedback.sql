-- Mind Cave: Central de Bugs e Sugestões da Comunidade
create table if not exists public.community_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  type text not null default 'bug' check (type in ('bug', 'improvement')),
  title text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  votes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_feedback_type_idx on public.community_feedback (type, created_at desc);

alter table public.community_feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='community_feedback' and policyname='feedback_read') then
    create policy feedback_read on public.community_feedback for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='community_feedback' and policyname='feedback_insert') then
    create policy feedback_insert on public.community_feedback for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='community_feedback' and policyname='feedback_update') then
    create policy feedback_update on public.community_feedback for update using (true) with check (true);
  end if;
end $$;
