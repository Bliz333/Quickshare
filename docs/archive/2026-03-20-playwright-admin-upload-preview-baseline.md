# 2026-03-20 Playwright 管理台上传/预览策略基线

## 本轮目标

- 把管理台“上传与预览”配置页纳入浏览器自动化
- 验证上传策略和预览策略的保存链路，并在测试后恢复原值

## 本轮改动

- 新增 `tests/e2e/admin-upload-preview.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台“上传与预览”页
- 上传策略：
  - 切换匿名上传开关
  - 启用并修改额外大小限制
  - 修改允许扩展名
  - 保存后通过 `GET /api/admin/settings/file-upload` 验证结果
- 预览策略：
  - 切换总开关和文本预览开关
  - 修改允许预览扩展名
  - 保存后通过 `GET /api/admin/settings/file-preview` 验证结果
- 在 `finally` 中恢复原始上传策略和预览策略

## 验证

- `node --check tests/e2e/admin-upload-preview.spec.js`
- `npx playwright test tests/e2e/admin-upload-preview.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台上传/预览策略页已经纳入浏览器自动化基线
- 当前 Playwright 覆盖面已经扩到第三条真实管理台配置链路
- 下一步更适合继续扩：
  - 管理台频控策略页
  - 管理台公告发送结果反馈
  - 更多保存后可通过公开或管理接口直接观测的后台配置页
