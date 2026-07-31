# QuickShare 平台与部署边界

## 本地开发

直接运行需要 Java 17、MySQL 8 和 Redis 6+：

```bash
cp src/main/resources/application-local.example.yml src/main/resources/application-local.yml
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

`application-local.yml` 是本地文件，不应提交真实口令。默认服务端口为 8080；源码静态资源随应用直接提供。

## Docker Compose

推荐的全栈入口：

```bash
cp .env.example .env
docker compose up --build -d
curl -fsS http://127.0.0.1:8080/api/health
```

`compose.yaml` 服务：

- `app`：Spring Boot + LibreOffice，上传目录挂 `quickshare-uploads`；
- `mysql`：MySQL 8.4，数据卷 `mysql-data`；
- `redis`：Redis 7，AOF 数据卷 `redis-data`；
- `minio` / `minio-init`：仅 `s3` profile，提供本地 S3 兼容验证。

MySQL、Redis、MinIO 默认只绑定 `127.0.0.1`；`app` 默认绑定所有接口。生产若由 nginx 反代，应把 `APP_BIND_HOST` 收到回环或受控内网地址。

本地 MinIO：

```bash
docker compose --profile s3 up --build -d
```

并在 `.env` 配置 `STORAGE_TYPE=s3` 及对应 `S3_*` / `MINIO_*` 值。

## 配置真相源

- 可公开的变量清单与占位值：`.env.example`
- Spring 默认映射：`src/main/resources/application.yml`
- 容器接线：`compose.yaml`
- 管理台运行时 override：MySQL `system_setting`
- 真实环境值：gitignored `.env` 或 `.agents/local/`

最低生产机密包括 `DB_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`JWT_SECRET`、`SETTING_ENCRYPT_KEY`；按功能再加 SMTP、S3、支付、Google、TURN 凭据。`SETTING_ENCRYPT_KEY` 缺失会让已加密的运行时设置无法解密，不应临时换值启动。

Transfer 的 Spring 属性已使用 `app.transfer`，但环境变量为了兼容仍为 `QUICKDROP_*`。运维文档和部署配置必须以 `.env.example` 的实际名称为准。

## 健康与容量

`GET /api/health` 报告 database、redis、storage 与总体 `UP/DEGRADED`。本地存储还报告上传目录、总量、可用量、百分比和风险级别；S3 模式报告 endpoint、bucket 和连接状态。

```bash
./scripts/quickshare-resource-check.sh --ensure
./scripts/quickshare-smoke.sh
```

容量、备份与告警细节见 `docs/ops/capacity.md`。备份至少同时覆盖 MySQL 与实际文件 backend；只备份数据库不能恢复本地上传内容。

## 反向代理

nginx 需要：

- 转发 `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto`；
- `/ws/transfer` 的 HTTP/1.1 Upgrade 与长连接 timeout；
- 与 Spring multipart / file policy 一致的 body size 和长上传下载 timeout；
- HTTPS，使 auth cookie 获得 Secure 属性。

兼容 `/ws/quickdrop` 暂时仍可代理，但新配置以 `/ws/transfer` 为主。TURN/STUN 不经普通 nginx HTTP proxy，需独立开放对应 UDP/TCP/TLS 端口。

## 预发布

`scripts/deploy-preprod.sh` 是仓库现有的预发布工具，默认目标别名是 `quickshare-test`。它支持远端 git、git bundle mirror 和最后的 snapshot fallback，并在构建前检查资源、部署后检查 health / RTC，可选择运行 smoke 和 browser smoke。

```bash
DEPLOY_RUN_SMOKE=1 \
DEPLOY_RUN_BROWSER_SMOKE=1 \
./scripts/deploy-preprod.sh
```

目标、路径、SSH helper 和分支均可由脚本声明的 `DEPLOY_*` 变量覆盖。真实 host/key 只放 `.agents/local/` 或本机 SSH config，不写进仓库。

该脚本会改变远端预发布工作树和容器状态，只能对已授权测试目标使用。它不是生产发布抽象，也不应用于未确认的生产主机。

## 生产

首次单机部署见 `docs/ops/production-deployment.md`，TLS 示例见 `docs/ops/https-proxy.md`。生产建议：

- 明确的不可变提交 SHA / release tag；
- 数据库迁移与应用版本一起验证；
- 部署前备份，部署后 health + smoke；
- 回滚恢复已验证提交和兼容数据库状态，不在共享主线上 reset 历史；
- 本地存储只适合单机，扩容前迁到共享对象存储并处理 WebSocket 进程内状态。

生产发布、回滚、DNS/防火墙/systemd、密钥轮换与数据删除都属于不可逆/上线级动作，遵循全局授权边界。
