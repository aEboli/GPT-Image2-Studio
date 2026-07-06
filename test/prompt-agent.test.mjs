import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CREATION_REFERENCE_ANALYSIS_MODE,
  PORTRAIT_REFERENCE_ANALYSIS_JSON_SCHEMA,
  PORTRAIT_REFERENCE_ANALYSIS_MODE,
  REFERENCE_ORCHESTRATION_JSON_SCHEMA,
  buildPromptAgentInput,
  consumePromptAgentSse,
  createPromptAgentRequestBody,
  extractPromptAgentJson,
  requestPromptAgentAnalysis,
} from "../lib/prompt-agent.mjs";
import { createPromptAgentStore } from "../lib/prompt-agent-store.mjs";
import { MAX_CREATION_REFERENCE_IMAGES } from "../lib/studio-constants.mjs";

const serverPath = new URL("../server.mjs", import.meta.url);
const cloudflareWorkerPath = new URL("../cloudflare-pages-worker.mjs", import.meta.url);

test("server runtimes default prompt-agent image analysis to medium reasoning effort", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  for (const source of [server, worker]) {
    assert.match(source, /const PROMPT_AGENT_ANALYSIS_REASONING_EFFORT = "medium";/);
    assert.match(
      source,
      /mode === REFERENCE_ORCHESTRATION_MODE[\s\S]*\? REFERENCE_ORCHESTRATION_REASONING_EFFORT[\s\S]*: PROMPT_AGENT_ANALYSIS_REASONING_EFFORT/,
    );
    assert.doesNotMatch(
      source,
      /mode === REFERENCE_ORCHESTRATION_MODE[\s\S]*\? REFERENCE_ORCHESTRATION_REASONING_EFFORT[\s\S]*: config\.defaults\?\.reasoningEffort \|\| DEFAULT_REASONING_EFFORT/,
    );
  }
});

test("server runtimes keep reference orchestration analysis on low reasoning effort", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  for (const source of [server, worker]) {
    assert.match(source, /const REFERENCE_ORCHESTRATION_REASONING_EFFORT = "low";/);
    assert.match(
      source,
      /mode === REFERENCE_ORCHESTRATION_MODE[\s\S]*\? REFERENCE_ORCHESTRATION_REASONING_EFFORT[\s\S]*: PROMPT_AGENT_ANALYSIS_REASONING_EFFORT/,
    );
  }
});

test("prompt agent request can analyze portrait person reference images safely", () => {
  const images = [
    {
      filename: "person-front.png",
      mimeType: "image/png",
      base64: "cGVyc29u",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: PORTRAIT_REFERENCE_ANALYSIS_MODE,
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: PORTRAIT_REFERENCE_ANALYSIS_MODE,
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.match(input[0].content[0].text, /portrait task reference analysis/i);
  assert.match(input[0].content[0].text, /visiblePresentation/);
  assert.match(input[0].content[0].text, /Do not infer real age, race, ethnicity, nationality, religion/i);
  assert.match(input[0].content[0].text, /adult status is unclear/i);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "写真人物参考图 1：person-front.png。请按此序号分析这张图的可见人物呈现、姿态、服装、发型和可用于写真生成的参考作用。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,cGVyc29u",
    },
  ]);
  assert.equal(requestBody.text.format.name, "portrait_reference_analysis_json");
  assert.ok(requestBody.text.format.schema.required.includes("visiblePresentation"));
  assert.ok(requestBody.text.format.schema.required.includes("heightImpression"));
  assert.deepEqual(
    requestBody.text.format.schema.properties.visiblePresentation.enum,
    ["masculine-presenting", "feminine-presenting", "androgynous-presenting", "unclear"],
  );
});

