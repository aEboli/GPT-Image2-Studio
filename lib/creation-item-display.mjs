const TARGET_SHOPPER_RESONANCE_TITLE = "目标人群共鸣图";

const LEGACY_TARGET_SHOPPER_ITEM_IDS = new Set([
  "universal:benefit-proof",
  "universal:target-shopper-resonance",
  "2-benefit",
  "2-benefit-proof",
  "2-target-shopper-resonance",
]);

const LEGACY_TARGET_SHOPPER_IMAGE_TYPES = new Set([
  "benefit-proof",
  "info-benefit",
  "target-shopper-resonance",
]);

const LEGACY_TARGET_SHOPPER_TITLES = new Set([
  "卖点图",
  "核心信息融合图",
  "卖点证据图",
  "信息卖点图",
  "目标人群共鸣图",
]);

function cleanString(value) {
  return String(value ?? "").trim();
}

function isSecondCreationSlot(item = {}) {
  const slotIndex = Number(item.slotIndex);
  const itemId = cleanString(item.itemId).toLowerCase();
  return slotIndex === 2 || /^(?:2[-_:])/.test(itemId);
}

export function isCreationTargetShopperResonanceItem(item = {}) {
  const itemId = cleanString(item.itemId).toLowerCase();
  const role = cleanString(item.role);
  const imageType = cleanString(item.imageType);
  if (LEGACY_TARGET_SHOPPER_ITEM_IDS.has(itemId)) {
    return true;
  }
  if (!isSecondCreationSlot(item)) {
    return false;
  }
  return role === "benefit" || LEGACY_TARGET_SHOPPER_IMAGE_TYPES.has(imageType);
}

export function getCreationItemDisplayTitle(item = {}, fallbackTitle = "") {
  const title = cleanString(item.title) || cleanString(fallbackTitle);
  if (!isCreationTargetShopperResonanceItem(item)) {
    return title;
  }

  // Preserve explicit custom titles; only migrate generic historical labels in the UI.
  if (!title || LEGACY_TARGET_SHOPPER_TITLES.has(title) || cleanString(item.role) === "benefit") {
    return TARGET_SHOPPER_RESONANCE_TITLE;
  }
  return title;
}

export { TARGET_SHOPPER_RESONANCE_TITLE };

// 缺失框仅用于展示，不能写回实际任务、计数或补图列表。
export function getCreationMarketingDisplayItems(set = {}) {
  const items = Array.isArray(set.items) ? set.items : [];
  const validation = set.marketingPlan?.validation;
  if (!validation) return items;
  const requestedCount = Math.min(20, Math.max(0, Number(validation.requestedCount) || 0));
  const missing = (Array.isArray(validation.removedItems) ? validation.removedItems : [])
    .filter((entry) => Number.isInteger(entry.sourceIndex) && entry.sourceIndex >= 1 && entry.sourceIndex <= requestedCount)
    .map((entry) => ({ ...entry }));
  for (let index = Math.min(requestedCount, Math.max(0, Number(validation.returnedCount) || 0)) + 1; index <= requestedCount; index += 1) {
    missing.push({ sourceIndex: index, title: `第 ${index} 张`, reason: "模型未返回本张图片的完整规划。" });
  }
  const usedIds = new Set(items.map((item) => item.itemId));
  const placeholders = missing.map((entry) => {
    let itemId = `marketing-missing-${entry.sourceIndex}`;
    while (usedIds.has(itemId)) itemId += "-missing";
    usedIds.add(itemId);
    return { itemId, itemKind: "carousel", title: entry.title || `第 ${entry.sourceIndex} 张`, slotIndex: entry.sourceIndex, status: "missing", enabled: false, error: entry.reason, marketingAssignment: { sourceIndex: entry.sourceIndex } };
  });
  const position = (item) => item.itemKind === "carousel" ? item.marketingAssignment?.sourceIndex || item.slotIndex : requestedCount + (item.slotIndex || 1);
  return [...items, ...placeholders].sort((left, right) => position(left) - position(right));
}
