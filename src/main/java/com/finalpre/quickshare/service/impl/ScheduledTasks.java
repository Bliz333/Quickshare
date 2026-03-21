package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.PaymentOrderMapper;
import com.finalpre.quickshare.mapper.UserMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
public class ScheduledTasks {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PaymentOrderMapper orderMapper;

    @Autowired
    private com.finalpre.quickshare.service.QuickDropService quickDropService;

    /**
     * Reset monthly download counters on the 1st of each month at 00:05.
     */
    @Scheduled(cron = "0 5 0 1 * *")
    public void resetMonthlyDownloads() {
        int updated = userMapper.update(null,
                new UpdateWrapper<User>()
                        .set("download_used", 0)
                        .eq("deleted", 0)
                        .gt("download_used", 0));
        log.info("Monthly download reset: {} users updated", updated);
    }

    /**
     * Expire pending orders older than 30 minutes. Runs every 10 minutes.
     */
    @Scheduled(fixedRate = 600000)
    public void expirePendingOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        int updated = orderMapper.update(null,
                new UpdateWrapper<PaymentOrder>()
                        .set("status", "expired")
                        .eq("status", "pending")
                        .lt("create_time", cutoff));
        if (updated > 0) {
            log.info("Expired {} pending orders older than 30 minutes", updated);
        }
    }

    @Scheduled(fixedRate = 3600000)
    public void cleanupExpiredQuickDropTransfers() {
        int deleted = quickDropService.cleanupExpiredTransfers();
        if (deleted > 0) {
            log.info("Cleaned up {} expired QuickDrop transfers", deleted);
        }
    }
}
