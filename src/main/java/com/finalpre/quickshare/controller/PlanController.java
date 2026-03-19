package com.finalpre.quickshare.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PlanMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public")
public class PlanController {

    @Autowired
    private PlanMapper planMapper;

    @GetMapping("/plans")
    public Result<List<Plan>> getActivePlans() {
        List<Plan> plans = planMapper.selectList(
                new QueryWrapper<Plan>()
                        .eq("status", 1)
                        .orderByAsc("sort_order")
                        .orderByAsc("price"));
        return Result.success(plans);
    }
}
