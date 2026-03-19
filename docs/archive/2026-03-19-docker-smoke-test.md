# Docker Smoke Test — 2026-03-19

## 环境
- WSL2 (Linux 6.6.87.2-microsoft-standard-WSL2)
- Docker 29.3.0, Docker Compose v5.1.0
- 使用 `compose.yaml` + `.env.example` 默认配置起栈
- 镜像内置 LibreOffice headless + 中文字体

## 测试结果

| # | 测试项 | 预期 | 实际 |
|---|---|---|---|
| 1 | 首页加载 | 200 | 200 |
| 2 | 管理员登录 + JWT | token 返回 | OK |
| 3a | `/console/quickshare-admin` | 200 | 200 |
| 3b | `/console/wrong-slug` | 404 | 404 |
| 3c | `/admin.html` 直接访问 | 拦截 | 401 |
| 4 | `/api/profile` 角色同步 | ADMIN | OK |
| 5 | 管理员策略端点 (频控/CORS/上传/预览/注册/控制台) | 全部 200 | OK |
| 6 | 公开注册设置 `/api/public/registration-settings` | 200 | OK |
| 7 | 管理员概览 `/api/admin/overview` | 200 + 统计 | OK |
| 13 | 上传 DOCX | 200 + fileId | OK |
| 14 | DOCX 预览 (LibreOffice -> PDF) | 200 + application/pdf | 200, PDF 10.6KB |
| 15 | 文件下载（原始 DOCX） | 200 | OK |
| 16 | 匿名上传 | 200 + guestUploadToken | OK |
| 17 | 匿名分享 | 200 + shareCode | OK |
| 18 | 公开分享信息查询 | 200 | OK |
| 19 | 公开下载 `/api/download/{shareCode}` | 200 + 原始文件 | OK |
| 20 | 错误提取码 | 400 | 400 |
| 21 | 注册页 `/register.html` | 200 | 200 |
| 22 | 网盘页 `/netdisk.html` | 200 | 200 |
| 23 | PDF 查看器 `/pdf-viewer.html` | 200 | 200 |
| 24 | 动态修改后台 slug | 旧 404, 新 200 | OK |
| 25 | 动态切换邮箱验证开关 | 公开接口实时反映 | OK |
| 26 | 关闭匿名上传后匿名请求 | 403 | 403 |
| 27 | XLSX 预览 (LibreOffice -> PDF) | 200 + application/pdf | 200, PDF 10KB |

## 发现的小问题
- 上传策略更新接口要求 `maxFileSizeBytes` 等字段为必填，部分字段缺失时返回 400 而非使用当前值；这是设计如此（前端表单始终发全量），不影响功能。

## 结论
Docker 单文件部署基线验证通过，三大重点功能（隐藏后台入口、Office 预览、注册页动态配置）在真实容器环境均工作正常。
