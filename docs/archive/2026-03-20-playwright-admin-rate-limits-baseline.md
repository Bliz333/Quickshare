# 2026-03-20 Playwright 管理台频控策略基线

## 本轮目标

- 把管理台“安全”页中的频控策略表格纳入浏览器自动化
- 验证四个公开入口频控 scene 的渲染，以及单个 scene 的保存链路
- 在测试结束后恢复原始频控配置

## 本轮改动

- 新增 `tests/e2e/admin-rate-limits.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“安全”页
- 校验四个频控 scene 都已渲染到表格中：
  - `guest-upload`
  - `public-share-info`
  - `public-download`
  - `public-share-extract-code-error`
- 修改 `public-download` 的启用状态、最大次数和窗口秒数
- 点击当前行保存按钮，并通过 `GET /api/admin/settings/rate-limits` 回读验证结果
- 在 `finally` 中恢复原始频控策略

## 验证

- `node --check tests/e2e/admin-rate-limits.spec.js`
- `npx playwright test tests/e2e/admin-rate-limits.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台频控策略页已经纳入浏览器自动化基线
- 保存后页面刷新与管理接口回读结果保持一致
- 当前 Playwright 覆盖已经继续扩到第四条真实管理台配置链路
