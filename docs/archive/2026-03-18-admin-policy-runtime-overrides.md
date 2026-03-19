# 2026-03-18 管理员策略后台化：频控 / CORS

- 目标：把先前已经抽象出来的限流策略和 CORS 策略，真正接到“管理员可读可改、改完立即生效”的闭环里，同时保留配置文件默认值作为回退基线。

## 本轮完成内容

- 新增 `system_setting` 持久化表
  - 启动建表脚本已补到 `docker/mysql/init/001-schema.sql`
  - 已有数据库补了手工迁移脚本：
    - `docker/mysql/manual/2026-03-18-add-system-setting-table.sql`
- 新增策略覆盖存储层
  - `SystemSettingOverrideService` / `SystemSettingOverrideServiceImpl`
  - 用于保存和读取管理员改过的频控 / CORS 覆盖值
  - 未配置覆盖值时继续回退到配置文件默认值
- 频控 provider 接入覆盖层
  - `RateLimitPolicyServiceImpl` 现在优先读 `system_setting` 覆盖值
  - 当前支持四个场景：
    - `guest-upload`
    - `public-share-info`
    - `public-download`
    - `public-share-extract-code-error`
- CORS provider 接入覆盖层
  - `CorsPolicyServiceImpl` 现在优先读 `system_setting` 覆盖值
  - 仍保留对 `* + credentials=true` 的保护逻辑
- 新增管理员策略接口
  - `GET /api/admin/settings/rate-limits`
  - `PUT /api/admin/settings/rate-limits/{scene}`
  - `GET /api/admin/settings/cors`
  - `PUT /api/admin/settings/cors`
- 管理员页面已接入策略表单
  - `admin.html` / `js/admin.js` 已新增频控策略编辑区与 CORS 配置区
  - 支持保存后立即刷新当前页面状态

## 设计取舍

- 仍然保留“配置文件默认值”作为基础兜底，不把策略写死到数据库。
- 管理员改动写入 `system_setting` 后，provider 直接读取覆盖结果，避免把管理台逻辑侵入具体执行链。
- 角色模型不扩展，仍只保留：
  - `USER`
  - `ADMIN`

## 新增文件

- `src/main/java/com/finalpre/quickshare/common/RateLimitScene.java`
- `src/main/java/com/finalpre/quickshare/entity/SystemSetting.java`
- `src/main/java/com/finalpre/quickshare/mapper/SystemSettingMapper.java`
- `src/main/java/com/finalpre/quickshare/service/SystemSettingOverrideService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/SystemSettingOverrideServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/service/AdminPolicyService.java`
- `src/main/java/com/finalpre/quickshare/service/impl/AdminPolicyServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/dto/AdminRateLimitPolicyUpdateRequest.java`
- `src/main/java/com/finalpre/quickshare/dto/AdminCorsPolicyUpdateRequest.java`
- `src/main/java/com/finalpre/quickshare/vo/AdminRateLimitPolicyVO.java`
- `src/main/java/com/finalpre/quickshare/vo/AdminCorsPolicyVO.java`
- `docker/mysql/manual/2026-03-18-add-system-setting-table.sql`

## 涉及修改

- `src/main/java/com/finalpre/quickshare/controller/AdminController.java`
- `src/main/java/com/finalpre/quickshare/service/impl/RateLimitPolicyServiceImpl.java`
- `src/main/java/com/finalpre/quickshare/service/impl/CorsPolicyServiceImpl.java`
- `src/main/resources/static/admin.html`
- `src/main/resources/static/js/admin.js`
- `src/main/resources/static/js/lang-switch.js`
- `docker/mysql/init/001-schema.sql`

## 验证结果

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminControllerTest,AdminPolicyServiceImplTest,RateLimitPolicyServiceImplTest,CorsPolicyServiceImplTest test`
- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 当前限制

- 前端仍然没有浏览器自动化测试，本轮依旧主要依赖后端测试与脚本语法检查。
- `system_setting` 只接了频控和 CORS，其他可调策略项还没迁进来。
- 已有数据库若未先执行手工迁移脚本，管理员策略接口和页面会缺少持久化表支撑。

## 下一步建议

1. 继续把更多安全策略项接入 `system_setting`，优先考虑上传大小 / 类型策略。
2. 为管理员策略表单补更细的联动提示与异常展示。
3. 评估给后台页面补浏览器级回归，避免后续策略表单改动只靠手工验证。
