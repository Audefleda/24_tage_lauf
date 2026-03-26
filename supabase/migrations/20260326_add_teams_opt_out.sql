-- PROJ-20: Teams-Benachrichtigung Opt-out
-- Neue Spalte fuer Nutzer*innen-Praeferenz: Teams-Benachrichtigungen ein/aus

-- 1. Neue Spalte hinzufuegen (bestehende Zeilen erhalten automatisch TRUE)
alter table runner_profiles
  add column teams_notifications_enabled boolean not null default true;

-- 2. RLS UPDATE Policy: Nutzer*in darf nur eigene Benachrichtigungs-Praeferenz aendern
create policy "Own profile update notifications"
  on runner_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
