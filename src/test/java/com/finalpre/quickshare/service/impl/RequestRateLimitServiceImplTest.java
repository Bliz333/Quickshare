package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.RateLimitExceededException;
import com.finalpre.quickshare.service.RateLimitPolicyService;
import com.finalpre.quickshare.service.RateLimitRule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RequestRateLimitServiceImplTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private RateLimitPolicyService rateLimitPolicyService;

    @InjectMocks
    private RequestRateLimitServiceImpl requestRateLimitService;

    @Test
    void checkGuestUploadAllowedShouldSetExpiryOnFirstRequest() {
        when(rateLimitPolicyService.getGuestUploadRule()).thenReturn(new RateLimitRule(true, 10L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(1L);

        requestRateLimitService.checkGuestUploadAllowed("203.0.113.9");

        verify(redisTemplate).expire(startsWith("rate-limit:guest-upload:203.0.113.9"), eq(600L), eq(TimeUnit.SECONDS));
    }

    @Test
    void checkGuestUploadAllowedShouldThrowWhenLimitExceeded() {
        when(rateLimitPolicyService.getGuestUploadRule()).thenReturn(new RateLimitRule(true, 10L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(11L);

        assertThatThrownBy(() -> requestRateLimitService.checkGuestUploadAllowed("203.0.113.9"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("匿名上传过于频繁，请稍后再试");
    }

    @Test
    void checkBasicUserUploadAllowedShouldThrowWhenLimitExceeded() {
        when(rateLimitPolicyService.getBasicUserUploadRule()).thenReturn(new RateLimitRule(true, 20L, 3600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(21L);

        assertThatThrownBy(() -> requestRateLimitService.checkBasicUserUploadAllowed(7L, "203.0.113.9"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("当前免费账号上传过于频繁，请稍后再试或升级套餐");
    }

    @Test
    void checkPublicDownloadAllowedShouldThrowWhenLimitExceeded() {
        when(rateLimitPolicyService.getPublicDownloadRule()).thenReturn(new RateLimitRule(true, 30L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(31L);

        assertThatThrownBy(() -> requestRateLimitService.checkPublicDownloadAllowed("203.0.113.9"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("下载请求过于频繁，请稍后再试");
    }

    @Test
    void checkPublicShareInfoAllowedShouldThrowWhenLimitExceeded() {
        when(rateLimitPolicyService.getPublicShareInfoRule()).thenReturn(new RateLimitRule(true, 60L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(61L);

        assertThatThrownBy(() -> requestRateLimitService.checkPublicShareInfoAllowed("203.0.113.9"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("分享访问请求过于频繁，请稍后再试");
    }

    @Test
    void checkPublicShareExtractCodeFailureAllowedShouldThrowWhenFailureLimitReached() {
        when(rateLimitPolicyService.getPublicShareExtractCodeErrorRule()).thenReturn(new RateLimitRule(true, 5L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("rate-limit:public-share-extract-code-error:203.0.113.9:ABCD1234")).thenReturn("5");

        assertThatThrownBy(() -> requestRateLimitService.checkPublicShareExtractCodeFailureAllowed("203.0.113.9", "ABCD1234"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("提取码尝试次数过多，请稍后再试");
    }

    @Test
    void recordPublicShareExtractCodeFailureShouldSetExpiryOnFirstFailure() {
        when(rateLimitPolicyService.getPublicShareExtractCodeErrorRule()).thenReturn(new RateLimitRule(true, 5L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment("rate-limit:public-share-extract-code-error:203.0.113.9:ABCD1234")).thenReturn(1L);

        requestRateLimitService.recordPublicShareExtractCodeFailure("203.0.113.9", "ABCD1234");

        verify(redisTemplate).expire("rate-limit:public-share-extract-code-error:203.0.113.9:ABCD1234", 600L, TimeUnit.SECONDS);
    }

    @Test
    void recordPublicShareExtractCodeFailureShouldThrowWhenFailureLimitExceeded() {
        when(rateLimitPolicyService.getPublicShareExtractCodeErrorRule()).thenReturn(new RateLimitRule(true, 5L, 600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment("rate-limit:public-share-extract-code-error:203.0.113.9:ABCD1234")).thenReturn(6L);

        assertThatThrownBy(() -> requestRateLimitService.recordPublicShareExtractCodeFailure("203.0.113.9", "ABCD1234"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("提取码尝试次数过多，请稍后再试");
    }

    @Test
    void resetPublicShareExtractCodeFailuresShouldDeleteCounter() {
        when(rateLimitPolicyService.getPublicShareExtractCodeErrorRule()).thenReturn(new RateLimitRule(true, 5L, 600L));

        requestRateLimitService.resetPublicShareExtractCodeFailures("203.0.113.9", "ABCD1234");

        verify(redisTemplate).delete("rate-limit:public-share-extract-code-error:203.0.113.9:ABCD1234");
    }

    @Test
    void checkGuestUploadAllowedShouldFailClosedWhenRedisUnavailable() {
        when(rateLimitPolicyService.getGuestUploadRule()).thenReturn(new RateLimitRule(true, 10L, 600L));
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis unavailable"));

        assertThatThrownBy(() -> requestRateLimitService.checkGuestUploadAllowed("203.0.113.9"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("匿名上传过于频繁，请稍后再试");
    }

    @Test
    void checkBasicUserUploadAllowedShouldSetExpiryOnFirstRequest() {
        when(rateLimitPolicyService.getBasicUserUploadRule()).thenReturn(new RateLimitRule(true, 20L, 3600L));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(1L);

        requestRateLimitService.checkBasicUserUploadAllowed(7L, "203.0.113.9");

        verify(redisTemplate).expire(startsWith("rate-limit:basic-user-upload:user:7:ip:203.0.113.9"), eq(3600L), eq(TimeUnit.SECONDS));
    }

    @Test
    void checkPublicShareExtractCodeFailureAllowedShouldFailClosedWhenRedisUnavailable() {
        when(rateLimitPolicyService.getPublicShareExtractCodeErrorRule()).thenReturn(new RateLimitRule(true, 5L, 600L));
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis unavailable"));

        assertThatThrownBy(() -> requestRateLimitService.checkPublicShareExtractCodeFailureAllowed("203.0.113.9", "ABCD1234"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage("提取码尝试次数过多，请稍后再试");
    }
}
