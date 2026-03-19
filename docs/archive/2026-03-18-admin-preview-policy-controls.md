# 2026-03-18 预览策略接入管理员后台

## 本轮目标

- 继续沿用“配置默认值 + `system_setting` 覆盖值”的策略接管模式
- 把预览策略从控制器里的硬编码判断抽出来，接入管理员后台
- 避免“关闭预览时把正常下载也一起误伤”，因此把用户下载链路从预览链路拆开

## 本轮改动

### 1. 预览策略 provider

- 新增：
  - `FilePreviewPolicy`
  - `FilePreviewPolicyService`
  - `FilePreviewPolicyServiceImpl`
  - `FilePreviewProperties`
- 当前支持的预览文件族：
  - 图片
  - 视频
  - 音频
  - PDF
  - 纯文本 / 代码 / 配置
  - Office 文档族（Word / Excel / PPT / OpenDocument）
- 仍然支持用 `allowedExtensions` 做更细粒度收窄

### 2. 管理台预览策略表单

- 管理台新增“预览策略”卡片
- 当前可直接控制：
  - 总预览开关
  - 图片 / 视频 / 音频 / PDF / 文本 / Office 文档族开关
  - 允许预览的扩展名列表
- 当前页面提示已明确写明：
  - 图片 / 视频 / 音频 / PDF / 文本主要依赖浏览器原生能力
  - Office 文档当前先走浏览器内嵌 fallback
  - 后续仍需要专用预览提供器 / 转换方案来补稳定体验

### 3. 预览与下载拆路

- 新增用户自有文件下载接口：
  - `GET /api/files/{fileId}/download`
- 原 `/api/files/{fileId}/preview` 现在只负责预览语义
- 好处：
  - 管理员关闭某类预览后，不会影响正常下载
  - 后续继续细化预览策略时，不需要再担心把下载主链路一起带坏

### 4. 网盘前端对齐

- 网盘页会先读取当前生效的预览策略，再决定是否尝试预览
- 不再只靠前端硬编码“图片 / 视频 / PDF / txt”
- 当前前端预览判断已覆盖：
  - 图片
  - 视频
  - 音频
  - PDF
  - 文本类
  - Office 文档 iframe fallback
- 下载按钮与传输面板已切到新的 `/api/files/{fileId}/download`

## 当前边界说明

- 这轮完成的是“预览策略后台化 + 用户侧行为对齐 + 下载拆路”
- Office / 文档类真正稳定可用的预览体验还没有完全解决
- 当前 Office 文档只是先尝试浏览器内嵌；若浏览器不支持，仍需下载
- 后续如果要把 PPT / 表格 / Word / 更多文档类型做成稳定预览，建议单独接入：
  - 文档转换服务
  - 专用预览提供器
  - 或对象存储 + 第三方在线预览链路

## 回归验证

- `node --check src/main/resources/static/js/admin.js`
- `node --check src/main/resources/static/js/lang-switch.js`
- `node --check src/main/resources/static/js/netdisk.js`
- `node --check src/main/resources/static/js/netdisk-render.js`
- `node --check src/main/resources/static/js/transfer.js`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=AdminControllerTest,AdminPolicyServiceImplTest,FileControllerTest,FilePreviewPolicyServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 备注

- `QuickshareApplicationTests` 在本地未启动 MySQL 时，当前仍会打印一次 `Connection refused`
- `SystemSettingOverrideServiceImpl` 预加载仍是 fail-open，会回退到文件配置，因此不会导致本轮测试失败
- 这条测试噪音仍保留在状态页，避免后续误判

## 建议下一步

1. 继续补“真正的文档预览实现”，优先 Office 文档与更多文本 / 表格类的稳定预览体验
2. 在预览策略基础上继续细化：
   - 更细的 MIME / 扩展名策略
   - 是否允许缩略图 / 内嵌 / 原文件预览
3. 预览策略主线稳定后，再进入 SMTP 后台化、邮件模板 / 公告体系、Turnstile / reCAPTCHA 提供器切换
