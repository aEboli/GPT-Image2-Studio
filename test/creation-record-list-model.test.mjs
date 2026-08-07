import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CREATION_RECORD_LIST_BATCH_SIZE,
  buildCreationRecordListModel,
  createCreationRecordListState,
  getCreationRecordListTimestamp,
  getCreationRecordTemuExportStatus,
  loadMoreCreationRecordListState,
} from "../lib/creation-record-list-model.mjs";

function makeSets(count) {
  return Array.from({ length: count }, (_, index) => ({
    setId: `set-${String(index + 1).padStart(3, "0")}`,
    createdAt: `2026-08-05T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
  }));
}

test("creation record list shows the first 60 matching sets without hiding the total", () => {
  const sets = makeSets(75);
  const state = createCreationRecordListState("query=shoe&window=all");
  const model = buildCreationRecordListModel(sets, {
    state,
    filterSignature: "query=shoe&window=all",
  });

  assert.equal(CREATION_RECORD_LIST_BATCH_SIZE, 60);
  assert.deepEqual(model.visibleSets, sets.slice(0, 60));
  assert.equal(model.shownCount, 60);
  assert.equal(model.totalCount, 75);
  assert.equal(model.hasMore, true);
  assert.deepEqual(model.state, {
    filterSignature: "query=shoe&window=all",
    visibleLimit: 60,
  });
});

test("load-more advances by 60 until every matching set is visible", () => {
  const sets = makeSets(130);
  const initialState = createCreationRecordListState("all");
  const secondBatchState = loadMoreCreationRecordListState(initialState, "all");
  const secondBatch = buildCreationRecordListModel(sets, {
    state: secondBatchState,
    filterSignature: "all",
  });

  assert.deepEqual(secondBatchState, {
    filterSignature: "all",
    visibleLimit: 120,
  });
  assert.equal(secondBatch.shownCount, 120);
  assert.equal(secondBatch.totalCount, 130);
  assert.equal(secondBatch.hasMore, true);

  const finalState = loadMoreCreationRecordListState(secondBatch.state, "all");
  const finalBatch = buildCreationRecordListModel(sets, {
    state: finalState,
    filterSignature: "all",
  });

  assert.equal(finalState.visibleLimit, 180);
  assert.equal(finalBatch.shownCount, 130);
  assert.equal(finalBatch.hasMore, false);
  assert.deepEqual(finalBatch.visibleSets, sets);
  assert.deepEqual(initialState, {
    filterSignature: "all",
    visibleLimit: 60,
  });
});

test("a changed filter signature resets pagination before another load-more action", () => {
  const loadedState = loadMoreCreationRecordListState(
    createCreationRecordListState("query=old"),
    "query=old",
  );
  const resetModel = buildCreationRecordListModel(makeSets(90), {
    state: loadedState,
    filterSignature: "query=new",
  });

  assert.equal(resetModel.shownCount, 60);
  assert.equal(resetModel.hasMore, true);
  assert.deepEqual(resetModel.state, {
    filterSignature: "query=new",
    visibleLimit: 60,
  });
  assert.deepEqual(loadMoreCreationRecordListState(loadedState, "query=new"), {
    filterSignature: "query=new",
    visibleLimit: 60,
  });
});

test("creation record list handles non-array input without mutating caller state", () => {
  const state = Object.freeze({ filterSignature: "all", visibleLimit: 120 });
  const model = buildCreationRecordListModel(null, {
    state,
    filterSignature: "all",
  });

  assert.deepEqual(model.visibleSets, []);
  assert.equal(model.shownCount, 0);
  assert.equal(model.totalCount, 0);
  assert.equal(model.hasMore, false);
  assert.notEqual(model.state, state);
  assert.deepEqual(state, { filterSignature: "all", visibleLimit: 120 });
});

test("Temu export status distinguishes unexported, strict current, strict stale, and draft", () => {
  const updatedAt = "2026-08-05T08:00:00.000Z";

  assert.deepEqual(getCreationRecordTemuExportStatus({ updatedAt }), {
    key: "not-exported",
    label: "未导出",
    tone: "neutral",
  });
  assert.deepEqual(
    getCreationRecordTemuExportStatus({
      updatedAt,
      temuExcelExportState: { mode: "strict", sourceUpdatedAt: updatedAt },
    }),
    { key: "exported", label: "已导出", tone: "success" },
  );
  assert.deepEqual(
    getCreationRecordTemuExportStatus({
      updatedAt,
      temuExcelExportState: {
        mode: "strict",
        sourceUpdatedAt: "2026-08-05T07:00:00.000Z",
      },
    }),
    { key: "modified", label: "已修改", tone: "warning" },
  );
  assert.deepEqual(
    getCreationRecordTemuExportStatus({
      updatedAt,
      temuExcelExportState: { mode: "draft", sourceUpdatedAt: updatedAt },
    }),
    { key: "draft", label: "待补全导出", tone: "info" },
  );
});

test("strict export status is conservative when timestamps cannot be compared", () => {
  assert.equal(
    getCreationRecordTemuExportStatus({
      temuExcelExportState: { mode: "strict", sourceUpdatedAt: "" },
    }).key,
    "modified",
  );
  assert.equal(
    getCreationRecordTemuExportStatus({
      updatedAt: "2026-08-05T08:00:00.000Z",
      temuExcelExportState: { mode: "unknown" },
    }).key,
    "not-exported",
  );
});

test("record list timestamp uses createdAt and never falls back to updatedAt", () => {
  assert.equal(
    getCreationRecordListTimestamp({
      createdAt: "2026-08-01T03:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    }),
    "2026-08-01T03:00:00.000Z",
  );
  assert.equal(
    getCreationRecordListTimestamp({ updatedAt: "2026-08-05T09:00:00.000Z" }),
    "",
  );
});

test("creation record list browser module is an exact public mirror", async () => {
  const [source, publicMirror] = await Promise.all([
    readFile(new URL("../lib/creation-record-list-model.mjs", import.meta.url)),
    readFile(new URL("../public/lib/creation-record-list-model.mjs", import.meta.url)),
  ]);

  assert.equal(source.equals(publicMirror), true);
});
