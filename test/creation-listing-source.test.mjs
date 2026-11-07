import assert from "node:assert/strict";
import test from "node:test";

import { requestCreationListingDraft } from "../lib/creation-listing-agent.mjs";
import { buildCreationListingSources } from "../lib/creation-listing-draft.mjs";

function makeAnonymizedSet() {
  const referenceImageRoles = [
    { index: 1, role: "product-subject", filename: "sample-standard.png", note: "标准款，黑色；长度 22 cm，宽度 11 cm；净重 240 g。" },
    { index: 2, role: "product-subject", filename: "sample-large.png", note: "大号，黑色；长度 24 cm，宽度 12 cm；净重 260 g。" },
    { index: 3, role: "detail", filename: "sample-package.png", note: "包装尺寸 28 x 16 x 6 cm；毛重 360 g；来源：包装参考图。" },
  ];
  const skuSubjects = [
    { id: "standard", title: "Standard Black Gloves", note: referenceImageRoles[0].note, filenames: [referenceImageRoles[0].filename], bundleCount: 1, subjectUnitCount: 2 },
    { id: "large", title: "Large Black Gloves", note: referenceImageRoles[1].note, filenames: [referenceImageRoles[1].filename], bundleCount: 2, subjectUnitCount: 2 },
  ];
  const productInsights = {
    version: 1,
    confirmedFacts: [
      { id: "fact-1", text: "Black gloves with wrist zipper", kind: "appearance", source: "reference", referenceIndexes: [1, 2] },
      { id: "fact-2", text: "Three temperature settings: 45°C / 50°C / 55°C", kind: "spec", source: "user", referenceIndexes: [] },
      { id: "fact-3", text: "3000 mAh battery; USB charging", kind: "spec", source: "reference", referenceIndexes: [3] },
    ],
    sellingPoints: [{ id: "selling-1", text: "Wrist zipper and three supplied settings", factIds: ["fact-1", "fact-2"] }],
    painPoints: [{ id: "pain-1", text: "Different size options need distinct measurements", factIds: ["fact-1"] }],
    unknowns: ["Battery runtime is not supplied"],
    conflicts: [{ text: "Unverified waterproof claim", claims: ["waterproof"], factIds: [] }],
  };
  const drawingDirectives = [
    "Recompose the complete sellable product from the supplied references. Preserve the observed shape, seams, wrist zipper, round controller, colors, material texture, markings and part-to-surface ownership. Do not invent unseen components, additional batteries, internal wires or unsupported views.",
    "Use a seamless white background and shaped key and rim lighting. Establish sculptural volume with material-specific reflections, soft contact shadows and coherent spatial lighting. Localized warmth is a conceptual visual effect, not measured thermal imaging or proof of a performance number.",
    "Keep the entire product inside the safe composition area. Distinguish the foreground and background through scale and overlap. Choose an independent supported camera framing rather than reproducing a source canvas. Avoid repeated framing across the hero, detail, specifications and packaging images.",
    "Only render assigned factual labels in the selected target language. Preserve the supplied numeric values and unit conversions. Never add certification badges, store names, rankings, guarantees, promotional prices, watermarks, unverified compatibility or unsupported package contents.",
    "Reference selection: use the subject references for geometry and the detail reference for confirmed controls. Place the reference-supported feature in visual focus, with readable text contrast and suitable negative space. Scene props are context elements rather than included accessories.",
    "For the final image, preserve the actual fabric and visible surfaces. Use the assigned content task as the primary hierarchy, with restrained commercial lighting and a coherent perspective. Do not replace the factual product with a generic icon or show the source reference as an inset collage.",
  ];
  const items = Array.from({ length: 20 }, (_, index) => ({
    itemId: "sample-item-" + (index + 1), slotIndex: index, role: index % 2 ? "detail" : "hero",
    title: "商品细节 " + (index + 1), status: index === 19 ? "failed" : "completed",
    filename: "sample-" + (index + 1) + ".png", relativePath: "sample-set/sample-" + (index + 1) + ".png",
    size: "1024x1024", format: "png", skuSubjectId: skuSubjects[index % 2].id, skuSubject: skuSubjects[index % 2],
    prompt: ["Image task " + (index + 1) + ": supplied product detail.", ...drawingDirectives].join("\n\n"),
    marketingCopy: "INTERNAL_DRAWING_COPY_DO_NOT_SEND",
    conversionIntent: { audienceFocus: "Buyers comparing glove sizes", motivationFocus: "Two stated size options", objectionFocus: "Measurements differ by selected variant", evidenceFocus: "Standard 22 x 11 cm; large 24 x 12 cm" },
  }));
  const effectivePlan = {
    productName: "Black Heated Gloves", productDescription: "Black gloves with wrist zipper. Package dimensions: 28 x 16 x 6 cm. Net weight 240 g. Gross weight 360 g.",
    sellingPoints: ["Wrist zipper", "3000 mAh battery", "Three settings: 45°C / 50°C / 55°C"],
    productInsights, dimensionSpecs: "Standard: length 22 cm x width 11 cm; Large: length 24 cm x width 12 cm",
    dimensionSpecGroups: referenceImageRoles.slice(0, 2).map((entry, index) => ({ id: "group-" + index, label: skuSubjects[index].title, referenceIndexes: [entry.index], filenames: [entry.filename], lines: [entry.note] })),
    dimensionUnitMode: "both", dimensionUnitModeLabel: "公制与英制",
    platform: "temu", platformPolicyId: "temu", targetLanguage: "en", platformProvenance: "explicit",
    categorySignals: ["winter gloves"], industryTemplatePath: "服饰 / 手套",
    referenceImageRoles, skuSubjects, skuBundleCount: 1,
    logo: { brand: "Sample Private Brand", text: "INTERNAL_LOGO_ARTWORK" },
    platformProfile: { prompt: drawingDirectives.join(" ") },
    slots: items.map((item) => ({ ...item })), items,
  };
  return { setId: "anonymized-listing-set", ...effectivePlan, effectivePlan, generatedItems: items.filter((item) => item.status === "completed") };
}

