# QuickShare 变更记录

本文件用于汇总每一轮可追溯的项目更新，详细内容存放在 `docs/archive/`。

## 2026-03-18

- 详细记录：`docs/archive/2026-03-18-stage2-session-log.md`
- 本轮主题：阶段 2 文件/文件夹闭环收口与前后端契约对齐
- 核心变更：
  - 补齐 `/api/files?folderId=`、`/api/folders/{id}/rename`、`/api/upload` 的 `folderId` 支持
  - 为 `FileInfoVO` 增加 `folderId` 兼容字段，减少前端存量代码改动
  - 删除文件/文件夹时同步清理物理文件
  - 补充同目录重名冲突校验，覆盖文件重命名、文件夹重命名和新建文件夹
  - 修正网盘前端分享参数，将“有效天数”转换为后端使用的 `expireHours`
  - 重命名文件夹后同步更新前端面包屑与本地缓存
  - 新增控制器和服务层测试，形成最小回归网
- 验证结果：
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest,FileServiceImplTest test`
  - `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`
  - `node --check src/main/resources/static/js/netdisk.js`
- 当前建议下一步：
  - 继续收口深层目录回归、逻辑删除一致性和前端缓存边界
  - 回到阶段 1，统一异常处理与鉴权回归测试
