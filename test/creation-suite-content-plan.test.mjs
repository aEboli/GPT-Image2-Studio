import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { applyCreationPlanOverrides, buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { allocateCreationProductScenes, normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { buildCreationQueuedSet as buildCreationQueuedSetFromState } from "../lib/creation-suite-queue.mjs";
import { buildCreationItemReferenceImages, buildCreationGenerationReferenceImageLabels } from "../lib/creation-reference-labels.mjs";
import { resolveCreationSelectedRolesSubmission } from "../lib/creation-browser-plan-state.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";

const sceneRoles = ["benefit", "scene", "atmosphere", "brand-story", "scene-fit-1", "scene-fit-2", "scene-fit-3", "after-sales", "human-handheld"].map((role) => ({ role }));
const normalized = (value) => normalizeCreationProductInsights(value, { referenceCount: 1, primaryIndex: 1 });

test("same phone operation is allocated once and exhausted scenes never cycle", () => {
  const insights = normalized(gloveAnalysisInput().productInsights);
  const assigned = allocateCreationProductScenes(sceneRoles, insights, {}, 0).filter(Boolean);
  assert.equal(assigned.filter((scene) => /手机/.test(scene.action)).length, 1);
  assert.equal(assigned.length, 4);
  assert.equal(new Set(assigned.map((scene) => scene.actionGroup)).size, assigned.length);
  assert.equal(assigned.some((scene) => /Preparation before|Putting away after/.test(scene.action)), false);
});

test("legacy scene grouping merges phone paraphrases without merging different operations sharing facts", () => {
  const raw = gloveAnalysisInput().productInsights;
  raw.usage_scenarios.forEach((scene) => { delete scene.action_group; });
  raw.usage_scenarios.push(
    { ...raw.usage_scenarios[0], id: "camera", title: "相机", action: "按下相机快门按钮", environment: "河边拍摄点" },
    { ...raw.usage_scenarios[0], id: "leash", title: "遛狗", action: "握住牵引绳遛狗", environment: "公园" },
  );
  const assigned = allocateCreationProductScenes(sceneRoles, normalized(raw), {}, 0).filter(Boolean);
  assert.equal(assigned.filter((scene) => /手机/.test(scene.action)).length, 1);
  assert.ok(assigned.some((scene) => /相机快门/.test(scene.action)));
  assert.ok(assigned.some((scene) => /牵引绳/.test(scene.action)));
});

test("automatic carousel includes independent information jobs before appended rebuilds", () => {
  for (const imageCount of [6, 8, 10, 12, 14, 18]) {
    const plan = buildCreationPlan(gloveAnalysisInput({ imageCount, infographicRebuildEnabled: true }));
    const items = plan.items.filter((item) => item.itemKind === "carousel");
    const information = items.filter((item) => item.contentAssignment?.kind === "infographic" && !item.evidenceBlocked);
    assert.ok(information.length >= (imageCount >= 12 ? 3 : 2), `${imageCount} images contain ${information.length} information jobs`);
    assert.equal(new Set(information.map((item) => item.contentAssignment.taskKey)).size, information.length);
    assert.ok(items.filter((item) => /手机/.test(item.sceneAssignment?.action || "")).length <= 1);
    assert.equal(items.length, imageCount);
  }
});

test("selling overview receives multiple benefits and cannot become invented charging steps", () => {
  const plan = buildCreationPlan(gloveAnalysisInput());
  const overview = plan.items.find((item) => item.contentAssignment?.taskKey === "selling-overview");
  assert.ok(overview);
  assert.ok(overview.contentAssignment.sellingPointIds.length >= 2);
  assert.ok(overview.contentAssignment.factIds.includes("fingers"));
  assert.doesNotMatch(overview.prompt, /numbered step|charging and connection ease|Single buying reason:/i);
  const dimensions = plan.items.find((item) => item.contentAssignment?.taskKey === "dimensions");
  assert.ok(dimensions);
  assert.doesNotMatch(dimensions.prompt, /charging|step infographic|\[battery;/i);
  const functional = plan.items.find((item) => item.role === "effect-comparison");
  assert.doesNotMatch(functional?.prompt || "", /exploded 3D|cutaway, arrows|separated pieces/i);
});

test("insufficient evidence yields explicit gaps rather than repeated scenes or fabricated information", () => {
  const raw = gloveAnalysisInput().productInsights;
  raw.confirmed_facts = raw.confirmed_facts.filter((fact) => fact.id === "appearance");
  raw.selling_points = [];
  raw.usage_scenarios = [];
  const plan = buildCreationPlan(gloveAnalysisInput({ dimensionSpecs: "", productInsights: raw }));
  assert.ok(plan.warnings.some((warning) => warning.code === "suite-information-gap"));
  assert.ok(plan.items.some((item) => item.evidenceBlocked && item.contentAssignment?.kind === "gap"));
  assert.ok(plan.items.filter((item) => item.contentAssignment?.kind === "infographic" && !item.evidenceBlocked).length < 3);
  assert.equal(plan.items.some((item) => item.sceneAssignment), false);
});

test("manual role choices and individual prompts survive automatic balance", () => {
  const roles = ["hero", "scene", "scene-fit-1", "scene-fit-2", "scene-fit-3", "human-handheld"];
  const plan = buildCreationPlan(gloveAnalysisInput({ selectedRoles: roles }));
  assert.deepEqual(plan.items.map((item) => item.role), roles);
  assert.ok(plan.warnings.some((warning) => /suite-(?:scene|information)-gap/.test(warning.code)));
  const custom = buildCreationPlan(gloveAnalysisInput({ platformItemOverrides: [{ slotKey: "universal:ownership-atmosphere", prompt: "用户写好的逐图提示词" }] }));
  assert.equal(custom.items.find((item) => item.slotKey === "universal:ownership-atmosphere").prompt, "用户写好的逐图提示词");
});

test("submitted plan, stored items and repair preserve the exact content assignment", () => {
  const plan = buildCreationPlan(gloveAnalysisInput());
  assert.ok(plan.items[0].contentAssignment);
  const submitted = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ setId: "suite-content-regression", productInsights: plan.productInsights, effectivePlan: submitted, items: submitted.items });
  const repair = buildCreationRepairPlan(stored);
  const queued = buildCreationQueuedSetFromState({
    getFrozenCreationEffectivePlan: () => plan,
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedLanguage: () => ({ value: "en" }),
    getCreationSelectedScenario: () => ({ value: "standard" }),
    getCreationSelectedIndustryTemplate: () => ({ value: "general" }),
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value) || 1,
    refs: {}, normalizeSet: (set) => set,
  });
  for (let index = 0; index < plan.items.length; index += 1) {
    assert.deepEqual(submitted.items[index].contentAssignment, plan.items[index].contentAssignment);
    assert.deepEqual(stored.items[index].contentAssignment, plan.items[index].contentAssignment);
    assert.deepEqual(repair.items[index].contentAssignment, plan.items[index].contentAssignment);
    assert.deepEqual(queued.items[index].contentAssignment, plan.items[index].contentAssignment);
    assert.equal(repair.items[index].prompt, plan.items[index].prompt);
  }
});

