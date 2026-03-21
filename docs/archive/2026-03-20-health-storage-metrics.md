# 2026-03-20 健康检查补充本地存储容量信息

## 本轮目标

- 让 `GET /api/health` 不再只返回 `storage: local|s3`
- 在本地存储模式下直接返回上传目录和磁盘容量信息，便于监控
- 修正“监控读取上传目录时会顺手创建目录”的语义问题

## 代码变更

- `src/main/java/com/finalpre/quickshare/config/FileConfig.java`
  - 新增 `getConfiguredUploadDir()`，用于读取原始配置路径
  - 保留 `getUploadDir()` 作为业务侧“需要目录存在时”的入口
- `src/main/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImpl.java`
  - 管理台存储运行态改为读取 `getConfiguredUploadDir()`
  - 目录不存在时仍可返回 `localUploadDirExists=false`，不会被检查动作自动修正
- `src/main/java/com/finalpre/quickshare/controller/HealthController.java`
  - 本地存储模式下新增：
    - `storageUploadDir`
    - `storageUploadDirExists`
    - `storageDiskTotalBytes`
    - `storageDiskUsableBytes`
  - 磁盘容量按“最近存在的父路径”读取，目录未创建时也能判断所在磁盘余量
- `src/test/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImplTest.java`
  - 覆盖“不自动创建缺失上传目录”的本地存储指标语义
- `src/test/java/com/finalpre/quickshare/controller/HealthControllerTest.java`
  - 覆盖本地模式返回容量字段
  - 覆盖 S3 模式下不返回本地磁盘字段

## 验证

- `git diff --check -- src/main/java/com/finalpre/quickshare/config/FileConfig.java src/main/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImpl.java src/main/java/com/finalpre/quickshare/controller/HealthController.java src/test/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImplTest.java src/test/java/com/finalpre/quickshare/controller/HealthControllerTest.java`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=AdminPolicyServiceImplTest,HealthControllerTest test`
- `docker compose up --build -d`
- `docker compose ps`
- `curl -sS http://127.0.0.1:8080/api/health`

## 烟测结果

- 当前 Docker 环境返回：
  - `storage:"local"`
  - `storageUploadDir:"/opt/quickshare/uploads"`
  - `storageUploadDirExists:true`
  - `storageDiskTotalBytes:1081101176832`
  - `storageDiskUsableBytes:1007505563648`
