-- =============================================================
-- Synapse — full Supabase schema
--   Run this once in the Supabase SQL editor (or `supabase db push`).
--   Includes: tables, indexes, Row Level Security, helper RPCs,
--             and a `match_chunks()` similarity-search function.
-- =============================================================

-- ---------------- Extensions ----------------
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------- Enums ---------------------
do $$ begin
  create type notebook_role  as enum ('viewer', 'editor', 'admin');
  create type source_kind    as enum ('pdf', 'docx', 'txt', 'url', 'youtube', 'rss');
  create type source_status  as enum ('pending', 'processing', 'ready', 'error');
  create type message_role   as enum ('user', 'assistant', 'system');
  create type note_kind      as enum ('summary', 'outline', 'eli5', 'exam', 'research', 'insight');
  create type agent_status   as enum ('idle', 'running', 'error');
exception when duplicate_object then null; end $$;

-- ---------------- Profiles ------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is inserted.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, display_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------- Notebooks -----------------
create table if not exists notebooks (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  emoji       text default '📓',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notebooks_owner_idx on notebooks(owner_id);

create table if not exists notebook_members (
  notebook_id uuid not null references notebooks(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        notebook_role not null default 'viewer',
  invited_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  primary key (notebook_id, user_id)
);
create index if not exists nm_user_idx on notebook_members(user_id);

-- Helper: current user's role on a notebook (or null).
create or replace function notebook_role_for(target uuid, uid uuid)
returns notebook_role language sql stable security definer as $$
  select case
    when n.owner_id = uid then 'admin'::notebook_role
    else m.role
  end
  from notebooks n
  left join notebook_members m
    on m.notebook_id = n.id and m.user_id = uid
  where n.id = target;
$$;

-- ---------------- Sources -------------------
create table if not exists sources (
  id          uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  kind        source_kind not null,
  title       text not null,
  url         text,                  -- original URL (for url/youtube/rss)
  storage_path text,                 -- supabase storage key (for uploads)
  status      source_status not null default 'pending',
  error       text,
  metadata    jsonb not null default '{}'::jsonb,
  refresh_interval_minutes int,      -- null = no auto-sync
  last_synced_at timestamptz,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sources_notebook_idx on sources(notebook_id);
create index if not exists sources_status_idx on sources(status);

-- ---------------- Chunks (vectors) ----------
-- Dimension matches `EMBEDDINGS_DIMENSIONS` in .env (default 1536 for text-embedding-3-small).
create table if not exists chunks (
  id          uuid primary key default uuid_generate_v4(),
  source_id   uuid not null references sources(id) on delete cascade,
  notebook_id uuid not null references notebooks(id) on delete cascade,
  ord         int  not null,         -- position in source
  content     text not null,
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists chunks_source_idx on chunks(source_id);
create index if not exists chunks_notebook_idx on chunks(notebook_id);
-- IVFFlat index — re-create with higher `lists` once you have many rows.
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity-search RPC. Optionally restrict to a single notebook;
-- pass null to query across every notebook the user can read.
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  filter_notebook uuid default null
)
returns table (
  id           uuid,
  source_id    uuid,
  notebook_id  uuid,
  content      text,
  ord          int,
  metadata     jsonb,
  similarity   float
)
language sql stable as $$
  select
    c.id, c.source_id, c.notebook_id, c.content, c.ord, c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.embedding is not null
    and (filter_notebook is null or c.notebook_id = filter_notebook)
    and exists (
      select 1
      from notebooks n
      where n.id = c.notebook_id
        and (n.owner_id = auth.uid()
             or exists (select 1 from notebook_members m
                        where m.notebook_id = n.id and m.user_id = auth.uid()))
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------- Messages (chat) -----------
create table if not exists messages (
  id          uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  user_id     uuid references profiles(id),
  role        message_role not null,
  content     text not null,
  citations   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists messages_notebook_idx on messages(notebook_id, created_at);

-- ---------------- Notes ---------------------
create table if not exists notes (
  id          uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  source_id   uuid references sources(id) on delete cascade,
  kind        note_kind not null,
  title       text,
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists notes_notebook_idx on notes(notebook_id);

-- ---------------- Comments ------------------
create table if not exists comments (
  id          uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  parent_id   uuid references comments(id) on delete cascade,
  -- exactly one of these will be set
  chunk_id    uuid references chunks(id) on delete cascade,
  note_id     uuid references notes(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_notebook_idx on comments(notebook_id);

-- ---------------- Agents --------------------
create table if not exists agents (
  id            uuid primary key default uuid_generate_v4(),
  notebook_id   uuid not null references notebooks(id) on delete cascade,
  name          text not null,
  instructions  text not null,                 -- e.g. "Track AI news, summarise daily"
  schedule_cron text,                          -- standard cron (null = manual)
  status        agent_status not null default 'idle',
  last_run_at   timestamptz,
  last_error    text,
  config        jsonb not null default '{}'::jsonb,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists agents_notebook_idx on agents(notebook_id);

-- ---------------- Notifications -------------
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  notebook_id uuid references notebooks(id) on delete cascade,
  kind        text not null,                   -- 'agent_done' | 'new_insight' | 'mention' | ...
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

-- ===============================================================
-- Row Level Security
-- ===============================================================
alter table profiles            enable row level security;
alter table notebooks           enable row level security;
alter table notebook_members    enable row level security;
alter table sources             enable row level security;
alter table chunks              enable row level security;
alter table messages            enable row level security;
alter table notes               enable row level security;
alter table comments            enable row level security;
alter table agents              enable row level security;
alter table notifications       enable row level security;

-- profiles: a user can read their own row, admins can read everyone they share a notebook with
drop policy if exists "profiles read self" on profiles;
create policy "profiles read self" on profiles
  for select using (id = auth.uid()
                    or exists (select 1 from notebook_members m1, notebook_members m2
                               where m1.user_id = auth.uid()
                                 and m2.user_id = profiles.id
                                 and m1.notebook_id = m2.notebook_id));

drop policy if exists "profiles update self" on profiles;
create policy "profiles update self" on profiles
  for update using (id = auth.uid());

-- notebooks: read if owner or member; write if owner or admin member
drop policy if exists "notebooks read" on notebooks;
create policy "notebooks read" on notebooks
  for select using (owner_id = auth.uid()
                    or exists (select 1 from notebook_members m
                               where m.notebook_id = notebooks.id and m.user_id = auth.uid()));

drop policy if exists "notebooks insert" on notebooks;
create policy "notebooks insert" on notebooks
  for insert with check (owner_id = auth.uid());

drop policy if exists "notebooks update" on notebooks;
create policy "notebooks update" on notebooks
  for update using (owner_id = auth.uid()
                    or exists (select 1 from notebook_members m
                               where m.notebook_id = notebooks.id
                                 and m.user_id = auth.uid()
                                 and m.role in ('admin')));

drop policy if exists "notebooks delete" on notebooks;
create policy "notebooks delete" on notebooks
  for delete using (owner_id = auth.uid());

-- notebook_members
drop policy if exists "members read" on notebook_members;
create policy "members read" on notebook_members
  for select using (user_id = auth.uid()
                    or exists (select 1 from notebooks n where n.id = notebook_id and n.owner_id = auth.uid()));

drop policy if exists "members write" on notebook_members;
create policy "members write" on notebook_members
  for all using (exists (select 1 from notebooks n where n.id = notebook_id and n.owner_id = auth.uid())
                 or notebook_role_for(notebook_id, auth.uid()) = 'admin')
         with check (exists (select 1 from notebooks n where n.id = notebook_id and n.owner_id = auth.uid())
                     or notebook_role_for(notebook_id, auth.uid()) = 'admin');

-- sources / chunks / messages / notes / comments / agents / notifications all share the
-- "user has access to the notebook" pattern. We DRY it via the helper function.
do $$ declare t text;
begin
  for t in select unnest(array['sources','chunks','messages','notes','comments','agents'])
  loop
    execute format('drop policy if exists "%s read" on %s;', t, t);
    execute format($p$create policy "%s read" on %s for select
                       using (notebook_role_for(notebook_id, auth.uid()) is not null);$p$, t, t);

    execute format('drop policy if exists "%s write" on %s;', t, t);
    execute format($p$create policy "%s write" on %s for all
                       using (notebook_role_for(notebook_id, auth.uid()) in ('editor','admin'))
                       with check (notebook_role_for(notebook_id, auth.uid()) in ('editor','admin'));$p$, t, t);
  end loop;
end $$;

-- notifications: only the addressee can see them
drop policy if exists "notifications self" on notifications;
create policy "notifications self" on notifications
  for select using (user_id = auth.uid());

-- The service role (used by /api/* routes) bypasses RLS, so server-side ingestion still works.
-- Browser-side queries are constrained by the policies above.

-- ---------------- updated_at triggers -------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_notebooks_updated on notebooks;
create trigger trg_notebooks_updated before update on notebooks
  for each row execute procedure set_updated_at();

drop trigger if exists trg_sources_updated on sources;
create trigger trg_sources_updated before update on sources
  for each row execute procedure set_updated_at();

-- ---------------- Realtime ------------------
-- Broadcast inserts/updates so collaborators see new messages, notes, members, etc. live.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table sources;
alter publication supabase_realtime add table notebook_members;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table notifications;
