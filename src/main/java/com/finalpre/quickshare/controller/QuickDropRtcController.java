package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.config.QuickDropProperties;
import com.finalpre.quickshare.vo.QuickDropIceServerVO;
import com.finalpre.quickshare.vo.QuickDropRtcConfigVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/public/quickdrop")
public class QuickDropRtcController {

    private final QuickDropProperties quickDropProperties;

    public QuickDropRtcController(QuickDropProperties quickDropProperties) {
        this.quickDropProperties = quickDropProperties;
    }

    @GetMapping("/rtc-config")
    public Result<QuickDropRtcConfigVO> getRtcConfig() {
        QuickDropRtcConfigVO vo = new QuickDropRtcConfigVO();
        vo.setDirectTransferEnabled(quickDropProperties.isDirectTransferEnabled());

        List<QuickDropIceServerVO> iceServers = new ArrayList<>();
        if (quickDropProperties.getStunUrls() != null && !quickDropProperties.getStunUrls().isEmpty()) {
            QuickDropIceServerVO stun = new QuickDropIceServerVO();
            stun.setUrls(quickDropProperties.getStunUrls());
            iceServers.add(stun);
        }

        List<String> turnUrls = new ArrayList<>();
        if (quickDropProperties.getTurnUrls() != null) {
            quickDropProperties.getTurnUrls().stream()
                    .filter(url -> url != null && !url.isBlank())
                    .map(String::trim)
                    .forEach(turnUrls::add);
        }
        if (turnUrls.isEmpty()
                && quickDropProperties.getTurnUrl() != null
                && !quickDropProperties.getTurnUrl().isBlank()) {
            turnUrls.add(quickDropProperties.getTurnUrl().trim());
        }

        if (!turnUrls.isEmpty()) {
            QuickDropIceServerVO turn = new QuickDropIceServerVO();
            turn.setUrls(turnUrls);
            turn.setUsername(quickDropProperties.getTurnUsername());
            turn.setCredential(quickDropProperties.getTurnPassword());
            iceServers.add(turn);
        }

        vo.setIceServers(iceServers);
        return Result.success(vo);
    }
}
