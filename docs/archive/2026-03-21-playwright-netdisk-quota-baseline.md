# 2026-03-21 Playwright 网盘配额侧栏基线

## 本轮目标

- 把 `netdisk.html` 登录后的配额侧栏纳入浏览器自动化
- 验证昵称、VIP 状态、存储/下载配额和升级入口都能按当前用户资料正确渲染

## 本轮改动

- 新增 `tests/e2e/netdisk-quota.spec.js`

## 用例覆盖

- 通过 API 登录管理员并读取当前 `/api/profile`
- 预注入登录态与 `quickshare-lang=en`，避免语言和日期格式在不同环境下漂移
- 打开 `netdisk.html` 后校验：
  - 当前用户昵称
  - VIP 状态文本
  - 存储配额文案
  - 下载配额文案
  - 存储配额进度条宽度
  - `pricing.html` 升级入口文案与链接

## 验证

- `node --check tests/e2e/netdisk-quota.spec.js`
- `npx playwright test tests/e2e/netdisk-quota.spec.js`

## 结果

- 网盘侧栏配额/VIP 展示已经纳入浏览器自动化基线
- 当前 Playwright 覆盖已补到“登录态网盘页 -> 当前用户资料卡片 -> 升级入口”这一条真实页面链路
