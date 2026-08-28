## Why

套图模式一次生成要 10-20 分钟，提示词模式 5 分钟以内。原因是三项叠加，而不是单张变慢：

1. **默认张数远多于并发。** 套图数量默认 18 张，SKU 图默认开启还会追加。服务端 `MAX_CREATION_PARALLEL_TASKS = 10` 同时卡住 `runWithConcurrency` 和会话槽位，18 项要跑两轮，总耗时约等于单张耗时乘以轮数。
2. **实际分辨率不是界面显示的 1K。** 计划项的 `resolutionTier` 来自平台档案（通用电商 `1.5K`、Amazon 等 `2K`），而 `resolveCreationItemGenerationParameters` 的取值顺序是 `effectiveSize → resolutionTier → 表单 size`，所以档案值优先于表单。切换平台时分辨率控件被复位成"自动"，有冻结计划时 `size` 根本不进 formData，用户看不出实际在按 1536² 或 2048² 出图。1536² 是 1024² 的 2.25 倍像素，2048² 是 4 倍。
3. **同一份参考图按项重复发往上游。** 服务端只解码一次参考图，但每个计划项的上游请求都把同一份 base64 重新塞进请求体。20 项乘以最多 15 张参考图，等于同样的字节被发送几十次；补图重试再发一遍。

前后端并发口径还不一致：客户端创作模式预算读 `maxParallelTasksPerSession`（15），服务端 creation 作用域只给 10，`scheduleCreationGenerationQueue` 会多起一个套图任务，它的项在服务端只能以 250ms 间隔空转等槽位，队列显示"当前生成"但实际一张没开始。

## What Changes

- **分辨率统一 1K。** 全部 18 个平台档案的 `resolutionTier` 与规划兜底值改为 `1K`。用户显式选择的分辨率覆盖仍然优先，不受影响。
- **并发统一 20，含补图重试。** `MAX_CREATION_PARALLEL_TASKS` 提到 20，`runWithConcurrency` 的硬顶 `MAX_CONCURRENT_WORKERS` 同步提到 20，客户端创作模式预算改为读同一个常量而不是会话通用值。生成、补图和自动补图三条路径共用这一个上限。
- **参考图在整套图内只上传一次。** 新增按内容指纹归一的参考图登记表：同一套图请求内相同字节只保留一份描述符，逐项引用同一条目，生成与补图共用。
- **路线 A 复用上游 file_id。** 参考图按内容指纹向上游 `/v1/files` 上传一次，逐项请求改为携带 `file_id`；探测失败、上游不支持或响应异常时回退到现有 base64 内联，不使任务失败。仅路线 A（Responses）支持，路线 B/C 保持内联。

## Capabilities

### New Capabilities

### Modified Capabilities

- `creation-mode`: 套图默认分辨率档位、生成并发上限（含补图重试）、参考图上游传输方式。

## Impact

- 分辨率：`lib/creation-platform-policies.mjs`、`lib/creation-planner.mjs`、`public/app.js` 的兜底平台选项。
- 并发：`lib/studio-constants.mjs`、`lib/limited-concurrency.mjs`、`public/app.js` 的 `getMaxParallelJobCount`。
- 参考图复用：新增 `lib/creation-reference-upload-cache.mjs`，改动 `lib/responses-workflow.mjs` 的 Responses 输入构建、`server.mjs` 的套图生成与补图路径。
- 已保存的历史套图记录：冻结计划不改写，补图仍按记录里的档位执行；只有新计划使用 1K。
- 同步产物：`public/lib` 下对应模块。
- 测试：`test/studio-limits.test.mjs`、`test/limited-concurrency.test.mjs`、平台档案与规划相关测试中针对 `1.5K` / `2K` 和并发数的断言。
- 上游成本：20 并发对第三方代理的限流压力高于 10，超限时表现为上游报错而非排队，需要用户侧确认端口承载能力。
