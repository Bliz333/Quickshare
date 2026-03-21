-- Raise free-tier defaults and stop exposing unlimited downloads to new users by default.
ALTER TABLE `user`
    ALTER COLUMN `storage_limit` SET DEFAULT 21474836480;

ALTER TABLE `user`
    ALTER COLUMN `download_limit` SET DEFAULT 500;

UPDATE `user`
SET `storage_limit` = 21474836480,
    `download_limit` = 500
WHERE `deleted` = 0
  AND UPPER(`role`) = 'USER'
  AND `storage_limit` = 1073741824
  AND (`vip_expire_time` IS NULL OR `vip_expire_time` < NOW())
  AND `download_limit` = -1;
