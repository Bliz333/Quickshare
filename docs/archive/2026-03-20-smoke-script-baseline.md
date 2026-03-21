# 2026-03-20 Smoke Script 基线

## 本轮目标

- 把当前已经写在 `docs/TESTING.md` 里的 Docker smoke 步骤沉淀成仓库内可重复执行脚本
- 降低“每次都靠手工拼一串 curl”的收口成本
- 给 WSL2 / Docker 端口转发偶发不稳定的场景留一个容器内回退模式

## 本轮改动

- 新增 `scripts/quickshare-smoke.sh`
- 默认覆盖：
  - `GET /api/health`
  - `GET /api/public/plans`
  - `GET /api/public/payment-options`
  - `GET /api/public/registration-settings`
  - `GET /pricing.html`
  - `GET /payment-result.html`
- 在存在 bootstrap admin 凭据时继续覆盖：
  - `POST /api/auth/login`
  - `GET /api/profile`
  - `GET /api/admin/settings/storage`
  - `GET /api/payment/orders`
  - `GET /api/files?folderId=0`
  - `POST /api/folders`
  - `GET /api/folders/all`
  - `PUT /api/folders/{id}/move`
  - `DELETE /api/folders/{id}`
  - `POST /api/upload` 同名去重
  - `POST /api/upload` 异名同内容物理复用
  - `GET /api/files/{id}/download` 真实下载内容比对
  - `GET /api/profile` 下载后 `downloadUsed` 递增校验
  - `POST /api/share`
  - `GET /api/share/{shareCode}` 正确/错误提取码校验
  - `GET /api/download/{shareCode}` 匿名/登录态公开下载
  - `GET /api/profile` 公开下载后的额度记账校验
  - API 级批量移动/删除校验（通过顺序调用现有 move/delete 接口模拟批量操作）
- 新增两个可选执行模式：
  - `SMOKE_UP=1`：脚本开头自动执行 `docker compose up --build -d`
  - `SMOKE_MODE=container`：通过 `docker exec` 在容器内执行相同 `curl` 探针
  - 当前文件传输类校验仍以主机模式为主；容器模式主要承担端口转发异常时的接口回退验证

## 为什么现在做

- 当前项目主线路线图已经完成，后续主要矛盾不再是“有没有功能”，而是“如何把现有功能持续稳定收口”
- 这批能力已经有文档、有接口、有定向测试，但还缺一个仓库内统一入口来重复做基础 smoke
- 把脚本落仓后，`README.md` / `docs/TESTING.md` / `docs/STATUS.md` / `docs/PLAN.md` 的描述可以真正与仓库能力对齐

## 验证

- `bash -n scripts/quickshare-smoke.sh`
- `./scripts/quickshare-smoke.sh`
- `./mvnw -q -DskipTests compile`
- 主机侧 smoke：
  - `curl -sS http://127.0.0.1:8080/api/health`
  - `curl -sS http://127.0.0.1:8080/api/public/plans`
  - `curl -sS http://127.0.0.1:8080/api/public/payment-options`
  - `curl -sS http://127.0.0.1:8080/api/public/registration-settings`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/pricing.html`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/payment-result.html`
  - `POST /api/auth/login`
  - `GET /api/profile`
  - `GET /api/admin/settings/storage`
  - `GET /api/payment/orders`
  - `GET /api/files?folderId=0`
  - 创建根目录 smoke 文件夹
  - 移动子文件夹到目标目录
  - 同目录同名同内容重复上传复用同一逻辑记录
  - 同目录异名同内容上传复用同一物理存储路径
  - 下载已上传文件并比对内容
  - 验证 `downloadUsed` 递增
  - 创建分享并验证返回 `shareCode` / `extractCode`
  - 错误提取码访问分享信息返回 `400`
  - 匿名公开下载不修改账号 `downloadUsed`
  - 登录态公开下载成功后 `downloadUsed` 再递增
  - 批量移动两个文件和一个文件夹到目标目录，再逐项批量删除并确认列表清理完成
  - 删除 smoke 文件夹并确认根目录清理完成

## 结果

- 当前主机侧 `127.0.0.1:8080` 已恢复可访问，脚本默认前提成立
- 当前 Docker 环境没有启用默认支付商户，`GET /api/public/payment-options` 仍然返回 `null`
- 当前 repo 内基础 smoke 已不只停留在只读探针，已覆盖登录后的文件夹创建、移动、上传去重、真实下载、分享下载、批量移动/删除和清理闭环
- 下一步自动化重点应继续上移到：
  - 拖拽移动的回归
  - 启用真实商户后的支付成功 / 退款回调验证
  - 浏览器自动化，而不是停留在接口层 smoke
  - 浏览器自动化当前还缺本地浏览器二进制和 Playwright/Puppeteer 依赖，需要先补环境基线
