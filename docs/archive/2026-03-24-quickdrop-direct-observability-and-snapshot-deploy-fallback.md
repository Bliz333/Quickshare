# 2026-03-24 QuickDrop 直连诊断、历史页 route 与内部部署回退

## 目标

- 继续定位 same-account 真实双页为什么最终总收口到 `relay`
- 补一套可重复输出最终模式的 real-browser 探针
- 在当前私有/internal 测试阶段，让预发布部署不再被 GitHub 凭据阻塞
- 开始推进 QuickDrop 历史页从 hash 过渡到更稳定的页面路由

## 本轮实现

### 1. QuickDrop 直连诊断补强

- `quickdrop-signal.js` 已新增直连诊断快照：
  - `rtcHasTurn / rtcHasStun`
  - `connectionState / iceConnectionState / iceGatheringState / signalingState`
  - local / remote candidate type 与 protocol 统计
  - selected candidate pair
  - ready-timeout 事件
- 这些信息会随着 `QuickDropSignalManager.getState()` 一起暴露，供页面和 real-browser 探针读取。

### 2. same-account 未就绪回退保留 direct 语义

- 过去如果 same-account 在“真正发文件前”就判断 direct 未就绪，主任务往往只剩纯 relay 记录，看不出是否先试过 direct。
- 现在会主动写回一条 synthetic direct fallback attempt：
  - `status=relay_fallback`
  - `startReason=same_account_direct`
  - `failureReason` 会按当前诊断分成：
    - `direct_ready_timeout`
    - `signaling_unavailable`
    - `peer_mismatch`
    - `ice_connection_failed`
    - `no_relay_candidate`
    - `direct_link_unavailable`
- 这样后续 relay 任务仍能保留“先试直连再回退”的顶层语义。

### 3. real-browser 最终模式输出

- `tests/e2e/quickdrop-real.spec.js` 现在不再只验证“传输成功”：
  - 会打印最终 `transferMode / currentTransferMode / stage / attemptStatus`
  - 会打印 attempt 列表
  - 会带出 `directDiagnostics`
- 同时新增：
  - `EXPECT_QUICKDROP_FINAL_MODE`
- `scripts/quickshare-playwright-smoke.sh` 已把这个环境变量透传进 Dockerized Playwright。

### 4. 历史页 route 开始收口

- `quickdrop.html` 历史页的 canonical 路由开始改为：
  - `?view=temporary-history`
  - `?view=account-history`
- 旧的 `#temporary-history / #account-history` 仍兼容，但页面会自动替换成 query route。
- 浏览器返回主页面的页面级回归已同步更新并通过。

### 5. 内部部署回退路径

- `scripts/deploy-preprod.sh` 已新增源码快照回退路径：
  - 本地 `git archive`
  - 上传到预发布机
  - 远端保留 `.env`
  - 用时间戳目录留回退点
  - 再 `docker-compose up --build -d`
- 这条路径默认开启，适合当前私有/internal 测试阶段，不再要求预发布机先具备 GitHub deploy key / token。

## 本地验证

- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `bash -n scripts/deploy-preprod.sh`
- `bash -n scripts/quickshare-playwright-smoke.sh`
- `node --check tests/e2e/quickdrop-real.spec.js`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081 npx playwright test tests/e2e/quickdrop.spec.js`
  - `15 passed, 1 skipped`

## 预发布复核状态

- 已尝试用新的 `deploy-preprod.sh` 再跑一轮预发布验证
- 当前阻塞变成目标机不可达，而不是脚本逻辑错误：
  - `ssh ... port 22: Connection timed out`
  - `curl http://145.79.143.107:8080/api/health` 超时
- 所以本轮还没有拿到“应用这批新改动后”的第二轮 preprod 结果

## 结论

- 现在已经有足够的本地观测和脚本能力来解释“为什么回退 relay”
- same-account direct 的真实命中率问题已经从“黑盒”变成“可继续量化诊断”
- 下一步等预发布机恢复后，优先做：
  1. 再跑一次 `deploy-preprod.sh`
  2. 跑 real-browser 模式探针
  3. 根据输出继续调 same-account direct wait / fallback 时机
