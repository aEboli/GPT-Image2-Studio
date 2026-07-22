export const MAX_ASSET_RECORD_DELETE_COUNT = 500;

function cleanString(value) {
  return String(value || "").trim();
}

export function normalizeAssetRecordDeleteIds(
  value,
  {
    allowEmpty = false,
    maxCount = MAX_ASSET_RECORD_DELETE_COUNT,
    recordLabel = "资产记录",
  } = {},
) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${recordLabel} ID 必须使用数组提交。`);
  }
  if (value.some((recordId) => typeof recordId !== "string")) {
    throw new TypeError(`${recordLabel} ID 必须是字符串。`);
  }

  const recordIds = [...new Set(value.map(cleanString).filter(Boolean))];
  if (!allowEmpty && recordIds.length === 0) {
    throw new Error(`请至少选择一条需要删除的${recordLabel}。`);
  }
  if (recordIds.some((recordId) => recordId.length > 200)) {
    throw new Error(`${recordLabel} ID 过长。`);
  }

  const normalizedMaxCount = Number.isFinite(Number(maxCount)) && Number(maxCount) > 0
    ? Math.floor(Number(maxCount))
    : MAX_ASSET_RECORD_DELETE_COUNT;
  if (recordIds.length > normalizedMaxCount) {
    throw new Error(`一次最多删除 ${normalizedMaxCount} 条${recordLabel}。`);
  }
  return recordIds;
}

export function getAssetRecordDeleteTargets({
  mode,
  records = [],
  getId = (record) => record?.id,
  currentId = "",
  checkedIds = [],
} = {}) {
  const availableRecords = Array.isArray(records)
    ? records.filter((record) => cleanString(getId(record)))
    : [];
  const availableIds = new Set(availableRecords.map((record) => cleanString(getId(record))));

  if (mode === "current") {
    const normalizedCurrentId = cleanString(currentId);
    return availableRecords.filter((record) => cleanString(getId(record)) === normalizedCurrentId).slice(0, 1);
  }
  if (mode !== "selected") {
    return [];
  }

  const selectedIds = new Set(
    normalizeAssetRecordDeleteIds(checkedIds, {
      allowEmpty: true,
      maxCount: Number.MAX_SAFE_INTEGER,
    }).filter((recordId) => availableIds.has(recordId)),
  );
  return availableRecords.filter((record) => selectedIds.has(cleanString(getId(record))));
}

export function resolveAssetRecordSelectionAfterDelete({
  records = [],
  getId = (record) => record?.id,
  currentId = "",
  deletedIds = [],
} = {}) {
  const orderedIds = [...new Set(
    (Array.isArray(records) ? records : [])
      .map((record) => cleanString(getId(record)))
      .filter(Boolean),
  )];
  const deletedIdSet = new Set(
    normalizeAssetRecordDeleteIds(deletedIds, {
      allowEmpty: true,
      maxCount: Number.MAX_SAFE_INTEGER,
    }),
  );
  const normalizedCurrentId = cleanString(currentId);
  const currentIndex = orderedIds.indexOf(normalizedCurrentId);

  if (currentIndex >= 0 && !deletedIdSet.has(normalizedCurrentId)) {
    return normalizedCurrentId;
  }
  if (currentIndex >= 0) {
    for (let index = currentIndex + 1; index < orderedIds.length; index += 1) {
      if (!deletedIdSet.has(orderedIds[index])) return orderedIds[index];
    }
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      if (!deletedIdSet.has(orderedIds[index])) return orderedIds[index];
    }
  }
  return orderedIds.find((recordId) => !deletedIdSet.has(recordId)) || "";
}

export function buildAssetRecordDeleteConfirmation({
  mode,
  targets = [],
  assetLabel = "资产记录",
  unitLabel = "条",
  getLabel = (record) => record?.title || record?.name,
  deleteScope = "对应记录和资产将被永久删除，无法撤销。",
} = {}) {
  const normalizedTargets = Array.isArray(targets) ? targets.filter(Boolean) : [];
  const count = normalizedTargets.length;
  const confirmLabel = count > 1 ? `删除 ${count} ${unitLabel}` : "确认删除";
  const currentAssetSeparator = /^[A-Za-z0-9]/u.test(assetLabel) ? " " : "";

  if (mode === "current") {
    const targetLabel = cleanString(getLabel(normalizedTargets[0])) || `未命名${assetLabel}`;
    return {
      title: `删除这${unitLabel}${currentAssetSeparator}${assetLabel}？`,
      message: `即将删除“${targetLabel}”。${deleteScope}`,
      confirmLabel,
    };
  }

  return {
    title: `删除选中的 ${assetLabel}？`,
    message: `已选择 ${count} ${unitLabel}。${deleteScope}`,
    confirmLabel,
  };
}
