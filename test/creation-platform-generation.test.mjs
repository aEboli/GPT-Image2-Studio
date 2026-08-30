import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CREATION_EFFECTIVE_PLAN_BYTES,
  assertCreationPlanCanGenerate,
  buildCreationPlan,
  buildCreationSubmittedPlan,
} from "../lib/creation-planner.mjs";
import {
  buildCreationInfographicRebuildPrompt,
  buildCreationItemGenerationPrompt,
  resolveCreationItemGenerationParameters,
} from "../lib/creation-generation-parameters.mjs";

function normalizedPlatformInput() {
  return {
    productName: "Trail Bottle",
    productDescription: "Insulated bottle with a supplied carry loop",
    sellingPoints: JSON.stringify(["keeps drinks cool", "leak resistant"]),
    platform: "xiaohongshu",
    industryTemplate: "outdoor",
    platformSetOverrides: JSON.stringify({ imageCount: 4 }),
    audienceStrategy: JSON.stringify({
      targetAudience: "需要户外补水的通勤与轻徒步使用者",
      purchaseMotivations: ["便携补水"],
      purchaseObjections: ["担心携带时洒漏"],
      desiredOutcome: "在移动场景中放心携带饮品",
      evidenceBasis: ["supplied carry loop", "leak resistant"],
      confidence: "high",
      source: "user",
    }),
    platformItemOverrides: JSON.stringify([
      { slotKey: "xiaohongshu:cover", ratio: "1:1", resolutionTier: "2K", targetLanguage: "zh-CN" },
      { slotKey: "xiaohongshu:lifestyle", ratio: "4:5", resolutionTier: "1.5K", targetLanguage: "en" },
    ]),
    infographicRebuildEnabled: "false",
  };
}

test("mixed square and portrait items resolve independent effective request parameters", () => {
  const square = resolveCreationItemGenerationParameters(
    { ratio: "1:1", resolutionTier: "2K", targetLanguage: "zh-CN" },
    { imageRoute: "a" },
  );
  const portrait = resolveCreationItemGenerationParameters(
    { ratio: "4:5", resolutionTier: "1.5K", targetLanguage: "en" },
    { imageRoute: "a" },
  );

  assert.deepEqual(
    { ratio: square.ratioOption.value, requestedSize: square.requestedSize, finalSize: square.finalSize, language: square.targetLanguage },
    { ratio: "1:1", requestedSize: "2K", finalSize: "2048x2048", language: "zh-CN" },
  );
  assert.deepEqual(
    { ratio: portrait.ratioOption.value, requestedSize: portrait.requestedSize, finalSize: portrait.finalSize, language: portrait.targetLanguage },
    { ratio: "4:5", requestedSize: "1.5K", finalSize: "1536x1920", language: "en" },
  );
});

test("an unsupported effective size falls back to the nearest supported size with the same ratio", () => {
  const parameters = resolveCreationItemGenerationParameters(
    { ratio: "4:5", resolutionTier: "1.5K", effectiveSize: "1600x2000", targetLanguage: "en" },
    { imageRoute: "a" },
  );

  assert.equal(parameters.requestedSize, "1600x2000");
  assert.equal(parameters.finalSize, "1536x1920");
  assert.equal(parameters.usedFallback, true);
});

test("per-item generation prompt carries matching ratio and target-language guidance", () => {
  const parameters = resolveCreationItemGenerationParameters(
    { ratio: "4:5", resolutionTier: "1.5K", targetLanguage: "en" },
    { imageRoute: "a" },
  );
  const prompt = buildCreationItemGenerationPrompt("Create a lifestyle product image.", parameters);

  assert.match(prompt, /4:5/);
  assert.match(prompt, /target language: en/i);
});

