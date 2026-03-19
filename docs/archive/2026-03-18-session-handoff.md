# 2026-03-18 当前会话交接基线

- 分支：`feature/hardening-plan`
- 用途：为下一次继续开发提供单一交接入口，避免重复梳理当前阶段判断与最近几轮安全加固内容

## 当前阶段判断

- 主阶段：阶段 1 `安全与鉴权强化`
- 辅阶段：阶段 2 `文件夹与文件闭环`
- 当前判断：
  - 阶段 2 的文件主链路已经基本打通，可视为“可继续迭代”的稳定基线
  - 当前主工作重心已回到阶段 1，主要是在现有文件 / 分享主链路上补安全边界、异常语义和公开入口风险控制

## 目前已经稳定的可复用基线

### 共享入口权限边界

- 首页匿名用户可以：
  - 上传文件
  - 立即创建分享
  - 通过分享码 / 提取码访问下载
- 网盘能力仍要求登录：
  - 文件列表
  - 文件夹操作
  - 网盘内预览 / 删除 / 重命名
- 匿名创建分享不再是“完全开放接口”，而是依赖匿名上传后返回的 `guestUploadToken`

### 分享 / 预览 / 下载回归

- 已补 `share / preview / download` 的最小 WebMvc 回归：
  - 401：缺少鉴权
  - 400：提取码错误 / 缺失 / 匿名分享凭证无效
  - 404：资源不存在
  - URL `token` 预览链路
- 已补服务层回归：
  - 逻辑删除文件不可继续分享
  - 分享过期
  - 下载次数上限
  - 下载成功后计数递增

### 公开入口频控

- 现在三个公开入口都已经有应用层频控：
  - 匿名上传 `/api/upload`
  - 公开分享信息查询 `/api/share/{shareCode}`
  - 公开下载 `/api/download/{shareCode}`
- 当前默认策略：
  - 匿名上传：10 次 / 600 秒 / IP
  - 分享信息查询：60 次 / 600 秒 / IP
  - 公开下载：30 次 / 600 秒 / IP
- Redis 故障时采用 fail-open：
  - 记录日志
  - 不阻断主流程

### 为阶段 3 预留的管理员接管点

- 频控策略来源已经从执行链中解耦，后续管理员面板不必改控制器或 Redis 计数逻辑，只需要接管策略来源：
  - `src/main/java/com/finalpre/quickshare/config/RateLimitProperties.java`
  - `src/main/java/com/finalpre/quickshare/service/RateLimitPolicyService.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/RateLimitPolicyServiceImpl.java`
  - `src/main/java/com/finalpre/quickshare/service/impl/RequestRateLimitServiceImpl.java`
- 当前仍然是配置文件提供策略；后续可以替换为：
  - 数据库表
  - Redis 动态配置
  - 后台管理接口

## 下一次继续开发时的建议起点

优先直接做：`提取码错误次数限制`

原因：
- 现在三个公开入口已有基础频控，但“猜提取码”这条风险还没有更细粒度限制
- 这是继续强化阶段 1 的最高价值补口
- 做完后，公开分享链路的攻击面会明显缩小

建议顺序：
1. 给分享信息查询加“提取码错误次数”计数，建议粒度至少包含 `IP + shareCode`
2. 错误次数超限后返回单独业务语义，例如“尝试次数过多，请稍后再试”
3. 补控制器和服务层回归
4. 再考虑是否把该策略并入未来管理员面板可调项

## 如果下一次要直接开始做管理员面板，这里是接入点

- 优先不要直接改 `RequestRateLimitServiceImpl` 的执行逻辑
- 先设计频控策略持久化模型与接口草案
- 管理员面板最自然的第一批控制项：
  - 匿名上传开关 / 阈值 / 窗口
  - 分享信息查询开关 / 阈值 / 窗口
  - 公开下载开关 / 阈值 / 窗口
  - 提取码错误尝试次数阈值 / 冷却时间

## 最后一次确认通过的验证

- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=FileControllerTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 -Dtest=RequestRateLimitServiceImplTest test`
- `mvn -q -Dmaven.repo.local=/tmp/quickshare-m2 test`

## 相关记录入口

- `docs/STATUS.md`
- `docs/CHANGELOG.md`
- `docs/archive/2026-03-18-share-preview-download-regression.md`
- `docs/archive/2026-03-18-guest-rate-limit-baseline.md`
- `docs/archive/2026-03-18-public-share-info-rate-limit-followup.md`
