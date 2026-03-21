package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.service.PlanBootstrapService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanBootstrapServiceImpl implements PlanBootstrapService {

    private final PlanMapper planMapper;

    @Override
    public void ensureDefaultPlans() {
        Long count = planMapper.selectCount(new QueryWrapper<>());
        if (count != null && count > 0) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        List<PlanSeed> seeds = List.of(
                new PlanSeed("Extra 50GB", "Add 50GB extra storage to the current account", "storage", gib(50), "8.80", 10),
                new PlanSeed("Extra 200GB", "Add 200GB extra storage to the current account", "storage", gib(200), "28.80", 20),
                new PlanSeed("Extra 1TB", "Add 1TB extra storage to the current account", "storage", teb(1), "88.00", 30),
                new PlanSeed("Cloud Drive 200GB", "Upgrade the account to a 200GB storage tier", "storage", gib(200), "19.90", 100),
                new PlanSeed("Cloud Drive 1TB", "Upgrade the account to a 1TB storage tier", "storage", teb(1), "59.90", 110),
                new PlanSeed("Cloud Drive 2TB", "Upgrade the account to a 2TB storage tier", "storage", teb(2), "99.90", 120),
                new PlanSeed("Cloud Drive 10TB", "Upgrade the account to a 10TB storage tier", "storage", teb(10), "299.90", 130),
                new PlanSeed("VIP Monthly", "30 days VIP membership", "vip", 30L, "19.99", 200),
                new PlanSeed("VIP Yearly", "365 days VIP membership", "vip", 365L, "199.00", 210)
        );

        for (PlanSeed seed : seeds) {
            Plan plan = new Plan();
            plan.setName(seed.name());
            plan.setDescription(seed.description());
            plan.setType(seed.type());
            plan.setValue(seed.value());
            plan.setPrice(new BigDecimal(seed.price()));
            plan.setSortOrder(seed.sortOrder());
            plan.setStatus(1);
            plan.setCreateTime(now);
            planMapper.insert(plan);
        }

        log.info("Default plans bootstrapped. count={}", seeds.size());
    }

    private static long gib(long value) {
        return value * 1024L * 1024L * 1024L;
    }

    private static long teb(long value) {
        return value * 1024L * 1024L * 1024L * 1024L;
    }

    private record PlanSeed(
            String name,
            String description,
            String type,
            long value,
            String price,
            int sortOrder
    ) {
    }
}