async function captureModelSource(source, endpointPath = "/responses") {
  let body;
  await assert.rejects(requestCreationListingDraft({
    baseUrl: "https://example.test/v1", apiKey: "test-key", source, endpointPath,
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      throw new Error("Fixture request captured");
    },
  }), /Fixture request captured/u);
  const prompt = body.input || body.messages[0].content;
  const sourceText = prompt.split("Source JSON:\n")[1].split("\n\n")[0];
  return { source: JSON.parse(sourceText), sourceText, prompt, body };
}

test("model source removes drawing plans and shrinks an anonymized real-structure fixture by at least 70%", async (t) => {
  const [source] = buildCreationListingSources(makeAnonymizedSet());
  const before = structuredClone(source);
  const captured = await captureModelSource(source);
  const model = captured.source;
  assert.equal(Object.hasOwn(model, "effectivePlan"), false);
  assert.equal(Object.hasOwn(model, "plannedItems"), false);
  assert.doesNotMatch(captured.sourceText, /INTERNAL_DRAWING_COPY|INTERNAL_LOGO_ARTWORK|"prompt"|"slots"/u);
  for (const key of ["platformId", "platformLabel", "marketplace", "listingPolicy", "language", "productName", "productDescription", "sellingPoints", "titleValueEvidence", "buyerDecisionEvidence", "listingEvidenceAliases", "skuSubjects", "skuBundleCount", "skuQuantityOptions", "skuPackQuantityText", "skuVariantCount", "dimensionSpecs", "dimensionUnitMode", "dimensionUnitModeLabel", "productDimensionEvidence", "packageDimensionEvidence", "productWeightEvidence", "packageWeightEvidence", "referenceImageRoles", "evidenceMode", "warnings"]) {
    assert.deepEqual(model[key], source[key], key);
  }
  assert.deepEqual(model.planFacts.productInsights, source.effectivePlan.productInsights);
  assert.deepEqual(model.planFacts.dimensionSpecGroups, source.effectivePlan.dimensionSpecGroups);
  assert.deepEqual(model.planFacts.categorySignals, ["winter gloves"]);
  assert.ok(model.forbiddenTerms.includes("Sample Private Brand"));
  assert.equal(model.imageItems.length, 20);
  assert.equal(model.imageItems.find((item) => item.itemId === "sample-item-20").status, "failed");
  assert.deepEqual(source, before, "完整本地来源不能被修改");
  const beforeLength = JSON.stringify(source, null, 2).length;
  const afterLength = captured.sourceText.length;
  const reduction = 1 - afterLength / beforeLength;
  t.diagnostic("Source JSON: " + beforeLength + " -> " + afterLength + " characters; reduced " + (reduction * 100).toFixed(2) + "%");
  assert.ok(reduction >= 0.7, "source reduction " + (reduction * 100).toFixed(2) + "%");
  const compactBefore = JSON.stringify(source).length;
  const compactAfter = JSON.stringify(model).length;
  t.diagnostic("Compact JSON: " + compactBefore + " -> " + compactAfter + " characters; reduced " + ((1 - compactAfter / compactBefore) * 100).toFixed(2) + "%");
  assert.ok(compactAfter <= compactBefore * 0.3, "压缩目标不能依赖 JSON 缩进差异");
});

