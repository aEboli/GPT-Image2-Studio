import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as imageRouteConfig from "../lib/image-route-config.mjs";
import {
  getGrokImageQualityOptions,
  getImageQualityOptions,
  normalizeGrokImageQuality,
  normalizeImageQualityForRoute,
  normalizeImageQuality,
} from "../lib/image-quality-options.mjs";
import { normalizeOutputFormat } from "../lib/output-format-options.mjs";
import { normalizeGenerationSize, normalizeModelProtocolImageSize } from "../lib/generation-size-options.mjs";
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
    "grokImageModelInput", "grokModelPickerToggle", "grokModelOptionsList",
    "ratioInput", "reasoningEffortField", "reasoningEffortInput",
  ].map((name) => [name, createControl()]));
  refs.imageRouteInputs = ["a", "b", "c", "d"].map((value) => Object.assign(createControl(value), { checked: value === route }));
  const configSection = route === "c" ? "gemini" : route === "d" ? "grok" : "gpt";
  refs.configSectionInputs = ["gpt", "gemini", "grok", "theme"].map((value) => Object.assign(createControl(value), { checked: value === configSection }));
  refs.gptRouteInputs = ["a", "b"].map((value) => Object.assign(createControl(value), { checked: value === (route === "b" ? "b" : "a") }));
  refs.configForm = { dataset: {}, querySelectorAll: () => [] };
  for (const name of ["globalNavItems", "viewTabs", "viewPanels", "promptModeBlocks"]) refs[name] = [];
  refs.imageToolModelSelect.value = legacyModel;
  refs.directImageModelInput.value = extendedModel;
  refs.protocolImageModelInput.value = "gemini-3.1-flash-image-preview";
  refs.outputFormatInput.value = "jpg";
  const document = { ...createControl(), createElement: createControl, querySelector: () => ({}), documentElement: { dataset: {} } };
  refs.modelOptionsList.ownerDocument = document;
  const context = {
    ...imageRouteConfig, refs, document, FormData, createConfigModelPickerController,
    state: { activeView: "studio", studioMode: "prompt", referenceFiles: [], configSection, config: { defaults: { quality: "high" } } },
    getGrokImageQualityOptions, getImageQualityOptions, normalizeGrokImageQuality, normalizeImageQualityForRoute, normalizeImageQuality, normalizeOutputFormat,
    normalizeGenerationSize, normalizeModelProtocolImageSize,
    getBrowserPrivateConfigRequestPayload: () => browserConfig,
    DEFAULT_REASONING_EFFORTS: ["low", "medium", "high", "xhigh"],
    readEndpointFields: () => ({}), getConfiguredGenerationStartDelayMs: () => 1000, getConfiguredGenerationConcurrency: () => 20,
    GENERATION_START_DELAY_FIELD: "generationStartDelayMs", GENERATION_CONCURRENCY_FIELD: "generationConcurrency",
    VIEW_ACCENT_FAMILIES: {}, CREATE_VIEW_IDS: new Set(), ASSET_VIEW_IDS: new Set(),
    ensureActiveViewModule: async () => true,
    CONFIG_SECTION_IDS: new Set(["gpt", "gemini", "grok", "theme"]),
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
    "normalizeConfigSection", "getSelectedConfigSection", "getSelectedImageRoute", "syncConfigSectionControls",
    "refreshSelectedImageRouteUi", "selectGptImageRoute", "isModelProtocolImageRoute", "getSelectedImageToolModel", "getCurrentPrivateConfigRequestPayload",
    "getImageQualityInputs", "getImageQualityInputKey", "getImageQualityRouteValues", "rememberImageQualityForRoute",
    "normalizeSelectedImageQuality", "renderImageQualityOptions", "getSelectedImageQuality", "syncMainImageReasoningControl",
    "getSelectedReasoningEffort", "getSelectedImageReasoningEffort",
    "setActiveView", "setStudioGenerationMode", "normalizeSizeForSelectedRoute", "resolveGenerationSizeForSelectedRoute",
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
  context.refs.configSectionInputs.find((input) => input.value === "gemini").dispatch("change");
  assert.equal(context.refs.transparentBackgroundField.hidden, true);
  assert.equal(context.refs.outputFormatInput.value, "jpg");
  assert.equal(context.getPromptImageBackground(), "opaque");
});

