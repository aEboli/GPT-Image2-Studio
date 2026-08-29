## 执行顺序

每个并发扇出 worker 按以下顺序执行：

1. 检查本次 fan-out 是否已中止。
2. 在 `clientSessionId + generationScope` 的共享任务桶中取得 slot。桶首次变为活跃时绑定该请求的并发上限。
3. 完成本地提示词、参考图和请求快照准备。
4. 在同一 scope 的共享 launch gate 中等待提交间隔。
5. 递增需要持久化的套图条目尝试次数。
6. 调用真实上游生成接口。
7. 在 `finally` 中释放 slot。

`runWithConcurrency` 只负责本地 worker 数量、动态入队和中止传播，不再为每个 HTTP 请求维护独立提交计时器。浏览器套图队列另行保证整套串行；队列中的第一套任务捕获调度参数，后续仍待处理的套图复用该快照。

套图自动补图使用显式 `autoRepair=1` 标记。服务端只为 `generationAttemptCount < 2` 的未完成条目构造自动补图请求，并在发往上游前保存递增后的计数；手动补图不走该过滤条件。

Responses 工作流对“任务已创建但中转站先报错”的情况保留以下边界：

1. HTTP 错误 body 或 `response.failed` / `response.incomplete` 事件必须同时提供可识别的 Responses 任务 ID，以及明确的临时容量/限流信号，才进入原任务 GET 回查。
2. 回查到 `completed` 直接复用最终图；回查到 `in_progress`、明确 `failed` 或回查不可用时，不再次 POST 已知的原任务。
3. 没有任务 ID、真实余额/账单/认证失败和其他不可恢复失败保持现有直接报错语义。
