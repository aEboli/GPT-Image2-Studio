## 1. Baseline And Policy Contract

- [x] 1.1 Review and record the current dirty-worktree diff for all affected Creation files so implementation preserves unrelated user changes and the existing uncommitted platform work.
- [x] 1.2 Add failing policy-contract and expanded-slot snapshot tests for all 19 platform IDs, exact ordered image types and per-slot ratios, unique slot keys, valid legacy-role mappings, composition, text, scene and Logo policies, recommended counts including 7 and 9, supported languages and resolution tiers, strategy versions, evidence levels, verification dates, and source references.
- [x] 1.3 Add failing tests proving that blocking constraints require an official source, C-level guidance stays advisory, and runtime policy resolution performs no external network access.
- [x] 1.4 Implement the canonical platform image-type and profile registry in `lib/creation-platform-policies.mjs`, including the approved defaults and source metadata, until the policy-contract tests pass.
- [x] 1.5 Add the browser-used platform policy and resolver modules to `PUBLIC_LIB_SYNC_TARGETS`, generate their `public/lib` mirrors, add a failing mirror-consistency test, and replace duplicated planner/browser platform definitions with the canonical modules plus a minimal universal loading fallback.

## 2. Strategy Resolver And Override Precedence

- [x] 2.1 Add failing resolver tests for `universal < platform < platform/category < reference coverage < set override < item override`, deterministic category substitutions, evidence-dependent and non-duplicating fallback replacement, stable item ordering, set/item overrides for composition, text density, scene and Logo policies, and variant-comparison slots that remain distinct from deduplicated appended per-SKU items.
- [x] 2.2 Add failing validation tests for sourced hard-rule conflicts, advisory warnings, conversion to a `custom` image type, unknown-platform fallback warnings, and restoration of current-platform recommendations.
- [x] 2.3 Implement `lib/creation-platform-resolver.mjs` with normalized profiles, category/reference overlays, set and item overrides, image-count derivation, constraint validation, warnings, and effective per-item parameters.
- [x] 2.4 Extend allowed Creation carousel counts and normalization so platform defaults such as Amazon 7 and Shopee 9 work without regressing zero-image infographic-rebuild mode or existing 4–18 presets.

## 3. Planner And Prompt Integration

- [x] 3.1 Add failing planner tests for the approved Amazon, Taobao/Tmall, Xiaohongshu, Etsy, eBay, Walmart, and one C-level platform plans, including image types, legacy roles, counts, order, ratios, sizes, languages, constraints, and warnings.
- [x] 3.2 Add failing prompt/reference tests proving that sourced strict main images forbid text, collage composition, and external uploaded Logo attachment while preserving product-embedded markings; Xiaohongshu avoids fabricated reviews or disguised UGC; and evidence-dependent prompts never invent unsupported platform claims or product facts.
- [x] 3.3 Integrate the resolver into `buildCreationPlan`, SKU planning, infographic rebuild planning, and plan overrides while preserving existing role IDs, reference coverage, content allocation, Logo behavior, and system-generated prompt compatibility.
- [x] 3.4 Return strategy metadata, set overrides, validation results, and effective per-item generation parameters from local and Cloudflare plan-preview endpoints.

## 4. Browser Automatic Plan And Manual Editing

- [x] 4.1 Add browser/static tests for the automatic-plan summary with separate carousel/SKU/rebuild/total counts, automatic and overridden field states, and compatible image-type enablement.
- [x] 4.2 Implement canonical policy-module loading and browser state for platform profiles, effective plans, set overrides, item overrides, validation warnings, and the Restore current platform recommendation action.
- [x] 4.3 Update the compact Creation parameter UI and image-type area to show the platform summary and compatible image-type state.
- [x] 4.4 Ensure preview and generation FormData serialize the frozen normalized override model rather than deriving a different plan from transient DOM values.

## 5. Platform Switching And Async Analysis Safety