test("prompt agent request can label complete portrait task references", () => {
  const images = [
    { filename: "person.png", mimeType: "image/png", base64: "cGVyc29u" },
    { filename: "pose.png", mimeType: "image/png", base64: "cG9zZQ==" },
    { filename: "armor.png", mimeType: "image/png", base64: "YXJtb3I=" },
  ];
  const imageLabels = [
    "Portrait person reference 1 of 1: person.png. Use this for visible person identity and facial/hair/body presentation cues.",
    "Portrait action and pose reference 1 of 1: pose.png. Use this only for pose, gesture, body movement, limb placement, action rhythm, and composition cues; do not treat it as another person identity, outfit, or prop source.",
    "Portrait clothing, prop, and accessory reference 1 of 1: armor.png. Use this only for outfit, fabric, prop, accessory, styling, color, and material cues; do not treat it as another person identity.",
  ];

  const input = buildPromptAgentInput({
    images,
    imageLabels,
    mode: PORTRAIT_REFERENCE_ANALYSIS_MODE,
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    imageLabels,
    mode: PORTRAIT_REFERENCE_ANALYSIS_MODE,
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.deepEqual(
    input[0].content.filter((item) => item.type === "input_text").map((item) => item.text).slice(1),
    imageLabels,
  );
  assert.equal(
    requestBody.input[0].content.filter((item) => item.type === "input_image").length,
    3,
  );
  assert.match(requestBody.input[0].content[3].text, /Portrait action and pose reference 1 of 1/);
  assert.match(requestBody.input[0].content[5].text, /Portrait clothing, prop, and accessory reference 1 of 1/);
});

test("prompt agent normalizes portrait analysis without requiring prompt text", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Visible portrait draft for a person in a navy blazer.",
              visiblePresentation: "feminine-presenting",
              heightImpression: "unclear",
              bodyBuild: "slim",
              pose: "standing three-quarter pose",
              clothing: "navy blazer",
              hair: "short dark hair",
              faceVisibility: "clear frontal face",
              distinctVisibleFeatures: ["round glasses"],
              referenceRoles: ["primary person identity reference"],
              risks: ["adult status not confirmed"],
              safety: "Use neutral portrait styling.",
              confidence: "medium",
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.visiblePresentation, "feminine-presenting");
  assert.equal(result.heightImpression, "unclear");
  assert.equal(result.bodyBuild, "slim");
  assert.equal(result.clothing, "navy blazer");
  assert.deepEqual(result.distinctVisibleFeatures, ["round glasses"]);
  assert.deepEqual(result.referenceRoles, ["primary person identity reference"]);
  assert.equal(result.safety, "Use neutral portrait styling.");
});

test("portrait reference analysis schema only asks for visible low-risk fields", () => {
  const schemaText = JSON.stringify(PORTRAIT_REFERENCE_ANALYSIS_JSON_SCHEMA);

  assert.match(schemaText, /visiblePresentation/);
  assert.match(schemaText, /heightImpression/);
  assert.match(schemaText, /bodyBuild/);
  assert.doesNotMatch(schemaText, /real age|race|ethnicity|nationality|religion|pregnancy|sexual orientation/i);
});

test("prompt agent request analyzes an uploaded image without invoking image generation", () => {
  const image = {
    filename: "sample.png",
    mimeType: "image/png",
    base64: "ZmFrZQ==",
  };

  const input = buildPromptAgentInput({ image });
  const requestBody = createPromptAgentRequestBody({
    image,
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.equal(input[0].role, "user");
  assert.equal(input[0].content[0].type, "input_text");
  assert.match(input[0].content[0].text, /JSON/);
  assert.match(input[0].content[0].text, /反推|逆向|复刻/);
  assert.deepEqual(input[0].content[1], {
    type: "input_text",
    text: "待分析图片 1：sample.png。请按此序号分析这张图片的角色、内容和可融合元素。",
  });
  assert.deepEqual(input[0].content[2], {
    type: "input_image",
    image_url: "data:image/png;base64,ZmFrZQ==",
  });
  assert.equal(requestBody.model, "gpt-5.4");
  assert.equal(requestBody.reasoning.effort, "high");
  assert.equal(requestBody.stream, true);
  assert.equal("tools" in requestBody, false);
  assert.equal("tool_choice" in requestBody, false);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.name, "image_prompt_json");
  assert.equal(requestBody.text.format.strict, true);
  assert.ok(requestBody.text.format.schema.required.includes("prompt"));
});

test("prompt agent request can orchestrate multiple reference images into scene prompts", () => {
  const images = [
    {
      filename: "person.png",
      mimeType: "image/png",
      base64: "cGVyc29u",
    },
    {
      filename: "pants.png",
      mimeType: "image/png",
      base64: "cGFudHM=",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "reference-orchestration",
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: "reference-orchestration",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.match(input[0].content[0].text, /参考图编排/);
  assert.match(input[0].content[0].text, /1\s*到\s*3|1-3/);
  assert.match(input[0].content[0].text, /人物.*服装|主体.*背景|关系/);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "参考图 1：person.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,cGVyc29u",
    },
    {
      type: "input_text",
      text: "参考图 2：pants.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,cGFudHM=",
    },
  ]);
  assert.equal(requestBody.text.format.name, "reference_orchestration_prompt_json");
  assert.equal("tools" in requestBody, false);
  assert.ok(requestBody.text.format.schema.required.includes("prompts"));
});

