import { DEFAULT_REASONING_EFFORT, MAX_CREATION_REFERENCE_IMAGES } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { buildReferenceAnalysisLanguagePromptGuidance } from "./reference-analysis-language.mjs";
import {
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  IMAGE_ROUTE_C,
  appendApiEndpointPath,
  normalizeApiEndpointPath,
  normalizeImageRoute,
} from "./image-route-config.mjs";
import { normalizeBase64, parseSseChunk } from "./responses-workflow.mjs";

const PROMPT_AGENT_INSTRUCTION = `你是一个图片提示词逆向工程 agent。请分析用户上传的图片，反推一份能复刻该图片视觉效果的 AI 图片生成提示词，并返回 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. prompt 字段必须是一段完整、可直接复制到图片生成文本框的中文提示词，目标是尽可能复刻原图。
3. 像提示词工程师一样反推主体、场景、构图、光线、色彩、材质、镜头、风格、画幅和关键细节。
4. negative_prompt 写出需要避免的画面问题。
5. 不要编造图片中不存在的品牌、文字、人名或敏感身份。`;

export const REFERENCE_ORCHESTRATION_MODE = "reference-orchestration";
export const CREATION_REFERENCE_ANALYSIS_MODE = "creation-reference-analysis";
export const PORTRAIT_REFERENCE_ANALYSIS_MODE = "portrait-reference-analysis";

const REFERENCE_ORCHESTRATION_INSTRUCTION = `你是一个参考图编排 agent。请分析用户上传的 1 到 6 张参考图，判断图片之间最合理的创作关系，并生成 1 到 3 条可直接用于图片生成的目标语言场景提示词。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. 先判断每张参考图的角色，例如人物主体、服装、裤子、配饰、背景、姿态、商品、风格参考或构图参考。
3. 多图时必须优先判断关系，例如人物 + 服装、主体 + 背景、商品 + 场景、风格图 + 内容图、多主体 + 场景。
4. 你会收到按顺序标注的参考图 1、参考图 2 等内容标签；必须逐张分析并覆盖所有参考图，不要只分析第一张。
5. prompts 必须包含 1 到 3 条结果；关系明确时给 1 条，存在明显不同场景或动作时给 2 到 3 条。
6. 每条 prompt 都要包含主体、参考图关系、场景、动作或姿态、镜头、光线、画面融合要求和必要限制。
7. 主体保真优先于融合创意；同一商品或同一产品主体必须保持不变，不要改成新主体、替换品类、改变核心结构或生成参考图中没有的主商品。
8. 不得新增或编造参考图中不存在的人、动物、物体、配件或可售商品；只有明确出现在参考图中的对象才能进入 prompt。
9. 电商商品参考图中，说明图、规格图、局部特写、不同状态图只能作为结构、细节或信息参考，不能当成新主体，也不得把不同状态混成同一画面状态。
10. 如果关系不明确，请在 risks 中说明待确认点，并让 prompt 保持保守，不要强行指定归属。
11. 不要识别或编造真人身份、姓名、年龄、品牌、地点或图片中不存在的敏感信息。`;

const CREATION_REFERENCE_ANALYSIS_INSTRUCTION = `你是一个套图参考图识别 agent。请分析用户上传的 1 到 ${MAX_CREATION_REFERENCE_IMAGES} 张电商套图参考图，为每张图判断最适合影响套图生成的用途，并返回 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. 必须逐张分析并覆盖所有套图参考图，不要只分析第一张。
3. reference_roles 必须按输入顺序返回，每张图只能选择一个 role。
4. role 只能是 product、package、material、dimensions、usage、scene、style、other：
   - product = 商品主体，仅用于独立白底主图、正面主体图、可售 SKU 色款或需要作为商品身份锚点的清晰主体图。
   - package = 包装清单，用于锁定包装、配件、套装和用户实际收到的物品。
   - material = 结构细节，用于锁定材质质感、纹理、表面、边缘工艺、外观结构、功能卖点、结构表现、部件标注和细节说明；不要当成商品主体或单独可售 SKU。
   - dimensions = 尺寸规格，用于锁定规格表、尺码卡、长度、重量、容量、钩号、型号、兼容性等可见数值；不要当成单独可售 SKU。
   - usage = 使用说明，用于锁定安装、装配、操作、充电、连接、接线、正负极、步骤、注意事项和说明性箭头标注；不要当成商品主体或单独可售 SKU。
   - scene = 使用场景，用于锁定环境、尺度、使用方式和生活化摆放。
   - style = 风格参考，用于锁定光线、构图、背景风格和商业摄影调性。
   - other = 仅在无法归类时使用。
4.1 如果图片主要展示包装清单、配件、套装、内含物或用户实际收到的物品，必须选择 role=package；即使同时出现尺寸、型号、重量、长度等规格数字，也不要改成 dimensions。
5. 如果图片是规格表、尺寸卡、参数图或主要展示长度、重量、容量、钩号、型号等文字，必须选择 role=dimensions，并在 note 中逐项抄写所有可辨认的具体规格，保留原始数字、单位和符号，例如“型号 F4J16、长度 13cm、重量 42g、钩号 2#”；看不清的文字写入 risks，不能只写“长度感”“比例”等概括。
6. 如果图片是使用说明、操作指南、充电指南、安装步骤、连接/接线示意、正负极标注、注意事项或用箭头/编号说明如何使用，必须选择 role=usage；即使图中出现商品，也不要归为 product，也不要为它创建 sku_subjects。
6.1 如果图片主要是外观结构说明、功能卖点拆解、部件/结构标注、材质纹理放大、细节说明、LED/电池/钢珠/螺旋桨等功能结构表现，必须选择 role=material；即使图中有完整商品，也不要归为 product，也不要为它创建 sku_subjects。
7. note 用一句简体中文说明这张图最应该影响什么，便于后续生成提示词引用。
8. category_hint 写出最可能的四级类目名称；如果无法判断到四级类目，返回空字符串。
9. category_path 写出可判断的完整类目路径；如果无法判断，返回空字符串。
10. risks 写出不确定点，例如产品身份不清、包装缺失、参考图互相冲突或文字不可辨认。
11. visual_language 只能返回 classic-commercial 或 reference-style；只有当参考图明确主要用于光线、背景、构图、色调或拍摄风格时才返回 reference-style，否则返回 classic-commercial。
12. visual_language_reason 用一句简体中文说明为什么推荐该视觉语言。
13. 不要识别或编造真人身份、姓名、年龄、品牌、地点或图片中不存在的敏感信息。`;

