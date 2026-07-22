import {
  buildAssetRecordDeleteConfirmation,
  getAssetRecordDeleteTargets,
  normalizeAssetRecordDeleteIds,
  resolveAssetRecordSelectionAfterDelete,
} from "./asset-record-delete.mjs";

export function createAssetRecordDeleteController({ refs, state, actions }) {
  const {
    closeLightbox,
    deleteBrowserCachedGalleryItem,
    filterArticleRecords,
    filterPortraitRecords,
    forgetGalleryMetadata,
    formatArticleTitle,
    getArticleCurrentRecord,
    getGalleryVisibleItems,
    getPortraitCurrentRecord,
    getPortraitTitle,
    getPptRecordKey,
    isPortraitRefreshing,
    preserveGalleryItem,
    renderArticleRecords,
    renderArticleWorkspace,
    renderGalleryWorkspace,
    renderPortraitRecords,
    renderPortraitWorkspace,
    renderPptWorkspace,
    setArticleFeedback,
    setPortraitFeedback,
  } = actions;
  let restoreFocus = null;

  function setGalleryFeedback(message = "", kind = "") {
    state.galleryDeleteFeedback = String(message || "");
    if (!refs.galleryActionFeedback) return;
    refs.galleryActionFeedback.textContent = state.galleryDeleteFeedback;
    refs.galleryActionFeedback.dataset.state = kind;
  }

  function setPptFeedback(message = "", kind = "") {
    if (!refs.pptRecordFeedback) return;
    refs.pptRecordFeedback.textContent = String(message || "");
    refs.pptRecordFeedback.dataset.state = kind;
  }

  function getContext(kind) {
    if (kind === "gallery") {
      return {
        records: state.gallery,
        visibleRecords: getGalleryVisibleItems(),
        getId: (item) => item?.filename,
        currentId: state.galleryCurrentFilename,
        checkedIds: state.galleryCheckedFilenames,
        assetLabel: "画廊图片",
        unitLabel: "张",
        getLabel: (item) => item?.filename,
        deleteScope: "对应图片、JSON 元数据和浏览器缓存将被永久删除，无法撤销。",
        deletedKey: "deletedFilenames",
        notFoundKey: "notFoundFilenames",
        scrollElement: refs.galleryScrollRegion,
        blocked: state.galleryLoading || state.assetRecordDeletion.busy,
      };
    }
    if (kind === "article") {
      return {
        records: state.articleIllustration.sets,
        visibleRecords: filterArticleRecords(),
        getId: (set) => set?.setId,
        currentId: getArticleCurrentRecord()?.setId || "",
        checkedIds: state.articleIllustration.recordCheckedSetIds,
        assetLabel: "文章插图",
        unitLabel: "套",
        getLabel: (set) => formatArticleTitle(set?.title),
        deleteScope: "对应记录、生成图片和 JSON 元数据将被永久删除，无法撤销。",
        deletedKey: "deletedSetIds",
        notFoundKey: "notFoundSetIds",
        scrollElement: refs.articleRecordList,
        blocked: state.articleIllustration.generating || state.articleIllustration.planning || state.articleIllustration.referenceGenerating || state.assetLoading.article || state.assetRecordDeletion.busy,
      };
    }
    if (kind === "portrait") {
      return {
        records: state.portrait.sets,
        visibleRecords: filterPortraitRecords(),
        getId: (set) => set?.setId,
        currentId: getPortraitCurrentRecord()?.setId || "",
        checkedIds: state.portrait.recordCheckedSetIds,
        assetLabel: "写真记录",
        unitLabel: "组",
        getLabel: getPortraitTitle,
        deleteScope: "对应记录、写真图片和 JSON 元数据将被永久删除，无法撤销。",
        deletedKey: "deletedSetIds",
        notFoundKey: "notFoundSetIds",
        scrollElement: refs.portraitRecordSetList,
        blocked: state.portrait.generating || state.portrait.planning || state.assetLoading.portrait || isPortraitRefreshing() || state.assetRecordDeletion.busy,
      };
    }
    if (kind === "ppt") {
      return {
        records: state.ppt.decks,
        visibleRecords: state.ppt.decks,
        getId: getPptRecordKey,
        currentId: state.ppt.recordDetail.deckKey,
        checkedIds: state.ppt.recordCheckedKeys,
        assetLabel: "PPT 记录",
        unitLabel: "条",
        getLabel: (deck) => deck?.title || deck?.pptxFilename,
        deleteScope: "对应 PPTX、页面图片和记录将被永久删除，无法撤销。",
        deletedKey: "deletedRecordKeys",
        notFoundKey: "notFoundRecordKeys",
        scrollElement: refs.pptRecordList,
        blocked: state.ppt.generating || state.assetLoading.ppt || state.assetRecordDeletion.busy,
      };
    }
    return null;
  }

  function setFeedback(kind, message = "", stateKind = "") {
    if (kind === "gallery") setGalleryFeedback(message, stateKind);
    if (kind === "article") setArticleFeedback(message, stateKind);
    if (kind === "portrait") setPortraitFeedback(message, stateKind);
    if (kind === "ppt") setPptFeedback(message, stateKind);
  }

  function renderPage(kind) {
    if (kind === "gallery") return renderGalleryWorkspace();
    if (kind === "article") {
      renderArticleWorkspace();
      return renderArticleRecords();
    }
    if (kind === "portrait") {
      renderPortraitWorkspace();
      return renderPortraitRecords();
    }
    if (kind === "ppt") return renderPptWorkspace();
    return undefined;
  }

  function updateCheckedRecordIds(currentIds, recordId, checked) {
    const normalizedId = String(recordId || "").trim();
    const nextIds = new Set(Array.isArray(currentIds) ? currentIds : []);
    if (checked && normalizedId) nextIds.add(normalizedId);
    else nextIds.delete(normalizedId);
    return [...nextIds];
  }

  function closeDialog({ force = false } = {}) {
    if (!refs.assetRecordDeleteDialog?.open || (state.assetRecordDeletion.busy && !force)) return;
    refs.assetRecordDeleteDialog.close();
  }

  function requestDelete(kind, mode) {
    const context = getContext(kind);
    if (!context || context.blocked) return;
    const targets = getAssetRecordDeleteTargets({
      mode,
      records: context.records,
      getId: context.getId,
      currentId: context.currentId,
      checkedIds: context.checkedIds,
    });
    if (targets.length === 0) {
      const assetLabelSeparator = /^[A-Za-z0-9]/u.test(context.assetLabel) ? " " : "";
      setFeedback(
        kind,
        mode === "selected" ? `请先勾选需要删除的${context.assetLabel}。` : `请先选择一${context.unitLabel}${assetLabelSeparator}${context.assetLabel}。`,
        "error",
      );
      return;
    }

    let targetIds;
    try {
      targetIds = normalizeAssetRecordDeleteIds(targets.map(context.getId), { recordLabel: context.assetLabel });
    } catch (error) {
      setFeedback(kind, error instanceof Error ? error.message : String(error), "error");
      return;
    }

    const copy = buildAssetRecordDeleteConfirmation({
      mode,
      targets,
      assetLabel: context.assetLabel,
      unitLabel: context.unitLabel,
      getLabel: context.getLabel,
      deleteScope: context.deleteScope,
    });
    state.assetRecordDeletion.request = {
      kind,
      mode,
      ids: targetIds,
      currentId: context.currentId,
      visibleIds: context.visibleRecords.map(context.getId).filter(Boolean),
      scrollTop: Number(context.scrollElement?.scrollTop) || 0,
    };
    refs.assetRecordDeleteDialogTitle.textContent = copy.title;
    refs.assetRecordDeleteDialogMessage.textContent = copy.message;
    refs.assetRecordDeleteConfirmButton.textContent = copy.confirmLabel;
    refs.assetRecordDeleteConfirmButton.disabled = false;
    refs.assetRecordDeleteCancelButton.disabled = false;
    restoreFocus = document.activeElement;
    refs.assetRecordDeleteDialog.showModal();
  }

  function resolveCurrentId(request, removedIds) {
    const currentId = String(request.currentId || "");
    if (!currentId || !removedIds.has(currentId)) return currentId;
    return resolveAssetRecordSelectionAfterDelete({
      records: request.visibleIds,
      getId: (recordId) => recordId,
      currentId,
      deletedIds: [...removedIds],
    });
  }

  async function commitResult(request, removedIds) {
    const removedIdSet = new Set(removedIds);
    const nextCurrentId = resolveCurrentId(request, removedIdSet);
    if (request.kind === "gallery") {
      state.gallery = state.gallery.filter((item) => !removedIdSet.has(item.filename));
      state.galleryCheckedFilenames = state.galleryCheckedFilenames.filter((filename) => !removedIdSet.has(filename));
      state.galleryCurrentFilename = nextCurrentId;
      removedIds.forEach(forgetGalleryMetadata);
      await Promise.all(removedIds.map(deleteBrowserCachedGalleryItem));
      if (removedIdSet.has(String(state.selectedPreviewKey || "").replace(/^file:/, ""))) state.selectedPreviewKey = "";
      if (removedIdSet.has(state.lightboxItem?.filename)) closeLightbox();
      return;
    }
    if (request.kind === "article") {
      state.articleIllustration.sets = state.articleIllustration.sets.filter((set) => !removedIdSet.has(set.setId));
      state.articleIllustration.recordCheckedSetIds = state.articleIllustration.recordCheckedSetIds.filter((setId) => !removedIdSet.has(setId));
      state.articleIllustration.recordSetId = nextCurrentId;
      if (removedIdSet.has(state.articleIllustration.currentSet?.setId)) state.articleIllustration.currentSet = null;
      if (removedIdSet.has(state.lightboxItem?.articleSetId)) closeLightbox();
      return;
    }
    if (request.kind === "portrait") {
      state.portrait.sets = state.portrait.sets.filter((set) => !removedIdSet.has(set.setId));
      state.portrait.recordCheckedSetIds = state.portrait.recordCheckedSetIds.filter((setId) => !removedIdSet.has(setId));
      state.portrait.recordSetId = nextCurrentId;
      if (removedIdSet.has(state.portrait.currentSet?.setId)) state.portrait.currentSet = null;
      if (removedIdSet.has(state.lightboxItem?.portraitSetId)) closeLightbox();
      return;
    }
    if (request.kind === "ppt") {
      const removedDecks = state.ppt.decks.filter((deck) => removedIdSet.has(getPptRecordKey(deck)));
      state.ppt.decks = state.ppt.decks.filter((deck) => !removedIdSet.has(getPptRecordKey(deck)));
      state.ppt.recordCheckedKeys = state.ppt.recordCheckedKeys.filter((recordKey) => !removedIdSet.has(recordKey));
      state.ppt.recordDetail.deckKey = nextCurrentId;
      if (removedIdSet.has(request.currentId)) state.ppt.recordDetail.slideNumber = 0;
      if (removedDecks.some((deck) => deck.deckId && deck.deckId === state.ppt.deckId)) {
        state.ppt.deckId = "";
        state.ppt.outline = null;
        state.ppt.slides = [];
        state.ppt.pptxUrl = "";
        state.ppt.editablePptxUrl = "";
        state.ppt.currentSlideNumber = 0;
        state.ppt.statusText = "等待生成";
      }
    }
  }

  function formatResult(kind, payload, removedCount, requestedCount) {
    const deletedCount = Math.max(0, Number(payload.deletedCount) || 0);
    const skippedCount = Array.isArray(payload.skippedUnsafePaths) ? payload.skippedUnsafePaths.length : 0;
    const unresolvedCount = Math.max(0, requestedCount - removedCount);
    const label = kind === "gallery" ? "张图片" : kind === "article" ? "套文章插图" : kind === "portrait" ? "组写真" : "条 PPT 记录";
    if (skippedCount > 0 || unresolvedCount > 0) {
      const notices = [
        skippedCount > 0 ? `${skippedCount} 个异常路径未自动清理` : "",
        unresolvedCount > 0 ? `${unresolvedCount} 项未获服务器确认` : "",
      ].filter(Boolean);
      return { message: `已从列表移除 ${removedCount} ${label}；${notices.join("，")}。`, kind: "error" };
    }
    if (deletedCount > 0) return { message: `已删除 ${deletedCount} ${label}。`, kind: "success" };
    return { message: `所选${label}已不存在，已从当前列表移除。`, kind: "success" };
  }

  function fetchDelete(kind, ids) {
    const options = (body) => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (kind === "gallery") return fetch("/api/output/delete", options({ filenames: ids }));
    if (kind === "article") return fetch("/api/article-illustration/sets/delete", options({ setIds: ids }));
    if (kind === "portrait") return fetch("/api/portrait/sets/delete", options({ setIds: ids }));
    if (kind === "ppt") return fetch("/api/ppt/decks/delete", options({ recordKeys: ids }));
    throw new Error("未知的资产删除类型。");
  }

  async function confirmDelete() {
    const request = state.assetRecordDeletion.request;
    if (state.assetRecordDeletion.busy || !request) return;
    const context = getContext(request.kind);
    if (!context) return;
    const ids = normalizeAssetRecordDeleteIds(request.ids, { recordLabel: context.assetLabel });
    state.assetRecordDeletion.busy = true;
    refs.assetRecordDeleteConfirmButton.disabled = true;
    refs.assetRecordDeleteCancelButton.disabled = true;
    refs.assetRecordDeleteConfirmButton.textContent = "正在删除...";
    renderPage(request.kind);

    try {
      if (request.kind === "gallery") {
        const targets = state.gallery.filter((item) => ids.includes(item.filename));
        await Promise.all(targets.map(preserveGalleryItem));
      }
      const response = await fetchDelete(request.kind, ids);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `删除${context.assetLabel}失败。`);

      const deletedIds = normalizeAssetRecordDeleteIds(payload[context.deletedKey] || [], { allowEmpty: true, maxCount: Number.MAX_SAFE_INTEGER });
      const notFoundIds = normalizeAssetRecordDeleteIds(payload[context.notFoundKey] || [], { allowEmpty: true, maxCount: Number.MAX_SAFE_INTEGER });
      const removedIds = [...new Set([...deletedIds, ...notFoundIds])].filter((recordId) => ids.includes(recordId));
      if (removedIds.length === 0 && Number(payload.deletedCount) === ids.length) removedIds.push(...ids);
      if (removedIds.length === 0) throw new Error(`服务器未确认删除任何${context.assetLabel}。`);

      await commitResult(request, removedIds);
      closeDialog({ force: true });
      const result = formatResult(request.kind, payload, removedIds.length, ids.length);
      setFeedback(request.kind, result.message, result.kind);
    } catch (error) {
      closeDialog({ force: true });
      setFeedback(request.kind, error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.assetRecordDeletion.busy = false;
      renderPage(request.kind);
      const scrollElement = getContext(request.kind)?.scrollElement;
      if (scrollElement) scrollElement.scrollTop = request.scrollTop;
    }
  }

  function bindEvents() {
    refs.assetRecordDeleteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      confirmDelete().catch((error) => {
        const kind = state.assetRecordDeletion.request?.kind;
        if (kind) setFeedback(kind, error instanceof Error ? error.message : String(error), "error");
      });
    });
    refs.assetRecordDeleteCancelButton.addEventListener("click", () => closeDialog());
    refs.assetRecordDeleteDialog.addEventListener("cancel", (event) => {
      if (state.assetRecordDeletion.busy) event.preventDefault();
    });
    refs.assetRecordDeleteDialog.addEventListener("click", (event) => {
      if (event.target === refs.assetRecordDeleteDialog) closeDialog();
    });
    refs.assetRecordDeleteDialog.addEventListener("close", () => {
      state.assetRecordDeletion.request = null;
      refs.assetRecordDeleteConfirmButton.disabled = false;
      refs.assetRecordDeleteCancelButton.disabled = false;
      refs.assetRecordDeleteConfirmButton.textContent = "确认删除";
      const restoreTarget = restoreFocus;
      restoreFocus = null;
      window.setTimeout(() => {
        if (restoreTarget?.isConnected && !restoreTarget.disabled) restoreTarget.focus();
        else document.querySelector('[data-view-panel]:not(.hidden) input[type="search"], [data-view-panel]:not(.hidden) .asset-record-picker-trigger')?.focus();
      }, 0);
    });
  }

  return { bindEvents, requestDelete, updateCheckedRecordIds };
}
