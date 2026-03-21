# 2026-03-20 存储运行态可见性

## 本轮目标

- 让管理台存储页不只停留在“能配”，还要能看见当前本地空间和后端状态

## 本轮改动

- 扩展 `GET /api/admin/settings/storage` 返回值：
  - `localUploadDir`
  - `localUploadDirExists`
  - `localDiskTotalBytes`
  - `localDiskUsableBytes`
- 管理台存储页新增运行态摘要：
  - 当前后端
  - 连接状态
  - 本地上传目录或当前 bucket / endpoint
  - 本地可用空间 / 总容量

## 验证

- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=AdminPolicyServiceImplTest test`
- `docker compose up --build -d`
- `curl -sS http://127.0.0.1:8080/api/admin/settings/storage -H 'Authorization: Bearer <admin-token>'`

## 结果

- 当前本地环境返回：
  - `localUploadDir=/opt/quickshare/uploads`
  - `localUploadDirExists=true`
  - `localDiskTotalBytes` / `localDiskUsableBytes` 均已可见
