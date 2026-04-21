# QuickShare 后续计划（2026-04-20）

旧的阶段式路线图已经完成。当前计划不再按”从 0 到 6 的大阶段”推进，而是围绕维护、体验和回归质量继续收口。

## 当前阶段进度

- 已完成（2026-04-05）：Transfer 重命名 + LAN 传输功能修复 + 首页重设计
  - QuickDrop → Transfer 全栈重命名（Java / DB / 前端）
  - 修复 LAN 接收方无响应 Bug：relay-done 信令 + 接收卡片弹窗
  - 改用 `/api/public/transfer/shares` 实现无需登录的 LAN 传输
  - `index.html` 全面重设计（设备环 + 接收弹窗 + 深色模式）
  - 新增 `TransferSignalingServiceImpl`（IP /24 房间分组）
  - DB 迁移 V11

- 已完成（2026-04-20）：Quick Share 首页接收预览 + 可读性增强
  - 首页接收弹窗 inline preview（图片 / PDF / Office / 文本）
  - 新增 `js/inline-preview.js` 共享预览模块
  - 桌面端 proportional sizing（卡片、图片 / 视频 / 文本 / iframe 预览）
  - `pdf-viewer.html` / `pdf-viewer.js` 嵌入式 viewer 模式
  - 预览失败 fallback 收口（坏图回退、文本 fallback、宽版卡片回收）
  - 已完成浏览器实际回归，移动端实施的 web 前置条件已满足

- 已完成阶段 A：QuickDrop 页面收口基线固化
  - 已重新验收未提交的 QuickDrop UI 改动
  - 已形成正式提交：`feat: finalize quickdrop mode-first history flow`
- 已完成阶段 B：发布脱敏与远端接入基线
  - 已清理公开文档中的真实域名 / IP
  - 已补 `docs/PUBLISHING.md` 的提交身份检查
  - 已切换 GitHub SSH remote 并推送当前分支
  - 本机已具备测试服务器快捷登录 helper（本地未跟踪配置）
- 已完成阶段 C：GitHub 拉取式预发布部署基线
  - `Dockerfile` 已支持从新鲜 Git checkout 自举构建
  - `deploy-preprod.sh` 已改为远端 `git fetch/reset` + `docker compose up --build -d`
  - 仅在构建 / 启动 / `health` 失败时自动回滚到上一个 commit
  - `quickshare-smoke.sh` 与 `quickshare-playwright-smoke.sh` 继续作为部署后验收入口
- 已完成阶段 D：QuickDrop 生命周期与详情补强
  - same-account `task` 与 public `pair task` 已补统一的 attempt 生命周期摘要字段
  - `quickdrop.html` / 配对直传详情已显示开始/结束/失败原因、fallback 时间与转存反馈
  - 已补 QuickDrop 定向 service test 与 `tests/e2e/quickdrop.spec.js` 页面回归
- 已完成阶段 E：远端部署基线第一轮固化
  - 已新增 `scripts/quickshare-resource-check.sh`
  - `deploy-preprod.sh` 已补原生 `ssh/scp` 回退、bundle mirror fallback 和远端资源预检
  - 最新远端等价部署流程已在 `030f67c` 上通过 compose 重建、smoke 与 browser smoke

## 分阶段 Checklist（按风险优先级）

### Phase 1. 预发布部署复现与真实公网验证

- 当前状态：已完成新一轮远端基线重建。测试机现已具备 JDK/Maven/Node，`/root/quickshare` 已收口为 git 工作副本，远端 `smoke` 与 Dockerized `quickdrop-real` 已重新通过，而且本轮真实双页 same-account 传输最终命中 `direct`

- 目标：
  - 把当前“服务器本地 bare repo + git 工作副本”的更新路径继续收口成真正的一键流程
  - 明确是否要为测试机补 GitHub 只读凭据；若不补，就把本地镜像同步路径正式文档化
  - 在资源受限前提下继续保持 `health`、QuickDrop `sync`、`rtc-config`、公开分享创建和真实双页传输可复现
- 建议提交边界：
  - 远端部署基线脚本、资源治理规则、运维文档同步一组提交
