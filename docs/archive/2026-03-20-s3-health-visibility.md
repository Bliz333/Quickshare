# 2026-03-20 S3 健康检查可见性

## 本轮目标

- 不让 `GET /api/health` 在 S3 模式下只返回一个 `storage:"s3"`
- 让监控侧能直接看到当前 bucket、endpoint 和连接状态
- 保持本地模式原有返回不被破坏

## 代码变更

- `src/main/java/com/finalpre/quickshare/controller/HealthController.java`
  - 新增 `DelegatingStorageService` 注入
  - 本地模式下继续返回本地磁盘指标
  - S3 模式下新增：
    - `storageConnectionStatus`
    - `storageBucket`
    - `storageEndpoint`
- `src/test/java/com/finalpre/quickshare/controller/HealthControllerTest.java`
  - 补充本地模式下 `storageConnectionStatus=local`
  - 补充 S3 模式下的 `connected / bucket / endpoint` 断言

## 验证

- `git diff --check -- src/main/java/com/finalpre/quickshare/controller/HealthController.java src/test/java/com/finalpre/quickshare/controller/HealthControllerTest.java`
- `./mvnw -q -Dtest=HealthControllerTest test`
- `curl -sS http://127.0.0.1:8080/api/health`

## 结果

- 本地模式保持不变，继续返回本地磁盘字段
- S3 模式现在可通过单测确认会返回：
  - `storageConnectionStatus`
  - `storageBucket`
  - `storageEndpoint`
