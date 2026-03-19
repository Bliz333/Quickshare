# QuickShare 项目状态（2026-03-19）

## 2026-03-19 SMTP 后台化完成
- SMTP 邮件配置已接入管理员后台，支持运行时读取和修改 SMTP 主机、端口、用户名、密码、发件人地址和 STARTTLS 开关
- 密码字段不回显明文，前端只展示"已设置/未设置"状态；更新时留空则保持现有密码
- 新增"发送测试邮件"功能，管理员可在保存 SMTP 配置后直接验证连通性
- `EmailServiceImpl` 改为按运行时策略动态创建 `JavaMailSender`，不再依赖 Spring Boot 自动配置的静态 Bean
- 新增 `SmtpPolicy` record、`SmtpPolicyService`，沿用"配置默认值 + system_setting 覆盖值"模式
- 后端 137 测试全通过（+6 SMTP 策略测试），JS 语法检查通过，Docker smoke test 通过

## 2026-03-19 Docker Smoke Test 通过
- 在 WSL2 + Docker Compose 环境完成完整 smoke test，覆盖以下场景：
  - 首页加载、管理员登录 + JWT、角色同步
  - 隐藏后台入口 `/console/{slug}` 正确路由（正确 slug 200，错误 slug 404，直接访问 admin.html 被拦截 401）
  - 管理员后台全部策略端点（频控、CORS、上传、预览、注册、控制台访问）均正常返回
  - 公开注册设置接口按运行时配置正确响应
  - DOCX / XLSX 上传后 LibreOffice headless 转 PDF 预览成功
  - 文件下载返回原始文件
  - 匿名上传、匿名分享、公开分享查询、公开下载全链路通过
  - 错误提取码返回 400，频控超限返回 429
  - 动态修改后台 slug 后旧路径 404、新路径 200
  - 动态切换邮箱验证开关后公开接口实时生效
  - 关闭匿名上传后匿名请求返回 403
  - 注册页、网盘页、PDF 查看器页面均正常加载
- 详细记录：`docs/archive/2026-03-19-docker-smoke-test.md`

## 2026-03-19 本轮增量（管理员后台与注册控制）
- 管理员后台现在已支持直接新增用户、删除用户，并补了”不能删除当前登录管理员 / 不能删掉最后一个管理员”的后端保护。
- 管理员后台入口不再暴露为公开固定 `admin.html`，改为 `/console/{slug}` 隐藏路径；`slug` 既可由 `compose/.env` 初始化，也可在管理员后台里直接修改。
- 注册与验证设置已经接入管理员后台，当前可直接控制：
  - 邮箱验证码注册开关
  - reCAPTCHA 开关
  - reCAPTCHA site key / secret key / verify URL
- 注册页已经改为读取公开运行时设置：
  - 关闭邮箱验证码后，会隐藏发送验证码按钮和验证码输入区
  - 关闭 reCAPTCHA 后，不再加载 Google 脚本
