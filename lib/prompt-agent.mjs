import { DEFAULT_REASONING_EFFORT, MAX_CREATION_REFERENCE_IMAGES } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { buildReferenceAnalysisLanguagePromptGuidance } from "./reference-analysis-language.mjs";
import { normalizeCreationAudienceStrategy } from "./creation-platform-resolver.mjs";
import { normalizeCreationSkuColorLabels } from "./creation-sku-colors.mjs";
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

const PROMPT_AGENT_INSTRUCTION = `你是一个图片提示词逆向工程 agent。请分析用户上传的图片，返回一份能复刻该图片视觉效果的结构化中文生图 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释；顶层只能包含 subject、framing、scene、visual、avoid。
2. subject 详细记录主体类型、姿态或状态、表情、可见外观、服装和与物体的交互。图片不适用的字符串返回空字符串，列表返回空数组，不要编造内容。
3. framing 必须详细记录画幅比例、景别、主体占画面比例、画面位置、负空间、前景框景、相机建议、机位角度、裁切、透视和景深。主体占比和位置尽量使用近似百分比或可复核的画面关系。
4. camera 必须给出一个明确且单一的全画幅等效建议焦段，并同时写出与画面匹配的建议拍摄距离、光圈和对焦目标。没有可靠 EXIF 时仍需选择最利于复刻的具体焦段，但只能作为生成建议，不得声称是原图 EXIF 或原始元数据。
5. scene 用一段精简文字描述背景环境和关键物体；visual 用一段精简文字合并光线、色彩、清晰度、媒介或摄影质感。
6. avoid 只列与当前图片容易生成错误的具体偏差，例如改变景别、主体占比、裁切、姿态、关键物体或景深；不要写“低质量、最差质量”等通用词。
7. 每项视觉信息只出现一次并放入最合适的字段；不得增加完整 prompt、title、summary、style_tags、notes 等重复汇总字段，不得用同义短语重复同一细节。
8. 只保留会改变可见画面、影响最终像素的具体描述。删除“精美”“高级”“震撼”“顶级”“杰作”“氛围感”等空泛质量修饰词，不要堆叠近义形容词。
9. 不要输出主图、详情页、SKU、直播、移动端缩略图等用途建议，不要评价图片适合做什么，也不要提供融合或改图建议。
10. 不要编造图片中不存在的品牌、文字、人名或敏感身份。`;

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
4. role 只能是 product、package、material、dimensions、usage、scene、other：
   - product = 商品主体，仅用于独立白底主图、正面主体图、可售 SKU 色款或需要作为商品身份锚点的清晰主体图。
   - package = 包装清单，用于锁定包装、配件、套装和用户实际收到的物品。
   - material = 结构细节，用于锁定材质质感、纹理、表面、边缘工艺、外观结构、功能卖点、结构表现、部件标注和细节说明；不要当成商品主体或单独可售 SKU。
   - dimensions = 尺寸规格，用于锁定规格表、尺码卡、长度、重量、容量、钩号、型号、兼容性等可见数值；不要当成单独可售 SKU。
   - usage = 使用说明，用于锁定安装、装配、操作、充电、连接、接线、正负极、步骤、注意事项和说明性箭头标注；不要当成商品主体或单独可售 SKU。
   - scene = 使用场景，用于锁定环境、尺度、使用方式和生活化摆放。
   - other = 仅在无法归类时使用。
