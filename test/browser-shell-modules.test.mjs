import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  appendBrowserConfigToFormData,
  normalizeBrowserPrivateConfig,
  toPublicBrowserConfig,
} from "../public/lib/browser-config.mjs";
import {
  createCreationListingController,
  formatCreationListingDraftHeader,
  getCreationRecordListingMetaLabel,
} from "../public/lib/creation-listing-view.mjs";
import { isCreationSubjectReferenceRole } from "../public/lib/creation-reference-roles.mjs";
import { reorderCreationReferenceFiles } from "../public/lib/creation-reference-drag.mjs";

const APP_SHELL_LINE_BUDGET = 16250;

function makeFakeControlButton(className = "") {
  const element = {
    className,
    children: [],
    disabled: false,
    textContent: "",
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(name));
        element.className = [...current].join(" ");
      },
      toggle(name, force) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        const shouldAdd = force ?? !current.has(name);
        if (shouldAdd) {
          current.add(name);
        } else {
          current.delete(name);
        }
        element.className = [...current].join(" ");
      },
    },
    appendChild(child) {
      element.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      element.children = [];
      children.forEach((child) => element.appendChild(child));
      element.textContent = children.map((child) => child.textContent || "").join("");
    },
  };
  return element;
}

function makeFakeDocumentElement(tagName) {
  return {
    tagName,
    children: [],
    className: "",
    textContent: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

test("browser config module normalizes private config without requiring window globals", () => {
  const normalized = normalizeBrowserPrivateConfig({
    imageRoute: "b",
    baseUrl: "https://example.test/",
    apiKey: "sk-browser-secret",
    responsesModel: "gpt-5.5",
    directBaseUrl: "https://direct.example.test/",
    directApiKey: "sk-direct-secret",
    directImageModel: "custom-image-model",
  });
  const publicConfig = toPublicBrowserConfig(normalized, { defaults: { size: "auto" } });
  const formData = appendBrowserConfigToFormData(new FormData(), () => normalized);

  assert.deepEqual(normalized, {
    imageRoute: "b",
    baseUrl: "https://example.test/v1",
    apiKey: "sk-browser-secret",
    responsesModel: "gpt-5.5",
    directBaseUrl: "https://direct.example.test/v1",
    directApiKey: "sk-direct-secret",
    directImageModel: "custom-image-model",
  });
  assert.equal(publicConfig.imageRoute, "b");
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.equal(publicConfig.apiKeyMask, "sk-b***cret");
  assert.equal(publicConfig.directApiKeyConfigured, true);
  assert.equal(publicConfig.directApiKeyMask, "sk-d***cret");
  assert.equal(publicConfig.directImageModel, "custom-image-model");
  assert.equal(publicConfig.defaults.size, "auto");
  assert.equal(formData.get("imageRoute"), "b");
  assert.equal(formData.get("baseUrl"), "https://example.test/v1");
  assert.equal(formData.get("apiKey"), "sk-browser-secret");
  assert.equal(formData.get("responsesModel"), "gpt-5.5");
  assert.equal(formData.get("directBaseUrl"), "https://direct.example.test/v1");
  assert.equal(formData.get("directApiKey"), "sk-direct-secret");
  assert.equal(formData.get("directImageModel"), "custom-image-model");
});

test("browser config form data can override saved route with the current UI route", () => {
  const saved = normalizeBrowserPrivateConfig({
    imageRoute: "a",
    baseUrl: "https://saved-route.example.test/",
    apiKey: "saved-route-key",
    responsesModel: "gpt-5.5",
    directBaseUrl: "https://saved-direct.example.test/",
    directApiKey: "saved-direct-key",
    directImageModel: "saved-direct-image",
  });
  const formData = appendBrowserConfigToFormData(new FormData(), () => saved, {
    imageRoute: "b",
    directBaseUrl: "https://live-direct.example.test/",
    directApiKey: "live-direct-key",
    directImageModel: "live-direct-image",
  });

  assert.equal(formData.get("imageRoute"), "b");
  assert.equal(formData.get("baseUrl"), "https://saved-route.example.test/v1");
  assert.equal(formData.get("apiKey"), "saved-route-key");
  assert.equal(formData.get("directBaseUrl"), "https://live-direct.example.test/v1");
  assert.equal(formData.get("directApiKey"), "live-direct-key");
  assert.equal(formData.get("directImageModel"), "live-direct-image");
});

test("public app shell delegates browser config and cache behavior to public modules", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const lineCount = app.split(/\r?\n/).length;

  assert.match(app, /from "\/lib\/browser-config\.mjs"/);
  assert.match(app, /from "\/lib\/browser-image-cache\.mjs"/);
  assert.match(app, /from "\/lib\/view-mode-loader\.mjs\?v=20260606-quick-blend-pair-delete-1"/);
  assert.match(app, /from "\/lib\/generation-client\.mjs"/);
  assert.match(app, /from "\/lib\/creation-listing-view\.mjs"/);
  assert.match(app, /from "\/lib\/creation-reference-drag\.mjs"/);
  assert.ok(
    lineCount < APP_SHELL_LINE_BUDGET,
    `public/app.js should stay below the shell budget, got ${lineCount}`,
  );
});

test("config drawer shows image route settings as exclusive mode tabs", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(html, /<fieldset class="route-selector" aria-label="生图调用模式">/);
  assert.match(html, /<span>路由模式<\/span>/);
  assert.match(html, /<span>直接调用模式<\/span>/);
  assert.match(html, /id="generationModeStatus"[\s\S]*路由模式/);
  assert.match(
    html,
    /data-route-panel="a"[\s\S]*接口地址[\s\S]*API Key[\s\S]*Responses 模型/,
  );
  assert.match(
    html,
    /data-route-panel="b"[\s\S]*接口地址[\s\S]*API Key[\s\S]*生图模型[\s\S]*id="directFetchModelsButton"[\s\S]*获取模型列表/,
  );
  assert.doesNotMatch(html, /线路A|线路B/);
  assert.match(styles, /\.route-config-panel\s*\{[\s\S]*display:\s*grid;/);
  assert.match(
    styles,
    /\.config-form:has\(input\[name="imageRoute"\]\[value="a"\]:checked\)\s*\[data-route-panel="b"\]/,
  );
  assert.match(
    styles,
    /\.config-form:has\(input\[name="imageRoute"\]\[value="b"\]:checked\)\s*\[data-route-panel="a"\]/,
  );
  assert.match(styles, /\.generation-mode-status\s*\{/);
  assert.match(app, /generationModeStatus:\s*document\.querySelector\("#generationModeStatus"\),/);
  assert.match(app, /function updateGenerationModeStatus\(\) \{/);
  assert.match(app, /const imageRoute = getSelectedImageRoute\(\);/);
  assert.match(app, /formatGenerationActivityModeLabel\(imageRoute\)/);
});

test("creation reference drag helper reorders product items as whole records only", () => {
  const first = { id: "first", role: "product", file: { name: "first.png" }, note: "red" };
  const second = { id: "second", role: "reference-product", file: { name: "second.png" }, note: "blue" };
  const detail = { id: "detail", role: "material", file: { name: "detail.png" }, note: "texture" };
  const reordered = reorderCreationReferenceFiles([first, second, detail], "second", "first");

  assert.deepEqual(reordered, [second, first, detail]);
  assert.equal(reordered[0].file.name, "second.png");
  assert.equal(reordered[0].note, "blue");
  assert.equal(reorderCreationReferenceFiles([first, detail], "detail", "first"), null);
  assert.equal(isCreationSubjectReferenceRole("product"), true);
  assert.equal(isCreationSubjectReferenceRole("reference-product"), true);
  assert.equal(isCreationSubjectReferenceRole("material"), false);
});

test("creation listing controller sends browser-private request config", async () => {
  let capturedRequest = null;
  let currentViewRenderCount = 0;
  const selectedSet = {
    setId: "creation-set-api-key",
    productName: "Listing Probe",
    items: [{ itemId: "sku-1", role: "sku", status: "completed", relativePath: "creation/sku-1.png" }],
  };
  const state = {
    creation: {
      listingGeneratingSetId: "",
      recordSetId: "",
      sets: [selectedSet],
    },
  };
  const controller = createCreationListingController({
    compactErrorMessage: (message) => message,
    fetchImpl: async (url, options) => {
      capturedRequest = {
        url,
        body: JSON.parse(options.body),
      };
      return new Response(
        JSON.stringify({
          ok: true,
          set: {
            ...selectedSet,
            listingDrafts: [{ title: "1 Pack Listing Probe" }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
    getRequestConfig: () => ({
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-browser-secret",
      responsesModel: "gpt-5.5",
    }),
    getSelectedSet: () => selectedSet,
    nowIso: () => "2026-05-24T00:00:00.000Z",
    refs: {},
    renderCurrentView: () => {
      currentViewRenderCount += 1;
    },
    renderRecordView: () => {},
    setFeedback: () => {},
    state,
    upsertSet: (set) => {
      state.creation.sets = [set];
      return set;
    },
  });

  const nextSet = await controller.generate();

  assert.equal(capturedRequest.url, "/api/creation/listings");
  assert.deepEqual(capturedRequest.body, {
    baseUrl: "https://api.example.test/v1",
    apiKey: "sk-browser-secret",
    responsesModel: "gpt-5.5",
    setId: selectedSet.setId,
    set: selectedSet,
  });
  assert.equal(nextSet.listingDrafts.length, 1);
  assert.equal(state.creation.listingGeneratingSetId, "");
  assert.equal(state.creation.recordSetId, selectedSet.setId);
  assert.equal(currentViewRenderCount, 2);
});

test("creation listing controls only disable the record currently generating", () => {
  const selectedSet = {
    setId: "set-b",
    productName: "Available Listing",
    listingDrafts: [{ title: "1 Pack Available Listing" }],
  };
  const refs = {
    creationRecordGenerateListingsButton: makeFakeControlButton("toolbar-button"),
    creationRecordCopyListingsButton: { disabled: true },
    creationRecordExportListingsButton: { disabled: true },
  };
  const controller = createCreationListingController({
    refs,
    state: {
      creation: {
        listingGeneratingSetId: "set-a",
        sets: [
          { setId: "set-a", productName: "Busy Listing" },
          selectedSet,
        ],
      },
    },
  });

  controller.syncRecordControls(selectedSet);

  assert.equal(refs.creationRecordGenerateListingsButton.disabled, false);
  assert.equal(refs.creationRecordGenerateListingsButton.textContent, "生成 Listing");
  assert.equal(refs.creationRecordCopyListingsButton.disabled, false);
  assert.equal(refs.creationRecordExportListingsButton.disabled, false);
});

test("creation listing generating button renders inline busy motion", () => {
  const previousDocument = globalThis.document;
  const selectedSet = {
    setId: "set-a",
    productName: "Busy Listing",
  };
  const refs = {
    creationRecordGenerateListingsButton: makeFakeControlButton("toolbar-button"),
  };
  globalThis.document = { createElement: makeFakeDocumentElement };

  try {
    const controller = createCreationListingController({
      refs,
      state: {
        creation: {
          listingGeneratingSetId: selectedSet.setId,
          sets: [selectedSet],
        },
      },
    });

    controller.syncRecordControls(selectedSet);
  } finally {
    globalThis.document = previousDocument;
  }

  const button = refs.creationRecordGenerateListingsButton;
  const busyMotion = button.children.find((child) => child.className === "inline-busy-motion");
  assert.equal(button.disabled, true);
  assert.match(button.className, /(^|\s)is-loading(\s|$)/);
  assert.equal(button.textContent, "生成中...");
  assert.ok(busyMotion);
  assert.equal(busyMotion.children.length, 3);
});

test("creation listing controller preserves other in-flight records when generating another set", async () => {
  let capturedBody = null;
  let inFlightIds = [];
  const busySet = { setId: "set-a", productName: "Busy Listing" };
  const selectedSet = { setId: "set-b", productName: "Available Listing" };
  const state = {
    creation: {
      listingGeneratingSetId: busySet.setId,
      sets: [busySet, selectedSet],
    },
  };
  const controller = createCreationListingController({
    compactErrorMessage: (message) => message,
    fetchImpl: async (url, options) => {
      capturedBody = JSON.parse(options.body);
      inFlightIds = [...state.creation.listingGeneratingSetIds];
      return new Response(
        JSON.stringify({
          ok: true,
          set: {
            ...selectedSet,
            listingDrafts: [{ title: "1 Pack Available Listing" }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
    getSelectedSet: () => busySet,
    refs: {},
    renderCurrentView: () => {},
    renderRecordView: () => {},
    setFeedback: () => {},
    state,
    upsertSet: (set) => set,
  });

  await controller.generate(selectedSet.setId);

  assert.equal(capturedBody.setId, selectedSet.setId);
  assert.deepEqual(inFlightIds, [busySet.setId, selectedSet.setId]);
  assert.deepEqual(state.creation.listingGeneratingSetIds, [busySet.setId]);
  assert.equal(state.creation.listingGeneratingSetId, busySet.setId);
});

test("creation record listing meta label only appears when listing drafts exist", () => {
  assert.equal(
    getCreationRecordListingMetaLabel({
      listingDrafts: [{ id: "listing-1", title: "1 Pack Listing Probe" }],
    }),
    "Listing",
  );
  assert.equal(getCreationRecordListingMetaLabel({ listingDrafts: [] }), "");
  assert.equal(getCreationRecordListingMetaLabel({}), "");
});

test("creation listing view removes Chinese from English draft headers", () => {
  const header = formatCreationListingDraftHeader({
    title: "1 Pack 13cm 路亚硬饵 Product Listing Draft",
    skuTitle: "路亚硬饵",
    marketplace: "amazon-us",
    language: "en-US",
    evidenceMode: "image-backed",
    status: "failed",
  }, 0);

  assert.equal(header.title, "1 Pack 13cm Product");
  assert.equal(header.meta, "amazon-us · en-US · image-backed · failed");
  assert.doesNotMatch(`${header.title} ${header.meta}`, /[\u3400-\u9fff]/u);
});
