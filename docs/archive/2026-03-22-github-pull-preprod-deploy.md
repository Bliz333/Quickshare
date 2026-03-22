# 2026-03-22 GitHub 拉取式预发布部署

## 本轮目标

- 将预发布部署从“本地打包上传”改为“服务器直接从 GitHub 拉取指定分支”
- 把 `docker compose up --build -d` 变成真正可从新鲜 Git checkout 直接完成的标准路径
- 将回滚收口为 commit 级恢复，而不是继续维护临时归档包流程

## 本轮改动

### 1. Docker 构建链路自举化

- `Dockerfile` 已改为多阶段构建：
  - builder 阶段使用 Maven + JDK 17 直接执行 `./mvnw ... package`
  - runtime 阶段使用 `eclipse-temurin:17-jre-jammy`
  - 继续内置：
    - `libreoffice-core`
    - `libreoffice-writer`
    - `libreoffice-calc`
    - `libreoffice-impress`
    - `fonts-noto-cjk`
    - `fonts-dejavu-core`
    - `fontconfig`
- `compose.yaml` 已移除循环依赖式 `APP_BASE_IMAGE` 参数
- `.dockerignore` 已补 `target/`、`playwright-report/`、`test-results/`

结论：

- 现在不需要宿主机先产出 `target/*.jar`
- 新鲜 Git checkout 可直接 `docker compose up --build -d`

### 2. 预发布部署改为 GitHub 拉取

- `scripts/deploy-preprod.sh` 现在会：
  - SSH 到测试服务器
  - 进入 `/root/quickshare`
  - `git fetch --prune`
  - 切到目标分支并 `git reset --hard origin/<branch>`
  - `git clean -fdx -e .env`
  - 执行 `docker compose up --build -d --remove-orphans`
- 默认部署当前本地分支名
- 若需显式部署主线，可传：

```bash
DEPLOY_GIT_BRANCH=main ./scripts/deploy-preprod.sh
```

### 3. 回滚与后验收

- 仅在以下失败时自动回滚到部署前 commit：
  - `docker compose up --build -d` 失败
  - `health` 恢复失败
- 以下后验收失败不会自动回滚，只会返回非零并保留现场：
  - `rtc-config` 失败
  - `quickshare-smoke.sh` 失败
  - `quickshare-playwright-smoke.sh` 失败

## 标准命令

```bash
./scripts/deploy-preprod.sh
DEPLOY_RUN_SMOKE=1 ./scripts/deploy-preprod.sh
DEPLOY_RUN_SMOKE=1 DEPLOY_RUN_BROWSER_SMOKE=1 ./scripts/deploy-preprod.sh
DEPLOY_GIT_BRANCH=main DEPLOY_RUN_SMOKE=1 DEPLOY_RUN_BROWSER_SMOKE=1 ./scripts/deploy-preprod.sh
```

## 取舍说明

- 暂未切到镜像仓库发布
  - 原因不是做不到，而是当前单机预发布环境里，GitHub 拉取式部署足够直接，额外引入镜像仓库只会增加 CI、镜像 tag、凭据和回滚管理复杂度
- 暂不再维护本地打包上传式部署
  - 它会放大 `scp/sftp` 稳定性问题
  - 与当前“代码唯一来源是 GitHub”这一原则不一致

## 当前结论

- 预发布部署的最短路径现已明确：
  - GitHub 是唯一代码源
  - 服务器直接拉代码
  - Docker 自己完成构建
  - 部署后统一跑 `health / rtc-config / smoke / browser smoke`
- 后续更值得投入的是：
  - 合并回 `main` 的分支收口
  - QuickDrop 生命周期细化
  - 支付真实回跳与更多页面级回归
