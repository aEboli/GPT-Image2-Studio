export const CREATION_TEMU_EXPORT_STORAGE_KEY = "image-studio-creation-temu-export-v1";

export const CREATION_TEMU_EXPORT_FIELD_NAMES = Object.freeze([
  "variantAttributeName",
  "defaultPrice",
  "defaultPackageLengthCm",
  "defaultPackageWidthCm",
  "defaultPackageHeightCm",
  "defaultPackageWeightG",
  "defaultStock",
  "defaultOriginCountry",
  "cloudName",
  "uploadPreset",
]);

function cleanString(value) {
  return String(value ?? "").trim();
}

export function getTemuExportFilename(contentDisposition) {
  const header = String(contentDisposition || "");
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/iu)?.[1];
  let filename = "temu-import.xlsx";
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      filename = "temu-import.xlsx";
    }
  } else {
    filename = header.match(/filename="([^"]+)"/iu)?.[1] || header.match(/filename=([^;]+)/iu)?.[1] || filename;
  }
  const safe = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "").trim();
  return safe.toLowerCase().endsWith(".xlsx") ? safe : "temu-import.xlsx";
}

function getTemuExportDomRefs(documentRef) {
  return {
    blockerList: documentRef.querySelector("#creationRecordTemuBlockerList"),
    cancelButton: documentRef.querySelector("#creationRecordTemuExportCancelButton"),
    closeButton: documentRef.querySelector("#creationRecordTemuExportCloseButton"),
    dialog: documentRef.querySelector("#creationRecordTemuExportDialog"),
    exportButton: documentRef.querySelector("#creationRecordExportTemuButton"),
    feedback: documentRef.querySelector("#creationRecordTemuExportFeedback"),
    fields: documentRef.querySelector("#creationRecordTemuExportFields"),
    form: documentRef.querySelector("#creationRecordTemuExportForm"),
    preflightButton: documentRef.querySelector("#creationRecordTemuPreflightButton"),
    preflightState: documentRef.querySelector("#creationRecordTemuPreflightState"),
    problemPanel: documentRef.querySelector("#creationRecordTemuProblemPanel"),
    readiness: documentRef.querySelector("#creationRecordTemuStrictReason"),
    recordList: documentRef.querySelector("#creationRecordSetList"),
    recordSummary: documentRef.querySelector("#creationRecordTemuRecordSummary"),
    recordSummaryList: documentRef.querySelector("#creationRecordTemuRecordList"),
    searchInput: documentRef.querySelector("#creationRecordSearchInput"),
    selectedCount: documentRef.querySelector("#creationRecordTemuExportSelectedCount"),
    stats: {
      blockerCount: documentRef.querySelector("#creationRecordTemuStatBlockerCount"),
      cacheReuseCount: documentRef.querySelector("#creationRecordTemuStatCacheReuseCount"),
      imageCount: documentRef.querySelector("#creationRecordTemuStatImageCount"),
      pendingUploadCount: documentRef.querySelector("#creationRecordTemuStatPendingUploadCount"),
      setCount: documentRef.querySelector("#creationRecordTemuStatSetCount"),
      skuCount: documentRef.querySelector("#creationRecordTemuStatSkuCount"),
      uploadedCount: documentRef.querySelector("#creationRecordTemuStatUploadedCount"),
      warningCount: documentRef.querySelector("#creationRecordTemuStatWarningCount"),
    },
    strictMode: documentRef.querySelector("#creationRecordTemuStrictMode"),
    submitButton: documentRef.querySelector("#creationRecordTemuExportSubmitButton"),
    templateName: documentRef.querySelector("#creationRecordTemuTemplateName"),
    warningList: documentRef.querySelector("#creationRecordTemuWarningList"),
  };
}

function countLocalSkuRows(set) {
  const skuIds = new Set(
    (Array.isArray(set?.items) ? set.items : [])
      .filter((item) => cleanString(item?.role) === "sku")
      .map((item) => cleanString(item?.skuSubjectId || item?.skuId))
      .filter(Boolean),
  );
  if (skuIds.size > 0) return skuIds.size;
  const listingCount = Array.isArray(set?.listingDrafts) ? set.listingDrafts.length : 0;
  return Math.max(1, listingCount);
}