test("an explicit image count keeps automatic roles automatic until the user edits roles", () => {
  const input = { platformSetOverrides: { imageCount: 6 }, selectedRoles: ["hero", "scene", "multi-angle"], roleSelectionManuallyEdited: false };
  assert.deepEqual(resolveCreationSelectedRolesSubmission(input), { imageCount: 6, selectedRoles: [] });
  assert.deepEqual(resolveCreationSelectedRolesSubmission({ ...input, roleSelectionManuallyEdited: true }).selectedRoles, input.selectedRoles);
});

test("editing a prompt after preview preserves the prompt and clears only its automatic content gap", () => {
  const plan = buildCreationPlan(gloveAnalysisInput());
  const missing = plan.items.find((item) => item.contentAssignment?.kind === "gap" && item.evidenceRequirement.code === "suite-content" && item.role.startsWith("scene-fit"));
  assert.ok(missing);
  const prompt = "手动指定的不同使用画面";
  const edited = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(applyCreationPlanOverrides(plan, [{ itemId: missing.itemId, prompt }])) });
  const item = edited.items.find((item) => item.itemId === missing.itemId);
  assert.equal(item.prompt, prompt);
  assert.equal(item.contentAssignment.kind, "manual");
  assert.equal(item.evidenceBlocked, false);
});

