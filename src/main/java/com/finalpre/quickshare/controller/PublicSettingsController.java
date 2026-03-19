package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.vo.PublicRegistrationSettingsVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class PublicSettingsController {

    @Autowired
    private RegistrationSettingsService registrationSettingsService;

    @GetMapping("/registration-settings")
    public Result<PublicRegistrationSettingsVO> getRegistrationSettings() {
        RegistrationSettingsPolicy policy = registrationSettingsService.getPolicy();

        PublicRegistrationSettingsVO vo = new PublicRegistrationSettingsVO();
        vo.setEmailVerificationEnabled(policy.emailVerificationEnabled());
        vo.setRecaptchaEnabled(policy.recaptchaEnabled());
        vo.setRecaptchaSiteKey(policy.recaptchaSiteKey());
        return Result.success(vo);
    }
}