test("configuration sections select provider routes and keep GPT mode switching local", () => {
  const context = createHarness();
  const { refs, state } = context;

  refs.gptRouteInputs.find((input) => input.value === "b").dispatch("change");
  assert.equal(context.getSelectedImageRoute(), "b");
  assert.equal(state.configModels.target, "direct");

  refs.configSectionInputs.find((input) => input.value === "gemini").dispatch("change");
  assert.equal(context.getSelectedImageRoute(), "c");
  assert.equal(state.configModels.target, "protocol");

  refs.configSectionInputs.find((input) => input.value === "grok").dispatch("change");
  assert.equal(context.getSelectedImageRoute(), "d");
  assert.equal(state.configModels.target, "grok");

  refs.configSectionInputs.find((input) => input.value === "gpt").dispatch("change");
  assert.equal(context.getSelectedImageRoute(), "a");
  assert.equal(state.configModels.target, "responses");

  refs.configSectionInputs.find((input) => input.value === "theme").dispatch("change");
  assert.equal(context.getSelectedImageRoute(), "a");
  assert.equal(state.configModels.target, "responses");
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
  const values = ["low", "max", "medium", "xhigh", "high"];
  qualityFields.forEach((name, index) => { context.refs[name].value = values[index]; });
  context.renderImageQualityOptions();
  qualityFields.forEach((name, index) => {
    assert.deepEqual(context.refs[name].children.map((option) => option.value), ["low", "medium", "high", "xhigh", "max"]);
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

test("route d exposes only Grok-supported quality choices", () => {
  const context = createHarness({ route: "d", browserConfig: { grokImageModel: "grok-imagine-image-2.0" } });
  context.refs.qualityInput.value = "high";
  context.renderImageQualityOptions();

  assert.deepEqual(getGrokImageQualityOptions().map((option) => option.value), ["low", "medium"]);
  assert.deepEqual(context.refs.qualityInput.children.map((option) => option.value), ["low", "medium"]);
  assert.equal(context.refs.qualityInput.value, "medium");
  assert.equal(context.getSelectedImageQuality(context.refs.qualityInput), "medium");
  assert.equal(normalizeGrokImageQuality("max"), "medium");
});

test("provider selection refreshes available quality tiers", () => {
  const context = createHarness();
  context.renderImageQualityOptions();
  context.refs.configSectionInputs.find((input) => input.value === "grok").dispatch("change");
  assert.deepEqual(context.refs.creationQualityInput.children.map((option) => option.value), ["low", "medium"]);
  assert.equal(context.refs.creationQualityInput.value, "medium");
  context.refs.configSectionInputs.find((input) => input.value === "gpt").dispatch("change");
  assert.deepEqual(context.refs.creationQualityInput.children.map((option) => option.value), ["low", "medium", "high"]);
});

for (const route of ["b", "c", "d"]) {
  test(`typing or picking the route ${route} image model refreshes quality controls immediately`, () => {
    const context = createHarness({ route });
    const input = route === "b"
      ? context.refs.directImageModelInput
      : route === "c"
        ? context.refs.protocolImageModelInput
        : context.refs.grokImageModelInput;
    const list = route === "b"
      ? context.refs.directModelOptionsList
      : route === "c"
        ? context.refs.protocolModelOptionsList
        : context.refs.grokModelOptionsList;
    input.value = legacyModel;
    context.renderImageQualityOptions();
    list.dispatch("click", { closest: () => ({ dataset: { modelId: extendedModel } }) });
    assert.equal(context.refs.pptQualityInput.children.some((option) => option.value === "max"), route !== "d");
    context.refs.pptQualityInput.value = route === "d" ? "high" : "max";
    input.value = legacyModel;
    input.dispatch("input");
    assert.equal(context.refs.pptQualityInput.value, route === "d" ? "medium" : "high");
    assert.equal(context.refs.pptQualityInput.children.some((option) => option.value === "max"), false);
  });
}
