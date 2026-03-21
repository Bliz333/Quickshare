# 2026-03-20 管理台总览显示本地容量风险

## 本轮目标

- 不让本地存储风险只停留在“存储页内可见”
- 让管理员进入后台后，在总览页就能立刻看到本地容量风险
- 继续复用已有风险级别和接口回归，而不是再造一套单独逻辑

## 代码变更

- `src/main/resources/static/js/admin.js`
  - 总览卡片新增稳定选择器 `data-overview-card`
  - 新增本地容量风险卡片：
    - 显示风险级别
    - 显示可用空间百分比
    - 显示本地上传目录
  - S3 模式下则改为显示存储运行态卡片
  - `refreshPolicySettings()` 取回存储策略后会重新渲染总览，避免先渲染概览再补存储数据时丢失卡片
- `src/main/resources/static/js/lang-switch.js`
  - 新增：
    - `adminStatStorageRisk`
    - `adminStatStorageRuntime`
- `tests/e2e/admin-storage.spec.js`
  - 新增总览页卡片断言
  - 继续沿用现有存储页回归，不额外拆一份重复用例

## 验证

- `git diff --check -- src/main/resources/static/js/admin.js src/main/resources/static/js/lang-switch.js tests/e2e/admin-storage.spec.js`
- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check tests/e2e/admin-storage.spec.js`
- `docker compose up --build -d app`
- `curl -sS http://127.0.0.1:8080/api/health`
- `npx playwright test tests/e2e/admin-storage.spec.js`

## 结果

- 管理台总览页已直接显示本地容量风险卡片
- 浏览器回归已确认：
  - 总览页风险卡片存在
  - 卡片显示的风险级别与接口返回一致
  - 存储页原有风险卡片和提示文案仍正常
