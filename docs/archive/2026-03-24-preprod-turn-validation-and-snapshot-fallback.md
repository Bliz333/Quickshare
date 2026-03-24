# 2026-03-24 预发布 TURN 验证与源码快照回退部署

## 目标

- 用当前 `feature/hardening-plan` 在预发布机继续做一轮真实公网 / TURN 验证。
- 确认 `health`、`rtc-config`、远端 smoke、浏览器 smoke 和 same-account 真实双页链路。
- 判断当前预发布环境里的最终任务模式到底是 `direct` 还是 `relay`。

## 先发现的阻塞

- `deploy-preprod.sh` 在预发布机当前不能直接用，原因有两个：
  - `/root/quickshare` 不是 git 仓库
  - 预发布机没有访问私有 GitHub 仓库 `Bliz333/Quickshare` 的读取凭据
- 实测现象：
  - `deploy-preprod.sh` 先报 `remote directory is not a git repository: /root/quickshare`
  - 即使临时 `git init` 后，`git fetch https://github.com/Bliz333/Quickshare.git` 仍报 `could not read Username`
- 这说明当前预发布机只能继续沿用“源码上传式”回退路径，GitHub 拉取式部署还没真正落地到服务器。

## 本轮采用的临时路径

- 本地用 `git archive` 打出当前 `HEAD` 源码快照并上传到预发布机：
  - 目标源码 commit：`fd0ff0f`
- 在预发布机：
  - 先备份现有 `.env`
  - 将旧 `/root/quickshare` 移到 `quickshare.snapshot-20260324-223711`
  - 新建 `/root/quickshare`
  - 恢复 `.env`
  - 解压当前源码快照
  - 写入新的 `DEPLOYED_COMMIT`
  - `docker-compose up --build -d --remove-orphans`

## 验证结果

### 运行态

- `GET http://127.0.0.1:8080/api/health`
  - 返回 `UP`
  - 数据库 `UP`
  - Redis `UP`
  - 本地存储模式
- `GET http://127.0.0.1:8080/api/public/quickdrop/rtc-config`
  - 继续返回：
    - `stun:stun.l.google.com:19302`
    - `turn:quickshare.878877.xyz:3478?transport=udp`
    - `turn:quickshare.878877.xyz:3478?transport=tcp`
  - TURN 用户名仍为 `quickdrop`

### smoke

- `./scripts/quickshare-smoke.sh`
  - 通过
  - 支付、文件、分享、下载、批量移动/删除链路继续可用

### 浏览器 smoke

- `./scripts/quickshare-playwright-smoke.sh`
  - 通过
  - `tests/e2e/quickdrop-real.spec.js` 通过

### same-account 真实双页模式探针

- 额外补了一条一次性 real-browser 探针，直接读取发送页 `quickDropState.displayOutgoingTransfers[0].task`
- 结果：
  - `transferMode: "relay"`
  - `currentTransferMode: "relay"`
  - `stage: "ready"`
  - `attemptStatus: "waiting"`
  - attempt 列表里只有 relay attempt
- 结论：
  - 当前预发布环境里，same-account 真实双页传输“可以完成”
  - 但最终仍主要收口到 `relay`
  - 这轮没有验证到稳定 `direct` 命中

## 结论

- 预发布 TURN 配置本身还在正常下发，服务也可用。
- 当前最大的部署侧问题不是应用代码，而是：
  - 预发布机还没有私有 GitHub 仓库凭据
  - GitHub 拉取式部署尚未真正落地
- QuickDrop 侧当前最大的产品/技术问题也已经更明确：
  - “是否能传”已经验证通过
  - “是否能稳定直连而不是回退 relay”仍待继续攻克

## 下一步

1. 给预发布机补私有仓库读取凭据，恢复真正的 `deploy-preprod.sh` 工作流。
2. 继续做 same-account 真实双端公网 / NAT / TURN 直连命中率验证。
3. 增加一条可重复输出最终模式的真实链路探针，不再只看“测试通过”。
