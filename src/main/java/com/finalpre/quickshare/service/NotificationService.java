package com.finalpre.quickshare.service;

import com.finalpre.quickshare.entity.NotificationRecord;

import java.util.List;

public interface NotificationService {

    String SCOPE_ALL = "all";
    String SCOPE_PERSONAL = "personal";

    void recordGlobalNotification(String subject, String body, Long senderUserId);

    void recordPersonalNotifications(List<Long> recipientUserIds, String subject, String body, Long senderUserId);

    List<NotificationRecord> listGlobalNotifications(int limit);

    List<NotificationRecord> listPersonalNotifications(Long userId, int limit);
}
