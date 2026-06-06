import {
  CREATION_INDUSTRY_TEMPLATE_OPTIONS,
  getCreationIndustryTemplateRolePreset,
  normalizeCreationIndustryTemplate as normalizeCreationIndustryTemplateOption,
} from "./creation-category-templates.mjs";
import { CREATION_REFERENCE_PRODUCT_ROLE, isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";
import { MAX_CREATION_REFERENCE_IMAGES } from "./studio-constants.mjs";

export { CREATION_INDUSTRY_TEMPLATE_OPTIONS };

export const CREATION_TARGET_LANGUAGE_OPTIONS = [
  {
    value: "zh-CN",
    label: "简体中文",
    promptInstruction: "使用简体中文短营销文案，图中文字控制在 2 到 8 个汉字，品牌名、型号、数字和单位保持原样。",
  },
  {
    value: "en",
    label: "English",
    promptInstruction: "Use concise English marketing copy, keep image text to 2-6 words, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "ja",
    label: "日本語",
    promptInstruction: "Use concise Japanese marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "ko",
    label: "한국어",
    promptInstruction: "Use concise Korean marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "fr",
    label: "Français",
    promptInstruction: "Use concise French marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "de",
    label: "Deutsch",
    promptInstruction: "Use concise German marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "es",
    label: "Español",
    promptInstruction: "Use concise Spanish marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
];

export const CREATION_IMAGE_COUNT_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 18];
const DEFAULT_CREATION_IMAGE_COUNT = 18;
const DEFAULT_CREATION_TARGET_LANGUAGE = "en";
const DEFAULT_CREATION_DIMENSION_UNIT_MODE = "both";
const DEFAULT_CREATION_VISUAL_LANGUAGE = "classic-commercial";
const DEFAULT_CREATION_LOGO_PLACEMENT = "top-left";
const DEFAULT_CREATION_SKU_BUNDLE_COUNT = 1;
const MAX_CREATION_SKU_BUNDLE_COUNT = 20;

export const CREATION_SKU_GENERATION_RULE_OPTIONS = [
  {
    value: "none",
    label: "无",
    includePackageList: false,
    includeDimensions: false,
  },
  {
    value: "package-list",
    label: "添加包装清单",
    includePackageList: true,
    includeDimensions: false,
  },
  {
    value: "dimensions",
    label: "添加尺寸",
    includePackageList: false,
    includeDimensions: true,
  },
  {
    value: "package-list-dimensions",
    label: "添加包装清单和尺寸",
    includePackageList: true,
    includeDimensions: true,
  },
];

export const CREATION_DIMENSION_UNIT_MODE_OPTIONS = [
  {
    value: "metric",
    label: "公制",
    promptInstruction: "Render all recognized dimension values in metric units only.",
  },
  {
    value: "imperial",
    label: "英制",
    promptInstruction: "Render all recognized dimension values in imperial units only.",
  },
  {
    value: "both",
    label: "公制和英制",
    promptInstruction: "Render each recognized dimension value with metric first and imperial in parentheses.",
  },
];

export const CREATION_LOGO_PLACEMENT_OPTIONS = [
  { value: "top-left", label: "左上", promptPosition: "top-left corner" },
  { value: "top-center", label: "上中", promptPosition: "top-center edge" },
  { value: "top-right", label: "右上", promptPosition: "top-right corner" },
  { value: "center-left", label: "左中", promptPosition: "center-left edge" },
  { value: "center", label: "居中", promptPosition: "center of the image" },
  { value: "center-right", label: "右中", promptPosition: "center-right edge" },
  { value: "bottom-left", label: "左下", promptPosition: "bottom-left corner" },
  { value: "bottom-center", label: "下中", promptPosition: "bottom-center edge" },
  { value: "bottom-right", label: "右下", promptPosition: "bottom-right corner" },
];

export const CREATION_LOGO_BACKGROUND_OPTIONS = [
  {
    value: "transparent",
    label: "透明底，直接放置",
    promptInstruction: "Treat the supplied reference as a transparent logo and place the transparent logo directly.",
  },
  {
    value: "remove-background",
    label: "非透明底，先抠图",
    promptInstruction: "First remove the logo reference background and isolate only the logo mark, then place it.",
  },
];

export const CREATION_SCENARIO_OPTIONS = [
  {
    value: "standard",
    label: "标准电商",
    promptInstruction: "Balanced ecommerce scenario: cover hero, benefits, lifestyle, and trust-building product proof for a marketplace listing.",
  },
  {
    value: "detail-page",
    label: "详情页转化",
    promptInstruction: "Detail-page conversion scenario: build modular images for product-detail pages, with clear feature hierarchy and purchase confidence.",
  },
  {
    value: "social-seeding",
    label: "社媒种草",
    promptInstruction: "Social seeding scenario: make the set feel native to lifestyle feeds while keeping the product accurate and commercially useful.",
  },
  {
    value: "launch",
    label: "新品发布",
    promptInstruction: "New product launch scenario: create a launch-ready visual story with discovery, key promise, usage context, and credibility.",
  },
  {
    value: "promotion",
    label: "活动促销",
    promptInstruction: "Promotion campaign scenario: create campaign assets with offer clarity, urgency, product value, and clean conversion-focused layouts.",
  },
  {
    value: "livestream",
    label: "直播电商",
    promptInstruction: "Live commerce scenario: prioritize clear selling points, demo-ready composition, host callouts, urgency, and product proof without clutter.",
  },
  {
    value: "gift-guide",
    label: "礼品推荐",
    promptInstruction: "Gift guide scenario: frame the product as a thoughtful gift with occasion, recipient fit, package appeal, and purchase confidence.",
  },
  {
    value: "marketplace-search",
    label: "平台搜索",
    promptInstruction: "Marketplace search scenario: make the product instantly understandable in crowded listings, with strong subject separation and quick benefit recognition.",
  },
  {
    value: "brand-story",
    label: "品牌故事",
    promptInstruction: "Brand story scenario: connect product craft, material, origin, values, and everyday usage into a coherent ecommerce visual narrative.",
  },
];

export const CREATION_VISUAL_LANGUAGE_OPTIONS = [
  {
    value: "classic-commercial",
    label: "经典商业摄影",
    promptInstruction:
      "Use classic commercial product photography: clean product-first ecommerce composition, polished but neutral lighting, controlled realistic shadows, clear material rendering, restrained props, and dependable catalog-ready framing.",
  },
  {
    value: "premium-studio",
    label: "高端棚拍",
    promptInstruction:
      "Use a deep controlled studio set with visible softbox shaping, sculpted rim highlights, precise reflection control, premium plinths or seamless sweep surfaces, and a luxury catalog mood.",
  },
  {
    value: "reference-style",
    label: "参考模式",
    promptInstruction:
      "Use the uploaded style reference images as the style authority: match their lighting, color grading, surface mood, camera language, background atmosphere, realism level, and composition rhythm while preserving the product subject from the product references or product brief. Do not copy the style reference subject, product identity, logo, text, packaging, or exact layout.",
  },
  {
    value: "clean-marketplace",
    label: "平台清爽白底",
    promptInstruction:
      "Use a pure white or near-white marketplace system with crisp cutout-like subject separation, very soft contact shadows, no lifestyle props, high readability, and thumbnail-safe marketplace composition.",
  },
  {
    value: "lifestyle-editorial",
    label: "生活方式杂志",
    promptInstruction:
      "Use a lifestyle magazine editorial look with a magazine-like lived-in environment, natural window or location light, human-scale context, curated editorial props, subtle depth of field, and polished but believable lifestyle restraint.",
  },
  {
    value: "social-ugc",
    label: "社媒实拍",
    promptInstruction:
      "Use phone-camera creator realism: casual handheld framing, everyday room or tabletop context, slightly imperfect natural light, authentic social-feed immediacy, and product-first clarity without studio polish.",
  },
  {
    value: "detail-infographic",
    label: "详情页信息图",
    promptInstruction:
      "Use a modular ecommerce information layout with panel blocks, callout lines, clear label zones, icon-like detail elements, structured hierarchy, and product-detail page readability.",
  },
  {
    value: "macro-material",
    label: "微距材质",
    promptInstruction:
      "Use a texture-led macro crop with close-range surface detail, raking side light, tactile material emphasis, shallow depth of field, and frame-filling craft or finish cues.",
  },
  {
    value: "outdoor-context",
    label: "户外场景",
    promptInstruction:
      "Use real outdoor environmental light with natural shadows, terrain or weather-aware surfaces, practical usage placement, credible activity context, and clear scale cues from the environment.",
  },
  {
    value: "minimal-luxury",
    label: "极简奢华",
    promptInstruction:
      "Use quiet luxury negative space with restrained neutral palettes, precise asymmetrical composition, refined stone/acrylic/metal surfaces, soft premium shadows, and minimal high-value presentation.",
  },
  {
    value: "bold-campaign",
    label: "活动海报",
    promptInstruction:
      "Use a poster-grade campaign composition with bolder graphic hierarchy, saturated accent fields, dynamic product angles, decisive silhouettes, energetic rim light, and campaign-ready copy zones.",
  },
  {
    value: "warm-handcrafted",
    label: "手作温度",
    promptInstruction:
      "Use a warm tactile handcrafted setting with wood, linen, paper, clay, or handmade surfaces, amber window light, gentle imperfections, human craft cues, and small-brand ecommerce warmth.",
  },
];

export const CREATION_REFERENCE_ROLE_OPTIONS = [
  {
    value: "product",
    label: "商品主体",
    promptLabel: "product subject",
    promptInstruction: "Preserve the product shape, proportions, color, markings, and visible structure.",
  },
  {
    value: "reference-product",
    label: "参考主体",
    promptLabel: "reference subject",
    promptInstruction: "Use it as the primary subject anchor with the same subject-generation mode as a product subject; preserve shape, proportions, color, markings, and visible structure.",
  },
  {
    value: "package",
    label: "包装清单",
    promptLabel: "package-list content and included items",
    promptInstruction: "Use it to read package-list content, bundle contents, included accessories, quantities, and what the shopper receives; do not copy package-box exterior appearance unless the current image role is explicitly a package/list image.",
  },
  {
    value: "material",
    label: "结构细节",
    promptLabel: "detail and structure reference",
    promptInstruction: "Use it to preserve material texture, finish, seams, surface detail, visible external structure, feature callouts, and annotated detail accuracy; do not treat it as a sellable product subject.",
  },
  {
    value: "dimensions",
    label: "尺寸规格",
    promptLabel: "dimensions and specifications",
    promptInstruction: "Use it only for size charts, measurements, capacity, weight, compatibility, and specification values; do not treat it as a sellable product subject.",
  },
  {
    value: "usage",
    label: "使用说明",
    promptLabel: "usage instructions",
    promptInstruction: "Use it only for setup, operation, charging, connection, assembly, steps, safety notes, and instruction callouts; do not treat it as a sellable product subject.",
  },
  {
    value: "scene",
    label: "使用场景",
    promptLabel: "usage scene",
    promptInstruction: "Use it as context for realistic placement, scale, environment, and usage behavior.",
  },
  {
    value: "style",
    label: "风格参考",
    promptLabel: "visual style reference",
    promptInstruction: "Use it for lighting, framing, mood, background style, and composition rhythm without copying unrelated objects.",
  },
  {
    value: "other",
    label: "其他",
    promptLabel: "supporting reference",
    promptInstruction: "Use it only where it helps product accuracy or ecommerce composition.",
  },
];

export const CREATION_ITEM_ROLES = [
  {
    role: "hero",
    title: "主图",
    filenameToken: "hero",
    brief: "clean ecommerce hero image with the product as the clear visual subject",
  },
  {
    role: "benefit",
    title: "卖点图",
    filenameToken: "benefit",
    brief: "pain-point-driven benefit image that shows one or two selling points solving concrete shopper problems",
  },
  {
    role: "scene",
    title: "场景图",
    filenameToken: "scene",
    brief: "photorealistic product-in-use scene that shows the product's true environment, scale, and context-specific action",
  },
  {
    role: "detail-trust",
    title: "详情信任图",
    filenameToken: "trust",
    brief: "detail and trust image that emphasizes material, structure, package, comparison, or quality proof",
  },
  {
    role: "comparison",
    title: "对比图",
    filenameToken: "compare",
    brief: "comparison image that makes the product advantage easy to understand without clutter",
  },
  {
    role: "social-proof",
    title: "种草图",
    filenameToken: "social",
    brief: "photorealistic real-person social-feed recommendation image that uses a real adult person or angler as supporting lifestyle context while the original product stays dominant",
  },
  {
    role: "package",
    title: "包装清单图",
    filenameToken: "package",
    brief: "package and included-items image that clarifies what the shopper receives",
  },
  {
    role: "promotion",
    title: "活动图",
    filenameToken: "promo",
    brief: "promotion image for campaign traffic with clear offer space and strong product visibility",
  },
  {
    role: "material-closeup",
    title: "材质细节图",
    filenameToken: "material",
    brief: "multi-window material detail image that analyzes texture, finish, joints, edges, surface detail, and quality cues",
  },
  {
    role: "usage-steps",
    title: "使用步骤图",
    filenameToken: "steps",
    brief: "how to use image with simple step-by-step product operation, setup, cleaning, or assembly guidance",
  },
  {
    role: "dimensions",
    title: "尺寸规格图",
    filenameToken: "size",
    brief: "dimensions and specification image that makes scale, capacity, size, compatibility, and key numbers easy to compare",
  },
  {
    role: "review-qa",
    title: "口碑问答图",
    filenameToken: "qa",
    brief: "review and shopper Q&A image that answers common purchase concerns with credible proof and concise ecommerce copy",
  },
  {
    role: "feature-callout",
    title: "功能拆解图",
    filenameToken: "feature",
    brief: "exploded feature callout image that maps the product's key parts, mechanisms, and shopper-facing functions",
  },
  {
    role: "variant-matrix",
    title: "变体矩阵图",
    filenameToken: "variants",
    brief: "variant matrix image that organizes colors, sizes, packs, or SKU choices into a clean comparison grid",
  },
  {
    role: "compatibility",
    title: "适配兼容图",
    filenameToken: "compat",
    brief: "compatibility fit image that clarifies what the product fits, works with, or should be selected for",
  },
  {
    role: "care-guide",
    title: "保养维护图",
    filenameToken: "care",
    brief: "care and maintenance image that shows cleaning, storage, replacement, or upkeep steps without clutter",
  },
  {
    role: "brand-story",
    title: "品牌故事图",
    filenameToken: "brand",
    brief: "brand story image that connects product craft, origin, values, and daily use into one credible ecommerce narrative",
  },
  {
    role: "image-decomposition",
    title: "图片拆解图",
    filenameToken: "decompose",
    brief: "annotated component breakdown poster that decomposes visible parts, materials, surfaces, and shopper-facing structure around the product",
  },
];

export const CREATION_SCENARIO_ROLE_PRESETS = {
  standard: ["hero", "benefit", "scene", "detail-trust"],
  "detail-page": [
    "hero",
    "benefit",
    "detail-trust",
    "material-closeup",
    "dimensions",
    "usage-steps",
    "comparison",
    "package",
  ],
  "social-seeding": ["hero", "scene", "social-proof", "benefit", "review-qa", "promotion"],
  launch: ["hero", "benefit", "scene", "material-closeup", "package", "social-proof", "dimensions", "promotion"],
  promotion: ["hero", "benefit", "comparison", "promotion", "package", "review-qa"],
  livestream: [
    "hero",
    "benefit",
    "scene",
    "usage-steps",
    "detail-trust",
    "comparison",
    "promotion",
    "social-proof",
    "review-qa",
    "dimensions",
  ],
  "gift-guide": ["hero", "package", "scene", "benefit", "social-proof", "review-qa"],
  "marketplace-search": ["hero", "benefit", "comparison", "dimensions", "material-closeup", "review-qa"],
  "brand-story": [
    "hero",
    "scene",
    "brand-story",
    "material-closeup",
    "package",
    "detail-trust",
    "image-decomposition",
    "social-proof",
    "usage-steps",
    "review-qa",
  ],
};

export const CREATION_INDUSTRY_ROLE_PRESETS = {
  general: [],
  apparel: ["hero", "scene", "material-closeup", "dimensions", "benefit", "social-proof", "review-qa", "promotion"],
  beauty: ["hero", "benefit", "material-closeup", "usage-steps", "detail-trust", "social-proof", "package", "review-qa"],
  food: ["hero", "benefit", "scene", "package", "material-closeup", "social-proof", "promotion", "review-qa"],
  electronics: ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  home: ["hero", "scene", "dimensions", "material-closeup", "usage-steps", "benefit", "comparison", "review-qa"],
};

export const CREATION_SCENARIO_ROLE_INSTRUCTIONS = {
  standard: {
    default:
      "Role focus: keep this image tightly aligned with the selected ecommerce scenario and this role's conversion job.",
  },
  "detail-page": {
    default:
      "Role focus: make this feel like a modular detail-page section with clear hierarchy, shopper reassurance, and a clean conversion path.",
    "detail-trust":
      "Role focus: build a detail-page proof section that answers quality, structure, package, and trust concerns before purchase.",
    "material-closeup":
      "Role focus: build a modular detail-page proof section with texture, material, finish, and quality cues.",
    dimensions:
      "Role focus: make specifications, scale, capacity, and compatibility easy to compare inside a product-detail page module.",
    "usage-steps":
      "Role focus: turn operation, setup, cleaning, or assembly into a short detail-page teaching sequence.",
  },
  "social-seeding": {
    default:
      "Role focus: make this image feel native to a lifestyle feed while keeping the product accurate and purchase intent clear.",
    scene:
      "Role focus: stage an authentic everyday moment that feels shareable, lightly editorial, and not like a hard-sell ad.",
    "social-proof":
      "Role focus: frame social proof as a product-centered feed recommendation with a real adult reviewer or angler as supporting marketing context without overpowering or changing the product.",
    promotion:
      "Role focus: keep any offer soft and content-native so it supports seeding instead of breaking feed authenticity.",
  },
  launch: {
    default:
      "Role focus: create launch-ready energy with discovery, novelty, product promise, and a clear reason to pay attention now.",
    hero:
      "Role focus: make the product feel newly released, memorable, and immediately recognizable as the launch anchor.",
    benefit:
      "Role focus: express the launch promise as one strong shopper-facing reason to try the product.",
    package:
      "Role focus: show launch unboxing, bundle appeal, or included items as a premium first-touch moment.",
  },
  promotion: {
    default:
      "Role focus: emphasize offer clarity, urgency, product value, and a conversion-focused campaign layout.",
    promotion:
      "Role focus: reserve clean space for campaign price, deadline, or bundle callout while keeping the product dominant.",
    comparison:
      "Role focus: make the deal logic easy to understand through before-after, value stack, or advantage comparison.",
    "review-qa":
      "Role focus: answer the last objections that block campaign conversion, such as value, durability, or fit.",
  },
  livestream: {
    default:
      "Role focus: make the image host-ready for live commerce with clear talking points, demo rhythm, and fast shopper understanding.",
    benefit:
      "Role focus: make selling points easy to explain aloud in a live stream, with demo-friendly visual anchors.",
    "usage-steps":
      "Role focus: show a host-ready demonstration sequence with step cues, demo handoff, and a clear talk track for live commerce.",
    promotion:
      "Role focus: reserve clean space for a limited-time offer callout and live-room urgency without overcrowding the product.",
    "review-qa":
      "Role focus: answer common live-room questions quickly, as if the host is resolving purchase hesitation in real time.",
    dimensions:
      "Role focus: make size, capacity, and compatibility instantly explainable during a live demonstration.",
  },
  "gift-guide": {
    default:
      "Role focus: position the product as a thoughtful gift with occasion, recipient fit, packaging appeal, and confidence to buy.",
    package:
      "Role focus: make the package, included items, and gift-ready presentation feel complete and desirable.",
    scene:
      "Role focus: show the product in a gifting occasion or recipient lifestyle context without losing product clarity.",
    "review-qa":
      "Role focus: answer gifting concerns such as who it suits, whether it feels premium, and why it is easy to choose.",
  },
  "marketplace-search": {
    default:
      "Role focus: optimize for fast scanning in crowded marketplace search results with strong subject separation and minimal clutter.",
    hero:
      "Role focus: make the product readable as a thumbnail-first listing image with instant category recognition.",
    benefit:
      "Role focus: make one key shopper benefit readable at search-card speed without relying on dense text.",
    comparison:
      "Role focus: show a fast scan comparison for crowded search result pages, using simple visual hierarchy.",
    dimensions:
      "Role focus: make scale, size, and key specs readable at listing-card size.",
    "material-closeup":
      "Role focus: show one high-confidence material or quality cue that can stand out in marketplace search thumbnails.",
  },
  "brand-story": {
    default:
      "Role focus: connect product craft, material, origin, values, and everyday usage into a coherent brand narrative.",
    scene:
      "Role focus: place the product in a lived-in scene that supports brand values and everyday relevance.",
    "material-closeup":
      "Role focus: make material, craft, surface finish, or origin detail carry the brand story visually.",
    "brand-story":
      "Role focus: make the product's craft, origin, maker values, everyday ritual, or brand promise readable without turning it into a generic brand manifesto.",
    "image-decomposition":
      "Role focus: turn the product into a clear image-decomposition poster with visible component labels, material callouts, and external structure notes that support brand understanding.",
    package:
      "Role focus: use packaging or included items to communicate brand care, ritual, and perceived value.",
    "social-proof":
      "Role focus: present credibility as brand trust and customer belonging rather than a generic review card.",
  },
};

const CREATION_ROLE_INTENT_INSTRUCTIONS = {
  benefit:
    "Role intent: connect selling points to shopper pain points. Show the pain cue and resolved benefit visually, and avoid a feature-only label layout.",
  scene:
    "Role intent: show the product inside a believable use scene with real environment, true scale, and category-specific action. For fishing lures or bait, show it in river or lake water being pursued or struck by a fish; for ladders, show it realistically placed on solid open ground or beside the task area.",
  "social-proof":
    "Role intent: make this a photoreal real-person social-feed product recommendation image. Include a real adult person or angler as supporting marketing context, such as holding, presenting, or using the product near water, while you preserve the exact reference product as the unchanged sellable subject. For fishing lures or bait, create a real hooked fish scene. Show a real hooked fish only when its mouth, lip, or jaw is visibly biting an existing belly or tail treble hook from the reference lure. Clearly show one visible point of that original treble hook embedded in the fish mouth, lip, or jaw. Do not replace the treble hook with a separate single hook. Keep the lure body outside or beside the fish mouth, so the viewer can see the original lure and the real hook-up relationship clearly. Preserve the same lure silhouette, segment count, head direction, tail shape, paint pattern, eye placement, fin shapes, hook hangers, split rings, tow eye, belly treble hooks, and tail hook hardware. People, fish, hands, rods, line, water, logos, and text may appear as supporting marketing context, but they must not replace, redesign, duplicate, hide, cover, recolor, resize, or move any visible part of the reference lure. Do not invent a new hook, top hook, back hook, mouth ring, extra split ring, or new attachment point. Do not turn the lure into a real fish or a different lure SKU.",
  "usage-steps":
    "Role intent: teach the practical setup or operation with a clean step sequence while preserving the real product. Preserve the supplied reference product as the unchanged subject; use callout arrows, labels, hands, line, water, or small step panels around it, but do not redesign the lure body, paint pattern, segments, tail, hooks, lip, blade, or hardware. For fishing lures or bait, keep belly and tail treble hooks hanging from their original underside and tail hangers; never relocate hooks or hangers onto the top, back, side, fish mouth, or hand; attach the fishing line through the exact visible line-tie, tow eye, or split ring already present on the reference lure, using the same physical attachment point consistently in the main image and step panels; if the reference lure uses a front/nose tow eye ahead of the diving lip, use that front/nose tow eye; do not assume or add a top/back ring unless it is already visible in the reference; do not tie the line to the body, eye, hook hanger, belly, tail, mouth, propeller, diving lip, blade, or an invented ring, and do not add a hook, loose connector, or extra ring at the lure mouth or back.",
  package:
    "Package inventory lock: make this a complete included-items checklist image. If a package/list reference is supplied, use that package reference as the inventory authority. Show every distinct visible included item and quantity from the supplied checklist or package facts; do not summarize, crop, merge, omit, or replace checklist entries with generic kit contents. Keep the full set readable in one clear layout, even if that requires smaller product thumbnails, a two-column list, or a structured grid.",
  "material-closeup":
    "Role intent: analyze stated or visible materials from the product description, selling points, category, and reference notes. Use several small inset detail panes to show texture, finish, joints, edges, coating, hardware, stitching, or surface response.",
  "brand-story":
    "Role intent: build a product-centered brand story module. Connect supplied craft notes, origin, maker values, material choices, design philosophy, or everyday use ritual to the product's shopper value. Keep the actual product dominant and do not invent founder history, awards, logos, locations, or brand claims that were not provided.",
  "image-decomposition":
    "Role intent: build an annotated component breakdown poster from the product and references. Identify visible components, materials, parts, spatial groups, controls, surfaces, textures, connections, and external functions. Use detailed callout boxes around the subject with concise labels and short explanations, and do not invent hidden internals or unsupported technical specifications.",
};

const CREATION_ROLE_RENDERING_CONSTRAINTS = {
  package:
    "For this package checklist image, prioritize complete inventory coverage over lifestyle styling: no cropped list, no missing bottom rows, no representative subset only, and no hidden quantities.",
  "social-proof":
    "For this social-proof image, you may render one short selling-point headline from the provided selling points, plus at most two small callout phrases if they help the product sell.",
  "image-decomposition":
    "For this image-decomposition poster, annotate only visible and inferable external product details. Do not invent hidden internals, fake part names, unsupported part counts, unsupported performance claims, or invisible mechanisms.",
};

const CREATION_CONTENT_ALLOCATION_STRATEGY = "deterministic-rules";

const CREATION_CONTENT_FACT_SPLIT_RE = /[\n,;\uFF0C\uFF1B\u3002\u3001!?]+|(?<!\d)\.(?!\d)/u;
const MAX_CREATION_SOURCE_FACT_CHARS = 180;
const MAX_CREATION_PRODUCT_LINE_CHARS = 180;

const CREATION_CONTENT_CATEGORY_PATTERNS = {
  identity: [/product|subject|sku|\u5546\u54c1|\u4ea7\u54c1|\u4e3b\u4f53|sku/i],
  "visible-copy": [/visible\s*text|headline|slogan|caption|copy|font|typography|\u753b\u9762\u6587\u5b57|\u6587\u5b57|\u6807\u9898|\u6587\u6848|\u5b57\u4f53/i],
  benefit: [/benefit|selling|pain|problem|visibility|visible|stable|action|cast|stiff|power|noise|portable|easy|\bled\b|light|flash|\u5356\u70b9|\u75db\u70b9|\u8fa8\u8bc6|\u53ef\u89c1|\u7a33\u5b9a|\u6cf3\u59ff|\u50f5\u786c|\u8fdc\u6295|\u6025\u6551|\u6b62\u8840|\u521b\u53e3\u8d34|\u7ef7\u5e26|\u6577\u6599|\u7eb1\u5e03|\u5438\u529b|\u4f4e\u566a|\u5f3a\u52b2|\u8f7b\u4fbf|\u591a\u573a\u666f|\u9002\u7528|\u7701\u529b|\u9ad8\u6548|\u706f|\u53d1\u5149|\u95ea\u5149/i],
  material: [/material|texture|surface|structure|detail|filter|nozzle|fabric|finish|steel|rattle|bead|abs|body|propeller|hook|hardware|\u6750\u8d28|\u7eb9\u7406|\u8d28\u611f|\u8868\u9762|\u7ed3\u6784|\u7ec6\u8282|\u6ee4\u82af|\u5438\u5634|\u505a\u5de5|\u94a2\u73e0|\u54cd\u73e0|\u94a2\u7403|\u73e0|\u672c\u4f53|\u6868\u53f6|\u9c7c\u94a9|\u4e94\u91d1/i],
  scene: [/scene|usage|context|environment|lifestyle|car interior|outdoor|indoor|\u4f7f\u7528\u573a\u666f|\u573a\u666f|\u8f66\u5185|\u6237\u5916|\u529e\u516c\u5ba4|\u65c5\u884c|\u53a8\u623f|\u751f\u6d3b/i],
  usage: [/step|setup|install|operation|how to|recharge|charging|usb|cable|\u4f7f\u7528\u6b65\u9aa4|\u6b65\u9aa4|\u5b89\u88c5|\u64cd\u4f5c|\u6e05\u6d01|\u7ec4\u88c5|\u5145\u7535|\u7535\u7ebf|\u6570\u636e\u7ebf/i],
  dimensions: [/dimension|size|spec|capacity|height|width|\bcm\b|\bmm\b|\bg\b|\boz\b|\u5c3a\u5bf8|\u89c4\u683c|\u5bb9\u91cf|\u9ad8\u5ea6|\u5bbd\u5ea6|\u91cd\u91cf/i],
  package: [/package|bundle|included|accessor|storage bag|first aid kit|bandages?|blankets?|cotton swabs?|safety pins?|non-woven tape|tourniquets?|whistles?|dressings?|soap wipes?|tweezers?|scissors?|usb|cable|\*\s*\d+\b|\u914d\u7f6e|\u5305\u88c5|\u6e05\u5355|\u5957\u88c5|\u6536\u7eb3\u888b|\u914d\u4ef6|\u521b\u53e3\u8d34|\u7ef7\u5e26|\u6577\u6599|\u68c9\u7b7e|\u80f6\u5e26|\u4e09\u89d2\u5dfe|\u6025\u6551\u6bef|\u7eb1\u5e03|\u522b\u9488|\u6b62\u8840\u5e26|\u6e7f\u5dfe|\u7eb1\u5e03\u526a|\u7535\u7ebf|\u6570\u636e\u7ebf/i],
  trust: [/trust|quality|proof|safe|cert|warranty|durable|review|reliable|steel|rattle|bead|\u4fe1\u4efb|\u8d28\u91cf|\u5b89\u5168|\u8ba4\u8bc1|\u8d28\u4fdd|\u8010\u7528|\u8bc4\u4ef7|\u53e3\u7891|\u9632\u6c34|\u94a2\u73e0|\u54cd\u73e0/i],
};

const CREATION_ROLE_CONTENT_CATEGORIES = {
  hero: ["identity", "visible-copy", "benefit", "trust"],
  benefit: ["benefit", "visible-copy", "trust"],
  scene: ["scene", "usage", "benefit"],
  "detail-trust": ["trust", "material", "package"],
  comparison: ["benefit", "trust", "dimensions"],
  "social-proof": ["scene", "trust", "benefit"],
  package: ["package"],
  promotion: ["visible-copy", "benefit"],
  "material-closeup": ["material", "trust"],
  "usage-steps": ["usage", "scene"],
  dimensions: ["dimensions"],
  "review-qa": ["trust", "benefit"],
  "feature-callout": ["identity", "benefit", "material", "trust"],
  "variant-matrix": ["identity", "benefit", "dimensions"],
  compatibility: ["dimensions", "usage", "benefit"],
  "care-guide": ["usage", "material", "trust"],
  "brand-story": ["scene", "material", "trust", "visible-copy"],
  "image-decomposition": ["identity", "material", "benefit", "usage", "visible-copy"],
};

const CREATION_ROLE_SOURCE_FACT_LIMITS = {
  package: 32,
};

function cleanString(value) {
  return String(value || "").trim();
}

function truncateCreationSourceFact(value, maxChars = MAX_CREATION_SOURCE_FACT_CHARS) {
  const text = cleanString(value);
  if (text.length <= maxChars) {
    return text;
  }
  const clipped = text.slice(0, maxChars);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace >= Math.floor(maxChars * 0.55) ? clipped.slice(0, lastSpace) : clipped).trim();
}

