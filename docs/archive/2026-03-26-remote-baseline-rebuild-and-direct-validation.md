# 2026-03-26 远端基线重建、direct 验证与资源回收

## 背景

- 当前真实功能基线已经不在本地旧 `main`，而在 `feature/hardening-plan`。
- 用户要求后续测试和部署都在远端服务器执行，本地只负责编辑和推送。
- 本轮接手时，测试机 `/root/quickshare` 只是一个无 `.git` 的源码快照目录，宿主机也缺 `java`、`mvn`、`node`。

## 本轮动作

### 1. 远端环境补齐

- 在 Debian 12 测试机安装：
  - `OpenJDK 17`
  - `Maven 3.8.7`
  - `Node 18.20.4`
  - `npm 9.2.0`

### 2. `/root/quickshare` 重建为 git 工作副本

- 先从本地生成 `git bundle`：

```bash
git bundle create /tmp/quickshare-20260326.bundle --all
```

- 将 bundle 上传到服务器。
- 备份服务器上的 `.env`。
- 将原 `/root/quickshare` 快照目录挪到时间戳快照目录。
- 在服务器创建本地 bare repo：

```bash
git clone --bare /root/quickshare-20260326.bundle /root/quickshare.git
```

- 再从 bare repo 检出正式工作副本：

```bash
git clone --branch feature/hardening-plan /root/quickshare.git /root/quickshare
```

- 恢复 `.env`，并写入 `DEPLOYED_COMMIT`。

结果：

- `/root/quickshare` 已成为正式 git 工作副本
- `/root/quickshare.git` 成为服务器本地镜像源
- 当前远端工作树提交为 `36591ea`

## 远端验证结果

### 1. 语法 / 编译

通过：

```bash
./scripts/check-js.sh
./mvnw -q -DskipTests compile
```

### 2. 定向 JUnit

通过：

```bash
./mvnw -q -Dtest=PlanControllerTest,PaymentServiceImplTest,AdminServiceImplTest,FileControllerTest,FileServiceImplTest,HealthControllerTest,LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,QuickDropServiceImplTest,QuickDropPairingServiceImplTest,UserServiceImplTest test
```

说明：

- 曾启动过一次完整 `./mvnw -q test`。
- 该运行并非业务失败，而是在只跑完少量 Spring Boot 测试类后被人工中断；`surefire` dump 显示是收到 `SIGINT/SHUTDOWN`，不是业务测试失败。
- 在当前 2G 内存、磁盘紧张的测试机上，本轮最终采用“定向 JUnit + smoke + browser smoke”作为验收口径。

### 3. 远端 Docker / smoke

通过：

```bash
docker-compose up --build -d --remove-orphans
./scripts/quickshare-smoke.sh
```

确认内容包括：

- `health`
- 登录与 `profile`
- 支付套餐/商户/订单状态机
- 文件夹管理
- 上传去重
- 私有下载
- 公开分享与下载
- 批量移动/删除

### 4. 远端 Dockerized Playwright

通过：

```bash
./scripts/quickshare-playwright-smoke.sh
```

默认执行：

```bash
tests/e2e/quickdrop-real.spec.js
```

本轮关键结果：

- same-account 双页真实浏览器传输最终命中：
  - `transferMode=direct`
  - `currentTransferMode=direct`
  - `attemptStatus=completed`
  - `endReason=peer_confirmed`
- 运行时信令状态：
  - `signalLoaded=true`
  - `signalConnected=true`
  - `signalDirectState=ready`
- RTC 配置状态：
  - `rtcHasTurn=true`
  - `rtcHasStun=true`
- 本轮 selected candidate pair：
  - `localCandidateType=host`
  - `remoteCandidateType=srflx`
  - `localProtocol=udp`
  - `remoteProtocol=udp`

结论：

- 这台测试机当前不再只是“真实双页可传输但最终回退 relay”。
- 已经存在可复现的真实 `direct` 命中样本。

## 资源使用与清理

### 清理前快照

```bash
df -h / /root
free -h
docker system df
```

关键数据：

- 磁盘：`15G` 总量，仅剩 `620MB` 可用，使用率 `96%`
- 内存：`1.9Gi` 总量，约 `594Mi` 可用
- Docker 未使用镜像可回收：约 `6.6GB`

### 执行的清理

- 删除本轮上传的 bundle：
  - `/root/quickshare-20260326.bundle`
- 删除本轮创建的临时快照目录：
  - `/root/quickshare.snapshot-20260326-010100`
- 执行：

```bash
docker image prune -af
```

### 清理后结果

- Docker 回收空间：`5.661GB`
- 磁盘恢复到：
  - 已用 `8.9G`
  - 可用 `6.2G`
  - 使用率 `60%`

## 本轮结论

- 远端测试机现在已经具备：
  - 正式 git 工作副本
  - 可重复的语法/编译/定向测试入口
  - 可重复的 Docker smoke
  - 可重复的 Dockerized 浏览器回归
- 当前 QuickDrop 远端真实链路已命中过 `direct`。
- 当前最需要继续补的不是“这台机器能不能直连”，而是：
  - 如何把不同网络条件下的直连命中率继续做稳
  - 如何把远端源码同步路径长期化，而不是再次退回快照目录
  - 如何在资源有限的测试机上维持持续可用的磁盘和内存余量
