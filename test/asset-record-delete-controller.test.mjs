import test from "node:test";
import assert from "node:assert/strict";

import { createAssetRecordDeleteController } from "../lib/asset-record-delete-controller.mjs";

test("selected deletion targets only checked records in the complete filtered collection", (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const articleRecords = [{ setId: "article-visible" }, { setId: "article-hidden" }];
  const portraitRecords = [{ setId: "portrait-visible" }, { setId: "portrait-hidden" }];
  const pptRecords = [{ recordKey: "ppt-visible" }, { recordKey: "ppt-hidden" }];
  const state = {
    gallery: [],
    galleryCheckedFilenames: [],
    galleryCurrentFilename: "",
    galleryLoading: false,
    articleIllustration: {
      sets: articleRecords,
      recordCheckedSetIds: articleRecords.map((record) => record.setId),
      generating: false,
      planning: false,
      referenceGenerating: false,
    },
    portrait: {
      sets: portraitRecords,
      recordCheckedSetIds: portraitRecords.map((record) => record.setId),
      generating: false,
      planning: false,
    },
    ppt: {
      decks: pptRecords,
      recordCheckedKeys: pptRecords.map((record) => record.recordKey),
      recordDetail: { deckKey: "ppt-visible" },
      generating: false,
    },
    assetLoading: { article: false, portrait: false, ppt: false },
    assetRecordDeletion: { busy: false, request: null },
  };
  const dialog = {
    open: false,
    showModal() {
      this.open = true;
    },
  };
  const refs = {
    assetRecordDeleteDialog: dialog,
    assetRecordDeleteDialogTitle: { textContent: "" },
    assetRecordDeleteDialogMessage: { textContent: "" },
    assetRecordDeleteConfirmButton: { textContent: "", disabled: false },
    assetRecordDeleteCancelButton: { disabled: false },
    galleryScrollRegion: { scrollTop: 0 },
    articleRecordList: { scrollTop: 0 },
    portraitRecordSetList: { scrollTop: 0 },
    pptRecordList: { scrollTop: 0 },
  };
  const noOp = () => {};
  const controller = createAssetRecordDeleteController({
    refs,
    state,
    actions: {
      closeLightbox: noOp,
      deleteBrowserCachedGalleryItem: noOp,
      filterArticleRecords: () => articleRecords.slice(0, 1),
      filterPortraitRecords: () => portraitRecords.slice(0, 1),
      filterPptRecords: () => pptRecords.slice(0, 1),
      forgetGalleryMetadata: noOp,
      formatArticleTitle: (value) => value || "文章插图",
      getArticleCurrentRecord: () => articleRecords[0],
      getGalleryVisibleItems: () => [],
      getPortraitCurrentRecord: () => portraitRecords[0],
      getPortraitTitle: () => "写真记录",
      getPptRecordKey: (record) => record.recordKey,
      isPortraitRefreshing: () => false,
      preserveGalleryItem: noOp,
      renderArticleRecords: noOp,
      renderArticleWorkspace: noOp,
      renderGalleryWorkspace: noOp,
      renderPortraitRecords: noOp,
      renderPortraitWorkspace: noOp,
      renderPptWorkspace: noOp,
      setArticleFeedback: noOp,
      setPortraitFeedback: noOp,
    },
  });

  for (const [kind, expectedId] of [
    ["article", "article-visible"],
    ["portrait", "portrait-visible"],
    ["ppt", "ppt-visible"],
  ]) {
    state.assetRecordDeletion.request = null;
    dialog.open = false;
    controller.requestDelete(kind, "selected");
    assert.deepEqual(state.assetRecordDeletion.request?.ids, [expectedId]);
    assert.equal(dialog.open, true);
  }

  assert.deepEqual(state.articleIllustration.recordCheckedSetIds, ["article-visible", "article-hidden"]);
  assert.deepEqual(state.portrait.recordCheckedSetIds, ["portrait-visible", "portrait-hidden"]);
  assert.deepEqual(state.ppt.recordCheckedKeys, ["ppt-visible", "ppt-hidden"]);
});