- 验收：
  - 预发布机继续保持 git 工作副本，不再回退成纯源码快照目录
  - 远端磁盘与内存余量在一次完整回归后仍保持安全余量
  - `curl /api/health`、`curl /api/public/quickdrop/rtc-config` 正常
  - same-account 真实双页验证继续可复现 `direct` 命中样本，或至少明确最新 `relay` 回退来自哪类网络条件
  - 补一条新的 archive 记录远端重建、回归结果和资源清理结果

### Phase 2. QuickDrop 生命周期与任务语义补强

- 当前状态：已完成
- 结果：
  - direct / relay attempt 已补开始、结束、失败原因与关键时间戳
  - same-account `task` 与 public `pair task` 的详情展示已切到同一套生命周期摘要
  - 对应 service 测试和 `quickdrop.spec.js` 页面回归已同步更新

### Phase 3. QuickDrop 产品化收口

- 当前状态：已完成（2026-03-30）
- 结果：
  - 删除 `#quickDropModeGuide` 首屏引导文案及对应渲染函数
  - 确认历史页 `?view=` URL 冷启动直接可访问，无需修改路由初始化顺序
  - relay / direct 传输均补”已存入网盘”badge + “在网盘中查看”跳转入口
  - `quickdrop.spec.js` 已覆盖 saved-badge 与“Save to Netdisk”回归用例

### Phase 4. 回归与 smoke 自动化扩展

- 当前状态：已完成（2026-03-30）
- 结果：
  - 新增 `tests/e2e/netdisk-nav.spec.js`：文件夹导航进入子目录（URL `?folder={id}` + 面包屑）、浏览器返回（URL 清除 + 面包屑还原）、冷启动 URL 直接打开子文件夹
  - 扩展 `tests/e2e/netdisk-quota.spec.js`：存储近满（>90%）进度条变红 + VIP 已过期状态文字变红两个 mock 驱动用例
  - 待续：真实公网商户回跳、更多登录后网盘 CRUD 操作回归

### Phase 5. 运行态与运维加固

- 当前状态：文档层已完成（2026-03-30）
- 结果：
  - `docs/ops/capacity.md`：磁盘风险阈值、health check 字段解读、Docker/日志/上传目录清理 SOP
  - `docs/ops/https-proxy.md`：nginx 反向代理配置（含 WebSocket upgrade）、Let's Encrypt / Certbot 集成、安全 header
  - `docs/ops/prod-preprod.md`：环境职责边界、配置差异清单、发布前 7 步检查清单
  - 已完成（2026-04-01）：docker-compose 日志轮转、`quickshare-alert.sh`、`quickshare-backup.sh`

## 当前目标

### 0. Mobile release operations and optional regression expansion

- 当前目标：在已落库的 Expo / React Native 客户端和生成后的 Android/iOS 原生工程基础上，继续维护发布流程文档，并按需扩展回归覆盖面。
- 当前状态更新：移动端实现本体与仓库内兼容性基线已经落库；本节记录的是后续发布运营与可选扩面方向，而不是主链路缺口。
- 产出应落在：
  - `docs/mobile/README.md`
  - `docs/mobile/architecture.md`
  - `docs/mobile/android.md`
  - `docs/mobile/ios.md`
  - `docs/mobile/store-submission.md`
  - `docs/mobile/testing.md`
  - `docs/mobile/responsibilities.md`
  - `docs/ops/production-deployment.md`
- 近期原则：
  - 当前已完成“后端可复用 + web 预览 / 可读性前置条件”以及移动端已落库基线，后续按需继续扩展回归覆盖与发布文档
  - 不把当前网页直接当作长期移动端方案，仍需按 Android/iOS 正式客户端路线推进
  - 当前无需再讨论 wrapper MVP，重点转向现有客户端的验证、兼容性和发布链路

### 1. 体验与交互稳定性

- 继续清理任何残留的浏览器原生交互，统一使用站内 Modal / Toast / 内联反馈。
- 补强网盘、分享页、支付结果页、管理台的边界状态处理，避免“点击了但看起来没反应”。
- 把套餐页、支付结果页、订单历史、网盘配额卡片、批量选择/拖拽移动这组用户侧高频操作一起收口。
- 继续优化移动、删除、重命名、返回导航等高频操作的一致性。

