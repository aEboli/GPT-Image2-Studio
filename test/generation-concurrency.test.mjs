import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createConfigStore } from "../lib/config-store.mjs";
import {
  appendBrowserConfigToFormData,
  getBrowserPrivateConfigRequestPayload,
  normalizeBrowserPrivateConfig,
  readBrowserPrivateConfig,
  saveBrowserPrivateConfig,
  toPublicBrowserConfig,
} from "../lib/browser-config.mjs";
import {
  GENERATION_CONCURRENCY_FIELD,
  normalizeGenerationConcurrency,
  resolveGenerationConcurrency,
  resolveGenerationConcurrencyForLimit,
} from "../lib/generation-concurrency.mjs";
import { runWithConcurrency } from "../lib/limited-concurrency.mjs";
import { createSessionTaskSlotLimiter } from "../lib/generation-task-slots.mjs";
import {
  DEFAULT_GENERATION_CONCURRENCY,
  MAX_CREATION_PARALLEL_TASKS,
  MAX_GENERATION_CONCURRENCY,
  MIN_GENERATION_CONCURRENCY,
  MAX_PARALLEL_TASKS_PER_SESSION,
} from "../lib/studio-constants.mjs";

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

test("generation concurrency defaults to 20 and clamps to its bounds", () => {
  assert.equal(DEFAULT_GENERATION_CONCURRENCY, 20);
  assert.equal(MIN_GENERATION_CONCURRENCY, 1);
  assert.equal(MAX_GENERATION_CONCURRENCY, 60);

  assert.equal(normalizeGenerationConcurrency(undefined), 20);
  assert.equal(normalizeGenerationConcurrency(null), 20);
  assert.equal(normalizeGenerationConcurrency(""), 20);
  assert.equal(normalizeGenerationConcurrency("   "), 20);
  assert.equal(normalizeGenerationConcurrency("not-a-number"), 20);

  // Zero and negatives clamp up to the minimum instead of disabling the fan-out.
  assert.equal(normalizeGenerationConcurrency(0), 1);
  assert.equal(normalizeGenerationConcurrency(-5), 1);
  assert.equal(normalizeGenerationConcurrency(1), 1);
  assert.equal(normalizeGenerationConcurrency(999), 60);
  assert.equal(normalizeGenerationConcurrency(60), 60);
  assert.equal(normalizeGenerationConcurrency(30), 30);
  assert.equal(normalizeGenerationConcurrency("3.4"), 3);
  assert.equal(normalizeGenerationConcurrency("3.6"), 4);
  assert.equal(normalizeGenerationConcurrency("8"), 8);
});

test("generation concurrency resolves the request value over the saved default", () => {
  const savedConfig = { defaults: { [GENERATION_CONCURRENCY_FIELD]: 6 } };

  assert.equal(resolveGenerationConcurrency({ [GENERATION_CONCURRENCY_FIELD]: "12" }, savedConfig), 12);
  assert.equal(resolveGenerationConcurrency({}, savedConfig), 6);
  assert.equal(resolveGenerationConcurrency({ [GENERATION_CONCURRENCY_FIELD]: "" }, savedConfig), 6);
  assert.equal(resolveGenerationConcurrency({}, {}), 20);

  const formData = new FormData();
  formData.set(GENERATION_CONCURRENCY_FIELD, "4");
  assert.equal(resolveGenerationConcurrency(formData, savedConfig), 4);
});

