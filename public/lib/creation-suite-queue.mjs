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
    if ((activeQueueId && queueJob.id === activeQueueId) || (setId && queueSetId === setId)) {
      queueJob.set = normalizedSet;
    }
  });
}

export function selectCreationQueueJob(creationState = {}, queueId) {
  const nextId = String(queueId || "");
  if (!getCreationQueueJobs(creationState).some((job) => job.id === nextId)) {
    return false;
  }

  creationState.selectedQueueId = nextId;
  return true;
}

function createQueueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCreationQueueJob({ creationState, formData, set, normalizeSet, nowIso, idFactory = createQueueId } = {}) {
  const normalizedSet = normalizeSet(set);
  const job = {
    id: idFactory("creation-queue"),
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
  label: "主体下方显示颜色名",
};

function cleanQueueString(value) {
  return String(value || "").trim();
}

function normalizeDefaultEnabledBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return true;
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

function draftItemsMatchSelectedRoles(draftItems, selectedRoles, { infographicRebuildEnabled = true, infographicRebuildCount = 0 } = {}) {
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

  return (
    selectedRoleIds.length > 0 &&
    selectedRoleIds.length === draftRoleIds.length &&
    selectedRoleIds.every((role, index) => role === draftRoleIds[index]) &&
    draftInfographicRebuildCount === (infographicRebuildEnabled ? infographicRebuildCount : 0)
  );
}

function formatCreationQueueLabel(index) {
  const queueIndex = Math.max(1, Number(index) || 1);
  return `队列${QUEUE_NUMBER_LABELS[queueIndex - 1] || queueIndex}`;
}

function buildCreationQueuedSkuTitle(skuSubject = {}, index = 0) {
  const title = cleanQueueString(skuSubject.title || skuSubject.name || skuSubject.id || skuSubject.filenames?.[0]);
  return title ? `SKU image ${index + 1} - ${title}` : `SKU image ${index + 1}`;
}

function buildCreationQueuedSkuItems(skuSubjects = [], startIndex = 0) {
  return (Array.isArray(skuSubjects) ? skuSubjects : [])
    .map((skuSubject, index) => ({
      itemId: `queued-sku-${index + 1}`,
      role: "sku",
      title: buildCreationQueuedSkuTitle(skuSubject, index),
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
  source.index = index;
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

function getCreationSubjectReferenceNames(referenceRoles = []) {
  return (Array.isArray(referenceRoles) ? referenceRoles : [])
    .filter((referenceRole) => isCreationSubjectReferenceRole(referenceRole?.role))
    .map(getCreationReferenceFilename)
    .filter(Boolean);
}

function buildCreationQueuedInfographicRebuildTitle(source = {}, index = 0) {
  const label = cleanQueueString(source.roleLabel || source.role || source.filename);
  const suffix = label ? ` - ${label}` : "";
  return `信息图重构 ${index + 1}${suffix}`;
}

function buildCreationQueuedInfographicRebuildItems({ referenceRoles = [], sources = [], startIndex = 0 } = {}) {
  const subjectReferenceNames = getCreationSubjectReferenceNames(referenceRoles);
  return (Array.isArray(sources) ? sources : []).map((source, index) => ({
    itemId: `queued-infographic-rebuild-${index + 1}`,
    role: "infographic-rebuild",
    title: buildCreationQueuedInfographicRebuildTitle(source, index),
    slotIndex: startIndex + index + 1,
    status: "queued",
    referenceImageNames: [...subjectReferenceNames, source.filename].filter(Boolean),
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

export function buildCreationQueuedSet({
  buildCreationReferenceRolePayload,
  buildCreationSkuSubjectPayload,
  createdAt,
  creationState,
  formatCreationDimensionUnitModeLabel,
  formatCreationVisualLanguageLabel,
  getCreationCurrentSet,
  getCreationLogoPayload,
  getCreationPreviewSlots,
  getCreationSelectedDimensionUnitMode,
  getCreationSelectedImageCount,
  getCreationSelectedIndustryTemplate,
  getCreationSelectedLanguage,
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
  const draftSet = !creationState.generating && isCreationDraftSet() ? getCreationCurrentSet() : null;
  const draftItems = draftSet?.items?.length ? draftSet.items : null;
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
  const infographicRebuildEnabled = selectedImageCount === 0 || normalizeDefaultEnabledBoolean(
    refs.creationInfographicRebuildEnabledInput?.checked ?? draftSet?.infographicRebuildEnabled,
  );
  const infographicRebuildSources = infographicRebuildEnabled ? getCreationInfographicRebuildSources(referenceImageRoles) : [];
  const shouldUseDraftItems = draftItemsMatchSelectedRoles(draftItems, selectedRoles, {
    infographicRebuildEnabled,
    infographicRebuildCount: infographicRebuildSources.length,
  });
  const baseSlots = shouldUseDraftItems ? draftItems : previewSlots;
  const baseRoleCount = baseSlots.filter((item) => !isCreationQueuedAppendRole(getQueueRoleId(item?.role))).length;
  const imageCount = selectedImageCount === 0 ? 0 : selectedRoles.length || baseRoleCount || selectedImageCount;
  const rawVisualLanguage = refs.creationVisualLanguageInput?.value;
  const normalizedVisualLanguage = normalizeVisualLanguageForQueue(rawVisualLanguage, normalizeCreationVisualLanguage);
  const skuSubjects = buildCreationSkuSubjectPayload();
  const baseItems = baseSlots.map((slot, index) => ({ ...slot, slotIndex: index + 1, status: "queued" }));
  const items = shouldUseDraftItems
    ? baseItems
    : [
        ...baseItems,
        ...buildCreationQueuedSkuItems(skuSubjects, baseItems.length),
        ...buildCreationQueuedInfographicRebuildItems({
          referenceRoles: referenceImageRoles,
          sources: infographicRebuildSources,
          startIndex: baseItems.length + skuSubjects.length,
        }),
      ];

  return normalizeSet({
    setId: createQueueId("creation-local"),
    productName,
    productDescription,
    sellingPoints,
    dimensionSpecs: refs.creationDimensionSpecsInput.value.trim(),
    dimensionUnitMode: getCreationSelectedDimensionUnitMode(),
    dimensionUnitModeLabel: formatCreationDimensionUnitModeLabel(getCreationSelectedDimensionUnitMode()),
    targetLanguage: getCreationSelectedLanguage().value,
    targetLanguageLabel: getCreationSelectedLanguage().label,
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

export function buildCreationQueuedRepairFormData(job = {}, { itemId = "", promptOverride = "", scope = "incomplete", set } = {}) {
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
  creationState.editingItemId = "";
  job.set = normalizeSet({ ...job.set, status: "generating", updatedAt: nowIso() });
  if (creationState.selectedQueueId === job.id || creationState.activeQueueId === job.id) {
    creationState.currentSet = job.set;
  }
  syncActiveCreationQueueSet(creationState, job.set, normalizeSet);
  render();

  try {
    const response = await fetchImpl("/api/creation/generate", { method: "POST", body: job.formData });
    if (!response.ok || !response.body) {
      throw new Error("套图生成请求失败");
    }

    await runCreationStream(response, {
      queueJob: job,
      onEventHandled: () => scheduleCreationGenerationQueue(context),
    });
    await loadCreationSets();
    if (typeof runAutoRepairIfNeeded === "function") {
      await runAutoRepairIfNeeded(job);
      await loadCreationSets();
    }
    job.status = "completed";
    job.set = normalizeSet({
      ...(job.set || creationState.currentSet),
      status: "completed",
      updatedAt: nowIso(),
    });
    if (creationState.selectedQueueId === job.id || creationState.activeQueueId === job.id) {
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
    if (creationState.selectedQueueId === job.id || creationState.activeQueueId === job.id) {
      creationState.currentSet = job.set;
    }
    syncActiveCreationQueueSet(creationState, job.set, normalizeSet);
    setFeedback(message, "error");
    showError(message);
  } finally {
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
  const { creationState, getMaxParallelTasks, maxActiveSuites = 2, maxParallelTasks, render } = context;
  const resolvedMaxParallelTasks = Number(
    typeof getMaxParallelTasks === "function" ? getMaxParallelTasks() : maxParallelTasks,
  );
  const parallelBudget = Number.isFinite(resolvedMaxParallelTasks) && resolvedMaxParallelTasks > 0 ? resolvedMaxParallelTasks : 1;
  let reservedItemCount = getRunningCreationQueueReservedItemCount(creationState);
  let runningSuiteCount = getRunningCreationQueueJobs(creationState).length;
  let startedJob = false;

  while (reservedItemCount < parallelBudget && runningSuiteCount < maxActiveSuites) {
    const nextJob = getCreationQueueJobs(creationState).find((job) => job.status === "queued");
    if (!nextJob) {
      break;
    }

    const nextReservedCount = getCreationQueueJobReservedItemCount(nextJob);
    void runCreationQueuedJob(nextJob, context);
    reservedItemCount += nextReservedCount;
    runningSuiteCount += 1;
    startedJob = true;
  }

  if (!startedJob && runningSuiteCount === 0) {
    creationState.generating = false;
    creationState.generationScope = "";
    creationState.activeQueueId = "";
  }

  render();
}
