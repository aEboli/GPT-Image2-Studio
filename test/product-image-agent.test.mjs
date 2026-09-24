import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PRODUCT_IMAGE_AGENT_JSON_SCHEMA,
  PRODUCT_IMAGE_AGENT_MODE,
  buildPromptAgentInput,
  extractPromptAgentJson,
} from "../lib/prompt-agent.mjs";

const indexPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const viewPath = new URL("../public/lib/views/product-agent-view.mjs", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);

test("product image agent schema requires bilingual image plans and marketing evidence", () => {
  assert.equal(PRODUCT_IMAGE_AGENT_MODE, "product-image-agent");
  assert.deepEqual(PRODUCT_IMAGE_AGENT_JSON_SCHEMA.required, [
    "product_summary",
    "pain_points",
    "selling_points",
    "target_audiences",
    "usage_scenarios",
    "image_plans",
    "risks",
  ]);
  const plan = PRODUCT_IMAGE_AGENT_JSON_SCHEMA.properties.image_plans.items;
  assert.deepEqual(plan.required, [
    "id",
    "title",
    "purpose",
    "marketing_angle",
    "reference_image_indexes",
    "aspect_ratio",
    "prompt_en",
    "prompt_zh",
    "avoid_en",
    "avoid_zh",
  ]);
  assert.match(plan.properties.prompt_en.description, /纯英文/);
  assert.match(plan.properties.prompt_en.description, /商品之外的可见文案必须用拉丁字母写英文/);
});

test("product image agent request includes user context and bilingual prompt constraints", () => {
  const input = buildPromptAgentInput({
    mode: PRODUCT_IMAGE_AGENT_MODE,
    contextPrompt: "Focus on commuter use and waterproof storage.",
    images: [{ filename: "product.png", mimeType: "image/png", base64: "aGVsbG8=" }],
  });
  const text = input[0].content.filter((part) => part.type === "input_text").map((part) => part.text).join("\n");
  assert.match(text, /prompt_en/);
  assert.match(text, /纯英文/);
  assert.match(text, /所有新增文案都必须使用英文和拉丁字母/);
  assert.match(text, /Focus on commuter use/);
});

test("product image agent response accepts its marketing plan schema without a legacy prompt field", () => {
  const payload = {
    product_summary: {
      product_type: "first aid kit",
      visible_facts: ["red carry bag"],
      differentiation: ["compact organization"],
    },
    pain_points: ["supplies are difficult to organize"],
    selling_points: ["portable storage"],
    target_audiences: ["drivers and families"],
    usage_scenarios: ["kept in a car for emergencies"],
    image_plans: [
      {
        id: "plan-01",
        title: "Hero product image",
        purpose: "show the complete product",
        marketing_angle: "organized and portable",
        reference_image_indexes: [1],
        aspect_ratio: "1:1",
        prompt_en: "A compact red first aid kit on a clean white background.",
        prompt_zh: "一款紧凑的红色急救包置于干净的白色背景上。",
        avoid_en: ["extra products"],
        avoid_zh: ["额外商品"],
      },
    ],
    risks: [],
  };

  const normalized = extractPromptAgentJson(JSON.stringify(payload), "", PRODUCT_IMAGE_AGENT_MODE);
  assert.deepEqual(normalized, payload);
});

test("product image agent view and server mode are exposed", async () => {
  const [html, app, view, server] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(viewPath, "utf8"),
    readFile(serverPath, "utf8"),
  ]);
  assert.match(html, /data-view-panel="product-agent"/);
  assert.match(html, /href="#product-agent"/);
  assert.match(html, /图片裂变工作台/);
  assert.match(html, /id="productAgentSpaceOptions"/);
  assert.match(html, /id="productAgentChannelOptions"/);
  assert.match(html, /id="productAgentDirectionOptions"/);
  assert.match(html, /id="productAgentPlanList"/);
  assert.match(app, /appendCurrentConfigToFormData,\n\s+getSelectedImageGenerationConfig/);
  assert.match(view, /appendCurrentConfig\(formData\);[\s\S]*fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(view, /referenceFiles\.forEach\(\(file\) => formData\.append\("referenceImages", file\)\);[\s\S]*appendCurrentConfig\(formData\);[\s\S]*requestGenerationStream/);
  assert.match(view, /options\.appendCurrentConfigToFormData/);
  assert.match(view, /buildTasks\(\)/);
  assert.match(view, /VISIBLE CANVAS TEXT: All text outside product\/packaging is English in Latin letters/);
  assert.match(view, /never copy non-Latin glyphs/);
  assert.match(view, /MAX_TASKS/);
  assert.match(html, /决定图片用在哪里/);
  assert.match(html, /1 · 用途｜图片用在哪里/);
  assert.match(html, /2 · 渠道｜图片发到哪里/);
  assert.match(html, /3 · 方向｜画面重点是什么/);
  assert.match(view, /商品列表、详情页、卖点图/);
  assert.match(view, /列表主图与详情图/);
  assert.match(server, /PRODUCT_IMAGE_AGENT_MODE/);
  assert.match(server, /mode === PRODUCT_IMAGE_AGENT_MODE[\s\S]*getSelectedTextVisionConfig/);
});