test("reference orchestration request preserves subject fidelity and non-subject reference boundaries", () => {
  const input = buildPromptAgentInput({
    images: [
      {
        filename: "product-front.png",
        mimeType: "image/png",
        base64: "ZnJvbnQ=",
      },
      {
        filename: "spec-card.png",
        mimeType: "image/png",
        base64: "c3BlYw==",
      },
      {
        filename: "usage-state.png",
        mimeType: "image/png",
        base64: "dXNhZ2U=",
      },
    ],
    mode: "reference-orchestration",
  });

  const instruction = input[0].content[0].text;

  assert.match(instruction, /同一(?:商品|产品|主体).*保持不变|保持.*同一(?:商品|产品|主体)/);
  assert.match(instruction, /不得.*(?:新增|编造).*(?:人|动物|物体)|(?:人|动物|物体).*不存在/);
  assert.match(instruction, /说明图|规格图|局部特写|不同状态图/);
  assert.match(instruction, /只能作为(?:结构|细节|信息).*参考/);
  assert.match(instruction, /(?:不能|不得).*新主体/);
  assert.match(instruction, /(?:不能|不得).*混成同一画面状态/);
});

test("reference orchestration analysis can request English output prompts", () => {
  const images = [
    {
      filename: "product.png",
      mimeType: "image/png",
      base64: "cHJvZHVjdA==",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "reference-orchestration",
    targetLanguage: "en",
    targetLanguageLabel: "English",
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: "reference-orchestration",
    targetLanguage: "en",
    targetLanguageLabel: "English",
    responsesModel: "gpt-5.4",
  });

  assert.match(input[0].content[0].text, /Target output language: English/);
  assert.match(input[0].content[0].text, /All generated scene prompts must be written in English/);
  assert.match(requestBody.input[0].content[0].text, /All visible text, headings, labels, callouts, annotations, and short copy must use English/);
});

test("reference orchestration schema does not hard-code Chinese output language", () => {
  const titleDescription = REFERENCE_ORCHESTRATION_JSON_SCHEMA.properties.title.description;
  const promptDescription = REFERENCE_ORCHESTRATION_JSON_SCHEMA.properties.prompts.items.properties.prompt.description;
  const schemaText = JSON.stringify(REFERENCE_ORCHESTRATION_JSON_SCHEMA);

  assert.match(titleDescription, /目标语言/);
  assert.match(promptDescription, /目标语言/);
  assert.doesNotMatch(schemaText, /完整中文提示词|使用简体中文/);
});

