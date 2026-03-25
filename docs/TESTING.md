# QuickShare 测试与验收流程（2026-03-26）

本文件用于约定未来改动的默认测试方式，避免出现“代码改了，但没有重新验证、没有统一收口标准”的情况。

## 当前默认环境

- 当前默认采用“远端优先”流程：
  - 本地负责编辑、提交、推送
  - 远端测试机负责编译、测试、部署和验收
- 当前已验证可用的远端基线：
  - Debian 12
  - `OpenJDK 17`
  - `Maven 3.8.7`
  - `Node 18.20.4` / `npm 9.2.0`
  - Docker + `docker-compose`
- 当前测试机资源有限，执行重建或浏览器回归前后都应检查：

```bash
df -h / /root
free -h
docker system df
```

- 如果这轮回归创建了临时 bundle、快照目录或产生了大量未使用镜像，验收后要立即清理，避免把测试机磁盘重新打满。

## 适用原则

- 默认按“改动范围”选择测试，而不是所有改动都机械执行同一套命令。
- 当前项目不再以本地机作为默认验收环境，除非这轮任务明确只影响本地开发体验。
- 在当前 WSL2 环境下，不把 `mvn test` 作为唯一收口标准。
- 任何可见功能、接口行为、运行时配置或导航逻辑的改动，至少要完成一轮可复现验证。
- 小里程碑也要即时验证，不允许把多轮小改动一直堆到最后再统一试。
- 每次收口都应记录：
  - 改了什么
  - 用什么方式验证
  - 验证结果是什么
  - 是否同步更新文档

## 小里程碑默认门槛

对“已经形成一个可描述的小闭环”的改动，默认至少执行：

1. `./scripts/check-js.sh`
2. `./mvnw -q -DskipTests compile`
3. 按改动点补最接近的一组后端定向测试
4. 如果改动进入真实用户流程，补 `./scripts/quickshare-smoke.sh`
5. 如果改动影响页面行为，补最接近的一条 Playwright 用例
6. 同步更新 `README.md`、`docs/STATUS.md`、`docs/PLAN.md`、`docs/CHANGELOG.md`，必要时补 `docs/archive/`

当前远端默认命令序列：

```bash
./scripts/check-js.sh
./mvnw -q -DskipTests compile
./mvnw -q -Dtest=PlanControllerTest,PaymentServiceImplTest,AdminServiceImplTest,FileControllerTest,FileServiceImplTest,HealthControllerTest,LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,QuickDropServiceImplTest,QuickDropPairingServiceImplTest,UserServiceImplTest test
docker-compose up --build -d --remove-orphans
./scripts/quickshare-smoke.sh
./scripts/quickshare-playwright-smoke.sh
```

## 推荐分级

### 1. 文档改动

适用场景：
- 只改 `README.md`、`docs/`、注释或文案说明

最低要求：
- 检查相关文档之间没有互相矛盾
- 查看 `git diff`，确认没有误改无关内容

建议补充：
- 若文档描述的是新功能或新行为，应核对对应代码仍然存在

## 2. 前端静态改动

适用场景：
- `src/main/resources/static/js/*.js`
- `src/main/resources/static/*.html`
- 纯前端交互、弹窗、导航、文案、渲染逻辑

最低要求：
- 对改动过的 JS 执行语法检查

常用命令：

```bash
./scripts/check-js.sh
node --check src/main/resources/static/js/admin.js
node --check src/main/resources/static/js/netdisk.js
node --check src/main/resources/static/js/netdisk-render.js
node --check src/main/resources/static/js/lang-switch.js
node --check src/main/resources/static/js/register.js
node --check src/main/resources/static/js/modal.js
node --check src/main/resources/static/js/pricing.js
node --check src/main/resources/static/js/payment-result.js
```

如果改动影响高频页面或用户操作，还应补：
- 浏览器手工验证
- 或 Docker 起栈后的真实页面烟测
- 如果改动的是 `quickdrop.html` 的首屏布局、模式切换、记录入口或配对/同账号发送主流程，建议直接跑整份：

```bash
npx playwright test tests/e2e/quickdrop.spec.js
```

## 3. 后端接口或业务逻辑改动

适用场景：
- `src/main/java/**`
- DTO、Controller、Service、配置策略、权限、存储、邮件、支付逻辑

最低要求：

```bash
mvn -q -DskipTests compile
```

建议补充：
- 如果当前环境稳定，可执行有针对性的测试类
- 若改动涉及订单状态机或支付方式能力，至少补：

```bash
./mvnw -q -Dtest=PlanControllerTest,PaymentServiceImplTest,AdminServiceImplTest test
```

