SET @quickdrop_task_table_exists := (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'quickdrop_task'
);

SET @quickdrop_task_table_sql := IF(
    @quickdrop_task_table_exists = 0,
    'CREATE TABLE `quickdrop_task` (
        `id` BIGINT NOT NULL AUTO_INCREMENT,
        `user_id` BIGINT NOT NULL,
        `task_key` VARCHAR(255) DEFAULT NULL,
        `sender_device_id` VARCHAR(64) NOT NULL,
        `receiver_device_id` VARCHAR(64) NOT NULL,
        `file_name` VARCHAR(255) NOT NULL,
        `file_size` BIGINT NOT NULL,
        `content_type` VARCHAR(255) DEFAULT NULL,
        `total_chunks` INT NOT NULL,
        `transfer_mode` VARCHAR(32) NOT NULL DEFAULT ''relay'',
        `current_transfer_mode` VARCHAR(32) NOT NULL DEFAULT ''relay'',
        `status` VARCHAR(32) NOT NULL DEFAULT ''pending_upload'',
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
    )',
    'SELECT 1'
);

PREPARE quickdrop_task_create_stmt FROM @quickdrop_task_table_sql;
EXECUTE quickdrop_task_create_stmt;
DEALLOCATE PREPARE quickdrop_task_create_stmt;

SET @quickdrop_transfer_task_id_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'quickdrop_transfer'
      AND column_name = 'task_id'
);

SET @quickdrop_transfer_task_id_sql := IF(
    @quickdrop_transfer_task_id_exists = 0,
    'ALTER TABLE `quickdrop_transfer` ADD COLUMN `task_id` BIGINT DEFAULT NULL AFTER `task_key`',
    'SELECT 1'
);

PREPARE quickdrop_transfer_add_task_id_stmt FROM @quickdrop_transfer_task_id_sql;
EXECUTE quickdrop_transfer_add_task_id_stmt;
DEALLOCATE PREPARE quickdrop_transfer_add_task_id_stmt;

SET @quickdrop_transfer_task_id_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'quickdrop_transfer'
      AND index_name = 'idx_quickdrop_transfer_task_id'
);

SET @quickdrop_transfer_task_id_index_sql := IF(
    @quickdrop_transfer_task_id_index_exists = 0,
    'CREATE INDEX `idx_quickdrop_transfer_task_id` ON `quickdrop_transfer` (`task_id`)',
    'SELECT 1'
);

PREPARE quickdrop_transfer_task_id_index_stmt FROM @quickdrop_transfer_task_id_index_sql;
EXECUTE quickdrop_transfer_task_id_index_stmt;
DEALLOCATE PREPARE quickdrop_transfer_task_id_index_stmt;
