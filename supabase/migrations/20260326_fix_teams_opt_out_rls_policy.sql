-- PROJ-20 BUG-1: Restrict UPDATE policy to prevent changing typo3_uid
-- The original "Own profile update notifications" policy allowed updating ANY column
-- on the user's own row. This replaces it with a more restrictive version that
-- ensures typo3_uid cannot be changed via the anon client.

drop policy "Own profile update notifications" on runner_profiles;

create policy "Own profile update notifications"
  on runner_profiles
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    AND typo3_uid = (
      SELECT typo3_uid FROM runner_profiles WHERE user_id = auth.uid()
    )
  );