function countLocalImages(set) {
  return (Array.isArray(set?.items) ? set.items : []).filter((item) =>
    [item?.relativePath, item?.publicUrl, item?.temuPublicUrl, item?.imageUrl].some((value) => cleanString(value)),
  ).length;
}

function createLocalSummary(sets) {
  const records = sets.map((set) => ({
    setId: cleanString(set?.setId),
    productName: cleanString(set?.productName) || "未命名商品",
    sourceUpdatedAt: cleanString(set?.updatedAt),
    skuCount: countLocalSkuRows(set),
    imageCount: countLocalImages(set),
    pendingUploadCount: 0,
    uploadedCount: 0,
    cacheReuseCount: 0,
    blockerCount: 0,
    warningCount: 0,
    strictReady: false,
    blockers: [],
    warnings: [],
  }));
  return {
    template: { name: "标准 Temu 模板", version: "", sheetName: "" },
    stats: {
      setCount: records.length,
      skuCount: records.reduce((sum, record) => sum + record.skuCount, 0),
      imageCount: records.reduce((sum, record) => sum + record.imageCount, 0),
      pendingUploadCount: 0,
      uploadedCount: 0,
      cacheReuseCount: 0,
      blockerCount: 0,
      warningCount: 0,
    },
    strictReady: false,
    blockers: [],
    warnings: [],
    records,
  };
}

export function buildCreationTemuPreflightFingerprint(payload, sets = []) {
  const setMap = new Map((Array.isArray(sets) ? sets : []).map((set) => [cleanString(set?.setId), set]));
  const sourceSnapshot = (Array.isArray(payload?.setIds) ? payload.setIds : []).map((setId) => {
    const normalizedSetId = cleanString(setId);
    return [normalizedSetId, cleanString(setMap.get(normalizedSetId)?.updatedAt)];
  });
  return JSON.stringify({
    setIds: payload?.setIds || [],
    defaults: payload?.defaults || {},
    cloudinary: payload?.cloudinary || null,
    sourceSnapshot,
  });
}

function normalizedProblems(value) {
  return Array.isArray(value) ? value.filter((problem) => problem && typeof problem === "object") : [];
}

function problemLabel(problem) {
  const target = [problem?.productName, problem?.skuId || problem?.skuName, problem?.field]
    .map(cleanString)
    .filter(Boolean)
    .join(" / ");
  return [target, cleanString(problem?.message) || cleanString(problem?.code)]
    .filter(Boolean)
    .join("：");
}

function normalizePreflightResponse(payload = {}) {
  const source = payload?.summary && typeof payload.summary === "object" ? payload.summary : payload;
  const blockers = normalizedProblems(source?.blockers || payload?.blockers);
  const warnings = normalizedProblems(source?.warnings || payload?.warnings);
  const stats = source?.stats && typeof source.stats === "object" ? source.stats : {};
  return {
    ...source,
    template: source?.template && typeof source.template === "object" ? source.template : {},
    stats: {
      setCount: Number(stats.setCount) || 0,
      skuCount: Number(stats.skuCount) || 0,
      imageCount: Number(stats.imageCount) || 0,
      pendingUploadCount: Number(stats.pendingUploadCount) || 0,
      uploadedCount: Number(stats.uploadedCount) || 0,
      cacheReuseCount: Number(stats.cacheReuseCount) || 0,
      blockerCount: Number.isFinite(Number(stats.blockerCount)) ? Number(stats.blockerCount) : blockers.length,
      warningCount: Number.isFinite(Number(stats.warningCount)) ? Number(stats.warningCount) : warnings.length,
    },
    blockers,
    warnings,
    records: Array.isArray(source?.records) ? source.records : [],
    strictReady: source?.strictReady === true && blockers.length === 0,
  };
}

