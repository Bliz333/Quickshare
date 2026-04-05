package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.TransferDirectSessionCreateRequest;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.vo.TransferDirectSessionVO;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transfer/direct-sessions")
public class TransferDirectSessionController {

    private final TransferPairingService transferPairingService;

    public TransferDirectSessionController(TransferPairingService transferPairingService) {
        this.transferPairingService = transferPairingService;
    }

    @PostMapping
    public Result<TransferDirectSessionVO> createDirectSession(Authentication authentication,
                                                                @RequestBody TransferDirectSessionCreateRequest request) {
        return Result.success(transferPairingService.createDirectSession(requireUserId(authentication), request));
    }

    private Long requireUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new AccessDeniedException("请先登录");
        }
        return userId;
    }
}
