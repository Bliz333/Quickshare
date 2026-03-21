# 2026-03-21 QuickDrop 直传中断回退与 TURN 配置收口

## 本轮目标

- 让同账号直传在“已经开始发送后又断掉”的情况下，不再直接卡死
- 把 TURN 配置从单地址写法收口到更适合生产部署的多地址写法

## 本轮实现

- `quickdrop.html` 主发送区现在已支持两级回退：
  - 发送前直连未就绪，自动回退服务器中转
  - 发送中途直连失败，也会自动切到服务器中转继续
- `quickdrop-direct.js` 已补发送上下文记录：
  - 已发分片数
  - 已确认分片数
  - 当前目标设备
- 直传切中转时，直传卡片会明确显示“正在切到服务器中转继续”
- QuickDrop TURN 配置已补多地址支持：
  - 新增 `QUICKDROP_TURN_URLS`
  - 仍兼容旧的 `QUICKDROP_TURN_URL`
  - `rtc-config` 现在会优先下发多条 TURN URL，便于同时提供 `udp/tcp`
- `.env.example` 和 `README.md` 已同步改成以 `QUICKDROP_TURN_URLS` 为主

## 当前边界

- 当前回退是“发送端自动继续”
- 还没有做到：
  - 接收端在同一任务视图下无感切换来源
  - 直传已收到的浏览器分片与服务器中转任务做统一去重 / 合并
  - 真正部署和验证一套生产可用的 TURN 服务

## 验证

- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest,QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- QuickDrop 现在已经具备“直传优先，但断了还能继续传完”的基本发送编排
- 下一步应优先继续补：
  - 真正部署 TURN
  - 直传 / 中转两条数据面的更细粒度统一
  - 更接近 PairDrop 的局域网发现与公网成功率优化
