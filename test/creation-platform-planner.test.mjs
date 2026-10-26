import test from "node:test";
import assert from "node:assert/strict";
import { applyCreationPlanOverrides, buildCreationPlan } from "../lib/creation-planner.mjs";
import * as creationReferenceLabels from "../lib/creation-reference-labels.mjs";


const FULL_EVIDENCE = Object.freeze({
  dimensions: true,
  materials: true,
  packageContents: true,
  performance: true,
  specifications: true,
  craft: true,
  condition: true,
  defects: true,
});

const SKU_SUBJECTS = Object.freeze([
  { id: "blue", title: "Blue", filenames: ["blue.png"] },
  { id: "red", title: "Red", filenames: ["red.png"] },
]);

// Text-bearing prompts must carry one canvas-text policy that keeps new copy claim-free.
const CANVAS_TEXT_CLAIM_BAN = /no performance, safety, certification, price, or superiority claims/i;

function assertCanvasTextPolicy(prompt, label) {
  assert.match(prompt, /CANVAS TEXT:/i, label);
  assert.match(prompt, CANVAS_TEXT_CLAIM_BAN, label);
}

test("planner adapts conversion intent by universal audience without polluting the strict main slot", () => {
  const audienceStrategy = {
    targetAudience: "需要快速比较并放心下单的初次购买者",
    purchaseMotivations: ["快速确认是否适合"],
    purchaseObjections: ["担心尺寸与配件不匹配"],
    desiredOutcome: "减少选择不确定性",
    evidenceBasis: ["商品描述和尺寸字段"],
    confidence: "high",
    source: "user",
  };
  const plan = buildCreationPlan({
    productName: "便携收纳盒",
    productDescription: "提供折叠尺寸和包装清单",
    sellingPoints: ["折叠收纳"],
    platform: "universal",
    audienceStrategy,
    platformEvidence: FULL_EVIDENCE,
  });

  assert.equal(plan.platform, "universal");
  assert.deepEqual(plan.audienceStrategy, audienceStrategy);
  assert.equal(plan.effectiveAudienceStrategy.targetAudience, audienceStrategy.targetAudience);
  assert.ok(plan.items.every((item) => item.conversionIntent?.conversionGoal));
  assert.ok(plan.items.every((item) => !/Buyer goal:/i.test(item.prompt)));
  assertCanvasTextPolicy(plan.items[0].prompt, "hero");

  // multi-angle is the only text-free slot left in the universal profile: it keeps the
  // markings-only canvas text policy and must not receive creative-range divergence.
  const strictMain = plan.items.find((item) => item.imageType === "multi-angle");
  assert.ok(strictMain);
  assert.equal(strictMain.textPolicy, "none");
  assert.match(strictMain.prompt, /CANVAS TEXT: existing product markings only/i);
  assert.doesNotMatch(strictMain.prompt, /new text in/i);
  assert.doesNotMatch(strictMain.prompt, /Creative range:/i);
});

const PLATFORM_CASES = Object.freeze([
  {
    platform: "universal",
    imageTypes: [
      "generic-hero", "target-shopper-resonance", "scene-application", "multi-angle",
      "ownership-atmosphere", "detail-macro", "use-style-story", "dimension-fit",
      "comparison-proof", "scene-fit-1", "scene-fit-2", "in-box", "variant-comparison",
      "scene-fit-3", "pain-solution", "selling-point-stack", "creator-demo", "spec-table",
    ],
    roles: [
      "hero", "benefit", "scene", "multi-angle", "atmosphere", "product-detail",
      "brand-story", "size-capacity-fit", "effect-comparison", "scene-fit-1", "scene-fit-2",
      "accessory-gift", "series-showcase", "scene-fit-3", "after-sales", "usage-suggestion",
      "human-handheld", "spec-table",
    ],
    ratios: Array.from({ length: 18 }, () => "1:1"),
    resolutionTier: "1K",
    targetLanguage: "en",
  },
]);

function buildPlatformPlan(platform, extra = {}) {
  return buildCreationPlan({
    productName: "Trail Bottle",
    productDescription: "Stainless steel insulated bottle with supplied lid and carry loop",
    sellingPoints: "keeps drinks cool, easy to carry",
    platform,
    evidence: FULL_EVIDENCE,
    skuSubjects: SKU_SUBJECTS,
    infographicRebuildEnabled: false,
    ...extra,
  });
}

