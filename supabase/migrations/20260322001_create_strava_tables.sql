-- PROJ-5: Strava-Webhook-Integration
-- Creates strava_connections (per-user OAuth tokens) and app_settings (global config)

-- strava_connections: stores one row per user who connected Strava
CREATE TABLE strava_connections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id       bigint      NOT NULL UNIQUE,
  access_token     text        NOT NULL,
  refresh_token    text        NOT NULL,
  token_expires_at timestamptz NOT NULL,
  last_synced_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;

-- Users can only access their own connection
CREATE POLICY "Users can view own strava connection"
  ON strava_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own strava connection"
  ON strava_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own strava connection"
  ON strava_connections FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own strava connection"
  ON strava_connections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- app_settings: global key-value store for app-level config (e.g. strava subscription_id)
-- No public RLS policies — only accessible via service role (createAdminClient)
CREATE TABLE app_settings (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role bypasses RLS, no user access needed
