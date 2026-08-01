# QuickShare 架构与领域边界

## 系统形态

QuickShare 是单仓库、单 Spring Boot 应用：同一个进程提供 JSON API、文件流、WebSocket 信令和静态网页。部署时通常与 MySQL、Redis 组成 Compose 栈；文件内容可落本地持久卷或 S3 兼容对象存储。

```text
Browser
  |-- HTML/CSS/JS ------------> Spring MVC static pages
  |-- JSON / file streams ----> Controller -> Service -> Mapper -> MySQL
  |-- WebSocket signaling ----> TransferWebSocketHandler -> in-memory sessions
                                            |
Redis <--------- rate limiting/runtime ---- Application -----> User files: local volume or S3
                                            |
                                            +---------------> Transfer temp: local volume
```

WebSocket 在线会话和房间是进程内状态；MySQL 中的 transfer task / relay / pair task 才是可恢复的服务端任务事实。多应用副本之前必须先处理信令会话、房间和其它进程内状态的外置或粘性路由。

## 后端分层

| 目录 | 职责 |
| --- | --- |
| `controller/` | HTTP / WebSocket 边界、鉴权主体、响应适配 |
| `service/` | 业务接口、策略值对象和跨入口抽象 |
| `service/impl/` | 业务规则、事务与资源编排 |
| `service/preview/` | 文件/分享/传输共用的预览交付模块 |
| `mapper/` | MyBatis Plus 数据访问 |
| `entity/` | MySQL 持久化模型 |
| `dto/` / `vo/` | API 输入 / 输出模型 |
| `config/` | Security、配置属性、WebSocket、CORS 与启动校验 |
| `common/` | `Result<T>`、角色、全局异常与共享错误类型 |

普通 JSON 返回 `{code,message,data}` 的 `Result<T>`。下载、预览和 HTML 资源直接使用 `ResponseEntity` / `HttpServletResponse`，不要为了形式统一把二进制塞进 JSON。

## 数据与所有权

- `user`：身份、角色、会员、存储与下载配额；使用逻辑删除。
- `file_info`：文件/文件夹树、内容哈希、物理存储键；使用逻辑删除。
- `share_link`：公开分享码、提取码、过期与下载次数。
- `system_setting`：可由管理台修改的运行时策略，敏感值经 AES-GCM 加密。
- `plan`、`payment_provider`、`payment_order`：套餐、支付商户和订单。
- `transfer_device`、`transfer_relay`、`transfer_task`、`transfer_pair_task`、`transfer_public_share`：Quick Transfer 服务端状态。
- `notification_record`：公告/通知投递记录。

Flyway 是结构真相源。V6-V10 曾使用 `quickdrop_*` 表名，V11 已迁移为 `transfer_*`；不要根据旧 migration 文件继续创建 QuickDrop 实体或查询。

## 身份与授权

- Spring Security 使用无状态会话；JWT 可从 Bearer header、HttpOnly `quickshare_access_token` cookie 或兼容 `?token=` 读取。
- 活跃会话接近过期时，后端返回 `X-Auth-Refresh` 并刷新 cookie；前端 `session.js` 同步 localStorage token。
- 密码使用 BCrypt。Google 登录入口由 `SocialLoginController` 验证 provider token 后复用用户模型。
- `AdminController` 使用 `@PreAuthorize("hasRole('ADMIN')")`；管理台隐藏 slug 不是授权手段，只是降低公开暴露。
- `ProdSecurityConfigurationValidator` 在生产配置不安全时阻止启动；不得通过降低校验来“让部署先起来”。

## 存储、配额与预览

网盘和普通分享的文件内容通过 `StorageService` I/O，`DelegatingStorageService` 根据运行时 `StoragePolicy` 选择本地或 S3。对应业务层保存的是 storage key，不应假定它总是宿主机路径。需要本地路径的预览转换通过 `acquireLocalPath()` 获取租约：本地文件是 borrowed，S3 下载副本是 owned，关闭租约时只清理 owned 临时文件。

Transfer relay 与公开取件是当前明确例外：`TransferServiceImpl` 直接在 `file.upload-dir/transfer-temp` 下写入分片和组装文件，controller 也从这些本地路径交付内容。切换网盘到 S3 不会把这些 payload 迁到共享存储；多副本部署前必须单独改造这条链路及其清理所有权。

`PreviewDelivery` 集中处理：

- 预览策略校验；
- Office 文件通过 `OfficePreviewService` 转 PDF；
- 图片缩略图临时文件的创建与关闭后清理；
- 原始流的文件名、content type、长度与 cache control。

文件删除、去重和保存到网盘同时涉及物理对象引用与用户配额；任何改动都要核对同内容多记录、文件夹递归、分享引用和失败回滚。

## 运行时策略

管理台可把注册、上传、预览、SMTP、CORS、频控、存储和支付配置写入 `system_setting`。各 `*PolicyService` 负责合并配置文件默认值与数据库 override；业务调用方不要直接读表或复制 fallback 规则。

Redis 频控采用 fail-closed 语义：依赖异常时不能默认放行受保护的公开入口。健康检查 `/api/health` 同时报告数据库、Redis、存储模式，以及本地存储时的磁盘风险。

## 命名与兼容

新代码、文档和 UI 统一使用 Transfer / Quick Transfer：

- canonical API：`/api/transfer/**`、`/api/public/transfer/**`
- canonical WebSocket：`/ws/transfer`
- canonical 页面：`/` 和 `/share`
- legacy：`/api/quickdrop/**`、`/api/public/quickdrop/**`、`/ws/quickdrop`、旧 QuickDrop HTML 路由

兼容入口已有回归测试。删除或改变它们属于兼容性决策，不能作为普通清理顺手完成。
