# QuickShare 文档入口

[English](README.md) | [简体中文](README.zh-CN.md)

这个目录是 QuickShare 的运行与维护文档入口。

## 推荐先看哪些文档

- [../README.md](../README.md)：英文主 README
- [../README.zh-CN.md](../README.zh-CN.md)：中文总览
- [STATUS.md](STATUS.md)：当前状态快照
- [TESTING.md](TESTING.md)：测试与验收流程
- [PLAN.md](PLAN.md)：下一阶段计划
- [CHANGELOG.md](CHANGELOG.md)：变更记录
- [PUBLISHING.md](PUBLISHING.md)：发布与脱敏说明

## 当前文档结构

- 英文现在是顶层主入口语言。
- 中文仍然是更深层运维说明、详细会话记录和历史归档的主要语言。
- [`archive/`](archive) 目录保留了按时间顺序组织的详细实现与验证记录，因此会更细、更长。

## 当前已验证基线

- `main` 已经对齐到最新的硬化基线。
- 远端验证已经在 Debian 12 测试机完成，环境包括：
  - OpenJDK 17
  - Maven 3.8.7
  - Node 18 / npm 9
  - Docker + `docker-compose`
- 最新远端回归已经通过：
  - JS 语法检查
  - Java 编译
  - 定向 JUnit
  - 仓库 smoke 脚本
  - Dockerized Playwright 浏览器烟测
- 最新远端 `quickdrop-real` 已经命中过 `direct`。

## 建议阅读顺序

### 新接手项目

1. [../README.md](../README.md)
2. [STATUS.md](STATUS.md)
3. [TESTING.md](TESTING.md)
4. [PLAN.md](PLAN.md)

### 做发布 / 部署 / 回归

1. [PUBLISHING.md](PUBLISHING.md)
2. [TESTING.md](TESTING.md)
3. [CHANGELOG.md](CHANGELOG.md)
4. [archive/2026-03-26-remote-baseline-rebuild-and-direct-validation.md](archive/2026-03-26-remote-baseline-rebuild-and-direct-validation.md)

## 备注

- 远端测试机资源有限，磁盘和内存检查已经是默认流程的一部分。
- 如果需要准确、按日期可追溯的实现记录，先看 [CHANGELOG.md](CHANGELOG.md)，再打开对应的 archive 文档。
