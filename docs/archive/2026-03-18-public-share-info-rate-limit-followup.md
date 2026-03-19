# 2026-03-18 公开分享查询频控补充与策略提供器抽象

- 分支：`feature/hardening-plan`
- 目标：继续完成公开入口频控，并把限流阈值来源从执行链中拆出，为阶段 3 管理员面板接入动态调控预留扩展点

## 本轮完成的变更

- 将 `GET /api/share/{shareCode}` 纳入应用层频控，当前默认限制为 60 次 / 600 秒 / IP。
- `RequestRateLimitService` 新增公开分享查询检查方法，`FileController` 已接入。
- 新增限流策略抽象：
  - `RateLimitRule`
  - `RateLimitPolicyService`
  - `RateLimitPolicyServiceImpl`
  - `RateLimitProperties`
- `RequestRateLimitServiceImpl` 不再直接依赖散落的 `@Value` 字段，改为从 `RateLimitPolicyService` 取当前策略。
- 当前策略仍然来自配置文件，但执行链已经与配置来源解耦；后续管理员面板若改为数据库 / Redis / 动态配置中心，只需要替换策略提供器实现。

## 影响文件

- `docs/CHANGELOG.md`
- `docs/STATUS.md`
- `docs/archive/2026-03-18-public-share-info-rate-limit-followup.md`
- `src/main/java/com/finalpre/quickshare/config/RateLimitProperties.java`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
- `src/main/java/com/finalpre/quickshare/service/RateLimitPolicyService.java`
- `src/main/java/com/finalpre/quickshare/service/RateLimitRule.java`
- `src/main/java/com/finalpre/quickshare/service/RequestRateLimitService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/RateLimitPolicyServiceImpl.java`
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

- 频控策略虽然已解耦，但还没有持久化配置入口，也没有管理员 UI。
- 计数还是固定窗口，恶意请求仍可能在窗口边界突刺。
- 目前仍是纯 IP 维度，尚未结合分享码、提取码错误次数、UA 或指纹。

## 建议的下一步

1. 为管理员面板预留策略读写接口 DTO 和数据库表草案。
2. 对提取码错误场景增加更细粒度的尝试次数限制。
3. 评估把应用层频控前移到 Nginx / API Gateway。