4.1 如果图片主要展示包装清单、配件、套装、内含物或用户实际收到的物品，必须选择 role=package；即使同时出现尺寸、型号、重量、长度等规格数字，也不要改成 dimensions。
5. 如果图片是规格表、尺寸卡、参数图或主要展示长度、重量、容量、钩号、型号等文字，必须选择 role=dimensions，并在 note 中逐项抄写所有可辨认的具体规格，保留原始数字、单位和符号，例如“型号 F4J16、长度 13cm、重量 42g、钩号 2#”；看不清的文字写入 risks，不能只写“长度感”“比例”等概括。
6. 如果图片是使用说明、操作指南、充电指南、安装步骤、连接/接线示意、正负极标注、注意事项或用箭头/编号说明如何使用，必须选择 role=usage；即使图中出现商品，也不要归为 product，也不要为它创建 sku_subjects。
6.1 如果图片主要是外观结构说明、功能卖点拆解、部件/结构标注、材质纹理放大、细节说明、LED/电池/钢珠/螺旋桨等功能结构表现，必须选择 role=material；即使图中有完整商品，也不要归为 product，也不要为它创建 sku_subjects。
7. note 用一句简体中文说明这张图最应该影响什么，便于后续生成提示词引用。
8. category_hint 写出最可能的四级类目名称；如果无法判断到四级类目，返回空字符串。
9. category_path 写出可判断的完整类目路径；如果无法判断，返回空字符串。
10. risks 写出不确定点，例如产品身份不清、包装缺失、参考图互相冲突或文字不可辨认。
11. 根据用户选择的平台和识别到的商品类型，补充哪些参考信息最适合用于平台化套图生成，例如主图识别、详情页信息、SKU 对比、直播讲解、移动端缩略图或规格核对；不要输出视觉语言建议。
12. audience_strategy 只描述与商品使用或购买决策直接相关的非敏感目标语境、购买动机、购买顾虑、期望结果、证据依据和置信度；不得从人物外观推断年龄、性别、种族、民族、国籍、宗教、健康、残障、怀孕、性取向、收入或其他敏感属性，不得使用地域或文化刻板印象。
13. audience_strategy 中的动机、顾虑、结果和证据必须来自用户提供的商品事实、可见商品/使用证据以及平台与类目上下文；证据不足时使用通用类目买家、confidence=low 和 source=analysis-suggestion，不得编造性能、认证、价格、销量、保证、评价或效果。`;

const CREATION_REFERENCE_ANALYSIS_SKU_INSTRUCTION = [
  "SKU grouping: also return sku_subjects. Each sku_subjects item must represent one sellable product subject group for one added SKU image.",
  "If one product-subject reference image contains multiple complete visible product units, colorways, finishes, or model variants, keep those units together as one sku_subject that uses that source filename; do not split them into multiple sku_subjects.",
  "Set sku_subjects[].subject_unit_count to the exact number of complete visible product units inside that grouped subject; use 1 only when the subject reference shows one complete product unit.",
  "For every sku_subject, return sku_subjects[].color_names with exactly one concise English pure-color label per complete visible product unit, in the same left-to-right or top-to-bottom order as those units. Each unit label may contain color names, spaces, and internal hyphens only, for example brown black silver or off-white. Preserve a hyphen inside a recognized compound color name. Separate colors with single spaces and never use a hyphen as a separator between independent colors. Use no other punctuation: no commas, quotation marks, slashes, brackets, bullets, or other symbols. It must not include component names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or any other non-color text. Keep all reliable colors for one product unit together inside one array string, including neutral colors shared by variants, but omit the associated part words. Do not split one unit's colors into multiple color_names items. Exclude the white/transparent background, shadows, highlights, environmental reflections, source-card text, and uncertain colors. If safe pure-color labels cannot be supplied for every complete unit in the group, return an empty color_names array and never guess.",
  "Distinguish visibly different colorways precisely, for example navy blue versus cyan or sky blue, and orange versus red; never copy an unrelated visible word such as white as the color result.",
  "In sku_subjects[].note, explicitly record the visible product unit count and the visible differences that must be preserved in the one SKU image. Group multiple photos of the same subject group into one item.",
  "Ordinary white-background SKU/colorway images, including source images that show two or more complete products in one frame, must use role=product and not role=reference-product.",
  "Use role=reference-product only for exactly one optional 参考主体 image when the image is explicitly the set-wide primary subject anchor; it keeps the same generation mode as role=product and must still be treated as a product subject for SKU grouping and generation references. Use role=product for ordinary 商品主体 images and additional sellable SKU subjects.",
  "For product and reference-product roles, reference_roles[].note must include the same exact visible product unit count that you put in sku_subjects[].subject_unit_count and sku_subjects[].note whenever the source image shows multiple complete product units.",
  "Never describe two stacked, side-by-side, top/bottom, or paired complete lures as 1 unit; 当同一张白底商品主体图里有上下、左右或成对的两个完整路亚/鱼饵时，reference_roles[].note 和 sku_subjects[].note 都必须写清“2 个完整产品单位”，不要写成“单个”或“单一”，也不要写“画面为1个完整产品单体”或“画面为1个完整产品单位”.",
  "Use role=package for package lists, packaging, included items, accessories, bundles, or what the shopper receives, even if the same image contains size, model, length, or weight text.",
  "Use role=dimensions for size charts, specification tables, size cards, specification-feel references, or references focused on length, weight, capacity, measurements, hooks, model numbers, or compatibility.",
  "Use role=usage for instruction guides, user manuals, setup steps, operation diagrams, charging guides, connection/polarity diagrams, positive/negative terminal callouts, or caution/step labels.",
  "Use role=material for exterior-structure callouts, feature selling-point callouts, annotated component/detail diagrams, material texture references, and references focused on visible structure details rather than a sellable SKU.",
  "Treat text outside the physical product as non-subject overlay: ignore corner badges, stickers, price tags, product-card captions, bottom SKU/color text blocks, title bars, watermarks, and words such as 2025 NEW or WHITE EDIT when deciding what the SKU subject must preserve.",
  "sku_subjects[].note should describe only the sellable product subject group plus intrinsic product-surface logos, model identifiers, markings, materials, color, shape, structure, and visible product unit count.",
  "When role=dimensions, transcribe every readable model, size, weight, hook number, capacity, and compatibility value into reference_roles[].note.",
  "Do not create SKU subjects for accessories, packaging-only images, material/detail/structure-only closeups, feature selling-point references, dimensions/specification/size-chart references, usage/instruction references, scenes.",
].join(" ");

const CREATION_REFERENCE_ANALYSIS_PRODUCT_NAME_INSTRUCTION =
  "Product naming: first identify the main sellable product subject in the reference set, then put that subject name in product_name. product_name must be the analyzed subject's concise ecommerce product name, not a category path or a generic word like product. Do not include brand names in product_name, even if they are visibly readable. Retain a model identifier only when it is part of the product identity; otherwise return a concise generic ecommerce product name such as 'jointed fishing lure'. Do not leave product_name empty.";

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
  required: ["subject", "framing", "scene", "visual", "avoid"],
  properties: {
    subject: {
      type: "object",
      additionalProperties: false,
      required: ["type", "pose", "expression", "appearance", "clothing", "interaction"],
      properties: {
        type: {
          type: "string",
          description: "画面主要人物、商品、动物、建筑或其他核心对象的简洁类型。",
        },
        pose: {
          type: "string",
          description: "主体的姿态、朝向、动作；静物则描述摆放方式和可见状态。",
        },
        expression: {
          type: "string",
          description: "人物或动物的可见表情；不适用时返回空字符串。",
        },
        appearance: {
          type: "array",
          items: { type: "string" },
          description: "逐项记录会影响复原的外观、形状、颜色、材质和细节。",
        },
        clothing: {
          type: "string",
          description: "可见服装、鞋履和佩戴物；不适用时返回空字符串。",
        },
        interaction: {
          type: "string",
          description: "主体与手机、道具、家具、其他主体或环境的可见交互；没有时返回空字符串。",
        },
      },
    },
    framing: {
      type: "object",
      additionalProperties: false,
      required: [
        "aspect_ratio",
        "shot_size",
        "subject_scale",
        "placement",
        "negative_space",
        "foreground_frame",
        "camera",
        "angle",
        "crop",
        "perspective",
        "depth_of_field",
      ],
      properties: {
        aspect_ratio: {
          type: "string",
          description: "原图或最接近原图构图的明确横竖画幅比例。",
        },
        shot_size: {
          type: "string",
          description: "准确景别及入镜范围，例如带大量环境的全身远景或紧凑头肩近景。",
        },
        subject_scale: {
          type: "string",
          description: "主体高度、宽度或关键部位约占画面的百分比。",
        },
        placement: {
          type: "string",
          description: "主体中心和关键部位在画面中的具体位置，可使用近似百分比或三分法关系。",
        },
        negative_space: {
          type: "string",
          description: "画面留白的位置与约占比例；没有明显留白时返回空字符串。",
        },
        foreground_frame: {
          type: "string",
          description: "前景遮挡、门窗框、枝叶等框景关系及其清晰程度；没有时返回空字符串。",
        },
        camera: {
          type: "string",
          description: "用于生成复刻的相机建议：一个明确且单一的全画幅等效焦段，并包含匹配的拍摄距离、光圈和对焦目标；无可靠 EXIF 时不得冒充原始参数。",
        },
        angle: {
          type: "string",
          description: "机位高度、俯仰、正侧方向和是否隔着前景拍摄。",
        },
        crop: {
          type: "string",
          description: "画面边缘保留或截断的主体部位、环境物体和框体。",
        },
        perspective: {
          type: "string",
          description: "广角、中焦或长焦形成的空间展开、压缩和比例特征。",
        },
        depth_of_field: {
          type: "string",
          description: "对焦区域，以及前景、主体和背景分别清晰或虚化的关系。",
        },
      },
    },
    scene: {
      type: "string",
      description: "用一段精简中文描述背景环境、空间和会影响复原的关键物体。",
    },
    visual: {
      type: "string",
      description: "用一段精简中文合并光线、色彩、清晰度、媒介和摄影质感。",
    },
    avoid: {
      type: "array",
      items: { type: "string" },
      description: "仅列出针对当前图片的高影响复原偏差，不包含通用质量词。",
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
  required: ["summary", "product_name", "category_hint", "category_path", "reference_roles", "sku_subjects", "audience_strategy", "risks"],
  properties: {
    summary: {
      type: "string",
      description: "一句话概括本组套图参考图的商品信息、可用素材和主要限制。",
    },
    product_name: {
      type: "string",
      minLength: 1,
      description: "The identified main sellable product subject name to fill the Creation Mode product name field. Use the analyzed subject's concise ecommerce product name, not a category path. Do not include brand names, even when they are visibly readable; retain a model identifier only when it is part of the product identity.",
    },
    category_hint: {
      type: "string",
      description: "最可能匹配的四级类目名称；无法判断时返回空字符串。",
    },
    category_path: {
      type: "string",
      description: "最可能匹配的完整类目路径；无法判断时返回空字符串。",
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
            enum: ["product", "reference-product", "package", "material", "dimensions", "usage", "scene", "other"],
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
        required: ["id", "title", "reference_indexes", "filenames", "subject_unit_count", "color_names", "note"],
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
          color_names: {
            type: "array",
            minItems: 0,
            maxItems: 20,
            items: { type: "string" },
            description: "Exactly one concise English pure-color label per complete visible product unit, ordered left-to-right or top-to-bottom, or an empty array when safe labels are unavailable for the complete group. Each label may contain multiple reliable colors but only color names, spaces, and internal hyphens inside recognized compound colors such as off-white. Use single spaces between independent colors; do not use hyphens as color separators or include commas, quotation marks, slashes, brackets, bullets, or other punctuation. Do not include component names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or other non-color text. Preserve each complete unit label as one array item. Exclude backgrounds, shadows, highlights, environmental reflections, overlay text, and uncertain colors.",
          },
          note: {
            type: "string",
            description: "What must be preserved for this SKU image subject group, including visible product unit count when one source image contains multiple complete product units; exclude source-image overlay text outside the physical product.",
          },
        },
      },
      description: "Distinct sellable product subjects that should receive added SKU background images.",
    },
    audience_strategy: {
      type: "object",
      additionalProperties: false,
      required: ["target_audience", "purchase_motivations", "purchase_objections", "desired_outcome", "evidence_basis", "confidence", "source"],
      properties: {
        target_audience: {
          type: "string",
          description: "Non-sensitive product-use or purchase context, never an inferred protected demographic.",
        },
        purchase_motivations: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Evidence-backed purchase motivations from supplied product facts or visible use context.",
        },
        purchase_objections: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Conservative buyer uncertainties that the supplied evidence can address.",
        },
        desired_outcome: {
          type: "string",
          description: "Buyer outcome supported by the supplied facts without invented claims.",
        },
        evidence_basis: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Supplied or visible facts supporting the audience suggestion.",
        },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        source: { type: "string", enum: ["analysis-suggestion"] },
      },
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

  if (!mode) {
    return `待分析图片 ${index + 1}：${filename}。请只根据这张图片反推一份主体和景别详细、背景与视觉精简且无同义重复的结构化生图 JSON。`;
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
  contextPrompt = "",
  strictJsonRetry = false,
} = {}) {
  const normalizedImages = normalizeImages({ image, images });
  const content = [
    {
      type: "input_text",
      text: getPromptAgentInstruction(mode, targetLanguage, targetLanguageLabel),
    },
    ...(String(contextPrompt || "").trim()
      ? [
          {
            type: "input_text",
            text: String(contextPrompt || "").trim(),
          },
        ]
      : []),
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
  contextPrompt,
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
      contextPrompt,
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
  contextPrompt,
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
      contextPrompt,
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
  contextPrompt,
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
      contextPrompt,
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
          const hasStructuredColorNames = Array.isArray(item.color_names) || Array.isArray(item.colorNames);
          const rawColorNames = item.color_names ?? item.colorNames ?? item.color_name ?? item.colorName ?? item.colors ?? item.colours;
          const subjectUnitCount = Math.max(
            normalizeSubjectUnitCount(
              item.subject_unit_count ?? item.subjectUnitCount ?? item.visible_unit_count ?? item.visibleUnitCount ?? item.unit_count ?? item.unitCount,
            ),
            inferSubjectUnitCount([title, note].join(" ")),
          );
          const colorNames = normalizeCreationSkuColorLabels(rawColorNames, subjectUnitCount > 1);

          if (!id && filenames.length === 0) {
            return null;
          }

          return {
            id,
            title,
            reference_indexes: referenceIndexes,
            filenames,
            subject_unit_count: subjectUnitCount,
            ...(hasStructuredColorNames || colorNames.length > 0 ? { color_names: colorNames } : {}),
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

function normalizeStructuredImagePromptJson(value) {
  const subject = value?.subject;
  const framing = value?.framing;
  const hasStructuredShape =
    subject &&
    typeof subject === "object" &&
    !Array.isArray(subject) &&
    framing &&
    typeof framing === "object" &&
    !Array.isArray(framing) &&
    Object.hasOwn(value, "scene") &&
    Object.hasOwn(value, "visual") &&
    Object.hasOwn(value, "avoid");

  if (!hasStructuredShape) {
    return null;
  }

  return {
    subject: {
      type: String(subject.type || "").trim(),
      pose: String(subject.pose || "").trim(),
      expression: String(subject.expression || "").trim(),
      appearance: normalizeStringArray(subject.appearance),
      clothing: String(subject.clothing || "").trim(),
      interaction: String(subject.interaction || "").trim(),
    },
    framing: {
      aspect_ratio: String(framing.aspect_ratio || "").trim(),
      shot_size: String(framing.shot_size || "").trim(),
      subject_scale: String(framing.subject_scale || "").trim(),
      placement: String(framing.placement || "").trim(),
      negative_space: String(framing.negative_space || "").trim(),
      foreground_frame: String(framing.foreground_frame || "").trim(),
      camera: String(framing.camera || "").trim(),
      angle: String(framing.angle || "").trim(),
      crop: String(framing.crop || "").trim(),
      perspective: String(framing.perspective || "").trim(),
      depth_of_field: String(framing.depth_of_field || "").trim(),
    },
    scene: String(value.scene || "").trim(),
    visual: String(value.visual || "").trim(),
    avoid: normalizeStringArray(value.avoid),
  };
}

function normalizePromptAgentJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型返回的 JSON 不是对象。");
  }

  const structuredImagePrompt = normalizeStructuredImagePromptJson(value);
  if (structuredImagePrompt) {
    return structuredImagePrompt;
  }

  const prompts = normalizePromptOptions(value);
  const prompt = String(value.prompt || prompts[0]?.prompt || "").trim();
  const referenceRoles = Array.isArray(value.reference_roles) ? value.reference_roles : [];
  const skuSubjects = normalizeSkuSubjects(value.sku_subjects || value.skuSubjects);
  const portraitReferenceRoles = normalizeStringArray(value.referenceRoles || value.reference_roles);
  const rawAudienceStrategy = value.audience_strategy || value.audienceStrategy;
  const normalizedAudienceStrategy = normalizeCreationAudienceStrategy(rawAudienceStrategy && typeof rawAudienceStrategy === "object" && !Array.isArray(rawAudienceStrategy) ? { ...rawAudienceStrategy, source: "analysis-suggestion" } : {}, { defaultSource: "analysis-suggestion" });
  const audienceStrategy = Object.keys(normalizedAudienceStrategy).length > 0 ? {
    target_audience: normalizedAudienceStrategy.targetAudience,
    purchase_motivations: normalizedAudienceStrategy.purchaseMotivations,
    purchase_objections: normalizedAudienceStrategy.purchaseObjections,
    desired_outcome: normalizedAudienceStrategy.desiredOutcome,
    evidence_basis: normalizedAudienceStrategy.evidenceBasis,
    confidence: normalizedAudienceStrategy.confidence,
    source: "analysis-suggestion",
  } : undefined;
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
    image_roles: normalizeStringArray(value.image_roles),
    reference_roles: referenceRoles,
    sku_subjects: skuSubjects,
    ...(audienceStrategy ? { audience_strategy: audienceStrategy } : {}),
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
  contextPrompt,
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
        contextPrompt,
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
          contextPrompt,
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
          contextPrompt,
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
  contextPrompt,
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
    contextPrompt,
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
