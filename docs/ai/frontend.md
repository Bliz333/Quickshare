# QuickShare 静态前端

## 运行与发布模型

前端位于 `src/main/resources/static/`，由 Spring Boot 原样提供，没有 npm build。`package.json` 只用于 Playwright；修改 JS 后不会有类型检查或 bundler 帮助发现依赖错误，因此 HTML 脚本顺序、全局对象和浏览器回归是接口的一部分。

## 页面入口

| Clean route | HTML | 主要职责 |
| --- | --- | --- |
| `/` | `index.html` | Quick Share 与 Quick Transfer 首页 |
| `/login` | `login.html` | 密码 / Google 登录 |
| `/register` | `register.html` | 注册与验证码 |
| `/share` | `share.html` | 分享下载、公开取件与配对接收 |
| `/drive` | `netdisk.html` | 个人网盘、预览、移动与配额 |
| `/pricing` | `pricing.html` | 套餐与下单 |
| `/payment-result` | `payment-result.html` | 订单状态 |
| `/pdf-viewer` | `pdf-viewer.html` | PDF.js viewer |
| `/console/{slug}` | `admin.html` | 管理台，slug 由后端校验 |

`FrontendPageController` 负责 clean route 和旧 `.html` 重定向。新导航必须指向 clean route；`/transfer.html`、`/quickdrop.html` 重定向到 `/`，分享侧旧页面重定向到 `/share`。

## 共享层

- `js/config.js`：`window.AppConfig` API 基址与 `window.QuickShareRoutes` 路由清理。
- `js/session.js`：token/user 状态、fetch/XHR 续签、profile 与管理台访问。
- `js/auth.js`：登录态渲染和共享鉴权 helper。
- `js/lang-switch.js`：中英文本与当前语言刷新。
- `js/theme.js`、`js/nav.js`、`js/modal.js`、`js/ui.js`：主题、导航、Modal 和通用反馈。
- `js/inline-preview.js`、`js/pdf-viewer.js`：预览 UI。
- `js/transfer*.js`、`js/e2ee.js`：传输、信令、WebRTC、relay 和浏览器端加密。

这些文件通过全局变量协作。修改共享导出前用 `rg` 检查所有 HTML/JS 调用方，并保留脚本加载先后关系。

## 会话与请求

登录成功后，JWT 同时可存在 localStorage 与 HttpOnly cookie。前端请求沿用现有 helper：

- fetch/XHR 响应中的 `X-Auth-Refresh` 由 `session.js` 捕获并更新 localStorage；
- `QuickShareSession.clear()` 统一清理 token/user；
- 遇到 401 时先保留语言、主题、设备标识等用户偏好，再清理身份状态；
- 资源 URL 需要 query token 时只用于现有兼容场景，普通 API 使用 Authorization/cookie。

不要在单个页面再实现一套 token 续签或登录跳转。

## 样式与多语言

- `css/design-tokens.css` 是颜色、间距、圆角、阴影和动效值的来源。
- `css/base.css` 负责基础布局与元素默认值，`css/components.css` 负责共享控件。
- 页面样式只表达页面特有布局，避免复制 button/modal/card 的状态实现。
- 新可见文案必须同时提供中文和英文键；动态列表、错误态、空态和 toast 都在范围内。
- 保留 light/dark、键盘 focus、移动端 390px 左右与桌面宽屏行为。

## Transfer 前端边界

Quick Transfer 的脚本是一个协作系统：

- `transfer-signal.js` 管 WebSocket 和房间/配对信令；
- `transfer-direct.js` 管 WebRTC DataChannel、公开分享到达与 direct attempt；
- `transfer-hub.js` 管同账号设备、relay、任务聚合和历史 UI；
- `e2ee.js` 管 relay 的 ECDH/HKDF/AES-GCM；
- `transfer.js` 管首页快速传输入口。

`taskKey` 用于把 direct 与 relay attempt 归并为一个任务。修改本地缓存 key、deviceId、clientTransferId 或 taskKey 算法会影响恢复/合并，不是单纯展示改动。

## 验证

1. `./scripts/check-js.sh`
2. 最近的 mock Playwright 用例；共享逻辑加 `tests/e2e/web-logic-regressions.spec.js`
3. 涉及真实后端、上传、登录或 WebRTC 时启动 Compose 并跑相应 live 用例
4. 可见改动用浏览器核对桌面和移动视口、控制台错误、hover/focus/错误/空状态

详细选择见 `docs/ai/validation.md`。
