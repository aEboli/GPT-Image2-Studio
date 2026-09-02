import { getCreationFatalUpstreamError } from "./creation-auto-repair.mjs";
import { formatCreationSkuItemColorNames } from "./creation-sku-colors.mjs";
import { isFatalUpstreamError } from "./upstream-fatal-error.mjs";

export function getCreationQueueJobs(creationState = {}) {
  return Array.isArray(creationState.queue) ? creationState.queue : [];
}

export function getPendingCreationQueueCount(creationState = {}) {
  return getCreationQueueJobs(creationState).filter((job) => job.status === "queued").length;
}

export function getActiveCreationQueueJob(creationState = {}) {
  return getCreationQueueJobs(creationState).find((job) => job.status === "running") || null;
}

export function getRunningCreationQueueJobs(creationState = {}) {
  return getCreationQueueJobs(creationState).filter((job) => job.status === "running");
}

export function getSelectedCreationQueueJob(creationState = {}) {
  const queueJobs = getCreationQueueJobs(creationState);
  const selectedId = creationState.selectedQueueId || creationState.activeQueueId;
  return (
    queueJobs.find((job) => job.id === selectedId) ||
    getActiveCreationQueueJob(creationState) ||
    queueJobs.find((job) => job.status === "queued") ||
    null
  );
}

export function shouldSyncCreationQueueJobCurrentSet(creationState = {}, job = {}) {
  const selectedQueueId = String(creationState.selectedQueueId || "");
  if (selectedQueueId) {
    return selectedQueueId === String(job.id || "");
  }
  return Boolean(creationState.activeQueueId) && creationState.activeQueueId === job.id;
}

export function getCreationRepairTargetSet(creationState = {}, currentSet = null, normalizeSet) {
  const selectedJob = getSelectedCreationQueueJob(creationState);
  const targetSet = selectedJob?.set || currentSet;
  if (!targetSet) {
    return null;
  }
  return typeof normalizeSet === "function" ? normalizeSet(targetSet) : targetSet;
}

export function syncActiveCreationQueueSet(creationState = {}, set, normalizeSet) {
  const activeQueueId = creationState.activeQueueId;
  if (!set || typeof normalizeSet !== "function") {
    return;
  }

  const normalizedSet = normalizeSet(set);
  const setId = String(normalizedSet?.setId || set?.setId || "");
  getCreationQueueJobs(creationState).forEach((queueJob) => {
    const queueSetId = String(queueJob.set?.setId || "");
    const matchesQueueSet = setId ? queueSetId === setId : activeQueueId && queueJob.id === activeQueueId;
    if (matchesQueueSet) {
      queueJob.set = normalizedSet;
    }
  });
}

export function selectCreationQueueJob(creationState = {}, queueId) {
  const nextId = String(queueId || "");
  const queueJobs = getCreationQueueJobs(creationState);
  const selectedJob = queueJobs.find((job) => job.id === nextId);
  if (!selectedJob) {
    return false;
  }

  const currentSetId = String(creationState.currentSet?.setId || "");
  const currentSetIsQueueBacked = Boolean(currentSetId) && queueJobs.some((job) => String(job.set?.setId || "") === currentSetId);
  creationState.selectedQueueId = nextId;
  if (currentSetIsQueueBacked && selectedJob.set) {
    creationState.currentSet = selectedJob.set;
  }
  return true;
}

function createQueueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneQueueSnapshot(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (_error) {
      // Fall through for non-cloneable legacy values.
    }
  }
  if (typeof value === "object") {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

const CREATION_SCHEDULING_SNAPSHOT_FIELDS = ["generationConcurrency", "generationStartDelayMs"];

function hasPendingCreationQueueWork(creationState = {}) {
  return getCreationQueueJobs(creationState).some((job) => job.status === "queued" || job.status === "running");
}

function captureCreationSchedulingSnapshot(formData) {
  if (!formData || typeof formData.get !== "function") {
    return null;
  }

  const snapshot = {};
  for (const field of CREATION_SCHEDULING_SNAPSHOT_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") {
      snapshot[field] = value;
    }
  }
  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

function applyCreationSchedulingSnapshot(formData, snapshot) {
  if (!formData || typeof formData.set !== "function" || !snapshot) {
    return;
  }

  for (const field of CREATION_SCHEDULING_SNAPSHOT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
      formData.set(field, snapshot[field]);
    }
  }
}