test("Creation planner emits the approved universal carousel plan and effective parameters", () => {
  for (const expected of PLATFORM_CASES) {
    const plan = buildPlatformPlan(expected.platform);
    const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

    assert.equal(plan.platform, expected.platform, expected.platform);
    assert.equal(plan.platformPolicyId, expected.platform, expected.platform);
    assert.match(plan.strategyVersion, /^\d{4}-\d{2}-\d{2}\.\d+$/u, expected.platform);
    assert.equal(plan.carouselImageCount, expected.imageTypes.length, expected.platform);
    assert.equal(plan.imageCount, expected.imageTypes.length, expected.platform);
    assert.equal(plan.skuImageCount, 2, expected.platform);
    assert.equal(plan.infographicRebuildCount, 0, expected.platform);
    assert.equal(plan.totalPlannedItemCount, expected.imageTypes.length + 2, expected.platform);
    assert.deepEqual(carouselItems.map((item) => item.imageType), expected.imageTypes, expected.platform);
    assert.deepEqual(carouselItems.map((item) => item.role), expected.roles, expected.platform);
    assert.deepEqual(carouselItems.map((item) => item.ratio), expected.ratios, expected.platform);
    assert.ok(carouselItems.every((item) => item.resolutionTier === expected.resolutionTier), expected.platform);
    assert.ok(carouselItems.every((item) => item.targetLanguage === expected.targetLanguage), expected.platform);
    assert.ok(carouselItems.every((item) => item.composition && item.textPolicy && item.scenePolicy && item.logoPolicy), expected.platform);
    assert.ok(carouselItems.every((item) => Array.isArray(item.constraints)), expected.platform);
    assert.ok(plan.items.slice(expected.imageTypes.length).every((item) => item.itemKind === "sku"), expected.platform);
    if (expected.warningCode) {
      assert.ok(plan.warnings.some((warning) => warning.code === expected.warningCode), expected.platform);
    }
  }
});

test("planner caps explicit roles at the universal image-type limit", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
    "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
    "scene-fit-1", "brand-story", "after-sales", "scene-fit-2", "scene-fit-3",
  ];
  const plan = buildCreationPlan({
    productName: "Travel Bottle",
    productDescription: "Product shown in the supplied image",
    platform: "universal",
    imageCount: 18,
    selectedRoles,
    platformEvidence: { dimensions: true, packageContents: true, skuVariants: true },
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");
  const nativeLimit = plan.platformProfile.slots.length;

  assert.equal(nativeLimit, 18);
  assert.equal(plan.carouselImageCount, nativeLimit);
  assert.equal(plan.imageCount, nativeLimit);
  assert.equal(plan.platformSetOverrides.imageCount, nativeLimit);
  assert.equal(carouselItems.length, nativeLimit);
  assert.equal(new Set(carouselItems.map((item) => item.slotKey)).size, nativeLimit);
  assert.deepEqual(carouselItems.map((item) => item.role), selectedRoles.slice(0, nativeLimit));
  assert.equal(carouselItems.some((item) => item.imageType === "custom"), false);
  const capWarning = plan.warnings.find((warning) => warning.code === "image-count-extension-limited");
  assert.ok(capWarning);
  assert.equal(capWarning.requestedCount, selectedRoles.length);
  assert.equal(capWarning.effectiveCount, nativeLimit);
  // Every capped slot still carries the supplied product identity as its source fact.
  assert.ok(carouselItems.every((item) => item.prompt.includes("Product: Travel Bottle.")));
});

test("universal keeps its native 18 slots when eighteen roles are requested", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
    "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
    "scene-fit-1", "brand-story", "after-sales",
  ];
  const plan = buildCreationPlan({
    productName: "Fishing Lure",
    productDescription: "Product shown in the supplied image",
    platform: "universal",
    imageCount: 18,
    selectedRoles,
    platformEvidence: {
      craft: true,
      defects: true,
      dimensions: true,
      materials: true,
      packageContents: true,
      performance: true,
      skuVariants: true,
    },
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(plan.carouselImageCount, 18);
  assert.equal(plan.platformSetOverrides.imageCount, 18);
  assert.equal(carouselItems.length, 18);
  assert.equal(carouselItems.some((item) => item.imageType === "custom"), false);
  assert.deepEqual(carouselItems.map((item) => item.role), selectedRoles);
  // 18 is the native universal limit, so the requested count is never reduced.
  assert.equal(plan.warnings.some((warning) => warning.code === "image-count-extension-limited"), false);
});