export function createCreationTemuExportController({
  state,
  getCurrentSetIds,
  getCurrentSets = () => state?.creation?.sets || [],
  isMutationBusy = () => false,
  refreshSets,
  setRecordFeedback,
  renderRecordView,
  compactErrorMessage = (message) => message,
  documentRef = document,
  windowRef = window,
  fetchImpl = fetch,
  urlApi = URL,
} = {}) {
  const refs = getTemuExportDomRefs(documentRef);
  let restoreFocus = null;
  let phase = "";
  let startBlocked = false;
  let preflight = null;
  let preflightFingerprint = "";
  let localSummary = createLocalSummary([]);

  function isBusy() {
    return Boolean(state?.creation?.recordTemuExportBusy);
  }

  function getCheckedSetIds() {
    const existingSetIds = new Set((getCurrentSetIds?.() || []).map((setId) => cleanString(setId)).filter(Boolean));
    return [...new Set((state?.creation?.recordCheckedSetIds || []).filter((setId) => existingSetIds.has(setId)))];
  }

  function getCheckedSets() {
    const checked = new Set(getCheckedSetIds());
    return (getCurrentSets?.() || []).filter((set) => checked.has(cleanString(set?.setId)));
  }

  function setFeedback(message = "", kind = "") {
    if (!refs.feedback) return;
    refs.feedback.textContent = message || "";
    refs.feedback.dataset.state = kind || "";
  }

  function readSettings() {
    try {
      const stored = JSON.parse(windowRef.localStorage.getItem(CREATION_TEMU_EXPORT_STORAGE_KEY) || "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    } catch {
      return {};
    }
  }

  function applySettings() {
    if (!refs.form) return;
    refs.form.reset();
    const stored = readSettings();
    for (const name of CREATION_TEMU_EXPORT_FIELD_NAMES) {
      const field = refs.form.elements.namedItem(name);
      if (!field) continue;
      field.value = String(stored[name] ?? (name === "variantAttributeName" ? "颜色" : ""));
    }
  }

  function saveSettings(values) {
    const stored = {};
    for (const name of CREATION_TEMU_EXPORT_FIELD_NAMES) {
      stored[name] = cleanString(values[name]);
    }
    try {
      windowRef.localStorage.setItem(CREATION_TEMU_EXPORT_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Export remains available when browser storage is disabled.
    }
  }

  function getMode() {
    const modeControl = refs.form?.elements?.namedItem?.("mode");
    return cleanString(modeControl?.value) === "strict" ? "strict" : "draft";
  }

  function setMode(mode) {
    const modeControl = refs.form?.elements?.namedItem?.("mode");
    if (modeControl) modeControl.value = mode === "strict" ? "strict" : "draft";
  }

  function buildPayload({ mode = getMode() } = {}) {
    const values = Object.fromEntries(
      CREATION_TEMU_EXPORT_FIELD_NAMES.map((name) => [
        name,
        cleanString(refs.form?.elements?.namedItem?.(name)?.value),
      ]),
    );
    const { cloudName, uploadPreset } = values;
    if (Boolean(cloudName) !== Boolean(uploadPreset)) {
      throw new Error("Cloud name 和 unsigned upload preset 必须同时填写或同时留空。");
    }
    const defaults = {};
    for (const name of CREATION_TEMU_EXPORT_FIELD_NAMES.slice(0, 8)) {
      if (values[name] !== "") defaults[name] = values[name];
    }
    return {
      values,
      payload: {
        mode: mode === "strict" ? "strict" : "draft",
        setIds: getCheckedSetIds(),
        defaults,
        ...(cloudName && uploadPreset ? { cloudinary: { cloudName, uploadPreset } } : {}),
      },
    };
  }

  function currentFingerprint() {
    try {
      return buildCreationTemuPreflightFingerprint(buildPayload({ mode: "strict" }).payload, getCheckedSets());
    } catch {
      return "";
    }
  }

  function preflightIsCurrent() {
    return Boolean(preflight && preflightFingerprint && preflightFingerprint === currentFingerprint());
  }

  function summaryMatchesCurrentRecords(summary) {
    const records = new Map((summary?.records || []).map((record) => [cleanString(record?.setId), record]));
    return getCheckedSets().every((set) => {
      const record = records.get(cleanString(set?.setId));
      return record && cleanString(record.sourceUpdatedAt) === cleanString(set?.updatedAt);
    });
  }

  function setText(target, value) {
    if (target) target.textContent = String(value ?? "");
  }

  function renderProblemList(target, problems) {
    if (!target) return;
    target.replaceChildren();
    for (const problem of problems.slice(0, 50)) {
      const item = documentRef.createElement("li");
      const code = documentRef.createElement("strong");
      code.textContent = cleanString(problem?.code) || "TEMU_EXPORT_ISSUE";
      const message = documentRef.createElement("span");
      message.textContent = problemLabel(problem);
      item.append(code, message);
      target.appendChild(item);
    }
  }

  function renderRecordSummary(records) {
    if (!refs.recordSummaryList) return;
    refs.recordSummaryList.replaceChildren();
    for (const record of records) {
      const row = documentRef.createElement("div");
      row.className = "creation-temu-export-record";
      const identity = documentRef.createElement("span");
      const title = documentRef.createElement("strong");
      title.textContent = cleanString(record?.productName) || "未命名商品";
      const meta = documentRef.createElement("small");
      meta.textContent = `${Number(record?.skuCount) || 0} SKU · ${Number(record?.imageCount) || 0} 图片`;
      identity.append(title, meta);
      const status = documentRef.createElement("span");
      status.className = "creation-temu-export-record-status";
      status.dataset.state = record?.strictReady === true ? "success" : "blocked";
      status.textContent = record?.strictReady === true
        ? "可严格导出"
        : `${Number(record?.blockerCount) || 0} 项阻塞`;
      row.append(identity, status);
      refs.recordSummaryList.appendChild(row);
    }
  }

  function renderWorkbench() {
    const summary = preflight || localSummary;
    const stats = summary.stats || {};
    const current = preflightIsCurrent();
    const canStrict = current && summary.strictReady === true && !startBlocked && !isBusy();
    setText(refs.selectedCount, getCheckedSetIds().length);
    setText(refs.stats.setCount, stats.setCount || 0);
    setText(refs.stats.skuCount, stats.skuCount || 0);
    setText(refs.stats.imageCount, stats.imageCount || 0);
    setText(refs.stats.pendingUploadCount, stats.pendingUploadCount || 0);
    setText(refs.stats.uploadedCount, stats.uploadedCount || 0);
    setText(refs.stats.cacheReuseCount, stats.cacheReuseCount || 0);
    setText(refs.stats.blockerCount, stats.blockerCount || 0);
    setText(refs.stats.warningCount, stats.warningCount || 0);
    const template = summary.template || {};
    setText(
      refs.templateName,
      [template.name || "标准 Temu 模板", template.version, template.sheetName].filter(Boolean).join(" · "),
    );

    if (isBusy() && phase === "preflight") {
      setText(refs.preflightState, "正在服务端预检");
    } else if (!preflight) {
      setText(refs.preflightState, "等待预检");
    } else if (!current) {
      setText(refs.preflightState, "预检已过期");
    } else {
      setText(refs.preflightState, summary.strictReady ? "预检通过" : "预检完成");
    }

    if (refs.readiness) {
      refs.readiness.dataset.state = canStrict
        ? "success"
        : preflight && current
          ? "blocked"
          : preflight
            ? "stale"
            : "pending";
      refs.readiness.textContent = canStrict
        ? "当前批次可以严格导出"
        : preflight && !current
          ? "选择或设置已变化，请重新预检"
          : preflight && Number(stats.blockerCount) > 0
            ? `严格导出被 ${stats.blockerCount} 项问题阻塞`
            : "严格导出需先完成服务端预检";
    }

    if (refs.strictMode) refs.strictMode.disabled = !canStrict;
    if (!canStrict && getMode() === "strict") setMode("draft");
    if (refs.submitButton) {
      const strict = getMode() === "strict";
      refs.submitButton.disabled = isBusy() || startBlocked || (strict && !canStrict);
      refs.submitButton.textContent = isBusy() && phase === "export"
        ? "正在生成..."
        : strict
          ? "导出严格 XLSX"
          : "导出待补全 XLSX";
    }
    if (refs.preflightButton) {
      refs.preflightButton.disabled = isBusy() || startBlocked || getCheckedSetIds().length === 0;
      refs.preflightButton.textContent = isBusy() && phase === "preflight"
        ? "正在预检..."
        : preflight
          ? "重新预检"
          : "运行预检";
    }

    const blockers = normalizedProblems(summary.blockers);
    const warnings = normalizedProblems(summary.warnings);
    if (refs.problemPanel) refs.problemPanel.hidden = !preflight || (blockers.length === 0 && warnings.length === 0);
    renderProblemList(refs.blockerList, blockers);
    renderProblemList(refs.warningList, warnings);
    renderRecordSummary(summary.records || []);
    if (refs.recordSummary) refs.recordSummary.hidden = (summary.records || []).length === 0;
  }

  function renderRecordViewPreservingListScroll() {
    const scrollTop = Number(refs.recordList?.scrollTop) || 0;
    const scrollLeft = Number(refs.recordList?.scrollLeft) || 0;
    renderRecordView?.();
    if (refs.recordList) {
      refs.recordList.scrollTop = scrollTop;
      refs.recordList.scrollLeft = scrollLeft;
    }
  }

  function setBusy(busy, nextPhase = "") {
    state.creation.recordTemuExportBusy = Boolean(busy);
    phase = busy ? nextPhase : "";
    if (refs.fields) refs.fields.disabled = Boolean(busy);
    if (refs.cancelButton) refs.cancelButton.disabled = Boolean(busy);
    if (refs.closeButton) refs.closeButton.disabled = Boolean(busy);
    renderRecordViewPreservingListScroll();
    renderWorkbench();
  }

  function syncControls(blocked, checkedCount) {
    startBlocked = Boolean(blocked) || Boolean(isMutationBusy?.());
    if (refs.exportButton) {
      refs.exportButton.disabled = startBlocked || checkedCount === 0;
      refs.exportButton.textContent = isBusy()
        ? phase === "preflight" ? "正在预检..." : "正在导出..."
        : checkedCount > 0
          ? `导出 Temu Excel (${checkedCount})`
          : "导出 Temu Excel";
    }
    if (refs.dialog?.open) renderWorkbench();
  }

  function close({ force = false } = {}) {
    if (!refs.dialog?.open || (isBusy() && !force)) return;
    refs.dialog.close();
  }

  function open() {
    if (isBusy() || startBlocked || isMutationBusy?.()) {
      setRecordFeedback?.("当前记录正在生成、刷新或删除，请完成后再打开 Temu 导出。", "error");
      return;
    }
    const sets = getCheckedSets();
    if (sets.length === 0) {
      setRecordFeedback?.("请先勾选需要导出的套图记录。", "error");
      return;
    }
    applySettings();
    setMode("draft");
    localSummary = createLocalSummary(sets);
    preflight = null;
    preflightFingerprint = "";
    setFeedback("");
    restoreFocus = documentRef.activeElement;
    renderWorkbench();
    refs.dialog?.showModal();
  }

  function triggerDownload(blob, filename) {
    const objectUrl = urlApi.createObjectURL(blob);
    const link = documentRef.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    windowRef.setTimeout(() => urlApi.revokeObjectURL(objectUrl), 1000);
  }

  async function readErrorPayload(response) {
    const payload = await response.json().catch(() => ({}));
    if (payload?.code === "unsupported_runtime_capability") {
      throw new Error("Temu Excel 导出需要在本地应用中运行。");
    }
    if (payload?.code === "TEMU_STRICT_EXPORT_BLOCKED") {
      preflight = normalizePreflightResponse(payload);
      preflightFingerprint = currentFingerprint();
      renderWorkbench();
    }
    const error = new Error(payload?.message || "Temu Excel 导出失败。");
    error.payload = payload;
    throw error;
  }

  async function runPreflight() {
    if (isBusy() || startBlocked || isMutationBusy?.() || !refs.form?.reportValidity()) return;
    let request;
    try {
      request = buildPayload({ mode: "strict" });
      if (request.payload.setIds.length === 0) throw new Error("请先勾选需要导出的套图记录。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error), "error");
      return;
    }

    saveSettings(request.values);
    const fingerprint = buildCreationTemuPreflightFingerprint(request.payload, getCheckedSets());
    setBusy(true, "preflight");
    setFeedback("正在验证模板、字段和最终公网图片...", "busy");
    try {
      const response = await fetchImpl("/api/creation/sets/export-temu-excel/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload),
      });
      if (!response.ok) await readErrorPayload(response);
      const summary = normalizePreflightResponse(await response.json());
      preflight = summary;
      preflightFingerprint = fingerprint;
      if (!summaryMatchesCurrentRecords(summary) || fingerprint !== currentFingerprint()) {
        preflightFingerprint = "";
        setFeedback("预检期间记录或设置发生变化，请重新预检。", "error");
      } else {
        setFeedback(
          summary.strictReady
            ? `预检通过：${summary.stats.skuCount} 个 SKU，0 项阻塞。`
            : `预检完成：${summary.stats.blockerCount} 项阻塞，${summary.stats.warningCount} 项提醒。`,
          summary.strictReady ? "success" : "error",
        );
      }
    } catch (error) {
      setFeedback(compactErrorMessage(error instanceof Error ? error.message : String(error), "Temu 预检失败"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (isBusy() || startBlocked || isMutationBusy?.() || !refs.form?.reportValidity()) return;

    const mode = getMode();
    if (mode === "strict" && (!preflightIsCurrent() || preflight?.strictReady !== true)) {
      setFeedback("严格导出需要当前批次通过服务端预检。", "error");
      renderWorkbench();
      return;
    }

    let request;
    try {
      request = buildPayload({ mode });
      if (request.payload.setIds.length === 0) throw new Error("请先勾选需要导出的套图记录。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error), "error");
      return;
    }

    saveSettings(request.values);
    setBusy(true, "export");
    setFeedback(mode === "strict" ? "正在重新验证并生成严格工作簿..." : "正在生成待补全工作簿...", "busy");
    try {
      const response = await fetchImpl("/api/creation/sets/export-temu-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload),
      });
      if (!response.ok) await readErrorPayload(response);
      const blob = await response.blob();
      if (!blob.size) throw new Error("Temu Excel 导出返回了空文件。");
      triggerDownload(blob, getTemuExportFilename(response.headers.get("Content-Disposition")));

      const setCount = Number(response.headers.get("X-Temu-Export-Set-Count")) || request.payload.setIds.length;
      const rowCount = Number(response.headers.get("X-Temu-Export-Row-Count")) || 0;
      const issueCount = Number(response.headers.get("X-Temu-Export-Issue-Count")) || 0;
      const stateWarningCount = Number(response.headers.get("X-Temu-Export-State-Write-Failure-Count")) || 0;
      let refreshWarning = "";
      try {
        await refreshSets?.();
      } catch {
        refreshWarning = "；记录状态刷新失败，可手动刷新";
      }
      close({ force: true });
      const modeLabel = mode === "strict" ? "严格" : "待补全";
      setRecordFeedback?.(
        `已${modeLabel}导出 ${setCount} 套、${rowCount} 个 SKU；导出问题共 ${issueCount} 项${stateWarningCount ? `，${stateWarningCount} 套状态未写回` : ""}${refreshWarning}。`,
        stateWarningCount || refreshWarning ? "error" : "success",
      );
    } catch (error) {
      setFeedback(compactErrorMessage(error instanceof Error ? error.message : String(error), "Temu Excel 导出失败"), "error");
    } finally {
      setBusy(false);
    }
  }

  function handleFormMutation() {
    if (preflight) renderWorkbench();
    else renderWorkbench();
  }

  function bind() {
    refs.exportButton?.addEventListener("click", open);
    refs.preflightButton?.addEventListener("click", () => {
      runPreflight().catch((error) => setFeedback(error instanceof Error ? error.message : String(error), "error"));
    });
    refs.form?.addEventListener("submit", (event) => {
      submit(event).catch((error) => setFeedback(error instanceof Error ? error.message : String(error), "error"));
    });
    refs.form?.addEventListener("input", handleFormMutation);
    refs.form?.addEventListener("change", handleFormMutation);
    refs.cancelButton?.addEventListener("click", () => close());
    refs.closeButton?.addEventListener("click", () => close());
    refs.dialog?.addEventListener("cancel", (event) => {
      if (isBusy()) event.preventDefault();
    });
    refs.dialog?.addEventListener("click", (event) => {
      if (event.target === refs.dialog) close();
    });
    refs.dialog?.addEventListener("close", () => {
      setFeedback("");
      const target = restoreFocus;
      restoreFocus = null;
      windowRef.setTimeout(() => {
        if (target?.isConnected && !target.disabled) target.focus();
        else refs.searchInput?.focus();
      }, 0);
    });
  }

  bind();
  return { close, getCheckedSetIds, open, runPreflight, submit, syncControls };
}
