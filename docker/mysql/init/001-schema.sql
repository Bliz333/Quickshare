CREATE TABLE IF NOT EXISTS `user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `email` VARCHAR(128) DEFAULT NULL,
  `nickname` VARCHAR(64) DEFAULT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'USER',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`),
  KEY `idx_user_email` (`email`),
  KEY `idx_user_role` (`role`),
  KEY `idx_user_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `file_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(1024) DEFAULT NULL,
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `file_type` VARCHAR(255) DEFAULT NULL,
  `md5` VARCHAR(32) DEFAULT NULL,
  `upload_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted` TINYINT NOT NULL DEFAULT 0,
  `is_folder` TINYINT NOT NULL DEFAULT 0,
  `parent_id` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_file_user_parent_deleted` (`user_id`, `parent_id`, `deleted`),
  KEY `idx_file_parent` (`parent_id`),
  KEY `idx_file_md5` (`md5`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `share_link` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `file_id` BIGINT NOT NULL,
  `share_code` VARCHAR(64) NOT NULL,
  `extract_code` VARCHAR(32) NOT NULL,
  `expire_time` DATETIME DEFAULT NULL,
  `download_count` INT NOT NULL DEFAULT 0,
  `max_download` INT NOT NULL DEFAULT -1,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_share_link_share_code` (`share_code`),
  KEY `idx_share_link_file_id` (`file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_setting` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `config_key` VARCHAR(128) NOT NULL,
  `config_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_setting_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `scope` VARCHAR(32) NOT NULL,
  `recipient_user_id` BIGINT DEFAULT NULL,
  `sender_user_id` BIGINT DEFAULT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_scope_time` (`scope`, `create_time`),
  KEY `idx_notification_recipient_time` (`recipient_user_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `task_key` VARCHAR(255) DEFAULT NULL,
  `task_id` BIGINT DEFAULT NULL,
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
  KEY `idx_quickdrop_transfer_task_key` (`task_key`),
  KEY `idx_quickdrop_transfer_task_id` (`task_id`),
  KEY `idx_quickdrop_transfer_user_receiver` (`user_id`, `receiver_device_id`, `update_time`),
  KEY `idx_quickdrop_transfer_user_sender` (`user_id`, `sender_device_id`, `update_time`),
  KEY `idx_quickdrop_transfer_expire` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quickdrop_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `task_key` VARCHAR(255) DEFAULT NULL,
  `sender_device_id` VARCHAR(64) NOT NULL,
  `receiver_device_id` VARCHAR(64) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `content_type` VARCHAR(255) DEFAULT NULL,
  `total_chunks` INT NOT NULL,
  `transfer_mode` VARCHAR(32) NOT NULL DEFAULT 'relay',
  `current_transfer_mode` VARCHAR(32) NOT NULL DEFAULT 'relay',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending_upload',
  `completed_chunks` INT NOT NULL DEFAULT 0,
  `attempts_json` LONGTEXT DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expire_time` DATETIME NOT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `saved_to_netdisk_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_quickdrop_task_user_task_key` (`user_id`, `task_key`),
  KEY `idx_quickdrop_task_user_sender` (`user_id`, `sender_device_id`, `update_time`),
  KEY `idx_quickdrop_task_user_receiver` (`user_id`, `receiver_device_id`, `update_time`),
  KEY `idx_quickdrop_task_expire` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quickdrop_pair_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `pair_session_id` VARCHAR(64) NOT NULL,
  `task_key` VARCHAR(255) DEFAULT NULL,
  `left_channel_id` VARCHAR(64) NOT NULL,
  `right_channel_id` VARCHAR(64) NOT NULL,
  `left_label` VARCHAR(128) DEFAULT NULL,
  `right_label` VARCHAR(128) DEFAULT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `content_type` VARCHAR(255) DEFAULT NULL,
  `total_chunks` INT NOT NULL,
  `transfer_mode` VARCHAR(32) NOT NULL DEFAULT 'direct',
  `current_transfer_mode` VARCHAR(32) NOT NULL DEFAULT 'direct',
  `status` VARCHAR(32) NOT NULL DEFAULT 'sending',
  `completed_chunks` INT NOT NULL DEFAULT 0,
  `attempts_json` LONGTEXT DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expire_time` DATETIME NOT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `saved_to_netdisk_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_quickdrop_pair_task_session` (`pair_session_id`, `update_time`),
  KEY `idx_quickdrop_pair_task_task_key` (`task_key`),
  KEY `idx_quickdrop_pair_task_expire` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quickdrop_public_share` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `share_token` VARCHAR(64) NOT NULL,
  `uploader_user_id` BIGINT DEFAULT NULL,
  `sender_label` VARCHAR(128) NOT NULL,
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
  UNIQUE KEY `uk_quickdrop_public_share_token` (`share_token`),
  KEY `idx_quickdrop_public_share_expire` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
