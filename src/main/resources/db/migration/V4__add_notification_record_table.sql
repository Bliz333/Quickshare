CREATE TABLE IF NOT EXISTS `notification_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `scope` VARCHAR(32) NOT NULL COMMENT 'all / personal',
  `recipient_user_id` BIGINT DEFAULT NULL COMMENT 'Recipient user ID for personal notifications',
  `sender_user_id` BIGINT DEFAULT NULL COMMENT 'Admin user ID who created the notification',
  `subject` VARCHAR(255) NOT NULL COMMENT 'Notification title',
  `body` TEXT NOT NULL COMMENT 'Notification body',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_scope_time` (`scope`, `create_time`),
  KEY `idx_notification_recipient_time` (`recipient_user_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
