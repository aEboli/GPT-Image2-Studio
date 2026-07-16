import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { handleApiRequest } from "../cloudflare-pages-worker.mjs";
import {
  MAX_CREATION_EFFECTIVE_PLAN_BYTES,
  assertCreationPlanCanGenerate,
  buildCreationPlan,
  buildCreationSubmittedPlan,
} from "../lib/creation-planner.mjs";
import {
  buildCreationItemGenerationPrompt,
  resolveCreationItemGenerationParameters,
} from "../lib/creation-generation-parameters.mjs";

const serverPath = fileURLToPath(new URL("../server.mjs", import.meta.url));
const workerPath = fileURLToPath(new URL("../cloudflare-pages-worker.mjs", import.meta.url));

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

function toFormData(input) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input)) {
    formData.set(key, value);
  }
  return formData;
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

test("local planner and Worker endpoint produce deeply equivalent plans for one normalized payload", async () => {
  const input = normalizedPlatformInput();
  const localPlan = buildCreationPlan(input);
  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: toFormData(input) }),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.plan, localPlan);
  assert.equal(payload.plan.effectiveAudienceStrategy.source, "user");
  assert.ok(payload.plan.items.every((item) => item.conversionIntent?.conversionGoal));
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

test("Local and Worker persist the outer server-validated Creation plan", async () => {
  const [server, worker] = await Promise.all([readFile(serverPath, "utf8"), readFile(workerPath, "utf8")]);
  for (const source of [server, worker]) {
    assert.match(source, /effectivePlan:\s*plan,/);
    assert.doesNotMatch(source, /effectivePlan:\s*plan\.effectivePlan\s*\|\|\s*plan/);
  }
});

test("local and Worker Creation loops resolve and expose parameters inside each item callback", async () => {
  const [server, worker] = await Promise.all([readFile(serverPath, "utf8"), readFile(workerPath, "utf8")]);
  const local = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationLogoBatchGenerate/)?.[0] || "";
  const cloud = worker.match(/async function runCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function runCreationLogoBatchGenerate/)?.[0] || "";

  for (const source of [local, cloud]) {
    const callback = source.match(/runWithConcurrency\(plan\.items[\s\S]*?async \(item\) => \{[\s\S]*/)?.[0] || "";
    assert.match(callback, /resolveCreationItemGenerationParameters\(item,/);
    assert.match(callback, /buildCreationItemGenerationPrompt\(item\.prompt, itemGenerationParameters\)/);
    assert.match(callback, /aspectRatio:\s*itemGenerationParameters\.ratioOption\.value/);
    assert.match(callback, /size:\s*itemGenerationParameters\.finalSize/);
    assert.match(callback, /targetLanguage:\s*itemGenerationParameters\.targetLanguage/);
    assert.match(callback, /effectiveSize:\s*savedSize/);
    assert.match(callback, /item_started[\s\S]*ratio:/);
    assert.match(callback, /item_status[\s\S]*ratio:/);
    assert.match(callback, /item_final_image[\s\S]*ratio:/);
    assert.match(callback, /catch \(error\)[\s\S]*item_failed/);
  }
});
