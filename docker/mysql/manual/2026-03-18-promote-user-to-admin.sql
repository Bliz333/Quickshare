-- Replace the target user id before executing.
UPDATE `user`
SET `role` = 'ADMIN'
WHERE `id` = 1
  AND `deleted` = 0;
