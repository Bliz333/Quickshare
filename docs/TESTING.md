# QuickShare 测试与验收

> 验证的唯一决策表是 [`docs/ai/validation.md`](ai/validation.md)。本文件提供人工阅读版流程，不保存某次远端执行日志。

## 快速选择

### 纯文档

```bash
git diff --check
# 校验本次修改 Markdown 的相对链接
# 扫描真实 host、token、密钥与个人环境路径
```

### Java 改动

```bash
./mvnw -q -DskipTests compile
./mvnw -q -Dtest=NearestTest,RelatedRegressionTest test
```

共享 service、安全、存储、数据库迁移或跨多个 controller 的改动再运行：

```bash
./scripts/release-ready.sh
```

### 静态前端

```bash
./scripts/check-js.sh
npx playwright test tests/e2e/web-logic-regressions.spec.js
```

页面专属行为应把示例文件替换为 `tests/e2e/` 中实际存在的最近用例，不在命令中使用尖括号占位符。

共享前端 helper / clean route / session 改动追加：

```bash
npx playwright test tests/e2e/web-logic-regressions.spec.js
```

### Quick Transfer

```bash
./mvnw -q -Dtest=TransferAttemptLedgerTest,TransferServiceImplTest,TransferPairingServiceImplTest,QuickDropLegacyRouteTest test
./scripts/check-js.sh
npx playwright test tests/e2e/quickdrop.spec.js
```

需要证明真实后端登录、设备同步和双页设备发现时运行：

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:8080/api \
npx playwright test tests/e2e/quickdrop-real.spec.js
```

`quickdrop-real` 的文件名是兼容历史；当前用例只验证真实登录、两台设备注册/发现和发送选择器，不发送文件，也不证明 WebRTC DataChannel、relay fallback 或 TURN。涉及这些链路时，必须补真实双端传输验收或新增相应自动化用例；不能用该用例通过代替。

## Release-ready

默认门禁运行 JS syntax、Java compile、核心定向 JUnit 和 package：

```bash
./scripts/release-ready.sh
```

完整运行态会额外检查资源、重建 Compose、跑 API smoke 和 Dockerized browser smoke：

```bash
RELEASE_READY_FULL=1 ./scripts/release-ready.sh
```

完整门禁会改变本机 Docker 状态，适用于已配置的隔离开发/预发布环境。任务结束清理自己启动的临时资源；若保留给前端目视验收，汇报中写明入口与保留原因。

## GitHub CI 覆盖

`main` 的 pull request 运行：

- release-ready baseline
- 完整 Maven suite（测试 profile，关闭 Flyway）
- JS syntax
- Maven package
- mock Playwright：通知、网盘配额、支付、Quick Transfer、注册验证码

以下不由默认 CI 证明：

- 真实 MySQL/Redis/Flyway 启动
- S3/MinIO 与 LibreOffice 运行态
- 管理台 live 用例、真实文件上传/拖拽
- WebSocket/WebRTC/TURN direct
- 生产 nginx、TLS、磁盘与备份

## 结果判读

- 编译失败：Java API/类型/依赖问题。
- JUnit 失败：按测试路径判断业务回归，不用跳过测试掩盖。
- mock Playwright 通过：只证明页面逻辑与模拟 API，不证明服务端。
- live smoke 失败：区分应用、数据库、Redis、存储、代理和资源不足。
- direct 未命中：检查 RTC config、signal、ICE candidate 与 selected pair，再判断是缺陷还是网络限制。

最终汇报只写当前提交实际执行过的命令和结果，不引用 `docs/archive/` 的旧成功记录代替本轮证据。