const CREATION_REFERENCE_ANALYSIS_SKU_INSTRUCTION =
  "SKU grouping: also return sku_subjects. Each sku_subjects item must represent one sellable product subject group for one added SKU image. If one product-subject reference image contains multiple complete visible product units, colorways, finishes, or model variants, keep those units together as one sku_subject that uses that source filename; do not split them into multiple sku_subjects. Set sku_subjects[].subject_unit_count to the exact number of complete visible product units inside that grouped subject; use 1 only when the subject reference shows one complete product unit. In sku_subjects[].note, explicitly record the visible product unit count and the visible differences that must be preserved in the one SKU image. Group multiple photos of the same subject group into one item. Ordinary white-background SKU/colorway images, including source images that show two or more complete products in one frame, must use role=product and not role=reference-product. Use role=reference-product only for exactly one optional 参考主体 image when the image is explicitly the set-wide primary subject anchor; it keeps the same generation mode as role=product and must still be treated as a product subject for SKU grouping and generation references. Use role=product for ordinary 商品主体 images and additional sellable SKU subjects. For product and reference-product roles, reference_roles[].note must include the same exact visible product unit count that you put in sku_subjects[].subject_unit_count and sku_subjects[].note whenever the source image shows multiple complete product units. Never describe two stacked, side-by-side, top/bottom, or paired complete lures as 1 unit; 当同一张白底商品主体图里有上下、左右或成对的两个完整路亚/鱼饵时，reference_roles[].note 和 sku_subjects[].note 都必须写清“2 个完整产品单位”，不要写成“单个”或“单一”，也不要写“画面为1个完整产品单体”或“画面为1个完整产品单位”. Use role=package for package lists, packaging, included items, accessories, bundles, or what the shopper receives, even if the same image contains size, model, length, or weight text. Use role=dimensions for size charts, specification tables, size cards, specification-feel references, or references focused on length, weight, capacity, measurements, hooks, model numbers, or compatibility. Use role=usage for instruction guides, user manuals, setup steps, operation diagrams, charging guides, connection/polarity diagrams, positive/negative terminal callouts, or caution/step labels. Use role=material for exterior-structure callouts, feature selling-point callouts, annotated component/detail diagrams, material texture references, and references focused on visible structure details rather than a sellable SKU. Treat text outside the physical product as non-subject overlay: ignore corner badges, stickers, price tags, product-card captions, bottom SKU/color text blocks, title bars, watermarks, and words such as 2025 NEW or WHITE EDIT when deciding what the SKU subject must preserve. sku_subjects[].note should describe only the sellable product subject group plus intrinsic product-surface logos, model identifiers, markings, materials, color, shape, structure, and visible product unit count. When role=dimensions, transcribe every readable model, size, weight, hook number, capacity, and compatibility value into reference_roles[].note. Do not create SKU subjects for accessories, packaging-only images, material/detail/structure-only closeups, feature selling-point references, dimensions/specification/size-chart references, usage/instruction references, scenes, or style references.";

const CREATION_REFERENCE_ANALYSIS_PRODUCT_NAME_INSTRUCTION =
  "Product naming: first identify the main sellable product subject in the reference set, then put that subject name in product_name. product_name must be the analyzed subject's concise ecommerce product name, not a category path or a generic word like product. If a brand or model is visibly readable, include it; if not, return a concise generic ecommerce product name such as 'jointed fishing lure'. Do not leave product_name empty.";

const PORTRAIT_REFERENCE_ANALYSIS_INSTRUCTION = `You are a portrait task reference analysis agent. Analyze the uploaded portrait reference set and return one strict JSON object for a portrait photography workflow.

Requirements:
1. Return JSON only. Do not return Markdown, code fences, or commentary.
2. Describe only visible presentation and visual cues that are useful for portrait generation.
3. Use visiblePresentation with exactly one of: masculine-presenting, feminine-presenting, androgynous-presenting, unclear.
4. Use heightImpression only as a low-confidence visual impression. If the full body or scale context is insufficient, return unclear.
5. Use bodyBuild with neutral low-granularity wording such as slim, average, broad, curvy, plus-size, unclear.
6. Include pose, clothing, hair, faceVisibility, distinctVisibleFeatures, referenceRoles, risks, safety, and confidence.
7. Respect each image's label: person references are for visible person identity and presentation, action references are pose-only guidance, and clothing/prop/accessory references are styling-only guidance.
8. Do not treat action or styling references as additional people.
9. Do not infer real age, race, ethnicity, nationality, religion, health, disability, pregnancy, sexual orientation, real identity name, or other sensitive personal attributes.
10. If adult status is unclear, safety must say to use ordinary portrait or lifestyle styling and avoid sexualized, nude, lingerie, or adult-oriented direction.
11. Keep the summary editable and conservative, suitable for user confirmation before image generation.`;