- 当前 `compose.yaml` / `.env.example` 已补 `ADMIN_CONSOLE_SLUG` 与 `REGISTRATION_EMAIL_VERIFICATION_ENABLED`，本地测试默认更容易直接联调。
- 本轮详细记录：`docs/archive/2026-03-19-admin-console-and-registration-controls.md`
- 本轮回归结果：
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`
  - `node --check src/main/resources/static/js/admin.js`
  - `node --check src/main/resources/static/js/session.js`
  - `node --check src/main/resources/static/js/auth.js`
  - `node --check src/main/resources/static/js/register.js`
  - `node --check src/main/resources/static/js/lang-switch.js`
  - `ruby -e "require 'yaml'; YAML.load_file('compose.yaml'); puts 'compose.yaml OK'"`

## 当前完成情况
- 后端：Spring Boot 3.2 + MyBatis-Plus；支持注册/登录（JWT）、邮箱验证码（Redis 缓存）、基础文件上传/预览/下载、分享链接创建与校验、文件/文件夹的新增、删除、重命名（部分）。
- 前端：静态页 index/login/register/netdisk/admin，包含上传与分享流程、多语言与主题切换、网盘文件展示/搜索/本地缓存，以及最小管理员后台页面。管理员页面已接通概览、用户、文件、分享管理和基础操作，并已可直接调整频控策略、上传策略（含匿名上传开关）、预览策略、CORS、后台隐藏入口，以及注册与验证设置；当前也已支持在后台直接新增 / 删除用户。
- 安全加固（进行中）：引入 Spring Security + JWT 过滤、全局异常处理；控制器层已切到认证上下文并返回正确 HTTP 状态码；首页共享链路已调整为“匿名可上传分享、网盘能力仍需登录”；分享信息查询、预览、下载已补最小回归，并为匿名上传、公开分享查询、公开下载补了基于 Redis 的最小频控；公开分享查询现已补 `IP + shareCode` 维度的提取码错误次数限制，超限返回 `429`，成功校验后会清理错误计数；限流策略、上传策略、预览策略、CORS、后台入口策略和注册验证设置来源都已抽成独立 provider，并已接入管理员面板可调覆盖值；上传策略当前已支持服务层大小限制、扩展名白名单和匿名上传总开关；预览策略当前已支持总开关、图片 / 视频 / 音频 / PDF / 文本 / Office 文档族开关与扩展名收窄；用户自有文件下载现已从预览链路拆分到 `/api/files/{id}/download`，避免预览策略影响正常下载；Office 文档预览现已补上 LibreOffice headless 转 PDF provider，并新增同源 PDF.js 查看器统一承接 PDF / Office 浏览；控制器层宽松 `@CrossOrigin` 已移除，默认 CORS 改为白名单；`User.role` 已落库并接入注册 / 登录 / JWT 角色流转；JWT 过滤现已改为只接受正常登录 access token，并以数据库当前角色为准；新增 `/api/profile` 供前端同步当前登录态，首页 / 网盘 / 管理页管理员入口已改为先向服务端解析当前隐藏后台路径再跳转；公开注册页也已改为按运行时设置动态决定是否显示邮箱验证码和 reCAPTCHA。
- 部署基线（已补齐）：新增 `Dockerfile`、`compose.yaml`、`.env.example` 与 MySQL 初始化脚本，当前版本已完成服务器 Docker Compose 联调；运行时镜像现已内置 LibreOffice headless 与常用字体，`compose` 单文件部署也已接入启动期管理员账号自举，部署完成后可直接登录管理后台；同时也已补 `ADMIN_CONSOLE_SLUG` 和 `REGISTRATION_EMAIL_VERIFICATION_ENABLED`，方便本地或测试环境直接起栈联调。

## 进度表
| 阶段 | 状态 | 当前判断 | 下一步 |
| --- | --- | --- | --- |
| 阶段 0：基线与配置清理 | **已完成** | Docker Compose smoke test 全部通过（2026-03-19）；LibreOffice 预览、管理员自举、隐藏后台入口均在真实容器环境验证通过。 | 继续收紧生产默认值。 |
| 阶段 1：安全与鉴权强化 | 进行中 | 安全加固和 Docker smoke test 均通过；SMTP 已后台化，支持运行时配置和测试邮件。 | 邮件模板体系、管理员公告邮件、secret 加密方案。 |
| 阶段 2：文件夹与文件闭环 | 进行中 | `/api/files?folderId=`、上传 `folderId`、文件夹重命名、重名冲突校验、物理文件清理以及网盘分享参数对齐已补上，目录主链路已基本连通。 | 继续收口更深层目录联调、逻辑删除一致性和页面缓存边界。 |
| 阶段 3：管理员体系与后台 | 进行中 | `User.role` 已落库并接入 JWT，第一批 `ADMIN` 管理员接口、最小后台页面以及频控 / 上传 / 预览 / CORS 策略表单都已就位，管理员已可管理用户、文件、分享和首批安全策略；上传策略现已支持匿名上传开关，预览策略已支持多文件族和扩展名收窄。 | 继续扩充更多可调策略项，并补后台交互和前端回归。 |
| 阶段 4：易支付接入 | 未开始 | 仅有规划，无订单模型、回调或签名验签实现。 | 阶段 1-3 稳定后再接入。 |
| 阶段 5：运维与质量 | 未开始 | 已补最小容器化部署与 MySQL 初始化脚本，但仍缺少 Flyway/Liquibase、CI、监控与覆盖率。 | 从分享/预览与目录闭环开始补更完整的自动化测试，再推进迁移脚本和 CI。 |

## 当前执行框架
1. 管理员页面已接通 overview / users / files / shares 与首批策略配置（频控 / 上传 / 预览 / CORS / 后台入口 / 注册验证），并且管理员身份现已通过服务端实时确认；当前后台也已支持新增用户、删除用户、隐藏后台入口路径切换，以及邮箱验证码 / reCAPTCHA 开关维护。
2. 每完成一个小步就补测试并执行 `mvn test`。
3. 当前文件主链路、Docker 联调基线、首页匿名共享入口、分享 / 预览 / 下载最小回归、三个公开入口的基础频控、提取码错误次数限制、CORS 白名单收口、角色基础落库、管理员接口、后台页面、频控 / 上传 / 预览 / CORS / 后台入口 / 注册验证策略接管，以及管理员角色实时同步都已打通；下载链路也已从预览链路拆开；Office 文档预览也已接上 LibreOffice headless 转 PDF 与同源 PDF.js 查看器；`compose` 部署时也可直接自举首个管理员账号。下一步先补真实 Docker / LibreOffice 环境 smoke test，再继续 SMTP、邮件模板 / 公告，以及敏感后台配置的收口工作。

## 下次续做起点
- 本轮记录：`docs/archive/2026-03-19-docker-smoke-test.md`
- 上一轮记录：`docs/archive/2026-03-19-admin-console-and-registration-controls.md`
- 历史交接入口：`docs/archive/2026-03-18-session-handoff.md`
- Docker smoke test 已全部通过（隐藏后台入口、Office 预览、注册页动态配置、匿名上传/分享全链路）。
- SMTP 后台化已完成（运行时可调 SMTP 配置 + 测试邮件功能）。
- 下一步：邮件模板体系 → 管理员公告/通知邮件 → secret 加密方案。

## 主要缺陷与风险
- 配置安全：现已去除明文密钥，需按环境变量/本地 profile 正确注入，否则无法连接外部资源。
- 部署侧风险：虽然已补 `compose.yaml`、基础建表脚本、LibreOffice 运行依赖和启动期管理员自举，但生产部署时仍需显式设置 `JWT_SECRET`、邮件参数、CORS 白名单以及持久化目录策略；本轮新增了 `user.role` 字段和 `system_setting` 表，已有数据库需要先执行 `docker/mysql/manual/2026-03-18-add-user-role.sql` 与 `docker/mysql/manual/2026-03-18-add-system-setting-table.sql`；如果不使用启动自举，也仍可参考 `docker/mysql/manual/2026-03-18-promote-user-to-admin.sql` 手工提升首个管理员。
- 鉴权待补完：已移除 `userId=1` 回退、控制器改为读取 Security 上下文，并补了文件接口鉴权回归；首页匿名上传/分享现通过临时分享凭证与网盘登录态拆分，分享信息查询 / 预览 / 下载也已补回归；匿名上传、公开分享查询、公开下载都已加最小频控，提取码错误次数也已按 `IP + shareCode` 单独限流，限流、上传策略、预览策略与 CORS 策略来源也已解耦并接入后台可调覆盖值；当前登录鉴权已改为只接受 access token 并以数据库角色为准，前端管理员入口也会实时同步当前身份；当前管理员模型只保留 `USER` / `ADMIN`，管理员接口、最小后台页面和首批策略配置界面都已具备最高权限入口，但更多策略项仍未迁入后台。
- 文件夹/文件闭环仍需联调：目录列表、上传归属、文件夹重命名、重名冲突校验与物理删除已补齐，但更深层目录回归、前端缓存边界和逻辑删除一致性还未系统验证。
- 文件可靠性：上传基础校验与流关闭已处理，删除也会同步清理物理文件；已补“逻辑删除文件不可继续分享”的校验，但 `ShareLink.status`、分享唯一性、下载次数并发安全、MD5/写入流程优化仍待继续处理。
- 基础设施：已有 Docker Compose 和初始化 SQL，可用于服务器联调；但仍缺少迁移脚本体系、自动化测试覆盖、日志与监控体系；前端管理员页面目前也只有手工联调与脚本语法检查，没有浏览器自动化回归。
- 测试环境提示：`QuickshareApplicationTests` 在本地未启动 MySQL 时，当前仍会打印一次 `Connection refused` 告警；现阶段 `SystemSettingOverrideServiceImpl` 预加载采用 fail-open，会回退到文件配置，因此不会导致本轮 `mvn test` 失败，但后续若收紧启动策略要同步处理这条测试噪音。
- 预览能力边界：管理员后台现已能控制图片 / 视频 / 音频 / PDF / 文本 / Office 文档族预览开关，并可按扩展名继续收窄；Office / 表格 / 演示文档现在已改为走 LibreOffice headless 转 PDF + 同源 PDF.js 查看器，镜像里也已内置 LibreOffice；但当前本地开发环境没有 Docker 可执行，因此这轮还缺真实 `compose` 起栈 smoke test，以及是否继续对齐公开分享页的收口工作。
- 后续后台能力：SMTP 运行时配置、邮件模板管理、管理员通知 / 公告邮件，以及 Cloudflare Turnstile / Google reCAPTCHA 提供器切换均已加入后续工作流，但本轮尚未开始实现。
- 文档与协议：README 描述的特性与实现程度不完全一致；仓库缺少独立的 `LICENSE` 文件。

## 近期改进优先级（建议顺序）
1) 安全与配置：在已完成提取码错误次数限制、CORS 白名单收口、`User.role` 落库、第一批 `ADMIN` 接口、最小管理员页面、频控 / 上传 / 预览 / CORS 策略后台化，以及管理员角色实时同步的基础上，先把 LibreOffice 预览 provider 做完真实环境 smoke test，再继续把更多安全策略接入后台可调项和更细的预览策略。
2) 文件/文件夹闭环：上传、列表、重命名、删除全链路支持 `folderId`；`/api/files` 支持按文件夹查询并过滤逻辑删除；补齐 `/folders/{id}/rename`；删除时同步清理物理文件。
3) 分享与预览：确保 `ShareLink` 唯一性与默认状态；下载/预览校验过期/次数/权限；为图片/视频增加缩略图缓存与限流。
4) 可运维性：在现有 Docker Compose 基线基础上，引入 Flyway/Liquibase 建表，增加单元/集成测试（鉴权、上传、分享、文件夹），限制 CORS 域名，完善日志与全局错误返回格式。
5) 产品化：修订 README/前端文案与实际功能对齐，新增 LICENSE，补充部署与性能调优指引。

## 运行与配置提示
- 推荐新增 `application-local.yml`（不入库）并通过环境变量注入数据库、Redis、SMTP、JWT、reCAPTCHA、上传目录等敏感配置。
- 如需启用 Office 文档稳定预览，还需确保运行环境可执行 `OFFICE_PREVIEW_COMMAND`（默认 `soffice`），并为预览缓存目录预留可写权限。
- 若使用容器部署，`.env.example` 已提供首个管理员自举配置；首次对外暴露前应至少修改 `BOOTSTRAP_ADMIN_PASSWORD`、`JWT_SECRET` 和 `CORS_ALLOWED_ORIGINS`。
- 运行时需本地 MySQL 与 Redis，上传目录由 `file.upload-dir` 自动创建；生产环境建议开启对象存储或独立磁盘并配置备份/限流。
- 服务器联调可以直接使用仓库中的 `compose.yaml`；首次启动会执行 `docker/mysql/init/001-schema.sql` 建表，后续若需重建库需同时清理 MySQL 数据卷。
