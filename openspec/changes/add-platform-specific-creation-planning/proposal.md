## Why

当前套图模式虽然已经提供 19 个平台选项，但平台差异只体现在附加提示词上，图片类型、顺序、张数、比例、分辨率、语言和生成管线参数仍沿用同一套默认逻辑。这会让 Amazon 白底主图等严格要求与现有通用首图模板直接冲突，也无法生成淘宝长图、小红书 3:4 封面等平台原生资产。

## What Changes

- 增加版本化、结构化的平台策略注册表，为通用电商及 18 个平台分别声明默认图片类型、顺序、推荐张数、逐图比例、分辨率档位、语言、构图、文字密度、SKU 规则、来源和证据等级。
- 将平台原生图片类型及逐图 Logo 策略设为计划项的一等字段，并保留现有 Creation 角色 ID 作为内容意图和历史兼容字段。
- 增加统一策略解析器，按“通用基线 < 平台策略 < 平台与类目覆盖 < 参考图覆盖需求 < 用户手动覆盖”生成最终计划，并在用户覆盖后验证图片类型绑定的官方硬规则。
- 将版本化、可序列化的 `effectivePlan` 设为预览、生成、队列、manifest、记录和修复共用的冻结契约；未经用户实际操作的表单默认值不构成覆盖，所有套图级、逐图及兼容提示词覆盖应用后都必须重新校验，执行边界必须拒绝 `canGenerate=false` 的计划。
- 区分平台 `recommendedCarouselCount`、证据解析后的 `automaticCarouselCount`、用户覆盖后的 `effectiveCarouselCount`、用户增减量以及最终总请求数；缺少事实证据时优先安全替换槽位，只有没有安全替换时才减少有效张数并显示原因。
- 支持每张计划图独立使用比例、分辨率和语言；本地服务与 Cloudflare Worker 共用同一解析结果和生成行为。
- 保留套图级快捷覆盖，同时允许用户增删、启停、排序并逐图修改图片类型、比例、分辨率、语言、构图模式、文字密度、场景策略和提示词。
- 平台切换前要求用户确认；确认后仅重置平台相关自动值和覆盖，保留商品资料、类目、尺寸、参考图、风格图、Logo、SKU、输出格式和模型/API 配置，取消则完整恢复原状态。
- 对参考图分析增加平台/类目请求版本校验，防止旧平台异步结果回写到新平台状态。
- 在队列快照和 Creation manifest 中持久化策略版本、平台 provenance、有效覆盖、轮播/SKU/重构计数及逐图参数；旧记录保持原计划，不因策略升级漂移，只有显式重新规划才使用新策略。
- 对官方规则不足的平台使用可见的保守建议和较低证据等级，不把推断标记为官方硬约束，也不在运行时抓取平台网站。
- 非 Amazon 平台禁用 Amazon US Listing Agent，并说明当前 Listing 能力的市场范围。
- 成套采用/淘汰审核、可持久化的暂停/取消/重排队列、商品版本管理、多平台差量派生和生成后视觉/OCR 质检留作后续独立 change，不扩入本次平台规划变更。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: 从统一角色切片和整套共用参数，调整为版本化平台策略驱动的图片类型规划、逐图生成参数、手动覆盖、平台切换、持久化与兼容行为。
- `creation-listing-agent`: 将 Amazon US Listing Agent 的启用条件明确限制为 Amazon 平台套图，避免其他平台误生成 Amazon Listing。

## Impact

- 规划与策略：`lib/creation-planner.mjs`，以及新增的平台策略和策略解析模块。
- 浏览器交互：`public/app.js`、`public/index.html`、`public/styles.css`，包括平台摘要、覆盖状态、可排序图片槽位和切换确认；浏览器使用的平台模块通过 `scripts/sync-public-lib.mjs` 从 `lib` 精确镜像到 `public/lib`。
- 生成路径：`server.mjs`、`cloudflare-pages-worker.mjs`，改为按计划项解析并提交比例、分辨率与语言。
- 队列、修复与存储：`lib/creation-suite-queue.mjs`、`lib/creation-repair.mjs`、`lib/creation-store.mjs`。
- Listing：现有 Listing 控件的可用状态与校验逻辑；不扩展非 Amazon Listing 内容生成。
- 测试：平台策略、解析优先级、规划器、浏览器交互、队列、存储、修复、本地/Worker 一致性和端到端回归测试。
- 现有未提交平台功能属于本变更的实施基线，实施时必须保留并最小化修改用户当前脏工作树中的其他改动。