test("completed image metadata wins and planned metadata only fills missing fields", async () => {
  const { source } = await captureModelSource({
    productName: "Storage Box",
    imageItems: [
      { itemId: "shared", status: "completed", title: "Completed view", skuSubject: { id: "blue", title: "Blue option", note: "" }, prompt: "INTERNAL_IMAGE_PROMPT" },
      { itemId: "shared", status: "planned", title: "Old view" }, null,
    ],
    plannedItems: [
      { itemId: "shared", status: "planned", title: "Planned view", role: "detail", skuSubject: { id: "blue", title: "Old option", note: "Length 20 cm; net weight 100 g", subjectUnitCount: 2 } },
      { itemId: "failed-only", status: "failed", title: "Unavailable packaging view" },
      { title: "Anonymous red variant", status: "planned" },
      { title: "Anonymous blue variant", status: "planned" },
    ],
  });
  assert.equal(Object.hasOwn(source, "plannedItems"), false);
  assert.equal(source.imageItems.length, 4);
  const completed = source.imageItems.find((item) => item.itemId === "shared");
  assert.equal(completed.status, "completed");
  assert.equal(completed.title, "Completed view");
  assert.equal(completed.role, "detail");
  assert.deepEqual(completed.skuSubject, { id: "blue", title: "Blue option", note: "Length 20 cm; net weight 100 g", subjectUnitCount: 2 });
  assert.equal(source.imageItems.find((item) => item.itemId === "failed-only").status, "failed");
  assert.doesNotMatch(JSON.stringify(source), /INTERNAL_IMAGE_PROMPT/u);
});

test("projection preserves complete component axes, explicit weights, units and their provenance without truncation", async () => {
  const dimensions = Array.from({ length: 30 }, (_, index) => "Component " + (index + 1) + ": length " + (index + 10) + " mm x width " + (index + 5) + " mm x height " + (index + 2) + " mm").join("; ");
  const source = {
    productName: "Component Set", dimensionSpecs: dimensions, productDimensionEvidence: dimensions,
    packageDimensionEvidence: "Carton: length 300 mm x width 200 mm x height 80 mm; source: package reference 3",
    productWeightEvidence: "Net: 350 g (12.35 oz); source: manufacturer specification",
    packageWeightEvidence: "Gross: 500 g (1.1 lb); source: carton label",
    dimensionUnitMode: "both", dimensionUnitModeLabel: "公制与英制",
    productDimensions: dimensions, packageDimensions: "300 x 200 x 80 mm",
    productWeight: 350, productWeightUnit: "g", packageWeight: 500, packageWeightUnit: "g",
    referenceImageRoles: [{ index: 3, filename: "package-label.png", role: "detail", note: dimensions }],
  };
  const { source: model } = await captureModelSource(source);
  for (const key of Object.keys(source)) assert.deepEqual(model[key], source[key], key);
});

for (const endpointPath of ["/responses", "/chat/completions"]) {
  for (const contract of ["legacy", "v1", "v2"]) {
    test(contract + " " + endpointPath + " keeps parseable Source JSON and the trilingual schema", async () => {
      const { source, prompt, body } = await captureModelSource({
        productName: "Storage Box", skuBundleCount: 2, dimensionSpecs: "20 x 12 x 10 cm",
        ...(contract === "legacy" ? {} : { platformId: "etsy", ...(contract === "v1" ? { forceV1: true } : { forceV2: true }) }),
        effectivePlan: { productName: "Storage Box", slots: [{ prompt: "INTERNAL_DRAWING_PLAN" }], items: [{ prompt: "INTERNAL_DRAWING_PLAN" }] },
      }, endpointPath);
      assert.equal(source.productName, "Storage Box");
      assert.equal(source.skuBundleCount, 2);
      assert.equal(Object.hasOwn(source, "effectivePlan"), false);
      assert.doesNotMatch(prompt, /INTERNAL_DRAWING_PLAN/u);
      assert.match(prompt, /natural German reference translation/u);
      const schema = body.text?.format.schema || body.response_format.json_schema.schema;
      assert.ok(schema.properties.zhDisplay);
      assert.ok(schema.properties.deDisplay);
      assert.ok(schema.properties.title);
    });
  }
}

test("local cleanup still uses full source identity metadata omitted from model input", async () => {
  const source = {
    forceV1: true, platformId: "etsy", productName: "Storage Box", skuBundleCount: 1,
    internalIdentityMetadata: { brand: "Private Fixture Brand" },
    effectivePlan: { slots: [{ prompt: "LOCAL_ONLY_DRAWING_PLAN" }] },
  };
  const before = structuredClone(source);
  let request;
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1", apiKey: "test-key", source,
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({ output_text: JSON.stringify({ title: "Private Fixture Brand Storage Box", description: "Private Fixture Brand blue storage box.", zhDisplay: { title: "Private Fixture Brand 蓝色收纳盒" }, deDisplay: { title: "Private Fixture Brand blaue Aufbewahrungsbox" } }) }), { status: 200 });
    },
  });
  assert.doesNotMatch(request.input, /internalIdentityMetadata|LOCAL_ONLY_DRAWING_PLAN/u);
  assert.doesNotMatch(JSON.stringify(draft), /Private Fixture Brand/u);
  assert.deepEqual(source, before);
});