function splitLongCreationContentFact(value) {
  const text = cleanString(value);
  if (!text) {
    return [];
  }
  if (text.length <= MAX_CREATION_SOURCE_FACT_CHARS) {
    return [text];
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const chunks = [];
    for (let index = 0; index < text.length; index += MAX_CREATION_SOURCE_FACT_CHARS) {
      chunks.push(text.slice(index, index + MAX_CREATION_SOURCE_FACT_CHARS));
    }
    return chunks.map(cleanString).filter(Boolean);
  }

  const chunks = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > MAX_CREATION_SOURCE_FACT_CHARS && current) {
      chunks.push(current);
      current = truncateCreationSourceFact(word);
    } else {
      current = next;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function stripCreationContentListMarker(value) {
  return cleanString(value)
    .replace(/^\d+[\u3001)]\s*/u, "")
    .replace(/^\d+\.(?=(?:\d+\.)|\d+\*|[^\d\s])\s*/u, "")
    .trim();
}

function isGenericCreationContentHeader(value) {
  return /^(?:product description|description|selling points?|pain points?|\u5546\u54c1\u63cf\u8ff0|\u4ea7\u54c1\u63cf\u8ff0|\u914d\u7f6e\u6e05\u5355|\u5356\u70b9|\u75db\u70b9)[:\uFF1A]?$/iu.test(cleanString(value));
}

