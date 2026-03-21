package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PlanMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanBootstrapServiceImplTest {

    @Mock
    private PlanMapper planMapper;

    @InjectMocks
    private PlanBootstrapServiceImpl planBootstrapService;

    @Test
    void ensureDefaultPlansShouldSeedWhenTableEmpty() {
        when(planMapper.selectCount(any())).thenReturn(0L);
        List<Plan> insertedPlans = new ArrayList<>();
        doAnswer(invocation -> {
            insertedPlans.add(invocation.getArgument(0));
            return 1;
        }).when(planMapper).insert(org.mockito.ArgumentMatchers.<Plan>any());

        planBootstrapService.ensureDefaultPlans();

        verify(planMapper, times(9)).insert(org.mockito.ArgumentMatchers.<Plan>any());
        assertThat(insertedPlans).extracting(Plan::getName)
                .contains("Extra 50GB", "Cloud Drive 10TB", "VIP Yearly");
    }

    @Test
    void ensureDefaultPlansShouldSkipWhenPlansAlreadyExist() {
        when(planMapper.selectCount(any())).thenReturn(2L);

        planBootstrapService.ensureDefaultPlans();

        verify(planMapper, never()).insert(org.mockito.ArgumentMatchers.<Plan>any());
    }
}
