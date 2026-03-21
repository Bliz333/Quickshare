# 2026-03-21 QuickDrop 服务端原生 taskKey

## 本轮目标

- 把 QuickDrop 的统一任务归并从“纯前端本地映射”继续推进到“服务端原生字段”
- 让同账号中转任务在后端返回时就自带 `taskKey`

## 本轮实现

- `quickdrop_transfer` 已新增 `task_key`
- `QuickDropTransfer`、`QuickDropTransferVO`、`QuickDropCreateTransferRequest` 已补 `taskKey`
- `QuickDropServiceImpl#createTransfer` 现在会持久化请求里的 `taskKey`
- `quickdrop.js` 在创建同账号中转任务时，已把当前任务的 `taskKey` 一起发给后端
- 主列表归并现在优先使用服务端返回的 `taskKey`
  - 本地映射仅保留为兼容兜底
- Docker 初始化 schema 也已同步补 `task_key`

## 迁移处理

- 新增 `V8__add_quickdrop_transfer_task_key.sql`
- 由于当前 MySQL 环境不支持 `ADD COLUMN IF NOT EXISTS`，迁移 SQL 已改为兼容写法
- 本地开发库中遗留的失败 `V8` 记录已清理并重新迁移成功

## 验证

- `node --check src/main/resources/static/js/quickdrop.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropServiceImplTest,QuickDropPairingServiceImplTest test`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- QuickDrop 的统一任务模型已经开始真正进入后端，而不再只是前端拼出来的视图
- 下一步应继续补：
  - 服务端原生统一任务 ID
  - 统一任务详情视图
  - 基于预发布 TURN 的真实双端公网验证
