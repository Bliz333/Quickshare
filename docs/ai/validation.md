# QuickShare 验证决策表

## 原则

选择能覆盖改动风险的最小充分门禁。命令成功只证明对应层，不把 mock Playwright 当真实后端/WebRTC 证明，也不把一次历史远端结果当当前提交证明。

## 分级

| 改动 | 必跑 | 视风险追加 |
| --- | --- | --- |
| 纯 Markdown | 链接检查、敏感信息扫描、`git diff --check` | 文档中的命令做 `--help`/语法或源文件核对 |
| 单个 Java 业务点 | `./mvnw -q -DskipTests compile` + 最近 JUnit | `./scripts/release-ready.sh` |
| 共享 service / security / storage / migration | compile + 所有相关 JUnit | 全 Maven suite、Compose smoke |
| 单个 JS / 页面逻辑 | `./scripts/check-js.sh` + 最近 mock Playwright | `web-logic-regressions.spec.js` |
| 可见前端 | JS + Playwright + 浏览器桌面/移动自检 | Compose live backend、真实上传/登录 |
| Transfer / WebRTC / E2EE | JS、Transfer JUnit、`quickdrop.spec.js` | `quickdrop-real.spec.js`、TURN 网络实测 |
| 发布候选 | `./scripts/release-ready.sh` | `RELEASE_READY_FULL=1 ./scripts/release-ready.sh` |

## 常用命令

```bash
./scripts/check-js.sh
./mvnw -q -DskipTests compile
./mvnw -q -Dtest=SomeTest,OtherTest test
./scripts/release-ready.sh
```

完整运行态（会构建/启动 Compose、跑 API 与浏览器 smoke）：

```bash
RELEASE_READY_FULL=1 ./scripts/release-ready.sh
```

Playwright：

```bash
npm ci
npx playwright install chromium
npx playwright test tests/e2e/web-logic-regressions.spec.js
npx playwright test tests/e2e/quickdrop.spec.js
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:8080 \
npx playwright test tests/e2e/quickdrop-real.spec.js
```

## Java 测试选择

| 区域 | 优先测试 |
| --- | --- |
| 文件/文件夹/配额 | `FileControllerTest,FileServiceImplTest,QuotaServiceImplTest` |
| 预览 | `PreviewResponseWriterTest,TransferPreviewControllerTest,DefaultPreviewDeliveryTest,LibreOfficeOfficePreviewServiceTest` |
| Transfer | `TransferAttemptLedgerTest,TransferServiceImplTest,TransferPairingServiceImplTest,QuickDropLegacyRouteTest` |
| 登录/安全 | `ProdSecurityConfigurationValidatorTest,JwtUtilTest,UserServiceImplTest` |
| 管理台/策略 | `AdminControllerTest,AdminServiceImplTest,AdminPolicyServiceImplTest` |
| 支付 | `PlanControllerTest,PaymentControllerTest,PaymentServiceImplTest` |
| 健康/存储 | `HealthControllerTest,LocalStorageRuntimeInspectorTest` |

## CI 事实

`.github/workflows/ci.yml` 对 `main` PR 运行：

1. `scripts/release-ready.sh`、完整 Maven tests、JS syntax、package；
2. mock-only Playwright：notifications、netdisk quota、pricing/payment、Quick Transfer、registration captcha。

真实后端 admin 用例、文件拖拽/导航与 `quickdrop-real` 不在 GitHub mock job 内。CI 绿灯不能替代这些场景的运行态验证。

分支 push 只匹配 `main` 和 `feature/*`；`codex/*` 分支要通过 PR 事件获得完整 CI。

## 收尾证据

汇报实际执行的命令、结果与未覆盖风险。失败用例必须区分：代码失败、环境依赖缺失、网络/TURN 条件未命中和资源不足。任务起的 Compose、浏览器服务器与临时产物默认清理；为目视验收保留时明确说明。
