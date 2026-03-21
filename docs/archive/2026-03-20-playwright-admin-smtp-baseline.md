# 2026-03-20 Playwright 管理台 SMTP 基线

## 本轮目标

- 把管理台“邮件”页中的 SMTP 配置与测试发送纳入浏览器自动化
- 验证当前环境的 SMTP 配置可以被页面读取、保存，并触发真实测试邮件发送
- 不改动现有 SMTP 凭据本身，只复用当前运行态配置

## 本轮改动

- 新增 `tests/e2e/admin-smtp.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 读取当前 SMTP 运行态配置
- 在管理台“邮件”页验证表单已正确回填：
  - `host`
  - `port`
  - `username`
  - `senderAddress`
  - `starttlsEnabled`
  - `hasPassword`
- 点击页面“保存配置”，并通过 `GET /api/admin/settings/smtp` 回读验证当前值保持一致
- 点击页面“发送测试邮件”，在弹出的收件人输入框中填写当前 `senderAddress` 或 `username`
- 通过 `POST /api/admin/settings/smtp/test` 触发真实测试发送，并验证接口返回成功

## 验证

- `node --check tests/e2e/admin-smtp.spec.js`
- `npx playwright test tests/e2e/admin-smtp.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台 SMTP 配置页已经纳入浏览器自动化基线
- 当前环境的 SMTP 运行态配置可真实保存，并可从页面触发测试邮件发送
- 当前 Playwright 全量基线已更新为 `21 passed`
