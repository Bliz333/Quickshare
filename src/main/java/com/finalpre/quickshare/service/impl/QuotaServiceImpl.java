package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.QuotaService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
public class QuotaServiceImpl implements QuotaService {

    private static final long DEFAULT_STORAGE_LIMIT_BYTES = 21474836480L;
    private static final int DEFAULT_DOWNLOAD_LIMIT = 500;
    private static final int UNLIMITED_DOWNLOAD_LIMIT = -1;

    @Autowired
    private UserMapper userMapper;

    @Override
    public void grantQuota(PaymentOrder order) {
        User user = userMapper.selectById(order.getUserId());
        if (user == null) {
            log.warn("Cannot grant quota: user {} not found", order.getUserId());
            return;
        }

        switch (order.getPlanType()) {
            case "storage" -> {
                long currentLimit = user.getStorageLimit() != null ? user.getStorageLimit() : DEFAULT_STORAGE_LIMIT_BYTES;
                user.setStorageLimit(currentLimit + order.getPlanValue());
                log.info("Granted {} bytes storage to user {}. new limit={}",
                        order.getPlanValue(), user.getId(), user.getStorageLimit());
            }
            case "downloads" -> {
                int currentLimit = user.getDownloadLimit() != null ? user.getDownloadLimit() : DEFAULT_DOWNLOAD_LIMIT;
                if (currentLimit == UNLIMITED_DOWNLOAD_LIMIT) {
                    log.info("Skip granting download quota for user {} because current limit is unlimited", user.getId());
                } else {
                    user.setDownloadLimit(order.getPlanValue().intValue());
                    if (currentLimit > 0) {
                        user.setDownloadLimit(currentLimit + order.getPlanValue().intValue());
                    }
                    log.info("Granted {} downloads to user {}. new limit={}",
                            order.getPlanValue(), user.getId(), user.getDownloadLimit());
                }
            }
            case "vip" -> {
                LocalDateTime currentExpire = user.getVipExpireTime();
                LocalDateTime base = (currentExpire != null && currentExpire.isAfter(LocalDateTime.now()))
                        ? currentExpire : LocalDateTime.now();
                user.setVipExpireTime(base.plusDays(order.getPlanValue()));
                log.info("Granted {} days VIP to user {}. expires={}",
                        order.getPlanValue(), user.getId(), user.getVipExpireTime());
            }
            default -> log.warn("Unknown plan type: {}", order.getPlanType());
        }

        userMapper.updateById(user);
    }

    @Override
    public void revokeQuota(PaymentOrder order) {
        User user = userMapper.selectById(order.getUserId());
        if (user == null) {
            log.warn("Cannot revoke quota: user {} not found", order.getUserId());
            return;
        }

        long planValue = order.getPlanValue() != null ? order.getPlanValue() : 0L;
        switch (order.getPlanType()) {
            case "storage" -> {
                long currentLimit = user.getStorageLimit() != null ? user.getStorageLimit() : DEFAULT_STORAGE_LIMIT_BYTES;
                long used = user.getStorageUsed() != null ? user.getStorageUsed() : 0L;
                long minimumLimit = Math.max(DEFAULT_STORAGE_LIMIT_BYTES, used);
                user.setStorageLimit(Math.max(minimumLimit, currentLimit - planValue));
                log.info("Revoked {} bytes storage from user {}. new limit={}",
                        planValue, user.getId(), user.getStorageLimit());
            }
            case "downloads" -> {
                int currentLimit = user.getDownloadLimit() != null ? user.getDownloadLimit() : DEFAULT_DOWNLOAD_LIMIT;
                int used = user.getDownloadUsed() != null ? user.getDownloadUsed() : 0;
                if (currentLimit == UNLIMITED_DOWNLOAD_LIMIT) {
                    log.info("Skip revoking download quota for user {} because current limit is unlimited", user.getId());
                } else {
                    long adjustedLimit = Math.max(used, currentLimit - planValue);
                    user.setDownloadLimit((int) Math.max(0L, adjustedLimit));
                    log.info("Revoked {} downloads from user {}. new limit={}",
                            planValue, user.getId(), user.getDownloadLimit());
                }
            }
            case "vip" -> {
                LocalDateTime currentExpire = user.getVipExpireTime();
                if (currentExpire == null) {
                    log.info("Skip revoking VIP for user {} because no expiry was set", user.getId());
                } else {
                    LocalDateTime adjustedExpire = currentExpire.minusDays(planValue);
                    user.setVipExpireTime(adjustedExpire.isAfter(LocalDateTime.now()) ? adjustedExpire : null);
                    log.info("Revoked {} days VIP from user {}. new expiry={}",
                            planValue, user.getId(), user.getVipExpireTime());
                }
            }
            default -> log.warn("Unknown plan type for revoke: {}", order.getPlanType());
        }

        userMapper.updateById(user);
    }