test("assigned reference selection and labels exclude unrelated facts even when their source role matches", () => {
  const input = gloveAnalysisInput();
  input.referenceImageRoles.push(
    { index: 2, filename: "function.png", role: "feature", note: "ASSIGNED_NOTE; UNRELATED_NOTE" },
    { index: 3, filename: "other-function.png", role: "feature", note: "UNRELATED_NOTE" },
  );
  input.productInsights.confirmed_facts.find((fact) => fact.id === "heat").reference_indexes = [2];
  const plan = buildCreationPlan(input);
  const item = plan.items.find((item) => item.contentAssignment.taskKey === "function-explanation");
  const references = input.referenceImageRoles.map((role) => ({ name: role.filename, referenceIndex: role.index, buffer: Buffer.from("reference") }));
  const selected = buildCreationItemReferenceImages(item, references, plan.referenceImageRoles);
  assert.ok(selected.some((image) => image.name === "function.png"));
  assert.equal(selected.some((image) => image.name === "other-function.png"), false);
  const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, item).join("\n");
  assert.match(labels, /内置加热芯片/);
  assert.doesNotMatch(labels, /UNRELATED_NOTE/);
});

test("supporting appearance and a dimension-check scene cannot duplicate the main detail and size tasks", () => {
  const input = gloveAnalysisInput();
  input.referenceImageRoles.push({ index: 2, filename: "black-phone.png", role: "feature" });
  input.productInsights.confirmed_facts.unshift({ id: "support-appearance", text: "黑色手套在操作手机", kind: "appearance", source: "reference", reference_indexes: [2] });
  const plan = buildCreationPlan(input);
  assert.equal(plan.items.some((item) => item.contentAssignment?.kind === "detail" && item.contentAssignment.factIds.includes("support-appearance")), false);
  assert.equal(plan.items.some((item) => item.sceneAssignment?.id === "size-scene"), false);
});

test("browser normalization and plan preview retain and display the assigned content", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const normalizer = app.slice(app.indexOf("function normalizeCreationItemForView("), app.indexOf("function normalizeCreationSetForView("));
  const renderer = app.slice(app.indexOf("function renderCreationPlatformPlan("), app.indexOf("function renderCreationView("));
  const element = () => ({ children: [], textContent: "", classList: { toggle() {} }, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } });
  const refs = { creationContentPlan: element(), creationContentPlanList: element() };
  const plan = buildCreationPlan(gloveAnalysisInput());
  const context = vm.createContext({
    refs, document: { createElement: element }, state: {},
    CREATION_PREVIEW_SLOTS: [], cloneCreationPlanValue: (value, fallback) => value ?? fallback,
    normalizeCreationGenerationSnapshotForView: () => ({}), normalizeCreationCoverageFields: () => ({}),
    getCreationDisplayedPlanContext: () => ({ plan }),
    createFrozenCreationPlatformPayload: () => ({ values: { platformSetOverrides: {}, platformItemOverrides: [] } }),
    getCreationPlatformPlanDisplayCounts: () => ({}),
  });
  vm.runInContext(normalizer + "\n" + renderer, context);
  const overview = plan.items.find((item) => item.contentAssignment?.taskKey === "selling-overview");
  assert.deepEqual(context.normalizeCreationItemForView(overview).contentAssignment, overview.contentAssignment);
  context.renderCreationPlatformPlan();
  assert.equal(refs.creationContentPlanList.children.length, plan.items.length);
  const copy = refs.creationContentPlanList.children.flatMap((entry) => entry.children.map((child) => child.textContent)).join("\n");
  assert.match(copy, /卖点与证据总览/);
  assert.match(copy, /内置加热芯片/);
  assert.match(copy, /缺少依据，跳过/);
  assert.doesNotMatch(copy, /undefined|\[object Object\]/);
});
