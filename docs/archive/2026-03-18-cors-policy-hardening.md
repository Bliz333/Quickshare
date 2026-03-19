# 2026-03-18 CORS 白名单收紧与策略来源抽象

- 目标：继续收阶段 1 的对外暴露面，移除控制器层宽松跨域放行，改为全局白名单控制，并为后续管理员面板接管 CORS 策略来源预留接入点。

## 本轮变更

- 去掉了 `AuthController`、`FileController` 上无参数的 `@CrossOrigin`，避免控制器层默认放开所有来源。
- 新增 `CorsProperties` / `CorsPolicy` / `CorsPolicyService` / `CorsPolicyServiceImpl`：
  - 当前仍由配置文件提供 CORS 策略
  - 但控制链已改为从 `CorsPolicyService` 取当前策略
  - 后续管理员面板若接管 CORS，只需要替换策略来源，不必重写过滤链
- `WebConfig` 不再在启动时静态写死 `CorsRegistry`，改为提供动态 `CorsConfigurationSource`，按请求读取当前策略。
- 当前默认策略：
  - 开发默认白名单：`http://localhost:3000,http://localhost:8080`
  - 默认 `allowCredentials=false`
  - 生产配置默认不再回退到 `*`，需要显式设置 `CORS_ALLOWED_ORIGINS`

## 回归覆盖

- `FileControllerTest` 新增场景：
  - 白名单来源预检请求通过并返回 `Access-Control-Allow-Origin`
  - 非白名单来源预检请求返回 `403`
- 同时保留原有分享 / 预览 / 下载 / 频控回归，确认去掉 `@CrossOrigin` 后主链路未回退。

## 涉及文件

- `src/main/java/com/finalpre/quickshare/config/CorsProperties.java`
- `src/main/java/com/finalpre/quickshare/config/WebConfig.java`
- `src/main/java/com/finalpre/quickshare/controller/AuthController.java`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
- `src/main/java/com/finalpre/quickshare/service/CorsPolicy.java`
- `src/main/java/com/finalpre/quickshare/service/CorsPolicyService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/CorsPolicyServiceImpl.java`
- `src/main/resources/application.yml`
- `src/main/resources/application-local.example.yml`
- `src/main/resources/application-prod.yml`
- `src/test/java/com/finalpre/quickshare/controller/FileControllerTest.java`

## 验证结果

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 下一步建议

1. 继续补 `User.role` 落库与角色常量收口，为管理员接口和后台登录做真正的权限基础。
2. 角色基础落稳后，再开始第一批管理员接口的 `ADMIN` 权限边界与策略读写入口草案。