test("prompt agent request can identify ecommerce creation reference roles", () => {
  const images = [
    {
      filename: "front.png",
      mimeType: "image/png",
      base64: "ZnJvbnQ=",
    },
    {
      filename: "texture.png",
      mimeType: "image/png",
      base64: "dGV4dHVyZQ==",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "creation-reference-analysis",
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: "creation-reference-analysis",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.match(input[0].content[0].text, /套图参考图识别/);
  assert.match(input[0].content[0].text, new RegExp(`1 到 ${MAX_CREATION_REFERENCE_IMAGES} 张电商套图参考图`));
  assert.match(input[0].content[0].text, /商品主体|包装清单|结构细节/);
  assert.match(input[0].content[0].text, /四级类目/);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "套图参考图 1：front.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,ZnJvbnQ=",
    },
    {
      type: "input_text",
      text: "套图参考图 2：texture.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,dGV4dHVyZQ==",
    },
  ]);
  assert.equal(requestBody.text.format.name, "creation_reference_analysis_json");
  assert.ok(requestBody.text.format.schema.required.includes("reference_roles"));
  assert.ok(requestBody.text.format.schema.required.includes("sku_subjects"));
  assert.ok(requestBody.text.format.schema.required.includes("product_name"));
  assert.match(input[0].content[0].text, /product_name/i);
  assert.match(input[0].content[0].text, /main sellable product subject/i);
  assert.match(input[0].content[0].text, /put that subject name in product_name/i);
  assert.ok(requestBody.text.format.schema.required.includes("category_hint"));
  assert.ok(requestBody.text.format.schema.required.includes("visual_language"));
  assert.match(requestBody.text.format.schema.properties.product_name.description, /main sellable product subject/i);
  assert.deepEqual(requestBody.text.format.schema.properties.visual_language.enum, ["classic-commercial", "reference-style"]);
  assert.ok(requestBody.text.format.schema.properties.reference_roles.items.properties.role.enum.includes("dimensions"));
  assert.ok(requestBody.text.format.schema.properties.reference_roles.items.properties.role.enum.includes("usage"));
  assert.ok(requestBody.text.format.schema.properties.reference_roles.items.properties.role.enum.includes("reference-product"));
  assert.match(input[0].content[0].text, /reference-product/);
  assert.match(input[0].content[0].text, /参考主体/);
  assert.equal(requestBody.text.format.schema.properties.reference_roles.maxItems, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(requestBody.text.format.schema.properties.reference_roles.items.properties.index.maximum, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(requestBody.text.format.schema.properties.sku_subjects.maxItems, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(
    requestBody.text.format.schema.properties.sku_subjects.items.properties.reference_indexes.items.maximum,
    MAX_CREATION_REFERENCE_IMAGES,
  );
  assert.ok(requestBody.text.format.schema.properties.sku_subjects.items.required.includes("subject_unit_count"));
  assert.equal(requestBody.text.format.schema.properties.sku_subjects.items.properties.subject_unit_count.type, "integer");
  assert.equal(requestBody.text.format.schema.properties.sku_subjects.items.properties.subject_unit_count.minimum, 1);
  assert.match(input[0].content[0].text, /dimensions/);
  assert.match(input[0].content[0].text, /role=dimensions/);
  assert.match(input[0].content[0].text, /role=usage/);
  assert.match(input[0].content[0].text, /充电指南|正负极|使用说明/);
  assert.match(input[0].content[0].text, /role=material/);
  assert.match(input[0].content[0].text, /外观结构|功能卖点|结构表现/);
  assert.match(input[0].content[0].text, /包装清单[\s\S]*即使[\s\S]*尺寸|package[\s\S]*even if[\s\S]*size/i);
  assert.match(input[0].content[0].text, /型号 F4J16、长度 13cm、重量 42g、钩号 2#/);
  assert.match(input[0].content[0].text, /Treat text outside the physical product as non-subject overlay/i);
  assert.match(input[0].content[0].text, /2025 NEW|WHITE EDIT/);
  assert.match(input[0].content[0].text, /If one product-subject reference image contains multiple complete visible product units/i);
  assert.match(input[0].content[0].text, /subject_unit_count/i);
  assert.match(input[0].content[0].text, /keep those units together as one sku_subject/i);
  assert.match(input[0].content[0].text, /do not split them into multiple sku_subjects/i);
  assert.match(input[0].content[0].text, /ordinary white-background SKU\/colorway images[\s\S]*role=product[\s\S]*not role=reference-product/i);
  assert.match(input[0].content[0].text, /reference_roles\[\]\.note[\s\S]*same exact visible product unit count/i);
  assert.match(input[0].content[0].text, /不要写成“单个”或“单一”/);
  assert.match(input[0].content[0].text, /画面为1个完整产品单体/);
  assert.match(requestBody.text.format.schema.properties.reference_roles.items.properties.note.description, /13cm/);
  assert.match(requestBody.text.format.schema.properties.sku_subjects.items.properties.note.description, /visible product unit count/i);
  assert.match(
    requestBody.text.format.schema.properties.sku_subjects.items.properties.subject_unit_count.description,
    /complete visible product units/i,
  );
  assert.match(requestBody.text.format.schema.properties.sku_subjects.items.properties.filenames.description, /same grouped sellable product subject/i);
  assert.match(input[0].content[0].text, /SKU/);
});

test("prompt agent creation reference analysis supports fifteen ordered references", () => {
  const images = Array.from({ length: MAX_CREATION_REFERENCE_IMAGES }, (_, index) => ({
    filename: `creation-ref-${index + 1}.png`,
    mimeType: "image/png",
    base64: Buffer.from(`ref-${index + 1}`).toString("base64"),
  }));
  const input = buildPromptAgentInput({
    images,
    mode: CREATION_REFERENCE_ANALYSIS_MODE,
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: CREATION_REFERENCE_ANALYSIS_MODE,
    responsesModel: "gpt-5.4",
  });
  const result = extractPromptAgentJson(JSON.stringify({
    reference_roles: images.map((image, index) => ({
      index: index + 1,
      filename: image.filename,
      role: "product",
      note: `Product subject ${index + 1}`,
    })),
    sku_subjects: images.map((image, index) => ({
      id: `sku-${index + 1}`,
      title: `SKU ${index + 1}`,
      reference_indexes: [index + 1],
      filenames: [image.filename],
      note: `SKU note ${index + 1}`,
    })),
  }));

  assert.equal(input[0].content.filter((item) => item.type === "input_image").length, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(requestBody.text.format.schema.properties.reference_roles.maxItems, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(requestBody.text.format.schema.properties.sku_subjects.maxItems, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(result.reference_roles.length, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(result.reference_roles.at(-1).index, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(result.reference_roles.at(-1).filename, "creation-ref-15.png");
  assert.equal(result.sku_subjects.length, MAX_CREATION_REFERENCE_IMAGES);
  assert.deepEqual(result.sku_subjects.at(-1).reference_indexes, [MAX_CREATION_REFERENCE_IMAGES]);
});

test("prompt agent normalizes creation reference category hints", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "识别到手机正面和屏幕细节。",
              category_hint: "智能手机",
              category_path: "数码电子 > 手机通讯 > 手机 > 智能手机",
              reference_roles: [{ index: 1, filename: "phone.png", role: "product", note: "手机主体。" }],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.category_hint, "智能手机");
  assert.equal(result.category_path, "数码电子 > 手机通讯 > 手机 > 智能手机");
});

test("prompt agent preserves creation reference product name", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Detected backpack product references.",
              product_name: "双肩背包",
              category_hint: "",
              category_path: "",
              visual_language: "classic-commercial",
              visual_language_reason: "",
              reference_roles: [
                { index: 1, filename: "front.png", role: "product", note: "Backpack product subject." },
              ],
              sku_subjects: [
                {
                  id: "front.png",
                  title: "红色双肩背包",
                  reference_indexes: [1],
                  filenames: ["front.png"],
                  subject_unit_count: 2,
                  note: "Two complete backpack views in one product-subject reference.",
                },
              ],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.product_name, "双肩背包");
});

test("prompt agent fills missing creation product name from SKU subject title", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Detected a sellable lunch bag SKU.",
              product_name: "",
              category_hint: "",
              category_path: "",
              visual_language: "classic-commercial",
              visual_language_reason: "",
              reference_roles: [
                { index: 1, filename: "front.png", role: "product", note: "Lunch bag product subject." },
              ],
              sku_subjects: [
                {
                  id: "front.png",
                  title: "insulated lunch bag",
                  reference_indexes: [1],
                  filenames: ["front.png"],
                  subject_unit_count: 1,
                  note: "One complete sellable product subject.",
                },
              ],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.product_name, "insulated lunch bag");
});

test("prompt agent fills missing creation product name from analyzed subject", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Detected a product-subject reference.",
              product_name: "",
              product_subject: "foldable camping table",
              category_hint: "Camping table",
              category_path: "Sports > Camping > Camp Furniture > Camping Tables",
              visual_language: "classic-commercial",
              visual_language_reason: "",
              reference_roles: [
                { index: 1, filename: "table.png", role: "product", note: "Foldable camping table product subject." },
              ],
              sku_subjects: [],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.product_name, "foldable camping table");
});

