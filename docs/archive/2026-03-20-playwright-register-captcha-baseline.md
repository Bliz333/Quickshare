# 2026-03-20 Playwright 注册页验证码 Provider 基线

## 本轮目标

- 把注册页的运行时验证码 provider 切换纳入浏览器自动化
- 不再只依赖接口返回值推断注册页 UI 是否跟着切换

## 本轮改动

- 新增 `tests/e2e/register-captcha.spec.js`

## 用例覆盖

- `reCAPTCHA` 场景：
  - mock `GET /api/public/registration-settings`
  - mock Google 脚本加载
  - 校验验证码区域渲染和 site key 注入
- `Turnstile` 场景：
  - mock `GET /api/public/registration-settings`
  - mock Cloudflare 脚本加载
  - 校验验证码区域渲染和 site key 注入
- 关闭邮箱验证码/人机验证场景：
  - 校验验证码输入区和发送验证码按钮进入隐藏/禁用状态
  - 校验验证码容器被清空

## 验证

- `node --check tests/e2e/register-captcha.spec.js`
- `npx playwright test tests/e2e/register-captcha.spec.js`
- `npx playwright test tests/e2e`

## 结果

- 注册页验证码 provider 切换已经纳入浏览器自动化基线
- 当前 Playwright 覆盖面已经补到注册页运行时配置驱动的 UI 分支
- 下一步更适合继续扩：
  - 套餐页支付弹窗和创建订单跳转
  - 真实商户启用后的支付成功回跳
  - 更多管理台配置页面的浏览器自动化
