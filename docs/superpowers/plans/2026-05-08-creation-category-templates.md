# Creation Category Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add searchable fourth-level ecommerce category templates to Creation Mode and let smart reference analysis switch to a matched template.

**Architecture:** Use one shared category-template module under `lib/` as the source of truth for backend planning and browser selection. Keep the existing `industryTemplate` request field for compatibility, but allow category-coded values such as `category:C06-001-001-001` and persist category path metadata in creation manifests.

**Tech Stack:** Node ESM modules, browser ESM imports from `/lib/`, native `node --test`, existing Creation Mode HTML/CSS/JS.

---

### Task 1: Category Template Source

**Files:**
- Create: `lib/creation-category-templates.mjs`
- Test: `test/creation-category-templates.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that import the new module, assert it exposes 1577 fourth-level category templates, resolves `category:C06-001-001-001` to `智能手机`, searches by `智能手机`, and avoids auto-matching duplicate fourth-level names without parent context.

- [ ] **Step 2: Run failing tests**

Run: `node --test ./test/creation-category-templates.test.mjs`

Expected: FAIL because `lib/creation-category-templates.mjs` does not exist yet.

- [ ] **Step 3: Generate the shared module**

Read `C:\Users\AEboli\Downloads\电商四级类目分级结构表.xlsx` and generate raw category records with code, level names, orders, and path. Export base templates, category templates, normalization, search, and text-match helpers.

- [ ] **Step 4: Run passing tests**

Run: `node --test ./test/creation-category-templates.test.mjs`

Expected: PASS.

### Task 2: Planner Integration

**Files:**
- Modify: `lib/creation-planner.mjs`
- Modify: `test/creation-planner.test.mjs`

- [ ] **Step 1: Write failing planner tests**

Add tests proving `buildCreationPlan()` accepts a category-coded `industryTemplate`, returns the fourth-level label/path metadata, and injects category-specific prompt guidance into every generated item.

- [ ] **Step 2: Run failing planner tests**

Run: `node --test ./test/creation-planner.test.mjs`

Expected: FAIL because the planner still only knows the old hard-coded industry templates.

- [ ] **Step 3: Integrate shared helpers**

Import template normalization from `lib/creation-category-templates.mjs`, keep existing public planner exports, and use template role presets plus prompt instructions from the shared module.

- [ ] **Step 4: Run passing planner tests**

Run: `node --test ./test/creation-planner.test.mjs`

Expected: PASS.

### Task 3: Browser Selection And Smart Switching

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `test/studio-preview-layout.test.mjs`

- [ ] **Step 1: Write failing layout/static tests**

Assert Creation Mode has a category template search input, imports `/lib/creation-category-templates.mjs`, renders filtered industry template options, submits category-coded `industryTemplate` values, and switches templates from Creation reference-analysis category hints.

- [ ] **Step 2: Run failing layout/static tests**

Run: `node --test ./test/studio-preview-layout.test.mjs`

Expected: FAIL on missing search input/import/switch helpers.

- [ ] **Step 3: Implement browser behavior**

Render industry/category options from the shared module, filter by search text, keep selected options visible, update role presets on selection, and apply a matched category template after smart reference analysis.

- [ ] **Step 4: Run passing layout/static tests**

Run: `node --test ./test/studio-preview-layout.test.mjs`

Expected: PASS.

### Task 4: Reference Analysis Schema And Persistence

**Files:**
- Modify: `lib/prompt-agent.mjs`
- Modify: `lib/creation-store.mjs`
- Modify: `server.mjs`
- Modify: `cloudflare-pages-worker.mjs`
- Modify: `test/prompt-agent.test.mjs`
- Modify: `test/creation-store.test.mjs`
- Modify: `test/creation-server-static.test.mjs`

- [ ] **Step 1: Write failing tests**

Assert Creation reference analysis asks for a category hint, normalization preserves category hints, manifests preserve template path metadata, and local/worker routes carry the metadata from plans to records.

- [ ] **Step 2: Run failing tests**

Run: `node --test ./test/prompt-agent.test.mjs ./test/creation-store.test.mjs ./test/creation-server-static.test.mjs`

Expected: FAIL on missing category hint/path handling.

- [ ] **Step 3: Implement metadata plumbing**

Add `category_hint` / `category_path` to reference-analysis structured output, normalize those fields, add `industryTemplatePath` to creation plans/manifests, and keep existing base-template records compatible.

- [ ] **Step 4: Run passing tests**

Run: `node --test ./test/prompt-agent.test.mjs ./test/creation-store.test.mjs ./test/creation-server-static.test.mjs`

Expected: PASS.

### Task 5: Docs And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `openspec/changes/add-creation-mode/specs/creation-mode/spec.md`
- Modify: `openspec/changes/add-creation-mode/tasks.md`

- [ ] **Step 1: Update docs**

Document searchable fourth-level category templates, smart switching, duplicate-name handling, and category-path persistence.

- [ ] **Step 2: Verify**

Run: `node --test ./test/creation-category-templates.test.mjs ./test/creation-planner.test.mjs ./test/prompt-agent.test.mjs ./test/creation-store.test.mjs ./test/creation-server-static.test.mjs ./test/studio-preview-layout.test.mjs`

Run: `npm test`

Run: `npm run build:pages`

Expected: all commands exit 0. If a pre-existing dirty-worktree failure appears, report it with the failing test name and relevant output.

### Self-Review

- Spec coverage: the plan covers shared data, planner prompts, browser search, smart switching, persistence, docs, and verification.
- Placeholder scan: no implementation step depends on an unspecified file or unnamed test command.
- Type consistency: category-coded template values use `category:<类目编码>` across module, planner, browser, request, and manifest.