test("prompt agent normalizes creation SKU subject groups", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Three white-background product references and one accessory reference.",
              category_hint: "Fishing lure",
              category_path: "Sports > Fishing > Lures > Hard bait",
              reference_roles: [
                { index: 1, filename: "blue.png", role: "product", note: "Blue SKU." },
                { index: 2, filename: "green.png", role: "product", note: "Green SKU." },
                { index: 3, filename: "red.png", role: "product", note: "Red SKU." },
                { index: 4, filename: "hooks.png", role: "package", note: "Accessory pack." },
              ],
              sku_subjects: [
                { id: "blue", title: "Blue lure", reference_indexes: [1], filenames: ["blue.png"], subject_unit_count: 1, note: "Blue sellable subject." },
                { id: "green", title: "Green lure", reference_indexes: [2], filenames: ["green.png"], subject_unit_count: 1, note: "Green sellable subject." },
                { id: "red", title: "Red lure", reference_indexes: [3], filenames: ["red.png"], subject_unit_count: 1, note: "Red sellable subject." },
              ],
              risks: ["Accessory image is not a distinct SKU subject."],
            }),
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    result.sku_subjects.map((subject) => [subject.id, subject.filenames, subject.reference_indexes, subject.subject_unit_count]),
    [
      ["blue", ["blue.png"], [1], 1],
      ["green", ["green.png"], [2], 1],
      ["red", ["red.png"], [3], 1],
    ],
  );
});

test("prompt agent lifts grouped SKU subject unit count from note evidence", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "One white-background SKU reference shows a paired lure subject.",
              category_hint: "Fishing lure",
              category_path: "Sports > Fishing > Lures > Hard bait",
              reference_roles: [
                {
                  index: 1,
                  filename: "orange-silver-pair.png",
                  role: "product",
                  note: "White-background SKU product subject.",
                },
              ],
              sku_subjects: [
                {
                  id: "orange-silver-pair",
                  title: "Orange and silver lure pair",
                  reference_indexes: [1],
                  filenames: ["orange-silver-pair.png"],
                  subject_unit_count: 1,
                  note: "This SKU reference shows two complete visible lure bodies: orange top and silver bottom.",
                },
              ],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.sku_subjects[0].subject_unit_count, 2);
});

test("prompt agent normalizes creation reference visual language recommendation", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "识别到商品主体和一张风格参考。",
              category_hint: "Fishing lure",
              category_path: "Sports > Fishing > Lures > Hard bait",
              visual_language: "reference-style",
              visual_language_reason: "参考图主要提供光线、背景和构图风格。",
              reference_roles: [
                { index: 1, filename: "lure.png", role: "product", note: "商品主体。" },
                { index: 2, filename: "mood.png", role: "style", note: "风格参考。" },
              ],
              sku_subjects: [{ id: "lure", title: "Lure", reference_indexes: [1], filenames: ["lure.png"], note: "Sellable lure." }],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.visual_language, "reference-style");
  assert.equal(result.visual_language_reason, "参考图主要提供光线、背景和构图风格。");
});

