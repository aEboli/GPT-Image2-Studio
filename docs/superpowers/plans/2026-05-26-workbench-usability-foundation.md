# Workbench Usability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the first batch of high-impact workbench usability and accessibility foundations without restructuring product workflows.

**Architecture:** Keep changes small and local to existing static UI, browser shell helpers, and test guardrails. Do not change generation payloads, records, image paths, or business prompts.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js `node:test`, ESM modules, existing `sync-public-lib` script.

---

### Task 1: Interactive Hidden-State Semantics

**Files:**
- Modify: `test/studio-preview-layout.test.mjs`
- Modify: `public/index.html`
- Modify: `public/app.js`

- [x] **Step 1: Write the failing test**

Add assertions that `.topbar-ghost-actions` and `#galleryScrollbar` are not hidden from the accessibility tree while containing buttons, and that the Gallery scrollbar has an accessible label.

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c node --test test/studio-preview-layout.test.mjs`

Expected: FAIL on the old `aria-hidden="true"` markup.

- [x] **Step 3: Write minimal implementation**

Remove `aria-hidden="true"` from `.topbar-ghost-actions`; replace Gallery scrollbar hidden state with `aria-label="瀑布画廊滚动控制"` and update `syncGalleryScrollUi()` to set `aria-disabled` and button `disabled` state.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c node --test test/studio-preview-layout.test.mjs`

Expected: PASS.

### Task 2: Error Announcement

**Files:**
- Modify: `test/studio-preview-layout.test.mjs`
- Modify: `public/index.html`

- [x] **Step 1: Write the failing test**

Update the existing error surface test to require:

```html
<div class="error-banner hidden" id="errorBanner" role="alert" aria-live="assertive"></div>
```

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c node --test test/studio-preview-layout.test.mjs`

Expected: FAIL because the current banner has no announcement attributes.

- [x] **Step 3: Write minimal implementation**

Add `role="alert"` and `aria-live="assertive"` to `#errorBanner`.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c node --test test/studio-preview-layout.test.mjs`

Expected: PASS.

### Task 3: Minimal Focus Restore

**Files:**
- Modify: `test/studio-preview-layout.test.mjs`
- Modify: `public/app.js`

- [x] **Step 1: Write the failing test**

Add source-level assertions for `captureOverlayTrigger`, `restoreOverlayTriggerFocus`, and their use in `setDrawerOpen`, `setPromptAgentOpen`, `openLightbox`, `closeLightbox`.

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c node --test test/studio-preview-layout.test.mjs`

Expected: FAIL because the helpers do not exist.

- [x] **Step 3: Write minimal implementation**

Add a small `overlayFocusTriggers` map, capture the active element before opening each overlay, focus the close button after opening, and restore focus on close.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c node --test test/studio-preview-layout.test.mjs`

Expected: PASS.

### Task 4: Public Lib Sync Coverage

**Files:**
- Modify: `scripts/sync-public-lib.mjs`
- Modify: `test/public-lib-sync.test.mjs`

- [x] **Step 1: Write the failing test**

Import `PUBLIC_LIB_SYNC_TARGETS` from the script and assert every mapped `lib` and `public/lib` file has identical content.

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c node --test test/public-lib-sync.test.mjs`

Expected: FAIL because the script does not export the target list yet.

- [x] **Step 3: Write minimal implementation**

Export `PUBLIC_LIB_SYNC_TARGETS` and preserve CLI execution behavior by guarding the script entrypoint with an import URL check.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c node --test test/public-lib-sync.test.mjs`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- No new production files.

- [x] **Step 1: Run targeted tests**

Run:

```powershell
cmd /c node --test test/studio-preview-layout.test.mjs test/public-lib-sync.test.mjs
```

Expected: PASS.

- [x] **Step 2: Run sync check**

Run:

```powershell
cmd /c npm run sync:public-lib -- --check
```

Expected: `Checked 44 public/lib modules`.

- [x] **Step 3: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors and exit code 0. Git may still report existing LF-to-CRLF warnings in this Windows working tree.

- [x] **Step 4: Run full test suite**

Run:

```powershell
cmd /c npm test
```

Expected: PASS.

### Review Follow-Up

- [x] Prevent Prompt Agent's mapped-to-Studio flow from restoring focus back to the old overlay trigger.
- [x] Make the error live region visible before updating its message text.
- [x] Sync this implementation plan's checkbox status with the completed OpenSpec task list.