test("the configured concurrency is one uniform knob with no per-path ceiling", () => {
  // Nothing configured anywhere falls back to the default, which equals the
  // creation limit every fan-out used before this became configurable.
  assert.equal(resolveGenerationConcurrencyForLimit({}, {}), DEFAULT_GENERATION_CONCURRENCY);

  // A configured value is authoritative in BOTH directions. It must not be
  // silently clamped to a per-path limit: a UI showing 30 that quietly runs 15
  // on one panel is exactly the confusion this control has to avoid.
  assert.equal(resolveGenerationConcurrencyForLimit({ [GENERATION_CONCURRENCY_FIELD]: 3 }, {}), 3);
  assert.equal(resolveGenerationConcurrencyForLimit({ [GENERATION_CONCURRENCY_FIELD]: 30 }, {}), 30);
  assert.equal(resolveGenerationConcurrencyForLimit({ [GENERATION_CONCURRENCY_FIELD]: 60 }, {}), 60);

  // The old per-path constants are no longer ceilings; a value above them wins.
  assert.ok(30 > MAX_PARALLEL_TASKS_PER_SESSION);
  assert.ok(30 > MAX_CREATION_PARALLEL_TASKS);

  const formData = new FormData();
  formData.set(GENERATION_CONCURRENCY_FIELD, "45");
  assert.equal(resolveGenerationConcurrencyForLimit(formData, {}), 45);

  // A saved default still applies when the request omits the field.
  assert.equal(
    resolveGenerationConcurrencyForLimit({}, { defaults: { [GENERATION_CONCURRENCY_FIELD]: 8 } }),
    8,
  );
});

test("the session task slot limiter accepts a per-request ceiling", async () => {
  // Without this override a fan-out wider than the scope's startup limit would
  // leave its extra workers spinning in the slot-wait loop instead of running.
  const limiter = createSessionTaskSlotLimiter({ maxParallelTasks: () => 15, retryDelayMs: 1 });

  for (let i = 0; i < 15; i += 1) {
    assert.equal(limiter.claimSessionTaskSlot("s1", `task-${i}`, "portrait"), true);
  }
  // The scope default is exhausted at 15.
  assert.equal(limiter.claimSessionTaskSlot("s1", "task-15", "portrait"), false);
  // A raised per-request ceiling admits more.
  assert.equal(
    limiter.claimSessionTaskSlot("s1", "task-15", "portrait", { maxParallelTasks: 30 }),
    true,
  );
  assert.equal(limiter.getActiveTaskCount("s1", "portrait"), 16);

  // A lower override really shrinks the shared bucket. Taking the larger of the
  // two would let two overlapping fan-outs in one scope reach the old default.
  const shrink = createSessionTaskSlotLimiter({ maxParallelTasks: () => 15, retryDelayMs: 1 });
  for (let i = 0; i < 3; i += 1) {
    assert.equal(shrink.claimSessionTaskSlot("s2", `t-${i}`, "portrait", { maxParallelTasks: 3 }), true);
  }
  assert.equal(shrink.claimSessionTaskSlot("s2", "t-3", "portrait", { maxParallelTasks: 3 }), false);
  assert.equal(shrink.getActiveTaskCount("s2", "portrait"), 3);

  // A request that passes no override still gets its scope default.
  assert.equal(shrink.claimSessionTaskSlot("s2", "t-3", "portrait"), true);
});

test("bounded concurrency runs at most the configured number of workers at once", async () => {
  let active = 0;
  let peak = 0;
  const items = Array.from({ length: 12 }, (_, index) => index);

  await runWithConcurrency(items, 3, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => { setTimeout(resolve, 5); });
    active -= 1;
  }, { startDelayMs: 0 });

  assert.equal(peak, 3, `expected at most 3 in flight, saw ${peak}`);
});

test("the shared hard cap reuses the configurable maximum", async () => {
  const source = await readFile(new URL("../lib/limited-concurrency.mjs", import.meta.url), "utf8");
  assert.match(source, /MAX_CONCURRENT_WORKERS = MAX_GENERATION_CONCURRENCY/);
  // A duplicated literal would let the hard cap and the configurable maximum
  // drift apart silently.
  assert.doesNotMatch(source, /MAX_CONCURRENT_WORKERS = \d+/);

  let peak = 0;
  let active = 0;
  const items = Array.from({ length: MAX_GENERATION_CONCURRENCY + 5 }, (_, index) => index);
  await runWithConcurrency(items, MAX_GENERATION_CONCURRENCY + 5, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => { setTimeout(resolve, 1); });
    active -= 1;
  }, { startDelayMs: 0 });
  assert.equal(peak, MAX_GENERATION_CONCURRENCY);
});

