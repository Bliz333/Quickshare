# 2026-03-18 匿名上传开关接入管理员后台

## 本轮目标

- 在已有上传策略后台化基础上，继续接入匿名上传总开关
- 保持“后台覆盖值 + 配置默认值”的 provider 模式
- 为后续预览开关、SMTP / 模板 / 公告、验证码提供器抽象预留工作流记录

## 本轮改动

### 匿名上传开关

- 上传策略新增 `guestUploadEnabled`
- 管理台“上传策略”卡片新增“允许匿名上传”开关
- 当前开关只影响未登录上传：
  - 已登录用户上传不受影响
  - 匿名上传关闭后，`POST /api/upload` 会直接返回 `403`

### 后端语义

- 新增 `FeatureDisabledException`
- 当前用于“匿名上传已关闭”场景
- 后续若继续加入预览开关、公告发送开关等功能关闭语义，可复用同一异常类型

## 当前工作流补充

### 已明确加入后续流程，但本轮暂不展开

1. SMTP 后台化
   - 管理面板维护 SMTP 连接配置
   - 测试连通性
   - 支持运行时切换

2. 邮件模板与通知能力
   - 后台维护验证码、通知、公告等邮件模板
   - 管理员可向指定用户或全站用户发送通知邮件 / 公告邮件

3. 人机验证提供器抽象
   - 除 Google reCAPTCHA 外，后续加入 Cloudflare Turnstile
   - 目标是做成“可切换提供器”，而不是把验证码逻辑继续写死在 reCAPTCHA 上

## 回归验证

- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminControllerTest,AdminPolicyServiceImplTest,FileUploadPolicyServiceImplTest,FileControllerTest,FileServiceImplTest test`

## 备注

- 当前 `mvn test` 里的 `QuickshareApplicationTests` 在本地未启动 MySQL 时仍会打印一次 `Connection refused`
- 现阶段 `SystemSettingOverrideServiceImpl` 预加载采用 fail-open，会回退到文件配置，因此不会导致测试失败
- 这条提醒已同步记入项目状态，避免后续误判为本轮回归异常

## 建议下一步

1. 继续在上传 / 预览策略里补后台项，优先考虑预览开关和允许预览类型
2. 之后再进入 SMTP 配置后台化与邮件模板体系
