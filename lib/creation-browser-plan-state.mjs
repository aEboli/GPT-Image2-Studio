export function getCreationSetPlanSource(set = {}) {
  return set.effectivePlan && typeof set.effectivePlan === "object" ? set.effectivePlan : set;
}

export function shouldDisableCreationGenerateButton({
  planning = false,
  preparingReferences = false,
  effectivePlan = null,
} = {}) {
  return Boolean(planning || preparingReferences || effectivePlan?.canGenerate === false);
}

export function cloneCreationPlanValue(value, fallback = null) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

export function deepFreezeCreationPlanValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((nested) => deepFreezeCreationPlanValue(nested));
  return value;
}

function parsePayloadValue(value, fallback) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function createCreationPlatformPayloadSnapshot(source = {}, {
  formDataFields = [],
  evidenceFields = [],
  normalizeSetOverrides,
  normalizeItemOverrides,
} = {}) {
  const rawSetOverrides = source.platformSetOverrides ?? source.setOverrides ?? {};
  const rawItemOverrides = source.platformItemOverrides ?? source.itemOverrides ?? [];
  const evidenceSource = parsePayloadValue(source.platformEvidence ?? source.evidence, {});
  const categorySource = parsePayloadValue(source.categorySignals, []);
  const coverageSource = parsePayloadValue(source.platformReferenceCoverage ?? source.referenceCoverage, []);
  const values = {
    platformSetOverrides: normalizeSetOverrides
      ? normalizeSetOverrides(rawSetOverrides)
      : cloneCreationPlanValue(parsePayloadValue(rawSetOverrides, {}), {}),
    platformItemOverrides: normalizeItemOverrides
      ? normalizeItemOverrides(rawItemOverrides)
      : cloneCreationPlanValue(parsePayloadValue(rawItemOverrides, []), []),
    platformEvidence: evidenceSource && typeof evidenceSource === "object" && !Array.isArray(evidenceSource)
      ? Object.fromEntries(evidenceFields
        .filter((field) => Object.prototype.hasOwnProperty.call(evidenceSource, field))
        .map((field) => [field, evidenceSource[field] === true || String(evidenceSource[field]).toLowerCase() === "true"]))
      : {},
    categorySignals: Array.isArray(categorySource)
      ? [...new Set(categorySource.map((entry) => String(entry || "").trim()).filter(Boolean))]
      : [],
    platformReferenceCoverage: Array.isArray(coverageSource)
      ? coverageSource.map((entry) => {
        if (typeof entry === "string") return { role: entry.trim(), filename: "", note: "" };
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        return {
          role: String(entry.role || "").trim(),
          filename: String(entry.filename || entry.name || "").trim(),
          note: String(entry.note || "").trim(),
        };
      }).filter((entry) => entry?.role)
      : [],
  };
  const serialized = Object.fromEntries(formDataFields.map((field) => [field, JSON.stringify(values[field])]));
  return deepFreezeCreationPlanValue({ values, serialized });
}

export function createCreationPlanPreviewRequestCoordinator(AbortControllerImpl = globalThis.AbortController) {
  let revision = 0;
  let controller = null;
  return {
    begin() {
      revision += 1;
      controller?.abort();
      controller = new AbortControllerImpl();
      return { revision, signal: controller.signal };
    },
    isCurrent(requestRevision) {
      return requestRevision === revision;
    },
    finish(requestRevision) {
      if (requestRevision !== revision) return false;
      controller = null;
      return true;
    },
  };
}

export function formatCreationPlanWarning(warning, platformLabel = "") {
  if (!warning || typeof warning !== "object") return String(warning || "");
  const messages = {
    "unknown-platform": "未识别所选平台，当前使用通用电商方案。",
    "advisory-platform-profile": `${platformLabel || "当前平台"}使用保守建议，生成前请复核平台规则。`,
    "missing-evidence-slot-omitted": "因缺少必要商品依据，已省略一个计划图片槽位。",
    "missing-evidence-slot-replaced": "因缺少必要商品依据，已将一个计划图片槽位替换为安全类型。",
    "image-count-extension-limited": "可用且有依据的图片类型不足，无法扩展到请求的张数。",
    "custom-image-type": "自定义图片不保证符合所选平台规则，请在生成前复核。",
  };
  return messages[warning.code] || String(warning.message || warning.code || "计划存在需复核项。");
}

export function buildCreationPlatformSlotOrderOverrides(itemOverrides = [], slotKeys = []) {
  const overrides = cloneCreationPlanValue(itemOverrides, []);
  slotKeys.filter(Boolean).forEach((slotKey, order) => {
    const index = overrides.findIndex((entry) => entry.slotKey === slotKey);
    const next = { ...(index >= 0 ? overrides[index] : {}), slotKey, order };
    if (index >= 0) overrides[index] = next;
    else overrides.push(next);
  });
  return overrides;
}

export function insertCreationPlatformCustomSlotOverride(itemOverrides = [], slotKeys = [], {
  afterSlotKey = "",
  slotKey,
} = {}) {
  const orderedSlotKeys = slotKeys.filter(Boolean);
  const afterIndex = afterSlotKey ? orderedSlotKeys.indexOf(afterSlotKey) : -1;
  orderedSlotKeys.splice(afterIndex >= 0 ? afterIndex + 1 : orderedSlotKeys.length, 0, slotKey);
  const overrides = buildCreationPlatformSlotOrderOverrides(itemOverrides, orderedSlotKeys);
  const customIndex = overrides.findIndex((entry) => entry.slotKey === slotKey);
  overrides[customIndex] = { ...overrides[customIndex], imageType: "custom", enabled: true };
  return overrides;
}
