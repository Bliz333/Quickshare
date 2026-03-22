# 2026-03-21 QuickDrop 记录页 Hash 导航与目标舞台强化

## 目标

- 让 QuickDrop 记录页不只是“看起来像次级页”，而是真正具备可返回、可直达的导航状态。
- 继续弱化“我的设备”里的普通列表感，让页面更像“当前设备 -> 目标设备 -> 发送”的投递首页。

## 本轮改动

- `quickdrop.js` 已补记录页 hash 导航：
  - `#temporary-history`
  - `#account-history`
- 记录页打开时，当前页面会同步更新 URL；浏览器后退会回到主页面，而不是继续停留在页内假状态。
- `tests/e2e/quickdrop.spec.js` 已新增：
  - same-account 记录页的 `hash` 导航
  - 浏览器 `back` 返回主舞台回归
- `quickdrop.html` 的“我的设备”区继续强化目标舞台：
  - 当前设备与目标设备之间增加更明显的投递流线
  - 目标设备卡在选中后继续强化为主焦点
  - 设备列表视觉继续压缩成“可选目标节点”，弱化传统卡片列表感

## 验证

- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./mvnw -q -DskipTests package -o`
- `docker compose up --build -d app`
- `curl -sS http://127.0.0.1:8080/api/health`
- `npx playwright test tests/e2e/quickdrop.spec.js`

## 当前结论

- QuickDrop 的记录页现在已经具备真实导航语义，而不是只靠覆盖层或局部显隐假装成“页面”。
- “我的设备”模式也比上一轮更接近投递流，而不是设备管理列表。
- 下一步若继续收口，最值得做的是：
  - 把记录页独立成单独 URL
  - 继续减少目标舞台里的辅助标签
  - 继续压缩临时互传中心卡里的解释性文字