test("ordinary runtime prompts protect subject graphics, original text, and language for current and historical plans", () => {
  const historicalItem = {
    role: "hero",
    prompt: "Historical frozen prompt that asks for concise English marketing copy.",
    ratio: "1:1",
    resolutionTier: "1K",
    targetLanguage: "en",
  };
  const historicalParameters = resolveCreationItemGenerationParameters(historicalItem, { imageRoute: "a" });
  const historicalPrompt = buildCreationItemGenerationPrompt(
    historicalItem.prompt,
    historicalParameters,
    historicalItem,
  );

  assert.match(historicalPrompt, /SUBJECT CONTENT LOCK:/);
  assert.match(historicalPrompt, /patterns, artwork, illustrations, symbols/i);
  assert.match(historicalPrompt, /exact characters, spelling, writing system, and original language/i);
  assert.match(historicalPrompt, /OUTPUT LANGUAGE BOUNDARY:/);
  assert.match(historicalPrompt, /newly authored wording outside the physical product or packaging subject, only that separate wording follows the selected language/i);

  const currentItem = buildCreationPlan({
    productName: "Cooling patch package",
    productDescription: "A supplied retail package with Japanese artwork and printed text.",
    sellingPoints: "cooling sensation",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [{ filename: "package.png", role: "product" }],
  }).items[0];
  const currentParameters = resolveCreationItemGenerationParameters(currentItem, { imageRoute: "a" });
  const currentPrompt = buildCreationItemGenerationPrompt(currentItem.prompt, currentParameters, currentItem);

  assert.equal([...currentPrompt.matchAll(/SUBJECT CONTENT LOCK:/g)].length, 1);
  assert.equal([...currentPrompt.matchAll(/SUBJECT IDENTITY LOCK:/g)].length, 1);

  const noTextItem = { ...historicalItem, textPolicy: "none" };
  const noTextPrompt = buildCreationItemGenerationPrompt(
    noTextItem.prompt,
    resolveCreationItemGenerationParameters(noTextItem, { imageRoute: "a" }),
    noTextItem,
  );
  assert.match(noTextPrompt, /SUBJECT CONTENT LOCK:/);
  assert.match(noTextPrompt, /SUBJECT IDENTITY LOCK:/);
  assert.doesNotMatch(noTextPrompt, /Newly added marketing copy target language:/i);
});

test("runtime subject locks are independently completed without duplicating explicit locks", () => {
  const parameters = resolveCreationItemGenerationParameters(
    { ratio: "1:1", resolutionTier: "1K", targetLanguage: "en" },
    { imageRoute: "a" },
  );
  const count = (prompt, pattern) => [...prompt.matchAll(pattern)].length;

  const contentOnly = buildCreationItemGenerationPrompt(
    "Create a product image.\nSUBJECT CONTENT LOCK: frozen content guidance.",
    parameters,
  );
  assert.equal(count(contentOnly, /SUBJECT CONTENT LOCK:/g), 1);
  assert.equal(count(contentOnly, /SUBJECT IDENTITY LOCK:/g), 1);

  const identityOnly = buildCreationItemGenerationPrompt(
    "Create a product image.\nSUBJECT IDENTITY LOCK: frozen identity guidance.",
    parameters,
  );
  assert.equal(count(identityOnly, /SUBJECT CONTENT LOCK:/g), 1);
  assert.equal(count(identityOnly, /SUBJECT IDENTITY LOCK:/g), 1);

  const both = buildCreationItemGenerationPrompt(
    "Create a product image.\nSUBJECT IDENTITY LOCK: frozen identity guidance.\nSUBJECT CONTENT LOCK: frozen content guidance.",
    parameters,
  );
  assert.equal(count(both, /SUBJECT CONTENT LOCK:/g), 1);
  assert.equal(count(both, /SUBJECT IDENTITY LOCK:/g), 1);

  const legacyContent = buildCreationItemGenerationPrompt(
    "Create a product image.\nSubject content: keep the package artwork unchanged.",
    parameters,
  );
  assert.equal(count(legacyContent, /SUBJECT CONTENT LOCK:/g), 1);
  assert.equal(count(legacyContent, /SUBJECT IDENTITY LOCK:/g), 1);
  assert.match(legacyContent, /Subject content: keep the package artwork unchanged\./);
});

