import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as imageRouteConfig from "../lib/image-route-config.mjs";
import { getImageQualityOptions, normalizeImageQuality } from "../lib/image-quality-options.mjs";
import { normalizeOutputFormat } from "../lib/output-format-options.mjs";
import { createConfigModelPickerController } from "../lib/config-model-picker.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const qualityFields = ["qualityInput", "creationQualityInput", "portraitQualityInput", "articleIllustrationQualityInput", "pptQualityInput"];
const legacyModel = "gpt-image-2";
const extendedModel = "gpt-image-2.5-sunburst";

function createControl(value = "") {
  const listeners = new Map();
  return {
    value, checked: false, dataset: {}, children: [],
    set innerHTML(_value) { this.children = []; },
    appendChild(child) { this.children.push(child); },
    setAttribute() {},
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatch(type, target = this) {
      for (const callback of listeners.get(type) || []) callback({ target });
    },
  };
}

function createHarness({ route = "a", browserConfig = {} } = {}) {
  const refs = Object.fromEntries([
    ...qualityFields, "transparentBackgroundField", "transparentBackgroundInput", "outputFormatInput",
    "imageToolModelSelect", "directImageModelInput", "protocolImageModelInput", "directResponsesModelInput",
    "baseUrlInput", "apiKeyInput", "responsesModelInput", "protocolBaseUrlInput", "protocolApiKeyInput",
    "configFeedback", "testConnectionButton", "fetchModelsButton", "modelPickerToggle", "modelOptionsList",
    "directModelPickerToggle", "directModelOptionsList", "protocolModelPickerToggle", "protocolModelOptionsList",
    "ratioInput", "reasoningEffortInput",
  ].map((name) => [name, createControl()]));
  refs.imageRouteInputs = ["a", "b", "c"].map((value) => Object.assign(createControl(value), { checked: value === route }));
  refs.configSectionInputs = ["a", "b", "c", "theme"].map((value) => createControl(value));
  for (const name of ["globalNavItems", "viewTabs", "viewPanels", "promptModeBlocks"]) refs[name] = [];
  refs.imageToolModelSelect.value = legacyModel;
  refs.directImageModelInput.value = extendedModel;
  refs.protocolImageModelInput.value = "gemini-3.1-flash-image-preview";
  refs.outputFormatInput.value = "jpg";
  const document = { ...createControl(), createElement: createControl, querySelector: () => ({}), documentElement: { dataset: {} } };
  refs.modelOptionsList.ownerDocument = document;
  const context = {
    ...imageRouteConfig, refs, document, FormData, createConfigModelPickerController,
    state: { activeView: "studio", studioMode: "prompt", referenceFiles: [], config: { defaults: { quality: "high" } } },
    getImageQualityOptions, normalizeImageQuality, normalizeOutputFormat,
    getBrowserPrivateConfigRequestPayload: () => browserConfig,
    readEndpointFields: () => ({}), getConfiguredGenerationStartDelayMs: () => 1000, getConfiguredGenerationConcurrency: () => 20,
    GENERATION_START_DELAY_FIELD: "generationStartDelayMs", GENERATION_CONCURRENCY_FIELD: "generationConcurrency",
    VIEW_ACCENT_FAMILIES: {}, CREATE_VIEW_IDS: new Set(), ASSET_VIEW_IDS: new Set(),
    ensureActiveViewModule: async () => true, normalizeConfigSection: (section) => section,
    getSelectedConfigSection: () => refs.imageRouteInputs.find((input) => input.checked).value,
    getUiLanguageText: (key) => key,
    DEFAULT_UI_RATIO: "1:1", DEFAULT_UI_RATIO_LABEL: "1:1",
    getRatioOption: () => ({ value: "1:1", baseSize: "1024x1024" }), getSelectedGenerationSize: () => "auto",
    nowIso: () => new Date().toISOString(), buildPromptModePrompt: () => "test prompt",
    getGenerationReferenceFile: (item) => item.file, buildGenerationTaskStatusText: () => "queued",
  };
  for (const name of [
    "syncHash", "renderActiveView", "syncGalleryLayoutMode", "scheduleStudioHeightSync", "scheduleGalleryPanelHeightSync",
    "scheduleGalleryScrollSync", "updateGenerateButton", "syncConfigSectionControls", "updateGenerationModeStatus",
    "syncEndpointFieldsFromFullUrlModes", "syncProtocolEndpointPreview", "renderSizeOptions", "renderReferenceAnalysisSizeOptions",
    "renderImageDecompositionSizeOptions", "renderCreationSizeOptions", "renderPortraitSizeOptions",
  ]) context[name] = () => {};
  const functions = [
    "supportsPromptTransparentBackground", "getPromptImageBackground", "syncPromptTransparentBackgroundControl",
    "getSelectedImageRoute", "isModelProtocolImageRoute", "getSelectedImageToolModel", "getCurrentPrivateConfigRequestPayload",
    "getImageQualityInputs", "renderImageQualityOptions", "getSelectedImageQuality", "setActiveView", "setStudioGenerationMode",
    "selectConfigSection", "createJob", "savePromptAttemptPreview",
  ].map((name) => {
    const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0];
    assert.ok(source, `${name} must be present`);
    return source;
  });
  const pickerStart = app.indexOf("const configModelPicker = createConfigModelPickerController(");
  const pickerEnd = app.indexOf("}); const apiEndpointBookPicker", pickerStart) + 3;
  const eventsStart = app.indexOf('  refs.configSectionInputs.forEach((input) => input.addEventListener("change"');
  const eventsEnd = app.indexOf("  configModelPicker.bindEvents();", eventsStart) + "  configModelPicker.bindEvents();".length;
  vm.runInNewContext([...functions, app.slice(pickerStart, pickerEnd), app.slice(eventsStart, eventsEnd)].join("\n"), context);
  return context;
}

