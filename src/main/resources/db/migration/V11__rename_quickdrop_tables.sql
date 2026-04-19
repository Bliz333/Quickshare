-- M1: Rename quickdrop_* tables to transfer_* to unify under QuickShare brand
RENAME TABLE quickdrop_device       TO transfer_device;
RENAME TABLE quickdrop_transfer     TO transfer_relay;
RENAME TABLE quickdrop_task         TO transfer_task;
RENAME TABLE quickdrop_pair_task    TO transfer_pair_task;
RENAME TABLE quickdrop_public_share TO transfer_public_share;
