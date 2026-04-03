-- PROJ-23: External Webhook Tokens
-- Stores hashed tokens for external webhook integrations (Make.com, Zapier, etc.)

CREATE TABLE IF NOT EXISTS external_webhook_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on token_hash for fast lookup in webhook endpoint
CREATE INDEX idx_external_webhook_tokens_hash ON external_webhook_tokens(token_hash);

-- RLS: Each user can only see/manage their own token
ALTER TABLE external_webhook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own token"
  ON external_webhook_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own token"
  ON external_webhook_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own token"
  ON external_webhook_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own token"
  ON external_webhook_tokens FOR DELETE
  USING (auth.uid() = user_id);
