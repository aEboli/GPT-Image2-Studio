import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  createGenerationLogStore,
  getGenerationLogChannelEntries,
  normalizeGenerationLogRelayUrl,
  parseGenerationLogStore,
  serializeGenerationLogStore,
  upsertGenerationLogEntry,
} from "../lib/generation-log-store.mjs";

const app = (await readFile(new URL("../public/app.js", import.meta.url), "utf8")).replace(/\r?\n/gu, "\r\n");

function readFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const source = app.slice(start);
  const closing = /\r?\n\}(\r?\n)/u.exec(source);
  assert.ok(closing, `missing end of ${name}`);
  const end = closing.index + closing[0].length - closing[1].length;
  return source.slice(0, end);
}

function createHarness() {
  const state = {
    config: { baseUrl: "https://current.example.test/v1", directImageBaseUrl: "https://current-direct.example.test/v1" },
    generationLog: createGenerationLogStore(),
  };
  const context = vm.createContext({
    state,
    normalizeGenerationLogRelayUrl,
    getSelectedImageRoute: () => "b",
    normalizeGenerationTaskStatus: (status) => status,
    compactErrorMessage: (message) => message,
    buildGenerationTaskActivityDetail: ({ statusText }) => statusText,
    formatCompactRatioLabel: (value) => value,
    formatCompactSizeLabel: (value) => value,
    formatGenerationActivityModeLabel: (value) => value,
    getJobLogChannel: () => "prompt",
    getImageUrl: () => "",
    GENERATION_TASK_STATUS_LABELS: { running: "生成中", completed: "已完成", error: "生成失败" },
    GENERATION_TASK_TIMELINE_STATUS: { running: "active", completed: "done", error: "error" },
    recordActivity: (entry) => { state.generationLog = upsertGenerationLogEntry(state.generationLog, entry); },
  });
  vm.runInContext([
    readFunction("resolveGenerationRelayUrl"),
    // This helper is intentionally a single line in app.js.
    app.match(/^function buildGenerationActivityRelayUrl\([^\n]+/m)[0],
    readFunction("recordGenerationTaskActivity"),
  ].join("\n"), context);
  return context;
}

test("polling old failed tasks after switching API preserves their queued URLs, including after reload", () => {
  const context = createHarness();
  const originalUrl = "https://original.example.test/v1";
  context.state.generationLog = upsertGenerationLogEntry(context.state.generationLog, {
    channel: "prompt", key: "old-job:task", relayUrl: originalUrl, status: "active",
  });
  const snapshot = { id: "old-job", imageRoute: "b", status: "error", errorMessage: "HTTP 502" };
  context.recordGenerationTaskActivity(snapshot);
  assert.equal(getGenerationLogChannelEntries(context.state.generationLog, "prompt")[0].relayUrl, originalUrl);

  context.state.config.directImageBaseUrl = "https://another.example.test/v1";
  context.state.generationLog = parseGenerationLogStore(JSON.stringify(serializeGenerationLogStore(context.state.generationLog)));
  context.recordGenerationTaskActivity(snapshot);
  assert.equal(getGenerationLogChannelEntries(context.state.generationLog, "prompt")[0].relayUrl, originalUrl);
});

test("server task base URL wins over current configuration for every image route", () => {
  const context = createHarness();
  for (const imageRoute of ["a", "b", "c", "d"]) {
    const baseUrl = `https://${imageRoute}.example.test/v1`;
    assert.equal(context.resolveGenerationRelayUrl({ imageRoute, baseUrl }), baseUrl);
  }
  assert.equal(context.resolveGenerationRelayUrl({ imageRoute: "b", directImageBaseUrl: "https://direct.example.test/v1" }), "https://direct.example.test/v1");
  assert.equal(context.resolveGenerationRelayUrl({ imageRoute: "c", protocolBaseUrl: "https://gemini.example.test/v1" }), "https://gemini.example.test/v1");
  assert.equal(context.resolveGenerationRelayUrl({ imageRoute: "d", grokBaseUrl: "https://grok.example.test/v1" }), "https://grok.example.test/v1");
});

test("unknown historical URLs remain unknown instead of borrowing the selected API", () => {
  const context = createHarness();
  assert.equal(context.resolveGenerationRelayUrl({}), "");
  context.recordGenerationTaskActivity({ id: "unknown-job", imageRoute: "b", status: "error" });
  assert.equal(getGenerationLogChannelEntries(context.state.generationLog, "prompt")[0].relayUrl, "");
});

test("a successful result can still refine the original task URL", () => {
  const context = createHarness();
  context.recordGenerationTaskActivity({ id: "job", imageRoute: "b", baseUrl: "https://queued.example.test/v1", status: "running" });
  context.recordGenerationTaskActivity({ id: "job", imageRoute: "b", status: "completed", item: { baseUrl: "https://actual.example.test/v1" } });
  assert.equal(getGenerationLogChannelEntries(context.state.generationLog, "prompt")[0].relayUrl, "https://actual.example.test/v1");
});