- 若改动涉及下载套餐或下载额度扣减，至少补：

```bash
./mvnw -q -Dtest=FileControllerTest,FileServiceImplTest test
```

- 若改动涉及健康检查或本地存储运行态指标，至少补：

```bash
./mvnw -q -Dtest=LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,HealthControllerTest test
```

- 如果改动影响外部行为，应继续做 Docker 烟测，而不是只停留在编译通过

## 4. 涉及真实用户流程的改动

适用场景：
- 登录/注册
- 管理台配置保存
- 网盘导航
- 上传/分享/下载/预览
- 文件或文件夹移动
- SMTP / 公告发送
- 存储切换
- 支付相关流程
- 套餐页 / 支付结果页 / 网盘配额展示

最低要求：

```bash
docker compose up --build -d
./scripts/quickshare-smoke.sh
```

然后按改动范围补最小烟测。

## WSL2 默认收口流程

对于绝大多数功能改动，推荐按下面顺序执行：

1. 前端语法检查

```bash
./scripts/check-js.sh
node --check src/main/resources/static/js/<changed-file>.js
```

2. Java 编译检查

```bash
mvn -q -DskipTests compile
```

3. Docker 重建部署

```bash
docker compose up --build -d
```

4. 仓库内 smoke 脚本

```bash
./scripts/quickshare-smoke.sh
```

如果当前环境主机侧 `127.0.0.1:8080` 端口转发不稳定，可直接在容器内执行同一套探针：

```bash
SMOKE_MODE=container SMOKE_DOCKER_CONTAINER=quickshare-app-1 ./scripts/quickshare-smoke.sh
```

说明：
- 主机模式下，当前脚本已覆盖登录后文件夹管理、上传去重、私有下载、分享创建、错误提取码、公开下载记账，以及 API 级批量移动/删除校验。
- 容器模式当前主要用于回退验证 HTTP/JSON 探针；若后续继续增强，会再补容器内文件传输链路。

5. 针对改动点做真实烟测

默认建议：
- 页面行为改动，至少补 1 条最贴近的 Playwright 用例
- 文档说明改动，收口前确认顶层文档与 archive 没有互相打架

## 浏览器自动化基线

当前 repo 已补一组 Playwright 页面基线，用于验证真实页面中的关键配置链路和用户操作链路，不再只停留在接口层 smoke。

常用命令：

```bash
npm install
npx playwright install chromium
npx playwright test tests/e2e
npx playwright test tests/e2e/admin-rate-limits.spec.js
npx playwright test tests/e2e/admin-email-templates.spec.js
npx playwright test tests/e2e/admin-orders.spec.js
npx playwright test tests/e2e/admin-smtp.spec.js
npx playwright test tests/e2e/admin-plans.spec.js
npx playwright test tests/e2e/admin-payment-providers.spec.js
npx playwright test tests/e2e/home-notifications.spec.js
npx playwright test tests/e2e/netdisk-drag.spec.js
npx playwright test tests/e2e/netdisk-quota.spec.js
npx playwright test tests/e2e/quickdrop.spec.js
npx playwright test tests/e2e/quickdrop-real.spec.js
PLAYWRIGHT_BASE_URL=http://localhost:8081 PLAYWRIGHT_API_BASE_URL=http://localhost:8080/api npx playwright test tests/e2e/quickdrop-real.spec.js
./scripts/quickshare-playwright-smoke.sh
./scripts/deploy-preprod.sh
DEPLOY_GIT_BRANCH=main DEPLOY_RUN_SMOKE=1 DEPLOY_RUN_BROWSER_SMOKE=1 ./scripts/deploy-preprod.sh
```

没有本地 Node / Chromium 的服务器环境，优先使用 Dockerized Playwright：

```bash
./scripts/quickshare-playwright-smoke.sh
PLAYWRIGHT_TEST_TARGET=tests/e2e/quickdrop.spec.js ./scripts/quickshare-playwright-smoke.sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 ./scripts/quickshare-playwright-smoke.sh
```

部署脚本支持 GitHub 拉取式，也支持远端无法直接拉私有仓库时的回退路径：

```bash
./scripts/deploy-preprod.sh
DEPLOY_RUN_SMOKE=1 ./scripts/deploy-preprod.sh
DEPLOY_RUN_SMOKE=1 DEPLOY_RUN_BROWSER_SMOKE=1 ./scripts/deploy-preprod.sh
```

说明：

