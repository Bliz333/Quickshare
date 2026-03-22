# 2026-03-21 QuickDrop 页面减法、记录抽屉与单入口选择

## 目标

- 继续把 `quickdrop.html` 从“功能堆叠页”收口成“上来十秒能懂”的主流程页。
- 让临时互传和“我的设备”都优先呈现单一路径，而不是把解释、状态、记录、设置同时摊在首屏。

## 本轮改动

- `quickdrop.html` 继续做页面减法：
  - 顶部入口收窄，只保留 `QuickShare / 网盘 / 主题 / 语言`
  - Hero 去掉步骤条，标题和副标题改成更短的一句话
  - 模式切换压成更紧凑的双按钮
- 临时互传区继续收口：
  - 由左右信息堆叠改成单列主路径
  - 保留“你的码 / 输入对方的码 / 已连到谁 / 选择内容 / 发出去”
  - 历史记录从页内折叠区改为底部抽屉，不再长期占主页面高度
- 同账号设备区继续收口：
  - 设备选择继续保留目标舞台
  - 设备改名入口默认折叠成次级按钮
  - 收发记录同样改为底部抽屉
- 文件选择入口继续收口：
  - `quickdrop.html` 和 `quickdrop-direct.js` 现在都改成单个“选择内容”主入口
  - 点击后展开一个轻量菜单，再选“文件 / 文件夹”
  - 不再把“选择文件 / 选择文件夹”两个并列按钮长期摆在主发送区
- `quickdrop.js` 继续补状态控制：
  - 新增设备设置折叠状态
  - 新增同账号内容选择菜单开合状态
  - 历史抽屉已改成独立层，不再在每次 `sync/render` 时被误清空
- `quickdrop-direct.js` 同步补了配对直传侧的内容选择菜单开合逻辑。
- `tests/e2e/quickdrop.spec.js` 已同步适配：
  - QuickDrop 页面统一走稳定导航 helper
  - 历史区域改成先展开抽屉再断言
  - 配对发送测试不再在打开历史抽屉的情况下点击主发送按钮

## 验证

- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./mvnw -q -DskipTests package -o`
- `docker compose up --build -d app`
- `curl -sS http://127.0.0.1:8080/api/health`
- `npx playwright test tests/e2e/quickdrop.spec.js`

## 当前结论

- QuickDrop 首屏现在更接近“模式先行 + 单一主操作”的思路，而不是把任务、设置、记录和技术状态同时摊开。
- 这轮仍然没有彻底做到 Snapdrop / PairDrop 那种“只看舞台，不看控件”的极限简化。
- 下一步如果继续收口，优先级应是：
  - 继续减少首屏文字和辅助标签
  - 让设备目标区更接近“点一个目标就发”
  - 评估把记录抽屉进一步独立成真正的次级页面
