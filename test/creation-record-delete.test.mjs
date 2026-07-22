import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreationRecordDeleteConfirmation,
  getCreationRecordDeleteTargets,
  normalizeCreationRecordDeleteSetIds,
  resolveCreationRecordSelectionAfterDelete,
} from "../lib/creation-record-delete.mjs";

const sets = [
  { setId: "set-a", productName: "商品 A" },
  { setId: "set-b", productName: "商品 B" },
  { setId: "set-c", productName: "商品 C" },
];

test("creation record deletion normalizes a bounded distinct ID batch", () => {
  assert.deepEqual(normalizeCreationRecordDeleteSetIds([" set-a ", "set-a", "set-b"]), ["set-a", "set-b"]);
  assert.throws(() => normalizeCreationRecordDeleteSetIds([]), /至少选择一套/u);
  assert.throws(() => normalizeCreationRecordDeleteSetIds("set-a"), /数组/u);
  assert.throws(
    () => normalizeCreationRecordDeleteSetIds(["set-a", "set-b"], { maxCount: 1 }),
    /最多删除 1 套/u,
  );
});

test("creation record deletion resolves current and checked targets independently", () => {
  assert.deepEqual(
    getCreationRecordDeleteTargets({ mode: "current", allSets: sets, currentSetId: "set-b" }),
    [sets[1]],
  );
  assert.deepEqual(
    getCreationRecordDeleteTargets({
      mode: "selected",
      allSets: sets,
      currentSetId: "set-a",
      checkedSetIds: ["set-c", "stale", "set-a", "set-c"],
    }),
    [sets[0], sets[2]],
  );
});

test("creation record filtered deletion requires an explicit keyword or time filter and uses every match", () => {
  const filteredSets = Array.from({ length: 75 }, (_, index) => ({
    setId: `filtered-${index + 1}`,
    productName: `筛选商品 ${index + 1}`,
  }));

  assert.deepEqual(
    getCreationRecordDeleteTargets({
      mode: "filtered",
      allSets: filteredSets,
      filteredSets,
      query: "   ",
      hasFilter: false,
    }),
    [],
  );
  assert.equal(
    getCreationRecordDeleteTargets({
      mode: "filtered",
      allSets: filteredSets,
      filteredSets,
      query: "",
      hasFilter: true,
    }).length,
    75,
  );
  assert.equal(
    getCreationRecordDeleteTargets({
      mode: "filtered",
      allSets: filteredSets,
      filteredSets,
      query: "筛选商品",
    }).length,
    75,
  );
});

test("creation record deletion confirmation describes mode count and irreversible assets", () => {
  const single = buildCreationRecordDeleteConfirmation({ mode: "current", targets: [sets[0]] });
  assert.match(single.title, /删除这套套图/u);
  assert.match(single.message, /商品 A/u);
  assert.match(single.message, /生成图片/u);
  assert.match(single.message, /无法撤销/u);

  const filtered = buildCreationRecordDeleteConfirmation({
    mode: "filtered",
    targets: sets,
    query: "商品",
    filterLabel: "关键词：商品、时间：今天",
  });
  assert.match(filtered.title, /筛选结果/u);
  assert.match(filtered.message, /3 套/u);
  assert.match(filtered.message, /商品/u);
  assert.match(filtered.message, /今天/u);
  assert.equal(filtered.confirmLabel, "删除 3 套");
});

test("creation record deletion keeps or advances the detail selection without a list reload", () => {
  assert.equal(
    resolveCreationRecordSelectionAfterDelete({
      filteredSets: sets,
      currentSetId: "set-b",
      deletedSetIds: ["set-a"],
    }),
    "set-b",
  );
  assert.equal(
    resolveCreationRecordSelectionAfterDelete({
      filteredSets: sets,
      currentSetId: "set-b",
      deletedSetIds: ["set-b"],
    }),
    "set-c",
  );
  assert.equal(
    resolveCreationRecordSelectionAfterDelete({
      filteredSets: sets,
      currentSetId: "set-c",
      deletedSetIds: ["set-c"],
    }),
    "set-b",
  );
  assert.equal(
    resolveCreationRecordSelectionAfterDelete({
      filteredSets: sets,
      currentSetId: "set-b",
      deletedSetIds: ["set-b", "set-c"],
    }),
    "set-a",
  );
  assert.equal(
    resolveCreationRecordSelectionAfterDelete({
      filteredSets: sets,
      currentSetId: "set-b",
      deletedSetIds: ["set-a", "set-b", "set-c"],
    }),
    "",
  );
});
