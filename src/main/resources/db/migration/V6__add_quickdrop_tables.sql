CREATE TABLE IF NOT EXISTS `quickdrop_device` (
  `device_id` VARCHAR(64) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `device_name` VARCHAR(128) NOT NULL,
  `device_type` VARCHAR(64) DEFAULT NULL,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`device_id`),
  KEY `idx_quickdrop_device_user_seen` (`user_id`, `last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quickdrop_transfer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `sender_device_id` VARCHAR(64) NOT NULL,
  `receiver_device_id` VARCHAR(64) NOT NULL,
  `transfer_key` VARCHAR(64) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `content_type` VARCHAR(255) DEFAULT NULL,
  `chunk_size` INT NOT NULL,
  `total_chunks` INT NOT NULL,
  `uploaded_chunks` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending_upload',
  `assembled_path` VARCHAR(1024) DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expire_time` DATETIME NOT NULL,
  `downloaded_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quickdrop_transfer_key` (`transfer_key`),
  KEY `idx_quickdrop_transfer_user_receiver` (`user_id`, `receiver_device_id`, `update_time`),
  KEY `idx_quickdrop_transfer_user_sender` (`user_id`, `sender_device_id`, `update_time`),
  KEY `idx_quickdrop_transfer_expire` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