for (const view of ["image-decomposition", "quick-blend", "style-transfer"]) {
  test(`leaving transparent prompt mode for ${view} restores the shared format before loading the view`, async () => {
    const context = createHarness();
    const { refs } = context;
    refs.transparentBackgroundInput.checked = true;
    context.syncPromptTransparentBackgroundControl();
    const queued = context.createJob();
    assert.equal(queued.imageBackground, "transparent");
    assert.equal(queued.format, "png");

    const viewChange = context.setActiveView(view);
    assert.equal(refs.outputFormatInput.value, "jpg");
    assert.equal(refs.outputFormatInput.disabled, false);
    assert.equal(context.getPromptImageBackground(), "opaque");
    await viewChange;
    await context.setActiveView("studio");
    assert.equal(refs.outputFormatInput.value, "png");
    refs.transparentBackgroundInput.checked = false;
    context.syncPromptTransparentBackgroundControl();
    assert.equal(refs.outputFormatInput.value, "jpg");
    assert.equal(queued.imageBackground, "transparent");
    assert.equal(queued.format, "png");
  });
}

test("protocol route hides transparent background and restores the selected format", () => {
  const context = createHarness();
  context.refs.transparentBackgroundInput.checked = true;
  context.syncPromptTransparentBackgroundControl();
  context.refs.configSectionInputs[2].dispatch("change");
  assert.equal(context.refs.transparentBackgroundField.hidden, true);
  assert.equal(context.refs.outputFormatInput.value, "jpg");
  assert.equal(context.getPromptImageBackground(), "opaque");
});

test("saving a prompt preview retains its job background after the current controls change", async () => {
  const context = createHarness();
  context.refs.transparentBackgroundInput.checked = true;
  const job = context.createJob();
  context.state.jobs = [job];
  context.refs.transparentBackgroundInput.checked = false;
  context.getPromptDeckCardsForKey = () => [{ attemptIndex: 1, previewUrl: "data:image/png;base64,AQID" }];
  context.makeJobPreviewKey = (id) => id;
  context.markPromptAttemptSaved = () => {};
  context.renderAll = () => {};
  context.showError = assert.fail;
  let savedPayload;
  context.fetch = async (_url, init) => {
    savedPayload = JSON.parse(init.body);
    return { ok: true, json: async () => ({ ok: true, filename: "preview.png" }) };
  };
  await context.savePromptAttemptPreview(job.id, 1);
  assert.equal(savedPayload.imageBackground, "transparent");
  assert.equal(savedPayload.format, "png");
});

test("all five quality controls follow the active image model and retain independent choices", () => {
  const context = createHarness({ route: "b" });
  const values = ["low", "max", "medium", "xhigh", "auto"];
  qualityFields.forEach((name, index) => { context.refs[name].value = values[index]; });
  context.renderImageQualityOptions();
  qualityFields.forEach((name, index) => {
    assert.deepEqual(context.refs[name].children.map((option) => option.value), ["auto", "low", "medium", "high", "xhigh", "max"]);
    assert.equal(context.getSelectedImageQuality(context.refs[name]), values[index]);
  });
});

for (const route of ["b", "c"]) {
  test(`route ${route} quality ignores the inactive A model and uses saved model fallbacks`, () => {
    const modelField = route === "b" ? "directImageModel" : "protocolImageModel";
    const context = createHarness({ route, browserConfig: { [modelField]: extendedModel } });
    context.refs[`${modelField}Input`].value = "";
    context.refs.creationQualityInput.value = "max";
    assert.equal(context.getSelectedImageQuality(context.refs.creationQualityInput), "max");
    context.refs[`${modelField}Input`].value = legacyModel;
    context.refs.imageToolModelSelect.value = extendedModel;
    context.renderImageQualityOptions();
    assert.equal(context.refs.creationQualityInput.value, "high");
    assert.equal(context.refs.creationQualityInput.children.some((option) => option.value === "max"), false);
  });
}

test("both route selectors refresh available quality tiers", () => {
  const context = createHarness();
  context.renderImageQualityOptions();
  context.refs.configSectionInputs[1].dispatch("change");
  assert.equal(context.refs.creationQualityInput.children.some((option) => option.value === "max"), true);
  context.refs.creationQualityInput.value = "max";
  context.refs.imageRouteInputs.forEach((input) => { input.checked = input.value === "c"; });
  context.refs.imageRouteInputs[2].dispatch("change");
  assert.equal(context.refs.creationQualityInput.value, "high");
  assert.equal(context.refs.creationQualityInput.children.some((option) => option.value === "max"), false);
});

for (const route of ["b", "c"]) {
  test(`typing or picking the route ${route} image model refreshes quality controls immediately`, () => {
    const context = createHarness({ route });
    const input = route === "b" ? context.refs.directImageModelInput : context.refs.protocolImageModelInput;
    const list = route === "b" ? context.refs.directModelOptionsList : context.refs.protocolModelOptionsList;
    input.value = legacyModel;
    context.renderImageQualityOptions();
    list.dispatch("click", { closest: () => ({ dataset: { modelId: extendedModel } }) });
    assert.equal(context.refs.pptQualityInput.children.some((option) => option.value === "max"), true);
    context.refs.pptQualityInput.value = "max";
    input.value = legacyModel;
    input.dispatch("input");
    assert.equal(context.refs.pptQualityInput.value, "high");
    assert.equal(context.refs.pptQualityInput.children.some((option) => option.value === "max"), false);
  });
}
