## 1. Specification and lifecycle contract

- [x] 1.1 将套图流等待和原任务回查拆分为独立取消信号，并保持当前并发和启动间隔不变。
- [x] 1.2 让 Responses SSE 上报已知原任务 ID，并让流等待到期能将该 ID 进入 GET-only 回查路径。
- [x] 1.3 为套图配置固定、有界的原任务回查窗口，区分回查窗口到期与客户端关闭。

## 2. Retry protection and state persistence

- [x] 2.1 在套图项清单中持久化非敏感的原任务回查状态和自动重试保护标记。
- [x] 2.2 在初始生成、Logo 批量和补图 worker 中写入原任务状态，并在手动补图新 POST 前清理旧保护状态。
- [x] 2.3 在浏览器和服务端自动补图筛选中排除受保护条目。

## 3. Client terminal-state protection

- [x] 3.1 扩展清单合并逻辑，保留已有正式资产及完成态。
- [x] 3.2 保护已完成条目不被迟到套图 SSE 事件降级。
- [x] 3.3 在手动补图流异常时重新同步服务端清单。

## 4. Regression coverage and verification

- [x] 4.1 为流等待到期后的 GET-only 回查、成功找回、回查到期、客户端关闭，以及最终图到达后 SSE 不关闭的场景添加 Responses 测试。
- [x] 4.2 为自动补图保护、清单字段归一化和客户端资产保留添加回归测试。
- [x] 4.3 运行聚焦测试、语法检查、公共库同步检查、严格 OpenSpec 校验和全量测试；确认并发配置未变化。
