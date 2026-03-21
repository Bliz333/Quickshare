# 2026-03-20 UI 收口、文件管理增强与文档同步

## 本轮主题

把前端交互、文件管理行为和仓库文档统一到同一套“当前真实状态”，避免页面体验、接口能力和文档描述互相打架。

## 核心变更

### 1. 弹窗与交互体验

- 统一引入应用内 Modal，替换掉浏览器原生风格的 `alert / confirm / prompt` 体验断层。
- 网盘页的分享、重命名、删除、退出登录等操作统一走站内弹窗，并与页面视觉风格对齐。

### 2. 管理台体验收口

- 修复管理员页面 `Back to Netdisk` 按钮失效问题。
- 安全设置里验证码 provider 文案改为随 `Google reCAPTCHA / Cloudflare Turnstile` 动态切换。
- `Verify URL` 旁增加说明文案，明确它是服务端向 provider 校验 token 的地址。
- 公告发送结果从原来的“看起来没反应”升级为明确统计：
  - `totalRecipients`
  - `deliverableCount`
  - `successCount`
  - `failCount`
  - `skippedCount`
- 当没有匹配用户或匹配用户都没有有效邮箱时，接口会直接返回明确错误。

### 3. 文件与文件夹移动

- 后端新增：
  - `PUT /api/files/{id}/move`
  - `PUT /api/folders/{id}/move`
  - `GET /api/folders/all`
- 前端网盘列表视图与网格视图均新增“移动”入口。
- 移动文件夹时增加防循环校验，禁止移动到自身或其子文件夹中。

### 4. 上传去重与物理存储复用

- 上传流程调整为先计算 MD5，再决定是否创建新记录或新物理对象。
- 同用户、同目录、同文件名、同内容再次上传：
  - 直接返回已有文件记录，不重复建库。
- 不同文件名但内容一致再次上传：
  - 创建新逻辑记录，但复用已有物理存储对象。
- 删除逻辑改为“引用感知”：
  - 只有当同一物理对象没有其他未删除记录引用时，才真正删除存储层文件。

### 5. 网盘浏览器返回逻辑

- 分类切换、进入文件夹、面包屑返回现在会同步写入浏览器 `history`。
- 浏览器返回键优先回到上一个网盘内部状态，而不是直接跳回 QuickShare 首页。
- URL 会跟随同步 `folder` / `category` 查询参数，便于刷新后恢复当前上下文。

### 6. 文档同步

- 更新 `README.md`，补齐文件移动、去重、公告统计、验证码 provider、相关 API。
- 新增 `docs/TESTING.md`，明确未来在 WSL2 环境下的默认测试与验收流程。
- 重写 `docs/STATUS.md`，改为当前状态快照，去掉旧阶段性混杂描述。
- 更新 `docs/PLAN.md`，把历史阶段计划切换为“已完成 + 当前维护方向”。
- 更新 `docs/CHANGELOG.md`，补充 2026-03-20 变更记录。

### 7. 用户侧交易与网盘操作继续收口

- 首页顶部、登录态区域和网盘侧栏都补了升级入口，统一导向 `pricing.html`。
- 新增 `pricing.html` + `pricing.js`，通过 `GET /api/public/plans` 渲染可购买套餐，并在登录后调用 `POST /api/payment/create` 下单。
- 新增 `payment-result.html` + `payment-result.js`，根据 `orderNo` 查询 `GET /api/payment/order/{orderNo}`，并在待支付状态下自动轮询。
- 网盘侧栏现在展示存储、下载次数和 VIP 状态，用户可以直接从当前配额视图进入升级流程。
- 网盘选择模式支持批量移动/删除，也支持把文件或文件夹拖拽到目标目录中。
- `PublicSettingsController` 现在会向注册页公开 `captchaProvider`，注册页前端会在 `reCAPTCHA` / `Turnstile` 之间切换脚本和文案。

## 验证

### 本地静态/编译检查

- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/auth.js`
- `node --check src/main/resources/static/js/netdisk.js`
- `node --check src/main/resources/static/js/netdisk-render.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check src/main/resources/static/js/register.js`
- `node --check src/main/resources/static/js/transfer.js`
- `node --check src/main/resources/static/js/ui.js`
- `node --check src/main/resources/static/js/modal.js`
- `node --check src/main/resources/static/js/pricing.js`
- `node --check src/main/resources/static/js/payment-result.js`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=PublicSettingsControllerTest,AdminPolicyServiceImplTest,RegistrationSettingsServiceImplTest test`

### WSL2 Docker 验证

- `docker compose up --build -d`
- `docker compose ps`
- `curl -sS http://127.0.0.1:8080/api/health`
- `curl -sS http://127.0.0.1:8080/api/public/plans`
- `curl -sS http://127.0.0.1:8080/api/public/registration-settings`
- `curl -I http://127.0.0.1:8080/pricing.html`
- `curl -I http://127.0.0.1:8080/payment-result.html`
- 拉取运行中静态资源，确认 `netdisk.js` 已包含 `pushState/popstate` 导航逻辑。

### 功能烟测结果

- 去重：
  - 第一次上传返回 `file1_id=13`
  - 第二次同名同内容上传仍返回 `file2_id=13`
  - 第三次异名同内容上传返回 `file3_id=14`
  - 三次上传 `filePath` 相同，说明物理存储已复用
- 文件移动：
  - `move_code=200`
  - 根目录不再包含已移动文件
  - 目标目录中可查询到该文件
- 文件夹移动：
  - `folder_move_code=200`
  - `child_parent_after_move` 与目标目录一致
- 公告：
  - 返回 `{"totalRecipients":1,"deliverableCount":1,"successCount":1,"failCount":0,"skippedCount":0}`
- 公开套餐与注册设置：
  - `GET /api/public/plans` 返回可售套餐列表
  - `GET /api/public/registration-settings` 返回 `captchaProvider`
- 静态页可达性：
  - `pricing.html` 返回 `200`
  - `payment-result.html` 返回 `200`

## 说明

- 这轮没有把 `mvn test` 作为唯一收口条件。
- 当前 WSL2/JDK 环境里，Mockito/ByteBuddy inline mock maker 仍存在自附加限制，完整测试套件在此环境下不稳定。
- 因此本轮以：
  - 前端 JS 语法检查
  - Java 编译
  - Docker 重建部署
- 真实接口烟测
  作为交付验证标准。
- 本次补做的进度核对以静态检查、编译和定向测试为主；套餐页、支付结果页、配额展示和批量操作的 Docker 页面烟测还需要后续补齐。
