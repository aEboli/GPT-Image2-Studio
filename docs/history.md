# Version history

[Back to README](../README.md) · [简体中文](./history.zh-CN.md)

New release notes are maintained in [releases/](./releases/) and [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases). The entries below preserve the previous README history.

### v0.2.116

- Added a current-set label above Creation outputs. It follows the selected queue item and shows the product name with its marketing plan/copy or queue position; drafts and the Logo batch branch stay unlabelled.
- Reworked AI marketing batch estimates, progress, and per-plan timing into compact status indicators with distinct success, warning, and failure states.

### v0.2.106

- Added German alongside English and Chinese for generated Creation listings, including display, individual and full-field copying, character counts, and JSON export. Existing drafts without German remain unchanged until regenerated.
- Increased the AI marketing plan count limit to 50 while retaining the existing per-plan generation and planning-concurrency limits.
- Added a **Severe failures** filter to Creation history for completed plans with at least 10 planned images and fewer than 10 successful outputs. It combines with the existing keyword and date filters.
- Preserved completed reference analysis and generated results when editing planning settings; only unsubmitted plans become stale and are cleared.
- Reduced redundant Creation rendering for large queues by reusing keyed nodes and coalescing progress and log updates; improved viewport image loading and cleanup.

### v0.2.096

- Added batch AI marketing prompts for independent Creation set plans, with up to two plans running concurrently and validated plans sent through the existing queue.
- Added per-plan progress, bounded retries, pause and resume behavior, and continuation that does not enqueue an already accepted plan twice.
- Strengthened marketing quality review for evidence-backed functional visuals, core buying reasons, and duplicate image tasks while retaining valid items during repair.
- Refined commercial CG and product-function visual guidance, and unified reasoning-effort mapping with bounded fallback only when an upstream rejects the parameter.
- Batch controller progress is page-local: after a refresh, already-enqueued sets use the existing queue and records, while unsubmitted plans do not resume automatically.

### v0.2.086

- AI ecommerce planning now builds the complete set of up to 20 image prompts in one planning request, with per-image goals, audiences, evidence, and reference assignments.
- Planning progress is streamed through preparation, response, validation, and completion. The interface shows received work and useful marketing summaries without exposing raw model output.
- Product analysis adds specific audience groups, selling points, pain points, and fact-linked marketing advice. The same frozen prompts and reference bindings carry into generation, saved records, retries, and missing-image repairs.
- Invalid or incomplete plans are rejected before image generation; retries and repairs reuse the accepted plan instead of silently replanning it.

### v0.2.076

- Product analysis now keeps complementary facts from multiple references, distinguishes real conflicts from unverified relationships, and carries evidence into planning, generation, retries, and saved records.
- Ecommerce sets assign distinct, evidence-backed scene and infographic tasks. They avoid repeating the same core action, skip unsupported SKU and measurement images, and revalidate evidence gates on the server.
- Canvas text filters unsupported medical, safety, certification, price, and absolute claims while preserving product-category terms. Image-to-infographic rebuilds map every output claim to readable source content.
- Paired sellable products such as gloves count as one SKU unit per pair. Marketplace IDs without an active automatic profile fall back to the universal 18-slot plan; Listing policies remain separate.

### v0.2.074

- Expanded Prompt Kit to 520 paired, source-attributed YouMind prompts for GPT Image 2.5 and GPT Image 2, with model, category, search, and sort controls.
- Saved API history now restores the model settings for each connection and masks keys in the picker.
- Expanded the interface palette set from eight to twelve and refined generation loading and image review interactions.

### v0.2.073

- Generated images now use descriptive time-prefixed filenames. Set images retain their sequence number, duplicate names receive collision suffixes, and gallery downloads use the saved filename.
- Added the Obsidian palette as the default while retaining Indigo and the six traditional-colour palettes.
- Creation queue entries show the product name alongside the queue position; closed configuration controls are inert to keyboard interaction.

### v0.2.072

- Replaced the prompt enhancer's default with an editable English clarity instruction that prioritizes the original prompt and references, preserves intentional style choices, and treats `8K` as a visual-quality goal rather than a resolution guarantee.
- Added a clickable origin for the selected image-generation service to the current-call summary; it omits API paths and credentials.
- Simplified generation-log rows, showing concise output filenames and retaining task endpoint details and failure messages.
- Removed the Product Image Replication Workbench and its dedicated analysis contract. Existing generated assets and historical release notes remain intact; the old `#product-agent` route falls back to Prompt-to-image.

### v0.2.071

- Reworked the Prompt Kit library to stay inside the image preview surface, with compact list cards and container-based layouts for narrow panels.
- Generation logs now keep the endpoint snapshot belonging to each task, including failures and history viewed after switching API routes; long relay URLs can be inspected with the keyboard.
- Expanded and reorganized the desktop API configuration drawer, and added full-value hints for long endpoint addresses.

