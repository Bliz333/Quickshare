# 2026-03-26 远端部署基线固化、资源脚本与 bundle mirror fallback

## 目标

- 把当前测试机上的远端部署链路从“能用”推进到“可复现、可保护资源、可继续演进”。
- 避免再次退回无 `.git` 的纯源码快照目录。
- 把测试机磁盘 / 内存约束显式纳入默认流程。

## 本轮改动

### 1. 新增资源脚本

新增：

```bash
scripts/quickshare-resource-check.sh
```

能力：

- 输出磁盘、内存、Docker 占用快照
- 支持：

```bash
./scripts/quickshare-resource-check.sh --report-only
./scripts/quickshare-resource-check.sh --ensure
```

- `--ensure` 会在磁盘低于阈值时：
  - 清理临时 deploy bundle / snapshot 产物
  - 按需 `docker image prune -af`
  - 清理后再重新校验阈值

### 2. 强化 `deploy-preprod.sh`

新增能力：

- 本地 helper 缺失时，自动回退到原生：
  - `ssh`
  - `scp`
- 本地 `timeout` 缺失时，不再直接失败；改为告警并继续运行
- 新增：
  - `DEPLOY_REMOTE_MIRROR_DIR`
  - `DEPLOY_ENABLE_GIT_BUNDLE_FALLBACK`
  - `DEPLOY_MIN_DISK_MB`
  - `DEPLOY_MIN_MEM_MB`
  - `DEPLOY_PRUNE_DOCKER_ON_LOW_DISK`
  - `DEPLOY_CLEANUP_REMOTE_ARTIFACTS`
- 远端 fallback 优先级改为：
  1. 正常 Git remote 拉取
  2. `git bundle -> 服务器本地 bare repo/worktree`
  3. 纯源码 snapshot fallback

这意味着：

- 远端即使不能直接读取私有 GitHub 仓库，也会优先维持 git worktree 语义
- 不会一上来就退化成“解压源码快照目录”

### 3. 远端资源预检

`deploy-preprod.sh` 现在在真正构建前会做远端资源检查：

- 默认最小磁盘：`2048MB`
- 默认最小可用内存：`256MB`

如果磁盘低于阈值且允许清理，会自动：

- 删除远端 bundle / snapshot 传输产物
- `docker image prune -af`

## 远端验证

### 1. 代码与工作树

已在测试机上通过 bundle 更新服务器本地 bare repo：

```bash
/root/quickshare.git
```

并把 worktree 切到：

```bash
030f67c
```

### 2. 资源脚本验证

通过：

```bash
./scripts/quickshare-resource-check.sh --ensure --min-disk-mb 2048 --min-mem-mb 256
./scripts/quickshare-resource-check.sh --report-only
```

### 3. 远端重建与验收

通过：

```bash
docker-compose up --build -d --remove-orphans
./scripts/quickshare-smoke.sh
./scripts/quickshare-playwright-smoke.sh
```

说明：

- 手工等价流程里第一次 smoke 抢跑，撞上应用刚刚重启的时间窗，出现 `Connection reset by peer`
- 这不是业务失败，而是缺少 `wait_for_health`
- 按脚本真实逻辑补等健康恢复后，smoke 和 browser smoke 均通过

### 4. QuickDrop 结果

本轮 `quickdrop-real.spec.js`：

- 通过
- 但最终任务模式收口为：

```json
"transferMode":"relay"
```

结论：

- 远端部署与回归链路已经稳定
- QuickDrop 直连能力不是“不可用”，因为此前已经有过 `direct` 命中样本
- 当前真正未收口的是：
  - `direct` 命中是否稳定
  - 哪些网络条件会导致这轮直接掉到 `relay`

## 资源结果

本轮再次清理远端：

- deploy bundle
- deploy snapshot
- 未使用 Docker 镜像

最终快照：

- 磁盘可用约 `6.2GB`
- 使用率约 `60%`
- 可用内存约 `917MB`

## 结论

- 远端部署基线现在已经进入“可维护”状态：
  - 有资源检查
  - 有 bundle mirror fallback
  - 有 worktree 语义
  - 有构建后 smoke / browser smoke
- 下一轮更适合顺序切到“回归自动化扩展”，而不是继续花时间在同一条部署底座上来回手工试。
