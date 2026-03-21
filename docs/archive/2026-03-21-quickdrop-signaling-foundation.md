# 2026-03-21 QuickDrop 信令与匹配码基础

## 本轮目标

- 为 QuickDrop 补上真正朝 PairDrop / Snapdrop 方向演进所需的实时层基础
- 先实现 WebSocket 信令通道和临时匹配码配对
- 不在这一轮强行接完 WebRTC 直传，但把后续所需的信令骨架铺好

## 本轮实现

- 新增 WebSocket 依赖：
  - `spring-boot-starter-websocket`
- 新增 QuickDrop WebSocket 基础设施：
  - `QuickDropWebSocketConfig`
  - `QuickDropWebSocketHandshakeInterceptor`
  - `QuickDropWebSocketHandler`
- 新增信令服务：
  - `QuickDropSignalingService`
  - `QuickDropSignalingServiceImpl`
- 新增配对码服务：
  - `QuickDropPairingService`
  - `QuickDropPairingServiceImpl`
- 新增公开配对码接口：
  - `POST /api/public/quickdrop/pair-codes`
  - `POST /api/public/quickdrop/pair-codes/{code}/claim`
- 新增前端信令脚本：
  - `src/main/resources/static/js/quickdrop-signal.js`
- `quickdrop.html` 与 `quickdrop-share.html` 已补临时匹配卡片：
  - 信令连接状态
  - 生成匹配码
  - 输入匹配码加入
  - 已配对状态提示

## 当前边界

- 当前这一步只补到“信令层和匹配码基础”
- 还没有真正接入：
  - WebRTC Offer / Answer 协商页面流程
  - ICE candidate 交换与 NAT 穿透
  - STUN / TURN 配置
  - 本地网络自动发现
- 也就是说：
  - 现在已经具备“后续接 WebRTC 的骨架”
  - 还不是“已经实现 PairDrop 级直传”

## 验证

- `node --check src/main/resources/static/js/quickdrop-signal.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest,QuickDropServiceImplTest test`

## 当前结论

- QuickDrop 现在已经进入“实时配对主线”的基础阶段
- 这一步完成后，下一阶段可以直接接：
  - WebRTC offer / answer
  - ICE candidate
  - STUN / TURN
  - 配对后直传与中转回退协同
