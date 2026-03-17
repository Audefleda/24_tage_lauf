-- PROJ-6: Benutzerverwaltung (Admin) - runner_profiles Tabelle
-- Verknuepft Supabase Auth User mit TYPO3 Laeufer-UID

create table if not exists runner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  typo3_uid integer not null unique,
  typo3_name text not null,
  created_at timestamptz default now()
);

-- Index auf user_id fuer schnelle Lookups (unique constraint erzeugt bereits Index)
-- Index auf typo3_uid fuer Duplikat-Checks (unique constraint erzeugt bereits Index)

-- Row Level Security aktivieren
alter table runner_profiles enable row level security;

-- Laeufer darf nur eigenes Profil lesen
create policy "Own profile read"
  on runner_profiles
  for select
  using (auth.uid() = user_id);

-- Laeufer darf eigenes Profil nicht selbst aendern (nur via Admin/Service Role)
-- Admin-Operationen laufen ueber Service Role Key, der RLS umgeht

-- created_at Index fuer sortierte Abfragen
create index idx_runner_profiles_created_at on runner_profiles (created_at desc);
