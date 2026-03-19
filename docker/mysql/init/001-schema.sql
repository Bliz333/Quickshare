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
