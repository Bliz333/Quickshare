# Quick Transfer 领域说明

## 名称与入口

Quick Transfer 是当前产品/代码名称。旧 QuickDrop 名称只存在于兼容 API、WebSocket、环境变量和迁移历史：

- 新 API：`/api/transfer/**`、`/api/public/transfer/**`
- 新 WebSocket：`/ws/transfer`
- 产品页面：首页 `/` 与分享/取件页 `/share`
- 兼容别名：`/api/quickdrop/**`、`/api/public/quickdrop/**`、`/ws/quickdrop`
- 环境变量暂时仍为 `QUICKDROP_*`，这是配置兼容面，不表示新代码应继续用旧命名

## 传输模式

### 同账号设备

登录设备通过 `/api/transfer/sync` 上报 presence 并读取其它设备、relay 和统一任务。发送方优先建立 direct session 与 WebRTC DataChannel；无法在等待窗口内就绪时创建/继续 `transfer_relay` 分片上传。

### 临时配对

匿名或登录浏览器通过 pair code / public room 建立 `pairSessionId`，WebSocket 只转发信令。`transfer_pair_task` 保存 direct attempt 的服务端视图，便于历史和生命周期反馈。

### 公开取件

发送方创建 `transfer_public_share`，分片上传后得到分享 token。接收页按 token 查询、预览或下载；登录用户可走保存到网盘接口。加密 payload 的 UI 保存限制见下文。

## 服务端模型

| 模型 | 含义 |
| --- | --- |
| `TransferDevice` | 同账号设备 presence，按 last-seen 判断在线 |
| `TransferRelay` | 服务端中转的分片、组装路径与接收方 |
| `TransferTask` | 同账号 direct + relay 的统一任务 |
| `TransferPairTask` | 临时配对 direct attempt 任务 |
| `TransferPublicShare` | 公开取件 token 与中转文件 |

`TransferTask` / `TransferPairTask` 的 `attemptsJson` 是 append/upsert 风格账本。唯一允许的读写入口是 package 内 `TransferAttemptLedger`：

- `load()` 容忍空值并标记损坏 JSON；
- `upsert()` 按 `(transferMode, transferId)` 合并生命周期；
- `remove()` 在损坏账本上保持不破坏原值；
- `view()` 同时生成 attempts、summary 与 task projection；
- service 保存时必须用同一个 view 回写 JSON 和投影字段，避免任务摘要与账本分叉。

不要在 service 里再次实现 attempt 排序、状态推导或 hybrid 判定。

## direct、relay 与归并

- direct attempt 由浏览器产生 `clientTransferId`，生命周期写回 `tasks/direct-attempts` 或 public pair-task 对应接口。
- relay 有数据库 `transferId`；前端使用稳定 `taskKey` 把 relay 与之前的 direct attempt 归并。
- `transferMode` 表示任务经历过的模式，`currentTransferMode` 表示当前 attempt；direct 失败后 relay 成功通常投影为 `hybrid` + current `relay`。
- 删除单个 direct attempt、删除 relay 和删除整个任务是不同操作，不能共享“删一条记录”的粗粒度实现。
- null、空或损坏账本都已有明确测试；改字段时必须保留向后兼容读取。

## relay E2EE

浏览器 `e2ee.js` 对 relay/public pickup 分片使用 AES-GCM：

- 公开取件的原始 key 放 URL fragment，fragment 不会发给服务器；完整链接仍是解密凭据。
- 同账号/临时配对通过 WebSocket 转发接收方 P-256 公钥、身份签名和发送方临时公钥，两端用 ECDH + HKDF 派生 AES key。
- 服务端保存 ciphertext、IV/元数据与密文长度，不拥有原始文件 key。
- 每个加密 chunk 比明文多 AES-GCM/IV 开销；`TransferServiceImpl` 的密文尺寸校验必须与前端格式同步。
- 加密 relay 的 Office 预览无法走服务端 LibreOffice；前端先解密的图片/文本/PDF可使用客户端路径。
- 当前前端禁止把加密 relay 直接“保存到网盘”，但服务端 API 并未把“密文不能当明文保存”建成完整强制边界。不要把 UI 限制写成服务端安全保证。

## 信令与扩容约束

`TransferWebSocketHandler` 支持 ping、signal、room-devices、request-transfer 和 public room 操作。session、channel、room 与 pair binding 保存在单进程内存中；连接断开时由 `TransferSignalingService` 清理。

因此：

- 反向代理必须支持 `/ws/transfer` upgrade 和长连接；
- 多副本部署需要 sticky routing 或把信令状态外置；
- WebSocket origin 当前允许任意 pattern，安全依赖 handshake channel/room 约束，修改时需做专门安全审查；
- TURN/STUN 只帮助建立 direct，relay 仍依赖 QuickShare HTTP 存储链路。

## 修改检查单

- API/DTO/VO 字段：同时检查 same-account、pair-task、public share 与 legacy route 测试。
- attempt 状态：检查 `TransferAttemptLedger`、两个 service 和前端格式化文案。
- chunk 格式/E2EE：前后端尺寸、续传索引、下载解密和失败恢复一起验证。
- 路由/命名：canonical 与 legacy 两组入口一起验证；兼容删除需要明确产品决定。
- 页面行为：mock Playwright 后再按需要运行真实双页 `quickdrop-real.spec.js`。
