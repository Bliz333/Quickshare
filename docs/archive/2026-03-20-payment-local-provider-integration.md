# 2026-03-20 本地环境支付商户联调与状态机回归

## 本轮目标

- 验证当前环境里真实默认商户已经接到套餐购买链路
- 在本地 `localhost` 不满足商户白名单时，仍然把订单状态机跑通
- 把“创建订单、异步通知、支付结果页状态、退款回滚、配额恢复”纳入脚本和浏览器自动化

## 代码变更

- `scripts/quickshare-smoke.sh`
  - 新增 `SMOKE_PAYMENT_FLOW`
  - 在已登录情况下自动创建临时套餐和临时支付商户
  - 真实调用 `/api/payment/create`
  - 本地按签名规则调用 `/api/payment/notify`
  - 继续验证：
    - `pending -> paid`
    - `paid -> refunded`
    - `storageLimit` 增加与回滚
    - 临时订单 / 商户 / 套餐清理
- `tests/e2e/pricing-payment.spec.js`
  - 新增真实默认商户跳转地址断言
  - 新增临时测试商户的本地签名 `notify` 回归
  - 新增支付结果页在 `paid` / `refunded` 下的真实页面断言

## 当前结论

- 当前环境默认商户已启用，`GET /api/public/payment-options` 返回：
  - `providerName: 富通`
  - `payTypes: wxpay, alipay`
- 真实下单已确认会生成商户域名跳转地址，并带上：
  - 本地 `notify_url`
  - 本地 `return_url`
- 由于当前仍是本机 `localhost` 环境，公网商户主动回调到本机这一条外部网络路径还不能算真实验证完成
- 但在应用内部，订单状态机和配额链路已通过本地签名 `notify` 跑通

## 验证

- `git diff --check -- scripts/quickshare-smoke.sh tests/e2e/pricing-payment.spec.js`
- `bash -n scripts/quickshare-smoke.sh`
- `node --check tests/e2e/pricing-payment.spec.js`
- `docker compose ps`
- `curl -sS http://127.0.0.1:8080/api/health`
- `./scripts/quickshare-smoke.sh`
- `npx playwright test tests/e2e/pricing-payment.spec.js`

## 结果

- `./scripts/quickshare-smoke.sh` 已确认：
  - 临时支付商户和临时套餐可完成 `create -> notify -> paid -> refund -> rollback -> cleanup`
- `tests/e2e/pricing-payment.spec.js` 已确认：
  - 真实默认商户会返回带本地回调参数的跳转地址
  - 临时测试商户可通过本地签名 `notify` 跑通 `paid` 和 `refunded`
  - `payment-result.html` 会正确展示真实订单状态
