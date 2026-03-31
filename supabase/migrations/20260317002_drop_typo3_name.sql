-- Remove typo3_name from runner_profiles — name is always loaded live from TYPO3
ALTER TABLE runner_profiles DROP COLUMN IF EXISTS typo3_name;
