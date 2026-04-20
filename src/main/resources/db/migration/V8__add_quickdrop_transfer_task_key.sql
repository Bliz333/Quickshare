SET @task_key_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'quickdrop_transfer'
      AND column_name = 'task_key'
);

SET @task_key_column_sql := IF(
    @task_key_column_exists = 0,
    'ALTER TABLE `quickdrop_transfer` ADD COLUMN `task_key` VARCHAR(255) DEFAULT NULL AFTER `receiver_device_id`',
    'SELECT 1'
);

PREPARE quickdrop_transfer_add_task_key_stmt FROM @task_key_column_sql;
EXECUTE quickdrop_transfer_add_task_key_stmt;
DEALLOCATE PREPARE quickdrop_transfer_add_task_key_stmt;

SET @task_key_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'quickdrop_transfer'
      AND index_name = 'idx_quickdrop_transfer_task_key'
);

SET @task_key_index_sql := IF(
    @task_key_index_exists = 0,
    'CREATE INDEX `idx_quickdrop_transfer_task_key` ON `quickdrop_transfer` (`task_key`)',
    'SELECT 1'
);

PREPARE quickdrop_transfer_add_task_key_index_stmt FROM @task_key_index_sql;
EXECUTE quickdrop_transfer_add_task_key_index_stmt;
DEALLOCATE PREPARE quickdrop_transfer_add_task_key_index_stmt;
