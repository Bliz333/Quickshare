# 2026-03-20 Playwright 拖拽回归基线

## 本轮目标

- 把网盘“拖拽移动”从手工点击验证推进到浏览器自动化回归
- 在现有 API/smoke 基线之外，补一条真实页面交互层测试

## 本轮改动

- 新增 `package.json`
- 新增 `playwright.config.js`
- 新增 `tests/e2e/netdisk-drag.spec.js`
- `.gitignore` 新增：
  - `node_modules/`
  - `playwright-report/`
  - `test-results/`

## 用例覆盖

- 通过 API 登录，向页面注入登录态
- 创建拖拽目标文件夹、源文件夹和测试文件
- 打开 `netdisk.html`
- 在真实页面列表视图中：
  - 把文件拖到目标文件夹
  - 把文件夹拖到目标文件夹
- 在真实页面选择模式中：
  - 选中多个文件/文件夹
  - 通过批量移动弹窗把它们移动到目标目录
  - 通过批量删除弹窗删除这些已移动对象
- 通过 API 轮询确认后端结果已生效
- 进入目标文件夹，确认 UI 中能看到被拖动的文件和文件夹
- 测试结束后递归清理临时目录

## 验证

- `node --check playwright.config.js`
- `node --check tests/e2e/netdisk-drag.spec.js`
- `npm install`
- `npx playwright install chromium`
- `npx playwright test tests/e2e/netdisk-drag.spec.js`

## 结果

- Playwright + Chromium 基线已经在当前工作区跑通
- 拖拽移动和选择模式批量操作现在都不再只依赖手工回归
- 下一步更适合继续扩：
  - 支付结果页和套餐页的页面级回归
  - 浏览器自动化与 `scripts/quickshare-smoke.sh` 的职责边界整理
