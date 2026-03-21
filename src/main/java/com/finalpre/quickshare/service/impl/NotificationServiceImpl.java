package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.entity.NotificationRecord;
import com.finalpre.quickshare.mapper.NotificationRecordMapper;
import com.finalpre.quickshare.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    @Autowired
    private NotificationRecordMapper notificationRecordMapper;

    @Override
    public void recordGlobalNotification(String subject, String body, Long senderUserId) {
        NotificationRecord record = new NotificationRecord();
        record.setScope(SCOPE_ALL);
        record.setRecipientUserId(null);
        record.setSenderUserId(senderUserId);
        record.setSubject(subject);
        record.setBody(body);
        record.setCreateTime(LocalDateTime.now());
        notificationRecordMapper.insert(record);
    }

    @Override
    public void recordPersonalNotifications(List<Long> recipientUserIds, String subject, String body, Long senderUserId) {
        if (recipientUserIds == null || recipientUserIds.isEmpty()) {
            return;
        }

        for (Long userId : new LinkedHashSet<>(recipientUserIds)) {
            if (userId == null) {
                continue;
            }
            NotificationRecord record = new NotificationRecord();
            record.setScope(SCOPE_PERSONAL);
            record.setRecipientUserId(userId);
            record.setSenderUserId(senderUserId);
            record.setSubject(subject);
            record.setBody(body);
            record.setCreateTime(LocalDateTime.now());
            notificationRecordMapper.insert(record);
        }
    }

    @Override
    public List<NotificationRecord> listGlobalNotifications(int limit) {
        return notificationRecordMapper.selectList(new QueryWrapper<NotificationRecord>()
                .eq("scope", SCOPE_ALL)
                .orderByDesc("create_time")
                .last("LIMIT " + normalizeLimit(limit)));
    }

    @Override
    public List<NotificationRecord> listPersonalNotifications(Long userId, int limit) {
        if (userId == null) {
            return List.of();
        }

        return notificationRecordMapper.selectList(new QueryWrapper<NotificationRecord>()
                .eq("scope", SCOPE_PERSONAL)
                .eq("recipient_user_id", userId)
                .orderByDesc("create_time")
                .last("LIMIT " + normalizeLimit(limit)));
    }

    private int normalizeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }
}