export const PROMPT_AGENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "prompt",
    "negative_prompt",
    "style_tags",
    "subject",
    "scene",
    "composition",
    "lighting",
    "color_palette",
    "camera",
    "aspect_ratio",
    "notes",
  ],
  properties: {
    title: {
      type: "string",
      description: "图片内容的短标题，使用简体中文。",
    },
    prompt: {
      type: "string",
      description: "可直接用于图片生成的完整中文提示词。",
    },
    negative_prompt: {
      type: "string",
      description: "生成时建议避免的瑕疵和错误方向。",
    },
    style_tags: {
      type: "array",
      items: { type: "string" },
      description: "风格关键词，适合用于快速筛选和复用。",
    },
    subject: {
      type: "string",
      description: "主体和关键对象。",
    },
    scene: {
      type: "string",
      description: "环境、背景和氛围。",
    },
    composition: {
      type: "string",
      description: "构图、视角、主体位置和空间关系。",
    },
    lighting: {
      type: "string",
      description: "光线类型、方向、强度和阴影。",
    },
    color_palette: {
      type: "string",
      description: "主要色彩、配色关系和色调。",
    },
    camera: {
      type: "string",
      description: "镜头、景深、焦段或拍摄质感。",
    },
    aspect_ratio: {
      type: "string",
      description: "根据图片构图建议的画幅比例。",
    },
    notes: {
      type: "array",
      items: { type: "string" },
      description: "复刻图片时最需要保留的细节。",
    },
  },
};

export const REFERENCE_ORCHESTRATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "image_roles", "relationship", "prompts", "risks"],
  properties: {
    title: {
      type: "string",
      description: "本次参考图编排的短标题，使用目标语言。",
    },
    summary: {
      type: "string",
      description: "一句话说明识别出的组合关系和创作方向。",
    },
    image_roles: {
      type: "array",
      items: { type: "string" },
      description: "逐张说明参考图角色，例如图 1：女性主体、图 2：裤装。",
    },
    relationship: {
      type: "string",
      description: "参考图之间的关系判断，例如人物穿搭、主体融入背景、商品场景化。",
    },
    prompts: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "intent", "prompt"],
        properties: {
          title: {
            type: "string",
            description: "单条提示词标题。",
          },
          intent: {
            type: "string",
            description: "这条提示词的使用意图。",
          },
          prompt: {
            type: "string",
            description: "可直接用于图片生成的完整目标语言提示词。",
          },
        },
      },
      description: "1 到 3 条可应用到主提示词框的编排提示词。",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "不确定点、需要用户确认的关系或生成时需要规避的问题。",
    },
  },
};

export const CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "product_name", "category_hint", "category_path", "visual_language", "visual_language_reason", "reference_roles", "sku_subjects", "risks"],
  properties: {
    summary: {
      type: "string",
      description: "一句话概括本组套图参考图的商品信息、可用素材和主要限制。",
    },
    product_name: {
      type: "string",
      minLength: 1,
      description: "The identified main sellable product subject name to fill the Creation Mode product name field. Use the analyzed subject's concise ecommerce product name, not a category path; include visible brand or model text only when it is actually readable.",
    },
    category_hint: {
      type: "string",
      description: "最可能匹配的四级类目名称；无法判断时返回空字符串。",
    },
    category_path: {
      type: "string",
      description: "最可能匹配的完整类目路径；无法判断时返回空字符串。",
    },
    visual_language: {
      type: "string",
      enum: ["classic-commercial", "reference-style"],
      description: "推荐的套图视觉语言。只有明确要使用参考图的光线、背景、构图、色调或拍摄风格时才返回 reference-style，否则返回 classic-commercial。",
    },
    visual_language_reason: {
      type: "string",
      description: "一句简体中文说明为什么推荐该视觉语言。",
    },
    reference_roles: {
      type: "array",
      minItems: 1,
      maxItems: MAX_CREATION_REFERENCE_IMAGES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "filename", "role", "note"],
        properties: {
          index: {
            type: "integer",
            minimum: 1,
            maximum: MAX_CREATION_REFERENCE_IMAGES,
            description: "参考图输入序号，从 1 开始。",
          },
          filename: {
            type: "string",
            description: "对应参考图文件名。",
          },
          role: {
            type: "string",
            enum: ["product", "reference-product", "package", "material", "dimensions", "usage", "scene", "style", "other"],
            description: "推荐的套图参考用途。",
          },
          note: {
            type: "string",
            description: "这张参考图应该影响生成结果的重点说明，使用简体中文。若 role=dimensions，必须逐项写入可辨认的具体规格原文，例如：型号 F4J16、长度 13cm、重量 42g、钩号 2#。若 role=usage，写清可见步骤、箭头、连接方式、正负极或注意事项。若 role=material，写清外观结构、功能卖点、材质纹理、部件标注或细节说明，不要写成商品主体。",
          },
        },
      },
      description: "逐张参考图的用途建议，必须按输入顺序返回。",
    },
    sku_subjects: {
      type: "array",
      maxItems: MAX_CREATION_REFERENCE_IMAGES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "reference_indexes", "filenames", "subject_unit_count", "note"],
        properties: {
          id: {
            type: "string",
            description: "Stable short id for this distinct sellable SKU subject.",
          },
          title: {
            type: "string",
            description: "Short display name for this SKU subject.",
          },
          reference_indexes: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
              maximum: MAX_CREATION_REFERENCE_IMAGES,
            },
            description: "Input reference image indexes that show this same sellable product subject.",
          },
          filenames: {
            type: "array",
            items: { type: "string" },
            description: "Reference filenames that show this same grouped sellable product subject.",
          },
          subject_unit_count: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Exact count of complete visible product units inside this grouped sellable product subject. Use 1 for a single complete product unit.",
          },
          note: {
            type: "string",
            description: "What must be preserved for this SKU image subject group, including visible product unit count when one source image contains multiple complete product units; exclude source-image overlay text outside the physical product.",
          },
        },
      },
      description: "Distinct sellable product subjects that should receive added SKU background images.",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "不确定点、需要用户确认的关系或生成时需要规避的问题。",
    },
  },
};

