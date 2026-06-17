export const CREATION_LOGO_LIBRARY_DB_NAME = "image-studio-creation-logo-library-v1";
export const CREATION_LOGO_LIBRARY_STORE_NAME = "logos";
export const CREATION_LOGO_LIBRARY_INDEX_KEY = "image-studio-creation-logo-library-index-v1";

const MAX_LOGO_LIBRARY_ITEMS = 24;

function nowIso() {
  return new Date().toISOString();
}

function getBrowserWindow() {
  return globalThis.window || null;
}

function getBrowserLocalStorage() {
  return getBrowserWindow()?.localStorage || null;
}

function normalizeLogoSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : 0;
}

export function normalizeCreationLogoLibraryItem(item = {}) {
  const source = item && typeof item === "object" ? item : {};
  const filename = String(source.filename || source.name || "").trim();
  if (!filename) {
    return null;
  }

  const id = String(source.id || `${filename}-${source.size || 0}`).trim();
  const normalized = {
    id,
    filename,
    mimeType: String(source.mimeType || source.type || "image/png").trim() || "image/png",
    savedAt: String(source.savedAt || source.createdAt || nowIso()),
    size: normalizeLogoSize(source.size),
  };
  const dataUrl = String(source.dataUrl || source.previewUrl || "").trim();
  if (dataUrl) {
    normalized.dataUrl = dataUrl;
  }
  return normalized;
}