test("infographic rebuild runtime prompt honors only the four selected output controls", () => {
  const item = {
    role: "infographic-rebuild",
    prompt: "OTHER_FROZEN_PROMPT_SENTINEL with suite facts, source notes, and platform styling.",
    ratio: "4:5",
    resolutionTier: "1.5K",
    targetLanguage: "en",
  };
  const parameters = resolveCreationItemGenerationParameters(item, {
    imageRoute: "a",
    fallbackRatio: "1:1",
    fallbackSize: "1024x1024",
    fallbackTargetLanguage: "zh-CN",
    fallbackFormat: "jpg",
  });
  const prompt = buildCreationItemGenerationPrompt(item.prompt, parameters, item);

  assert.equal(prompt, buildCreationInfographicRebuildPrompt({
    targetLanguage: "en",
    ratio: "4:5",
    requestedSize: "1.5K",
    effectiveSize: "1536x1920",
    format: "jpg",
  }));
  assert.match(prompt, /target language:\s*English \(en\)/i);
  assert.match(prompt, /output format:\s*JPG/i);
  assert.match(prompt, /resolution:\s*requested 1\.5K; effective canvas 1536x1920/i);
  assert.match(prompt, /aspect ratio:\s*4:5/i);
  assert.doesNotMatch(prompt, /OTHER_FROZEN_PROMPT_SENTINEL/);
  assert.doesNotMatch(prompt, /SUBJECT CONTENT LOCK:/);
  assert.doesNotMatch(prompt, /SUBJECT IDENTITY LOCK:/);
  assert.deepEqual(
    {
      ratio: parameters.ratioOption.value,
      requestedSize: parameters.requestedSize,
      finalSize: parameters.finalSize,
      targetLanguage: parameters.targetLanguage,
      format: parameters.format,
    },
    {
      ratio: "4:5",
      requestedSize: "1.5K",
      finalSize: "1536x1920",
      targetLanguage: "en",
      format: "jpg",
    },
  );
});

test("infographic rebuild prompt requires substantial visual redesign while locking source facts", () => {
  const prompt = buildCreationInfographicRebuildPrompt();

  assert.match(prompt, /clearly new, professionally designed infographic/i);
  assert.match(prompt, /substantially redesigned at first glance/i);
  assert.match(prompt, /new overall layout and information architecture/i);
  assert.match(prompt, /at least three additional visual dimensions/i);
  assert.match(prompt, /composition and product placement/i);
  assert.match(prompt, /background treatment/i);
  assert.match(prompt, /typography system/i);
  assert.match(prompt, /color treatment/i);
  assert.match(prompt, /spacing and grouping/i);
  assert.match(prompt, /cards, icons, arrows, callouts/i);
  assert.match(prompt, /not a valid rebuild if it keeps substantially the same grid/i);
  assert.match(prompt, /only upscales, cleans, or sharpens/i);
  assert.match(prompt, /minor spacing, color, or typography changes/i);

  assert.match(prompt, /single attached source infographic/i);
  assert.match(prompt, /only visual and information authority/i);
  assert.match(prompt, /exact visible product identity, variant, product colors, parts, and quantities/i);
  assert.match(prompt, /render every translatable visible text string completely in the selected target language/i);
  assert.match(prompt, /brand names, model names, numbers, units/i);
  assert.match(prompt, /numbers, units, parameters, claims, steps, and lists exactly/i);
  assert.match(prompt, /do not summarize, omit, add, invent, replace, or contradict/i);

  assert.doesNotMatch(prompt, /preserve every visible element unchanged/i);
  assert.doesNotMatch(prompt, /do not .*redesign or restyle/i);
  assert.doesNotMatch(prompt, /extend only the existing background or margins/i);
});

test("creation planning keeps unsafe analysis personas and unsupported claims out of prompts", () => {
  const plan = buildCreationPlan({ productName: "Plain Bottle", platform: "amazon", audienceStrategy: { targetAudience: "Black buyers age 25-34", purchaseMotivations: ["FDA certified health effects", "$19.99 lowest price", "3x faster", "4.9/5 stars", "over 1 million sold", "销量第一"], purchaseObjections: ["patients with diabetes", "Chinese consumers"], desiredOutcome: "clinically proven treatment", evidenceBasis: [], confidence: "high", source: "analysis-suggestion" } });
  const promptText = plan.items.map((item) => item.prompt).join("\n");
  assert.equal(plan.effectiveAudienceStrategy.targetAudience, "buyers evaluating this product category");
  assert.equal(plan.effectiveAudienceStrategy.confidence, "low");
  assert.doesNotMatch(promptText, /Black buyers|25-34|Chinese consumers|FDA certified|\$19\.99|3x faster|4\.9\/5|million sold|销量第一|diabetes|clinically proven treatment/i);
});

