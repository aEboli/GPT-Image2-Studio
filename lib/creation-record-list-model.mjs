export const CREATION_RECORD_LIST_BATCH_SIZE = 60;

const TEMU_EXPORT_STATUSES = Object.freeze({
  notExported: Object.freeze({
    key: "not-exported",
    label: "未导出",
    tone: "neutral",
  }),
  exported: Object.freeze({
    key: "exported",
    label: "已导出",
    tone: "success",
  }),
  modified: Object.freeze({
    key: "modified",
    label: "已修改",
    tone: "warning",
  }),
  draft: Object.freeze({
    key: "draft",
    label: "待补全导出",
    tone: "info",
  }),
});

function normalizeFilterSignature(value) {
  return String(value ?? "");
}

function normalizeVisibleLimit(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < CREATION_RECORD_LIST_BATCH_SIZE) {
    return CREATION_RECORD_LIST_BATCH_SIZE;
  }

  const batches = Math.floor(numericValue / CREATION_RECORD_LIST_BATCH_SIZE);
  return Math.max(1, batches) * CREATION_RECORD_LIST_BATCH_SIZE;
}

function reconcileCreationRecordListState(state, filterSignature) {
  const normalizedSignature = normalizeFilterSignature(filterSignature);
  if (
    !state ||
    typeof state !== "object" ||
    normalizeFilterSignature(state.filterSignature) !== normalizedSignature
  ) {
    return createCreationRecordListState(normalizedSignature);
  }

  return {
    filterSignature: normalizedSignature,
    visibleLimit: normalizeVisibleLimit(state.visibleLimit),
  };
}

function normalizeTimestamp(value) {
  return String(value ?? "").trim();
}

export function createCreationRecordListState(filterSignature = "") {
  return {
    filterSignature: normalizeFilterSignature(filterSignature),
    visibleLimit: CREATION_RECORD_LIST_BATCH_SIZE,
  };
}

export function loadMoreCreationRecordListState(state, filterSignature = "") {
  const normalizedSignature = normalizeFilterSignature(filterSignature);
  const reconciledState = reconcileCreationRecordListState(state, normalizedSignature);
  if (
    !state ||
    typeof state !== "object" ||
    normalizeFilterSignature(state.filterSignature) !== normalizedSignature
  ) {
    return reconciledState;
  }

  return {
    ...reconciledState,
    visibleLimit: reconciledState.visibleLimit + CREATION_RECORD_LIST_BATCH_SIZE,
  };
}

export function buildCreationRecordListModel(sets, options = {}) {
  const records = Array.isArray(sets) ? sets : [];
  const state = reconcileCreationRecordListState(options.state, options.filterSignature);
  const visibleSets = records.slice(0, state.visibleLimit);

  return {
    visibleSets,
    shownCount: visibleSets.length,
    totalCount: records.length,
    hasMore: visibleSets.length < records.length,
    state,
  };
}

export function getCreationRecordTemuExportStatus(set) {
  const exportState = set?.temuExcelExportState;
  const mode = String(exportState?.mode ?? "").trim().toLowerCase();

  if (mode === "draft") {
    return TEMU_EXPORT_STATUSES.draft;
  }
  if (mode !== "strict") {
    return TEMU_EXPORT_STATUSES.notExported;
  }

  const sourceUpdatedAt = normalizeTimestamp(exportState?.sourceUpdatedAt);
  const currentUpdatedAt = normalizeTimestamp(set?.updatedAt);
  if (sourceUpdatedAt && currentUpdatedAt && sourceUpdatedAt === currentUpdatedAt) {
    return TEMU_EXPORT_STATUSES.exported;
  }
  return TEMU_EXPORT_STATUSES.modified;
}

export function getCreationRecordListTimestamp(set) {
  return normalizeTimestamp(set?.createdAt);
}
