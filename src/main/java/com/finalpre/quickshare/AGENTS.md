# QuickShare Java 后端规则

> 先读仓库根 `AGENTS.md`；系统分层见 `docs/ai/architecture.md`，传输域见 `docs/ai/transfer.md`，验证选择见 `docs/ai/validation.md`。

## 分层职责

- `controller/`：HTTP / WebSocket 入口、参数与鉴权主体适配、`Result<T>` 或流式响应。
- `service/`：跨 controller 复用的业务接口与领域策略。
- `service/impl/`：事务、配额、幂等、生命周期和外部资源编排。
- `mapper/`：MyBatis Plus 数据访问；不要在 controller 拼查询。
- `entity/`：数据库持久化模型；API 输出优先使用 `vo/`，输入使用 `dto/`。
- `config/`：Spring Security、配置属性、WebSocket 与启动时配置验证。

## 必守边界

- Controller 从 Spring `Authentication` 读取 `Long userId`；管理员能力统一受 `AdminController` 的 `@PreAuthorize("hasRole('ADMIN')")` 保护。
- API 业务失败交给 `GlobalExceptionHandler` 和既有异常类型；不要在各 controller 发明不同错误包络。
- 新增或修改表结构只能追加 Flyway 迁移。迁移需兼容已有数据库，禁止编辑已经发布的版本来“修历史”。
- `User` 与 `FileInfo` 使用逻辑删除；涉及文件/文件夹删除时同时核对分享、物理对象引用与配额回收语义。
- 网盘/分享文件存储只依赖 `StorageService`，不得把本地路径假设泄漏到通用业务逻辑。Transfer relay/公开取件当前仍直接使用 `file.upload-dir/transfer-temp`，修改该例外时必须同时检查清理、S3 和多副本语义。
- 所有预览入口复用 `PreviewDelivery`；Office 转换失败保持可理解的 unavailable 语义，不把转换异常伪装成空成功响应。
- Transfer 任务的 attempt 合并、删除、摘要和投影统一通过 `TransferAttemptLedger`。损坏账本不得被一次普通读/删静默清空。
- 运行时设置优先走对应 PolicyService；敏感值持久化前经 `SettingEncryptor`，日志中只记录非敏感标识。

## 验证

- Java 改动至少编译并运行离改动最近的 JUnit；跨 controller/service 共享行为需覆盖双方调用路径。
- 文件/预览改动优先：`FileControllerTest,FileServiceImplTest,PreviewResponseWriterTest,TransferPreviewControllerTest,DefaultPreviewDeliveryTest`。
- Transfer 改动优先：`TransferAttemptLedgerTest,TransferServiceImplTest,TransferPairingServiceImplTest`，涉及路由再加 `QuickDropLegacyRouteTest`。
- 安全、登录、续签改动优先：`ProdSecurityConfigurationValidatorTest,JwtUtilTest,UserServiceImplTest`，并补对应 controller 测试。
