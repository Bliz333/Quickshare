# 2026-03-20 存储风险级别自动化回归

## 本轮目标

- 不让本地存储风险级别只停留在手工 `curl` 验证
- 让仓库内 smoke 脚本直接检查风险字段是否存在，以及管理台接口与健康检查是否一致
- 让浏览器自动化覆盖管理台存储页里的风险卡片和提示文案

## 代码变更

- `scripts/quickshare-smoke.sh`
  - 新增本地模式下的风险字段校验：
    - `storageDiskUsablePercent`
    - `storageDiskRiskLevel`
    - `localDiskUsablePercent`
    - `localDiskRiskLevel`
  - 新增一致性校验：
    - `storageUploadDir == localUploadDir`
    - `storageDiskRiskLevel == localDiskRiskLevel`
- `src/main/resources/static/js/admin.js`
  - 管理台存储运行态卡片新增稳定选择器：
    - `data-runtime-card`
    - `data-risk-level`
- `tests/e2e/admin-storage.spec.js`
  - 新增风险卡片断言
  - 新增风险提示文案断言
  - 新增页面展示结果与 `/api/health`、`/api/admin/settings/storage` 的一致性断言

## 验证

- `git diff --check -- src/main/resources/static/js/admin.js scripts/quickshare-smoke.sh tests/e2e/admin-storage.spec.js`
- `bash -n scripts/quickshare-smoke.sh`
- `node --check src/main/resources/static/js/admin.js`
- `node --check tests/e2e/admin-storage.spec.js`
- `docker compose up --build -d app`
- `docker compose ps`
- `./scripts/quickshare-smoke.sh`
- `npx playwright test tests/e2e/admin-storage.spec.js`

## 结果

- `./scripts/quickshare-smoke.sh` 已通过，并确认：
  - 本地模式下两个接口都返回风险字段
  - 上传目录和风险级别在两个接口之间一致
- `tests/e2e/admin-storage.spec.js` 已通过，并确认：
  - 管理台存储页已展示风险卡片
  - 风险卡片带稳定选择器，便于后续扩展回归
  - 页面提示文案会按当前风险级别切换
