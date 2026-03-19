# 2026-03-18 Docker 打包与服务器联调记录

- 分支：`feature/hardening-plan`
- 目标：补齐服务器联调用的容器化部署资产，并确认当前版本可通过 `docker compose` 在服务器上启动验证

## 本轮完成的变更

- 新增 `Dockerfile`，采用多阶段构建生成 Spring Boot 运行镜像。
- 新增 `compose.yaml`，编排 `app`、`mysql`、`redis` 三个服务，便于服务器直接 `docker compose up --build` 联调。
- 新增 `.env.example`，统一服务器部署时需要调整的环境变量。
- 新增 `.dockerignore`，减少镜像上下文体积。
- 新增 `docker/mysql/init/001-schema.sql`，为首次启动的 MySQL 容器提供基础建表脚本。
- 更新 `README.md`，补充 Docker 启动方式、环境变量说明和建表方式说明。
- 更新 `.gitignore`，忽略本地 `.env` 文件，避免部署密钥误入仓库。

## 验证情况

### 本地验证

- `mvn -q -Dmaven.test.skip=true package`
- `ruby -e "require 'yaml'; YAML.load_file('compose.yaml'); puts 'compose.yaml OK'"`

### 服务器验证

- 已通过 `docker compose` 方式完成服务器联调。
- 当前版本可正常打包、启动并进行基础效果验证。
- 以上服务器验证结论来自本轮用户实际测试反馈。

## 影响文件

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `README.md`
- `compose.yaml`
- `docker/mysql/init/001-schema.sql`

## 当前结论

- 项目已经具备一套可直接用于服务器联调的最小容器化方案。
- 阶段 1 与阶段 2 的当前成果已经可以在服务器环境做持续回归，不再局限于本地运行。
- 后续开发可以直接基于这套 compose 基线继续推进分享/预览回归、权限细化和更深层目录联调。

## 建议的下一步

1. 继续补分享/预览/下载路径的异常与鉴权回归测试。
2. 开始收紧生产向配置，尤其是 `CORS_ALLOWED_ORIGINS`、`JWT_SECRET` 和邮件配置。
3. 视服务器部署方式决定是否继续补 `nginx` 反代、持久化目录映射和更严格的健康检查。