export function createCreationQueueJob({ creationState, formData, set, normalizeSet, nowIso, idFactory = createQueueId } = {}) {
  const hasPendingWork = hasPendingCreationQueueWork(creationState);
  if (hasPendingWork && creationState.schedulingSnapshot) {
    applyCreationSchedulingSnapshot(formData, creationState.schedulingSnapshot);
  } else {
    const schedulingSnapshot = captureCreationSchedulingSnapshot(formData);
    if (schedulingSnapshot) {
      creationState.schedulingSnapshot = schedulingSnapshot;
    }
  }

  const normalizedSet = cloneQueueSnapshot(normalizeSet(set));
  const job = {
    id: idFactory("creation-queue"),
    listingAgentEnabled: set?.listingAgentEnabled === true,
    status: "queued",
    autoRepairAttemptCount: 0,
    createdAt: normalizedSet?.createdAt || nowIso(),
    formData,
    set: normalizedSet,
  };

  creationState.queue.push(job);
  creationState.selectedQueueId = job.id;
  if (!creationState.currentSet) {
    creationState.currentSet = job.set;
  }
  return job;
}

function normalizeVisualLanguageForQueue(value, normalizeCreationVisualLanguage) {
  const normalized =
    typeof normalizeCreationVisualLanguage === "function"
      ? normalizeCreationVisualLanguage(value)
      : String(value || "classic-commercial");
  if (normalized && typeof normalized === "object") {
    return {
      value: String(normalized.value || normalized.visualLanguage || value || "classic-commercial"),
      label: String(normalized.label || normalized.visualLanguageLabel || ""),
    };
  }
  return { value: String(normalized || "classic-commercial"), label: "" };
}

function formatVisualLanguageLabelForQueue(value, normalizedVisualLanguage, formatCreationVisualLanguageLabel) {
  if (typeof formatCreationVisualLanguageLabel === "function") {
    return formatCreationVisualLanguageLabel(value);
  }
  return normalizedVisualLanguage.label || normalizedVisualLanguage.value;
}

const QUEUE_NUMBER_LABELS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const DEFAULT_CREATION_SKU_GENERATION_RULE = {
  value: "color-name-under-subject",
  label: "显示颜色",
};
const DEFAULT_CREATION_PLATFORM = {
  value: "universal",
  label: "通用电商",
};

function cleanQueueString(value) {
  return String(value || "").trim();
}

function normalizeDefaultEnabledBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = cleanQueueString(value).toLowerCase();
  return !["false", "0", "off", "no"].includes(normalized);
}

function isUnfinishedCreationQueueItem(item = {}) {
  const status = cleanQueueString(item.status).toLowerCase();
  return status !== "completed" && status !== "failed";
}

function getCreationQueueJobReservedItemCount(job = {}) {
  const items = Array.isArray(job.set?.items) ? job.set.items : [];
  const count = items.filter(isUnfinishedCreationQueueItem).length;
  return Math.max(1, count);
}

export function getRunningCreationQueueReservedItemCount(creationState = {}) {
  return getRunningCreationQueueJobs(creationState).reduce((total, job) => total + getCreationQueueJobReservedItemCount(job), 0);
}

function getQueueRoleId(value) {
  return cleanQueueString(value?.role || value);
}

function isCreationInfographicRebuildQueueRole(role) {
  return role === "infographic-rebuild";
}

function isCreationQueuedAppendRole(role) {
  return role === "sku" || isCreationInfographicRebuildQueueRole(role);
}

