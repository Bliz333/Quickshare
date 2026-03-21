# 2026-03-21 预发布 TURN 启用

## 本轮目标

- 在预发布机上真正把 TURN 服务跑起来
- 让当前预发布环境的 QuickDrop `rtc-config` 开始下发 TURN 地址，而不只是本地代码支持

## 本轮实现

- 在 `145.79.143.107` 上安装并启用 `coturn`
- 监听：
  - `3478/tcp`
  - `3478/udp`
- 预发布机上的 QuickDrop 应用环境已补：
  - `QUICKDROP_TURN_URLS`
  - `QUICKDROP_TURN_USERNAME`
  - `QUICKDROP_TURN_PASSWORD`
- 预发布机代码已同步到当前工作树版本后重建应用
- 预发布机上的历史 MySQL 账号密码不一致问题已做非破坏性恢复，保证应用重新可启动

## 验证

- `systemctl status coturn`
- `ss -ltnup | grep 3478`
- `docker-compose ps`
- `curl http://127.0.0.1:8080/api/health`
- `curl http://127.0.0.1:8080/api/public/quickdrop/rtc-config`

## 当前结论

- 预发布环境现在已经能下发：
  - 默认 STUN
  - 实际 TURN `udp/tcp` 地址
- 下一步不再是“把 TURN 配置写进代码”，而是：
  - 用真实双端浏览器做公网 / NAT 场景验证
  - 继续补直传 / 中转统一任务视图和更细粒度接续