- 服务器在具备仓库读取权限时，会在 `/root/quickshare` 内 `git fetch/reset` 到目标分支，然后执行 `docker compose up --build -d`
- 默认部署当前本地分支名；如需强制部署 `main`，显式传 `DEPLOY_GIT_BRANCH=main`
- 若当前环境到测试机的 SSH 会话存在卡住风险，可显式传 `DEPLOY_SSH_TIMEOUT_SECONDS`
- 真实 QuickDrop 浏览器回归继续在服务器本机网络中执行，而不是依赖当前环境直连公网 `:8080`
- 若远端暂时不能直接读取私有 Git 仓库，保持 `DEPLOY_ENABLE_SNAPSHOT_FALLBACK=1`，或者维护服务器本地 git mirror / bare repo，再从该镜像更新工作副本

当前这组用例覆盖：
- 管理台注册设置保存、provider 切换和公开设置同步
- 管理台频控策略表格渲染、单个 scene 保存和接口回读
- 管理台存储页运行态摘要、类型切换、保存和连接测试
- 管理台系统页 `CORS` 保存、隐藏后台入口路径切换和真实路由保持
- 管理台上传策略和预览策略保存及接口回读
- 管理台邮件模板编辑、保存、刷新回填和接口回读
- 管理台 SMTP 配置读取、保存和真实测试发送
- 管理台订单页 `pending -> paid -> refunded -> deleted`，以及配额发放/回滚
- 管理台套餐页新增、编辑、删除
- 管理台支付商户页新增、编辑、删除，以及编辑时保留旧密钥
- 首页通知中心的“全部通知 / 我的通知”分类展示
- 登录态注入
- QuickDrop 设备页的设备列表渲染、接收箱按钮和保存到网盘动作
- QuickDrop 公开分享页的创建流程和取件页渲染
- QuickDrop 配对直传的浏览器接收箱渲染、分片接收完成态和下载按钮可用性
- QuickDrop 配对直传的发送钩子、对端确认流程和直传完成状态
- QuickDrop 同账号设备页自动请求直连会话，以及主发送区“直连优先 / 中转回退”的编排
- QuickDrop 同账号设备页在直传中途失败时会自动切到服务器中转继续
- QuickDrop 同账号主接收箱 / 发送记录合并显示直传任务，以及直传文件从主接收箱保存到网盘
- QuickDrop 页面减法后的首屏结构：模式切换、中心配对卡、带 `hash` 路由的次级记录页、单入口“选择内容”和折叠式设备设置
- QuickDrop 同一个文件在“直传后回退中转”时，主发送记录仍只显示一条混合任务
- QuickDrop 中转任务服务端返回 `taskKey` 后，主列表归并仍保持稳定
- QuickDrop 同账号混合任务详情弹窗会显示服务端 relay `task` 快照、当前阶段和 direct/relay attempt 链路
- QuickDrop 同账号页在服务端 `incomingTasks / outgoingTasks` 存在时，会优先按统一任务列表渲染和删除
- QuickDrop 本地真实双页浏览器传输可把同账号任务落到统一任务列表
- Dockerized Playwright smoke 可在无本地 Node 的预发布机上直接复用 `quickdrop-real.spec.js`，不再依赖手工装浏览器
- 本地若需要用工作区静态前端验证真实后端，可起一个 `localhost:8081` 静态服务器，再配合 `PLAYWRIGHT_API_BASE_URL=http://localhost:8080/api` 运行 `quickdrop-real.spec.js`
- QuickDrop 公开配对直传会把 attempt 写回服务端 `pair task`
- QuickDrop 公开配对页现已优先按服务端 `pair task` 渲染页面级任务视图，而不只看浏览器本地 incoming 记录
- QuickDrop 公开配对页的任务详情弹窗会显示 `pairTaskId / pairSessionId`，且 server-only pair task 也可页内删除
- 网盘页面真实拖拽文件到目标文件夹
- 网盘页面真实拖拽文件夹到目标文件夹
- 网盘侧栏按当前登录用户资料渲染昵称、VIP 状态、存储/下载配额和升级入口
- 选择模式下的批量移动弹窗
- 选择模式下的批量删除弹窗
- 套餐页在“无商户”和“有订单历史”场景下的页面渲染
- 支付结果页在“已有订单”和“缺少 order_no”场景下的页面渲染
- 支付结果页 `pending -> paid` 自动轮询状态切换
- 真实默认商户创建订单后的跳转参数
- 临时测试商户下 `pending -> paid -> refunded` 和配额回滚
- 注册页 `reCAPTCHA` / `Turnstile` provider 切换
- 注册页关闭邮箱验证码/人机验证时的 UI 收口
- UI 列表变化与后端数据结果一致

