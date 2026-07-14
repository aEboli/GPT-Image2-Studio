# Creation Queue Panel Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent asynchronous updates from one creation queue from replacing the panel and action target of another selected queue.

**Architecture:** Keep each stream update scoped to its own `queueJob.set`. Resolve whether that update may synchronize `state.creation.currentSet` from `selectedQueueId`, falling back to `activeQueueId` only when no queue is selected. When the user changes selection, synchronize `currentSet` only if it is already queue-backed, preserving the existing local-draft preview behavior.

**Tech Stack:** Browser ES modules, Node.js built-in test runner, DOM-free queue state helpers.

## Global Constraints

- Limit changes to creation queue state/display behavior and its regression tests.
- Preserve local draft state when a queued suite is selected for preview.
- Do not change queue scheduling, concurrency limits, or stream payload handling.

---

### Task 1: Isolate selected queue panel state

**Files:**
- Modify: `lib/creation-suite-queue.mjs`
- Modify: `public/app.js`
- Test: `test/creation-suite-queue.test.mjs`

**Interfaces:**
- Produces: a pure queue-display predicate that accepts creation state and a queue job, returning whether that job may synchronize `currentSet`.
- Consumes: existing `selectedQueueId`, `activeQueueId`, `queue`, `currentSet`, and `queueJob.set` state.

- [x] **Step 1: Write failing regression tests**

Add tests covering these exact cases: with A active and B selected, A cannot synchronize the displayed current set while B can; with no explicit selection, the active job can synchronize; selecting B switches a queue-backed `currentSet` from A to B; selecting B preserves a local draft `currentSet`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test test/creation-suite-queue.test.mjs`

Expected: at least one new assertion fails because the current implementation also treats the stale `currentSet.setId` as a display match and does not synchronize queue-backed selection.

- [x] **Step 3: Implement the minimal state fix**

In `lib/creation-suite-queue.mjs`, add the display predicate and update `selectCreationQueueJob` so it replaces `currentSet` only when the existing `currentSet.setId` belongs to a queued job. In `public/app.js`, replace the local `shouldShowCreationQueueJob` OR condition with the pure predicate. Continue writing all stream events to their own `queueJob.set` and `state.creation.sets`.

- [x] **Step 4: Run focused and related tests**

Run: `node --test test/creation-suite-queue.test.mjs test/creation-store.test.mjs test/creation-repair.test.mjs`

Expected: all tests pass with zero failures.

- [x] **Step 5: Run the project test suite**

Run: `npm test`

Expected: all tests pass with zero failures.