- [x] 5.1 Add failing interaction tests for platform-switch confirmation, exact reset scope, cancel restoring all previous state, preserved product/assets/SKU/configuration fields, and immediate recomputation after confirmation.
- [x] 5.2 Implement the platform-switch confirmation transaction and make programmatic record reuse or initial hydration avoid unnecessary confirmation dialogs.
- [x] 5.3 Add failing tests for a reference analysis response that completes after the platform or category snapshot changes.
- [x] 5.4 Add abort/request-version handling to reference analysis so stale responses cannot update suggestions, roles, notes, category, slots, or preview state.

## 6. Per-Item Local And Cloud Generation

- [x] 6.1 Add failing local-server and Worker tests showing that one set can generate square and portrait items with different effective sizes and language guidance.
- [x] 6.2 Add failing parity tests requiring the same normalized payload to produce deeply equivalent platform plans in local and Cloudflare environments.
- [x] 6.3 Move ratio and resolution resolution inside each local Creation item task, and persist the effective request parameters in activity, lightbox, SSE, and saved item metadata.
- [x] 6.4 Apply the same per-item generation logic in `cloudflare-pages-worker.mjs`, including nearest supported same-ratio size fallback and item-level failure isolation.

## 7. Queue, Manifest, Reuse, And Repair Compatibility

- [x] 7.1 Add failing queue tests proving that platform, strategy version, set/item overrides, ordered slots, prompts, ratios, sizes, and languages are frozen at submission and do not change when the form is edited later.
- [x] 7.2 Add failing store and record tests for new manifest fields and count semantics, explicit versus `legacy-missing` platform provenance before fallback normalization, record display, reuse, explicit re-planning, and old manifests that lack all platform-strategy fields.
- [x] 7.3 Add failing repair tests proving that retry and completion reuse each saved item's image type, role, ratio, effective size, language, constraints, and prompt instead of current form or current-profile defaults.
- [x] 7.4 Extend `creation-suite-queue`, server/Worker set builders, `creation-store`, record hydration, export, and `creation-repair` to persist and restore the frozen effective plan without rewriting legacy manifests.

## 8. Listing Integration Boundary

- [x] 8.1 Add Listing UI and endpoint tests for platform-aware records, preserved historical drafts, and legacy manifests without platform metadata.
- [x] 8.2 Keep Listing generation, rewrite, review, copy, and export integrated with saved Creation records without making platform metadata a destructive migration boundary.

## 9. Verification And Independent Acceptance

- [x] 9.1 Run the focused policy, resolver, planner, browser, switching, reference-analysis, server, Worker, queue, store, repair, Listing, and end-to-end test files and resolve every regression without weakening assertions.
- [x] 9.2 Run the complete project test, `npm run sync:public-lib -- --check`, and build/start verification commands required by the repository and record any environment-only limitations.
- [x] 9.3 Inspect the real browser UI for Amazon, Taobao/Tmall, Xiaohongshu, and one C-level platform, covering preview, confirmation and cancellation, manual set/item overrides, mixed ratios, warning/error states, queue snapshots, saved-record reuse, and retry.
- [x] 9.4 Verify local and Cloudflare plan parity with representative payload fixtures and confirm that no runtime request is made to marketplace rule URLs.
- [x] 9.5 Scan all new and modified Chinese content for replacement characters, mojibake, incomplete phrases, inconsistent UTF-8 encoding, placeholders, and stale duplicated platform labels.
- [x] 9.6 Request an independent read-only acceptance agent to review the final diff, core paths, failure states, tests, OpenSpec compliance, and unrelated-worktree preservation; address every confirmed issue before completion.
- [x] 9.7 Perform the final minimal-diff review and update these OpenSpec task checkboxes only when their corresponding implementation and verification evidence is complete.

## 10. 审查整改与运行时加固

