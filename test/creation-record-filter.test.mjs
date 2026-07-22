import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreationRecordTimeFilterOptions,
  filterCreationRecordSetsByTime,
  formatCreationRecordTimeFilterLabel,
  hasActiveCreationRecordTimeFilter,
  normalizeCreationRecordDateFilter,
  normalizeCreationRecordTimeFilter,
} from "../lib/creation-record-filter.mjs";

function localTimestamp(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

const referenceNow = new Date(2026, 6, 22, 15, 30, 0, 0);
const sets = [
  { setId: "today", createdAt: localTimestamp(2026, 7, 22, 1) },
  { setId: "recent-edge", createdAt: localTimestamp(2026, 7, 16) },
  { setId: "older-edge", createdAt: localTimestamp(2026, 7, 15) },
  { setId: "future", createdAt: localTimestamp(2026, 7, 23) },
  { setId: "invalid", createdAt: "not-a-date" },
  { setId: "missing" },
];

test("creation record time filters normalize supported windows and exact dates", () => {
  assert.equal(normalizeCreationRecordTimeFilter(" recent "), "recent");
  assert.equal(normalizeCreationRecordTimeFilter("unexpected"), "all");
  assert.equal(normalizeCreationRecordDateFilter("2026-07-16"), "2026-07-16");
  assert.equal(normalizeCreationRecordDateFilter("2026-02-30"), "");
  assert.equal(normalizeCreationRecordDateFilter("16/07/2026"), "");
  assert.equal(hasActiveCreationRecordTimeFilter({ window: "all", date: "" }), false);
  assert.equal(hasActiveCreationRecordTimeFilter({ window: "today", date: "" }), true);
  assert.equal(hasActiveCreationRecordTimeFilter({ window: "all", date: "2026-07-16" }), true);
});

test("creation record time filters use local calendar-day boundaries", () => {
  assert.deepEqual(
    filterCreationRecordSetsByTime(sets, { window: "today" }, referenceNow).map((set) => set.setId),
    ["today"],
  );
  assert.deepEqual(
    filterCreationRecordSetsByTime(sets, { window: "recent" }, referenceNow).map((set) => set.setId),
    ["today", "recent-edge"],
  );
  assert.deepEqual(
    filterCreationRecordSetsByTime(sets, { window: "older" }, referenceNow).map((set) => set.setId),
    ["older-edge"],
  );
  assert.deepEqual(
    filterCreationRecordSetsByTime(sets, { date: "2026-07-16" }, referenceNow).map((set) => set.setId),
    ["recent-edge"],
  );
  assert.deepEqual(
    filterCreationRecordSetsByTime(sets, { window: "all" }, referenceNow).map((set) => set.setId),
    sets.map((set) => set.setId),
  );
});

test("creation record time filter options count all and bounded records", () => {
  assert.deepEqual(buildCreationRecordTimeFilterOptions(sets, referenceNow), [
    { value: "all", label: "全部", count: 6 },
    { value: "today", label: "今天", count: 1 },
    { value: "recent", label: "近 7 天", count: 2 },
    { value: "older", label: "更早", count: 1 },
  ]);
  assert.equal(formatCreationRecordTimeFilterLabel({ window: "recent" }), "近 7 天");
  assert.equal(formatCreationRecordTimeFilterLabel({ window: "all", date: "2026-07-16" }), "日期 2026-07-16");
  assert.equal(formatCreationRecordTimeFilterLabel({ window: "all", date: "" }), "");
});
