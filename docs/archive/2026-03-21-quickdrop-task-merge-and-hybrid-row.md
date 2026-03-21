# 2026-03-21 QuickDrop 任务归并与混合行视图

## 本轮目标

- 继续把 QuickDrop 从“技术链路并列展示”收口到“任务视图”
- 让同一文件在“直传后回退中转”时，不再在主发送记录里出现两条

## 本轮实现

- `quickdrop.js` 已补任务归并键：
  - 优先使用显式 `taskKey`
  - 无 `taskKey` 时，对“直传回退中转”场景继续用回退签名兜底归并
- 主发送记录现在支持混合任务行：
  - 同一文件先直传后切中转时，会显示成一条 `Direct -> Relay`
  - 不再把直传记录和中转记录拆成两条
- 主列表删除动作已补到分组语义：
  - 混合任务删除时会同时清理对应的中转记录和本地直传记录
- 直传任务记录已继续补 `taskKey`
  - 发送上下文
  - 本地持久化记录
  - 回退后的直传记录更新

## 当前边界

- 现在已经有“单行混合任务视图”
- 但仍未完全做到服务端统一任务模型：
  - 仍依赖前端本地归并
  - 服务端中转任务本身还没有原生 `taskKey`
  - 任务详情页和统一任务 ID 还没正式落地

## 验证

- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./mvnw -q -DskipTests compile`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- QuickDrop 主列表已经具备“同一任务一行”的初步形态
- 下一步应继续补：
  - 服务端原生任务 ID / taskKey
  - 统一任务详情视图
  - 直传 / 中转切换后的更完整状态回写