export const PORTRAIT_REFERENCE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "visiblePresentation",
    "heightImpression",
    "bodyBuild",
    "pose",
    "clothing",
    "hair",
    "faceVisibility",
    "distinctVisibleFeatures",
    "referenceRoles",
    "risks",
    "safety",
    "confidence",
  ],
  properties: {
    summary: {
      type: "string",
      description: "Editable visible portrait draft for user confirmation.",
    },
    visiblePresentation: {
      type: "string",
      enum: ["masculine-presenting", "feminine-presenting", "androgynous-presenting", "unclear"],
      description: "Visible presentation label based on styling and appearance cues.",
    },
    heightImpression: {
      type: "string",
      description: "Low-confidence visual height impression; use unclear when scale context is limited.",
    },
    bodyBuild: {
      type: "string",
      description: "Neutral low-granularity body shape impression.",
    },
    pose: {
      type: "string",
      description: "Visible pose, gesture, and framing cues.",
    },
    clothing: {
      type: "string",
      description: "Visible wardrobe and accessory cues.",
    },
    hair: {
      type: "string",
      description: "Visible hair style, length, and color cues.",
    },
    faceVisibility: {
      type: "string",
      description: "How clearly the face is visible and usable as a reference.",
    },
    distinctVisibleFeatures: {
      type: "array",
      items: { type: "string" },
      description: "Visible non-sensitive details useful for preserving likeness.",
    },
    referenceRoles: {
      type: "array",
      items: { type: "string" },
      description: "How each uploaded reference should be used in the portrait set.",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "Unclear points that need user review.",
    },
    safety: {
      type: "string",
      description: "Generation safety guidance for the portrait planner.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high", "unclear"],
      description: "Overall confidence of the visible draft.",
    },
  },
};

function normalizeImage(image) {
  if (!image || typeof image !== "object") {
    throw new Error("请先上传一张图片。");
  }

  const mimeType = String(image.mimeType || "").trim() || "image/png";
  const base64 = normalizeBase64(String(image.base64 || ""));

  if (!base64) {
    throw new Error("图片内容为空。");
  }

  return {
    filename: String(image.filename || "uploaded-image").trim(),
    mimeType,
    base64,
  };
}

function normalizeImages({ image, images } = {}) {
  const list = Array.isArray(images) && images.length > 0 ? images : image ? [image] : [];
  if (list.length === 0) {
    throw new Error("请先上传一张图片。");
  }

  return list.map(normalizeImage);
}

function buildPromptAgentImageLabel({ filename, index, mode }) {
  if (mode === PORTRAIT_REFERENCE_ANALYSIS_MODE) {
    return `写真人物参考图 ${index + 1}：${filename}。请按此序号分析这张图的可见人物呈现、姿态、服装、发型和可用于写真生成的参考作用。`;
  }

  const label =
    mode === CREATION_REFERENCE_ANALYSIS_MODE
      ? "套图参考图"
      : mode === REFERENCE_ORCHESTRATION_MODE
        ? "参考图"
        : "待分析图片";
  return `${label} ${index + 1}：${filename}。请按此序号分析这张图片的角色、内容和可融合元素。`;
}

function buildPromptAgentImageContent({ normalizedImages, mode, imageLabels = [] }) {
  const labels = Array.isArray(imageLabels) ? imageLabels : [];
  return normalizedImages.flatMap((normalized, index) => [
    {
      type: "input_text",
      text:
        String(labels[index] || "").trim() ||
        buildPromptAgentImageLabel({
          filename: normalized.filename,
          index,
          mode,
        }),
    },
    {
      type: "input_image",
      image_url: `data:${normalized.mimeType};base64,${normalized.base64}`,
    },
  ]);
}

function buildStrictJsonRetryInstruction(mode) {
  const format = getPromptAgentSchema(mode);
  const requiredKeys = Array.isArray(format.schema?.required) ? format.schema.required.join(", ") : "";
  return [
    "The previous model output was not parseable JSON.",
    `Return exactly one JSON object matching the ${format.name} schema.`,
    requiredKeys ? `Required top-level keys: ${requiredKeys}.` : "",
    "Do not include Markdown, code fences, explanations, bullet lists, or prose outside the JSON object.",
    "The first character must be { and the last character must be }.",
  ]
    .filter(Boolean)
    .join(" ");
}

function getPromptAgentInstruction(mode, targetLanguage, targetLanguageLabel) {
  if (mode === PORTRAIT_REFERENCE_ANALYSIS_MODE) {
    return PORTRAIT_REFERENCE_ANALYSIS_INSTRUCTION;
  }

  if (mode === CREATION_REFERENCE_ANALYSIS_MODE) {
    return `${CREATION_REFERENCE_ANALYSIS_INSTRUCTION}\n${CREATION_REFERENCE_ANALYSIS_PRODUCT_NAME_INSTRUCTION}\n${CREATION_REFERENCE_ANALYSIS_SKU_INSTRUCTION}`;
  }

  if (mode === REFERENCE_ORCHESTRATION_MODE) {
    return `${REFERENCE_ORCHESTRATION_INSTRUCTION}\n\n${buildReferenceAnalysisLanguagePromptGuidance(targetLanguage, targetLanguageLabel)}`;
  }

  return PROMPT_AGENT_INSTRUCTION;
}

