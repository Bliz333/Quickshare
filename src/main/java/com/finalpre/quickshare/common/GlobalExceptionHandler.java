package com.finalpre.quickshare.common;

import jakarta.validation.ValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AuthenticationException.class)
    public Result<Void> handleAuth(AuthenticationException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return Result.error(401, "未授权或登录已失效");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public Result<Void> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return Result.error(403, "无权限执行该操作");
    }

    @ExceptionHandler({ValidationException.class, MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, IllegalArgumentException.class})
    public Result<Void> handleBadRequest(Exception ex) {
        log.warn("Invalid request", ex);
        return Result.error(400, ex.getMessage());
    }

    @ExceptionHandler(RuntimeException.class)
    public Result<Void> handleRuntime(RuntimeException ex) {
        log.error("Unexpected error", ex);
        return Result.error(500, ex.getMessage());
    }
}
