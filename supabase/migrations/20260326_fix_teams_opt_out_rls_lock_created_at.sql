-- PROJ-20 BUG-3: Prevent created_at from being changed via the notifications UPDATE policy
-- runner_profiles has only: id, user_id, typo3_uid, created_at, teams_notifications_enabled
-- typo3_uid and created_at are immutable — only teams_notifications_enabled may be changed.

DROP POLICY "Own profile update notifications" ON runner_profiles;

CREATE POLICY "Own profile update notifications"
  ON runner_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND typo3_uid = (SELECT typo3_uid FROM runner_profiles WHERE user_id = auth.uid())
    AND created_at = (SELECT created_at FROM runner_profiles WHERE user_id = auth.uid())
  );