## 重点烟测清单

### 管理台改动

- 管理入口路径仍然可访问：`/console/{slug}`
- 公开页面不应出现管理入口按钮
- 配置保存后刷新页面，确认值与行为一致
- 若涉及 SMTP / 公告：
  - 先测试 SMTP 配置
  - 再发送公告
  - 核对返回统计是否合理

### 网盘改动

- 进入文件夹、切换分类、面包屑返回是否正常
- 浏览器返回键是否回到上一个网盘上下文
- 列表视图和网格视图行为是否一致
- 选择模式开启/关闭后，勾选状态、批量操作栏和当前列表渲染是否一致
- 拖拽文件或文件夹到目标目录后，结果列表、当前位置和提示反馈是否正确
- 批量移动/删除在“部分成功 / 部分失败 / 无需移动”三种情况下都要有明确反馈

### 文件管理改动

- 上传后文件是否出现在正确目录
- 重命名、删除、移动是否都能落到正确目标
- 登录用户下载自己的文件后，`GET /api/profile` 返回的 `downloadUsed` 应递增
- 如果涉及去重：
  - 同名同内容重复上传是否复用已有记录
  - 不同名同内容是否复用物理存储
  - 删除一个引用后其他引用是否仍可用

### 分享与预览改动

- 分享创建、提取码校验、公开下载是否正常
- 图片、文本、PDF、Office 预览是否符合当前策略
- 错误提取码、禁用分享、超限下载要有正确反馈

### 套餐与支付改动

- 首页、登录态区域和网盘侧栏的升级入口都能正确进入 `pricing.html`
- `GET /api/public/plans` 返回的套餐能被套餐页正确渲染
- `GET /api/public/payment-options` 应返回当前默认商户和支持的 `payTypes`
- 如果 `GET /api/public/payment-options` 返回 `null`，套餐页应直接禁用购买入口，而不是等提交下单时报错
- 启用商户后，`POST /api/payment/create` 应返回有效跳转地址，且不允许前端提交商户不支持的 `payType`
- 本地环境如果没有公网白名单，至少要用临时测试商户 + 本地签名 `notify` 跑通 `pending -> paid -> refunded -> rollback`
- 登录后 `GET /api/payment/orders` 和 `GET /api/payment/order/{orderNo}` 要能正常返回自己的订单数据
- `payment-result.html` 在 `pending` 状态下会自动轮询，手动刷新按钮也可正常工作
- `paid` / `expired` / `refunded` 三种订单状态的文案、按钮和提示都要正确
- 后端退款后，重复成功通知不应重新发放配额
- 用户资料刷新后，网盘侧栏中的存储/下载/VIP 配额展示要与订单结果一致

### 下载额度改动

- 登录用户下载自己的文件时，`downloadUsed` 应增加
- 登录用户访问公开下载链接时，也应计入自己的 `downloadUsed`
- 匿名公开下载不应错误修改任意账号的下载计数

### 安全与策略改动

- `Google reCAPTCHA` / `Cloudflare Turnstile` 切换后文案是否同步
- `site key` / `secret key` / `verify URL` 展示是否对应当前 provider
- 公开设置接口返回值是否与管理台保存结果一致
- 注册页是否只加载当前 provider 对应的脚本，并且验证码发送流程仍可用

### 存储配置改动

- `GET /api/admin/settings/storage` 应返回当前后端配置和连接状态
- 本地存储模式下，应能看到上传目录、目录是否存在、磁盘总容量和当前可用空间
- 本地存储模式下，应继续返回 `localDiskUsablePercent` 和 `localDiskRiskLevel`
- S3 模式下，应能看到 endpoint、bucket 和连接状态
- `GET /api/health` 在本地存储模式下也应返回 `storageUploadDir`、`storageUploadDirExists`、`storageDiskTotalBytes`、`storageDiskUsableBytes`、`storageDiskUsablePercent`、`storageDiskRiskLevel`
- `GET /api/health` 在 S3 模式下也应返回 `storageConnectionStatus`、`storageBucket`、`storageEndpoint`
- 监控类接口不应因为读取上传目录配置而自动创建目录，否则会掩盖真实缺失状态
- 当前本地磁盘风险阈值约定为：剩余空间 `<= 15%` 返回 `warning`，`<= 5%` 返回 `critical`
- `./scripts/quickshare-smoke.sh` 应继续校验 `GET /api/health` 与 `GET /api/admin/settings/storage` 的上传目录和风险级别一致
- `npx playwright test tests/e2e/admin-storage.spec.js` 应继续校验总览页风险卡片、存储页风险提示文案和接口对齐
- `./scripts/quickshare-smoke.sh` 应继续覆盖临时支付商户和临时套餐的全链路清理
- 本地 MinIO 联调基线现在是：
  - `docker compose --profile s3 config`
  - `docker compose --profile s3 up -d minio minio-init`
  - 管理台切到 `http://minio:9000` 后先做连接测试
  - 当前已确认连接/上传/删除可用；在运行态切到 `S3/MinIO` 后，再执行 `./scripts/quickshare-smoke.sh` 已能覆盖并验证下载内容一致性

