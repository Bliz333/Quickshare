# 2026-03-18 公开分享提取码错误次数限制

- 目标：继续收阶段 1 的公开分享风险控制，在基础 IP 频控之外，为“猜提取码”增加更细粒度的错误次数限制。

## 本轮变更

- `GET /api/share/{shareCode}` 在原有公开分享查询频控基础上，新增提取码错误次数限制：
  - 维度：`IP + shareCode`
  - 默认策略：5 次错误 / 600 秒
  - 超限语义：HTTP `429`，提示“提取码尝试次数过多，请稍后再试”
- 分享信息查询控制器接入了三段式处理：
  - 先校验公开分享查询总频率
  - 再校验该 `IP + shareCode` 是否已因提取码错误被锁定
  - 提取码校验成功后清空该维度的错误计数，避免合法用户被历史输错持续影响
- `RequestRateLimitService` / `RateLimitPolicyService` 扩展了提取码错误次数相关接口与策略来源，仍沿用当前“策略来源解耦、执行链不耦合后台”的方向。
- 配置新增 `app.rate-limit.public-share-extract-code-error.*`，同时补齐 `application.yml`、`application-local.example.yml`、`application-prod.yml` 默认值和环境变量占位。

## 回归覆盖

- `FileControllerTest` 新增场景：
  - 提取码错误次数超限时返回 `429`
  - 提取码错误时记录错误计数
  - 提取码正确时清理错误计数
  - 缺少提取码时仍统一返回“提取码错误”，且不进入服务层
- `RequestRateLimitServiceImplTest` 新增场景：
  - 提取码错误计数达到阈值时拒绝继续尝试
  - 首次错误会设置过期时间
  - 超限写入时返回明确的限流异常
  - 成功后可删除对应计数
  - Redis 异常时继续保持 fail-open

## 涉及文件

- `src/main/java/com/finalpre/quickshare/config/RateLimitProperties.java`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
- `src/main/java/com/finalpre/quickshare/service/RateLimitPolicyService.java`
- `src/main/java/com/finalpre/quickshare/service/RequestRateLimitService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/RateLimitPolicyServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/service/impl/RequestRateLimitServiceImpl.java`
- `src/main/resources/application.yml`
- `src/main/resources/application-local.example.yml`
- `src/main/resources/application-prod.yml`
- `src/test/java/com/finalpre/quickshare/controller/FileControllerTest.java`
- `src/test/java/com/finalpre/quickshare/service/impl/RequestRateLimitServiceImplTest.java`

## 验证结果

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=RequestRateLimitServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 下一步建议

1. 开始角色权限与 CORS 白名单设计，继续收阶段 1 的对外暴露面。
2. 若提前进入阶段 3 管理员面板，优先让后台接管 `public-share-extract-code-error` 策略来源，不直接改 Redis 执行链。
