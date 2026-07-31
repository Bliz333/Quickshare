# QuickShare 文档入口

[English](README.md) | [简体中文](README.zh-CN.md)

这里把当前产品事实、工程知识、运维手册和历史证据分开维护。带日期的 archive 只代表当时，不代表当前版本。

## 从哪里开始

| 目标 | 阅读入口 |
| --- | --- |
| 安装或了解产品 | [`../README.zh-CN.md`](../README.zh-CN.md) |
| 用 AI 工具修改代码 | [`../AGENTS.md`](../AGENTS.md) |
| 查看当前维护状态 | [`STATUS.md`](STATUS.md) |
| 选择正确的验证方式 | [`ai/validation.md`](ai/validation.md) |
| 运行或部署服务 | [`ai/platform.md`](ai/platform.md) 与 [`ops/`](ops/) |
| 评估后续候选工作 | [`PLAN.md`](PLAN.md) |
| 规划移动端 | [`mobile/README.md`](mobile/README.md) |

## 文档分层

### 当前工程知识

根 [`AGENTS.md`](../AGENTS.md) 是项目知识地图，稳定且能由代码验证的细节放在 [`ai/`](ai/)：

- [`ai/architecture.md`](ai/architecture.md)：系统分层、数据所有权、安全、存储与兼容边界
- [`ai/frontend.md`](ai/frontend.md)：静态前端、路由、会话、样式和多语言
- [`ai/transfer.md`](ai/transfer.md)：Quick Transfer 直传/中转、任务账本、信令与 relay E2EE
- [`ai/validation.md`](ai/validation.md)：按风险选择测试及 CI 覆盖边界
- [`ai/platform.md`](ai/platform.md)：本地、Compose、预发布、生产与机密边界

### 运维手册

[`ops/`](ops/) 包含首次生产部署、HTTPS 反代、容量、备份和环境差异。真实主机与凭据只放在 Git 之外的 `.env`、SSH config 或 `.agents/local/`。

### 状态与计划

- [`STATUS.md`](STATUS.md) 只保留当前能力与已知边界。
- [`PLAN.md`](PLAN.md) 是未承诺的候选事项，不是既定路线图。
- [`CHANGELOG.md`](CHANGELOG.md) 与 [`archive/`](archive/) 保存按时间追溯的证据。

### 历史和规划材料

- [`archive/`](archive/) 的命名、命令和验证结果可能已经过时。
- [`mobile/`](mobile/) 是移动产品规划；仓库当前没有原生 Android/iOS 工程。
- [`web-design-phase.md`](web-design-phase.md) 等旧设计材料只作历史参考，除非当前前端规则明确指向它们。

## 维护规则

只有代码、配置、运维或产品事实变化时才更新文档。旧内容直接修正或删除，不再向当前状态文件追加会话日志。发布前必须以脚本、`.env.example`、`compose.yaml` 和源码核对命令与变量名。
