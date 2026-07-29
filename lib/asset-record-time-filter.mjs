const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TIME_FILTER_LABELS = {
  all: "全部",
  today: "今天",
  recent: "近 7 天",
  older: "更早",
};
const TIME_FILTER_VALUES = new Set(Object.keys(TIME_FILTER_LABELS));

function startOfLocalDay(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalDateKey(value) {
  const day = startOfLocalDay(value);
  if (!day) return "";
  return [
    String(day.getFullYear()).padStart(4, "0"),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

function getLocalDayDifference(value, referenceNow) {
  const day = startOfLocalDay(value);
  const referenceDay = startOfLocalDay(referenceNow);
  if (!day || !referenceDay) return Number.POSITIVE_INFINITY;
  return Math.round((referenceDay.getTime() - day.getTime()) / DAY_IN_MS);
}

function matchesAssetRecordTime(record, { window, date }, referenceNow) {
  if (date) return toLocalDateKey(record?.createdAt) === date;
  if (window === "all") return true;

  const dayDifference = getLocalDayDifference(record?.createdAt, referenceNow);
  if (!Number.isFinite(dayDifference) || dayDifference < 0) return false;
  if (window === "today") return dayDifference === 0;
  if (window === "recent") return dayDifference < 7;
  if (window === "older") return dayDifference >= 7;
  return true;
}

export function normalizeAssetRecordTimeFilter(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return TIME_FILTER_VALUES.has(normalized) ? normalized : "all";
}

export function normalizeAssetRecordDateFilter(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return "";
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function hasActiveAssetRecordTimeFilter(filters = {}) {
  return Boolean(
    normalizeAssetRecordDateFilter(filters.date) ||
      normalizeAssetRecordTimeFilter(filters.window) !== "all",
  );
}

export function filterAssetRecordsByTime(records, filters = {}, referenceNow = new Date()) {
  const date = normalizeAssetRecordDateFilter(filters.date);
  const window = date ? "all" : normalizeAssetRecordTimeFilter(filters.window);
  return (Array.isArray(records) ? records : []).filter((record) =>
    matchesAssetRecordTime(record, { window, date }, referenceNow),
  );
}

export function buildAssetRecordTimeFilterOptions(records, referenceNow = new Date()) {
  const normalizedRecords = Array.isArray(records) ? records : [];
  return Object.entries(TIME_FILTER_LABELS).map(([value, label]) => ({
    value,
    label,
    count: filterAssetRecordsByTime(normalizedRecords, { window: value }, referenceNow).length,
  }));
}

export function formatAssetRecordTimeFilterLabel(filters = {}) {
  const date = normalizeAssetRecordDateFilter(filters.date);
  if (date) return `日期 ${date}`;
  const window = normalizeAssetRecordTimeFilter(filters.window);
  return window === "all" ? "" : TIME_FILTER_LABELS[window];
}
