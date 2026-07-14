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
- [x] 3.3 Integrate the resolver into `buildCreationPlan`, SKU planning, infographic rebuild planning, and plan overrides while preserving existing role IDs, reference coverage, content allocation, Logo behavior, and prompt-edit compatibility.
- [x] 3.4 Return strategy metadata, set overrides, validation results, and effective per-item generation parameters from local and Cloudflare plan-preview endpoints.

## 4. Browser Automatic Plan And Manual Editing

- [x] 4.1 Add failing browser/static tests for the automatic-plan summary with separate carousel/SKU/rebuild/total counts, automatic and overridden field states, ordered image slots, enable/disable, add/remove, move controls, per-item image type, ratio, resolution, language, composition, text density, scene policy, Logo policy, and prompt editing.
- [x] 4.2 Implement canonical policy-module loading and browser state for platform profiles, effective plans, set overrides, item overrides, validation warnings, and the Restore current platform recommendation action.
- [x] 4.3 Update the compact Creation parameter UI and image-type area to show the platform summary by default and expose ordered per-item advanced controls only on demand.
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

## 8. Amazon Listing Boundary

- [x] 8.1 Add failing Listing UI and endpoint tests for Amazon eligibility, non-Amazon disabled controls and validation, preserved historical drafts, and legacy manifests without platform metadata.
- [x] 8.2 Restrict new Listing generation and rewrite actions to Amazon or eligible legacy sets while leaving review, copy, and export of saved Amazon drafts available on non-Amazon records.

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