function getPromptAgentSchema(mode) {
  if (mode === PORTRAIT_REFERENCE_ANALYSIS_MODE) {
    return {
      name: "portrait_reference_analysis_json",
      schema: PORTRAIT_REFERENCE_ANALYSIS_JSON_SCHEMA,
    };
  }

  if (mode === CREATION_REFERENCE_ANALYSIS_MODE) {
    return {
      name: "creation_reference_analysis_json",
      schema: CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA,
    };
  }

  return mode === REFERENCE_ORCHESTRATION_MODE
    ? {
        name: "reference_orchestration_prompt_json",
        schema: REFERENCE_ORCHESTRATION_JSON_SCHEMA,
      }
    : {
        name: "image_prompt_json",
        schema: PROMPT_AGENT_JSON_SCHEMA,
      };
}

export function buildPromptAgentInput({
  image,
  images,
  imageLabels = [],
  mode,
  targetLanguage,
  targetLanguageLabel,
  strictJsonRetry = false,
} = {}) {
  const normalizedImages = normalizeImages({ image, images });
  const content = [
    {
      type: "input_text",
      text: getPromptAgentInstruction(mode, targetLanguage, targetLanguageLabel),
    },
    ...buildPromptAgentImageContent({ normalizedImages, mode, imageLabels }),
  ];

  if (strictJsonRetry) {
    content.push({
      type: "input_text",
      text: buildStrictJsonRetryInstruction(mode),
    });
  }

  return [
    {
      role: "user",
      content,
    },
  ];
}

export function createPromptAgentRequestBody({
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  structuredOutput = true,
  strictJsonRetry = false,
}) {
  const body = {
    model: responsesModel,
    input: buildPromptAgentInput({
      image,
      images,
      imageLabels,
      mode,
      targetLanguage,
      targetLanguageLabel,
      strictJsonRetry,
    }),
    reasoning: {
      effort: reasoningEffort,
    },
    stream: true,
  };

  if (structuredOutput) {
    const format = getPromptAgentSchema(mode);
    body.text = {
      format: {
        type: "json_schema",
        name: format.name,
        strict: true,
        schema: format.schema,
      },
    };
  }

  return body;
}

function getPromptAgentChatResponseFormat(mode) {
  const format = getPromptAgentSchema(mode);
  return {
    type: "json_schema",
    json_schema: {
      name: format.name,
      strict: true,
      schema: format.schema,
    },
  };
}

function mapPromptAgentChatContentPart(part) {
  if (part?.type === "input_text") {
    return {
      type: "text",
      text: part.text || "",
    };
  }

  if (part?.type === "input_image") {
    return {
      type: "image_url",
      image_url: {
        url: part.image_url || "",
      },
    };
  }

  return null;
}

function buildPromptAgentChatMessages(options) {
  return buildPromptAgentInput(options).map((message) => ({
    role: message.role || "user",
    content: message.content.map(mapPromptAgentChatContentPart).filter(Boolean),
  }));
}

function createPromptAgentChatCompletionsRequestBody({
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  responsesModel,
  structuredOutput = true,
  strictJsonRetry = false,
}) {
  const body = {
    model: responsesModel,
    messages: buildPromptAgentChatMessages({
      image,
      images,
      imageLabels,
      mode,
      targetLanguage,
      targetLanguageLabel,
      strictJsonRetry,
    }),
  };

  if (structuredOutput) {
    body.response_format = getPromptAgentChatResponseFormat(mode);
  }

  return body;
}

function parseImageDataUrl(value) {
  const match = String(value || "").match(/^data:([^;,]+);base64,(.+)$/i);
  return {
    mimeType: match?.[1] || "image/png",
    data: normalizeBase64(match?.[2] || ""),
  };
}

function mapPromptAgentGeminiPart(part) {
  if (part?.type === "input_text") {
    return {
      text: part.text || "",
    };
  }

  if (part?.type === "input_image") {
    const imageData = parseImageDataUrl(part.image_url);
    return {
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.data,
      },
    };
  }

  return null;
}

function createPromptAgentGeminiRequestBody({
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  responsesModel,
  imageModel,
  structuredOutput = true,
  strictJsonRetry = false,
}) {
  const body = {
    model: imageModel || responsesModel,
    contents: buildPromptAgentInput({
      image,
      images,
      imageLabels,
      mode,
      targetLanguage,
      targetLanguageLabel,
      strictJsonRetry,
    }).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: message.content.map(mapPromptAgentGeminiPart).filter(Boolean),
    })),
    generationConfig: {
      responseModalities: ["TEXT"],
    },
  };

  if (structuredOutput) {
    body.generationConfig.responseMimeType = "application/json";
  }

  return body;
}

function isGeminiPromptAgentModel(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.includes("gemini") && (
    normalized.includes("image") ||
    normalized.includes("banana") ||
    normalized.includes("图像") ||
    normalized.includes("生图")
  );
}

