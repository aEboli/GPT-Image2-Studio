import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

import { createCreationListingController } from "../lib/creation-listing-view.mjs";

function getSourceSection(source, startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `Missing source marker: ${startMarker}`);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(endIndex, -1, `Missing source marker: ${endMarker}`);
  return source.slice(startIndex, endIndex);
}

function createButton() {
  const listeners = new Map();
  return {
    disabled: true,
    textContent: "",
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    click() {
      assert.equal(this.disabled, false, "enabled export button should be clickable");
      for (const handler of listeners.get("click") || []) {
        handler({ target: this, preventDefault() {} });
      }
    },
  };
}

function loadLegacyRecordExportRuntime(appSource, state) {
  const downloads = [];
  const blobs = new Map();
  const revokedUrls = [];
  const feedback = [];
  let objectUrlSequence = 0;
  const documentRef = {
    body: {
      appendChild(link) {
        downloads.push(link);
        return link;
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "a");
      return {
        clicked: false,
        removed: false,
        click() {
          this.clicked = true;
        },
        remove() {
          this.removed = true;
        },
      };
    },
  };
  const context = createContext({
    Blob,
    document: documentRef,
    filterCreationRecordSets: () => state.creation.sets,
    setCreationRecordFeedback: (...args) => feedback.push(args),
    state,
    URL: {
      createObjectURL(blob) {
        const url = `blob:legacy-export-${++objectUrlSequence}`;
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
    window: {
      setTimeout(callback) {
        callback();
        return 0;
      },
    },
    getCreationItemDisplayTitle(item, fallbackTitle = "") {
      return String(item?.title || fallbackTitle || "");
    },
  });

  const runtimeSource = [
    getSourceSection(
      appSource,
      "function getCreationRecordSelectedSet() {",
      "\nfunction getCreationRecordDeleteTargetsForMode",
    ),
    getSourceSection(
      appSource,
      "function buildCreationRecordPromptText(set) {",
      "\nfunction triggerBrowserTextDownload",
    ),
    getSourceSection(
      appSource,
      "function triggerBrowserTextDownload(text, filename, mimeType = \"text/plain;charset=utf-8\") {",
      "\nfunction downloadCreationRecordTextFile",
    ),
    getSourceSection(
      appSource,
      "function downloadCreationRecordTextFile(text, filename, mimeType = \"text/plain;charset=utf-8\") {",
      "\nconst creationListingController",
    ),
    getSourceSection(
      appSource,
      "function exportCreationRecordPrompts() {",
      "\nfunction exportCreationRecordManifest",
    ),
    getSourceSection(
      appSource,
      "function exportCreationRecordManifest() {",
      "\nfunction shouldAutoGenerateCreationListings",
    ),
  ].join("\n");
  const legacyControlSource = getSourceSection(
    appSource,
    "  if (refs.creationRecordCopyPromptsButton) {",
    "  const repairBlocked =",
  );
  const legacyEventBindingSource = getSourceSection(
    appSource,
    "  refs.creationRecordExportPromptsButton.addEventListener(\"click\", exportCreationRecordPrompts);",
    "  creationListingController.bindEvents();",
  );

  runInContext(`${runtimeSource}\n    globalThis.legacyRecordExports = {
      bindEvents(refs) {
${legacyEventBindingSource}
      },
      downloadCreationRecordTextFile,
      exportCreationRecordManifest,
      exportCreationRecordPrompts,
      getCreationRecordSelectedSet,
      syncControls(refs, selectedSet) {
${legacyControlSource}
      },
    };
  `, context);

  return {
    ...context.legacyRecordExports,
    blobs,
    downloads,
    feedback,
    revokedUrls,
  };
}

function buildRecordFixtures() {
  const detailRecord = {
    setId: "detail-a",
    productName: "详情商品 A",
    scenarioLabel: "主图场景 A",
    industryTemplateLabel: "家居 A",
    manifestMarker: "A_ONLY_MANIFEST",
    items: [
      {
        itemId: "a-main",
        title: "A 主图",
        prompt: "A_ONLY_PROMPT",
        marketingCopy: "A_ONLY_COPY",
      },
    ],
    listingDrafts: [
      {
        id: "listing-a",
        title: "A_ONLY_LISTING",
        description: "A listing payload",
      },
    ],
  };
  const batchRecordB = {
    setId: "batch-b",
    productName: "Temu 批次 B",
    manifestMarker: "B_ONLY_MANIFEST",
    items: [{ itemId: "b-main", prompt: "B_ONLY_PROMPT" }],
    listingDrafts: [{ id: "listing-b", title: "B_ONLY_LISTING" }],
  };
  const batchRecordC = {
    setId: "batch-c",
    productName: "Temu 批次 C",
    manifestMarker: "C_ONLY_MANIFEST",
    items: [{ itemId: "c-main", prompt: "C_ONLY_PROMPT" }],
    listingDrafts: [{ id: "listing-c", title: "C_ONLY_LISTING" }],
  };
  return { batchRecordB, batchRecordC, detailRecord };
}

test("legacy TXT and JSON exports stay bound to detail record A when Temu batch B/C is checked", async () => {
  const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const { batchRecordB, batchRecordC, detailRecord } = buildRecordFixtures();
  const state = {
    creation: {
      listingGeneratingSetId: "",
      recordCheckedSetIds: [],
      recordSetId: detailRecord.setId,
      sets: [detailRecord, batchRecordB, batchRecordC],
    },
  };
  const runtime = loadLegacyRecordExportRuntime(appSource, state);
  const refs = {
    creationRecordCopyListingsButton: createButton(),
    creationRecordCopyPromptsButton: createButton(),
    creationRecordExportListingsButton: createButton(),
    creationRecordExportManifestButton: createButton(),
    creationRecordExportPromptsButton: createButton(),
  };
  const listingController = createCreationListingController({
    refs,
    state,
    getSelectedSet: runtime.getCreationRecordSelectedSet,
    downloadTextFile: runtime.downloadCreationRecordTextFile,
    setFeedback: (...args) => runtime.feedback.push(args),
  });
  const syncExportControls = () => {
    const selectedSet = runtime.getCreationRecordSelectedSet();
    runtime.syncControls(refs, selectedSet);
    listingController.syncRecordControls(selectedSet);
    return {
      listingJson: refs.creationRecordExportListingsButton.disabled,
      manifestJson: refs.creationRecordExportManifestButton.disabled,
      promptTxt: refs.creationRecordExportPromptsButton.disabled,
    };
  };

  const beforeTemuSelection = syncExportControls();
  state.creation.recordCheckedSetIds = [batchRecordB.setId, batchRecordC.setId];
  const afterTemuSelection = syncExportControls();

  assert.deepEqual(beforeTemuSelection, {
    listingJson: false,
    manifestJson: false,
    promptTxt: false,
  });
  assert.deepEqual(afterTemuSelection, beforeTemuSelection);
  assert.equal(runtime.getCreationRecordSelectedSet(), detailRecord);

  runtime.bindEvents(refs);
  listingController.bindEvents();
  refs.creationRecordExportPromptsButton.click();
  refs.creationRecordExportManifestButton.click();
  refs.creationRecordExportListingsButton.click();

  assert.equal(runtime.downloads.length, 3);
  const [promptDownload, manifestDownload, listingDownload] = runtime.downloads;
  assert.deepEqual(
    runtime.downloads.map((download) => download.download),
    [
      "creation-prompts-detail-a.txt",
      "creation-record-detail-a.json",
      "creation-listings-detail-a.json",
    ],
  );
  for (const download of runtime.downloads) {
    assert.equal(download.clicked, true);
    assert.equal(download.removed, true);
  }
  assert.deepEqual(runtime.revokedUrls, runtime.downloads.map((download) => download.href));

  const promptBlob = runtime.blobs.get(promptDownload.href);
  assert.equal(promptBlob.type, "text/plain;charset=utf-8");
  const promptText = await promptBlob.text();
  assert.match(promptText, /套图: 详情商品 A/u);
  assert.match(promptText, /记录: detail-a/u);
  assert.match(promptText, /A_ONLY_PROMPT/u);
  assert.doesNotMatch(promptText, /B_ONLY|C_ONLY/u);

  const manifestBlob = runtime.blobs.get(manifestDownload.href);
  assert.equal(manifestBlob.type, "application/json;charset=utf-8");
  const manifestPayload = JSON.parse(await manifestBlob.text());
  assert.deepEqual(manifestPayload, detailRecord);
  assert.equal(manifestPayload.manifestMarker, "A_ONLY_MANIFEST");

  const listingBlob = runtime.blobs.get(listingDownload.href);
  assert.equal(listingBlob.type, "application/json;charset=utf-8");
  const listingPayload = JSON.parse(await listingBlob.text());
  assert.deepEqual(listingPayload, {
    setId: detailRecord.setId,
    productName: detailRecord.productName,
    listingDrafts: detailRecord.listingDrafts,
  });
  assert.match(JSON.stringify(listingPayload), /A_ONLY_LISTING/u);
  assert.doesNotMatch(JSON.stringify(listingPayload), /B_ONLY|C_ONLY/u);
});