function draftItemsMatchSelectedRoles(draftItems, selectedRoles, {
  skuGenerationEnabled = true,
  skuImageCount = 0,
  infographicRebuildEnabled = false,
  infographicRebuildCount = 0,
} = {}) {
  if (!Array.isArray(draftItems) || draftItems.length === 0 || !Array.isArray(selectedRoles)) {
    return false;
  }

  const selectedRoleIds = selectedRoles.map(getQueueRoleId).filter(Boolean);
  const draftRoleIds = draftItems
    .map((item) => getQueueRoleId(item?.role))
    .filter((role) => role && !isCreationQueuedAppendRole(role));
  const draftInfographicRebuildCount = draftItems.filter((item) =>
    isCreationInfographicRebuildQueueRole(getQueueRoleId(item?.role)),
  ).length;
  const draftSkuImageCount = draftItems.filter((item) => getQueueRoleId(item?.role) === "sku").length;

  return (
    selectedRoleIds.length > 0 &&
    selectedRoleIds.length === draftRoleIds.length &&
    selectedRoleIds.every((role, index) => role === draftRoleIds[index]) &&
    draftSkuImageCount === (skuGenerationEnabled ? skuImageCount : 0) &&
    draftInfographicRebuildCount === (infographicRebuildEnabled ? infographicRebuildCount : 0)
  );
}

function formatCreationQueueLabel(index) {
  const queueIndex = Math.max(1, Number(index) || 1);
  return `队列${QUEUE_NUMBER_LABELS[queueIndex - 1] || queueIndex}`;
}

function buildCreationQueuedSkuTitle(skuSubject = {}, index = 0, targetLanguage = {}) {
  const colorName = formatCreationSkuItemColorNames(skuSubject, targetLanguage);
  return colorName ? `SKU image ${index + 1} - ${colorName}` : `SKU image ${index + 1}`;
}

function buildCreationQueuedSkuFilenameToken(skuSubject = {}, index = 0, targetLanguage = {}) {
  const colorToken = formatCreationSkuItemColorNames(skuSubject, targetLanguage)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return colorToken ? `sku-${index + 1}-${colorToken}` : `sku-${index + 1}`;
}

function buildCreationQueuedSkuItems(skuSubjects = [], startIndex = 0, targetLanguage = {}) {
  return (Array.isArray(skuSubjects) ? skuSubjects : [])
    .map((skuSubject, index) => ({
      itemId: `queued-sku-${index + 1}`,
      role: "sku",
      title: buildCreationQueuedSkuTitle(skuSubject, index, targetLanguage),
      filenameToken: buildCreationQueuedSkuFilenameToken(skuSubject, index, targetLanguage),
      slotIndex: startIndex + index + 1,
      status: "queued",
      referenceImageNames: Array.isArray(skuSubject.filenames) ? skuSubject.filenames.map(cleanQueueString).filter(Boolean) : [],
      skuSubject,
    }));
}

function isCreationSubjectReferenceRole(role) {
  const normalized = cleanQueueString(role).toLowerCase();
  return normalized === "product" || normalized === "reference-product";
}

function getCreationReferenceFilename(referenceRole = {}) {
  return cleanQueueString(referenceRole.filename || referenceRole.name || referenceRole.fileName);
}

function buildCreationQueueSourceInfographic(referenceRole = {}, index = 0) {
  const source = {
    filename: getCreationReferenceFilename(referenceRole),
    role: cleanQueueString(referenceRole.role),
  };
  const roleLabel = cleanQueueString(referenceRole.roleLabel || referenceRole.label);
  const rolePromptLabel = cleanQueueString(referenceRole.rolePromptLabel || referenceRole.promptLabel);
  const note = cleanQueueString(referenceRole.note);
  if (roleLabel) {
    source.roleLabel = roleLabel;
  }
  if (rolePromptLabel) {
    source.rolePromptLabel = rolePromptLabel;
  }
  if (note) {
    source.note = note;
  }
  const referenceIndex = Number(referenceRole.index);
  source.index = Number.isFinite(referenceIndex) && referenceIndex > 0 ? referenceIndex : index + 1;
  return source;
}

function getCreationInfographicRebuildSources(referenceRoles = []) {
  return (Array.isArray(referenceRoles) ? referenceRoles : [])
    .map((referenceRole, index) => ({ referenceRole, index }))
    .filter(({ referenceRole }) => {
      const filename = getCreationReferenceFilename(referenceRole);
      const role = cleanQueueString(referenceRole?.role);
      return filename && role && !isCreationSubjectReferenceRole(role);
    })
    .map(({ referenceRole, index }) => buildCreationQueueSourceInfographic(referenceRole, index));
}

