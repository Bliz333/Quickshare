# QuickShare 后续计划（2026-03-21）

旧的阶段式路线图已经完成。当前计划不再按“从 0 到 6 的大阶段”推进，而是围绕维护、体验和回归质量继续收口。

## 当前目标

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
- 条件允许时继续补浏览器自动化，而不是只依赖手工点击回归。
- 当前 Playwright + Chromium 基线已经可用，下一步应继续扩大页面级覆盖面，优先补真实公网商户回跳场景、更多登录后网盘 CRUD 交互，以及把当前默认验收脚本同步进 CI。

### 3. 部署与文档卫生

- 持续保持 `README.md`、`docs/STATUS.md`、`docs/PLAN.md`、`docs/CHANGELOG.md` 同步。
- 新增功能或修复后，优先补 archive 记录，再同步顶层摘要文档。
- 继续保持 Docker、环境变量、管理台运行时配置说明与真实实现一致。
- 存储规划继续保持两层拆分：
  - 应用层负责用户逻辑配额、上传校验和后端切换
  - 基础设施层负责磁盘 / bucket 容量、备份、生命周期和告警

### 4. 可选体验增强

- 明确匿名分享访问是否需要计入分享者或访问者的套餐额度；若需要，补新的扣减主体与对账规则。
- QuickDrop 下一阶段优先级：
  - 基于已部署的预发布 TURN 做真实双端公网 / NAT 场景验证，并继续提升直连成功率
  - 继续补更细粒度的 direct / relay attempt 生命周期，例如错误原因、完成原因和更清晰的 attempt 结束态
  - 继续考虑把 public `pair task` 和 same-account `task` 收成同一套顶层模型 / 操作语义
  - 直传文件保存到网盘后的后续动作继续收口：
    - 是否保留本地缓存
    - 是否给出“已转存到网盘”的任务级入口
    - 更长 TTL 或后台自动清理策略
  - 任务级操作继续补：
    - 任务详情里更明确的 attempt 时间线
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
    - 已完成补充步：QuickDrop 页面级减法收口
      - `quickdrop.html` 首屏已继续去掉步骤条和大段解释
      - 临时互传与同账号发送都已改成“单入口选择内容”
      - 记录区已移到底部抽屉，设备改名已默认折叠
    - 已完成补充步：QuickDrop 中心舞台与次级记录页
      - 临时互传现已进一步压成中心配对卡
      - 记录区已从抽屉推进到真正的次级页面状态，并接上 `hash` 路由
    - 下一步更适合继续做产品化收口，而不是再堆新控件：
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
