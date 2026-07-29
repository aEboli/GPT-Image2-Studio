import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssetRecordTimeFilterOptions,
  filterAssetRecordsByTime,
  formatAssetRecordTimeFilterLabel,
  hasActiveAssetRecordTimeFilter,
  normalizeAssetRecordDateFilter,
  normalizeAssetRecordTimeFilter,
} from "../lib/asset-record-time-filter.mjs";

function localTimestamp(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

const referenceNow = new Date(2026, 6, 24, 15, 30, 0, 0);
const records = [
  { recordId: "today", createdAt: localTimestamp(2026, 7, 24, 1) },
  { recordId: "recent-edge", createdAt: localTimestamp(2026, 7, 18) },
  { recordId: "older-edge", createdAt: localTimestamp(2026, 7, 17) },
  { recordId: "future", createdAt: localTimestamp(2026, 7, 25) },
  { recordId: "invalid", createdAt: "not-a-date" },
  { recordId: "missing" },
];

test("asset record time filters normalize supported windows and exact dates", () => {
  assert.equal(normalizeAssetRecordTimeFilter(" recent "), "recent");
  assert.equal(normalizeAssetRecordTimeFilter("unexpected"), "all");
  assert.equal(normalizeAssetRecordDateFilter("2026-07-18"), "2026-07-18");
  assert.equal(normalizeAssetRecordDateFilter("2026-02-30"), "");
  assert.equal(normalizeAssetRecordDateFilter("18/07/2026"), "");
  assert.equal(hasActiveAssetRecordTimeFilter({ window: "all", date: "" }), false);
  assert.equal(hasActiveAssetRecordTimeFilter({ window: "today", date: "" }), true);
  assert.equal(hasActiveAssetRecordTimeFilter({ window: "all", date: "2026-07-18" }), true);
});

test("asset record time filters use local calendar-day boundaries", () => {
  assert.deepEqual(
    filterAssetRecordsByTime(records, { window: "today" }, referenceNow).map(
      (record) => record.recordId,
    ),
    ["today"],
  );
  assert.deepEqual(
    filterAssetRecordsByTime(records, { window: "recent" }, referenceNow).map(
      (record) => record.recordId,
    ),
    ["today", "recent-edge"],
  );
  assert.deepEqual(
    filterAssetRecordsByTime(records, { window: "older" }, referenceNow).map(
      (record) => record.recordId,
    ),
    ["older-edge"],
  );
  assert.deepEqual(
    filterAssetRecordsByTime(records, { window: "older", date: "2026-07-18" }, referenceNow).map(
      (record) => record.recordId,
    ),
    ["recent-edge"],
  );
});

test("bounded windows exclude invalid and future records while all retains them", () => {
  for (const window of ["today", "recent", "older"]) {
    const recordIds = filterAssetRecordsByTime(records, { window }, referenceNow).map(
      (record) => record.recordId,
    );
    assert.equal(recordIds.includes("future"), false);
    assert.equal(recordIds.includes("invalid"), false);
    assert.equal(recordIds.includes("missing"), false);
  }

  assert.deepEqual(
    filterAssetRecordsByTime(records, { window: "all" }, referenceNow).map(
      (record) => record.recordId,
    ),
    records.map((record) => record.recordId),
  );
});

test("asset record time filter options count all and bounded records", () => {
  assert.deepEqual(buildAssetRecordTimeFilterOptions(records, referenceNow), [
    { value: "all", label: "全部", count: 6 },
    { value: "today", label: "今天", count: 1 },
    { value: "recent", label: "近 7 天", count: 2 },
    { value: "older", label: "更早", count: 1 },
  ]);
  assert.equal(formatAssetRecordTimeFilterLabel({ window: "recent" }), "近 7 天");
  assert.equal(
    formatAssetRecordTimeFilterLabel({ window: "all", date: "2026-07-18" }),
    "日期 2026-07-18",
  );
  assert.equal(formatAssetRecordTimeFilterLabel({ window: "all", date: "" }), "");
});
