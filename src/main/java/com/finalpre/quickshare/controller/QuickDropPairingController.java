package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.QuickDropPairCodeClaimRequest;
import com.finalpre.quickshare.dto.QuickDropPairCodeCreateRequest;
import com.finalpre.quickshare.service.QuickDropPairingService;
import com.finalpre.quickshare.vo.QuickDropPairClaimVO;
import com.finalpre.quickshare.vo.QuickDropPairCodeVO;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/quickdrop/pair-codes")
public class QuickDropPairingController {

    private final QuickDropPairingService quickDropPairingService;

    public QuickDropPairingController(QuickDropPairingService quickDropPairingService) {
        this.quickDropPairingService = quickDropPairingService;
    }

    @PostMapping
    public Result<QuickDropPairCodeVO> createPairCode(Authentication authentication,
                                                      @RequestBody QuickDropPairCodeCreateRequest request) {
        return Result.success(quickDropPairingService.createPairCode(resolveUserId(authentication), request));
    }

    @PostMapping("/{code}/claim")
    public Result<QuickDropPairClaimVO> claimPairCode(Authentication authentication,
                                                      @PathVariable String code,
                                                      @RequestBody QuickDropPairCodeClaimRequest request) {
        return Result.success(quickDropPairingService.claimPairCode(resolveUserId(authentication), code, request));
    }

    private Long resolveUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) {
            return userId;
        }
        return null;
    }
}
