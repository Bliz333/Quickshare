# 2026-03-21 QuickDrop 第一阶段 MVP

## 本轮目标

- 为注册用户补一条“同账号不同设备互传”的真实可用链路
- 不依赖配对码，设备发现直接基于同账号登录态
- 先做稳定的服务器中转 + chunk 续传，不抢在第一轮就上 WebRTC

## 本轮实现

- 后端新增 QuickDrop 基础模型：
  - `quickdrop_device`
  - `quickdrop_transfer`
- 新增接口：
  - `POST /api/quickdrop/sync`
  - `POST /api/quickdrop/transfers`
  - `GET /api/quickdrop/transfers/{id}`
  - `PUT /api/quickdrop/transfers/{id}/chunks/{chunkIndex}`
  - `GET /api/quickdrop/transfers/{id}/download`
  - `DELETE /api/quickdrop/transfers/{id}`
- 新增 `quickdrop.html`
  - 同账号设备自动发现
  - 设备名称可自定义
  - 目标设备选择
  - 发送记录 / 接收箱
- 断点续传采用“按 chunk 补缺”：
  - 发送端创建传输会话后按分片上传
  - 本地缓存 `transferId`
  - 重新选择同一文件 + 同一目标设备时，会继续补上传缺失的分片
- 当前阶段传输采用服务器中转：
  - 文件先写入 QuickDrop 临时目录
  - 分片齐全后后端组装成完整文件
  - 接收端下载组装后的结果文件
- 新增过期清理任务：
  - 周期清理超时的 QuickDrop 传输和临时文件

## 当前边界

- 当前仅支持“同账号设备互传”
- 当前未接入 WebRTC / STUN / TURN
- 当前不做浏览器后台静默接收
- 当前接收结果是浏览器下载，不是自动落到网盘目录
- 当前续传需要用户重新选择同一个本地文件，浏览器不会无权限自动读取上次文件句柄

## 验证

- `node --check src/main/resources/static/js/quickdrop.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/quickdrop.html`
- `POST /api/auth/login`
- `POST /api/quickdrop/sync`

## 当前结论

- QuickDrop 第一阶段已经形成一条真实可用链路
- 现在已经支持：
  - 同账号设备发现
  - 选择目标设备发送文件
  - 服务器中转
  - chunk 续传
  - 接收端下载
- 下一阶段更适合补：
  - WebRTC 直传
  - STUN / TURN
  - 接收后保存到网盘
  - 更完整的页面级自动化
