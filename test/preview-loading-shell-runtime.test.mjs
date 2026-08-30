import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  createGenerationLoadingShell,
  getGenerationLoadingInterval,
  getGenerationLoadingProgress,
  getGenerationLoadingItemStage,
  getGenerationLoadingShellFamily,
  getGenerationLoadingStageFamily,
  stopGenerationLoadingShell,
  stopGenerationLoadingShells,
  updateGenerationLoadingShell,
} from "../lib/generation-loading.mjs";
import { shouldReusePreviewLoadingShell } from "../lib/preview-loading-shell.mjs";
import { getPreviewPlaceholderState, isWaitingPreviewItem } from "../lib/preview-placeholder-state.mjs";

function createTestElement(tagName = "div", ownerDocument = null) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children: [],
    className: "",
    dataset: {},
    attributes: new Map(),
    textContent: "",
    parentElement: null,
    style: {
      properties: new Map(),
      setProperty(name, value) {
        element.style.properties.set(name, String(value));
      },
    },
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(String(name)));
        element.className = [...current].join(" ");
      },
      contains(name) {
        return String(element.className || "").split(/\s+/).includes(String(name));
      },
    },
    append(...nodes) {
      nodes.forEach((node) => element.appendChild(node));
    },
    appendChild(node) {
      node.parentElement = element;
      element.children.push(node);
      return node;
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return element.attributes.get(name) || "";
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : "";
      const matches = [];
      const stack = [...element.children];
      while (stack.length > 0) {
        const node = stack.shift();
        if (className && String(node.className || "").split(/\s+/).includes(className)) {
          matches.push(node);
        }
        stack.unshift(...node.children);
      }
      return matches;
    },
  };
  return element;
}

function createTestDocument() {
  const documentRef = createTestElement("#document");
  documentRef.createElement = (tagName) => createTestElement(tagName, documentRef);
  documentRef.ownerDocument = documentRef;
  return documentRef;
}

function installScheduler() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const pending = new Map();
  const delays = [];
  let nextId = 1;
  globalThis.setTimeout = (callback, delay) => {
    const id = nextId++;
    pending.set(id, callback);
    delays.push(Number(delay));
    return id;
  };
  globalThis.clearTimeout = (id) => {
    pending.delete(id);
  };
  return {
    pending,
    delays,
    runNext() {
      const entry = pending.entries().next().value;
      if (!entry) {
        return false;
      }
      pending.delete(entry[0]);
      entry[1]();
      return true;
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

test("preview loading uses one shared drop with an accessible percentage", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-1", active: true });
    assert.equal(nodes.shell.querySelectorAll(".generation-loading-drop").length, 1);
    assert.equal(nodes.shell.querySelectorAll(".generation-loading-percent").length, 1);
    assert.equal(nodes.percent.textContent, "0%");
    assert.equal(nodes.shell.getAttribute("aria-valuemin"), "0");
    assert.equal(nodes.shell.getAttribute("aria-valuemax"), "99");
    assert.equal(nodes.shell.getAttribute("aria-valuenow"), "0");
    assert.equal(scheduler.delays[0], 800);
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview loading advances one percent every 800 milliseconds below 20 percent", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-2", active: true });
    for (let step = 1; step <= 20; step += 1) {
      assert.equal(scheduler.runNext(), true);
      assert.equal(getGenerationLoadingProgress(nodes), step);
    }
    assert.equal(nodes.percent.textContent, "20%");
    assert.equal(scheduler.delays.slice(0, 20).every((delay) => delay === 800), true);
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview loading slows by 1500ms per additional 10 percent band", () => {
  assert.equal(getGenerationLoadingInterval(0), 800);
  assert.equal(getGenerationLoadingInterval(18), 800);
  assert.equal(getGenerationLoadingInterval(19), 800);
  assert.equal(getGenerationLoadingInterval(20), 2300);
  assert.equal(getGenerationLoadingInterval(29), 2300);
  assert.equal(getGenerationLoadingInterval(30), 3800);
  assert.equal(getGenerationLoadingInterval(39), 3800);
  assert.equal(getGenerationLoadingInterval(40), 5300);
  assert.equal(getGenerationLoadingInterval(89), 11300);
  assert.equal(getGenerationLoadingInterval(90), 12800);
  assert.equal(getGenerationLoadingInterval(98), 12800);
});