function buildCreationQueuedInfographicRebuildTitle(source = {}, index = 0) {
  const label = cleanQueueString(source.roleLabel || source.role || source.filename);
  const suffix = label ? ` - ${label}` : "";
  return `信息图重构 ${index + 1}${suffix}`;
}

function buildCreationQueuedInfographicRebuildItems({ sources = [], startIndex = 0 } = {}) {
  return (Array.isArray(sources) ? sources : []).map((source, index) => ({
    itemId: `queued-infographic-rebuild-${index + 1}`,
    role: "infographic-rebuild",
    title: buildCreationQueuedInfographicRebuildTitle(source, index),
    slotIndex: startIndex + index + 1,
    status: "queued",
    referenceImageNames: [source.filename].filter(Boolean),
    sourceInfographic: source,
  }));
}

function getCreationQueueStatusText(job, isActive) {
  if (isActive) {
    return "当前生成";
  }
  if (job.status === "completed") {
    return "已完成";
  }
  if (job.status === "failed") {
    return "失败";
  }
  return "排队中";
}

function isCreationQueueSetCompleted(set = {}) {
  const items = Array.isArray(set.items) ? set.items : [];
  return items.length > 0 && items.every((item) => cleanQueueString(item.status).toLowerCase() === "completed");
}

// Reads an account-level reason out of a stream event. Checking each event lets
// the queue fail not-yet-started suites immediately instead of sending known
// doomed requests after the active suite reaches its terminal state.
function getCreationStreamFatalUpstreamError(payload = {}) {
  const message = cleanQueueString(payload.message);
  if (message && isFatalUpstreamError(message)) {
    return message;
  }

  return payload.set ? getCreationFatalUpstreamError(payload.set) : "";
}

// An account-level upstream failure rejects every request the same way, so the
// suites still waiting in the queue would each burn a full wave of doomed calls.
// They fail now and carry the same reason, which also stops the scheduler: it
// only ever picks up jobs still in `queued`.
export function failPendingCreationQueueJobs(creationState = {}, message, { normalizeSet, nowIso } = {}) {
  const reason = cleanQueueString(message);
  if (!reason) {
    return 0;
  }

  const pendingJobs = getCreationQueueJobs(creationState).filter((job) => job.status === "queued");
  for (const job of pendingJobs) {
    const items = Array.isArray(job.set?.items) ? job.set.items : [];
    const failedSet = {
      ...job.set,
      status: "failed",
      updatedAt: typeof nowIso === "function" ? nowIso() : new Date().toISOString(),
      items: items.map((item) => (
        cleanQueueString(item.status).toLowerCase() === "completed"
          ? item
          : { ...item, status: "failed", error: reason }
      )),
    };
    job.status = "failed";
    job.set = typeof normalizeSet === "function" ? normalizeSet(failedSet) : failedSet;
  }

  return pendingJobs.length;
}

