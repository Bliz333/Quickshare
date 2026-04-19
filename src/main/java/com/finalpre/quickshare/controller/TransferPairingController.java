package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.TransferPairCodeClaimRequest;
import com.finalpre.quickshare.dto.TransferPairCodeCreateRequest;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.vo.TransferPairClaimVO;
import com.finalpre.quickshare.vo.TransferPairCodeVO;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/public/transfer/pair-codes", "/api/public/quickdrop/pair-codes"})
public class TransferPairingController {

    private final TransferPairingService transferPairingService;

    public TransferPairingController(TransferPairingService transferPairingService) {
        this.transferPairingService = transferPairingService;
    }

    @PostMapping
    public Result<TransferPairCodeVO> createPairCode(Authentication authentication,
                                                      @RequestBody TransferPairCodeCreateRequest request) {
        return Result.success(transferPairingService.createPairCode(resolveUserId(authentication), request));
    }

    @PostMapping("/{code}/claim")
    public Result<TransferPairClaimVO> claimPairCode(Authentication authentication,
                                                      @PathVariable String code,
                                                      @RequestBody TransferPairCodeClaimRequest request) {
        return Result.success(transferPairingService.claimPairCode(resolveUserId(authentication), code, request));
    }

    private Long resolveUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) {
            return userId;
        }
        return null;
    }
}
