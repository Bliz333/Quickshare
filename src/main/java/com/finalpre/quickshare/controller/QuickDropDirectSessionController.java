package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.QuickDropDirectSessionCreateRequest;
import com.finalpre.quickshare.service.QuickDropPairingService;
import com.finalpre.quickshare.vo.QuickDropDirectSessionVO;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quickdrop/direct-sessions")
public class QuickDropDirectSessionController {

    private final QuickDropPairingService quickDropPairingService;

    public QuickDropDirectSessionController(QuickDropPairingService quickDropPairingService) {
        this.quickDropPairingService = quickDropPairingService;
    }

    @PostMapping
    public Result<QuickDropDirectSessionVO> createDirectSession(Authentication authentication,
                                                                @RequestBody QuickDropDirectSessionCreateRequest request) {
        return Result.success(quickDropPairingService.createDirectSession(requireUserId(authentication), request));
    }

    private Long requireUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new AccessDeniedException("请先登录");
        }
        return userId;
    }
}