export function buildCreationQueuedSet({
  buildCreationReferenceRolePayload,
  buildCreationSkuSubjectPayload,
  createdAt,
  creationState,
  formatCreationDimensionUnitModeLabel,
  formatCreationVisualLanguageLabel,
  getCreationCurrentSet,
  getCreationDraftSet,
  getFrozenCreationEffectivePlan,
  getCreationLogoPayload,
  getCreationPreviewSlots,
  getCreationSelectedDimensionUnitMode,
  getCreationSelectedImageCount,
  getCreationSelectedIndustryTemplate,
  getCreationSelectedLanguage,
  getCreationSelectedPlatform,
  getCreationSelectedRoles,
  getCreationSelectedScenario,
  getCreationSelectedSkuGenerationRule,
  isCreationDraftSet,
  normalizeCreationSkuBundleCountForPayload,
  normalizeCreationVisualLanguage,
  normalizeSet,
  productDescription,
  productName,
  referenceFiles = [],
  refs,
  sellingPoints,
} = {}) {
  const frozenEffectivePlan = typeof getFrozenCreationEffectivePlan === "function"
    ? getFrozenCreationEffectivePlan()
    : null;
  if (frozenEffectivePlan && Array.isArray(frozenEffectivePlan.items) && frozenEffectivePlan.items.length > 0) {
    const snapshot = structuredClone(frozenEffectivePlan);
    const dimensionUnitMode = snapshot.dimensionUnitMode || getCreationSelectedDimensionUnitMode();
    const language = getCreationSelectedLanguage();
    const platform = typeof getCreationSelectedPlatform === "function" ? getCreationSelectedPlatform() : DEFAULT_CREATION_PLATFORM;
    const scenario = getCreationSelectedScenario();
    const industryTemplate = getCreationSelectedIndustryTemplate();
    const skuGenerationRule = typeof getCreationSelectedSkuGenerationRule === "function"
      ? getCreationSelectedSkuGenerationRule()
      : DEFAULT_CREATION_SKU_GENERATION_RULE;
    const rawVisualLanguage = refs.creationVisualLanguageInput?.value;
    const normalizedVisualLanguage = normalizeVisualLanguageForQueue(rawVisualLanguage, normalizeCreationVisualLanguage);
    return normalizeSet({
      ...snapshot,
      setId: createQueueId("creation-local"),
      productName: snapshot.productName || productName,
      productDescription: snapshot.productDescription || productDescription,
      sellingPoints: Array.isArray(snapshot.sellingPoints) ? snapshot.sellingPoints : sellingPoints,
      dimensionSpecs: snapshot.dimensionSpecs || refs.creationDimensionSpecsInput?.value?.trim() || "",
      dimensionSpecGroups: Array.isArray(snapshot.dimensionSpecGroups) ? snapshot.dimensionSpecGroups : [],
      dimensionUnitMode,
      dimensionUnitModeLabel: snapshot.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(dimensionUnitMode),
      targetLanguage: snapshot.targetLanguage || language.value,
      targetLanguageLabel: snapshot.targetLanguageLabel || language.label,
      platform: snapshot.platform || platform.value || DEFAULT_CREATION_PLATFORM.value,
      platformLabel: snapshot.platformLabel || platform.label || DEFAULT_CREATION_PLATFORM.label,
      scenario: snapshot.scenario || scenario.value,
      scenarioLabel: snapshot.scenarioLabel || scenario.label,
      visualLanguage: snapshot.visualLanguage || normalizedVisualLanguage.value,
      visualLanguageLabel: snapshot.visualLanguageLabel || formatVisualLanguageLabelForQueue(rawVisualLanguage, normalizedVisualLanguage, formatCreationVisualLanguageLabel),
      industryTemplate: snapshot.industryTemplate || industryTemplate.value,
      industryTemplateLabel: snapshot.industryTemplateLabel || industryTemplate.label,
      industryTemplatePath: snapshot.industryTemplatePath || industryTemplate.categoryPath || "",
      selectedRoles: Array.isArray(snapshot.selectedRoles) ? snapshot.selectedRoles : getCreationSelectedRoles(),
      referenceImageNames: referenceFiles.map((item) => item.file?.name || "").filter(Boolean),
      referenceImageRoles: typeof buildCreationReferenceRolePayload === "function" ? buildCreationReferenceRolePayload() : [],
      skuSubjects: Array.isArray(snapshot.skuSubjects) ? snapshot.skuSubjects : buildCreationSkuSubjectPayload(),
      skuBundleCount: snapshot.skuBundleCount || normalizeCreationSkuBundleCountForPayload(refs.creationSkuBundleCountInput?.value || "1"),
      skuGenerationRule: snapshot.skuGenerationRule || skuGenerationRule.value || DEFAULT_CREATION_SKU_GENERATION_RULE.value,
      skuGenerationRuleLabel: snapshot.skuGenerationRuleLabel || skuGenerationRule.label || DEFAULT_CREATION_SKU_GENERATION_RULE.label,
      logo: snapshot.logo || (typeof getCreationLogoPayload === "function" ? getCreationLogoPayload() : null),
      effectivePlan: snapshot,
      createdAt,
      updatedAt: createdAt,
      status: "queued",
      items: snapshot.items.map((item, index) => ({ ...structuredClone(item), slotIndex: index + 1, status: "queued" })),
    });
  }
  const editableDraftSet = typeof getCreationDraftSet === "function" ? getCreationDraftSet() : null;
  const draftSet = isCreationDraftSet(editableDraftSet)
    ? editableDraftSet
    : !creationState.generating && isCreationDraftSet()
      ? getCreationCurrentSet()
      : null;
  const draftItems = draftSet?.items?.length ? draftSet.items : null;
  const platform =
    typeof getCreationSelectedPlatform === "function"
      ? getCreationSelectedPlatform()
      : DEFAULT_CREATION_PLATFORM;
  const targetLanguage = getCreationSelectedLanguage();
  const scenario = getCreationSelectedScenario();
  const industryTemplate = getCreationSelectedIndustryTemplate();
  const skuGenerationRule =
    typeof getCreationSelectedSkuGenerationRule === "function"
      ? getCreationSelectedSkuGenerationRule()
      : DEFAULT_CREATION_SKU_GENERATION_RULE;
  const selectedImageCount = Number(getCreationSelectedImageCount());
  const previewSlots = selectedImageCount === 0 ? [] : getCreationPreviewSlots();
  const selectedRoles = selectedImageCount === 0 ? [] : getCreationSelectedRoles();
  const referenceImageRoles = buildCreationReferenceRolePayload();
  const skuGenerationEnabled = normalizeDefaultEnabledBoolean(
    refs.creationSkuGenerationEnabledInput?.checked ?? draftSet?.skuGenerationEnabled,
    true,
  );
  const draftHasInfographicRebuildItems = Array.isArray(draftItems)
    && draftItems.some((item) => isCreationInfographicRebuildQueueRole(getQueueRoleId(item?.role)));
  const infographicRebuildEnabled = selectedImageCount === 0 || normalizeDefaultEnabledBoolean(
    refs.creationInfographicRebuildEnabledInput?.checked ?? draftSet?.infographicRebuildEnabled,
    draftHasInfographicRebuildItems,
  );
  const skuSubjects = buildCreationSkuSubjectPayload();
  const infographicRebuildSources = infographicRebuildEnabled ? getCreationInfographicRebuildSources(referenceImageRoles) : [];
  const shouldUseDraftItems = draftItemsMatchSelectedRoles(draftItems, selectedRoles, {
    skuGenerationEnabled,
    skuImageCount: skuSubjects.length,
    infographicRebuildEnabled,
    infographicRebuildCount: infographicRebuildSources.length,
  });
  const baseSlots = shouldUseDraftItems ? draftItems : previewSlots;
  const baseRoleCount = baseSlots.filter((item) => !isCreationQueuedAppendRole(getQueueRoleId(item?.role))).length;
  const imageCount = selectedImageCount === 0 ? 0 : selectedRoles.length || baseRoleCount || selectedImageCount;
  const rawVisualLanguage = refs.creationVisualLanguageInput?.value;
  const normalizedVisualLanguage = normalizeVisualLanguageForQueue(rawVisualLanguage, normalizeCreationVisualLanguage);
  const queuedSkuSubjects = skuGenerationEnabled ? skuSubjects : [];
  const baseItems = baseSlots.map((slot, index) => ({ ...slot, slotIndex: index + 1, status: "queued" }));
  const items = shouldUseDraftItems
    ? baseItems
    : [
        ...baseItems,
        ...buildCreationQueuedSkuItems(queuedSkuSubjects, baseItems.length, targetLanguage),
        ...buildCreationQueuedInfographicRebuildItems({
          sources: infographicRebuildSources,
          startIndex: baseItems.length + queuedSkuSubjects.length,
        }),
      ];

  return normalizeSet({
    setId: createQueueId("creation-local"),
    productName,
    productDescription,
    sellingPoints,
    dimensionSpecs: refs.creationDimensionSpecsInput.value.trim(),
    dimensionSpecGroups: Array.isArray(draftSet?.dimensionSpecGroups) ? draftSet.dimensionSpecGroups : [],
    dimensionUnitMode: getCreationSelectedDimensionUnitMode(),
    dimensionUnitModeLabel: formatCreationDimensionUnitModeLabel(getCreationSelectedDimensionUnitMode()),
    targetLanguage: targetLanguage.value,
    targetLanguageLabel: targetLanguage.label,
    platform: platform.value || DEFAULT_CREATION_PLATFORM.value,
    platformLabel: platform.label || DEFAULT_CREATION_PLATFORM.label,
    imageCount,
    scenario: scenario.value,
    scenarioLabel: scenario.label,
    visualLanguage: normalizedVisualLanguage.value,
    visualLanguageLabel: formatVisualLanguageLabelForQueue(rawVisualLanguage, normalizedVisualLanguage, formatCreationVisualLanguageLabel),
    industryTemplate: industryTemplate.value,
    industryTemplateLabel: industryTemplate.label,
    industryTemplatePath: industryTemplate.categoryPath || "",
    selectedRoles,
    referenceImageNames: referenceFiles.map((item) => item.file?.name || "").filter(Boolean),
    referenceImageRoles,
    skuGenerationEnabled,
    infographicRebuildEnabled,
    infographicRebuildCount: infographicRebuildSources.length,
    skuSubjects,
    skuBundleCount: normalizeCreationSkuBundleCountForPayload(refs.creationSkuBundleCountInput?.value || "1"),
    skuGenerationRule: skuGenerationRule.value || DEFAULT_CREATION_SKU_GENERATION_RULE.value,
    skuGenerationRuleLabel: skuGenerationRule.label || DEFAULT_CREATION_SKU_GENERATION_RULE.label,
    logo: getCreationLogoPayload(),
    createdAt,
    updatedAt: createdAt,
    status: "queued",
    items,
  });
}