    @Override
    public void checkStorageQuota(Long userId, long fileSizeBytes) {
        User user = userMapper.selectById(userId);
        if (user == null) return; // guest upload, no quota check
        long limit = user.getStorageLimit() != null ? user.getStorageLimit() : DEFAULT_STORAGE_LIMIT_BYTES;
        long used = user.getStorageUsed() != null ? user.getStorageUsed() : 0L;
        if (limit > 0 && used + fileSizeBytes > limit) {
            throw new IllegalStateException("存储空间不足，请购买更多空间");
        }
    }

    @Override
    public boolean reserveStorageQuota(Long userId, long fileSizeBytes) {
        if (userId == null) return false;
        int updated = userMapper.reserveStorageQuota(userId, fileSizeBytes, DEFAULT_STORAGE_LIMIT_BYTES);
        if (updated > 0) {
            return true;
        }
        checkStorageQuota(userId, fileSizeBytes);
        return false;
    }

    @Override
    public void recordStorageUsed(Long userId, long fileSizeBytes) {
        if (userId == null) return;
        User user = userMapper.selectById(userId);
        if (user == null) return;
        user.setStorageUsed((user.getStorageUsed() != null ? user.getStorageUsed() : 0L) + fileSizeBytes);
        userMapper.updateById(user);
    }

    @Override
    public void releaseStorage(Long userId, long fileSizeBytes) {
        if (userId == null) return;
        User user = userMapper.selectById(userId);
        if (user == null) return;
        long newUsed = (user.getStorageUsed() != null ? user.getStorageUsed() : 0L) - fileSizeBytes;
        user.setStorageUsed(Math.max(0, newUsed));
        userMapper.updateById(user);
    }

    @Override
    public void checkDownloadQuota(Long userId) {
        if (userId == null) return;
        User user = userMapper.selectById(userId);
        if (user == null) return;
        int limit = user.getDownloadLimit() != null ? user.getDownloadLimit() : DEFAULT_DOWNLOAD_LIMIT;
        if (limit == UNLIMITED_DOWNLOAD_LIMIT) return;
        int used = user.getDownloadUsed() != null ? user.getDownloadUsed() : 0;
        if (used >= limit) {
            throw new IllegalStateException("本月下载次数已用完，请购买更多次数");
        }
    }

    @Override
    public void recordDownload(Long userId) {
        if (userId == null) return;
        User user = userMapper.selectById(userId);
        if (user == null) return;
        user.setDownloadUsed((user.getDownloadUsed() != null ? user.getDownloadUsed() : 0) + 1);
        userMapper.updateById(user);
    }

    @Override
    public boolean isVip(Long userId) {
        if (userId == null) return false;
        User user = userMapper.selectById(userId);
        if (user == null) return false;
        return user.getVipExpireTime() != null && user.getVipExpireTime().isAfter(LocalDateTime.now());
    }

    @Override
    public boolean isDefaultFreeTier(Long userId) {
        if (userId == null) return false;
        User user = userMapper.selectById(userId);
        if (user == null) return false;

        boolean vipActive = user.getVipExpireTime() != null && user.getVipExpireTime().isAfter(LocalDateTime.now());
        long storageLimit = user.getStorageLimit() != null ? user.getStorageLimit() : DEFAULT_STORAGE_LIMIT_BYTES;
        int downloadLimit = user.getDownloadLimit() != null ? user.getDownloadLimit() : DEFAULT_DOWNLOAD_LIMIT;
        return !vipActive
                && storageLimit <= DEFAULT_STORAGE_LIMIT_BYTES
                && downloadLimit <= DEFAULT_DOWNLOAD_LIMIT;
    }
}
