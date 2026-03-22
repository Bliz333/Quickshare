# 2026-03-22 发布脱敏、远端接入与路线图重排

## 背景

- 上一轮 QuickDrop 页面收口已经完成到“模式优先首屏 + 中心配对卡 + 次级记录页 + `hash` 导航”，但仍停留在未提交工作树。
- 仓库准备继续公开同步到 GitHub，因此需要先完成一轮正式的发布前脱敏与远端访问整理。

## 本轮完成

- 重新审阅并验证当前 QuickDrop 前端工作树：
  - `node --check src/main/resources/static/js/quickdrop.js`
  - `node --check src/main/resources/static/js/quickdrop-direct.js`
  - `node --check src/main/resources/static/js/lang-switch.js`
  - `./mvnw -q -DskipTests compile`
  - 通过静态资源服务器执行 `npx playwright test tests/e2e/quickdrop.spec.js`
- 将上一轮 QuickDrop UI 收口落为正式提交：
  - `feat: finalize quickdrop mode-first history flow`
- 清理仓库中不适合公开保留的真实部署标识：
  - 真实域名改成 `quickshare.example.com`
  - 真实服务器 IP 改成“预发布机（地址已脱敏）”
  - 发布流程文档补上 `git` 提交身份检查与修正步骤
- 将 GitHub remote 从 HTTPS 改为 SSH，并验证：
  - `ssh -T git@github.com`
  - `git push -u origin feature/hardening-plan`
- 为测试服务器补本机可复用访问方式：
  - `/root/.ssh/config` 已新增 `quickshare-test`
  - 本机已补 `quickshare-test-ssh` / `quickshare-test-scp`
  - 由于远端 `sshd` 当前仅开放 `password`，helper 统一封装了密码模式
  - 已确认 `quickshare-test-ssh 'hostname'` 与 `quickshare-test-scp ...` 可用

## 结论

- 现在 GitHub 上已经有一条可恢复的当前工作分支基线。
- 仓库公开同步前最显眼的隐私信息已完成脱敏。
- 本地到 GitHub、测试机两条远端链路都已打通，后续可直接进入“部署验证 -> 产品化收口 -> 自动化扩展”的下一轮迭代。

## 下一轮优先级

1. 预发布部署复现与真实公网/TURN 验证。
2. QuickDrop attempt 生命周期与统一任务语义补强。
3. QuickDrop 历史页独立 URL / 更明确产品流线。
4. 把当前默认验收组合继续固化到 CI / smoke。