export function buildCreationQueuedRepairFormData(job = {}, {
  autoRepair = false,
  itemId = "",
  promptOverride = "",
  scope = "incomplete",
  set,
} = {}) {
  const formData = new FormData();
  const sourceFormData = job.formData;
  if (sourceFormData && typeof sourceFormData.entries === "function") {
    for (const [key, value] of sourceFormData.entries()) {
      formData.append(key, value);
    }
  }

  formData.set("setId", cleanQueueString(set?.setId || job.set?.setId));
  if (itemId) {
    formData.set("itemId", cleanQueueString(itemId));
    formData.delete("scope");
    if (promptOverride) {
      formData.set("promptOverride", cleanQueueString(promptOverride));
    } else {
      formData.delete("promptOverride");
    }
  } else {
    formData.set("scope", cleanQueueString(scope) || "incomplete");
    formData.delete("itemId");
    formData.delete("promptOverride");
  }

  if (autoRepair) {
    formData.set("autoRepair", "1");
  } else {
    formData.delete("autoRepair");
  }

  return formData;
}

export function renderCreationQueueStrip({
  strip,
  queueJobs = [],
  selectedQueueId = "",
  normalizeSet,
  getProgressSummary,
  getStatusLabel,
  formatClock,
} = {}) {
  if (!strip) {
    return;
  }

  strip.replaceChildren();
  strip.classList.toggle("hidden", queueJobs.length === 0);
  if (queueJobs.length === 0) {
    return;
  }

  queueJobs.forEach((job, index) => {
    const set = normalizeSet(job.set || {});
    const progress = getProgressSummary(set);
    const isActive = job.status === "running";
    const queueLabel = formatCreationQueueLabel(index + 1);

    const button = document.createElement("button");
    button.className = "creation-queue-item";
    button.type = "button";
    button.title = `${queueLabel} · ${set.productName || "未命名商品"} · ${getStatusLabel(set.status)} ${progress.completed}/${progress.total}`;
    button.dataset.creationQueueId = job.id;
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-selected", selectedQueueId === job.id || (!selectedQueueId && isActive));
    button.setAttribute("aria-pressed", String(selectedQueueId === job.id));

    const label = document.createElement("strong");
    label.className = "creation-queue-label";
    label.textContent = queueLabel;

    const status = document.createElement("span");
    status.className = "creation-queue-status";
    status.textContent = getCreationQueueStatusText(job, isActive);

    const meta = document.createElement("small");
    meta.textContent = `${progress.completed}/${progress.total}`;

    button.append(label, status, meta);
    strip.appendChild(button);
  });
}

