# 2026-03-21 QuickDrop 公开分享与保存到网盘

## 本轮目标

- 给 QuickDrop 增加“免登录也能发”的公共分享能力
- 给接收端增加“保存到我的网盘”，不只停留在浏览器下载
- 为 QuickDrop 增加最小页面级自动化基线

## 本轮实现

- 新增公开分享模型：
  - `quickdrop_public_share`
- 新增公开分享接口：
  - `POST /api/public/quickdrop/shares`
  - `GET /api/public/quickdrop/shares/{shareToken}`
  - `PUT /api/public/quickdrop/shares/{shareToken}/chunks/{chunkIndex}`
  - `GET /api/public/quickdrop/shares/{shareToken}/download`
- 新增登录态保存接口：
  - `POST /api/quickdrop/transfers/{id}/save`
  - `POST /api/quickdrop/public-shares/{shareToken}/save`
- 新增 `FileService.importLocalFile(...)`
  - 把 QuickDrop 临时组装文件导入当前用户网盘
  - 继续复用现有存储后端、逻辑配额、文件记录体系
- 新增 `quickdrop-share.html`
  - 访客可直接上传文件生成临时取件链接
  - 打开链接后可下载
  - 登录用户可直接把该文件保存到自己的网盘
- `quickdrop.html` 已补“保存到网盘”按钮：
  - 接收箱里的 ready/completed 传输可直接导入网盘
- QuickDrop 保存到网盘现已支持目标文件夹选择：
  - 设备互传页和公开分享页都会读取当前用户文件夹列表
  - 保存动作不再固定写入根目录
- 新增 QuickDrop 页面自动化：
  - `tests/e2e/quickdrop.spec.js`

## 当前边界

- 当前 QuickDrop 仍然是服务器中转，不是浏览器端纯 P2P
- 当前公开分享仍以临时取件链接为主，不做近端发现
- 当前 QuickDrop 自动化是最小基线，还没有覆盖真实文件上传到完成下载的整条浏览器路径
- 当前 QuickDrop 浏览器自动化里，“公开取件页已登录保存控件”这条 mock 用例仍待继续收口；当前已先保留设备页保存和公开创建流程两条稳定基线

## 验证

- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check src/main/resources/static/js/quickdrop-share.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/quickdrop.html`
- `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/quickdrop-share.html`
- `POST /api/public/quickdrop/shares`
- `PUT /api/public/quickdrop/shares/{shareToken}/chunks/0`
- `GET /api/public/quickdrop/shares/{shareToken}`
- `POST /api/quickdrop/public-shares/{shareToken}/save`
- `POST /api/folders`
- `POST /api/quickdrop/public-shares/{shareToken}/save` with selected `folderId`
- `npx playwright test tests/e2e/quickdrop.spec.js`

## 当前结论

- QuickDrop 现在已经不只支持“同账号设备互传”
- 也已经支持：
  - 免登录创建临时取件分享
  - 登录后把 QuickDrop 文件保存到自己的网盘
  - 保存到网盘时选择目标文件夹
  - QuickDrop 页面最小浏览器自动化回归
- 下一阶段更适合补：
  - QuickDrop 真实页面文件上传/下载自动化
  - WebRTC / STUN / TURN
  - 接收后自动落盘而不是手动点击保存
