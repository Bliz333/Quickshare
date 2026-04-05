package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.config.TransferProperties;
import com.finalpre.quickshare.vo.TransferIceServerVO;
import com.finalpre.quickshare.vo.TransferRtcConfigVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/public/transfer")
public class TransferRtcController {

    private final TransferProperties transferProperties;

    public TransferRtcController(TransferProperties transferProperties) {
        this.transferProperties = transferProperties;
    }

    @GetMapping("/rtc-config")
    public Result<TransferRtcConfigVO> getRtcConfig() {
        TransferRtcConfigVO vo = new TransferRtcConfigVO();
        vo.setDirectTransferEnabled(transferProperties.isDirectTransferEnabled());

        List<TransferIceServerVO> iceServers = new ArrayList<>();
        if (transferProperties.getStunUrls() != null && !transferProperties.getStunUrls().isEmpty()) {
            TransferIceServerVO stun = new TransferIceServerVO();
            stun.setUrls(transferProperties.getStunUrls());
            iceServers.add(stun);
        }

        List<String> turnUrls = new ArrayList<>();
        if (transferProperties.getTurnUrls() != null) {
            transferProperties.getTurnUrls().stream()
                    .filter(url -> url != null && !url.isBlank())
                    .map(String::trim)
                    .forEach(turnUrls::add);
        }
        if (turnUrls.isEmpty()
                && transferProperties.getTurnUrl() != null
                && !transferProperties.getTurnUrl().isBlank()) {
            turnUrls.add(transferProperties.getTurnUrl().trim());
        }

        if (!turnUrls.isEmpty()) {
            TransferIceServerVO turn = new TransferIceServerVO();
            turn.setUrls(turnUrls);
            turn.setUsername(transferProperties.getTurnUsername());
            turn.setCredential(transferProperties.getTurnPassword());
            iceServers.add(turn);
        }

        vo.setIceServers(iceServers);
        return Result.success(vo);
    }
}
