import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCreationPromptSourceSegments,
  translateCreationPlanPrompts,
} from "../lib/creation-prompt-translation.mjs";

test("creation prompt translation extracts Chinese segments with embedded numbers and codes", () => {
  const segments = extractCreationPromptSourceSegments(
    "Product: 三节鱼形路亚饵. Reference coverage: a.png (dimensions / specs): 保留长度14.5厘米、钩号4号及“下沉”属性; b.png (product / subject): 用于主图识别及SKU对比。",
  );

  assert.deepEqual(segments, [
    "三节鱼形路亚饵",
    "保留长度14.5厘米、钩号4号及“下沉”属性",
    "用于主图识别及SKU对比。",
  ]);
});

function createFetch(calls, translate) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const segments = JSON.parse(body.input.split("\n").at(-1));
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ translations: segments.map((source) => ({ source, target: translate(source) })) }),
    }), { status: 200 });
  };
}

test("creation prompt translation replaces Chinese segments in non-Chinese items only", async () => {
  const calls = [];
  const plan = {
    targetLanguage: "en",
    items: [
      { itemId: "a", role: "hero", prompt: "Create a hero. Product: 三节鱼形路亚饵." },
      { itemId: "b", role: "scene", targetLanguage: "zh-CN", prompt: "Product: 三节鱼形路亚饵." },
      { itemId: "c", role: "infographic-rebuild", prompt: "INFOGRAPHIC REBUILD: 原图." },
    ],
  };

  const result = await translateCreationPlanPrompts(plan, {
    config: { baseUrl: "https://example.test/v1", endpointPath: "/responses", apiKey: "key", responsesModel: "m" },
    fetchImpl: createFetch(calls, () => "three-section fish lure"),
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].body.input, /into English/);
  assert.equal(result.warning, "");
  assert.equal(result.translatedCount, 1);
  assert.equal(result.plan.items[0].prompt, "Create a hero. Product: three-section fish lure.");
  assert.equal(result.plan.items[1].prompt, plan.items[1].prompt);
  assert.equal(result.plan.items[2].prompt, plan.items[2].prompt);
});

test("creation prompt translation keeps original prompts and reports a warning when it cannot translate", async () => {
  const plan = { targetLanguage: "en", items: [{ itemId: "a", role: "hero", prompt: "Product: 路亚饵." }] };

  const missingKey = await translateCreationPlanPrompts(plan, { config: {} });
  assert.equal(missingKey.plan, plan);
  assert.match(missingKey.warning, /未配置文本模型/);

  const failed = await translateCreationPlanPrompts(plan, {
    config: { baseUrl: "https://example.test/v1", apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 }),
  });
  assert.equal(failed.plan, plan);
  assert.match(failed.warning, /提示词翻译失败.*boom/);

  const chineseOutput = await translateCreationPlanPrompts(plan, {
    config: { baseUrl: "https://example.test/v1", apiKey: "key" },
    fetchImpl: createFetch([], (source) => source),
  });
  assert.equal(chineseOutput.plan.items[0].prompt, plan.items[0].prompt);
});

test("creation prompt translation skips Chinese target sets without a request", async () => {
  let called = false;
  const plan = { targetLanguage: "zh-CN", items: [{ itemId: "a", role: "hero", prompt: "Product: 路亚饵." }] };
  const result = await translateCreationPlanPrompts(plan, {
    config: { apiKey: "key" },
    fetchImpl: async () => {
      called = true;
    },
  });

  assert.equal(called, false);
  assert.equal(result.plan, plan);
  assert.equal(result.warning, "");
});