const CREATION_SKU_BUNDLE_COUNT_WORDS = new Map([
  ["单", 1],
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
const ENGLISH_UNIT_COUNT_WORDS = new Map([
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
const CHINESE_UNIT_COUNT_WORDS = new Map([
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

function clampCreationSkuBundleCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_CREATION_SKU_BUNDLE_COUNT;
  }
  return Math.min(MAX_CREATION_SKU_BUNDLE_COUNT, Math.max(DEFAULT_CREATION_SKU_BUNDLE_COUNT, Math.round(value)));
}

export function normalizeCreationSkuBundleCount(value, fallback = DEFAULT_CREATION_SKU_BUNDLE_COUNT) {
  const fallbackCount = clampCreationSkuBundleCount(Number.parseInt(cleanString(fallback), 10));
  const raw = cleanString(value);
  if (!raw) {
    return fallbackCount;
  }

  const digitMatch = raw.match(/\d+/);
  if (digitMatch) {
    return clampCreationSkuBundleCount(Number.parseInt(digitMatch[0], 10));
  }

  if (raw.includes("十")) {
    const [left, right] = raw.split("十");
    const tens = CREATION_SKU_BUNDLE_COUNT_WORDS.get(left) || 1;
    const ones = CREATION_SKU_BUNDLE_COUNT_WORDS.get(right) || 0;
    return clampCreationSkuBundleCount(tens * 10 + ones);
  }

  for (const [word, count] of CREATION_SKU_BUNDLE_COUNT_WORDS) {
    if (raw.includes(word)) {
      return clampCreationSkuBundleCount(count);
    }
  }

  return fallbackCount;
}

function normalizeCreationSubjectUnitCount(value) {
  const count = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(count) && count > 1 ? Math.min(MAX_CREATION_SKU_BUNDLE_COUNT, Math.round(count)) : 0;
}

function parseCreationUnitCountToken(value) {
  const token = cleanString(value);
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return normalizeCreationSubjectUnitCount(digitCount);
  }
  if (CHINESE_UNIT_COUNT_WORDS.has(token)) {
    return normalizeCreationSubjectUnitCount(CHINESE_UNIT_COUNT_WORDS.get(token));
  }
  if (token.includes("十")) {
    const [left, right] = token.split("十");
    const tens = left ? CHINESE_UNIT_COUNT_WORDS.get(left) || 0 : 1;
    const ones = right ? CHINESE_UNIT_COUNT_WORDS.get(right) || 0 : 0;
    return normalizeCreationSubjectUnitCount(tens * 10 + ones);
  }
  return 0;
}

function inferCreationSubjectUnitCount(value = "") {
  const text = cleanString(value).toLowerCase();
  const digitMatch = text.match(/\b(\d+)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (digitMatch) {
    return normalizeCreationSubjectUnitCount(digitMatch[1]);
  }
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (wordMatch) {
    return normalizeCreationSubjectUnitCount(ENGLISH_UNIT_COUNT_WORDS.get(wordMatch[1].toLowerCase()));
  }
  const chineseMatch = text.match(/([一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款|种|组|套)?\s*(?:完整|可见|完整可见|可售|不同|独立)?\s*(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵)/u);
  return chineseMatch ? parseCreationUnitCountToken(chineseMatch[1]) : 0;
}

export function normalizeCreationSkuGenerationRule(value) {
  const normalized = cleanString(value);
  return (
    CREATION_SKU_GENERATION_RULE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_SKU_GENERATION_RULE_OPTIONS[0]
  );
}

function trimTerminalSentencePunctuation(value) {
  return cleanString(value).replace(/[.!?。！？]+$/u, "").trim();
}

function normalizeSellingPoints(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,，；、]+/)
    .map(cleanString)
    .filter(Boolean);
}

function normalizeDimensionSpecs(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,，；、]+/)
    .map(cleanString)
    .filter(Boolean);
}

function uniqueCleanStrings(values = []) {
  const seen = new Set();
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function splitCreationContentFacts(value) {
  return uniqueCleanStrings(
    String(value || "")
      .split(CREATION_CONTENT_FACT_SPLIT_RE)
      .flatMap(splitLongCreationContentFact)
      .map(stripCreationContentListMarker)
      .filter((value) => !isGenericCreationContentHeader(value))
      .filter(Boolean),
  );
}

function categorizeCreationContentFact(text, fallbackCategory) {
  const categories = Object.entries(CREATION_CONTENT_CATEGORY_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([category]) => category);
  if (categories.includes("visible-copy")) {
    return ["visible-copy"];
  }
  return categories.length > 0 ? categories : [fallbackCategory];
}

function buildCategorizedCreationContentFacts(facts, fallbackCategory) {
  return uniqueCleanStrings(facts).map((text) => ({
    text,
    categories: categorizeCreationContentFact(text, fallbackCategory),
  }));
}

export function buildCreationContentAllocation({ productDescription = "", sellingPoints = [] } = {}) {
  return {
    strategy: CREATION_CONTENT_ALLOCATION_STRATEGY,
    agentRequired: false,
    descriptionFacts: buildCategorizedCreationContentFacts(splitCreationContentFacts(productDescription), "identity"),
    sellingPointFacts: buildCategorizedCreationContentFacts(sellingPoints, "benefit"),
  };
}

function getCreationRoleContentCategories(role) {
  return CREATION_ROLE_CONTENT_CATEGORIES[role] || CREATION_ROLE_CONTENT_CATEGORIES.hero;
}

function selectCreationContentFacts(facts, categories, maxCount = 3) {
  const categorySet = new Set(categories);
  return facts
    .filter((fact) => fact.categories.some((category) => categorySet.has(category)))
    .map((fact) => fact.text)
    .slice(0, maxCount);
}

function selectFallbackCreationContentFacts(facts, maxCount = 3) {
  return facts.map((fact) => fact.text).slice(0, maxCount);
}

function formatCreationContentFacts(facts) {
  return uniqueCleanStrings(facts).map(trimTerminalSentencePunctuation).filter(Boolean).join(" / ");
}

function buildCreationRoleSourceFocus({
  role,
  allocation,
  descriptionLine,
  sellingPointLine,
  sellingPoints,
}) {
  const categories = getCreationRoleContentCategories(role);
  const sourceFactLimit = CREATION_ROLE_SOURCE_FACT_LIMITS[role] || 3;
  const descriptionFacts = selectCreationContentFacts(allocation.descriptionFacts, categories, sourceFactLimit);
  const sellingPointFacts = selectCreationContentFacts(allocation.sellingPointFacts, categories, sourceFactLimit);
  const selectedSellingPoints = formatCreationContentFacts(sellingPointFacts);
  const fallbackDescriptionFacts = formatCreationContentFacts(selectFallbackCreationContentFacts(allocation.descriptionFacts, sourceFactLimit));
  const fallbackSellingPoints = sellingPoints.length <= 2 ? sellingPointLine : trimTerminalSentencePunctuation(sellingPoints[0]);
  const description = formatCreationContentFacts(descriptionFacts);
  const selling =
    sellingPoints.length > 0
      ? sellingPoints.length <= 2
        ? sellingPointLine
        : selectedSellingPoints || fallbackSellingPoints || sellingPointLine
      : selectedSellingPoints || description || fallbackDescriptionFacts || sellingPointLine;

  return {
    strategy: allocation.strategy,
    categories,
    description,
    selling,
  };
}

function buildCreationProductLine({ productName = "", productDescription = "", sellingPoints = [] } = {}) {
  const namedProduct = truncateCreationSourceFact(productName, MAX_CREATION_PRODUCT_LINE_CHARS);
  if (namedProduct) {
    return namedProduct;
  }

  const descriptionFacts = splitCreationContentFacts(productDescription);
  const descriptionProduct = truncateCreationSourceFact(descriptionFacts[0] || productDescription, MAX_CREATION_PRODUCT_LINE_CHARS);
  if (descriptionProduct) {
    return descriptionProduct;
  }

  return truncateCreationSourceFact(sellingPoints[0], MAX_CREATION_PRODUCT_LINE_CHARS);
}

export function normalizeCreationDimensionUnitMode(value) {
  const normalized = cleanString(value);
  return (
    CREATION_DIMENSION_UNIT_MODE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_DIMENSION_UNIT_MODE_OPTIONS.find((option) => option.value === DEFAULT_CREATION_DIMENSION_UNIT_MODE) ||
    CREATION_DIMENSION_UNIT_MODE_OPTIONS[0]
  );
}

export function normalizeCreationLogoPlacement(value) {
  const normalized = cleanString(value);
  return (
    CREATION_LOGO_PLACEMENT_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_LOGO_PLACEMENT_OPTIONS.find((option) => option.value === DEFAULT_CREATION_LOGO_PLACEMENT) ||
    CREATION_LOGO_PLACEMENT_OPTIONS[0]
  );
}

export function normalizeCreationLogoBackground(value) {
  const normalized = cleanString(value);
  return (
    CREATION_LOGO_BACKGROUND_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_LOGO_BACKGROUND_OPTIONS[0]
  );
}

export function normalizeCreationLogoOptions(value = {}) {
  let source = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch (_error) {
      source = {};
    }
  }

  if (!source || typeof source !== "object") {
    source = {};
  }

  const filename = cleanString(source.filename || source.name || source.logoFilename);
  const placement = normalizeCreationLogoPlacement(source.placement || source.logoPlacement);
  const background = normalizeCreationLogoBackground(source.background || source.backgroundMode || source.logoBackground);
  const enabledValue = source.enabled ?? source.logoEnabled ?? Boolean(filename);
  const enabled =
    filename &&
    (enabledValue === true ||
      enabledValue === "true" ||
      enabledValue === "1" ||
      enabledValue === "on" ||
      enabledValue === 1);

  return {
    enabled: Boolean(enabled),
    filename: enabled ? filename : "",
    placement: placement.value,
    placementLabel: placement.label,
    promptPosition: placement.promptPosition,
    background: background.value,
    backgroundLabel: background.label,
    backgroundInstruction: background.promptInstruction,
  };
}

const DIMENSION_UNIT_LOOKUP = new Map([
  ["mm", { kind: "length", system: "metric", unit: "mm", toBase: (value) => value }],
  ["毫米", { kind: "length", system: "metric", unit: "mm", toBase: (value) => value }],
  ["cm", { kind: "length", system: "metric", unit: "cm", toBase: (value) => value * 10 }],
  ["厘米", { kind: "length", system: "metric", unit: "cm", toBase: (value) => value * 10 }],
  ["m", { kind: "length", system: "metric", unit: "m", toBase: (value) => value * 1000 }],
  ["米", { kind: "length", system: "metric", unit: "m", toBase: (value) => value * 1000 }],
  ["in", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["inch", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["inches", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["英寸", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["ft", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["foot", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["feet", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["英尺", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["yd", { kind: "length", system: "imperial", unit: "yd", toBase: (value) => value * 914.4 }],
  ["yard", { kind: "length", system: "imperial", unit: "yd", toBase: (value) => value * 914.4 }],
  ["yards", { kind: "length", system: "imperial", unit: "yd", toBase: (value) => value * 914.4 }],
  ["ml", { kind: "volume", system: "metric", unit: "ml", toBase: (value) => value }],
  ["毫升", { kind: "volume", system: "metric", unit: "ml", toBase: (value) => value }],
  ["l", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["liter", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["liters", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["litre", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["litres", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["升", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["fl oz", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["fluid ounce", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["fluid ounces", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["液量盎司", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["g", { kind: "weight", system: "metric", unit: "g", toBase: (value) => value }],
  ["克", { kind: "weight", system: "metric", unit: "g", toBase: (value) => value }],
  ["kg", { kind: "weight", system: "metric", unit: "kg", toBase: (value) => value * 1000 }],
  ["千克", { kind: "weight", system: "metric", unit: "kg", toBase: (value) => value * 1000 }],
  ["lb", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["lbs", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["pound", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["pounds", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["磅", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["oz", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
  ["ounce", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
  ["ounces", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
  ["盎司", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
]);

const DIMENSION_ADJACENT_LABEL_RE_SOURCE = String.raw`(?:diameter|height|width|depth|thickness|length|weight|capacity|volume|\u76f4\u5f84|\u76f4\u5f91|\u9ad8(?:\u5ea6)?|\u5bbd(?:\u5ea6)?|\u5bec(?:\u5ea6)?|\u539a(?:\u5ea6)?|\u6df1(?:\u5ea6)?|\u957f(?:\u5ea6)?|\u9577(?:\u5ea6)?|\u91cd\u91cf|\u51c0\u91cd|\u6de8\u91cd|\u91cd|\u5bb9\u91cf|\u51c0\u542b\u91cf)`;
const DIMENSION_MEASUREMENT_RE = new RegExp(
  String.raw`(^|[^\p{L}\p{N}_]|${DIMENSION_ADJACENT_LABEL_RE_SOURCE})([+-]?(?:\d+(?:\.\d+)?|\.\d+))(\s*)(fl\.?\s*oz|fluid\s*ounces?|inches?|inch|in\.?|ft\.?|feet|foot|yards?|yard|yd\.?|\u6beb\u7c73|\u5398\u7c73|\u82f1\u5bf8|\u82f1\u5c3a|\u6beb\u5347|\u6db2\u91cf\u76ce\u53f8|\u5343\u514b|\u514b|\u78c5|\u76ce\u53f8|\u5347|mm|cm|kg|g|ml|lb|lbs|oz|m|l)(?=$|[^\p{L}\p{N}_]|(?=${DIMENSION_ADJACENT_LABEL_RE_SOURCE}))`,
  "giu",
);
const DIMENSION_SPEC_INTENT_RE =
  /dimension(s)?\s*(chart|guide|card|table|sheet|info|information|specifications?|feel|reference|focus|value|values)|size\s*(chart|guide|card|table|sheet|feel|reference|focus|value|values)|spec(ification)?\s*(table|chart|card|sheet|info|information|feel|reference|focus|value|values)|measurement\s*(chart|guide|card|table)|尺寸\s*(图|表|卡|规格|信息|参数|感|参考|依据|值|数值|重点|焦点)|规格\s*(图|表|卡|信息|参数|感|参考|依据|值|数值|重点|焦点)|尺码\s*(图|表|卡|信息|指南)|实物握持尺度|规格信息|尺寸规格|规格感|尺寸感/iu;
const DIMENSION_SIGNAL_RE =
  /dimension|size|measurement|capacity|length|width|height|weight|hook|尺寸|规格|尺码|容量|长度|宽度|高度|重量|比例|尺度|钩/iu;
const DIMENSION_SPEC_VALUE_RE = /#\s*\d+|\d+\s*#\s*(?:hook|hooks|钩)?|\d+\s*(?:号|號)\s*钩|size\s*#?\s*\d+\s*hooks?/iu;
const USAGE_INSTRUCTION_SIGNAL_RE =
  /usage\s*(guide|manual|instructions?|steps?|diagram|method)|user\s*(guide|manual|instructions?)|operation\s*(guide|manual|instructions?|steps?|method|diagram)|instruction(s)?|manual|tutorial|step[-\s]?by[-\s]?step|how\s*to|setup\s*(guide|instructions?|steps?)|assembly\s*(guide|instructions?|steps?)|install(?:ation)?\s*(guide|instructions?|steps?)|charging\s*(guide|instructions?|steps?|method|connection|diagram)|connection\s*(guide|instructions?|steps?|method|diagram)|polarity|positive\s*(pole|terminal|electrode)|negative\s*(pole|terminal|electrode)|使用\s*(指南|说明|教程|步骤|方法|方式|指引)|操作\s*(指南|说明|教程|步骤|方法|流程)|安装\s*(指南|说明|教程|步骤|方法|流程)|装配\s*(指南|说明|教程|步骤|方法|流程)|充电\s*(指南|说明|教程|步骤|方式|方法|连接|接线)|连接\s*(指南|说明|教程|步骤|方式|方法|示意|接线)|接线|正负极|正极|负极|请按照|注意事项|说明书|教程图|步骤图/iu;
const DETAIL_REFERENCE_SIGNAL_RE =
  /detail|close.?up|callout|feature\s*(callout|breakdown|point|annotation)|structure\s*(callout|breakdown|detail|annotation|notes?)|component\s*(callout|breakdown|detail|annotation)|material|texture|surface|fabric|finish|seams?|craft|细节|质感|纹理|表面|工艺|外观结构|结构表现|结构说明|结构标注|部件标注|功能卖点|卖点外观|功能拆解|结构拆解/iu;
const PRODUCT_SUBJECT_REFERENCE_RE =
  /product\s*(subject|photo|main|hero)|hero\s*product|sku\s*subject|sellable\s*(product|sku|subject)|商品主体|主体图|主图|白底主图|正面主体|可售|色款|配色|整体轮廓/iu;
const PACKAGE_REFERENCE_SIGNAL_RE = /package|packaging|box|bundle|included\s*(items?|contents?)?|contents?|accessor(?:y|ies)|in\s+the\s+box|what'?s\s+included|包装|包装清单|清单|套装|配件|盒|到手|收到|内含物/iu;
const PACKAGE_CONTENT_REFERENCE_RE = /included\s*(items?|contents?)?|contents?|accessor(?:y|ies)|in\s+the\s+box|comes?\s+with|what'?s\s+included|包装清单|清单包含|包装内容|到手内容|实际收到|用户实际收到|配件清单|套装内容|内含物|标配清单|附带配件|随附配件|(?:includes?|included|comes?\s+with|包含|内含|含有|附带|随附|标配)[^。.;；\n]{0,40}(?:usb|cables?|charging\s*cable|charger|manual|accessor(?:y|ies)|propeller|eva|float|充电线|数据线|线缆|螺旋桨|叶片|漂浮|浮漂|说明书|配件|收纳袋|备用)/iu;
const DIMENSION_MODEL_RE = /(?:\b(model|sku|item\s*no\.?)|(型号|型號))\s*[:：#]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/giu;
const DIMENSION_HOOK_PATTERNS = [
  /((?:hook(?:\s*size)?|hooks?|fish\s*hook|钩号|鉤號|鱼钩|魚鉤|钩|鉤))\s*[:：]?\s*#?\s*(\d+)\s*#?/giu,
  /#\s*(\d+)\s*(?:hooks?|hook|钩|鉤)?/giu,
  /\b(\d+)\s*#\s*(?:hooks?|hook|钩|鉤)?/giu,
];
const DIMENSION_FACT_LABEL_ORDER = new Map([
  ["model", 0],
  ["length", 10],
  ["height", 11],
  ["width", 12],
  ["diameter", 13],
  ["depth", 14],
  ["weight", 20],
  ["capacity", 30],
  ["hook size", 40],
  ["sinking rate", 50],
]);
const CREATION_DIMENSION_SPEC_ALLOWED_LABELS = new Set(["length", "height", "width", "depth", "weight"]);

const DIMENSION_ENGLISH_LABELS = new Map([
  ["model", "Model"],
  ["length", "Length"],
  ["height", "Height"],
  ["width", "Width"],
  ["diameter", "Diameter"],
  ["depth", "Depth"],
  ["weight", "Weight"],
  ["capacity", "Capacity"],
  ["hook size", "Hook Size"],
  ["sinking rate", "Sinking Rate"],
]);

function normalizeDimensionUnitToken(value) {
  return cleanString(value).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

function formatDimensionNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/u, "").replace(/(\.\d)0$/u, "$1");
}

function formatMetricDimensionValue(kind, baseValue) {
  if (kind === "length") {
    return `${formatDimensionNumber(baseValue / 10)} cm`;
  }
  if (kind === "volume") {
    return `${formatDimensionNumber(baseValue)} ml`;
  }
  if (kind === "weight") {
    return baseValue >= 1000
      ? `${formatDimensionNumber(baseValue / 1000)} kg`
      : `${formatDimensionNumber(baseValue)} g`;
  }
  return "";
}

function formatImperialDimensionValue(kind, baseValue) {
  if (kind === "length") {
    return `${formatDimensionNumber(baseValue / 25.4)} in`;
  }
  if (kind === "volume") {
    return `${formatDimensionNumber(baseValue / 29.5735295625)} fl oz`;
  }
  if (kind === "weight") {
    return baseValue >= 453.59237
      ? `${formatDimensionNumber(baseValue / 453.59237)} lb`
      : `${formatDimensionNumber(baseValue / 28.349523125)} oz`;
  }
  return "";
}

function convertDimensionMeasurement(value, spacing, rawUnit, mode) {
  const parsedValue = Number.parseFloat(value);
  const unit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(rawUnit));
  const original = `${value}${spacing}${rawUnit}`;

  if (!unit || !Number.isFinite(parsedValue)) {
    return original;
  }

  const baseValue = unit.toBase(parsedValue);
  const metricValue = unit.system === "metric" ? original : formatMetricDimensionValue(unit.kind, baseValue);
  const imperialValue = unit.system === "imperial" ? original : formatImperialDimensionValue(unit.kind, baseValue);

  if (mode === "both") {
    return metricValue && imperialValue ? `${metricValue} (${imperialValue})` : original;
  }

  if (mode === "imperial") {
    return unit.system === "imperial" ? original : imperialValue || original;
  }

  return unit.system === "metric" ? original : metricValue || original;
}

function convertDimensionSpecLine(line, mode) {
  return cleanString(line).replace(DIMENSION_MEASUREMENT_RE, (match, prefix, value, spacing, unit) => {
    return `${prefix}${convertDimensionMeasurement(value, spacing, unit, mode)}`;
  });
}

function normalizeDimensionFactLabel(label) {
  const text = cleanString(label).toLowerCase();
  if (/^(?:直径|直徑|diameter)$/.test(text)) {
    return "diameter";
  }
  if (/^(?:高度|高|height)$/.test(text)) {
    return "height";
  }
  if (/^(?:宽度|寬度|宽|寬|width)$/.test(text)) {
    return "width";
  }
  if (/^(?:厚度|厚|depth)$/.test(text)) {
    return "depth";
  }
  if (/^(?:长度|長度|长|長|length)$/.test(text)) {
    return "length";
  }
  if (/^(?:重量|净重|淨重|重|weight)$/.test(text)) {
    return "weight";
  }
  if (/^(?:容量|净含量|淨含量|capacity)$/.test(text)) {
    return "capacity";
  }
  if (/^(?:钩号|鉤號|hook size)$/.test(text)) {
    return "hook size";
  }
  return text;
}

function shouldUseEnglishDimensionLabels(targetLanguageValue = "") {
  return cleanString(targetLanguageValue).toLowerCase().startsWith("en");
}

function formatDimensionFactLabelForTarget(label, targetLanguageValue = "") {
  const normalizedLabel = normalizeDimensionFactLabel(label);
  if (shouldUseEnglishDimensionLabels(targetLanguageValue)) {
    return DIMENSION_ENGLISH_LABELS.get(normalizedLabel) || label;
  }
  return label;
}

function inferDimensionMeasurementLabel(beforeMeasurement, unit) {
  const before = cleanString(beforeMeasurement).toLowerCase();
  const normalizedUnit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(unit));

  if (/(?:直径|直徑)\s*[:：-]?$/.test(before)) {
    return "直径";
  }
  if (/(?:diameter|dia\.?)\s*[:：-]?$/.test(before)) {
    return "Diameter";
  }
  if (/(?:高(?:度)?)\s*[:：-]?$/.test(before)) {
    return "高度";
  }
  if (/(?:height)\s*[:：-]?$/.test(before)) {
    return "Height";
  }
  if (/(?:宽(?:度)?|寬(?:度)?)\s*[:：-]?$/.test(before)) {
    return "宽度";
  }
  if (/(?:width)\s*[:：-]?$/.test(before)) {
    return "Width";
  }
  if (/(?:厚(?:度)?)\s*[:：-]?$/.test(before)) {
    return "厚度";
  }
  if (/(?:depth)\s*[:：-]?$/.test(before)) {
    return "Depth";
  }
  if (/(?:长(?:度)?|長(?:度)?)\s*[:：-]?$/.test(before)) {
    return "长度";
  }
  if (/(?:length|long)\s*[:：-]?$/.test(before)) {
    return "Length";
  }
  if (/(?:净重|淨重|重量|重)\s*[:：-]?$/.test(before)) {
    return "重量";
  }
  if (/(?:weight)\s*[:：-]?$/.test(before)) {
    return "Weight";
  }
  if (/(?:容量|净含量|淨含量)\s*[:：-]?$/.test(before)) {
    return "容量";
  }
  if (/(?:capacity|volume)\s*[:：-]?$/.test(before)) {
    return "Capacity";
  }

  if (normalizedUnit?.kind === "weight") {
    return "Weight";
  }
  if (normalizedUnit?.kind === "volume") {
    return "Capacity";
  }
  return "Length";
}

function makeDimensionMeasurementFact({ label, value, spacing, unit, mode, targetLanguageValue }) {
  const parsedValue = Number.parseFloat(value);
  const unitInfo = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(unit));
  if (!unitInfo || !Number.isFinite(parsedValue)) {
    return null;
  }

  const baseValue = unitInfo.toBase(parsedValue);
  const normalizedLabel = cleanString(label);
  const displayLabel = formatDimensionFactLabelForTarget(normalizedLabel, targetLanguageValue);
  const displayValue = convertDimensionMeasurement(value, spacing, unit, mode);
  return {
    type: "measurement",
    label: displayLabel,
    normalizedLabel: normalizeDimensionFactLabel(normalizedLabel),
    kind: unitInfo.kind,
    baseValue,
    text: `${displayLabel} ${displayValue}`,
  };
}

function isDimensionRateMeasurementContext(text, measurementStart, measurementEnd, unit) {
  const unitInfo = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(unit));
  if (unitInfo?.kind !== "length") {
    return false;
  }

  const before = text.slice(Math.max(0, measurementStart - 48), measurementStart).toLowerCase();
  const after = text.slice(measurementEnd, measurementEnd + 28).toLowerCase();
  return (
    /(?:sinking|sink|dive|fall|rate|speed|velocity|\u4e0b\u6c89|\u6c89\u964d|\u6c89\u6c34|\u901f\u5ea6|\u901f\u7387)\s*[:\uFF1A]?\s*$/iu.test(
      before,
    ) ||
    /^\s*(?:\/\s*(?:s|sec(?:ond)?s?|min(?:ute)?s?|h|hr|hours?|\u79d2|\u5206\u949f|\u5c0f\u65f6)(?=$|[^\p{L}\p{N}_])|per\s+(?:s|sec(?:ond)?s?|min(?:ute)?s?|h|hr|hours?)(?=$|[^\p{L}\p{N}_]))/iu.test(
      after,
    )
  );
}

function extractDimensionMeasurementFacts(text, mode, targetLanguageValue = "") {
  DIMENSION_MEASUREMENT_RE.lastIndex = 0;
  const matches = [...text.matchAll(DIMENSION_MEASUREMENT_RE)];
  DIMENSION_MEASUREMENT_RE.lastIndex = 0;

  return matches
    .map((match) => {
      const [, prefix, value, spacing, unit] = match;
      const measurementStart = (match.index || 0) + prefix.length;
      const measurementEnd = measurementStart + value.length + spacing.length + unit.length;
      if (isDimensionRateMeasurementContext(text, measurementStart, measurementEnd, unit)) {
        return null;
      }
      const before = text.slice(Math.max(0, measurementStart - 32), measurementStart);
      return makeDimensionMeasurementFact({
        label: inferDimensionMeasurementLabel(before, unit),
        value,
        spacing,
        unit,
        mode,
        targetLanguageValue,
      });
    })
    .filter(Boolean);
}

function extractDimensionModelFacts(text, targetLanguageValue = "") {
  return [...text.matchAll(DIMENSION_MODEL_RE)]
    .map((match) => {
      const sourceLabel = cleanString(match[2]) ? "型号" : "Model";
      const label = formatDimensionFactLabelForTarget(sourceLabel, targetLanguageValue);
      const model = cleanString(match[3]).toUpperCase();
      return { label, model };
    })
    .filter((entry) => entry.model)
    .map(({ label, model }) => ({
      type: "model",
      normalizedLabel: "model",
      value: model,
      text: `${label} ${model}`,
    }));
}

function extractDimensionHookFacts(text, targetLanguageValue = "") {
  return DIMENSION_HOOK_PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)]
      .map((match) => {
        const explicitLabel = cleanString(match[1]);
        const size = cleanString(match[2] || match[1]);
        const sourceLabel = /[钩鉤鱼魚]/u.test(explicitLabel) ? "钩号" : "Hook Size";
        const label = formatDimensionFactLabelForTarget(sourceLabel, targetLanguageValue);
        return { label, size };
      })
      .filter((entry) => entry.size)
      .map(({ label, size }) => ({
        type: "hook",
        normalizedLabel: "hook size",
        value: size,
        text: `${label} ${size}#`,
      })),
  );
}

function extractDimensionActionAttributeFacts(text, targetLanguageValue = "") {
  const raw = cleanString(text);
  const attributes = [];
  if (/(?:\u7f13\u6c89|\u6162\u6c89|slow[-\s]?sink(?:ing)?)/iu.test(raw)) {
    attributes.push(shouldUseEnglishDimensionLabels(targetLanguageValue) ? "slow sinking" : "\u7f13\u6c89");
  }
  if (/(?:\u5feb\u6c89|fast[-\s]?sink(?:ing)?)/iu.test(raw)) {
    attributes.push(shouldUseEnglishDimensionLabels(targetLanguageValue) ? "fast sinking" : "\u5feb\u6c89");
  }
  if (/(?:\u60ac\u6d6e|suspend(?:ing)?)/iu.test(raw)) {
    attributes.push(shouldUseEnglishDimensionLabels(targetLanguageValue) ? "suspending" : "\u60ac\u6d6e");
  }
  if (/(?:\u6d6e\u6c34|float(?:ing)?)/iu.test(raw)) {
    attributes.push(shouldUseEnglishDimensionLabels(targetLanguageValue) ? "floating" : "\u6d6e\u6c34");
  }

  const label = shouldUseEnglishDimensionLabels(targetLanguageValue) ? "Sinking Rate" : "\u5c5e\u6027";
  return [...new Set(attributes)].map((value) => ({
    type: "attribute",
    normalizedLabel: "sinking rate",
    value,
    text: `${label} ${value}`,
  }));
}

function dimensionFactsEquivalent(left, right) {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type === "measurement") {
    if (left.normalizedLabel !== right.normalizedLabel || left.kind !== right.kind) {
      return false;
    }
    const tolerance = Math.max(0.6, Math.abs(left.baseValue) * 0.01);
    return Math.abs(left.baseValue - right.baseValue) <= tolerance;
  }
  return cleanString(left.value || left.text).toLowerCase() === cleanString(right.value || right.text).toLowerCase();
}

function dimensionFactOrder(fact) {
  return DIMENSION_FACT_LABEL_ORDER.get(fact.normalizedLabel) ?? 99;
}

function collectUniqueDimensionFacts(targetFacts, sourceFacts) {
  for (const fact of sourceFacts) {
    if (!targetFacts.some((existing) => dimensionFactsEquivalent(existing, fact))) {
      targetFacts.push(fact);
    }
  }
  return targetFacts;
}

function isAllowedCreationDimensionFact(fact = {}) {
  return fact.type === "measurement" && CREATION_DIMENSION_SPEC_ALLOWED_LABELS.has(fact.normalizedLabel);
}

function formatDimensionFactsAsLines(facts = []) {
  return facts
    .filter(isAllowedCreationDimensionFact)
    .sort((left, right) => dimensionFactOrder(left) - dimensionFactOrder(right))
    .map((fact) => fact.text);
}

function buildDimensionSpecLinesFromText(value, mode, targetLanguageValue = "") {
  const facts = [];
  normalizeDimensionSpecs(value).forEach((line) => {
    collectUniqueDimensionFacts(
      facts,
      extractDimensionMeasurementFacts(line, mode, targetLanguageValue).filter(isAllowedCreationDimensionFact),
    );
  });
  return formatDimensionFactsAsLines(facts);
}

function getDecimalWeightMeasurements(value = "") {
  const matches = [...cleanString(value).matchAll(/([+-]?(?:\d+\.\d+|\.\d+))(\s*)(kg|g|lb|lbs|oz)\b/giu)];
  return matches.map((match) => ({
    value: match[1],
    spacing: match[2] || "",
    unit: match[3],
    text: `${match[1]}${match[2] || ""}${match[3]}`,
  }));
}

function buildCreationExactNumericValueLock(dimensionSpecSummary = "") {
  const decimalWeights = getDecimalWeightMeasurements(dimensionSpecSummary);
  const lines = [
    "EXACT NUMERIC VALUE LOCK: copy every digit, decimal point, leading zero, space, parenthesis, and unit exactly for all visible specification values.",
  ];
  if (decimalWeights.length === 0) {
    return lines.join(" ");
  }

  lines.push(
    `Decimal weight values that must stay exact: ${decimalWeights.map((entry) => entry.text).join(", ")}.`,
    "Never drop a decimal point, remove a leading zero, change kg/g/lb/oz units, or rescale a weight unless that converted value is explicitly listed.",
  );

  decimalWeights
    .filter((entry) => normalizeDimensionUnitToken(entry.unit) === "kg")
    .forEach((entry) => {
      const parsedValue = Number.parseFloat(entry.value);
      const digitsOnly = entry.value.replace(/[^\d]/gu, "");
      if (!digitsOnly || !Number.isFinite(parsedValue)) {
        return;
      }
      const droppedDecimalDigits = digitsOnly.replace(/^0+/u, "") || digitsOnly;
      const scaledGrams = formatDimensionNumber(parsedValue * 1000);
      lines.push(
        `Do not render ${entry.text} as ${droppedDecimalDigits} kg, ${droppedDecimalDigits}kg, ${entry.value}g, or ${scaledGrams}g.`,
      );
    });

  return lines.join(" ");
}

function extractReferenceDimensionFacts(note, mode, targetLanguageValue = "") {
  return [
    ...extractDimensionModelFacts(note, targetLanguageValue),
    ...extractDimensionMeasurementFacts(note, mode, targetLanguageValue),
    ...extractDimensionHookFacts(note, targetLanguageValue),
    ...extractDimensionActionAttributeFacts(note, targetLanguageValue),
  ];
}

export function formatCreationDimensionSpecsForMode(value, mode) {
  const dimensionUnitMode = normalizeCreationDimensionUnitMode(mode);
  return normalizeDimensionSpecs(value)
    .map((line) => convertDimensionSpecLine(line, dimensionUnitMode.value))
    .filter(Boolean)
    .join("\n");
}

function hasDimensionMeasurement(value) {
  const text = cleanString(value);
  if (!text) {
    return false;
  }

  DIMENSION_MEASUREMENT_RE.lastIndex = 0;
  const matched = DIMENSION_MEASUREMENT_RE.test(text);
  DIMENSION_MEASUREMENT_RE.lastIndex = 0;
  return matched;
}

function hasDimensionSpecificationValue(value) {
  const text = cleanString(value);
  return Boolean(text) && (hasDimensionMeasurement(text) || DIMENSION_SPEC_VALUE_RE.test(text));
}

function hasDimensionSpecIntent(value) {
  return DIMENSION_SPEC_INTENT_RE.test(cleanString(value).toLowerCase());
}

function hasDimensionReferenceSignal(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) {
    return false;
  }

  return hasDimensionSpecIntent(text) || (hasDimensionSpecificationValue(text) && DIMENSION_SIGNAL_RE.test(text));
}

function hasUsageInstructionSignal(value) {
  return USAGE_INSTRUCTION_SIGNAL_RE.test(cleanString(value).toLowerCase());
}

function hasDetailReferenceSignal(value) {
  return DETAIL_REFERENCE_SIGNAL_RE.test(cleanString(value).toLowerCase());
}

function hasProductSubjectReferenceSignal(value) {
  return PRODUCT_SUBJECT_REFERENCE_RE.test(cleanString(value).toLowerCase());
}

function hasPackageReferenceSignal(value) {
  return PACKAGE_REFERENCE_SIGNAL_RE.test(cleanString(value).toLowerCase());
}

function hasPackageContentReferenceSignal(value) {
  return PACKAGE_CONTENT_REFERENCE_RE.test(cleanString(value).toLowerCase());
}

function buildReferenceDimensionSpecLines(referenceImageRoles = [], mode, targetLanguageValue = "") {
  const eligibleEntries = referenceImageRoles.filter((entry) => {
    const note = cleanString(entry?.note);
    if (!hasDimensionSpecificationValue(note)) {
      return false;
    }

    return cleanString(entry?.role) === "dimensions" || hasDimensionReferenceSignal(note);
  });
  const dimensionEntries = eligibleEntries.filter((entry) => cleanString(entry?.role) === "dimensions");
  const sourceEntries = dimensionEntries.length > 0 ? dimensionEntries : eligibleEntries;
  const facts = [];
  for (const entry of sourceEntries) {
    const note = cleanString(entry?.note);
    const extractedFacts = extractReferenceDimensionFacts(note, mode, targetLanguageValue).filter(isAllowedCreationDimensionFact);
    if (extractedFacts.length > 0) {
      collectUniqueDimensionFacts(facts, extractedFacts);
    }
  }

  return formatDimensionFactsAsLines(facts);
}

function buildCreationDimensionPromptInstruction({
  dimensionSpecSummary = "",
  dimensionUnitMode,
  source = "",
} = {}) {
  if (dimensionSpecSummary) {
    const heading =
      source === "reference"
        ? "Dimension specifications recognized from reference notes"
        : "Dimension specifications for this size chart only";
    const usage =
      source === "reference"
        ? "The dimensions/specification image must visibly present these recognized specifications with the selected unit mode; other images may show broad size comparison, but do not print or reveal these exact values."
        : "The dimensions/specification image must visibly present these exact specifications with the selected unit mode; other images may show broad size comparison, but do not print or reveal these exact values.";
    const mandatory =
      "Mandatory visible specification labels: render every listed length, height, width, depth, and weight value above as separate legible labels in the dimensions/specification image. Do not omit, merge, blur, replace, or paraphrase any listed size or weight value.";

    return `${heading}: ${dimensionSpecSummary}. ${dimensionUnitMode.promptInstruction} ${buildCreationExactNumericValueLock(dimensionSpecSummary)} ${mandatory} ${usage}`;
  }

  return `${dimensionUnitMode.promptInstruction} Apply this selected unit mode only to length, height, width, depth, and weight values recognized from dimension/specification reference images or analyst notes. Do not invent missing measurements; only render size or weight values visible in the supplied references or explicitly provided by the user.`;
}

function buildCreationNonDimensionSpecBoundaryInstruction(hasReservedDimensionSpecs) {
  return hasReservedDimensionSpecs
    ? "Do not render, print, quote, or reveal exact length, height, width, depth, or weight values in this image; reserve these exact size and weight values for the dimensions/specification image only."
    : "";
}

export function normalizeCreationTargetLanguage(value) {
  const normalized = cleanString(value);
  return (
    CREATION_TARGET_LANGUAGE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_TARGET_LANGUAGE_OPTIONS.find((option) => option.value === DEFAULT_CREATION_TARGET_LANGUAGE) ||
    CREATION_TARGET_LANGUAGE_OPTIONS[0]
  );
}

export function normalizeCreationImageCount(value) {
  const normalized = Number.parseInt(cleanString(value), 10);
  return CREATION_IMAGE_COUNT_OPTIONS.includes(normalized) ? normalized : DEFAULT_CREATION_IMAGE_COUNT;
}

export function normalizeCreationSelectedRoles(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch (_error) {
      entries = value.split(/[\n,，；;]+/);
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  const seen = new Set();
  return entries
    .map((entry) => cleanString(typeof entry === "string" ? entry : entry?.role || entry?.value))
    .map((roleValue) => CREATION_ITEM_ROLES.find((role) => role.role === roleValue))
    .filter(Boolean)
    .filter((role) => {
      if (seen.has(role.role)) {
        return false;
      }

      seen.add(role.role);
      return true;
    });
}

export function normalizeCreationScenario(value) {
  const normalized = cleanString(value);
  return CREATION_SCENARIO_OPTIONS.find((option) => option.value === normalized) || CREATION_SCENARIO_OPTIONS[0];
}

export function normalizeCreationVisualLanguage(value) {
  const normalized = cleanString(value);
  return (
    CREATION_VISUAL_LANGUAGE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_VISUAL_LANGUAGE_OPTIONS.find((option) => option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) ||
    CREATION_VISUAL_LANGUAGE_OPTIONS[0]
  );
}

export function normalizeCreationIndustryTemplate(value) {
  return normalizeCreationIndustryTemplateOption(value);
}

export function getCreationScenarioRolePreset(value) {
  const normalized = cleanString(value);
  return normalizeCreationSelectedRoles(CREATION_SCENARIO_ROLE_PRESETS[normalized] || CREATION_SCENARIO_ROLE_PRESETS.standard);
}

export function getCreationIndustryRolePreset(value) {
  return normalizeCreationSelectedRoles(getCreationIndustryTemplateRolePreset(value));
}

export function getCreationScenarioRoleInstruction(scenarioValue, roleValue) {
  const scenario = normalizeCreationScenario(scenarioValue);
  const role = cleanString(roleValue);
  const scenarioInstructions = CREATION_SCENARIO_ROLE_INSTRUCTIONS[scenario.value] || CREATION_SCENARIO_ROLE_INSTRUCTIONS.standard;
  return scenarioInstructions[role] || scenarioInstructions.default || CREATION_SCENARIO_ROLE_INSTRUCTIONS.standard.default;
}

function getCreationRoleIntentInstruction(roleValue) {
  return CREATION_ROLE_INTENT_INSTRUCTIONS[cleanString(roleValue)] || "";
}

function getCreationRoleRenderingConstraint(roleValue) {
  return CREATION_ROLE_RENDERING_CONSTRAINTS[cleanString(roleValue)] || "";
}

function getCreationIndustryTemplateRoleInstruction(industryTemplate, roleValue) {
  const role = cleanString(roleValue);
  const roleInstructions = industryTemplate?.rolePromptInstructions || {};
  return cleanString(roleInstructions[role] || roleInstructions.default || "");
}

function buildCreationVisualLanguageGuidance(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  const isDefaultClassic = option.value === DEFAULT_CREATION_VISUAL_LANGUAGE;

  return [
    `VISUAL LANGUAGE LOCK: Shared visual language: ${option.label}. ${
      isDefaultClassic
        ? "Use this classic commercial product photography look as the set-wide visual authority."
        : "This selected look must override the generic ecommerce baseline for the whole set."
    }`,
    option.promptInstruction,
    "Keep the whole set visually consistent in lighting, color grading, background family, material treatment, brand atmosphere, layout density, and realism level; vary only the role-specific camera angle, framing, scene density, props, and information layout.",
    isDefaultClassic
      ? "Do not drift into reference-style matching, lifestyle editorial, social UGC, premium studio drama, or unrelated ad poster styles unless explicitly selected."
      : "Do not drift back to neutral classic commercial studio photography unless the selected visual language explicitly asks for it.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationVisualLanguageQualityLine(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Ecommerce marketing quality, clear composition, realistic product details, polished commercial lighting.";
  }

  return "Ecommerce marketing quality and realistic product details; the final lighting, palette, background system, material mood, and layout density must follow the selected visual language instead of default polished commercial treatment.";
}

function buildCreationSkuBackgroundInstruction(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Change the background from the uploaded white or plain product photo into a clean classic-commercial ecommerce background with polished neutral lighting, controlled shadow, and the same background system used by the SKU series.";
  }

  return "Change the background from the uploaded white or plain product photo into a new ecommerce setting that follows the selected visual language lock; preserve the SKU subject exactly while changing only the surrounding scene, surface, light, and layout mood.";
}

function buildCreationSkuQualityLine(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Ecommerce SKU image quality, clear centered subject, clean background separation, realistic product details, and the same classic commercial photography template across all SKU images.";
  }

  return "Ecommerce SKU image quality, clear subject recognition, realistic product details, and a background, light, surface, and composition that visibly match the selected visual language.";
}

function buildCreationSkuSeriesConsistencyInstruction(skuSubjects = []) {
  const subjects = Array.isArray(skuSubjects) ? skuSubjects : [];
  if (subjects.length <= 1) {
    return "";
  }

  const subjectList = subjects
    .map((subject, index) => cleanString(subject.title || subject.id || subject.filenames?.[0] || `SKU ${index + 1}`))
    .filter(Boolean)
    .join("; ");

  return [
    "SKU SERIES CONSISTENCY LOCK: Use the same visual template across first generation and retries for every SKU image in this set.",
    subjectList ? `Series subjects: ${subjectList}.` : "",
    "Use one locked SKU frame blueprint: same camera height, focal length, lens perspective, product scale ratio, canvas margins, background plane, shadow softness, and whitespace balance.",
    "Keep camera angle, product scale, canvas composition, background system, lighting direction, shadow style, typography treatment, icon style, margins, and overall ecommerce template consistent across all SKU images.",
    "Only change the exact SKU subject, colorway, and subject-specific facts; do not change framing, poster layout, graphic style, or visual language between SKU images.",
    "Do not generate each SKU as an independent ad concept; they must read as sibling frames from one product series.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationSkuMainSubjectLock(skuSubject = {}) {
  const subjectName = cleanString(skuSubject.filenames?.[0] || skuSubject.title || skuSubject.id);
  if (!subjectName) {
    return "";
  }

  return [
    `SKU MAIN SUBJECT LOCK: Use ${subjectName} as the SKU product subject for this image.`,
    "Keep the SKU image aligned with the main creation subject; change only the surrounding background, surface, light, layout, allowed count duplication, and requested SKU information.",
    "Do not substitute another product reference, colorway, accessory, package image, style reference, scene object, or newly invented product as the SKU subject.",
  ].join(" ");
}

function buildCreationSkuSourceTextBoundaryInstruction() {
  return [
    "Treat source-image text outside the physical product as non-subject noise.",
    "Do not reproduce source-image corner badges, stickers, promotional labels, catalog captions, price tags, title bars, watermarks, bottom SKU/color text blocks, or words such as \"2025 NEW\" and \"WHITE EDIT\" unless the user explicitly asks for that exact overlay.",
    "The generated SKU may use only the current SKU template's required product code or color label; do not inherit the reference card's overlay wording, placement, badge shape, or typography.",
  ].join(" ");
}

function getCreationReferenceNotesByRole(referenceImageRoles = [], role = "") {
  return (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => cleanString(entry?.role) === role)
    .map((entry) => cleanString(entry.note || entry.analysisNote || entry.description))
    .filter(Boolean);
}

function buildCreationSkuPackageListSummary(contentAllocation, referenceImageRoles = []) {
  const packageFacts = [
    ...selectCreationContentFacts(contentAllocation.descriptionFacts, ["package"], 16),
    ...selectCreationContentFacts(contentAllocation.sellingPointFacts, ["package"], 8),
    ...getCreationReferenceNotesByRole(referenceImageRoles, "package"),
  ];
  return formatCreationContentFacts(packageFacts);
}

function buildCreationSkuDimensionSummary(dimensionSpecSummary = "", referenceImageRoles = []) {
  const dimensionFacts = [
    dimensionSpecSummary,
    ...getCreationReferenceNotesByRole(referenceImageRoles, "dimensions"),
  ];
  return formatCreationContentFacts(dimensionFacts);
}

function getCreationSkuSupportingReferenceRoles(skuGenerationRule) {
  const roles = [];
  if (skuGenerationRule.includeDimensions) {
    roles.push("dimensions");
  }
  return roles;
}

function buildCreationSkuGenerationRuleInstruction({
  skuGenerationRule,
  packageListSummary,
  dimensionSummary,
} = {}) {
  const rule = normalizeCreationSkuGenerationRule(skuGenerationRule?.value || skuGenerationRule);
  if (rule.value === "none") {
    return "";
  }

  const scope =
    rule.includePackageList && rule.includeDimensions
      ? "add package-list content and dimensions"
      : rule.includePackageList
        ? "add package-list content"
        : "add dimensions";
  const lines = [
    `SKU generation rule: ${scope}.`,
    rule.includePackageList && packageListSummary
      ? `Package-list content only, not packaging box appearance: ${packageListSummary}.`
      : "",
    rule.includePackageList
      ? "Treat package-list content as text/fact inventory for included items and quantities; do not attach or copy the package-list image, package box exterior, package artwork, shipping carton, or container design into the SKU subject."
      : "",
    rule.includeDimensions && dimensionSummary
      ? `Dimension/specification content to keep accurate when useful: ${dimensionSummary}.`
      : "",
    rule.includeDimensions
      ? "Use size/specification references only for factual callouts, scale, capacity, and compatibility; do not turn a size chart into the sellable SKU subject."
      : "",
  ];
  return lines.filter(Boolean).join(" ");
}

function buildCreationSkuReferenceScopeInstruction(skuGenerationRule) {
  const rule = normalizeCreationSkuGenerationRule(skuGenerationRule?.value || skuGenerationRule);
  if (rule.includePackageList || rule.includeDimensions) {
    return [
      "Use the SKU subject reference as the only physical sellable product in this SKU image.",
      rule.includePackageList
        ? "Use package-list text only as factual included-item and quantity content; do not copy package-list images, package-box exterior appearance, packaging artwork, shipping cartons, or container design."
        : "Ignore packaging-only references when composing this SKU image.",
      rule.includeDimensions
        ? "Use dimension references only as factual size/specification content; do not copy their chart layout as the SKU subject."
        : "Ignore dimension-only references when composing this SKU image.",
      "Ignore accessory-only, material-only, scene, and style references when composing this SKU image.",
    ].join(" ");
  }
  return "Ignore accessory-only, packaging-only, dimension-only, material-only, scene, and style references when composing this SKU image.";
}

function buildCreationSkuSubjectUnitCountInstruction(skuSubject = {}) {
  const subjectUnitCount =
    normalizeCreationSubjectUnitCount(skuSubject.subjectUnitCount) ||
    inferCreationSubjectUnitCount([skuSubject.title, skuSubject.note].join(" "));
  if (subjectUnitCount <= 1) {
    return "";
  }

  const evidence = cleanString(skuSubject.note);
  return [
    `SKU SUBJECT UNIT COUNT LOCK: This grouped SKU subject contains ${subjectUnitCount} complete visible product units in one sellable SKU image.`,
    "Preserve the same number of complete visible product units from the supplied SKU subject reference.",
    "Do not collapse them into one unit, and do not split them into separate SKU images.",
    evidence ? `Visible unit evidence: ${evidence}.` : "",
  ].filter(Boolean).join(" ");
}

export function normalizeCreationReferenceRole(value) {
  const normalized = cleanString(value);
  return CREATION_REFERENCE_ROLE_OPTIONS.find((option) => option.value === normalized) || CREATION_REFERENCE_ROLE_OPTIONS[0];
}

export function normalizeCreationReferenceRoles(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch (_error) {
      entries = [];
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => {
      const role = normalizeCreationReferenceRole(entry?.role);
      const filename = cleanString(entry?.filename || entry?.name || `reference-image-${index + 1}`);
      const note = cleanString(entry?.note || entry?.analysisNote || entry?.description);
      return {
        filename,
        role: role.value,
        roleLabel: role.label,
        rolePromptLabel: role.promptLabel,
        promptInstruction: role.promptInstruction,
        note,
      };
    })
    .filter((entry) => entry.filename);
}

function parseArrayInput(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

function normalizeNumberArray(value) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  return entries
    .map((entry) => Number.parseInt(cleanString(entry), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}

function getSkuSubjectReferenceIndexes(source = {}) {
  return normalizeNumberArray(
    source.referenceIndexes ||
      source.reference_indices ||
      source.reference_indexes ||
      source.indexes ||
      source.indices ||
      source.index ||
      source.referenceIndex,
  );
}

function getSkuSubjectFilenames(source = {}, referenceImageRoles = []) {
  const explicitFilenames = uniqueCleanStrings([
    ...(Array.isArray(source.filenames) ? source.filenames : []),
    ...(Array.isArray(source.referenceFilenames) ? source.referenceFilenames : []),
    ...(Array.isArray(source.reference_filenames) ? source.reference_filenames : []),
    source.filename,
    source.name,
  ]);
  const indexFilenames = getSkuSubjectReferenceIndexes(source)
    .map((index) => referenceImageRoles[index - 1]?.filename)
    .filter(Boolean);

  return uniqueCleanStrings([...explicitFilenames, ...indexFilenames]);
}

function isSkuSubjectAccessoryLike(source = {}, filenames = [], referenceImageRoles = []) {
  const text = [
    source.kind,
    source.type,
    source.role,
    source.title,
    source.name,
    source.note,
    source.description,
  ]
    .map(cleanString)
    .join(" ")
    .toLowerCase();
  if (/\b(accessory|accessories|package|packaging|included|material|scene|style|support)\b/.test(text)) {
    return true;
  }
  if (hasUsageInstructionSignal(text)) {
    return true;
  }

  const filenameSet = new Set(filenames.map((filename) => filename.toLowerCase()));
  const matchingRoles = referenceImageRoles.filter((entry) => filenameSet.has(cleanString(entry.filename).toLowerCase()));
  return matchingRoles.length > 0 && matchingRoles.every((entry) => !isCreationSubjectReferenceRole(entry.role));
}

function normalizeCreationSkuSubjectEntry(entry = {}, index = 0, referenceImageRoles = []) {
  const source = entry && typeof entry === "object" ? entry : {};
  const referenceIndexes = getSkuSubjectReferenceIndexes(source);
  const filenames = getSkuSubjectFilenames(source, referenceImageRoles);
  const title = cleanString(source.title || source.name || source.label || filenames[0] || `SKU ${index + 1}`);
  const id = cleanString(source.id || source.subjectId || source.subject_id || source.groupId || source.group_id || filenames[0] || title || `sku-${index + 1}`);
  const note = cleanString(source.note || source.description || source.summary || source.reason);
  const rawBundleCount = source.bundleCount ?? source.bundle_count ?? source.quantity ?? source.count ?? source.skuBundleCount;
  const bundleCount = rawBundleCount === undefined || rawBundleCount === null || cleanString(rawBundleCount) === ""
    ? 0
    : normalizeCreationSkuBundleCount(rawBundleCount);
  const rawSubjectUnitCount =
    source.subjectUnitCount ??
    source.subject_unit_count ??
    source.visibleUnitCount ??
    source.visible_unit_count ??
    source.unitCount ??
    source.unit_count;
  const subjectUnitCount = normalizeCreationSubjectUnitCount(rawSubjectUnitCount) || inferCreationSubjectUnitCount([title, note].join(" "));

  if (!id || filenames.length === 0 || isSkuSubjectAccessoryLike(source, filenames, referenceImageRoles)) {
    return null;
  }

  return {
    id,
    title,
    referenceIndexes,
    filenames,
    note,
    ...(bundleCount ? { bundleCount } : {}),
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
  };
}

function getSkuReferenceSubjectEntries(referenceImageRoles = []) {
  return referenceImageRoles
    .map((entry, index) => ({ ...entry, referenceIndex: index + 1 }))
    .filter((entry) => isCreationSubjectReferenceRole(entry.role) && cleanString(entry.filename));
}

function buildSkuSubjectsFromReferenceEntries(entries = []) {
  return entries.map((entry, index) => ({
      id: cleanString(entry.filename || `sku-${index + 1}`),
      title: cleanString(entry.filename || `SKU ${index + 1}`),
      referenceIndexes: [entry.referenceIndex || index + 1],
      filenames: [cleanString(entry.filename)],
      note: cleanString(entry.note),
    }));
}

function buildFallbackSkuSubjects(referenceImageRoles = []) {
  return buildSkuSubjectsFromReferenceEntries(getSkuReferenceSubjectEntries(referenceImageRoles));
}

function getMatchingSkuReferenceRoles(subject = {}, referenceImageRoles = []) {
  const filenames = new Set(
    uniqueCleanStrings(subject.filenames).map((filename) => filename.toLowerCase()),
  );
  if (filenames.size === 0) {
    return [];
  }

  return (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .map((entry, index) => ({ ...entry, referenceIndex: index + 1 }))
    .filter((entry) => isCreationSubjectReferenceRole(entry.role) && filenames.has(cleanString(entry.filename).toLowerCase()));
}

function enrichCreationSkuSubjectFromReferenceRoles(subject = {}, referenceImageRoles = []) {
  const matchedRoles = getMatchingSkuReferenceRoles(subject, referenceImageRoles);
  if (matchedRoles.length === 0) {
    return subject;
  }

  const ownNote = cleanString(subject.note);
  const referenceNote = uniqueCleanStrings(matchedRoles.map((entry) => entry.note)).join(" | ");
  const inferenceNote = uniqueCleanStrings([ownNote, referenceNote]).join(" | ");
  const note = !ownNote || (referenceNote && referenceNote.length > ownNote.length)
    ? uniqueCleanStrings([ownNote, referenceNote]).join(" | ")
    : ownNote;
  const referenceIndexes = normalizeNumberArray([
    ...(Array.isArray(subject.referenceIndexes) ? subject.referenceIndexes : []),
    ...matchedRoles.map((entry) => entry.referenceIndex),
  ]);
  const subjectUnitCount = Math.max(
    normalizeCreationSubjectUnitCount(subject.subjectUnitCount),
    ...matchedRoles.map((entry) => normalizeCreationSubjectUnitCount(entry.subjectUnitCount ?? entry.subject_unit_count)),
    inferCreationSubjectUnitCount([subject.title, inferenceNote].join(" ")),
  );

  return {
    ...subject,
    ...(referenceIndexes.length > 0 ? { referenceIndexes } : {}),
    ...(note ? { note } : {}),
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
  };
}

export function normalizeCreationSkuSubjects(value, referenceImageRoles = []) {
  const normalizedReferenceImageRoles = normalizeCreationReferenceRoles(referenceImageRoles);
  const entries = parseArrayInput(value);
  const subjectSource = entries.length > 0 ? entries : buildFallbackSkuSubjects(normalizedReferenceImageRoles);
  const subjects = subjectSource
    .map((entry, index) => normalizeCreationSkuSubjectEntry(entry, index, normalizedReferenceImageRoles))
    .filter(Boolean);
  const enrichedSubjects = subjects.map((subject) =>
    enrichCreationSkuSubjectFromReferenceRoles(subject, normalizedReferenceImageRoles),
  );
  const seen = new Set();

  return enrichedSubjects.filter((subject) => {
    const key = (subject.id || subject.filenames.join("|")).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function inferCreationReferenceRole(value) {
  const raw = cleanString(value).toLowerCase();

  if (hasPackageContentReferenceSignal(raw)) {
    return "package";
  }
  if (hasDimensionReferenceSignal(raw)) {
    return "dimensions";
  }
  if (hasUsageInstructionSignal(raw)) {
    return "usage";
  }
  if (hasDetailReferenceSignal(raw) && !hasProductSubjectReferenceSignal(raw)) {
    return "material";
  }
  if (hasPackageReferenceSignal(raw)) {
    return "package";
  }
  if (/material|texture|surface|fabric|finish|detail|close.?up|材质|纹理|质感|表面|细节|工艺/.test(raw)) {
    return "material";
  }
  if (/scene|usage|context|environment|lifestyle|使用|场景|环境|生活|摆放/.test(raw)) {
    return "scene";
  }
  if (/style|lighting|composition|mood|background|风格|光线|构图|背景|调性/.test(raw)) {
    return "style";
  }
  if (/other|support|其它|其他|辅助/.test(raw)) {
    return "other";
  }

  return "product";
}

function normalizeCreationReferenceAnalysisEntry(entry, index, filenames) {
  const source = typeof entry === "string" ? { note: entry, role: inferCreationReferenceRole(entry) } : entry || {};
  const resolvedIndex = Math.max(1, Number(source.index) || index + 1);
  const filename = cleanString(source.filename || source.name || filenames[resolvedIndex - 1] || filenames[index] || `reference-image-${resolvedIndex}`);
  const roleText = [source.roleLabel, source.title, source.note, source.description, source.reason, source.summary, filename]
    .filter(Boolean)
    .join(" ");
  const evidenceText = [source.title, source.note, source.description, source.reason, source.summary, filename]
    .filter(Boolean)
    .join(" ");
  const rawExplicitRole = cleanString(source.role);
  const hasKnownExplicitRole = CREATION_REFERENCE_ROLE_OPTIONS.some((option) => option.value === rawExplicitRole);
  const explicitRole = hasKnownExplicitRole ? normalizeCreationReferenceRole(rawExplicitRole) : null;
  const inferredRole = inferCreationReferenceRole(roleText);
  const shouldUseDimensionRole =
    hasDimensionReferenceSignal(roleText) &&
    (!explicitRole || explicitRole.value === "other" || (explicitRole.value === "product" && hasDimensionSpecIntent(roleText)));
  const shouldUseUsageRole =
    hasUsageInstructionSignal(roleText) &&
    (!explicitRole || explicitRole.value === "other" || explicitRole.value === "product" || explicitRole.value === "scene");
  const shouldUseDetailRole =
    hasDetailReferenceSignal(evidenceText) &&
    (!explicitRole || explicitRole.value === "other" || (explicitRole.value === "product" && !hasProductSubjectReferenceSignal(evidenceText)));
  const shouldUsePackageRole =
    (hasPackageContentReferenceSignal(evidenceText) &&
      (!explicitRole || explicitRole.value === "other" || explicitRole.value === "product" || explicitRole.value === "dimensions")) ||
    (hasPackageReferenceSignal(evidenceText) &&
      (!explicitRole || explicitRole.value === "other" || explicitRole.value === "product"));
  const role = normalizeCreationReferenceRole(
    shouldUsePackageRole
      ? "package"
      : shouldUseDimensionRole
        ? "dimensions"
        : shouldUseUsageRole
          ? "usage"
          : shouldUseDetailRole
            ? "material"
            : explicitRole?.value || inferredRole,
  );
  const note = cleanString(source.note || source.description || source.reason || source.summary);

  if (!filename) {
    return null;
  }

  return {
    index: resolvedIndex,
    filename,
    role: role.value,
    roleLabel: role.label,
    rolePromptLabel: role.promptLabel,
    promptInstruction: role.promptInstruction,
    note,
  };
}

function getCreationReferenceAnalysisGroupedSubjectUnitCount(entry = {}, skuSubjects = []) {
  const filename = cleanString(entry.filename).toLowerCase();
  const referenceIndex = Number(entry.index) || 0;
  const counts = [inferCreationSubjectUnitCount([entry.title, entry.note, entry.description, entry.reason, entry.summary].join(" "))];

  (Array.isArray(skuSubjects) ? skuSubjects : []).forEach((subject = {}) => {
    const filenames = uniqueCleanStrings(subject.filenames).map((item) => item.toLowerCase());
    const referenceIndexes = Array.isArray(subject.referenceIndexes) ? subject.referenceIndexes : [];
    const matchesFilename = filename && filenames.includes(filename);
    const matchesIndex = referenceIndex > 0 && referenceIndexes.includes(referenceIndex);
    if (!matchesFilename && !matchesIndex) {
      return;
    }
    counts.push(
      normalizeCreationSubjectUnitCount(subject.subjectUnitCount),
      inferCreationSubjectUnitCount([subject.title, subject.note].join(" ")),
    );
  });

  return Math.max(0, ...counts);
}

function shouldDowngradeReferenceProductAnalysisRole(entry = {}, subjectUnitCount = 0) {
  if (cleanString(entry.role) !== CREATION_REFERENCE_PRODUCT_ROLE) {
    return false;
  }
  const text = [entry.filename, entry.roleLabel, entry.title, entry.note, entry.description, entry.reason, entry.summary]
    .map(cleanString)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    /primary subject anchor|set-wide primary|main subject anchor|full-set main subject|selected by user|user-selected|explicitly selected|用户选择|用户指定|主锚点|主主体锚点|全套主体锚点|全套主主体/.test(
      text,
    )
  ) {
    return false;
  }
  return subjectUnitCount > 1 || /ordinary|white-background|sku|colorway|sellable|白底|色款|配色|可售/.test(text);
}

function getCreationReferenceAnalysisRoleCorrectionReason(entry = {}, subjectUnitCount = 0) {
  const existingReason = cleanString(entry.roleCorrectionReason || entry.role_correction_reason);
  if (existingReason) {
    return existingReason;
  }
  if (!shouldDowngradeReferenceProductAnalysisRole(entry, subjectUnitCount)) {
    return "";
  }
  if (subjectUnitCount > 1) {
    return `已从 reference-product 调整为 product：识别到 ${subjectUnitCount} 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product；普通白底 SKU、色款图或多单位可售商品图应使用 product。`;
  }
  return "已从 reference-product 调整为 product：该图是普通白底 SKU、色款图或可售商品图。只有用户明确指定的单一全套主主体锚点才保留 reference-product。";
}

function normalizeCreationReferenceAnalysisUnitCountNote(note = "", subjectUnitCount = 0) {
  if (subjectUnitCount <= 1) {
    return cleanString(note);
  }
  const cleanedNote = cleanString(note)
    .replace(/(?:[，,；;\s]*)?图中共\s*(?:[一二两三四五六七八九十]|\d{1,2})\s*个完整产品单位[。.]?/gu, "")
    .replace(/[，,；;\s]+$/u, "")
    .trim();
  const countNote = `图中共 ${subjectUnitCount} 个完整产品单位。`;
  return cleanedNote ? `${trimTerminalSentencePunctuation(cleanedNote)}；${countNote}` : countNote;
}

function enrichCreationReferenceAnalysisEntryFromSkuSubjects(entry = {}, skuSubjects = []) {
  const subjectUnitCount = getCreationReferenceAnalysisGroupedSubjectUnitCount(entry, skuSubjects);
  const roleCorrectionReason = getCreationReferenceAnalysisRoleCorrectionReason(entry, subjectUnitCount);
  const role = roleCorrectionReason
    ? normalizeCreationReferenceRole("product")
    : normalizeCreationReferenceRole(entry.role);
  return {
    ...entry,
    role: role.value,
    roleLabel: role.label,
    rolePromptLabel: role.promptLabel,
    promptInstruction: role.promptInstruction,
    ...(roleCorrectionReason ? { roleCorrectionReason } : {}),
    note: normalizeCreationReferenceAnalysisUnitCountNote(entry.note, subjectUnitCount),
  };
}

function getCreationReferenceAnalysisVisualLanguageSource(source = {}) {
  const direct =
    source.visualLanguage ||
    source.visual_language ||
    source.visualLanguageRecommendation ||
    source.visual_language_recommendation ||
    source.visualLanguageSuggestion ||
    source.visual_language_suggestion;
  if (direct && typeof direct === "object") {
    return direct.value || direct.visualLanguage || direct.visual_language || direct.id || direct.mode;
  }
  return direct;
}

function getCreationReferenceAnalysisVisualLanguageReason(source = {}) {
  const direct = source.visualLanguageSuggestion || source.visual_language_suggestion;
  return cleanString(
    source.visualLanguageReason ||
      source.visual_language_reason ||
      source.visualLanguageNote ||
      source.visual_language_note ||
      (direct && typeof direct === "object" ? direct.reason || direct.note || direct.description : ""),
  );
}

export function normalizeCreationReferenceAnalysis(value = {}, filenames = []) {
  const source = value && typeof value === "object" ? value : {};
  const referenceRoles = Array.isArray(source.reference_roles)
    ? source.reference_roles
    : Array.isArray(source.recommendations)
      ? source.recommendations
      : Array.isArray(source.image_roles)
        ? source.image_roles
        : [];
  const normalizedFilenames = Array.isArray(filenames) ? filenames.map(cleanString).filter(Boolean) : [];
  const preliminaryRecommendations = referenceRoles
    .map((entry, index) => normalizeCreationReferenceAnalysisEntry(entry, index, normalizedFilenames))
    .filter(Boolean)
    .slice(0, MAX_CREATION_REFERENCE_IMAGES);
  const visualLanguage = normalizeCreationVisualLanguage(getCreationReferenceAnalysisVisualLanguageSource(source));
  const skuSubjects = normalizeCreationSkuSubjects(source.skuSubjects || source.sku_subjects, preliminaryRecommendations);
  const recommendations = preliminaryRecommendations.map((entry) =>
    enrichCreationReferenceAnalysisEntryFromSkuSubjects(entry, skuSubjects),
  );

  return {
    summary: cleanString(source.summary || source.relationship || source.title),
    categoryHint: cleanString(source.categoryHint || source.category_hint || source.category || source.categoryName),
    categoryPath: cleanString(source.categoryPath || source.category_path),
    visualLanguage: visualLanguage.value,
    visualLanguageLabel: visualLanguage.label,
    visualLanguageReason: getCreationReferenceAnalysisVisualLanguageReason(source),
    recommendations,
    skuSubjects,
    risks: Array.isArray(source.risks) ? source.risks.map(cleanString).filter(Boolean) : [],
  };
}

function getCreationPrimarySubjectReferenceRole(referenceImageRoles = []) {
  const entries = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  return (
    entries.find((entry) => cleanString(entry?.role) === CREATION_REFERENCE_PRODUCT_ROLE && cleanString(entry?.filename)) ||
    entries.find((entry) => isCreationSubjectReferenceRole(entry?.role) && cleanString(entry?.filename)) ||
    null
  );
}

function buildCreationPrimarySubjectLock(referenceImageRoles = []) {
  const primarySubject = getCreationPrimarySubjectReferenceRole(referenceImageRoles);
  if (!primarySubject) {
    return "";
  }

  const hasOtherProductSubjects = referenceImageRoles.some(
    (entry) => entry !== primarySubject && isCreationSubjectReferenceRole(entry?.role) && cleanString(entry?.filename),
  );

  return [
    `SET-WIDE PRIMARY SUBJECT LOCK: Use ${primarySubject.filename} as the primary visual product subject for every non-SKU image in this creation set.`,
    "Preserve that selected subject's silhouette, proportions, colorway, materials, logos, markings, hardware, front/back structure, straps/handles, seams, and visible feature placement across all role images.",
    hasOtherProductSubjects
      ? "Other product-subject references are secondary comparison or variant context; do not let them replace the selected primary subject."
      : "",
    "Supporting references may influence only their assigned role constraints, background, scene, dimensions, usage, material, package, or style; they must not become the main sellable product subject.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationReferenceGuidance(referenceImageRoles = []) {
  if (referenceImageRoles.length === 0) {
    return "Use any supplied reference images only for product identity, material, proportions, packaging, and visual constraints.";
  }

  const roleLines = referenceImageRoles
    .map(
      (entry, index) => {
        const note = cleanString(entry.note);
        const includeNote = note && entry.role !== "dimensions" && !hasDimensionReferenceSignal(note) && !hasDimensionSpecificationValue(note);
        return `${index + 1}. ${entry.filename} = ${entry.rolePromptLabel}: ${entry.promptInstruction}${includeNote ? ` Analyst note: ${note}.` : ""}`;
      },
    )
    .join(" ");

  return `Reference image roles: ${roleLines} ${buildCreationPrimarySubjectLock(referenceImageRoles)} Use these roles to decide what each supplied reference image should influence; do not copy unrelated objects or layouts from references.`;
}

function buildCreationLogoGuidance(logoOptions = {}) {
  const logo = normalizeCreationLogoOptions(logoOptions);
  if (!logo.enabled) {
    return "";
  }

  return [
    `Logo reference image: ${logo.filename}.`,
    `Place this supplied logo at the ${logo.promptPosition} (${logo.placement}) with clean safe margins.`,
    logo.backgroundInstruction,
    "Keep the logo legible and proportional; do not invent extra brand logos or unrelated watermarks.",
  ].join(" ");
}

function buildCreationSkuPrompt({
  skuSubject,
  skuSubjects,
  productLine,
  targetLanguage,
  visualLanguage,
  logoOptions,
  skuGenerationRule,
  packageListSummary,
  dimensionSummary,
}) {
  const subjectTitle = cleanString(skuSubject.title || skuSubject.id || "SKU subject");
  const referenceList = skuSubject.filenames.join(", ");
  const bundleCount = normalizeCreationSkuBundleCount(skuSubject.bundleCount);
  const subjectUnitCount =
    normalizeCreationSubjectUnitCount(skuSubject.subjectUnitCount) ||
    inferCreationSubjectUnitCount([skuSubject.title, skuSubject.note].join(" "));
  const bundleInstruction =
    bundleCount > 1 && subjectUnitCount <= 1
      ? [
          `Render exactly ${bundleCount} identical copies of this same SKU subject, copying and arranging the supplied main SKU subject into a ${bundleCount}-piece same-product combination pack.`,
          `The final SKU image must show exactly ${bundleCount} complete visible product units from the same subject.`,
          `Do not output one enlarged product unit when the requested combination count is ${bundleCount}.`,
          "Do not change any individual copy's shape, proportions, colors, materials, intrinsic markings, product-surface logos or model identifiers, hooks, hardware, or visible structure.",
          "The only SKU-count change is duplication of the same supplied subject; do not introduce a second distinct SKU, accessory-only subject, or redesigned variant.",
        ].join(" ")
      : "";

  return [
    `Create one SKU product image for the distinct sellable subject: ${subjectTitle}.`,
    buildCreationSkuMainSubjectLock(skuSubject),
    buildCreationSkuSeriesConsistencyInstruction(skuSubjects),
    buildCreationSkuSubjectUnitCountInstruction(skuSubject),
    bundleInstruction,
    `Product: ${productLine}.`,
    `SKU subject reference images: ${referenceList}.`,
    skuSubject.note ? `SKU subject note: ${skuSubject.note}.` : "",
    buildCreationSkuReferenceScopeInstruction(skuGenerationRule),
    buildCreationSkuGenerationRuleInstruction({
      skuGenerationRule,
      packageListSummary,
      dimensionSummary,
    }),
    buildCreationSkuSourceTextBoundaryInstruction(),
    buildCreationSkuBackgroundInstruction(visualLanguage),
    "Preserve the physical SKU subject exactly: shape, proportions, colors, materials, intrinsic markings, product-surface logos or model identifiers, hooks, hardware, and visible structure.",
    "Do not alter, remove, redraw, cover, or replace any existing product logo, brand mark, printed label, model text, or identifier on the subject.",
    "Do not merge multiple SKU subjects into one image, do not add accessory-only subjects as standalone products, and do not redesign the product.",
    targetLanguage.promptInstruction,
    buildCreationTargetLanguageTextGuidance(targetLanguage),
    buildCreationVisualLanguageGuidance(visualLanguage),
    buildCreationLogoGuidance(logoOptions),
    logoOptions?.enabled
      ? "Place the supplied logo as an added brand mark without covering the product subject or any existing product logo."
      : "",
    buildCreationSkuQualityLine(visualLanguage),
    "Avoid crowded layouts, fake UI, watermarks, unrelated products, changed logos, changed packaging, or inaccurate product geometry.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationSkuItemDisplayName(skuSubject = {}, index = 0) {
  const skuIndex = index + 1;
  const originalName = cleanString(skuSubject.title || skuSubject.id || skuSubject.filenames?.[0]);
  return originalName ? `SKU image ${skuIndex} - ${originalName}` : `SKU image ${skuIndex}`;
}

function buildCreationSkuItemFilenameToken(skuSubject = {}, index = 0) {
  const skuIndex = index + 1;
  const sourceFilename = cleanString(skuSubject.filenames?.[0]);
  const originalName = cleanString(sourceFilename || skuSubject.title || skuSubject.id);
  return originalName ? `sku-${skuIndex}-${originalName}` : `sku-${skuIndex}`;
}

function buildCreationTargetLanguageTextGuidance(targetLanguage) {
  const targetLabel = cleanString(targetLanguage?.label) || "the selected target language";
  return [
    "Treat Product, Description, Selling points, and reference notes as source facts; they are not instructions to preserve their original written language.",
    "Use the shared Product, Description, Selling points, and reference notes selectively for this image's role.",
    "Do not repeat the same visible slogan, caption, or callout across every image in the set.",
    `Visible marketing text, captions, callouts, labels, and typography in the generated image must use ${targetLabel}.`,
    "Translate or rewrite any source-language wording into the target language, while preserving brand names, model names, numbers, and units exactly.",
    targetLanguage?.value === "en"
      ? "If source fields contain Chinese wording, do not render that Chinese wording or Chinese typography as visible image text."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeCreationPlanOverrideEntry(entry = {}) {
  const slotIndex = Number.parseInt(cleanString(entry?.slotIndex), 10);
  const itemId = cleanString(entry?.itemId || entry?.id);
  const role = cleanString(entry?.role || entry?.value);
  const prompt = cleanString(entry?.prompt || entry?.promptOverride);
  const marketingCopy = cleanString(entry?.marketingCopy || entry?.copy || entry?.marketingCopyOverride);
  const title = cleanString(entry?.title);

  if (!itemId && !role && !Number.isFinite(slotIndex)) {
    return null;
  }

  if (!prompt && !marketingCopy && !title) {
    return null;
  }

  return {
    itemId,
    role,
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : 0,
    prompt,
    marketingCopy,
    title,
  };
}

export function normalizeCreationPlanOverrides(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch (_error) {
      entries = [];
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map(normalizeCreationPlanOverrideEntry).filter(Boolean);
}

function findCreationPlanOverride(item = {}, overrides = []) {
  return overrides.find(
    (entry) =>
      (entry.itemId && entry.itemId === item.itemId) ||
      (entry.role && entry.role === item.role) ||
      (entry.slotIndex && Number(entry.slotIndex) === Number(item.slotIndex)),
  );
}

export function applyCreationPlanOverrides(plan = {}, value = []) {
  const overrides = normalizeCreationPlanOverrides(value);
  if (overrides.length === 0 || !Array.isArray(plan.items)) {
    return plan;
  }

  return {
    ...plan,
    items: plan.items.map((item) => {
      const override = findCreationPlanOverride(item, overrides);
      if (!override) {
        return item;
      }

      return {
        ...item,
        ...(override.title ? { title: override.title } : {}),
        ...(override.prompt ? { prompt: override.prompt } : {}),
        ...(override.marketingCopy ? { marketingCopy: override.marketingCopy } : {}),
      };
    }),
  };
}

export function buildCreationPlan(input = {}) {
  const productName = cleanString(input.productName);
  const productDescription = cleanString(input.productDescription);
  const sellingPoints = normalizeSellingPoints(input.sellingPoints);
  const dimensionSpecs = cleanString(input.dimensionSpecs);
  const dimensionUnitMode = normalizeCreationDimensionUnitMode(input.dimensionUnitMode);
  const targetLanguage = normalizeCreationTargetLanguage(input.targetLanguage);
  const referenceImageRoles = normalizeCreationReferenceRoles(input.referenceImageRoles);
  const inputDimensionSpecLines = buildDimensionSpecLinesFromText(
    dimensionSpecs,
    dimensionUnitMode.value,
    targetLanguage.value,
  );
  const referenceDimensionSpecLines =
    inputDimensionSpecLines.length > 0
      ? []
      : buildReferenceDimensionSpecLines(referenceImageRoles, dimensionUnitMode.value, targetLanguage.value);
  const dimensionSpecLines = inputDimensionSpecLines.length > 0 ? inputDimensionSpecLines : referenceDimensionSpecLines;
  const dimensionSpecSource = inputDimensionSpecLines.length > 0 ? "input" : referenceDimensionSpecLines.length > 0 ? "reference" : "";
  const dimensionSpecSummary = dimensionSpecLines.length > 0 ? dimensionSpecLines.map(trimTerminalSentencePunctuation).join(" / ") : "";
  const effectiveDimensionSpecs = dimensionSpecLines.join("\n");
  const hasReservedDimensionSpecs =
    Boolean(dimensionSpecSummary) ||
    referenceImageRoles.some((entry) => entry.role === "dimensions" || hasDimensionReferenceSignal(entry.note) || hasDimensionSpecificationValue(entry.note));
  const imageCount = normalizeCreationImageCount(input.imageCount);
  const scenario = normalizeCreationScenario(input.scenario);
  const visualLanguage = normalizeCreationVisualLanguage(input.visualLanguage || input.visual_language);
  const industryTemplate = normalizeCreationIndustryTemplate(input.industryTemplate);
  const skuSubjectInput = input.skuSubjects ?? input.sku_subjects;
  const skuBundleCount = normalizeCreationSkuBundleCount(input.skuBundleCount ?? input.sku_bundle_count);
  const skuGenerationRule = normalizeCreationSkuGenerationRule(input.skuGenerationRule ?? input.sku_generation_rule);
  const normalizedSkuSubjects =
    skuSubjectInput === undefined || skuSubjectInput === null
      ? []
      : normalizeCreationSkuSubjects(skuSubjectInput, referenceImageRoles);
  const skuSubjects = normalizedSkuSubjects.map((subject) => ({
    ...subject,
    bundleCount: normalizeCreationSkuBundleCount(subject.bundleCount, skuBundleCount),
  }));
  const logoOptions = normalizeCreationLogoOptions(input.logoOptions || input.logo);
  const selectedRoles = normalizeCreationSelectedRoles(input.selectedRoles);
  const industryPresetRoles = getCreationIndustryRolePreset(industryTemplate.value);
  const industryPresetRoleSet = new Set(industryPresetRoles.map((role) => role.role));
  const defaultRoles =
    industryPresetRoles.length > 0
      ? [...industryPresetRoles, ...CREATION_ITEM_ROLES.filter((role) => !industryPresetRoleSet.has(role.role))]
      : CREATION_ITEM_ROLES;
  const plannedRoles = selectedRoles.length > 0 ? selectedRoles : defaultRoles.slice(0, imageCount);
  const effectiveImageCount = plannedRoles.length;

  if (!productName && !productDescription && sellingPoints.length === 0) {
    throw new Error("商品信息不能为空。");
  }

  const productLine = trimTerminalSentencePunctuation(buildCreationProductLine({ productName, productDescription, sellingPoints }));
  const descriptionLine = trimTerminalSentencePunctuation(productDescription || "用户未提供详细描述");
  const sellingPointLine =
    sellingPoints.length > 0
      ? sellingPoints.map(trimTerminalSentencePunctuation).filter(Boolean).join(" / ")
      : "围绕商品核心价值提炼短卖点";
  const contentAllocation = buildCreationContentAllocation({
    productDescription,
    sellingPoints,
  });
  const skuPackageListSummary = buildCreationSkuPackageListSummary(contentAllocation, referenceImageRoles);
  const skuDimensionSummary = buildCreationSkuDimensionSummary(dimensionSpecSummary, referenceImageRoles);
  const skuSupportingReferenceRoles = getCreationSkuSupportingReferenceRoles(skuGenerationRule);

  const carouselItems = plannedRoles.map((role, index) => {
    const sourceFocus = buildCreationRoleSourceFocus({
      role: role.role,
      allocation: contentAllocation,
      descriptionLine,
      sellingPointLine,
      sellingPoints,
    });

    return {
      itemId: `${index + 1}-${role.role}`,
      slotIndex: index + 1,
      role: role.role,
      title: role.title,
      filenameToken: role.filenameToken,
      marketingCopyLanguage: targetLanguage.value,
      sourceFocus,
      prompt: [
        `Create ${role.brief}.`,
        `Product: ${productLine}.`,
        sourceFocus.description ? `Description: ${sourceFocus.description}.` : "",
        sourceFocus.selling ? `Selling points: ${sourceFocus.selling}.` : "",
        role.role === "dimensions"
          ? buildCreationDimensionPromptInstruction({
              dimensionSpecSummary,
              dimensionUnitMode,
              source: dimensionSpecSource,
            })
          : "",
        role.role !== "dimensions" ? buildCreationNonDimensionSpecBoundaryInstruction(hasReservedDimensionSpecs) : "",
        getCreationRoleIntentInstruction(role.role),
        `Scenario: ${scenario.label}. ${scenario.promptInstruction}`,
        `Industry template: ${industryTemplate.label}. ${industryTemplate.promptInstruction}`,
        getCreationIndustryTemplateRoleInstruction(industryTemplate, role.role),
        getCreationScenarioRoleInstruction(scenario.value, role.role),
        targetLanguage.promptInstruction,
        buildCreationTargetLanguageTextGuidance(targetLanguage),
        buildCreationVisualLanguageGuidance(visualLanguage),
        getCreationRoleRenderingConstraint(role.role),
        buildCreationReferenceGuidance(referenceImageRoles),
        buildCreationLogoGuidance(logoOptions),
        buildCreationVisualLanguageQualityLine(visualLanguage),
        "Avoid crowded layouts, illegible text, fake UI, watermarks, brand logos not supplied by the user, and unrelated products.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
  const skuItems = skuSubjects.map((skuSubject, index) => {
    const slotIndex = effectiveImageCount + index + 1;
    return {
      itemId: `${slotIndex}-sku-${skuSubject.id}`,
      slotIndex,
      role: "sku",
      title: buildCreationSkuItemDisplayName(skuSubject, index),
      filenameToken: buildCreationSkuItemFilenameToken(skuSubject, index),
      marketingCopyLanguage: targetLanguage.value,
      skuSubject,
      skuSupportingReferenceRoles,
      prompt: buildCreationSkuPrompt({
        skuSubject,
        skuSubjects,
        productLine,
        targetLanguage,
        visualLanguage,
        logoOptions,
        skuGenerationRule,
        packageListSummary: skuPackageListSummary,
        dimensionSummary: skuDimensionSummary,
      }),
    };
  });

  return {
    productName,
    productDescription,
    sellingPoints,
    dimensionSpecs: effectiveDimensionSpecs,
    dimensionUnitMode: dimensionUnitMode.value,
    dimensionUnitModeLabel: dimensionUnitMode.label,
    targetLanguage: targetLanguage.value,
    targetLanguageLabel: targetLanguage.label,
    imageCount: effectiveImageCount,
    scenario: scenario.value,
    scenarioLabel: scenario.label,
    visualLanguage: visualLanguage.value,
    visualLanguageLabel: visualLanguage.label,
    industryTemplate: industryTemplate.value,
    industryTemplateLabel: industryTemplate.label,
    industryTemplatePath: industryTemplate.categoryPath || "",
    selectedRoles: plannedRoles.map((role) => role.role),
    referenceImageRoles,
    skuSubjects,
    skuBundleCount,
    skuGenerationRule: skuGenerationRule.value,
    skuGenerationRuleLabel: skuGenerationRule.label,
    skuImageCount: skuSubjects.length,
    contentAllocation: {
      strategy: contentAllocation.strategy,
      agentRequired: contentAllocation.agentRequired,
    },
    logo: logoOptions.enabled ? logoOptions : null,
    items: [...carouselItems, ...skuItems],
  };
}
