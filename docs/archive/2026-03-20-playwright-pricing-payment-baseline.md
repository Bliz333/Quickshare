# 2026-03-20 Playwright 套餐页与支付结果页基线

## 本轮目标

- 把 `pricing.html` 和 `payment-result.html` 从接口级 smoke 推进到页面级浏览器自动化
- 补齐用户交易页在“当前环境无支付商户”前提下仍可稳定验证的页面行为

## 本轮改动

- 新增 `tests/e2e/pricing-payment.spec.js`

## 用例覆盖

- 套餐页：
  - 已登录状态下注入会话
  - 套餐卡片数量与 `GET /api/public/plans` 一致
  - 当前环境 `GET /api/public/payment-options = null` 时，购买按钮保持禁用
  - 订单历史区能展示当前用户订单
  - 使用 route mock 验证支付弹窗和 `POST /api/payment/create` 成功跳转
- 支付结果页：
  - 带 `order_no` 参数时，页面能展示订单号、套餐名和状态样式
  - 不带 `order_no` 参数时，页面展示无订单回退态
  - 使用 Playwright route mock 验证 `pending -> paid` 自动轮询切换

## 验证

- `node --check tests/e2e/pricing-payment.spec.js`
- `npx playwright test tests/e2e/pricing-payment.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 套餐页和支付结果页已经纳入浏览器自动化基线
- 支付结果页的前端轮询状态机也已经有浏览器自动化覆盖
- 套餐页支付弹窗和创建订单跳转也已经有页面级回归
- 当前 Playwright 覆盖面已经从网盘文件管理扩展到用户交易页面
- 下一步更适合继续扩：
  - 注册页验证码 provider 切换
  - 启用真实商户后的真实下单跳转
  - 套餐页下单失败提示的页面级断言
