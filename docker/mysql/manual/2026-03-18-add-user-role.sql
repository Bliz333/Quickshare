ALTER TABLE `user`
  ADD COLUMN `role` VARCHAR(32) NOT NULL DEFAULT 'USER' AFTER `nickname`,
  ADD KEY `idx_user_role` (`role`);