test("preview loading exposes the tick duration for a continuous water rise", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-rise", active: true });
    assert.equal(nodes.shell.style.properties.get("--generation-loading-rise-duration"), "800ms");
    nodes.progress = 25;
    updateGenerationLoadingShell(nodes, { key: "job-rise", active: true });
    assert.equal(nodes.shell.style.properties.get("--generation-loading-rise-duration"), "2300ms");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("stage color families follow the real request stages", () => {
  assert.equal(getGenerationLoadingStageFamily("queued"), "queued");
  assert.equal(getGenerationLoadingStageFamily("uploading"), "uploading");
  assert.equal(getGenerationLoadingStageFamily("connecting"), "connecting");
  assert.equal(getGenerationLoadingStageFamily("generating"), "generating");
  assert.equal(getGenerationLoadingStageFamily("reference_generating"), "generating");
  assert.equal(getGenerationLoadingStageFamily("saving"), "saving");
  ["waiting_upstream", "waiting_final", "retrying_upstream", "recovering_original"].forEach((stage) => {
    assert.equal(getGenerationLoadingStageFamily(stage), "recovering");
  });
  ["error", "failed", "original_failed"].forEach((stage) => {
    assert.equal(getGenerationLoadingStageFamily(stage), "failed");
  });
});

test("unknown stages fall back without guessing a later stage", () => {
  assert.equal(getGenerationLoadingStageFamily(""), "generating");
  assert.equal(getGenerationLoadingStageFamily("nonsense"), "generating");
  assert.equal(getGenerationLoadingStageFamily("", "waiting"), "queued");
  assert.equal(getGenerationLoadingStageFamily("nonsense", "waiting"), "queued");
});

test("item stage is read from the usual status fields", () => {
  assert.equal(getGenerationLoadingItemStage({ statusStage: "saving" }), "saving");
  assert.equal(getGenerationLoadingItemStage({ stage: "connecting" }), "connecting");
  assert.equal(getGenerationLoadingItemStage({ status: "queued" }), "queued");
  assert.equal(getGenerationLoadingItemStage({ statusStage: "saving", status: "queued" }), "saving");
  assert.equal(getGenerationLoadingItemStage(null), "");
});

test("loading shells expose the stage and its color family on the dataset", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-stage", active: true, stage: "connecting" });
    assert.equal(nodes.shell.dataset.generationLoadingStage, "connecting");
    assert.equal(nodes.shell.dataset.generationLoadingFamily, "connecting");
    assert.equal(getGenerationLoadingShellFamily(nodes), "connecting");

    updateGenerationLoadingShell(nodes, { key: "job-stage", active: true, stage: "generating" });
    assert.equal(nodes.shell.dataset.generationLoadingFamily, "generating");

    updateGenerationLoadingShell(nodes, { key: "job-stage", active: true, stage: "retrying_upstream" });
    assert.equal(nodes.shell.dataset.generationLoadingFamily, "recovering");

    updateGenerationLoadingShell(nodes, { key: "job-stage", active: true, stage: "saving" });
    assert.equal(nodes.shell.dataset.generationLoadingFamily, "saving");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("a re-render without a stage keeps the last known stage", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-keep", active: true, stage: "saving" });
    updateGenerationLoadingShell(nodes, { key: "job-keep", active: true });
    assert.equal(nodes.shell.dataset.generationLoadingStage, "saving");
    assert.equal(nodes.shell.dataset.generationLoadingFamily, "saving");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("stylesheet derives water color from stage hue and progress depth", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /@property --generation-loading-hue\s*\{[\s\S]*syntax:\s*"<number>"/);
  assert.match(styles, /@property --generation-loading-sat\s*\{[\s\S]*syntax:\s*"<percentage>"/);
  // 深浅由百分比推导，所以同一阶段内也能看出推进。
  assert.match(
    styles,
    /--generation-loading-fluid:\s*hsl\([\s\S]*var\(--generation-loading-hue\)[\s\S]*calc\([\s\S]*var\(--generation-loading-progress\)/,
  );
  assert.match(styles, /--generation-loading-hue 900ms ease-in-out/);
  // 浅色主题必须用亮度偏移而不是固定值，否则会盖掉各阶段按感知亮度做的校准。
  assert.match(
    styles,
    /html\[data-theme="light"\] \.generation-loading-shell\s*\{[^}]*--generation-loading-light-shift:/,
  );
  assert.doesNotMatch(
    styles,
    /html\[data-theme="light"\] \.generation-loading-shell\s*\{[^}]*--generation-loading-light-base:/,
  );
  ["queued", "uploading", "connecting", "generating", "recovering", "saving", "failed"].forEach((family) => {
    assert.match(
      styles,
      new RegExp(
        `\\.generation-loading-shell\\[data-generation-loading-family="${family}"\\]\\s*\\{[\\s\\S]*?--generation-loading-hue:`,
      ),
    );
  });
  assert.match(styles, /\.generation-loading-drop::after\s*\{[\s\S]*var\(--generation-loading-fluid\)/);
  assert.match(styles, /\.generation-loading-wave\s*\{[\s\S]*var\(--generation-loading-fluid\)/);
  // 等待态不再自带取色，避免覆盖阶段色相族。
  assert.doesNotMatch(
    styles,
    /\[data-generation-loading-mode="waiting"\] \.generation-loading-wave \{[\s\S]*?background-image:/,
  );
});

test("loading surface avoids a bright moving divider and keeps status text crisp", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const fillRule = styles.match(/\.generation-loading-drop::after\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const waveRule = styles.match(/\n\.generation-loading-wave \{[\s\S]*?\n\}/)?.[0] || "";
  const waveAfterRule =
    styles.match(/\n\.generation-loading-wave::after\s*\{\s*z-index:\s*1;[\s\S]*?\n\}/)?.[0] || "";
  const shellRule = styles.match(/\n\.generation-loading-shell\s*\{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(fillRule, /mask-image:\s*linear-gradient\(180deg, transparent 0%, #000 18%, #000 100%\)/);
  assert.doesNotMatch(fillRule, /inset 0 1px 0 rgba\(255, 255, 255/);
  assert.match(waveRule, /opacity:\s*0;/);
  assert.match(waveRule, /animation:\s*none;/);
  assert.doesNotMatch(waveRule, /#ffffff/);
  assert.match(waveAfterRule, /animation:\s*none;/);
  assert.match(shellRule, /font-family:\s*"IBM Plex Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif;/);
  assert.match(styles, /\.generation-loading-heartbeat\s*\{[\s\S]*stroke-width:\s*2\.25;/);
});

test("preview loading renders a wave layer inside the water drop", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wave", active: true });
    assert.equal(nodes.shell.querySelectorAll(".generation-loading-wave").length, 1);
    assert.equal(nodes.wave.parentElement, nodes.drop);
    assert.equal(nodes.wave.getAttribute("aria-hidden"), "true");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview and thumbnail loading shells share progress for the same key", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const preview = createGenerationLoadingShell(documentRef, { key: "job-shared", active: true });
    const thumbnail = createGenerationLoadingShell(documentRef, { key: "job-shared", active: true });
    assert.equal(scheduler.delays.length, 1);
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(preview), 1);
    assert.equal(getGenerationLoadingProgress(thumbnail), 1);
    assert.equal(preview.percent.textContent, thumbnail.percent.textContent);
    stopGenerationLoadingShell(preview);
    assert.equal(scheduler.pending.size, 1);
    stopGenerationLoadingShell(thumbnail);
    assert.equal(scheduler.pending.size, 0);
  } finally {
    scheduler.restore();
  }
});

test("preview loading caps at 99 percent and stops scheduling", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-3", active: true });
    nodes.progress = 98;
    updateGenerationLoadingShell(nodes, { key: "job-3", active: true });
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(nodes), 99);
    assert.equal(nodes.percent.textContent, "99%");
    assert.equal(nodes.timer, null);
    assert.equal(scheduler.pending.size, 0);
  } finally {
    scheduler.restore();
  }
});

test("preview loading resets when the generation key changes and stops cleanly", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-a", active: true });
    scheduler.runNext();
    updateGenerationLoadingShell(nodes, { key: "job-b", active: true });
    assert.equal(getGenerationLoadingProgress(nodes), 0);
    assert.equal(nodes.shell.dataset.generationLoadingKey, "job-b");
    stopGenerationLoadingShell(nodes);
    assert.equal(nodes.timer, null);
    assert.equal(nodes.active, false);
    assert.equal(scheduler.pending.size, 0);
  } finally {
    scheduler.restore();
  }
});

test("waiting loading shells never schedule a percentage tick", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wait", active: true, mode: "waiting" });
    assert.equal(nodes.shell.dataset.generationLoadingMode, "waiting");
    assert.equal(nodes.timer, null);
    assert.equal(scheduler.pending.size, 0);
    assert.equal(nodes.percent.textContent, "");
    assert.equal(nodes.status.textContent, "排队等待中");
    assert.equal(nodes.shell.getAttribute("aria-label"), "排队等待中");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("waiting shells start from zero once the task begins generating", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wait-2", active: true, mode: "waiting" });
    updateGenerationLoadingShell(nodes, { key: "job-wait-2", active: true, mode: "generating" });
    assert.equal(nodes.shell.dataset.generationLoadingMode, "generating");
    assert.equal(getGenerationLoadingProgress(nodes), 0);
    assert.equal(nodes.status.textContent, "生图生成中");
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(nodes), 1);
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("a generating shell switched back to waiting stops ticking and clears the percentage", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wait-3", active: true });
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(nodes), 1);
    updateGenerationLoadingShell(nodes, { key: "job-wait-3", active: true, mode: "waiting" });
    assert.equal(nodes.timer, null);
    assert.equal(scheduler.pending.size, 0);
    assert.equal(getGenerationLoadingProgress(nodes), 0);
    assert.equal(nodes.percent.textContent, "");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("queued prompt items are reported as waiting previews", () => {
  assert.equal(isWaitingPreviewItem({ statusStage: "queued" }), true);
  assert.equal(isWaitingPreviewItem({ statusStage: "queued", started: true }), false);
  assert.equal(isWaitingPreviewItem({ statusStage: "queued", isRunning: true }), false);
  assert.equal(isWaitingPreviewItem({ statusStage: "generating" }), false);
  assert.equal(isWaitingPreviewItem({}), false);
  assert.equal(getPreviewPlaceholderState({ item: { id: "job-q", statusStage: "queued" } }).waiting, true);
  assert.equal(getPreviewPlaceholderState({ item: { id: "job-g", statusStage: "generating" } }).waiting, false);
});

test("queue and thumbnail strips separate adjacent same-footprint entries", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.creation-queue-item \+ \.creation-queue-item::before\s*\{[\s\S]*background:/);
  assert.match(styles, /\.filmstrip-entry \+ \.filmstrip-entry::before\s*\{[\s\S]*background:/);
  assert.match(styles, /\.generation-loading-shell\[data-generation-loading-mode="waiting"\]/);
  assert.match(styles, /@keyframes generation-loading-waiting-pulse/);
});

test("preview loading shell reuse is limited to the same active generation", () => {
  assert.equal(shouldReusePreviewLoadingShell({ mode: "loading", loadingKey: "same" }, { mode: "loading", loadingKey: "same" }), true);
  assert.equal(shouldReusePreviewLoadingShell({ mode: "loading", loadingKey: "old" }, { mode: "loading", loadingKey: "new" }), false);
  assert.equal(shouldReusePreviewLoadingShell({ mode: "ready" }, { mode: "loading" }), false);
});

test("preview placeholder exposes a stable loading key", () => {
  const state = getPreviewPlaceholderState({ item: { id: "job-42", statusStage: "generating" } });
  assert.equal(state.mode, "loading");
  assert.equal(state.loadingKey, "job-42");
});

test("app and stylesheet no longer contain the removed multi-layer generation animations", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /createGenerationLoadingShell\(document/);
  assert.doesNotMatch(app, /createPreviewMotionNode|preview-loading-orb-field|quick-blend-thumb-loader/);
  assert.match(styles, /\.generation-loading-drop\s*\{/);
  assert.match(styles, /@keyframes generation-loading-breathe/);
  assert.match(styles, /\.generation-loading-wave\s*\{[\s\S]*bottom:\s*calc\(var\(--generation-loading-progress\)/);
  assert.match(styles, /@keyframes generation-loading-wave-drift/);
  assert.match(styles, /@keyframes generation-loading-water-bubbles/);
  assert.match(styles, /@property --generation-loading-progress\s*\{[\s\S]*syntax:\s*"<percentage>"/);
  assert.match(
    styles,
    /\.generation-loading-shell\s*\{[\s\S]*transition:\s*--generation-loading-progress var\(--generation-loading-rise-duration,\s*800ms\) linear/,
  );
  assert.doesNotMatch(styles, /preview-loading-orb-field|preview-loading-fluid|creation-card-loading-sketch|quick-blend-thumb-loader|image-edit-spin|image-decomposition-spin/);
});

// A stage that reaches the shell without a family silently renders the ordinary
// `generating` hue, which misreports what the pipeline is doing. Read the stages back
// out of the workflow so a newly added one cannot slip through unmapped.
test("every stage the workflow emits has an explicit colour family", async () => {
  const { readFile } = await import("node:fs/promises");
  const { GENERATION_LOADING_STAGE_FAMILIES } = await import("../lib/generation-loading.mjs");
  const workflow = await readFile(new URL("../lib/responses-workflow.mjs", import.meta.url), "utf8");

  const emitted = new Set();
  for (const match of workflow.matchAll(/stage:s*"([a-z_]+)"/g)) {
    emitted.add(match[1]);
  }
  for (const match of workflow.matchAll(/"(original_failed|recovery_unavailable)"/g)) {
    emitted.add(match[1]);
  }

  assert.ok(emitted.size > 0, "expected to find emitted stages");
  const unmapped = [...emitted].filter((stage) => !GENERATION_LOADING_STAGE_FAMILIES[stage]).sort();
  assert.deepEqual(unmapped, [], `unmapped stages: ${unmapped.join(", ")}`);
});

test("loading shell keeps the realtime log line opt-in", async () => {
  const { getGenerationLoadingLogText } = await import("../lib/generation-loading.mjs");
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const quiet = createGenerationLoadingShell(documentRef, { key: "job-quiet", active: true });
    assert.equal(quiet.shell.querySelectorAll(".generation-loading-log").length, 1);
    assert.equal(quiet.log.hidden, true);
    assert.equal(quiet.log.textContent, "");
    assert.equal(quiet.shell.dataset.generationLoadingLog, "off");
    assert.equal(getGenerationLoadingLogText(quiet), "");

    updateGenerationLoadingShell(quiet, { key: "job-quiet", active: true, logText: "上游重试：正在重试 1/2" });
    assert.equal(quiet.log.hidden, true, "log stays hidden until the call site opts in");

    const loud = createGenerationLoadingShell(documentRef, {
      key: "job-loud",
      active: true,
      showLog: true,
      logText: "上游重试：正在重试 1/2",
    });
    assert.equal(loud.log.hidden, false);
    assert.equal(loud.log.textContent, "上游重试：正在重试 1/2");
    assert.equal(loud.shell.dataset.generationLoadingLog, "on");
    assert.equal(getGenerationLoadingLogText(loud), "上游重试：正在重试 1/2");
    assert.equal(loud.percent.textContent, "0%");

    updateGenerationLoadingShell(loud, { key: "job-loud", active: true });
    assert.equal(loud.log.textContent, "上游重试：正在重试 1/2", "omitted logText keeps the last text");

    updateGenerationLoadingShell(loud, { key: "job-loud", active: true, logText: "" });
    assert.equal(loud.log.hidden, true, "empty text takes no space");
    assert.equal(loud.shell.dataset.generationLoadingLog, "off");
  } finally {
    scheduler.restore();
  }
});

test("loading shell log line does not disturb progress, stage, or waiting semantics", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, {
      key: "job-1",
      active: true,
      stage: "generating",
      showLog: true,
      logText: "正在生成图片",
    });
    assert.equal(scheduler.delays[0], 800);
    scheduler.runNext();
    assert.equal(getGenerationLoadingProgress(nodes), 1);
    assert.equal(nodes.percent.textContent, "1%");
    assert.equal(getGenerationLoadingShellFamily(nodes), "generating");
    assert.equal(nodes.log.textContent, "正在生成图片");

    updateGenerationLoadingShell(nodes, { key: "job-1", active: true, mode: "waiting", logText: "排队中：等待资源分配" });
    assert.equal(nodes.percent.textContent, "");
    assert.equal(nodes.log.textContent, "排队中：等待资源分配");
    assert.equal(nodes.log.hidden, false);
  } finally {
    scheduler.restore();
  }
});

test("loading shell log line wraps to show the full progress text", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.generation-loading-log\s*\{[\s\S]*white-space:\s*normal/);
  assert.match(styles, /\.generation-loading-log\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(styles, /\.generation-loading-log\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.doesNotMatch(styles, /\.generation-loading-log\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(styles, /\.generation-loading-log\[hidden\]\s*\{[\s\S]*display:\s*none/);
});

/* 写真模式每次渲染都重建整个结果网格，所以“先建新卡片再停旧动画”这个顺序
   同时决定了运行内进度会不会被清零、以及运行结束后进度源会不会残留到 99%。 */
test("rebuilding a grid before stopping the old shells keeps the run progress", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const grid = documentRef.createElement("div");
    const previousShell = createGenerationLoadingShell(documentRef, { key: "001-headshot", active: true });
    grid.appendChild(previousShell.shell);

    scheduler.runNext();
    scheduler.runNext();
    assert.equal(getGenerationLoadingProgress(previousShell), 2);

    const rebuiltShell = createGenerationLoadingShell(documentRef, { key: "001-headshot", active: true });
    stopGenerationLoadingShells(grid);

    assert.equal(getGenerationLoadingProgress(rebuiltShell), 2);
    assert.equal(previousShell.active, false);
    assert.ok(scheduler.runNext());
    assert.equal(getGenerationLoadingProgress(rebuiltShell), 3);
    stopGenerationLoadingShell(rebuiltShell);
  } finally {
    scheduler.restore();
  }
});

test("a finished run leaves no shared progress for the next run to inherit", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const grid = documentRef.createElement("div");
    const firstRunShell = createGenerationLoadingShell(documentRef, { key: "002-halfbody", active: true });
    grid.appendChild(firstRunShell.shell);

    scheduler.runNext();
    scheduler.runNext();
    scheduler.runNext();
    assert.equal(getGenerationLoadingProgress(firstRunShell), 3);

    /* 出图后重建的卡片不再有加载动画，停掉旧动画就该把进度源一起回收。 */
    stopGenerationLoadingShells(grid);
    assert.equal(firstRunShell.active, false);
    assert.equal(scheduler.pending.size, 0);

    const secondRunShell = createGenerationLoadingShell(documentRef, { key: "002-halfbody", active: true });
    assert.equal(getGenerationLoadingProgress(secondRunShell), 0);
    assert.equal(secondRunShell.percent.textContent, "0%");
    stopGenerationLoadingShell(secondRunShell);
  } finally {
    scheduler.restore();
  }
});
