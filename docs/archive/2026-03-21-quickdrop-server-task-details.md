# 2026-03-21 QuickDrop 服务端任务详情与页内任务收口

## 本轮目标

- 让同账号 relay transfer 返回结构化 `task` 详情，而不再只给页面一组原始 transfer 字段
- 让 `quickdrop.html` 的 hybrid 任务详情弹窗优先消费结构化模型，不再主要靠前端临时字符串推断

## 本轮实现

- 新增 `QuickDropTaskVO` 和 `QuickDropTaskAttemptVO`
- `QuickDropTransferVO` 已补：
  - `direction`
  - `transferMode`
  - `peerDeviceId`
  - `peerLabel`
  - `task`
- `QuickDropServiceImpl` 现在会在 relay 返回里统一补出 `task`：
  - `taskKey`
  - `direction`
  - `transferMode`
  - `currentTransferMode`
  - `stage`
  - 对端设备信息
  - 当前 chunk 进度
  - relay attempt 列表
- `quickdrop.js` 现在会：
  - 优先消费服务端 `task`
  - 把本地 direct 记录归一成同一 task 形状
  - 在 hybrid 行里合并 relay/direct attempts
  - 在详情弹窗里显示 `current stage`、attempt 链路和 relay/direct 记录 ID

## 当前边界

- 这轮完成的是“服务端任务详情”
- 还没有做到真正的“服务端统一任务 ID”
- direct 任务目前仍主要保存在浏览器本地；hybrid 详情仍是“服务端 relay task + 本地 direct task”的页内合并

## 验证

- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js --grep "same-account merged task row exposes task details modal payload"`

## 当前结论

- QuickDrop relay 侧现在已经具备明确的结构化任务详情，不再只靠前端猜方向、对端和当前阶段
- 同账号页的详情弹窗也开始真正收口到“任务模型”，而不只是“显示合并后的一行”
- 下一步更合适的继续方向是：
  - 服务端原生统一任务 ID
  - direct / relay 状态回写继续下沉
  - 更大文件与真实公网双端验证
