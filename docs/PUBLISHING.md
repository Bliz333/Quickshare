# GitHub 发布与仓库卫生

本文件只处理公开仓库卫生。任务分支 commit/push/PR 按全局规则自主执行；合并主线、生产发布、force-push 和历史重写仍需明确授权。

## 1. 机密与隐私

- `.env`、本地 profile、SSH key、支付/SMTP/S3/TURN/Google 凭据不得被追踪。
- `.env.example` 只保留公开占位值和示例域名；`JWT_SECRET`、`SETTING_ENCRYPT_KEY` 保持为空以触发生产启动校验，数据库 starter 口令必须在对外部署前替换。
- 真实主机、用户名、IP、密钥路径放 `.agents/local/` 或本机 SSH config。
- 发布前扫描新增内容，不在命令里回显 secret 值：

```bash
git diff --cached --name-only
rg -n 'BEGIN .*PRIVATE KEY|Authorization: Bearer|gh[opusr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}' \
  README*.md docs src scripts .env.example compose.yaml
```

命中只是线索，需要区分变量名/占位符与真实值。

## 2. 文档与运行一致性

- 环境变量以 `.env.example`、`application.yml`、`compose.yaml` 为准。
- API/WebSocket 以 controller/config 为准；新文档使用 Transfer canonical 路由。
- 当前能力写 `STATUS.md`，候选写 `PLAN.md`，历史写 `CHANGELOG.md` / `archive/`。
- 不在 README 宣称“最新远端已通过”来代替当前提交的 CI/测试证据。

## 3. 验证

按 `docs/ai/validation.md` 选择门禁。发布候选默认：

```bash
./scripts/release-ready.sh
git diff --check
git status --short
```

运行态候选在隔离环境追加：

```bash
RELEASE_READY_FULL=1 ./scripts/release-ready.sh
```

## 4. Git 检查

```bash
git status --short --branch
git diff --stat <target>...HEAD
git remote -v
git log -1 --format='%h %an <%ae> | %cn <%ce> | %s'
```

确认没有 `.env`、`node_modules/`、`target/`、`test-results/`、浏览器报告或本机临时文件。提交身份遵循当前仓库配置，不在共享文档硬编码个人邮箱。

已经公开的敏感值必须立即轮换。清理 Git 历史属于破坏性兼容操作，需明确授权和协调所有 clone；不能只删当前工作树文件，也不能未经授权自行 amend/force-push。

## 5. 发布后

- 核对远端 commit SHA 与审查/CI 的最终 SHA 一致。
- 生产发布另按 `docs/ai/platform.md` 和 `docs/ops/`，不把 push 任务分支当成上线。
- 若真实凭据曾泄漏，先轮换并撤销，再处理历史；历史清理不能替代轮换。
- 移动端只有规划文档。在原生工程、签名资产和商店流水线存在前，不发布移动版本声明。
