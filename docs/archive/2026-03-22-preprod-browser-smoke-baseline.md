# 2026-03-22 预发布浏览器回归固化

## 本轮目标

- 把 QuickDrop 真实双页浏览器回归固定成“测试服务器可重复执行”的标准步骤。
- 避免继续依赖测试服务器额外预装 Node / Chromium。
- 将浏览器回归接入现有 `deploy-preprod.sh`，让部署后验收能覆盖真实 QuickDrop 页面链路。

## 变更

- 新增 `scripts/quickshare-playwright-smoke.sh`
  - 默认使用 `mcr.microsoft.com/playwright:v1.58.2-noble`
  - 默认执行 `tests/e2e/quickdrop-real.spec.js`
  - 默认访问 `http://127.0.0.1:8080`
  - 通过 Dockerized Playwright 运行，无需目标机预装 Node / Chromium
- `scripts/deploy-preprod.sh` 新增 `DEPLOY_RUN_BROWSER_SMOKE=1`
  - 远端部署完成后先等健康检查恢复
  - 再在测试服务器本机网络中执行 `./scripts/quickshare-playwright-smoke.sh`
- 清理本地未提交的 `tests/e2e/quickdrop-real.spec.js` 试验性改动，恢复到已在测试服务器跑通的基线实现

## 验证

执行：

```bash
quickshare-test-ssh 'cd /root/quickshare && docker run --rm --network host --ipc=host -v /root/quickshare:/workspace -w /workspace -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 -e E2E_ADMIN_USERNAME=admin -e E2E_ADMIN_PASSWORD=ChangeMeAdmin123! mcr.microsoft.com/playwright:v1.58.2-noble bash -lc "npm ci && npx playwright test tests/e2e/quickdrop-real.spec.js --reporter=line"'
```

结果：

- `1 passed (1.5m)`

## 结论

- QuickDrop same-account 真实双页传输在测试服务器本机网络里继续可用。
- 预发布部署链路现在已具备“健康检查 + API smoke + 真实浏览器回归”的可重复入口。
- 当前执行环境直连测试服务器公网 `:8080` 端口时，对大体积静态资源响应存在外部链路异常；因此浏览器回归固定在服务器本机网络执行，而不把这条外部网络异常误判为应用功能失败。