test("config store persists and normalizes the generation concurrency", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "generation-concurrency-config-"));
  const store = createConfigStore({ rootDir });

  const initial = await store.readPublicConfig();
  assert.equal(initial.defaults[GENERATION_CONCURRENCY_FIELD], 20);

  const saved = await store.saveConfig({ defaults: { [GENERATION_CONCURRENCY_FIELD]: 5 } });
  assert.equal(saved.defaults[GENERATION_CONCURRENCY_FIELD], 5);
  assert.equal((await store.readPublicConfig()).defaults[GENERATION_CONCURRENCY_FIELD], 5);

  const clamped = await store.saveConfig({ defaults: { [GENERATION_CONCURRENCY_FIELD]: 999 } });
  assert.equal(clamped.defaults[GENERATION_CONCURRENCY_FIELD], 60);

  const raised = await store.saveConfig({ defaults: { [GENERATION_CONCURRENCY_FIELD]: 40 } });
  assert.equal(raised.defaults[GENERATION_CONCURRENCY_FIELD], 40);

  const floored = await store.saveConfig({ defaults: { [GENERATION_CONCURRENCY_FIELD]: 0 } });
  assert.equal(floored.defaults[GENERATION_CONCURRENCY_FIELD], 1);

  const junk = await store.saveConfig({ defaults: { [GENERATION_CONCURRENCY_FIELD]: "abc" } });
  assert.equal(junk.defaults[GENERATION_CONCURRENCY_FIELD], 20);
});

test("browser config round-trips the generation concurrency", () => {
  assert.equal(normalizeBrowserPrivateConfig({})[GENERATION_CONCURRENCY_FIELD], 20);
  assert.equal(normalizeBrowserPrivateConfig({ [GENERATION_CONCURRENCY_FIELD]: 4 })[GENERATION_CONCURRENCY_FIELD], 4);

  const storage = createMemoryStorage();
  const saved = saveBrowserPrivateConfig({ [GENERATION_CONCURRENCY_FIELD]: 6 }, storage);
  assert.equal(saved[GENERATION_CONCURRENCY_FIELD], 6);
  assert.equal(readBrowserPrivateConfig(storage)[GENERATION_CONCURRENCY_FIELD], 6);

  // An absent field keeps the stored value instead of resetting to the default.
  assert.equal(saveBrowserPrivateConfig({}, storage)[GENERATION_CONCURRENCY_FIELD], 6);
  assert.equal(saveBrowserPrivateConfig({ [GENERATION_CONCURRENCY_FIELD]: 2 }, storage)[GENERATION_CONCURRENCY_FIELD], 2);

  const publicConfig = toPublicBrowserConfig(readBrowserPrivateConfig(storage), {});
  assert.equal(publicConfig.defaults[GENERATION_CONCURRENCY_FIELD], 2);

  const payload = getBrowserPrivateConfigRequestPayload(() => readBrowserPrivateConfig(storage));
  assert.equal(payload[GENERATION_CONCURRENCY_FIELD], 2);

  const formData = appendBrowserConfigToFormData(new FormData(), () => readBrowserPrivateConfig(storage));
  assert.equal(formData.get(GENERATION_CONCURRENCY_FIELD), "2");
});

