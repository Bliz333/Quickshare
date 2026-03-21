# 2026-03-21 预发布服务器烟测

## 目标

- 在真实服务器上完成一轮“接近上线”的部署前烟测
- 验证域名、容器编排、基础健康检查和 QuickDrop 主路径
- 不进入正式发布，只做预发布验证

## 服务器概况

- Debian 12
- 约 2 GB 内存
- 根分区约 15 GB，可用约 14 GB
- 域名 `quickshare.878877.xyz` 已解析到目标服务器

## 本轮动作

- 通过 SSH 登录服务器
- 确认机器初始状态：
  - 未安装 `docker`
  - 未安装 `git`
  - 80 / 443 / 8080 无服务监听
- 安装：
  - `docker.io`
  - `docker-compose`
  - `git`
  - `curl`
- 将当前工作树打包上传到服务器，不通过 GitHub 拉取
- 在服务器上补预发布 `.env`
  - 生成临时 `JWT_SECRET`
  - 生成临时 `SETTING_ENCRYPT_KEY`
  - 生成临时数据库密码
  - 生成临时 bootstrap admin 密码
- 收紧 `compose` 端口暴露：
  - 应用对外监听 `80`
  - MySQL 仅绑定 `127.0.0.1:3306`
  - Redis 仅绑定 `127.0.0.1:6379`
- 启动：
  - `docker-compose up --build -d`

## 烟测结果

- `docker-compose ps`
  - `app`、`mysql`、`redis` 全部启动
- `GET http://127.0.0.1/api/health`
  - 返回 `UP`
  - 数据库 `UP`
  - Redis `UP`
  - 当前为本地存储模式
- `GET http://quickshare.878877.xyz`
  - 返回 `200`
- `POST /api/auth/login`
  - bootstrap admin 登录成功
- `POST /api/quickdrop/sync`
  - 返回当前设备、设备列表和推荐 chunk 大小
- `POST /api/public/quickdrop/shares`
  - 公开分享会话创建成功

## 备注

- 服务器当前仍是预发布状态，不建议直接作为正式生产基线
- 当前尚未接入 HTTPS / 证书
- 当前 QuickDrop 只验证了创建与 sync 主路径，尚未在服务器上做完整真实文件上传下载链路
- 服务器侧临时管理员账号信息仅保存在服务器本地 `/root/quickshare/.server-secrets.txt`
