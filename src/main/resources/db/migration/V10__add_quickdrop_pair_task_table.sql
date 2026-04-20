SET @quickdrop_pair_task_table_exists := (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'quickdrop_pair_task'
);

SET @quickdrop_pair_task_table_sql := IF(
    @quickdrop_pair_task_table_exists = 0,
    'CREATE TABLE `quickdrop_pair_task` (
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
        `transfer_mode` VARCHAR(32) NOT NULL DEFAULT ''direct'',
        `current_transfer_mode` VARCHAR(32) NOT NULL DEFAULT ''direct'',
        `status` VARCHAR(32) NOT NULL DEFAULT ''sending'',
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
    )',
    'SELECT 1'
);

PREPARE quickdrop_pair_task_create_stmt FROM @quickdrop_pair_task_table_sql;
EXECUTE quickdrop_pair_task_create_stmt;
DEALLOCATE PREPARE quickdrop_pair_task_create_stmt;
