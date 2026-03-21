# 2026-03-21 QuickDrop 同账号免配对直连与回退编排

## 本轮目标

- 让登录用户在同账号多设备之间不需要再手工输入匹配码
- 设备页选中目标设备后自动建立直连会话
- 主发送区优先使用浏览器直传，未就绪时自动回退服务器中转

## 本轮实现

- 新增同账号直连会话接口：
  - `POST /api/quickdrop/direct-sessions`
- 后端会校验：
  - 两台设备都属于当前账号
  - 当前设备和目标设备都已连上 QuickDrop 信令
- `pair-ready` WebSocket 事件已补 `peerDeviceId`
- `quickdrop.html` 现在会在选择同账号目标设备后自动尝试建立直连
- 主发送区 `开始发送` 现在改成：
  - 先等待目标设备的直连准备完成
  - 如果直连已就绪，直接调用浏览器直传
  - 如果直连暂未就绪，则自动回退原有服务器中转上传
- 直传模块已补“目标设备匹配校验”，避免把文件发到错误的当前配对端

## 当前边界

- 现在已经解决“同账号设备还要手工配对码”的问题
- 但当前回退仍主要覆盖“发送前路由选择”：
  - 直连未就绪时自动回退中转
  - 直连传输中途失败后的自动接续编排还没补完
- TURN 仍未部署，公网复杂 NAT 场景成功率还需要继续提升

## 验证

- `node --check src/main/resources/static/js/quickdrop-signal.js`
- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest,QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- QuickDrop 现在已经具备：
  - 同账号免配对直连
  - 匹配码配对直连
  - 同账号服务器中转
  - 公开取件链接
- 下一步应优先继续补：
  - TURN
  - 直连中途失败后的自动接续 / 中转切换
  - 更接近 PairDrop 的局域网发现和更高公网成功率
