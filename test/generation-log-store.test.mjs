import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GENERATION_LOG_CHANNEL,
  GENERATION_LOG_CHANNEL_LIMIT,
  GENERATION_LOG_GROUP_CHILD_LIMIT,
  createGenerationLogStore,
  formatGenerationLogGroupSummary,
  formatGenerationLogRelayText,
  getGenerationLogAllEntries,
  getGenerationLogChannelEntries,
  getGenerationLogChannelLabel,
  getGenerationLogGroupItemDetail,
  isGenerationLogBatchChannel,
  normalizeGenerationLogChannel,
  normalizeGenerationLogRelayUrl,
  parseGenerationLogStore,
  serializeGenerationLogStore,
  summarizeGenerationLogGroup,
  upsertGenerationLogEntry,
  upsertGenerationLogGroupEntry,
} from "../lib/generation-log-store.mjs";

function buildEntry(overrides = {}) {
  return {
    channel: "prompt",
    key: "job-1:task",
    title: "生成中",
    detail: "正在生成图片",
    status: "active",
    at: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

test("generation log channels are normalized and unknown channels fall back to prompt", () => {
  assert.equal(normalizeGenerationLogChannel("creation"), "creation");
  assert.equal(normalizeGenerationLogChannel("image-edit"), "image-edit");
  assert.equal(normalizeGenerationLogChannel(""), DEFAULT_GENERATION_LOG_CHANNEL);
  assert.equal(normalizeGenerationLogChannel("gallery"), DEFAULT_GENERATION_LOG_CHANNEL);
  assert.equal(getGenerationLogChannelLabel("quick-blend"), "快速溶图");
  assert.equal(isGenerationLogBatchChannel("creation"), true);
  assert.equal(isGenerationLogBatchChannel("portrait"), true);
  assert.equal(isGenerationLogBatchChannel("prompt"), false);
});

test("generation log keeps each channel partition independent", () => {
  const filledStore = Array.from({ length: GENERATION_LOG_CHANNEL_LIMIT + 3 }).reduce((store, _value, index) => {
    return upsertGenerationLogEntry(store, buildEntry({ key: `job-${index}:task`, at: `2026-08-28T10:${String(index).padStart(2, "0")}:00.000Z` }));
  }, upsertGenerationLogEntry(createGenerationLogStore(), buildEntry({ channel: "image-edit", key: "edit-1:task", detail: "图片编辑生成中" })));

  const promptEntries = getGenerationLogChannelEntries(filledStore, "prompt");
  const editEntries = getGenerationLogChannelEntries(filledStore, "image-edit");
  assert.equal(promptEntries.length, GENERATION_LOG_CHANNEL_LIMIT);
  assert.equal(promptEntries[0].key, `job-${GENERATION_LOG_CHANNEL_LIMIT + 2}:task`);
  assert.equal(editEntries.length, 1);
  assert.equal(editEntries[0].key, "edit-1:task");
  assert.equal(promptEntries.some((entry) => entry.key === "edit-1:task"), false);
});

test("generation log entries keep their first order slot while text updates", () => {
  const startedStore = upsertGenerationLogEntry(createGenerationLogStore(), buildEntry());
  const laterStore = upsertGenerationLogEntry(startedStore, buildEntry({ key: "job-2:task", at: "2026-08-28T10:05:00.000Z" }));
  const updatedStore = upsertGenerationLogEntry(laterStore, buildEntry({ detail: "图像已成功生成", status: "done", at: "2026-08-28T10:09:00.000Z" }));

  const entries = getGenerationLogChannelEntries(updatedStore, "prompt");
  assert.deepEqual(entries.map((entry) => entry.key), ["job-2:task", "job-1:task"]);
  assert.equal(entries[1].detail, "图像已成功生成");
  assert.equal(entries[1].at, "2026-08-28T10:09:00.000Z");
  assert.equal(entries[1].orderAt, "2026-08-28T10:00:00.000Z");
});

test("generation log relay url is stored bare and rendered with one prefix", () => {
  assert.equal(normalizeGenerationLogRelayUrl("https://api.agicto.cn/v1"), "https://api.agicto.cn/v1");
  assert.equal(normalizeGenerationLogRelayUrl("URL：https://api.agicto.cn/v1"), "https://api.agicto.cn/v1");
  assert.equal(normalizeGenerationLogRelayUrl("中转: https://api.agicto.cn/v1"), "https://api.agicto.cn/v1");
  assert.equal(normalizeGenerationLogRelayUrl(""), "");
  assert.equal(formatGenerationLogRelayText("https://api.agicto.cn/v1"), "URL：https://api.agicto.cn/v1");
  assert.equal(formatGenerationLogRelayText("URL：https://api.agicto.cn/v1"), "URL：https://api.agicto.cn/v1");
  assert.equal(formatGenerationLogRelayText(""), "");
});

test("generation log keeps the queued relay url across later updates and lets a result refine it", () => {
  const queuedStore = upsertGenerationLogEntry(createGenerationLogStore(), buildEntry({ relayUrl: "https://api.agicto.cn/v1" }));
  const failedStore = upsertGenerationLogEntry(queuedStore, buildEntry({ detail: "最终失败：fetch failed", status: "error", at: "2026-08-28T10:02:00.000Z" }));
  assert.equal(getGenerationLogChannelEntries(failedStore, "prompt")[0].relayUrl, "https://api.agicto.cn/v1");

  const refinedStore = upsertGenerationLogEntry(failedStore, buildEntry({ key: "job-2:task", relayUrl: "https://api.agicto.cn/v1" }));
  const resultStore = upsertGenerationLogEntry(refinedStore, buildEntry({ key: "job-2:task", relayUrl: "https://api.openai.com/v1", status: "done" }));
  assert.equal(getGenerationLogChannelEntries(resultStore, "prompt").find((entry) => entry.key === "job-2:task").relayUrl, "https://api.openai.com/v1");
});

test("generation log failure entry keeps the queued relay url when the job is already gone", () => {
  // The failure path can fire after the job left state.jobs, so it may pass no
  // relay url at all. The queued value must survive rather than blanking the row.
  const queuedStore = upsertGenerationLogEntry(createGenerationLogStore(), buildEntry({ relayUrl: "https://api.agicto.cn/v1" }));
  const failedStore = upsertGenerationLogEntry(queuedStore, buildEntry({
    title: "失败",
    detail: "最终失败：fetch failed",
    status: "error",
    relayUrl: "",
    at: "2026-08-28T10:03:00.000Z",
  }));

  const entry = getGenerationLogChannelEntries(failedStore, "prompt")[0];
  assert.equal(entry.status, "error");
  assert.equal(entry.relayUrl, "https://api.agicto.cn/v1");
  assert.equal(formatGenerationLogRelayText(entry.relayUrl), "URL：https://api.agicto.cn/v1");
});

test("generation log groups a batch into one row with derived counts", () => {
  const store = ["a", "b", "c", "d"].reduce((accumulator, itemId, index) => {
    return upsertGenerationLogGroupEntry(accumulator, {
      channel: "creation",
      groupId: "set-1",
      groupLabel: "套图批次",
      groupItemId: itemId,
      totalCount: 8,
      relayUrl: "https://api.agicto.cn/v1",
      title: `第 ${index + 1} 张`,
      detail: "正在生成图片",
      status: "active",
      at: `2026-08-28T10:0${index}:00.000Z`,
    });
  }, createGenerationLogStore());

  const rows = getGenerationLogChannelEntries(store, "creation");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "group");
  assert.equal(rows[0].groupId, "set-1");
  assert.equal(rows[0].children.length, 4);
  assert.equal(rows[0].relayUrl, "https://api.agicto.cn/v1");

  const settledStore = ["a", "b", "c", "d", "e"].reduce((accumulator, itemId, index) => {
    return upsertGenerationLogGroupEntry(accumulator, {
      channel: "creation",
      groupId: "set-1",
      groupItemId: itemId,
      status: index < 4 ? "done" : "error",
      detail: index < 4 ? "图像已成功生成" : "最终失败：上游响应结束",
      at: "2026-08-28T10:10:00.000Z",
    });
  }, store);

  const settledGroup = getGenerationLogChannelEntries(settledStore, "creation")[0];
  const summary = summarizeGenerationLogGroup(settledGroup);
  assert.deepEqual(summary, { totalCount: 8, completedCount: 4, failedCount: 1, runningCount: 3, status: "active" });
  assert.equal(formatGenerationLogGroupSummary(settledGroup), "8 张 · 完成 4 · 失败 1 · 进行中 3");
});

test("generation log group status reflects running, failed, and completed children", () => {
  function buildGroup(statuses, totalCount) {
    return { totalCount, children: statuses.map((status, index) => ({ key: `item-${index}`, status })) };
  }

  assert.equal(summarizeGenerationLogGroup(buildGroup(["done", "done", "active"], 3)).status, "active");
  assert.equal(summarizeGenerationLogGroup(buildGroup(["done", "done", "error"], 3)).status, "error");
  assert.equal(summarizeGenerationLogGroup(buildGroup(["done", "done"], 2)).status, "done");
  /* 计划里还有没开始的图时组行保持进行中，不能因为已有条目都完成就提前判完成。 */
  assert.equal(summarizeGenerationLogGroup(buildGroup(["done", "done"], 8)).status, "active");
  assert.equal(summarizeGenerationLogGroup(buildGroup(["done", "done"], 8)).runningCount, 6);
  assert.deepEqual(summarizeGenerationLogGroup(buildGroup(["error"], 0)), {
    totalCount: 1,
    completedCount: 0,
    failedCount: 1,
    runningCount: 0,
    status: "error",
  });
});

test("generation log group keeps the newest children within the child limit and stays one row", () => {
  const store = Array.from({ length: GENERATION_LOG_GROUP_CHILD_LIMIT + 5 }).reduce((accumulator, _value, index) => {
    return upsertGenerationLogGroupEntry(accumulator, {
      channel: "creation",
      groupId: "set-1",
      groupItemId: `item-${index}`,
      title: `第 ${index + 1} 张`,
      status: "done",
      at: "2026-08-28T10:00:00.000Z",
    });
  }, createGenerationLogStore());

  const rows = getGenerationLogChannelEntries(store, "creation");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].children.length, GENERATION_LOG_GROUP_CHILD_LIMIT);
  assert.equal(rows[0].children.at(0).groupItemId, "item-5");
  assert.equal(rows[0].children.at(-1).groupItemId, `item-${GENERATION_LOG_GROUP_CHILD_LIMIT + 4}`);
});