function collectTextParts(value, parts = []) {
  if (!value || typeof value !== "object") {
    return parts;
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (
    (!value.type ||
      value.type === "output_text" ||
      value.type === "text" ||
      value.type === "response.output_text.done") &&
    typeof value.text === "string"
  ) {
    parts.push(value.text);
  }

  if (typeof value.content === "string") {
    parts.push(value.content);
  }

  if (Array.isArray(value.choices)) {
    value.choices.forEach((choice) => {
      collectTextParts(choice?.message, parts);
      collectTextParts(choice?.delta, parts);
    });
  }

  if (Array.isArray(value.output)) {
    value.output.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.content)) {
    value.content.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.parts)) {
    value.parts.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.candidates)) {
    value.candidates.forEach((candidate) => collectTextParts(candidate?.content || candidate, parts));
  }

  if (value.response && typeof value.response === "object") {
    collectTextParts(value.response, parts);
  }

  if (value.item && typeof value.item === "object") {
    collectTextParts(value.item, parts);
  }

  return parts;
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

class PromptAgentJsonParseError extends Error {
  constructor(rawText, cause) {
    super("模型返回的内容不是有效 JSON。", { cause });
    this.name = "PromptAgentJsonParseError";
    this.rawText = String(rawText || "");
  }
}

function isPromptAgentJsonParseError(error) {
  return error instanceof PromptAgentJsonParseError;
}

function parseJsonObject(text) {
  const cleaned = stripJsonFence(text);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (nestedError) {
        throw new PromptAgentJsonParseError(cleaned, nestedError);
      }
    }
    throw new PromptAgentJsonParseError(cleaned, error);
  }
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeIntegerArray(value) {
  return Array.isArray(value)
    ? value.map((item) => Number.parseInt(String(item || "").trim(), 10)).filter((item) => Number.isFinite(item) && item > 0)
    : [];
}

const SUBJECT_UNIT_COUNT_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);
const CHINESE_SUBJECT_UNIT_COUNT_WORDS = new Map([
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function clampSubjectUnitCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.min(20, Math.round(value)) : 0;
}

function normalizeSubjectUnitCount(value) {
  const count = Number.parseInt(String(value || "").trim(), 10);
  return clampSubjectUnitCount(count) || 1;
}

function parseSubjectUnitCountToken(value) {
  const token = String(value || "").trim();
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return clampSubjectUnitCount(digitCount);
  }
  if (CHINESE_SUBJECT_UNIT_COUNT_WORDS.has(token)) {
    return clampSubjectUnitCount(CHINESE_SUBJECT_UNIT_COUNT_WORDS.get(token));
  }
  if (token.includes("十")) {
    const [left, right] = token.split("十");
    const tens = left ? CHINESE_SUBJECT_UNIT_COUNT_WORDS.get(left) || 0 : 1;
    const ones = right ? CHINESE_SUBJECT_UNIT_COUNT_WORDS.get(right) || 0 : 0;
    return clampSubjectUnitCount(tens * 10 + ones);
  }
  return 0;
}

function inferSubjectUnitCount(value = "") {
  const text = String(value || "").trim().toLowerCase();
  const digitMatch = text.match(/\b(\d+)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (digitMatch) {
    return clampSubjectUnitCount(Number.parseInt(digitMatch[1], 10));
  }
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (wordMatch) {
    return clampSubjectUnitCount(SUBJECT_UNIT_COUNT_WORDS.get(wordMatch[1].toLowerCase()));
  }
  const chineseMatch = text.match(/([一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款|种|组|套)?\s*(?:完整|可见|完整可见|可售|不同|独立)?\s*(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵)/u);
  return chineseMatch ? parseSubjectUnitCountToken(chineseMatch[1]) : 0;
}

function normalizeCreationReferenceVisualLanguage(value) {
  const normalized = String(value || "").trim();
  return normalized === "reference-style" ? "reference-style" : "classic-commercial";
}

function normalizeSkuSubjects(value) {
  return Array.isArray(value)
    ? value
        .map((item, index) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const referenceIndexes = normalizeIntegerArray(
            item.reference_indexes || item.referenceIndexes || item.indexes || item.indices,
          );
          const filenames = normalizeStringArray(item.filenames || item.reference_filenames || item.referenceFilenames);
          const id = String(item.id || item.subjectId || item.subject_id || filenames[0] || `sku-${index + 1}`).trim();
          const title = String(item.title || item.name || filenames[0] || id).trim();
          const note = String(item.note || item.description || item.summary || "").trim();
          const subjectUnitCount = Math.max(
            normalizeSubjectUnitCount(
              item.subject_unit_count ?? item.subjectUnitCount ?? item.visible_unit_count ?? item.visibleUnitCount ?? item.unit_count ?? item.unitCount,
            ),
            inferSubjectUnitCount([title, note].join(" ")),
          );

          if (!id && filenames.length === 0) {
            return null;
          }

          return {
            id,
            title,
            reference_indexes: referenceIndexes,
            filenames,
            subject_unit_count: subjectUnitCount,
            note,
          };
        })
        .filter(Boolean)
        .slice(0, MAX_CREATION_REFERENCE_IMAGES)
    : [];
}

function isLikelyReferenceFilename(value) {
  const text = String(value || "").trim();
  return /[\\/]/.test(text) || /\.(?:avif|bmp|gif|heic|jpe?g|png|svg|tiff?|webp)$/i.test(text);
}

function isUsefulProductNameCandidate(value) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  return Boolean(text) && !isLikelyReferenceFilename(text) && !["product", "goods", "item", "sku", "商品", "产品", "物品", "主体"].includes(normalized);
}

function getSkuSubjectProductNameCandidate(subject = {}) {
  const directName = String(
    subject.product_name ||
      subject.productName ||
      subject.productSubject ||
      subject.product_subject ||
      subject.mainSubject ||
      subject.main_subject ||
      subject.subjectName ||
      subject.subject_name ||
      subject.subject ||
      subject.productTitle ||
      subject.product_title ||
      subject.title ||
      subject.name ||
      subject.label ||
      "",
  ).trim();
  if (!isUsefulProductNameCandidate(directName)) {
    return "";
  }

  const normalizedName = directName.toLowerCase();
  const id = String(subject.id || subject.subjectId || subject.subject_id || "").trim().toLowerCase();
  const filenames = normalizeStringArray(subject.filenames || subject.reference_filenames || subject.referenceFilenames)
    .map((item) => item.toLowerCase());
  return normalizedName && normalizedName !== id && !filenames.includes(normalizedName) ? directName : "";
}

