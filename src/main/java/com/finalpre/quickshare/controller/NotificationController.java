package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.entity.NotificationRecord;
import com.finalpre.quickshare.service.NotificationService;
import com.finalpre.quickshare.vo.NotificationVO;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @GetMapping("/public/notifications")
    public Result<List<NotificationVO>> getGlobalNotifications(@RequestParam(defaultValue = "20") Integer limit) {
        return Result.success(notificationService.listGlobalNotifications(limit == null ? 20 : limit)
                .stream()
                .map(this::toVO)
                .toList());
    }

    @GetMapping("/notifications/personal")
    public Result<List<NotificationVO>> getPersonalNotifications(
            Authentication authentication,
            @RequestParam(defaultValue = "20") Integer limit) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new AccessDeniedException("请先登录");
        }

        return Result.success(notificationService.listPersonalNotifications(userId, limit == null ? 20 : limit)
                .stream()
                .map(this::toVO)
                .toList());
    }

    private NotificationVO toVO(NotificationRecord record) {
        NotificationVO vo = new NotificationVO();
        BeanUtils.copyProperties(record, vo);
        return vo;
    }
}