### v0.2.070

- Improved Prompt Kit card summaries with a three-line preview of each prompt.
- Corrected the recorded outbound IP source. Lookup uses the configured upstream HTTP transport, sends no API credentials or generation content, and reports "Not recorded" when unavailable.

### v0.2.069

- Updated the product image collector extension to `1.1.34`, including bounded concurrent downloads and clearer partial-failure feedback.
- Improved contrast and surface hierarchy across the dark base theme and six traditional palettes.

### v0.2.068

- Strengthened image-to-prompt style locking with prioritized source-specific visual anchors and clear subject/texture intent, plus `4K/8K` visual-quality wording that does not promise actual output dimensions.
- Added image-grounded constraints against unintended blur, smudging, artifacts, and unrelated clutter while preserving intentional bokeh, soft focus, grain, and motion.

### v0.2.067

- Refined Prompt Kit cards: removed the card-level copy-to-personal-template action, showed only complete text in list view, and changed image view to masonry with full labels below each image and a prominent Apply action. Copy and Apply remain available in the detail lightbox.

### v0.2.066

- API history now restores the last saved model for each provider and channel, including the Route image-tool model; unsaved model edits do not replace the saved history.
- Current generation details and saved image records show the request IP. Older records without an IP are labeled "Not recorded".
- Fixed Vercel Serverless startup so the deployed function ignores the platform's injected `HOST` binding and exports its request handler without starting a local HTTP listener.

### v0.2.056

- Added explicit style-lock vocabulary to image-to-prompt results so a second generation can preserve the source medium, aesthetic, palette, lighting, material response, depth, and finishing cues.
- Added image-specific style-drift constraints to the structured `avoid` field and clarified the Prompt Agent entry point in the interface.
- Hardened provider credential routing, concurrent record/history persistence, running task retention, PPT record paths, extension page injection, and Listing response timeouts.
- Persisted desktop API configuration across application restarts and dynamically assigned local ports through restricted sandboxed IPC.

### v0.2.046

- Simplified reasoning selectors to show only the effort name and concrete GPT resolution selectors to show only pixel dimensions; submitted values and provider-specific Gemini/Grok tiers are unchanged.
- Reworked the quick-start entry with a runtime choice table and clarified how selector labels relate to provider request values.

### v0.2.045

- Reworked the universal ecommerce set so the former overlapping specification, craft, and material slots become three distinct scene-fit roles. Scene facts are distributed across different settings and shots, while platform-native profiles keep their own specification roles.
- Added product-grounded visual divergence: distinct visual formats and casts, bounded supporting-reference reuse, new scene references for non-blueprint roles, and usable carry/pack/store directions for products that cannot be worn.
- Simplified ordinary Creation prompts by removing internal planning labels, merging subject locks into one product-fidelity instruction, and translating Chinese prompt segments at generation time for non-Chinese target languages. Translation failures keep generation running and surface a warning.
- Added saved generation detail inspection for Creation results, including the actual prompt, ratio, size, quality, transparency, route switches, models, reference images, endpoint, and duration. Historical gaps remain explicitly unrecorded.
- Updated ratio metadata to canonical values, added favicon and web-manifest routes, and changed the default text/vision model to `gpt-6-luna` while preserving existing non-empty settings.

### v0.2.044

- Route mode now leaves `tools[].model` out of image-generation requests by default, which lets compatible relays choose the image-tool model without rejecting an extra field.
- Added the **发送 tools[].model** switch to opt into sending the selected allowlisted image-tool model; the setting is saved with route configuration, browser-private requests, and queued jobs, while direct image routes keep their existing explicit model behavior.
- Normalized missing or legacy `includeImageToolModel` values to off across local config, browser storage, request payloads, server defaults, and the public browser module mirror.
- Updated the runtime specification, archived change records, English and Simplified Chinese README guidance, and regression coverage for default, disabled, enabled, persistence, and request-body behavior.

### v0.2.043

- Added the YouMind GPT Image 2 Prompt Kit snapshot as a local, source-attributed library with scenario, visual-style, and subject taxonomy, paired previews, search, list/image browsing, lightbox review, apply, and personal-template actions.
- Added the Product Image Replication Workbench for up to 15 mother images, evidence-backed product facts and audience strategy, a bounded workspace-by-channel-by-direction task board, English prompts with Simplified Chinese counterparts, and per-task or batch generation.
- Added a Route-mode image tool model selector with an explicit enable/disable switch. Queued jobs freeze the effective tool model and quality settings, while loading shells, filmstrips, retries, recovery polling, and partial-preview provenance keep long generations inspectable.
- Added COS cosplay reference assets for Portrait Mode, merged Creation product description, selling-point, and dimension inputs without dropping historical facts, and refreshed the Windows PowerShell 7.4+ launcher and port display.
- Synced browser modules and release contracts, including the new local prompt assets, favicon, OpenSpec changes, and regression coverage for the updated workbench behavior.

