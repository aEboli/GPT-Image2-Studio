import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const publicLightboxViewerPath = new URL("../public/lib/lightbox-image-viewer.mjs", import.meta.url);
const previewKeyboardNavigationPath = new URL("../lib/preview-keyboard-navigation.mjs", import.meta.url);
const quickBlendViewPath = new URL("../lib/views/quick-blend-view.mjs", import.meta.url);
const imageEditViewPath = new URL("../lib/views/image-edit-view.mjs", import.meta.url);
const styleTransferPresetLightboxPath = new URL("../lib/style-transfer-preset-lightbox.mjs", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);
const browserConfigPath = new URL("../lib/browser-config.mjs", import.meta.url);
const browserImageCachePath = new URL("../lib/browser-image-cache.mjs", import.meta.url);
const configModelPickerPath = new URL("../lib/config-model-picker.mjs", import.meta.url);
const creationListingViewPath = new URL("../lib/creation-listing-view.mjs", import.meta.url);
const creationRecordListViewPath = new URL("../lib/creation-record-list-view.mjs", import.meta.url);
const creationReferenceDragPath = new URL("../lib/creation-reference-drag.mjs", import.meta.url);
const creationReferenceAnalysisViewPath = new URL("../lib/creation-reference-analysis-view.mjs", import.meta.url);
const publicCreationReferenceCoveragePath = new URL("../public/lib/creation-reference-coverage.mjs", import.meta.url);
const creationCardLoadingPath = new URL("../lib/creation-card-loading.mjs", import.meta.url);
const creationSuiteQueuePath = new URL("../lib/creation-suite-queue.mjs", import.meta.url);
const publicConfigModelPickerPath = new URL("../public/lib/config-model-picker.mjs", import.meta.url);
const publicCreationListingViewPath = new URL("../public/lib/creation-listing-view.mjs", import.meta.url);
const generationClientPath = new URL("../lib/generation-client.mjs", import.meta.url);
const generationLogPanelPath = new URL("../lib/generation-log-panel.mjs", import.meta.url);
const generationLogStorePath = new URL("../lib/generation-log-store.mjs", import.meta.url);
const pptAnalysisClientPath = new URL("../lib/ppt-analysis-client.mjs", import.meta.url);
const stylesAssetVersion = "20260825-attempt-preview-deck-1";
const appAssetVersion = "20260825-attempt-preview-deck-1";
const pptModuleAssetVersion = "20260527-density-overlap-1";
const creationQueueModuleAssetVersion = "20260712-creation-queue-selection-isolation-1";
const quickBlendModuleAssetVersion = "20260608-quick-blend-time-sort-1";

test("static assets use the current cache-busting version", async () => {
  const html = await readFile(indexPath, "utf8");

  assert.match(html, new RegExp(`\\.\\/styles\\.css\\?v=${stylesAssetVersion}`));
  assert.match(html, new RegExp(`\\.\\/app\\.js\\?v=${appAssetVersion}`));
});

test("creation image count keeps role checkbox defaults synchronized", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const CREATION_IMAGE_COUNT_OPTIONS = \[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18\];/);
  assert.match(app, /function alignCreationRoleIdsToCount\(/);
  assert.match(app, /function syncCreationSelectedRolesToCurrentCount\(\) \{/);
  assert.match(app, /refs\.creationImageCountInput\.addEventListener\("click", syncCreationSelectedRolesToCurrentCount\)/);
  assert.match(app, /function syncCreationSelectedRolesToPreset\(selectedRoles\) \{[\s\S]*isCreationZeroImageCountMode\(\)[\s\S]*state\.creationSelectedRoles = \[\]/);
  assert.match(app, /function getFiniteCreationImageCount\(value\) \{ return value !== undefined && value !== null && String\(value\)\.trim\(\) !== "" && Number\.isFinite\(Number\(value\)\)/);
  assert.match(app, /function normalizeCreationSetForView\(set = \{\}\) \{[\s\S]*resolveCreationPlanCounts\(\{ \.\.\.planSource, \.\.\.set, items \}\)/);
  assert.match(app, /filenameToken: String\(item\.filenameToken \|\| item\.filename_token \|\| ""\)/);

  const applySetBody =
    app.match(/function applyCreationSetToForm\(set\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction getCreationCurrentSet/)?.[0] || "";
  assert.match(applySetBody, /setCreationImageCountValue\(normalized\.imageCount\);/);
  assert.match(applySetBody, /alignCreationRoleIdsToCount\(normalizedRoles, getCreationSelectedImageCount\(\)\)/);
  assert.doesNotMatch(applySetBody, /setCreationImageCountValue\(state\.creationSelectedRoles\.length \|\| normalized\.imageCount\)/);
});

function readCssRule(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] || "";
}

function readCssRuleContaining(styles, selector, text) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...styles.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "g"))];
  return matches.find((match) => match[1].includes(text))?.[1] || "";
}

function extractFunctionBefore(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`function ${nextFunctionName}`, start + 1);
  assert.notEqual(start, -1, `${functionName} should exist`);
  assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
  return source.slice(start, end).trimEnd();
}

function createTestClassList() {
  const values = new Set();
  return {
    add(...names) {
      names.filter(Boolean).forEach((name) => values.add(name));
    },
    remove(...names) {
      names.forEach((name) => values.delete(name));
    },
    toggle(name, force) {
      const shouldAdd = force === undefined ? !values.has(name) : Boolean(force);
      if (shouldAdd) {
        values.add(name);
      } else {
        values.delete(name);
      }
      return shouldAdd;
    },
    contains(name) {
      return values.has(name);
    },
    toString() {
      return [...values].join(" ");
    },
  };
}

function testElementMatchesSelector(element, selector) {
  if (selector === "[data-creation-listing-copy-text]") {
    return Object.hasOwn(element.dataset, "creationListingCopyText");
  }
  if (selector === "[data-model-id]") {
    return Object.hasOwn(element.dataset, "modelId");
  }
  return false;
}

function createTestElement(tagName = "div", ownerDocument = null) {
  const listeners = new Map();
  const element = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    parentElement: null,
    children: [],
    dataset: {},
    attributes: new Map(),
    classList: createTestClassList(),
    className: "",
    disabled: false,
    hidden: false,
    textContent: "",
    type: "",
    value: "",
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    appendChild(child) {
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach((node) => element.appendChild(node));
    },
    replaceChildren(...nodes) {
      element.children.forEach((child) => {
        child.parentElement = null;
      });
      element.children = [];
      nodes.forEach((node) => element.appendChild(node));
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return element.attributes.get(name) || "";
    },
    contains(node) {
      for (let current = node; current; current = current.parentElement) {
        if (current === element) {
          return true;
        }
      }
      return false;
    },
    closest(selector) {
      for (let current = element; current; current = current.parentElement) {
        if (testElementMatchesSelector(current, selector)) {
          return current;
        }
      }
      return null;
    },
    dispatchEvent(event) {
      event.target ||= element;
      event.currentTarget = element;
      for (const handler of listeners.get(event.type) || []) {
        handler(event);
      }
      if (event.bubbles && !event.cancelBubble && element.parentElement) {
        element.parentElement.dispatchEvent(event);
      }
      return !event.defaultPrevented;
    },
  };
  let innerHTML = "";
  Object.defineProperty(element, "innerHTML", {
    get() {
      return innerHTML;
    },
    set(value) {
      innerHTML = String(value || "");
      if (!innerHTML) {
        element.replaceChildren();
      }
    },
  });
  return element;
}

function createTestDocument() {
  const documentRef = createTestElement("#document");
  documentRef.createElement = (tagName) => createTestElement(tagName, documentRef);
  documentRef.ownerDocument = documentRef;
  return documentRef;
}

function createModelPickerHarness() {
  const documentRef = createTestDocument();
  const refs = {
    apiKeyInput: createTestElement("input", documentRef),
    baseUrlInput: createTestElement("input", documentRef),
    endpointPathSelect: createTestElement("select", documentRef),
    configFeedback: createTestElement("p", documentRef),
    directApiKeyInput: createTestElement("input", documentRef),
    directBaseUrlInput: createTestElement("input", documentRef),
    directEndpointPathSelect: createTestElement("select", documentRef),
    directFetchModelsButton: createTestElement("button", documentRef),
    directImageModelInput: createTestElement("input", documentRef),
    directModelOptionsList: createTestElement("div", documentRef),
    directModelPickerToggle: createTestElement("button", documentRef),
    directResponsesFetchModelsButton: createTestElement("button", documentRef),
    directResponsesModelInput: createTestElement("input", documentRef),
    directResponsesModelOptionsList: createTestElement("div", documentRef),
    directResponsesModelPickerToggle: createTestElement("button", documentRef),
    fetchModelsButton: createTestElement("button", documentRef),
    imageRouteInputs: [
      { value: "a", checked: true },
      { value: "b", checked: false },
      { value: "c", checked: false },
    ],
    modelOptionsList: createTestElement("div", documentRef),
    modelPickerToggle: createTestElement("button", documentRef),
    protocolApiKeyInput: createTestElement("input", documentRef),
    protocolBaseUrlInput: createTestElement("input", documentRef),
    protocolFetchModelsButton: createTestElement("button", documentRef),
    protocolImageModelInput: createTestElement("input", documentRef),
    protocolModelOptionsList: createTestElement("div", documentRef),
    protocolModelPickerToggle: createTestElement("button", documentRef),
    responsesModelInput: createTestElement("input", documentRef),
    testConnectionButton: createTestElement("button", documentRef),
  };
  refs.apiKeyInput.value = "test-key";
  refs.baseUrlInput.value = "https://api.example.test/v1";
  refs.endpointPathSelect.value = "responses";
  refs.directApiKeyInput.value = "direct-key";
  refs.directBaseUrlInput.value = "https://direct.example.test/v1";
  refs.directEndpointPathSelect.value = "chat/completions";
  refs.directImageModelInput.value = "gpt-image-2";
  refs.directResponsesModelInput.value = "gpt-5.5";
  refs.protocolApiKeyInput.value = "protocol-key";
  refs.protocolBaseUrlInput.value = "https://protocol.example.test/v1";
  refs.protocolImageModelInput.value = "gemini-3.1-flash-image-preview";
  refs.responsesModelInput.value = "gpt-5.5";
  return { documentRef, refs };
}

class TestFormData {
  values = new Map();

  set(name, value) {
    this.values.set(name, value);
  }

  get(name) {
    return this.values.get(name);
  }
}

async function waitForAsyncHandlers() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createListingCopyButton(ownerDocument, label, text) {
  const button = createTestElement("button", ownerDocument);
  button.dataset.creationListingCopyLabel = label;
  button.dataset.creationListingCopyText = text;
  return button;
}

test("browser-imported lib modules are copied into public for Vercel static serving", async () => {
  const app = await readFile(appPath, "utf8");
  const imports = [...app.matchAll(/from "\/lib\/([^"?]+)\.mjs(?:\?[^"]*)?"/g)].map((match) => match[1]);

  assert.ok(imports.length > 0);
  assert.equal(new Set(imports).size, imports.length);
  assert.match(app, new RegExp(`from "/lib/ppt-analysis-client\\.mjs\\?v=${pptModuleAssetVersion}"`));

  for (const moduleName of imports) {
    const moduleSource = await readFile(new URL(`../public/lib/${moduleName}.mjs`, import.meta.url), "utf8");
    const sourceModule = await readFile(new URL(`../lib/${moduleName}.mjs`, import.meta.url), "utf8");
    assert.equal(moduleSource, sourceModule);
    assert.doesNotMatch(moduleSource, /\uFFFD/);
  }

  const sizeOptionsModule = await readFile(new URL("../public/lib/generation-size-options.mjs", import.meta.url), "utf8");
  assert.match(sizeOptionsModule, /export function getGenerationSizeOptions/);
});

test("creation saved logo library opens as a compact right-side popover", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const lightboxViewer = await readFile(publicLightboxViewerPath, "utf8");
  const lightboxImageRule = readCssRule(styles, "#lightboxImage");
  const logoLibrary = await readFile(new URL("../lib/creation-logo-library.mjs", import.meta.url), "utf8");

  const panelRule = readCssRule(styles, ".creation-logo-library-panel");
  const savedGridRule = readCssRule(styles, ".creation-saved-logo-grid");
  const savedImageRule = readCssRule(styles, ".creation-saved-logo-select img");

  assert.match(panelRule, /position:\s*fixed;/);
  assert.match(panelRule, /left:\s*var\(--creation-logo-library-left,\s*auto\);/);
  assert.match(panelRule, /right:\s*auto;/);
  assert.match(savedGridRule, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(76px,\s*92px\)\);/);
  assert.match(savedGridRule, /justify-content:\s*start;/);
  assert.match(savedImageRule, /width:\s*76px;/);
  assert.match(savedImageRule, /height:\s*76px;/);
  assert.match(logoLibrary, /function mountCreationLogoLibraryPanel\(\)/);
  assert.match(logoLibrary, /document\.body\.appendChild\(panel\)/);
  assert.match(logoLibrary, /function positionCreationLogoLibraryPanel\(\)/);
  assert.match(logoLibrary, /--creation-logo-library-left/);
  assert.match(logoLibrary, /--creation-logo-library-top/);
  assert.match(logoLibrary, /window\.addEventListener\("resize",\s*positionCreationLogoLibraryPanel\)/);
  assert.doesNotMatch(html, /id="creationLogoFilename"/);
  assert.doesNotMatch(app, /creationLogoFilename/);
  assert.match(app, /creationLogoLibrary\.saveFiles\(\[file\],\s*\{\s*applySaved:\s*false\s*\}\)/);
  assert.doesNotMatch(logoLibrary, /name\.textContent = item\.filename/);
  assert.match(logoLibrary, /saveFiles\(fileList,\s*\{\s*applySaved = true\s*\} = \{\}\)/);
  assert.match(logoLibrary, /applyLogoFile\?\.\(\[selectedFile\],\s*\{\s*persist:\s*false\s*\}\)/);
  assert.match(logoLibrary, /applyLogoFile\?\.\(\[file\],\s*\{\s*persist:\s*false\s*\}\)/);
});

test("preview image uses contain sizing to fill the available canvas without clipping", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /#previewImage\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*auto;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;/,
  );
  assert.doesNotMatch(styles, /#previewImage\s*\{[^}]*object-fit:\s*contain;/);
  assert.match(app, /refs\.previewImage\.style\.transform = `scale\(\$\{state\.zoom\}\)`;/);
});

test("preview image keeps the mounted frame visible when render refreshes the same source", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const currentPreviewImageSrc = refs\.previewImage\.getAttribute\("src"\) \|\| "";/);
  assert.match(app, /const shouldUpdatePreviewImage = currentPreviewImageSrc !== imageUrl;/);
  assert.match(app, /if \(shouldUpdatePreviewImage && !currentPreviewImageSrc\) \{[\s\S]*refs\.previewImage\.classList\.remove\("is-visible"\);[\s\S]*\}/);
  assert.match(app, /if \(shouldUpdatePreviewImage\) \{[\s\S]*refs\.previewImage\.src = imageUrl;[\s\S]*\} else \{[\s\S]*refs\.previewImage\.classList\.add\("is-visible"\);[\s\S]*\}/);
  assert.doesNotMatch(
    app,
    /refs\.previewImage\.classList\.remove\("is-visible"\);\s*refs\.previewImage\.classList\.add\("is-mounted"\);[\s\S]*refs\.previewImage\.src = imageUrl;/,
  );
});

test("lightbox detail image exposes PS-style zoom and pan viewer controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const lightboxViewer = await readFile(publicLightboxViewerPath, "utf8");
  const lightboxImageRule = readCssRule(styles, "#lightboxImage");

  assert.match(
    html,
    /<div class="lightbox-viewer-controls hidden"[^>]*>[\s\S]*id="lightboxZoomOutButton"[\s\S]*id="lightboxZoomLabel"[\s\S]*id="lightboxZoomInButton"[\s\S]*id="lightboxFitButton"[\s\S]*id="lightboxActualSizeButton"[\s\S]*<\/div>/,
  );
  assert.match(
    html,
    /<div class="lightbox-media-stage">[\s\S]*<div class="lightbox-image-shell">[\s\S]*<img id="lightboxImage"[\s\S]*<aside class="lightbox-fields"[\s\S]*data-lightbox-tab="prompt"[\s\S]*data-lightbox-tab="params"[\s\S]*id="lightboxPrompt"[\s\S]*id="lightboxParams"[\s\S]*lightbox-file-list/,
  );
  assert.match(styles, /\.lightbox-viewer-controls\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/);
  assert.match(styles, /\.lightbox-zoom-label\s*\{[\s\S]*min-width:\s*54px;[\s\S]*text-align:\s*center;/);
  assert.match(
    styles,
    /\.lightbox-dialog\s*\{[\s\S]*width:\s*min\(1180px,\s*calc\(100vw - 48px\)\);[\s\S]*max-height:\s*min\(92svh,\s*920px\);/,
  );
  assert.match(
    styles,
    /\.lightbox-media-stage\s*\{[\s\S]*min-height:\s*min\(64svh,\s*680px\);[\s\S]*grid-template-columns:\s*clamp\(220px,\s*18vw,\s*280px\)\s+minmax\(0,\s*1fr\)\s+clamp\(220px,\s*18vw,\s*280px\);/,
  );
  assert.match(styles, /\.lightbox-media-stage\s*\{[\s\S]*gap:\s*clamp\(18px,\s*1\.7vw,\s*28px\);[\s\S]*padding:\s*0;/);
  assert.match(styles, /\.lightbox-media-stage\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(styles, /\.lightbox-image-shell\s*\{[\s\S]*touch-action:\s*none;[\s\S]*user-select:\s*none;/);
  assert.match(styles, /\.lightbox-image-shell\.is-viewer-draggable\s*\{[\s\S]*cursor:\s*grab;/);
  assert.match(styles, /\.lightbox-media-stage\.is-viewer-dragging \.lightbox-image-shell\s*\{[\s\S]*cursor:\s*grabbing;/);
  assert.match(styles, /\.lightbox-media-stage\.is-viewer-inspecting\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.lightbox-media-stage\.is-viewer-inspecting \.lightbox-fields\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /\.lightbox-media-stage\.is-viewer-inspecting \.lightbox-image-shell,\s*\.lightbox\.is-image-only-preview \.lightbox-image-shell\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1;/);
  assert.match(styles, /#lightboxImage\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;/);
  assert.match(styles, /#lightboxImage\s*\{[\s\S]*object-fit:\s*contain;[\s\S]*transform:\s*translate\(-50%,\s*-50%\)\s*translate3d\(var\(--lightbox-pan-x,\s*0px\),\s*var\(--lightbox-pan-y,\s*0px\),\s*0\)\s*scale\(var\(--lightbox-scale,\s*1\)\);/);
  assert.doesNotMatch(lightboxImageRule, /transition:[\s\S]*transform/);
  assert.match(styles, /grid-template-columns:[\s\S]*minmax\(280px,\s*340px\)/);
  assert.match(styles, /\.lightbox-fields\s*\{[\s\S]*display:\s*contents;/);
  assert.match(styles, /\.lightbox-image-shell\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1;/);
  assert.match(styles, /\.lightbox-fields \.detail-field\s*\{[\s\S]*grid-row:\s*1;[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.lightbox-fields \.detail-field-head,[\s\S]*\.lightbox-fields \.detail-field > span\s*\{[\s\S]*min-height:\s*44px;/);
  assert.match(styles, /\.lightbox-fields \.detail-field:first-child\s*\{[\s\S]*grid-column:\s*1;/);
  assert.match(styles, /\.lightbox-fields \.detail-field:last-child\s*\{[\s\S]*grid-column:\s*3;/);
  assert.match(styles, /\.lightbox-fields \.detail-field textarea\s*\{[\s\S]*min-height:\s*0;[\s\S]*max-height:\s*none;/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\]\s+\.lightbox-fields,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\]\s+\.lightbox-fields\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\]\s+\.lightbox-image-shell,[\s\S]*html\[data-ui-layout="mobile"\]\s+\.lightbox-fields \.detail-field\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*auto;/,
  );
  assert.match(app, /import \{ createLightboxImageViewer, createLightboxViewerState \} from "\/lib\/lightbox-image-viewer\.mjs";/);
  assert.match(app, /lightboxViewer:\s*createLightboxViewerState\(\),/);
  assert.match(app, /lightboxViewerControls:\s*document\.querySelector\("\.lightbox-viewer-controls"\),/);
  assert.match(app, /const lightboxViewerController = createLightboxImageViewer\(\{ refs, state \}\);/);
  assert.match(app, /function resetLightboxViewer\(options\) \{[\s\S]*lightboxViewerController\.reset\(options\);[\s\S]*\}/);
  assert.match(app, /function syncLightboxImageMetrics\(options\) \{[\s\S]*lightboxViewerController\.syncMetrics\(options\);[\s\S]*\}/);
  assert.match(app, /lightboxViewerController\.bindEvents\(\);/);
  assert.doesNotMatch(app, /lightboxZoomed/);
  assert.doesNotMatch(app, /stepLightboxZoom|fitLightboxViewer|setLightboxActualSize|zoomLightboxAtPoint|startLightboxPan/);
  assert.match(lightboxViewer, /export const LIGHTBOX_VIEWER_MIN_SCALE = 0\.25;/);
  assert.match(lightboxViewer, /export const LIGHTBOX_VIEWER_MAX_SCALE = 8;/);
  assert.match(lightboxViewer, /export function createLightboxViewerState\(\) \{[\s\S]*scale:\s*1,[\s\S]*fitScale:\s*1,[\s\S]*mode:\s*"view",[\s\S]*lastInspectionScale:\s*1,/);
  assert.match(lightboxViewer, /function isInspectionMode\(/);
  assert.match(lightboxViewer, /function calculateFitScale\(/);
  assert.match(lightboxViewer, /function zoomAtPoint\(/);
  assert.match(lightboxViewer, /function panBy\(/);
  assert.match(lightboxViewer, /function toggleInspectionZoom\(/);
  assert.match(lightboxViewer, /refs\.lightboxImage\.addEventListener\("load",\s*\(\) => syncMetrics\(\)\);/);
  assert.match(lightboxViewer, /refs\.lightboxImage\.addEventListener\("dragstart",\s*\(event\) => event\.preventDefault\(\)\);/);
  assert.match(lightboxViewer, /refs\.lightboxViewerControls\.classList\.toggle\("hidden",\s*!ready\);/);
  assert.match(lightboxViewer, /if \(!isInspectionMode\(viewer\(\)\)\) viewer\(\)\.mode = "inspect";/);
  assert.match(lightboxViewer, /refs\.lightboxMediaStage\.classList\.toggle\("is-viewer-inspecting",\s*isInspectionMode\(current\)\);/);
  assert.match(lightboxViewer, /refs\.lightboxImageShell\.addEventListener\("wheel",[\s\S]*!isInspectionMode\(viewer\(\)\)[\s\S]*event\.preventDefault\(\);[\s\S]*zoomAtPoint/);
  assert.match(lightboxViewer, /refs\.lightboxImageShell\.addEventListener\("pointerdown",\s*startPan\);/);
  assert.match(lightboxViewer, /refs\.lightboxImageShell\.addEventListener\("pointermove",\s*continuePan\);/);
  assert.match(lightboxViewer, /refs\.lightboxImageShell\.addEventListener\("dblclick",[\s\S]*toggleInspectionZoom/);
  assert.match(lightboxViewer, /refs\.lightboxFitButton\.addEventListener\("click",\s*\(\) => fit\(\)\);/);
  assert.match(lightboxViewer, /refs\.lightboxActualSizeButton\.addEventListener\("click",\s*\(\) => setActualSize\(\)\);/);
  assert.match(lightboxViewer, /window\.addEventListener\("resize",[\s\S]*syncMetrics\(\{ preserveMode:\s*true \}\)/);
});

test("lightbox prompt field exposes a copy button beside the label", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    html,
    /<div class="detail-field-head">[\s\S]*<span[^>]*>提示词<\/span>[\s\S]*<button class="inline-button detail-copy-button" id="copyPromptButton" type="button">复制<\/button>/,
  );
  assert.match(styles, /\.detail-field-head\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*space-between;/);
  assert.match(styles, /\.detail-copy-button\[data-copied="true"\]\s*\{[\s\S]*color:\s*var\(--text\);/);
  assert.match(
    app,
    /async function copyLightboxPrompt\(\) \{[\s\S]*navigator\.clipboard\.writeText\(refs\.lightboxPrompt\.value\);[\s\S]*markPromptCopied\(\);[\s\S]*\}/,
  );
  assert.match(app, /refs\.copyPromptButton\.addEventListener\("click",[\s\S]*copyLightboxPrompt\(\)\.catch/);
});

test("image previews support arrow-key navigation across preview contexts", async () => {
  const app = await readFile(appPath, "utf8");
  const previewKeyboardNavigation = await readFile(previewKeyboardNavigationPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");
  const imageEditView = await readFile(imageEditViewPath, "utf8");

  assert.match(app, /from "\/lib\/preview-keyboard-navigation\.mjs"/);
  assert.match(app, /lightboxNavigation:\s*\{[\s\S]*items:\s*\[\],[\s\S]*index:\s*-1,/);
  assert.match(app, /function openLightbox\(item,\s*navigation\s*=\s*null\) \{/);
  assert.match(app, /const previewKeyboardNavigation = createPreviewKeyboardNavigationController\(\{/);
  assert.match(app, /const handlePreviewArrowNavigation = previewKeyboardNavigation\.handlePreviewArrowNavigation;/);
  assert.match(app, /previewKeyboardNavigation\.normalizeLightboxNavigation\(item,\s*navigation\);/);
  assert.match(app, /document\.addEventListener\("keydown", handlePreviewArrowNavigation\);/);
  assert.match(previewKeyboardNavigation, /function openLightboxNavigationItem\(direction\) \{/);
  assert.match(previewKeyboardNavigation, /function handlePreviewArrowNavigation\(event\) \{/);
  assert.match(previewKeyboardNavigation, /event\.key === "ArrowLeft" \|\| event\.key === "ArrowRight"/);
  assert.match(previewKeyboardNavigation, /openLightboxNavigationItem\(direction\)/);
  assert.match(previewKeyboardNavigation, /function openReferencePreviewByDirection\(direction\) \{/);
  assert.match(previewKeyboardNavigation, /function openPromptAgentPreviewByDirection\(direction\) \{/);
  assert.match(previewKeyboardNavigation, /function getReferencePreviewNavigationEntries\(\) \{/);
  assert.match(previewKeyboardNavigation, /function getPromptAgentPreviewNavigationEntries\(\) \{/);
  assert.match(previewKeyboardNavigation, /openReferencePreviewByDirection\(direction\)/);
  assert.match(previewKeyboardNavigation, /openPromptAgentPreviewByDirection\(direction\)/);
  assert.match(previewKeyboardNavigation, /isTextEditingTarget\(event\.target\)/);
  assert.match(app, /openLightbox\(buildCreationRecordLightboxItem\(record\.item,\s*record\.set\),\s*\{[\s\S]*items:\s*record\.set\.items/);
  assert.match(app, /openLightbox\(buildArticleRecordLightboxItem\(record\.item,\s*record\.set\),\s*\{[\s\S]*items:\s*record\.set\.items/);
  assert.match(app, /openLightbox\(buildPortraitRecordLightboxItem\(record\.item,\s*record\.set\),\s*\{[\s\S]*items:\s*record\.set\.items/);

  assert.match(quickBlendView, /function getQuickBlendReferencePreviewEntries\(\) \{/);
  assert.match(quickBlendView, /setReferencePreviewNavigationContext\(\{[\s\S]*items:\s*getQuickBlendReferencePreviewEntries\(\),/);
  assert.match(imageEditView, /setReferencePreviewNavigationContext\(\{[\s\S]*items:\s*\[item\],/);
});

test("filmstrip thumbnails stay square, fill the available rail, and keep labels compact", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /\.filmstrip-item img,\s*[\r\n]+\s*\.filmstrip-ghost\s*\{[\s\S]*width:\s*84px;[\s\S]*height:\s*84px;/,
  );
  assert.match(styles, /\.filmstrip-row\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*min-height:\s*118px;/);
  assert.match(styles, /\.filmstrip\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/);
  assert.match(styles, /\.filmstrip\s*\{[\s\S]*grid-auto-columns:\s*92px;[\s\S]*justify-content:\s*start;/);
  assert.match(styles, /\.filmstrip\s*\{[\s\S]*padding:\s*calc\(var\(--field-gap,\s*6px\) \* 0\.5\)\s*2px\s*6px;/);
  assert.match(styles, /\.filmstrip-item\s*\{[\s\S]*justify-items:\s*center;/);
  assert.match(styles, /\.filmstrip-item span\s*\{[\s\S]*font-size:\s*var\(--type-subtitle-size\);[\s\S]*line-height:\s*14px;[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.filmstrip-item img\s*\{[\s\S]*object-fit:\s*cover;/);
  assert.match(app, /function formatFilmstripSizeLabel\(item\) \{[\s\S]*return formatCompactSizeLabel\(item\?\.size\);/);
  assert.match(app, /label: formatFilmstripSizeLabel\(job\) \|\| job\.statusText \|\| formatClock\(job\.createdAt\)/);
  assert.match(app, /label: formatFilmstripSizeLabel\(item\) \|\| formatClock\(item\.createdAt\)/);
});

test("filmstrip keeps all prompt queue jobs within the fifteen-task window", async () => {
  const app = await readFile(appPath, "utf8");
  const getFilmstripItemsRuntime = extractFunctionBefore(app, "getFilmstripItems", "getFilmstripPlaceholderState");
  const state = {
    jobs: Array.from({ length: 16 }, (_, index) => ({
      id: `job-${index + 1}`,
      createdAt: "",
      statusText: `job ${index + 1}`,
    })).reverse(),
    gallery: [],
    promptFilmstripBaselineFilenames: [],
    promptFilmstripSessionFilenames: [],
  };
  const getFilmstripItems = new Function(
    "state",
    "sortGalleryItemsByCreatedAtDesc",
    "makeJobPreviewKey",
    "makeGalleryPreviewKey",
    "formatFilmstripSizeLabel",
    "formatClock",
    "getPromptGenerationGalleryItems",
    "getStablePreviewLoadingItems",
    "getTerminalPromptAttemptDecks",
    "PROMPT_FILMSTRIP_JOB_LIMIT",
    "PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT",
    `${getFilmstripItemsRuntime}\nreturn getFilmstripItems;`,
  )(
    state,
    (items) => [...items],
    (id) => `job:${id}`,
    (filename) => `file:${filename}`,
    () => "",
    () => "",
    () => [],
    (items) => [...items].reverse(),
    () => [],
    15,
    50,
  );

  const entries = getFilmstripItems();

  assert.deepEqual(
    entries.map((entry) => entry.item.id),
    Array.from({ length: 15 }, (_, index) => `job-${index + 1}`),
  );
});

test("filmstrip keeps the initial baseline and current-session results within a 50-image window", async () => {
  const app = await readFile(appPath, "utf8");
  const getFilmstripItemsRuntime = extractFunctionBefore(app, "getFilmstripItems", "getFilmstripPlaceholderState");
  const baselineFilenames = Array.from({ length: 10 }, (_, index) => `history-${String(index + 1).padStart(2, "0")}.png`);
  const sessionFilenames = Array.from({ length: 60 }, (_, index) => `session-${String(index + 1).padStart(2, "0")}.png`);
  const state = {
    jobs: Array.from({ length: 16 }, (_, index) => ({
      id: `job-${index + 1}`,
      createdAt: "",
      statusText: `job ${index + 1}`,
    })).reverse(),
    gallery: [
      ...sessionFilenames.map((filename, index) => ({
        filename,
        createdAt: new Date(Date.UTC(2026, 5, 14, 0, 0, 0, 60000 - index)).toISOString(),
        size: "1024x1024",
      })),
      ...Array.from({ length: 60 }, (_, index) => ({
        filename: `history-${String(index + 1).padStart(2, "0")}.png`,
        createdAt: new Date(Date.UTC(2026, 5, 13, 0, 0, 0, 60000 - index)).toISOString(),
        size: "1024x1024",
      })),
    ],
    promptFilmstripBaselineFilenames: baselineFilenames,
    promptFilmstripSessionFilenames: [],
  };
  const getFilmstripItems = new Function(
    "state",
    "sortGalleryItemsByCreatedAtDesc",
    "makeJobPreviewKey",
    "makeGalleryPreviewKey",
    "formatFilmstripSizeLabel",
    "formatClock",
    "getPromptGenerationGalleryItems",
    "getStablePreviewLoadingItems",
    "getTerminalPromptAttemptDecks",
    "PROMPT_FILMSTRIP_JOB_LIMIT",
    "PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT",
    `${getFilmstripItemsRuntime}\nreturn getFilmstripItems;`,
  )(
    state,
    (items) => [...items].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    (id) => `job:${id}`,
    (filename) => `file:${filename}`,
    (item) => String(item?.size || ""),
    (value) => String(value || ""),
    (items) => items,
    (items) => [...items].reverse(),
    () => [],
    15,
    50,
  );

  const entries = getFilmstripItems();

  assert.deepEqual(entries.slice(0, 15).map((entry) => entry.key), Array.from({ length: 15 }, (_, index) => `job:job-${index + 1}`));
  assert.equal(entries.filter((entry) => entry.key.startsWith("job:")).length, 15);
  assert.equal(entries.filter((entry) => entry.key.startsWith("file:")).length, 10);
  assert.deepEqual(entries.filter((entry) => entry.key.startsWith("file:")).map((entry) => entry.item.filename), baselineFilenames);

  state.promptFilmstripSessionFilenames = sessionFilenames.slice(0, 5);
  const fiveResultEntries = getFilmstripItems();
  const fiveResultFilenames = fiveResultEntries.filter((entry) => entry.key.startsWith("file:")).map((entry) => entry.item.filename);
  assert.equal(fiveResultEntries.filter((entry) => entry.key.startsWith("job:")).length, 15);
  assert.equal(fiveResultFilenames.length, 15);
  assert.deepEqual(fiveResultFilenames, [...sessionFilenames.slice(0, 5), ...baselineFilenames]);
  assert.ok(!fiveResultFilenames.includes("history-11.png"));

  state.promptFilmstripSessionFilenames = sessionFilenames;
  const rolloverEntries = getFilmstripItems();
  const rolloverFilenames = rolloverEntries.filter((entry) => entry.key.startsWith("file:")).map((entry) => entry.item.filename);
  assert.equal(rolloverEntries.filter((entry) => entry.key.startsWith("job:")).length, 15);
  assert.equal(rolloverFilenames.length, 50);
  assert.deepEqual(rolloverFilenames, sessionFilenames.slice(0, 50));
  assert.ok(!rolloverFilenames.some((filename) => filename.startsWith("history-")));
});

test("prompt filmstrip registers only current-session saved task results", async () => {
  const app = await readFile(appPath, "utf8");
  const helperStart = app.indexOf("function syncPromptFilmstripBaseline()");
  const helperEnd = app.indexOf("function getFilmstripItems()", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helpersRuntime = app.slice(helperStart, helperEnd).trimEnd();
  const history = Array.from({ length: 20 }, (_, index) => ({
    filename: `history-${String(index + 1).padStart(2, "0")}.png`,
    createdAt: new Date(Date.UTC(2026, 5, 13, 0, 0, 0, 20000 - index)).toISOString(),
  }));
  const state = {
    gallery: history,
    promptFilmstripBaselineCaptured: false,
    promptFilmstripBaselineFilenames: [],
    promptFilmstripSessionJobIds: [],
    promptFilmstripSessionFilenames: [],
  };
  const helpers = new Function(
    "state",
    "getPromptGenerationGalleryItems",
    "PROMPT_FILMSTRIP_INITIAL_HISTORY_LIMIT",
    `${helpersRuntime}\nreturn { capturePromptFilmstripBaseline, registerPromptFilmstripSessionJob, recordPromptFilmstripSessionResult };`,
  )(
    state,
    (items) => [...items].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    10,
  );

  helpers.capturePromptFilmstripBaseline();
  assert.deepEqual(state.promptFilmstripBaselineFilenames, history.slice(0, 10).map((item) => item.filename));

  const savedItem = {
    filename: "session-01.png",
    createdAt: new Date(Date.UTC(2026, 5, 14)).toISOString(),
  };
  state.gallery = [
    savedItem,
    ...state.gallery.filter((item) => item.filename !== "history-01.png"),
  ];
  helpers.registerPromptFilmstripSessionJob({ id: "prompt-job-1" });
  helpers.recordPromptFilmstripSessionResult({ id: "other-job" }, savedItem);
  assert.deepEqual(state.promptFilmstripSessionFilenames, []);

  helpers.recordPromptFilmstripSessionResult({ id: "prompt-job-1" }, savedItem);
  helpers.recordPromptFilmstripSessionResult({ id: "prompt-job-1" }, savedItem);
  assert.deepEqual(state.promptFilmstripSessionFilenames, ["session-01.png"]);
  assert.deepEqual(state.promptFilmstripBaselineFilenames, history.slice(0, 10).map((item) => item.filename));
  assert.ok(!state.promptFilmstripBaselineFilenames.includes("history-11.png"));
});

test("filmstrip rendering reuses keyed thumbnail nodes instead of clearing the rail", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /shell\.dataset\.filmstripKey = key;/);
  assert.match(app, /refs\.filmstrip\.querySelectorAll\("\.filmstrip-entry\[data-filmstrip-key\]"\)/);
  assert.match(app, /const fragment = document\.createDocumentFragment\(\);/);
  assert.match(app, /refs\.filmstrip\.replaceChildren\(fragment\);/);
  assert.match(app, /if \(image\.getAttribute\("src"\) !== imageUrl\) \{[\s\S]*image\.src = imageUrl;[\s\S]*\}/);
  assert.doesNotMatch(app, /refs\.filmstrip\.innerHTML = "";/);
});

test("studio filmstrip shows a visible placeholder while prompt thumbnails load", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(app, /galleryLoading:\s*true,/);
  assert.match(app, /galleryLoadError:\s*"",/);
  assert.match(app, /function getFilmstripPlaceholderState\(\) \{[\s\S]*state\.galleryLoading[\s\S]*state\.galleryLoadError/);
  assert.match(app, /function renderFilmstripPlaceholder\(\) \{[\s\S]*refs\.filmstrip\.replaceChildren\(fragment\);/);
  assert.match(app, /if \(entries\.length === 0\) \{[\s\S]*renderFilmstripPlaceholder\(\);[\s\S]*return;/);
  assert.match(app, /state\.galleryLoading = false;[\s\S]*state\.galleryLoadError = "";/);
  assert.match(
    app,
    /catch \(error\) \{[\s\S]*state\.galleryLoading = false;[\s\S]*state\.galleryLoadError = error instanceof Error \? error\.message : String\(error\);[\s\S]*throw error;/,
  );
  assert.match(styles, /\.filmstrip-placeholder-entry\s*\{[\s\S]*pointer-events:\s*none;/);
  assert.match(styles, /\.filmstrip-placeholder-ghost\.is-loading::before\s*\{[\s\S]*animation:\s*filmstrip-placeholder-sweep/);
  assert.match(styles, /@keyframes filmstrip-placeholder-sweep/);
});

test("studio prompt filmstrip keeps its session boundary across direct and polled completion", async () => {
  const app = await readFile(appPath, "utf8");
  const getFilmstripItemsBody = extractFunctionBefore(app, "getFilmstripItems", "getFilmstripPlaceholderState");
  const startGenerationBody = extractFunctionBefore(app, "startGeneration", "isStartGenerationShortcut");
  const loadGalleryBody = extractFunctionBefore(app, "loadGallery", "normalizeGenerationTaskSnapshot");
  const applySnapshotsBody = extractFunctionBefore(app, "applyGenerationTaskSnapshots", "loadGenerationTasks");
  const runGenerationBody = extractFunctionBefore(app, "runGeneration", "startGeneration");

  assert.match(app, /getPromptGenerationGalleryItems/);
  assert.match(app, /const promptGalleryItems = getPromptGenerationGalleryItems\(state\.gallery\);/);
  assert.match(app, /promptFilmstripBaselineCaptured:\s*false,/);
  assert.match(app, /promptFilmstripBaselineFilenames:\s*\[\],/);
  assert.match(app, /promptFilmstripSessionJobIds:\s*\[\],/);
  assert.match(app, /promptFilmstripSessionFilenames:\s*\[\],/);
  assert.match(getFilmstripItemsBody, /const visibleFilenames = new Set\(\[[\s\S]*promptFilmstripBaselineFilenames[\s\S]*promptFilmstripSessionFilenames/);
  assert.match(getFilmstripItemsBody, /\.filter\(\(item\) => visibleFilenames\.has\(String\(item\?\.filename \|\| ""\)\.trim\(\)\)\)[\s\S]*\.slice\(0, PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT\)/);
  assert.doesNotMatch(getFilmstripItemsBody, /promptFilmstripHistoryLimit/);
  assert.match(startGenerationBody, /const job = createJob\(\);\s*registerPromptFilmstripSessionJob\(job\); state\.jobs\.unshift\(job\);/);
  assert.match(loadGalleryBody, /state\.gallery = sortGalleryItemsByCreatedAtDesc\(hydratedGallery\.items\);\s*capturePromptFilmstripBaseline\(\);/);
  assert.match(applySnapshotsBody, /upsertGalleryItem\(task\.item\);\s*recordPromptFilmstripSessionResult\(task, task\.item\);/);
  assert.match(runGenerationBody, /GENERATION_STREAM_EVENTS\.SAVED[\s\S]*upsertGalleryItem\(payload\.item\);\s*recordPromptFilmstripSessionResult\(job, payload\.item\);/);
  assert.doesNotMatch(app, /localStorage\.(?:getItem|setItem)\([^)]*promptFilmstrip(?:Baseline|Session)/i);
  assert.match(app, /refs\.recentEmpty\.classList\.toggle\("hidden",\s*promptGalleryItems\.length > 0\);/);
  assert.match(app, /getRecentGalleryItems\(promptGalleryItems\)/);
  assert.doesNotMatch(app, /getRecentGalleryItems\(state\.gallery\)/);
});

test("studio keeps the initial preview idle until a job or thumbnail is selected", async () => {
  const app = await readFile(appPath, "utf8");
  const ensureStart = app.indexOf("function ensureSelectedPreview()");
  const ensureEnd = app.indexOf("function setSelectedPreviewKey(", ensureStart);
  const ensureSelectedPreview = app.slice(ensureStart, ensureEnd);

  assert.ok(ensureStart >= 0 && ensureEnd > ensureStart);
  assert.match(ensureSelectedPreview, /state\.selectedPreviewKey = makeJobPreviewKey\(latestJob\.id\);/);
  assert.doesNotMatch(ensureSelectedPreview, /sortGalleryItemsByCreatedAtDesc\(state\.gallery\)/);
  assert.doesNotMatch(ensureSelectedPreview, /preferredGalleryItem|makeGalleryPreviewKey\(preferredGalleryItem\.filename\)/);
  assert.match(app, /button\.addEventListener\("click", \(\) => \{\s*setSelectedPreviewKey\(key\);\s*\}\);/);
});

test("generation activity moves into settings while studio workspace reflows to two columns", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.doesNotMatch(html, /<section class="studio-panel recent-panel">/);
  assert.doesNotMatch(html, /id="recentList"|id="recentEmpty"|id="clearHistoryButton"|id="focusGalleryButton"/);
  assert.doesNotMatch(html, /<aside class="side-column">/);
  assert.match(html, /data-nav-action="activity-log"[\s\S]*生成日志/);
  assert.match(
    html,
    /<form class="config-form" id="configForm">[\s\S]*<\/form>\s*<section class="config-log-panel live-panel config-card" id="configGenerationLogPanel" aria-label="生成日志" data-ui-i18n-aria-label="activityLog">[\s\S]*<h2 data-ui-i18n="activityLog">生成日志<\/h2>[\s\S]*id="timelineList"/,
  );
  assert.match(styles, /\.studio-grid\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\)\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="narrow-desktop"\] \.studio-grid\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*324px\)\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.config-log-panel\.live-panel\s*\{[\s\S]*min-height:\s*180px;[\s\S]*height:\s*auto;/);
  const timelineListRule = readCssRule(styles, ".timeline-list");
  const timelineItemRule = readCssRule(styles, ".timeline-item");
  assert.match(timelineListRule, /gap:\s*0;/);
  assert.match(timelineListRule, /padding:\s*2px\s+0\s+4px;/);
  assert.match(timelineItemRule, /grid-template-columns:\s*18px\s+minmax\(0,\s*1fr\);/);
  assert.match(timelineItemRule, /gap:\s*4px\s+10px;/);
  assert.match(timelineItemRule, /padding:\s*var\(--timeline-item-padding-y,\s*8px\)\s*0;/);
  assert.match(styles, /\.timeline-copy\s*\{[\s\S]*display:\s*contents;/);
  assert.match(styles, /\.timeline-main\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1;[\s\S]*white-space:\s*normal;[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(readCssRule(styles, ".timeline-main"), /display:\s*block;/);
  assert.match(readCssRule(styles, ".timeline-summary"), /white-space:\s*normal;/);
  assert.match(readCssRule(styles, ".timeline-summary"), /overflow-wrap:\s*anywhere;/);
  assert.match(readCssRule(styles, ".timeline-summary"), /color:\s*var\(--text\);/);
  assert.match(readCssRule(styles, ".timeline-summary"), /font-weight:\s*700;/);
  assert.doesNotMatch(readCssRule(styles, ".timeline-summary"), /white-space:\s*nowrap|text-overflow:\s*ellipsis|overflow:\s*hidden/);
  assert.match(styles, /\.timeline-relay\s*\{[\s\S]*display:\s*inline;[\s\S]*margin-left:\s*8px;[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(readCssRule(styles, ".timeline-relay"), /color:\s*rgba\(132,\s*202,\s*255,\s*0\.82\);/);
  assert.match(readCssRule(styles, ".timeline-relay"), /font-weight:\s*600;/);
  assert.doesNotMatch(readCssRule(styles, ".timeline-relay"), /margin-top/);
  assert.match(styles, /\.timeline-detail\s*\{[\s\S]*grid-column:\s*2 \/ -1;[\s\S]*grid-row:\s*2;/);
  assert.doesNotMatch(styles, /\.timeline-params\s*\{/);
  assert.match(styles, /\.timeline-url\s*\{[\s\S]*grid-column:\s*2 \/ -1;[\s\S]*grid-row:\s*2;/);
  assert.match(readCssRule(styles, ".timeline-url"), /white-space:\s*normal;/);
  assert.match(readCssRule(styles, ".timeline-url"), /overflow-wrap:\s*anywhere;/);
  assert.match(readCssRule(styles, ".timeline-url"), /color:\s*rgba\(171,\s*184,\s*218,\s*0\.76\);/);
  assert.doesNotMatch(readCssRule(styles, ".timeline-url"), /text-overflow:\s*ellipsis|white-space:\s*nowrap/);
  assert.match(styles, /\.timeline-item\.has-url \.timeline-detail\s*\{[\s\S]*grid-row:\s*3;/);
  const timelineMetaRule = readCssRuleContaining(styles, ".timeline-meta", "display: flex");
  assert.match(timelineMetaRule, /grid-column:\s*2\s*\/\s*-1;/);
  assert.match(timelineMetaRule, /grid-row:\s*3;/);
  assert.match(timelineMetaRule, /display:\s*flex;/);
  assert.match(timelineMetaRule, /flex-wrap:\s*wrap;/);
  assert.match(timelineMetaRule, /column-gap:\s*12px;/);
  assert.doesNotMatch(timelineMetaRule, /justify-content:\s*space-between|margin-left/);
  assert.match(styles, /\.timeline-item\.has-url\.has-detail \.timeline-meta\s*\{[\s\S]*grid-row:\s*4;/);
  assert.doesNotMatch(readCssRule(styles, ".timeline-ratio-size"), /margin-left/);
  assert.doesNotMatch(readCssRule(styles, ".timeline-item time"), /justify-self:\s*end/);
  assert.doesNotMatch(styles, /\.timeline-ratio\s*\{|\.timeline-resolution\s*\{/);
  assert.match(styles, /\.timeline-main,\s*\.timeline-url,\s*\.timeline-meta\s*\{[\s\S]*font-size:\s*0\.78rem;/);
  assert.doesNotMatch(readCssRuleContaining(styles, ".timeline-main,\n.timeline-url,\n.timeline-meta", "font-size: 0.78rem"), /color:/);
  assert.match(styles, /\.timeline-mode,\s*\.timeline-ratio-size\s*\{[\s\S]*color:\s*rgba\(171,\s*184,\s*218,\s*0\.64\);/);
  assert.match(readCssRule(styles, ".timeline-mode"), /font-weight:\s*700;/);
  assert.match(styles, /\.timeline-meta\s*\{[\s\S]*align-items:\s*center;[\s\S]*white-space:\s*nowrap;[\s\S]*overflow-wrap:\s*normal;/);
  assert.match(styles, /\.timeline-ratio-size,\s*\.timeline-start-time time\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\]\s+\.timeline-meta\s*\{[\s\S]*white-space:\s*normal;/);
  assert.match(app, /configGenerationLogPanel:\s*document\.querySelector\("#configGenerationLogPanel"\),/);
  assert.match(app, /function openConfigGenerationLog\(\) \{[\s\S]*setDrawerOpen\(true\);[\s\S]*refs\.configGenerationLogPanel\?\.scrollIntoView/);
  assert.match(app, /if \(action === "activity-log"\) \{[\s\S]*openConfigGenerationLog\(\);[\s\S]*return;/);
  assert.match(app, /function formatCompactRatioLabel\(ratio\) \{[\s\S]*return \/\^\\d\+:\\d\+\$\/\.test\(normalized\) \? normalized : "";/);
  assert.match(app, /formatGenerationActivityModeLabel/);
  assert.doesNotMatch(app, /title\.textContent = item\.title;[\s\S]*copy\.appendChild\(title\);/);
  // Row building lives in the shared log panel module; the settings log panel is the
  // only place the log renders, scoped to the board picked by the channel tabs.
  const logPanel = await readFile(generationLogPanelPath, "utf8");
  assert.match(app, /renderGenerationLogRows\(refs\.timelineList, \{[\s\S]*entries: items,[\s\S]*channel,[\s\S]*formatTime: formatClock,/);
  assert.match(logPanel, /const displayText = getGenerationActivityDisplayText\(entry\.detail\);/);
  assert.match(logPanel, /"timeline-summary", displayText\.summary \|\| cleanText\(entry\.title\)/);
  assert.match(logPanel, /row\.classList\.add\("has-url"\);[\s\S]*"timeline-url", cleanText\(entry\.imageUrl\)[\s\S]*link\.target = "_blank";[\s\S]*link\.rel = "noopener noreferrer";/);
  assert.match(logPanel, /if \(displayText\.detail\) \{[\s\S]*row\.classList\.add\("has-detail"\);[\s\S]*"timeline-detail", displayText\.detail/);
  assert.match(logPanel, /if \(appendRelay\(documentRef, main, entry\.relayUrl\)\) \{[\s\S]*row\.classList\.add\("has-relay"\);/);
  assert.match(logPanel, /"timeline-relay", relayText/);
  assert.doesNotMatch(logPanel, /className: "timeline-params"|createElement\(documentRef, "pre"/);
  assert.match(logPanel, /"timeline-meta"\);[\s\S]*"timeline-mode", cleanText\(entry\.modeLabel\)[\s\S]*cleanText\(entry\.ratio\), cleanText\(entry\.size\) \? `\(\$\{cleanText\(entry\.size\)\}\)` : ""[\s\S]*"timeline-ratio-size", ratioSize[\s\S]*entry\.generationStartedAt \|\| entry\.generationCompletedAt[\s\S]*\[entry\.generationStartedAt, entry\.generationCompletedAt\][\s\S]*\[entry\.at\][\s\S]*"timeline-start-time"[\s\S]*formatTime\(value\)/);
  assert.doesNotMatch(logPanel, /className = "timeline-ratio"|className = "timeline-resolution"/);
  // The relay URL is stored bare and only gains its `URL：` prefix at render time,
  // so success and failure rows cannot end up with different formats.
  const logStore = await readFile(generationLogStorePath, "utf8");
  assert.match(logStore, /export function normalizeGenerationLogRelayUrl\(value\) \{[\s\S]*match\(\/\^\(\?:URL\|中转\)\\s\*\[：:\]\\s\*\(\.\+\)\$\//);
  assert.match(logStore, /export function formatGenerationLogRelayText\(relayUrl\) \{[\s\S]*return normalized \? `URL：\$\{normalized\}` : "";/);
  assert.doesNotMatch(logStore, /return relayUrl \? `中转/);
  assert.match(app, /function buildGenerationActivityRelayUrl\(item = \{\}\) \{[\s\S]*resolveGenerationRelayUrl\(item\);/);
  assert.match(app, /imageUrl: getImageUrl\(current\), modeLabel: formatGenerationActivityModeLabel\(current\.imageRoute \|\| current\.generationRoute\), relayUrl: buildGenerationActivityRelayUrl\(current\),/);
  assert.match(app, /modeLabel: formatGenerationActivityModeLabel\(task\?\.imageRoute\),/);
  assert.match(app, /imageUrl: getImageUrl\(task\?\.item\),/);
  assert.match(app, /relayUrl: task\?\.item \? buildGenerationActivityRelayUrl\(task\.item\) : resolveGenerationRelayUrl\(task\),/);
  assert.match(app, /relayUrl: normalizeGenerationLogRelayUrl\(entry\?\.relayUrl \|\| entry\?\.paramsText\),/);
  assert.match(app, /relayUrl: buildGenerationActivityRelayUrl\(item\)/);
  assert.doesNotMatch(app, /paramsText: buildParameterText/);
  assert.match(app, /ratio: formatCompactRatioLabel\(task\?\.ratio\),/);
  assert.match(app, /size: formatCompactSizeLabel\(task\?\.size\),/);
});

test("live feed shows a floating unread indicator without forcing scroll to newest items", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<button class="timeline-new-indicator hidden" id="timelineNewIndicator" type="button" aria-label="查看新动态">[\s\S]*<span aria-hidden="true">↑<\/span>[\s\S]*<strong id="timelineNewCount">0<\/strong>[\s\S]*<\/button>/);
  assert.match(styles, /\.timeline-new-indicator\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*64px;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/);
  assert.match(app, /timelineUnreadCount:\s*0/);
  assert.match(app, /timelineSignatures:\s*new Map\(\)/);
  assert.match(app, /function getTimelineScrollAnchor\(\) \{[\s\S]*dataset\.timelineKey/);
  assert.match(app, /function restoreTimelineScrollAnchor\(anchor, fallbackScrollTop\) \{[\s\S]*refs\.timelineList\.scrollTop \+=/);
  assert.match(app, /const scrollAnchor = isAtTop \? null : getTimelineScrollAnchor\(\);[\s\S]*restoreTimelineScrollAnchor\(scrollAnchor, previousScrollTop\);/);
  assert.match(app, /refs\.timelineNewIndicator\.addEventListener\("click", scrollTimelineToNewest\);/);
  assert.match(app, /refs\.timelineList\.addEventListener\("scroll", handleTimelineScroll/);
});

test("live feed keeps existing task order stable while activity text changes", async () => {
  const app = await readFile(appPath, "utf8");

  const logStore = await readFile(generationLogStorePath, "utf8");

  assert.match(app, /upsertGenerationLogEntry/);
  assert.match(app, /state\.generationLog = upsertGenerationLogEntry\(state\.generationLog,/);
  // An entry keeps the order slot it was first written with, so later status text
  // updates cannot reshuffle rows the user is already reading.
  assert.match(logStore, /orderAt: cleanText\(existing\?\.orderAt\) \|\| cleanText\(existing\?\.at\) \|\| cleanText\(entry\?\.orderAt\) \|\| at,/);
  assert.match(logStore, /orderAt: cleanText\(existing\?\.orderAt\) \|\| cleanText\(existing\?\.at\) \|\| cleanText\(group\?\.orderAt\) \|\| at,/);
  assert.doesNotMatch(app, /state\.activityFeed/);
});

test("generation status and activity copy share queue heartbeat retry recovery labels", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /buildGenerationTaskStatusText/);
  assert.match(app, /statusText:\s*buildGenerationTaskStatusText\(\{[\s\S]*statusStage:\s*task\.statusStage \|\| status,[\s\S]*errorMessage:\s*task\.errorMessage/);
  assert.match(app, /const statusText = buildGenerationTaskStatusText\(\{[\s\S]*statusStage:\s*payload\.stage,[\s\S]*statusText:\s*payload\.message/);
  assert.match(app, /handleActivityStatus\(job\.id,\s*payload\.stage,\s*statusText\)/);
  assert.match(app, /buildGenerationTaskActivityDetail\(\{[\s\S]*statusStage:\s*stage,[\s\S]*statusText:\s*message/);
});

test("scrollable surfaces use subtle themed scrollbars instead of default browser chrome", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /--scrollbar-size:\s*10px;/);
  assert.match(
    styles,
    /\.settings-form,[\s\S]*\.creation-form,[\s\S]*\.creation-result-grid,[\s\S]*\.portrait-form,[\s\S]*\.portrait-result-grid,[\s\S]*\.ppt-form,[\s\S]*\.ppt-slide-list,[\s\S]*\.image-decomposition-form,[\s\S]*textarea\s*\{[\s\S]*scrollbar-width:\s*thin;[\s\S]*scrollbar-color:\s*var\(--scrollbar-thumb-color,\s*rgba\(132,\s*147,\s*255,\s*0\.42\)\)\s*var\(--scrollbar-track-color,\s*rgba\(255,\s*255,\s*255,\s*0\.06\)\);/,
  );
  assert.match(
    styles,
    /\.settings-form::-webkit-scrollbar,[\s\S]*\.creation-form::-webkit-scrollbar,[\s\S]*\.creation-result-grid::-webkit-scrollbar,[\s\S]*\.portrait-form::-webkit-scrollbar,[\s\S]*\.portrait-result-grid::-webkit-scrollbar,[\s\S]*\.ppt-form::-webkit-scrollbar,[\s\S]*\.ppt-slide-list::-webkit-scrollbar,[\s\S]*\.image-decomposition-form::-webkit-scrollbar,[\s\S]*textarea::-webkit-scrollbar\s*\{[\s\S]*width:\s*var\(--scrollbar-size,\s*10px\);[\s\S]*height:\s*var\(--scrollbar-size,\s*10px\);/,
  );
  assert.match(styles, /\.settings-form::-webkit-scrollbar-thumb,[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(156,\s*170,\s*255,\s*0\.58\),\s*rgba\(111,\s*124,\s*255,\s*0\.34\)\);/);
});

test("creation workbench layouts inherit the prompt studio column split", async () => {
  const styles = await readFile(stylesPath, "utf8");

  [".creation-workspace", ".article-illustration-workspace", ".portrait-workspace", ".ppt-workspace"].forEach((selector) => {
    const rule = readCssRuleContaining(styles, selector, "display: grid");
    assert.match(
      rule,
      /grid-template-columns:\s*var\(--studio-grid-left,\s*392px\)\s*minmax\(0,\s*1fr\);/,
      `${selector} should use the same left/right split as .studio-grid`,
    );
    assert.match(rule, /gap:\s*var\(--studio-grid-gap,\s*14px\);/);
  });

  assert.match(
    styles,
    /html\[data-ui-layout="narrow-desktop"\] \.studio-grid,[\s\S]*html\[data-ui-layout="narrow-desktop"\] \.creation-workspace,[\s\S]*html\[data-ui-layout="narrow-desktop"\] \.article-illustration-workspace,[\s\S]*html\[data-ui-layout="narrow-desktop"\] \.portrait-workspace,[\s\S]*html\[data-ui-layout="narrow-desktop"\] \.ppt-workspace\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*324px\)\s*minmax\(0,\s*1fr\);/,
  );
});

test("config drawer uses a quieter structured settings layout", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(html, /<div class="drawer-panel config-panel">/);
  assert.match(html, /<div class="config-drawer-body">[\s\S]*<section class="config-card config-connection-card" aria-labelledby="configConnectionTitle">/);
  assert.match(html, /<h3 id="configConnectionTitle" data-ui-i18n="connectionSection">调用通道<\/h3>/);
  assert.doesNotMatch(html, /config-drawer-summary/);
  assert.doesNotMatch(html, /选择当前生成请求的调用路径/);
  assert.doesNotMatch(html, /API Key 只保存在当前浏览器/);
  assert.match(html, /<div class="config-route-fields">[\s\S]*data-route-panel="a"[\s\S]*data-route-panel="b"[\s\S]*<\/div>/);
  assert.doesNotMatch(html, /config-preferences-card|configPreferencesTitle|<h3 id="configPreferencesTitle">偏好<\/h3>/);
  assert.match(
    html,
    /<div class="drawer-head-actions config-actions-row">[\s\S]*<div class="config-language-switch" role="group" aria-label="切换界面语言" data-ui-i18n-aria-label="languageSwitch">[\s\S]*<input id="uiLanguageInput" name="uiLanguage" type="hidden" value="zh-CN" \/>[\s\S]*data-ui-language-option="zh-CN"[\s\S]*data-ui-language-option="en"[\s\S]*<\/div>[\s\S]*<button class="header-button" id="closeConfigButton" type="button" data-ui-i18n="close">关闭<\/button>/,
  );
  assert.match(html, /<div class="config-action-bar">[\s\S]*id="configFeedback"[^>]*aria-live="polite"[^>]*><\/p>[\s\S]*id="testConnectionButton"[\s\S]*data-ui-i18n="testConnection">测试连接<\/button>[\s\S]*type="submit" data-ui-i18n="save">保存<\/button>[\s\S]*<\/div>/);
  assert.match(html, /<\/form>\s*<section class="config-log-panel live-panel config-card" id="configGenerationLogPanel" aria-label="生成日志" data-ui-i18n-aria-label="activityLog">/);
  assert.match(styles, /\.config-drawer \.drawer-panel\s*\{[\s\S]*width:\s*min\(560px,\s*calc\(100vw - 24px\)\);/);
  assert.match(styles, /\.config-panel\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.config-actions-row\s*\{[\s\S]*flex-wrap:\s*nowrap;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\]\s+\.config-panel \.drawer-head,[\s\S]*html\[data-ui-layout="mobile"\]\s+\.config-panel \.drawer-head\s*\{[\s\S]*align-items:\s*center;[\s\S]*flex-direction:\s*row;/);
  assert.match(readCssRule(styles, ".config-drawer-body"), /overflow-y:\s*auto;[\s\S]*overflow-x:\s*hidden;[\s\S]*display:\s*grid;[\s\S]*gap:\s*8px;/);
  assert.match(readCssRule(styles, ".config-language-switch"), /width:\s*104px;[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(readCssRule(styles, ".config-language-option"), /min-width:\s*0;[\s\S]*white-space:\s*nowrap;/);
  assert.match(readCssRule(styles, ".config-actions-row > .header-button"), /min-width:\s*78px;/);
  assert.match(readCssRule(styles, 'html[data-ui-layout="mobile"] .config-language-switch'), /width:\s*104px;[\s\S]*flex:\s*0 0 104px;/);
  assert.match(
    readCssRule(styles, 'html:is([data-ui-layout="mobile"], [data-ui-layout="tablet"], [data-ui-layout="stacked"]) .config-language-option'),
    /min-height:\s*44px;/,
  );
  assert.match(
    readCssRule(styles, 'html:is([data-ui-layout="mobile"], [data-ui-layout="tablet"], [data-ui-layout="stacked"]) .route-selector label'),
    /min-height:\s*46px;/,
  );
  assert.match(styles, /\.route-selector\s*\{[\s\S]*padding:\s*3px;[\s\S]*border-radius:\s*8px;/);
  assert.match(styles, /\.route-selector label\s*\{[\s\S]*min-height:\s*34px;[\s\S]*border-radius:\s*7px;/);
  assert.match(styles, /\.route-selector label:has\(input:checked\)\s*\{[\s\S]*box-shadow:/);
  assert.match(styles, /\.config-card\s*\{[\s\S]*padding:\s*10px;/);
  assert.match(styles, /\.config-route-fields\s*\{[\s\S]*gap:\s*8px;[\s\S]*padding:\s*10px;[\s\S]*border-radius:\s*8px;/);
  assert.match(styles, /\.config-route-fields input,[\s\S]*\.config-route-fields select\s*\{[\s\S]*min-height:\s*36px;/);
  assert.match(styles, /\.endpoint-suffix-select\s*\{[\s\S]*min-height:\s*30px;/);
  assert.match(styles, /\.inline-button\s*\{[\s\S]*min-height:\s*30px;/);
  assert.match(styles, /\.config-log-panel\.live-panel\s*\{[\s\S]*min-height:\s*180px;[\s\S]*height:\s*auto;/);
  assert.match(styles, /\.config-note:empty\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /\.config-action-bar\s*\{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*0;[\s\S]*grid-template-columns:\s*minmax\(112px,\s*0\.36fr\)\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.config-action-bar \.header-button,[\s\S]*\.config-action-bar \.generate-button\s*\{[\s\S]*min-height:\s*38px;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\]\s+\.config-action-bar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(
    readCssRule(styles, 'html[data-ui-layout="mobile"] .config-drawer .drawer-panel'),
    /left:\s*0;[\s\S]*right:\s*0;[\s\S]*width:\s*auto;[\s\S]*scrollbar-gutter:\s*auto;/,
  );
});

test("reference upload appears above prompt and generate action below prompt", async () => {
  const html = await readFile(indexPath, "utf8");

  assert.match(
    html,
    /<form id="generateForm" class="settings-form">[\s\S]*<details[\s\S]*class="field-group reference-field-group adaptive-section"[\s\S]*id="referenceDropzone"[\s\S]*<\/details>[\s\S]*id="promptInput"[\s\S]*<button[\s\S]*class="generate-button"[\s\S]*id="generateButton"[\s\S]*type="submit"/,
  );
  assert.doesNotMatch(html, /class="generate-note"/);
  assert.doesNotMatch(html, /支持最多 20 个任务排队/);
  assert.doesNotMatch(html, /id="generateButton"[\s\S]*id="promptInput"/);
  assert.doesNotMatch(html, /id="promptInput"[\s\S]*id="referenceDropzone"/);
});

test("studio prompt counter displays character count without a hard limit", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<span class="field-counter"><span id="promptCounter">0 字<\/span><\/span>/);
  assert.doesNotMatch(html, /id="promptCounter">0<\/span>\s*\/\s*1000/);
  assert.match(app, /refs\.promptCounter\.textContent = `\$\{refs\.promptInput\.value\.length\} \$\{getUiLanguageText\("promptCounterSuffix"\) \|\| "字"\}`;/);
  assert.doesNotMatch(app, /refs\.promptCounter\.textContent = String\(refs\.promptInput\.value\.length\);/);
});

test("prompt studio exposes independent clear and reference-recycling controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(html, /id="clearReferenceButton"[\s\S]*aria-label="清空参考图"/);
  assert.match(html, /id="clearPromptButton"[\s\S]*aria-label="清空提示词"/);
  const clearButtonMarkup = [...html.matchAll(/<button\s+class="icon-button field-heading-icon-button field-clear-button"[\s\S]*?<\/button>/g)]
    .map((match) => match[0]);
  assert.equal(clearButtonMarkup.length, 2);
  assert.equal((html.match(/class="field-clear-icon"/g) || []).length, 2);
  assert.equal((html.match(/<path d="M3 6h18" \/>/g) || []).length, 2);
  assert.equal((html.match(/<path d="M8 6V4h8v2" \/>/g) || []).length, 2);
  assert.equal((html.match(/<path d="m19 6-1 14H6L5 6" \/>/g) || []).length, 2);
  clearButtonMarkup.forEach((markup) => assert.doesNotMatch(markup, /×/));
  assert.match(
    html,
    /id="surprisePromptButton"[\s\S]*aria-label="提示词模板"[\s\S]*data-tooltip="提示词模板"[\s\S]*<span class="prompt-template-icon" aria-hidden="true">⭐<\/span>/,
  );
  assert.match(html, /id="previewAddReferenceButton"[\s\S]*>添加到参考图<\/button>/);
  assert.match(html, /id="previewAddReferenceButton"[\s\S]*aria-disabled="true"/);
  assert.match(html, /id="previewAddReferenceButton"[\s\S]*data-tooltip="添加到参考图；也可拖动预览图片到参考图区域"/);
  assert.doesNotMatch(html, /<[^>]*\btitle="[^"]*"[^>]*\bdata-tooltip="[^"]*"[^>]*>/);
  assert.match(html, /id="appTooltip"[^>]*role="tooltip"[^>]*popover="manual"/);
  assert.match(app, /function clearPromptInput\(\) \{[\s\S]*updatePromptCounter\(\);[\s\S]*updateGenerateButton\(\);/);
  assert.match(app, /refs\.clearReferenceButton\.addEventListener\("click",[\s\S]*resetReferenceFiles\(\);/);
  assert.match(app, /async function addCurrentPreviewToReferences\(previewKey = state\.selectedPreviewKey\)/);
  assert.match(app, /new File\(\[blob\],[\s\S]*applyReferenceFiles\(\[file\], \{ feedback: true \}\);/);
  assert.match(app, /event\.dataTransfer\?\.setData\(PREVIEW_REFERENCE_DRAG_MIME, state\.selectedPreviewKey\)/);
  assert.match(app, /function handleReferenceDrop\(event\) \{[\s\S]*getPreviewReferenceDragKey\(event\.dataTransfer\)[\s\S]*addCurrentPreviewToReferences/);
  const tooltipRule = readCssRule(styles, ".app-tooltip");
  assert.match(tooltipRule, /position:\s*fixed;/);
  assert.match(tooltipRule, /z-index:\s*2147483647;/);
  assert.match(tooltipRule, /max-width:\s*min\(280px,\s*calc\(100vw\s*-\s*24px\)\);/);
  assert.match(tooltipRule, /pointer-events:\s*none;/);
  assert.doesNotMatch(styles, /\[data-tooltip\]::after/);
  assert.match(app, /appTooltip:\s*document\.querySelector\("#appTooltip"\),/);
  assert.match(app, /const APP_TOOLTIP_TRIGGER_SELECTOR = "\[data-tooltip\]";/);
  assert.match(app, /\[data-ui-i18n-title\][\s\S]*!element\.matches\(APP_TOOLTIP_TRIGGER_SELECTOR\)/);
  assert.doesNotMatch(app, /appTooltipTitle/);
  assert.match(app, /function bindAppTooltips\(\) \{/);
  assert.match(app, /function formatAppTooltipText\(value\) \{[\s\S]*\.replace\(\/\(\[。；\]\)\[\^\\S\\r\\n\]\*\(\?=\\S\)\/gu, "\$1\\n"\);/);
  assert.match(app, /const text = formatAppTooltipText\(trigger\.dataset\.tooltip\);/);
  const formatAppTooltipTextSource = extractFunctionBefore(app, "formatAppTooltipText", "restoreAppTooltipDescription");
  const formatAppTooltipText = new Function(`${formatAppTooltipTextSource}; return formatAppTooltipText;`)();
  assert.equal(formatAppTooltipText("添加到参考图；也可拖动图片"), "添加到参考图；\n也可拖动图片");
  assert.equal(formatAppTooltipText("第一句。第二句"), "第一句。\n第二句");
  assert.equal(formatAppTooltipText("第一句； 第二句。第三句"), "第一句；\n第二句。\n第三句");
  assert.equal(formatAppTooltipText("末尾标点。"), "末尾标点。");
  assert.match(app, /document\.addEventListener\("pointerover",[\s\S]*showAppTooltip\(trigger\);/);
  assert.match(app, /document\.addEventListener\("focusin",[\s\S]*showAppTooltip\(trigger\);/);
  assert.match(app, /typeof refs\.appTooltip\.showPopover === "function"[\s\S]*refs\.appTooltip\.showPopover\(\);/);
  assert.match(app, /Math\.min\(rightBoundary - tooltipRect\.width,\s*Math\.max\(leftBoundary,\s*centeredLeft\)\)/);
  assert.match(app, /trigger\.setAttribute\("aria-describedby",[\s\S]*refs\.appTooltip\.id/);
  assert.match(app, /refs\.appTooltip\.hidePopover\(\);/);
  assert.match(tooltipRule, /white-space:\s*pre-line;/);
  assert.match(styles, /\.preview-add-reference-button\[aria-disabled="true"\]\s*\{[\s\S]*cursor:\s*not-allowed;[\s\S]*opacity:\s*0\.46;/);
  assert.doesNotMatch(app, /refs\.previewAddReferenceButton\.disabled\s*=/);
  assert.match(app, /refs\.previewAddReferenceButton\.setAttribute\("aria-disabled",\s*String\(!canAddPreviewReference\)\);/);
  assert.match(app, /refs\.previewAddReferenceButton\.getAttribute\("aria-disabled"\) === "true"[\s\S]*return;/);
  assert.match(styles, /\.field-heading-icon-button\s*\{[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;[\s\S]*border-radius:\s*7px;/);
  assert.match(styles, /\.field-clear-icon\s*\{[\s\S]*width:\s*14px;[\s\S]*fill:\s*none;[\s\S]*stroke:\s*currentColor;[\s\S]*stroke-width:\s*1\.8;[\s\S]*stroke-linecap:\s*round;/);
  assert.match(styles, /#surprisePromptButton\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*1;/);
  assert.match(styles, /\.field-clear-button:focus-visible\s*\{[\s\S]*outline:\s*2px solid/);
  assert.match(
    styles,
    /html:is\(\[data-ui-layout="stacked"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="mobile"\]\) \.field-heading-icon-button\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/,
  );
  assert.match(
    styles,
    /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\]\) #surprisePromptButton\s*\{[\s\S]*margin-inline-end:\s*52px;/,
  );
  assert.match(styles, /\.reference-grid\.dragover\s*\{/);
  assert.match(styles, /\.reference-preview-viewer \.reference-preview-backdrop\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.24\);[\s\S]*backdrop-filter:\s*none;[\s\S]*-webkit-backdrop-filter:\s*none;/);
  assert.match(styles, /\.lightbox-fields \.lightbox-params-field\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(96px,\s*1fr\) auto;[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.lightbox-fields \.lightbox-params-field textarea\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*96px;/);
  assert.match(styles, /html:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="mobile"\]\) \.lightbox-fields \.lightbox-params-field\s*\{[\s\S]*minmax\(112px,\s*1fr\) auto;/);
});

test("reference preview cards do not render uploaded filenames", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.doesNotMatch(app, /name\.textContent\s*=\s*item\.file\.name/);
  assert.doesNotMatch(app, /name\.className = "creation-logo-batch-source-name";[\s\S]*name\.textContent = item\.file\?\.name/);
  assert.doesNotMatch(app, /name\.className = "creation-reference-note";[\s\S]*name\.textContent = item\.file\?\.name/);
  assert.doesNotMatch(app, /name\.className = "portrait-reference-name";[\s\S]*name\.textContent = item\.file\?\.name/);
  assert.doesNotMatch(app, /reference-card-meta/);
  assert.doesNotMatch(app, /creation-logo-batch-source-name|portrait-reference-name/);
  assert.doesNotMatch(styles, /\.reference-card-meta/);
  assert.doesNotMatch(styles, /\.creation-logo-batch-source-name|\.portrait-reference-name/);
  assert.doesNotMatch(quickBlendView, /quick-blend-group-label/);
  assert.doesNotMatch(styles, /\.quick-blend-group-label/);
  assert.match(styles, /\.reference-card\s*\{[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(styles, /\.reference-preview-button\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*height:\s*auto;/);
  assert.match(styles, /\.reference-preview-button img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/);
  assert.match(styles, /\.reference-add-button\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
});

test("reference thumbnail remove control is a top-right x button", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /remove\.className = "reference-remove";[\s\S]*remove\.textContent = "x";/);
  assert.match(app, /remove\.setAttribute\("aria-label", "移除参考图"\);/);
  assert.match(styles, /\.reference-card\s*\{[\s\S]*position:\s*relative;/);
  assert.match(
    styles,
    /\.reference-remove\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*6px;[\s\S]*right:\s*6px;[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;/,
  );
  assert.doesNotMatch(app, /remove\.textContent = "移除";/);
});

test("reference thumbnail remove control appears only on the active thumbnail", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*\.reference-remove\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/,
  );
  assert.match(
    styles,
    /\.reference-card:hover\s*>\s*\.reference-remove,[\s\S]*\.reference-card:focus-within\s*>\s*\.reference-remove\s*\{[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
  );
});

test("style transfer thumbnail remove control anchors to the thumbnail corner", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\]\s+\.style-transfer-grid\s+\.reference-card\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-self:\s*stretch;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\]\s+\.style-transfer-grid\s+\.reference-remove\s*\{[\s\S]*top:\s*2px;[\s\S]*right:\s*2px;/,
  );
});

test("style transfer upload slots accept one image and align preview width to upload button", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(html, /id="styleTransferSourceInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*>/);
  assert.match(html, /id="styleTransferStyleInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*>/);
  assert.doesNotMatch(html, /id="styleTransferSourceInput"[^>]*\bmultiple\b/);
  assert.doesNotMatch(html, /id="styleTransferStyleInput"[^>]*\bmultiple\b/);
  assert.match(html, /id="styleTransferSourceDropzone"[\s\S]*<strong>[^<]+<\/strong>\s*<\/label>/);
  assert.match(html, /id="styleTransferStyleDropzone"[\s\S]*<strong>[^<]+<\/strong>\s*<\/label>/);
  const styleTransferBlock = html.match(/<div class="field-group style-transfer-block hidden"[\s\S]*?<label class="compact-field style-transfer-note">/)?.[0] || "";
  assert.doesNotMatch(styleTransferBlock, /<div class="field-head">[\s\S]*原图/);
  assert.doesNotMatch(styleTransferBlock, /<div class="field-head">[\s\S]*风格参考图/);
  assert.match(app, /const imageFiles = \[\.\.\.\(fileList \|\| \[\]\)\]\.filter\(\(item\) => item\.type\.startsWith\("image\/"\)\);/);
  assert.match(app, /if \(imageFiles\.length > 1\) \{[\s\S]*showError\("原图和风格参考图每个区域只能上传一张图片。"\);[\s\S]*return;/);
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot:has\(\.style-transfer-grid:not\(\.hidden\)\) \{[\s\S]*grid-template-rows:\s*minmax\(132px,\s*auto\);/,
  );
  assert.match(
    styles,
    /\.reference-grid\.style-transfer-grid\s*\{[\s\S]*width:\s*100%;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*justify-items:\s*stretch;/,
  );
  assert.match(
    styles,
    /\.reference-grid\.style-transfer-grid \.reference-card\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-self:\s*stretch;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-grid \.reference-preview-button\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*132px;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-grid \.reference-preview-button img\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/,
  );
});

test("pasted clipboard images in studio text inputs upload to the active image slot", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /function getClipboardImageFiles\(clipboardData\) \{[\s\S]*clipboardData\?\.items[\s\S]*item\.kind === "file"[\s\S]*item\.type\.startsWith\("image\/"\)[\s\S]*item\.getAsFile\(\)/,
  );
  assert.match(
    app,
    /function handleStudioImagePaste\(event\) \{[\s\S]*const imageFiles = getClipboardImageFiles\(event\.clipboardData\);[\s\S]*if \(imageFiles\.length === 0\) \{[\s\S]*return;[\s\S]*event\.preventDefault\(\);[\s\S]*if \(state\.studioMode === "style-transfer"\) \{[\s\S]*applyStyleTransferReferenceFile\("source", imageFiles\);[\s\S]*return;[\s\S]*applyReferenceFiles\(imageFiles\);/,
  );
  assert.match(app, /refs\.promptInput\.addEventListener\("paste", handleStudioImagePaste\);/);
  assert.match(app, /refs\.styleTransferInstructionInput\.addEventListener\("paste", handleStudioImagePaste\);/);
});

test("pasted clipboard images on creation view upload to creation references", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /function handleCreationReferenceImagePaste\(event\) \{[\s\S]*state\.activeView !== "creation"[\s\S]*isCreationLogoBatchBranch\(\)[\s\S]*const imageFiles = getClipboardImageFiles\(event\.clipboardData\);[\s\S]*imageFiles\.length === 0[\s\S]*return;[\s\S]*event\.preventDefault\(\);[\s\S]*applyCreationReferenceFiles\(imageFiles\);/,
  );
  assert.match(app, /document\.addEventListener\("paste", handleCreationReferenceImagePaste\);/);
});

test("pasted clipboard images in prompt agent modal upload to prompt agent preview", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /function isPromptAgentModalOpen\(\) \{[\s\S]*return !refs\.promptAgentModal\.classList\.contains\("hidden"\);[\s\S]*\}/,
  );
  assert.match(
    app,
    /function handlePromptAgentImagePaste\(event\) \{[\s\S]*if \(!isPromptAgentModalOpen\(\) \|\| event\.defaultPrevented\) \{[\s\S]*return;[\s\S]*const imageFiles = getClipboardImageFiles\(event\.clipboardData\);[\s\S]*if \(imageFiles\.length === 0\) \{[\s\S]*return;[\s\S]*event\.preventDefault\(\);[\s\S]*applyPromptAgentFile\(imageFiles\);/,
  );
  assert.match(
    app,
    /function handleCreationReferenceImagePaste\(event\) \{[\s\S]*event\.defaultPrevented[\s\S]*state\.activeView !== "creation"/,
  );
  assert.match(app, /document\.addEventListener\("paste", handlePromptAgentImagePaste\);/);
});

test("reference thumbnails render three per row and open a local preview viewer", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="referencePreviewViewer"[\s\S]*id="referencePreviewImage"/);
  assert.match(styles, /\.reference-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /\.reference-preview-button\s*\{/);
  assert.match(styles, /\.reference-analysis-view \.reference-preview-button\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
  assert.match(app, /referencePreviewItem:\s*null/);
  assert.match(app, /function openReferencePreview\(referenceId\) \{/);
  assert.match(app, /refs\.referencePreviewImage\.src = item\.previewUrl;/);
  assert.match(app, /refs\.referenceGrid\.addEventListener\("click",[\s\S]*target\.closest\("\[data-reference-preview-id\]"\)/);
});

test("reference images are compressed before generation uploads", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const GENERATION_REFERENCE_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 \* 1024;/);
  assert.match(app, /const GENERATION_REFERENCE_IMAGE_MAX_EDGE = 1024;/);
  assert.match(app, /async function prepareGenerationReferenceImageFile\(file\) \{/);
  assert.match(app, /new File\(\[blob\], makeGenerationReferenceImageName\(file\.name\)/);
  assert.match(app, /function startReferenceGenerationCompression\(item\) \{/);
  assert.match(app, /item\.generationFilePromise = prepareGenerationReferenceImageFile\(item\.file\)/);
  assert.match(app, /function getGenerationReferenceFile\(item\) \{/);
  assert.match(app, /const referenceFiles = state\.referenceFiles\.map\(getGenerationReferenceFile\);/);
  assert.match(app, /await ensureReferenceGenerationFilesReady\(\);[\s\S]*const job = createJob\(\);/);
  assert.match(app, /job\.referenceFiles\.forEach\(\(file\) => \{[\s\S]*formData\.append\("referenceImages", file\);/);
});

test("style transfer mode exposes independent source and style uploads", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /href="#style-transfer"[\s\S]*data-view-panel="studio"/);
  assert.match(html, /id="styleTransferBlock"/);
  assert.match(html, /id="styleTransferPresetInput"/);
  assert.match(html, /id="styleTransferPresetComparison"/);
  assert.match(html, /id="styleTransferSourceInput"[\s\S]*id="styleTransferSourceGrid"/);
  assert.match(html, /id="styleTransferStyleInput"[\s\S]*id="styleTransferStyleGrid"/);
  assert.match(html, /id="styleTransferInstructionInput"/);
  assert.match(styles, /\.style-transfer-block\s*\{/);
  assert.match(styles, /\.style-transfer-upload-grid\s*\{/);
  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"studio"[\s\S]*"style-transfer"[\s\S]*"reference-analysis"[\s\S]*"image-decomposition"[\s\S]*"quick-blend"[\s\S]*"image-compress"[\s\S]*"creation"[\s\S]*"article-illustration"[\s\S]*"ppt"[\s\S]*\]\);/);
  assert.match(app, /studioMode:\s*"prompt"/);
  assert.match(app, /function setStudioGenerationMode\(mode = "prompt"\)/);
  assert.match(app, /function getViewFromHash\(\) \{[\s\S]*"#style-transfer"[\s\S]*return "style-transfer";/);
  assert.match(app, /function syncHash\(view\) \{[\s\S]*view === "style-transfer"[\s\S]*"#style-transfer"/);
});

test("style transfer mode can use every style preset with before and after previews", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const presetAssets = [
    "custom-style-reference.svg",
    "style-before.png",
    "anime-cel.png",
    "hand-drawn.png",
    "pencil-sketch.png",
    "cyberpunk-neon.png",
    "pixel-game.png",
    "low-poly-3d.png",
    "editorial-watercolor.png",
    "paper-cut-collage.png",
    "risograph-poster.png",
    "vintage-film.png",
    "comic-ink.png",
    "clay-toy.png",
    "ink-gongbi.png",
  ];

  assert.match(html, /id="styleTransferPresetInput"/);
  assert.match(html, /id="styleTransferPresetComparison"/);
  assert.match(styles, /\.style-transfer-preset-preview\s*\{/);
  assert.match(styles, /\.style-transfer-comparison\s*\{/);
  assert.match(
    styles,
    /\.style-transfer-upload-grid\.uses-preset-style\s+\.style-transfer-style-slot\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(app, /const STYLE_TRANSFER_CUSTOM_PRESET = "custom";/);
  assert.match(app, /const STYLE_TRANSFER_DEFAULT_PRESET = "clay-toy";/);
  assert.match(app, /const STYLE_TRANSFER_PRESET_BEFORE_IMAGE = "\.\/assets\/style-presets\/cinematic-photo\.png";/);
  assert.match(app, /value:\s*"cinematic-photo"[\s\S]*beforeImage:\s*STYLE_TRANSFER_PRESET_BEFORE_IMAGE,[\s\S]*image:\s*"\.\/assets\/style-presets\/style-before\.png"/);
  assert.match(app, /const STYLE_TRANSFER_PRESETS = \[/);
  assert.match(app, /beforeImage:\s*STYLE_TRANSFER_PRESET_BEFORE_IMAGE/);
  for (const asset of presetAssets) {
    assert.match(app, new RegExp(`image:\\s*"\\.\\/assets\\/style-presets\\/${asset}"`));
  }
  assert.match(app, /function hasSelectedStyleTransferPreset\(\) \{/);
  assert.match(app, /function renderStyleTransferPresetPreview\(\) \{/);
  assert.match(app, /const showPreview = Boolean\(preset\.beforeImage && preset\.image\);/);
  assert.match(app, /function ensureStyleTransferPresetReferenceFileReady\(\) \{/);
  assert.match(app, /await ensureStyleTransferPresetReferenceFileReady\(\);[\s\S]*const job = createStyleTransferJob\(\);/);
  assert.match(app, /styleTransferReferenceImageName:\s*stylePresetFile\?\.name \|\| styleItem\?\.file\?\.name \|\| ""/);
});

test("style transfer preset comparison opens both images without detail metadata", async () => {
  const [app, html, styles, styleTransferPresetLightbox] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(indexPath, "utf8"),
    readFile(stylesPath, "utf8"),
    readFile(styleTransferPresetLightboxPath, "utf8"),
  ]);

  assert.match(app, /from "\/lib\/style-transfer-preset-lightbox\.mjs"/);
  assert.match(app, /function openStyleTransferPresetComparison\(\) \{/);
  assert.match(app, /buildStyleTransferPresetComparisonItem\(\{ preset, nowIso \}\)/);
  assert.match(app, /openLightbox\(comparisonItem\);/);
  assert.match(app, /refs\.styleTransferPresetComparison\.addEventListener\("click",\s*handleStyleTransferPresetComparisonClick\);/);
  assert.match(app, /openStyleTransferPresetComparison\(\)/);
  assert.match(app, /button\.dataset\.styleTransferPresetPreview = "comparison";/);
  assert.match(app, /button\.title = `放大查看 \$\{preset\.label\}\$\{label\}`;/);
  assert.match(styleTransferPresetLightbox, /export function buildStyleTransferPresetComparisonItem/);
  assert.match(styleTransferPresetLightbox, /comparisonImages:\s*\[/);
  assert.match(styleTransferPresetLightbox, /slot:\s*"before"[\s\S]*imageUrl:\s*beforeImage/);
  assert.match(styleTransferPresetLightbox, /slot:\s*"after"[\s\S]*imageUrl:\s*afterImage/);
  assert.match(styleTransferPresetLightbox, /prompt:\s*""/);
  assert.doesNotMatch(styleTransferPresetLightbox, /paramsText|imageModel/);
  assert.match(html, /id="lightboxComparison"[^>]*aria-label="风格迁移前后对比"/);
  assert.match(app, /refs\.lightbox\.classList\.toggle\("is-style-transfer-comparison",\s*Boolean\(fresh\.isStyleTransferComparisonItem\)\)/);
  assert.match(app, /renderStyleTransferLightboxComparison\(fresh\)/);
  assert.match(app, /function closeLightbox\(\) \{[\s\S]*refs\.lightbox\.classList\.remove\("is-style-transfer-comparison"\);[\s\S]*renderStyleTransferLightboxComparison\(null\);/);
  assert.match(styles, /\.lightbox\.is-style-transfer-comparison\s+\.lightbox-comparison/);
  assert.match(styles, /\.lightbox\.is-style-transfer-comparison\s+:is\(\.lightbox-meta > :not\(#lightboxClose\), \.lightbox-actions, \.lightbox-image-shell, \.lightbox-fields\)/);
  assert.match(styles, /\.lightbox\.is-style-transfer-comparison \.lightbox-dialog\s*\{[\s\S]*width:\s*min\(1560px, calc\(100vw - 32px\), 180dvh\);[\s\S]*height:\s*auto;[\s\S]*aspect-ratio:\s*1\.96 \/ 1;[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\);/);
  assert.doesNotMatch(styleTransferPresetLightbox, /canvas|toDataURL|drawImage/);
  assert.match(styles, /\.style-transfer-comparison-button\s*\{[\s\S]*cursor:\s*zoom-in;/);
  assert.match(styles, /\.style-transfer-comparison-button:hover \.style-transfer-comparison-frame/);
});

test("quick blend mode exposes independent A and B upload groups", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(html, /href="#quick-blend"[\s\S]*快速溶图/);
  assert.match(html, /data-view-panel="quick-blend"/);
  assert.match(html, /id="quickBlendAInput"[\s\S]*id="quickBlendBInput"/);
  assert.match(html, /产品图 \/ A 组/);
  assert.match(html, /上传产品图/);
  assert.match(html, /每个任务使用 1 张产品图 \+ 1 张 B 组图/);
  assert.doesNotMatch(html, /id="quickBlendAInput"[^>]*disabled/);
  assert.doesNotMatch(html, /id="quickBlendBInput"[^>]*disabled/);
  assert.doesNotMatch(html, /id="quickBlendADropzone"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html, /id="quickBlendBDropzone"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html, /上传控件将在下一步启用/);
  assert.match(html, /id="quickBlendPairList"/);
  assert.match(html, /id="quickBlendGenerateButton"/);
  assert.match(styles, /\.quick-blend-view\s*\{/);
  assert.match(
    styles,
    /\.quick-blend-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(330px,\s*0\.78fr\)\s*minmax\(460px,\s*1\.22fr\);/,
  );
  assert.match(styles, /\.quick-blend-upload-grid\s*\{/);
  assert.doesNotMatch(styles, /\.quick-blend-dropzone\.is-disabled\s*\{/);
  assert.match(styles, /\.quick-blend-pair-list\s*\{/);
  assert.match(styles, /\.quick-blend-preview-panel\s*\{[\s\S]*grid-area:\s*auto;/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.quick-blend-view \.quick-blend-preview-panel,[\s\S]*html\[data-ui-layout="mobile"\] \.quick-blend-view \.quick-blend-preview-panel\s*\{[\s\S]*grid-area:\s*auto;/,
  );
  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"image-decomposition"[\s\S]*"quick-blend"[\s\S]*"image-compress"[\s\S]*\]\);/);
  assert.match(app, /function getViewFromHash\(\) \{[\s\S]*"#quick-blend"[\s\S]*return "quick-blend";/);
  assert.match(app, /function syncHash\(view\) \{[\s\S]*view === "quick-blend"[\s\S]*"#quick-blend"/);
  assert.match(app, /state\.activeView === "studio" \|\| state\.activeView === "style-transfer" \|\| state\.activeView === "image-decomposition" \|\| state\.activeView === "quick-blend"/);
  assert.match(app, /quickBlend:\s*\{/);
  assert.match(app, /quickBlendPreviewItem:\s*null/);
  assert.match(app, /quickBlend:\s*renderQuickBlendView/);
  assert.match(app, /formatFilmstripSizeLabel,/);
  assert.match(app, /function appendQuickBlendReferencesToFormData\(formData, job\) \{/);
  assert.match(app, /formData\.set\("quickBlendPairIndex", job\.quickBlendPairIndex\);/);
  assert.doesNotMatch(app, /\brenderQuickBlendRatioGrid\(\);/);
  assert.doesNotMatch(app, /\brenderQuickBlendSizeOptions\(\);/);
  assert.match(quickBlendView, /quickBlendAInput:\s*document\.querySelector\("#quickBlendAInput"\)/);
  assert.match(quickBlendView, /quickBlendBInput:\s*document\.querySelector\("#quickBlendBInput"\)/);
  assert.match(quickBlendView, /quickBlendPairList:\s*document\.querySelector\("#quickBlendPairList"\)/);
  assert.match(quickBlendView, /quickBlendGenerateButton:\s*document\.querySelector\("#quickBlendGenerateButton"\)/);
  assert.match(quickBlendView, /function getQuickBlendPairs\(\) \{/);
  assert.match(quickBlendView, /function validateQuickBlendPairs\(\) \{/);
  assert.match(quickBlendView, /function createQuickBlendJobs\(\) \{/);
  assert.match(quickBlendView, /function renderQuickBlendRatioGrid\(\) \{/);
  assert.match(quickBlendView, /function renderQuickBlendSizeOptions\(\) \{/);
  assert.match(quickBlendView, /formatFilmstripSizeLabel\s*=\s*\(item\)\s*=>\s*String\(item\?\.size \|\| ""\),/);
  assert.match(quickBlendView, /mode:\s*"quick-blend"/);
});

test("quick blend mode implements upload pairing queue preview and cleanup contracts", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(html, /id="quickBlendAInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*multiple/);
  assert.match(html, /id="quickBlendBInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*multiple/);
  assert.match(styles, /\.quick-blend-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /\.quick-blend-grid\.is-dragover\s*\{[\s\S]*outline:\s*1px dashed/);
  const quickBlendPlaceholderRule = styles.match(/\.quick-blend-placeholder-card\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body || "";
  assert.match(quickBlendPlaceholderRule, /aspect-ratio:\s*1\s*\/\s*1;/);
  assert.match(quickBlendPlaceholderRule, /pointer-events:\s*none;/);
  assert.match(quickBlendPlaceholderRule, /border-color:\s*transparent;/);
  assert.match(quickBlendPlaceholderRule, /background:\s*transparent;/);
  assert.match(styles, /\.quick-blend-reference-card\s*\{[\s\S]*cursor:\s*grab;/);
  assert.match(styles, /\.quick-blend-reference-card\.is-dragging\s*\{[\s\S]*opacity:\s*0\.58;[\s\S]*transform:\s*scale\(0\.98\);/);
  assert.match(styles, /\.quick-blend-reference-card\s*>\s*\.reference-remove\s*\{[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;[\s\S]*z-index:\s*3;/);
  assert.match(styles, /\.quick-blend-pair-list\s*\{[\s\S]*max-height:\s*clamp\(150px,\s*19vh,\s*190px\);/);
  assert.match(styles, /\.quick-blend-pair-row\s*\{[\s\S]*min-height:\s*34px;[\s\S]*font-size:\s*0\.82rem;/);
  assert.match(styles, /\.quick-blend-generation-canvas\.has-image\s*\{[\s\S]*cursor:\s*zoom-in;/);
  assert.match(styles, /\.quick-blend-generation-thumb\.is-running\s*\{/);
  assert.match(styles, /\.quick-blend-generation-thumb\.is-running\s*\{/);
  assert.match(styles, /\.filmstrip \.generation-loading-shell\s*\{/);
  assert.match(styles, /\.filmstrip \.generation-loading-drop\s*\{/);
  assert.doesNotMatch(styles, /quick-blend-thumb-loader|quick-blend-thumb-ring|quick-blend-thumb-scan/);

  assert.match(quickBlendView, /function createQuickBlendItem\(group, file\) \{/);
  assert.match(quickBlendView, /function renderQuickBlendFeedback\(message = "", kind = ""\) \{/);
  assert.match(quickBlendView, /function setQuickBlendFeedback\(message = "", kind = ""\) \{[\s\S]*state\.quickBlend\.feedback = message;[\s\S]*state\.quickBlend\.feedbackKind = kind;[\s\S]*renderQuickBlendFeedback\(message, kind\);/);
  assert.match(quickBlendView, /id:\s*`quick-blend-\$\{group\}-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 8\)\}`/);
  assert.match(quickBlendView, /fingerprint:\s*buildReferenceFingerprint\(file\)/);
  assert.match(quickBlendView, /startQuickBlendGenerationCompression\(referenceItem\);/);
  assert.doesNotMatch(quickBlendView, /fingerprints\.has|duplicateCount|已跳过重复文件/);
  assert.match(quickBlendView, /function applyQuickBlendFiles\(group, fileList\) \{/);
  assert.match(quickBlendView, /function removeQuickBlendFile\(group, itemId\) \{/);
  assert.match(quickBlendView, /function reorderQuickBlendFile\(group, itemId, targetId = "", placement = "before"\) \{/);
  assert.match(quickBlendView, /const QUICK_BLEND_RESERVED_SLOT_COUNT = 6;/);
  assert.match(quickBlendView, /grid\.dataset\.quickBlendGroup = group;/);
  assert.match(quickBlendView, /grid\.classList\.toggle\("hidden", files\.length === 0\);[\s\S]*if \(files\.length === 0\) \{[\s\S]*return;[\s\S]*\}/);
  assert.match(quickBlendView, /while \(grid\.children\.length < QUICK_BLEND_RESERVED_SLOT_COUNT\) \{[\s\S]*placeholder\.className = "reference-card quick-blend-placeholder-card";[\s\S]*grid\.appendChild\(placeholder\);/);
  assert.match(quickBlendView, /syncReferenceDropzoneCompact\(refs\.quickBlendADropzone, state\.quickBlend\.aFiles\.length > 0\);/);
  assert.match(quickBlendView, /syncReferenceDropzoneCompact\(refs\.quickBlendBDropzone, state\.quickBlend\.bFiles\.length > 0\);/);
  assert.match(quickBlendView, /card\.draggable = true;/);
  assert.match(quickBlendView, /card\.dataset\.quickBlendId = item\.id;/);
  assert.match(quickBlendView, /previewButton\.draggable = false;/);
  assert.match(quickBlendView, /image\.draggable = false;/);
  assert.match(quickBlendView, /addEventListener\("dragstart"[\s\S]*quickBlendDragState = \{ group, itemId: item\.id \}/);
  assert.match(quickBlendView, /addEventListener\("drop"[\s\S]*reorderQuickBlendFile\(quickBlendDragState\.group, quickBlendDragState\.itemId, targetId, placement\);/);
  assert.match(quickBlendView, /function getQuickBlendPairs\(\) \{[\s\S]*Math\.max\(state\.quickBlend\.aFiles\.length, state\.quickBlend\.bFiles\.length, state\.quickBlend\.cFiles\.length, state\.quickBlend\.dFiles\.length\)[\s\S]*a:\s*state\.quickBlend\.aFiles\[index\] \|\| null[\s\S]*b:\s*state\.quickBlend\.bFiles\[index\] \|\| null[\s\S]*c:\s*state\.quickBlend\.cFiles\[index\] \|\| null[\s\S]*d:\s*state\.quickBlend\.dFiles\[index\] \|\| null/);
  assert.match(quickBlendView, /function validateQuickBlendPairs\(\) \{[\s\S]*state\.quickBlend\.aFiles\.length === 0 && state\.quickBlend\.bFiles\.length === 0[\s\S]*state\.quickBlend\.aFiles\.length === 0[\s\S]*state\.quickBlend\.bFiles\.length === 0[\s\S]*state\.quickBlend\.aFiles\.length !== state\.quickBlend\.bFiles\.length/);
  assert.match(quickBlendView, /refs\.quickBlendGenerateButton\.disabled = !validation\.ok \|\| preparingReference;/);
  assert.match(quickBlendView, /const hasStoredFeedback = Boolean\(state\.quickBlend\.feedback\);[\s\S]*const fallbackKind = validation\.ok \? "success" : "";[\s\S]*renderQuickBlendFeedback\(message, hasStoredFeedback \? state\.quickBlend\.feedbackKind \|\| fallbackKind : fallbackKind\);/);
  assert.doesNotMatch(quickBlendView, /queuedWouldOverflow|availableSlots|queueMessage/);
  assert.match(quickBlendView, /function createQuickBlendJobs\(\) \{[\s\S]*mode:\s*"quick-blend"[\s\S]*quickBlendPairIndex:\s*String\(index \+ 1\)[\s\S]*quickBlendAImageName:\s*pair\.a\.file\.name[\s\S]*quickBlendBImageName:\s*pair\.b\.file\.name[\s\S]*quickBlendAFile[\s\S]*quickBlendBFile[\s\S]*referenceFiles[\s\S]*referenceImageNames/);
  assert.match(app, /function appendQuickBlendReferencesToFormData\(formData, job\) \{[\s\S]*formData\.set\("mode", "quick-blend"\);[\s\S]*formData\.set\("quickBlendPairIndex", job\.quickBlendPairIndex\);[\s\S]*formData\.set\("quickBlendAImageName", job\.quickBlendAImageName\);[\s\S]*formData\.set\("quickBlendBImageName", job\.quickBlendBImageName\);[\s\S]*job\.referenceFiles\.forEach\(\(file\) => formData\.append\("referenceImages", file\)\);/);
  assert.match(quickBlendView, /async function startQuickBlendGeneration\(\) \{[\s\S]*const jobs = createQuickBlendJobs\(\);[\s\S]*state\.jobs\.unshift\(\.\.\.jobs\);[\s\S]*state\.quickBlend\.previewKey = makeJobPreviewKey\(jobs\[0\]\.id\);[\s\S]*jobs\.forEach\(\(job\) => recordJobQueued\(job\)\);[\s\S]*renderAll\(\);[\s\S]*setActiveView\("quick-blend"\);[\s\S]*scheduleGenerationQueue\(\);/);

  assert.match(app, /quickBlend:\s*\{[\s\S]*feedback:\s*"",[\s\S]*feedbackKind:\s*"",[\s\S]*generationKeys:/);
  assert.match(app, /function storeQuickBlendGenerationItem\(item\) \{/);
  assert.match(app, /function replaceQuickBlendGenerationKey\(oldKey, newKey\) \{/);
  assert.match(app, /function removeQuickBlendGenerationKey\(key\) \{/);
  assert.match(quickBlendView, /function getQuickBlendGenerationEntries\(\) \{/);
  assert.match(quickBlendView, /function renderQuickBlendGenerationPreview\(\) \{/);
  assert.match(quickBlendView, /function openQuickBlendGeneratedPreview\(\) \{/);
  assert.match(quickBlendView, /createGenerationLoadingShell\(document, \{ key, active: true, stage: getGenerationLoadingItemStage\(item\) \}\)/);
  assert.doesNotMatch(quickBlendView, /quick-blend-thumb-loader|formatLoadingThumbnailStatusLabel/);
  assert.match(app, /if \(canceledJob\.mode === "quick-blend"\) \{[\s\S]*removeQuickBlendGenerationKey\(makeJobPreviewKey\(canceledJob\.id\)\);/);
  assert.match(app, /if \(task\.mode === "quick-blend"\) \{[\s\S]*task\.item\.mode = "quick-blend";[\s\S]*storeQuickBlendGenerationItem\(task\.item\);[\s\S]*replaceQuickBlendGenerationKey\(taskPreviewKey, makeGalleryPreviewKey\(task\.item\.filename\)\);/);
  assert.match(app, /function setQuickBlendFeedback\(message = "", kind = ""\) \{[\s\S]*state\.quickBlend\.feedback = message;[\s\S]*state\.quickBlend\.feedbackKind = kind;/);
  assert.match(app, /const taskPreviewKey = makeJobPreviewKey\(task\.id\);[\s\S]*const wasSelectedPreview = state\.selectedPreviewKey === taskPreviewKey;[\s\S]*const wasTrackedQuickBlendJob = task\.mode === "quick-blend" && existingJobs\.has\(task\.id\);/);
  assert.match(app, /if \(task\.status === "error" && task\.mode === "quick-blend"\) \{[\s\S]*removeQuickBlendGenerationKey\(taskPreviewKey\);[\s\S]*if \(wasTrackedQuickBlendJob \|\| wasSelectedPreview\) \{[\s\S]*setQuickBlendFeedback\(task\.errorMessage \|\| "快速溶图任务失败。", "error"\);/);
  assert.match(app, /if \(job\.mode === "quick-blend"\) \{[\s\S]*payload\.item\.mode = "quick-blend";[\s\S]*storeQuickBlendGenerationItem\(payload\.item\);[\s\S]*replaceQuickBlendGenerationKey\(makeJobPreviewKey\(job\.id\), makeGalleryPreviewKey\(payload\.item\.filename\)\);/);
  assert.match(app, /if \(job\.mode === "quick-blend"\) \{[\s\S]*removeQuickBlendGenerationKey\(makeJobPreviewKey\(job\.id\)\);[\s\S]*setQuickBlendFeedback\(message, "error"\);/);
  assert.match(app, /async function deleteGalleryItem\(item\) \{[\s\S]*preserveQuickBlendGenerationItemForDelete\(item\),[\s\S]*state\.gallery = state\.gallery\.filter/);
  assert.match(app, /async function clearHistory\(\) \{[\s\S]*preserveQuickBlendGenerationItemForDelete\(item\),[\s\S]*state\.gallery = \[\];/);
});

test("quick blend generation thumbnails keep submitted pair order while completing out of order", async () => {
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");
  const registerSource = extractFunctionBefore(
    quickBlendView,
    "registerQuickBlendGenerationKey",
    "registerQuickBlendGenerationKeys",
  );
  const registerBatchSource = extractFunctionBefore(
    quickBlendView,
    "registerQuickBlendGenerationKeys",
    "replaceQuickBlendGenerationKey",
  );
  const replaceSource = extractFunctionBefore(
    quickBlendView,
    "replaceQuickBlendGenerationKey",
    "removeQuickBlendGenerationKey",
  );
  const state = { quickBlend: { generationKeys: ["file:older.png"] } };
  const { registerQuickBlendGenerationKeys, replaceQuickBlendGenerationKey } = Function(
    "state",
    `${registerBatchSource}\n${registerSource}\n${replaceSource}\nreturn { registerQuickBlendGenerationKeys, replaceQuickBlendGenerationKey };`,
  )(state);

  registerQuickBlendGenerationKeys(["job:pair-1", "job:pair-2", "job:pair-3", "job:pair-4"]);

  assert.deepEqual(state.quickBlend.generationKeys, [
    "job:pair-1",
    "job:pair-2",
    "job:pair-3",
    "job:pair-4",
    "file:older.png",
  ]);

  replaceQuickBlendGenerationKey("job:pair-2", "file:pair-2.png");
  replaceQuickBlendGenerationKey("job:pair-1", "file:pair-1.png");
  replaceQuickBlendGenerationKey("job:pair-4", "file:pair-4.png");
  replaceQuickBlendGenerationKey("job:pair-3", "file:pair-3.png");

  assert.deepEqual(state.quickBlend.generationKeys, [
    "file:pair-1.png",
    "file:pair-2.png",
    "file:pair-3.png",
    "file:pair-4.png",
    "file:older.png",
  ]);
});

test("quick blend generation thumbnails put untracked late submissions before older thumbnails", async () => {
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");
  const replaceSource = extractFunctionBefore(
    quickBlendView,
    "replaceQuickBlendGenerationKey",
    "removeQuickBlendGenerationKey",
  );
  const state = {
    quickBlend: {
      generationKeys: ["file:older-1.png", "file:older-2.png"],
    },
  };
  const { replaceQuickBlendGenerationKey } = Function(
    "state",
    `${replaceSource}\nreturn { replaceQuickBlendGenerationKey };`,
  )(state);

  replaceQuickBlendGenerationKey("job:lost-latest", "file:latest.png");

  assert.deepEqual(state.quickBlend.generationKeys, [
    "file:latest.png",
    "file:older-1.png",
    "file:older-2.png",
  ]);
});

test("quick blend generation entries sort thumbnails by generated time descending", async () => {
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");
  const getItemSource = extractFunctionBefore(
    quickBlendView,
    "getQuickBlendGenerationItemByKey",
    "storeQuickBlendGenerationItem",
  );
  const getEntriesSource = extractFunctionBefore(
    quickBlendView,
    "getQuickBlendGenerationEntries",
    "syncQuickBlendGenerationPreviewKey",
  );
  const state = {
    quickBlend: {
      generationKeys: ["file:older.png", "file:latest.png", "file:middle.png"],
      generationItems: {
        "file:older.png": { filename: "older.png", mode: "quick-blend", createdAt: "2026-06-08T18:33:44.000Z" },
        "file:latest.png": { filename: "latest.png", mode: "quick-blend", createdAt: "2026-06-08T18:47:54.000Z" },
        "file:middle.png": { filename: "middle.png", mode: "quick-blend", createdAt: "2026-06-08T18:37:48.000Z" },
      },
    },
    jobs: [],
    gallery: [],
  };
  const makeJobPreviewKey = (jobId) => `job:${jobId}`;
  const makeGalleryPreviewKey = (filename) => `file:${filename}`;
  const sortGalleryItemsByCreatedAtDesc = (items) =>
    [...items].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const { getQuickBlendGenerationEntries } = Function(
    "state",
    "makeJobPreviewKey",
    "makeGalleryPreviewKey",
    "sortGalleryItemsByCreatedAtDesc",
    `${getItemSource}\n${getEntriesSource}\nreturn { getQuickBlendGenerationEntries };`,
  )(state, makeJobPreviewKey, makeGalleryPreviewKey, sortGalleryItemsByCreatedAtDesc);

  assert.deepEqual(
    getQuickBlendGenerationEntries().map((entry) => entry.key),
    ["file:latest.png", "file:middle.png", "file:older.png"],
  );
});

test("quick blend generation thumbnail captions prefer generated time over pair labels", async () => {
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(
    quickBlendView,
    /caption\.textContent = formatClock\(item\?\.createdAt\) \|\| item\?\.statusText \|\| formatFilmstripSizeLabel\(item\);/,
  );
  assert.doesNotMatch(quickBlendView, /caption\.textContent = item\?\.quickBlendPairIndex/);
});

test("quick blend pair preview can remove the same index across all reference groups", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(quickBlendView, /function removeQuickBlendPair\(pairIndex\) \{/);
  assert.match(
    quickBlendView,
    /for \(const group of QUICK_BLEND_GROUPS\) \{[\s\S]*const \[removedItem\] = next\.splice\(normalizedIndex, 1\);[\s\S]*state\.quickBlend\[key\] = next;/,
  );
  assert.match(
    quickBlendView,
    /const removeButton = document\.createElement\("button"\);[\s\S]*removeButton\.className = "quick-blend-pair-remove";[\s\S]*removeButton\.dataset\.quickBlendPairRemoveIndex = String\(pair\.index\);[\s\S]*removeButton\.addEventListener\("click", \(\) => removeQuickBlendPair\(pair\.index\)\);/,
  );
  assert.match(
    styles,
    /\.quick-blend-pair-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(var\(--quick-blend-pair-groups,\s*2\), auto minmax\(0,\s*1fr\)\) auto;/,
  );
  assert.match(styles, /\.quick-blend-pair-remove\s*\{[\s\S]*width:\s*28px;[\s\S]*height:\s*28px;[\s\S]*border-radius:\s*999px;/);
});

test("quick blend upload groups expose per-group clear image controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  for (const group of ["A", "B", "C", "D"]) {
    assert.match(
      html,
      new RegExp(`id="quickBlend${group}ClearButton"[\\s\\S]*type="button"[\\s\\S]*data-quick-blend-clear-group="${group.toLowerCase()}"[\\s\\S]*清空图片`),
    );
    assert.match(quickBlendView, new RegExp(`quickBlend${group}ClearButton:\\s*document\\.querySelector\\("#quickBlend${group}ClearButton"\\)`));
    assert.match(quickBlendView, new RegExp(`refs\\.quickBlend${group}ClearButton\\?\\.addEventListener\\("click", \\(\\) => clearQuickBlendGroup\\("${group.toLowerCase()}"\\)\\);`));
  }

  assert.match(quickBlendView, /function clearQuickBlendGroup\(group\) \{/);
  assert.match(
    quickBlendView,
    /for \(const item of files\) \{[\s\S]*revokeReferencePreview\(item\);[\s\S]*state\.quickBlend\[key\] = \[\];/,
  );
  assert.match(quickBlendView, /button\.disabled = files\.length === 0;/);
  assert.match(styles, /\.quick-blend-clear-button\s*\{[\s\S]*min-height:\s*28px;[\s\S]*border-radius:\s*999px;/);
});

test("quick blend upload groups keep the first pending upload slot full size", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(
    styles,
    /\.quick-blend-upload-group:has\(\.quick-blend-grid\.hidden\) \.quick-blend-dropzone\s*\{[\s\S]*min-height:\s*clamp\(220px,\s*30vh,\s*320px\);/,
  );
  assert.match(styles, /\.quick-blend-grid\s*\{[\s\S]*min-height:\s*clamp\(220px,\s*30vh,\s*320px\);/);
  assert.match(
    quickBlendView,
    /grid\.classList\.toggle\("hidden", files\.length === 0\);[\s\S]*if \(files\.length === 0\) \{[\s\S]*return;[\s\S]*\}/,
  );
  assert.match(quickBlendView, /syncReferenceDropzoneCompact\(refs\.quickBlendADropzone, state\.quickBlend\.aFiles\.length > 0\);/);
  assert.match(quickBlendView, /syncReferenceDropzoneCompact\(refs\.quickBlendBDropzone, state\.quickBlend\.bFiles\.length > 0\);/);
  assert.match(quickBlendView, /syncReferenceDropzoneCompact\(refs\.quickBlendCDropzone, state\.quickBlend\.cFiles\.length > 0\);/);
  assert.match(quickBlendView, /syncReferenceDropzoneCompact\(refs\.quickBlendDDropzone, state\.quickBlend\.dFiles\.length > 0\);/);
});

test("quick blend mode supports optional C/D groups and layout metadata", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(html, /id="quickBlendCInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*multiple/);
  assert.match(html, /id="quickBlendDInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*multiple/);
  assert.match(html, /id="quickBlendLayoutOrderInput"/);
  assert.match(html, /id="quickBlendPlacementShapeInput"/);
  assert.match(html, /<span>队形<\/span>[\s\S]*id="quickBlendPlacementShapeInput"[\s\S]*<option value="square">正方形排序<\/option>[\s\S]*<option value="rectangle">矩形排序<\/option>/);
  assert.doesNotMatch(html, /<span>区域<\/span>[\s\S]*id="quickBlendPlacementShapeInput"/);
  assert.match(app, /quickBlend:\s*\{[\s\S]*cFiles:\s*\[\],[\s\S]*dFiles:\s*\[\],[\s\S]*layoutOrder:\s*"vertical",[\s\S]*placementShape:\s*"square"/);

  assert.match(quickBlendView, /quickBlendCInput:\s*document\.querySelector\("#quickBlendCInput"\)/);
  assert.match(quickBlendView, /quickBlendDInput:\s*document\.querySelector\("#quickBlendDInput"\)/);
  assert.match(quickBlendView, /quickBlendLayoutOrderInput:\s*document\.querySelector\("#quickBlendLayoutOrderInput"\)/);
  assert.match(quickBlendView, /quickBlendPlacementShapeInput:\s*document\.querySelector\("#quickBlendPlacementShapeInput"\)/);
  assert.match(quickBlendView, /function getEnabledQuickBlendOptionalGroups\(\) \{/);
  assert.match(quickBlendView, /function getQuickBlendPairGroups\(\) \{/);
  assert.match(quickBlendView, /function syncQuickBlendLayoutOptions\(\) \{/);
  assert.match(quickBlendView, /quickBlendCImageName:\s*pair\.c\?\.file\?\.name \|\| ""/);
  assert.match(quickBlendView, /quickBlendDImageName:\s*pair\.d\?\.file\?\.name \|\| ""/);
  assert.match(quickBlendView, /quickBlendLayoutOrder:\s*state\.quickBlend\.layoutOrder/);
  assert.match(quickBlendView, /quickBlendPlacementShape:\s*state\.quickBlend\.placementShape/);
  assert.match(quickBlendView, /referenceFiles:\s*\[getQuickBlendGenerationFile\(pair\.a\), getQuickBlendGenerationFile\(pair\.b\), getQuickBlendGenerationFile\(pair\.c\), getQuickBlendGenerationFile\(pair\.d\)\]\.filter\(Boolean\)/);

  assert.match(app, /formData\.set\("quickBlendCImageName", job\.quickBlendCImageName \|\| ""\);/);
  assert.match(app, /formData\.set\("quickBlendDImageName", job\.quickBlendDImageName \|\| ""\);/);
  assert.match(app, /formData\.set\("quickBlendLayoutOrder", job\.quickBlendLayoutOrder \|\| "vertical"\);/);
  assert.match(app, /formData\.set\("quickBlendPlacementShape", job\.quickBlendPlacementShape \|\| "square"\);/);
  assert.match(app, /job\.referenceFiles\.forEach\(\(file\) => formData\.append\("referenceImages", file\)\);/);
});

test("quick blend defaults to square output and reads shared generation controls safely", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const quickBlendView = await readFile(quickBlendViewPath, "utf8");

  assert.match(app, /const DEFAULT_QUICK_BLEND_RATIO = "1:1";/);
  assert.match(html, /id="quickBlendRatioInput" type="hidden" value="1:1"/);
  assert.match(quickBlendView, /const DEFAULT_QUICK_BLEND_RATIO_VALUE = "1:1";/);

  assert.match(quickBlendView, /baseUrlInput:\s*document\.querySelector\("#baseUrlInput"\)/);
  assert.match(quickBlendView, /outputFormatInput:\s*document\.querySelector\("#outputFormatInput"\)/);
  assert.match(quickBlendView, /reasoningEffortInput:\s*document\.querySelector\("#reasoningEffortInput"\)/);
  assert.match(quickBlendView, /responsesModelInput:\s*document\.querySelector\("#responsesModelInput"\)/);
  assert.doesNotMatch(quickBlendView, /document\.querySelector\("#baseUrl"\)/);
  assert.doesNotMatch(quickBlendView, /document\.querySelector\("#outputFormat"\)/);
  assert.doesNotMatch(quickBlendView, /document\.querySelector\("#reasoningEffort"\)/);
  assert.doesNotMatch(quickBlendView, /document\.querySelector\("#responsesModel"\)/);

  assert.match(quickBlendView, /const baseUrlValue = String\(state\.config\?\.baseUrl \|\| refs\.baseUrlInput\?\.value \|\| ""\)\.trim\(\);/);
  assert.match(quickBlendView, /const responsesModelValue = String\(state\.config\?\.responsesModel \|\| refs\.responsesModelInput\?\.value \|\| DEFAULT_RESPONSES_MODEL\)\.trim\(\);/);
  assert.match(quickBlendView, /refs\.quickBlendRatioInput\?\.value \|\| DEFAULT_QUICK_BLEND_RATIO/);
  assert.match(quickBlendView, /refs\.quickBlendSizeInput\?\.value \|\| "auto"/);
});

test("style transfer mode keeps the shared studio height sync and mode styling hooks", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(app, /studioView:\s*document\.querySelector\("\.studio-view"\),/);
  assert.match(app, /if \(refs\.studioView\) \{[\s\S]*refs\.studioView\.dataset\.studioMode = nextMode;[\s\S]*\}/);
  assert.match(app, /const isStudioLikeView =[\s\S]*state\.activeView === "studio" \|\| state\.activeView === "style-transfer" \|\| state\.activeView === "image-decomposition" \|\| state\.activeView === "quick-blend";/);
  assert.match(app, /if \(STACKED_STUDIO_LAYOUT_MODES\.has\(getCurrentStudioLayoutMode\(\)\) \|\| !isStudioLikeView\) \{/);
  assert.doesNotMatch(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.studio-grid\s*\{[\s\S]*--studio-grid-left:/);
  assert.doesNotMatch(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.studio-grid\s*\{[\s\S]*--studio-grid-gap:/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-upload-grid \{/);
});

test("style transfer panel aligns slot rows and clips its own background", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-block \{[\s\S]*box-sizing:\s*border-box;[\s\S]*overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot \{[\s\S]*grid-template-rows:\s*minmax\(132px,\s*auto\);/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-dropzone \{[\s\S]*min-height:\s*132px;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot:has\(\.style-transfer-grid:not\(\.hidden\)\) \{[\s\S]*grid-template-rows:\s*minmax\(132px,\s*auto\);/,
  );
  assert.doesNotMatch(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot \.field-head/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.nav-flyout\.mega-menu,[\s\S]*html\[data-ui-layout="mobile"\] \.nav-item\[data-nav-section="settings"\] \.nav-flyout\.mega-menu\s*\{[\s\S]*position:\s*fixed;[\s\S]*left:\s*10px;[\s\S]*right:\s*10px;[\s\S]*max-height:\s*calc\(100dvh - 112px\);/,
  );
});

test("style transfer generation builds a preservation prompt and submits both images as references", async () => {
  const app = await readFile(appPath, "utf8");
  const server = await readFile(serverPath, "utf8");

  assert.match(app, /function buildStyleTransferPrompt\(\) \{/);
  assert.match(app, /Use the first reference image as the source image/);
  assert.match(app, /preserve every visible subject, object, pose, layout, composition, spatial relationship/);
  assert.match(app, /Use the second reference image only as the style reference/);
  assert.match(app, /The second reference image is the style authority/);
  assert.match(app, /Do not keep anime, cartoon, comic, cel-shaded, line-art, CGI doll, or illustration residue/);
  assert.match(app, /function createStyleTransferJob\(\) \{/);
  assert.match(app, /mode:\s*"style-transfer"/);
  assert.match(app, /referenceFiles:\s*getStyleTransferReferenceFiles\(\)/);
  assert.match(app, /function appendStyleTransferReferencesToFormData\(formData, job\) \{/);
  assert.match(app, /formData\.set\("mode", "style-transfer"\);/);
  assert.match(app, /formData\.set\("styleTransferSourceImageName", job\.styleTransferSourceImageName\);/);
  assert.match(app, /formData\.set\("styleTransferReferenceImageName", job\.styleTransferReferenceImageName\);/);
  assert.match(app, /job\.referenceFiles\.forEach\(\(file\) => \{[\s\S]*formData\.append\("referenceImages", file\);/);
  assert.match(
    app,
    /startGeneration[\s\S]*if \(state\.studioMode === "style-transfer"\) \{[\s\S]*await ensureStyleTransferGenerationFilesReady\(\);[\s\S]*const job = createStyleTransferJob\(\);/,
  );
  assert.match(server, /buildGenerationReferenceImageLabels/);
  assert.match(server, /getStyleTransferReferenceImageLabels\(generationMode,\s*styleTransferStylePreset,\s*referenceImages = \[\],\s*options = \{\}\)/);
});

test("reference analysis generation uploads prepared reference images", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getReferenceAnalysisGenerationFile\(item\) \{/);
  assert.match(app, /function startReferenceAnalysisGenerationCompression\(item\) \{/);
  assert.match(app, /function ensureReferenceAnalysisGenerationFilesReady\(\) \{/);
  assert.match(
    app,
    /function createReferenceAnalysisJob\(\) \{[\s\S]*const referenceFiles = state\.referenceAnalysis\.files\.map\(getReferenceAnalysisGenerationFile\)\.filter\(Boolean\);/,
  );
  assert.match(
    app,
    /startReferenceAnalysisGeneration[\s\S]*await ensureReferenceAnalysisGenerationFilesReady\(\);[\s\S]*const job = createReferenceAnalysisJob\(\);/,
  );
  assert.doesNotMatch(
    app,
    /const referenceFiles = state\.referenceAnalysis\.files\.map\(\(item\) => item\.file\)\.filter\(Boolean\);/,
  );
});

test("reference analysis generation applies selected output language", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const server = await readFile(serverPath, "utf8");

  assert.match(
    html,
    /<span>输出语言<\/span>[\s\S]*<select id="referenceAnalysisLanguageInput" name="targetLanguage">[\s\S]*<option value="zh-CN" selected>简体中文<\/option>[\s\S]*<option value="en">English<\/option>/,
  );
  assert.match(app, /normalizeReferenceAnalysisLanguage,/);
  assert.doesNotMatch(app, /appendReferenceAnalysisLanguageInstruction/);
  assert.match(app, /outputLanguage:\s*"zh-CN"/);
  assert.match(app, /referenceAnalysisLanguageInput:\s*document\.querySelector\("#referenceAnalysisLanguageInput"\),/);
  assert.match(app, /function getReferenceAnalysisSelectedLanguage\(\) \{/);
  assert.match(
    app,
    /function createReferenceAnalysisJob\(\) \{[\s\S]*const targetLanguage = getReferenceAnalysisSelectedLanguage\(\);[\s\S]*prompt:\s*String\(state\.referenceAnalysis\.selectedPrompt \|\| ""\)\.trim\(\),[\s\S]*targetLanguage:\s*targetLanguage\.value,[\s\S]*targetLanguageLabel:\s*targetLanguage\.label,/,
  );
  assert.match(
    app,
    /function buildGenerationFormData\(job\) \{[\s\S]*if \(job\.targetLanguage\) \{[\s\S]*formData\.set\("targetLanguage", job\.targetLanguage\);[\s\S]*formData\.set\("targetLanguageLabel", job\.targetLanguageLabel \|\| job\.targetLanguage\);/,
  );
  assert.match(
    server,
    /appendReferenceAnalysisLanguageInstruction\(prompt,\s*targetLanguageInput,\s*targetLanguageLabelInput\)/,
  );
});

test("reference analysis generation mode survives task polling snapshots", async () => {
  const app = await readFile(appPath, "utf8");
  const server = await readFile(serverPath, "utf8");

  const formDataBody = app.match(/function buildGenerationFormData\(job\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(formDataBody, /if \(job\.mode\) \{[\s\S]*formData\.set\("mode", job\.mode\);[\s\S]*\}/);

  assert.match(server, /const GENERATION_MODES = new Set\(\[[\s\S]*"style-transfer"[\s\S]*"reference-analysis"[\s\S]*IMAGE_DECOMPOSITION_MODE[\s\S]*\]\);/);
  assert.match(server, /function normalizeGenerationMode\(value\) \{[\s\S]*GENERATION_MODES\.has\(mode\) \? mode : "";/);
  assert.match(server, /generationTaskStore\.upsertTask\(clientSessionId,[\s\S]*mode:\s*generationMode,/);

  const applySnapshotsBody = app.match(/function applyGenerationTaskSnapshots\(tasks, \{ render = true \} = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(applySnapshotsBody, /const existingJobs = new Map\(state\.jobs\.map\(\(job\) => \[job\.id, job\]\)\);/);
  assert.match(applySnapshotsBody, /mode:\s*snapshot\.mode \|\| existing\?\.mode \|\| "",/);
});

test("generation form data freezes the current route and model when the job is queued", async () => {
  const app = await readFile(appPath, "utf8");
  const server = await readFile(serverPath, "utf8");
  const formDataBody = app.match(/function buildGenerationFormData\(job\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(app, /function getCurrentPrivateConfigRequestPayload\(\) \{[\s\S]*imageRoute:\s*getSelectedImageRoute\(\)/);
  assert.match(app, /protocolBaseUrl:\s*refs\.protocolBaseUrlInput\.value\.trim\(\) \|\| browserPayload\.protocolBaseUrl/);
  assert.match(app, /protocolApiKey:\s*refs\.protocolApiKeyInput\.value\.trim\(\) \|\| browserPayload\.protocolApiKey/);
  assert.match(app, /protocolImageModel:\s*refs\.protocolImageModelInput\.value\.trim\(\) \|\| browserPayload\.protocolImageModel/);
  assert.match(
    app,
    /function appendCurrentConfigToFormData\(formData\) \{[\s\S]*appendBrowserConfigToFormData\(formData, undefined, getCurrentPrivateConfigRequestPayload\(\)\);/,
  );
  assert.match(app, /function recordJobQueued\(job\) \{[\s\S]*applyQueuedJobConfigSnapshot\(job\);/);
  assert.match(formDataBody, /appendJobConfigToFormData\(formData, job\);/);
  assert.doesNotMatch(formDataBody, /appendCurrentConfigToFormData\(formData\);/);
  assert.doesNotMatch(formDataBody, /appendBrowserConfigToFormData\(formData\);/);
  assert.match(server, /requestModelProtocolImageGeneration/);
  assert.match(server, /if \(options\.imageRoute === IMAGE_ROUTE_C\) \{[\s\S]*return requestModelProtocolImageGeneration\(options\);/);
});

test("generation size controls switch to protocol scale values in model protocol mode", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /getModelProtocolImageSizeOptions,/);
  assert.match(app, /normalizeModelProtocolImageSize/);
  assert.match(app, /function isModelProtocolImageRoute\(\)/);
  assert.match(app, /function renderSizeOptions\(sizeInput = refs\.sizeInput, ratioInput = refs\.ratioInput\) \{[\s\S]*getModelProtocolImageSizeOptions\(\)/);
  assert.match(app, /function getSelectedGenerationSize\(\) \{[\s\S]*normalizeModelProtocolImageSize\(refs\.sizeInput\.value \|\| "auto"\)/);
  assert.match(app, /refs\.imageRouteInputs\.forEach\(\(input\) => input\.addEventListener\("change", \(\) => \{[\s\S]*renderSizeOptions\(\);[\s\S]*\}\)\);/);
});

test("prompt field can start generation with Ctrl+Enter", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="generateButton"[\s\S]*aria-keyshortcuts="Control\+Enter"/);
  assert.match(app, /function isStartGenerationShortcut\(event\) \{[\s\S]*event\.ctrlKey[\s\S]*event\.key === "Enter"/);
  assert.match(app, /function handlePromptGenerationShortcut\(event\) \{[\s\S]*isStartGenerationShortcut\(event\)[\s\S]*event\.preventDefault\(\);[\s\S]*refs\.generateButton\.click\(\);/);
  assert.match(app, /refs\.promptInput\.addEventListener\("keydown", handlePromptGenerationShortcut\);/);
});

test("prompt mode exposes optional enhancement text and appends it to submitted prompts", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const defaultEnhancePrompt =
    ",sharp focus, macro details, rich textures, crisp edges, photorealistic texture, visible grain, detailed surface material, cinematic lighting";

  assert.match(html, /id="promptEnhanceToggle"[\s\S]*role="switch"[\s\S]*aria-checked="false"/);
  assert.match(html, /id="promptEnhanceInput"/);
  assert.ok(html.includes(defaultEnhancePrompt));
  assert.match(styles, /\.prompt-enhance-panel\s*\{/);
  assert.match(styles, /\.prompt-enhance-toggle\.is-active[\s\S]*\.prompt-enhance-switch-track/);
  assert.match(app, /const DEFAULT_PROMPT_ENHANCE_TEXT = ",sharp focus, macro details, rich textures, crisp edges, photorealistic texture, visible grain, detailed surface material, cinematic lighting";/);
  assert.match(app, /promptEnhanceEnabled:\s*false/);
  assert.match(app, /promptEnhanceToggle:\s*document\.querySelector\("#promptEnhanceToggle"\)/);
  assert.match(app, /function buildPromptModePrompt\(\) \{[\s\S]*state\.promptEnhanceEnabled[\s\S]*refs\.promptEnhanceInput/);
  assert.match(app, /prompt:\s*buildPromptModePrompt\(\),/);
  assert.match(app, /refs\.promptEnhanceToggle\.addEventListener\("click", togglePromptEnhanceMode\);/);
  assert.match(app, /refs\.promptEnhanceInput\.addEventListener\("keydown", handlePromptGenerationShortcut\);/);
});

test("studio rendering preserves the settings form scroll position during generation updates", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getSettingsFormScrollTop\(\) \{[\s\S]*refs\.generateForm\.scrollTop/);
  assert.match(app, /function restoreSettingsFormScrollTop\(scrollTop\) \{[\s\S]*refs\.generateForm\.scrollTop = scrollTop;[\s\S]*window\.requestAnimationFrame\(restore\);/);
  assert.match(app, /function renderAll\(\) \{[\s\S]*const settingsScrollTop = getSettingsFormScrollTop\(\);[\s\S]*restoreSettingsFormScrollTop\(settingsScrollTop\);[\s\S]*\}/);
  assert.match(app, /function syncStudioHeight\(\) \{[\s\S]*const settingsScrollTop = getSettingsFormScrollTop\(\);[\s\S]*restoreSettingsFormScrollTop\(settingsScrollTop\);[\s\S]*\}/);
});

test("generation loading shell renders one shared percentage drop", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  assert.match(app, /createGenerationLoadingShell\(document, \{ active: false \}\)/);
  assert.match(app, /updateGenerationLoadingShell\(nodes\.loading,[\s\S]*active: true/);
  assert.match(styles, /\.generation-loading-shell\s*\{/);
  assert.match(styles, /\.generation-loading-drop\s*\{[\s\S]*linear-gradient/);
  assert.match(styles, /\.generation-loading-drop::after\s*\{[\s\S]*height:\s*var\(--generation-loading-progress\)/);
  assert.match(styles, /@keyframes generation-loading-water-flow/);
  assert.doesNotMatch(styles, /conic-gradient/);
  assert.match(styles, /\.generation-loading-percent\s*\{/);
  assert.match(styles, /@keyframes generation-loading-breathe/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.generation-loading-drop[\s\S]*animation:\s*none;/);
  assert.doesNotMatch(app, /createPreviewMotionNode|preview-loading-orb-field|preview-loading-fluid/);
  assert.doesNotMatch(styles, /preview-loading-orb-field|preview-loading-fluid|preview-loading-ring-line|preview-loading-fill\s*\{/);
});

test("studio panels start without redundant title blocks and merge parameters under ratio controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const promptParameterSettings = html.match(/<details[\s\S]*class="field-group parameter-settings adaptive-section"[\s\S]*?(?=<\/form>)/)?.[0] || "";

  assert.match(html, /<details[\s\S]*class="field-group parameter-settings adaptive-section"[\s\S]*id="parameterAdaptiveSection"[\s\S]*<div class="ratio-grid" id="ratioGrid"><\/div>[\s\S]*<div class="advanced-content">/);
  assert.match(styles, /\.parameter-settings > \.ratio-grid\s*\{[\s\S]*margin-bottom:\s*calc\(var\(--field-gap,\s*6px\) \+ 2px\);/);
  assert.doesNotMatch(promptParameterSettings, /<small>Parameters<\/small>/);
  assert.match(html, /<details[\s\S]*class="field-group parameter-settings adaptive-section"[\s\S]*<label class="compact-field">[\s\S]*<span data-ui-i18n="reasoningEffort">思考等级<\/span>[\s\S]*id="reasoningEffortInput"[\s\S]*<label class="compact-field">[\s\S]*id="sizeInput"[\s\S]*<label class="compact-field">[\s\S]*id="outputFormatInput"/);
  assert.match(app, /const REASONING_LABELS = \{[\s\S]*low: "Low",[\s\S]*medium: "Medium",[\s\S]*high: "High",[\s\S]*xhigh: "XHigh",[\s\S]*\};/);
  assert.match(app, /const REASONING_ESTIMATES = \{[\s\S]*low: "30s\+",[\s\S]*medium: "90s\+",[\s\S]*high: "150s\+",[\s\S]*xhigh: "210s\+",[\s\S]*\};/);
  assert.match(app, /option\.textContent = estimate \? `\$\{label\} ~\$\{estimate\}` : label;/);
  assert.match(html, /<div class="advanced-controls">[\s\S]*<label class="compact-field">[\s\S]*<span data-ui-i18n="outputFormat">输出格式<\/span>[\s\S]*<\/label>[\s\S]*<div class="parameter-meta" aria-label="工具模型与质量" data-ui-i18n-aria-label="toolModelAndQuality">[\s\S]*<span data-ui-i18n="toolModel">工具模型<\/span>[\s\S]*<strong>gpt-image-2<\/strong>[\s\S]*<span data-ui-i18n="quality">质量<\/span>[\s\S]*<strong>High<\/strong>[\s\S]*<\/div>[\s\S]*<\/div>/);
  assert.doesNotMatch(html, /<p>工具模型：/);
  assert.doesNotMatch(html, /<p>质量：/);
  assert.doesNotMatch(html, /<details class="advanced-box"/);
  assert.doesNotMatch(html, /<summary>高级选项/);
  assert.doesNotMatch(promptParameterSettings, />\s*比例\s*</);
  assert.doesNotMatch(html, /<h2>生成设置<\/h2>/);
  assert.doesNotMatch(html, /<h2>生成结果<\/h2>/);
  assert.doesNotMatch(html, /外层模型：/);
  assert.doesNotMatch(html, /中转地址：/);
  assert.doesNotMatch(html, /id="advancedResponsesModel"/);
  assert.doesNotMatch(html, /id="advancedBaseUrl"/);
  assert.doesNotMatch(app, /advancedResponsesModel/);
  assert.doesNotMatch(app, /advancedBaseUrl/);
});

test("ratio picker renders every configured aspect ratio instead of a featured subset", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /function getVisibleRatios\(\) \{[\s\S]*return \[\.\.\.state\.aspectRatios\];[\s\S]*\}/);
  assert.match(app, /const RATIO_ORIENTATION_LABELS = \{[\s\S]*landscape: "\\u6a2a\\u5411",[\s\S]*portrait: "\\u7ad6\\u5411",[\s\S]*square: "\\u65b9\\u5f62",[\s\S]*\};/);
  assert.match(app, /function getRatioOrientationLabel\(orientation\) \{[\s\S]*return RATIO_ORIENTATION_LABELS\[orientation\] \|\| RATIO_ORIENTATION_LABELS\.square;[\s\S]*\}/);
  assert.doesNotMatch(app, /FEATURED_RATIOS/);
  assert.doesNotMatch(app, /state\.aspectRatios\.slice\(0,\s*5\)/);
  assert.doesNotMatch(app, /subtitle\.textContent = option\.label/);
  assert.doesNotMatch(app, /button\.appendChild\(subtitle\)/);
  assert.match(html, /<summary class="field-heading adaptive-section-summary">[\s\S]*<span data-ui-i18n="parameters">参数设置<\/span>[\s\S]*<span class="ratio-orientation-summary" id="ratioOrientationSummary" aria-live="polite"><\/span>[\s\S]*<\/summary>/);
  assert.match(app, /ratioOrientationSummary:\s*document\.querySelector\("#ratioOrientationSummary"\)/);
  assert.match(app, /function syncRatioOrientationSummary\(\) \{[\s\S]*const ratioOption = getRatioOption\(refs\.ratioInput\.value \|\| DEFAULT_UI_RATIO\);[\s\S]*refs\.ratioOrientationSummary\.textContent = getUiRatioLabel\(ratioOption\);[\s\S]*refs\.ratioOrientationSummary\.dataset\.orientation = ratioOption\?\.orientation \|\| "square";[\s\S]*\}/);
  assert.match(app, /syncGenerationRatio\(value\) \{[\s\S]*renderRatioGrid\(\);[\s\S]*syncRatioOrientationSummary\(\);[\s\S]*renderReferenceAnalysisRatioGrid\(\);/);
  assert.match(app, /const orientationLabel = getUiRatioOrientationLabel\(option\.orientation\);[\s\S]*button\.dataset\.orientation = option\.orientation \|\| "square";[\s\S]*button\.setAttribute\("aria-label", getUiRatioLabel\(option\) \|\| `\$\{option\.value\} \$\{orientationLabel\}`\);/);
  assert.doesNotMatch(app, /orientationBubble/);
  assert.doesNotMatch(styles, /\.ratio-chip span\s*\{/);
  assert.match(
    styles,
    /\.ratio-orientation-summary\s*\{[\s\S]*margin-left:\s*auto;[\s\S]*border-radius:\s*999px;[\s\S]*text-shadow:\s*0 0 12px rgba\(119,\s*255,\s*214,\s*0\.58\);/,
  );
  assert.match(styles, /\.field-heading \.ratio-orientation-summary\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*font-size:\s*11px;[\s\S]*font-weight:\s*800;/);
  assert.match(styles, /\.ratio-orientation-summary\[data-orientation="landscape"\]\s*\{[\s\S]*color:\s*#a8ffdf;/);
  assert.match(styles, /\.ratio-orientation-summary\[data-orientation="portrait"\]\s*\{[\s\S]*color:\s*#b8f7ff;/);
  assert.doesNotMatch(styles, /\.ratio-chip-orientation/);
});

test("studio output format can be selected as png or jpg", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<span data-ui-i18n="outputFormat">输出格式<\/span>[\s\S]*<select id="outputFormatInput" name="format"><\/select>/);
  assert.match(app, /getOutputFormatOptions,[\s\S]*normalizeOutputFormat,/);
  assert.match(app, /outputFormatInput: document\.querySelector\("#outputFormatInput"\)/);
  assert.match(app, /function renderOutputFormatOptions\(\) \{[\s\S]*getOutputFormatOptions\(\)\.forEach/);
  assert.match(app, /format: normalizeOutputFormat\(refs\.outputFormatInput\.value/);
  assert.match(app, /formData\.set\("format", job\.format\);/);
});

test("prompt agent opens from global navigation without adding another view tab", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /data-nav-action="prompt-agent"[\s\S]*图片转提示词/);
  assert.match(html, /<div class="topbar-ghost-actions">[\s\S]*id="openPromptAgentButton"/);
  assert.doesNotMatch(html, /<div class="topbar-ghost-actions"[^>]*aria-hidden="true"/);
  assert.match(styles, /\.topbar-ghost-actions\s*\{[\s\S]*display:\s*none;/);
  assert.match(html, /<aside class="prompt-agent-modal hidden" id="promptAgentModal"/);
  assert.match(html, /id="promptAgentHistoryList"/);
  assert.doesNotMatch(html, /data-view-tab="prompt-agent"/);
  assert.match(styles, /\.prompt-agent-modal\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(app, /fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(app, /refs\.promptInput\.value = promptText;/);
  assert.match(app, /loadPromptAgentHistory/);
});

test("top navigation groups functions into an Apple-style global mega menu", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const createMenu = html.match(/data-nav-section="create"[\s\S]*?(?=<div class="nav-item" data-nav-section="assets")/)?.[0] || "";
  const assetsMenu = html.match(/data-nav-section="assets"[\s\S]*?(?=<div class="nav-item" data-nav-section="settings")/)?.[0] || "";
  const settingsMenu = html.match(/data-nav-section="settings"[\s\S]*?(?=<\/div>\s*<\/nav>)/)?.[0] || "";

  assert.match(html, /<nav class="primary-nav global-nav" aria-label="全局导航" data-ui-i18n-aria-label="globalNav">/);
  assert.doesNotMatch(html, /nav-region-label/);
  assert.doesNotMatch(html, />主区</);
  assert.match(html, /<div class="view-tabs global-nav-list" aria-label="功能菜单导航" data-ui-i18n-aria-label="functionMenu">/);
  assert.match(html, /data-nav-section="create"[\s\S]*data-nav-menu="create"[\s\S]*aria-haspopup="true"[\s\S]*aria-expanded="false"[\s\S]*<span class="nav-tab-label" data-ui-i18n="navCreate">创作<\/span>[\s\S]*<span class="nav-tab-note">Studio<\/span>/);
  assert.doesNotMatch(html, /data-nav-section="present"/);
  assert.doesNotMatch(html, /data-view-tab="ppt"/);
  assert.match(html, /data-nav-section="assets"[\s\S]*data-nav-menu="assets"[\s\S]*aria-haspopup="true"[\s\S]*aria-expanded="false"[\s\S]*<span class="nav-tab-label" data-ui-i18n="navAssets">资产<\/span>[\s\S]*<span class="nav-tab-note">Gallery<\/span>/);
  assert.doesNotMatch(html, /data-nav-section="records"/);
  assert.doesNotMatch(html, /data-view-tab="ppt-record"/);
  assert.match(html, /data-nav-section="settings"[\s\S]*data-nav-menu="settings"[\s\S]*aria-haspopup="true"[\s\S]*aria-expanded="false"[\s\S]*<span class="nav-tab-label" data-ui-i18n="navSettings">配置<\/span>[\s\S]*<span class="nav-tab-note">Settings<\/span>/);
  assert.doesNotMatch(html, /<button class="view-tab[^>]*(data-view-tab|data-nav-action)=/);
  assert.match(createMenu, /href="#studio"[\s\S]*提示词生图/);
  assert.match(createMenu, /href="#creation"[\s\S]*套图模式/);
  assert.match(createMenu, /href="#ppt"[\s\S]*PPT生成/);
  assert.match(createMenu, /data-nav-action="prompt-agent"[\s\S]*图片转提示词/);
  assert.doesNotMatch(createMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="output"|瀑布画廊|套图记录|PPT记录|参数与队列|比例与分辨率|查看生成结果|继续创作/);
  assert.match(assetsMenu, /data-nav-action="output"[\s\S]*打开输出目录/);
  assert.match(assetsMenu, /href="#gallery"[\s\S]*瀑布画廊/);
  assert.match(assetsMenu, /href="#creation-record"[\s\S]*套图记录/);
  assert.match(assetsMenu, /href="#ppt-record"[\s\S]*PPT记录/);
  assert.doesNotMatch(assetsMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="prompt-agent"|href="#studio"|href="#creation"|href="#ppt"|>画廊<\/a>|按日期浏览|筛选生成历史/);
  assert.match(settingsMenu, /data-nav-action="config"[\s\S]*配置 API/);
  assert.match(settingsMenu, /data-nav-action="theme"[\s\S]*主题颜色/);
  assert.doesNotMatch(settingsMenu, /模型与密钥|浏览器本地配置|切换明暗主题|data-nav-action="output"|data-nav-action="prompt-agent"/);
  assert.doesNotMatch(settingsMenu, /data-view-tab=/);
  assert.doesNotMatch(html, /<div class="topbar-actions" aria-label="状态与工具">/);
  assert.match(html, /<div class="topbar-api-check" aria-label="API、LOG">[\s\S]*<button class="header-pill status-ready" id="connectionStatus" data-state="idle" type="button" aria-label="待填写API、LOG，打开 API、LOG">[\s\S]*<span id="connectionLabel">待填写API、LOG<\/span>/);
  assert.match(html, /<div class="topbar-ghost-actions">[\s\S]*id="configStatus"[\s\S]*id="themeToggleButton"[\s\S]*id="openOutputButton"[\s\S]*id="openPromptAgentButton"[\s\S]*id="openConfigButton"/);
  assert.doesNotMatch(html, /topbar-ghost-actions[^>]*aria-hidden/);
  assert.doesNotMatch(html, /nav-switch-panel|nav-switch-list|nav-switch-link|小区 · 界面切换/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.topbar\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:\s*0;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translate\(-50%,\s*calc\(-100% \+ var\(--topbar-trigger-height,\s*10px\)\)\);/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.topbar:hover,[\s\S]*\.topbar:focus-within,[\s\S]*\.topbar-reveal \.topbar,[\s\S]*\.topbar:has\(\.nav-item\.is-nav-open\)\s*\{[\s\S]*transform:\s*translate\(-50%,\s*0\);/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.brand-cluster,[\s\S]*\.topbar-api-check,[\s\S]*\.topbar-ghost-actions,[\s\S]*\.nav-tab-note\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.global-nav\s*\{[\s\S]*position:\s*static;[\s\S]*width:\s*auto;[\s\S]*transform:\s*none;/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.view-tabs\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/);
  assert.match(styles, /--nav-tab-bg:\s*rgba\(15,\s*23,\s*42,\s*0\.84\);[\s\S]*--nav-tab-active:\s*#34c759;[\s\S]*--nav-tab-idle:\s*#6f7cff;/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.view-tab\s*\{[\s\S]*min-width:\s*92px;[\s\S]*min-height:\s*30px;[\s\S]*border-radius:\s*10px;[\s\S]*var\(--nav-tab-idle\)\s*22%,\s*var\(--nav-tab-bg\)/);
  assert.match(styles, /\.view-tab\.active\s*\{[\s\S]*var\(--nav-tab-active\)\s*28%,\s*var\(--nav-tab-bg\)[\s\S]*var\(--nav-tab-active\)\s*12%,\s*var\(--nav-tab-bg\)[\s\S]*color:\s*var\(--nav-tab-active\);/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.view-tab\.active::after\s*\{[\s\S]*background:\s*var\(--nav-tab-active\);/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.view-tab::after\s*\{[\s\S]*height:\s*4px;[\s\S]*background:\s*var\(--nav-tab-idle\);[\s\S]*opacity:\s*0\.86;/);
  assert.match(styles, /--flyout-bg:\s*rgba\(8,\s*13,\s*26,\s*0\.96\);[\s\S]*--flyout-text:\s*var\(--text\);/);
  assert.match(styles, /html\[data-theme="light"\]\s*\{[\s\S]*--flyout-bg:\s*rgba\(251,\s*251,\s*253,\s*0\.96\);[\s\S]*--flyout-text:\s*var\(--text\);/);
  assert.match(styles, /\.nav-flyout\.mega-menu\s*\{[\s\S]*width:\s*min\(680px,\s*calc\(100vw - 32px\)\);[\s\S]*padding:\s*24px;/);
  assert.match(styles, /\.mega-menu-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(170px,\s*1\.35fr\)\s+repeat\(2,\s*minmax\(120px,\s*1fr\)\);/);
  assert.match(styles, /\.mega-menu-link,\s*[\r\n]+\s*\.mega-menu-action\s*\{[\s\S]*font-size:\s*var\(--type-small-title-size\);[\s\S]*font-weight:\s*600;/);
  assert.doesNotMatch(styles, /\.mega-menu-link\.large,\s*[\r\n]+\s*\.mega-menu-action\.large\s*\{/);
  assert.match(styles, /html:not\(\[data-ui-layout="tablet"\]\):not\(\[data-ui-layout="mobile"\]\) \.global-nav-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*max-content\);[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /html\[data-ui-layout="stacked"\] \.global-nav-list,[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.global-nav-list\s*\{[\s\S]*overflow:\s*visible;/);
  assert.doesNotMatch(styles, /\.nav-item:hover \.nav-flyout/);
  assert.doesNotMatch(styles, /\.nav-item:focus-within \.nav-flyout/);
  assert.match(styles, /\.nav-item\.is-nav-open \.nav-flyout\s*\{[\s\S]*opacity:\s*1;[\s\S]*visibility:\s*visible;[\s\S]*pointer-events:\s*auto;/);
  assert.match(app, /const TOPBAR_REVEAL_CLASS = "topbar-reveal";/);
  assert.match(app, /document\.addEventListener\("pointermove", syncTopbarRevealFromPointer, \{ passive: true \}\);/);
  assert.match(app, /setTopbarReveal\(Boolean\(item\)\);/);
  assert.match(app, /function closeGlobalNavIfOutsideTopbar\(\) \{/);
  assert.match(app, /refs\.topbar\?\.addEventListener\("pointerleave", closeGlobalNavIfOutsideTopbar\);/);
  assert.match(app, /refs\.topbar\?\.addEventListener\("focusout", closeGlobalNavIfOutsideTopbar\);/);
  assert.match(app, /function handleGlobalNavAction\(action\) \{/);
  assert.match(app, /const activeNavSection = CREATE_VIEW_IDS\.has\(view\) \? "create" : ASSET_VIEW_IDS\.has\(view\) \? "assets" : "";/);
  assert.match(app, /refs\.connectionStatus\.addEventListener\("click",\s*\(\) => setDrawerOpen\(true\)\);/);
  assert.match(app, /const CONNECTION_STATUS_ENTRY_LABEL = "API、LOG";/);
  assert.match(app, /const CONNECTION_STATUS_EMPTY_LABEL = "待填写API、LOG";/);
  assert.match(app, /refs\.connectionStatus\.setAttribute\("aria-label", `\$\{entryLabel\}, \$\{getUiLanguageText\("connectionOpen"\)\}`\);/);
  assert.match(app, /refs\.connectionLabel\.textContent = entryLabel;/);
  assert.match(app, /setConnectionState\("idle", getUiLanguageText\("apiIdle"\) \|\| \(state\.uiLanguage === "en" \? "Configure API first" : "请先配置 API"\), getUiLanguageText\("connectionStatusEmpty"\) \|\| CONNECTION_STATUS_EMPTY_LABEL\);/);
  assert.match(app, /globalNavItems:\s*\[\.\.\.document\.querySelectorAll\("\[data-nav-section\]"\)\]/);
  assert.match(app, /function setActiveGlobalNavItem\(item\) \{[\s\S]*refs\.globalNavItems\.forEach\(\(navItem\) => \{[\s\S]*const isOpen = navItem === item;[\s\S]*navItem\.classList\.toggle\("is-nav-open",\s*isOpen\);/);
  assert.match(app, /button\.addEventListener\("pointerenter",\s*\(\) => setActiveGlobalNavItem\(item\)\);/);
  assert.match(app, /button\.addEventListener\("focus",\s*\(\) => setActiveGlobalNavItem\(item\)\);/);
  assert.match(app, /button\.addEventListener\("click",\s*\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*setActiveGlobalNavItem\(item\);[\s\S]*\}\);/);
  assert.match(app, /document\.querySelectorAll\("\[data-nav-action\]"\)\.forEach/);
});

test("interactive workbench controls stay in the accessibility tree", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<div class="topbar-ghost-actions">[\s\S]*<button class="theme-toggle header-button" id="themeToggleButton"/);
  assert.doesNotMatch(html, /<div class="topbar-ghost-actions"[^>]*aria-hidden="true"/);
  assert.match(html, /<nav class="asset-view-nav" aria-label="资产视图">/);
  assert.match(html, /<div class="gallery-scroll-region" id="galleryScrollRegion">/);
  assert.doesNotMatch(html, /class="gallery-scroll-arrow"|id="galleryScrollThumb"/);
  assert.match(app, /button\.setAttribute\("aria-label", `查看图片 \$\{filename\}`\);/);
});

test("global navigation closes flyouts after links and actions", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /target\.closest\("a\[href\^='#'\]"\)[\s\S]*setActiveGlobalNavItem\(null\);/);
  assert.match(
    app,
    /button\.addEventListener\("click", \(\) => \{[\s\S]*handleGlobalNavAction\(button\.dataset\.navAction\);[\s\S]*setActiveGlobalNavItem\(null\);[\s\S]*\}\);/,
  );
});

test("PPT record cards open a deck preview detail with slide thumbnails", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="pptRecordList"[\s\S]*id="pptRecordDetail"/);
  assert.match(styles, /\.ppt-record-browser\s*\{/);
  assert.match(styles, /\.ppt-record-detail\s*\{/);
  assert.match(styles, /\.ppt-record-preview-stage\s*\{/);
  assert.match(styles, /\.ppt-record-slide-strip\s*\{/);
  assert.match(app, /recordDetail:\s*\{[\s\S]*deckKey:\s*""[\s\S]*slideNumber:\s*0[\s\S]*\}/);
  assert.match(app, /function getPptDeckRecordKey\(deck\) \{/);
  assert.match(app, /function selectPptRecord\(recordKey\) \{/);
  assert.match(app, /function renderPptRecordDetail\(deck\) \{/);
  assert.match(app, /item\.dataset\.pptRecordKey = getPptDeckRecordKey\(deck\);/);
  assert.match(app, /refs\.pptRecordList\.addEventListener\("click",[\s\S]*target\.closest\("\[data-ppt-record-key\]"\)/);
  assert.match(app, /refs\.pptRecordDetail\.addEventListener\("click",[\s\S]*target\.closest\("\[data-ppt-record-slide\]"\)/);
  assert.match(app, /previewImage\.src = getPptSlideImageUrl\(selectedSlide\);/);
});

test("theme toggle persists dark and white themes", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /image-studio-ui-theme-v1/);
  assert.match(html, /<button class="theme-toggle header-button" id="themeToggleButton" type="button" aria-pressed="false">/);
  assert.match(html, /<span id="themeToggleLabel">白色主题<\/span>/);
  assert.match(styles, /html\[data-theme="light"\]\s*\{[\s\S]*--bg:\s*#f5f5f7;[\s\S]*--text:\s*#1d1d1f;/);
  assert.match(styles, /html\[data-theme="light"\] body\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*#f5f5f7 0%,\s*#ffffff 100%\);/);
  assert.match(app, /const THEME_STORAGE_KEY = "image-studio-ui-theme-v1";/);
  assert.match(app, /function setUiTheme\(theme\) \{[\s\S]*document\.documentElement\.dataset\.theme = normalized;[\s\S]*window\.localStorage\.setItem\(THEME_STORAGE_KEY,\s*normalized\);/);
  assert.match(app, /refs\.themeToggleButton\.addEventListener\("click",\s*\(\) => \{/);
});

test("theme language switch supports English from the config drawer", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /const languageKey = "image-studio-ui-language-v1";/);
  assert.match(
    html,
    /<div class="config-language-switch" role="group" aria-label="切换界面语言" data-ui-i18n-aria-label="languageSwitch">[\s\S]*<input id="uiLanguageInput" name="uiLanguage" type="hidden" value="zh-CN" \/>[\s\S]*<button class="config-language-option is-active" type="button" data-ui-language-option="zh-CN" aria-pressed="true" aria-label="简体中文界面" data-ui-i18n-aria-label="languageZh">CN<\/button>[\s\S]*<button class="config-language-option" type="button" data-ui-language-option="en" aria-pressed="false" aria-label="English UI" data-ui-i18n-aria-label="languageEn">EN<\/button>/,
  );
  assert.doesNotMatch(html, /<label class="field ui-language-field">/);
  assert.doesNotMatch(html, /<details class="config-language-menu">/);
  assert.match(html, /<h2 data-ui-i18n="configTitle">连接配置<\/h2>/);
  assert.match(html, /<button class="header-button" id="closeConfigButton" type="button" data-ui-i18n="close">关闭<\/button>/);
  assert.match(html, /<span data-ui-i18n="routeMode">路由模式<\/span>/);
  assert.match(html, /<button class="mega-menu-action" id="themeNavAction" type="button" data-nav-action="theme" data-ui-i18n="themeMenu">主题颜色<\/button>/);
  assert.match(readCssRule(styles, ".config-language-switch"), /width:\s*104px;[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(readCssRule(styles, ".config-language-option"), /min-width:\s*0;[\s\S]*white-space:\s*nowrap;/);
  assert.match(readCssRule(styles, ".config-actions-row > .header-button"), /min-width:\s*78px;/);
  assert.match(app, /const UI_LANGUAGE_STORAGE_KEY = "image-studio-ui-language-v1";/);
  assert.match(app, /function normalizeUiLanguage\(language\) \{[\s\S]*return language === "en" \? "en" : "zh-CN";/);
  assert.match(app, /document\.documentElement\.lang = normalized;/);
  assert.match(app, /function applyUiLanguageText\(\) \{[\s\S]*document\.querySelectorAll\("\[data-ui-i18n\]"\)[\s\S]*document\.querySelectorAll\("\[data-ui-i18n-aria-label\]"\)[\s\S]*document\.querySelectorAll\("\[data-ui-i18n-placeholder\]"\)/);
  assert.match(app, /function getUiImageRouteLabel\(imageRoute\) \{[\s\S]*modeDirect[\s\S]*modeProtocol[\s\S]*modeRoute/);
  assert.match(app, /refs\.uiLanguageOptions\.forEach\(\(button\) => \{[\s\S]*button\.classList\.toggle\("is-active", isActive\);[\s\S]*button\.setAttribute\("aria-pressed", String\(isActive\)\);/);
  assert.match(app, /refs\.themeNavAction\.textContent = getUiLanguageText\("themeMenu"\);/);
  assert.match(
    app,
    /refs\.themeToggleLabel\.textContent = getUiLanguageText\(isLight \? "themeDark" : "themeLight"\);/,
  );
  assert.match(app, /refs\.uiLanguageOptions\.forEach\(\(button\) => \{[\s\S]*button\.addEventListener\("click", \(\) => setUiLanguage\(button\.dataset\.uiLanguageOption\)\);/);
  assert.doesNotMatch(app, /uiLanguageInput\.addEventListener\("change"/);
});

test("main studio shell follows the selected UI language", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<nav class="primary-nav global-nav" aria-label="全局导航" data-ui-i18n-aria-label="globalNav">/);
  assert.match(html, /<span class="nav-tab-label" data-ui-i18n="navCreate">创作<\/span>/);
  assert.match(html, /<span class="nav-tab-label" data-ui-i18n="navAssets">资产<\/span>/);
  assert.match(html, /<span class="nav-tab-label" data-ui-i18n="navSettings">配置<\/span>/);
  assert.match(html, /href="#studio" data-ui-i18n="menuPromptStudio">提示词生图<\/a>/);
  assert.match(html, /href="#creation" data-ui-i18n="menuCreation">套图模式<\/a>/);
  assert.match(html, /href="#ppt" data-ui-i18n="menuPpt">PPT生成<\/a>/);
  assert.match(html, /data-nav-action="prompt-agent" data-ui-i18n="promptAgent">图片转提示词<\/button>/);
  assert.match(html, /<strong data-ui-i18n="referenceUploadTitle">拖入图片或点击上传<\/strong>/);
  assert.match(html, /id="promptInput"[\s\S]*data-ui-i18n-placeholder="promptPlaceholder"/);
  assert.match(html, /id="promptEnhanceToggle"[\s\S]*data-ui-i18n-aria-label="promptEnhanceAria"[\s\S]*<strong data-ui-i18n="promptEnhance">增强模式<\/strong>/);
  assert.match(html, /id="generateButton"[\s\S]*data-ui-i18n-title="generateTitle"[\s\S]*data-ui-i18n="generate"[\s\S]*>/);
  assert.match(html, /id="parameterAdaptiveSection"[\s\S]*<span data-ui-i18n="parameters">参数设置<\/span>/);
  assert.match(html, /<span data-ui-i18n="reasoningEffort">思考等级<\/span>[\s\S]*id="reasoningEffortInput"/);
  assert.match(html, /<span data-ui-i18n="size">分辨率<\/span>[\s\S]*id="sizeInput"/);
  assert.match(html, /<span data-ui-i18n="outputFormat">输出格式<\/span>[\s\S]*id="outputFormatInput"/);
  assert.match(html, /id="previewDownloadButton"[\s\S]*data-ui-i18n="download">下载<\/a>/);
  assert.match(html, /id="previewLightboxButton"[\s\S]*data-ui-i18n="view">查看<\/button>/);
  assert.match(html, /id="previewDeleteButton"[\s\S]*data-ui-i18n="delete">删除<\/button>/);
  assert.match(app, /function getUiRatioLabel\(option\)/);
  assert.match(app, /function getUiSizeLabel\(option\)/);
  assert.match(app, /function getUiPreviewPlaceholderState\(placeholderState\)/);
  assert.match(app, /function rerenderUiLanguageSensitiveViews\(\)/);
  assert.match(app, /rerenderUiLanguageSensitiveViews\(\);/);
});

test("floating dialogs and popovers use theme-aware overlay surface tokens", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /:root\s*\{[\s\S]*--overlay-surface-bg:/);
  assert.match(
    styles,
    /html\[data-theme="light"\]\s*\{[\s\S]*--overlay-surface-bg:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.98\)/,
  );

  [
    ".lightbox-dialog",
    ".creation-industry-popover",
    ".prompt-agent-dialog",
    ".prompt-agent-image-viewer-dialog",
    ".prompt-template-panel",
    ".ppt-edit-dialog",
  ].forEach((selector) => {
    const rule = readCssRuleContaining(styles, selector, "background: var(--overlay-surface-bg");
    assert.match(rule, /background:\s*var\(--overlay-surface-bg/);
    assert.doesNotMatch(rule, /background:\s*(?:rgba\((?:13|14|17|21|24),|linear-gradient\(180deg,\s*rgba\((?:13|14|17|21|24),)/);
  });

  assert.match(readCssRule(styles, ".prompt-template-head"), /border-bottom:\s*1px solid var\(--overlay-border-muted/);
  assert.match(readCssRule(styles, ".ppt-edit-head"), /border-bottom:\s*1px solid var\(--overlay-border-muted/);
});

test("prompt template panel anchors beside the settings panel without covering it", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const panelRule = readCssRule(styles, ".prompt-template-panel");

  assert.match(panelRule, /left:\s*calc\(var\(--prompt-template-settings-edge,[\s\S]*\+\s*var\(--studio-grid-gap,\s*14px\)\);/);
  assert.match(panelRule, /right:\s*auto;/);
  assert.match(
    panelRule,
    /width:\s*min\(680px,\s*calc\(100vw\s*-\s*var\(--prompt-template-settings-edge,[\s\S]*-\s*var\(--studio-grid-gap,\s*14px\)\s*-\s*clamp\(12px,\s*2vw,\s*26px\)\)\);/,
  );
  const promptTemplateAnchorSync = extractFunctionBefore(app, "syncPromptTemplateSettingsEdge", "syncStudioHeight");
  assert.match(promptTemplateAnchorSync, /refs\.settingsPanel\.getBoundingClientRect\(\)/);
  assert.match(promptTemplateAnchorSync, /Math\.round\(settingsRect\.right\)/);
  assert.match(promptTemplateAnchorSync, /setProperty\("--prompt-template-settings-edge",/);
  assert.doesNotMatch(app, /--prompt-template-preview-anchor-left|canvasRect\.left\s*\+\s*canvasRect\.width\s*\/\s*2/);
  assert.match(app, /studioHeightObserver\.observe\(refs\.settingsPanel\);/);
  const promptTemplatePopoverOpen = extractFunctionBefore(app, "setPromptTemplatePopoverOpen", "selectRandomPrompt");
  assert.match(promptTemplatePopoverOpen, /if \(open\) \{\s*syncPromptTemplateSettingsEdge\(\);\s*\}/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.prompt-template-panel,[\s\S]*html\[data-ui-layout="stacked"\] \.prompt-template-panel,[\s\S]*html\[data-ui-layout="mobile"\] \.prompt-template-panel\s*\{[\s\S]*right:\s*auto;[\s\S]*left:\s*10px;[\s\S]*width:\s*calc\(100vw\s*-\s*20px\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.prompt-template-body,[\s\S]*html\[data-ui-layout="stacked"\] \.prompt-template-body,[\s\S]*html\[data-ui-layout="mobile"\] \.prompt-template-body\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
  );
});

test("compact select controls use theme-aware form surfaces", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const rootRule = readCssRule(styles, ":root");
  const lightRule = readCssRule(styles, "html[data-theme=\"light\"]");
  const compactSelectRule = readCssRule(styles, ".compact-field select");
  const compactArrowRule = readCssRule(styles, ".compact-field:has(select)::after");
  const compactOptionRule = readCssRule(styles, ".compact-field select option");
  const gallerySelectRule = readCssRule(styles, ".gallery-filter-select");
  const creationTemplateSearchRule = readCssRule(styles, ".creation-template-search");

  assert.match(rootRule, /color-scheme:\s*dark;/);
  assert.match(lightRule, /color-scheme:\s*light;/);
  assert.match(compactSelectRule, /color:\s*var\(--text\);/);
  assert.match(compactSelectRule, /background:\s*var\(--input-bg/);
  assert.doesNotMatch(compactSelectRule, /rgba\(16,\s*22,\s*40,\s*0\.92\)|color:\s*#f5f7ff/);
  assert.match(compactArrowRule, /border-right:\s*2px solid var\(--muted\);/);
  assert.match(compactOptionRule, /color:\s*var\(--text\);[\s\S]*background:\s*var\(--bg-soft\);/);
  assert.match(gallerySelectRule, /color-scheme:\s*inherit;/);
  assert.match(creationTemplateSearchRule, /color:\s*var\(--text\);[\s\S]*background:\s*var\(--input-bg/);
  assert.match(creationTemplateSearchRule, /width:\s*100%;/);
  assert.match(creationTemplateSearchRule, /max-width:\s*100%;/);
  assert.match(creationTemplateSearchRule, /box-sizing:\s*border-box;/);
  assert.doesNotMatch(creationTemplateSearchRule, /rgba\(12,\s*18,\s*32,\s*0\.88\)|color:\s*#f5f7ff/);
  assert.match(
    styles,
    /\.gallery-filter-select option,\s*[\r\n]+\.gallery-filter-select optgroup\s*\{[\s\S]*background:\s*var\(--bg-soft\);[\s\S]*color:\s*var\(--text\);/,
  );
});

test("gallery date section headers use theme-aware surfaces", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const gallerySectionHeadRule = readCssRule(styles, ".gallery-section-head");

  assert.match(gallerySectionHeadRule, /border:\s*1px solid var\(--overlay-border-muted\);/);
  assert.match(gallerySectionHeadRule, /background:\s*var\(--overlay-surface-bg-soft\);/);
  assert.doesNotMatch(gallerySectionHeadRule, /rgba\(14,\s*20,\s*36/);
});

test("prompt agent preview marks uploaded images as zoomable and animates analysis", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="promptAgentPreviewButton"[\s\S]*aria-label="放大查看待分析图片"/);
  assert.match(html, /class="prompt-agent-zoom-badge"[\s\S]*点击放大/);
  assert.match(html, /id="promptAgentImageViewer"/);
  assert.match(html, /class="prompt-agent-analysis-motion" id="promptAgentAnalysisMotion"/);
  assert.match(styles, /@keyframes prompt-agent-scan/);
  assert.match(styles, /\.prompt-agent-preview\.is-analyzing[\s\S]*prompt-agent-scan-line/);
  assert.match(styles, /\.prompt-agent-image-viewer\.open[\s\S]*display:\s*grid;/);
  assert.match(app, /function openPromptAgentImageViewer\(\)/);
  assert.match(app, /refs\.promptAgentPreviewButton\.addEventListener\("click", openPromptAgentImageViewer\)/);
  assert.match(app, /refs\.promptAgentPreview\.classList\.toggle\("is-analyzing", state\.promptAgent\.running\)/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.prompt-agent-preview\.is-analyzing \.prompt-agent-scan-line[\s\S]*animation:\s*none;/,
  );
});

test("prompt agent long-term history keeps prompts collapsed behind title rows", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /className = "prompt-agent-history-title-button"/);
  assert.match(app, /titleButton\.dataset\.promptAgentMapId = item\.id;/);
  assert.match(app, /titleButton\.textContent = getPromptAgentDisplayName\(item\);/);
  assert.match(app, /className = "prompt-agent-history-expand-button"/);
  assert.match(app, /expandButton\.dataset\.promptAgentExpandId = item\.id;/);
  assert.match(app, /className = "prompt-agent-history-detail hidden"/);
  assert.doesNotMatch(app, /mapButton\.textContent = "映射到提示词";/);
  assert.match(styles, /\.prompt-agent-history-title-button\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.prompt-agent-history-expand-button\s*\{[\s\S]*justify-self:\s*end;/);
  assert.match(styles, /\.prompt-agent-history-detail\.hidden\s*\{[\s\S]*display:\s*none;/);
});

test("prompt agent uses one structured JSON result for display, copy, mapping, and templates", async () => {
  const app = await readFile(appPath, "utf8");
  const html = await readFile(indexPath, "utf8");

  assert.match(app, /function getPromptAgentTemplateId\(item\) \{/);
  assert.match(app, /getPromptAgentDisplayName, getPromptAgentTemplateDisplayName, isStructuredImagePromptJson/);
  assert.match(app, /function getPromptAgentReusableText\(item\) \{[\s\S]*getPromptAgentJsonText\(item\)/);
  assert.match(app, /function savePromptAgentResultAsTemplate\(item\) \{[\s\S]*const prompt = getPromptAgentReusableText\(item\);[\s\S]*mergePromptAgentHistoryTemplates\(/);
  assert.match(app, /getTemplateId: getPromptAgentTemplateId,[\s\S]*getPrompt: getPromptAgentReusableText,[\s\S]*getName: getPromptAgentDisplayName/);
  assert.match(app, /const resultText = getPromptAgentReusableText\(state\.promptAgent\.result\);[\s\S]*refs\.promptAgentResult\.value = resultText;/);
  assert.match(app, /function mapPromptAgentPrompt\(itemId\) \{[\s\S]*getPromptAgentReusableText\(item\)/);
  assert.match(html, /id="copyPromptAgentJsonButton"[\s\S]*复制 JSON/);
  assert.doesNotMatch(html, /id="copyPromptAgentPromptButton"/);
  assert.match(html, /id="promptAgentResultLabel">结构化反推 JSON/);
  assert.match(html, /<h2>图片转提示词<\/h2>[\s\S]*主体与景别详细、背景与视觉精简/);
  assert.match(app, /setPromptAgentFeedback\("已生成结构化反推 JSON。", "success"\);/);
  assert.match(app, /state\.promptTemplates = nextTemplates;/);
  assert.match(app, /writePromptTemplates\(\);[\s\S]*renderPromptTemplates\(\);/);
  assert.match(app, /savePromptAgentResultAsTemplate\(payload\.item\);/);
});

test("prompt agent history backfills missing Prompt Kit templates without replacing existing entries", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function syncPromptAgentHistoryToTemplates\(history\) \{[\s\S]*mergePromptAgentHistoryTemplates\(/);
  assert.match(app, /state\.promptAgent\.historyLoaded && !force/);
  assert.match(app, /state\.promptAgent\.historyLoaded = true;/);
  assert.match(app, /loadPromptAgentHistory\(\)\.catch\(\(error\) => \{[\s\S]*load prompt agent history for templates failed/);
  assert.match(app, /loadPromptAgentHistory\(\{ force: true \}\)/);
  assert.match(app, /const changed = nextTemplates\.length !== state\.promptTemplates\.length;/);
  assert.match(app, /const PROMPT_TEMPLATE_DISMISSED_HISTORY_KEY = "image-studio-prompt-template-dismissed-history-v1";/);
  assert.match(app, /state\.promptTemplateDismissedHistoryIds\.add\(selected\.id\);/);
  assert.match(app, /skipItem: \(historyItem\) => state\.promptTemplateDismissedHistoryIds\.has\(getPromptAgentTemplateId\(historyItem\)\)/);
});

test("Prompt Kit labels long-term history templates separately from other templates", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /const historyTemplates = state\.promptTemplates\.filter\(\(template\) => String\(template\.id \|\| ""\)\.startsWith\("prompt-agent-"\)\);/);
  assert.match(app, /appendPromptTemplateGroup\(historyTemplates, historyTemplates\.length > 0 \? "长期保留" : ""\);/);
  assert.match(app, /appendPromptTemplateGroup\(otherTemplates, historyTemplates\.length > 0 \? "其他模板" : ""\);/);
  assert.match(styles, /\.prompt-template-group-head\s*\{/);
});

test("legacy image-to-prompt JSON templates normalize to their single prompt", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /getLegacyPromptAgentTemplatePrompt/);
  assert.match(app, /function parsePromptAgentTemplateJson\(template, prompt\) \{/);
  assert.match(app, /String\(template\?\.id \|\| ""\)\.startsWith\("prompt-agent-"\)/);
  assert.match(app, /JSON\.parse\(prompt\)/);
  assert.match(app, /const parsedPromptJson = parsePromptAgentTemplateJson\(template, rawPrompt\);/);
  assert.match(app, /const prompt = getLegacyPromptAgentTemplatePrompt\(template, parsedPromptJson\) \|\| rawPrompt;/);
  assert.match(app, /name: getPromptAgentTemplateDisplayName\(template, parsedPromptJson, index\),/);
});

test("prompt image analysis compresses large browser uploads before posting to Vercel", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const PROMPT_AGENT_ANALYSIS_REASONING_EFFORT = "medium";/);
  assert.match(app, /PROMPT_ANALYSIS_IMAGE_MAX_EDGE = 1024/);
  assert.match(app, /PROMPT_ANALYSIS_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 \* 1024/);
  assert.match(app, /async function preparePromptAnalysisImageFile\(file\) \{/);
  assert.match(app, /createImageBitmap\(file\)/);
  assert.match(app, /canvasToBlob\([\s\S]*"image\/jpeg"[\s\S]*PROMPT_ANALYSIS_IMAGE_JPEG_QUALITY/);
  assert.match(app, /new File\(\[blob\], makePromptAnalysisImageName\(file\.name\)/);
  assert.match(
    app,
    /async function buildPromptAgentFormData\(\) \{[\s\S]*formData\.set\("image", await preparePromptAnalysisImageFile\(state\.promptAgent\.file\)\);[\s\S]*formData\.set\(\s*"reasoningEffort",\s*PROMPT_AGENT_ANALYSIS_REASONING_EFFORT,?\s*\);/,
  );
  const promptAgentFormDataBody = app.match(/async function buildPromptAgentFormData\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(promptAgentFormDataBody, /appendCurrentConfigToFormData\(formData\);/);
  assert.doesNotMatch(promptAgentFormDataBody, /appendJobConfigToFormData\(formData,\s*job\)/);
  assert.match(app, /const formData = await buildPromptAgentFormData\(\);[\s\S]*analysisSnapshot !== getPromptAgentAnalysisSnapshot\(\)[\s\S]*body: formData,/);
});

test("reference orchestration analysis is a separate studio mode outside prompt generation", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const generateForm = html.match(/<form id="generateForm"[\s\S]*?<\/form>/)?.[0] || "";

  assert.doesNotMatch(generateForm, /id="referenceAnalyzeButton"|id="referenceAnalysisPanel"|reference-analysis-actions/);
  assert.match(html, /href="#reference-analysis"[\s\S]*融图分析/);
  assert.match(html, /data-view-panel="reference-analysis"/);
  assert.match(html, /id="referenceAnalysisDropzone"[\s\S]*id="referenceAnalysisGrid"/);
  assert.match(html, /id="referenceAnalysisGrid"[\s\S]*class="reference-analysis-actions"[\s\S]*class="reference-analysis-params"/);
  assert.match(html, /id="referenceAnalysisRatioGrid"[\s\S]*id="referenceAnalysisLanguageInput"[\s\S]*id="referenceAnalysisSizeInput"[\s\S]*id="referenceAnalysisGenerateButton"[\s\S]*id="referenceAnalysisAutoCollapseButton"/);
  assert.match(html, /id="referenceAnalysisAutoCollapseButton"[\s\S]*role="switch"[\s\S]*aria-checked="true"/);
  assert.match(html, /class="reference-analysis-switch-label"[\s\S]*应用提示词后自动折叠/);
  assert.match(html, /class="reference-analysis-switch-track"[\s\S]*class="reference-analysis-switch-thumb"/);
  assert.match(html, /id="referenceAnalyzeButton"[\s\S]*融图分析/);
  const uploadPanelIndex = html.indexOf("reference-analysis-upload-panel");
  const previewColumnIndex = html.indexOf("reference-analysis-preview-column");
  const resultPanelIndex = html.indexOf("reference-analysis-result-panel");
  assert.ok(uploadPanelIndex >= 0 && uploadPanelIndex < previewColumnIndex);
  assert.ok(previewColumnIndex >= 0 && previewColumnIndex < resultPanelIndex);
  const previewColumnBlock = html.slice(previewColumnIndex, resultPanelIndex);
  assert.match(previewColumnBlock, /class="studio-panel reference-analysis-preview-panel"[\s\S]*id="referenceAnalysisGenerationCanvas"[\s\S]*id="referenceAnalysisGenerationImage"/);
  assert.match(previewColumnBlock, /class="studio-panel reference-analysis-thumbnail-panel"[\s\S]*id="referenceAnalysisGenerationStrip"[\s\S]*id="referenceAnalysisThumbnailEmpty"/);
  assert.doesNotMatch(previewColumnBlock, /id="referenceAnalysisSelectedPrompt"/);
  const resultPanelBlock = html.slice(resultPanelIndex);
  assert.match(resultPanelBlock, /id="referenceAnalysisPanel"[\s\S]*id="referenceAnalysisList"[\s\S]*id="referenceAnalysisSelectedPromptPanel"[\s\S]*id="referenceAnalysisSelectedPrompt"/);
  assert.doesNotMatch(resultPanelBlock, /id="referenceAnalysisGenerationCanvas"|id="referenceAnalysisGenerationStrip"/);
  assert.match(html, /id="referenceAnalysisCopyPromptButton"/);
  assert.match(html, /id="referenceAnalysisGenerationImage"/);
  assert.match(html, /id="referenceAnalysisGenerationDownloadButton"/);
  assert.match(html, /id="referenceAnalysisGenerationStrip"[\s\S]*aria-label="融图分析生成缩略图"/);
  const selectedPromptBlock =
    html.match(/<div class="reference-analysis-selected hidden"[\s\S]*?<textarea id="referenceAnalysisSelectedPrompt"[\s\S]*?<\/textarea>\s*<\/div>/)?.[0] ||
    "";
  assert.doesNotMatch(selectedPromptBlock, /id="referenceAnalysisGenerateButton"/);
  assert.doesNotMatch(selectedPromptBlock, /id="referenceAnalysisGenerationCanvas"|id="referenceAnalysisGenerationStrip"/);
  assert.doesNotMatch(html, /id="referenceAnalyzeButton"[^>]*disabled/);
  assert.match(html, /id="referenceAnalysisPanel"[\s\S]*编排提示词/);
  assert.match(html, /id="referenceAnalysisList"/);
  const referenceAnalysisActionsBlock =
    html.match(/<div class="reference-analysis-actions">[\s\S]*?<div class="reference-analysis-panel/)?.[0] || "";
  const referenceAnalysisPanelHeadBlock =
    html.match(/<div class="reference-analysis-panel[\s\S]*?<div class="reference-analysis-list/)?.[0] || "";
  assert.match(referenceAnalysisActionsBlock, /id="referenceAnalysisToggleButton"/);
  assert.doesNotMatch(referenceAnalysisPanelHeadBlock, /id="referenceAnalysisToggleButton"/);
  assert.match(html, /aria-controls="referenceAnalysisHead referenceAnalysisList"/);
  assert.match(html, /id="referenceAnalysisToggleButton"[\s\S]*class="reference-analysis-toggle hidden"/);
  assert.match(styles, /\.reference-analysis-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.reference-analysis-button\s*\{[\s\S]*width:\s*100%;/);
  assert.match(styles, /\.reference-analysis-panel\s*\{/);
  assert.match(styles, /\.reference-analysis-card\s*\{/);
  assert.match(styles, /\.reference-analysis-card p\s*\{[\s\S]*font-size:\s*var\(--type-body-size\);/);
  assert.match(styles, /\.reference-analysis-apply-pill\s*\{[\s\S]*border-radius:\s*999px;[\s\S]*background:\s*linear-gradient\(135deg, rgba\(112, 226, 162, 0\.96\), rgba\(145, 159, 255, 0\.9\)\);/);
  assert.match(styles, /\.reference-analysis-apply-pill\.is-selected\s*\{/);
  assert.match(styles, /\.reference-analysis-selected\s*\{/);
  assert.match(styles, /\.reference-analysis-selected\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.reference-analysis-selected textarea\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*width:\s*100%;/);
  assert.match(styles, /\.reference-analysis-generation\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-canvas\s*\{/);
  assert.match(styles, /\.reference-analysis-view\s+\.reference-analysis-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(300px, 420px\) minmax\(280px, 0\.9fr\) minmax\(360px, 1fr\);/);
  assert.match(styles, /\.reference-analysis-preview-column\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.reference-analysis-preview-panel\s*\{[\s\S]*display:\s*grid;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.reference-analysis-thumbnail-panel\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(72px, auto\) auto;/);
  assert.match(styles, /\.reference-analysis-thumbnail-empty\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-canvas\.has-image\s*\{[\s\S]*cursor:\s*zoom-in;/);
  assert.match(styles, /\.reference-analysis-generation-canvas\.has-image:focus-visible\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-placeholder\.preview-placeholder-loading\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-strip\s*\{[\s\S]*grid-auto-flow:\s*column;[\s\S]*overflow-x:\s*auto;/);
  assert.match(styles, /\.reference-analysis-generation-thumb\s*\{[\s\S]*width:\s*72px;[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/);
  assert.match(styles, /\.reference-analysis-generation-thumb\.active\s*\{[\s\S]*border-color:\s*rgba\(112, 226, 162, 0\.62\);/);
  assert.match(styles, /\.reference-analysis-generation-thumb\.is-running\s*\{[\s\S]*border-color:\s*rgba\(112, 226, 162, 0\.42\);/);
  assert.match(styles, /\.reference-analysis-auto-collapse\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 52px;[\s\S]*text-align:\s*left;/);
  assert.match(styles, /\.reference-analysis-switch-track\s*\{[\s\S]*width:\s*52px;[\s\S]*height:\s*30px;/);
  assert.match(styles, /\.reference-analysis-switch-thumb\s*\{[\s\S]*transform:\s*translateX\(0\);/);
  assert.match(styles, /\.reference-analysis-auto-collapse\.is-active \.reference-analysis-switch-track\s*\{[\s\S]*background:\s*#34c759;/);
  assert.match(styles, /\.reference-analysis-auto-collapse\.is-active \.reference-analysis-switch-thumb\s*\{[\s\S]*transform:\s*translateX\(22px\);/);
  assert.match(styles, /\.reference-analysis-roles\s*\{/);
  assert.match(styles, /\.reference-analysis-role\s*\{[\s\S]*width:\s*auto;/);
  assert.match(styles, /\.reference-analysis-toggle\s*\{/);
  assert.match(styles, /\.reference-analysis-list\.hidden\s*\{/);
  assert.match(styles, /\.reference-analysis-view\s+\.reference-analysis-workspace\s*\{/);
  assert.match(styles, /\.reference-analysis-upload-panel\s*\{/);
  assert.match(styles, /\.reference-analysis-result-panel\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(styles, /\.reference-analysis-params\s*\{/);
  assert.match(styles, /\.reference-analysis-view\s+\.reference-grid\s*\{/);
  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"studio"[\s\S]*"style-transfer"[\s\S]*"reference-analysis"[\s\S]*"image-decomposition"[\s\S]*"quick-blend"[\s\S]*"image-compress"[\s\S]*"creation"[\s\S]*"article-illustration"[\s\S]*"ppt"[\s\S]*\]\);/);
  assert.match(app, /referenceAnalysis:\s*\{/);
  assert.match(app, /files:\s*\[\]/);
  assert.match(app, /autoCollapseOnApply:\s*true/);
  assert.match(app, /collapsed:\s*false/);
  assert.match(app, /generationKeys:\s*\[\]/);
  assert.match(app, /generationItems:\s*\{\}/);
  assert.match(app, /previewKey:\s*""/);
  assert.match(app, /selectedPrompt:\s*""/);
  assert.match(app, /referenceAnalysisDropzone:\s*document\.querySelector\("#referenceAnalysisDropzone"\),/);
  assert.match(app, /referenceAnalysisAutoCollapseButton:\s*document\.querySelector\("#referenceAnalysisAutoCollapseButton"\),/);
  assert.match(app, /referenceAnalysisGrid:\s*document\.querySelector\("#referenceAnalysisGrid"\),/);
  assert.match(app, /referenceAnalysisHead:\s*document\.querySelector\("#referenceAnalysisHead"\),/);
  assert.match(app, /referenceAnalysisRatioGrid:\s*document\.querySelector\("#referenceAnalysisRatioGrid"\),/);
  assert.match(app, /referenceAnalysisLanguageInput:\s*document\.querySelector\("#referenceAnalysisLanguageInput"\),/);
  assert.match(app, /referenceAnalysisSizeInput:\s*document\.querySelector\("#referenceAnalysisSizeInput"\),/);
  assert.match(app, /referenceAnalysisSelectedPrompt:\s*document\.querySelector\("#referenceAnalysisSelectedPrompt"\),/);
  assert.match(app, /referenceAnalysisSelectedPromptPanel:\s*document\.querySelector\("#referenceAnalysisSelectedPromptPanel"\),/);
  assert.match(app, /referenceAnalysisCopyPromptButton:\s*document\.querySelector\("#referenceAnalysisCopyPromptButton"\),/);
  assert.match(app, /referenceAnalysisGenerateButton:\s*document\.querySelector\("#referenceAnalysisGenerateButton"\),/);
  assert.match(app, /referenceAnalysisGenerationCanvas:\s*document\.querySelector\("#referenceAnalysisGenerationCanvas"\),/);
  assert.match(app, /referenceAnalysisGenerationDownloadButton:\s*document\.querySelector\("#referenceAnalysisGenerationDownloadButton"\),/);
  assert.match(app, /referenceAnalysisGenerationImage:\s*document\.querySelector\("#referenceAnalysisGenerationImage"\),/);
  assert.match(app, /referenceAnalysisGenerationMeta:\s*document\.querySelector\("#referenceAnalysisGenerationMeta"\),/);
  assert.match(app, /referenceAnalysisGenerationPlaceholder:\s*document\.querySelector\("#referenceAnalysisGenerationPlaceholder"\),/);
  assert.match(app, /referenceAnalysisGenerationStrip:\s*document\.querySelector\("#referenceAnalysisGenerationStrip"\),/);
  assert.match(app, /referenceAnalysisThumbnailEmpty:\s*document\.querySelector\("#referenceAnalysisThumbnailEmpty"\),/);
  assert.match(app, /referenceAnalysisToggleButton:\s*document\.querySelector\("#referenceAnalysisToggleButton"\),/);
  assert.match(app, /function applyReferenceAnalysisFiles\(fileList\) \{/);
  assert.match(app, /function renderReferenceAnalysisGrid\(\) \{/);
  assert.match(app, /function createReferenceAnalysisJob\(\) \{/);
  assert.match(app, /function registerReferenceAnalysisGenerationKey\(key\) \{/);
  assert.match(app, /function storeReferenceAnalysisGenerationItem\(item\) \{/);
  assert.match(app, /function replaceReferenceAnalysisGenerationKey\(oldKey, newKey\) \{/);
  assert.match(app, /function getReferenceAnalysisGenerationItemByKey\(key\) \{[\s\S]*state\.referenceAnalysis\.generationItems\[key\][\s\S]*state\.gallery\.find/);
  assert.match(app, /function preserveReferenceAnalysisGenerationItemForDelete\(item\) \{[\s\S]*state\.referenceAnalysis\.generationKeys\.includes\(key\)/);
  assert.match(app, /function getReferenceAnalysisGenerationPreviewEntries\(\) \{[\s\S]*state\.referenceAnalysis\.generationKeys[\s\S]*job\.mode === "reference-analysis"/);
  assert.match(app, /function setReferenceAnalysisGenerationPreviewKey\(key\) \{/);
  assert.match(app, /function renderReferenceAnalysisGenerationStrip\(\) \{/);
  assert.match(app, /refs\.referenceAnalysisThumbnailEmpty\.classList\.toggle\("hidden", entries\.length > 0\);/);
  assert.match(app, /function renderReferenceAnalysisGenerationPreview\(\) \{/);
  assert.match(app, /function openReferenceAnalysisGeneratedPreview\(\) \{[\s\S]*const item = getReferenceAnalysisGenerationPreviewItem\(\);[\s\S]*openLightbox\(item,\s*\{[\s\S]*items:\s*getReferenceAnalysisGenerationPreviewEntries\(\)\.map\(\(entry\) => entry\.item\),[\s\S]*\}\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.setAttribute\("role", "button"\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.setAttribute\("aria-label", "查看融图分析生成图"\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.addEventListener\("click", openReferenceAnalysisGeneratedPreview\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.addEventListener\("keydown", \(event\) => \{[\s\S]*event\.key === "Enter"[\s\S]*event\.key === " "[\s\S]*openReferenceAnalysisGeneratedPreview\(\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationStrip\.addEventListener\("click", \(event\) => \{[\s\S]*setReferenceAnalysisGenerationPreviewKey\(target\.dataset\.referenceAnalysisGenerationKey\);/);
  assert.match(app, /function renderReferenceAnalysisGenerationLoading\(item\) \{/);
  assert.match(app, /let referenceAnalysisLoadingShellNodes = null;/);
  assert.match(
    app,
    /renderReferenceAnalysisGenerationLoading\(item\)[\s\S]*createPreviewLoadingShellNodes\(\)[\s\S]*updatePreviewLoadingShell\(referenceAnalysisLoadingShellNodes, placeholderState\)/,
  );
  assert.match(app, /title:\s*"提示词模式生成中"/);
  assert.match(app, /function renderReferenceAnalysisSelectedPrompt\(\) \{/);
  assert.match(app, /function renderReferenceAnalysisRatioGrid\(\) \{/);
  assert.match(app, /function renderReferenceAnalysisSizeOptions\(\) \{/);
  assert.match(app, /function syncGenerationRatio\(value\) \{/);
  assert.match(app, /function syncGenerationSize\(value\) \{/);
  assert.match(app, /function syncReferenceAnalysisGenerationSize\(value\) \{/);
  assert.match(app, /function toggleReferenceAnalysisPanel\(\) \{/);
  assert.match(app, /function toggleReferenceAnalysisAutoCollapse\(\) \{/);
  assert.match(app, /refs\.referenceAnalysisList\.classList\.toggle\("hidden", state\.referenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.referenceAnalysisHead\.classList\.toggle\("hidden", state\.referenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.referenceAnalysisAutoCollapseButton\.classList\.toggle\("is-active", state\.referenceAnalysis\.autoCollapseOnApply\);/);
  assert.match(app, /refs\.referenceAnalysisAutoCollapseButton\.setAttribute\("aria-checked", String\(state\.referenceAnalysis\.autoCollapseOnApply\)\);/);
  assert.match(app, /refs\.referenceAnalysisToggleButton\.textContent = state\.referenceAnalysis\.collapsed \? "展开提示词" : "折叠提示词";/);
  assert.match(app, /roleGroup\.className = "reference-analysis-roles";/);
  assert.match(app, /button\.className = "inline-button reference-analysis-apply-pill";/);
  assert.match(app, /button\.classList\.toggle\("is-selected", isSelected\);/);
  assert.match(app, /button\.textContent = isSelected \? "已应用" : "应用提示词";/);
  assert.match(app, /async function buildReferenceAnalysisFormData\(\) \{/);
  assert.match(app, /formData\.set\("mode", "reference-orchestration"\);/);
  assert.match(app, /const REFERENCE_ORCHESTRATION_REASONING_EFFORT = "low";/);
  assert.match(
    app,
    /async function buildReferenceAnalysisFormData\(\) \{[\s\S]*formData\.set\(\s*"reasoningEffort",\s*REFERENCE_ORCHESTRATION_REASONING_EFFORT,\s*\);/,
  );
  assert.match(app, /state\.referenceAnalysis\.files\.map\(\(item\) => preparePromptAnalysisImageFile\(item\.file\)\)/);
  assert.match(app, /formData\.append\("image", file\);/);
  assert.match(app, /appendCurrentConfigToFormData\(formData\);/);
  assert.match(app, /const formData = await buildReferenceAnalysisFormData\(\);/);
  assert.match(app, /analysisSnapshot !== getReferenceAnalysisRequestSnapshot\(\)[\s\S]*body: formData,/);
  assert.match(app, /fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(app, /button\.dataset\.referenceAnalysisPromptIndex = String\(index\);/);
  assert.match(app, /function applyReferenceAnalysisPrompt\(index\) \{/);
  assert.match(app, /async function startReferenceAnalysisGeneration\(\) \{/);
  assert.match(app, /registerReferenceAnalysisGenerationKey\(makeJobPreviewKey\(job\.id\)\);/);
  assert.match(app, /refs\.referenceAnalysisGenerateButton\.disabled =\s*!promptText \|\| preparingReference;/);
  assert.doesNotMatch(app, /refs\.referenceAnalysisGenerateButton\.disabled =[\s\S]*getQueuedJobCount\(\) >= getMaxQueuedJobCount\(\);/);
  assert.match(app, /if \(job\.mode === "reference-analysis"\) \{[\s\S]*state\.referenceAnalysis\.previewKey = makeGalleryPreviewKey\(payload\.item\.filename\);/);
  assert.match(app, /if \(job\.mode === "reference-analysis"\) \{[\s\S]*payload\.item\.mode = "reference-analysis";[\s\S]*storeReferenceAnalysisGenerationItem\(payload\.item\);[\s\S]*replaceReferenceAnalysisGenerationKey\(makeJobPreviewKey\(job\.id\), makeGalleryPreviewKey\(payload\.item\.filename\)\);/);
  assert.match(app, /async function deleteGalleryItem\(item\) \{[\s\S]*preserveReferenceAnalysisGenerationItemForDelete\(item\),[\s\S]*preserveImageDecompositionGenerationItemForDelete\(item\),[\s\S]*state\.gallery = state\.gallery\.filter/);
  assert.match(app, /async function clearHistory\(\) \{[\s\S]*state\.gallery\.flatMap\(\(item\) => \[[\s\S]*preserveReferenceAnalysisGenerationItemForDelete\(item\),[\s\S]*preserveImageDecompositionGenerationItemForDelete\(item\),[\s\S]*state\.gallery = \[\];/);
  const referenceApplyBody =
    app.match(/function applyReferenceAnalysisPrompt\(index\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction mapPromptAgentPrompt/)?.[0] || "";
  assert.match(referenceApplyBody, /state\.referenceAnalysis\.selectedPrompt = promptText;/);
  assert.match(referenceApplyBody, /if \(state\.referenceAnalysis\.autoCollapseOnApply\) \{[\s\S]*state\.referenceAnalysis\.collapsed = true;/);
  assert.match(referenceApplyBody, /renderReferenceAnalysis\(\);/);
  assert.doesNotMatch(referenceApplyBody, /refs\.promptInput\.value|setActiveView\("studio"\)|refs\.promptInput\.focus/);
  assert.match(app, /refs\.referenceAnalyzeButton\.disabled = state\.referenceAnalysis\.running;/);
  assert.match(app, /renderInlineBusyButton\(refs\.referenceAnalyzeButton,[\s\S]*busy:\s*state\.referenceAnalysis\.running/);
  assert.match(app, /refs\.referenceAnalysisToggleButton\.addEventListener\("click", toggleReferenceAnalysisPanel\);/);
  assert.match(app, /refs\.referenceAnalysisAutoCollapseButton\.addEventListener\("click", toggleReferenceAnalysisAutoCollapse\);/);
  assert.match(app, /refs\.referenceAnalysisGenerateButton\.addEventListener\("click", \(\) => \{[\s\S]*startReferenceAnalysisGeneration\(\)\.catch/);
  assert.match(app, /setReferenceAnalysisFeedback\("图形分析需要上传参考图。", "error"\);/);
  assert.match(app, /refs\.referenceAnalysisDropzone\.addEventListener\("dragover",[\s\S]*event\.preventDefault\(\);[\s\S]*classList\.add\("dragover"\);/);
  assert.match(app, /refs\.referenceAnalysisDropzone\.addEventListener\("drop",[\s\S]*event\.preventDefault\(\);[\s\S]*applyReferenceAnalysisFiles\(event\.dataTransfer\?\.files\);/);
  assert.match(app, /refs\.referenceAnalysisSizeInput\.addEventListener\("change",[\s\S]*syncReferenceAnalysisGenerationSize\(event\.target\.value\);/);
  assert.match(app, /renderRatioGrid\(refs\.referenceAnalysisRatioGrid, refs\.referenceAnalysisRatioInput, syncReferenceAnalysisRatio\)/);
  const generationRatioBody = app.match(/function syncGenerationRatio\(value\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(generationRatioBody, /referenceAnalysis/);
  assert.match(app, /refs\.referenceAnalysisCopyPromptButton\.addEventListener\("click",[\s\S]*copyReferenceAnalysisSelectedPrompt\(\)\.catch/);
});

test("direct prompt applications keep reference analysis independent", async () => {
  const app = await readFile(appPath, "utf8");
  const referenceApplyBody =
    app.match(/function applyReferenceAnalysisPrompt\(index\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction mapPromptAgentPrompt/)?.[0] || "";

  assert.match(app, /function applyPromptTemplate\(templateId = ""\) \{[\s\S]*refs\.promptInput\.value = prompt;[\s\S]*updatePromptCounter\(\);/);
  assert.match(referenceApplyBody, /state\.referenceAnalysis\.selectedPrompt = promptText;[\s\S]*if \(state\.referenceAnalysis\.autoCollapseOnApply\) \{[\s\S]*state\.referenceAnalysis\.collapsed = true;[\s\S]*renderReferenceAnalysis\(\);/);
  assert.doesNotMatch(referenceApplyBody, /refs\.promptInput\.value|updatePromptCounter\(\)|setActiveView\("studio"\)|refs\.promptInput\.focus/);
  assert.doesNotMatch(referenceApplyBody, /currentPrompt|includes\(promptText\)|`\\$\\{currentPrompt\\}\\n\\n\\$\\{promptText\\}`/);
  assert.match(app, /function mapPromptAgentPrompt\(itemId\) \{[\s\S]*refs\.promptInput\.value = promptText;[\s\S]*updatePromptCounter\(\);/);
});

test("studio error surfaces compact long upstream HTTP failures before rendering", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<div class="error-banner hidden" id="errorBanner" role="alert" aria-live="assertive"><\/div>/);
  assert.match(app, /function compactErrorMessage\(message, fallbackLabel = "请求失败"\)/);
  assert.match(app, /payload\?\.error\?\.message \|\| payload\?\.message \|\| payload\?\.detail/);
  assert.match(app, /payload\?\.error\?\.param \|\| payload\?\.param/);
  assert.match(
    app,
    /function showError\(message\) \{\s*refs\.errorBanner\.classList\.remove\("hidden"\);\s*refs\.errorBanner\.textContent = compactErrorMessage\(message\);/,
  );
  assert.match(app, /refs\.errorBanner\.textContent = compactErrorMessage\(message\);/);
  assert.match(app, /compactErrorMessage\(message, "生成请求失败"\)/);
  assert.match(app, /compactErrorMessage\(message, "图片分析请求失败"\)/);
  assert.match(app, /JSON\.parse\(text\)/);
  assert.match(app, /detail\.length > 220/);
  assert.match(app, /"error_code"\\s\*:\\s\*"\?\(\[A-Za-z0-9_\.-\]\+\)"\?/);
});

test("floating workbench surfaces capture and restore focus", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const overlayFocusTriggers = new Map\(\);/);
  assert.match(app, /function captureOverlayTrigger\(name\) \{/);
  assert.match(app, /function focusOverlayTarget\(target\) \{/);
  assert.match(app, /function restoreOverlayTriggerFocus\(name\) \{/);
  assert.match(app, /function setPromptAgentOpen\(open, \{ restoreFocus = true \} = \{\}\) \{/);
  assert.match(app, /if \(open\) \{[\s\S]*captureOverlayTrigger\("config"\);[\s\S]*focusOverlayTarget\(refs\.closeConfigButton\);/);
  assert.match(app, /else \{[\s\S]*restoreOverlayTriggerFocus\("config"\);[\s\S]*\}/);
  assert.match(app, /if \(open\) \{[\s\S]*captureOverlayTrigger\("prompt-agent"\);[\s\S]*focusOverlayTarget\(refs\.promptAgentCloseButton\);/);
  assert.match(app, /else if \(restoreFocus\) \{[\s\S]*restoreOverlayTriggerFocus\("prompt-agent"\);[\s\S]*\}/);
  assert.match(app, /setPromptAgentOpen\(false, \{ restoreFocus: false \}\);[\s\S]*refs\.promptInput\.focus\(\);/);
  assert.match(app, /captureOverlayTrigger\("lightbox"\);[\s\S]*setLightboxOpen\(true\);[\s\S]*focusOverlayTarget\(refs\.lightboxClose\);/);
  assert.match(app, /setLightboxOpen\(false\);[\s\S]*restoreOverlayTriggerFocus\("lightbox"\);/);
});

test("studio layout consumes density variables for wide-screen adaptation without changing structure", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.app-shell\s*\{[\s\S]*min\(var\(--app-shell-max-width,\s*1680px\),\s*calc\(100vw - 20px\)\);[\s\S]*padding:\s*var\(--app-shell-padding-top,\s*8px\)\s*0\s*var\(--app-shell-padding-bottom,\s*10px\);/);
  assert.match(styles, /\.topbar\s*\{[\s\S]*gap:\s*var\(--topbar-gap,\s*18px\);[\s\S]*padding:\s*var\(--topbar-padding,\s*6px 10px 14px\);/);
  assert.match(styles, /\.view-root\s*\{[\s\S]*min-height:\s*calc\(100svh - var\(--view-root-offset,\s*12px\)\);[\s\S]*height:\s*calc\(100svh - var\(--view-root-offset,\s*12px\)\);/);
  assert.match(styles, /\.studio-grid\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\)\s*minmax\(0,\s*1fr\);[\s\S]*gap:\s*var\(--studio-grid-gap,\s*14px\);/);
  assert.match(styles, /\.studio-panel,\s*[\r\n]+\s*\.drawer-panel,\s*[\r\n]+\s*\.lightbox-dialog\s*\{[\s\S]*padding:\s*var\(--panel-padding,\s*12px\);/);
  assert.match(styles, /\.settings-form\s*\{[\s\S]*gap:\s*calc\(var\(--field-gap,\s*6px\) \+ 6px\);/);
  assert.match(
    styles,
    /\.settings-form\s*\{[\s\S]*min-width:\s*0;[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/,
  );
  assert.match(styles, /textarea,\s*[\r\n]+\s*input,\s*[\r\n]+\s*select\s*\{[\s\S]*padding:\s*var\(--input-padding-y,\s*10px\)\s*var\(--input-padding-x,\s*12px\);/);
  assert.match(styles, /textarea\s*\{[\s\S]*min-height:\s*var\(--textarea-min-height,\s*96px\);/);
  assert.match(styles, /\.ratio-chip\s*\{[\s\S]*min-height:\s*var\(--ratio-chip-height,\s*48px\);/);
  assert.match(styles, /\.reference-dropzone\s*\{[\s\S]*min-height:\s*var\(--reference-dropzone-min-height,\s*140px\);/);
  assert.match(styles, /\.generate-button\s*\{[\s\S]*min-height:\s*var\(--generate-button-height,\s*42px\);/);
  assert.match(styles, /\.timeline-item\s*\{[\s\S]*padding:\s*var\(--timeline-item-padding-y,\s*8px\)\s*0;/);
  assert.match(styles, /\.recent-item\s*\{[\s\S]*padding:\s*var\(--recent-item-padding,\s*8px\);[\s\S]*grid-template-columns:\s*var\(--recent-thumb-size,\s*60px\)\s*minmax\(0,\s*1fr\)\s*auto;/);
  assert.match(styles, /\.recent-item img\s*\{[\s\S]*width:\s*var\(--recent-thumb-size,\s*60px\);[\s\S]*height:\s*var\(--recent-thumb-size,\s*60px\);/);
  assert.match(app, /document\.documentElement\.dataset\.uiLayout = layoutMode;/);
  assert.match(styles, /html\[data-ui-layout="stacked"\] \.studio-grid,/);
  assert.match(styles, /html\[data-ui-layout="narrow-desktop"\] \.studio-grid\s*\{/);
});

test("every density keeps the desktop app shell flush without a viewport breakpoint jump", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /\.app-shell\s*\{\s*width:\s*min\(var\(--app-shell-max-width,\s*1680px\),\s*calc\(100vw - 20px\)\);/,
  );
  assert.doesNotMatch(styles, /html\[data-ui-density="wide"\] \.app-shell\s*\{/);
  assert.match(app, /document\.documentElement\.dataset\.uiDensity = settings\.mode;/);
  assert.doesNotMatch(styles, /@media \(min-width:\s*2200px\)[\s\S]*?\.app-shell/);
});

test("the app shell and the fixed desktop topbar resolve to the same width at every density", async () => {
  const { getStudioDensitySettings } = await import("../lib/studio-density.mjs");
  const shellWidthRule = /width:\s*min\(var\(--app-shell-max-width,\s*1680px\),\s*calc\(100vw - 20px\)\)/g;
  const styles = await readFile(stylesPath, "utf8");

  // .app-shell and the fixed desktop .topbar must share one width formula, so a
  // wider shell can never leave the topbar stranded mid-viewport.
  assert.equal([...styles.matchAll(shellWidthRule)].length, 2);

  for (const [width, height] of [[1440, 810], [1680, 960], [1920, 990], [2560, 1350], [3840, 2070]]) {
    const settings = getStudioDensitySettings({
      width,
      height,
      outerWidth: width,
      devicePixelRatio: 1,
      visualScale: 1,
    });
    const shellMaxWidth = Number.parseFloat(settings.variables["--app-shell-max-width"]);

    assert.equal(Math.min(shellMaxWidth, width - 20), width - 20, `${width}x${height}`);
  }
});

test("image upload zones collapse into compact thumbnail grids after files are present", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.reference-dropzone\.is-compact-hidden\s*\{[\s\S]*position:\s*absolute;[\s\S]*clip-path:\s*inset\(50%\);/);
  assert.match(styles, /\.reference-add-card\s*\{/);
  assert.match(styles, /\.reference-add-button\s*\{/);
  assert.match(styles, /\.style-transfer-upload-grid\.uses-preset-style \.style-transfer-source-slot\s*\{[\s\S]*width:\s*calc\(\(100% - 12px\) \/ 2\);[\s\S]*justify-self:\s*center;/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-dropzone\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1;[\s\S]*height:\s*auto;/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot:has\(\.style-transfer-dropzone\.is-compact-hidden\)\s*\{[\s\S]*grid-template-rows:\s*minmax\(132px,\s*auto\);/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-grid \.reference-preview-button\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1;[\s\S]*height:\s*auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.style-transfer-upload-grid\.uses-preset-style \.style-transfer-source-slot\s*\{[\s\S]*width:\s*100%;/);

  assert.match(app, /function syncReferenceDropzoneCompact\(dropzone, hasFiles\) \{/);
  assert.match(app, /function createReferenceAddCard\(\{ input, label, onFiles \}\) \{/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.referenceDropzone, state\.referenceFiles\.length > 0\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.referenceAnalysisDropzone, state\.referenceAnalysis\.files\.length > 0\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.creationReferenceDropzone, state\.creationReferenceFiles\.length > 0\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.styleTransferSourceDropzone, Boolean\(getStyleTransferReferenceItem\("source"\)\)\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.styleTransferStyleDropzone, Boolean\(getStyleTransferReferenceItem\("style"\)\)\);/);

  assert.match(app, /refs\.referenceGrid\.appendChild\(\s*createReferenceAddCard\(\{[\s\S]*input:\s*refs\.referenceInput,[\s\S]*onFiles:\s*applyReferenceFiles/);
  assert.match(app, /refs\.referenceAnalysisGrid\.appendChild\(\s*createReferenceAddCard\(\{[\s\S]*input:\s*refs\.referenceAnalysisInput,[\s\S]*onFiles:\s*applyReferenceAnalysisFiles/);
  assert.match(app, /refs\.creationReferenceGrid\.appendChild\(\s*createReferenceAddCard\(\{[\s\S]*input:\s*refs\.creationReferenceInput,[\s\S]*onFiles:\s*applyCreationReferenceFiles/);
  assert.doesNotMatch(app, /styleTransferSourceGrid\.appendChild\(\s*createReferenceAddCard/);
  assert.doesNotMatch(app, /styleTransferStyleGrid\.appendChild\(\s*createReferenceAddCard/);
});

test("studio entry defaults to square ratio", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<input id="ratioInput" name="ratio" type="hidden" value="1:1" \/>/);
  assert.match(app, /const DEFAULT_UI_RATIO = "1:1";/);
  assert.doesNotMatch(app, /\|\| "4:5"/);
});

test("mobile and Pad studio layout uses dedicated compact workbench layouts", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const referenceAdaptiveSection = html.match(/<details[\s\S]*id="referenceAdaptiveSection"[\s\S]*?<\/details>/)?.[0] || "";
  const parameterAdaptiveSection = html.match(/<details[\s\S]*id="parameterAdaptiveSection"[\s\S]*?<\/details>/)?.[0] || "";
  const tabletAppShellRule = readCssRule(styles, 'html[data-ui-layout="tablet"] .app-shell');
  const tabletViewRootRule = readCssRule(styles, 'html[data-ui-layout="tablet"] .view-root');

  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover" \/>/);
  assert.match(html, /id="referenceAdaptiveSection"[\s\S]*data-adaptive-section="reference"[\s\S]*data-compact-open="false"[\s\S]*<summary class="field-heading adaptive-section-summary">/);
  assert.match(html, /id="parameterAdaptiveSection"[\s\S]*data-adaptive-section="parameters"[\s\S]*data-compact-open="false"[\s\S]*<summary class="field-heading adaptive-section-summary">/);
  assert.match(html, /dataset\.uiLayout = "mobile";[\s\S]*dataset\.uiLayout = "tablet";/);
  assert.match(html, /devicePixelRatio[\s\S]*isPhonePhysicalSize[\s\S]*isTabletPhysicalSize[\s\S]*physicalTouchWidth/);
  assert.match(html, /const viewportWidth = outerWidth > innerWidth \? outerWidth : innerWidth;/);
  assert.doesNotMatch(referenceAdaptiveSection, /\sopen(?:\s|>)/);
  assert.doesNotMatch(parameterAdaptiveSection, /\sopen(?:\s|>)/);
  assert.match(styles, /html,\s*[\r\n]+body\s*\{[\s\S]*overflow-x:\s*clip;/);
  assert.match(tabletAppShellRule, /height:\s*100dvh;/);
  assert.match(tabletAppShellRule, /grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(tabletAppShellRule, /overflow:\s*hidden;/);
  assert.match(tabletViewRootRule, /height:\s*100%;/);
  assert.match(tabletViewRootRule, /min-height:\s*0;/);
  assert.match(tabletViewRootRule, /overflow:\s*hidden;/);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.app-shell\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*100dvh;[\s\S]*display:\s*block;[\s\S]*overflow:\s*visible;/,
  );
  assert.match(styles, /html\[data-ui-layout="tablet"\]\[data-ui-orientation="portrait"\] \.studio-grid,[\s\S]*html\[data-ui-layout="stacked"\]\[data-ui-orientation="portrait"\] \.studio-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*grid-template-areas:\s*"settings"[\s\S]*"preview";/);
  assert.match(styles, /@media \(min-width:\s*900px\) and \(min-height:\s*600px\)[\s\S]*html\[data-ui-orientation="landscape"\]\[data-ui-layout="tablet"\] \.studio-grid,[\s\S]*html\[data-ui-orientation="landscape"\]\[data-ui-layout="stacked"\] \.studio-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*380px\)\s*minmax\(0,\s*1fr\);[\s\S]*grid-template-areas:\s*"settings preview";[\s\S]*height:\s*calc\(var\(--visual-viewport-height,\s*100dvh\)\s*-\s*var\(--view-root-offset,\s*12px\)\);[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /html\[data-ui-orientation="landscape"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.settings-panel,\s*\.preview-panel\)\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /html\[data-ui-orientation="landscape"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.settings-form\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*auto;/);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.studio-grid\s*\{[\s\S]*grid-template-rows:\s*none;[\s\S]*"settings"[\s\S]*"preview";[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/,
  );
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.preview-panel\s*\{[\s\S]*grid-area:\s*preview;[\s\S]*height:\s*100%;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.preview-panel\s*\{[\s\S]*grid-area:\s*preview;[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.settings-form\s*\{[\s\S]*height:\s*100%;[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.settings-form\s*\{[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.preview-canvas\s*\{[\s\S]*min-height:\s*clamp\(180px,\s*36svh,\s*280px\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.ratio-grid\s*\{[\s\S]*display:\s*flex;[\s\S]*overflow-x:\s*auto;[\s\S]*scrollbar-width:\s*thin;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.reference-dropzone\s*\{[\s\S]*min-height:\s*48px;[\s\S]*grid-template-columns:\s*30px\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.filmstrip-item span\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.adaptive-section,[\s\S]*html\[data-ui-layout="mobile"\] \.adaptive-section\s*\{[\s\S]*border-radius:\s*14px;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.adaptive-section-summary,[\s\S]*html\[data-ui-layout="mobile"\] \.adaptive-section-summary\s*\{[\s\S]*min-height:\s*44px;[\s\S]*cursor:\s*pointer;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.adaptive-section\[open\] > \.adaptive-section-summary::after,[\s\S]*html\[data-ui-layout="mobile"\] \.adaptive-section\[open\] > \.adaptive-section-summary::after\s*\{/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.advanced-controls\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.preview-toolbar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.zoom-controls\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.preview-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(app, /const ADAPTIVE_COLLAPSIBLE_LAYOUTS = new Set\(\["stacked", "tablet", "mobile"\]\);/);
  assert.match(app, /studio-density\.mjs\?v=20260713-cross-device-1/);
  assert.match(app, /function getStudioViewportMetrics\(\) \{[\s\S]*coarsePointer:\s*window\.matchMedia\?\.\("\(pointer: coarse\)"\)\?\.matches \|\| false,/);
  assert.match(app, /function syncAdaptiveWorkbenchSections\(layoutMode = getCurrentStudioLayoutMode\(\)\) \{/);
  assert.match(app, /section\.open = section\.dataset\.compactOpen === "true";/);
  assert.match(app, /function bindAdaptiveWorkbenchSections\(\) \{/);
});

test("compact preview toolbar keeps controls evenly distributed and centered", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const previewActions = html.match(
    /<div class="preview-actions">[\s\S]*?id="previewDownloadButton"[\s\S]*?id="previewLightboxButton"[\s\S]*?id="previewDeleteButton"[\s\S]*?<\/div>/,
  )?.[0] || "";
  const previewActionButtonRule = readCssRule(styles, ".preview-actions .toolbar-button");
  const zoomLabelRule = readCssRule(styles, ".zoom-label");

  assert.match(previewActions, /<a class="toolbar-button" id="previewDownloadButton"[^>]*>下载<\/a>/);
  assert.match(previewActions, /id="previewAddReferenceButton"[^>]*>添加到参考图<\/button>/);
  assert.match(
    previewActions,
    /id="previewDownloadButton"[\s\S]*id="previewLightboxButton"[\s\S]*id="previewDeleteButton"/,
  );
  assert.match(previewActionButtonRule, /display:\s*inline-flex;/);
  assert.match(previewActionButtonRule, /align-items:\s*center;/);
  assert.match(previewActionButtonRule, /justify-content:\s*center;/);
  assert.match(previewActionButtonRule, /text-align:\s*center;/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.zoom-controls,\s*html\[data-ui-layout="mobile"\] \.zoom-controls\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.preview-actions,\s*html\[data-ui-layout="mobile"\] \.preview-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(zoomLabelRule, /display:\s*grid;/);
  assert.match(zoomLabelRule, /place-items:\s*center;/);
});

test("compact image decomposition keeps operation panels before results without implicit grid tracks", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const workspace = html.match(/<div class="image-decomposition-workspace">[\s\S]*?<\/section>\s*<\/div>/)?.[0] || "";

  assert.ok(
    workspace.indexOf("image-decomposition-upload-panel") < workspace.indexOf("image-decomposition-preview-panel"),
    "image decomposition operations should precede the result panel in DOM order",
  );
  assert.match(
    styles,
    /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.image-decomposition-workspace\s*\{[\s\S]*grid-template-areas:\s*none;[\s\S]*grid-auto-flow:\s*row;/,
  );
  assert.match(
    styles,
    /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.image-decomposition-preview-panel\s*\{[\s\S]*grid-area:\s*auto;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\]\[data-ui-orientation="portrait"\] :is\(\.image-decomposition-upload-panel,\s*\.image-decomposition-form\),[\s\S]*html\[data-ui-layout="mobile"\] :is\(\.image-decomposition-upload-panel,\s*\.image-decomposition-form\)\s*\{[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/,
  );
});

test("compact creation menu entries keep touch-sized targets", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const creationMenu = html.match(/id="nav-menu-studio"[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";

  assert.match(creationMenu, /class="mega-menu-link[^"\n]*" href="#image-decomposition"/);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] :is\(\.mega-menu-link,\s*\.mega-menu-action\),[\s\S]*html\[data-ui-input="coarse"\]\[data-ui-layout="tablet"\] :is\(\.mega-menu-link,\s*\.mega-menu-action\),[\s\S]*html\[data-ui-input="coarse"\]\[data-ui-layout="stacked"\] :is\(\.mega-menu-link,\s*\.mega-menu-action\)\s*\{[\s\S]*min-block-size:\s*44px;[\s\S]*align-items:\s*center;/,
  );
});

test("compact config menu actions keep touch-sized targets", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const configMenu = html.match(/id="nav-menu-settings"[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";

  assert.match(configMenu, /class="mega-menu-action large"[^>]*data-nav-action="config"/);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] :is\(\.mega-menu-link,\s*\.mega-menu-action\),[\s\S]*html\[data-ui-input="coarse"\]\[data-ui-layout="tablet"\] :is\(\.mega-menu-link,\s*\.mega-menu-action\),[\s\S]*html\[data-ui-input="coarse"\]\[data-ui-layout="stacked"\] :is\(\.mega-menu-link,\s*\.mega-menu-action\)\s*\{[\s\S]*min-block-size:\s*44px;/,
  );
});

test("compact gallery tiles keep a 44px hit area without distorting images", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.gallery-tile img\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*auto;/);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.gallery-masonry,[\s\S]*html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.gallery-masonry\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(44px,\s*1fr\)\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.gallery-tile,[\s\S]*html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.gallery-tile\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/,
  );
});

test("compact creation logo and card actions keep touch-sized targets", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] :is\(\.creation-logo-library-button,\s*\.creation-card-actions \.mini-action\),[\s\S]*html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.creation-logo-library-button,\s*\.creation-card-actions \.mini-action\)\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/,
  );
});

test("compact quick blend clear controls keep touch-sized targets", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal((html.match(/class="quick-blend-clear-button"/g) || []).length, 4);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.quick-blend-clear-button,[\s\S]*html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.quick-blend-clear-button\s*\{[\s\S]*min-block-size:\s*44px;/,
  );
});

test("compact PPT source labels keep touch-sized targets", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal((html.match(/class="ppt-source-option"/g) || []).length, 3);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.ppt-source-option,[\s\S]*html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.ppt-source-option\s*\{[\s\S]*min-block-size:\s*44px;/,
  );
});

test("compact portrait library location style and shot controls keep touch-sized targets", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(html, /class="mini-action portrait-accessory-asset-button"[\s\S]*>搭配库<\/button>/);
  assert.match(html, /class="portrait-location-toggle"[\s\S]*<span>地点写真<\/span>/);
  assert.equal((html.match(/name="portraitStyles"/g) || []).length, 9);
  assert.equal((html.match(/name="portraitShotTypes"/g) || []).length, 5);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] :is\(\.portrait-accessory-asset-button,\s*\.portrait-location-toggle,\s*\.portrait-style-grid label,\s*\.portrait-shot-grid label\),[\s\S]*html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.portrait-accessory-asset-button,\s*\.portrait-location-toggle,\s*\.portrait-style-grid label,\s*\.portrait-shot-grid label\)\s*\{[\s\S]*min-block-size:\s*44px;/,
  );
});

test("coarse compact image decomposition actions and selects keep touch-sized targets", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /html\[data-ui-input="coarse"\]:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.image-decomposition-generate-button,\s*\.image-decomposition-parameter-settings select\)\s*\{[\s\S]*min-block-size:\s*44px;/,
  );
});

test("compact Gallery uses native scrolling without a separate arrow rail", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal((html.match(/class="gallery-scroll-arrow"/g) || []).length, 0);
  assert.doesNotMatch(html, /id="galleryScrollThumb"|id="galleryScrollbar"/);
  assert.match(styles, /\.gallery-scroll-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.gallery-scroll-region\s*\{[\s\S]*-webkit-overflow-scrolling:\s*touch;/);
});

test("low-height coarse stacked Studio keeps reveal and core controls touch-sized", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="topbarRevealButton"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="globalTopbar"/);
  assert.match(html, /class="toolbar-button" id="creationPlanButton"/);
  assert.match(html, /class="generate-button" id="creationGenerateButton"/);
  assert.match(html, /id="creationLogoBackgroundInput"[\s\S]*name="logoBackground"/);
  assert.match(html, /class="header-button" id="closeConfigButton"/);
  assert.match(html, /class="inline-button endpoint-full-toggle" id="baseUrlFullToggle"/);
  assert.match(html, /class="inline-button" id="fetchModelsButton"/);
  assert.match(html, /class="header-button" id="testConnectionButton"/);
  assert.match(html, /class="generate-button" type="submit" data-ui-i18n="save"/);
  assert.match(app, /function isTopbarRevealLayout\(\) \{[\s\S]*return true;/);
  assert.match(app, /refs\.topbarRevealButton\?\.addEventListener\("click",[\s\S]*setTopbarReveal\(/);
  assert.match(
    styles,
    /html\[data-ui-input="coarse"\]\[data-ui-layout="stacked"\] \.topbar-reveal-button\s*\{[\s\S]*position:\s*fixed;[\s\S]*display:\s*inline-grid;[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/,
  );
  assert.match(
    styles,
    /html\[data-ui-input="coarse"\]\[data-ui-layout="stacked"\]\.topbar-reveal \.topbar\s*\{[\s\S]*transform:\s*translate\(-50%,\s*0\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-input="coarse"\]\[data-ui-layout="stacked"\] :is\([\s\S]*\.view-tab,[\s\S]*\.header-button,[\s\S]*\.inline-button,[\s\S]*\.toolbar-button,[\s\S]*\.icon-button,[\s\S]*\.generate-button,[\s\S]*\.ratio-chip,[\s\S]*input:not\(\[type="hidden"\]\)[\s\S]*select,[\s\S]*#lightboxClose[\s\S]*\)\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/,
  );
});

test("cross-device workbench keeps touch targets overflow and overlays reachable", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /html,\s*[\r\n]+body\s*\{[\s\S]*max-width:\s*100%;[\s\S]*overflow-x:\s*clip;/);
  assert.match(styles, /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\s*\.studio-grid,[\s\S]*\.ppt-record-view\s*\)\s*\{[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;/);
  assert.match(styles, /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.panel-title,\s*\.field-heading,[\s\S]*\.prompt-agent-feedback\)\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] :is\([\s\S]*\.generate-button[\s\S]*#lightboxClose[\s\S]*\)\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/);
  assert.match(styles, /html\[data-ui-input="coarse"\]\[data-ui-layout="tablet"\] :is\([\s\S]*\.generate-button[\s\S]*#lightboxClose[\s\S]*\)\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/);
  assert.match(styles, /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) #surprisePromptButton\s*\{[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/);
  assert.match(styles, /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.ratio-grid,\s*\.filmstrip,\s*\.gallery-top-actions,\s*\.article-record-actions,\s*\.creation-record-actions,\s*\.ppt-record-actions\)\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*scrollbar-width:\s*thin;/);
  assert.match(styles, /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) :is\(\.drawer-panel,\s*\.prompt-agent-dialog,\s*\.prompt-agent-image-viewer-dialog,\s*\.prompt-template-panel,\s*\.portrait-accessory-asset-panel,\s*\.ppt-edit-dialog,\s*\.lightbox-dialog\)\s*\{[\s\S]*max-height:\s*calc\(var\(--visual-viewport-height,\s*100dvh\)[\s\S]*env\(safe-area-inset-top\)[\s\S]*env\(safe-area-inset-bottom\)[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /html:is\(\[data-ui-layout="mobile"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="stacked"\]\) \.lightbox-dialog\s*\{[\s\S]*grid-template-rows:\s*auto\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.lightbox-top\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;/);
  assert.match(app, /document\.documentElement\.dataset\.uiOrientation = viewportMetrics\.width >= viewportMetrics\.height \? "landscape" : "portrait";/);
  assert.match(app, /document\.documentElement\.dataset\.uiInput = viewportMetrics\.coarsePointer \? "coarse" : "fine";/);
  assert.match(app, /document\.documentElement\.style\.setProperty\("--visual-viewport-height", `\$\{visualViewportHeight\}px`\);/);
});

test("responsive viewport sync updates root layout metadata without rebuilding workflow nodes", async () => {
  const app = await readFile(appPath, "utf8");
  const syncBody = app.match(/function syncStudioDensity\(\) \{[\s\S]*?\r?\n\}\r?\nfunction scheduleStudioDensitySync/)?.[0] || "";
  const scheduleBody = app.match(/function scheduleStudioDensitySync\(\) \{[\s\S]*?\r?\n\}\r?\nlet densityZoomEndTimer/)?.[0] || "";

  assert.match(syncBody, /dataset\.uiLayout = layoutMode/);
  assert.match(syncBody, /dataset\.uiOrientation/);
  assert.match(syncBody, /dataset\.uiInput/);
  assert.match(syncBody, /--visual-viewport-height/);
  assert.doesNotMatch(syncBody, /appendChild|replaceChildren|innerHTML|outerHTML|createElement|cloneNode/);
  assert.match(scheduleBody, /syncStudioDensity\(\)/);
  assert.match(scheduleBody, /syncGalleryLayoutMode\(\)/);
  assert.doesNotMatch(scheduleBody, /renderGalleryView|appendChild|replaceChildren|innerHTML|outerHTML|createElement|cloneNode/);
  assert.match(app, /window\.addEventListener\("resize", scheduleStudioDensitySync\);/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\("resize", scheduleStudioDensitySync\);/);
});

test("tablet and mobile topbars auto-hide while keeping mode status visible", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.topbar,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.topbar\s*\{[\s\S]*position:\s*fixed;[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*center;[\s\S]*transform:\s*translate\(-50%,\s*calc\(-100% \+ var\(--topbar-trigger-height,\s*10px\)\)\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.topbar:hover,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.topbar:hover,\s*[\s\S]*html\[data-ui-layout="tablet"\]\.topbar-reveal \.topbar,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\]\.topbar-reveal \.topbar,[\s\S]*\{[\s\S]*transform:\s*translate\(-50%,\s*0\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.brand-cluster,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.brand-cluster,\s*[\r\n]+\s*html\[data-ui-layout="tablet"\] \.topbar-api-check,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.topbar-api-check,\s*[\r\n]+\s*html\[data-ui-layout="tablet"\] \.nav-tab-note,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.nav-tab-note\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.generation-mode-status,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.generation-mode-status\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*white-space:\s*nowrap;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.global-nav-list,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\] \.global-nav-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*max-content\);[\s\S]*overflow:\s*visible;/,
  );
  assert.match(app, /function isTopbarRevealLayout\(\) \{[\s\S]*return true;/);
});

test("tablet and mobile topbars provide an explicit keyboard-accessible reveal control", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<button[^>]*id="topbarRevealButton"[^>]*type="button"[^>]*aria-expanded="false"[^>]*aria-controls="globalTopbar"/);
  assert.match(html, /<header class="topbar" id="globalTopbar">/);
  assert.match(styles, /\.topbar-reveal-button\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.topbar-reveal-button,[\s\S]*html\[data-ui-layout="mobile"\] \.topbar-reveal-button\s*\{[\s\S]*display:\s*inline-grid;[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
  assert.match(styles, /html\[data-ui-layout="tablet"\]\.topbar-reveal \.topbar-reveal-button,[\s\S]*html\[data-ui-layout="mobile"\]\.topbar-reveal \.topbar-reveal-button\s*\{[\s\S]*top:\s*calc\(max\(2px, env\(safe-area-inset-top\)\) \+ 48px\);/);
  assert.match(app, /topbarRevealButton:\s*document\.querySelector\("#topbarRevealButton"\)/);
  assert.match(app, /refs\.topbarRevealButton\?\.addEventListener\("click", \(event\) => \{[\s\S]*event\.stopPropagation\(\);/);
  assert.match(app, /setAttribute\("aria-expanded", String\(shouldOpen\)\)/);
  assert.match(app, /target\?\.closest\("\.topbar-reveal-button"\)\) return;/);
  assert.match(app, /focusInRevealButton = refs\.topbarRevealButton\?\.contains\(document\.activeElement\)/);
});

test("config drawer suppresses auto-hidden topbar reveal on tablet and mobile", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const TOPBAR_SUPPRESSED_CLASS = "topbar-suppressed";/);
  assert.match(
    app,
    /function isTopbarRevealSuppressed\(\) \{[\s\S]*return document\.documentElement\.classList\.contains\(TOPBAR_SUPPRESSED_CLASS\);[\s\S]*\}/,
  );
  assert.match(
    app,
    /const shouldOpen = Boolean\(open\) && isTopbarRevealLayout\(\) && !isTopbarRevealSuppressed\(\);/,
  );
  assert.match(
    app,
    /refs\.configDrawer\.classList\.toggle\("open", open\);[\s\S]*document\.documentElement\.classList\.toggle\(TOPBAR_SUPPRESSED_CLASS, open\);[\s\S]*if \(open\) \{[\s\S]*setTopbarReveal\(false\);/,
  );
  assert.match(
    styles,
    /html\.topbar-suppressed\[data-ui-layout="tablet"\] \.topbar,\s*[\r\n]+\s*html\.topbar-suppressed\[data-ui-layout="mobile"\] \.topbar\s*\{[\s\S]*pointer-events:\s*none;[\s\S]*transform:\s*translate\(-50%,\s*calc\(-100% \+ var\(--topbar-trigger-height,\s*10px\)\)\);/,
  );
});

test("studio columns use synchronized desktop height so wide screens do not leave a dead zone under the workspace", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const studioGridRule = readCssRule(styles, ".studio-grid");
  const settingsPanelRule = readCssRule(styles, ".settings-panel");
  const previewPanelRule = readCssRule(styles, ".preview-panel");
  const studioGridBlock = styles.match(/\.studio-view \.studio-grid\s*\{[\s\S]*?\}/)?.[0] || "";

  assert.match(studioGridRule, /--studio-panel-height:\s*var\(--studio-column-height,\s*100%\);/);
  assert.match(settingsPanelRule, /height:\s*var\(--studio-panel-height,\s*var\(--studio-column-height,\s*auto\)\);/);
  assert.match(previewPanelRule, /height:\s*var\(--studio-panel-height,\s*var\(--studio-column-height,\s*auto\)\);/);
  assert.match(studioGridBlock, /min-height:\s*0;/);
  assert.match(studioGridBlock, /height:\s*100%;/);
  assert.doesNotMatch(studioGridBlock, /calc\(100% - 48px\)/);
  assert.doesNotMatch(app, /!refs\.settingsPanel \|\| !refs\.previewPanel \|\| !refs\.sideColumn \|\| !refs\.viewRoot/);
  assert.match(
    app,
    /const viewRootRect = refs\.viewRoot\.getBoundingClientRect\(\);[\s\S]*const availableHeight = Math\.max\(320,\s*Math\.floor\(Math\.max\(1,\s*Math\.round\(window\.visualViewport\?\.height \|\| window\.innerHeight\)\) - viewRootRect\.top - WORKSPACE_BOTTOM_GAP_PX\)\);[\s\S]*const resolvedHeight = availableHeight;/,
  );
  assert.match(app, /const WORKSPACE_BOTTOM_GAP_PX = 2;/);
  assert.doesNotMatch(app, /const availableHeight = Math\.max\(600,/);
  assert.match(app, /const availableHeight = Math\.max\(320,\s*Math\.floor\(Math\.max\(1,\s*Math\.round\(window\.visualViewport\?\.height \|\| window\.innerHeight\)\) - viewRootRect\.top - WORKSPACE_BOTTOM_GAP_PX\)\);/);
});

test("generation task refresh tolerates older servers without the task endpoint", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(response\.status === 404\) \{[\s\S]*applyGenerationTaskSnapshots\(\[\], \{ render \}\);[\s\S]*return;/);
  assert.match(app, /throw new Error\("读取生成任务失败"\);/);
});

test("studio stores API settings in the browser and sends them with cloud generation requests", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const browserConfig = await readFile(browserConfigPath, "utf8");

  assert.match(html, /id="configFeedback"[^>]*aria-live="polite"[^>]*><\/p>/);
  assert.match(app, /configModelPicker\.setFeedback\("配置已保存到当前浏览器。", "success"\);/);
  assert.match(app, /from "\/lib\/browser-config\.mjs";/);
  assert.match(app, /appendBrowserConfigToFormData,\s*[\s\S]*getBrowserPrivateConfigRequestPayload,\s*[\s\S]*readBrowserPrivateConfig,\s*[\s\S]*saveBrowserPrivateConfig,/);
  assert.match(browserConfig, /export const BROWSER_CONFIG_STORAGE_KEY = "image-studio-browser-config-v1";/);
  assert.match(browserConfig, /export function readBrowserPrivateConfig\(storage = getLocalStorage\(\)\) \{/);
  assert.match(browserConfig, /export function appendBrowserConfigToFormData\(formData, readConfig = readBrowserPrivateConfig, overrides = \{\}\) \{/);
  assert.match(browserConfig, /export function getBrowserPrivateConfigRequestPayload\(readConfig = readBrowserPrivateConfig\) \{/);
  assert.match(browserConfig, /storage\?\.setItem\?\.\(BROWSER_CONFIG_STORAGE_KEY, JSON\.stringify/);
  assert.match(browserConfig, /\.\.\.\(browserConfig \|\| \{\}\),[\s\S]*\.\.\.overrideConfig,/);
  assert.match(browserConfig, /formData\.set\("baseUrl", config\.baseUrl\);/);
  assert.match(browserConfig, /formData\.set\("endpointPath", config\.endpointPath\);/);
  assert.match(browserConfig, /formData\.set\("apiKey", config\.apiKey\);/);
  assert.match(browserConfig, /formData\.set\("responsesModel", config\.responsesModel\);/);
  assert.match(browserConfig, /formData\.set\("directEndpointPath", config\.directEndpointPath\);/);
  assert.match(browserConfig, /formData\.set\("directResponsesModel", config\.directResponsesModel\);/);
  assert.match(browserConfig, /formData\.set\("protocolBaseUrl", config\.protocolBaseUrl\);/);
  assert.match(browserConfig, /formData\.set\("protocolApiKey", config\.protocolApiKey\);/);
  assert.match(browserConfig, /formData\.set\("protocolImageModel", config\.protocolImageModel\);/);
  assert.match(app, /directResponsesModelInput:\s*document\.querySelector\("#directResponsesModelInput"\),/);
  assert.match(app, /const directTextModel = refs\.directResponsesModelInput\.value\.trim\(\) \|\| browserPayload\.directTextModel \|\| browserPayload\.directResponsesModel/);
  assert.match(app, /\bdirectTextModel,\s*\/\/ Legacy aliases/);
  assert.match(app, /directResponsesModel:\s*directTextModel/);
  assert.match(app, /refs\.directResponsesModelInput\.value = config\.directTextModel \|\| config\.directResponsesModel \|\| DEFAULT_DIRECT_RESPONSES_MODEL;/);
  assert.match(app, /protocolBaseUrlInput:\s*document\.querySelector\("#protocolBaseUrlInput"\),/);
  assert.match(app, /protocolApiKeyInput:\s*document\.querySelector\("#protocolApiKeyInput"\),/);
  assert.match(app, /protocolImageModelInput:\s*document\.querySelector\("#protocolImageModelInput"\),/);
  assert.match(app, /protocolImageModel:\s*refs\.protocolImageModelInput\.value\.trim\(\) \|\| browserPayload\.protocolImageModel/);
  assert.match(app, /refs\.protocolImageModelInput\.value = config\.protocolImageModel \|\| DEFAULT_PROTOCOL_IMAGE_MODEL;/);
  assert.match(app, /const payload = getCurrentPrivateConfigRequestPayload\(\);/);
  assert.match(app, /function buildPptFormData\(\) \{[\s\S]*appendCurrentConfigToFormData\(formData\);[\s\S]*return formData;/);
  assert.match(app, /function getPptGenerationSnapshot\(\) \{[\s\S]*requestConfig: getCurrentPrivateConfigRequestPayload\(\)/);
  assert.match(app, /function buildPptCompletionRequest\(slideNumbers\) \{[\s\S]*state\.ppt\.generationSnapshot \|\| getPptGenerationSnapshot\(\)[\s\S]*\.\.\.snapshot\.requestConfig,/);
});

test("config endpoint controls keep suffix before full URL and mark direct image edits as automatic", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const routeASelect = html.match(/<select class="endpoint-suffix-select" id="endpointPathSelect"[\s\S]*?<\/select>/)?.[0] || "";
  const routeBSelect = html.match(/<select class="endpoint-suffix-select" id="directEndpointPathSelect"[\s\S]*?<\/select>/)?.[0] || "";

  assert.match(
    html,
    /<select class="endpoint-suffix-select" id="endpointPathSelect"[\s\S]*?<\/select>\s*<button class="inline-button endpoint-full-toggle" id="baseUrlFullToggle"/,
  );
  assert.match(
    html,
    /<select class="endpoint-suffix-select" id="directEndpointPathSelect"[\s\S]*?<option value="images\/generations">images\/generations[\s\S]*?<option value="responses">responses<\/option>[\s\S]*?<option value="chat\/completions">chat\/completions<\/option>[\s\S]*?<\/select>\s*<button class="inline-button endpoint-full-toggle" id="directBaseUrlFullToggle"/,
  );
  assert.match(routeASelect, /<option value="responses">responses<\/option>/);
  assert.doesNotMatch(routeASelect, /chat\/completions/);
  assert.doesNotMatch(routeASelect, /images\/generations/);
  assert.match(routeBSelect, /<option value="images\/generations">/);
  assert.match(routeBSelect, /<option value="responses">/);
  assert.match(routeBSelect, /chat\/completions/);
  assert.doesNotMatch(routeBSelect, /edits/);
  const directResponsesInputIndex = html.indexOf('id="directResponsesModelInput"');
  const directResponsesFieldStart = html.lastIndexOf('<div class="field model-field"', directResponsesInputIndex);
  const directResponsesFieldOpenTag = html.slice(
    directResponsesFieldStart,
    html.indexOf(">", directResponsesFieldStart) + 1,
  );
  assert.notEqual(directResponsesInputIndex, -1);
  assert.notEqual(directResponsesFieldStart, -1);
  assert.doesNotMatch(directResponsesFieldOpenTag, /\shidden(?:[=\s>]|$)/);
  assert.match(html, /<input name="imageRoute" type="radio" value="c" \/>[\s\S]*<span data-ui-i18n="protocolMode">Gemini模型<\/span>/);
  assert.match(html, /<div class="route-config-panel" data-route-panel="c"[\s\S]*id="protocolBaseUrlInput"[\s\S]*id="protocolApiKeyInput"[\s\S]*id="protocolImageModelInput"/);
  assert.match(html, /id="protocolCompatibilityHint"[\s\S]*Gemini[\s\S]*images\/generations/);
  assert.match(styles, /\.endpoint-toolbar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/);
  assert.match(styles, /\.config-form:has\(input\[name="imageRoute"\]\[value="c"\]:checked\) \[data-route-panel="a"\]/);
  assert.match(styles, /\.config-form:has\(input\[name="imageRoute"\]\[value="c"\]:checked\) \[data-route-panel="b"\]/);
  assert.match(app, /API_ENDPOINT_IMAGE_EDITS,/);
  assert.match(app, /API_ENDPOINT_CHAT_COMPLETIONS,/);
  assert.match(app, /splitModelProtocolUrl,/);
  assert.match(app, /function normalizeEndpointSelectValue\(imageRoute = "a", endpointPath = "", fallbackEndpointPath = ""\)/);
  assert.match(app, /normalizedEndpointPath === API_ENDPOINT_IMAGE_EDITS\s*\?\s*API_ENDPOINT_IMAGE_GENERATIONS/);
  assert.match(app, /function getProtocolImageGenerationsUrlPreview\(/);
  assert.match(app, /function getProtocolImageGenerationsUrlPreview\([\s\S]*splitModelProtocolUrl\([\s\S]*appendApiEndpointPath\([^,]+,\s*API_ENDPOINT_IMAGE_GENERATIONS\)/);
});

test("direct mode exposes the text and vision model field", async () => {
  const html = await readFile(indexPath, "utf8");
  const inputIndex = html.indexOf('id="directResponsesModelInput"');
  const fieldStart = html.lastIndexOf('<div class="field model-field"', inputIndex);
  const fieldOpenTag = html.slice(fieldStart, html.indexOf(">", fieldStart) + 1);

  assert.notEqual(inputIndex, -1);
  assert.notEqual(fieldStart, -1);
  assert.doesNotMatch(fieldOpenTag, /\shidden(?:[=\s>]|$)/);
});

test("config drawer can test the connection and reveal fetched models in a picker", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const configModelPicker = await readFile(configModelPickerPath, "utf8");
  const modelOptionsListRule = readCssRule(styles, ".model-options-list");

  assert.match(html, /id="testConnectionButton"[\s\S]*测试连接/);
  assert.match(html, /id="fetchModelsButton"[\s\S]*获取模型列表/);
  assert.match(html, /id="modelPickerToggle"[\s\S]*aria-label="展开可用模型列表"/);
  assert.match(html, /id="modelOptionsList"[\s\S]*role="listbox"/);
  assert.match(app, /testConnectionButton:\s*document\.querySelector\("#testConnectionButton"\),/);
  assert.match(app, /fetchModelsButton:\s*document\.querySelector\("#fetchModelsButton"\),/);
  assert.match(app, /directFetchModelsButton:\s*document\.querySelector\("#directFetchModelsButton"\),/);
  assert.match(app, /directResponsesFetchModelsButton:\s*document\.querySelector\("#directResponsesFetchModelsButton"\),/);
  assert.match(app, /protocolFetchModelsButton:\s*document\.querySelector\("#protocolFetchModelsButton"\),/);
  assert.match(app, /modelPickerToggle:\s*document\.querySelector\("#modelPickerToggle"\),/);
  assert.match(app, /modelOptionsList:\s*document\.querySelector\("#modelOptionsList"\),/);
  assert.match(app, /directModelPickerToggle:\s*document\.querySelector\("#directModelPickerToggle"\),/);
  assert.match(app, /directModelOptionsList:\s*document\.querySelector\("#directModelOptionsList"\),/);
  assert.match(app, /directResponsesModelPickerToggle:\s*document\.querySelector\("#directResponsesModelPickerToggle"\),/);
  assert.match(app, /directResponsesModelOptionsList:\s*document\.querySelector\("#directResponsesModelOptionsList"\),/);
  assert.match(app, /protocolModelPickerToggle:\s*document\.querySelector\("#protocolModelPickerToggle"\),/);
  assert.match(app, /protocolModelOptionsList:\s*document\.querySelector\("#protocolModelOptionsList"\),/);
  assert.match(app, /from "\/lib\/config-model-picker\.mjs";/);
  assert.match(app, /const configModelPicker = createConfigModelPickerController\(/);
  assert.match(app, /configModelPicker\.bindEvents\(\);/);
  assert.match(configModelPicker, /async function fetchConfigModels\(/);
  assert.match(configModelPicker, /await fetchImpl\("\/api\/models"/);
  assert.match(configModelPicker, /getBrowserPrivateConfigRequestPayload\?\.\(\)/);
  assert.match(configModelPicker, /formData\.set\("imageRoute", payload\.imageRoute\);/);
  assert.match(configModelPicker, /formData\.set\("directBaseUrl", payload\.directBaseUrl\);/);
  assert.match(configModelPicker, /formData\.set\("directApiKey", payload\.directApiKey\);/);
  assert.match(configModelPicker, /formData\.set\("directImageModel", payload\.directImageModel\);/);
  assert.match(configModelPicker, /formData\.set\("directResponsesModel", payload\.directResponsesModel\);/);
  assert.match(configModelPicker, /formData\.set\("protocolBaseUrl", payload\.protocolBaseUrl\);/);
  assert.match(configModelPicker, /formData\.set\("protocolApiKey", payload\.protocolApiKey\);/);
  assert.match(configModelPicker, /formData\.set\("protocolImageModel", payload\.protocolImageModel\);/);
  assert.match(configModelPicker, /function render\(\)/);
  assert.match(configModelPicker, /function renderTarget\(target, activeTarget\)/);
  assert.match(configModelPicker, /function getVisibleModels\(target = getTargetForSelectedRoute\(\)\)/);
  assert.match(configModelPicker, /targetRefs\.toggle\.hidden = !hasModels;/);
  assert.match(configModelPicker, /fetchConfigModels\(\{ openAfterFetch: true, mode: "models", target: MODEL_TARGET_RESPONSES \}\);/);
  assert.match(configModelPicker, /refs\.directFetchModelsButton\?\.addEventListener\("click"/);
  assert.match(configModelPicker, /refs\.directResponsesFetchModelsButton\?\.addEventListener\("click"/);
  assert.match(configModelPicker, /refs\.protocolFetchModelsButton\?\.addEventListener\("click"/);
  assert.match(configModelPicker, /toggleModelPicker\(MODEL_TARGET_DIRECT\)/);
  assert.match(configModelPicker, /toggleModelPicker\(MODEL_TARGET_DIRECT_RESPONSES\)/);
  assert.match(configModelPicker, /toggleModelPicker\(MODEL_TARGET_PROTOCOL\)/);
  assert.match(configModelPicker, /handleModelInput\(MODEL_TARGET_RESPONSES\)/);
  assert.match(styles, /\.config-actions-row\s*\{/);
  assert.match(styles, /\.model-picker-control\s*\{/);
  assert.match(styles, /\.model-picker-toggle\s*\{/);
  assert.match(styles, /\.model-options-list\s*\{/);
  assert.match(modelOptionsListRule, /background:\s*var\(--bg-soft\);/);
  assert.doesNotMatch(modelOptionsListRule, /--panel-strong/);
  assert.match(styles, /\.model-options-empty\s*\{/);
});

test("fetch models button opens fetched model options while silent fetches stay collapsed", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ ok: true, models: ["gpt-image-2", "gpt-5.5"] }),
  });
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl,
    getBrowserPrivateConfigRequestPayload: () => ({}),
  });

  controller.bindEvents();
  refs.fetchModelsButton.dispatchEvent({ type: "click" });
  await waitForAsyncHandlers();

  assert.equal(state.configModels.open, true);
  assert.equal(refs.modelOptionsList.hidden, false);
  assert.deepEqual(refs.modelOptionsList.children.map((child) => child.textContent), ["gpt-image-2", "gpt-5.5"]);

  await controller.fetchConfigModels({ openAfterFetch: false, mode: "models" });

  assert.equal(state.configModels.open, false);
  assert.equal(refs.modelOptionsList.hidden, true);
});

test("config model picker action labels follow injected UI language", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const labels = {
    fetchModels: "Fetch Models",
    fetchModelsLoading: "Fetching...",
    testConnection: "Test Connection",
    testConnectionLoading: "Testing...",
  };
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, models: [] }) }),
    getBrowserPrivateConfigRequestPayload: () => ({}),
    getUiText: (key) => labels[key] || "",
  });

  controller.render();
  assert.equal(refs.testConnectionButton.textContent, "Test Connection");
  assert.equal(refs.fetchModelsButton.textContent, "Fetch Models");

  state.configModels.loading = true;
  state.configModels.loadingMode = "models";
  state.configModels.loadingTarget = "responses";
  controller.render();
  assert.equal(refs.fetchModelsButton.textContent, "Fetching...");

  state.configModels.loadingMode = "test";
  controller.render();
  assert.equal(refs.testConnectionButton.textContent, "Testing...");
});

test("direct mode fetch models uses direct API settings and direct model picker", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  refs.imageRouteInputs[0].checked = false;
  refs.imageRouteInputs[1].checked = true;
  const capturedBodies = [];
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const fetchImpl = async (_url, init) => {
    capturedBodies.push(init.body);
    return {
      ok: true,
      json: async () => ({ ok: true, models: ["vendor-image-pro", "gpt-image-2"] }),
    };
  };
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl,
    getBrowserPrivateConfigRequestPayload: () => ({
      imageRoute: "b",
      baseUrl: "https://saved-route.example.test/v1",
      apiKey: "saved-route-key",
      responsesModel: "gpt-5.4",
      directBaseUrl: "https://saved-direct.example.test/v1",
      directApiKey: "saved-direct-key",
      directImageModel: "saved-direct-image",
      directResponsesModel: "saved-direct-vision",
    }),
  });

  controller.bindEvents();
  refs.directFetchModelsButton.dispatchEvent({ type: "click" });
  await waitForAsyncHandlers();

  assert.equal(capturedBodies.length, 1);
  assert.equal(capturedBodies[0].get("imageRoute"), "b");
  assert.equal(capturedBodies[0].get("directBaseUrl"), "https://direct.example.test/v1");
  assert.equal(capturedBodies[0].get("directApiKey"), "direct-key");
  assert.equal(capturedBodies[0].get("directImageModel"), "gpt-image-2");
  assert.equal(capturedBodies[0].get("directResponsesModel"), "gpt-5.5");
  assert.equal(capturedBodies[0].get("directTextModel"), "gpt-5.5");
  assert.equal(refs.directModelOptionsList.hidden, false);
  assert.equal(refs.modelOptionsList.hidden, true);
  assert.equal(refs.directResponsesModelOptionsList.hidden, true);
  assert.deepEqual(
    refs.directModelOptionsList.children.map((child) => child.textContent),
    ["vendor-image-pro", "gpt-image-2"],
  );
});

test("model protocol mode fetch models uses protocol API settings and protocol picker", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  refs.imageRouteInputs[0].checked = false;
  refs.imageRouteInputs[2].checked = true;
  const capturedBodies = [];
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const fetchImpl = async (_url, init) => {
    capturedBodies.push(init.body);
    return {
      ok: true,
      json: async () => ({ ok: true, models: ["gemini-3.1-flash-image-preview", "gemini-3.1-flash-image-preview-vip"] }),
    };
  };
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl,
    getBrowserPrivateConfigRequestPayload: () => ({
      imageRoute: "c",
      protocolBaseUrl: "https://saved-protocol.example.test/v1",
      protocolApiKey: "saved-protocol-key",
      protocolImageModel: "saved-protocol-image",
    }),
  });

  controller.bindEvents();
  refs.protocolFetchModelsButton.dispatchEvent({ type: "click" });
  await waitForAsyncHandlers();

  assert.equal(capturedBodies.length, 1);
  assert.equal(capturedBodies[0].get("imageRoute"), "c");
  assert.equal(capturedBodies[0].get("protocolBaseUrl"), "https://protocol.example.test/v1");
  assert.equal(capturedBodies[0].get("protocolApiKey"), "protocol-key");
  assert.equal(capturedBodies[0].get("protocolImageModel"), "gemini-3.1-flash-image-preview");
  assert.equal(refs.protocolModelOptionsList.hidden, false);
  assert.equal(refs.directModelOptionsList.hidden, true);
  assert.equal(refs.modelOptionsList.hidden, true);
  assert.deepEqual(
    refs.protocolModelOptionsList.children.map((child) => child.textContent),
    ["gemini-3.1-flash-image-preview", "gemini-3.1-flash-image-preview-vip"],
  );
});

test("direct text and vision model picker uses direct API settings and its own options", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  refs.imageRouteInputs[0].checked = false;
  refs.imageRouteInputs[1].checked = true;
  const capturedBodies = [];
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const fetchImpl = async (_url, init) => {
    capturedBodies.push(init.body);
    return {
      ok: true,
      json: async () => ({ ok: true, models: ["gpt-5.5", "gpt-5.4"] }),
    };
  };
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl,
    getBrowserPrivateConfigRequestPayload: () => ({}),
  });

  controller.bindEvents();
  refs.directResponsesFetchModelsButton.dispatchEvent({ type: "click" });
  await waitForAsyncHandlers();

  assert.equal(capturedBodies.length, 1);
  assert.equal(capturedBodies[0].get("imageRoute"), "b");
  assert.equal(capturedBodies[0].get("directBaseUrl"), "https://direct.example.test/v1");
  assert.equal(capturedBodies[0].get("directEndpointPath"), "chat/completions");
  assert.equal(capturedBodies[0].get("directApiKey"), "direct-key");
  assert.equal(capturedBodies[0].get("directImageModel"), "gpt-image-2");
  assert.equal(capturedBodies[0].get("directResponsesModel"), "gpt-5.5");
  assert.equal(refs.directResponsesModelOptionsList.hidden, false);
  assert.equal(refs.directModelOptionsList.hidden, true);
  assert.equal(refs.modelOptionsList.hidden, true);
  assert.deepEqual(
    refs.directResponsesModelOptionsList.children.map((child) => child.textContent),
    ["gpt-5.5", "gpt-5.4"],
  );

  refs.directResponsesModelInput.value = "5.4";
  refs.directResponsesModelInput.dispatchEvent({ type: "input" });
  refs.directResponsesModelOptionsList.children[0].dispatchEvent({ type: "click", bubbles: true });

  assert.equal(refs.directResponsesModelInput.value, "gpt-5.4");
  assert.equal(refs.directResponsesModelOptionsList.hidden, true);
});

test("test connection uses the currently selected direct mode settings", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  refs.imageRouteInputs[0].checked = false;
  refs.imageRouteInputs[1].checked = true;
  const capturedBodies = [];
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const fetchImpl = async (_url, init) => {
    capturedBodies.push(init.body);
    return {
      ok: true,
      json: async () => ({ ok: true, models: ["vendor-image-pro"] }),
    };
  };
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl,
    getBrowserPrivateConfigRequestPayload: () => ({}),
  });

  controller.bindEvents();
  refs.testConnectionButton.dispatchEvent({ type: "click" });
  await waitForAsyncHandlers();

  assert.equal(capturedBodies.length, 1);
  assert.equal(capturedBodies[0].get("imageRoute"), "b");
  assert.equal(capturedBodies[0].get("directBaseUrl"), "https://direct.example.test/v1");
  assert.equal(capturedBodies[0].get("directEndpointPath"), "chat/completions");
  assert.equal(capturedBodies[0].get("directApiKey"), "direct-key");
  assert.equal(capturedBodies[0].get("directResponsesModel"), "gpt-5.5");
  assert.equal(state.configModels.open, false);
});

test("model input searches fetched Responses models without collapsing the picker", async () => {
  const { createConfigModelPickerController } = await import(publicConfigModelPickerPath);
  const { refs } = createModelPickerHarness();
  const state = { config: {}, configModels: { items: [], loading: false, loadingMode: "", open: false } };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ ok: true, models: ["gpt-image-2", "GPT-4.1-mini", "o3"] }),
  });
  const controller = createConfigModelPickerController({
    refs,
    state,
    FormDataCtor: TestFormData,
    fetchImpl,
    getBrowserPrivateConfigRequestPayload: () => ({}),
  });
  const getOptionLabels = () =>
    refs.modelOptionsList.children.filter((child) => child.dataset.modelId).map((child) => child.textContent);

  controller.bindEvents();
  await controller.fetchConfigModels({ openAfterFetch: true, mode: "models" });

  assert.deepEqual(getOptionLabels(), ["gpt-image-2", "GPT-4.1-mini", "o3"]);

  refs.responsesModelInput.value = "GPT";
  refs.responsesModelInput.dispatchEvent({ type: "input" });

  assert.equal(state.configModels.open, true);
  assert.equal(refs.modelOptionsList.hidden, false);
  assert.deepEqual(getOptionLabels(), ["gpt-image-2", "GPT-4.1-mini"]);

  refs.responsesModelInput.value = "";
  refs.responsesModelInput.dispatchEvent({ type: "input" });

  assert.equal(state.configModels.open, true);
  assert.deepEqual(getOptionLabels(), ["gpt-image-2", "GPT-4.1-mini", "o3"]);

  refs.responsesModelInput.value = "vision";
  refs.responsesModelInput.dispatchEvent({ type: "input" });

  assert.equal(state.configModels.open, true);
  assert.deepEqual(getOptionLabels(), []);
  assert.equal(refs.modelOptionsList.children.length, 1);
  assert.equal(refs.modelOptionsList.children[0].className, "model-options-empty");
  assert.match(refs.modelOptionsList.children[0].textContent, /没有匹配的模型/);

  refs.responsesModelInput.value = "mini";
  refs.responsesModelInput.dispatchEvent({ type: "input" });
  refs.modelOptionsList.children[0].dispatchEvent({ type: "click", bubbles: true });

  assert.equal(refs.responsesModelInput.value, "GPT-4.1-mini");
  assert.equal(state.configModels.open, false);
  assert.equal(refs.modelOptionsList.hidden, true);
});

test("studio caches generated browser images for persistent preview and download", async () => {
  const app = await readFile(appPath, "utf8");
  const browserImageCache = await readFile(browserImageCachePath, "utf8");

  assert.match(app, /from "\/lib\/browser-image-cache\.mjs";/);
  assert.match(browserImageCache, /export const BROWSER_IMAGE_CACHE_INDEX_KEY = "image-studio-browser-image-cache-index-v1";/);
  assert.match(browserImageCache, /export function openBrowserImageCacheDB\(\) \{/);
  assert.match(browserImageCache, /export function isServerImageProxyUrl\(url\) \{/);
  assert.match(browserImageCache, /export async function fetchServerImageAsDataUrl\(imageUrl\) \{/);
  assert.match(browserImageCache, /export async function cacheBrowserGalleryItem\(item\) \{/);
  assert.match(browserImageCache, /await fetchServerImageAsDataUrl\(imageUrl\)/);
  assert.match(app, /if \(eventName === GENERATION_STREAM_EVENTS\.FINAL_IMAGE_CHUNK\) \{[\s\S]*await cacheBrowserGalleryItem\(\{\s*filename: payload\.filename,[\s\S]*imageUrl: dataUrl,[\s\S]*thumbnailUrl: dataUrl,[\s\S]*\}\);/);
  assert.match(app, /function attachChunkedImageToSavedItem\(item, finalImageChunks, fallbackDataUrl = ""\) \{/);
  assert.match(app, /const dataUrl = entry\?\.dataUrl \|\| \(isCacheableBrowserImageUrl\(fallbackDataUrl\) \? fallbackDataUrl : ""\);/);
  assert.match(app, /let finalImageDataUrl = "";/);
  assert.match(app, /if \(eventName === GENERATION_STREAM_EVENTS\.FINAL_IMAGE\) \{[\s\S]*finalImageDataUrl = isCacheableBrowserImageUrl\(payload\.dataUrl\) \? payload\.dataUrl : "";/);
  assert.match(app, /if \(dataUrl\) \{[\s\S]*finalImageDataUrl = dataUrl;[\s\S]*handleActivityFinal\(job\.id\);/);
  assert.match(
    app,
    /payload\.item = attachChunkedImageToSavedItem\(payload\.item, finalImageChunks, finalImageDataUrl \|\| job\.previewUrl\);/,
  );
  assert.match(browserImageCache, /const cachedImageUrl = isCacheableBrowserImageUrl\(cachedItem\?\.imageUrl\) \? cachedItem\.imageUrl : "";/);
  assert.match(browserImageCache, /imageUrl: cachedImageUrl \|\| item\.imageUrl \|\| cachedItem\?\.imageUrl \|\| "",/);
  assert.match(
    browserImageCache,
    /thumbnailUrl: cachedThumbnailUrl \|\| item\.thumbnailUrl \|\| cachedItem\?\.thumbnailUrl \|\| cachedImageUrl \|\| "",/,
  );
  assert.match(app, /function mergeGalleryItemWithExistingBrowserImage\(item\) \{/);
  assert.match(app, /const imageMergedItem = mergeGalleryItemWithExistingBrowserImage\(item\);/);
  assert.match(app, /const hydratedItem = mergeGalleryItemWithCachedMetadata\(imageMergedItem, state\.galleryMetadataCache\[item\?\.filename\]\);/);
  assert.match(browserImageCache, /export async function readBrowserCachedGalleryItems\(\) \{/);
  assert.match(app, /function upsertGalleryItem\(item\) \{[\s\S]*void cacheBrowserGalleryItem\(hydratedItem\);/);
  assert.match(app, /async function loadGallery\(\) \{[\s\S]*const browserCachedItems = await readBrowserCachedGalleryItems\(\);[\s\S]*state\.gallery = sortGalleryItemsByCreatedAtDesc/);
  assert.match(app, /async function deleteGalleryItem\(item\) \{[\s\S]*await deleteBrowserCachedGalleryItem\(item\.filename\);/);
  assert.match(app, /async function clearHistory\(\) \{[\s\S]*await clearBrowserImageCache\(\);/);
  assert.match(browserImageCache, /export function dataUrlToBlob\(dataUrl\) \{/);
  assert.match(app, /function imageElementToBlob\(imageElement\) \{/);
  assert.match(app, /async function resolveDownloadImageBlob\(item, imageElement\) \{/);
  assert.match(app, /const renderedBlob = await imageElementToBlob\(imageElement\);[\s\S]*if \(renderedBlob\) \{[\s\S]*return renderedBlob;/);
  assert.match(app, /function triggerBrowserImageDownload\(blob, filename\) \{/);
  assert.match(app, /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(objectUrl\), 1000\);/);
  assert.match(app, /async function downloadGalleryItem\(item, imageElement\) \{/);
  assert.match(app, /refs\.previewDownloadButton\.addEventListener\("click", \(event\) => \{[\s\S]*downloadGalleryItem\(item, refs\.previewImage\)/);
  assert.match(app, /refs\.lightboxDownload\.addEventListener\("click", \(event\) => \{[\s\S]*downloadGalleryItem\(state\.lightboxItem, refs\.lightboxImage\)/);
  assert.match(app, /download\.addEventListener\("click", \(event\) => \{[\s\S]*downloadGalleryItem\(item, image\)/);
});

test("task polling restarts preserved local queued jobs when remote snapshots omit them", async () => {
  const app = await readFile(appPath, "utf8");
  const applySnapshotsBody = extractFunctionBefore(app, "applyGenerationTaskSnapshots", "loadGenerationTasks");

  assert.match(
    applySnapshotsBody,
    /const localTransientJobs = state\.jobs\.filter\(\(job\) => !snapshotIds\.has\(job\.id\) && \(job\.isRunning \|\| !job\.started\)\);/,
  );
  assert.match(applySnapshotsBody, /const hasLocalQueuedJobs = localTransientJobs\.some\(\(job\) => isQueuedGenerationJob\(job\)\);/);
  assert.match(applySnapshotsBody, /if \(hasLocalQueuedJobs\) \{\s*scheduleGenerationQueue\(\);\s*\}/);
  assert.match(applySnapshotsBody, /scheduleGenerationTaskPolling\(\);/);
});

test("studio lazy-loads non-default view modules and renders only the active view", async () => {
  const app = await readFile(appPath, "utf8");
  const loader = await readFile(new URL("../lib/view-mode-loader.mjs", import.meta.url), "utf8");

  assert.match(app, /ensureLazyViewModule/);
  assert.match(app, /function ensureActiveViewModule\(view\) \{/);
  assert.match(app, /function renderActiveView\(\) \{/);
  assert.match(app, /function renderAll\(\) \{[\s\S]*renderActiveView\(\);[\s\S]*\}/);
  assert.match(app, /setActiveView\(view\) \{[\s\S]*ensureActiveViewModule\(view\);[\s\S]*renderActiveView\(\);/);

  const renderAllBody = app.match(/function renderAll\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(renderAllBody, /renderCreationView\(\);[\s\S]*renderPptView\(\);[\s\S]*renderGalleryView\(\);/);

  assert.match(loader, /export const VIEW_MODULE_URLS = Object\.freeze/);
  assert.match(loader, /"creation": "\/lib\/views\/creation-view\.mjs"/);
  assert.match(loader, new RegExp(`"quick-blend": "/lib/views/quick-blend-view\\.mjs\\?v=${quickBlendModuleAssetVersion}"`));
  assert.match(loader, /export async function ensureLazyViewModule/);
});

test("studio marks persisted active generation records as interrupted on reload", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function normalizePersistedActivityEntry\(entry\) \{/);
  assert.match(app, /if \(normalized\.status === "active"\) \{/);
  assert.match(app, /title: GENERATION_TASK_STATUS_LABELS\.error,/);
  assert.match(app, /detail: "上次页面关闭前生成未完成，请重新生成",/);
  // The persisted-row normalizer is handed to the store so it applies to both
  // top-level rows and batch children when the log is read back.
  assert.match(app, /return parseGenerationLogStore\(raw, \{ normalizeRow: normalizePersistedActivityEntry \}\);/);
  assert.match(app, /window\.localStorage\.getItem\(GENERATION_LOG_STORAGE_KEY\) \|\| window\.localStorage\.getItem\(GENERATION_ACTIVITY_STORAGE_KEY\)/);
});

test("studio keeps local port retry exhaustion out of the visible error feed", async () => {
  const app = await readFile(appPath, "utf8");
  const generationClient = await readFile(generationClientPath, "utf8");

  assert.match(app, /isGenerationRequestRetryMessage,/);
  assert.match(app, /if \(isGenerationRequestRetryMessage\(detail\)\) \{[\s\S]*return null;/);
  assert.match(generationClient, /if \(plan\.retryable && !plan\.shouldSurfaceError\) \{[\s\S]*return null;/);
  assert.match(app, /if \(!response\) \{[\s\S]*removeJob\(job\.id\);[\s\S]*return;/);
  assert.doesNotMatch(generationClient, /throw new Error\(plan\.message\)/);
});

test("prompt template list shows titles only and uses title clicks to apply prompts", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /className = "prompt-template-title-button"/);
  assert.match(app, /applyPromptTemplate\(template\.id\)/);
  assert.match(app, /editPromptTemplate\(template\.id\)/);
  assert.match(app, /deletePromptTemplate\(template\.id\)/);
  assert.doesNotMatch(app, /prompt\.textContent = template\.prompt/);
  assert.match(styles, /\.prompt-template-title-button\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.prompt-template-row-actions\s*\{[\s\S]*display:\s*flex;/);
  assert.match(styles, /\.prompt-template-row-actions \.mini-action\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*24px;[\s\S]*white-space:\s*nowrap;/);
});

test("prompt template storage respects an intentionally empty saved list", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(raw === null\) \{[\s\S]*return DEFAULT_PROMPT_TEMPLATES\.map/);
  assert.match(app, /return Array\.isArray\(parsed\) \? parsed\.map\(normalizePromptTemplate\)\.filter\(Boolean\) : \[\];/);
});

test("prompt template content accepts up to three thousand characters", async () => {
  const html = await readFile(indexPath, "utf8");
  const templateTextarea = html.match(/<textarea id="promptTemplateTextInput"[\s\S]*?<\/textarea>/)?.[0] || "";

  assert.match(templateTextarea, /\bmaxlength="3000"/);
  assert.doesNotMatch(templateTextarea, /\bmaxlength="1000"/);
});

test("default prompt templates cover ten daily life scenes", async () => {
  const app = await readFile(appPath, "utf8");
  const block = app.match(/const SURPRISE_PROMPTS = \[[\s\S]*?\];/)?.[0] || "";
  const names = [...block.matchAll(/name: "([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(names, [
    "清晨通勤",
    "家庭早餐",
    "居家阅读",
    "厨房做饭",
    "超市采购",
    "午后办公",
    "健身运动",
    "朋友聚会",
    "亲子手作",
    "夜晚学习",
  ]);
  assert.match(app, /const PROMPT_TEMPLATE_STORAGE_KEY = "image-studio-prompt-templates-v2";/);
  assert.doesNotMatch(block, /直播带货|国风服饰|数码产品/);
});

test("PPT view exposes source options, page count, progress, retry and PPTX download controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const pptAnalysisClient = await readFile(pptAnalysisClientPath, "utf8");

  assert.doesNotMatch(html, /data-view-tab="ppt"/);
  assert.match(html, /data-nav-section="create"[\s\S]*href="#ppt"[\s\S]*PPT生成/);
  assert.match(html, /data-view-panel="ppt"/);
  assert.match(html, /id="pptSourceModeUpload"[\s\S]*上传文档/);
  assert.match(html, /id="pptSourceModeText"[\s\S]*输入文本/);
  assert.match(html, /id="pptSourceModeTopic"[\s\S]*输入主题/);
  assert.match(html, /id="pptSourceInput"[\s\S]*sourceFiles/);
  assert.match(html, /id="pptSourceTextInput"[\s\S]*sourceText/);
  assert.match(html, /id="pptTopicInput"[\s\S]*topic/);
  assert.match(html, /id="pptAnalyzeButton"[\s\S]*分析文档/);
  assert.match(html, /id="pptAnalysisPanel"/);
  assert.match(html, /id="pptPageCountInput"[\s\S]*pageCount/);
  assert.match(html, /id="pptCompletionRatio"/);
  assert.match(html, /id="pptCompleteMissingButton"[\s\S]*补齐缺页/);
  assert.match(html, /id="pptDownloadLink"[\s\S]*下载 PPTX/);
  assert.doesNotMatch(html, /id="pptDeckCount"|class="studio-panel ppt-history-panel"|id="pptRefreshHistoryButton"|id="pptHistoryEmpty"|id="pptHistoryList"|历史演示/);

  assert.match(styles, /\.ppt-workspace\s*\{/);
  assert.match(styles, /\.ppt-analysis-card\s*\{/);
  assert.match(styles, /\.ppt-source-options\s*\{/);
  assert.match(styles, /\.ppt-output-actions\s*\{/);
  assert.match(styles, /\.ppt-slide-retry-button\s*\{/);
  assert.doesNotMatch(styles, /\.ppt-history-panel|\.ppt-history-list|\.ppt-history-item|\.ppt-history-actions/);

  assert.match(app, /ppt:\s*\{/);
  assert.match(app, /createPptAnalysisController/);
  assert.match(app, /pptAnalysis\.render\(\)/);
  assert.match(app, /pptAnalysis\.bind\(\)/);
  assert.match(pptAnalysisClient, /fetch\("\/api\/ppt\/analyze"/);
  assert.match(pptAnalysisClient, /refs\.pageCountInput\.value = String\(recommendedPageCount\)/);
  assert.match(pptAnalysisClient, /refs\.stylePresetInput\.value = recommendedStylePreset/);
  assert.match(app, /fetch\("\/api\/ppt\/generate"/);
  assert.match(app, /fetch\("\/api\/ppt\/complete"/);
  assert.match(app, /function getPptCompletionStats\(\)/);
  assert.match(app, /function getPptMissingSlideNumbers\(\)/);
  assert.match(app, /function retryPptSlide\(slideNumber\)/);
  assert.match(app, /function completeMissingPptSlides\(\)/);
  assert.match(app, /data-ppt-retry-slide/);
  assert.match(app, /refs\.pptCompleteMissingButton\.addEventListener\("click", completeMissingPptSlides\)/);
  assert.match(app, /eventName === "slide_failed"/);
  assert.doesNotMatch(app, /pptDeckCount|pptHistoryEmpty|pptHistoryList|pptRefreshHistoryButton|renderPptHistory/);
});

test("studio compact panels omit repeated helper copy", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.doesNotMatch(
    html,
    /Reference（可选，最多 6 张）|支持 JPG \/ PNG|Style Transfer|保留主体、元素和构图|只复刻画风和视觉语言|<small>Prompt<\/small>|<small>Parameters<\/small>|Output Preview|Live Feed|Reference Orchestration|Ratio \/ Size|Prompt Candidates|Deck History|电商套图生成记录和 creation 文件夹历史|生成记录和文件夹历史|点击提示词可映射到 Studio 文本框|单商品可生成|只影响套图模式|支持拖入多张图片|上传文档、输入文本或主题|三选一或组合使用|源文档只用于本次解析|渐进披露会|生成后会在这里显示大纲/,
  );
  assert.doesNotMatch(
    app,
    /填写商品信息后会自动生成|填写商品信息后自动生成|生成后会在这里显示大纲|CREATION_SCENARIO_HINTS|CREATION_INDUSTRY_TEMPLATE_HINTS|creation-card-prompt|creation-card-brief/,
  );
});

test("creation mode is a separate studio view with isolated state and routes", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loadingModule = await readFile(creationCardLoadingPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");
  const creationPanel = html.match(/data-view-panel="creation"[\s\S]*?(?=<section class="view-panel ppt-view)/)?.[0] || "";

  assert.doesNotMatch(html, /<nav class="studio-mode-tabs"/);
  assert.doesNotMatch(html, /data-studio-mode-tab/);
  assert.match(html, /data-view-panel="creation"/);
  assert.match(html, /id="creationForm"/);
  assert.match(html, /id="creationTargetLanguageInput"/);
  assert.match(html, /id="creationTargetLanguageInput"[\s\S]*<option value="zh-CN">[\s\S]*<option value="en" selected>English<\/option>/);
  assert.match(html, /id="creationTargetLanguageInput"[\s\S]*<option value="fr">Français<\/option>[\s\S]*<option value="de">Deutsch<\/option>[\s\S]*<option value="es">Español<\/option>/);
  assert.match(html, /id="creationGenerateButton"/);
  assert.match(html, /id="creationPlanButton"/);
  assert.doesNotMatch(html, /id="creationPlanMeta"/);
  assert.doesNotMatch(creationPanel, /id="creationSetList"|id="creationHistoryCount"|creation-history-block/);

  assert.doesNotMatch(styles, /\.studio-mode-tabs\s*\{/);
  assert.match(styles, /\.creation-workspace\s*\{/);
  assert.match(styles, /\.creation-result-grid\s*\{/);
  assert.match(styles, /\.creation-plan-actions\s*\{/);

  assert.match(app, /creation:\s*\{/);
  assert.match(app, /planning:\s*false/);
  assert.match(app, /if \(window\.location\.hash === "#creation"\)/);
  assert.match(app, /view === "creation" \? "#creation"/);
  assert.match(app, /fetch\("\/api\/creation\/plan"/);
  assert.match(queueModule, /fetchImpl\("\/api\/creation\/generate"/);
  assert.match(app, /fetch\("\/api\/creation\/sets"/);
  assert.match(app, /creationPlanButton: document\.querySelector\("#creationPlanButton"\)/);
  assert.doesNotMatch(app, /creationPlanMeta: document\.querySelector\("#creationPlanMeta"\)/);
  assert.match(app, /creationProductNameInput: document\.querySelector\("#creationProductNameInput"\)/);
  assert.doesNotMatch(app, /creation[\s\S]{0,400}PROMPT_TEMPLATE_STORAGE_KEY/);
});

test("creation mode has product references without a separate style-reference module", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const server = await readFile(serverPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");
  const creationReferenceDrag = await readFile(creationReferenceDragPath, "utf8");
  const creationReferenceAnalysisView = await readFile(creationReferenceAnalysisViewPath, "utf8");
  const creationReferenceCoverage = await readFile(publicCreationReferenceCoveragePath, "utf8");

  assert.match(html, /id="creationReferenceDropzone"/);
  assert.match(html, /id="creationReferenceCount">0 \/ 15/);
  assert.match(html, /class="creation-reference-head-actions"[\s\S]*id="creationReferenceResetButton"[\s\S]*type="button"[\s\S]*清空参考图[\s\S]*id="creationReferenceCount"/);
  assert.match(html, /id="creationReferenceInput"[\s\S]*name="creationReferenceImages"/);
  assert.match(html, /id="creationReferenceGrid"/);
  assert.doesNotMatch(html, /creationStyleReference|creation-style-reference/);
  assert.match(html, /id="creationReferenceAnalyzeButton"[\s\S]*智能识别/);
  assert.doesNotMatch(html, /creationReferenceApplyAnalysisButton|应用建议/);
  assert.match(html, /id="creationReferenceAnalysisFeedback"/);
  assert.match(html, /id="creationReferenceAnalysisPanel"/);
  const creationReferenceAnalysisHeadCopy = html.match(/<div class="creation-reference-analysis-head-copy">[\s\S]*?<\/div>/)?.[0] || "";
  assert.match(creationReferenceAnalysisHeadCopy, /<span>[\s\S]*<\/span>/);
  assert.doesNotMatch(creationReferenceAnalysisHeadCopy, /creationReferenceAnalysisSummary/);
  assert.match(html, /<\/div>\s*<strong id="creationReferenceAnalysisSummary">--<\/strong>\s*<small class="creation-reference-analysis-meta" id="creationReferenceAnalysisMeta">--<\/small>/);
  assert.match(html, /id="creationReferenceAnalysisToggleButton"[\s\S]*aria-controls="creationReferenceAnalysisList"/);
  assert.doesNotMatch(html, /id="creationReferenceApplyVisualLanguageButton"/);
  assert.doesNotMatch(html, /应用视觉语言/);
  const creationReferenceAnalysisHeadActions = html.match(/<div class="creation-reference-analysis-head-actions">[\s\S]*?<\/div>/)?.[0] || "";
  assert.doesNotMatch(creationReferenceAnalysisHeadActions, /creationReferenceAnalysisMeta/);
  assert.match(html, /class="creation-reference-analysis-meta" id="creationReferenceAnalysisMeta"/);
  assert.match(html, /id="creationReferenceAnalysisList"/);
  assert.match(styles, /\.creation-reference-head-actions\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*flex-end;/);
  assert.match(styles, /\.creation-reference-reset-button\s*\{[\s\S]*min-height:\s*28px;[\s\S]*white-space:\s*nowrap;/);
  assert.doesNotMatch(app, /识别中\.\.\./);
  assert.doesNotMatch(app, /正在识别参考图用途\.\.\./);
  assert.match(
    app,
    /refs\.creationReferenceAnalyzeButton\.disabled = analyzingReferences \|\| state\.creationReferenceFiles\.length === 0;/,
  );
  assert.doesNotMatch(
    app,
    /refs\.creationReferenceAnalyzeButton\.disabled =[\s\S]{0,120}state\.creation\.generating/,
  );
  assert.match(app, /refs\.creationReferenceAnalyzeButton\.replaceChildren\(analyzingReferences \? "识别中" : "智能识别"/);
  assert.match(app, /className: "creation-reference-analyze-spinner", ariaHidden: "true"/);
  assert.match(app, /creationReferenceResetButton: document\.querySelector\("#creationReferenceResetButton"\)/);
  assert.match(app, /function hasCreationReferenceInputData\(\) \{\s*return state\.creationReferenceFiles\.length > 0;\s*\}/);
  assert.match(app, /function syncCreationReferenceResetButton\(\) \{/);
  const creationReferenceClearStart = app.indexOf("function clearCreationReferenceFiles()");
  const creationReferenceClearEnd = app.indexOf("function resetCreationReferenceFilesForRecordReuse", creationReferenceClearStart);
  assert.ok(creationReferenceClearStart >= 0 && creationReferenceClearEnd > creationReferenceClearStart);
  const creationReferenceClearBody = app.slice(creationReferenceClearStart, creationReferenceClearEnd);
  assert.match(creationReferenceClearBody, /state\.creationReferenceFiles\.forEach\(\(item\) => \{/);
  assert.match(creationReferenceClearBody, /state\.creationReferenceFiles = \[\];/);
  assert.match(creationReferenceClearBody, /refs\.creationReferenceInput\.value = "";/);
  assert.match(creationReferenceClearBody, /renderCreationReferenceGrid\(\);/);
  assert.doesNotMatch(creationReferenceClearBody, /state\.creationReferenceRestoreQueue\s*=|state\.creationReferenceAnalysis\s*=|setCreationReferenceAnalysisFeedback\("", ""\)|resetCreationDraftPreview|renderCreationView|creationResultGrid|state\.creation\.currentSet|state\.creation\.queue|state\.creation\.sets|state\.creationLogo/);
  assert.match(app, /refs\.creationReferenceResetButton\.addEventListener\("click", clearCreationReferenceFiles\)/);
  assert.match(html, /SKU 组合件数[\s\S]*id="creationSkuBundleCountInput"[\s\S]*name="skuBundleCount"/);
  const creationImageCountMarkup = html.match(/<select id="creationImageCountInput"[\s\S]*?<\/select>/)?.[0] || "";
  assert.match(creationImageCountMarkup, /<option value="0">0 张<\/option>[\s\S]*<option value="1">1 张<\/option>[\s\S]*<option value="18" selected>18 张<\/option>/);
  assert.match(app, /function syncCreationPlatformImageCountOptions\(/);
  assert.match(app, /resolveCreationPlatformImageCountState\(/);
  assert.match(html, /SKU 生成规则[\s\S]*id="creationSkuGenerationRuleInput"[\s\S]*name="skuGenerationRule"[\s\S]*<option value="color-name-under-subject" selected>显示颜色<\/option>[\s\S]*<option value="none">无<\/option>[\s\S]*<option value="package-list">显示清单<\/option>[\s\S]*<option value="dimensions">显示尺寸<\/option>[\s\S]*<option value="package-list-dimensions">显示清单和尺寸<\/option>/);
  assert.doesNotMatch(html, /id="creationScenarioInput"/);
  assert.doesNotMatch(html, /id="creationVisualLanguageInput"/);
  assert.match(html, /平台选择[\s\S]*id="creationPlatformInput"[\s\S]*name="platform"[\s\S]*<option value="universal" selected>通用电商<\/option>/);
  assert.doesNotMatch(html, /id="creationPlatformInput"[\s\S]*<option value="amazon">Amazon<\/option>/);
  assert.match(app, /const CREATION_PLATFORM_POLICY_MODULE_URL = "\/lib\/creation-platform-policies\.mjs[^\"]*";/);
  assert.match(app, /const CREATION_PLATFORM_RESOLVER_MODULE_URL = "\/lib\/creation-platform-resolver\.mjs[^\"]*";/);
  assert.match(app, /Promise\.all\(\[[\s\S]*import\(CREATION_PLATFORM_POLICY_MODULE_URL\)[\s\S]*import\(CREATION_PLATFORM_RESOLVER_MODULE_URL\)/);
  assert.match(app, /const FALLBACK_CREATION_PLATFORM_OPTIONS = \[[\s\S]*value: "universal"[\s\S]*label: "通用电商"[\s\S]*\];/);
  assert.match(app, /function renderCreationPlatformOptions\(\)/);
  assert.doesNotMatch(app, /const CREATION_PLATFORM_LABELS = \{[\s\S]*amazon:/);
  assert.match(html, /id="creationIndustryTemplateInput"[\s\S]*type="hidden"[\s\S]*value="general"/);
  assert.doesNotMatch(html, /value="apparel"/);
  assert.doesNotMatch(html, /value="beauty"/);
  assert.doesNotMatch(html, /value="food"/);
  assert.doesNotMatch(html, /value="electronics"/);
  assert.doesNotMatch(html, /value="home"/);
  assert.match(html, /id="creationIndustryTemplateBrowser"/);
  assert.match(html, /id="creationIndustryTemplateTrigger"[\s\S]*aria-controls="creationIndustryTemplatePopover"/);
  assert.match(html, /id="creationIndustryTemplateCurrent"/);
  assert.match(html, /id="creationIndustryTemplatePopover"[\s\S]*hidden/);
  assert.match(html, /id="creationIndustryTemplateStepLabel"/);
  assert.match(html, /id="creationIndustryTemplateBackButton"[\s\S]*返回上一级/);
  assert.doesNotMatch(html, /id="creationIndustryTemplateOptionCount"/);
  assert.match(html, /id="creationIndustryTemplateLevels"/);
  const creationIndustrySearchInputId = html.indexOf('id="creationIndustryTemplateSearchInput"');
  const creationIndustrySearchInputStart = html.lastIndexOf("<input", creationIndustrySearchInputId);
  const creationIndustrySearchInputEnd = html.indexOf("/>", creationIndustrySearchInputId);
  const creationIndustrySearchInput = html.slice(creationIndustrySearchInputStart, creationIndustrySearchInputEnd + 2);
  assert.ok(creationIndustrySearchInput);
  assert.doesNotMatch(creationIndustrySearchInput, /placeholder=/);
  assert.doesNotMatch(html, /placeholder="搜索三级\/四级类目名或编码"/);
  assert.match(html, /id="creationSellingPointsInput"[\s\S]*id="creationDimensionSpecsInput"[\s\S]*name="dimensionSpecs"[\s\S]*例如：长 13 cm，宽 2 cm，高 3 cm，重 42 g/);
  assert.match(html, /id="creationDimensionSpecsInput"[\s\S]*id="creationDimensionUnitModeInput"[\s\S]*name="dimensionUnitMode"[\s\S]*<option value="metric">[\s\S]*<option value="imperial">[\s\S]*<option value="both" selected>/);
  assert.doesNotMatch(html, /写清商品是什么|每行或用逗号分隔|只用于尺寸规格图/);
  assert.match(html, /id="creationProductDescriptionInput"[\s\S]*rows="2"/);
  assert.match(html, /id="creationSellingPointsInput"[\s\S]*rows="1"/);
  assert.match(html, /id="creationDimensionSpecsInput"[\s\S]*rows="1"/);
  assert.match(html, /id="creationSkuGenerationEnabledInput" name="skuGenerationEnabled" type="checkbox" checked/);
  assert.match(html, /id="creationInfographicRebuildEnabledInput" name="infographicRebuildEnabled" type="checkbox" \/>/);
  assert.match(html, /<div class="creation-control-row creation-option-grid">[\s\S]*id="creationImageCountInput"[\s\S]*id="creationSkuBundleCountInput"[\s\S]*id="creationPlatformInput"[\s\S]*id="creationTargetLanguageInput"[\s\S]*id="creationOutputFormatInput"[\s\S]*id="creationRatioInput"[\s\S]*id="creationSizeInput"[\s\S]*id="creationSkuGenerationRuleInput"[\s\S]*id="creationDimensionUnitModeInput"[\s\S]*id="creationSkuGenerationEnabledInput"[\s\S]*id="creationInfographicRebuildEnabledInput"[\s\S]*id="creationListingAgentEnabledInput"[\s\S]*id="creationIndustryTemplateBrowser"/);
  assert.match(html, /<select id="creationRatioInput" name="ratio">[\s\S]*<option value="1:1" data-full-label="电商主图、头像、社交媒体 · 方形 1:1" selected>1:1<\/option>[\s\S]*<option value="9:21" data-full-label="超长竖图 · 竖屏 9:21">9:21<\/option>[\s\S]*<option value="1:3" data-full-label="超长竖版广告 · 竖屏 1:3">1:3<\/option>[\s\S]*<\/select>/);
  assert.match(html, /<select id="creationSizeInput" name="size">[\s\S]*<option value="1024x1024" selected>1K 1024 x 1024<\/option>[\s\S]*<option value="2880x2880">最大 2880 x 2880<\/option>[\s\S]*<\/select>/);
  assert.match(html, /<select id="portraitRatioInput" name="ratio">[\s\S]*<option value="4:5" selected>Instagram帖子 · 竖屏 4:5<\/option>[\s\S]*<option value="3:1">超宽广告图 · 横屏 3:1<\/option>[\s\S]*<\/select>/);
  assert.match(html, /<select id="portraitSizeInput" name="size">[\s\S]*<option value="1024x1280" selected>1K 1024 x 1280<\/option>[\s\S]*<option value="2560x3200">最大 2560 x 3200<\/option>[\s\S]*<\/select>/);
  assert.doesNotMatch(html, /id="creationScenarioHint"/);
  assert.match(html, /id="creationRolePicker"/);
  assert.match(html, /id="creationRoleGrid"/);
  assert.match(html, /id="creationRoleCount"/);
  assert.match(html, /id="creationRoleCount">18 \/ 18/);
  assert.doesNotMatch(html, /id="creationRoleHint"/);

  assert.match(styles, /\.creation-reference-grid\s*\{/);
  assert.match(styles, /\.creation-reference-role\s*\{/);
  assert.match(styles, /\.creation-reference-role option\s*\{[\s\S]*background:\s*#ffffff;[\s\S]*color:\s*#171b2f;/);
  assert.match(styles, /#creationProductNameInput,\s*#creationSellingPointsInput,\s*#creationDimensionSpecsInput\s*\{[\s\S]*height:\s*44px;/);
  assert.match(styles, /#creationProductDescriptionInput\s*\{[\s\S]*height:\s*72px;/);
  assert.match(styles, /#creationProductDescriptionInput,\s*#creationSellingPointsInput,\s*#creationDimensionSpecsInput\s*\{[\s\S]*overflow-y:\s*hidden;[\s\S]*resize:\s*vertical;/);
  assert.doesNotMatch(styles, /#creationSellingPointsInput,\s*#creationDimensionSpecsInput\s*\{[^}]*resize:\s*none;/);
  assert.match(styles, /\.creation-reference-analysis-panel\s*\{/);
  assert.match(styles, /\.creation-reference-analysis-panel \.reference-analysis-head\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;/);
  assert.match(styles, /\.creation-reference-analysis-head-copy\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1;[\s\S]*display:\s*flex;/);
  assert.match(styles, /\.creation-reference-analysis-panel \.creation-reference-analysis-head-copy span\s*\{[\s\S]*color:\s*var\(--text\);[\s\S]*font-size:\s*var\(--type-body-size\);[\s\S]*font-weight:\s*800;/);
  assert.match(styles, /#creationReferenceAnalysisSummary\s*\{[\s\S]*min-width:\s*0;[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*grid-row:\s*2;[\s\S]*padding-left:\s*8px;[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /\.creation-reference-analysis-head-actions\s*\{[\s\S]*grid-column:\s*3;[\s\S]*grid-row:\s*1;/);
  assert.match(styles, /\.creation-reference-analysis-panel\.is-collapsed #creationReferenceAnalysisSummary,\s*\.creation-reference-analysis-panel\.is-collapsed #creationReferenceAnalysisMeta\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /\.creation-reference-analysis-actions\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--accent\) 18%, var\(--border\)\);[\s\S]*background:[\s\S]*linear-gradient\(135deg, color-mix\(in srgb, var\(--accent\) 10%, transparent\), color-mix\(in srgb, var\(--success\) 8%, transparent\)\)/);
  assert.match(styles, /\.creation-reference-analysis-actions \.reference-analysis-button\s*\{[\s\S]*background:[\s\S]*color-mix\(in srgb, var\(--accent\) 18%, var\(--control-bg\)\)/);
  assert.match(styles, /\.creation-reference-analysis-actions \.prompt-agent-feedback:empty\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /\.creation-reference-analyze-spinner\s*\{[\s\S]*animation:\s*creation-reference-analyze-spin 1800ms linear infinite;/);
  assert.match(styles, /@keyframes creation-reference-analyze-spin/);
  assert.doesNotMatch(styles, /creationReferenceApplyAnalysisButton/);
  assert.match(styles, /\.creation-reference-analysis-role-correction\s*\{/);
  assert.match(styles, /\.creation-reference-note\s*\{/);
  assert.match(readCssRule(styles, ".creation-reference-note"), /padding:\s*0\s+8px\s+10px;/);
  assert.doesNotMatch(readCssRule(styles, ".creation-reference-note"), /max-height|-webkit-line-clamp/);
  assert.doesNotMatch(styles, /\.creation-reference-role-readonly\s*\{/);
  assert.match(styles, /\.creation-reference-note\[contenteditable="true"\]\s*\{/);
  assert.match(styles, /\.creation-template-search\s*\{/);
  assert.match(styles, /\.creation-industry-browser\s*\{/);
  assert.match(styles, /\.creation-industry-browser-head\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(112px,\s*128px\);[\s\S]*gap:\s*10px;/);
  assert.match(styles, /\.creation-industry-trigger\s*\{/);
  assert.match(styles, /\.creation-industry-popover\s*\{/);
  assert.match(styles, /\.creation-industry-popover\[hidden\]\s*\{/);
  assert.match(styles, /\.creation-industry-back-button\s*\{/);
  assert.match(styles, /\.creation-industry-levels\s*\{/);
  assert.match(styles, /\.creation-industry-option\s*\{/);
  const creationIndustryOptionTextRule =
    styles.match(/\.creation-industry-option strong,\s*\.creation-industry-option small\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(creationIndustryOptionTextRule, /white-space:\s*normal;/);
  assert.match(creationIndustryOptionTextRule, /overflow-wrap:\s*anywhere;/);
  assert.doesNotMatch(creationIndustryOptionTextRule, /overflow:\s*hidden|text-overflow:\s*ellipsis|white-space:\s*nowrap/);
  assert.match(styles, /\.creation-industry-option strong\s*\{[\s\S]*font-size:\s*var\(--type-subtitle-size\);/);
  assert.match(styles, /\.creation-industry-option small\s*\{[\s\S]*font-size:\s*var\(--type-caption-size,\s*0\.7rem\);[\s\S]*line-height:\s*1\.35;/);
  assert.doesNotMatch(styles, /\.creation-industry-levels\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.creation-option-grid\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(
    html,
    /<div class="creation-toggle-row" data-creation-set-only>[\s\S]*id="creationSkuGenerationEnabledInput"[\s\S]*id="creationInfographicRebuildEnabledInput"[\s\S]*id="creationListingAgentEnabledInput"[\s\S]*<\/div>/,
  );
  const creationToggleRowRule = readCssRule(styles, ".creation-toggle-row");
  assert.match(creationToggleRowRule, /grid-column:\s*1 \/ -1;/);
  assert.match(creationToggleRowRule, /display:\s*grid;/);
  assert.match(creationToggleRowRule, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(creationToggleRowRule, /align-items:\s*stretch;/);
  const creationToggleControlRule = readCssRule(styles, ".creation-toggle-row .creation-listing-toggle");
  assert.match(creationToggleControlRule, /height:\s*100%;/);
  assert.match(creationToggleControlRule, /box-sizing:\s*border-box;/);
  const creationListingToggleRule = readCssRule(styles, ".creation-listing-toggle");
  assert.match(creationListingToggleRule, /min-height:\s*40px;/);
  assert.match(creationListingToggleRule, /border-color:\s*rgba\(249,\s*192,\s*106,\s*0\.58\);/);
  assert.match(creationListingToggleRule, /linear-gradient\(135deg,\s*rgba\(249,\s*192,\s*106,\s*0\.22\),\s*rgba\(112,\s*226,\s*162,\s*0\.11\)\)/);
  assert.doesNotMatch(readCssRule(styles, ".creation-listing-toggle.is-prominent"), /grid-column|min-height/);
  const creationListingToggleTextRule = readCssRule(styles, ".creation-listing-toggle span");
  assert.match(creationListingToggleTextRule, /font-size:\s*clamp\(0\.72rem,\s*8\.5cqw,\s*var\(--type-body-size\)\);/);
  assert.match(creationListingToggleTextRule, /overflow-wrap:\s*anywhere;/);
  assert.match(creationListingToggleTextRule, /white-space:\s*normal;/);
  assert.match(creationListingToggleTextRule, /line-height:\s*1\.35;/);
  assert.doesNotMatch(creationListingToggleTextRule, /text-overflow:\s*clip|white-space:\s*nowrap/);
  assert.match(styles, /\.creation-sku-generation-rule-field\s*\{/);
  const creationOptionGridControlRule = readCssRule(styles, ".creation-option-grid .compact-field select");
  const creationOptionGridOptionRule = readCssRule(styles, ".creation-option-grid .compact-field select option");
  const creationFormCompactLabelRule = readCssRule(styles, ".creation-form .compact-field > span");
  const creationPlatformSelectRule = readCssRule(styles, "#creationPlatformInput");
  const creationPlatformOptionRule = readCssRule(styles, "#creationPlatformInput option");
  const creationSkuBundleRule = readCssRule(styles, ".creation-option-grid .creation-sku-bundle-field input");
  const creationTemplateSearchLabelRule = readCssRule(styles, ".creation-template-search-field span");
  const creationTemplateSearchRule = readCssRule(styles, ".creation-template-search");
  const creationIndustryHeadLabelRule = readCssRule(styles, ".creation-industry-browser-head span");
  assert.doesNotMatch(styles, /\.creation-option-grid\s+\.creation-sku-bundle-field::after/);
  assert.match(creationOptionGridControlRule, /height:\s*40px;/);
  assert.match(creationOptionGridControlRule, /min-width:\s*0;/);
  assert.match(creationOptionGridControlRule, /box-sizing:\s*border-box;/);
  assert.match(creationOptionGridControlRule, /padding:\s*0\s+28px\s+0\s+8px;/);
  assert.match(creationOptionGridControlRule, /text-align:\s*center;/);
  assert.match(creationOptionGridControlRule, /font-size:\s*clamp\(0\.72rem,\s*8\.5cqw,\s*var\(--type-body-size\)\);/);
  assert.match(creationOptionGridOptionRule, /font-size:\s*14px;/);
  assert.match(creationFormCompactLabelRule, /font-size:\s*var\(--type-body-size\);/);
  assert.match(creationPlatformSelectRule, /font-size:\s*clamp\(0\.72rem,\s*8\.5cqw,\s*var\(--type-body-size\)\);/);
  assert.match(creationPlatformOptionRule, /font-size:\s*14px;/);
  assert.match(creationSkuBundleRule, /height:\s*40px;/);
  assert.match(creationSkuBundleRule, /padding:\s*0\s+12px;/);
  assert.match(creationSkuBundleRule, /text-align:\s*center;/);
  assert.match(creationSkuBundleRule, /font-size:\s*clamp\(0\.72rem,\s*8\.5cqw,\s*var\(--type-body-size\)\);/);
  assert.match(creationTemplateSearchLabelRule, /font-size:\s*var\(--type-body-size\);/);
  assert.match(creationTemplateSearchRule, /font-size:\s*var\(--type-body-size\);/);
  assert.match(creationIndustryHeadLabelRule, /font-size:\s*var\(--type-body-size\);/);
  assert.doesNotMatch(creationSkuBundleRule, /padding:\s*0\s+40px/);
  assert.doesNotMatch(creationOptionGridControlRule, /vw/);
  assert.match(creationOptionGridControlRule, /white-space:\s*nowrap;/);
  assert.match(creationOptionGridControlRule, /text-overflow:\s*clip;/);
  assert.match(readCssRule(styles, ".creation-option-grid .compact-field"), /container-type:\s*inline-size;/);
  assert.match(readCssRule(styles, ".creation-option-grid .compact-field:has(select)::after"), /right:\s*11px;/);
  assert.match(creationOptionGridControlRule, /text-align-last:\s*center;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-option-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(
    readCssRule(styles, 'html[data-ui-layout="mobile"] .creation-toggle-row'),
    /grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(styles, /\.creation-role-picker\s*\{/);
  assert.match(styles, /\.creation-role-grid\s*\{/);
  assert.match(styles, /\.creation-role-option\s*\{/);
  assert.doesNotMatch(styles, /\.creation-scenario-hint\s*\{/);
  assert.doesNotMatch(styles, /\.creation-card-brief\s*\{/);

  assert.match(app, /creationReferenceFiles:\s*\[\]/);
  assert.match(app, /function getCreationMaxReferenceImageCount\(\) \{/);
  assert.match(app, /function getCreationMaxProductReferenceImageCount\(\) \{ return getCreationMaxReferenceImageCount\(\); \}/);
  assert.match(app, /const maxReferenceImages = getCreationMaxProductReferenceImageCount\(\);/);
  assert.doesNotMatch(app, /creationStyleReference|styleReferenceImages/);
  assert.doesNotMatch(server, /styleReferenceImages|MAX_CREATION_STYLE_REFERENCE_IMAGES/);
  assert.match(app, /creationIndustryTemplateBrowser:\s*\{/);
  assert.match(app, /creationReferenceAnalysis:\s*\{/);
  assert.match(app, /creationReferenceAnalyzeButton: document\.querySelector\("#creationReferenceAnalyzeButton"\)/);
  assert.doesNotMatch(app, /creationReferenceApplyAnalysisButton/);
  assert.match(app, /creationReferenceAnalysisList: document\.querySelector\("#creationReferenceAnalysisList"\)/);
  assert.match(app, /creationReferenceAnalysisPanel: document\.querySelector\("#creationReferenceAnalysisPanel"\)/);
  assert.match(app, /creationReferenceAnalysisToggleButton: document\.querySelector\("#creationReferenceAnalysisToggleButton"\)/);
  assert.doesNotMatch(app, /creationReferenceApplyVisualLanguageButton: document\.querySelector\("#creationReferenceApplyVisualLanguageButton"\)/);
  assert.match(app, /creationSkuBundleCountInput: document\.querySelector\("#creationSkuBundleCountInput"\)/);
  assert.match(app, /creationPlatformInput: document\.querySelector\("#creationPlatformInput"\)/);
  assert.doesNotMatch(app, /creationScenarioInput: document\.querySelector\("#creationScenarioInput"\)/);
  assert.doesNotMatch(app, /creationVisualLanguageInput: document\.querySelector\("#creationVisualLanguageInput"\)/);
  assert.match(app, /creationDimensionSpecsInput: document\.querySelector\("#creationDimensionSpecsInput"\)/);
  assert.match(app, /creationDimensionUnitModeInput: document\.querySelector\("#creationDimensionUnitModeInput"\)/);
  assert.match(app, /creationIndustryTemplateBrowser: document\.querySelector\("#creationIndustryTemplateBrowser"\)/);
  assert.match(app, /creationIndustryTemplateTrigger: document\.querySelector\("#creationIndustryTemplateTrigger"\)/);
  assert.match(app, /creationIndustryTemplateCurrent: document\.querySelector\("#creationIndustryTemplateCurrent"\)/);
  assert.match(app, /creationIndustryTemplatePopover: document\.querySelector\("#creationIndustryTemplatePopover"\)/);
  assert.match(app, /creationIndustryTemplateStepLabel: document\.querySelector\("#creationIndustryTemplateStepLabel"\)/);
  assert.match(app, /creationIndustryTemplateBackButton: document\.querySelector\("#creationIndustryTemplateBackButton"\)/);
  assert.doesNotMatch(app, /creationIndustryTemplateOptionCount/);
  assert.match(app, /creationIndustryTemplateLevels: document\.querySelector\("#creationIndustryTemplateLevels"\)/);
  assert.match(app, /creationIndustryTemplateSearchInput: document\.querySelector\("#creationIndustryTemplateSearchInput"\)/);
  assert.match(app, /creationCategoryTemplatesModule:\s*null/);
  assert.match(app, /async function loadCreationCategoryTemplatesModule\(\) \{/);
  assert.match(app, /const CREATION_CATEGORY_TEMPLATE_MODULE_URL = "\/lib\/creation-category-templates\.mjs\?v=20260509-category-search-2";/);
  assert.match(app, /import\(CREATION_CATEGORY_TEMPLATE_MODULE_URL\)/);
  assert.doesNotMatch(app, /from "\/lib\/creation-category-templates\.mjs\?v=20260509-category-search-2"/);
  assert.match(app, /creationReferenceInput: document\.querySelector\("#creationReferenceInput"\)/);
  assert.match(app, /creationRoleGrid: document\.querySelector\("#creationRoleGrid"\)/);
  assert.match(app, /creationRoleCount: document\.querySelector\("#creationRoleCount"\)/);
  assert.doesNotMatch(app, /creationScenarioHint: document\.querySelector\("#creationScenarioHint"\)/);
  assert.doesNotMatch(app, /creationRoleHint: document\.querySelector\("#creationRoleHint"\)/);
  assert.match(app, /creationSelectedRoles:\s*\[\]/);
  assert.match(app, /const CREATION_REFERENCE_ROLE_OPTIONS = \[/);
  assert.match(app, /\{ value: "reference-product", label: "参考主体" \}/);
  assert.match(app, /\{ value: "dimensions", label: "尺寸规格" \}/);
  assert.match(app, /\{ value: "usage", label: "使用说明" \}/);
  assert.match(app, /const CREATION_SCENARIO_ROLE_PRESETS = \{/);
  assert.match(app, /const CREATION_VISUAL_LANGUAGE_LABELS = \{/);
  assert.doesNotMatch(app, /"reference-style": "参考模式"/);
  assert.match(app, /const platform = normalizeCreationPlatform\(set\.platform\)/);
  assert.match(app, /platform:\s*platform\.value,\s*[\r\n]+\s*platformLabel:\s*String\(set\.platformLabel \|\| formatCreationPlatformLabel\(platform\.value\)\)/);
  assert.match(app, /\["平台", set\.platformLabel \|\| formatCreationPlatformLabel\(set\.platform\)\]/);
  assert.doesNotMatch(app, /\["视觉语言", set\.visualLanguageLabel \|\| formatCreationVisualLanguageLabel\(set\.visualLanguage\)\]/);
  assert.doesNotMatch(app, /material-closeup/);
  assert.doesNotMatch(app, /usage-steps/);
  assert.doesNotMatch(app, /review-qa/);
  assert.match(app, /1-hero\|hero\|首图成交主视觉/);
  assert.match(app, /1-hero\|hero\|首图成交主视觉\|[^;]*小圆框/);
  assert.match(app, /2-benefit\|benefit\|目标人群共鸣图/);
  assert.match(app, /3-scene\|scene\|适用多场景图/);
  assert.match(app, /4-multi-angle\|multi-angle\|多角度产品展示图/);
  assert.match(app, /5-atmosphere\|atmosphere\|冲动下单氛围图/);
  assert.match(app, /6-product-detail\|product-detail\|产品细节特写图/);
  assert.match(app, /7-brand-story\|brand-story\|品牌质感\/礼品价值图/);
  assert.match(app, /7-brand-story\|brand-story\|品牌质感\/礼品价值图\|做成多场景用途与风格拼贴/);
  assert.match(app, /8-size-capacity-fit\|size-capacity-fit\|尺寸容量适配图/);
  assert.match(app, /9-effect-comparison\|effect-comparison\|功能效果渲染图/);
  assert.match(app, /9-effect-comparison\|effect-comparison\|功能效果渲染图\|以一个清晰完整的商品主体为核心覆盖所有可靠功能；同屏不清晰时使用连续无损场景拼接，不做对比或遗漏/);
  assert.match(app, /10-spec-table\|spec-table\|参数规格图/);
  assert.match(app, /11-craft-process\|craft-process\|品质工艺证明图/);
  assert.match(app, /12-accessory-gift\|accessory-gift\|到手清单\/配件图/);
  assert.match(app, /13-series-showcase\|series-showcase\|多款式\/SKU选择图/);
  assert.match(app, /14-ingredient-material\|ingredient-material\|材质成分解析图/);
  assert.match(
    app,
    /15-after-sales\|after-sales\|痛点图\|用真实使用困扰、解决路径和结果变化，让买家知道它具体替我解决什么问题/,
  );
  assert.match(
    app,
    /16-usage-suggestion\|usage-suggestion\|卖点图\|用 3-5 个核心卖点连接功能证据和买后收益，让买家知道买它能获得什么好处/,
  );
  assert.match(app, /17-human-handheld\|human-handheld\|真人手持展示图/);
  assert.match(app, /18-human-wearable\|human-wearable\|真人穿戴场景图/);
  assert.doesNotMatch(app, /17-brand-story\|brand-story\|品牌故事图/);
  assert.doesNotMatch(app, /18-image-decomposition\|image-decomposition\|图片拆解图/);
  assert.doesNotMatch(app, /18-certification-proof\|certification-proof\|资质背书图/);
  assert.doesNotMatch(app, /brief\.className = "creation-card-brief";/);
  assert.doesNotMatch(app, /refs\.creationScenarioHint\.textContent =[\s\S]*CREATION_INDUSTRY_TEMPLATE_HINTS/);
  assert.match(app, /function getCreationSelectedPlatform\(/);
  assert.match(app, /function getCreationSelectedRoles\(\) \{/);
  assert.match(app, /Number\.isFinite\(value\) && CREATION_IMAGE_COUNT_OPTIONS\.includes\(value\)/);
  assert.match(app, /function setCreationImageCountValue\(count\) \{ syncCreationPlatformImageCountOptions\(\{ preferredValue: Number\(count\) \}\); \}/);
  assert.match(app, /function isCreationZeroImageCountMode\(\) \{/);
  assert.match(app, /CREATION_IMAGE_COUNT_OPTIONS\.includes\(selectedRoles\.length\)/);
  assert.match(app, /function syncCreationSelectedRolesToCount\(\) \{/);
  assert.doesNotMatch(app, /function syncCreationSelectedRolesToScenario\(\) \{/);
  assert.match(app, /function renderCreationRatioOptions\(\) \{/);
  assert.match(app, /function renderCreationSizeOptions\(\) \{/);
  assert.match(app, /function renderCreationRolePicker\(\) \{/);
  const creationRolePickerBody =
    app.match(/function renderCreationRolePicker\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction buildCreationLogoBatchPreviewItems/)?.[0] || "";
  assert.match(creationRolePickerBody, /input\.type = "checkbox";/);
  assert.doesNotMatch(creationRolePickerBody, /input\.disabled = state\.creation\.generating;/);
  assert.match(app, /function applyCreationReferenceFiles\(fileList\) \{/);
  const creationReferenceUploadHandler =
    app.match(/function applyCreationReferenceFiles\(fileList\) \{[\s\S]*?\r?\n}\r?\n\r?\nfunction renderCreationLogo/)?.[0] || "";
  assert.doesNotMatch(
    creationReferenceUploadHandler,
    /setCreationSelectValue\(refs\.creationVisualLanguageInput,\s*"reference-style",\s*"classic-commercial"\)/,
  );
  assert.match(app, /function buildCreationReferenceAnalysisFormData\(\) \{/);
  const creationReferenceAnalysisFormBody =
    app.match(/async function buildCreationReferenceAnalysisFormData\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\nasync function analyzeCreationReferenceImages/)?.[0] || "";
  assert.match(app, /const CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT = "low";/);
  assert.match(
    creationReferenceAnalysisFormBody,
    /formData\.set\(\s*"reasoningEffort",\s*CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT,\s*\);/,
  );
  assert.doesNotMatch(
    creationReferenceAnalysisFormBody,
    /refs\.reasoningEffortInput|state\.config\?\.defaults\?\.reasoningEffort|"xhigh"/,
  );
  assert.match(creationReferenceAnalysisFormBody, /formData\.set\("platform", getCreationSelectedPlatform\(\)\.value\)/);
  assert.match(creationReferenceAnalysisFormBody, /formData\.set\("platformLabel", getCreationSelectedPlatform\(\)\.label\)/);
  assert.match(app, /function analyzeCreationReferenceImages\(\) \{/);
  assert.match(app, /async function applyCreationReferenceAnalysis\(analysis\) \{/);
  assert.match(app, /async function applyCreationReferenceAnalysisCategoryMatch\(analysis, isCurrent = \(\) => true\) \{/);
  assert.match(app, /await applyCreationReferenceAnalysisCategoryMatch\(normalized, isCurrent\)/);
  assert.match(app, /buildCreationReferenceAnalysisCategoryMatchText\(analysis\)/);
  assert.match(app, /getCreationReferenceAnalysisCategoryProductName\(analysis\)/);
  assert.doesNotMatch(app, /refs\.creationProductNameInput\?\.value,[\s\S]*refs\.creationProductDescriptionInput\?\.value,[\s\S]*refs\.creationSellingPointsInput\?\.value,/);
  assert.match(app, /analysis\?\.reference_roles/);
  assert.match(app, /findCreationIndustryTemplateMatch/);
  assert.match(app, /findCreationIndustryTemplateProductNameMatch/);
  assert.match(app, /function applyCreationReferenceAnalysisRecommendations\(\) \{/);
  assert.doesNotMatch(app, /function applyCreationReferenceAnalysisVisualLanguage\(\) \{/);
  assert.match(app, /from "\/lib\/creation-reference-analysis-view\.mjs"/);
  assert.match(queueModule, /const platform =\s*[\r\n]+\s*typeof getCreationSelectedPlatform === "function"\s*[\r\n]+\s*\? getCreationSelectedPlatform\(\)\s*[\r\n]+\s*: DEFAULT_CREATION_PLATFORM;/);
  assert.match(queueModule, /platform:\s*platform\.value/);
  assert.match(queueModule, /platformLabel:\s*platform\.label/);
  assert.match(queueModule, /const normalizedVisualLanguage = normalizeVisualLanguageForQueue\(rawVisualLanguage, normalizeCreationVisualLanguage\);/);
  assert.match(queueModule, /visualLanguage:\s*normalizedVisualLanguage\.value/);
  assert.doesNotMatch(app, /formatCreationVisualLanguageLabel,\s*getCreationCurrentSet/);
  assert.doesNotMatch(app, /visualLanguageReason:/);
  assert.match(app, /hasCreationReferenceUsageInstructionSignal/);
  assert.match(app, /hasCreationReferenceDetailSignal/);
  assert.match(app, /hasCreationReferenceProductSubjectSignal/);
  assert.match(app, /shouldUseUsageRole/);
  assert.match(creationReferenceAnalysisView, /export function getCreationReferenceAnalysisGroupedSubjectUnitCount\(entry = \{\}, skuSubjects = \[\]\) \{/);
  assert.match(creationReferenceAnalysisView, /export function shouldDowngradeReferenceProductAnalysisRole\(entry = \{\}, subjectUnitCount = 0\) \{/);
  assert.match(creationReferenceAnalysisView, /export function getCreationReferenceAnalysisRoleCorrectionReason\(entry = \{\}, subjectUnitCount = 0\) \{/);
  assert.match(creationReferenceAnalysisView, /export function summarizeCreationReferenceAnalysisRoleCorrections\(recommendations = \[\]\) \{/);
  assert.match(creationReferenceAnalysisView, /export function buildCreationReferenceAnalysisAppliedFeedbackMessage\(/);
  assert.match(creationReferenceAnalysisView, /export function normalizeCreationReferenceAnalysisUnitCountNote\(note = "", subjectUnitCount = 0\) \{/);
  assert.match(app, /getCreationReferenceAnalysisGroupedSubjectUnitCount/);
  assert.match(app, /shouldDowngradeReferenceProductAnalysisRole/);
  assert.match(app, /getCreationReferenceAnalysisRoleCorrectionReason/);
  assert.match(app, /buildCreationReferenceAnalysisAppliedFeedbackMessage/);
  assert.match(app, /normalizeCreationReferenceAnalysisUnitCountNote/);
  assert.match(app, /normalizeCreationReferenceAnalysisRecommendation\(entry = \{\}, index = 0, skuSubjects = \[\]\)/);
  assert.match(app, /roleCorrectionReason:\s*roleCorrectionReason/);
  assert.match(app, /const appliedMessage = buildCreationReferenceAnalysisAppliedFeedbackMessage\(\{/);
  assert.doesNotMatch(app, /setCreationSelectValue\(refs\.creationVisualLanguageInput,\s*analysis\.visualLanguage,\s*"classic-commercial"\)/);
  assert.doesNotMatch(creationReferenceAnalysisView, /export function syncCreationReferenceVisualLanguageButton/);
  assert.doesNotMatch(creationReferenceAnalysisView, /已是建议视觉语言|应用视觉语言|视觉语言建议/);
  assert.doesNotMatch(app, /analysis\.visualLanguageLabel \|\| formatCreationVisualLanguageLabel\(analysis\.visualLanguage\)/);
  assert.doesNotMatch(app, /appendCreationVisualLanguageSuggestionCard/);
  assert.match(app, /state\.creationReferenceAnalysis\.applied = false;/);
  assert.match(app, /state\.creationReferenceAnalysis\.applied = true;/);
  assert.match(app, /correction\.className = "creation-reference-analysis-role-correction";/);
  assert.match(app, /correction\.textContent = entry\.roleCorrectionReason;/);
  assert.match(app, /function toggleCreationReferenceAnalysisPanel\(\) \{/);
  assert.match(app, /state\.creationReferenceAnalysis\.collapsed = !state\.creationReferenceAnalysis\.collapsed;/);
  assert.match(app, /function renderCreationReferenceAnalysis\(\) \{/);
  assert.match(app, /refs\.creationReferenceAnalysisPanel\.classList\.toggle\("is-collapsed", state\.creationReferenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.creationReferenceAnalysisSummary\.classList\.toggle\("hidden", state\.creationReferenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.creationReferenceAnalysisMeta\.classList\.toggle\("hidden", state\.creationReferenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.creationReferenceAnalysisList\.classList\.toggle\("hidden", state\.creationReferenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.creationReferenceAnalysisToggleButton\.setAttribute\("aria-expanded", String\(!state\.creationReferenceAnalysis\.collapsed\)\);/);
  assert.match(app, /function updateCreationReferenceRole\(referenceId, role\) \{/);
  assert.match(app, /role === "reference-product"/);
  assert.match(app, /item\.role === "reference-product" \? "product"/);
  assert.match(app, /function buildCreationReferenceRolePayload\(\) \{/);
  assert.match(app, /function buildCreationSkuSubjectPayload\(\) \{/);
  assert.match(app, /from "\/lib\/creation-reference-drag\.mjs"/);
  assert.match(app, /function reorderCreationReferenceFile\(referenceId,\s*beforeReferenceId\)\s*\{/);
  assert.match(app, /reorderCreationReferenceFiles\(state\.creationReferenceFiles, referenceId, beforeReferenceId\)/);
  assert.match(app, /creationReferenceCardId/);
  assert.match(app, /const isProductReference = isCreationSubjectReferenceRole\(item\.role \|\| "product"\);/);
  assert.match(app, /card\.draggable = isProductReference;/);
  assert.match(app, /bindCreationReferenceDrag\(\{\s*grid:\s*refs\.creationReferenceGrid,[\s\S]*getReferenceFiles:\s*\(\) => state\.creationReferenceFiles,[\s\S]*reorderReferenceFile:\s*reorderCreationReferenceFile,?[\s\S]*\}\);/);
  assert.match(creationReferenceDrag, /export function reorderCreationReferenceFiles\(referenceFiles = \[\], referenceId = "", beforeReferenceId = ""\) \{/);
  assert.match(creationReferenceDrag, /\.creation-reference-card\[data-creation-reference-card-id\]/);
  assert.match(creationReferenceDrag, /isCreationSubjectReferenceRole\(item\.role \|\| "product"\)/);
  assert.match(creationReferenceDrag, /grid\.addEventListener\("dragstart"/);
  assert.match(creationReferenceDrag, /grid\.addEventListener\("drop"[\s\S]*reorderReferenceFile\(referenceId, getCreationReferenceDropBeforeId\(event, dragState\)\)/);
  assert.match(
    app,
    /function buildCreationReferenceRolePayload\(\) \{[\s\S]*return state\.creationReferenceFiles[\s\S]*note: item\.note \|\| "",[\s\S]*\.filter\(\(item\) => item\.role !== "style"\);\s*\}/,
  );
  assert.doesNotMatch(app, /\{ value: "style", label: "风格参考" \}/);
  assert.match(app, /function inferCreationReferenceAnalysisRole\(entry = \{\}\) \{/);
  assert.match(app, /shouldUseDetailRole/);
  assert.match(app, /explicitRole === "other"/);
  assert.match(app, /hasCreationReferenceDimensionSignal\(text\)/);
  assert.match(app, /spec\(ification\)\?\\s\*\(table\|chart\|card\|sheet\|info\|information\|feel\|reference\|focus\|value\|values\)/);
  assert.match(app, /规格感\|尺寸感/);
  assert.match(app, /function buildCreationPlanPreviewFormData\(\) \{/);
  assert.match(app, /creationIndustryTemplateInput: document\.querySelector\("#creationIndustryTemplateInput"\)/);
  assert.doesNotMatch(app, /const CREATION_SCENARIO_HINTS = \{/);
  assert.doesNotMatch(app, /const CREATION_INDUSTRY_TEMPLATE_HINTS = \{/);
  assert.match(app, /const CREATION_INDUSTRY_TEMPLATE_LEVEL_LABELS = \[/);
  assert.match(app, /function getCreationIndustryTemplateLevelOptions\(/);
  assert.match(app, /categoryPath: getCreationIndustryTemplateLevelPath\(level, name, browserPath\)/);
  assert.match(app, /function getCreationIndustryTemplateLevelPath\(level, name, browserPath = state\.creationIndustryTemplateBrowser\) \{/);
  assert.match(app, /\[browserPath\.level1, name\]\.filter\(Boolean\)\.join\(" > "\)/);
  assert.match(app, /\[browserPath\.level1, browserPath\.level2, name\]\.filter\(Boolean\)\.join\(" > "\)/);
  assert.match(app, /function createCreationIndustryTemplateButton\(\{\s*categoryPath = ""/);
  assert.match(app, /button\.title = \[name, metaText\]\.filter\(Boolean\)\.join\(" · "\)/);
  assert.match(app, /function getCreationIndustryTemplateActiveLevel\(/);
  assert.match(app, /function focusCreationIndustryTemplateBrowserOnSelectedTemplate\(\) \{/);
  assert.match(app, /const currentTemplate = getCreationSelectedIndustryTemplate\(\);[\s\S]*if \(!currentTemplate\.categoryPath\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setCreationIndustryTemplateBrowserPath\(currentTemplate\);/);
  assert.match(app, /function goBackCreationIndustryTemplateLevel\(\) \{/);
  assert.match(app, /function setCreationIndustryTemplateBrowserOpen\(/);
  assert.doesNotMatch(app, /function renderCreationIndustryTemplateLevel\(/);
  assert.match(app, /function renderCreationIndustryTemplateSearchResults\(/);
  assert.match(app, /function renderCreationIndustryTemplateBrowser\(\) \{/);
  assert.match(app, /searchCreationIndustryTemplates\(query, \{ limit: 48, includeBase: false \}\)/);
  assert.match(app, /metaText = template\.categoryPath \|\| template\.code \|\| "";/);
  assert.match(app, /button\.append\(title, meta\);/);
  assert.doesNotMatch(app, /meta\.textContent = `\$\{template\.code\} \//);
  assert.doesNotMatch(app, /个四级类目/);
  assert.match(app, /currentTemplate\.value && currentTemplate\.value !== "general"/);
  assert.match(app, /return currentTemplate\.label \|\| currentTemplate\.value;/);
  assert.doesNotMatch(app, /function getCreationPlanOverrides\(\) \{/);
  assert.doesNotMatch(app, /function canEditCreationItem\(/);
  assert.match(app, /function previewCreationPlan\(\) \{/);
  assert.match(app, /function resetCreationDraftPreview\(\) \{/);
  assert.match(app, /const file = getCreationReferenceGenerationFile\(item\);[\s\S]*formData\.append\("referenceImages", file\)/);
  assert.match(app, /formData\.set\("dimensionSpecs", refs\.creationDimensionSpecsInput\.value\.trim\(\)\)/);
  assert.match(app, /formData\.set\("dimensionUnitMode", refs\.creationDimensionUnitModeInput\.value \|\| "both"\)/);
  assert.match(app, /formData\.set\("referenceImageRoles", JSON\.stringify\(buildCreationReferenceRolePayload\(\)\)\)/);
  assert.match(app, /formData\.set\("skuSubjects", JSON\.stringify\(buildCreationSkuSubjectPayload\(\)\)\)/);
  assert.match(app, /formData\.set\("skuBundleCount", refs\.creationSkuBundleCountInput\?\.value \|\| "1"\)/);
  assert.match(app, /formData\.set\("platform", getCreationSelectedPlatform\(\)\.value\)/);
  assert.doesNotMatch(app, /formData\.set\("visualLanguage", refs\.creationVisualLanguageInput\?\.value \|\| "classic-commercial"\)/);
  assert.doesNotMatch(app, /formData\.set\("planOverrides"/);
  assert.match(app, /creationRoleSelectionManuallyEdited:\s*false/);
  assert.match(app, /const CREATION_REFERENCE_COVERAGE_ROLE_TARGETS = \{/);
  assert.match(app, /usage:\s*\["usage-suggestion"\]/);
  assert.match(app, /scene:\s*\["scene",\s*"atmosphere"\]/);
  assert.match(app, /material:\s*\["product-detail",\s*"ingredient-material"\]/);
  assert.match(app, /dimensions:\s*\["size-capacity-fit",\s*"spec-table"\]/);
  assert.match(app, /package:\s*\["accessory-gift"\]/);
  assert.match(app, /from "\/lib\/creation-reference-coverage\.mjs\?v=20260703-latest-restore-1"/);
  assert.match(creationReferenceCoverage, /export function applyCreationReferenceCoverageRolePlan\(/);
  assert.match(creationReferenceCoverage, /export function normalizeCreationCoverageFields\(/);
  assert.match(creationReferenceCoverage, /export function appendCreationCoverageSummary\(/);
  assert.match(creationReferenceCoverage, /export function toggleCreationSelectedRoles\(/);
  assert.match(app, /function syncCreationSelectedRolesToReferenceCoverage\(analysis = state\.creationReferenceAnalysis\.result\) \{/);
  assert.match(app, /if \(state\.creationRoleSelectionManuallyEdited\) \{/);
  assert.match(app, /fetch\("\/api\/creation\/reference\/analyze"/);
  assert.match(app, /fetch\("\/api\/creation\/plan"/);
  assert.match(app, /formData\.set\("selectedRoles", JSON\.stringify\(getCreationSelectedRoles\(\)\)\)/);
  assert.match(app, /roleSelect\.dataset\.creationReferenceRoleId = item\.id;/);
  assert.match(app, /function updateCreationReferenceRole\(referenceId, role\) \{\s*state\.creationReferenceFiles = state\.creationReferenceFiles\.map\([\s\S]*?\);\s*markCreationReferenceAnalysisDirty\(\{ invalidateCategorySuggestion: false \}\);\s*resetCreationDraftPreview\(\);\s*renderCreationReferenceGrid\(\);\s*\}/);
  assert.doesNotMatch(app, /creationStyleReference|applyCreationStyleReferenceFiles/);
  assert.match(app, /formData\.set\("imageCount", String\(getCreationPlanPreviewImageCount\(selectedRoles\)\)\)/);
  assert.doesNotMatch(app, /formData\.set\("scenario", refs\.creationScenarioInput\.value\)/);
  assert.match(app, /formData\.set\("skuGenerationEnabled", String\(refs\.creationSkuGenerationEnabledInput\?\.checked !== false\)\)/);
  assert.match(app, /formData\.set\("infographicRebuildEnabled", String\(isCreationInfographicRebuildRequired\(\) \|\| refs\.creationInfographicRebuildEnabledInput\?\.checked === true\)\)/);
  assert.match(app, /formData\.set\("skuGenerationRule", getCreationSelectedSkuGenerationRule\(\)\.value\)/);
  assert.match(app, /skuGenerationEnabled: String\(set\.skuGenerationEnabled !== false\)/);
  assert.match(app, /infographicRebuildEnabled: String\(set\.infographicRebuildEnabled === true\)/);
  assert.match(app, /refs\.creationSkuGenerationEnabledInput\.checked = normalized\.skuGenerationEnabled !== false;/);
  assert.match(app, /refs\.creationInfographicRebuildEnabledInput\.checked = normalized\.infographicRebuildEnabled === true;/);
  assert.match(app, /const DEFAULT_CREATION_SKU_GENERATION_RULE = "color-name-under-subject";/);
  assert.match(app, /"color-name-under-subject": "显示颜色"/);
  assert.match(app, /formData\.set\("industryTemplate", resolveCreationReferenceAnalysisContextCategoryValue\(\{ analysisDirty: state\.creationReferenceAnalysis\.dirty,[^\n]*categorySuggestionStale: state\.creationReferenceAnalysis\.categorySuggestionStale,[^\n]*previousAutoCategoryValue: state\.creationReferenceAnalysis\.categoryTemplateSuggestion \}\)\)/);
  assert.match(app, /\[refs\.creationProductNameInput, refs\.creationProductDescriptionInput, refs\.creationSellingPointsInput, refs\.creationDimensionSpecsInput\]\.forEach\(\(input\) => input\.addEventListener\("input", resetCreationDraftPreview\)\)/);
  assert.match(app, /\[refs\.creationDimensionUnitModeInput, refs\.creationTargetLanguageInput, refs\.creationPlatformInput\]\.forEach\(\(input\) => input\?\.addEventListener\("change", resetCreationDraftPreview\)\)/);
  assert.match(app, /refs\.creationImageCountInput\.addEventListener\("change",\s*\(\) => \{[\s\S]*syncCreationSelectedRolesToCount\(\)[\s\S]*requestCreationPlanPreview\(\)/);
  assert.match(app, /refs\.creationImageCountInput\.addEventListener\("click", syncCreationSelectedRolesToCurrentCount\)/);
  assert.match(app, /refs\.creationSkuGenerationEnabledInput\?\.addEventListener\("change", refreshCreationPlanAfterSkuGenerationToggle\)/);
  assert.match(app, /refs\.creationInfographicRebuildEnabledInput\?\.addEventListener\("change", resetCreationDraftPreview\)/);
  assert.match(app, /refs\.creationSkuGenerationRuleInput\?\.addEventListener\("change", resetCreationDraftPreview\)/);
  assert.match(app, /refs\.creationRoleGrid\.addEventListener\("change"/);
  assert.doesNotMatch(app, /refs\.creationScenarioInput\.addEventListener\("change", syncCreationSelectedRolesToScenario\)/);
  assert.doesNotMatch(app, /refs\.creationIndustryTemplateInput\.addEventListener\("change", syncCreationSelectedRolesToIndustry\)/);
  assert.match(app, /const shouldOpenCreationIndustryTemplateBrowser = refs\.creationIndustryTemplatePopover\?\.hidden !== false;/);
  assert.match(app, /if \(shouldOpenCreationIndustryTemplateBrowser\) \{[\s\S]*focusCreationIndustryTemplateBrowserOnSelectedTemplate\(\);[\s\S]*\}[\s\S]*renderCreationIndustryTemplateBrowser\(\);[\s\S]*setCreationIndustryTemplateBrowserOpen\(shouldOpenCreationIndustryTemplateBrowser\);/);
  assert.match(app, /refs\.creationIndustryTemplateBrowser\.addEventListener\("click"/);
  assert.match(app, /refs\.creationIndustryTemplateBackButton\.addEventListener\("click", goBackCreationIndustryTemplateLevel\)/);
  assert.match(app, /refs\.creationIndustryTemplateSearchInput\.addEventListener\("input"/);
  assert.match(app, /setCreationIndustryTemplateBrowserOpen\(true\)/);
  assert.match(app, /document\.addEventListener\("pointerdown"/);
  assert.match(app, /document\.addEventListener\("keydown"/);
  assert.match(app, /function setCreationRatioOptionLabels\(\{ expanded = false \} = \{\}\) \{/);
  assert.match(app, /element\.dataset\.fullLabel = option\.label;/);
  assert.match(app, /element\.textContent = getCreationRatioCompactLabel\(option\);/);
  assert.match(app, /refs\.creationRatioInput\.addEventListener\("pointerdown", \(\) => setCreationRatioOptionLabels\(\{ expanded: true \}\)\)/);
  assert.match(app, /refs\.creationRatioInput\.addEventListener\("blur", \(\) => setCreationRatioOptionLabels\(\{ expanded: false \}\)\)/);
  assert.match(app, /refs\.creationRatioInput\.addEventListener\("change", \(\) => \{[\s\S]*renderCreationSizeOptions\(\);[\s\S]*setCreationRatioOptionLabels\(\{ expanded: false \}\);[\s\S]*\}\)/);
  assert.match(app, /setCreationSelectValue\(refs\.creationDimensionUnitModeInput, normalized\.dimensionUnitMode, "both"\)/);
  assert.match(app, /setCreationSelectValue\(refs\.creationPlatformInput, normalized\.platform, "universal"\)/);
  assert.doesNotMatch(app, /setCreationSelectValue\(refs\.creationVisualLanguageInput, normalized\.visualLanguage, "classic-commercial"\)/);
  assert.match(app, /refs\.creationPlanButton\.addEventListener\("click"/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("change",[\s\S]*creationReferenceRoleId/);
  assert.doesNotMatch(app, /styleReferenceImages|creationStyleReference/);
  assert.match(app, /refs\.creationReferenceAnalyzeButton\.addEventListener\("click"/);
  assert.match(app, /async function applyCreationReferenceAnalysis\(analysis\)[\s\S]*applyCreationReferenceAnalysisRecommendations\(\)/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("dblclick", beginCreationReferenceNoteEditing\)/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("focusout"[\s\S]*commitCreationReferenceNoteEditing/);
  assert.doesNotMatch(app, /refs\.creationReferenceApplyVisualLanguageButton\.addEventListener\("click", applyCreationReferenceAnalysisVisualLanguage\)/);
  assert.match(app, /refs\.creationReferenceAnalysisToggleButton\.addEventListener\("click", toggleCreationReferenceAnalysisPanel\)/);
  const creationApplyAnalysisBody = app.match(/function applyCreationReferenceAnalysisRecommendations\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction renderCreationReferenceAnalysis/)?.[0] || "";
  assert.doesNotMatch(creationApplyAnalysisBody, /previousVisualLanguage/);
  assert.match(creationApplyAnalysisBody, /syncCreationSelectedRolesToReferenceCoverage\(analysis\);/);
  assert.match(creationApplyAnalysisBody, /state\.creationReferenceAnalysis\.collapsed = true;/);
  assert.doesNotMatch(creationApplyAnalysisBody, /setCreationSelectValue\(refs\.creationVisualLanguageInput/);
  assert.match(creationApplyAnalysisBody, /renderCreationReferenceAnalysis\(\);/);
  assert.doesNotMatch(creationApplyAnalysisBody, /state\.creation\.generating/);
  const toggleCreationRoleBody = app.match(/function toggleCreationSelectedRole\(role\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction getCreationPreviewSlots/)?.[0] || "";
  assert.match(toggleCreationRoleBody, /state\.creationRoleSelectionManuallyEdited = true;/);
  const syncPresetBody = app.match(/function syncCreationSelectedRolesToPreset\(selectedRoles\) \{[\s\S]*?\r?\n\}\r?\nfunction syncCreationSelectedRolesToIndustry/)?.[0] || "";
  assert.match(syncPresetBody, /if \(state\.creationRoleSelectionManuallyEdited\) \{[\s\S]*resetCreationDraftPreview\(\);[\s\S]*return;/);
  assert.doesNotMatch(app, /function syncCreationSelectedRolesToScenario\(\) \{ syncCreationSelectedRolesToPreset\(getCreationRecommendedRolePreset\(\)\); \}/);
  assert.match(app, /function syncCreationSelectedRolesToIndustry\(\) \{ syncCreationSelectedRolesToPreset\(getCreationRecommendedRolePreset\(\)\); \}/);
  assert.doesNotMatch(app, /appendCreationCoverageSummary\(card, item/);
  assert.match(creationReferenceCoverage, /export function buildCreationCoverageSummaryText\(item = \{\}\) \{/);
  assert.match(creationReferenceCoverage, /coverageSummaryText/);
  assert.doesNotMatch(app, /state\.creationReferenceAnalysis = state\.referenceAnalysis/);
  assert.doesNotMatch(app, /state\.creation\.creationReferenceFiles/);
  assert.doesNotMatch(app, /state\.creationReferenceFiles = state\.referenceFiles/);
});

test("creation mode exposes optional logo upload placement and background controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loadingModule = await readFile(creationCardLoadingPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");

  assert.match(html, /id="creationLogoLibraryButton"[\s\S]*aria-controls="creationLogoLibraryPanel"/);
  assert.match(html, /id="creationLogoLibraryPanel"[\s\S]*id="creationLogoLibraryInput"[\s\S]*accept="image\/\*"[\s\S]*multiple[\s\S]*id="creationSavedLogoGrid"/);
  assert.match(html, /id="creationLogoInput"[\s\S]*name="logoImage"[\s\S]*accept="image\/\*"/);
  assert.match(html, /id="creationLogoPreview"/);
  assert.match(html, /id="creationLogoPlacementInput"[\s\S]*value="top-left" selected[\s\S]*value="top-right"[\s\S]*value="bottom-left"[\s\S]*value="bottom-right"/);
  assert.match(html, /id="creationLogoBackgroundInput"[\s\S]*value="transparent"[\s\S]*value="remove-background"/);

  assert.match(styles, /\.creation-logo-block\s*\{/);
  assert.match(styles, /\.creation-logo-library-button\s*\{/);
  const logoBlockRule = readCssRule(styles, ".creation-logo-block");
  const logoPanelRule = readCssRule(styles, ".creation-logo-library-panel");
  const logoPanelHiddenRule = readCssRule(styles, ".creation-logo-library-panel.hidden");
  const logoPreviewRule = readCssRule(styles, ".creation-logo-preview");
  const logoPreviewImageRule = readCssRule(styles, ".creation-logo-preview img");
  const logoRemoveRule = readCssRule(styles, ".creation-logo-preview > .creation-logo-remove");
  assert.match(logoBlockRule, /position:\s*relative;/);
  assert.match(logoPanelRule, /position:\s*fixed;/);
  assert.match(logoPanelRule, /left:\s*var\(--creation-logo-library-left,\s*auto\);/);
  assert.match(logoPanelRule, /z-index:\s*\d+;/);
  assert.match(logoPanelRule, /box-shadow:/);
  assert.match(logoPanelHiddenRule, /display:\s*none !important;/);
  assert.match(logoPreviewRule, /width:\s*fit-content;/);
  assert.match(logoPreviewRule, /grid-template-columns:\s*76px;/);
  assert.match(logoPreviewImageRule, /width:\s*76px;/);
  assert.match(logoPreviewImageRule, /height:\s*76px;/);
  assert.match(logoPreviewImageRule, /object-fit:\s*contain;/);
  assert.match(logoRemoveRule, /position:\s*absolute;/);
  assert.match(logoRemoveRule, /opacity:\s*1;/);
  assert.match(logoRemoveRule, /pointer-events:\s*auto;/);
  assert.match(styles, /\.creation-saved-logo-grid\s*\{/);
  assert.match(styles, /\.creation-logo-controls\s*\{/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-logo-controls\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);

  assert.match(app, /createCreationLogoLibraryController/);
  assert.match(app, /creationLogo:\s*\{/);
  assert.match(app, /creationLogoLibraryButton: document\.querySelector\("#creationLogoLibraryButton"\)/);
  assert.match(app, /creationLogoLibraryInput: document\.querySelector\("#creationLogoLibraryInput"\)/);
  assert.match(app, /creationSavedLogoGrid: document\.querySelector\("#creationSavedLogoGrid"\)/);
  assert.match(app, /const creationLogoLibrary = createCreationLogoLibraryController\(/);
  assert.match(app, /creationLogoLibrary\.bind\(\)/);
  assert.match(app, /creationLogoLibrary\.load\(\)/);
  assert.match(app, /creationLogoInput: document\.querySelector\("#creationLogoInput"\)/);
  assert.match(app, /creationLogoPlacementInput: document\.querySelector\("#creationLogoPlacementInput"\)/);
  assert.match(app, /creationLogoBackgroundInput: document\.querySelector\("#creationLogoBackgroundInput"\)/);
  assert.match(app, /function applyCreationLogoFile\(fileList,\s*\{\s*persist = true\s*\} = \{\}\) \{/);
  assert.match(app, /function getCreationLogoPayload\(\) \{/);
  assert.match(app, /formData\.set\("logoOptions", JSON\.stringify\(getCreationLogoPayload\(\)\)\);/);
  assert.match(app, /formData\.append\("logoImage", logoFile\);/);
  assert.match(app, /logo:\s*plan\.logo \|\| getCreationLogoPayload\(\),/);
  assert.match(queueModule, /logo:\s*getCreationLogoPayload\(\),/);
  assert.match(app, /refs\.creationLogoInput\.addEventListener\("change"/);
});

test("creation compact layouts keep panels and reference grids from overlapping", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /html\[data-ui-layout="stacked"\] \.creation-workspace,[\s\S]*html\[data-ui-layout="tablet"\] \.creation-workspace,[\s\S]*html\[data-ui-layout="mobile"\] \.creation-workspace\s*\{[\s\S]*grid-auto-rows:\s*max-content;[\s\S]*align-content:\s*start;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="stacked"\] \.creation-settings-panel,[\s\S]*html\[data-ui-layout="tablet"\] \.creation-output-panel,[\s\S]*html\[data-ui-layout="mobile"\] \.creation-output-panel\s*\{[\s\S]*height:\s*auto;[\s\S]*max-height:\s*none;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.creation-reference-grid,[\s\S]*html\[data-ui-layout="mobile"\] \.creation-logo-batch-source-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.creation-reference-grid \.reference-card,[\s\S]*html\[data-ui-layout="mobile"\] \.creation-logo-batch-source-grid \.reference-card\s*\{[\s\S]*min-width:\s*0;/,
  );
});

test("creation mode exposes upload-image logo batch branch", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /class="creation-branch-tabs"[\s\S]*name="creationBranch"[\s\S]*value="set" checked/);
  assert.match(html, /id="creationBranchLogoBatchInput"[\s\S]*value="logo-batch"/);
  assert.match(html, /id="creationLogoBatchSourceInput"[\s\S]*name="logoBatchSourceImages"[\s\S]*accept="image\/\*"[\s\S]*multiple/);
  assert.match(html, /id="creationLogoBatchSourceGrid"/);
  assert.match(html, /data-creation-set-only/);
  assert.match(html, /data-creation-logo-batch-only/);

  assert.match(styles, /\.creation-branch-tabs\s*\{/);
  assert.match(styles, /\.creation-logo-batch-source-block\s*\{/);
  assert.match(styles, /\.creation-branch-option:has\(input:checked\)\s*\{/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-branch-tabs\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);

  assert.match(app, /creationBranch:\s*"set"/);
  assert.match(app, /creationLogoBatchFiles:\s*\[\]/);
  assert.match(app, /creationBranchInputs:\s*document\.querySelectorAll\('\[name="creationBranch"\]'\)/);
  assert.match(app, /creationLogoBatchSourceInput: document\.querySelector\("#creationLogoBatchSourceInput"\)/);
  assert.match(app, /function setCreationBranch\(branch = "set"\) \{/);
  assert.match(app, /function applyCreationLogoBatchSourceFiles\(fileList\) \{/);
  assert.match(app, /function renderCreationLogoBatchSourceGrid\(\) \{/);
  assert.match(app, /function buildCreationLogoBatchFormData\(\) \{/);
  assert.match(app, /function hasPendingCreationBranchGenerationFiles\(\) \{/);
  assert.match(app, /const preparingReferences = hasPendingCreationBranchGenerationFiles\(\);/);
  assert.match(app, /formData\.append\("sourceImages", file\)/);
  assert.match(app, /fetch\("\/api\/creation\/logo-batch"/);

  const logoBatchForm = app.match(/function buildCreationLogoBatchFormData\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(logoBatchForm, /creationProductNameInput/);
  assert.match(logoBatchForm, /const title = firstSourceName \? `上传图加 Logo \$\{firstSourceName\}` : "上传图加 Logo";/);
});

test("creation reference analysis apply fills product name from fourth-level category", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function applyCreationReferenceAnalysisProductNameSuggestion\(analysis = \{\}\) \{/);
  assert.match(app, /productName: String\(analysis\?\.productName \|\| analysis\?\.product_name/);
  assert.match(app, /applyCreationReferenceAnalysisProductNameValue\(\{[\s\S]*previousAutoProductName: state\.creationReferenceAnalysis\.productNameSuggestion,[\s\S]*\}\)/);
  assert.match(app, /state\.creationReferenceAnalysis\.productNameSuggestion = result\.autoProductName;/);
  assert.match(app, /setCreationReferenceProductNameValue\(result\.productName\);/);
  assert.match(
    app,
    /state\.creationReferenceAnalysis\.applied = true;[\s\S]*const productNameApplied = applyCreationReferenceAnalysisProductNameSuggestion\(analysis\);/,
  );
});

test("creation reference analysis auto-fills product name after recognition", async () => {
  const app = await readFile(appPath, "utf8");
  const applyBody = app.match(/async function applyCreationReferenceAnalysis\(analysis\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(applyBody, /const categoryMatch = await applyCreationReferenceAnalysisCategoryMatch\(normalized, isCurrent\);/);
  assert.match(applyBody, /const appliedResult = applyCreationReferenceAnalysisRecommendations\(\);/);
  assert.match(applyBody, /categoryApplied: categoryMatch\.applied,[\s\S]*categoryCleared: categoryMatch\.cleared,[\s\S]*matchedTemplate: categoryMatch\.template,[\s\S]*\.\.\.appliedResult/);
  assert.match(app, /resolveCreationReferenceAnalysisContextCategoryValue\(\{[\s\S]*categorySuggestionStale: state\.creationReferenceAnalysis\.categorySuggestionStale,[\s\S]*previousAutoCategoryValue: state\.creationReferenceAnalysis\.categoryTemplateSuggestion/);
  assert.match(app, /formData\.set\("industryTemplate", resolveCreationReferenceAnalysisContextCategoryValue\(\{ analysisDirty: state\.creationReferenceAnalysis\.dirty,[^\n]*categorySuggestionStale: state\.creationReferenceAnalysis\.categorySuggestionStale,[^\n]*previousAutoCategoryValue: state\.creationReferenceAnalysis\.categoryTemplateSuggestion \}\)\);/);
  assert.match(app, /function markCreationReferenceAnalysisDirty\(\{ invalidateCategorySuggestion = true \} = \{\}\) \{[\s\S]*if \(invalidateCategorySuggestion\) state\.creationReferenceAnalysis\.categorySuggestionStale = true;/);
  assert.match(app, /markCreationReferenceAnalysisDirty\(\{ invalidateCategorySuggestion: false \}\); resetCreationDraftPreview\(\); renderCreationReferenceGrid\(\); renderCreationView\(\);/);
  assert.match(app, /function clearCreationReferenceAnalysisManagedCategory\(\) \{[\s\S]*resolveCreationReferenceAnalysisCategoryValue\([\s\S]*if \(!resolution\.cleared\)[\s\S]*setCreationIndustryTemplateValue\(resolution\.categoryValue/);
  assert.match(app, /state\.creationReferenceFiles = \[\];[\s\S]*clearCreationReferenceAnalysisManagedCategory\(\);[\s\S]*state\.creation\.planDirty = true;/);
  assert.match(app, /const \{ appliedMessage, categoryApplied, categoryCleared, matchedTemplate \} = await applyCreationReferenceAnalysis\(payload\);/);
  assert.match(app, /categoryCleared[\s\S]*本轮未识别到可靠商品类目，已恢复为通用电商/);
});

test("creation reference analysis preserves grouped product labels on reference cards", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /getCreationReferenceAnalysisDisplayRoleLabel/);
  assert.match(app, /choice\.textContent = getCreationReferenceAnalysisDisplayRoleLabel\(\{ role: option\.value, roleLabel: option\.label, subjectUnitCount: item\.subjectUnitCount \}\);/);
  assert.match(app, /subjectUnitCount,\s*roleLabel: getCreationReferenceAnalysisDisplayRoleLabel/);
  assert.match(app, /subjectUnitCount: recommendation\.subjectUnitCount \|\| 0/);
  assert.match(app, /subjectUnitCount: item\.subjectUnitCount \|\| 0/);
});

test("creation reference analysis ignores stale in-flight image batches", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getCreationReferenceAnalysisSnapshot\(\) \{[\s\S]*state\.creationReferenceFiles\.map/);
  assert.match(
    app,
    /function invalidateCreationReferenceAnalysisRequest\(\) \{[^\n]*creationReferenceAnalysisRequestToken \+= 1;[^\n]*state\.creationReferenceAnalysis\.running = false;[^\n]*\}/,
  );

  const dirtyBody = app.match(/function markCreationReferenceAnalysisDirty\(\{ invalidateCategorySuggestion = true \} = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(dirtyBody, /invalidateCreationReferenceAnalysisRequest\(\);/);

  const analyzeStart = app.indexOf("async function analyzeCreationReferenceImages()");
  const analyzeEnd = app.indexOf("function renderCreationRolePicker()", analyzeStart);
  assert.ok(analyzeStart >= 0 && analyzeEnd > analyzeStart);
  const analyzeBody = app.slice(analyzeStart, analyzeEnd);
  assert.match(analyzeBody, /const referenceSnapshot = getCreationReferenceAnalysisSnapshot\(\);/);
  assert.match(
    analyzeBody,
    /requestToken !== creationReferenceAnalysisRequestToken \|\| referenceSnapshot !== getCreationReferenceAnalysisSnapshot\(\)/,
  );
});

test("creation mode exposes record detail and item repair actions", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loadingModule = await readFile(creationCardLoadingPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");
  const repairFormDataBody = app.match(/function buildCreationRepairFormData\([^]*?(?=\r?\nasync function handleCreationStreamEvent)/)?.[0] || "";

  assert.match(html, /id="creationRepairFailedButton"[\s\S]*补齐未完成项/);
  assert.match(html, /id="creationRecordDetail"/);

  assert.match(styles, /\.creation-record-detail\s*\{/);
  assert.match(styles, /#creationRecordDetail\.creation-record-detail\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /#creationRecordDetail \.creation-record-section\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /#creationRecordDetail \.creation-record-section\.is-wide\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /#creationRecordDetail \.creation-record-field\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\);/);
  assert.match(styles, /#creationRecordDetail \.creation-record-label\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /#creationRecordDetail \.creation-record-value\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /#creationRecordArchiveDetail\.creation-record-detail\.is-toggleable\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/);
  assert.match(styles, /\.creation-record-detail-toggle\s*\{[\s\S]*width:\s*32px;[\s\S]*height:\s*32px;/);
  assert.match(styles, /\.creation-record-detail-toggle::before\s*\{[\s\S]*transform:\s*rotate\(45deg\);/);
  assert.match(styles, /#creationRecordArchiveDetail\.creation-record-detail\.is-expanded \.creation-record-detail-toggle::before\s*\{[\s\S]*transform:\s*rotate\(-135deg\);/);
  assert.match(styles, /#creationRecordArchiveDetail\.creation-record-detail\.is-collapsed \.creation-record-detail-body\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /\.creation-card-actions\s*\{/);
  assert.match(styles, /\.creation-card-path\s*\{/);
  assert.match(styles, /\.creation-card\s*\{[\s\S]*position:\s*relative;[\s\S]*isolation:\s*isolate;[\s\S]*gap:\s*8px;[\s\S]*min-height:\s*max-content;[\s\S]*padding:\s*8px;/);
  assert.match(
    styles,
    /\.creation-card\s*\{[\s\S]*transition:\s*border-color\s+160ms\s+ease,\s*box-shadow\s+160ms\s+ease;/,
  );
  assert.match(
    styles,
    /\.creation-card:hover,\s*\.creation-card:focus-within\s*\{[\s\S]*border-color:\s*#ff9f43;[\s\S]*box-shadow:\s*0\s+0\s+0\s+1px\s+rgba\(255,\s*159,\s*67,\s*0\.28\),\s*0\s+0\s+16px\s+rgba\(255,\s*136,\s*40,\s*0\.24\);/,
  );
  assert.match(styles, /\.creation-card-head\s*\{[\s\S]*min-width:\s*0;/);
  assert.match(styles, /\.creation-card-head strong\s*\{[\s\S]*font-size:\s*0\.82rem;[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.creation-result-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);[\s\S]*grid-auto-rows:\s*max-content;[\s\S]*gap:\s*10px;/);
  assert.match(styles, /\.creation-card\.is-sku\s*\{[\s\S]*order:\s*2;/);
  assert.match(styles, /\.creation-card\.is-infographic-rebuild\s*\{[\s\S]*order:\s*3;/);
  assert.match(styles, /\.creation-card\.is-sku-start,[\s\S]*\.creation-card\.is-infographic-rebuild-start\s*\{[\s\S]*grid-column-start:\s*1;/);
  assert.match(styles, /\.creation-card-media\s*\{[\s\S]*width:\s*min\(100%,\s*220px\);[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/);
  assert.match(styles, /\.creation-card-actions \.mini-action\s*\{[\s\S]*height:\s*30px;/);
  assert.doesNotMatch(styles, /\.creation-card-editor|\.creation-prompt-editor-layer/);

  assert.match(app, /creationRepairFailedButton: document\.querySelector\("#creationRepairFailedButton"\)/);
  assert.match(app, /creationRecordDetail: document\.querySelector\("#creationRecordDetail"\)/);
  assert.match(app, /function formatCreationReferenceRoleSummary\(referenceImageRoles = \[\]\) \{/);
  assert.match(app, /function getCreationRepairReferenceRolePayload\(set = getCreationCurrentSet\(\)\) \{/);
  assert.match(app, /function renderCreationRecordDetail\(set\) \{/);
  assert.match(app, /recordDetailExpanded:\s*false,/);
  assert.match(app, /function toggleCreationRecordArchiveDetail\(\) \{/);
  assert.match(app, /state\.creation\.recordDetailExpanded = !state\.creation\.recordDetailExpanded;/);
  assert.match(app, /state\.creation\.recordDetailExpanded = false;[\s\S]*renderCreationRecordView\(\);/);
  assert.match(app, /const detailToggle = document\.createElement\("button"\);[\s\S]*detailToggle\.dataset\.creationRecordDetailToggle = "true";/);
  assert.match(app, /refs\.creationRecordArchiveDetail\.addEventListener\("click",[\s\S]*closest\("\[data-creation-record-detail-toggle\]"\)[\s\S]*toggleCreationRecordArchiveDetail\(\);/);
  assert.match(app, /const detailSections = \[/);
  assert.equal(
    (app.match(/\["商品类目", set\.industryTemplateLabel \|\| CREATION_INDUSTRY_TEMPLATE_LABELS\[set\.industryTemplate\] \|\| "通用电商"\]/g) || []).length,
    2,
  );
  assert.doesNotMatch(app, /\["行业", set\.industryTemplateLabel/);
  assert.match(app, /section\.className = `creation-record-section\$\{wide \? " is-wide" : ""\}`;/);
  assert.match(app, /item\.className = "creation-record-field";/);
  assert.match(app, /labelNode\.className = "creation-record-label";/);
  assert.match(app, /valueNode\.className = "creation-record-value";/);
  assert.match(app, /renderCreationRecordDetail\(set\)[\s\S]*formatCreationReferenceRoleSummary\(set\.referenceImageRoles\)/);
  assert.match(app, /function repairCreationItems\(/);
  assert.match(repairFormDataBody, /const useDraftFiles = shouldUseCreationRepairDraftFiles\(currentSet\);/);
  assert.match(repairFormDataBody, /formData\.set\("referenceImageRoles", JSON\.stringify\(useDraftFiles \? getCreationRepairReferenceRolePayload\(currentSet\) : currentSet\?\.referenceImageRoles \|\| \[\]\)\);/);
  assert.match(repairFormDataBody, /if \(useDraftFiles\) \{[\s\S]*state\.creationReferenceFiles\.forEach/);
  assert.doesNotMatch(repairFormDataBody, /formData\.set\("referenceImageRoles", JSON\.stringify\(getCreationRepairReferenceRolePayload\(currentSet\)\)\);/);
  assert.match(queueModule, /const referenceImageRoles = buildCreationReferenceRolePayload\(\);/);
  assert.match(queueModule, /referenceImageRoles,/);
  assert.doesNotMatch(app, /function getCreationItemDraftKey|function toggleCreationItemEditor|function closeCreationItemEditor|function saveCreationItemDraft/);
  assert.match(app, /fetch\("\/api\/creation\/repair"/);
  assert.doesNotMatch(app, /formData\.set\("promptOverride"/);
  assert.match(app, /button\.dataset\.creationRetryItemId = item\.itemId;/);
  assert.doesNotMatch(app, /creationEditItemId|creationClosePromptEditor|creationSavePromptItemId|creationPromptEditor/);
  assert.match(app, /path\.className = "creation-card-path";/);
  assert.match(app, /card\.classList\.toggle\("is-sku", item\.role === "sku"\);/);
  assert.match(app, /card\.classList\.toggle\("is-sku-start", options\.isSkuStart === true\);/);
  assert.match(app, /card\.classList\.toggle\("is-infographic-rebuild", item\.role === "infographic-rebuild"\);/);
  assert.match(app, /card\.classList\.toggle\("is-infographic-rebuild-start", options\.isInfographicRebuildStart === true\);/);
  assert.match(loadingModule, /const firstSkuItem = items\.find\(\(item\) => item\.role === "sku"\);/);
  assert.match(loadingModule, /const firstInfographicRebuildItem = items\.find\(\(item\) => item\.role === "infographic-rebuild"\);/);
  assert.match(app, /getItemOptions: \(item, _index, \{ firstSkuItem, firstInfographicRebuildItem \}\) => \(\{/);
  assert.match(app, /isSkuStart: item === firstSkuItem,/);
  assert.match(app, /isInfographicRebuildStart: item === firstInfographicRebuildItem,/);
  assert.match(app, /const firstRecordSkuItem = selectedSet\.items\.find\(\(item\) => item\.role === "sku"\);/);
  assert.match(app, /const firstRecordInfographicRebuildItem = selectedSet\.items\.find\(\(item\) => item\.role === "infographic-rebuild"\);/);
  assert.match(app, /isSkuStart: item === firstRecordSkuItem,/);
  assert.match(app, /isInfographicRebuildStart: item === firstRecordInfographicRebuildItem,/);
  assert.match(app, /const shouldRenderPath = !imageUrl && !showRecordActions && !hideGenerationDetails;/);
  assert.match(app, /path\.textContent = item\.error \|\| "";/);
  assert.match(app, /refs\.creationResultGrid\.addEventListener\("click",[\s\S]*creationRetryItemId/);
  assert.doesNotMatch(app, /creationEditItemId|creationClosePromptEditor|creationSavePromptItemId/);
  assert.match(app, /refs\.creationRepairFailedButton\.addEventListener\("click"/);
});

test("creation result card images open the lightbox from the thumbnail", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /const isResultPreviewMedia = Boolean\(imageUrl && !showRecordActions\);/);
  assert.match(app, /document\.createElement\(\(showRecordActions \|\| isResultPreviewMedia\) && imageUrl \? "button" : "div"\)/);
  assert.match(app, /media\.classList\.add\("creation-result-preview-media"\);/);
  assert.match(app, /media\.dataset\.creationPreviewItemId = item\.itemId;/);
  assert.match(app, /function buildCreationCurrentLightboxItem\(item = \{\}\) \{/);
  assert.match(app, /isImageOnlyLightboxItem:\s*true,/);
  assert.match(app, /function openCreationCurrentItemPreview\(itemId\) \{/);
  assert.match(app, /openCreationCurrentItemPreview\(itemId\) \{[\s\S]*const lightboxItem = buildCreationCurrentLightboxItem\(item\);[\s\S]*openLightbox\(lightboxItem,\s*\{[\s\S]*items:\s*currentSet\?\.items \|\| \[\],[\s\S]*buildItem:\s*buildCreationCurrentLightboxItem,[\s\S]*\}\);[\s\S]*\}/);
  assert.match(app, /const shouldResolveLightboxItem = !state\.lightboxItem\.isCreationRecordItem && !state\.lightboxItem\.isImageOnlyLightboxItem && !state\.lightboxItem\.isPreviewLightboxItem;/);
  assert.match(app, /refs\.creationResultGrid\.addEventListener\("click",[\s\S]*const previewButton = event\.target\.closest\("\[data-creation-preview-item-id\]"\);[\s\S]*openCreationCurrentItemPreview\(previewButton\.dataset\.creationPreviewItemId\)/);
  assert.match(styles, /\.creation-result-preview-media\s*\{/);
});

test("creation generation cards replace plan details with loading animation", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");

  assert.match(app, /generationScope:\s*""/);
  assert.match(app, /function shouldShowCreationCardLoading\(item = \{\}, showRecordActions = false\) \{/);
  assert.match(app, /if \(getImageUrl\(item\)\) \{\s*return false;\s*\}/);
  assert.doesNotMatch(app, /state\.creation\.generationScope === "full"[\s\S]*return status !== "failed";/);
  assert.match(app, /function shouldHideCreationCardDetails\(item = \{\}, showRecordActions = false\) \{/);
  assert.match(app, /function createCreationCardLoading\(status = "generating", sequenceIndex = 0, key = "", logText = ""\) \{/);
  assert.match(app, /const isQueued = status === "queued";/);
  assert.match(app, /createCreationCardLoadingShell\(isQueued \? "queued" : "generating",\s*null,\s*\{ sequenceIndex, key, logText \}\)/);
  assert.match(app, /card\.classList\.toggle\("is-generating", isLoadingCard\);/);
  assert.match(app, /status\.textContent = getCreationItemStatusLabel\(item\);/);
  assert.match(app, /media\.classList\.add\("is-loading"\);[\s\S]*media\.appendChild\(createCreationCardLoading\(item\.status,\s*fallbackIndex,\s*item\.itemId,\s*getCreationCardLogText\(item\)\)\);/);
  assert.match(app, /const shouldRenderPath = !imageUrl && !showRecordActions && !hideGenerationDetails;/);
  assert.match(app, /if \(shouldRenderPath\) \{/);
  assert.match(app, /if \(showActions && !hideGenerationDetails\) \{/);
  assert.match(queueModule, /creationState\.generationScope = "full";/);
  assert.match(app, /state\.creation\.generationScope = itemId \? "single" : "repair";/);

  const generatingCardRule = styles.match(/\.creation-card\.is-generating\s*\{[\s\S]*?\}/)?.[0] || "";
  assert.match(generatingCardRule, /grid-template-rows:\s*auto\s+auto;/);
  assert.doesNotMatch(generatingCardRule, /minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(styles, /\.creation-result-grid:has\(\.creation-card\.is-generating\)/);
  assert.match(styles, /\.creation-card\.is-generating\s*\{/);
  assert.match(styles, /\.creation-card-media\.is-loading\s*\{/);
  assert.match(styles, /\.creation-card-media\.is-loading\s*\{[\s\S]*width:\s*min\(100%,\s*220px\);/);
  assert.match(styles, /\.creation-card-loading\s*\{[\s\S]*min-height:\s*132px;[\s\S]*padding:\s*12px;/);
  assert.match(styles, /\.creation-card-loading \.generation-loading-drop\s*\{/);
  assert.doesNotMatch(styles, /creation-card-loading-sketch|creation-card-loading-waiting|creation-card-loading-steps/);
});

test("creation result grid keeps running card loading DOM stable across rerenders", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loadingModule = await readFile(creationCardLoadingPath, "utf8");

  assert.match(app, /from "\/lib\/creation-card-loading\.mjs"/);
  assert.match(app, /function syncCreationResultGrid\(items = \[\], \{ showActions = true \} = \{\}\) \{/);
  assert.match(app, /syncCreationResultGridShell\(\{/);
  assert.match(app, /syncCreationLoadingCard\(card,\s*item,\s*index/);
  assert.match(app, /createCreationCardLoadingShell\([^,]+,\s*null,\s*\{ sequenceIndex, key, logText \}\)/);
  assert.match(app, /syncCreationResultGrid\(items, \{ showActions: showCreationResultActions \}\);/);
  const renderCreationViewBody = extractFunctionBefore(app, "renderCreationView", "getCreationPlanPreviewImageCount");
  assert.doesNotMatch(renderCreationViewBody, /refs\.creationResultGrid\.innerHTML = "";/);
  assert.match(loadingModule, /export function getCreationCardDomKey\(item = \{\}, fallbackIndex = 0\) \{/);
  assert.match(loadingModule, /export function syncCreationResultGrid\(\{/);
  assert.match(loadingModule, /\.querySelectorAll\("\.creation-card\[data-creation-card-key\]"\)/);
  assert.match(loadingModule, /updateCreationCardLoading\(loadingShell,\s*item\.status,\s*\{ key, logText \}\)/);

  assert.match(styles, /\.creation-card-loading \.generation-loading-drop\s*\{/);
  assert.doesNotMatch(styles, /creation-card-loading-sketch|creation-card-loading-waiting|creation-card-loading-steps|creation-card-loading-progress|creation-card-loading-signal/);
});

test("creation single-item repair keeps other action buttons available while one item runs", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /queuedRepairItemIds:\s*\[\]/);
  assert.match(app, /repairingItemId:\s*""/);
  assert.match(app, /from "\/lib\/creation-item-repair-queue\.mjs"/);
  assert.match(app, /function getCreationRepairButtonText\(item = \{\}\) \{/);
  assert.match(app, /function queueCreationItemRepair\(itemId\) \{/);
  assert.match(app, /function runNextQueuedCreationItemRepair\(\) \{/);
  assert.match(app, /state\.creation\.generationScope === "single"/);
  assert.match(app, /const hideGenerationDetails = shouldHideCreationCardDetails\(item, showRecordActions\);/);
  assert.match(app, /button\.disabled = !canRepairCreationItem\(item\.itemId\);/);
  assert.match(app, /button\.textContent = getCreationRepairButtonText\(item\);/);
});

test("creation mode exposes a set-level queue strip for queued suites", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");

  assert.match(html, /id="creationQueueStrip"/);
  assert.match(
    html,
    /id="creationSetMeta"[\s\S]*id="creationQueueStrip"[\s\S]*id="creationRecordDetail"/,
  );

  assert.match(app, /queue:\s*\[\]/);
  assert.match(app, /selectedQueueId:\s*""/);
  assert.match(app, new RegExp(`from "/lib/creation-suite-queue\\.mjs\\?v=${creationQueueModuleAssetVersion}"`));
  assert.match(app, /function getCreationQueueJobs\(\) \{/);
  assert.match(app, /function getSelectedCreationQueueJob\(\) \{/);
  assert.match(app, /function renderCreationQueueStrip\(\) \{/);
  assert.match(app, /function selectCreationQueueJob\(queueId\) \{/);
  assert.match(app, /creationQueueStrip:\s*document\.querySelector\("#creationQueueStrip"\)/);
  assert.match(app, /refs\.creationQueueStrip\.addEventListener\("click"/);
  assert.match(queueModule, /export function renderCreationQueueStrip\(/);
  assert.match(queueModule, /button\.dataset\.creationQueueId = job\.id;/);
  assert.match(queueModule, /formatCreationQueueLabel\(index \+ 1\)/);
  assert.match(queueModule, /buildCreationQueuedSkuItems\(skuSubjects/);

  assert.match(styles, /\.creation-queue-strip\s*\{/);
  assert.match(styles, /\.creation-queue-strip\s*\{[\s\S]*flex:\s*0 0 auto;/);
  assert.match(styles, /\.creation-queue-strip\s*\{[\s\S]*min-height:\s*22px;/);
  assert.match(styles, /\.creation-queue-strip\s*\{[\s\S]*overflow-y:\s*hidden;/);
  assert.match(styles, /\.creation-queue-item\s*\{/);
  assert.match(styles, /\.creation-queue-item\s*\{[\s\S]*max-width:\s*150px;/);
  assert.match(styles, /\.creation-queue-item\s*\{[\s\S]*border-radius:\s*999px;/);
  assert.match(styles, /\.creation-queue-item\s*\{[\s\S]*background:/);
  assert.match(styles, /\.creation-queue-label\s*\{/);
  assert.match(styles, /\.creation-queue-item\.is-active\s*\{/);
  assert.match(styles, /\.creation-queue-item\.is-selected\s*\{/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-queue-strip\s*\{/);
});

test("creation generation can enqueue another suite while one is running", async () => {
  const app = await readFile(appPath, "utf8");
  const queueModule = await readFile(creationSuiteQueuePath, "utf8");

  assert.match(app, /function getPendingCreationQueueCount\(\) \{/);
  assert.match(app, /function buildCreationQueuedSet\(/);
  assert.match(app, /function enqueueCreationGeneration\(/);
  assert.match(app, /async function runCreationQueuedJob\(job\) \{/);
  assert.match(app, /function scheduleCreationGenerationQueue\(\) \{/);
  assert.match(queueModule, /creationState\.queue\.push\(job\);/);
  assert.match(queueModule, /export function buildCreationQueuedRepairFormData\(job = \{\}/);
  assert.match(queueModule, /export async function runCreationQueuedJob\(job, context = \{\}\) \{/);
  assert.match(queueModule, /export function scheduleCreationGenerationQueue\(context = \{\}\) \{/);
  assert.match(queueModule, /getRunningCreationQueueReservedItemCount\(creationState\)/);
  assert.match(queueModule, /runningSuiteCount < maxActiveSuites/);
  assert.match(app, /function upsertCreationSetForStream\(set, \{ queueJob \} = \{\}\) \{/);
  assert.match(app, /function updateCreationStreamItem\(itemId, patch = \{\}, context = \{\}\) \{/);
  assert.match(app, /async function handleCreationStreamEvent\(eventName, payload = \{\}, context = \{\}\) \{/);
  assert.match(app, /await handleCreationStreamEvent\(eventName, payload, context\);/);
  assert.match(app, /body: buildCreationQueuedRepairFormData\(queueJob, \{ scope: "incomplete", set: currentSet \}\)/);
  assert.match(app, /setCreationFeedback\(`已加入队列 · 第 \$\{getPendingCreationQueueCount\(\)\} 位`, "busy"\);/);
  assert.match(app, /refs\.creationGenerateButton\.textContent = [\s\S]*\? "加入队列"[\s\S]*: "生成套图";/);
  assert.match(app, /refs\.creationGenerateButton\.disabled = shouldDisableCreationGenerateButton\(\{ planning: state\.creation\.planning, preparingReferences, effectivePlan: state\.creation\.effectivePlan \}\);/);
  assert.match(app, /startCreationGeneration[\s\S]*await waitForPendingCreationPlanPreview\(\)[\s\S]*state\.creation\.planDirty[\s\S]*await requestCreationPlanPreview\(\)[\s\S]*getFrozenCreationEffectivePlan\(\)/);
  assert.match(app, /refs\.creationPlanButton\.disabled = state\.creation\.planning;/);
  assert.match(app, /function getCreationDraftSet\(\)/);
  assert.match(app, /buildCreationQueuedSetFromState\(\{[\s\S]*getCreationDraftSet/);
  assert.doesNotMatch(app, /async function previewCreationPlan\(\) \{\s*if \(state\.creation\.generating\)/);
  assert.doesNotMatch(app, /refs\.creationGenerateButton\.disabled =[\s\S]*getPendingCreationQueueCount\(\) >= getMaxQueuedJobCount\(\);/);
  assert.doesNotMatch(app, /refs\.creationGenerateButton\.disabled = state\.creation\.generating \|\| state\.creation\.planning \|\| preparingReferences;/);
});

test("recognition and analysis busy states expose motion hooks", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const pptAnalysisClient = await readFile(pptAnalysisClientPath, "utf8");

  assert.match(app, /function createInlineBusyMotion\(/);
  assert.match(app, /function renderInlineBusyButton\(/);
  assert.match(app, /button\.style\.minWidth = button\.dataset\.busyMinWidth;/);
  assert.match(app, /button\.style\.minWidth = "";/);
  assert.match(app, /renderInlineBusyButton\(refs\.promptAgentAnalyzeButton,[\s\S]*busy:\s*state\.promptAgent\.running/);
  assert.match(app, /renderInlineBusyButton\(refs\.referenceAnalyzeButton,[\s\S]*busy:\s*state\.referenceAnalysis\.running/);
  assert.match(app, /media\.classList\.add\("is-waiting"\);/);
  assert.match(pptAnalysisClient, /function createPptAnalyzeMotion\(/);
  assert.match(pptAnalysisClient, /refs\.analyzeButton\.classList\.toggle\("is-loading", model\.analyzing\);/);
  assert.match(pptAnalysisClient, /refs\.analyzeButton\.style\.minWidth = refs\.analyzeButton\.dataset\.busyMinWidth;/);

  assert.match(styles, /\.inline-busy-motion\s*\{/);
  assert.match(styles, /\.inline-busy-motion span\s*\{[\s\S]*animation:\s*inline-busy-pulse/);
  assert.match(styles, /\.generate-button\.is-loading,\s*\.creation-record-actions \.toolbar-button\.is-loading,\s*\.reference-analysis-button\.is-loading,\s*#pptAnalyzeButton\.is-loading/);
  assert.match(styles, /\.creation-record-actions \.toolbar-button\.is-loading::before/);
  assert.match(styles, /\.creation-card-media\.is-waiting\s+span\s*\{/);
  assert.doesNotMatch(styles, /\.creation-card-media\.is-waiting::before|@keyframes creation-card-waiting-pulse/);
  assert.doesNotMatch(styles, /\.creation-card-media\.is-waiting::after/);
  assert.doesNotMatch(styles, /creation-card-waiting-sweep|\.creation-card-media\.is-waiting::before/);
});

test("creation results do not expose a prompt editor or micro-adjust action", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.doesNotMatch(html, /creationPromptEditorLayer|微调提示词/);
  assert.doesNotMatch(styles, /\.creation-prompt-editor-layer|\.creation-card-editor/);
  assert.doesNotMatch(app, /creationPromptEditorLayer|微调提示词|creationEditItemId|creationSavePromptItemId/);
});

test("creation record reuse tracks reference images that need reupload", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationReferenceRestoreList"/);
  assert.match(styles, /\.creation-reference-restore-list\s*\{/);
  assert.match(styles, /\.creation-reference-restore-item\.is-missing/);
  assert.match(styles, /\.creation-reference-restore-item\.is-uploaded/);
  assert.match(app, /creationReferenceRestoreQueue:\s*\[\]/);
  assert.match(app, /function buildCreationReferenceRestoreQueue\(set = \{\}\) \{/);
  assert.match(app, /function findCreationReferenceRestoreEntryForFile\(file, restoreQueue = state\.creationReferenceRestoreQueue\) \{/);
  assert.match(app, /function renderCreationReferenceRestoreList\(\) \{/);
  assert.match(app, /state\.creationReferenceRestoreQueue = buildCreationReferenceRestoreQueue\(normalized\);/);
  assert.match(app, /restoreEntryId:\s*restoreEntry\?\.id \|\| ""/);
  assert.match(app, /restoredFromRecordFilename:\s*restoreEntry\?\.filename \|\| ""/);
  assert.match(app, /role:\s*restoreEntry\?\.role \|\| "product"/);
  assert.match(app, /note:\s*restoreEntry\?\.note \|\| ""/);
  assert.match(app, /markCreationReferenceRestoreEntryMissing\(target\?\.restoreEntryId\)/);
  assert.match(app, /renderCreationReferenceRestoreList\(\);/);
  assert.match(app, /if \(state\.creationReferenceRestoreQueue\.length > 0\) \{[\s\S]*return \[\];/);
});

test("creation reference reuploads can be manually bound to a saved reference", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.creation-reference-bind\s*\{/);
  assert.match(app, /function bindCreationReferenceToRestoreEntry\(referenceId, restoreEntryId\) \{/);
  assert.match(app, /select\.className = "creation-reference-bind";/);
  assert.match(app, /select\.dataset\.creationReferenceRestoreBindId = item\.id;/);
  assert.match(app, /state\.creationReferenceRestoreQueue = state\.creationReferenceRestoreQueue\.map/);
  assert.match(app, /restoreEntryId: normalizedRestoreId/);
  assert.match(app, /restoredFromRecordFilename: nextRestoreEntry\.filename/);
  assert.match(app, /role: nextRestoreEntry\.role \|\| item\.role \|\| "product"/);
  assert.match(app, /restoreEntryId: "",[\s\S]*restoredFromRecordFilename: "",[\s\S]*note: "",/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("change",[\s\S]*creationReferenceRestoreBindId/);
});

test("creation mode uploads prepared reference images for generation and repair", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getCreationReferenceGenerationFile\(item\) \{/);
  assert.match(
    app,
    /function getCreationReferenceGenerationFile\(item\) \{[\s\S]*infographicRebuildEnabled[\s\S]*!isCreationSubjectReferenceRole\(item\?\.role \|\| "product"\)[\s\S]*return item\.file;/,
  );
  assert.match(app, /async function ensureCreationReferenceGenerationFilesReady\(\) \{/);
  assert.match(app, /startCreationGeneration[\s\S]*await ensureCreationReferenceGenerationFilesReady\(\);[\s\S]*const generationFormData = buildCreationFormData\(\);/);
  assert.match(app, /function getCreationQueueJobForSet\(set = \{\}\) \{/);
  assert.match(app, /async function runCreationQueuedRepairRequest\(queueJob, \{ itemId = "", scope = "incomplete", set \} = \{\}\) \{/);
  assert.match(app, /async function runCreationRepairRequest[\s\S]*queueJob = getCreationQueueJobForSet\(currentSet\);[\s\S]*await runCreationQueuedRepairRequest\(queueJob, \{ itemId, scope, set: currentSet \}\);[\s\S]*return;/);
  assert.match(app, /async function runCreationRepairRequest[\s\S]*shouldUseCreationRepairDraftFiles\(currentSet\)[\s\S]*await ensureCreationReferenceGenerationFilesReady\(\);[\s\S]*body: buildCreationRepairFormData/);
  assert.match(app, /repairCreationItems[\s\S]*const currentSet = getCreationRepairTargetSet\(\);[\s\S]*await runCreationRepairRequest\(\{ itemId, scope, set: currentSet \}\);/);
  assert.match(
    app,
    /if \(useDraftFiles\) \{[\s\S]*state\.creationReferenceFiles\.forEach\(\(item\) => \{[\s\S]*getCreationReferenceGenerationFile\(item\)[\s\S]*formData\.append\("referenceImages", file\)/,
  );
  assert.doesNotMatch(app, /styleReferenceImages|creationStyleReferenceFiles/);
  assert.doesNotMatch(app, /formData\.append\("referenceImages", item\.file\)/);
});

test("creation mode auto-repairs incomplete first-pass sets once through the repair route", async () => {
  const app = await readFile(appPath, "utf8");
  const repairItemsHandler =
    app.match(/async function repairCreationItems[\s\S]*?\r?\n}\r?\n\r?\nfunction normalizePortraitItemForView/)?.[0] || "";

  assert.match(app, /from "\/lib\/creation-auto-repair\.mjs"/);
  assert.match(app, /getCreationRepairTargetSet as getCreationRepairTargetSetFromState/);
  assert.match(app, /function getCreationRepairTargetSet\(\) \{ return getCreationRepairTargetSetFromState\(state\.creation, getCreationCurrentSet\(\), normalizeCreationSetForView\); \}/);
  assert.match(app, /autoRepairAttemptCount:\s*0/);
  assert.match(app, /async function runCreationRepairRequest\(\{ itemId = "", scope = "incomplete", set = getCreationRepairTargetSet\(\), streamContext = null \} = \{\}\) \{/);
  assert.match(app, /repairCreationItems[\s\S]*await runCreationRepairRequest\(\{ itemId, scope, set: currentSet \}\);/);
  assert.match(app, /await runCreationAutoRepairIfNeeded\(payload\.set\)/);
  assert.match(app, /await runCreationRepairRequest\(\{ scope: "incomplete", set: currentSet \}\);/);
  assert.match(app, /getCreationAutoRepairNotice/);
  assert.doesNotMatch(repairItemsHandler, /fetch\("\/api\/creation\/repair"/);
});

test("asset record views include PPT records and Creation set records", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /data-nav-section="assets"[\s\S]*href="#gallery"[\s\S]*瀑布画廊[\s\S]*href="#creation-record"[\s\S]*套图记录[\s\S]*href="#ppt-record"[\s\S]*PPT记录/);
  assert.match(html, /data-view-panel="gallery"[\s\S]*data-view-panel="creation-record"[\s\S]*data-view-panel="ppt-record"/);
  assert.match(html, /id="pptRecordCount"/);
  assert.match(html, /id="pptRecordRefreshButton"/);
  assert.match(html, /id="pptRecordList"/);
  assert.match(html, /id="creationRecordCount"/);
  assert.match(html, /id="creationRecordSearchInput"/);
  assert.match(html, /id="creationRecordReuseButton"/);
  assert.match(html, /id="creationRecordOpenFolderButton"/);
  assert.doesNotMatch(html, /id="creationRecordCopyPathsButton"/);
  assert.match(html, /id="creationRecordCopyFullPathsButton"/);
  assert.match(html, /id="creationRecordRepairIncompleteButton"[\s\S]*补齐未生成图像/);
  assert.match(html, /id="creationRecordRefreshButton"/);
  assert.match(html, /id="creationRecordActionFeedback"/);
  assert.match(html, /id="creationRecordSetList"/);
  assert.match(html, /id="creationRecordArchiveDetail"/);
  assert.match(html, /id="creationRecordResultGrid"/);
  assert.doesNotMatch(html, /data-nav-section="records"/);
  assert.match(styles, /\.ppt-record-view\s*\{/);
  assert.match(styles, /\.ppt-record-list\s*\{/);
  assert.match(styles, /\.creation-record-view\s*\{/);
  assert.match(styles, /\.creation-record-search\s*\{/);
  assert.match(styles, /\.creation-record-feedback\s*\{/);
  assert.match(styles, /\.creation-record-browser\s*\{/);
  assert.match(styles, /\.creation-record-result-grid\s*\{/);
  assert.match(app, /if \(window\.location\.hash === "#ppt-record"\)/);
  assert.match(app, /if \(window\.location\.hash === "#creation-record"\)/);
  assert.match(app, /function renderPptRecordView\(\) \{/);
  assert.match(app, /function renderCreationRecordView\(\) \{/);
  assert.match(app, /function renderCreationRecordSetList\(filteredSets = filterCreationRecordSets\(\)\) \{/);
  assert.match(app, /function filterCreationRecordSets\(\) \{/);
  assert.match(
    app,
    /function isCreationMissingAssetItem\(item = \{\}\) \{\s*return Boolean\(item\.missingAsset \|\| item\.missing_asset\);\s*\}/,
  );
  assert.match(app, /status\.textContent = getCreationItemStatusLabel\(item\);/);
  assert.match(app, /placeholder\.textContent = isCreationMissingAssetItem\(item\) \? "历史图片文件缺失，可一键补图" : item\.status === "failed" \? item\.error \|\| "生成失败" : "等待生成";/);
  assert.match(app, /renderCreationRecordArchiveDetail\(set\)[\s\S]*formatCreationReferenceRoleSummary\(set\.referenceImageRoles\)/);
  assert.match(app, /function applyCreationSetToForm\(set\) \{/);
  assert.match(app, /function reuseCreationRecordSet\(\) \{/);
  assert.match(app, /function setCreationRecordFeedback\(message = "", kind = ""\) \{/);
  assert.match(app, /async function writeTextToClipboard\(text, failureMessage = "当前浏览器不支持复制图片路径。"\) \{/);
  assert.match(app, /function getCreationRecordImagePaths\(set\) \{/);
  assert.match(app, /async function fetchCreationRecordPathReport\(set\) \{/);
  assert.match(app, /function buildCreationRecordFullPathText\(payload, set\) \{/);
  assert.doesNotMatch(app, /async function copyCreationRecordPaths\(\) \{/);
  assert.match(app, /async function copyCreationRecordFullPaths\(\) \{/);
  assert.match(app, /async function openCreationRecordFolder\(\) \{/);
  assert.match(app, /creationRecordRepairIncompleteButton: document\.querySelector\("#creationRecordRepairIncompleteButton"\)/);
  assert.match(app, /const repairBlocked = state\.creation\.generating \|\| state\.creation\.recordTemuExportBusy \|\| !canRepairCreationSet\(selectedSet\) \|\| recordIncompleteItems\.length === 0;/);
  assert.match(app, /creationRecordRepairIncompleteButton\.disabled = repairBlocked;/);
  assert.match(app, /creationRecordRepairIncompleteButton\.textContent = getCreationRecordRepairButtonLabel\(recordIncompleteItems\);/);
  assert.match(app, /async function repairCreationRecordIncompleteImages\(\) \{/);
  assert.match(app, /const missingAssetCount = targetItems\.filter\(isCreationMissingAssetItem\)\.length;/);
  assert.match(app, /正在补齐缺失的历史图像文件/);
  assert.match(app, /缺失图像文件已补齐/);
  const recordRepairHandler = app.match(/async function repairCreationRecordIncompleteImages[\s\S]*?\r?\n}\r?\n\r?\nfunction toggleCreationRecordArchiveDetail/)?.[0] || "";
  assert.doesNotMatch(recordRepairHandler, /applyCreationSetToForm\(selectedSet\)|state\.creation\.currentSet\s*=/);
  assert.match(recordRepairHandler, /recordRepairJob[\s\S]*runCreationRepairRequest\(\{ scope: "incomplete", set: selectedSet, streamContext: \{ queueJob: recordRepairJob \} \}\)/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(app, /await writeTextToClipboard\(text\)/);
  assert.match(app, /fetch\("\/api\/creation\/sets\/paths"/);
  assert.match(app, /fetch\("\/api\/creation\/sets\/open-folder"/);
  assert.match(app, /refs\.pptRecordRefreshButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordSearchInput\.addEventListener\("input",/);
  assert.match(app, /refs\.creationRecordReuseButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordOpenFolderButton\.addEventListener\("click",/);
  assert.doesNotMatch(app, /refs\.creationRecordCopyPathsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordCopyFullPathsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordRepairIncompleteButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordRefreshButton\.addEventListener\("click",/);
  assert.match(app, /function refreshCreationRecordSets\(\) \{/);
  assert.match(app, /if \(view === "creation-record"\) \{[\s\S]*refreshCreationRecordSets\(\);[\s\S]*\}/);
  assert.match(app, /fetch\("\/api\/creation\/sets", \{\s*cache: "no-store"/);
  assert.match(app, /refs\.creationRecordSetList\.addEventListener\("click",[\s\S]*target\.closest\("\[data-creation-record-set-id\]"\)/);
  assert.match(app, /state\.ppt\.decks = Array\.isArray\(payload\) \? payload : \[\];[\s\S]*renderPptRecordView\(\);/);
  assert.match(app, /state\.creation\.sets = nextSets;[\s\S]*renderCreationRecordView\(\);/);
  assert.match(app, /applyCreationSetToForm\(selectedSet\);[\s\S]*state\.creation\.currentSet = normalizeCreationSetForView\(selectedSet\);[\s\S]*setActiveView\("creation"\);/);
  assert.match(app, /refs\.creationProductNameInput\.value = normalized\.productName \|\| "";/);
  assert.match(app, /refs\.creationProductDescriptionInput\.value = normalized\.productDescription \|\| "";/);
  assert.match(app, /refs\.creationSellingPointsInput\.value = normalized\.sellingPoints\.join\("\\n"\);/);
  assert.match(app, /refs\.creationDimensionSpecsInput\.value = normalized\.dimensionSpecs \|\| "";/);
  assert.match(app, /setCreationSelectValue\(refs\.creationTargetLanguageInput, normalized\.targetLanguage, "en"\);/);
  assert.match(app, /setCreationSelectValue\(refs\.creationPlatformInput, normalized\.platform, "universal"\);/);
  assert.match(app, /setCreationIndustryTemplateValue\(normalized\.industryTemplate/);
  assert.match(app, /setCreationImageCountValue\(normalized\.imageCount\);/);
  assert.match(app, /state\.creationSelectedRoles = alignCreationRoleIdsToCount\(normalizedRoles, getCreationSelectedImageCount\(\)\);/);
  assert.match(app, /state\.creationReferenceFiles = \[\];/);
  assert.match(app, /state\.creationReferenceAnalysis = createEmptyCreationReferenceAnalysisState\(\);/);
  assert.doesNotMatch(app, /state\.creation\.currentSet = selectedSet \? normalizeCreationSetForView\(selectedSet\) : null;/);
});

test("creation record desktop grid keeps six cards per row", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const creationRecordGridRule = readCssRule(styles, ".creation-record-result-grid");

  assert.match(creationRecordGridRule, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(creationRecordGridRule, /row-gap:\s*16px;/);
  assert.match(creationRecordGridRule, /column-gap:\s*10px;/);
  assert.doesNotMatch(creationRecordGridRule, /grid-template-columns:\s*repeat\(4,/);
});

test("creation record cards constrain SKU media inside narrow grid tracks", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const recordCardRule = readCssRule(styles, ".creation-card.is-record-card");
  const recordHeadRule = readCssRule(styles, ".creation-card.is-record-card .creation-card-head");
  const recordMediaRule = readCssRule(styles, ".creation-card.is-record-card .creation-card-media");
  const recordPreviewMediaRule = readCssRule(styles, ".creation-record-preview-media");
  const recordImageRule = readCssRule(styles, ".creation-card.is-record-card .creation-card-media img");

  assert.match(recordCardRule, /overflow:\s*hidden;/);
  assert.match(recordCardRule, /grid-template-rows:\s*auto auto;/);
  assert.match(recordHeadRule, /min-width:\s*0;/);
  assert.match(recordMediaRule, /width:\s*100%;/);
  assert.match(recordMediaRule, /max-width:\s*100%;/);
  assert.match(recordMediaRule, /min-width:\s*0;/);
  assert.match(recordMediaRule, /box-sizing:\s*border-box;/);
  assert.match(recordPreviewMediaRule, /max-width:\s*100%;/);
  assert.match(recordPreviewMediaRule, /min-width:\s*0;/);
  assert.match(recordImageRule, /max-width:\s*100%;/);
  assert.match(recordImageRule, /min-width:\s*0;/);
});

test("asset views define compact tablet and mobile layouts", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.gallery-column-switch,[\s\S]*html\[data-ui-layout="mobile"\] \.gallery-column-switch\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.gallery-toolbar-head\s*\{[\s\S]*"actions reset"[\s\S]*"meta meta";/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.gallery-filter-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.article-record-panel,[\s\S]*html\[data-ui-layout="mobile"\] \.ppt-record-panel\s*\{[\s\S]*height:\s*var\(--gallery-panel-height\);[\s\S]*grid-template-rows:\s*auto\s*minmax\(0,\s*1fr\);[\s\S]*overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.article-record-browser,[\s\S]*html\[data-ui-layout="tablet"\] \.ppt-record-browser\s*\{[\s\S]*grid-template-columns:\s*minmax\(220px,\s*280px\)\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.article-record-browser,[\s\S]*html\[data-ui-layout="mobile"\] \.ppt-record-browser\s*\{[\s\S]*grid-template-rows:\s*clamp\(104px,\s*18svh,\s*148px\)\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.article-record-list,[\s\S]*html\[data-ui-layout="mobile"\] \.ppt-record-list\s*\{[\s\S]*grid-auto-flow:\s*column;[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*hidden;/,
  );
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.ppt-record-card-actions\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-record-result-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
});

test("creation record cards open gallery-style lightbox details", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const creationCardSource = extractFunctionBefore(app, "createCreationCard", "syncCreationResultGrid");

  assert.match(styles, /\.creation-card\.is-record-card\s+\.creation-card-media\s*\{/);
  assert.match(styles, /\.creation-record-preview-media\s*\{/);
  assert.match(app, /const showRecordActions = options\.showRecordActions === true;/);
  assert.match(app, /card\.classList\.toggle\("is-record-card", showRecordActions\);/);
  assert.doesNotMatch(app, /creation-card-prompt/);
  assert.match(app, /if \(shouldRenderPath\) \{[\s\S]*path\.className = "creation-card-path";[\s\S]*card\.appendChild\(path\);[\s\S]*\}/);
  assert.match(app, /media\.dataset\.creationRecordPreviewItemId = item\.itemId;/);
  assert.match(app, /media\.dataset\.creationRecordPreviewSetId = options\.creationSetId \|\| "";/);
  assert.match(app, /function getCreationRecordItemById\(itemId, setId = ""\) \{/);
  assert.match(app, /import \{ buildCreationRecordLightboxItem, normalizeCreationGenerationSnapshotForView \} from "\/lib\/creation-record-lightbox\.mjs";/);
  assert.match(app, /function openCreationRecordItemPreview\(itemId, setId = ""\) \{/);
  assert.match(app, /async function copyCreationRecordItemPath\(itemId, setId = ""\) \{/);
  assert.doesNotMatch(creationCardSource, /creation-record-card-actions|previewButton|textContent = "查看"/);
  assert.doesNotMatch(html, /lightboxCopyPathButton|lightboxCopyFullPathButton|lightboxDelete/);
  assert.match(app, /refs\.creationRecordResultGrid\.addEventListener\("click",[\s\S]*openCreationRecordItemPreview\(\s*previewTarget\.dataset\.creationRecordPreviewItemId,\s*previewTarget\.dataset\.creationRecordPreviewSetId,\s*\)/);
  assert.match(app, /const firstRecordInfographicRebuildItem = selectedSet\.items\.find\(\(item\) => item\.role === "infographic-rebuild"\);/);
  assert.match(app, /isSkuStart: item === firstRecordSkuItem,/);
  assert.match(app, /isInfographicRebuildStart: item === firstRecordInfographicRebuildItem,/);
  assert.doesNotMatch(app, /dataset\.creationRecordCopyPromptItemId/);
  assert.doesNotMatch(app, /dataset\.creationRecordCopyPathItemId/);
  assert.doesNotMatch(app, /dataset\.creationRecordCopyFullPathItemId/);
});

test("creation records expose prompt exports", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationRecordCopyPromptsButton"/);
  assert.match(html, /id="creationRecordExportPromptsButton"/);
  assert.match(html, /id="creationRecordExportManifestButton"/);
  assert.match(styles, /\.creation-record-export-actions\s*\{/);
  assert.match(app, /creationRecordCopyPromptsButton: document\.querySelector\("#creationRecordCopyPromptsButton"\)/);
  assert.match(app, /function buildCreationRecordPromptText\(set\) \{/);
  assert.match(app, /function downloadCreationRecordTextFile\(/);
  assert.match(app, /async function copyCreationRecordPrompts\(\) \{/);
  assert.match(app, /function exportCreationRecordPrompts\(\) \{/);
  assert.match(app, /function exportCreationRecordManifest\(\) \{/);
  assert.match(app, /refs\.creationRecordCopyPromptsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordExportPromptsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordExportManifestButton\.addEventListener\("click",/);
});

test("creation records support current selected and filtered deletion with an app dialog", async () => {
  const [html, app, styles, recordListView] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(stylesPath, "utf8"),
    readFile(creationRecordListViewPath, "utf8"),
  ]);

  assert.match(html, /id="creationRecordDeleteCurrentButton"[^>]*>删除当前<\/button>/);
  assert.match(html, /id="creationRecordDeleteSelectedButton"[^>]*>删除选中/);
  assert.match(html, /id="creationRecordDeleteFilteredButton"[^>]*>删除筛选结果<\/button>/);
  assert.match(html, /id="creationRecordDeleteDialog"[^>]*aria-labelledby="creationRecordDeleteDialogTitle"/);
  assert.match(html, /id="creationRecordDeleteCancelButton"[^>]*>取消<\/button>/);
  assert.match(html, /id="creationRecordDeleteConfirmButton"[^>]*>确认删除<\/button>/);
  assert.match(app, /from "\/lib\/creation-record-delete\.mjs\?v=20260722-creation-record-delete-flow-1"/);
  assert.match(recordListView, /checkbox\.dataset\.creationRecordSelectSetId = setId;/);
  assert.match(app, /getCreationRecordDeleteTargets\(\{/);
  assert.match(app, /fetch\("\/api\/creation\/sets\/delete", \{/);
  assert.match(app, /method: "POST"/);
  assert.match(app, /state\.creation\.currentSet\?\.setId/);
  const deleteFlowStart = app.indexOf("async function confirmCreationRecordDelete()");
  const deleteFlowEnd = app.indexOf("function getCreationRecordImagePaths", deleteFlowStart);
  const deleteFlow = app.slice(deleteFlowStart, deleteFlowEnd);
  assert.notEqual(deleteFlowStart, -1);
  assert.notEqual(deleteFlowEnd, -1);
  assert.match(deleteFlow, /resolveCreationRecordSelectionAfterDelete\(/);
  assert.match(deleteFlow, /if \(deletedIds\.has\(selectedSetIdBeforeDelete\)\) \{[\s\S]*recordDetailExpanded = false;/);
  assert.doesNotMatch(deleteFlow, /loadCreationSets\(\)/);
  assert.match(app, /refs\.creationRecordRefreshButton\.addEventListener\("click", refreshCreationRecordSets\);/);
  assert.match(styles, /\.creation-record-list-item\s*\{/);
  assert.match(styles, /\.creation-record-select\s*\{/);
  assert.match(styles, /\.creation-record-delete-dialog\s*\{/);
});

test("creation records keep the desktop list and image Listing workspace visible together", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(
    html,
    /class="creation-record-browser">[\s\S]*class="asset-record-picker"[\s\S]*class="creation-record-archive"[^>]*>[\s\S]*id="creationRecordResultGrid"[\s\S]*id="creationRecordListingDrafts"/u,
  );
  assert.doesNotMatch(html, /id="creationRecordCloseDetailButton"|返回记录列表/u);
  assert.doesNotMatch(app, /recordDetailOpen|recordPicker\.hidden|recordArchive\.hidden/u);
  assert.match(app, /refs\.creationRecordResultGrid\.classList\.toggle\("hidden", !selectedSet\);/u);
  assert.match(
    styles,
    /\.creation-record-browser\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(280px,\s*340px\)\s+minmax\(0,\s*1fr\);/u,
  );
  assert.doesNotMatch(
    styles,
    /html:is\(\[data-ui-layout="tablet"\],\s*\[data-ui-layout="mobile"\]\) \.creation-record-browser\s*\{[^}]*display:\s*block;/u,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\]\[data-ui-orientation="portrait"\] \.creation-record-browser\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*280px\)\s+minmax\(0,\s*1fr\);[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/u,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.article-record-browser,\s*html\[data-ui-layout="mobile"\] \.creation-record-browser,[^{]*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto auto;[^}]*overflow:\s*visible;/u,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.creation-record-browser \.creation-record-list-footer\s*\{[^}]*display:\s*none;/u,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.creation-record-browser \.asset-record-picker\.is-open \.creation-record-list-footer\s*\{[^}]*display:\s*flex;/u,
  );
  assert.match(
    app,
    /selectCreationRecord\(target\.dataset\.creationRecordSetId\);\s*assetWorkspaceController\.closeRecordPickers\(\);/u,
  );
});

test("creation records combine keyword and created-time filters across actions", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(html, /id="creationRecordTimeFilters"[^>]*aria-label="套图记录时间筛选"/);
  assert.match(html, /id="creationRecordDateInput"[^>]*type="date"/);
  assert.match(html, /id="creationRecordResetFiltersButton"[^>]*>清空筛选<\/button>/);
  assert.match(app, /from "\/lib\/creation-record-filter\.mjs(?:\?[^\"]+)?"/);
  assert.match(app, /recordTimeFilter:\s*"all"/);
  assert.match(app, /recordDateFilter:\s*""/);
  assert.match(app, /function getCreationRecordKeywordMatchedSets\(\) \{/);
  assert.match(app, /filterCreationRecordSetsByTime\(/);
  assert.match(app, /from "\/lib\/creation-record-list-model\.mjs(?:\?[^\"]+)?";/);
  assert.match(app, /const listModel = buildCreationRecordListModel\(filteredSets, \{/);
  assert.match(app, /refs\.creationRecordLoadMoreButton\?\.addEventListener\("click", \(\) => \{[\s\S]*loadMoreCreationRecordListState\([\s\S]*renderCreationRecordView\(\);[\s\S]*\}\);/);
  assert.match(app, /buildCreationRecordTimeFilterOptions\(/);
  assert.match(app, /const isActive = option\.value === filters\.window;/);
  assert.match(app, /button\.setAttribute\("aria-pressed", String\(isActive\)\)/);
  assert.match(app, /function hasCreationRecordActiveFilters\(\) \{/);
  assert.match(app, /function getCreationRecordFilterLabel\(\) \{/);
  assert.match(app, /hasFilter:\s*hasCreationRecordActiveFilters\(\)/);
  assert.match(app, /filterLabel:\s*getCreationRecordFilterLabel\(\)/);
  assert.match(app, /refs\.creationRecordDateInput\.addEventListener\("input",/);
  assert.match(app, /refs\.creationRecordResetFiltersButton\.addEventListener\("click",/);
  assert.match(styles, /\.creation-record-time-filters\s*\{/);
  assert.match(styles, /\.creation-record-date\s*\{/);
  assert.match(styles, /\.creation-record-reset-filters\s*\{/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-record-filter-bar\s*\{/);
});

test("creation record toolbar stays compact without visible scrollbar or wrapped title", async () => {
  const styles = await readFile(stylesPath, "utf8");

  const panelTitleRule = readCssRule(styles, ".creation-record-panel > .panel-title");
  const panelTitleHeadingRule = readCssRule(styles, ".creation-record-panel > .panel-title h2");
  const recordActionsRule = readCssRule(styles, ".creation-record-actions");
  const exportActionsRule = readCssRule(styles, ".creation-record-export-actions");
  const recordButtonRule = readCssRule(styles, ".creation-record-actions .toolbar-button");
  const recordSearchRule = readCssRule(styles, ".creation-record-search");

  assert.match(panelTitleRule, /flex-wrap:\s*nowrap;/);
  assert.match(panelTitleRule, /overflow:\s*hidden;/);
  assert.match(panelTitleHeadingRule, /white-space:\s*nowrap;/);
  assert.match(recordActionsRule, /flex-wrap:\s*nowrap;/);
  assert.match(recordActionsRule, /justify-content:\s*flex-start;/);
  assert.match(recordActionsRule, /overflow-x:\s*auto;/);
  assert.match(recordActionsRule, /scrollbar-width:\s*none;/);
  assert.match(recordActionsRule, /font-size:\s*13px;/);
  assert.match(recordActionsRule, /--header-control-padding-x:\s*10px;/);
  assert.match(recordButtonRule, /font-size:\s*13px;/);
  assert.match(recordSearchRule, /white-space:\s*nowrap;/);
  assert.match(recordSearchRule, /grid-template-columns:\s*auto minmax\(118px,\s*156px\);/);
  assert.match(exportActionsRule, /flex-wrap:\s*nowrap;/);
  assert.match(exportActionsRule, /flex:\s*0 0 auto;/);
  assert.match(styles, /\.creation-record-actions::-webkit-scrollbar\s*\{[\s\S]*display:\s*none;/);
});

test("creation mode exposes listing agent controls and record listing drafts", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const listingView = await readFile(creationListingViewPath, "utf8");
  const recordListView = await readFile(creationRecordListViewPath, "utf8");

  assert.match(html, /id="creationListingAgentEnabledInput"/);
  assert.match(html, /id="creationRecordGenerateListingsButton"/);
  assert.match(html, /id="creationRecordArchiveDetail"[^>]*>[\s\S]*?id="creationRecordGenerateListingsButton"[\s\S]*?<\/div>\s*<div class="creation-record-results">/);
  assert.doesNotMatch(html, /class="asset-listing-actions"[^>]*>[\s\S]*?id="creationRecordGenerateListingsButton"/);
  assert.match(html, /id="creationRecordExportListingsButton"/);
  assert.match(html, /id="creationRecordCopyListingsButton"/);
  assert.match(html, /id="creationResultGrid"[\s\S]*id="creationInlineListingStatus"[\s\S]*id="creationInlineListingDrafts"/);
  assert.match(html, /id="creationRecordListingStatus"/);
  assert.match(html, /id="creationRecordListingDrafts"/);
  assert.match(html, /id="creationRecordResultGrid"><\/div>[\s\S]*class="creation-listing-panel hidden"[\s\S]*id="creationRecordListingDrafts"/);
  assert.doesNotMatch(html, /data-asset-content-tab="listing"|data-asset-content-panel="listing"/);
  assert.match(html, /aria-label="Listing 草稿"[\s\S]*<h3>Listing 草稿<\/h3>/u);
  assert.doesNotMatch(html, /Amazon Listing 草稿|<h3>Amazon Listing<\/h3>/u);

  assert.match(app, /creationListingAgentEnabledInput: document\.querySelector\("#creationListingAgentEnabledInput"\)/);
  assert.match(app, /creationInlineListingDrafts: document\.querySelector\("#creationInlineListingDrafts"\)/);
  assert.match(app, /creationInlineListingStatus: document\.querySelector\("#creationInlineListingStatus"\)/);
  assert.match(app, /creationRecordGenerateListingsButton: document\.querySelector\("#creationRecordGenerateListingsButton"\)/);
  assert.match(app, /creationRecordExportListingsButton: document\.querySelector\("#creationRecordExportListingsButton"\)/);
  assert.match(app, /creationRecordCopyListingsButton: document\.querySelector\("#creationRecordCopyListingsButton"\)/);
  assert.match(app, /from "\/lib\/creation-listing-view\.mjs"/);
  assert.match(app, /function getCreationInlineListingRefs\(\) \{/);
  assert.match(app, /createCreationListingController\(\{/);
  assert.match(app, /renderCurrentView: renderCreationView,/);
  assert.match(app, /getListingLabel: getCreationRecordListingMetaLabel,/);
  assert.match(recordListView, /const listingLabel = cleanString\(getListingLabel\?\.\(set\)\);/);
  assert.match(app, /creationRecordArchiveDetail\.insertBefore\(refs\.creationRecordGenerateListingsButton, detailToggle\)/);
  assert.match(recordListView, /metaRow\.className = "creation-record-meta-row";/);
  assert.match(recordListView, /statusRow\.className = "creation-record-status-row";/);
  assert.match(recordListView, /listingBadge\.className = "creation-record-listing-badge";/);
  assert.match(recordListView, /statusRow\.appendChild\(status\);[\s\S]*statusRow\.appendChild\(listingBadge\);[\s\S]*button\.append\(titleRow, metaRow, statusRow\);/);
  assert.doesNotMatch(recordListView, /metaRow\.appendChild\(listingBadge\);/);
  assert.match(app, /fetchImpl: \(\.\.\.args\) => fetch\(\.\.\.args\),/);
  assert.match(app, /getRequestConfig: getBrowserPrivateConfigRequestPayload,/);
  assert.match(app, /creationListingController\.syncRecordControls\(selectedSet\);/);
  assert.match(app, /creationListingController\.bindEvents\(\);/);
  assert.match(app, /renderCreationListingDrafts\(\{[\s\S]*refs:\s*getCreationInlineListingRefs\(\),[\s\S]*set:\s*currentSet/);
  assert.match(listingView, /export function getCreationListingDraftAccessState\(draft = \{\}, source = \{\}\) \{[\s\S]*canUse: true,[\s\S]*reason: "direct-output"/);
  assert.match(listingView, /export function renderCreationListingDrafts\(\{ refs, state, set \} = \{\}\) \{/);
  assert.match(listingView, /async function generate\(setId = ""\) \{/);
  assert.match(listingView, /const requestedSetId = cleanCreationListingText\(setId\);/);
  assert.match(listingView, /fetchImpl\("\/api\/creation\/listings",/);
  assert.match(listingView, /\.\.\.\(context\.getRequestConfig\?\.\(\) \|\| \{\}\),[\s\S]*setId: selectedSet\.setId,[\s\S]*set: selectedSet,/);
  assert.match(listingView, /async function copy\(\) \{[\s\S]*const selectedSet = context\.getSelectedSet\?\.\(\);[\s\S]*const text = buildCreationRecordListingText\(selectedSet\);/);
  assert.match(listingView, /function exportListings\(\) \{[\s\S]*const selectedSet = context\.getSelectedSet\?\.\(\);[\s\S]*buildCreationListingExportPayload\(selectedSet\)/);
  assert.match(listingView, /export function buildCreationListingDraftText\(draft, index = 0, source = \{\}\) \{[\s\S]*bilingualScalar[\s\S]*bilingualList/);
  assert.match(listingView, /export function buildCreationRecordListingText\(set\) \{[\s\S]*buildCreationListingDraftText\(draft, index, set\)/);
  assert.match(listingView, /export function buildCreationListingFieldCopyText\(value, \{ list = false \} = \{\}\) \{/);
  assert.match(listingView, /export function buildCreationListingFieldRows\(value, localizedValue, \{ list = false \} = \{\}\) \{/);
  assert.match(listingView, /title[\s\S]*sellingPoints[\s\S]*painPoints[\s\S]*fiveBullets[\s\S]*description[\s\S]*backendSearchTerms[\s\S]*keywordBuckets/);
  assert.match(listingView, /createCreationListingField\("标题", draft\.title, \{[\s\S]*localizedValue: draft\.zhDisplay\?\.title/);
  assert.match(listingView, /createCreationListingField\("卖点", draft\.sellingPoints, \{[\s\S]*list: true,[\s\S]*localizedValue: draft\.zhDisplay\?\.sellingPoints/);
  assert.match(listingView, /createCreationListingField\("痛点", draft\.painPoints, \{[\s\S]*localizedValue: draft\.zhDisplay\?\.painPoints/);
  assert.match(listingView, /createCreationListingField\("五点描述", draft\.fiveBullets, \{[\s\S]*localizedValue: draft\.zhDisplay\?\.fiveBullets/);
  assert.match(listingView, /createCreationListingField\("商品描述", draft\.description, \{[\s\S]*localizedValue: draft\.zhDisplay\?\.description/);
  assert.match(listingView, /createCreationListingField\("后台搜索词", draft\.backendSearchTerms, \{[\s\S]*localizedValue: draft\.zhDisplay\?\.backendSearchTerms/);
  assert.match(listingView, /const copySource = copyValue \?\? value;/);
  assert.match(listingView, /const labelNode = document\.createElement\("strong"\);[\s\S]*labelNode\.className = "creation-listing-field-label";/);
  assert.match(listingView, /function applyCreationListingCopyData\(target, label, value, \{ list = false \} = \{\}\) \{/);
  assert.match(listingView, /function createCreationListingValueCopyTarget\(displayText, copyText, label, \{[\s\S]*localized = false,[\s\S]*prominent = false,[\s\S]*\} = \{\}\) \{/);
  assert.match(listingView, /fieldTools\.appendChild\(createCreationListingFieldCopyButton\(label, copySource, \{ list: copyList \}\)\);/);
  assert.match(listingView, /appendRowCopyTargets\(row, index\);/);
  assert.match(listingView, /if \(localizedText\) \{[\s\S]*localizedCopyRows\[index\] \|\| localizedText,[\s\S]*`\$\{itemLabel\}中文`/);
  assert.match(listingView, /createCreationListingField\("警告"/u);
  assert.match(listingView, /createCreationListingField\("缺失信息"/u);
  assert.doesNotMatch(listingView, /titleCopy\.className = "creation-listing-title-copy";/);
  assert.match(listingView, /createCreationListingField\("标题", draft\.title, \{[\s\S]*prominent: true,[\s\S]*\}\)\);/);
  assert.doesNotMatch(listingView, /CREATION_LISTING_(?:LANGUAGE|SECTION)_MODES|getCreationListingViewModes|setCreationListingViewMode|createCreationListingSegmentedControl|creationListingViewControl|listingLanguageMode|listingSectionMode/);
  assert.doesNotMatch(listingView, /copyGroup|searchGroup|creation-listing-field-group/);
  assert.match(listingView, /getCreationListingPolicy\(requestedPolicyId\)/);
  assert.doesNotMatch(listingView, /needsCurrentRewrite|hasBlockedV2|待人工复核，不可直接发布/u);
  assert.doesNotMatch(listingView, /CREATION_LISTING_BUCKET_COPY_LABELS|Exact keywords:|Long-tail keywords:|Traffic keywords:|Descriptive keywords:/);
  assert.match(listingView, /const bucketRows = buildCreationListingBucketRows\([\s\S]*draft\.keywordBuckets,[\s\S]*draft\.zhDisplay\?\.keywordBuckets/);
  assert.match(listingView, /fixedLabel\.className = "creation-listing-bucket-label";[\s\S]*fixedLabel\.textContent = `\$\{rowValue\.label\}:`;/);
  assert.match(listingView, /copyTarget\.classList\.add\("creation-listing-bucket-value"\);/);
  assert.match(listingView, /localizedCountValue: localizedBucketValues,/);
  assert.match(listingView, /copyValue: buildCreationListingBucketCopyLines\(draft\.keywordBuckets\),/);
  assert.match(listingView, /localizedCopyValue: buildCreationListingLocalizedBucketCopyLines\(draft\.zhDisplay\?\.keywordBuckets\),/);
  assert.match(listingView, /localized \? "creation-listing-localized" : "creation-listing-value-copy"/);
  assert.match(listingView, /const listingDraftContainers = new Set\(\[[\s\S]*creationRecordListingDrafts,[\s\S]*creationInlineListingDrafts,[\s\S]*\]\.filter\(Boolean\)\);/);
  assert.match(listingView, /listingDraftContainers\.forEach\(\(container\) => \{[\s\S]*container\.addEventListener\("click",[\s\S]*closest\?\.\("\[data-creation-listing-copy-text\]"\)[\s\S]*copyCreationListingFieldButton/);
  assert.match(listingView, /export function buildCreationListingExportPayload\(set\) \{/);
  assert.match(listingView, /if \(sourceDrafts\.every\([\s\S]*schemaVersion[\s\S]*!== "2"\)\) \{[\s\S]*setId: set\.setId,[\s\S]*productName: set\.productName,[\s\S]*listingDrafts: sourceDrafts/);
  assert.match(listingView, /listingDrafts: sourceDrafts\.map\(buildCreationListingV1ExportDraft\)/);
  assert.match(listingView, /function buildCreationListingV1ExportDraft\(sourceDraft = \{\}, index = 0\) \{[\s\S]*painPoints:[\s\S]*fiveBullets:[\s\S]*backendSearchTerms:[\s\S]*zhDisplay:/);
  assert.doesNotMatch(listingView, /metadata: \{ setId: set\.setId \}|buildCreationListingV2ExportContent/);
  assert.match(listingView, /function syncRecordControls\(selectedSet\) \{[\s\S]*creationRecordCopyListingsButton\.disabled = drafts\.length === 0 \|\| isGenerating;[\s\S]*creationRecordExportListingsButton\.disabled = drafts\.length === 0 \|\| isGenerating;[\s\S]*renderCreationListingDrafts\(\{ refs: context\.refs, state: context\.state, set: selectedSet \}\);/);

  assert.match(styles, /\.creation-listing-drafts\s*\{/);
  assert.match(readCssRule(styles, "#creationRecordArchiveDetail.creation-record-detail.is-toggleable"), /grid-template-columns:\s*minmax\(0, 1fr\) auto auto;/);
  assert.match(readCssRule(styles, ".creation-record-listing-action"), /min-height:\s*32px;/);
  assert.match(styles, /\.creation-listing-card\s*\{/);
  assert.match(styles, /\.creation-listing-card\.is-failed\s*\{/);
  assert.match(styles, /\.creation-listing-card\.is-needs-review\s*\{/);
  assert.match(styles, /\.creation-listing-field\.is-internal\s*\{/);
  assert.match(styles, /\.creation-listing-card[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /\.creation-record-meta\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*100%;/);
  assert.match(readCssRule(styles, ".creation-record-meta-row"), /display:\s*block;/);
  assert.match(styles, /\.creation-record-status-row\s*\{[\s\S]*display:\s*flex;[\s\S]*gap:\s*6px;/);
  assert.match(styles, /\.creation-record-listing-badge\s*\{[\s\S]*background:\s*rgba\(54,\s*211,\s*153,\s*0\.14\);/);
  assert.match(styles, /\.creation-listing-content-frame\s*\{/);
  assert.match(readCssRule(styles, ".creation-listing-content-frame"), /border-top:\s*1px solid/);
  assert.match(readCssRule(styles, ".creation-listing-field"), /border-bottom:\s*1px solid/);
  assert.match(readCssRule(styles, ".creation-listing-field:first-child"), /background:\s*rgba\(125,\s*211,\s*252,\s*0\.035\)/);
  assert.doesNotMatch(styles, /\.creation-listing-view-toolbar\s*\{|\.creation-listing-segmented\s*\{|\.creation-listing-view-control|data-creation-listing-(?:language|section)-mode/);
  assert.match(readCssRule(styles, ".creation-listing-copy-pair"), /display:\s*grid;/);
  assert.match(readCssRule(styles, ".creation-listing-copy-pair"), /grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.doesNotMatch(readCssRule(styles, ".creation-listing-copy-pair"), /repeat\(2/);
  assert.match(readCssRule(styles, ".creation-listing-copy-pair"), /width:\s*fit-content;/);
  assert.match(readCssRule(styles, ".creation-listing-copy-pair"), /max-width:\s*100%;/);
  assert.match(
    readCssRule(styles, ".creation-listing-field li:not(:last-child) > .creation-listing-copy-pair"),
    /border-bottom:\s*1px solid/,
  );
  assert.doesNotMatch(readCssRule(styles, ".creation-listing-localized"), /border-top:\s*1px solid/);
  assert.doesNotMatch(readCssRule(styles, ".creation-listing-bucket-line.is-localized"), /border-top:\s*1px solid/);
  assert.match(styles, /\.creation-listing-field-copy\s*\{/);
  assert.match(styles, /\.creation-listing-field-copy:hover\s*\{/);
  assert.match(styles, /\.creation-listing-title-copy\s*\{/);
  assert.match(styles, /\.creation-listing-title-copy:hover\s*\{/);
  assert.match(styles, /\.creation-listing-character-count\s*\{/);
  assert.match(readCssRule(styles, ".creation-listing-character-count"), /background:\s*transparent/);
  assert.match(readCssRule(styles, ".creation-listing-character-count.english"), /color:\s*var\(--text-soft\)/);
  assert.match(readCssRule(styles, ".creation-listing-character-count.chinese"), /color:\s*color-mix/);
  assert.match(styles, /\.creation-listing-localized\s*\{/);
  assert.match(styles, /\.creation-listing-value-copy,[\s\S]*\.creation-listing-localized\s*\{/);
  assert.match(styles, /\.creation-listing-value-copy:hover,[\s\S]*\.creation-listing-localized:hover\s*\{/);
  assert.match(styles, /\.creation-listing-value-copy:focus-visible,[\s\S]*\.creation-listing-localized:focus-visible\s*\{/);
  assert.doesNotMatch(styles, /\.creation-listing-localized::before\s*\{/);
  assert.match(readCssRule(styles, ".creation-listing-bucket-label"), /user-select:\s*none;/);
  assert.match(styles, /\.creation-record-results\s*\{/);
  assert.match(readCssRule(styles, ".creation-record-results"), /display:\s*block;/);
  assert.doesNotMatch(readCssRule(styles, ".creation-record-results"), /display:\s*grid;/);
  assert.match(styles, /\.creation-record-result-grid\s*\{[\s\S]*min-height:\s*max-content;[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /\.creation-result-grid \+ \.creation-listing-panel:not\(\.hidden\)\s*\{[\s\S]*margin-top:\s*12px;/);
  assert.match(
    readCssRule(styles, 'html[data-ui-layout="mobile"] .creation-record-panel > .asset-page-head'),
    /position:\s*static;/,
  );
  assert.doesNotMatch(styles, /creation-card-listing-draft/);
});

test("creation listing copy handlers work for record and inline draft containers", async () => {
  const { createCreationListingController } = await import(publicCreationListingViewPath);
  const documentRef = createTestDocument();
  const recordDrafts = createTestElement("div", documentRef);
  const inlineDrafts = createTestElement("div", documentRef);
  const recordCopyButton = createListingCopyButton(documentRef, "Title", "record title");
  const inlineCopyButton = createListingCopyButton(documentRef, "Title", "inline title");
  const copied = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  recordDrafts.appendChild(recordCopyButton);
  inlineDrafts.appendChild(inlineCopyButton);
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  try {
    const controller = createCreationListingController({
      refs: {
        creationRecordListingDrafts: recordDrafts,
        creationInlineListingDrafts: inlineDrafts,
      },
      state: { creation: {} },
      setFeedback: () => {},
      writeTextToClipboard: async (text) => {
        copied.push(text);
      },
    });

    controller.bindEvents();
    recordCopyButton.dispatchEvent({ type: "click", bubbles: true });
    await Promise.resolve();
    inlineCopyButton.dispatchEvent({ type: "click", bubbles: true });
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }

  assert.deepEqual(copied, ["record title", "inline title"]);
});

test("creation listing drafts scroll in the right output panel without collapsing images", async () => {
  const styles = await readFile(stylesPath, "utf8");

  const outputPanelRule = readCssRuleContaining(styles, ".creation-output-panel", "display: flex");
  const resultGridRule = readCssRule(styles, ".creation-result-grid");

  assert.doesNotMatch(outputPanelRule, /grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto;/);
  assert.match(outputPanelRule, /display:\s*flex;/);
  assert.match(outputPanelRule, /flex-direction:\s*column;/);
  assert.match(outputPanelRule, /overflow:\s*auto;/);
  assert.match(resultGridRule, /flex:\s*0 0 auto;/);
  assert.match(resultGridRule, /min-height:\s*max-content;/);
  assert.match(resultGridRule, /overflow:\s*visible;/);
  assert.match(styles, /\.creation-output-panel,[\s\S]*\.creation-form,[\s\S]*\.creation-result-grid,[\s\S]*scrollbar-width:\s*thin;/);
  assert.match(styles, /\.creation-output-panel::-webkit-scrollbar,[\s\S]*\.creation-form::-webkit-scrollbar,[\s\S]*width:\s*var\(--scrollbar-size,\s*10px\);/);
});

test("creation listing agent can run automatically after full creation generation completes", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /function shouldAutoGenerateCreationListings\(completedSet = getCreationCurrentSet\(\), queueJob = null\) \{/,
  );
  assert.match(app, /refs\.creationListingAgentEnabledInput\?\.checked/);
  assert.match(app, /state\.creation\.generationScope === "full"/);
  assert.match(
    app,
    /if \(eventName === "complete"\) \{[\s\S]*upsertCreationSetForStream\(payload\.set, context\);[\s\S]*shouldAutoGenerateCreationListings\(completedSet, context\.queueJob\)[\s\S]*setCreationFeedback\("套图生成完成，正在自动生成 Listing\.\.\.", "busy"\);[\s\S]*creationListingController\.generate\(payload\.set\.setId\)[\s\S]*setCreationFeedback\("套图与 Listing 已生成。", "success"\)/,
  );
});

test("waterfall gallery paginates history unless keyword search is active", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="galleryPagination"/);
  assert.match(html, /id="galleryPreviousPageButton"[\s\S]*上一页/);
  assert.match(html, /id="galleryNextPageButton"[\s\S]*下一页/);
  assert.match(app, /paginateGallerySections/);
  assert.match(app, /const shouldPaginateHistory = !filters\.query;/);
  assert.match(app, /refs\.galleryPreviousPageButton\.addEventListener\("click"/);
  assert.match(app, /refs\.galleryNextPageButton\.addEventListener\("click"/);
});

test("PPT view supports richer styles and direct slide annotation editing", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<option value="tech">科技发布<\/option>/);
  assert.match(html, /<option value="finance">金融数据<\/option>/);
  assert.match(html, /<option value="luxury">高端品牌<\/option>/);
  assert.match(html, /id="pptEditModal"/);
  assert.match(html, /id="pptEditCanvas"/);
  assert.match(html, /id="pptEditInstructionInput"/);
  assert.match(html, /id="pptSubmitEditButton"[\s\S]*重新生成本页/);

  assert.match(styles, /\.ppt-edit-modal\s*\{/);
  assert.match(styles, /\.ppt-edit-canvas-wrap\s*\{/);
  assert.match(styles, /\.ppt-edit-toolbar\s*\{/);

  assert.match(app, /function openPptSlideEditor\(slideNumber\)/);
  assert.match(app, /function drawPptEditStroke/);
  assert.match(app, /function submitPptSlideEdit\(\)/);
  assert.match(app, /fetch\("\/api\/ppt\/slide\/edit"/);
  assert.match(app, /data-ppt-edit-slide/);
  assert.match(app, /refs\.pptSubmitEditButton\.addEventListener\("click",/);
});

test("PPT view exposes dynamic components and transition effect controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="pptDynamicPresetInput"/);
  assert.match(html, /<option value="storyline">路径叙事<\/option>/);
  assert.match(html, /<option value="data-pulse">数据脉冲<\/option>/);
  assert.match(html, /id="pptTransitionPresetInput"/);
  assert.match(html, /<select id="pptTransitionPresetInput" name="transitionPreset">\s*<option value="smooth">平滑<\/option>/);
  assert.match(html, /<option value="fade">淡入<\/option>/);
  assert.match(html, /<option value="morph-flow">流动切换<\/option>/);
  assert.match(html, /id="pptTransitionSpeedInput"/);

  assert.match(styles, /\.ppt-motion-grid\s*\{/);
  assert.doesNotMatch(styles, /\.ppt-motion-note\s*\{/);
  assert.match(styles, /\.ppt-outline-box:empty\s*\{/);

  assert.match(app, /pptDynamicPresetInput: document\.querySelector\("#pptDynamicPresetInput"\)/);
  assert.match(app, /pptTransitionPresetInput: document\.querySelector\("#pptTransitionPresetInput"\)/);
  assert.match(app, /formData\.set\("dynamicPreset", refs\.pptDynamicPresetInput\.value\)/);
  assert.match(app, /formData\.set\("transitionPreset", refs\.pptTransitionPresetInput\.value\)/);
  assert.match(app, /transitionSpeed: refs\.pptTransitionSpeedInput\.value/);
});

test("PPT view exposes editable reconstruction export controls and download state", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="pptExportModeInput"/);
  assert.match(html, /name="exportMode"/);
  assert.match(html, /value="flat-image"/);
  assert.match(html, /value="editable-reconstruction"/);
  assert.match(html, /id="pptEditableDownloadLink"/);

  assert.match(styles, /\.ppt-editable-download-link\s*\{/);

  assert.match(app, /pptExportModeInput: document\.querySelector\("#pptExportModeInput"\)/);
  assert.match(app, /pptEditableDownloadLink: document\.querySelector\("#pptEditableDownloadLink"\)/);
  assert.match(app, /formData\.set\("exportMode", refs\.pptExportModeInput\.value\)/);
  assert.match(app, /eventName === "editable_deck_saved"/);
  assert.match(app, /editablePptxUrl/);
});

test("local PPT generation integrates editable reconstruction after ordinary PPTX export", async () => {
  const server = await readFile(serverPath, "utf8");
  const ordinaryExportIndex = server.indexOf("await exportPptxDeck({");
  const editableModeIndex = server.indexOf("if (isEditablePptExportMode(normalizedExportMode))");

  assert.match(server, /import \{ buildEditablePptxFilename, buildEditablePptxReconstruction \}/);
  assert.notEqual(ordinaryExportIndex, -1);
  assert.notEqual(editableModeIndex, -1);
  assert.ok(ordinaryExportIndex < editableModeIndex);
  assert.match(server.slice(ordinaryExportIndex, editableModeIndex), /outputPath: pptxAbsolutePath/);
  assert.match(server, /const editableResult = await buildEditablePptxReconstruction\(\{[\s\S]*?outputPath: resolveOutputAssetPath\(editablePptxRelativePath\)[\s\S]*?\}\);/);
  assert.match(server, /editablePptxRelativePath,[\s\S]*editablePptxFilename,[\s\S]*editablePptxWarnings,[\s\S]*exportMode: normalizedExportMode/);
  assert.match(server, /writeSseEventPayload\(onEvent, "editable_reconstruction_warning"/);
  assert.match(server, /writeSseEventPayload\(onEvent, "editable_deck_saved"/);
});