test("generation log group order stays stable while children keep arriving", () => {
  const firstGroupStore = upsertGenerationLogGroupEntry(createGenerationLogStore(), {
    channel: "creation",
    groupId: "set-1",
    groupItemId: "a",
    status: "active",
    at: "2026-08-28T10:00:00.000Z",
  });
  const secondGroupStore = upsertGenerationLogGroupEntry(firstGroupStore, {
    channel: "creation",
    groupId: "set-2",
    groupItemId: "a",
    status: "active",
    at: "2026-08-28T10:05:00.000Z",
  });
  const updatedStore = upsertGenerationLogGroupEntry(secondGroupStore, {
    channel: "creation",
    groupId: "set-1",
    groupItemId: "b",
    status: "done",
    at: "2026-08-28T10:09:00.000Z",
  });

  assert.deepEqual(getGenerationLogChannelEntries(updatedStore, "creation").map((row) => row.groupId), ["set-2", "set-1"]);
});

test("generation log group item details stay isolated when queues reuse an item ID", () => {
  const failedStore = upsertGenerationLogGroupEntry(createGenerationLogStore(), {
    channel: "creation",
    groupId: "set-old",
    groupItemId: "hero",
    detail: "生成请求失败：HTTP 404",
    status: "error",
    at: "2026-08-28T10:00:00.000Z",
  });
  const activeStore = upsertGenerationLogGroupEntry(failedStore, {
    channel: "creation",
    groupId: "set-new",
    groupItemId: "hero",
    detail: "正在生成图片",
    status: "active",
    at: "2026-08-28T10:01:00.000Z",
  });

  assert.equal(getGenerationLogGroupItemDetail(activeStore, "creation", "set-old", "hero"), "生成请求失败：HTTP 404");
  assert.equal(getGenerationLogGroupItemDetail(activeStore, "creation", "set-new", "hero"), "正在生成图片");
  assert.equal(getGenerationLogGroupItemDetail(activeStore, "creation", "", "hero"), "");
});

