# GitHub 发布与脱敏流程

本项目准备公开推送到 GitHub 前，建议按下面顺序执行，不跳步。

## 1. 凭据与隐私清理

- 确认 `.env` 没有被追踪：
  - 当前 `.gitignore` 已忽略 `.env`
- 确认 `.env.example` 只保留占位值，不保留可直接登录的默认管理员口令
- 确认 `compose.yaml` 不再提供可直接复用的默认管理员密码
- 搜索仓库中的敏感信息：

```bash
rg -n "token|Authorization: Bearer|JWT_SECRET|SETTING_ENCRYPT_KEY|MAIL_PASSWORD|S3_SECRET_KEY|merchantKey|ChangeMeAdmin123|admin@example.com" README.md docs src .env.example compose.yaml tests scripts -g '!target'
```

- 对公开仓库不需要保留的值，改成：
  - 空值
  - 明确占位值
  - 或文档说明“请在私有 `.env` 中配置”

## 2. 运行与文档一致性

- 确认 `README.md`、`docs/STATUS.md`、`docs/PLAN.md`、`docs/CHANGELOG.md` 已反映当前真实能力
- 新功能如果有 archive 记录，确认顶层文档里没有悬空引用
- 对外文档避免写入本地专用 URL、私有邮箱、私有商户参数、真实 token

## 3. 小里程碑验证

- 至少执行：

```bash
./scripts/check-js.sh
./mvnw -q -DskipTests compile
```

- 对 QuickDrop 当前建议至少补：

```bash
./mvnw -q -Dtest=QuickDropServiceImplTest test
npx playwright test tests/e2e/quickdrop.spec.js
docker compose up --build -d app
```

## 4. Git 清理检查

- 查看工作区改动：

```bash
git status --short
git diff --stat
```

- 确认不应提交的内容没有进入索引：
  - `.env`
  - `node_modules/`
  - `test-results/`
  - `playwright-report/`
  - 本地生成的临时文件

## 5. 提交与推送

- 建议先本地提交：

```bash
git add .
git commit -m "feat: quickdrop public share and netdisk save flow"
```

- 推送前再次确认 remote：

```bash
git remote -v
```

- 确认当前 remote 指向的是你要公开的仓库，而不是私有镜像或错误地址

## 6. 首次公开后

- 立刻重新生成所有真正使用中的私密值：
  - JWT secret
  - 设置加密 key
  - 邮件口令
  - S3 secret
  - 支付商户密钥
- 如果历史里曾误提交过真实敏感信息，不要只删工作树文件：
  - 需要改写 git history
  - 并同步轮换对应凭据
