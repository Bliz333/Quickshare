# 2026-03-18 阶段 1 异常处理与鉴权回归补充记录

- 分支：`feature/hardening-plan`
- 目标：收口控制器层零散异常处理，统一接入 Spring Security 认证上下文，并补文件接口鉴权回归测试

## 本轮完成的变更

- `GlobalExceptionHandler` 改为返回统一 `Result` 结构和对应 HTTP 状态码，不再只改业务 `code` 字段。
- 新增 `ResourceNotFoundException`，将文件服务中的异常语义拆成：
  - 参数/状态错误：`IllegalArgumentException`
  - 越权访问：`AccessDeniedException`
  - 资源不存在：`ResourceNotFoundException`
- `FileController` 去掉手工解析 `Authorization` 和本地 `try/catch`，统一从 Security `Authentication` 读取 `userId`。
- `AuthController` 去掉分散 `try/catch`，让注册/登录/发送验证码走全局异常处理。
- `UserServiceImpl`、`VerificationCodeServiceImpl`、`FileServiceImpl` 调整为更明确的异常类型，避免所有业务错误都落成 500。
- `FileControllerTest` 改成 `WebMvcTest + SecurityConfig + JwtAuthenticationFilter`，覆盖：
  - 缺少 token 返回 401
  - 有效 Bearer token 正常访问文件列表/上传/重命名
  - URL `token` 参数可通过 JWT 过滤链
  - 空文件名返回 400
  - 越权删除返回 403
  - 资源不存在返回 404

## 影响文件

- `docs/CHANGELOG.md`
- `docs/STATUS.md`
- `src/main/java/com/finalpre/quickshare/common/GlobalExceptionHandler.java`
- `src/main/java/com/finalpre/quickshare/common/ResourceNotFoundException.java`
- `src/main/java/com/finalpre/quickshare/controller/AuthController.java`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
- `src/main/java/com/finalpre/quickshare/service/impl/FileServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/service/impl/UserServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/service/impl/VerificationCodeServiceImpl.java`
- `src/test/java/com/finalpre/quickshare/controller/FileControllerTest.java`

## 执行过的验证

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest,FileServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 当前仍未解决的问题

- 角色权限仍只停留在 JWT 载荷，尚未进入接口级 `ADMIN` 权限设计。
- 分享/预览/下载虽然已经走统一异常链，但缺少系统化的 WebMvc 回归测试。
- CORS 默认值仍依赖配置，部署时需要明确白名单。

## 建议的下一步

1. 为分享信息获取、下载、预览补 400/401/403/404 回归测试。
2. 设计管理员接口最小集合，确定 `ADMIN` 的接口保护边界。
3. 按部署环境收紧 `cors.allowed-origins`，避免生产继续使用宽松配置。
