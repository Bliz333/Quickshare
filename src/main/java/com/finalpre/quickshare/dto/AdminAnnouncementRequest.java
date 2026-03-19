package com.finalpre.quickshare.dto;

import lombok.Data;
import java.util.List;

@Data
public class AdminAnnouncementRequest {
    /** Email subject */
    private String subject;
    /** Email body content */
    private String body;
    /** If null or empty, send to all users. Otherwise send to these user IDs only. */
    private List<Long> userIds;
}
