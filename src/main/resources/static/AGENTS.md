# QuickShare 静态前端规则

> 先读仓库根 `AGENTS.md`；前端整体说明见 `docs/ai/frontend.md`，传输域见 `docs/ai/transfer.md`，验证选择见 `docs/ai/validation.md`。

## 运行模型

- 前端是原生 HTML / CSS / JavaScript，无 bundler、模块解析或编译步骤；HTML 中的脚本顺序就是依赖顺序。
- 对外使用 clean routes：`/`、`/login`、`/register`、`/share`、`/drive`、`/pricing`、`/payment-result`。旧 `.html` 与 QuickDrop 页面由后端重定向，不应成为新链接目标。
- API 基址与页面 URL 统一经 `window.AppConfig` / `window.QuickShareRoutes`；会话读取、续签和清理由 `window.QuickShareSession` 负责。

## 必守边界

- 新请求复用现有鉴权与续签路径，不要绕过 `session.js` 自建第二套 token 状态。XHR 上传同样要保留 `X-Auth-Refresh` 处理。
- 共享颜色、间距、字号与状态值优先使用 `css/design-tokens.css`；通用控件放 `css/components.css`，页面只保留真正局部样式。
- 中文/英文可见文案同步维护 `js/lang-switch.js` 的两套键，并核对动态渲染分支，不在模板和脚本之间复制不同版本文案。
- Transfer 代码沿用 `transfer-*` 命名；新增实现不得重新引入 QuickDrop 变量、DOM id 或路由，除非明确修复兼容入口。
- `e2ee.js` 管理 relay 加解密和密钥协商；不得把原始文件密钥放入 URL query、HTTP body、服务端日志或普通 API 响应。
- 大文件流程保持分片/恢复语义，避免为了 UI 简化把整个文件读入多个并存 Blob/ArrayBuffer。
- DOM 操作要保持现有页面脚本顺序和全局导出兼容；修改共享 helper 前先检查所有 HTML 引用方。

## 验证

- 任意 JS 改动先运行 `./scripts/check-js.sh`。
- 共享逻辑或路由改动运行 `tests/e2e/web-logic-regressions.spec.js` 和最近的 mock Playwright 用例。
- Transfer 改动运行 `tests/e2e/quickdrop.spec.js`；需要真实后端 / WebRTC 时再运行 `tests/e2e/quickdrop-real.spec.js`。
- 任何可见改动遵循全局 live review 规则：先做桌面与移动视口浏览器自检，再给精确 URL、位置与预期表现。
