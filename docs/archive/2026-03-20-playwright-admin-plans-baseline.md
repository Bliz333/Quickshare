# 2026-03-20 Playwright 管理台套餐页基线

## 本轮目标

- 把管理台“套餐”页纳入浏览器自动化
- 验证套餐新增、编辑、删除三条真实页面链路
- 测试结束后自动清理 `E2E` 套餐数据，避免污染环境

## 本轮改动

- 新增 `tests/e2e/admin-plans.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“套餐”页
- 新增一个 `downloads` 套餐，并验证：
  - `POST /api/admin/plans` 返回成功
  - `GET /api/admin/plans` 能回读到新增结果
  - 页面列表和数量徽标同步更新
- 编辑刚创建的套餐，切换到 `vip` 套餐并更新数值、价格、排序和状态
- 通过自定义确认弹窗删除该套餐，并验证：
  - `DELETE /api/admin/plans/{id}` 返回成功
  - 接口回读和页面列表都已移除
- 在开始和结束时清理残留的 `E2E Plan*` 数据

## 验证

- `node --check tests/e2e/admin-plans.spec.js`
- `npx playwright test tests/e2e/admin-plans.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台套餐页已经纳入浏览器自动化基线
- 套餐的新增、编辑、删除页面链路都已形成可重复回归
- 当前 Playwright 全量基线已更新为 `19 passed`
