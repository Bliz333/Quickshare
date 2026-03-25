# 2026-03-25 QuickDrop 本地基线恢复、直连重试与信令地址收口

## 目标

- 恢复本地 `docker compose` 运行态基线，重新拿回 `health` 和 smoke 验证入口。
- 收口 same-account 发送在“对端信令刚起但还没 ready”时过早回退 relay 的问题。
- 让工作区静态前端 (`localhost:8081`) 在本地开发/验证时也能把 QuickDrop WebSocket 连到真实后端 (`localhost:8080`)。
- 用 updated 前端重新执行 real-browser 探针，确认当前 same-account 真实链路到底停在哪一步。

## 运行态恢复

- 本地 `quickshare-app-1` 之前进入重启循环，日志显示 `UnknownHostException: mysql`。
- 进一步核对后确认并不是 `compose.yaml` 配置写错，而是运行中的 `quickshare-app-1` 容器丢失了对 `quickshare_default` 的网络 attachment。
- 通过：
  - `docker compose up -d --force-recreate app`
- 本地运行态恢复：
  - `GET /api/health` 再次返回 `UP`
  - `./scripts/quickshare-smoke.sh` 再次通过

## 本轮代码变更

### 1. same-account 发送前补短暂直连重试

- `quickdrop.js` 现在会在 `ensurePairWithDevice` 遇到短暂信令错误时补一小段重试，而不是第一次失败就立刻判死回退 relay。
- 当前识别为可重试的错误包括：
  - 包含“直连信令”的后端报错
  - `Signaling Offline`
  - `direct session failed`
- same-account 发送路径现在显式传入：
  - `pairRetryCount: 2`
  - `pairRetryDelayMs: 450`

### 2. QuickDrop WebSocket 地址跟随 `AppConfig.API_BASE`

- `quickdrop-signal.js` 过去总是按当前页面 `window.location.host` 组装 `/ws/quickdrop`。
- 这会导致：
  - 页面由 `localhost:8081` 静态服务器提供时
  - REST API 走 `AppConfig.API_BASE = http://localhost:8080/api`
  - 但 WebSocket 仍错误地连到 `ws://localhost:8081/ws/quickdrop`
- 现在已改为：
  - 优先从 `window.AppConfig.API_BASE` 解析协议和 host
  - 再回退到当前页面 origin
- 结果是本地工作区静态前端也能直接对真实后端验证 QuickDrop 信令，而不必等 Docker 镜像重建成功。

### 3. 浏览器回归补一条“短暂信令错误后重试成功”用例

- `tests/e2e/quickdrop.spec.js` 新增 same-account 用例：
  - 第一次 `ensurePairWithDevice` 返回“目标设备当前没有连上直连信令”
  - 第二次重试成功
  - 最终仍优先走 direct，不创建 relay transfer

### 4. real-browser 探针支持拆分页面地址与 API 地址

- `tests/e2e/quickdrop-real.spec.js` 现在支持：
  - `PLAYWRIGHT_BASE_URL`
  - `PLAYWRIGHT_API_BASE_URL`
- 同时新增输出：
  - `signalLoaded`
  - `signalConnected`
  - `signalDirectState`
  - `signalPeerDeviceId`
- 便于区分“页面没加载信令脚本”“信令没连上”“协商已启动但没 ready”等不同层次的问题。

## 验证结果

- 本地运行态：
  - `docker compose up -d --force-recreate app`
  - `curl http://127.0.0.1:8080/api/health`
  - `./scripts/quickshare-smoke.sh`
- 前端与页面回归：
  - `./scripts/check-js.sh`
  - `PLAYWRIGHT_BASE_URL=http://localhost:8081 npx playwright test tests/e2e/quickdrop.spec.js --reporter=line`
    - `16 passed, 1 skipped`
- same-account 关键发送路径：
  - `PLAYWRIGHT_BASE_URL=http://localhost:8081 npx playwright test tests/e2e/quickdrop.spec.js -g "same-account ..."`
    - `3 passed`
- real-browser 探针：
  - `PLAYWRIGHT_BASE_URL=http://localhost:8081 PLAYWRIGHT_API_BASE_URL=http://localhost:8080/api npx playwright test tests/e2e/quickdrop-real.spec.js --reporter=line`
    - 通过
    - 最终快照显示：
      - `transferMode: "relay"`
      - `signalConnected: true`
      - `signalDirectState: "negotiating"`
      - `rtcHasTurn: false`
      - `rtcHasStun: true`
      - `localCandidateTypes / remoteCandidateTypes` 仍全 0

## 结论

- 本地项目基线已经恢复，可继续执行 `health -> smoke -> Playwright`。
- updated 前端已经能在不重建 Docker 镜像的情况下，对真实后端执行 QuickDrop real-browser 探针。
- 当前 same-account 真实链路已经不再是“信令根本没连上”的黑盒问题，而是更明确地收敛到：
  - 只有 STUN、没有 TURN
  - 协商进入 `negotiating`
  - 候选仍没有形成
  - 最终回退 `relay`

## 下一步

1. 在本地或预发布补可用 TURN，再重跑同一条 real-browser 探针。
2. 继续观察 candidate type / selected pair 是否开始出现，而不是只看“最终能否传完”。
3. 若仍停在 `negotiating`，继续收集 `offer/answer/candidate` 事件与超时路径，而不是继续盲改 UI。
