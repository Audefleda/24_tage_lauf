-- PROJ-8: Add response_success column and rename response_text to response_message
-- The spec requires:
--   response_success: boolean (nullable) — the "success" field from TYPO3 JSON response
--   response_message: text (nullable) — only the "message" field from TYPO3 JSON response (not full JSON)

-- Add the new boolean column for the TYPO3 success field
ALTER TABLE typo3_request_log
  ADD COLUMN response_success BOOLEAN;

-- Rename response_text to response_message to match the spec
ALTER TABLE typo3_request_log
  RENAME COLUMN response_text TO response_message;
