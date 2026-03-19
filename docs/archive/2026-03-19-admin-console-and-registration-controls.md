# 2026-03-19 管理后台接管用户、隐藏入口与注册验证

## 本轮目标

- 让管理员可以直接在后台新增和删除用户，不再依赖数据库或 API 手工操作
- 把管理员后台从公开固定页面切到隐藏路径，并保留 `compose/.env` 初始化入口
- 让本地测试环境可以直接关闭邮箱验证码和 reCAPTCHA，且改动能从管理员后台实时生效

## 本轮改动

### 1. 管理员后台补齐用户新增 / 删除

- 新增管理员接口：
  - `POST /api/admin/users`
  - `DELETE /api/admin/users/{userId}`
- `AdminServiceImpl` 现在支持：
  - 创建用户时直接写入初始密码、角色、昵称、邮箱
  - 删除用户时同步清理该用户名下文件与关联分享
  - 防止删除当前登录管理员
  - 防止把系统里最后一个 `ADMIN` 一并降权或删除
- 管理员页面新增：
  - 新建用户表单
  - 用户删除按钮
  - 成功 / 失败提示

### 2. 管理后台入口改为隐藏路径

- 新增：
  - `AdminConsoleProperties`
  - `AdminConsoleAccessService`
  - `AdminConsoleController`
- 管理后台壳页面不再直接通过公开 `admin.html` 暴露，而是改为：
  - `/console/{slug}`
- 当前 `slug` 来源为：
  - 配置默认值 `app.admin-console.slug`
  - 或 `system_setting` 中的管理员覆盖值
- `SecurityConfig` 现已显式拒绝直接访问 `/admin.html`
- 首页 / 网盘 / 管理页中的“管理后台”入口不再写死 `admin.html`，改为先读取后端当前生效入口，再跳转到正确路径
- 管理员页面新增“后台入口”配置卡片，可直接修改隐藏入口；保存后当前页面会自动切到新路径

### 3. 注册与验证设置接入后台

- 新增：
  - `RegistrationProperties`
  - `RecaptchaProperties`
  - `RegistrationSettingsPolicy`
  - `RegistrationSettingsService`
  - `PublicSettingsController`
- 管理员接口新增：
  - `GET /api/admin/settings/registration`
  - `PUT /api/admin/settings/registration`
- 公开只读接口新增：
  - `GET /api/public/registration-settings`
- 当前注册相关运行时设置已支持后台维护：
  - 是否启用邮箱验证码注册
  - 是否启用 reCAPTCHA
  - reCAPTCHA site key
  - reCAPTCHA secret key
  - reCAPTCHA verify URL
- `AuthController` 已改为按当前注册设置决定是否强制校验邮箱验证码
- `VerificationCodeServiceImpl` 已改为按当前注册设置决定：
  - 是否允许发送邮箱验证码
  - 是否要求先通过 reCAPTCHA

### 4. 注册页改为读取运行时配置

- `register.html` 移除了写死的 reCAPTCHA 初始化脚本和站点 key
- `register.js` 现在会先读取 `/api/public/registration-settings`
- 页面行为已改为跟随当前后台设置：
  - 关闭邮箱验证码后：
    - 隐藏发送验证码按钮
    - 隐藏验证码输入区
    - 注册时不再强制要求邮箱和验证码
  - 关闭 reCAPTCHA 后：
    - 不再加载 Google reCAPTCHA 脚本
    - 不再显示验证码组件
  - 开启 reCAPTCHA 且 key 完整时：
    - 才动态加载脚本并渲染组件

### 5. Docker / 本地测试默认值继续收口

- 配置新增：
  - `ADMIN_CONSOLE_SLUG`
  - `REGISTRATION_EMAIL_VERIFICATION_ENABLED`
- 当前 `compose.yaml` / `.env.example` 默认更偏向本地测试：
  - `ADMIN_CONSOLE_SLUG=quickshare-admin`
  - `REGISTRATION_EMAIL_VERIFICATION_ENABLED=false`
  - `RECAPTCHA_ENABLED=false`
- 这意味着本地起栈后：
  - 可直接通过隐藏路径进入后台
  - 不配置 SMTP / reCAPTCHA 也能先完成注册和后台联调

## 当前可复用的开发基线

- Office 文档预览链路：
  - LibreOffice headless 转 PDF
  - 同源 PDF.js 查看器承接 PDF / Office
