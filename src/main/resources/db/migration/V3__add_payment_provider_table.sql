-- Payment providers (supports multiple epay merchants)
CREATE TABLE IF NOT EXISTS `payment_provider` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL COMMENT 'Display name (e.g. Futoon Pay)',
  `api_url` VARCHAR(512) NOT NULL COMMENT 'Epay API base URL',
  `pid` VARCHAR(64) NOT NULL COMMENT 'Merchant ID',
  `merchant_key` VARCHAR(512) NOT NULL COMMENT 'Merchant secret key',
  `pay_types` VARCHAR(256) NOT NULL DEFAULT 'alipay,wxpay' COMMENT 'Supported payment types',
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add provider_id to payment_order (safe: procedure pattern)
DROP PROCEDURE IF EXISTS add_provider_id_column;
DELIMITER //
CREATE PROCEDURE add_provider_id_column()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_order' AND COLUMN_NAME='provider_id') THEN
        ALTER TABLE `payment_order` ADD COLUMN `provider_id` BIGINT DEFAULT NULL COMMENT 'Payment provider ID' AFTER `status`;
    END IF;
END //
DELIMITER ;
CALL add_provider_id_column();
DROP PROCEDURE IF EXISTS add_provider_id_column;
