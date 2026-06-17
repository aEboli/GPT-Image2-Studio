function cleanItemId(value) {
  return String(value || "").trim();
}

export function isCreationItemRepairQueued(creationState = {}, itemId = "") {
  const targetItemId = cleanItemId(itemId);
  return Boolean(targetItemId && creationState.queuedRepairItemIds?.includes(targetItemId));
}

export function isCreationItemRepairActive(creationState = {}, itemId = "") {
  const targetItemId = cleanItemId(itemId);
  return Boolean(
    targetItemId &&
      creationState.generationScope === "single" &&
      cleanItemId(creationState.repairingItemId) === targetItemId,
  );
}

export function canRepairCreationItem({
  creationState = {},
  itemId = "",
  canRepairSet = false,
} = {}) {
  const targetItemId = cleanItemId(itemId);
  if (!targetItemId || creationState.planning || !canRepairSet) {
    return false;
  }
  if (
    isCreationItemRepairActive(creationState, targetItemId) ||
    isCreationItemRepairQueued(creationState, targetItemId)
  ) {
    return false;
  }
  return !creationState.generating || creationState.generationScope === "single";
}

export function getCreationRepairButtonText({ creationState = {}, item = {} } = {}) {
  if (isCreationItemRepairActive(creationState, item.itemId)) {
    return "生成中";
  }
  if (isCreationItemRepairQueued(creationState, item.itemId)) {
    return "已排队";
  }
  return item.status === "completed" ? "重生成" : item.status === "failed" ? "重试" : "补图";
}

export function queueCreationItemRepair(creationState = {}, itemId = "") {
  const targetItemId = cleanItemId(itemId);
  if (!targetItemId || isCreationItemRepairQueued(creationState, targetItemId)) {
    return false;
  }
  creationState.queuedRepairItemIds = [...(creationState.queuedRepairItemIds || []), targetItemId];
  return true;
}

export function removeQueuedCreationItemRepair(creationState = {}, itemId = "") {
  const targetItemId = cleanItemId(itemId);
  creationState.queuedRepairItemIds = (creationState.queuedRepairItemIds || []).filter(
    (entry) => entry !== targetItemId,
  );
}

export function shiftNextQueuedCreationItemRepair(creationState = {}, isValidItem = () => true) {
  while (creationState.queuedRepairItemIds?.length > 0) {
    const [nextItemId, ...remainingItemIds] = creationState.queuedRepairItemIds;
    creationState.queuedRepairItemIds = remainingItemIds;
    if (isValidItem(nextItemId)) {
      return nextItemId;
    }
  }
  return "";
}
