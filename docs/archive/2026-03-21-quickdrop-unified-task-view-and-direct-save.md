# 2026-03-21 QuickDrop 统一任务视图骨架与直传保存到网盘

## 本轮目标

- 让浏览器直传任务不再只躺在单独的直传卡片里
- 让主接收箱 / 发送记录开始看到浏览器直传任务
- 让直传收到的文件可以直接保存到网盘

## 本轮实现

- `quickdrop.js` 现在会把两类任务合并到主列表：
  - 服务器中转任务
  - 浏览器直传任务
- 主接收箱和发送记录现在都会显示任务来源：
  - `直传 / Direct`
  - `中转 / Relay`
- 直传收到的文件现在可以直接从主接收箱保存到网盘
  - 通过现有 `/api/upload` 落盘
  - 继续复用当前页面的目标文件夹选择器
- `quickdrop-direct.js` 已补本地任务记录：
  - `incoming`
  - `outgoing`
  - 发送中、等待完成、已完成、回退中转等状态
- 仍保留原有直传卡片，作为配对直传专用面板；但主列表已开始承接统一视图

## 当前边界

- 现在已经有“统一任务视图骨架”
- 但仍不是最终形态：
  - 同一文件在“直传后回退中转”时，仍可能以两种任务语义出现
  - 还没有做到真正统一的任务 ID / 任务详情页
  - 直传卡片和主接收箱之间仍有一定展示重复

## 验证

- `node --check src/main/resources/static/js/quickdrop-direct.js`
- `node --check src/main/resources/static/js/quickdrop.js`
- `node --check tests/e2e/quickdrop.spec.js`
- `./scripts/check-js.sh`
- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=QuickDropPairingServiceImplTest,QuickDropServiceImplTest test`
- `docker compose up --build -d app`
- `npx playwright test tests/e2e/quickdrop.spec.js`
- `./scripts/quickshare-smoke.sh`

## 当前结论

- QuickDrop 用户侧现在已经开始从“多条并行技术链路”收口到“一个任务视图”
- 下一步应继续补：
  - 统一任务 ID / 任务归并
  - 直传 / 中转切换时更少的重复感知
  - 更完整的任务详情和网盘落盘后回写状态
