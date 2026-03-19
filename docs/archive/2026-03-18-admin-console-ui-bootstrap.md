# 2026-03-18 管理员后台页面第一版

- 目标：把已经落好的管理员接口接到一个最小可用的静态后台页面上，先让管理员能直接查看概览、管用户、删文件、失效分享，同时为后续“限流 / CORS 策略接管”预留页面位置。

## 本轮完成内容

- 新增 `admin.html` + `js/admin.js`
  - 登录态校验
  - 仅 `ADMIN` 可进入，普通用户前端会被导回网盘页
  - 对接以下接口：
    - `GET /api/admin/overview`
    - `GET /api/admin/users`
    - `GET /api/admin/files`
    - `GET /api/admin/shares`
    - `PUT /api/admin/users/{userId}/role`
    - `DELETE /api/admin/files/{fileId}`
    - `PUT /api/admin/shares/{shareId}/disable`
- 首页登录态补管理员入口
  - `ADMIN` 用户登录后，在首页除“网盘主页”外会额外看到“管理后台”按钮
- 网盘页补管理员入口
  - 头部和侧边栏都新增管理员入口
  - 基于本地 `user.role` 控制显隐
- 语言包补齐管理员后台文案
  - 新增中英双语文本
  - 语言切换时会重绘后台动态表格与状态标签
- 后续策略区块预留
  - 页面中加入“策略接管预留”卡片
  - 明确下一步将把公开入口频控与 CORS 白名单接到管理员面板

## 权限模型保持不变

- 仍然只保留两层角色：
  - `USER`
  - `ADMIN`
- 不增加更多后台角色。
- 管理员继续视为最高权限，可管理所有内容。

## 交互边界

- 若未登录访问 `admin.html`，前端会跳转到 `login.html`
- 若当前账号不是 `ADMIN`，前端会提示无权限并跳回 `netdisk.html`
- 若管理员把自己降为 `USER`
  - 前端会清空本地登录态
  - 强制重新登录，避免页面继续持有旧角色上下文

## 涉及文件

- `src/main/resources/static/admin.html`
- `src/main/resources/static/js/admin.js`
- `src/main/resources/static/js/auth.js`
- `src/main/resources/static/netdisk.html`
- `src/main/resources/static/js/netdisk.js`
- `src/main/resources/static/js/lang-switch.js`

## 验证结果

- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/auth.js`
- `node --check src/main/resources/static/js/netdisk.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 当前限制

- 这一步只接了前端页面，没有新增“限流 / CORS 策略管理”后端接口。
- 目前仍无前端自动化测试，本轮只做了脚本语法检查与后端全量回归。

## 下一步建议

1. 开始为管理员面板补“频控策略 / CORS 策略”读取接口。
2. 明确策略存储来源，延续当前 provider 抽象，不要直接把配置写回执行链。
3. 补管理台对应的策略编辑区块和保存流程，再做一轮回归。
