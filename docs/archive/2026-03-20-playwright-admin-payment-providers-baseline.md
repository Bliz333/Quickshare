# 2026-03-20 Playwright 管理台支付商户页基线

## 本轮目标

- 把管理台“支付商户”页纳入浏览器自动化
- 验证商户新增、编辑、删除三条真实页面链路
- 验证编辑时留空密钥会保留现有商户密钥

## 本轮改动

- 新增 `tests/e2e/admin-payment-providers.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“支付”页
- 新增一个支付商户，并验证：
  - `POST /api/admin/payment-providers` 返回成功
  - `GET /api/admin/payment-providers` 能回读到新增结果
  - 页面列表和数量徽标同步更新
- 编辑刚创建的商户，更新名称、API 地址、PID、支付方式、排序和启用状态
- 编辑时保持密钥输入框为空，并通过接口回读确认 `hasKey` 仍为 `true`
- 通过自定义确认弹窗删除该商户，并验证：
  - `DELETE /api/admin/payment-providers/{id}` 返回成功
  - 接口回读和页面列表都已移除
- 在开始和结束时清理残留的 `E2E Provider*` 数据

## 验证

- `node --check tests/e2e/admin-payment-providers.spec.js`
- `npx playwright test tests/e2e/admin-payment-providers.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台支付商户页已经纳入浏览器自动化基线
- 商户的新增、编辑、删除页面链路都已形成可重复回归
- 编辑保留旧密钥的 UI 行为已经有了真实页面覆盖
