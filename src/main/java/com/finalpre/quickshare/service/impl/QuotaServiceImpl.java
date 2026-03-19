package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.QuotaService;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
public class QuotaServiceImpl implements QuotaService {

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
                long currentLimit = user.getStorageLimit() != null ? user.getStorageLimit() : 1073741824L;
                user.setStorageLimit(currentLimit + order.getPlanValue());
                log.info("Granted {} bytes storage to user {}. new limit={}",
                        order.getPlanValue(), user.getId(), user.getStorageLimit());
            }
            case "downloads" -> {
                int currentLimit = user.getDownloadLimit() != null ? user.getDownloadLimit() : -1;
                if (currentLimit == -1) {
                    user.setDownloadLimit(order.getPlanValue().intValue());
                } else {
                    user.setDownloadLimit(currentLimit + order.getPlanValue().intValue());
                }
                log.info("Granted {} downloads to user {}. new limit={}",
                        order.getPlanValue(), user.getId(), user.getDownloadLimit());
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
    public void checkStorageQuota(Long userId, long fileSizeBytes) {
        User user = userMapper.selectById(userId);
        if (user == null) return; // guest upload, no quota check
        long limit = user.getStorageLimit() != null ? user.getStorageLimit() : 1073741824L;
        long used = user.getStorageUsed() != null ? user.getStorageUsed() : 0L;
        if (limit > 0 && used + fileSizeBytes > limit) {
            throw new IllegalStateException("存储空间不足，请购买更多空间");
        }
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
        int limit = user.getDownloadLimit() != null ? user.getDownloadLimit() : -1;
        if (limit == -1) return; // unlimited
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
}
