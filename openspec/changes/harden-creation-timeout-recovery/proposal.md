## Why

套图单项在上游已创建任务后，可能在最终图片字节回传前达到本地流等待期限。现有实现会同时取消流读取和原任务回查，使后台自动补图可能再次提交仍在运行的任务，并且迟到的流事件或旧清单可能覆盖已保存的正式图片。

## What Changes

- 将套图的流等待期限与原任务回查取消语义分离：已知 Responses 任务在流等待到期后仅通过有界 GET 回查，不自动重新 POST。
- 已交付完整最终图片时立即结束对应 SSE 读取并释放上游连接，不再等待代理补发 EOF 或 `[DONE]`。
- 对流等待到期但结果未确认的条目持久化非敏感保护标记，阻止后台自动补图重复提交；用户显式手动补图仍可开始一次新请求。
- 加固套图客户端清单合并和 SSE 事件处理，避免迟到状态、旧清单或补图请求断流把已保存正式图片降级为生成中或失败。
- 保持当前套图并发和启动间隔配置不变。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `creation-mode`: 套图超时后的原任务恢复、自动补图资格和客户端终态图片保护。

## Impact

- Responses 工作流：`lib/responses-workflow.mjs`。
- 套图服务端生命周期、清单和补图：`server.mjs`、`lib/creation-store.mjs`、`lib/creation-auto-repair.mjs`。
- 套图浏览器状态合并和补图错误处理：`public/app.js`、`lib/creation-preview-retention.mjs`。
- 测试：Responses 工作流、套图自动补图、清单保留和套图端到端回归测试。
