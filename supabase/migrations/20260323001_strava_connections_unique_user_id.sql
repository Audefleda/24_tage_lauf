-- BUG-1 fix (PROJ-5): add UNIQUE constraint on user_id
-- Required for upsert onConflict:'user_id' to work correctly
ALTER TABLE strava_connections ADD CONSTRAINT strava_connections_user_id_key UNIQUE (user_id);
