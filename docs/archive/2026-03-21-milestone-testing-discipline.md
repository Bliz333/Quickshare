# 2026-03-21 小里程碑测试纪律与 CI 同步

## 本轮目标

- 把“每个小里程碑都要及时测试”落成仓库内可重复执行的默认入口
- 同步当前已验证的主线状态到顶层文档，避免文档结论滞后于工作树
- 让 CI 至少先跟上当前 JS 语法基线和 Maven Wrapper 入口

## 本轮改动

- 新增 `scripts/check-js.sh`
  - 统一检查 `src/main/resources/static/js/*.js`
  - 检查 `playwright.config.js`
  - 检查 `tests/e2e/*.js`
- 调整 `.github/workflows/ci.yml`
  - 增加 `actions/setup-node@v4`
  - Maven 命令统一改为 `./mvnw`
  - JS 语法检查改为调用 `./scripts/check-js.sh`
- 同步顶层文档
  - `README.md`
  - `docs/TESTING.md`
  - `docs/PLAN.md`
  - `docs/STATUS.md`
  - `docs/CHANGELOG.md`

## 本轮验证

- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=PlanControllerTest,PaymentServiceImplTest,AdminServiceImplTest test`
- `./mvnw -q -Dtest=FileControllerTest,FileServiceImplTest test`
- `./mvnw -q -Dtest=LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,HealthControllerTest test`
- `./scripts/quickshare-smoke.sh`
- `npx playwright test tests/e2e/netdisk-quota.spec.js`
- `npx playwright test tests/e2e/pricing-payment.spec.js`

## 当前结论

- 当前工作树的支付、文件管理、分享下载、网盘配额展示和套餐页/支付结果页主链路，已经再次通过一轮小里程碑验收
- 当前最值得继续补的，不是再写一批大功能，而是把“真实公网商户回跳”和“更多登录后页面 CRUD 回归”纳入自动化
- 文档现在已经明确要求：小里程碑不再允许只改代码不测试，也不允许只测试不更新文档
