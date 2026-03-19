# 2026-03-18 Office 预览 provider：LibreOffice headless + PDF.js

## 本轮目标

- 在现有“预览策略后台化 + 下载链路拆分”基础上，补上 Office 文档真正可用的预览 provider
- 后端先把 `doc/docx/xls/xlsx/ppt/pptx/odt/ods/odp` 统一转成 PDF
- 前端新增同源 PDF.js 查看器，把 PDF 与 Office 预览统一到一条查看链路
- 保持“每做完一个小里程碑就先测一轮”的执行节奏

## 本轮改动

### 1. 后端：Office 文档按需转 PDF

- 新增：
  - `OfficePreviewProperties`
  - `OfficePreviewService`
  - `PreviewResource`
  - `LibreOfficeOfficePreviewService`
  - `PreviewUnavailableException`
- `GET /api/files/{fileId}/preview` 在命中 Office 文档时会：
  - 先校验管理员预览策略是否允许
  - 再调用 LibreOffice headless 做一次按需转换
  - 成功后以 `application/pdf` 直接回流给前端
- 当前转换命令使用：
  - `--headless`
  - `--convert-to pdf`
  - 独立 `UserInstallation` 临时目录，避免污染默认 LibreOffice profile

### 2. 缓存与失败语义

- 转换结果会缓存到预览缓存目录，重复打开同一份未变化文件时不会重复转换
- 当前缓存 key 基于：
  - 源文件绝对路径
  - 文件大小
  - 最后修改时间
- 若 LibreOffice / `soffice` 不可用、转换失败或超时：
  - 返回 `503 Service Unavailable`
  - 响应语义为“预览暂时不可用 / 转换失败”，不影响正常下载链路

### 3. 前端：PDF.js 查看器

- 新增：
  - `src/main/resources/static/pdf-viewer.html`
  - `src/main/resources/static/js/pdf-viewer.js`
- 网盘页中：
  - 原生 PDF 预览已切到新的同源 PDF.js 页面
  - Office 文档预览也改为先走后端 PDF 输出，再在同源 PDF.js 页面中展示
- 当前 PDF.js 查看器支持：
  - 上一页 / 下一页
  - 缩放
  - 下载原文件
  - Office 转 PDF 来源提示
  - 预览失败时显示清晰错误信息

### 4. 配置补充

- 新增环境配置项：
  - `OFFICE_PREVIEW_ENABLED`
  - `OFFICE_PREVIEW_COMMAND`
  - `OFFICE_PREVIEW_TIMEOUT_SECONDS`
  - `OFFICE_PREVIEW_CACHE_DIR`
- 默认值仍为：
  - `OFFICE_PREVIEW_ENABLED=true`
  - `OFFICE_PREVIEW_COMMAND=soffice`

## 本轮验证

### 里程碑 1：后端转换链路

```bash
mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest,LibreOfficeOfficePreviewServiceTest test
```

结果：通过

### 里程碑 2：前端查看器接入

```bash
node --check src/main/resources/static/js/pdf-viewer.js
node --check src/main/resources/static/js/netdisk-render.js
node --check src/main/resources/static/js/lang-switch.js
```

结果：通过

## 当前边界与备注

- 当前本地开发环境里 `which soffice` 返回 `not found`
- 因此这轮已完成：
  - 代码链路
  - 服务层伪 `soffice` 单测
  - 控制器回归
  - 前端脚本校验
- 但还没有在“真实安装了 LibreOffice 的环境”做一次端到端 smoke test
- 当前 PDF.js 资源走 CDN 固定版本引用；查看器本身是同源页面，避免跨域问题

## 建议下一步

1. 在实际安装了 LibreOffice 的部署环境补一次 smoke test，确认 `OFFICE_PREVIEW_COMMAND` 与缓存目录权限
2. 决定是否把同一套 PDF.js 查看器继续接到公开分享页 / 其他文件列表页
3. 预览 provider 稳定后，回到 SMTP 后台化、邮件模板 / 公告、Turnstile / reCAPTCHA 提供器切换
