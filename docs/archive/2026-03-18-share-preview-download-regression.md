# 2026-03-18 分享 / 预览 / 下载回归补充记录

- 分支：`feature/hardening-plan`
- 目标：继续收阶段 1，补分享信息查询、下载、预览链路的异常与鉴权回归，并修正匿名分享与访客下载页的边界行为

## 本轮完成的变更

- `FileControllerTest` 新增分享 / 预览 / 下载回归，覆盖：
  - 预览缺少 token 返回 401
  - 预览支持 URL `token` 参数
  - 预览物理文件缺失返回 404
  - 匿名分享凭证无效返回 400
  - 分享信息不存在返回 404
  - 提取码缺失或错误返回 400
  - 下载接口业务异常会透出正确 HTTP 状态码
- `FileServiceImplTest` 新增分享规则回归，覆盖：
  - 已逻辑删除文件不可创建分享
  - 非文件所有者不可创建分享
  - 提取码错误、分享过期、下载次数上限
  - 分享对应文件已删除
  - 下载成功后响应流输出与下载次数递增
- `FileServiceImpl#createShareLink` 现在会拒绝为逻辑删除文件创建分享。
- `FileController#getShareInfo` 改为允许缺省 `extractCode` 参数，再统一落到业务错误“提取码错误”，避免返回框架级缺参信息。
- `download.js` 访客下载页改为始终显式传递 `extractCode`，让前后端都收敛到统一错误语义。

## 影响文件

- `docs/CHANGELOG.md`
- `docs/STATUS.md`
- `docs/archive/2026-03-18-share-preview-download-regression.md`
- `src/main/java/com/finalpre/quickshare/controller/FileController.java`
- `src/main/java/com/finalpre/quickshare/service/impl/FileServiceImpl.java`
- `src/main/resources/static/js/download.js`
- `src/test/java/com/finalpre/quickshare/controller/FileControllerTest.java`
- `src/test/java/com/finalpre/quickshare/service/impl/FileServiceImplTest.java`

## 执行过的验证

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileServiceImplTest test`
- `node --check src/main/resources/static/js/download.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 当前仍未解决的问题

- 分享码唯一性仍依赖随机碰撞概率，尚未显式防重。
- 下载次数递增目前未做并发保护，极端情况下可能出现计数竞争。
- 匿名上传 / 分享 / 下载还没有频控、大小策略和清理策略。
- 访客下载仍是新窗口直出文件流，失败时会在新页看到 JSON 错误，交互还可以继续优化。

## 建议的下一步

1. 为匿名上传与下载增加最小频控和配额限制。
2. 收口分享码唯一性、下载计数并发安全和 `ShareLink.status` 生命周期。
3. 继续补前端交互回归，尤其是访客下载失败提示与预览页过期场景。
