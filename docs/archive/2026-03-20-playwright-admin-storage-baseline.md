# 2026-03-20 Playwright 管理台存储页基线

## 本轮目标

- 把管理台存储页纳入浏览器自动化
- 验证运行态摘要、存储类型切换 UI、保存请求和连接测试请求
- 在不改变当前实际存储后端的前提下完成页面回归

## 本轮改动

- 新增 `tests/e2e/admin-storage.spec.js`

## 用例覆盖

- 通过 API 获取当前隐藏后台入口并注入管理员登录态
- 打开管理台存储页
- 校验运行态摘要与当前后端配置一致：
  - 本地模式显示上传目录和磁盘信息
  - S3 模式显示 bucket / endpoint / 连接状态
- 切换 `storageType` 下拉，验证 `s3Fields` 显隐逻辑
- 保存当前后端类型并确认：
  - `PUT /api/admin/settings/storage` 返回成功
  - `GET /api/admin/settings/storage` 仍保持原始类型
- 点击“测试连接”并确认：
  - 本地模式返回 `local`
  - S3 模式返回非空状态字符串

## 验证

- `node --check tests/e2e/admin-storage.spec.js`
- `npx playwright test tests/e2e/admin-storage.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 管理台存储页已经纳入浏览器自动化基线
- 当前 Playwright 覆盖面已经扩到第二条真实管理台配置链路
- 下一步更适合继续扩：
  - 管理台上传/预览策略页
  - 管理台频控策略页
  - 更多“保存后立即可观测”的后台配置场景
