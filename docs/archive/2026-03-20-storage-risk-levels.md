# 2026-03-20 本地存储容量风险级别

## 本轮目标

- 不再让管理台存储页和 `GET /api/health` 各自维护一套本地磁盘指标逻辑
- 在已有字节级容量信息之上，补充更直接的可用空间百分比和风险级别
- 让运维能直接看到“现在是否该清理、扩容或切到 S3”，而不是只看到一串字节数

## 代码变更

- `src/main/java/com/finalpre/quickshare/service/LocalStorageRuntimeInfo.java`
  - 新增本地存储运行态结构，统一承载目录、容量、百分比和风险级别
- `src/main/java/com/finalpre/quickshare/service/impl/LocalStorageRuntimeInspector.java`
  - 新增共享解析器，统一解析本地上传目录、最近存在父路径的磁盘容量、可用空间百分比和风险级别
  - 当前阈值：
    - `<= 15%`：`warning`
    - `<= 5%`：`critical`
- `src/main/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImpl.java`
  - 管理台存储页改为直接复用共享解析器
- `src/main/java/com/finalpre/quickshare/controller/HealthController.java`
  - 健康检查接口改为复用共享解析器
  - 本地模式新增：
    - `storageDiskUsablePercent`
    - `storageDiskRiskLevel`
- `src/main/java/com/finalpre/quickshare/vo/AdminStoragePolicyVO.java`
  - 新增：
    - `localDiskUsablePercent`
    - `localDiskRiskLevel`
- `src/main/resources/static/js/admin.js`
  - 管理台存储页运行态摘要新增“容量风险”卡片
  - 本地模式下按风险级别切换提示文案
- `src/main/resources/static/js/lang-switch.js`
  - 新增中英文风险级别和提示文案

## 测试

- `git diff --check -- src/main/java/com/finalpre/quickshare/service/LocalStorageRuntimeInfo.java src/main/java/com/finalpre/quickshare/service/impl/LocalStorageRuntimeInspector.java src/main/java/com/finalpre/quickshare/vo/AdminStoragePolicyVO.java src/main/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImpl.java src/main/java/com/finalpre/quickshare/controller/HealthController.java src/main/resources/static/js/admin.js src/main/resources/static/js/lang-switch.js src/test/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImplTest.java src/test/java/com/finalpre/quickshare/controller/HealthControllerTest.java src/test/java/com/finalpre/quickshare/service/impl/LocalStorageRuntimeInspectorTest.java`
- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,HealthControllerTest test`
- `docker compose up --build -d`
- `docker compose ps`
- `curl -sS http://127.0.0.1:8080/api/health`
- `POST /api/auth/login`
- `GET /api/admin/settings/storage`

## 烟测结果

- `GET /api/health` 返回：
  - `storageDiskUsablePercent: 93.1`
  - `storageDiskRiskLevel: "healthy"`
- `GET /api/admin/settings/storage` 返回：
  - `localDiskUsablePercent: 93.1`
  - `localDiskRiskLevel: "healthy"`
- 运行中的前端资源已确认包含：
  - `getStorageRiskLabel`
  - `getStorageRuntimeHint`
  - `adminStorageRuntimeRisk`
