import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createDeferredUpdate } from "../lib/deferred-update.mjs";
import {
  createGenerationLogStore, normalizeGenerationLogChannel, normalizeGenerationLogRelayUrl,
  serializeGenerationLogStore, upsertGenerationLogEntry, upsertGenerationLogGroupEntry,
} from "../lib/generation-log-store.mjs";
import { sanitizeGenerationActivityDetail } from "../lib/generation-activity-feed.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start) + start.length));

function fixture() {
  let open = false;
  const writes = [];
  const calls = { timeline: 0, creation: 0 };
  const listeners = new Map();
  const document = { hidden: false, addEventListener: (event, callback) => listeners.set(event, callback) };
  const window = { localStorage: { setItem(key, value) { writes.push(JSON.parse(value)); } },
    addEventListener: (event, callback) => listeners.set(event, callback) };
  const context = {
    createDeferredUpdate, createGenerationLogStore, normalizeGenerationLogChannel, normalizeGenerationLogRelayUrl,
    serializeGenerationLogStore, upsertGenerationLogEntry, upsertGenerationLogGroupEntry, sanitizeGenerationActivityDetail,
    window, document, GENERATION_LOG_STORAGE_KEY: "test-log",
    state: { activeView: "creation", generationLog: createGenerationLogStore() },
    refs: { configDrawer: { classList: { contains: () => open } } },
    renderTimeline() { calls.timeline += 1; }, renderCreationView() { calls.creation += 1; },
    formatCompactRatioLabel: (value) => value, formatCompactSizeLabel: (value) => value,
    nowIso: () => "2026-11-02T00:00:00Z",
  };
  runInNewContext(between("function writeGenerationLogStore(", "function readGalleryMetadataCache(") +
    between("function recordActivity(", "async function copyLightboxPrompt(") +
    between("function bindEvents() {", "  creationLogoLibrary.bind();").replace("function bindEvents() {", "") +
    "this.flushLogs = () => generationLogUpdates.flush();", context);
  return { context, writes, calls, listeners, document, setOpen: (value) => { open = value; } };
}

test("600 log updates retain latest in-memory status but cause one storage write and no closed-panel render", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  for (let index = 0; index < 600; index += 1) {
    f.context.recordGroupActivity({ channel: "creation", groupId: `suite-${Math.floor(index / 20)}`,
      groupItemId: `item-${index % 20}`, totalCount: 20, status: "done", detail: `完成 ${index}` });
  }
  const latest = JSON.stringify(f.context.state.generationLog);
  assert.match(latest, /完成 599/);
  assert.equal(f.writes.length, 0);
  t.mock.timers.tick(250);
  assert.equal(f.writes.length, 1);
  assert.equal(f.calls.timeline, 0);
  assert.match(JSON.stringify(f.writes[0]), /完成 599/);
  f.setOpen(true);
  f.context.recordActivity({ channel: "prompt", key: "new", status: "active", detail: "新任务" });
  t.mock.timers.tick(250);
  assert.equal(f.writes.length, 2);
  assert.equal(f.calls.timeline, 1);
});

test("hiding or leaving flushes pending logs once, and resuming refreshes visible panels", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  f.context.recordActivity({ channel: "prompt", key: "new", status: "done", detail: "完成" });
  f.document.hidden = true;
  f.listeners.get("visibilitychange")();
  assert.equal(f.writes.length, 1);
  f.listeners.get("pagehide")();
  t.mock.timers.tick(1000);
  assert.equal(f.writes.length, 1);
  f.document.hidden = false;
  f.setOpen(true);
  f.listeners.get("visibilitychange")();
  assert.equal(f.calls.creation, 1);
  assert.equal(f.calls.timeline, 1);
  f.context.recordActivity({ channel: "prompt", key: "next", status: "done", detail: "第二次完成" });
  f.listeners.get("pagehide")();
  assert.equal(f.writes.length, 2);
  t.mock.timers.tick(1000);
  assert.equal(f.writes.length, 2);
});

test("opening settings renders current logs immediately even when no write is pending", () => {
  const f = fixture();
  let open = false;
  f.context.refs.configDrawer = {
    classList: { contains: () => open, toggle(name, value) { open = value; f.setOpen(value); } },
    setAttribute() {},
  };
  Object.assign(f.context, {
    TOPBAR_SUPPRESSED_CLASS: "open", syncGenerationSchedulingLock() {}, setTopbarReveal() {},
    captureOverlayTrigger() {}, focusOverlayTarget() {}, restoreOverlayTriggerFocus() {},
  });
  f.document.documentElement = { classList: { toggle() {} } };
  runInNewContext(between("function setDrawerOpen(", "function openConfigGenerationLog("), f.context);
  f.context.setDrawerOpen(true);
  assert.equal(f.calls.timeline, 1);
});
