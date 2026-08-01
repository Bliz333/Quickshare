# QuickShare

[English](README.md) | 简体中文

**在线 Demo：** [https://smi.im](https://smi.im)

QuickShare 是一个基于 Spring Boot 的文件分享与个人网盘平台，包含：

- 带提取码、过期时间、下载次数限制的公开分享链路
- 支持文件夹、批量操作、拖拽移动和配额展示的个人网盘
- 支持同账号设备互传、浏览器直传和公开取件的 Quick Transfer
- 用于运行时策略、存储、邮件、支付和用户管理的后台管理台
- 本地文件系统与 S3 兼容对象存储
- 基于 LibreOffice 和 PDF.js 的 Office 文档预览
- Quick Transfer 中转 / 取件载荷使用浏览器端 AES-GCM 加密，服务器侧只保存密文

## 当前状态

- Web 产品已经覆盖分享、个人网盘、设备互传、管理台、支付和运行时策略。
- 项目当前处于维护、体验打磨、兼容和回归补强阶段。
- 新代码与路由使用 **Quick Transfer / Transfer**；QuickDrop 只保留在需要向后兼容的 API、WebSocket、环境变量和测试名中。
- 当前能力与已知边界见 [docs/STATUS.md](docs/STATUS.md)；历史远端测试结果只证明当时的提交，不代表当前分支。

## 核心能力

### 用户侧

- 文件上传、分享、预览、下载与提取码保护
- 多级文件夹、重命名、删除、移动、批量操作和拖拽移动
- 上传去重和引用感知删除
- 套餐页、支付结果页、用户订单历史、配额与 VIP 展示
- 注册验证码 provider 可在 Google reCAPTCHA 与 Cloudflare Turnstile 之间切换

### Quick Transfer

- 同账号设备发现，无需配对码
- 浏览器直传优先，失败后回退服务器中转
- 公开取件链接和匿名配对直传
- 中转回退使用浏览器端 AES-GCM 加密：服务器中转存储只保存和转发加密分片，而不是明文文件载荷。
- 服务端统一任务模型和直传 attempt 写回
- 任务详情可展示阶段、失败原因、回退原因和“已转存到网盘”反馈

### 中转传输安全模型

- 网络条件允许时，Quick Transfer 仍优先使用浏览器点对点直传。
- 当链路回退到服务器中转或公开取件时，文件会先在浏览器内通过 Web Crypto AES-GCM 加密，再按分片上传。服务器保存加密分片、IV 和必要元数据，因此中转存储保存的是密文而不是明文。
- 公开取件链接通过 URL fragment（`#key=...`）携带解密密钥；fragment 不会随 HTTP 请求发给服务器。拿到完整链接的人可以解密文件，因此完整链接仍应当按敏感信息处理。
- 同账号和匿名配对中转通过 WebSocket 交换接收端 ECDH 公钥材料，并用浏览器本地保存的 P-256 长期身份签名验证临时公钥，再由两端通过 HKDF 本地派生 AES-GCM 文件密钥。信令服务器只转发公钥材料和签名，不再转发原始文件密钥。
- 因为中转存储保存的是密文而不是明文，encrypted relay 文件在浏览器 UI 中暂不支持服务器端 Office 转换预览，也暂不支持直接“保存到网盘”，直到后续补客户端预览或用户密钥托管方案。当前限制是前端边界；绕过 UI 直接调用 API 仍可能把密文保存进网盘。

### 管理侧

- 隐藏路径管理台
- 注册、上传、预览、CORS、频控等运行时策略管理
- SMTP、邮件模板与公告投递统计
- 套餐、支付商户、订单和配额管理
- 本地磁盘容量 / 风险级别与 S3 连接状态可视化

## 快速开始

### Docker Compose

```bash
cp .env.example .env
# 至少配置：
# - DB_PASSWORD
# - MYSQL_ROOT_PASSWORD
# - JWT_SECRET
# - SETTING_ENCRYPT_KEY
# 可选：
# - BOOTSTRAP_ADMIN_*
# - STORAGE_TYPE=s3 及相关 S3_* 参数

docker compose up --build -d
# 如果你的环境只有旧版二进制：
# docker-compose up --build -d
```

访问入口：

- 首页：`http://localhost:8080`
- 网盘：`http://localhost:8080/drive`
- 分享 / 取件：`http://localhost:8080/share`
- 套餐页：`http://localhost:8080/pricing`
- 支付结果页：`http://localhost:8080/payment-result`
- 管理台：`http://localhost:8080/console/{ADMIN_CONSOLE_SLUG}`

### 本地开发

前置条件：

- Java 17+
- Maven 3.6+
- MySQL 8+
- Redis 6+

```bash
mysql -u root -p -e "CREATE DATABASE quickshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cp src/main/resources/application-local.example.yml src/main/resources/application-local.yml
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

## 配置

Compose 常用环境变量与安全占位值见 [`.env.example`](.env.example)；其它 Spring override 映射见 [`application.yml`](src/main/resources/application.yml)。

关键项：

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | JWT 签名密钥 |
| `SETTING_ENCRYPT_KEY` | 数据库敏感设置加密密钥 |
| `STORAGE_TYPE` | `local` 或 `s3` |
| `S3_ENDPOINT`、`S3_ACCESS_KEY`、`S3_SECRET_KEY`、`S3_BUCKET` | S3 兼容存储配置 |
| `BOOTSTRAP_ADMIN_ENABLED` | 启动时创建初始管理员 |
| `ADMIN_CONSOLE_SLUG` | 隐藏管理台路径 |
| `SERVER_COMPRESSION_ENABLED` | 启用 API / 静态资源 HTTP 压缩 |
| `REGISTRATION_EMAIL_VERIFICATION_ENABLED` | 注册时是否启用邮箱验证 |
| `QUICKDROP_STUN_URLS` | 沿用旧变量名的 Quick Transfer STUN 配置 |
| `QUICKDROP_TURN_URLS` | 沿用旧变量名的 Quick Transfer TURN 配置 |
| `QUICKDROP_TURN_USERNAME`、`QUICKDROP_TURN_PASSWORD` | 沿用旧变量名的 Quick Transfer TURN 凭据 |

## 测试与验收

按 [docs/ai/validation.md](docs/ai/validation.md) 的风险矩阵选择门禁。默认发布候选基线：

```bash
./scripts/release-ready.sh
# 在具备 Docker / 运行态配置的预发布主机上跑完整 RC 门禁：
RELEASE_READY_FULL=1 ./scripts/release-ready.sh
```

完整门禁会改变本机 Docker 状态，只适用于已配置的隔离开发/预发布环境。mock Playwright 不证明真实后端、WebRTC direct、TURN、S3 或 LibreOffice 运行态。更细说明见 [docs/README.zh-CN.md](docs/README.zh-CN.md) 和 [docs/TESTING.md](docs/TESTING.md)。

## 部署说明

- 应用镜像支持从新鲜 git 工作副本直接构建。
- `deploy-preprod.sh` 现在已经补上：
  - 本地 helper 缺失时回退到原生 `ssh` / `scp`
  - 远端无法直接读仓库时，优先走 “git bundle -> 服务器本地 bare mirror/worktree” 路径
  - 构建前资源检查和验收后的资源快照输出
- 对无法直接读取私有仓库的环境，当前更稳的做法是使用服务器本地 git mirror / bare repo，snapshot fallback 只保留为最后兜底。

## 文档入口

- [README.md](README.md)：英文主 README
- [AGENTS.md](AGENTS.md)：AI 工具使用的项目知识地图
- [docs/ai](docs/ai)：当前架构、前端、Transfer、验证与平台知识
- [docs/README.md](docs/README.md)：英文文档入口
- [docs/README.zh-CN.md](docs/README.zh-CN.md)：中文文档入口
- [docs/STATUS.md](docs/STATUS.md)：当前状态快照
- [docs/TESTING.md](docs/TESTING.md)：详细测试与验收流程
- [docs/PLAN.md](docs/PLAN.md)：未承诺的候选工作，不是既定路线图
- [docs/CHANGELOG.md](docs/CHANGELOG.md)：变更记录
- [docs/archive](docs/archive)：详细里程碑与会话归档

## 架构

| 层 | 技术栈 |
| --- | --- |
| 后端 | Spring Boot 3.2、Spring Security、JWT |
| 数据 | MySQL 8、MyBatis Plus、Flyway |
| 缓存 | Redis |
| 存储 | 本地文件系统或 S3 兼容对象存储 |
| 预览 | LibreOffice headless + PDF.js |
| 前端 | 原生 JS、HTML、CSS |
| 验证 | JUnit、仓库 smoke、Playwright、Dockerized 浏览器烟测 |

## 作者

Bliz333

## License

[MIT License](LICENSE)
