# 2026-03-20 下载套餐扣减接线记录

## 本轮目标

- 把 `downloads` 套餐从“只有字段和计划类型”补到“真实下载会扣减”
- 保持匿名公开下载不误扣任意账号额度

## 实现方式

- 在 `FileController` 下载入口层接入额度校验与记账
- 登录用户下载自己的文件：
  - 下载前执行 `checkDownloadQuota(userId)`
  - 下载成功后执行 `recordDownload(userId)`
- 登录用户访问公开下载链接：
  - 同样执行下载额度校验与记账
- 匿名公开下载：
  - 保持可用，但不扣任何账号套餐额度

## 为什么接在控制器层

- 先校验额度，再进入真实下载流程，可以避免额度不足时还先扣别的计数
- 控制器层最容易拿到当前登录用户身份，能区分“登录下载”和“匿名下载”

## 测试

- `./mvnw -q -DskipTests compile`
- `./mvnw -q -Dtest=FileControllerTest,FileServiceImplTest test`
- `docker compose up --build -d`
- `POST /api/auth/login`
- `GET /api/profile`
- `GET /api/files?folderId=0`
- `GET /api/files/{fileId}/download`
- 再次 `GET /api/profile`

## 结果

- 登录用户下载真实文件后，`downloadUsed` 从 `0` 变为 `1`
- 当前 `downloads` 套餐语义已经落到真实下载流程

## 后续可选项

- 如果未来要把匿名分享访问也计入套餐额度，需要先定义“扣分享者还是扣访问者”的规则