test("the concurrency control sits in the scheduling card above the generation log panel", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  const inputIndex = html.indexOf('id="generationConcurrencyInput"');
  const delayIndex = html.indexOf('id="generationStartDelayInput"');
  const schedulingIndex = html.indexOf('class="config-card config-scheduling-card"');
  const logPanelIndex = html.indexOf('id="configGenerationLogPanel"');
  const actionBarIndex = html.indexOf('class="config-action-bar"');
  const configFormIndex = html.indexOf('id="configForm"');
  const configFormEndIndex = html.indexOf("</form>", configFormIndex);

  assert.ok(inputIndex > 0, "the concurrency input must exist");
  assert.ok(inputIndex > schedulingIndex, "the control must live in the generation scheduling card");
  assert.ok(inputIndex < delayIndex, "the concurrency control renders alongside the submit interval");
  assert.ok(inputIndex < logPanelIndex, "the control must render before the generation log panel");
  assert.ok(inputIndex < actionBarIndex, "the control must render before the save action bar");
  assert.ok(
    inputIndex > configFormIndex && inputIndex < configFormEndIndex,
    "the control must live inside the config form",
  );

  assert.match(html, /class="scheduling-hint-trigger"[^>]*data-ui-i18n="concurrencyLabel">请求并发数量<\/span>/);
  assert.match(html, /<small data-ui-i18n="concurrencyUnit">个<\/small>/);
  assert.match(
    html,
    /<input id="generationConcurrencyInput" name="generationConcurrency" type="number" step="any"[^>]*placeholder="20"/,
  );
  // Native min/max/step would fail form validation and silently block saving
  // every other config field. The bounds live in data attributes and are
  // enforced in JS, the same contract the submit interval field follows.
  assert.doesNotMatch(html, /id="generationConcurrencyInput"[^>]*\smax="/);
  assert.doesNotMatch(html, /id="generationConcurrencyInput"[^>]*\smin="/);
  assert.match(html, /id="generationConcurrencyInput"[^>]*data-min-concurrency="1"/);
  assert.match(html, /id="generationConcurrencyInput"[^>]*data-max-concurrency="60"/);
  // The explanation hovers off the title instead of sitting under the field, so
  // the label carries the description reference and the hint is a tooltip.
  assert.match(html, /aria-describedby="generationConcurrencyHint"[^>]*data-ui-i18n="concurrencyLabel"/);
  assert.match(html, /class="scheduling-hint-tooltip" id="generationConcurrencyHint" role="tooltip"[^>]*>[^<]*默认 20 个，范围 1 到 60/);
  assert.doesNotMatch(html, /class="field-hint" id="generationConcurrencyHint"/);
});

test("the scheduling explanations hover off the title instead of sitting under the fields", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  // Both scheduling hints must be tooltips, not permanent field hints.
  ["generationConcurrencyHint", "generationStartDelayHint"].forEach((id) => {
    assert.match(html, new RegExp(`class="scheduling-hint-tooltip" id="${id}" role="tooltip"`));
    assert.doesNotMatch(html, new RegExp(`class="field-hint" id="${id}"`));
    // Keyboard users need it too, so the trigger is focusable and described-by.
    assert.match(html, new RegExp(`class="scheduling-hint-trigger" tabindex="0" aria-describedby="${id}"`));
  });

  // Hidden until the title is hovered or focused.
  assert.match(css, /\.scheduling-hint-tooltip \{[\s\S]*?visibility: hidden;/);
  assert.match(css, /\.scheduling-hint-trigger:is\(:hover, :focus-visible\) ~ \.scheduling-hint-tooltip \{[\s\S]*?visibility: visible;/);
  assert.match(css, /\.scheduling-hint-anchor \{\s*position: relative;/);
});

test("the browser reads the concurrency control into the request payload", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /generationConcurrencyInput:\s*document\.querySelector\("#generationConcurrencyInput"\),/);
  assert.match(app, /\[GENERATION_CONCURRENCY_FIELD\]:\s*getConfiguredGenerationConcurrency\(browserPayload\),/);
  assert.match(app, /function getConfiguredGenerationConcurrency\(browserPayload = \{\}\) \{[\s\S]*?normalizeGenerationConcurrency\(refs\.generationConcurrencyInput\?\.value, fallback\)/);
  assert.match(app, /refs\.generationConcurrencyInput\.value = String\(\s*normalizeGenerationConcurrency\(config\.defaults\?\.\[GENERATION_CONCURRENCY_FIELD\]/);
  // Clamp on the field's own commit and again on submit, because Enter can
  // submit the form without firing change.
  assert.match(app, /refs\.generationConcurrencyInput\?\.addEventListener\("change", \(\) => \{[\s\S]*normalizeGenerationConcurrency\(refs\.generationConcurrencyInput\.value/);
  assert.match(app, /refs\.generationConcurrencyInput\.value = String\(payload\[GENERATION_CONCURRENCY_FIELD\]\);/);
  assert.match(app, /concurrencyLabel: "请求并发数量"/);
  assert.match(app, /concurrencyLabel: "Request Concurrency"/);
});

test("every server concurrency fan-out resolves the configured concurrency", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  const fanOutCalls = server.match(/await runWithConcurrency\(/g) || [];
  const resolved = server.match(/const generationConcurrency = resolveGenerationConcurrencyForLimit\(formData, config\);/g) || [];
  const usedAsLimit = server.match(/await runWithConcurrency\(\w+(?:\.\w+)?, generationConcurrency,/g) || [];
  const slotOverrides = server.match(/maxParallelTasks: generationConcurrency/g) || [];

  assert.equal(fanOutCalls.length, 5, "creation generate/repair/logo-batch and portrait generate/repair fan out");
  assert.equal(resolved.length, 5, "every fan-out handler resolves the configured concurrency once");
  assert.equal(usedAsLimit.length, 5, "every fan-out must use it as the worker limit");
  // Widening the fan-out without also raising the session slot ceiling would
  // park the extra workers in the 250ms slot-wait poll instead of generating.
  assert.equal(slotOverrides.length, 5, "every fan-out must pass it as the slot ceiling");

  // A bare constant as the limit would ignore the control entirely.
  assert.doesNotMatch(server, /await runWithConcurrency\([^,]+, MAX_[A-Z_]+,/);
});

test("every server fan-out stops on an account-level upstream error", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  // A path that skips the guard would keep sending doomed requests after the
  // batch has already been aborted. The repo is CRLF, so a bare \n never matches.
  const guardedWorkers = server.match(
    /try \{\r?\n\s*throwIfFanOutAborted\(controls\);\r?\n/g,
  ) || [];
  assert.equal(guardedWorkers.length, 5, "the guard must be the first statement in each worker try block");

  // The slot helper must receive `controls` from every fan-out, because the abort
  // is re-checked inside it AFTER the slot is granted. Without that, a worker
  // that sat in the 250ms slot poll while the abort was raised would claim a slot
  // and fire the request the abort exists to prevent.
  const slotWaitsWithControls = server.match(
    /await waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response, \{ maxParallelTasks: generationConcurrency, controls \}\);/g,
  ) || [];
  assert.equal(slotWaitsWithControls.length, 5, "every fan-out must pass controls to the slot wait");

  // The post-claim re-check must release the slot before throwing: the caller
  // only sets its `slotClaimed` flag on the line after the wait returns, so its
  // own finally block cannot release it.
  assert.match(
    server,
    /if \(readFanOutAbortReason\(controls\)\) \{\s*releaseSessionTaskSlot\(sessionId, taskId, requestScope\);\s*throwIfFanOutAborted\(controls\);/,
  );

  // Without the message the classifier has nothing to judge, so every failure
  // would buy a retry again. The helper's own declaration shares this shape, so
  // only the call sites are counted.
  const requeueCalls = server.match(
    /= requeueFailedSetItem\(\{ response, controls, retryLedger, item, message \}\)/g,
  ) || [];
  assert.equal(requeueCalls.length, 5, "every fan-out must hand the failure message to the requeue decision");

  assert.match(server, /if \(isFatalUpstreamError\(message\)\) \{\s*controls\?\.abortRemaining\?\.\(message\);\s*return 0;/);
});

test("the scheduling controls lock while generation work is pending", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  // The lock must consider every panel that can launch a generation request,
  // plus queued prompt jobs that have not read the parameters yet.
  const predicate = app.match(/function hasPendingGenerationWork\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.notEqual(predicate, "", "hasPendingGenerationWork must exist");
  assert.match(predicate, /getTotalRunningJobCount\(\) > 0/);
  assert.match(predicate, /getTotalQueuedJobCount\(\) > 0/);
  assert.match(predicate, /state\.creation\?\.generating/);
  assert.match(predicate, /state\.portrait\?\.generating/);
  assert.match(predicate, /state\.articleIllustration\?\.generating/);
  assert.match(predicate, /state\.articleIllustration\?\.referenceGenerating/);
  assert.match(predicate, /state\.ppt\?\.generating/);

  const sync = app.match(/function syncGenerationSchedulingLock\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.notEqual(sync, "", "syncGenerationSchedulingLock must exist");
  assert.match(sync, /const locked = hasPendingGenerationWork\(\);/);
  assert.match(sync, /refs\.generationConcurrencyInput, refs\.generationStartDelayInput/);
  assert.match(sync, /input\.disabled = locked;/);
  assert.match(sync, /refs\.generationSchedulingLockNote\?\.classList\.toggle\("hidden", !locked\)/);
  // Reverting on the unlocked -> locked transition keeps an edit typed just
  // before a generation started from being written by a later save.
  assert.match(sync, /becameLocked/);

  // The lock must be reflected from every state change that starts or ends
  // generation, and again when the drawer is opened mid-generation.
  ["renderCreationView", "renderPortraitView", "renderPptView", "renderArticleIllustrationView"].forEach((fn) => {
    assert.match(
      app,
      new RegExp(`function ${fn}\\(\\) \\{\\s*syncGenerationSchedulingLock\\(\\);`),
      `${fn} must sync the lock before its mount guard`,
    );
  });
  assert.match(app, /function updateGenerateButton\(\) \{[\s\S]*?syncGenerationSchedulingLock\(\);/);
  assert.match(app, /function setDrawerOpen\(open\) \{[\s\S]*?syncGenerationSchedulingLock\(\);/);

  // A locked control is ignored on save: the saved value is authoritative, so a
  // stale field cannot rewrite the scheduling parameters mid-batch.
  assert.match(
    app,
    /function getConfiguredGenerationConcurrency\(browserPayload = \{\}\) \{[\s\S]*?if \(hasPendingGenerationWork\(\)\) \{\s*return fallback;/,
  );
  assert.match(
    app,
    /function getConfiguredGenerationStartDelayMs\(browserPayload = \{\}\) \{[\s\S]*?if \(hasPendingGenerationWork\(\)\) \{\s*return fallback;/,
  );

  assert.match(app, /schedulingLockNote: "有生图任务正在进行或排队/);
  assert.match(app, /schedulingLockNote: "Generation tasks are running or queued/);
});

test("the scheduling lock note ships in the scheduling card", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  const noteIndex = html.indexOf('id="generationSchedulingLockNote"');
  const schedulingIndex = html.indexOf('class="config-card config-scheduling-card"');
  const concurrencyIndex = html.indexOf('id="generationConcurrencyInput"');

  assert.ok(noteIndex > schedulingIndex, "the note belongs to the scheduling card");
  assert.ok(noteIndex < concurrencyIndex, "the note renders above the controls it explains");
  // Hidden by default and announced when it appears.
  assert.match(html, /id="generationSchedulingLockNote"[^>]*class="[^"]*hidden[^"]*"|class="[^"]*hidden[^"]*"[^>]*id="generationSchedulingLockNote"/);
  assert.match(html, /id="generationSchedulingLockNote"[^>]*aria-live="polite"/);
  assert.match(html, /id="generationSchedulingLockNote"[^>]*data-ui-i18n="schedulingLockNote"/);

  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.config-scheduling-card input:disabled \{/);
});

test("the SSE response raises its listener ceiling before the fan-out attaches close listeners", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  // Derived from the widest fan-out, so raising MAX_CREATION_PARALLEL_TASKS cannot
  // leave the ceiling behind and re-introduce the warning.
  assert.match(server, /const MAX_SSE_CLOSE_LISTENERS = MAX_CREATION_PARALLEL_TASKS \+ 10;/);
  assert.doesNotMatch(server, /MAX_SSE_CLOSE_LISTENERS = \d+;/);
  // The capacity has to be raised before the per-item listener is attached.
  assert.match(
    server,
    /function createCreationRequestLifecycle\(response\) \{\s*ensureSseListenerCapacity\(response\);/,
  );
  // 0 means unlimited in Node, so it must never be lowered to a finite ceiling.
  assert.match(server, /if \(current === 0 \|\| current >= MAX_SSE_CLOSE_LISTENERS\) \{\s*return;/);
});

test("the raised listener ceiling silences the warning for the widest fan-out", async () => {
  const { IncomingMessage, ServerResponse } = await import("node:http");
  const { Socket } = await import("node:net");

  const widestFanOut = Math.max(MAX_CREATION_PARALLEL_TASKS, MAX_PARALLEL_TASKS_PER_SESSION);
  const ceiling = MAX_CREATION_PARALLEL_TASKS + 10;
  assert.ok(ceiling > widestFanOut, "the ceiling must clear the widest fan-out");

  const warnings = [];
  const onWarning = (warning) => {
    if (warning.name === "MaxListenersExceededWarning") {
      warnings.push(warning.message);
    }
  };
  process.on("warning", onWarning);

  try {
    // Node's default is 10 listeners per event, so the widest fan-out warns without
    // the raise. This asserts the bug the raise exists to fix is real.
    const unraised = new ServerResponse(new IncomingMessage(new Socket()));
    assert.equal(unraised.getMaxListeners(), 10);
    for (let index = 0; index < widestFanOut; index += 1) {
      unraised.once("close", () => {});
    }
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.equal(warnings.length, 1, "the default ceiling must warn for the widest fan-out");
    assert.match(warnings[0], /close listeners added to \[ServerResponse\]/);

    const raised = new ServerResponse(new IncomingMessage(new Socket()));
    raised.setMaxListeners(ceiling);
    const listeners = [];
    for (let index = 0; index < widestFanOut; index += 1) {
      const listener = () => {};
      listeners.push(listener);
      raised.once("close", listener);
    }
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.equal(warnings.length, 1, "the raised ceiling must not warn");

    // Each item removes its own listener on dispose, so the count returns to zero and
    // the raise only covers a genuine peak rather than masking a real leak.
    assert.equal(raised.listenerCount("close"), widestFanOut);
    for (const listener of listeners) {
      raised.removeListener("close", listener);
    }
    assert.equal(raised.listenerCount("close"), 0);
  } finally {
    process.removeListener("warning", onWarning);
  }
});

test("browser and server keep the concurrency out of masked credential surfaces", () => {
  const storage = createMemoryStorage();
  saveBrowserPrivateConfig({ apiKey: "sk-secret-value", [GENERATION_CONCURRENCY_FIELD]: 7 }, storage);
  const publicConfig = toPublicBrowserConfig(readBrowserPrivateConfig(storage), {});

  assert.equal(publicConfig.defaults[GENERATION_CONCURRENCY_FIELD], 7);
  assert.equal("apiKey" in publicConfig, false);
  assert.doesNotMatch(JSON.stringify(publicConfig), /sk-secret-value/);
});