test("prompt agent keeps original filenames for unnamed creation SKU subjects", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "One product reference.",
              category_hint: "Fishing lure",
              category_path: "Sports > Fishing > Lures > Hard bait",
              reference_roles: [{ index: 1, filename: "blue-silver-lure.png", role: "product", note: "Blue silver body." }],
              sku_subjects: [{ reference_indexes: [1], filenames: ["blue-silver-lure.png"], note: "Blue sellable subject." }],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.deepEqual(result.sku_subjects[0], {
    id: "blue-silver-lure.png",
    title: "blue-silver-lure.png",
    reference_indexes: [1],
    filenames: ["blue-silver-lure.png"],
    subject_unit_count: 1,
    note: "Blue sellable subject.",
  });
});

test("prompt agent labels every reference image so the model can compare all images", () => {
  const images = [
    {
      filename: "kitchen-scene.png",
      mimeType: "image/png",
      base64: "a2l0Y2hlbg==",
    },
    {
      filename: "zip-hoodie.jpg",
      mimeType: "image/jpeg",
      base64: "aG9vZGll",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "reference-orchestration",
  });

  assert.match(input[0].content[0].text, /覆盖所有参考图/);
  assert.match(input[0].content[0].text, /不要只分析第一张/);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "参考图 1：kitchen-scene.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,a2l0Y2hlbg==",
    },
    {
      type: "input_text",
      text: "参考图 2：zip-hoodie.jpg。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/jpeg;base64,aG9vZGll",
    },
  ]);
});

test("prompt agent normalizes reference orchestration output to one to three prompts", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "穿搭街拍编排",
              summary: "识别为女性主体与裤装参考图的穿搭关系。",
              image_roles: ["图 1：女性主体", "图 2：裤装"],
              relationship: "人物穿搭",
              prompts: [
                {
                  title: "通勤街拍",
                  intent: "让女性主体穿上参考裤装并置于城市街头。",
                  prompt: "让参考女性主体穿上参考裤装，站在城市街头，自然侧身回望，柔和日光，时尚街拍质感。",
                },
                {
                  title: "室内 Lookbook",
                  intent: "强调裤装版型与人物姿态。",
                  prompt: "让参考女性主体穿上参考裤装，在简洁摄影棚中站姿展示，干净背景，柔和棚拍光。",
                },
                {
                  title: "咖啡店场景",
                  intent: "将穿搭放入生活化环境。",
                  prompt: "让参考女性主体穿上参考裤装，坐在咖啡店窗边，轻松自然姿态，午后暖光。",
                },
                {
                  title: "多余结果",
                  intent: "不应保留第四条。",
                  prompt: "这条不应该被保留。",
                },
              ],
              risks: ["服装尺码需要生成模型自行适配"],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.prompt, "让参考女性主体穿上参考裤装，站在城市街头，自然侧身回望，柔和日光，时尚街拍质感。");
  assert.equal(result.prompts.length, 3);
  assert.deepEqual(result.image_roles, ["图 1：女性主体", "图 2：裤装"]);
  assert.equal(result.relationship, "人物穿搭");
});

test("prompt agent can parse streamed Responses text into JSON prompt data", async () => {
  const chunks = [
    [
      "event: response.output_text.delta",
      'data: {"type":"response.output_text.delta","delta":"{\\"title\\":\\"街头快照\\",\\"prompt\\":\\""}',
      "",
      "",
      "event: response.output_text.delta",
      'data: {"type":"response.output_text.delta","delta":"复古 CCD 街头快照\\",\\"negative_prompt\\":\\"低清晰度\\",\\"style_tags\\":[\\"ccd\\"],\\"subject\\":\\"人物\\",\\"scene\\":\\"街头\\",\\"composition\\":\\"半身构图\\",\\"lighting\\":\\"直闪\\",\\"color_palette\\":\\"低饱和\\",\\"camera\\":\\"CCD\\",\\"aspect_ratio\\":\\"4:5\\",\\"notes\\":[\\"保留抓拍感\\"]}"}',
      "",
      "",
      "event: response.completed",
      'data: {"type":"response.completed"}',
      "",
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n"),
  ];
  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }

          const value = new TextEncoder().encode(chunks[index]);
          index += 1;
          return { done: false, value };
        },
      };
    },
  };

  const result = await consumePromptAgentSse(fakeStream);

  assert.equal(result.title, "街头快照");
  assert.equal(result.prompt, "复古 CCD 街头快照");
  assert.deepEqual(result.notes, ["保留抓拍感"]);
});

