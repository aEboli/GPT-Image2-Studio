# Creation SKU Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append SKU images after Creation Mode carousel images by grouping uploaded white-background product references into distinct sellable subjects.

**Architecture:** Keep the existing 4/6/8/10/12 carousel roles unchanged. Add SKU-specific planner utilities that turn applied reference analysis into extra `sku` plan items, then include those extra items in local and Cloudflare creation generation without counting them against the carousel limit.

**Tech Stack:** Node.js ESM, `node:test`, plain browser JavaScript, existing `/api/creation/*` and Worker parity.

---

### Task 1: Planner SKU Items

**Files:**
- Modify: `lib/creation-planner.mjs`
- Test: `test/creation-planner.test.mjs`

- [x] Write failing tests that prove three different product-subject references add three `sku` items after twelve carousel roles.
- [x] Write failing tests that prove a package/accessory reference does not create an extra SKU item.
- [x] Implement SKU subject grouping from `referenceImageRoles`.
- [x] Run `node --test test/creation-planner.test.mjs`.

### Task 2: Reference Analysis Contract

**Files:**
- Modify: `lib/prompt-agent.mjs`
- Test: `test/prompt-agent.test.mjs`

- [x] Write failing tests for `sku_subjects` in the Creation reference-analysis schema.
- [x] Update the analysis instruction and JSON schema so the model returns distinct SKU product subjects only.
- [x] Normalize `sku_subjects` from the analysis result.
- [x] Run `node --test test/prompt-agent.test.mjs`.

### Task 3: Generation And Records

**Files:**
- Modify: `server.mjs`
- Modify: `cloudflare-pages-worker.mjs`
- Test: `test/creation-server-static.test.mjs`

- [x] Write failing static tests that local and Worker generation pass SKU subjects into `buildCreationPlan`.
- [x] Ensure SKU items are generated, saved, and recorded like Creation images with role `sku`.
- [x] Run `node --test test/creation-server-static.test.mjs`.

### Task 4: Browser Payload

**Files:**
- Modify: `public/app.js`
- Test: `test/studio-preview-layout.test.mjs`

- [x] Write failing layout/static tests that applied Creation reference analysis sends `skuSubjects`.
- [x] Add browser helpers to preserve applied SKU subject groups from smart analysis.
- [x] Include the SKU subject payload in plan preview and generation.
- [x] Run `node --test test/studio-preview-layout.test.mjs`.

### Task 5: Verification

**Files:**
- No production files.

- [x] Run targeted tests for planner, prompt-agent, server static, and preview layout.
- [x] Run `cmd /c npm test`.
- [x] Run `cmd /c npm run sync:public-lib -- --check` if shared browser modules are touched.
- [x] Dispatch a read-only validation agent to review the final diff against the user request.
