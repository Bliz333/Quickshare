# 2026-03-21 MinIO Smoke 复核与文档同步

## 本轮目标

- 复核顶层文档里仍写着“MinIO 下载内容一致性待修复”的结论是否还成立
- 用当前仓库内 smoke 基线直接验证 S3/MinIO 运行态下的真实上传/下载内容一致性
- 把缺失和过期的文档条目同步回当前真实状态

## 本轮核对

- 当前 `GET /api/health` 返回：
  - `storage: "s3"`
  - `storageEndpoint: "http://minio:9000"`
  - `storageBucket: "quickshare"`
  - `storageConnectionStatus: "connected"`
- 当前 `docker compose ps` 显示：
  - `quickshare-app-1` 运行中
  - `quickshare-minio-1` 运行中且健康检查通过

## 验证

- `docker compose ps`
- `curl -sS http://127.0.0.1:8080/api/health`
- `./scripts/quickshare-smoke.sh`

## 结果

- 当前工作树在 S3/MinIO 运行态下已重新通过仓库内 smoke
- `./scripts/quickshare-smoke.sh` 已实际跑到并通过以下内容一致性检查：
  - 登录态上传文件后，再下载自有文件并用 `cmp` 校验内容一致
  - 创建公开分享后，匿名下载内容与原始上传内容一致
  - 登录态公开下载内容与原始上传内容一致
- 因此，“MinIO 下载内容一致性仍待修复”已不再是当前真实状态，应从顶层文档移除
- 同步补齐了缺失的 `docs/archive/2026-03-20-playwright-admin-registration-baseline.md`
