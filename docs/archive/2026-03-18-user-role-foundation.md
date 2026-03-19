# 2026-03-18 用户角色基础落库

- 目标：继续收阶段 1 的角色能力，把 JWT 中已有但仍然“硬编码”的角色信息落到用户数据模型，给后续管理员后台与 `ADMIN` 权限边界提供真实基础。

## 本轮变更

- 新增 `UserRole` 枚举，统一角色名规范化逻辑，当前保留：
  - `USER`
  - `ADMIN`
- `User` 实体新增 `role` 字段，注册时默认写入 `USER`。
- `UserServiceImpl` 改为：
  - 注册时持久化默认角色并按该角色签发 JWT
  - 登录时优先读取数据库中的角色
  - 对空值或非法角色统一回退到 `USER`
- `JwtUtil` 改为统一通过 `UserRole` 规范化角色，避免 token 内部出现大小写或脏值分叉。
- 数据库基线更新：
  - `docker/mysql/init/001-schema.sql` 的 `user` 表新增 `role` 字段和索引
  - 为已有库补了手工迁移脚本：`docker/mysql/manual/2026-03-18-add-user-role.sql`

## 回归覆盖

- `UserServiceImplTest` 新增场景：
  - 注册时持久化默认 `USER` 角色
  - 登录时保留数据库中的 `ADMIN` 角色并写入 JWT
  - 历史空角色用户登录时回退为 `USER`
- 同时执行全量 `mvn test`，确认刚完成的提取码错误次数限制和 CORS 白名单收口没有回退。

## 涉及文件

- `src/main/java/com/finalpre/quickshare/common/UserRole.java`
- `src/main/java/com/finalpre/quickshare/entity/User.java`
- `src/main/java/com/finalpre/quickshare/service/impl/UserServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/utils/JwtUtil.java`
- `src/test/java/com/finalpre/quickshare/service/impl/UserServiceImplTest.java`
- `docker/mysql/init/001-schema.sql`
- `docker/mysql/manual/2026-03-18-add-user-role.sql`

## 验证结果

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=UserServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 注意事项

- 这一步引入了真实 schema 变化；已有数据库若未重建，需要先执行：
  - `docker/mysql/manual/2026-03-18-add-user-role.sql`
- 当前只完成了角色基础落库，还没有管理员接口或 `@PreAuthorize("hasRole('ADMIN')")` 的实际业务边界。

## 下一步建议

1. 开始第一批管理员接口的权限边界设计，优先补 `ADMIN` 方法级校验和最小后台只读入口。
2. 在角色边界稳定后，再把限流 / CORS 等策略来源通过管理员面板接管为动态配置。