test("generation log cross-channel view labels every row with its channel", () => {
  const store = upsertGenerationLogGroupEntry(
    upsertGenerationLogEntry(createGenerationLogStore(), buildEntry({ at: "2026-08-28T10:00:00.000Z" })),
    { channel: "creation", groupId: "set-1", groupItemId: "a", status: "active", at: "2026-08-28T10:01:00.000Z" },
  );

  const rows = getGenerationLogAllEntries(store);
  assert.deepEqual(rows.map((row) => row.channel), ["creation", "prompt"]);
});

test("generation log persists per channel and migrates the legacy single feed", () => {
  const store = upsertGenerationLogGroupEntry(
    upsertGenerationLogEntry(createGenerationLogStore(), buildEntry({ relayUrl: "https://api.agicto.cn/v1", status: "done" })),
    { channel: "creation", groupId: "set-1", groupItemId: "a", status: "done", at: "2026-08-28T10:01:00.000Z" },
  );

  const restored = parseGenerationLogStore(JSON.stringify(serializeGenerationLogStore(store)));
  assert.equal(getGenerationLogChannelEntries(restored, "prompt")[0].relayUrl, "https://api.agicto.cn/v1");
  assert.equal(getGenerationLogChannelEntries(restored, "creation")[0].children.length, 1);

  const legacy = parseGenerationLogStore(JSON.stringify([{ key: "job-old:task", title: "已完成", detail: "图像已成功生成", status: "done", at: "2026-08-27T10:00:00.000Z", paramsText: "URL：https://api.agicto.cn/v1" }]));
  const migrated = getGenerationLogChannelEntries(legacy, "prompt");
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].key, "job-old:task");
  assert.equal(migrated[0].detail, "图像已成功生成");
  assert.equal(migrated[0].status, "done");
  assert.equal(migrated[0].at, "2026-08-27T10:00:00.000Z");
});

test("generation log parsing applies the caller row normalizer and survives corrupted storage", () => {
  const normalized = parseGenerationLogStore(JSON.stringify([{ key: "job-1:task", title: "生成中", detail: "正在生成图片", status: "active", at: "2026-08-27T10:00:00.000Z" }]), {
    normalizeRow: (row) => (row?.status === "active" ? { ...row, status: "error", detail: "上次页面关闭前生成未完成，请重新生成" } : row),
  });
  assert.equal(getGenerationLogChannelEntries(normalized, "prompt")[0].status, "error");

  assert.deepEqual(parseGenerationLogStore("{not json").channels, {});
  assert.deepEqual(parseGenerationLogStore("").channels, {});
  assert.deepEqual(parseGenerationLogStore(null).channels, {});
  assert.deepEqual(parseGenerationLogStore('"text"').channels, {});
});