export function readCreationLogoLibraryIndex() {
  try {
    const raw = getBrowserLocalStorage()?.getItem(CREATION_LOGO_LIBRARY_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeCreationLogoLibraryItem).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

export function writeCreationLogoLibraryIndex(items = []) {
  try {
    getBrowserLocalStorage()?.setItem(
      CREATION_LOGO_LIBRARY_INDEX_KEY,
      JSON.stringify(items.map(normalizeCreationLogoLibraryItem).filter(Boolean).slice(0, MAX_LOGO_LIBRARY_ITEMS)),
    );
  } catch (_error) {
    // Ignore quota/private-mode failures; the current page state can still use uploaded logos.
  }
}

function openCreationLogoLibraryDB() {
  const indexedDB = getBrowserWindow()?.indexedDB;
  if (!indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CREATION_LOGO_LIBRARY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(CREATION_LOGO_LIBRARY_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function withCreationLogoLibraryStore(mode, operation) {
  const db = await openCreationLogoLibraryDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CREATION_LOGO_LIBRARY_STORE_NAME, mode);
    const store = transaction.objectStore(CREATION_LOGO_LIBRARY_STORE_NAME);
    let operationResult = null;
    transaction.oncomplete = () => {
      db.close();
      resolve(operationResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    };
    operationResult = operation(store);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, base64 = ""] = String(dataUrl || "").split(",", 2);
  const mimeType = header.match(/^data:([^;]+);base64$/i)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function buildCreationLogoLibraryId(file) {
  const safeName = String(file?.name || "logo").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "logo";
  return `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
}

async function putCreationLogoLibraryData(item, dataUrl) {
  const saved = await withCreationLogoLibraryStore("readwrite", (store) => {
    store.put({ id: item.id, dataUrl, updatedAt: nowIso() });
    return true;
  });
  if (!saved) {
    throw new Error("当前浏览器不支持长期保存 Logo。");
  }
}

async function getCreationLogoLibraryData(id) {
  return withCreationLogoLibraryStore("readonly", (store) => {
    const request = store.get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.dataUrl || "");
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
    });
  });
}

async function deleteCreationLogoLibraryData(id) {
  await withCreationLogoLibraryStore("readwrite", (store) => {
    store.delete(id);
  });
}

export async function saveCreationLogoLibraryFile(file) {
  if (!(file instanceof File) || !String(file.type || "").startsWith("image/")) {
    throw new Error("请上传图片格式的 Logo。");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const item = normalizeCreationLogoLibraryItem({
    id: buildCreationLogoLibraryId(file),
    filename: file.name || "Logo",
    mimeType: file.type || "image/png",
    savedAt: nowIso(),
    size: file.size || 0,
  });
  await putCreationLogoLibraryData(item, dataUrl);

  const nextIndex = [
    item,
    ...readCreationLogoLibraryIndex().filter((entry) => entry.filename !== item.filename || entry.size !== item.size),
  ].slice(0, MAX_LOGO_LIBRARY_ITEMS);
  writeCreationLogoLibraryIndex(nextIndex);
  await getBrowserWindow()?.navigator?.storage?.persist?.();
  return { ...item, dataUrl };
}

export async function readCreationLogoLibraryItems() {
  const index = readCreationLogoLibraryIndex();
  const items = [];
  const missingIds = new Set();

  for (const entry of index) {
    try {
      const dataUrl = await getCreationLogoLibraryData(entry.id);
      if (!dataUrl) {
        missingIds.add(entry.id);
        continue;
      }
      items.push({ ...entry, dataUrl });
    } catch (_error) {
      missingIds.add(entry.id);
    }
  }

  if (missingIds.size > 0) {
    writeCreationLogoLibraryIndex(index.filter((entry) => !missingIds.has(entry.id)));
  }
  return items;
}

export async function deleteCreationLogoLibraryItem(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return;
  }

  writeCreationLogoLibraryIndex(readCreationLogoLibraryIndex().filter((entry) => entry.id !== normalizedId));
  try {
    await deleteCreationLogoLibraryData(normalizedId);
  } catch (_error) {
    // The visible library index is already updated; stale binary data can be ignored.
  }
}

function getDefaultDeleteConfirmation() {
  const browserWindow = getBrowserWindow();
  return typeof browserWindow?.confirm === "function"
    ? browserWindow.confirm.bind(browserWindow)
    : null;
}

export function confirmCreationLogoLibraryDelete(item = {}, confirmDelete = getDefaultDeleteConfirmation()) {
  const normalized = normalizeCreationLogoLibraryItem(item) || {};
  const filename = normalized.filename || String(item?.filename || item?.name || "").trim() || "这个 Logo";
  if (typeof confirmDelete !== "function") {
    return false;
  }
  return Boolean(confirmDelete(`确认删除常用 Logo「${filename}」吗？删除后需要重新上传才能恢复。`));
}

export function creationLogoLibraryItemToFile(item = {}) {
  const normalized = normalizeCreationLogoLibraryItem(item);
  if (!normalized || !item.dataUrl) {
    return null;
  }

  const blob = dataUrlToBlob(item.dataUrl);
  return new File([blob], normalized.filename, {
    type: normalized.mimeType || blob.type || "image/png",
    lastModified: Date.parse(normalized.savedAt) || Date.now(),
  });
}

export function createCreationLogoLibraryController({
  applyLogoFile,
  confirmDelete = getDefaultDeleteConfirmation(),
  refs = {},
  setFeedback = () => {},
  showError = () => {},
} = {}) {
  let isOpen = false;
  let isLoading = false;
  let items = [];
  let selectedFilename = "";

  function mountCreationLogoLibraryPanel() {
    const panel = refs.creationLogoLibraryPanel;
    const document = globalThis.document;
    if (!panel || !document?.body || panel.parentElement === document.body) {
      return;
    }

    document.body.appendChild(panel);
  }

  function positionCreationLogoLibraryPanel() {
    const panel = refs.creationLogoLibraryPanel;
    const button = refs.creationLogoLibraryButton;
    const browserWindow = globalThis.window;
    if (!isOpen || !panel || !button || !browserWindow) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = browserWindow.innerWidth || 0;
    const viewportHeight = browserWindow.innerHeight || 0;
    const margin = 8;
    const gap = 8;
    const panelWidth = Math.min(300, Math.max(0, viewportWidth - margin * 2));
    const panelHeight = Math.min(420, viewportHeight * 0.7);
    const preferredLeft = buttonRect.right + gap;
    const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - panelWidth - margin));
    const preferredTop = buttonRect.bottom + gap;
    const top = Math.max(margin, Math.min(preferredTop, viewportHeight - panelHeight - margin));

    panel.style.setProperty("--creation-logo-library-left", `${Math.round(left)}px`);
    panel.style.setProperty("--creation-logo-library-top", `${Math.round(top)}px`);
  }

  function setOpen(nextOpen) {
    isOpen = Boolean(nextOpen);
    render();
    if (isOpen && items.length === 0 && !isLoading) {
      void load();
    }
  }

  function render(next = {}) {
    selectedFilename = String(next.selectedFilename ?? selectedFilename ?? "");
    refs.creationLogoLibraryButton?.setAttribute("aria-expanded", String(isOpen));
    refs.creationLogoLibraryPanel?.classList.toggle("hidden", !isOpen);
    positionCreationLogoLibraryPanel();
    if (refs.creationLogoLibraryCount) {
      refs.creationLogoLibraryCount.textContent = isLoading ? "读取中" : `${items.length} 个已保存`;
    }
    if (refs.creationLogoLibraryEmpty) {
      refs.creationLogoLibraryEmpty.classList.toggle("hidden", isLoading || items.length > 0);
    }
    if (!refs.creationSavedLogoGrid) {
      return;
    }

    refs.creationSavedLogoGrid.innerHTML = "";
    refs.creationSavedLogoGrid.classList.toggle("hidden", isLoading || items.length === 0);
    for (const item of items) {
      const card = document.createElement("div");
      card.className = "creation-saved-logo-card";
      if (item.filename === selectedFilename) {
        card.classList.add("selected");
      }

      const selectButton = document.createElement("button");
      selectButton.className = "creation-saved-logo-select";
      selectButton.type = "button";
      selectButton.dataset.creationLogoLibrarySelectId = item.id;
      selectButton.setAttribute("aria-label", `引用 Logo ${item.filename}`);
      selectButton.title = item.filename;

      const image = document.createElement("img");
      image.src = item.dataUrl;
      image.alt = "";
      image.loading = "lazy";
      selectButton.appendChild(image);

      card.appendChild(selectButton);

      const removeButton = document.createElement("button");
      removeButton.className = "creation-saved-logo-remove";
      removeButton.type = "button";
      removeButton.dataset.creationLogoLibraryDeleteId = item.id;
      removeButton.setAttribute("aria-label", `删除 Logo ${item.filename}`);
      removeButton.textContent = "x";
      card.appendChild(removeButton);
      refs.creationSavedLogoGrid.appendChild(card);
    }
  }

  async function load() {
    isLoading = true;
    render();
    try {
      items = await readCreationLogoLibraryItems();
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      isLoading = false;
      render();
    }
  }

  async function saveFiles(fileList, { applySaved = true } = {}) {
    const files = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      return;
    }

    isLoading = true;
    render();
    try {
      let firstSaved = null;
      for (const file of files) {
        const saved = await saveCreationLogoLibraryFile(file);
        firstSaved ||= saved;
      }
      items = await readCreationLogoLibraryItems();
      const selectedFile = firstSaved ? creationLogoLibraryItemToFile(firstSaved) : null;
      if (selectedFile && applySaved) {
        applyLogoFile?.([selectedFile], { persist: false });
      }
      setFeedback("Logo 已保存到常用库。");
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      if (refs.creationLogoLibraryInput) {
        refs.creationLogoLibraryInput.value = "";
      }
      isLoading = false;
      render();
    }
  }

  function selectItem(id) {
    const item = items.find((entry) => entry.id === id);
    const file = item ? creationLogoLibraryItemToFile(item) : null;
    if (!file) {
      showError("这个 Logo 暂时无法读取，请重新上传。");
      return;
    }

    applyLogoFile?.([file], { persist: false });
    setFeedback("已引用常用 Logo。");
    setOpen(false);
  }

  async function deleteItem(id) {
    const item = items.find((entry) => entry.id === id);
    if (!confirmCreationLogoLibraryDelete(item, confirmDelete)) {
      return;
    }
    await deleteCreationLogoLibraryItem(id);
    items = items.filter((item) => item.id !== id);
    render();
  }

  function bind() {
    mountCreationLogoLibraryPanel();
    refs.creationLogoLibraryButton?.addEventListener("click", () => setOpen(!isOpen));
    refs.creationLogoLibraryCloseButton?.addEventListener("click", () => setOpen(false));
    refs.creationForm?.addEventListener("scroll", positionCreationLogoLibraryPanel, { passive: true });
    if (typeof window !== "undefined") {
      window.addEventListener("resize", positionCreationLogoLibraryPanel);
    }
    globalThis.document?.addEventListener("click", (event) => {
      if (!isOpen) {
        return;
      }
      const target = event.target;
      if (
        refs.creationLogoLibraryButton?.contains(target) ||
        refs.creationLogoLibraryPanel?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    });
    globalThis.document?.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen) {
        setOpen(false);
      }
    });
    refs.creationLogoLibraryInput?.addEventListener("change", (event) => {
      saveFiles(event.target.files).catch((error) => showError(error instanceof Error ? error.message : String(error)));
    });
    refs.creationSavedLogoGrid?.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-creation-logo-library-delete-id]");
      if (deleteButton) {
        deleteItem(deleteButton.dataset.creationLogoLibraryDeleteId).catch((error) =>
          showError(error instanceof Error ? error.message : String(error)),
        );
        return;
      }

      const selectButton = event.target.closest("[data-creation-logo-library-select-id]");
      if (selectButton) {
        selectItem(selectButton.dataset.creationLogoLibrarySelectId);
      }
    });
  }

  return {
    bind,
    load,
    render,
    saveFiles,
  };
}