- [x] 10.1 增加本地写真 mock 集成测试，覆盖成功 SSE、异常 SSE 和记录落库；增加本地服务默认只绑定回环地址及写接口安全校验测试。
- [x] 10.2 修复写真生成误用 Creation 参数解析器和服务端未定义错误格式化函数；默认绑定回环地址，并为敏感写接口增加同源或启动令牌校验且保持本地前端兼容。
- [x] 10.3 增加 Cloudflare R2 自定义元数据 8,192 字节上限测试，以及 Worker Creation complete set 与本地 manifest 冻结字段一致性测试。
- [x] 10.4 将完整提示词移出 R2 自定义元数据，并让 Worker Creation manifest 持久化策略版本、provenance、覆盖项、计数字段和 `effectivePlan`。
- [x] 10.5 增加浏览器行为测试，覆盖自定义槽位新增、前后插入、排序、禁用后重新启用、连续编辑竞态和覆盖状态可见文案。
- [x] 10.6 修复 resolver 与浏览器计划编辑器的自定义槽位物化、统一 `order` 排序、全槽位渲染、最新预览响应提交和覆盖状态同步。
- [x] 10.7 为移动端顶栏增加明确且可触达的展开入口，并修正计划警告列表语义和中文可见状态，不改变现有桌面布局。
- [x] 10.8 运行定向测试、完整 `npm test`、public/lib 同步检查、Cloudflare Pages 构建、OpenSpec strict validation、依赖审计和中文乱码扫描。
- [x] 10.9 请求独立只读验收 agent 复核安全边界、写真 SSE、R2 上限、Worker manifest、计划编辑器真实交互和脏工作树保留；处理所有确认问题后再完成本节。

## 11. 兼容图片类型计数对齐

- [x] 11.1 增加定向浏览器状态测试，证明兼容图片类型区域从冻结 `effectivePlan` 读取当前轮播槽位、启用状态和计数，并排除追加 SKU 与信息图重构项。
- [x] 11.2 将兼容图片类型区域的列表、勾选状态和计数对齐当前有效轮播计划，复用逐槽启停覆盖与预览更新路径，并运行相关回归与 OpenSpec strict validation。
- [x] 11.3 将兼容图片类型和平台计划摘要对齐当前显示队列任务的冻结 `effectivePlan` 与只读覆盖快照；旧任务无可用计划时回退当前表单计划，并完成定向回归、public/lib 同步检查和 OpenSpec strict validation。

## 12. 显式生成数量端到端对齐

- [x] 12.1 增加失败测试，覆盖无证据 Amazon 显式 18 张、18 个所选角色、浏览器自动 7 与用户改 18 的序列化，以及本地与 Worker 代表性端点。
- [x] 12.2 让浏览器将用户数量选择保存为显式覆盖，让 planner 把所选角色传入共享 resolver，并以不虚构商品事实的自定义建议槽位严格补足请求数量。
- [x] 12.3 运行定向测试、端点一致性检查、public/lib 同步检查和 OpenSpec strict validation，并复核中文编码与最小 diff。

## 13. 全平台 Listing 回归

- [x] 13.1 移除全部平台资格限制，遍历 19 个 canonical 平台并直接覆盖 Temu、Etsy、legacy，保留空选择和生成中禁用，并完成浏览器控件、本地/Worker 端点、全量测试与构建验证。

## 14. 全平台专属 Listing 文案策略

