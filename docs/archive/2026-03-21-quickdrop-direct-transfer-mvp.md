# 2026-03-21 QuickDrop 配对直传 MVP

## 本轮目标

- 把 QuickDrop 从“只有信令和匹配码骨架”推进到“配对后真的能浏览器直传文件”
- 保留现有同账号服务器中转和公开取件链接，不推翻前两轮稳定链路
- 给后续断点续传、TURN、中转回退编排和免配对同账号直连打好可复用的数据面基础

## 本轮实现

- `quickdrop-signal.js` 已补成真正可用的直连信令层：
  - `Offer / Answer`
  - `ICE candidate` 交换
  - 控制通道 `quickdrop-control`
  - 二进制数据通道 `quickdrop-file`
  - 更稳的直连状态同步与候选队列处理
- 新增 `src/main/resources/static/js/quickdrop-direct.js`
  - 配对直传文件发送
  - 浏览器内分片接收
  - 收到的分片持久化到浏览器存储
  - 重新配对后按缺失分片续传
  - 本地“直传接收箱”下载与删除
- `quickdrop.html` 已补“配对直传”卡片：
  - 显示当前配对端
  - 选择文件并直接发送
  - 查看直传接收箱
  - 同账号服务器中转链路继续保留
- `quickdrop-share.html` 已补“配对直传”卡片：
  - 匿名或登录用户都可用匹配码进入直传
  - 公开分享链接链路继续保留
- QuickDrop 直传默认开关已改为开启：
  - 默认下发 STUN 配置
  - 未配 TURN 时仍允许先跑局域网 / 可直连 NAT 场景

## 当前边界

- 现在已经是“可用的配对后浏览器直传 MVP”
- 但还不是最终形态，当前仍缺：
  - 同账号设备的免配对自动直连
  - TURN 部署与更强的公网成功率
  - 直连失败后自动切回服务器中转的统一编排
  - 浏览器端更大文件、更长时间传输下的性能调优
  - 直传文件“保存到网盘”的正式链路

## 验证

- `node --check src/main/resources/static/js/quickdrop-signal.js`
- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check src/main/resources/static/js/quickdrop-share.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest,QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- QuickDrop 已从“信令基础”进入“真实直传 MVP”阶段
- 现有能力已经同时覆盖：
  - 同账号服务器中转
  - 免登录公开取件链接
  - 匹配码配对后的浏览器直传
- 下一步应优先继续补：
  - 同账号免配对直连
  - TURN / 中转回退编排
  - 更完整的断点续传与浏览器端大文件稳定性