### 2. 回归与烟测自动化

- 仓库内现已同时具备 `scripts/quickshare-smoke.sh` 和 `scripts/check-js.sh`，分别用于固定真实流程探针和统一 JS 语法基线。
- 下一步不再是“从 0 开始补 smoke”，而是继续把“`check-js` -> compile -> targeted tests -> smoke -> nearest Playwright`”固化成默认小里程碑验收入口。
- 优先覆盖：
  - 管理台关键配置保存
  - 公告发送结果反馈
  - 网盘浏览器历史返回
  - 启用支付商户后的真实外部回跳、支付结果页轮询、退款状态与网盘配额/VIP 展示刷新
- 本轮已完成：
  - 支付结果页 mocked paid order 展示
  - 支付结果页手动刷新后的 `pending -> refunded`
- 下一步继续优先：
  - 登录后网盘 CRUD 页面级回归，建议拆成更小的稳定用例，而不是单条综合流程
- 条件允许时继续补浏览器自动化，而不是只依赖手工点击回归。
- 当前 Playwright + Chromium 基线已经可用，下一步应继续扩大页面级覆盖面，优先补真实公网商户回跳场景、更多登录后网盘 CRUD 交互，以及把当前默认验收脚本同步进 CI。
- 当前默认验收链路现已同步进 CI：`check-js -> JUnit -> quickshare-smoke -> quickshare-playwright-smoke`
- 脚本层已经支持 GitHub 拉取式；但当前测试机的真实稳定底座是“git 工作副本 + 服务器本地 bare repo + docker-compose”。下一步更值得投入的是把这条远端基线固化，而不是再回到无版本信息的源码快照目录。
- 这一轮远端部署基线已经补上资源检查和 bundle mirror fallback，因此下一阶段可以顺势转向“回归自动化扩展”，而不是继续反复手工重建同一条部署链路。

### 3. 部署与文档卫生

- 持续保持 `README.md`、`docs/STATUS.md`、`docs/PLAN.md`、`docs/CHANGELOG.md` 同步。
- 新增功能或修复后，优先补 archive 记录，再同步顶层摘要文档。
- 继续保持 Docker、环境变量、管理台运行时配置说明与真实实现一致。
- 存储规划继续保持两层拆分：
  - 应用层负责用户逻辑配额、上传校验和后端切换
  - 基础设施层负责磁盘 / bucket 容量、备份、生命周期和告警

### 4. 可选体验增强（不阻塞当前已验证基线）

- 明确匿名分享访问是否需要计入分享者或访问者的套餐额度；若需要，补新的扣减主体与对账规则。
- QuickDrop 后续优化方向：
  - 基于已部署的预发布 TURN 做真实双端公网 / NAT 场景验证，并继续提升直连成功率
  - 继续考虑把 public `pair task` 和 same-account `task` 收成同一套顶层模型 / 操作语义
  - 直传文件保存到网盘后的后续动作继续收口：
    - 是否保留本地缓存
    - 是否给出“已转存到网盘”的任务级入口
    - 更长 TTL 或后台自动清理策略
  - 任务级操作继续补：
    - 任务筛选 / 分页
    - 更完整的任务级下载 / 保存 / 删除一致性
  - 建议按以下顺序推进：
    - 已完成第 1 步：服务端统一任务骨架
      - 已新增 `quickdrop_task`
      - `quickdrop_transfer` 已显式关联 `taskId`
      - relay/create/upload/get/save/download 已统一挂到服务端任务
      - `sync` 现已返回 `incomingTasks / outgoingTasks`
    - 已完成第 2 步：浏览器直传状态回写到服务端
      - same-account direct attempt 已补最小上报接口
      - `sending / receiving / waiting_complete / relay_fallback / completed` 已变为服务端可见
    - 已完成第 3 步：同账号页任务优先
      - `quickdrop.html` 主接收箱 / 发送记录现已优先消费统一任务列表
      - 任务详情和删除动作现已切到任务语义
    - 已完成第 4 步：任务完成态与缓存清理收口
      - direct 下载 / 保存到网盘后的 completed 状态已回写
      - 浏览器端已补 completed / saved 记录的保留时长清理策略
    - 已完成第 5 步：真实双页本地浏览器验证
      - 已新增两页真实浏览器 QuickDrop 回归
      - 当前本地 headless 结果已确认：真实两页传输可落到统一任务列表，但最终模式仍可能收口到 `Relay`
    - 已完成补充步：公开配对 / 匿名直传服务端记录层
      - 已新增 `quickdrop_pair_task`
      - public paired direct attempt 已补服务端写回接口
      - 公开配对页直传接收箱已可查看 `pairTaskId / pairSessionId`
    - 已完成补充步：公开配对 / 匿名直传页面级任务视图
      - 已新增 `GET /api/public/quickdrop/pair-tasks`
      - `QuickDropPairingServiceImpl` 已补 `listPairTasks`
      - `quickdrop-direct.js` 配对任务面板现已优先消费服务端 `pair task`
      - server-only public pair task 现已可在页面查看详情并删除
    - 已完成补充步：QuickDrop 生命周期与任务详情语义
      - `QuickDropTaskVO / QuickDropPairTaskVO / QuickDropTaskAttemptVO` 已补 `attemptStatus`、开始/结束/失败原因和关键时间戳
      - `quickdrop.html` 与配对直传详情弹窗现已显示 fallback / fail / save feedback
      - QuickDrop 定向 service test 与 `tests/e2e/quickdrop.spec.js` 已覆盖新详情字段
    - 已完成补充步：QuickDrop 直连诊断与最终模式探针
      - `quickdrop-signal.js` 已补 `rtc-config` 摘要、ICE/connection state、候选统计和 selected candidate pair
      - `tests/e2e/quickdrop-real.spec.js` 现已输出真实链路最终模式，并支持 `EXPECT_QUICKDROP_FINAL_MODE`
      - same-account 在“直连未就绪即回退 relay”时，现已写回 direct fallback attempt
    - 已完成补充步：预发布 TURN / same-account 真实链路复核
      - 预发布 `health`、`rtc-config`、远端 smoke 与 Dockerized 浏览器 smoke 已继续通过
      - 远端 real-browser 已经出现过 `direct` 命中样本，但最新一次又回到 `relay`
    - 后续若继续投入，重点是“扩大不同网络条件下的稳定直连命中率”，不是“这台测试机能否完成传输”
    - 已完成补充步：QuickDrop 页面级减法收口
      - `quickdrop.html` 首屏已继续去掉步骤条和大段解释
      - 临时互传与同账号发送都已改成“单入口选择内容”
      - 记录区已移到底部抽屉，设备改名已默认折叠
    - 已完成补充步：QuickDrop 中心舞台与次级记录页
      - 临时互传现已进一步压成中心配对卡
      - 记录区已从抽屉推进到真正的次级页面状态，并开始从 `hash` 收口到 query route
    - 若继续做产品化收口，更适合继续做以下优化，而不是再堆新控件：
      - 继续减少首屏辅助文案
      - 继续把设备目标区收成“点目标即发”的舞台
      - 评估把记录页独立成单独 URL，而不是继续停留在页内视图切换
- 存储侧优先考虑：
  - 生产环境 S3-first
  - 本地仅作开发/单机部署或临时缓存
  - 增加容量告警、对象生命周期和迁移/备份策略
- 大列表分页、筛选和性能优化继续收口。

## 当前收口标准

- 不再以“写完功能”作为完成条件，而以“实现、验证、文档一致”作为完成条件。
- 对涉及 UI / 配置 / 文件行为的改动，默认至少完成以下动作中的相应组合：
  - `./scripts/check-js.sh` 或至少对改动文件执行 `node --check`
  - `./mvnw -q -DskipTests compile`
  - 按改动点补最接近的一组定向测试
  - 涉及真实用户流程时补 `./scripts/quickshare-smoke.sh`
  - 涉及页面行为时补最接近的一条 Playwright 用例
  - 明确更新顶层文档和归档记录

## 不再作为单独大阶段处理的事项

- 安全基线、文件夹闭环、管理员体系、支付接入、部署基线都已完成，不再重复维护旧路线图描述。
- 后续若出现新的大功能，再单独开新计划，不混入当前维护文档。