- [x] 14.1 将 2026-07-15 核验的广告真实性底线和 Amazon、TikTok Shop、Etsy、eBay、Walmart、Shopify、淘宝、京东、拼多多、抖音、小红书、Shopee、Lazada、Rakuten、Coupang 官方 Listing 来源固化为版本化 source register；明确 Temu、AliExpress、Mercado Libre 等低证据平台只使用可配置保守建议，不产生伪官方硬规则。
- [x] 14.2 先增加失败测试，固定 5 个跨类目 archetype、19 个 canonical override、完整 Listing policy 字段、来源与证据等级、冻结 platform/locale 解析顺序、unknown 与 `legacy-missing` 回退，以及运行时不访问规则 URL。
- [x] 14.3 先增加失败测试，覆盖 V2 strict superset schema、V1 `fiveBullets`/`backendSearchTerms`/`painPoints`/`amazon-us` aliases、平台标题/高亮/描述/搜索面/语言/字符与 UTF-8 字节限制、统一事实门控、claim 风险和两次无效后的 reviewable fallback。
- [x] 14.4 实现共享 Listing policy registry、resolver、source enrichment、分层 prompt、动态 strict schema、normalizer、validator 和保守回退；移除全局 Amazon US English、Rufus、数量前置、固定五点、后台词和非 ASCII 假设，同时保留 Amazon policy 的有依据规则。
- [x] 14.5 更新记录页归一化、动态字段标签、发布字段/内部字段区分、复制、导出和失败状态；旧 V1 草稿保持原内容且不自动迁移，用户显式重写时才生成并冻结 V2 policy metadata。
- [x] 14.6 增加本地服务与 Cloudflare Worker parity 测试，证明相同规范化 set 产生等价的 policy、locale、上游请求体、草稿、校验和回退状态，并确认两个端点不复制平台策略。
- [x] 14.7 运行 Listing 定向测试、全量 `npm test`、`npm run sync:public-lib -- --check`、Cloudflare Pages 构建、OpenSpec strict validation、中文 UTF-8/乱码扫描和限定文件最小 diff 复核；不得把机器校验表述为平台审核、法律合规或高转化保证。
- [x] 14.8 请求独立只读验收 agent 复核官方来源等级、19 平台覆盖、旧草稿兼容、事实门控、失败状态、UI 发布复制、本地/Worker parity 和脏工作树保留；处理所有确认问题后才勾选本节任务。

## 15. 参考证据刷新与自定义槽位语义

- [x] 15.1 增加规格和失败测试，覆盖应用建议后刷新参考 coverage/evidence、Temu 显式 16 张、通用电商显式 18 张，以及 custom 槽的角色默认值、提示词和用途标题分化。
- [x] 15.2 从用户已应用的参考图角色重建冻结 `platformReferenceCoverage` 和 `platformEvidence`，保留现有套图/逐图覆盖与类目信号，不把未应用的识别结果直接当作事实。
- [x] 15.3 让显式补足的 custom 槽使用安全的 role-led 默认值，并让 planner 显示“角色用途（自定义）”及对应角色提示词，同时保持 advisory、无平台硬约束和事实门控。
- [x] 15.4 运行 resolver、planner、browser state 定向测试、public/lib 同步检查、OpenSpec strict validation 和中文 UTF-8/乱码扫描，复核限定文件的最小 diff。
- [x] 15.5 增加失败测试，直接模拟 `effectivePlan=null`、显式 `imageCount=18`、角色未手动编辑和 18 个已对齐角色，证明浏览器提交决策保留数量与角色并让端点计划得到指定 custom 用途。
- [x] 15.6 将首次预览的数量与角色提交规则收敛为可测试的纯决策，并接入 `buildCreationPlanPreviewFormData`；仅在无显式数量且无手动角色编辑时请求空角色自动计划。
- [x] 15.7 运行 browser state、preview endpoint 定向测试、public/lib 同步检查和 OpenSpec strict validation。

## 16. 当前表单与队列计划计数隔离

- [x] 16.1 增加失败测试，覆盖当前表单选择 4 张时摘要轮播计数为 4、SKU/重构独立追加，以及后台 18 张队列快照不会覆盖当前表单计划。
- [x] 16.2 将当前表单草稿计划与选中/活动队列任务的冻结计划分离；表单计划未刷新时显示明确待刷新状态，同时保持队列生成、保存和修复继续使用冻结快照。
- [x] 16.3 运行 browser state、planner、preview endpoint、queue 定向测试、public/lib 同步检查、OpenSpec strict validation 和中文 UTF-8/乱码扫描，并复核用户现有脏工作树改动未被覆盖。
- [x] 16.4 在真实浏览器中验证生成期间编辑下一套数量、预览、加入队列和切回任务快照的界面状态，再由独立只读验收 agent 复核。

## 17. Listing 直接生成