test("universal prompts stay platform-neutral and grounded in supplied source facts", () => {
  const plan = buildCreationPlan({
    productName: "Second-hand camera bag",
    productDescription: "Camera bag shown in the supplied product photo",
    platform: "universal",
    skuSubjects: SKU_SUBJECTS,
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.ok(carouselItems.length > 0);
  // Every prompt stays anchored to the supplied product identity instead of drifting into a generic scene.
  assert.ok(carouselItems.every((item) => item.prompt.includes("Product: Second-hand camera bag.")));
  // The universal baseline must not name a platform, and the deleted Temu profile must stay deleted.
  assert.ok(carouselItems.every((item) => !/Platform fit:|\btemu\b/i.test(item.prompt)));
  const textBearingItems = carouselItems.filter((item) => item.textPolicy !== "none");
  const textFreeItems = carouselItems.filter((item) => item.textPolicy === "none");
  assert.ok(textBearingItems.length > 0);
  // The universal profile keeps at least one strict markings-only slot.
  assert.ok(textFreeItems.length > 0);
  for (const item of textBearingItems) {
    assertCanvasTextPolicy(item.prompt, item.imageType);
  }
  assert.ok(
    textFreeItems.every((item) => /CANVAS TEXT: existing product markings only/i.test(item.prompt) && /Composition:/i.test(item.prompt)),
  );
  // Evidence-gated slot replacement only runs for non-universal profiles, so the
  // universal baseline keeps its full native set even without packageContents evidence.
  assert.ok(carouselItems.some((item) => item.imageType === "in-box"));
  assert.equal(plan.warnings.some((warning) => warning.code.startsWith("missing-evidence-slot-")), false);
});

test("platform item prompt overrides and legacy preview overrides remain compatible", () => {
  const planned = buildPlatformPlan("universal", {
    platformItemOverrides: [{ slotKey: "universal:target-shopper-resonance", prompt: "User-edited benefit prompt." }],
  });
  const benefit = planned.items.find((item) => item.imageType === "target-shopper-resonance");
  assert.equal(benefit.prompt, "User-edited benefit prompt.");

  const legacyOverridden = applyCreationPlanOverrides(planned, [{ itemId: benefit.itemId, prompt: "Legacy preview override." }]);
  assert.equal(legacyOverridden.items.find((item) => item.itemId === benefit.itemId).prompt, "Legacy preview override.");
  assert.equal(legacyOverridden.carouselImageCount, planned.carouselImageCount);
});

test("planner keeps disabled carousel slots available for browser re-enablement", () => {
  const plan = buildPlatformPlan("universal", {
    platformItemOverrides: [{ slotKey: "universal:target-shopper-resonance", enabled: false }],
  });
  const disabledSlot = plan.slots.find((slot) => slot.slotKey === "universal:target-shopper-resonance");

  assert.equal(plan.slots.length, 18);
  assert.equal(plan.carouselImageCount, 17);
  assert.equal(disabledSlot?.enabled, false);
  assert.equal(plan.items.some((item) => item.slotKey === disabledSlot.slotKey), false);
});

test("planner keeps all 18 universal image types visible when five are requested", () => {
  const plan = buildPlatformPlan("universal", { imageCount: 5 });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(plan.slots.length, 18);
  assert.equal(plan.slots.filter((slot) => slot.enabled !== false).length, 5);
  assert.ok(plan.slots.slice(5).every((slot) => slot.enabled === false));
  assert.equal(carouselItems.length, 5);
  assert.equal(plan.carouselImageCount, 5);
  assert.equal(plan.imageCount, 5);
});

test("planner preserves an unknown requested platform and exposes the universal fallback warning", () => {
  const plan = buildPlatformPlan("future-market");

  assert.equal(plan.requestedPlatform, "future-market");
  assert.equal(plan.platform, "universal");
  assert.ok(plan.warnings.some((warning) => warning.code === "unknown-platform"));
});

test("universal 18-image set replaces overlapping information images with scene-fit images", () => {
  const universal = buildPlatformPlan("universal", { imageCount: 18 });
  const universalRoles = universal.items.filter((item) => item.itemKind === "carousel").map((item) => item.role);

  assert.equal(universalRoles.length, 18);
  for (const role of ["scene-fit-1", "scene-fit-2", "scene-fit-3"]) assert.ok(universalRoles.includes(role), role);
  assert.equal(universalRoles.filter((role) => role === "spec-table").length, 1);
  for (const role of ["craft-process", "ingredient-material"]) assert.ok(!universalRoles.includes(role), role);
  assert.equal(new Set(universalRoles).size, 18);
});

test("scene-fit items are each assigned a different supplied scene", () => {
  const plan = buildCreationPlan({
    productName: "便携急救包",
    productDescription: "防水材质，适用户外露营、车内、办公室",
    imageCount: 18,
  });
  const prompts = ["scene-fit-1", "scene-fit-2", "scene-fit-3"].map(
    (role) => plan.items.find((item) => item.role === role).prompt,
  );

  assert.match(prompts[0], /Setting: 适用户外露营/);
  assert.match(prompts[1], /Setting: 车内/);
  assert.match(prompts[2], /Setting: 办公室/);

  const fallback = buildCreationPlan({ productName: "Ceramic mug", imageCount: 18 });
  const fallbackPrompts = ["scene-fit-1", "scene-fit-2", "scene-fit-3"].map(
    (role) => fallback.items.find((item) => item.role === role).prompt.match(/Setting: [^.]+/)[0],
  );
  assert.equal(new Set(fallbackPrompts).size, 3);
});

test("only the scene role copies a scene reference as a blueprint and scene-fit items stay distinct", () => {
  const plan = buildCreationPlan({
    productName: "Jointed swimbait lure",
    imageCount: 18,
    referenceImageRoles: [
      { index: 1, filename: "lure.png", role: "product", note: "Lure product subject" },
      { index: 2, filename: "boat.jpg", role: "scene", note: "Angler on a boat holding a fish" },
    ],
  });
  const byRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(byRole.scene, /Scene source boat\.jpg is a visual blueprint/);
  assert.match(byRole.atmosphere, /Scene source boat\.jpg is setting context: keep its kind of environment and activity, and create a new person/);
  for (const role of ["human-handheld", "human-wearable"]) {
    assert.doesNotMatch(byRole[role], /boat\.jpg/, role);
  }
  // The per-role "Shot:" sentence is gone; the scene-fit slots stay distinguishable through the
  // ordinal intent in their own directive and through the distinct scene assignment each receives.
  const sceneFitPrompts = ["scene-fit-1", "scene-fit-2", "scene-fit-3"].map((role) => byRole[role]);
  assert.match(sceneFitPrompts[0], /for the product's primary setting/i);
  assert.match(sceneFitPrompts[1], /for a second distinct setting/i);
  assert.match(sceneFitPrompts[2], /for a third distinct setting/i);
  for (const role of ["scene-fit-1", "scene-fit-2", "scene-fit-3"]) {
    assert.doesNotMatch(byRole[role], /boat\.jpg/, role);
  }
  assert.ok(plan.items.every((item) => !item.prompt.includes("围绕商品核心价值提炼短卖点")));
});

test("pain-point image is a photographic before-and-after comparison", () => {
  const plan = buildCreationPlan({ productName: "Jointed swimbait lure", selectedRoles: ["after-sales"] });

  const prompt = plan.items[0].prompt;
  // Two panels of one buyer situation, and the product itself is unchanged in the "after" panel.
  assert.match(prompt, /photographic before-and-after pain-point comparison/i);
  assert.match(prompt, /two panels of the same buyer situation, before and after/i);
  assert.match(prompt, /product clearly visible and unchanged in the second/i);
});

test("universal set gives every carousel item a distinct visual format and person-led items distinct casts", () => {
  const plan = buildCreationPlan({ productName: "Ceramic pour-over coffee dripper", imageCount: 18 });
  const carousel = plan.items.filter((item) => item.itemKind === "carousel");
  const formats = carousel.map((item) => (item.prompt.match(/Visual format: [^.]+\./) || [""])[0]);

  assert.ok(formats.every(Boolean), "every item declares a visual format");
  assert.equal(new Set(formats).size, carousel.length);

  const personLedRoles = ["benefit", "atmosphere", "human-handheld", "human-wearable", "after-sales"];
  const personLedPrompts = personLedRoles.map((role) => {
    const prompt = carousel.find((item) => item.role === role).prompt;
    assert.doesNotMatch(prompt, /\b(?:woman|man|male|female|girl|boy|\d0s|late teens|20s|30s|40s|50s|60s)\b/i);
    return prompt;
  });
  assert.ok(personLedPrompts.every((prompt) => /face outside the crop|no face required|hands lead the frame|relevant body area/i.test(prompt)));

  const wearable = carousel.find((item) => item.role === "human-wearable").prompt;
  // The wearable directive still carries the non-wearable fallback instead of leaving the slot empty.
  assert.match(wearable, /if it is not wearable, show it packed or stored/i);
});

test("each supporting reference feeds at most two universal carousel items", () => {
  const referenceImageRoles = [
    { index: 1, filename: "product.png", role: "product", note: "Product subject" },
    { index: 2, filename: "feature.png", role: "feature", note: "Feature callouts" },
    { index: 3, filename: "material.png", role: "material", note: "Material detail" },
    { index: 4, filename: "scene.png", role: "scene", note: "Person using it outdoors" },
    { index: 5, filename: "usage.png", role: "usage", note: "Setup steps" },
    { index: 6, filename: "size.png", role: "dimensions", note: "Length 14cm" },
    { index: 7, filename: "box.png", role: "package", note: "Included items" },
  ];
  const plan = buildCreationPlan({ productName: "Travel kettle", imageCount: 18, referenceImageRoles });
  const images = referenceImageRoles.map((entry) => ({ originalname: entry.filename, name: entry.filename, size: 1000, buffer: Buffer.alloc(4) }));
  const counts = new Map();
  for (const item of plan.items.filter((entry) => entry.itemKind === "carousel")) {
    for (const image of creationReferenceLabels.buildCreationItemReferenceImages(item, images, referenceImageRoles)) {
      counts.set(image.originalname, (counts.get(image.originalname) || 0) + 1);
    }
  }
  counts.delete("product.png");
  for (const [name, count] of counts) assert.ok(count <= 2, `${name} used ${count} times`);
});

test("five SKUs all reach the SKU choice image and each SKU image keeps its own subject", () => {
  const colors = ["gold", "green", "red", "purple", "blue"];
  const referenceImageRoles = colors.map((color, index) => ({ index: index + 1, filename: `${color}.png`, role: "product", note: `${color} lure` }));
  const skuSubjects = colors.map((color, index) => ({ id: color, title: color, filenames: [`${color}.png`], referenceIndexes: [index + 1] }));
  const plan = buildCreationPlan({ productName: "Swimbait lure", imageCount: 18, referenceImageRoles, skuSubjects });
  const images = referenceImageRoles.map((entry) => ({ originalname: entry.filename, name: entry.filename, size: 1000, buffer: Buffer.alloc(4) }));
  const namesFor = (item) => creationReferenceLabels.buildCreationItemReferenceImages(item, images, referenceImageRoles).map((image) => image.originalname);

  assert.deepEqual(namesFor(plan.items.find((item) => item.role === "series-showcase")).sort(), colors.map((color) => `${color}.png`).sort());
  const skuItems = plan.items.filter((item) => item.role === "sku");
  assert.equal(skuItems.length, 5);
  skuItems.forEach((item, index) => assert.equal(namesFor(item)[0], `${colors[index]}.png`));
});

test("scene and persona items carry a concrete setting while every item anchors the product first", () => {
  const plan = buildCreationPlan({ productName: "Ceramic pour-over coffee dripper", imageCount: 18 });
  const sceneLedRoles = new Set([
    "scene",
    "scene-fit-1",
    "scene-fit-2",
    "scene-fit-3",
    "atmosphere",
    "human-handheld",
    "human-wearable",
    "brand-story",
  ]);
  for (const item of plan.items.filter((entry) => entry.itemKind === "carousel")) {
    // The product-first anchor opens every prompt.
    assert.match(item.prompt, /^PRODUCT FIDELITY:/, item.role);
    // The removed Creative range / Look / Shot paragraphs must stay removed.
    assert.doesNotMatch(item.prompt, /Creative range|Look: |Shot: /, item.role);
    // Scene-led roles get a concrete setting cue; studio and information roles do not.
    const hasSettingCue = /Situation: |Setting: /.test(item.prompt);
    assert.equal(hasSettingCue, sceneLedRoles.has(item.role), item.role);
  }
  const fallback = plan.items.find((item) => item.role === "scene-fit-2").prompt;
  assert.match(fallback, /Setting: a second real setting implied by this product's function or buyer/);
});
