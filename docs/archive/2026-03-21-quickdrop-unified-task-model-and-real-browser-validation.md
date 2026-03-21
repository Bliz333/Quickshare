# 2026-03-21 QuickDrop 统一任务模型、状态回写与真实双页验证

## 本轮目标

- 把 QuickDrop same-account 链路从“relay 有服务端 taskKey、direct 主要还在本地”推进到真正的服务端统一任务骨架
- 让 same-account direct 状态开始写回服务端
- 让 `quickdrop.html` 主列表优先按统一任务渲染
- 给这条链路补一条真实两页浏览器验证，而不再只依赖 mock

## 本轮实现

- 新增服务端统一任务骨架：
  - `quickdrop_task`
  - `quickdrop_transfer.task_id`
  - `V9__add_quickdrop_task_tables.sql`
- `QuickDropServiceImpl` 现在会：
  - 为 relay transfer 显式创建/关联服务端任务
  - 在 `sync` 中返回 `incomingTasks / outgoingTasks`
  - 在 relay `create / get / upload / download / save / delete` 时持续回写任务 attempt
- 新增 same-account direct 状态写回接口：
  - `POST /api/quickdrop/tasks/direct-attempts`
  - `DELETE /api/quickdrop/tasks/{taskId}/direct-attempts/{clientTransferId}`
- 新增任务级删除：
  - `DELETE /api/quickdrop/tasks/{taskId}`
- `quickdrop-direct.js` 现在会在 same-account 场景下：
  - 把 direct `sending / receiving / waiting_complete / relay_fallback / completed` 回写到服务端任务
  - 把 direct 下载 / 保存到网盘后的完成态继续写回
  - 对已完成或已转存记录按保留时长做浏览器端清理
- `quickdrop.html` 现在会：
  - 优先消费 `incomingTasks / outgoingTasks`
  - 用任务语义做详情和删除
  - 仅把旧的 relay/direct 数组归并保留为兼容兜底

## 验证

- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `node --check tests/e2e/quickdrop-real.spec.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `npx playwright test tests/e2e/quickdrop-real.spec.js`
- `./scripts/quickshare-smoke.sh`

## 真实结果

- same-account QuickDrop 现在已经具备服务端统一任务骨架，而不再只是“relay 在后端、direct 在前端”
- 本地真实两页浏览器验证已确认：
  - 两页真实传输可完成
  - 统一任务列表会落盘并可展示
- 当前 headless 本地环境下，最终任务模式仍可能收口到 `Relay`
  - 这说明“真实传输可达”和“稳定直连成功率”已经可以分开讨论
  - 后者继续留给 TURN / NAT / 直连成功率优化阶段

## 当前边界

- 当前 same-account 统一任务模型已覆盖 relay 和 signed-in direct
- 公开分享页 / 匿名配对直传还没有完全纳入同一套服务端任务模型
- 真实公网/TURN 双端验证仍待继续，不应把本地 headless 两页结果等同于公网直连成功率
