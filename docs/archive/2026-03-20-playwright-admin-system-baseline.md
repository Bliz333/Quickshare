# 2026-03-20 Playwright 管理台系统页基线

## 本轮目标

- 把管理台“系统”配置页纳入浏览器自动化
- 验证 `CORS` 策略和隐藏后台入口路径的保存链路，并在测试后恢复原值
- 修正管理台 hash 导航与 `<base href="/">` 叠加后把隐藏后台路径折回根路径的问题

## 本轮改动

- 新增 `tests/e2e/admin-system.spec.js`
- 修正 `src/main/resources/static/js/admin.js` 中管理台 hash 更新逻辑，显式保留当前 `pathname`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“系统”页
- `CORS` 策略：
  - 修改允许来源、方法、请求头、凭证开关和缓存秒数
  - 保存后通过 `GET /api/admin/settings/cors` 回读验证结果
- 后台入口：
  - 修改 `entrySlug`
  - 保存后确认页面仍停留在新的隐藏后台路径，而不是被 hash 导航折回站点根路径
  - 通过 `GET /api/admin/settings/admin-console` 回读验证新路径
- 在 `finally` 中恢复原始 `CORS` 和后台入口配置

## 验证

- `node --check src/main/resources/static/js/admin.js`
- `node --check tests/e2e/admin-system.spec.js`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/admin-system.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台系统页已经纳入浏览器自动化基线
- 隐藏后台入口在页内 hash 切换和入口路径变更后都能继续保持真实隐藏路径
- 该轮落地时，Playwright 全量基线更新为 `15 passed`
- 下一步更适合继续扩：
  - 管理台频控策略页
  - 管理台邮件模板页
  - 更多保存后能直接通过管理接口回读验证的后台配置页
