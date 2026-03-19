# 2026-03-18 管理员接口第一批基线

- 目标：在仅保留 `USER` / `ADMIN` 两层角色的前提下，补一批最小可用的管理员接口，让后续后台页面不再是“先有 UI、再回补 API”的空壳。

## 角色边界

- 当前权限模型只保留两类角色：
  - `USER`
  - `ADMIN`
- 不再继续拆更细的运营、审核、只读管理员等角色。
- 管理员默认拥有最高权限，当前通过 `@PreAuthorize("hasRole('ADMIN')")` 统一保护整组管理员接口。

## 本轮新增接口

- `GET /api/admin/overview`
  - 返回用户数、文件数、文件夹数、分享总数、有效分享数、总存储占用
- `GET /api/admin/users`
  - 返回用户列表与当前角色
- `PUT /api/admin/users/{userId}/role`
  - 只允许设置为 `USER` / `ADMIN`
- `GET /api/admin/files`
  - 返回文件列表，包含归属用户信息
- `DELETE /api/admin/files/{fileId}`
  - 管理员可强制删除任意文件 / 文件夹
  - 删除文件时会同步清理物理文件与关联分享
- `GET /api/admin/shares`
  - 返回分享列表，包含关联文件与归属用户信息
- `PUT /api/admin/shares/{shareId}/disable`
  - 管理员可直接失效任意分享

## 关键实现

- 新增 `AdminController` + `AdminService` / `AdminServiceImpl`
- 整组接口统一以 `ADMIN` 为唯一放行条件，不再设计更细粒度后台角色
- 删除文件时走管理员自己的递归删除逻辑，不复用面向普通用户的所有权校验链

## 初始化管理员

- 当前首个管理员仍需手工提升角色
- 可参考：
  - `docker/mysql/manual/2026-03-18-add-user-role.sql`
  - `docker/mysql/manual/2026-03-18-promote-user-to-admin.sql`

## 回归覆盖

- `AdminControllerTest`
  - 未登录访问管理员接口返回 `401`
  - 普通 `USER` 访问管理员接口返回 `403`
  - `ADMIN` 可访问概览、用户列表、改角色、失效分享
- `AdminServiceImplTest`
  - 概览聚合统计
  - 用户角色规范化
  - 分享列表带出文件与用户元信息
  - 改角色仅允许 `USER` / `ADMIN`
  - 强制删除文件会清理物理文件与关联分享

## 涉及文件

- `src/main/java/com/finalpre/quickshare/controller/AdminController.java`
- `src/main/java/com/finalpre/quickshare/service/AdminService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/AdminServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/dto/AdminUserRoleUpdateRequest.java`
- `src/main/java/com/finalpre/quickshare/vo/AdminOverviewVO.java`
- `src/main/java/com/finalpre/quickshare/vo/AdminFileVO.java`
- `src/main/java/com/finalpre/quickshare/vo/AdminShareVO.java`
- `src/main/java/com/finalpre/quickshare/common/UserRole.java`
- `src/test/java/com/finalpre/quickshare/controller/AdminControllerTest.java`
- `src/test/java/com/finalpre/quickshare/service/impl/AdminServiceImplTest.java`
- `docker/mysql/manual/2026-03-18-promote-user-to-admin.sql`

## 验证结果

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminControllerTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 下一步建议

1. 开始最小管理员页面，优先对接 `overview / users / files / shares` 四个读取接口。
2. 在后台页面里补角色提升、分享失效、文件强删的最小操作流。
3. 再把限流 / CORS 策略接到管理员页面，接管现有策略来源。