function getSkuSubjectProductName(value = {}, skuSubjects = []) {
  const rawSkuSubjects = Array.isArray(value.sku_subjects)
    ? value.sku_subjects
    : Array.isArray(value.skuSubjects)
      ? value.skuSubjects
      : [];
  for (const subject of [...rawSkuSubjects, ...skuSubjects]) {
    const candidate = getSkuSubjectProductNameCandidate(subject);
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

function getDirectProductNameCandidate(value = {}, { includeSubject = false } = {}) {
  const candidates = [
    value.product_name,
    value.productName,
    value.productSubject,
    value.product_subject,
    value.mainSubject,
    value.main_subject,
    value.subjectName,
    value.subject_name,
    includeSubject ? value.subject : "",
    value.productTitle,
    value.product_title,
  ];
  return candidates.map((item) => String(item || "").trim()).find(isUsefulProductNameCandidate) || "";
}

function normalizePromptOptions(value) {
  const prompts = Array.isArray(value.prompts)
    ? value.prompts
        .map((item, index) => {
          if (typeof item === "string") {
            const prompt = item.trim();
            return prompt
              ? {
                  title: `提示词 ${index + 1}`,
                  intent: "",
                  prompt,
                }
              : null;
          }

          if (!item || typeof item !== "object") {
            return null;
          }

          const prompt = String(item.prompt || "").trim();
          if (!prompt) {
            return null;
          }

          return {
            title: String(item.title || `提示词 ${index + 1}`).trim(),
            intent: String(item.intent || "").trim(),
            prompt,
          };
        })
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const singlePrompt = String(value.prompt || "").trim();
  if (prompts.length > 0) {
    return prompts;
  }

  return singlePrompt
    ? [
        {
          title: String(value.title || "图片提示词").trim(),
          intent: "",
          prompt: singlePrompt,
        },
      ]
    : [];
}

function normalizePromptAgentJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型返回的 JSON 不是对象。");
  }

  const prompts = normalizePromptOptions(value);
  const prompt = String(value.prompt || prompts[0]?.prompt || "").trim();
  const referenceRoles = Array.isArray(value.reference_roles) ? value.reference_roles : [];
  const skuSubjects = normalizeSkuSubjects(value.sku_subjects || value.skuSubjects);
  const portraitReferenceRoles = normalizeStringArray(value.referenceRoles || value.reference_roles);
  const hasPortraitAnalysis =
    value.visiblePresentation !== undefined ||
    value.heightImpression !== undefined ||
    value.bodyBuild !== undefined ||
    value.faceVisibility !== undefined ||
    portraitReferenceRoles.length > 0;
  if (!prompt && referenceRoles.length === 0 && !hasPortraitAnalysis) {
    throw new Error("模型返回的 JSON 缺少 prompt 字段。");
  }

  return {
    title: String(value.title || "图片提示词").trim(),
    prompt,
    negative_prompt: String(value.negative_prompt || "").trim(),
    style_tags: normalizeStringArray(value.style_tags),
    subject: String(value.subject || "").trim(),
    scene: String(value.scene || "").trim(),
    composition: String(value.composition || "").trim(),
    lighting: String(value.lighting || "").trim(),
    color_palette: String(value.color_palette || "").trim(),
    camera: String(value.camera || "").trim(),
    aspect_ratio: String(value.aspect_ratio || "").trim(),
    notes: normalizeStringArray(value.notes),
    product_name: getDirectProductNameCandidate(value, { includeSubject: referenceRoles.length > 0 || skuSubjects.length > 0 }) ||
      getSkuSubjectProductName(value, skuSubjects),
    summary: String(value.summary || "").trim(),
    category_hint: String(value.category_hint || value.categoryHint || value.category || "").trim(),
    category_path: String(value.category_path || value.categoryPath || "").trim(),
    visual_language: normalizeCreationReferenceVisualLanguage(value.visual_language || value.visualLanguage),
    visual_language_reason: String(value.visual_language_reason || value.visualLanguageReason || "").trim(),
    image_roles: normalizeStringArray(value.image_roles),
    reference_roles: referenceRoles,
    sku_subjects: skuSubjects,
    relationship: String(value.relationship || "").trim(),
    prompts,
    risks: normalizeStringArray(value.risks),
    visiblePresentation: String(value.visiblePresentation || "unclear").trim(),
    heightImpression: String(value.heightImpression || "unclear").trim(),
    bodyBuild: String(value.bodyBuild || "unclear").trim(),
    pose: String(value.pose || "").trim(),
    clothing: String(value.clothing || "").trim(),
    hair: String(value.hair || "").trim(),
    faceVisibility: String(value.faceVisibility || "").trim(),
    distinctVisibleFeatures: normalizeStringArray(value.distinctVisibleFeatures),
    referenceRoles: portraitReferenceRoles,
    safety: String(value.safety || "").trim(),
    confidence: String(value.confidence || "").trim(),
  };
}

export function extractPromptAgentJson(payload) {
  if (typeof payload === "string") {
    return normalizePromptAgentJson(parseJsonObject(payload));
  }

  const text = collectTextParts(payload).join("\n").trim();
  if (!text) {
    throw new Error("模型响应中没有可解析的文本内容。");
  }

  return normalizePromptAgentJson(parseJsonObject(text));
}