### v0.2.033

- Added the Product Image Replication Workbench. Upload up to 15 mother images, add an optional goal, and run an evidence-backed product-group analysis that keeps uncertain claims in a reviewable risk list.
- Added a routed task board that combines compatible workspaces, channels, and content directions. Every task keeps its source references, aspect ratio, English generation prompt, Simplified Chinese counterpart, and per-task or batch generate/download controls.
- Added the product-image-agent structured JSON contract and default text/vision configuration path, while continuing to use the existing image-generation endpoint for routed outputs.
- Added deterministic local Prompt Kit preview assets and corrected preview filename handling; image editing now normalizes English target clauses without duplicating user requirements.
- Compressed ordinary Creation and SKU prompt control text while keeping product facts, reference roles, platform constraints, subject identity, surface content, and target-language boundaries.

### v0.2.020

- Added the categorized Prompt Kit library: six categories, 24 subcategories, ten prompts per subcategory, search, list/image views, adjustable list typography, lightbox prompt review, direct apply, and copy-to-personal-template actions. The library's profile/avatar previews are bundled locally from the requested YouMind collection with attribution; runtime browsing does not depend on the third-party site.
- Replaced the ten legacy daily-scene Prompt Kit defaults with practical identity-photo, business-avatar, ecommerce, portrait, home, travel, and marketing templates. Existing custom templates and Prompt Agent history remain intact during the versioned default migration.
- Simplified Creation and infographic prompt construction into bounded, positive instructions so generated requests stay focused instead of repeating long negative constraint lists.
- Standardized project-owned Windows scripts on PowerShell 7.4+, added explicit runtime and failure checks, and kept pure Node/Electron and stop-service CMD entry points independent of PowerShell.
- Added major/minor/feature/patch release commands with a three-digit patch policy and synchronized README, Windows package, lockfile, workbench, and release-note version facts.

### v0.2.19

- Added Grok image generation and reference-image editing with independent xAI connection settings, five-reference validation, and provider-specific request parameters.
- Grok quality is limited to `low` / `medium` (default `medium`); GPT reasoning never leaks into Grok image calls, task snapshots, or saved image metadata. API histories and quality choices are isolated by route.
- Removed automatic quality and resolution options throughout the workbench. Existing values normalize to concrete defaults before display, queueing, storage, and upstream requests.
- Unified the configuration sections as GPT / Gemini / Grok / Palette, with Route / Direct nested under GPT. Refined spacing, aligned fields and the Gemini endpoint, and shortened controls and log labels with full-value tooltips.

- Creation, Portrait, Article Illustration, and PPT now expose independent reasoning-effort and quality controls. Plans, queued operations, repairs, missing-slide completion, and slide edits retain the selected values, with quality clamped to the active image model.
- Prompt-to-image can request a transparent background on the Route and Direct image routes. The choice is captured per job, forces PNG output, and is recorded in saved metadata; the Gemini/model-protocol route keeps the control hidden.
- New Creation plans use a fixed one-subject SKU count while the SKU generation rule remains editable.
- The Palette section now shows seven concise palette swatches in a four-column grid. Custom colour roles and floral ornaments were removed, and the default palette is `靛蓝` (Indigo).

### v0.2.18

- The configuration drawer is now four mutually exclusive sections: **路由模式** / **直连模式** / **Gemini** / **主题**. Only the selected section's fields render, and the hidden sections' controls — Fetch Models included — are disabled rather than merely invisible, so a hidden channel can no longer be edited or queried by mistake.
- The palette is no longer a popover opened from a trigger after the Gemini option. It is a standalone card inside **主题**, which carries no connection fields at all. Switching to **主题** and back leaves the active call channel unchanged.
- Palette options stay on one horizontal row and scroll sideways in a narrow drawer, instead of reflowing into a 4-column then 2-column grid.
- The default palette is `经典靛蓝` (Classic indigo) and restores the v0.2.6 indigo tokens (`#6f7cff` / `#12192f` / `#879cff`) across Studio and the embedded Temu workbench. The other six palettes keep their traditional-colour values, and every stored palette ID is unchanged, so an existing selection still resolves.
- Visible palette names are shorter (`青花甜白` → `青花`, `江南竹影` → `竹影`, `雨过天青` → `天青`, `故宫朱墙` → `朱墙`, `漆器朱漆` → `朱漆`, `敦煌石青` → `敦煌`), and the two long section labels were shortened to `直连模式` and `Gemini`.
- Corrected in the docs: the platform-profile table is version `2026-07-18.2`, and both READMEs describe the four-section drawer instead of the retired palette trigger.

