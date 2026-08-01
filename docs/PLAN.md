# QuickShare 候选计划

本项目当前没有已承诺的产品路线图。本文件只列从代码和现有边界能确认的候选工作，排序不等于立项；一旦决定做某项，应在 issue/spec 中写明验收标准，而不是继续向本文件追加执行日志。

## 推荐优先级

### 1. 加密 relay 的服务端保存边界

现状：前端阻止 encrypted relay 直接保存到网盘，但 API 仍可能把 ciphertext 当普通文件保存。

候选目标：为服务端引入可验证的 encrypted payload 元数据和明确拒绝/解密协议，补 API 绕过 UI 的回归。该工作涉及兼容与密钥模型，实施前需要产品/安全决策。

### 2. Transfer 多副本前置设计

现状：WebSocket session、房间与 pair binding 位于单进程内存。

候选目标：在需要水平扩容前决定 sticky session 或 Redis/pub-sub 等外置方案，并覆盖断线、重连、跨节点 signal 和清理语义。没有扩容需求时不应提前增加分布式复杂度。

### 3. QuickDrop 兼容表面收口

现状：代码和数据库已使用 Transfer，但 API、WebSocket、环境变量、测试名仍保留旧别名。

候选目标：先定义 deprecation 版本、调用量观测和迁移说明，再分阶段移除；未完成兼容决策前继续保留现有测试。

### 4. 真实浏览器验证稳定性

现状：GitHub CI 覆盖 mock Playwright，不覆盖真实登录、上传、后台和 WebRTC/TURN。

候选目标：把可重复的 live backend 用例接入隔离预发布门禁，并明确 direct 未命中与功能失败的区别，避免网络条件让 CI 随机失败。

### 5. 移动产品决策

现状：只有 `docs/mobile/` 规划，没有 Android/iOS 工程。

候选目标：先选择 PWA/WebView/原生及首发能力范围，再创建工程。不要在产品方向未定时同时维护两套空壳客户端。

## 不应作为计划继续堆积的内容

- 已完成任务和每日执行记录：放 git history / PR / `docs/archive/`。
- 当前能力：放 `docs/STATUS.md`。
- 稳定工程知识：放 `AGENTS.md` / `docs/ai/`。
- 真实主机、凭据和上线状态：放 Git 外的受控运维记录。