function pickStreamText({ completedText, collectedTexts, deltaText }) {
  if (completedText.trim()) {
    return completedText.trim();
  }

  const latestCollectedText = [...collectedTexts].reverse().find((text) => text.trim());
  if (latestCollectedText) {
    return latestCollectedText.trim();
  }

  return deltaText.trim();
}

export async function consumePromptAgentSse(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let deltaText = "";
  let completedText = "";
  const collectedTexts = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const { eventName, data } = parseSseChunk(chunk);
      if (!data) {
        continue;
      }

      if (data === "[DONE]") {
        return extractPromptAgentJson(
          pickStreamText({
            completedText,
            collectedTexts,
            deltaText,
          }),
        );
      }

      const payload = JSON.parse(data);
      const resolvedEventName = eventName || payload?.type || "unknown";

      if (
        resolvedEventName === "response.output_text.delta" &&
        typeof payload.delta === "string"
      ) {
        deltaText += payload.delta;
      }

      if (
        resolvedEventName === "response.output_text.done" &&
        typeof payload.text === "string"
      ) {
        completedText = payload.text;
      }

      const parts = collectTextParts(payload);
      if (parts.length > 0) {
        collectedTexts.push(parts.join("\n"));
      }
    }
  }

  return extractPromptAgentJson(
    pickStreamText({
      completedText,
      collectedTexts,
      deltaText,
    }),
  );
}

function shouldRetryWithoutStructuredOutput(error) {
  const message = error instanceof Error ? error.message : String(error);
  const upstreamBody =
    error && typeof error === "object" && typeof error.upstreamBody === "string"
      ? error.upstreamBody
      : "";
  return /text\.format|json_schema|response_format|responseMimeType|response_mime_type|structured/i.test(`${message}\n${upstreamBody}`);
}

async function parsePromptAgentResponse(response) {
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      formatHttpErrorMessage({
        label: "图片分析请求失败",
        status: response.status,
        body,
      }),
    );
    error.upstreamBody = body;
    throw error;
  }

  const contentType = response.headers?.get("content-type") || "";
  if (response.body && /text\/event-stream/i.test(contentType)) {
    return consumePromptAgentSse(response.body);
  }

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  return extractPromptAgentJson(payload);
}

async function sendPromptAgentRequest({
  baseUrl,
  endpointPath,
  apiKey,
  imageRoute,
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  responsesModel,
  imageModel,
  reasoningEffort,
  fetchImpl,
  structuredOutput,
  strictJsonRetry,
}) {
  const normalizedRoute = normalizeImageRoute(imageRoute);
  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath, API_ENDPOINT_RESPONSES);
  const useModelProtocol = normalizedRoute === IMAGE_ROUTE_C;
  const useGeminiProtocol = useModelProtocol && isGeminiPromptAgentModel(imageModel || responsesModel);
  const useChatCompletions = !useGeminiProtocol && (useModelProtocol || normalizedEndpointPath === API_ENDPOINT_CHAT_COMPLETIONS);
  const requestEndpointPath = useGeminiProtocol
    ? API_ENDPOINT_IMAGE_GENERATIONS
    : useChatCompletions
      ? API_ENDPOINT_CHAT_COMPLETIONS
      : normalizedEndpointPath;
  const requestBody = useGeminiProtocol
    ? createPromptAgentGeminiRequestBody({
        image,
        images,
        imageLabels,
        mode,
        targetLanguage,
        targetLanguageLabel,
        responsesModel,
        imageModel,
        structuredOutput,
        strictJsonRetry,
      })
    : useChatCompletions
      ? createPromptAgentChatCompletionsRequestBody({
          image,
          images,
          imageLabels,
          mode,
          targetLanguage,
          targetLanguageLabel,
          responsesModel: responsesModel || imageModel,
          structuredOutput,
          strictJsonRetry,
        })
      : createPromptAgentRequestBody({
          image,
          images,
          imageLabels,
          mode,
          targetLanguage,
          targetLanguageLabel,
          responsesModel,
          reasoningEffort,
          structuredOutput,
          strictJsonRetry,
        });

  const response = await fetchImpl(appendApiEndpointPath(baseUrl, requestEndpointPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: useGeminiProtocol || useChatCompletions ? "application/json" : "text/event-stream",
    },
    body: JSON.stringify(requestBody),
  });

  return parsePromptAgentResponse(response);
}

async function sendPromptAgentRequestWithStructuredFallback(options) {
  try {
    return await sendPromptAgentRequest({
      ...options,
      structuredOutput: true,
    });
  } catch (error) {
    if (!shouldRetryWithoutStructuredOutput(error)) {
      throw error;
    }

    return sendPromptAgentRequest({
      ...options,
      structuredOutput: false,
    });
  }
}

export async function requestPromptAgentAnalysis({
  baseUrl,
  endpointPath,
  apiKey,
  imageRoute,
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  responsesModel,
  imageModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
}) {
  const options = {
    baseUrl,
    endpointPath,
    apiKey,
    imageRoute,
    image,
    images,
    imageLabels,
    mode,
    targetLanguage,
    targetLanguageLabel,
    responsesModel,
    imageModel,
    reasoningEffort,
    fetchImpl,
  };

  try {
    return await sendPromptAgentRequestWithStructuredFallback({
      ...options,
      strictJsonRetry: false,
    });
  } catch (error) {
    if (!isPromptAgentJsonParseError(error)) {
      throw error;
    }

    return sendPromptAgentRequestWithStructuredFallback({
      ...options,
      strictJsonRetry: true,
    });
  }
}
