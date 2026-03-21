# 2026-03-20 Playwright 管理台邮件模板基线

## 本轮目标

- 把管理台“邮件”页中的模板配置纳入浏览器自动化
- 验证模板编辑、保存、重新回填和接口回读链路
- 在测试结束后恢复原始模板内容

## 本轮改动

- 新增 `tests/e2e/admin-email-templates.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“邮件”页
- 读取当前首个邮件模板和可用 locale
- 修改一个 locale 的主题和正文
- 保存后通过 `GET /api/admin/settings/email-templates` 回读验证结果
- 校验页面刷新后的输入框仍然回填为最新内容
- 在 `finally` 中恢复原始模板内容

## 验证

- `node --check tests/e2e/admin-email-templates.spec.js`
- `npx playwright test tests/e2e/admin-email-templates.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台邮件模板页已经纳入浏览器自动化基线
- 模板编辑后的页面回填与管理接口回读结果保持一致
- 当前 Playwright 全量基线已更新为 `17 passed`
