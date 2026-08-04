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
    cancelButton: documentRef.querySelector("#creationRecordTemuExportCancelButton"),
    closeButton: documentRef.querySelector("#creationRecordTemuExportCloseButton"),
    dialog: documentRef.querySelector("#creationRecordTemuExportDialog"),
    exportButton: documentRef.querySelector("#creationRecordExportTemuButton"),
    feedback: documentRef.querySelector("#creationRecordTemuExportFeedback"),
    fields: documentRef.querySelector("#creationRecordTemuExportFields"),
    form: documentRef.querySelector("#creationRecordTemuExportForm"),
    recordList: documentRef.querySelector("#creationRecordSetList"),
    searchInput: documentRef.querySelector("#creationRecordSearchInput"),
    selectedCount: documentRef.querySelector("#creationRecordTemuExportSelectedCount"),
    submitButton: documentRef.querySelector("#creationRecordTemuExportSubmitButton"),
  };
}

export function createCreationTemuExportController({
  state,
  getCurrentSetIds,
  setRecordFeedback,
  renderRecordView,
  compactErrorMessage = (message) => message,
  documentRef = document,
  windowRef = window,
  fetchImpl = fetch,
  FormDataCtor = FormData,
  urlApi = URL,
} = {}) {
  const refs = getTemuExportDomRefs(documentRef);
  let restoreFocus = null;

  function isBusy() {
    return Boolean(state?.creation?.recordTemuExportBusy);
  }

  function getCheckedSetIds() {
    const existingSetIds = new Set((getCurrentSetIds?.() || []).map((setId) => String(setId || "").trim()).filter(Boolean));
    return [...new Set((state?.creation?.recordCheckedSetIds || []).filter((setId) => existingSetIds.has(setId)))];
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
      stored[name] = String(values[name] ?? "").trim();
    }
    try {
      windowRef.localStorage.setItem(CREATION_TEMU_EXPORT_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Export remains available when browser storage is disabled.
    }
  }

  function syncControls(deleteBlocked, checkedCount) {
    if (refs.exportButton) {
      refs.exportButton.disabled = Boolean(deleteBlocked) || checkedCount === 0;
      refs.exportButton.textContent = isBusy()
        ? "正在导出..."
        : checkedCount > 0
          ? `导出 Temu Excel (${checkedCount})`
          : "导出 Temu Excel";
    }
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

  function setBusy(busy) {
    state.creation.recordTemuExportBusy = Boolean(busy);
    if (refs.fields) refs.fields.disabled = Boolean(busy);
    if (refs.submitButton) {
      refs.submitButton.disabled = Boolean(busy);
      refs.submitButton.textContent = busy ? "正在生成..." : "生成并下载 XLSX";
    }
    if (refs.cancelButton) refs.cancelButton.disabled = Boolean(busy);
    if (refs.closeButton) refs.closeButton.disabled = Boolean(busy);
    renderRecordViewPreservingListScroll();
  }

  function close({ force = false } = {}) {
    if (!refs.dialog?.open || (isBusy() && !force)) return;
    refs.dialog.close();
  }

  function open() {
    if (isBusy()) return;
    const setIds = getCheckedSetIds();
    if (setIds.length === 0) {
      setRecordFeedback?.("请先勾选需要导出的套图记录。", "error");
      return;
    }
    applySettings();
    setFeedback("");
    if (refs.selectedCount) refs.selectedCount.textContent = String(setIds.length);
    restoreFocus = documentRef.activeElement;
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

  function buildPayload() {
    const formData = new FormDataCtor(refs.form);
    const values = Object.fromEntries(CREATION_TEMU_EXPORT_FIELD_NAMES.map((name) => [name, String(formData.get(name) || "").trim()]));
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
        setIds: getCheckedSetIds(),
        defaults,
        ...(cloudName && uploadPreset ? { cloudinary: { cloudName, uploadPreset } } : {}),
      },
    };
  }

  async function submit(event) {
    event.preventDefault();
    if (isBusy() || !refs.form?.reportValidity()) return;

    let request;
    try {
      request = buildPayload();
      if (request.payload.setIds.length === 0) throw new Error("请先勾选需要导出的套图记录。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error), "error");
      return;
    }

    saveSettings(request.values);
    setBusy(true);
    setFeedback("正在整理 SKU、图片链接和导出问题...", "busy");
    try {
      const response = await fetchImpl("/api/creation/sets/export-temu-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.code === "unsupported_runtime_capability") {
          throw new Error("Temu Excel 导出需要在本地应用中运行。");
        }
        throw new Error(payload?.message || "Temu Excel 导出失败。");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Temu Excel 导出返回了空文件。");
      triggerDownload(blob, getTemuExportFilename(response.headers.get("Content-Disposition")));

      const setCount = Number(response.headers.get("X-Temu-Export-Set-Count")) || request.payload.setIds.length;
      const rowCount = Number(response.headers.get("X-Temu-Export-Row-Count")) || 0;
      const issueCount = Number(response.headers.get("X-Temu-Export-Issue-Count")) || 0;
      const issueSheetHeader = response.headers.get("X-Temu-Export-Issue-Sheet") || "";
      let issueSheetName = "导出问题";
      try {
        issueSheetName = decodeURIComponent(issueSheetHeader) || issueSheetName;
      } catch {
        // The default sheet name remains useful when a proxy rewrites the header.
      }
      close({ force: true });
      setRecordFeedback?.(`已导出 ${setCount} 套、${rowCount} 个 SKU；${issueSheetName}共 ${issueCount} 项。`, "success");
    } catch (error) {
      setFeedback(compactErrorMessage(error instanceof Error ? error.message : String(error), "Temu Excel 导出失败"), "error");
    } finally {
      setBusy(false);
    }
  }

  function bind() {
    refs.exportButton?.addEventListener("click", open);
    refs.form?.addEventListener("submit", (event) => {
      submit(event).catch((error) => setFeedback(error instanceof Error ? error.message : String(error), "error"));
    });
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
  return { close, getCheckedSetIds, open, submit, syncControls };
}
