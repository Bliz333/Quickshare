# 2026-03-21 QuickDrop 公开配对页面级任务视图

## 本轮目标

- 把 public / anonymous paired direct transfer 从“服务端可观测”继续推进到“页面级任务视图”
- 让 `quickdrop-share.html` 和配对直传面板优先消费服务端 `pair task`，而不再只看浏览器本地 incoming 记录

## 本轮实现

- `QuickDropPairingServiceImpl` 现在已补：
  - `listPairTasks`
- 公开接口现在已具备完整的 public pair task 读写闭环：
  - `POST /api/public/quickdrop/pair-tasks/direct-attempts`
  - `GET /api/public/quickdrop/pair-tasks`
  - `DELETE /api/public/quickdrop/pair-tasks/{taskId}/direct-attempts/{clientTransferId}`
- `quickdrop-direct.js` 现在会：
  - 轮询当前 pair session 的服务端 `pair task`
  - 以服务端 `pair task` 为主，合并本地 direct transfer 能力后渲染页面任务卡片
  - 在页面上展示 incoming / outgoing 两个方向的当前配对任务，而不再只显示本地接收箱
  - 对 server-only public pair task 提供详情和删除动作
  - 对本地已有接收分片的 incoming task 继续提供下载动作
- `quickdrop-share.html` 与 `quickdrop.html` 的公开配对任务区域文案已改成任务视图语义，不再继续叫“直传接收箱”
- `tests/e2e/quickdrop.spec.js` 已新增：
  - server-only public pair task 页面渲染
  - server-only public pair task 详情
  - server-only public pair task 删除

## 验证

- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest test`
- `./mvnw -q -DskipTests compile`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js --grep "receives a paired direct transfer and keeps it in the browser inbox|sends a paired direct transfer through the direct channel hooks|loads paired tasks from the server task view and can delete a server-only pair task"`
- `npx playwright test tests/e2e/quickdrop.spec.js`

## 当前边界

- 这轮完成的是“公开配对页的 server-first pair task 页面视图”
- 还没有把 public `pair task` 和 same-account `task` 收成同一套顶层模型
- 还没有把更细粒度的 attempt 生命周期、错误原因和完成原因补到 public pair task 上