## 关于 `mvn test`

当前 WSL2 / JDK 组合下，完整 `mvn test` 可能受 Mockito / ByteBuddy inline mock maker 自附加限制影响，不适合作为唯一验收标准。

因此默认策略是：

- 本地优先使用：
  - `node --check`
  - `mvn -q -DskipTests compile`
  - `docker compose up --build -d`
  - `./scripts/quickshare-smoke.sh`
  - 真实接口或页面烟测
- 完整测试套件更适合在：
  - CI
  - 可正常支持 self-attach 的本地环境
  - 明确需要做大范围回归时

## 交付收口要求

每完成一个小里程碑，默认需要同时完成以下事项：

1. 代码或文档改动已经落盘
2. 至少执行与改动范围匹配的一轮验证
3. 说明实际执行过的验证命令和结果
4. 如行为或能力发生变化，同步更新：
   - `README.md`
   - `docs/STATUS.md`
   - `docs/PLAN.md`
   - `docs/CHANGELOG.md`
   - 必要时补 `docs/archive/` 归档记录

## 当前建议

- 文档改动：差异检查 + 一致性检查即可
- 普通前端/后端改动：`node --check` + `mvn -q -DskipTests compile`
- 影响真实流程的改动：`docker compose up --build -d` + `./scripts/quickshare-smoke.sh`，再补改动点特定回归
- QuickDrop 直传/信令/配对码改动，至少补：

```bash
./mvnw -q -Dtest=QuickDropPairingServiceImplTest,QuickDropServiceImplTest test
node --check src/main/resources/static/js/quickdrop-signal.js
node --check src/main/resources/static/js/quickdrop-direct.js
node --check src/main/resources/static/js/quickdrop.js
npx playwright test tests/e2e/quickdrop.spec.js
```

- 如果这轮主要改的是同账号任务详情 / hybrid 行收口，至少补：

```bash
./mvnw -q -Dtest=QuickDropServiceImplTest test
node --check src/main/resources/static/js/quickdrop.js
node --check src/main/resources/static/js/lang-switch.js
docker compose up --build -d app
npx playwright test tests/e2e/quickdrop.spec.js --grep "same-account merged task row exposes task details modal payload"
```

- 如果这轮已经改到同账号统一任务骨架 / direct 状态回写，至少补：

```bash
./mvnw -q -Dtest=QuickDropServiceImplTest test
node --check src/main/resources/static/js/quickdrop-direct.js
node --check src/main/resources/static/js/quickdrop.js
node --check tests/e2e/quickdrop-real.spec.js
docker compose up --build -d app
npx playwright test tests/e2e/quickdrop.spec.js
npx playwright test tests/e2e/quickdrop-real.spec.js
./scripts/quickshare-smoke.sh
```

- 如果这轮改的是公开配对 / 匿名直传服务端记录层，至少补：

```bash
./mvnw -q -Dtest=QuickDropPairingServiceImplTest test
node --check src/main/resources/static/js/quickdrop-direct.js
node --check tests/e2e/quickdrop.spec.js
docker compose up --build -d app
npx playwright test tests/e2e/quickdrop.spec.js --grep "receives a paired direct transfer and keeps it in the browser inbox|sends a paired direct transfer through the direct channel hooks"
```

- 如果这轮改的是公开配对 / 匿名直传页面级任务视图，至少补：

```bash
./mvnw -q -Dtest=QuickDropPairingServiceImplTest test
node --check src/main/resources/static/js/quickdrop-direct.js
node --check src/main/resources/static/js/lang-switch.js
node --check tests/e2e/quickdrop.spec.js
docker compose up --build -d app
npx playwright test tests/e2e/quickdrop.spec.js --grep "receives a paired direct transfer and keeps it in the browser inbox|sends a paired direct transfer through the direct channel hooks|loads paired tasks from the server task view and can delete a server-only pair task"
```
- 不要在未验证、未说明、未同步文档的情况下直接宣布完成
