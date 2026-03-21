# 2026-03-20 Playwright 管理台订单页基线

## 本轮目标

- 把管理台“订单管理”页纳入浏览器自动化
- 验证订单 `pending -> paid -> refunded -> deleted` 的真实页面链路
- 验证标记支付会发放配额、退款会回滚配额
- 让测试数据在结束后可完整清理，不残留 `E2E` 订单

## 本轮改动

- 新增 `tests/e2e/admin-orders.spec.js`
- 新增后台订单删除能力：`DELETE /api/admin/orders/{orderId}`
- 管理台订单表为 `pending / expired / refunded` 订单新增删除入口

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 通过管理接口创建临时 `plan` 和 `payment provider`
- 通过 `/api/payment/create` 创建一笔真实 `pending` 订单
- 打开管理台“支付”页中的订单管理表格
- 在真实页面中执行：
  - `Mark Paid`
  - `Mark Refunded`
  - `Delete Order`
- 通过 `GET /api/admin/orders` 回读验证每一步状态变化
- 通过 `GET /api/profile` 验证：
  - 标记支付后存储配额增加
  - 退款后存储配额恢复原值
- 测试结束后自动清理：
  - `E2E Order Plan*` 对应订单
  - 临时 `plan`
  - 临时 `payment provider`

## 验证

- `node --check src/main/resources/static/js/admin.js`
- `node --check tests/e2e/admin-orders.spec.js`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/admin-orders.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台订单页已经纳入浏览器自动化基线
- 订单管理链路现在具备页面级“支付 / 退款 / 删除”闭环
- 当前 Playwright 全量基线已更新为 `20 passed`
