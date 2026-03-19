# 2026-03-18 匿名上传 / 下载频控基线

- 分支：`feature/hardening-plan`
- 目标：为首页匿名上传和公开下载入口补最小可用的后端频控，避免在未接入网关或 WAF 的情况下完全裸露

## 本轮完成的变更

- 新增 `RateLimitExceededException`，统一表示频控超限，并在全局异常处理中映射为 HTTP 429。
- 新增 `RequestRateLimitService` 与 `RequestRateLimitServiceImpl`：
  - 使用 Redis `INCR + EXPIRE` 做按客户端 IP 的窗口计数
  - 当前覆盖两个入口：
    - 匿名上传 `/api/upload`
    - 公开下载 `/api/download/{shareCode}`
  - Redis 异常时采用 fail-open，记录错误日志但不阻断主流程，避免 Redis 故障直接导致上传/下载不可用
- `FileController` 现在会优先解析客户端 IP：
  - `X-Forwarded-For`
  - `X-Real-IP`
  - `remoteAddr`
- 新增频控配置项：
  - `app.rate-limit.guest-upload.*`
  - `app.rate-limit.public-download.*`
- 默认配置：
  - 匿名上传：10 次 / 600 秒
  - 公开下载：30 次 / 600 秒

## 影响文件

- `docs/CHANGELOG.md`
- `docs/STATUS.md`
- `docs/archive/2026-03-18-guest-rate-limit-baseline.md`
- `src/main/java/com/finalpre/quickshare/common/GlobalExceptionHandler.java`
- `src/main/java/com/finalpre/quickshare/common/RateLimitExceededException.java`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
- `src/main/java/com/finalpre/quickshare/service/RequestRateLimitService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/RequestRateLimitServiceImpl.java`
- `src/main/resources/application.yml`
- `src/main/resources/application-prod.yml`
- `src/main/resources/application-local.example.yml`
- `src/test/java/com/finalpre/quickshare/controller/FileControllerTest.java`
- `src/test/java/com/finalpre/quickshare/service/impl/RequestRateLimitServiceImplTest.java`

## 执行过的验证

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=RequestRateLimitServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 当前仍未解决的问题

- 目前只限制了匿名上传和公开下载，分享信息查询 `/api/share/{shareCode}` 仍未频控。
- 计数是固定窗口，尚未升级到滑动窗口或令牌桶。
- 频控粒度只到 IP，尚未结合分享码、文件 ID、UA 或风险评分。
- 下载次数递增与频控目前都在应用层，仍缺少更外层的网关 / CDN / WAF 保护。

## 建议的下一步

1. 将公开分享信息查询也纳入频控，降低提取码穷举和分享码探测成本。
2. 为公开下载失败页补前端友好提示，避免用户只看到 JSON。
3. 评估是否把频控前移到 Nginx / Cloudflare / API Gateway。
