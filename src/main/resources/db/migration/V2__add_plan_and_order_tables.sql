-- Plans (subscription packages / one-time purchases)
CREATE TABLE IF NOT EXISTS `plan` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL COMMENT 'Plan display name',
  `description` VARCHAR(512) DEFAULT NULL,
  `type` VARCHAR(32) NOT NULL COMMENT 'storage / downloads / vip',
  `value` BIGINT NOT NULL DEFAULT 0 COMMENT 'Bytes for storage, count for downloads, days for VIP',
  `price` DECIMAL(10,2) NOT NULL COMMENT 'Price in CNY',
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=active, 0=disabled',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plan_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders
CREATE TABLE IF NOT EXISTS `payment_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(64) NOT NULL COMMENT 'Internal order number',
  `user_id` BIGINT NOT NULL,
  `plan_id` BIGINT NOT NULL,
  `plan_name` VARCHAR(128) NOT NULL COMMENT 'Snapshot of plan name at purchase time',
  `plan_type` VARCHAR(32) NOT NULL,
  `plan_value` BIGINT NOT NULL DEFAULT 0,
  `amount` DECIMAL(10,2) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending / paid / expired / refunded',
  `pay_type` VARCHAR(32) DEFAULT NULL COMMENT 'alipay / wxpay / qqpay',
  `trade_no` VARCHAR(128) DEFAULT NULL COMMENT 'Epay platform trade number',
  `notify_time` DATETIME DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_order_user` (`user_id`),
  KEY `idx_order_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User quota (extends user table)
ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `storage_limit` BIGINT NOT NULL DEFAULT 1073741824 COMMENT 'Storage limit in bytes (default 1GB)';
ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `storage_used` BIGINT NOT NULL DEFAULT 0 COMMENT 'Storage used in bytes';
ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `download_limit` INT NOT NULL DEFAULT -1 COMMENT 'Download limit per month (-1=unlimited)';
ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `download_used` INT NOT NULL DEFAULT 0 COMMENT 'Downloads used this month';
ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `vip_expire_time` DATETIME DEFAULT NULL COMMENT 'VIP expiration time';
