# 2026-03-20 订单系统加固与套餐页同步记录

## 本轮目标

- 把订单系统从“主流程能跑”补到“状态机更安全、前端闭环更完整”
- 避免退款单被重复通知重新发放配额
- 让套餐页只展示当前商户真实支持的支付方式
- 给用户补上自己的订单历史入口

## 核心改动

### 后端

- `PaymentServiceImpl`
  - 创建订单前校验商户是否支持所选 `payType`
  - 支付通知只允许 `pending` / `expired` 进入成功处理
  - `refunded` 订单收到重复成功通知时直接忽略，不再重新发放配额
- `AdminServiceImpl`
  - 手工标记已支付时拒绝处理已退款订单
  - 手工标记退款时只允许 `paid` 订单进入，并同步回收已发放配额
- `QuotaService` / `QuotaServiceImpl`
  - 新增 `revokeQuota(PaymentOrder order)` 用于退款回收
- `PlanController`
  - 新增 `GET /api/public/payment-options`
  - 返回默认启用商户和其支持的 `payTypes`
- `PaymentController`
  - 保持通知接口失败时返回 `fail`
  - 用户订单列表和订单详情继续供套餐页 / 支付结果页消费

### 前端

- `pricing.html` / `pricing.js`
  - 新增支付方式能力展示区域
  - 新增“我的订单”区域，接通 `/api/payment/orders`
  - 下单时补上 `providerId`
  - 无可用商户时直接禁用购买按钮，避免点击后才在创建订单时报错
- `payment-result.js`
  - 保持 `pending` 自动轮询、手动刷新、状态切换提示
- `lang-switch.js`
  - 补齐套餐页、订单历史、支付方式能力展示的中英文文案

## 测试与验证

### 静态/编译

- `node --check src/main/resources/static/js/pricing.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check src/main/resources/static/js/payment-result.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=PlanControllerTest,PaymentServiceImplTest,AdminServiceImplTest test`

### Docker 烟测

- `docker compose up --build -d`
- `docker compose ps`
- `curl -sS http://127.0.0.1:8080/api/health`
- `curl -sS http://127.0.0.1:8080/api/public/payment-options`
- `curl -I http://127.0.0.1:8080/pricing.html`
- `curl -I http://127.0.0.1:8080/payment-result.html`
- 登录后检查：
  - `POST /api/auth/login`
  - `GET /api/payment/orders`
  - `GET /api/payment/order/{orderNo}`

## 本轮实际发现

- 当前 Docker 环境未启用支付商户，`GET /api/public/payment-options` 返回 `null`
- 因此这轮无法在本机完成“真实下单成功 -> 异步回调 -> 配额刷新”的完整页面回归
- 已补救的用户侧行为是：
  - 套餐页直接禁用购买入口
  - 不再把错误拖到创建订单请求时才暴露

## 剩余事项

- 在启用真实商户的环境补一轮完整支付成功 / 退款回调烟测
- 把 `downloads` 套餐额度接到真实下载扣减链路，补齐下载次数套餐语义
