-- PROJ-8: TYPO3 Request Log
-- Append-only log table for all TYPO3 updateruns requests.
-- INSERT via service role (server-side), SELECT only for admins.
-- No UPDATE or DELETE allowed.

CREATE TABLE typo3_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typo3_runner_uid INTEGER NOT NULL,
  run_date DATE NOT NULL,
  run_distance_km NUMERIC(8,3) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_status INTEGER,
  response_text TEXT
);

-- Enable Row Level Security
ALTER TABLE typo3_request_log ENABLE ROW LEVEL SECURITY;

-- Admin can read all log entries
-- Checks app_metadata.role = 'admin' (set via Supabase auth.admin.updateUserById)
CREATE POLICY "Admins can read request logs"
  ON typo3_request_log
  FOR SELECT
  USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

-- No INSERT policy for anon/authenticated — inserts happen via service role
-- which bypasses RLS. This ensures only server-side code can write logs.

-- No UPDATE or DELETE policies — table is append-only

-- Performance indexes
CREATE INDEX idx_typo3_request_log_sent_at
  ON typo3_request_log (sent_at DESC);

CREATE INDEX idx_typo3_request_log_runner_uid
  ON typo3_request_log (typo3_runner_uid);
