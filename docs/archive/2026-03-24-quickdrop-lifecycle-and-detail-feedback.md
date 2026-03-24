# 2026-03-24 QuickDrop 生命周期与详情补强

## 背景

- QuickDrop 的统一任务骨架、same-account 直传回写和 public `pair task` 页面视图已经具备，但任务详情仍主要停留在“模式 + 状态 + 进度 + 更新时间”。
- 这会导致用户和开发者都很难直接回答一次传输“为什么失败”“什么时候切到中转”“是否已经转存到网盘”。

## 本轮实现

- 后端任务与 attempt 语义补强：
  - `QuickDropTaskVO`、`QuickDropPairTaskVO`、`QuickDropTaskAttemptVO` 已补 `attemptStatus`
  - 新增开始/结束/失败原因字段，以及 `startTime`、`fallbackAt`、`failedAt`、`completedAt`、`savedToNetdiskAt`、`downloadedAt`
  - same-account `task` 与 public `pair task` 现在都从 attempt 列表汇总出统一的生命周期摘要
- 任务回写链路对齐：
  - `QuickDropDirectAttemptSyncRequest`、`QuickDropPairTaskSyncRequest` 已支持 `startReason / endReason / failureReason`
  - relay/direct attempt 在服务端落库时会保留起始原因，并根据完成、失败、回退行为自动补对应时间点
- 前端详情补强：
  - `quickdrop.html` 的任务详情和 `quickdrop-direct.js` 的配对任务详情现在会显示 lifecycle、start/end/failure reason、fallback 时间和“已转存到网盘”状态
  - 浏览器本地 direct 记录会保留这些字段并随服务端回写同步，避免只在 server task 里有语义、本地记录却丢失
  - 配对直传错误现在会区分“同账号失败后切中转”和“临时配对直接失败”，不再统一写成 `relay_fallback`

## 验证

- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropServiceImplTest,QuickDropPairingServiceImplTest test`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081 npx playwright test tests/e2e/quickdrop.spec.js`
  - 使用 `python3 -m http.server 8081 -d src/main/resources/static` 提供静态页面基线

## 结果

- QuickDrop 详情已能直接解释一次任务的生命周期，不再只显示粗粒度进度。
- same-account `task` 与 public `pair task` 的任务语义进一步收敛，但仍未完全统一到同一顶层模型。
- 下一步重点转向预发布 TURN / 公网验证、历史页产品化收口，以及任务筛选/分页等更高层体验问题。