test("submitted effective plans are bounded, normalized, recounted, and hard-rule revalidated", () => {
  const input = normalizedPlatformInput();
  const preview = buildCreationPlan(input);
  const submitted = buildCreationSubmittedPlan({
    ...input,
    effectivePlan: JSON.stringify({
      ...preview,
      canGenerate: false,
      carouselImageCount: 999,
      totalPlannedItemCount: 999,
    }),
  });

  assert.equal(submitted.canGenerate, true);
  assert.equal(submitted.carouselImageCount, submitted.items.filter((item) => item.itemKind === "carousel").length);
  assert.equal(submitted.totalPlannedItemCount, submitted.items.length);
  assert.deepEqual(submitted.items.map((item) => item.prompt), preview.items.map((item) => item.prompt));

  const amazon = buildCreationPlan({ productName: "Bottle", platform: "amazon" });
  const tamperedItems = amazon.items.map((item, index) => index === 0
    ? { ...item, textPolicy: "moderate", prompt: `${item.prompt} Add visible marketing text.` }
    : item);
  const tampered = buildCreationSubmittedPlan({
    effectivePlan: JSON.stringify({ ...amazon, items: tamperedItems, canGenerate: true, validation: { isValid: true } }),
  });
  assert.throws(() => assertCreationPlanCanGenerate(tampered), /Amazon 主图不得包含营销文字/);

  const imageTypeTampered = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify({ ...amazon, items: amazon.items.map((item, index) => index === 0 ? { ...item, imageType: "generic-hero", constraints: [], scenePolicy: "lifestyle", prompt: `${item.prompt} Create a lifestyle scene with decorative props.` } : item), canGenerate: true, validation: { isValid: true } }) });
  assert.equal(imageTypeTampered.items[0].imageType, "amazon-main");
  assert.throws(() => assertCreationPlanCanGenerate(imageTypeTampered), /纯白棚拍背景|不得使用生活场景/);
  const disabledTampered = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify({ ...amazon, items: amazon.items.map((item, index) => index === 0 ? { ...item, enabled: false, textPolicy: "moderate", prompt: `${item.prompt} Add visible marketing text.` } : item), canGenerate: true, validation: { isValid: true } }) });
  assert.equal(disabledTampered.items[0].enabled, true);
  assert.throws(() => assertCreationPlanCanGenerate(disabledTampered), /Amazon 主图不得包含营销文字/);
  const nestedPlan = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify({ ...amazon, effectivePlan: { ...amazon, items: amazon.items.map((item) => ({ ...item, prompt: "unvalidated nested prompt" })) } }) });
  assert.equal(Object.hasOwn(nestedPlan, "effectivePlan"), false);
  assert.deepEqual(nestedPlan.items.map((item) => item.prompt), amazon.items.map((item) => item.prompt));

  assert.throws(
    () => buildCreationSubmittedPlan({ effectivePlan: "x".repeat(MAX_CREATION_EFFECTIVE_PLAN_BYTES + 1) }),
    /冻结计划.*过大/,
  );
  assert.throws(
    () => buildCreationSubmittedPlan({ effectivePlan: JSON.stringify({ items: [{ itemId: "broken" }] }) }),
    /缺少.*prompt|冻结计划项/,
  );
});

test("submitted zero-carousel infographic rebuild stays source-only under strict platform slots", () => {
  const input = {
    productName: "Bottle",
    platform: "amazon",
    imageCount: "0",
    skuGenerationEnabled: "false",
    infographicRebuildEnabled: "true",
    referenceImageRoles: [
      { index: 1, filename: "product.png", role: "product" },
      { index: 2, filename: "size-card.png", role: "dimensions" },
    ],
  };
  const preview = buildCreationPlan(input);
  const submitted = buildCreationSubmittedPlan({
    ...input,
    effectivePlan: JSON.stringify(preview),
  });

  assert.equal(submitted.items.length, 1);
  assert.equal(submitted.items[0].itemKind, "infographic-rebuild");
  assert.equal(submitted.items[0].role, "infographic-rebuild");
  assert.equal(submitted.items[0].imageType, "infographic-rebuild");
  assert.equal(submitted.items[0].prompt, buildCreationInfographicRebuildPrompt());
  assert.deepEqual(submitted.items[0].sourceInfographic, preview.items[0].sourceInfographic);
});
