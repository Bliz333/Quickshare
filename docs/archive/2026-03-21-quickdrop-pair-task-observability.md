# 2026-03-21 QuickDrop 公开配对任务记录层

## 本轮目标

- 让 public / anonymous paired direct transfer 不再完全停留在浏览器本地
- 为公开配对页补一层服务端 `pair task` 记录，先解决可观测性和任务 ID 问题

## 本轮实现

- 新增：
  - `quickdrop_pair_task`
  - `V10__add_quickdrop_pair_task_table.sql`
  - `QuickDropPairTask`
  - `QuickDropPairTaskMapper`
  - `QuickDropPairTaskSyncRequest`
  - `QuickDropPairTaskVO`
- `QuickDropPairingServiceImpl` 现在已补：
  - `syncPairTask`
  - `deletePairTaskAttempt`
- 新增公开接口：
  - `POST /api/public/quickdrop/pair-tasks/direct-attempts`
  - `DELETE /api/public/quickdrop/pair-tasks/{taskId}/direct-attempts/{clientTransferId}`
- `quickdrop-direct.js` 现在会在 public / anonymous 配对场景下：
  - 把 direct attempt 写回服务端 `pair task`
  - 删除本地直传记录时同步删除服务端 pair attempt
- 直传接收箱现已补详情按钮，可查看：
  - `Direct Transfer ID`
  - `Pair Task ID`
  - `Pair Session`

## 验证

- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js --grep "receives a paired direct transfer and keeps it in the browser inbox|sends a paired direct transfer through the direct channel hooks"`
- `./scripts/quickshare-smoke.sh`

## 当前边界

- 这轮解决的是“公开配对直传的服务端记录层”
- 还没有把 `quickdrop-share.html` 做成 same-account 那种主任务列表
- 还没有把 public `pair task` 和 same-account `task` 收敛成一套统一顶层模型