- 管理员后台当前已可管理：
  - 概览
  - 用户角色
  - 新增用户
  - 删除用户
  - 文件强制删除
  - 分享失效
  - 频控策略
  - 上传策略
  - 预览策略
  - CORS
  - 管理后台隐藏路径
  - 注册与验证设置
- 启动期管理员账号自举、隐藏后台入口、运行时策略覆盖、公开注册页动态配置，这几条已经形成统一模式：
  - 配置文件默认值
  - `system_setting` 管理员覆盖值
  - 前端页面运行时读取

## 回归验证

- 里程碑 1：管理员新增 / 删除用户
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminServiceImplTest,AdminControllerTest test`
  - `node --check src/main/resources/static/js/admin.js`
- 里程碑 2：隐藏管理后台路径
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminPolicyServiceImplTest,AdminControllerTest,AdminConsoleControllerTest test`
  - `node --check src/main/resources/static/js/admin.js`
  - `node --check src/main/resources/static/js/session.js`
  - `node --check src/main/resources/static/js/auth.js`
  - `ruby -e "require 'yaml'; YAML.load_file('compose.yaml'); puts 'compose.yaml OK'"`
- 里程碑 3：注册 / 邮箱验证码 / reCAPTCHA 设置后台化
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminPolicyServiceImplTest,AdminControllerTest,AdminConsoleControllerTest,RegistrationSettingsServiceImplTest,PublicSettingsControllerTest test`
  - `node --check src/main/resources/static/js/register.js`
  - `node --check src/main/resources/static/js/admin.js`
  - `node --check src/main/resources/static/js/session.js`
- 全量回归
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`
  - `node --check src/main/resources/static/js/lang-switch.js`
  - `ruby -e "require 'yaml'; YAML.load_file('compose.yaml'); puts 'compose.yaml OK'"`

## 关键文件入口

- 管理员用户管理：
  - `src/main/java/com/finalpre/quickshare/controller/AdminController.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/AdminServiceImpl.java`
  - `src/main/resources/static/admin.html`
  - `src/main/resources/static/js/admin.js`
- 管理后台隐藏入口：
  - `src/main/java/com/finalpre/quickshare/controller/AdminConsoleController.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/AdminConsoleAccessServiceImpl.java`
  - `src/main/java/com/finalpre/quickshare/config/SecurityConfig.java`
  - `src/main/resources/static/js/session.js`
  - `src/main/resources/static/js/auth.js`
  - `src/main/resources/static/netdisk.html`
- 注册与验证后台化：
  - `src/main/java/com/finalpre/quickshare/controller/PublicSettingsController.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/RegistrationSettingsServiceImpl.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/VerificationCodeServiceImpl.java`
  - `src/main/java/com/finalpre/quickshare/controller/AuthController.java`
  - `src/main/resources/static/register.html`
  - `src/main/resources/static/js/register.js`
- 部署默认值：
  - `compose.yaml`
  - `.env.example`
  - `src/main/resources/application.yml`
  - `src/main/resources/application-prod.yml`

## 当前边界与注意事项

- 隐藏后台路径只是“降低暴露面”，不是权限替代；真正鉴权仍然依赖服务端 `ADMIN` 角色
- `reCAPTCHA` 当前只有在“后台开关开启且 key 完整”时才视为真正启用
- 邮箱验证码关闭后，注册页会放开邮箱 / 验证码步骤；这适合本地联调，不适合直接照搬生产
- 当前 reCAPTCHA secret key 会跟其他后台策略一样写入 `system_setting`；若后续要更高安全级别，需要单独做加密或外部密钥托管
- 当前环境仍没有可执行的 Docker，虽然代码和配置已经过校验，但这轮仍未做真实 `docker compose up --build -d` smoke test

## 下次续做建议

1. 在真实 Docker 环境补一轮 smoke test，重点验证：
   - LibreOffice Office 预览
   - 隐藏后台路径切换
   - 注册页在“邮箱验证码关闭 / reCAPTCHA 关闭”下的真实表单行为
2. 继续把 SMTP 运行时配置、邮件模板、公告通知收口到管理员后台
3. 决定是否把 reCAPTCHA secret / SMTP 密码这类敏感值改成加密存储或只保留环境变量引用
4. 评估是否把同一套 PDF.js 查看器继续接到公开分享页，减少两套预览行为分叉
