# QuickShare 当前状态

> 更新基线：2026-08-01，基于 `main` 的 `421e714`。本文件只描述仓库能力，不声称任何外部测试站或生产环境当前在线。

## 产品阶段

QuickShare 已完成主要 web 产品闭环，当前适合按维护型项目推进：修复、兼容性、体验改进、回归与运维加固。仓库没有原生 Android/iOS 客户端，也没有已承诺的下一阶段产品路线图。

## 当前能力

- 注册、密码/Google 登录、滑动 JWT 续签与用户资料
- 匿名或登录上传、公开分享、提取码、过期与下载限制
- 个人网盘、文件夹、批量/拖拽移动、去重、配额与预览
- 本地文件系统或 S3 兼容对象存储，管理台可运行时切换策略
- 图片、音视频、文本、PDF 和 LibreOffice Office 预览
- 套餐、支付商户、订单、会员/存储/下载配额
- SMTP、邮件模板、公告、注册/上传/预览/CORS/频控策略管理
- Quick Transfer：同账号设备、临时配对、WebRTC direct、relay fallback、公开取件和统一任务历史
- relay/public pickup 浏览器端 AES-GCM；同账号/配对链路通过 ECDH + HKDF 派生文件密钥
- `/api/health` 的数据库、Redis、存储连接和本地磁盘风险可见性

## 当前命名

代码、数据库和新文档使用 Transfer / Quick Transfer。以下旧名称仅为兼容：

- `/api/quickdrop/**`、`/api/public/quickdrop/**`
- `/ws/quickdrop`
- `/quickdrop.html`、`/quickdrop-share.html`
- `QUICKDROP_*` 环境变量

数据库已由 Flyway V11 把 `quickdrop_*` 表迁移为 `transfer_*`。旧迁移文件与 E2E 文件名仍可包含 QuickDrop，不应据此新增旧命名实现。

## 最近收口的工程基线

- Transfer attempt 的解析、合并、删除、摘要和任务投影集中到 `TransferAttemptLedger`；null/空/损坏账本有回归保护。
- 文件、公开分享和 Transfer 的预览交付集中到 `PreviewDelivery`，共享策略、Office 转换、缩略图与流生命周期。
- JWT 支持 HttpOnly cookie 与 `X-Auth-Refresh` 滑动续签，fetch/XHR 都能更新浏览器 token。
- Google 登录同时支持 One Tap 和居中 popup，并复用服务端身份验证入口。
- canonical API/WebSocket 已迁到 `/transfer`，旧 QuickDrop 路由保留兼容测试。

## 已知边界

- 加密 relay 的“不能直接保存到网盘”目前主要由前端限制；服务端没有完整验证 payload 是否仍为密文。它不是服务端强制安全保证。
- Transfer WebSocket session、房间与 pair binding 在单应用进程内存中。未经外置或粘性路由设计，不支持透明水平扩容。
- relay E2EE 无法直接使用服务端 LibreOffice；浏览器可解密的图片、文本、PDF 走客户端预览路径。
- `QUICKDROP_*` 变量和 legacy 路由仍属于兼容表面；移除前需要明确版本与迁移策略。
- 移动端文档只描述可选方案，没有可构建的 mobile artifact、签名或商店流水线。
- `docs/archive/` 中的远端直连结果、主机资源和部署提交仅是历史证据，不代表当前环境。

## 当前验证入口

- 默认候选门禁：`./scripts/release-ready.sh`
- 完整 Compose + smoke + browser：`RELEASE_READY_FULL=1 ./scripts/release-ready.sh`
- 详细测试选择：`docs/ai/validation.md`
- 当前平台边界：`docs/ai/platform.md`
