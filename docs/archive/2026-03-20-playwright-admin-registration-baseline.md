# 2026-03-20 Playwright 管理台注册设置基线

## 本轮目标

- 把管理台“安全”页中的注册设置保存链路纳入浏览器自动化
- 验证验证码 provider 切换后的页面文案和公开设置同步
- 在测试结束后恢复原始注册配置

## 本轮改动

- 新增 `tests/e2e/admin-registration.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“安全”页并进入注册设置区域
- 读取当前注册设置作为恢复基线
- 切换 `captchaProvider`：
  - `Google reCAPTCHA`
  - `Cloudflare Turnstile`
- 校验 `Site Key` 标签文案和 `Verify URL` 提示会随 provider 切换
- 修改邮箱验证码开关、人机验证开关、`site key`、`secret key` 和 `verify URL`
- 点击保存后，通过 `GET /api/admin/settings/registration` 回读验证最新值
- 再通过 `GET /api/public/registration-settings` 验证公开接口已同步返回最新 provider 与 `site key`
- 在 `finally` 中恢复原始注册设置

## 验证

- `node --check tests/e2e/admin-registration.spec.js`
- `npx playwright test tests/e2e/admin-registration.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台注册设置页已经纳入浏览器自动化基线
- provider 切换后的页面文案、保存链路和公开设置同步都已验证
- 当前 Playwright 覆盖已经把“运行时注册策略 -> 公开注册页配置”这一条真实配置链路补齐
