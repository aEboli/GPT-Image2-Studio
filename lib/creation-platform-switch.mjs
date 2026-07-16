const PRESERVED_FIELDS = [
  "productName", "productDescription", "sellingPoints", "category", "industryTemplate",
  "dimensions", "dimensionSpecs", "referenceFiles", "logo",
  "skuSubjects", "skuBundleCount", "outputFormat", "config", "apiConfig",
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function beginCreationPlatformSwitch(previousState, nextPlatform, { programmatic = false } = {}) {
  if (programmatic || String(previousState?.platform || "") === String(nextPlatform || "")) return null;
  return { previousState: clone(previousState || {}), nextPlatform: String(nextPlatform || "universal") };
}

export function cancelCreationPlatformSwitch(transaction) {
  return clone(transaction?.previousState || {});
}

export function confirmCreationPlatformSwitch(transaction, resolvedPlan = {}) {
  const previous = transaction?.previousState || {};
  const next = { ...clone(previous), ...clone(resolvedPlan), platform: transaction?.nextPlatform || resolvedPlan.platform || previous.platform };
  next.platformSetOverrides = {};
  next.platformItemOverrides = [];
  return next;
}

export { PRESERVED_FIELDS };
