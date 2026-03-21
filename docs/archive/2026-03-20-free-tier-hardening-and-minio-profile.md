# 2026-03-20 免费层默认策略收紧与 MinIO 本地联调

## 本轮目标

- 把游客和免费用户的默认滥用面先收紧
- 修掉支付商户敏感字段直接打日志的问题
- 给本地 S3/MinIO 联调补一个真正可起栈的 `compose` profile
- 给新库补默认套餐档位，避免只靠手工初始化

## 代码变更

- `src/main/resources/application.yml`
  - MyBatis 日志实现改为 `Slf4jImpl`
  - 游客上传默认改为 `2 次 / 1 小时`
  - 新增 `basic-user-upload` 频控默认值
  - 新增 `app.upload.guest-max-size-bytes`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
  - 游客上传新增 `2GB` 单文件上限
  - 登录免费用户上传会额外经过轻量频控
- `src/main/java/com/finalpre/quickshare/service/impl/QuotaServiceImpl.java`
  - 默认免费层改为 `20GB` 存储、`500` 下载/月
  - `-1` 继续作为无限下载语义保留
  - 新增“是否仍在默认免费层”判断
- `src/main/java/com/finalpre/quickshare/service/impl/PlanBootstrapServiceImpl.java`
  - 空库时自动补默认套餐
- `compose.yaml`
  - 新增 `s3` profile
  - 新增 `minio` 和 `minio-init`
- `.env.example`
  - 新增 MinIO 和免费层默认限流示例
- `src/main/resources/db/migration/V5__free_tier_defaults.sql`
  - 提升用户默认免费层配额
  - 将历史免费用户从 `1GB / unlimited` 迁到 `20GB / 500`

## 测试

- `docker compose --profile s3 config`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=RequestRateLimitServiceImplTest,QuotaServiceImplTest,FileControllerTest,PlanBootstrapServiceImplTest,HealthControllerTest test`
- `docker compose --profile s3 up -d minio minio-init`
- `docker compose ps`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- 真实运行中的日志里已不再 grep 到 `merchant_key`
- 默认免费层和游客上传策略已收紧，主流程 `smoke` 通过
- 本地 MinIO profile 已成功起栈，`quickshare` bucket 会自动初始化
- 最新本地 MinIO 联调结果：
  - 连接测试通过
  - 上传成功
  - 删除成功
  - 下载内容一致性当时尚未完成最终复核，已在 2026-03-21 的 S3 smoke 复核中确认通过

## 后续跟进

- 2026-03-21 已在当前 `S3/MinIO` 运行态下重新执行 `./scripts/quickshare-smoke.sh`
- 当前 smoke 已通过自有文件下载、匿名公开下载和登录态公开下载的内容一致性校验
- 详见：`docs/archive/2026-03-21-minio-smoke-revalidation-and-doc-sync.md`
