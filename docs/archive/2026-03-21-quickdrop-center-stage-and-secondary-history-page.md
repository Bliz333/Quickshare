# 2026-03-21 QuickDrop 中心配对卡与次级记录页

## 目标

- 继续把 QuickDrop 临时互传的首屏收成更像 PairDrop 的中心舞台，而不是一段段表单。
- 把“记录”从覆盖层抽屉推进到真正的次级页面状态，避免遮挡主发送区。

## 本轮改动

- `quickdrop.html` 的临时互传区继续收口：
  - 原来的“你的码”和“输入匹配码”两块并列/分段区，已继续压成一个中心配对卡
  - 当前结构更接近“先生成一个码，或者直接输对方的码，然后发送”的单主路径
  - 配对状态和当前连接对象仍保留，但已退到中心卡下方，不再抢第一眼注意力
- QuickDrop 记录区不再使用覆盖式抽屉：
  - 同账号 `收发记录`
  - 临时互传 `互传记录`
  现在都进入 `quickdrop.html` 里的独立次级页面状态
- 记录次级页现已接上 hash 路由：
  - `#temporary-history`
  - `#account-history`
  浏览器返回现在可直接回到主页面，不再只是视觉层的开关
- `quickdrop.js` 现在新增了主页面 / 记录页面的视图状态切换：
  - `main`
  - `temporaryHistory`
  - `accountHistory`
- 记录页打开后，会隐藏主页面 Hero 和发送舞台，不再与主操作重叠，也不会再拦截主发送按钮点击。
- 单入口“选择内容”继续保留：
  - same-account 和 paired direct 都先点一个主入口
  - 再在轻量菜单里选“文件 / 文件夹”
- `tests/e2e/quickdrop.spec.js` 已同步适配新的次级页面状态：
  - 需要查看详情或执行记录页动作时，会先切到对应记录页
  - 不再假设所有记录控件永远悬浮在主页面里

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

- QuickDrop 现在已经从“主页面上叠一个记录抽屉”推进到“主页面 + 次级记录页”的结构，页面层级更清楚了。
- 临时互传首屏也更接近中心舞台思路，而不是继续堆表单卡片。
- 下一步若继续收口，优先级更适合放在：
  - 继续减少首屏上的说明性文案
  - 继续把设备目标区做得更像“点目标即发”
  - 评估是否把 QuickDrop 的记录页独立成单独 URL，而不是当前页内视图切换
