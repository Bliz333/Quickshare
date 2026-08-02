# QuickShare - 项目知识地图

> Codex / opencode 直接读本文件；Claude 经 `CLAUDE.md` 引入同一份规则。
> 全局 worktree、git 红线、自治执行与知识文档规则见 `~/ai-rules/global-core.md`。
> 真实凭据只允许放在 gitignored `.env` 或 `.agents/local/`，不得写入已跟踪文档。

## 读取顺序

1. 先读本文件。
2. 修改 `src/main/java/com/finalpre/quickshare/**` 时继续读该目录的 `AGENTS.md`；修改 `src/main/resources/static/**` 时读静态前端的 `AGENTS.md`。
3. 只在任务命中知识地图主题时读对应 `docs/ai/*`，禁止为“全面了解”预读全部文档或 `docs/archive/*`。

## 项目边界

QuickShare 是 Java 17 / Spring Boot 3.2 单体应用：后端同时提供 REST、WebSocket 和原生 HTML / CSS / JavaScript 前端。MySQL 是业务真相源，Redis 用于频控等运行态能力。网盘/分享文件经 `StorageService` 落本地卷或 S3 兼容存储；Transfer relay 与公开取件当前例外，仍使用 `file.upload-dir/transfer-temp` 本地路径。

- 当前产品与代码统一使用 **Quick Transfer / Transfer**；`QuickDrop` 只保留在旧路由、旧环境变量和迁移历史中作为兼容名称。
- 首页 `/` 承载快速传输，`/share` 承载分享/取件；`/transfer.html`、`/quickdrop.html` 等旧页面只做重定向。
- 前端没有打包步骤，静态资源从 `src/main/resources/static/` 原样随 Spring Boot 发布。
- 数据库结构只由 `src/main/resources/db/migration/V*.sql` 演进；现有 Flyway 迁移一经发布不得改写。

## 跨模块硬约束

- 普通 JSON API 继续返回 `Result<T>`；文件下载、预览、页面资源等流式/二进制响应是明确例外。
- Controller 只做 HTTP、鉴权主体解析和响应适配；业务规则放 service，SQL 访问放 mapper。
- 网盘/分享文件内容必须走 `StorageService`；Transfer relay/公开取件仍是明确的本地临时存储例外。文件、分享和传输预览必须走 `PreviewDelivery`，不得在 controller 重复实现类型判断、Office 转换或缩略图逻辑。
- `transfer_task` / `transfer_pair_task` 的 attempt JSON 必须通过 `TransferAttemptLedger` 读写和投影，保留损坏/空账本的现有保护语义。
- 管理员接口保持 `@PreAuthorize("hasRole('ADMIN')")` 边界；JWT 可来自 Bearer、HttpOnly cookie 或兼容 query token，续签响应由 `AuthCookieSupport` / `X-Auth-Refresh` 统一处理。
- 运行时策略继续通过对应 `*PolicyService` 与 `SystemSettingOverrideService` 读取；敏感设置使用 `SettingEncryptor`，不得明文写日志或返回前端。

## 知识地图

- 系统分层、数据与关键边界 -> `docs/ai/architecture.md`
- 静态前端、路由、会话、样式与多语言 -> `docs/ai/frontend.md`
- Quick Transfer 的 direct / relay / pairing / E2EE / 任务模型 -> `docs/ai/transfer.md`
- 验证分级、测试选择与 CI -> `docs/ai/validation.md`
- 本地、Compose、预发布、生产与机密边界 -> `docs/ai/platform.md`
- 面向使用者的安装与能力总览 -> `README.md` / `README.zh-CN.md`
- 当前维护状态与已知边界 -> `docs/STATUS.md`
- 尚未承诺的候选工作 -> `docs/PLAN.md`
- 首次生产部署、反向代理与容量操作 -> `docs/ops/`
- 移动端仍处于规划状态 -> `docs/mobile/README.md`
- 历史里程碑只用于追溯 -> `docs/CHANGELOG.md` / `docs/archive/`

## 模块规则

- Java 后端：`src/main/java/com/finalpre/quickshare/AGENTS.md`
- 静态前端：`src/main/resources/static/AGENTS.md`

## 验证、Git 与部署

- 验证唯一决策表是 `docs/ai/validation.md`；按改动风险选择最小充分门禁，并记录实际结果。
- `main` 是受保护主线；任何编辑遵循全局 worktree 规则。任务分支可自主 commit、push、开 draft PR 和跟踪 CI。
- `.github/workflows/ci.yml` 的 PR 门禁目标是 `main`；分支 push 只有 `main` / `feature/*` 会自动触发，`codex/*` 需要 PR 才触发完整 CI。
- `scripts/deploy-preprod.sh` 只用于已配置的预发布目标，不等同于生产发布。生产发布、回滚、改 DNS / 防火墙 / 密钥仍需遵守全局不可逆动作授权边界。
- 任何前端可见改动都要完成浏览器自检，并提供 live URL、位置和预期表现供一次目视判断；未获确认前不得称为完成。

## 文档维护

- `AGENTS.md` 只做地图和硬边界；主题细节放 `docs/ai/`，不要把新任务日志继续堆进 `docs/STATUS.md`。
- 代码、配置和脚本是可直接推导事实的真相源；文档只保存跨文件才能得出的稳定知识和操作边界。
- `docs/archive/` 是历史证据，不代表当前命名、路由、测试结果或部署状态。