### v0.2.17

- The configuration drawer is compact: long explanations are hover/focus help markers, and the configuration form and generation log scroll independently so the log stays visible.
- The channel row is now **Route mode / Direct-call mode / Gemini model / Palette**. The Palette trigger sits immediately after Gemini and opens the full palette, custom-colour, and floral-accent controls.
- Added seven allowlisted Chinese traditional-colour palettes, three custom colour roles for buttons/focus, surfaces, and floral details, and local persistence mirrored to the embedded Temu workbench.
- Added four low-interference decorative motifs: plum branch, orchid sprig, bamboo nodes, and peony medallion. They cannot intercept interaction and are hidden from assistive technology.
- Added OpenSpec coverage and regression tests for the palette allowlist, colour validation, tooltip affordances, independent logs, theme-message synchronization, and the Gemini-adjacent palette trigger.

### v0.2.16

- The dark theme now sits on pure black `#000000`. Surfaces mix in only 6–12% of a traditional color (山梗紫, 秋波蓝, 粉绿, 朱红) so the page still reads as black while panels, inputs, and the preview stage stay distinguishable. Every hardcoded blue-black value is gone from the stylesheet, and a test pins that.
- Primary actions, the selected nav item, and general interaction are 魏紫 `#7e1671` (hover 青莲 `#8b2671`, active 绀紫 `#461629`) across all five view families in dark mode. `select` option popups follow the theme instead of a hardcoded light pair. The light theme is unchanged.
- The prompt-template button is a lucide sparkles SVG instead of a `⭐` emoji, so it follows `currentColor` and matches the stroke weight of the other parameter-row icons.
- Repository cleanup: two unreferenced root screenshots, a scratch design-QA log, and `docs/superpowers/` (superseded by `openspec/`) were removed.

### v0.2.15

- Route mode's image tool model is selectable: `gpt-image-2` (default), `gpt-image-2.5-sunburst`, and `gpt-image-2.5-flare`. It used to be hardcoded, and the record entries reported a model that was never actually used.
- Output quality is selectable and clamped to what the model supports: `low`, `medium`, and `high`, plus `xhigh` and `max` on the 2.5 variants. Grok exposes only `low` and `medium`; legacy automatic values are migrated to a concrete default and are never sent upstream. Quality is submitted per request instead of read from the config default only.
- Endpoints and keys you have used are kept in a reusable list in browser local storage, so switching providers no longer overwrites the previous key. Selecting an entry restores address, suffix, and key as one set.
- The palette was retuned within the Chinese traditional color library: a lighter night ground with three surface steps, a paper-toned day theme with real card boundaries, desaturated accents, and control outlines lifted to the WCAG 3:1 floor.
- The product image collector extension moved to `1.1.33`; the collector, panel, and launcher now stay in one isolated world, so reads no longer time out waiting on background messaging.

### v0.2.14

- The Gemini channel no longer turns an unsupported ratio into a square. It accepts 10 of the 15 ratios; the other five now resolve to the closest supported ratio in the same orientation (`2:1` → `16:9`, `3:1` → `21:9`, and `1:2`, `9:21`, `1:3` → `9:16`) instead of collapsing to `1:1`. Because this channel sends a size tier rather than pixels, the ratio the user picked is now the fallback source for that match.
- `release:patch` and `check:release` maintain the derived version facts as well: both README badges, the installer and portable filenames quoted in prose, the release-note links, and the `v<version>` GitHub Release references. Previously only one anchored fact per file was checked, so a bump could pass while the README still advertised the previous version's download.

### v0.2.13

- Article illustration planning now produces a dense consecutive-keyframe storyboard. The planner counts the source's natural paragraph clusters and asks for at least one finished frame per paragraph or distinct visual beat, plus extra consecutive frames whenever action, emotion, dialogue, camera angle, or location changes. No maximum illustration count is applied, and `recommendedImageCount` reports the frames actually produced.
- Article illustration generation fans out the whole planned set through the same bounded-concurrency loop the other set modes use, honoring the configured generation concurrency and start delay instead of walking one item at a time. Pending reference cards in a run finish before storyboard items start, so later frames can use them.
- A failed direct-route image request now names the endpoint it actually used and unwraps Node's bare `fetch failed` into the underlying reason (`ENOTFOUND`, `ECONNREFUSED`, a TLS error, or `UND_ERR_CONNECT_TIMEOUT`). This route rewrites `images/generations` to `images/edits` once references are attached, so the failing URL is not always the configured one.
- Both READMEs gained a step-by-step [Beginner API setup](./configuration.md#beginner-api-setup) walkthrough.
