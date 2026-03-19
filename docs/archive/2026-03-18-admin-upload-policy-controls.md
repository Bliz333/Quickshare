# 2026-03-18 上传策略接入管理员后台

## 本轮目标

- 继续沿用“配置默认值 + `system_setting` 覆盖值”的策略接管模式
- 把上传相关的核心安全边界接入管理员后台
- 保持上传主链路不改执行结构，只替换策略来源

## 本轮接入的后台控制项

### 1. 服务层最大上传大小

- 新增后台可调的 `maxFileSizeBytes`
- `-1` 表示不额外施加服务层大小限制
- 实际请求仍然受 `spring.servlet.multipart.max-file-size` 的应用硬上限约束
- 管理台会直接显示当前服务硬上限，避免后台配置超过运行时真实能力

### 2. 允许扩展名白名单

- 新增后台可调的 `allowedExtensions`
- 为空时表示允许所有扩展名
- 支持逗号或换行输入，保存时统一规范化为小写扩展名
- 现有上传校验仍按文件后缀判断，不把 MIME 判断逻辑重新写进主链路

## 后端改动

### 上传策略 provider

- 新增：
  - `FileUploadPolicy`
  - `FileUploadPolicyService`
  - `FileUploadPolicyServiceImpl`
- 读取顺序：
  1. `system_setting` 后台覆盖值
  2. `application*.yml` 中的 `file.*` 默认值

### `system_setting` 扩展

- 新增上传策略键：
  - `file-upload.policy`
- 沿用现有 JSON 序列化与缓存逻辑
- 不需要新增表或手工迁移脚本

### 管理员接口

- 新增：
  - `GET /api/admin/settings/file-upload`
  - `PUT /api/admin/settings/file-upload`

## 前端管理台改动

- 管理台新增“上传策略”卡片
- 当前支持：
  - 勾选是否启用额外大小限制
  - 输入最大上传大小（MB）
  - 编辑允许扩展名列表
- 页面会展示当前服务硬上限提示，帮助区分“服务层动态限制”和“multipart 固定硬上限”

## 上传执行链改动

- `FileServiceImpl#uploadFile`
  - 不再直接读取 `FileConfig` 的大小 / 类型默认值
  - 改为通过 `FileUploadPolicyService` 获取当前生效策略
- 文件保存目录仍继续从 `FileConfig` 获取
- 这样保持了“目录配置”和“安全策略配置”的职责分离

## 回归验证

- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminControllerTest,AdminPolicyServiceImplTest,FileUploadPolicyServiceImplTest,FileServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 结果

- 管理员后台现在除了频控 / CORS，还能直接调整上传大小和扩展名白名单
- 上传链路仍保持 provider 抽象，没有把动态配置逻辑写回控制器或文件服务主流程

## 建议下一步

1. 继续把上传相关剩余安全项接入后台，例如匿名上传开关、上传 MIME/预览策略
2. 文档预览（PDF / DOCX 等）和后台开关保留在下一批，不抢当前安全策略后台化节奏