- [x] 17.1 增加失败测试，证明模型两次无效和 mock 路径均返回发布字段完整、统一 validator 通过且状态为 `completed` 的 V2 草稿。
- [x] 17.2 让模型重试耗尽和 V2 mock 共用基于已验证商品输入的确定性草稿构造器；只有通过当前 Listing policy 与事实校验才允许直接复制或导出，不再返回人工复核占位。
- [x] 17.3 更新本地、Worker、端到端和界面契约测试，运行 Listing 定向测试、全量测试、public/lib 同步检查、Pages 构建、OpenSpec strict validation 与中文乱码扫描。

## 18. 全平台 Listing 英中对照与无品牌门禁

- [x] 18.1 逐项复核 19 个 canonical Listing policy 的当前官方来源、核验日期、版本和证据等级；固定 Etsy 标题 140 字符、最多 13 个标签且每个 20 字符，Amazon 75 字符标题自 2026-07-27 生效且只在可靠官方 source 支持时记录具体 backend-search UTF-8 字节上限，并把 Coupang 搜索标签限制改为 UTF-8 bytes；Temu、AliExpress、Mercado Libre 保持低证据 advisory。
- [x] 18.2 先增加失败的 policy contract 测试，覆盖 19 平台 override、官方硬限制与生效日期、低证据建议不阻断、运行时不访问规则 URL，以及移除 Listing `brand` archetype 和 `brand-if-supplied` 语义。
- [x] 18.3 先增加失败的 V2 schema、normalizer 和 validator 测试，证明英文 `title`、`sellingPoints`、`buyerObjections`、`highlights`、`description`、`searchTerms`、`keywordBuckets`、`warnings`、`missingInfo` 与 `zhDisplay` 同名字段在类型、条数、顺序和语义上逐项对应。
- [x] 18.4 先增加失败的无品牌门禁测试，覆盖商品名、描述、卖点、SKU、包装/尺寸、参考图说明和 manifest 中的品牌、商标、店铺、卖家、平台词，以及 model、retry、mock、确定性 fallback、嵌套英中字段、单字段复制、整段复制、导出和 V1 历史草稿边界。
- [x] 18.5 实现版本化 Listing policy 更正、非品牌 `editorial` archetype、英文公开稿与简体中文逐字段对照，并让 source builder 在 prompt 前提取禁止词集合；不得把本产品 `no-brand` 硬规则表述为平台官方规则。
- [x] 18.6 让 prompt、sanitizer、normalizer、validator、model retry、mock、确定性 fallback、本地服务和 Worker 共用同一 policy、事实、英中结构与递归无品牌门禁；只有全部通过时才返回 `completed`。
- [x] 18.7 更新记录页英中对应展示、平台字段标签、单字段/整段复制和结构化导出，确保发布内容无禁止词、两种语言不丢字段，平台与 policy 信息只保留在非内容 metadata；旧 V1 草稿读取时不自动改写。
- [x] 18.8 运行 Listing policy/schema/prompt/normalizer/validator/fallback/UI/copy/export/local/Worker focused tests，随后运行完整 `npm test`、`npm run sync:public-lib -- --check`、Cloudflare Pages build、`openspec validate add-platform-specific-creation-planning --strict` 和新增/修改中文 UTF-8 乱码扫描，并复核限定文件最小 diff。
- [x] 18.9 请求独立只读验收 agent 复核 19 平台证据分级、Etsy/Amazon/Coupang 限制、英中逐字段对照、所有内容字段 no-brand、共享门禁、本地/Worker parity、V1 历史保护、真实 UI 复制/导出和脏工作树保留；处理所有确认问题后再勾选本节任务。

## 19. 恢复旧版 Listing 结构并直接输出

