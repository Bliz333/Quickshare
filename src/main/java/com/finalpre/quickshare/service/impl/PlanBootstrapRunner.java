package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.PlanBootstrapService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanBootstrapRunner implements ApplicationRunner {

    private final PlanBootstrapService planBootstrapService;

    @Override
    public void run(ApplicationArguments args) {
        planBootstrapService.ensureDefaultPlans();
    }
}
