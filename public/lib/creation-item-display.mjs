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
