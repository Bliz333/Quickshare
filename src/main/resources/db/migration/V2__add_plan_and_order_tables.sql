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

-- User quota columns (safe: procedure drops itself after use)
DROP PROCEDURE IF EXISTS add_user_quota_columns;
DELIMITER //
CREATE PROCEDURE add_user_quota_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='storage_limit') THEN
        ALTER TABLE `user` ADD COLUMN `storage_limit` BIGINT NOT NULL DEFAULT 1073741824 COMMENT 'Storage limit in bytes (default 1GB)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='storage_used') THEN
        ALTER TABLE `user` ADD COLUMN `storage_used` BIGINT NOT NULL DEFAULT 0 COMMENT 'Storage used in bytes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='download_limit') THEN
        ALTER TABLE `user` ADD COLUMN `download_limit` INT NOT NULL DEFAULT -1 COMMENT 'Download limit per month (-1=unlimited)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='download_used') THEN
        ALTER TABLE `user` ADD COLUMN `download_used` INT NOT NULL DEFAULT 0 COMMENT 'Downloads used this month';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='vip_expire_time') THEN
        ALTER TABLE `user` ADD COLUMN `vip_expire_time` DATETIME DEFAULT NULL COMMENT 'VIP expiration time';
    END IF;
END //
DELIMITER ;
CALL add_user_quota_columns();
DROP PROCEDURE IF EXISTS add_user_quota_columns;
