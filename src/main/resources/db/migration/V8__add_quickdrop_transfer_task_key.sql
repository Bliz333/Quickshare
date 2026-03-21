ALTER TABLE `quickdrop_transfer`
    ADD COLUMN `task_key` VARCHAR(255) DEFAULT NULL AFTER `receiver_device_id`;

CREATE INDEX `idx_quickdrop_transfer_task_key`
    ON `quickdrop_transfer` (`task_key`);
