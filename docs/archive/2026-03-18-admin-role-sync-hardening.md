# 2026-03-18 管理员角色同步与登录态收口

## 本轮目标

- 修正“用户已被降级为普通用户，但前端仍显示管理员入口”的问题
- 避免后端继续直接信任 JWT 中固化的 `role` claim
- 顺手收口游客上传临时 JWT 被当成正常登录态使用的潜在风险

## 核心问题

- 旧实现里，登录成功时会把 `role` 写入 JWT。
- `JwtAuthenticationFilter` 每次请求都直接从 token claim 读取角色建立权限。
- 前端首页 / 网盘 / 管理页也直接信任 `localStorage.user.role` 控制管理员入口。
- 这会导致：
  - 用户在数据库中被从 `ADMIN` 降级后，旧 token 在过期前仍带着管理员角色
  - 前端本地缓存也会继续把该用户当管理员展示入口
  - 游客上传临时 token 同样是 JWT，如果被误当成普通 access token，存在被过滤器错误接受的空间

## 本轮改动

### 后端鉴权链路

- `JwtAuthenticationFilter`
  - 改为只接受“正常登录 access token”，不再把带业务用途的临时 token 当登录态
  - 解析出 `userId` 后，实时查数据库当前用户
  - 角色统一以数据库里的 `user.role` 为准，而不是 token claim
  - 用户不存在或已逻辑删除时，不建立认证上下文

- `JwtUtil`
  - 新增 access token 校验方法，要求必须是正常登录 token
  - 显式区分 guest upload token 与普通登录 token

### 当前用户资料同步

- 新增 `GET /api/profile`
  - 仅对已认证登录态开放
  - 返回数据库当前用户资料与当前角色

- `UserService`
  - 新增当前用户资料读取能力，统一返回规范化角色

### 前端入口显隐修正

- 新增 `src/main/resources/static/js/session.js`
  - 统一封装 token / user 读取、清理、当前资料同步与角色判断

- 首页 `auth.js`
  - 登录态下先按普通用户渲染
  - 再向 `/api/profile` 拉取当前资料
  - 只有服务端确认 `ADMIN` 后才显示“管理后台”按钮

- 网盘页 `netdisk.js`
  - 管理员入口默认保持隐藏
  - 页面初始化时同步当前资料，只有确认 `ADMIN` 才放开管理员入口

- 管理页 `admin.js`
  - 页面初始化时必须先向服务端确认当前仍是 `ADMIN`
  - 本地缓存角色不再足以放行管理员页面
  - 自己把自己降级后，沿用现有逻辑清理会话并重新登录

## 回归验证

- `node --check src/main/resources/static/js/session.js`
- `node --check src/main/resources/static/js/auth.js`
- `node --check src/main/resources/static/js/netdisk.js`
- `node --check src/main/resources/static/js/admin.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminControllerTest,FileControllerTest,ProfileControllerTest,UserServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 结果

- 管理员权限现在以数据库当前角色为准
- 普通用户不应再因本地缓存或旧 token 而继续看到管理员入口
- 游客上传临时 token 不再能作为普通登录态进入受保护接口

## 建议下一步

1. 继续把更多安全/策略项接入管理员后台，优先考虑上传大小、文件类型等配置
2. 后续再补文档类预览（PDF / DOCX 等）与后台开关，但当前优先级低于安全策略后台化