- [x] 19.1 更新 Listing 规格和测试，固定 19 平台继续使用各自 policy，但新草稿统一输出 `title`、`sellingPoints`、`painPoints`、`fiveBullets`、`description`、`backendSearchTerms`、`keywordBuckets` 与同构 `zhDisplay`。
- [x] 19.2 将模型调用收敛为单次请求，移除 validator 驱动重试、`needs-review`、失败重写和复制/导出门控；请求或解析失败时直接返回 `completed` 的旧版确定性 fallback。
- [x] 19.3 让 source、prompt、model、mock、fallback、normalizer 和输出 sanitizer 继续统一移除品牌、商标、店铺、卖家和平台名称，但不把该清洗实现为审核流程。
- [x] 19.4 恢复记录页旧版七区块和英中逐项展示，确保单字段复制、整段复制和结构化导出直接可用；历史 V2 草稿只做视图映射，不自动改写存储。
- [x] 19.5 运行 Listing 定向测试、完整 `npm test`、public/lib 同步检查、Pages build、OpenSpec strict validation、中文 UTF-8/乱码扫描和最小 diff 复核。
- [x] 19.6 在真实浏览器和实际端点中验证至少两个平台生成内容不同、字段结构一致、无品牌、无审核门控，并处理所有确认问题。

## 20. 套图数量刷新与编辑入口收敛

- [x] 20.1 更新 Creation 规格和失败测试，固定数量变化后立即刷新、首次生成等待最新计划、例行内部 warning 不展示，以及逐图高级编辑和套图提示词入口不存在。
- [x] 20.2 将数量 change 事件接到可跟踪的最新预览 Promise，并让生成提交等待该 Promise 后再冻结队列请求。
- [x] 20.3 过滤 `missing-evidence-slot-omitted`、`missing-evidence-slot-replaced`、`image-count-extension-custom` 并对其他可见计划 warning 去重，保留未知平台、能力不足和阻断错误。
- [x] 20.4 移除逐图高级编辑 DOM、渲染、事件、样式和辅助模块；移除结果卡片提示词微调层，并停止前端提交 `planOverrides` 与 `promptOverride`。
- [x] 20.5 运行定向测试、完整测试、Pages build、public/lib 同步检查、OpenSpec strict validation、中文 UTF-8/乱码扫描和真实 HTTP 静态资产检查；应用内浏览器因 URL 安全策略拒绝本地地址，已记录为环境限制且未使用其他浏览器或 CDP 绕过。

## 22. 显式参数冻结与平台数量上限

- [x] 22.1 增加失败测试，覆盖小红书显式 English、比例和分辨率在浏览器预览、本地/Worker 计划、冻结队列及逐图参数中不被平台默认值覆盖。
- [x] 22.2 增加失败测试，覆盖通用电商保留 18 个原生槽位、其余 18 个命名平台的数量选项上限等于各自规范化槽位数、平台切换时收紧旧值，以及 resolver 不用跨平台或 `custom` 槽位补足命名平台。
- [x] 22.3 实现浏览器套图级参数覆盖同步、预览端点透传、通用电商 18 张默认值、命名平台动态数量选项和共享 resolver 上限，并保持 SKU/重构追加项及历史冻结计划兼容。
- [x] 22.4 运行定向测试、完整测试、Pages build、public/lib 同步检查、OpenSpec strict validation、中文 UTF-8/乱码扫描和最小 diff 复核。

## 21. SKU 开关、全平台尺寸图与平台原生提示词

- [x] 21.1 更新 Creation 规格并增加失败测试，固定 SKU 图开关只改变追加项、刷新期间不回退通用角色、19 个平台都保留尺寸/尺度槽位，以及每张轮播图都携带当前平台 profile 策略。
- [x] 21.2 让 SKU 图开关立即请求同平台新计划，同时保留当前轮播 `effectivePlan` 直到新响应生效；计划待刷新时不渲染通用角色 fallback。
- [x] 21.3 为抖音、TikTok Shop、Shopify 和 Rakuten 补齐尺寸槽位，并让所有平台在缺少精确尺寸证据时仍保留尺寸用途且明确禁止编造数值。
- [x] 21.4 将当前平台 profile 的图库 `promptInstruction` 写入每个轮播项提示词，并验证同一商品在代表性平台得到不同的图片策划提示。
- [x] 21.5 运行定向测试、完整 `npm test`、Pages build、public/lib 同步检查、OpenSpec strict validation、中文 UTF-8/乱码扫描和真实页面关键交互验证。
