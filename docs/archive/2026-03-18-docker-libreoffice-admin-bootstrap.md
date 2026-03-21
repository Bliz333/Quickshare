# 2026-03-18 Docker 部署补齐：LibreOffice + 启动管理员自举

## 本轮目标

- 把 Office 文档预览所需的 LibreOffice headless 直接并入应用镜像
- 保持 `compose.yaml` 单文件部署，不额外拆独立 Office 服务
- 增加启动期管理员账号自举，让部署完成后可以直接登录管理后台

## 本轮改动

### 1. Docker 镜像内置 LibreOffice

- `Dockerfile` 运行时镜像新增安装：
  - `libreoffice-core`
  - `libreoffice-writer`
  - `libreoffice-calc`
  - `libreoffice-impress`
  - `fonts-noto-cjk`
  - `fonts-dejavu-core`
  - `fontconfig`
- 同时补了默认环境变量：
  - `OFFICE_PREVIEW_COMMAND=soffice`
  - `OFFICE_PREVIEW_CACHE_DIR=/opt/quickshare/uploads/.preview-cache`

### 2. Compose 单文件部署继续成立

- `compose.yaml` 里的 `app` 服务已新增：
  - Office 预览命令与缓存目录环境变量
  - 启动管理员账号自举环境变量
- 当前仍保持：
  - `app`
  - `mysql`
  - `redis`
  三个服务单文件起栈

### 3. 启动管理员账号自举

- 新增：
  - `BootstrapAdminProperties`
  - `AdminBootstrapRunner`
- 当前支持的环境变量：
  - `BOOTSTRAP_ADMIN_ENABLED`
  - `BOOTSTRAP_ADMIN_USERNAME`
  - `BOOTSTRAP_ADMIN_PASSWORD`
  - `BOOTSTRAP_ADMIN_EMAIL`
  - `BOOTSTRAP_ADMIN_NICKNAME`
  - `BOOTSTRAP_ADMIN_RESET_PASSWORD_ON_STARTUP`
- 启动行为：
  - 若配置开启且用户名不存在，则创建一个 `ADMIN`
  - 若用户名已存在，则确保其角色提升为 `ADMIN`
  - 若 `RESET_PASSWORD_ON_STARTUP=true`，则每次启动都会把密码重置为配置值

### 4. 默认部署体验

- `.env.example` 现在已带默认启动管理员示例：
  - 用户名：`admin`
  - 密码：在私有 `.env` 中显式设置，不再建议在公开仓库内保留默认管理员密码示例
- 因此按当前仓库默认流程：
  - `cp .env.example .env`
  - `docker compose up --build -d`
  后，部署完成即可直接登录管理后台

## 本轮验证

### 里程碑 1：管理员自举逻辑

```bash
mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminBootstrapRunnerTest test
```

结果：通过

### 里程碑 2：部署配置

```bash
ruby -e "require 'yaml'; YAML.load_file('compose.yaml'); puts 'compose.yaml OK'"
```

结果：通过

备注：

- 本地环境当前 `docker` 不可用，`docker compose config` 无法执行
- 因此这轮只完成了 YAML 解析校验，尚未做真实镜像构建 smoke test

## 建议下一步

1. 在实际具备 Docker 的部署机执行一次 `docker compose up --build -d` smoke test
2. 首次对外暴露前，修改默认 `BOOTSTRAP_ADMIN_PASSWORD`、`JWT_SECRET`、`CORS_ALLOWED_ORIGINS`
3. 继续把更多后台策略项收口到管理员面板，减少部署后再手工改配置的次数
