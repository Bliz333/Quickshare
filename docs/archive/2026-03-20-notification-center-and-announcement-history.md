# 2026-03-20 通知中心与公告记录

## 本轮目标

- 让管理员公告不再只是“发完邮件即结束”，而是同时落成可回看的通知记录
- 让用户在首页直接查看历史通知，并区分“全部通知”和“我的通知”
- 保持现有公告邮件链路不变，新增站内通知能力

## 本轮改动

- 新增 `notification_record` 表，并接入 Flyway：
  - `src/main/resources/db/migration/V4__add_notification_record_table.sql`
  - `docker/mysql/init/001-schema.sql`
- 新增通知领域对象与服务：
  - `src/main/java/com/finalpre/quickshare/entity/NotificationRecord.java`
  - `src/main/java/com/finalpre/quickshare/mapper/NotificationRecordMapper.java`
  - `src/main/java/com/finalpre/quickshare/service/NotificationService.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/NotificationServiceImpl.java`
  - `src/main/java/com/finalpre/quickshare/vo/NotificationVO.java`
  - `src/main/java/com/finalpre/quickshare/controller/NotificationController.java`
- 公告发送现在会同时写入通知记录：
  - 全站公告写入一条 `all`
  - 定向公告按用户写入 `personal`
- 首页新增通知中心面板：
  - `src/main/resources/static/index.html`
  - `src/main/resources/static/js/home-notifications.js`
  - `src/main/resources/static/js/lang-switch.js`

## 用户可见结果

- 首页现在可以查看通知记录
- 匿名用户可看“全部通知”
- 登录用户可切换：
  - “全部通知”
  - “我的通知”
- 管理员从公告页发出的历史公告会保留下来，不再只存在于邮箱发送记录中

## 接口

- `GET /api/public/notifications`
  - 返回全站通知列表
- `GET /api/notifications/personal`
  - 返回当前登录用户的个人通知列表

## 验证

- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=AdminServiceImplTest test`
- `node --check src/main/resources/static/js/home-notifications.js`
- `node --check tests/e2e/home-notifications.spec.js`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/home-notifications.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 公告体系现在同时具备邮件发送和站内历史记录
- 首页通知中心已经可用，并按“全部 / 我的”分类展示
- 当前 Playwright 全量基线已更新为 `23 passed`
