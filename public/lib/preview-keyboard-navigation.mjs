function isTextEditingTarget(target) {
  if (!target || typeof target !== "object") {
    return false;
  }

  const tagName = String(target.tagName || "").toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean(target.isContentEditable);
}

function getNavigationIndex(items = [], item = {}, getImageUrl = () => "") {
  const itemId = String(item?.itemId || item?.id || item?.filename || item?.relativePath || "").trim();
  const itemUrl = getImageUrl(item);
  return items.findIndex((entry) => {
    const entryId = String(entry?.itemId || entry?.id || entry?.filename || entry?.relativePath || "").trim();
    return (itemId && entryId === itemId) || (itemUrl && getImageUrl(entry) === itemUrl);
  });
}

function getPreviewEntryIndex(items = [], currentId = "") {
  const normalizedId = String(currentId || "").trim();
  return items.findIndex((item) => String(item?.id || item?.itemId || item?.filename || "").trim() === normalizedId);
}

function scheduleFrame(callback) {
  const requestFrame = globalThis.window?.requestAnimationFrame || globalThis.requestAnimationFrame;
  if (typeof requestFrame === "function") {
    requestFrame.call(globalThis.window || globalThis, callback);
    return;
  }
  callback();
}

export function createPreviewKeyboardNavigationController({
  refs,
  state,
  getImageUrl,
  resetLightboxViewer,
  syncLightboxImageMetrics,
  syncLightboxItem,
} = {}) {
  function clearLightboxNavigation() {
    state.lightboxNavigation = { items: [], index: -1, buildItem: null };
  }

  function normalizeLightboxNavigation(item, navigation = null) {
    const sourceItems = Array.isArray(navigation?.items)
      ? navigation.items.filter((entry) => entry && getImageUrl(entry))
      : [];
    if (sourceItems.length === 0) {
      clearLightboxNavigation();
      return;
    }

    const buildItem = typeof navigation?.buildItem === "function" ? navigation.buildItem : (entry) => entry;
    const index = navigation.index !== undefined ? Number(navigation.index) : getNavigationIndex(sourceItems, item, getImageUrl);
    state.lightboxNavigation = {
      items: sourceItems,
      index: Number.isFinite(index) && index >= 0 ? index : Math.max(0, getNavigationIndex(sourceItems, item, getImageUrl)),
      buildItem,
    };
  }

  function openLightboxNavigationItem(direction) {
    const navigation = state.lightboxNavigation || {};
    const items = Array.isArray(navigation.items) ? navigation.items : [];
    if (items.length <= 1) {
      return false;
    }

    const step = direction >= 0 ? 1 : -1;
    let nextIndex = Number.isInteger(navigation.index) ? navigation.index : 0;
    for (let attempt = 0; attempt < items.length; attempt += 1) {
      nextIndex = (nextIndex + step + items.length) % items.length;
      const sourceItem = items[nextIndex];
      const lightboxItem = navigation.buildItem ? navigation.buildItem(sourceItem) : sourceItem;
      if (lightboxItem && getImageUrl(lightboxItem)) {
        state.lightboxNavigation.index = nextIndex;
        state.lightboxItem = lightboxItem;
        resetLightboxViewer();
        syncLightboxItem();
        scheduleFrame(() => syncLightboxImageMetrics());
        return true;
      }
    }
    return false;
  }

  function setReferencePreviewNavigationContext({ items = [], currentId = "" } = {}) {
    const previewItems = Array.isArray(items) ? items.filter((item) => item?.previewUrl) : [];
    const index = getPreviewEntryIndex(previewItems, currentId);
    state.referencePreviewNavigation = {
      items: previewItems,
      index: index >= 0 ? index : (previewItems.length > 0 ? 0 : -1),
    };
  }

  function getReferencePreviewNavigationEntries() {
    if (state.referencePreviewItem) {
      return state.referenceFiles;
    }
    if (state.referenceAnalysisPreviewItem) {
      return state.referenceAnalysis.files;
    }
    if (state.imageDecompositionPreviewItem) {
      return [state.imageDecomposition.file].filter(Boolean);
    }
    if (state.styleTransferPreviewItem) {
      return [state.styleTransfer.source, state.styleTransfer.style].filter(Boolean);
    }
    return state.referencePreviewNavigation.items || [];
  }

  function openReferencePreviewByDirection(direction) {
    if (!refs.referencePreviewViewer.classList.contains("open")) {
      return false;
    }

    const items = getReferencePreviewNavigationEntries().filter((item) => item?.previewUrl);
    if (items.length <= 1) {
      return false;
    }

    const currentId = String(
      state.referencePreviewItem?.id ||
        state.referenceAnalysisPreviewItem?.id ||
        state.imageDecompositionPreviewItem?.id ||
        state.styleTransferPreviewItem?.id ||
        state.quickBlendPreviewItem?.id ||
        state.imageEditPreviewItem?.id ||
        state.referencePreviewNavigation.items?.[state.referencePreviewNavigation.index]?.id ||
        "",
    );
    const currentIndex = Math.max(0, getPreviewEntryIndex(items, currentId));
    const step = direction >= 0 ? 1 : -1;
    const nextIndex = (currentIndex + step + items.length) % items.length;
    const nextItem = items[nextIndex];

    state.referencePreviewItem = null;
    state.referenceAnalysisPreviewItem = null;
    state.imageDecompositionPreviewItem = null;
    state.styleTransferPreviewItem = null;
    state.quickBlendPreviewItem = null;
    state.imageEditPreviewItem = null;
    setReferencePreviewNavigationContext({ items, currentId: nextItem.id });
    refs.referencePreviewImage.src = nextItem.previewUrl;
    refs.referencePreviewViewer.classList.add("open");
    refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
    return true;
  }

  function getPromptAgentPreviewNavigationEntries() {
    return [
      state.promptAgent.previewUrl ? { id: "current", previewUrl: state.promptAgent.previewUrl } : null,
      ...state.promptAgent.history.filter((item) => getImageUrl(item)).map((item) => ({
        id: item.id || item.filename,
        previewUrl: getImageUrl(item),
      })),
    ].filter((item) => item?.previewUrl);
  }

  function openPromptAgentPreviewByDirection(direction) {
    if (!refs.promptAgentImageViewer.classList.contains("open")) {
      return false;
    }

    const items = getPromptAgentPreviewNavigationEntries();
    if (items.length <= 1) {
      return false;
    }

    const currentSrc = refs.promptAgentImageViewerImage.getAttribute("src") || "";
    const currentIndex = Math.max(0, items.findIndex((item) => item.previewUrl === currentSrc));
    const step = direction >= 0 ? 1 : -1;
    const nextItem = items[(currentIndex + step + items.length) % items.length];
    state.promptAgent.viewerOpen = true;
    refs.promptAgentImageViewerImage.src = nextItem.previewUrl;
    refs.promptAgentImageViewer.classList.add("open");
    refs.promptAgentImageViewer.setAttribute("aria-hidden", "false");
    return true;
  }

  function handlePreviewArrowNavigation(event) {
    if (!(event.key === "ArrowLeft" || event.key === "ArrowRight") || isTextEditingTarget(event.target)) {
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (!refs.lightbox.classList.contains("hidden")) {
      if (openLightboxNavigationItem(direction)) {
        event.preventDefault();
      }
      return;
    }

    if (refs.referencePreviewViewer.classList.contains("open")) {
      if (openReferencePreviewByDirection(direction)) {
        event.preventDefault();
      }
      return;
    }

    if (refs.promptAgentImageViewer.classList.contains("open") && openPromptAgentPreviewByDirection(direction)) {
      event.preventDefault();
    }
  }

  return {
    clearLightboxNavigation,
    handlePreviewArrowNavigation,
    normalizeLightboxNavigation,
    openLightboxNavigationItem,
    openPromptAgentPreviewByDirection,
    openReferencePreviewByDirection,
    setReferencePreviewNavigationContext,
  };
}
