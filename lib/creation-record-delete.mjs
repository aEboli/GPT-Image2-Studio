export const MAX_CREATION_RECORD_DELETE_COUNT = 500;

function cleanString(value) {
  return String(value || "").trim();
}

export function normalizeCreationRecordDeleteSetIds(
  value,
  { allowEmpty = false, maxCount = MAX_CREATION_RECORD_DELETE_COUNT } = {},
) {
  if (!Array.isArray(value)) {
    throw new TypeError("套图记录 ID 必须使用数组提交。");
  }

  if (value.some((setId) => typeof setId !== "string")) {
    throw new TypeError("套图记录 ID 必须是字符串。");
  }

  const setIds = [...new Set(value.map(cleanString).filter(Boolean))];
  if (!allowEmpty && setIds.length === 0) {
    throw new Error("请至少选择一套需要删除的套图记录。");
  }
  if (setIds.some((setId) => setId.length > 200)) {
    throw new Error("套图记录 ID 过长。");
  }

  const normalizedMaxCount = Number.isFinite(Number(maxCount)) && Number(maxCount) > 0
    ? Math.floor(Number(maxCount))
    : MAX_CREATION_RECORD_DELETE_COUNT;
  if (setIds.length > normalizedMaxCount) {
    throw new Error(`一次最多删除 ${normalizedMaxCount} 套套图记录。`);
  }
  return setIds;
}

export function getCreationRecordDeleteTargets({
  mode,
  allSets = [],
  filteredSets = [],
  currentSetId = "",
  checkedSetIds = [],
  query = "",
  hasFilter,
} = {}) {
  const sets = Array.isArray(allSets) ? allSets.filter((set) => cleanString(set?.setId)) : [];
  const availableIds = new Set(sets.map((set) => cleanString(set.setId)));

  if (mode === "current") {
    const normalizedCurrentSetId = cleanString(currentSetId);
    return sets.filter((set) => cleanString(set.setId) === normalizedCurrentSetId).slice(0, 1);
  }

  if (mode === "selected") {
    const selectedIds = new Set(
      normalizeCreationRecordDeleteSetIds(checkedSetIds, { allowEmpty: true, maxCount: Number.MAX_SAFE_INTEGER })
        .filter((setId) => availableIds.has(setId)),
    );
    return sets.filter((set) => selectedIds.has(cleanString(set.setId)));
  }

  if (mode === "filtered") {
    const hasExplicitFilter = typeof hasFilter === "boolean" ? hasFilter : Boolean(cleanString(query));
    if (!hasExplicitFilter) return [];
    const filteredIds = new Set(
      (Array.isArray(filteredSets) ? filteredSets : [])
        .map((set) => cleanString(set?.setId))
        .filter((setId) => availableIds.has(setId)),
    );
    return sets.filter((set) => filteredIds.has(cleanString(set.setId)));
  }

  return [];
}

export function resolveCreationRecordSelectionAfterDelete({
  filteredSets = [],
  currentSetId = "",
  deletedSetIds = [],
} = {}) {
  const orderedSetIds = [...new Set(
    (Array.isArray(filteredSets) ? filteredSets : [])
      .map((set) => cleanString(set?.setId))
      .filter(Boolean),
  )];
  const deletedIds = new Set(
    normalizeCreationRecordDeleteSetIds(deletedSetIds, {
      allowEmpty: true,
      maxCount: Number.MAX_SAFE_INTEGER,
    }),
  );
  const normalizedCurrentSetId = cleanString(currentSetId);
  const currentIndex = orderedSetIds.indexOf(normalizedCurrentSetId);

  if (currentIndex >= 0 && !deletedIds.has(normalizedCurrentSetId)) {
    return normalizedCurrentSetId;
  }
  if (currentIndex >= 0) {
    for (let index = currentIndex + 1; index < orderedSetIds.length; index += 1) {
      if (!deletedIds.has(orderedSetIds[index])) return orderedSetIds[index];
    }
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      if (!deletedIds.has(orderedSetIds[index])) return orderedSetIds[index];
    }
  }
  return orderedSetIds.find((setId) => !deletedIds.has(setId)) || "";
}

export function buildCreationRecordDeleteConfirmation({ mode, targets = [], query = "", filterLabel = "" } = {}) {
  const normalizedTargets = Array.isArray(targets) ? targets.filter((set) => cleanString(set?.setId)) : [];
  const count = normalizedTargets.length;
  const confirmLabel = count > 1 ? `删除 ${count} 套` : "确认删除";
  const permanentNotice = "对应记录、生成图片和 JSON 元数据将被永久删除，无法撤销。";

  if (mode === "current") {
    const productName = cleanString(normalizedTargets[0]?.productName) || "未命名商品";
    return {
      title: "删除这套套图？",
      message: `即将删除「${productName}」。${permanentNotice}`,
      confirmLabel,
    };
  }

  if (mode === "filtered") {
    const normalizedFilterLabel = cleanString(filterLabel) || cleanString(query) || "当前条件";
    return {
      title: "删除筛选结果？",
      message: `当前筛选“${normalizedFilterLabel}”匹配 ${count} 套。${permanentNotice}`,
      confirmLabel,
    };
  }

  return {
    title: "删除选中的套图？",
    message: `已选择 ${count} 套。${permanentNotice}`,
    confirmLabel,
  };
}
