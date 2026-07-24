## Context

套图模式调用 `generateCreationListingDrafts()`，应用入口会强制使用 Platform V1。该分支目前只请求一次模型，但在上游非 2xx、JSON 解析异常、结构不完整、风险声明或证据校验失败时调用 `makeMockCreationListingDraft()`，随后 API 把结果保存为 `completed`。截图中的 `Product Details` 和重复内部证据指令正是该路径的可见结果。非 V1 路径也会在重试耗尽或部分上游错误后返回确定性草稿。

## Goals / Non-Goals

**Goals:**

- 只有真实模型结果通过现有验收时才返回并保存 `completed` Listing。
- 所有真实请求失败都返回可读错误，且不产生 mock 或确定性草稿。
- 本地服务和 Worker 使用同一失败语义。
- 重新生成失败不覆盖已有 Listing。

**Non-Goals:**

- 不改变提示词、Listing 字段、复制/导出结构或历史记录读取方式。
- 不新增重试、人工审核或 `needs-review` 状态。
- 不删除测试显式调用的 mock 构造器。

## Decisions

### 1. 在共享请求层失败闭合

`requestCreationListingDraft()` 是本地服务和 Worker 共用的最窄边界。所有真实请求的 HTTP、解析和验收失败都在这里抛出错误，使两个运行时自然返回非成功响应。相比只在 UI 或单个路由过滤 mock，此方案不会让自动套图生成、手动重新生成或 Worker 路径发生语义漂移。

### 2. 保留一次真实模型请求

Platform V1 继续只请求一次；失败立即抛出。非 V1 保留现有最多两次验收尝试，但耗尽后同样抛出。此变更只删除兜底，不扩大请求次数或引入新状态机。

### 3. 显式 mock 与失败处理分离

`mock: true` 保留给单元和端到端测试。真实请求的任何异常分支不得调用 mock 构造器，也不得把错误转换为 `completed`。生产路由仍只有在显式测试配置下才能选择 mock，不会因上游失败自动进入该模式。

### 4. 成功后才持久化

本地路由现有代码已在生成函数成功返回后才执行 `saveManifest()`。共享请求层抛错后会直接进入 502 响应，因此无需修改持久化结构，失败时旧 `listingDrafts` 保持不变。

## Risks / Trade-offs

- 上游短暂故障会让用户看见失败，而不是得到可用性很差的草稿。该行为符合用户明确要求，并由可读错误提示降低排查成本。
- 过去依赖自动兜底的测试需要改为显式 mock 或失败断言。聚焦测试和串行全套测试用于防止遗漏。

## Migration Plan

无需数据迁移。部署后仅影响新的生成和重新生成请求；已有 Listing 保持原样。回滚可恢复共享请求层的旧失败分支，但会重新引入伪完成内容风险。

## Open Questions

无。
