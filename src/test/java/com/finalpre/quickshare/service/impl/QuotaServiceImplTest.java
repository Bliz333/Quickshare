package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuotaServiceImplTest {

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private QuotaServiceImpl quotaService;

    @Test
    void checkDownloadQuotaShouldAllowUnlimitedUsers() {
        User user = new User();
        user.setId(7L);
        user.setDownloadLimit(-1);
        user.setDownloadUsed(999);
        when(userMapper.selectById(7L)).thenReturn(user);

        assertThatCode(() -> quotaService.checkDownloadQuota(7L)).doesNotThrowAnyException();
    }

    @Test
    void checkDownloadQuotaShouldRejectWhenFreeTierDownloadLimitReached() {
        User user = new User();
        user.setId(7L);
        user.setDownloadLimit(500);
        user.setDownloadUsed(500);
        when(userMapper.selectById(7L)).thenReturn(user);

        assertThatThrownBy(() -> quotaService.checkDownloadQuota(7L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("本月下载次数已用完，请购买更多次数");
    }

    @Test
    void isDefaultFreeTierShouldReturnTrueForDefaultQuotaUser() {
        User user = new User();
        user.setId(7L);
        user.setStorageLimit(21474836480L);
        user.setDownloadLimit(500);
        when(userMapper.selectById(7L)).thenReturn(user);

        assertThat(quotaService.isDefaultFreeTier(7L)).isTrue();
    }

    @Test
    void isDefaultFreeTierShouldReturnFalseForExpandedStorageUser() {
        User user = new User();
        user.setId(7L);
        user.setStorageLimit(21474836480L + 1024L);
        user.setDownloadLimit(500);
        when(userMapper.selectById(7L)).thenReturn(user);

        assertThat(quotaService.isDefaultFreeTier(7L)).isFalse();
    }
}
