package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.RateLimitExceededException;
import com.finalpre.quickshare.service.RateLimitPolicyService;
import com.finalpre.quickshare.service.RateLimitRule;
import com.finalpre.quickshare.service.RequestRateLimitService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class RequestRateLimitServiceImpl implements RequestRateLimitService {

    private static final String RATE_LIMIT_PREFIX = "rate-limit:";
    private static final String PUBLIC_SHARE_EXTRACT_CODE_ERROR_SCENE = "public-share-extract-code-error";
    private static final String PUBLIC_SHARE_EXTRACT_CODE_ERROR_MESSAGE = "提取码尝试次数过多，请稍后再试";

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private RateLimitPolicyService rateLimitPolicyService;

    @Override
    public void checkGuestUploadAllowed(String clientIp) {
        RateLimitRule rule = rateLimitPolicyService.getGuestUploadRule();
        checkLimit(
                "guest-upload",
                clientIp,
                rule,
                "匿名上传过于频繁，请稍后再试"
        );
    }

    @Override
    public void checkPublicDownloadAllowed(String clientIp) {
        RateLimitRule rule = rateLimitPolicyService.getPublicDownloadRule();
        checkLimit(
                "public-download",
                clientIp,
                rule,
                "下载请求过于频繁，请稍后再试"
        );
    }

    @Override
    public void checkPublicShareInfoAllowed(String clientIp) {
        RateLimitRule rule = rateLimitPolicyService.getPublicShareInfoRule();
        checkLimit(
                "public-share-info",
                clientIp,
                rule,
                "分享访问请求过于频繁，请稍后再试"
        );
    }

    @Override
    public void checkPublicShareExtractCodeFailureAllowed(String clientIp, String shareCode) {
        RateLimitRule rule = rateLimitPolicyService.getPublicShareExtractCodeErrorRule();
        if (rule == null || !rule.enabled() || rule.maxRequests() <= 0 || rule.windowSeconds() <= 0) {
            return;
        }

        String key = buildShareExtractCodeErrorKey(clientIp, shareCode);
        try {
            String currentValue = redisTemplate.opsForValue().get(key);
            if (currentValue == null || currentValue.isBlank()) {
                return;
            }

            long failureCount = Long.parseLong(currentValue);
            if (failureCount >= rule.maxRequests()) {
                throw new RateLimitExceededException(PUBLIC_SHARE_EXTRACT_CODE_ERROR_MESSAGE);
            }
        } catch (RateLimitExceededException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Rate limit check failed, allow request to continue. scene={}, key={}, reason={}",
                    PUBLIC_SHARE_EXTRACT_CODE_ERROR_SCENE, key, ex.getMessage());
            log.debug("Rate limit check stack", ex);
        }
    }

    @Override
    public void recordPublicShareExtractCodeFailure(String clientIp, String shareCode) {
        RateLimitRule rule = rateLimitPolicyService.getPublicShareExtractCodeErrorRule();
        if (rule == null || !rule.enabled() || rule.maxRequests() <= 0 || rule.windowSeconds() <= 0) {
            return;
        }

        String key = buildShareExtractCodeErrorKey(clientIp, shareCode);
        try {
            Long failureCount = redisTemplate.opsForValue().increment(key);
            if (failureCount == null) {
                return;
            }
            if (failureCount == 1L) {
                redisTemplate.expire(key, rule.windowSeconds(), TimeUnit.SECONDS);
            }
            if (failureCount > rule.maxRequests()) {
                throw new RateLimitExceededException(PUBLIC_SHARE_EXTRACT_CODE_ERROR_MESSAGE);
            }
        } catch (RateLimitExceededException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Rate limit record failed, allow request to continue. scene={}, key={}, reason={}",
                    PUBLIC_SHARE_EXTRACT_CODE_ERROR_SCENE, key, ex.getMessage());
            log.debug("Rate limit record stack", ex);
        }
    }

    @Override
    public void resetPublicShareExtractCodeFailures(String clientIp, String shareCode) {
        RateLimitRule rule = rateLimitPolicyService.getPublicShareExtractCodeErrorRule();
        if (rule == null || !rule.enabled()) {
            return;
        }

        String key = buildShareExtractCodeErrorKey(clientIp, shareCode);
        try {
            redisTemplate.delete(key);
        } catch (Exception ex) {
            log.warn("Rate limit reset failed, ignore and continue. scene={}, key={}, reason={}",
                    PUBLIC_SHARE_EXTRACT_CODE_ERROR_SCENE, key, ex.getMessage());
            log.debug("Rate limit reset stack", ex);
        }
    }

    private void checkLimit(String scene,
                            String clientIp,
                            RateLimitRule rule,
                            String message) {
        if (rule == null || !rule.enabled() || rule.maxRequests() <= 0 || rule.windowSeconds() <= 0) {
            return;
        }

        String normalizedClientIp = normalizeClientIp(clientIp);
        String key = RATE_LIMIT_PREFIX + scene + ":" + normalizedClientIp;

        try {
            Long requestCount = redisTemplate.opsForValue().increment(key);
            if (requestCount == null) {
                return;
            }
            if (requestCount == 1L) {
                redisTemplate.expire(key, rule.windowSeconds(), TimeUnit.SECONDS);
            }
            if (requestCount > rule.maxRequests()) {
                throw new RateLimitExceededException(message);
            }
        } catch (RateLimitExceededException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Rate limit check failed, allow request to continue. scene={}, clientIp={}, reason={}",
                    scene, normalizedClientIp, ex.getMessage());
            log.debug("Rate limit check stack", ex);
        }
    }

    private String normalizeClientIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "unknown";
        }
        return clientIp.trim();
    }

    private String buildShareExtractCodeErrorKey(String clientIp, String shareCode) {
        return RATE_LIMIT_PREFIX
                + PUBLIC_SHARE_EXTRACT_CODE_ERROR_SCENE
                + ":"
                + normalizeClientIp(clientIp)
                + ":"
                + normalizeShareCode(shareCode);
    }

    private String normalizeShareCode(String shareCode) {
        if (shareCode == null || shareCode.isBlank()) {
            return "unknown-share";
        }
        return shareCode.trim();
    }
}
