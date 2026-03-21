package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminAnnouncementResultVO {
    private int totalRecipients;
    private int deliverableCount;
    private int successCount;
    private int failCount;
    private int skippedCount;
}