export async function runCreationQueuedJob(job, context = {}) {
  if (!job || job.status !== "queued") {
    return;
  }

  const {
    creationState,
    compactErrorMessage,
    fetchImpl = fetch,
    loadCreationSets,
    normalizeSet,
    nowIso,
    onFinished,
    render,
    runAutoRepairIfNeeded,
    runCreationStream,
    setFeedback,
    showError,
  } = context;

  job.status = "running";
  creationState.generating = true;
  creationState.generationScope = "full";
  if (!creationState.activeQueueId) {
    creationState.activeQueueId = job.id;
  }
  if (!creationState.selectedQueueId) {
    creationState.selectedQueueId = job.id;
  }
  job.autoRepairAttemptCount = 0;
  job.set = normalizeSet({ ...job.set, status: "generating", updatedAt: nowIso() });
  if (shouldSyncCreationQueueJobCurrentSet(creationState, job)) {
    creationState.currentSet = job.set;
  }
  syncActiveCreationQueueSet(creationState, job.set, normalizeSet);
  render();

  try {
    const response = await fetchImpl("/api/creation/generate", { method: "POST", body: job.formData });
    if (!response.ok || !response.body) {
      throw new Error("套图生成请求失败");
    }

    let terminalEvent = "";
    let terminalMessage = "";
    await runCreationStream(response, {
      queueJob: job,
      onEventHandled: (eventName, payload = {}) => {
        if (eventName === "complete" || eventName === "error") {
          terminalEvent = eventName;
          terminalMessage = cleanQueueString(payload.message);
        }
        const fatalUpstreamError = getCreationStreamFatalUpstreamError(payload);
        if (fatalUpstreamError) {
          failPendingCreationQueueJobs(creationState, fatalUpstreamError, { normalizeSet, nowIso });
        }
        scheduleCreationGenerationQueue(context);
      },
    });
    if (terminalEvent === "error") {
      throw new Error(terminalMessage || "套图生成失败");
    }
    if (terminalEvent !== "complete") {
      throw new Error("套图生成连接中断，仍有未完成项");
    }
    await loadCreationSets();
    if (typeof runAutoRepairIfNeeded === "function") {
      await runAutoRepairIfNeeded(job);
      await loadCreationSets();
    }
    if (!isCreationQueueSetCompleted(job.set)) {
      // Report the upstream reason rather than the generic notice: an account-level
      // failure is what the user has to act on, and the generic text reads as if
      // the suite merely needs another repair pass.
      throw new Error(getCreationFatalUpstreamError(job.set) || "套图生成结束后仍有未完成项");
    }
    job.status = "completed";
    job.set = normalizeSet({
      ...(job.set || creationState.currentSet),
      status: "completed",
      updatedAt: nowIso(),
    });
    if (shouldSyncCreationQueueJobCurrentSet(creationState, job)) {
      creationState.currentSet = job.set;
    }
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图生成请求失败");
    job.status = "failed";
    const currentSet = job.set || creationState.currentSet;
    const currentItems = Array.isArray(currentSet.items) ? currentSet.items : [];
    job.set = normalizeSet({
      ...currentSet,
      status: "failed",
      updatedAt: nowIso(),
      items: currentItems.map((item) => item.status === "completed" ? item : { ...item, status: "failed", error: message }),
    });
    if (shouldSyncCreationQueueJobCurrentSet(creationState, job)) {
      creationState.currentSet = job.set;
    }
    syncActiveCreationQueueSet(creationState, job.set, normalizeSet);
    if (isFatalUpstreamError(message)) {
      failPendingCreationQueueJobs(creationState, message, { normalizeSet, nowIso });
    }
    setFeedback(message, "error");
    showError(message);
  } finally {
    if (typeof onFinished === "function") {
      onFinished(job);
    }
    const runningJobs = getRunningCreationQueueJobs(creationState);
    if (creationState.activeQueueId === job.id) {
      creationState.activeQueueId = runningJobs[0]?.id || "";
    }
    creationState.generating = runningJobs.length > 0;
    creationState.generationScope = runningJobs.length > 0 ? "full" : "";
    render();
    scheduleCreationGenerationQueue(context);
  }
}

export function scheduleCreationGenerationQueue(context = {}) {
  const { creationState, render } = context;
  if (getRunningCreationQueueJobs(creationState).length > 0) {
    render();
    return;
  }

  const nextJob = getCreationQueueJobs(creationState).find((job) => job.status === "queued");
  if (nextJob) {
    void runCreationQueuedJob(nextJob, context);
  } else {
    creationState.generating = false;
    creationState.generationScope = "";
    creationState.activeQueueId = "";
    delete creationState.schedulingSnapshot;
  }

  render();
}
