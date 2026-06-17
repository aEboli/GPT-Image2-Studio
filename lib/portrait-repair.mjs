function cleanString(value) {
  return String(value || "").trim();
}

function isIncompletePortraitItem(item = {}) {
  return cleanString(item.status) !== "completed" || !cleanString(item.filename) || !cleanString(item.relativePath);
}

function isFailedPortraitItem(item = {}) {
  return cleanString(item.status) === "failed";
}

export function applyPortraitRepairOverrides(item = {}, { promptOverride = "" } = {}) {
  const prompt = cleanString(promptOverride);
  return {
    ...item,
    ...(prompt ? { prompt } : {}),
  };
}

export function selectPortraitRepairItems(portraitSet = {}, { itemId = "", scope = "" } = {}) {
  const items = Array.isArray(portraitSet.items) ? portraitSet.items : [];
  const requestedItemId = cleanString(itemId);

  if (requestedItemId) {
    return items.filter((item) => cleanString(item.itemId) === requestedItemId);
  }

  if (cleanString(scope).toLowerCase() === "incomplete") {
    return items.filter(isIncompletePortraitItem);
  }

  return items.filter(isFailedPortraitItem);
}
