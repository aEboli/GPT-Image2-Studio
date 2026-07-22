import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssetRecordDeleteConfirmation,
  getAssetRecordDeleteTargets,
  normalizeAssetRecordDeleteIds,
  resolveAssetRecordSelectionAfterDelete,
} from "../lib/asset-record-delete.mjs";

const records = [
  { id: "record-a", title: "第一条" },
  { id: "record-b", title: "第二条" },
  { id: "record-c", title: "第三条" },
];

test("asset record deletion normalizes bounded distinct identifiers", () => {
  assert.deepEqual(
    normalizeAssetRecordDeleteIds([" record-a ", "record-a", "record-b"], { recordLabel: "写真记录" }),
    ["record-a", "record-b"],
  );
  assert.throws(() => normalizeAssetRecordDeleteIds("record-a"), /数组/);
  assert.throws(() => normalizeAssetRecordDeleteIds([]), /至少选择/);
  assert.throws(() => normalizeAssetRecordDeleteIds(["a", "b"], { maxCount: 1 }), /一次最多删除 1/);
  assert.throws(() => normalizeAssetRecordDeleteIds(["x".repeat(201)]), /过长/);
});

test("asset record deletion keeps current and checked targets independent", () => {
  assert.deepEqual(
    getAssetRecordDeleteTargets({
      mode: "current",
      records,
      getId: (record) => record.id,
      currentId: "record-b",
      checkedIds: ["record-a", "record-c"],
    }).map((record) => record.id),
    ["record-b"],
  );
  assert.deepEqual(
    getAssetRecordDeleteTargets({
      mode: "selected",
      records,
      getId: (record) => record.id,
      currentId: "record-b",
      checkedIds: ["record-c", "record-a", "record-c", "stale"],
    }).map((record) => record.id),
    ["record-a", "record-c"],
  );
});

test("asset record deletion resolves the next then previous surviving selection", () => {
  assert.equal(
    resolveAssetRecordSelectionAfterDelete({
      records,
      getId: (record) => record.id,
      currentId: "record-b",
      deletedIds: ["record-b"],
    }),
    "record-c",
  );
  assert.equal(
    resolveAssetRecordSelectionAfterDelete({
      records,
      getId: (record) => record.id,
      currentId: "record-c",
      deletedIds: ["record-b", "record-c"],
    }),
    "record-a",
  );
  assert.equal(
    resolveAssetRecordSelectionAfterDelete({
      records,
      getId: (record) => record.id,
      currentId: "record-a",
      deletedIds: ["record-a", "record-b", "record-c"],
    }),
    "",
  );
});

test("asset record deletion confirmation identifies current name and selected count", () => {
  assert.deepEqual(
    buildAssetRecordDeleteConfirmation({
      mode: "current",
      targets: [records[0]],
      assetLabel: "文章插图",
      unitLabel: "套",
      getLabel: (record) => record.title,
      deleteScope: "对应记录、生成图片和 JSON 元数据将被永久删除，无法撤销。",
    }),
    {
      title: "删除这套文章插图？",
      message: "即将删除“第一条”。对应记录、生成图片和 JSON 元数据将被永久删除，无法撤销。",
      confirmLabel: "确认删除",
    },
  );
  assert.deepEqual(
    buildAssetRecordDeleteConfirmation({
      mode: "selected",
      targets: records.slice(0, 2),
      assetLabel: "PPT 记录",
      unitLabel: "个",
      deleteScope: "对应 PPTX、页面图片和记录将被永久删除，无法撤销。",
    }),
    {
      title: "删除选中的 PPT 记录？",
      message: "已选择 2 个。对应 PPTX、页面图片和记录将被永久删除，无法撤销。",
      confirmLabel: "删除 2 个",
    },
  );
  assert.deepEqual(
    buildAssetRecordDeleteConfirmation({
      mode: "current",
      targets: [{ title: "季度复盘" }],
      assetLabel: "PPT 记录",
      unitLabel: "条",
    }),
    {
      title: "删除这条 PPT 记录？",
      message: "即将删除“季度复盘”。对应记录和资产将被永久删除，无法撤销。",
      confirmLabel: "确认删除",
    },
  );
});