test("prompt agent retries without structured output when provider rejects strict JSON schema", async () => {
  const calls = [];
  const sseBody = [
    "event: response.output_text.done",
    `data: {"type":"response.output_text.done","text":${JSON.stringify(
      JSON.stringify({
        title: "产品图",
        prompt: "白底产品摄影，柔光棚拍，高级商业质感",
        negative_prompt: "模糊，畸变",
        style_tags: ["product"],
        subject: "产品",
        scene: "白底影棚",
        composition: "居中构图",
        lighting: "柔和棚拍光",
        color_palette: "白色与浅灰",
        camera: "微距商业摄影",
        aspect_ratio: "1:1",
        notes: ["保留干净背景"],
      }),
    )}}`,
    "",
    "",
    "data: [DONE]",
    "",
    "",
  ].join("\n");

  const result = await requestPromptAgentAnalysis({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    image: {
      filename: "product.png",
      mimeType: "image/png",
      base64: "ZmFrZQ==",
    },
    responsesModel: "gpt-5.4",
    async fetchImpl(url, options) {
      calls.push({
        url,
        body: JSON.parse(options.body),
      });

      if (calls.length === 1) {
        return new Response("Unknown parameter: text.format", { status: 400 });
      }

      return new Response(sseBody, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      });
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.stream, true);
  assert.equal(calls[0].body.text.format.type, "json_schema");
  assert.equal(calls[1].body.stream, true);
  assert.equal("text" in calls[1].body, false);
  assert.equal(result.prompt, "白底产品摄影，柔光棚拍，高级商业质感");
});

test("prompt agent posts to the configured endpoint path", async () => {
  const calls = [];
  const result = await requestPromptAgentAnalysis({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "chat/completions",
    apiKey: "test-key",
    image: {
      filename: "product.png",
      mimeType: "image/png",
      base64: "ZmFrZQ==",
    },
    responsesModel: "vendor-vision-text",
    async fetchImpl(url, options) {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            title: "Product image",
            prompt: "Clean product photo on white background.",
            negative_prompt: "blur",
            style_tags: ["product"],
            subject: "Product",
            scene: "White studio",
            composition: "Centered",
            lighting: "Softbox",
            color_palette: "White and gray",
            camera: "Commercial macro",
            aspect_ratio: "1:1",
            notes: [],
          }),
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://direct.example.test/v1/chat/completions");
  assert.equal(calls[0].body.model, "vendor-vision-text");
  assert.equal(result.prompt, "Clean product photo on white background.");
});

test("prompt agent uses chat completions request and response format for Route B text vision", async () => {
  const calls = [];
  const result = await requestPromptAgentAnalysis({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "chat/completions",
    apiKey: "direct-key",
    image: {
      filename: "product.png",
      mimeType: "image/png",
      base64: "cHJvZHVjdA==",
    },
    responsesModel: "vendor-vision-text",
    async fetchImpl(url, options) {
      calls.push({
        url,
        body: JSON.parse(options.body),
      });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Chat product image",
                  prompt: "Clean chat-completions product photo.",
                  negative_prompt: "blur",
                  style_tags: ["product"],
                  subject: "Product",
                  scene: "White studio",
                  composition: "Centered",
                  lighting: "Softbox",
                  color_palette: "White and gray",
                  camera: "Commercial macro",
                  aspect_ratio: "1:1",
                  notes: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://direct.example.test/v1/chat/completions");
  assert.equal(calls[0].body.model, "vendor-vision-text");
  assert.equal("input" in calls[0].body, false);
  assert.equal(calls[0].body.messages[0].role, "user");
  assert.deepEqual(
    calls[0].body.messages[0].content.map((item) => item.type),
    ["text", "text", "image_url"],
  );
  assert.equal(calls[0].body.response_format.type, "json_schema");
  assert.equal(calls[0].body.response_format.json_schema.name, "image_prompt_json");
  assert.equal(result.prompt, "Clean chat-completions product photo.");
});

test("prompt agent uses model protocol settings for Route C Gemini analysis", async () => {
  const calls = [];
  const result = await requestPromptAgentAnalysis({
    imageRoute: "c",
    baseUrl: "https://protocol.example.test/v1",
    apiKey: "protocol-key",
    image: {
      filename: "product.png",
      mimeType: "image/png",
      base64: "cHJvZHVjdA==",
    },
    responsesModel: "gemini-3.1-flash-image-preview",
    imageModel: "gemini-3.1-flash-image-preview",
    async fetchImpl(url, options) {
      calls.push({
        url,
        body: JSON.parse(options.body),
      });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "Gemini product image",
                      prompt: "Clean Gemini protocol product photo.",
                      negative_prompt: "blur",
                      style_tags: ["product"],
                      subject: "Product",
                      scene: "White studio",
                      composition: "Centered",
                      lighting: "Softbox",
                      color_palette: "White and gray",
                      camera: "Commercial macro",
                      aspect_ratio: "1:1",
                      notes: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://protocol.example.test/v1/images/generations");
  assert.equal(calls[0].body.model, "gemini-3.1-flash-image-preview");
  assert.equal("input" in calls[0].body, false);
  assert.equal("messages" in calls[0].body, false);
  assert.deepEqual(calls[0].body.generationConfig.responseModalities, ["TEXT"]);
  assert.equal(calls[0].body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(
    calls[0].body.contents[0].parts.map((item) => (item.text ? "text" : "inline_data")),
    ["text", "text", "inline_data"],
  );
  assert.equal(result.prompt, "Clean Gemini protocol product photo.");
});

test("prompt agent retries creation reference analysis when the model returns prose instead of JSON", async () => {
  const calls = [];
  const validAnalysis = {
    summary: "Fishing lure reference set.",
    category_hint: "Fishing Lures",
    category_path: "Sports > Fishing > Fishing Lures",
    visual_language: "classic-commercial",
    visual_language_reason: "Product references use clean ecommerce photography.",
    reference_roles: [
      {
        index: 1,
        filename: "lure.png",
        role: "product",
        note: "Preserve the lure body, hooks, scale pattern, and red tail.",
      },
    ],
    sku_subjects: [
      {
        id: "lure",
        title: "Fishing lure",
        reference_indexes: [1],
        filenames: ["lure.png"],
        note: "Sellable lure subject.",
      },
    ],
    risks: [],
  };

  const result = await requestPromptAgentAnalysis({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    images: [
      {
        filename: "lure.png",
        mimeType: "image/png",
        base64: "bHVyZQ==",
      },
    ],
    mode: CREATION_REFERENCE_ANALYSIS_MODE,
    responsesModel: "gpt-5.4",
    async fetchImpl(url, options) {
      calls.push({
        url,
        body: JSON.parse(options.body),
      });

      const text =
        calls.length === 1
          ? "I analyzed the lure images and they are product photos."
          : JSON.stringify(validAnalysis);
      return new Response(
        [
          "event: response.output_text.done",
          `data: {"type":"response.output_text.done","text":${JSON.stringify(text)}}`,
          "",
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        },
      );
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.text.format.name, "creation_reference_analysis_json");
  assert.equal(calls[1].body.text.format.name, "creation_reference_analysis_json");
  assert.match(calls[1].body.input[0].content.at(-1).text, /Return exactly one JSON object/i);
  assert.equal(result.category_hint, "Fishing Lures");
  assert.equal(result.reference_roles[0].role, "product");
});

test("prompt agent returns compact upstream HTTP errors", async () => {
  await assert.rejects(
    () =>
      requestPromptAgentAnalysis({
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        image: {
          filename: "timeout.png",
          mimeType: "image/png",
          base64: "ZmFrZQ==",
        },
        responsesModel: "gpt-5.4",
        async fetchImpl() {
          return new Response(
            JSON.stringify({
              type: "https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/",
              detail: "The origin web server did not respond within the timeout window.",
              error_code: 524,
            }),
            { status: 524 },
          );
        },
      }),
    {
      message: "图片分析请求失败：HTTP 524，错误码 524",
    },
  );
});

test("prompt agent extracts JSON prompt data from Responses output text", () => {
  const payload = {
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "霓虹街景",
              prompt: "赛博朋克街道，雨夜霓虹，电影感构图",
              negative_prompt: "低清晰度，畸变",
              style_tags: ["cinematic", "neon"],
              subject: "街道行人",
              scene: "雨夜城市",
              composition: "低机位广角",
              lighting: "霓虹反射光",
              color_palette: "蓝紫与品红",
              camera: "35mm wide angle",
              aspect_ratio: "16:9",
              notes: ["保留湿润路面反光"],
            }),
          },
        ],
      },
    ],
  };

  const result = extractPromptAgentJson(payload);

  assert.equal(result.title, "霓虹街景");
  assert.equal(result.prompt, "赛博朋克街道，雨夜霓虹，电影感构图");
  assert.deepEqual(result.style_tags, ["cinematic", "neon"]);
});

test("prompt agent store keeps JSON analysis history across reads", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "prompt-agent-store-"));

  try {
    const store = createPromptAgentStore({ rootDir });
    const first = await store.append({
      id: "prompt-json-1",
      createdAt: "2026-04-28T08:00:00.000Z",
      filename: "sample.png",
      json: {
        title: "产品图",
        prompt: "白底商业产品摄影，柔和棚拍光",
      },
      responsesModel: "gpt-5.4",
      reasoningEffort: "high",
    });

    const reloaded = createPromptAgentStore({ rootDir });
    const history = await reloaded.list();

    assert.equal(first.id, "prompt-json-1");
    assert.equal(history.length, 1);
    assert.equal(history[0].json.prompt, "白底商业产品摄影，柔和棚拍光");
    assert.equal(history[0].filename, "sample.png");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
