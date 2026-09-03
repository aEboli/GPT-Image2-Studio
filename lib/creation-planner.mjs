import {
  CREATION_INDUSTRY_TEMPLATE_OPTIONS,
  getCreationIndustryTemplateRolePreset,
  normalizeCreationIndustryTemplate as normalizeCreationIndustryTemplateOption,
} from "./creation-category-templates.mjs";
import { getCreationReferenceAnalysisDisplayRoleLabel } from "./creation-reference-analysis-view.mjs";
import { CREATION_REFERENCE_PRODUCT_ROLE, isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";
import {
  formatCreationSkuItemColorNames,
  getCreationSkuColorNames,
  normalizeCreationSkuColorLabels,
} from "./creation-sku-colors.mjs";
import { CREATION_PLATFORM_OPTIONS, getCreationPlatformImageType, getCreationPlatformProfile } from "./creation-platform-policies.mjs";
import {
  buildCreationInfographicRebuildPrompt,
  buildCreationSubjectContentProtectionPrompt,
} from "./creation-generation-parameters.mjs";
import {
  normalizeCreationAudienceStrategy,
  normalizeCreationConversionIntent,
  normalizeCreationPlatformItemOverrides,
  normalizeCreationPlatformSetOverrides,
  resolveCreationPlatformPlan,
  validateCreationPlatformPlan,
} from "./creation-platform-resolver.mjs";
import { MAX_CREATION_REFERENCE_IMAGES } from "./studio-constants.mjs";

export { CREATION_INDUSTRY_TEMPLATE_OPTIONS };
export { CREATION_PLATFORM_OPTIONS };

export const MAX_CREATION_EFFECTIVE_PLAN_BYTES = 4 * 1024 * 1024;
export const MAX_CREATION_EFFECTIVE_PLAN_ITEMS = 64;

export const CREATION_TARGET_LANGUAGE_OPTIONS = [
  {
    value: "zh-CN",
    label: "简体中文",
    promptInstruction: "使用简体中文创作简短的新增画布文案；商品或包装表面已有文字保留原语言，品牌名、型号、数字和单位保持原样。",
  },
  {
    value: "en",
    label: "English",
    promptInstruction: "Use concise English for newly authored canvas text; keep existing text on the physical product or packaging in its original language, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "ja",
    label: "日本語",
    promptInstruction: "Use concise Japanese for newly authored canvas text; keep existing text on the physical product or packaging in its original language, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "ko",
    label: "한국어",
    promptInstruction: "Use concise Korean for newly authored canvas text; keep existing text on the physical product or packaging in its original language, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "fr",
    label: "Français",
    promptInstruction: "Use concise French for newly authored canvas text; keep existing text on the physical product or packaging in its original language, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "de",
    label: "Deutsch",
    promptInstruction: "Use concise German for newly authored canvas text; keep existing text on the physical product or packaging in its original language, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "es",
    label: "Español",
    promptInstruction: "Use concise Spanish for newly authored canvas text; keep existing text on the physical product or packaging in its original language, and preserve brand names, model names, numbers, and units exactly.",
  },
];

export const CREATION_IMAGE_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DEFAULT_CREATION_IMAGE_COUNT = 18;
const CREATION_FINAL_UPLOAD_IMAGE_LIMIT = 10;
const DEFAULT_CREATION_TARGET_LANGUAGE = "en";
const DEFAULT_CREATION_DIMENSION_UNIT_MODE = "both";
const DEFAULT_CREATION_PLATFORM = "universal";
const DEFAULT_CREATION_VISUAL_LANGUAGE = "classic-commercial";
const DEFAULT_CREATION_LOGO_PLACEMENT = "top-left";
const DEFAULT_CREATION_SKU_BUNDLE_COUNT = 1;
const MAX_CREATION_SKU_BUNDLE_COUNT = 20;

export const CREATION_SKU_GENERATION_RULE_OPTIONS = [
  {
    value: "color-name-under-subject",
    label: "显示颜色",
    includePackageList: false,
    includeDimensions: false,
    showColorNameUnderSubject: true,
  },
  {
    value: "none",
    label: "无",
    includePackageList: false,
    includeDimensions: false,
  },
  {
    value: "package-list",
    label: "显示清单",
    includePackageList: true,
    includeDimensions: false,
  },
  {
    value: "dimensions",
    label: "显示尺寸",
    includePackageList: false,
    includeDimensions: true,
  },
  {
    value: "package-list-dimensions",
    label: "显示清单和尺寸",
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
    promptInstruction: "Use it to read package-list content, bundle contents, included accessories, quantities, and what the shopper receives. In a package/list image, keep the contents unpacked on an open surface and show confirmed packaging as one separate secondary inventory item beside them. Other roles use it as a fact source only.",
  },
  {
    value: "material",
    label: "材质结构细节",
    promptLabel: "detail and structure reference",
    promptInstruction: "Use it to preserve material texture, finish, seams, surface detail, visible external structure, craft, and annotated detail accuracy, as supporting evidence rather than a sellable product subject. Do not use it for functional claims or usage steps.",
  },
  {
    value: "feature",
    label: "功能卖点",
    promptLabel: "feature and functional benefit reference",
    promptInstruction: "Use it to preserve visibly supported feature selling points, mechanisms, functional effects, benefit evidence, runtime, temperature or mode settings, and charging benefits, as supporting evidence rather than a sellable product subject. Do not invent performance or turn it into a usage manual.",
  },
  {
    value: "dimensions",
    label: "尺寸规格",
    promptLabel: "dimensions and specifications",
    promptInstruction: "Use it for physical size charts, measurements, weight, container capacity, model, fit, and compatibility values, as a fact source rather than a sellable product subject. Runtime, heating temperature, mode count, battery life, and charging benefits belong to feature evidence unless they are merely one row inside a broader specification table.",
  },
  {
    value: "usage",
    label: "使用说明",
    promptLabel: "usage instructions",
    promptInstruction: "Use it to read actual setup, operation, charging, connection, assembly, safety steps, and instruction callouts as source facts, rather than as a sellable product subject. A feature headline that merely says fast charging, Type-C support, or one-button control is feature evidence, not a usage procedure.",
  },
  {
    value: "scene",
    label: "使用场景",
    promptLabel: "usage scene",
    promptInstruction: "Use it as context for realistic placement, scale, environment, and usage behavior.",
  },
  {
    value: "other",
    label: "其他",
    promptLabel: "supporting reference",
    promptInstruction: "Use it where it helps product accuracy or ecommerce composition.",
  },
];

export const CREATION_ITEM_ROLES = [
  {
    role: "hero",
    title: "首图成交主视觉",
    filenameToken: "hero",
    brief: "a conversion-first hero image with the product as the dominant subject",
    question: "what is this product and why should I care at first glance?",
    directive:
      "Lead with unmistakable product identity and one main buying promise, then group the reliable non-dimension facts into a concise headline, proof, material, use, package, and trust hierarchy. Keep 3-5 small circular scene frames around the dominant product for believable use contexts.",
  },
  {
    role: "benefit",
    title: "目标人群共鸣图",
    filenameToken: "benefit",
    brief: "a target-shopper resonance image built around one recognizable buyer",
    question: "which target shopper will feel understood by this product right now?",
    directive:
      "Show one recognizable target person or buyer viewpoint, one concrete pre-purchase need, frustration, or hesitation, and the exact product entering that moment as the emotionally credible choice. Use at most one short supporting proof cue. Explicit selling-point stacks belong to 卖点图.",
  },
  {
    role: "scene",
    title: "适用多场景图",
    filenameToken: "scene",
    brief: "a multi-scenario application image with advertising campaign energy",
    question: "which real scenarios make this product feel useful and worth buying?",
    directive:
      "Show 2-4 believable use scenarios in one advertising-led composition with real environments, true scale, target-user context, and category-specific action. Build depth through foreground and background layering, dynamic angles, and one clear main product anchor.",
    lureDirective: "Show the lure in river or lake water, pursued or struck by a fish.",
  },
  {
    role: "multi-angle",
    title: "多角度产品展示图",
    filenameToken: "angles",
    brief: "a multi-angle product display with 3-4 clean views",
    question: "can I understand the product from every important side before ordering?",
    directive:
      "Present the same exact product from 3-4 angles in a clean arrangement so shape, structure, thickness, finish, and visible interfaces are easy to inspect. Keep the background dry and uncluttered and the frame product-only and text-free, with product shape, colors, markings, and proportions identical across every angle.",
  },
  {
    role: "atmosphere",
    title: "冲动下单氛围图",
    filenameToken: "mood",
    brief: "a decisive-moment impulse-buy atmosphere image",
    question: "what decisive moment would make me want to buy this now?",
    directive:
      "Build one believable ownership instant where desire turns into action: a visible action, a target-user cue, a specific environment, and one purchase-trigger emotion such as relief, readiness, confidence, or a just-in-time need, with the exact product recognizable and close.",
  },
  {
    role: "product-detail",
    title: "产品细节特写图",
    filenameToken: "detail",
    brief: "a product detail proof image",
    question: "are the visible details trustworthy enough to buy?",
    directive:
      "Use macro crops, local close-up panes, and callout labels as visible proof of the materials, texture, finish, seams, edges, controls, connectors, structure, and workmanship that are actually visible in the supplied product.",
  },
  {
    role: "brand-story",
    title: "品牌质感/礼品价值图",
    filenameToken: "brand",
    brief: "a many-scene use-and-style collage board",
    question: "can I immediately see all the ways and places I could use this product?",
    directive:
      "Build a Multiple Uses & Style collage of 9-12 rounded photo tiles showing varied real-use situations that fit the product, plus a bottom row of use-method mini icons or line-art panels for different wearing, holding, storage, or setup styles. Repeat the exact same product subject across the board with consistent color, material, proportions, and markings.",
  },
  {
    role: "size-capacity-fit",
    title: "尺寸容量适配图",
    filenameToken: "size",
    brief: "a dimension, capacity, or fit verification image",
    question: "will the size, capacity, or fit work for my space, body, device, package, or use case?",
    directive:
      "Show the product with accurate callout measurement lines, capacity or size markers, compatibility cues, and a reference object or body-scale cue when it helps. Every numeric label matches the supplied specifications exactly.",
  },
  {
    role: "effect-comparison",
    title: "功能效果渲染图",
    filenameToken: "compare",
    brief: "a single-product functional effect rendering",
    question: "can I see everything this product function actually does?",
    directive:
      "Keep one dominant, fully visible product as the single anchor and show every supported function, mechanism, effect path, and outcome around it with dimensional arrows, cutaway overlays, motion trails, and flow cues in premium ecommerce 3D/CGI or cinematic visualization. If one frame cannot hold every cue legibly, stitch a seamless continuous scene around that same unchanged product.",
  },
  {
    role: "spec-table",
    title: "参数规格图",
    filenameToken: "specs",
    brief: "a product-led key-specification explainer",
    question: "which few key specifications affect my choice, and where do they apply on the product?",
    directive:
      "Keep the product visually dominant and anchor at most four distinct decision-relevant specifications to the product parts, capacity, scale, or fit cues they describe. Each value lives as a measurement line or local callout on the product, or in one of 2-4 compact explanatory modules, carrying the exact supplied value.",
  },
  {
    role: "craft-process",
    title: "品质工艺证明图",
    filenameToken: "craft",
    brief: "a quality and craft proof image",
    question: "why should I trust the making quality?",
    directive:
      "Turn the supplied production, material handling, assembly, testing, or inspection facts into a staged process sequence with concise step labels, presented as evidence of durability, care, finish, safety, or reliability.",
  },
  {
    role: "accessory-gift",
    title: "到手清单/配件图",
    filenameToken: "accessories",
    brief: "an unpacked included-items and accessory checklist",
    question: "what exactly comes with this product?",
    directive:
      "Lay the main product and every confirmed accessory, gift, or included component on a clean open surface, each item and quantity fully visible outside any container. Cover the complete supplied checklist in one readable layout, using smaller thumbnails or a structured grid when needed, with any confirmed packaging as one separate item beside the unpacked contents.",
  },
  {
    role: "series-showcase",
    title: "多款式/SKU选择图",
    filenameToken: "series",
    brief: "a variant and SKU choice image",
    question: "which variant, color, size, bundle, or SKU should I choose?",
    directive:
      "Arrange the supplied colors, styles, sizes, bundles, or product variants as one coherent choice set where the selection differences are easy to compare. Label each variant with a short style name, color name, or SKU marker when that label is supplied or safely inferable.",
  },
  {
    role: "ingredient-material",
    title: "材质成分解析图",
    filenameToken: "ingredients",
    brief: "a material or ingredient analysis image",
    question: "what is it made of and why does that matter?",
    directive:
      "Visualize the supplied ingredients, materials, components, or composition facts with simple icons, material swatches, and short labels that connect the composition to tactile feel, durability, comfort, taste, safety, or compatibility.",
  },
  {
    role: "after-sales",
    title: "痛点图",
    filenameToken: "pain-point",
    brief: "a pain-point solution image",
    question: "what problem does this product solve for me?",
    directive:
      "Show one real usage pain, the way the supplied product resolves it, and the payoff the buyer can expect, built from the supplied pain, solution, and outcome facts.",
  },
  {
    role: "usage-suggestion",
    title: "卖点图",
    filenameToken: "selling-point",
    brief: "a selling-point image",
    question: "what clear benefits will I get after buying it?",
    directive:
      "Connect 3-5 supplied core selling points to concrete product evidence and the buyer payoff after purchase, treating easy setup, operation, care, wearing, charging, or connection cues as evidence of ease or value. Keep the supplied reference product as the unchanged subject and add callout arrows, labels, hands, or small evidence panels around it.",
    lureDirective:
      "Keep the belly and tail treble hooks on their original underside and tail hangers, and attach the fishing line through the exact visible line-tie, tow eye, or split ring already on the reference lure, using that same point in the main image and every evidence panel.",
  },
  {
    role: "human-handheld",
    title: "真人手持展示图",
    filenameToken: "human-handheld",
    brief: "a real-person handheld demonstration image",
    question: "what does this product look like in a real person's hands or in actual use?",
    directive:
      "Keep a live person in frame using hands or a natural grip to hold, suspend, or present the exact product close enough to read scale, texture, and detail, with the person natural and secondary to the product.",
    lureDirective: "Keep hooks, body shape, markings, hardware, and the supplied line attachment point exactly as referenced.",
  },
  {
    role: "human-wearable",
    title: "真人穿戴场景图",
    filenameToken: "human-wearable",
    brief: "a real-person worn or carried demonstration image",
    question: "how does this product look on a real body or when carried in a real scene?",
    directive:
      "Keep a live model visibly wearing, carrying, shouldering, or using the exact product in a believable scene so fit, drape, scale, body relationship, and lifestyle use read clearly. Keep straps, garment shape, bag scale, and silhouette faithful to the supplied product.",
  },
];

export const CREATION_SCENARIO_ROLE_PRESETS = {
  standard: ["hero", "benefit", "scene", "multi-angle"],
  "detail-page": [
    "hero",
    "benefit",
    "product-detail",
    "size-capacity-fit",
    "effect-comparison",
    "spec-table",
    "accessory-gift",
    "usage-suggestion",
  ],
  "social-seeding": ["hero", "scene", "atmosphere", "benefit", "brand-story", "usage-suggestion"],
  launch: ["hero", "benefit", "atmosphere", "multi-angle", "product-detail", "brand-story", "series-showcase", "accessory-gift"],
  promotion: ["hero", "benefit", "effect-comparison", "after-sales", "accessory-gift", "usage-suggestion"],
  livestream: [
    "hero",
    "benefit",
    "scene",
    "usage-suggestion",
    "product-detail",
    "effect-comparison",
    "accessory-gift",
    "after-sales",
    "spec-table",
    "size-capacity-fit",
  ],
  "gift-guide": ["hero", "accessory-gift", "scene", "benefit", "brand-story", "after-sales"],
  "marketplace-search": ["hero", "benefit", "effect-comparison", "size-capacity-fit", "product-detail", "spec-table"],
  "brand-story": [
    "hero",
    "scene",
    "brand-story",
    "craft-process",
    "ingredient-material",
    "product-detail",
    "atmosphere",
    "series-showcase",
    "usage-suggestion",
    "after-sales",
  ],
};

export const CREATION_INDUSTRY_ROLE_PRESETS = {
  general: [],
  apparel: ["hero", "human-wearable", "scene", "product-detail", "size-capacity-fit", "benefit", "series-showcase", "after-sales"],
  beauty: ["hero", "benefit", "product-detail", "usage-suggestion", "ingredient-material", "atmosphere", "accessory-gift", "after-sales"],
  food: ["hero", "benefit", "scene", "accessory-gift", "ingredient-material", "atmosphere", "effect-comparison", "after-sales"],
  electronics: ["hero", "benefit", "spec-table", "usage-suggestion", "product-detail", "effect-comparison", "accessory-gift", "after-sales"],
  home: ["hero", "scene", "size-capacity-fit", "product-detail", "usage-suggestion", "benefit", "effect-comparison", "after-sales"],
};

export const CREATION_SCENARIO_ROLE_INSTRUCTIONS = {
  standard: {
    default: "Role focus: keep this image aligned with the selected ecommerce scenario and this role's conversion job.",
  },
  "detail-page": {
    default: "Role focus: read as a modular detail-page section with clear hierarchy and a clean conversion path.",
    "product-detail": "Role focus: give the detail page close proof of structure, material, and quality.",
    "size-capacity-fit": "Role focus: make specifications, scale, capacity, and compatibility easy to compare in one detail-page module.",
    "spec-table": "Role focus: turn a few key parameters into a product-led annotated explanation.",
    benefit: "Role focus: create one detail-page resonance moment where a recognizable buyer with a concrete hesitation finds the product credible.",
    "usage-suggestion": "Role focus: turn 3-5 core selling points into a benefit-evidence-payoff module.",
  },
  "social-seeding": {
    default: "Role focus: feel native to a lifestyle feed while keeping the product accurate and purchase intent clear.",
    scene: "Role focus: stage an authentic, shareable everyday moment with a light editorial touch.",
    benefit: "Role focus: make one target shopper feel seen in a specific everyday need, with the product naturally becoming the choice.",
    atmosphere: "Role focus: capture a decisive ownership instant whose mood, visible action, and lifestyle aspiration make the product immediately wanted.",
    "usage-suggestion": "Role focus: keep 3-5 supplied benefits feed-native, with product evidence and buyer payoff.",
  },
  launch: {
    default: "Role focus: create launch-ready energy with discovery, novelty, and a clear reason to look now.",
    hero: "Role focus: make the product feel newly released, memorable, and instantly recognizable as the launch anchor.",
    benefit: "Role focus: express the launch through one target shopper recognizing the product fits a concrete need or moment.",
    "accessory-gift": "Role focus: present unboxing, bundle appeal, or included items as a premium first-touch moment.",
  },
  promotion: {
    default: "Role focus: emphasize offer clarity, urgency, product value, and a conversion-focused campaign layout.",
    "effect-comparison": "Role focus: make the supported product value easy to grasp through one dominant product in a unified functional rendering.",
    "after-sales": "Role focus: show the campaign pain point, the supplied solution path, and the payoff that makes the offer easy to choose.",
  },
  livestream: {
    default: "Role focus: stay host-ready with clear talking points, demo rhythm, and fast shopper understanding.",
    benefit: "Role focus: give the host one resonance moment to describe: who needs it, which situation triggers interest, and why the product is credible.",
    "usage-suggestion": "Role focus: build a host-ready stack of 3-5 supported benefits with product evidence and buyer payoff.",
    "after-sales": "Role focus: answer which real-use problem the product solves, using supplied pain, solution, and payoff facts.",
    "size-capacity-fit": "Role focus: make size, capacity, and compatibility instantly explainable during a live demo.",
  },
  "gift-guide": {
    default: "Role focus: position the product as a thoughtful gift with occasion, recipient fit, packaging appeal, and buying confidence.",
    "accessory-gift": "Role focus: make the package, included items, and gift-ready presentation feel complete and desirable.",
    scene: "Role focus: show a gifting occasion or recipient lifestyle context with the product still clear.",
    "after-sales": "Role focus: show the recipient pain, the product solution, and the resulting confidence or delight.",
  },
  "marketplace-search": {
    default: "Role focus: optimize for fast scanning in crowded search results with strong subject separation.",
    hero: "Role focus: stay readable as a thumbnail-first listing image with instant category recognition.",
    benefit: "Role focus: make the intended shopper and one familiar need readable at search-card speed, with the product resolving it.",
    "effect-comparison": "Role focus: make one dominant product and its functional effect instantly readable with a unified hierarchy.",
    "size-capacity-fit": "Role focus: keep scale, size, and key specs readable at listing-card size.",
    "product-detail": "Role focus: show one high-confidence material or quality cue that stands out in search thumbnails.",
  },
  "brand-story": {
    default: "Role focus: connect product craft, material, origin, values, and everyday usage into a coherent brand narrative.",
    scene: "Role focus: place the product in a lived-in scene that supports brand values and everyday relevance.",
    "craft-process": "Role focus: let material, craft, surface finish, or origin detail carry the brand story visually.",
    "brand-story": "Role focus: prove through the collage that the product fits many occasions, environments, users, and handling styles.",
    "ingredient-material": "Role focus: let materials, ingredients, or composition cues support the brand story from supplied facts.",
    "accessory-gift": "Role focus: use packaging or included items to communicate brand care, ritual, and perceived value.",
    "after-sales": "Role focus: connect the real buyer problem, the supplied solution, and the payoff to the brand story.",
  },
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
  dimensions: [/dimension|size|spec|capacity|height|width|\d+(?:\.\d+)?\s*(?:cm|mm|kg|g|oz|lb|ml|in)\b|\bcm\b|\bmm\b|\bg\b|\boz\b|\u5c3a\u5bf8|\u89c4\u683c|\u5bb9\u91cf|\u9ad8\u5ea6|\u5bbd\u5ea6|\u91cd\u91cf/i],
  package: [/package|bundle|included|accessor|storage bag|first aid kit|bandages?|blankets?|cotton swabs?|safety pins?|non-woven tape|tourniquets?|whistles?|dressings?|soap wipes?|tweezers?|scissors?|usb|cable|\*\s*\d+\b|\u914d\u7f6e|\u5305\u88c5|\u6e05\u5355|\u5957\u88c5|\u6536\u7eb3\u888b|\u914d\u4ef6|\u521b\u53e3\u8d34|\u7ef7\u5e26|\u6577\u6599|\u68c9\u7b7e|\u80f6\u5e26|\u4e09\u89d2\u5dfe|\u6025\u6551\u6bef|\u7eb1\u5e03|\u522b\u9488|\u6b62\u8840\u5e26|\u6e7f\u5dfe|\u7eb1\u5e03\u526a|\u7535\u7ebf|\u6570\u636e\u7ebf/i],
  trust: [/trust|quality|proof|safe|cert|warranty|durable|review|reliable|steel|rattle|bead|\u4fe1\u4efb|\u8d28\u91cf|\u5b89\u5168|\u8ba4\u8bc1|\u8d28\u4fdd|\u8010\u7528|\u8bc4\u4ef7|\u53e3\u7891|\u9632\u6c34|\u94a2\u73e0|\u54cd\u73e0/i],
};

const CREATION_ROLE_CONTENT_CATEGORIES = {
  hero: ["identity", "visible-copy", "benefit", "material", "usage", "scene", "package", "trust"],
  benefit: ["benefit", "trust", "visible-copy"],
  scene: ["scene", "usage", "benefit"],
  "multi-angle": ["identity", "material", "dimensions"],
  atmosphere: ["scene", "benefit", "trust"],
  "product-detail": ["material", "trust", "benefit"],
  "brand-story": ["scene", "usage", "benefit", "visible-copy"],
  "size-capacity-fit": ["dimensions", "identity"],
  "effect-comparison": ["benefit", "trust", "dimensions"],
  "spec-table": ["dimensions", "visible-copy"],
  "craft-process": ["material", "usage", "trust"],
  "accessory-gift": ["package", "trust", "visible-copy"],
  "series-showcase": ["identity", "benefit", "dimensions"],
  "ingredient-material": ["material", "package", "trust"],
  "after-sales": ["benefit", "usage", "trust", "scene"],
  "usage-suggestion": ["benefit", "material", "usage", "trust"],
  "human-handheld": ["scene", "usage", "material"],
  "human-wearable": ["scene", "benefit", "dimensions"],
};

const CREATION_CONTENT_CATEGORY_ROLE_BUDGETS = {
  dimensions: {
    maxRoles: 2,
    preferredRoles: ["size-capacity-fit", "spec-table"],
  },
  material: {
    maxRoles: 2,
    preferredRoles: ["product-detail", "ingredient-material"],
  },
  usage: {
    maxRoles: 2,
    preferredRoles: ["usage-suggestion", "scene"],
  },
};

const CREATION_REFERENCE_COVERAGE_ROLE_TARGETS = {
  usage: ["usage-suggestion", "human-handheld"],
  scene: ["scene", "atmosphere", "human-handheld", "human-wearable"],
  material: ["product-detail", "ingredient-material"],
  feature: ["effect-comparison", "usage-suggestion", "after-sales"],
  dimensions: ["size-capacity-fit", "spec-table"],
  package: ["accessory-gift"],
};

const CREATION_REQUIRED_REFERENCE_COVERAGE_ROLES = new Set(["usage", "scene"]);
const CREATION_VISUAL_BLUEPRINT_REFERENCE_ROLES = new Set(["scene"]);
const CREATION_COVERAGE_REPLACEMENT_PRIORITY = [
  "multi-angle",
  "series-showcase",
  "brand-story",
  "after-sales",
  "craft-process",
  "effect-comparison",
  "atmosphere",
  "benefit",
  "product-detail",
  "size-capacity-fit",
  "spec-table",
  "ingredient-material",
  "accessory-gift",
  "scene",
  "usage-suggestion",
];

const CREATION_ROLE_SOURCE_FACT_LIMITS = {
  "accessory-gift": 32,
  hero: 10,
};

const CREATION_DIMENSION_IMAGE_ROLES = new Set(["size-capacity-fit", "spec-table"]);
const CREATION_ART_DIRECTED_ROLES = new Set([
  "benefit",
  "scene",
  "atmosphere",
  "usage-suggestion",
  "brand-story",
  "after-sales",
  "human-handheld",
  "human-wearable",
]);
const CREATION_CONVERSION_ART_DIRECTED_ROLES = new Set([
  "atmosphere",
  "brand-story",
  "after-sales",
  "effect-comparison",
  "human-handheld",
  "human-wearable",
]);
const CREATION_CHARGING_SIGNAL_RE =
  /charge|charging|recharge|rechargeable|usb|usb-c|battery|power\s*bank|cable|\u5145\u7535|\u5145\u96fb|\u7535\u6c60|\u96fb\u6c60|\u6570\u636e\u7ebf|\u6578\u64da\u7dda|\u5145\u7535\u7ebf|\u5145\u96fb\u7dda|\u7535\u7ebf|\u96fb\u7dda/i;

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeDefaultEnabledBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = cleanString(value).toLowerCase();
  if (
    value === false ||
    value === 0 ||
    normalized === "false" ||
    normalized === "0" ||
    normalized === "off" ||
    normalized === "no"
  ) {
    return false;
  }
  return true;
}

function isCreationDimensionImageRole(roleValue) {
  return CREATION_DIMENSION_IMAGE_ROLES.has(cleanString(roleValue));
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

function getBaseCreationRoleContentCategories(role) {
  return CREATION_ROLE_CONTENT_CATEGORIES[role] || CREATION_ROLE_CONTENT_CATEGORIES.hero;
}

function buildCreationContentCategoryBudget(plannedRoles = []) {
  const roleValues = plannedRoles.map((role) => cleanString(role?.role || role)).filter(Boolean);
  const roleSet = new Set(roleValues);
  const allowedByCategory = new Map();

  Object.entries(CREATION_CONTENT_CATEGORY_ROLE_BUDGETS).forEach(([category, budget]) => {
    const naturalRoles = roleValues.filter((role) => getBaseCreationRoleContentCategories(role).includes(category));
    const preferredRoles = budget.preferredRoles.filter((role) => roleSet.has(role) && naturalRoles.includes(role));
    const fallbackRoles = naturalRoles.filter((role) => !preferredRoles.includes(role));
    const allowedRoles = [...preferredRoles, ...fallbackRoles].slice(0, budget.maxRoles);
    if (allowedRoles.length > 0) {
      allowedByCategory.set(category, new Set(allowedRoles));
    }
  });

  return { allowedByCategory };
}

function getCreationRoleContentCategories(role, categoryBudget) {
  const baseCategories = getBaseCreationRoleContentCategories(role);
  if (!categoryBudget?.allowedByCategory) {
    return baseCategories;
  }
  return baseCategories.filter((category) => {
    const allowedRoles = categoryBudget.allowedByCategory.get(category);
    return !allowedRoles || allowedRoles.has(role);
  });
}

function isCreationContentFactAllowedForRole(fact = {}, role = "", categoryBudget) {
  if (!categoryBudget?.allowedByCategory) {
    return true;
  }
  const factCategories = fact.categories || [];
  const blockedCategories = factCategories.filter((category) => {
    const allowedRoles = categoryBudget.allowedByCategory.get(category);
    return allowedRoles && !allowedRoles.has(role);
  });
  if (blockedCategories.length === 0) {
    return true;
  }

  const roleCategories = getBaseCreationRoleContentCategories(role);
  return (
    roleCategories.includes("benefit") &&
    factCategories.includes("benefit") &&
    blockedCategories.every((category) => category === "material")
  );
}

function selectCreationContentFacts(facts, categories, maxCount = 3, options = {}) {
  const categorySet = new Set(categories);
  return facts
    .filter((fact) => isCreationContentFactAllowedForRole(fact, options.role, options.categoryBudget))
    .filter((fact) => fact.categories.some((category) => categorySet.has(category)))
    .map((fact) => fact.text)
    .slice(0, maxCount);
}

function selectFallbackCreationContentFacts(facts, maxCount = 3, options = {}) {
  const categorySet = new Set(options.categories || []);
  return facts
    .filter((fact) => isCreationContentFactAllowedForRole(fact, options.role, options.categoryBudget))
    .filter((fact) => categorySet.size === 0 || fact.categories.some((category) => categorySet.has(category)))
    .map((fact) => fact.text)
    .slice(0, maxCount);
}

function formatCreationContentFacts(facts, maxChars = Number.POSITIVE_INFINITY) {
  const values = uniqueCleanStrings(facts).map(trimTerminalSentencePunctuation).filter(Boolean);
  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    return values.join(" / ");
  }
  const selected = [];
  let usedChars = 0;
  for (const value of values) {
    const separatorLength = selected.length > 0 ? 3 : 0;
    const remaining = maxChars - usedChars - separatorLength;
    if (remaining <= 0) break;
    if (value.length <= remaining) {
      selected.push(value);
      usedChars += separatorLength + value.length;
      continue;
    }
    if (remaining >= 24) selected.push(truncateCreationSourceFact(value, remaining));
    break;
  }
  return selected.join(" / ");
}

function buildCreationRoleSourceFocus({
  role,
  allocation,
  descriptionLine,
  sellingPointLine,
  sellingPoints,
  categoryBudget,
}) {
  const heroOwnsAllNonDimensionFacts = role === "hero";
  const categories = heroOwnsAllNonDimensionFacts
    ? getBaseCreationRoleContentCategories(role)
    : getCreationRoleContentCategories(role, categoryBudget);
  const selectionOptions = { role, categoryBudget: heroOwnsAllNonDimensionFacts ? null : categoryBudget };
  const eligibleDescriptionFacts = heroOwnsAllNonDimensionFacts
    ? allocation.descriptionFacts.filter((fact) => !(fact.categories || []).includes("dimensions"))
    : allocation.descriptionFacts;
  const eligibleSellingPointFacts = heroOwnsAllNonDimensionFacts
    ? allocation.sellingPointFacts.filter((fact) => !(fact.categories || []).includes("dimensions"))
    : allocation.sellingPointFacts;
  const sourceFactLimit = heroOwnsAllNonDimensionFacts
    ? Math.max(
        CREATION_ROLE_SOURCE_FACT_LIMITS[role] || 0,
        eligibleDescriptionFacts.length,
        eligibleSellingPointFacts.length,
      )
    : CREATION_ROLE_SOURCE_FACT_LIMITS[role] || 3;
  const sourceFactCharBudget = heroOwnsAllNonDimensionFacts
    ? 360
    : role === "accessory-gift"
      ? Number.POSITIVE_INFINITY
      : 320;
  const descriptionFacts = selectCreationContentFacts(eligibleDescriptionFacts, categories, sourceFactLimit, selectionOptions);
  const sellingPointFacts = selectCreationContentFacts(eligibleSellingPointFacts, categories, sourceFactLimit, selectionOptions);
  const selectedSellingPoints = formatCreationContentFacts(sellingPointFacts, sourceFactCharBudget);
  const fallbackDescriptionFacts = formatCreationContentFacts(
    selectFallbackCreationContentFacts(eligibleDescriptionFacts, sourceFactLimit, {
      ...selectionOptions,
      categories,
    }),
    sourceFactCharBudget,
  );
  const fallbackSellingPointFacts = formatCreationContentFacts(
    selectFallbackCreationContentFacts(eligibleSellingPointFacts, sourceFactLimit, {
      ...selectionOptions,
      categories,
    }),
    sourceFactCharBudget,
  );
  const canUseFullSellingLine =
    sellingPoints.length <= 2 &&
    eligibleSellingPointFacts.every((fact) =>
      isCreationContentFactAllowedForRole(fact, role, heroOwnsAllNonDimensionFacts ? null : categoryBudget),
    );
  const description = formatCreationContentFacts(descriptionFacts, sourceFactCharBudget);
  const selling =
    sellingPoints.length > 0
      ? sellingPoints.length <= 2
        ? selectedSellingPoints || (canUseFullSellingLine ? sellingPointLine : "")
        : selectedSellingPoints || fallbackSellingPointFacts
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
  ["公斤", { kind: "weight", system: "metric", unit: "kg", toBase: (value) => value * 1000 }],
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

const DIMENSION_ADJACENT_LABEL_RE_SOURCE = String.raw`(?:diameter|height|width|depth|thickness|length|weight|capacity|volume|\u76f4\u5f84|\u76f4\u5f91|\u9ad8(?:\u5ea6)?|\u5bbd(?:\u5ea6)?|\u5bec(?:\u5ea6)?|\u539a(?:\u5ea6)?|\u6df1(?:\u5ea6)?|\u957f(?:\u5ea6)?|\u9577(?:\u5ea6)?|\u91cd\u91cf|\u51c0\u91cd|\u6de8\u91cd|\u91cd|\u5bb9\u91cf|\u51c0\u542b\u91cf|\u5c3a\u5bf8|\u89c4\u683c)`;
const DIMENSION_MEASUREMENT_RE = new RegExp(
  String.raw`(^|[^\p{L}\p{N}_.]|${DIMENSION_ADJACENT_LABEL_RE_SOURCE})([+-]?(?:\d+(?:\.\d+)?|\.\d+))(\s*)(fl\.?\s*oz|fluid\s*ounces?|inches?|inch|in\.?|ft\.?|feet|foot|yards?|yard|yd\.?|\u6beb\u7c73|\u5398\u7c73|\u82f1\u5bf8|\u82f1\u5c3a|\u6beb\u5347|\u6db2\u91cf\u76ce\u53f8|\u5343\u514b|\u516c\u65a4|\u514b|\u78c5|\u76ce\u53f8|\u5347|mm|cm|kg|g|ml|lb|lbs|oz|m|l)(?=$|[^\p{L}\p{N}_]|(?=${DIMENSION_ADJACENT_LABEL_RE_SOURCE}))`,
  "giu",
);
const DIMENSION_LABEL_CONTEXT_RE = /(?:diameter|dia\.?|height|width|depth|thickness|length|long|weight|capacity|volume|直径|直徑|高(?:度)?|宽(?:度)?|寬(?:度)?|厚(?:度)?|深(?:度)?|长(?:度)?|長(?:度)?|重量|净重|淨重|重|容量|净含量|淨含量|尺寸|规格)\s*[:：-]?\s*$/iu;
const DIMENSION_SPEC_INTENT_RE =
  /dimension(s)?\s*(chart|guide|card|table|sheet|info|information|specifications?|feel|reference|focus|value|values)|size\s*(chart|guide|card|table|sheet|feel|reference|focus|value|values)|spec(ification)?\s*(table|chart|card|sheet|info|information|feel|reference|focus|value|values)|measurement\s*(chart|guide|card|table)|尺寸\s*(图|表|卡|规格|信息|参数|感|参考|依据|值|数值|重点|焦点)|规格\s*(图|表|卡|信息|参数|感|参考|依据|值|数值|重点|焦点)|尺码\s*(图|表|卡|信息|指南)|实物握持尺度|规格信息|尺寸规格|规格感|尺寸感/iu;
const DIMENSION_SIGNAL_RE =
  /dimension|size|measurement|capacity|length|width|height|weight|hook|尺寸|规格|尺码|容量|长度|宽度|高度|重量|比例|尺度|钩/iu;
const DIMENSION_SPEC_VALUE_RE = /#\s*\d+|\d+\s*#\s*(?:hook|hooks|钩)?|\d+\s*(?:号|號)\s*钩|size\s*#?\s*\d+\s*hooks?/iu;
const USAGE_INSTRUCTION_SIGNAL_RE =
  /usage\s*(guide|manual|instructions?|steps?|diagram|method)|user\s*(guide|manual|instructions?)|operation\s*(guide|manual|instructions?|steps?|method|diagram)|instruction(s)?|manual|tutorial|step[-\s]?by[-\s]?step|how\s*to|setup\s*(guide|instructions?|steps?)|assembly\s*(guide|instructions?|steps?)|install(?:ation)?\s*(guide|instructions?|steps?)|charging\s*(guide|instructions?|steps?|method|connection|diagram)|connection\s*(guide|instructions?|steps?|method|diagram)|polarity|positive\s*(pole|terminal|electrode)|negative\s*(pole|terminal|electrode)|使用\s*(指南|说明|教程|步骤|方法|方式|指引)|操作\s*(指南|说明|教程|步骤|方法|流程)|安装\s*(指南|说明|教程|步骤|方法|流程)|装配\s*(指南|说明|教程|步骤|方法|流程)|充电\s*(指南|说明|教程|步骤|方式|方法|连接|接线)|连接\s*(指南|说明|教程|步骤|方式|方法|示意|接线)|接线|正负极|正极|负极|请按照|注意事项|说明书|教程图|步骤图/iu;
const DETAIL_REFERENCE_SIGNAL_RE =
  /detail|close.?up|callout|structure\s*(callout|breakdown|detail|annotation|notes?)|component\s*(callout|breakdown|detail|annotation)|material|texture|surface|fabric|finish|seams?|craft|细节|质感|纹理|表面|工艺|外观结构|结构表现|结构说明|结构标注|部件标注|结构拆解/iu;
const FEATURE_REFERENCE_SIGNAL_RE =
  /feature\s*(callout|breakdown|point|annotation|benefit|effect|demo|diagram)|functional\s*(benefit|effect|feature|proof|callout|diagram)|selling\s*point|benefit\s*(callout|diagram|proof)|功能(?:图|内容|卖点|效果|展示|说明|拆解|证据|亮点|对比|演示|结构(?:表现|说明|标注)?)|卖点(?:图|说明|拆解|展示|证据)|效果(?:图|说明|展示|证据|对比|演示)/iu;
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

function getDimensionMeasurementMatchStart(match) {
  return (match.index || 0) + match[1].length;
}

function getDimensionMeasurementMatchEnd(match) {
  return getDimensionMeasurementMatchStart(match) + match[2].length + match[3].length + match[4].length;
}

function getDimensionMeasurementLabelContext(text, match, { before = false } = {}) {
  const start = getDimensionMeasurementMatchStart(match);
  if (before) {
    return text.slice(Math.max(0, start - 32), start);
  }
  return text.slice(Math.max(0, (match.index || 0) - 32), (match.index || 0) + match[1].length);
}

function hasExplicitDimensionLabel(value) {
  return DIMENSION_LABEL_CONTEXT_RE.test(cleanString(value));
}

function areEquivalentDimensionMeasurements(previousMatch, currentMatch) {
  const previousUnit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(previousMatch?.[4]));
  const currentUnit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(currentMatch?.[4]));
  const previousValue = Number.parseFloat(previousMatch?.[2]);
  const currentValue = Number.parseFloat(currentMatch?.[2]);
  if (!previousUnit || !currentUnit || previousUnit.kind !== currentUnit.kind || !Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
    return false;
  }
  const previousBaseValue = previousUnit.toBase(previousValue);
  const currentBaseValue = currentUnit.toBase(currentValue);
  const tolerance = Math.max(0.6, Math.abs(previousBaseValue) * 0.01, Math.abs(currentBaseValue) * 0.01);
  return Math.abs(previousBaseValue - currentBaseValue) <= tolerance;
}

function isPairedDimensionMeasurement(text, previousMatch, currentMatch) {
  if (!previousMatch || !currentMatch) {
    return false;
  }
  const previousUnit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(previousMatch[4]));
  const currentUnit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(currentMatch[4]));
  if (!previousUnit || !currentUnit || previousUnit.kind !== currentUnit.kind) {
    return false;
  }

  const previousEnd = getDimensionMeasurementMatchEnd(previousMatch);
  const currentStart = getDimensionMeasurementMatchStart(currentMatch);
  const between = text.slice(previousEnd, currentStart);
  const hasExplicitCurrentLabel = hasExplicitDimensionLabel(getDimensionMeasurementLabelContext(text, currentMatch, { before: true }));
  if (hasExplicitCurrentLabel) {
    return false;
  }

  const isUnitCopy =
    previousUnit.system !== currentUnit.system && areEquivalentDimensionMeasurements(previousMatch, currentMatch);
  return isUnitCopy && (/^\s*\(/u.test(between) || /^\s*\/\s*/u.test(between));
}

function convertDimensionSpecLine(line, mode) {
  const text = cleanString(line);
  if (!text) {
    return "";
  }

  DIMENSION_MEASUREMENT_RE.lastIndex = 0;
  const matches = [...text.matchAll(DIMENSION_MEASUREMENT_RE)];
  DIMENSION_MEASUREMENT_RE.lastIndex = 0;
  if (matches.length === 0) {
    return text;
  }

  let previousMatch = null;
  let cursor = 0;
  let output = "";
  for (const match of matches) {
    const matchStart = match.index || 0;
    const matchEnd = getDimensionMeasurementMatchEnd(match);
    if (isPairedDimensionMeasurement(text, previousMatch, match)) {
      // The separator belongs to the duplicate unit copy. Remove it through the
      // closing parenthesis (when present), while retaining the first field.
      let pairedEnd = matchEnd;
      const after = text.slice(pairedEnd);
      if (/^\s*\)/u.test(after)) {
        pairedEnd += after.match(/^\s*\)/u)[0].length;
      }
      cursor = pairedEnd;
      continue;
    }

    output += text.slice(cursor, matchStart);
    output += `${match[1]}${convertDimensionMeasurement(match[2], match[3], match[4], mode)}`;
    cursor = matchEnd;
    previousMatch = match;
  }
  output += text.slice(cursor);
  return output;
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

  const facts = [];
  let previousAcceptedMatch = null;
  matches.forEach((match) => {
      const [, prefix, value, spacing, unit] = match;
      const measurementStart = getDimensionMeasurementMatchStart(match);
      const measurementEnd = getDimensionMeasurementMatchEnd(match);
      if (isDimensionRateMeasurementContext(text, measurementStart, measurementEnd, unit)) {
        return;
      }
      const before = text.slice(Math.max(0, measurementStart - 32), measurementStart);
      if (isPairedDimensionMeasurement(text, previousAcceptedMatch, match)) {
        return;
      }
      const fact = makeDimensionMeasurementFact({
        label: inferDimensionMeasurementLabel(before, unit),
        value,
        spacing,
        unit,
        mode,
        targetLanguageValue,
      });
      if (fact) {
        facts.push(fact);
        previousAcceptedMatch = match;
      }
    });
  return facts;
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

function parseCreationDimensionGroupInput(value) {
  if (typeof value === "string") {
    try {
      return parseCreationDimensionGroupInput(JSON.parse(value));
    } catch (_error) {
      return value ? [value] : [];
    }
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const descriptorKeys = new Set([
    "id",
    "key",
    "groupId",
    "group_id",
    "label",
    "name",
    "title",
    "variant",
    "variantLabel",
    "variant_label",
    "color",
    "colorName",
    "color_name",
    "size",
    "sizeLabel",
    "size_label",
    "referenceIndexes",
    "reference_indexes",
    "reference_indices",
    "indexes",
    "indices",
    "referenceIndex",
    "reference_index",
    "filenames",
    "filename",
    "referenceFilenames",
    "reference_filenames",
    "specs",
    "specifications",
    "dimensions",
    "dimensionSpecs",
    "dimension_specs",
    "sizeSpecs",
    "size_specs",
    "lines",
    "values",
    "facts",
    "note",
    "description",
  ]);
  if (Object.keys(value).some((key) => descriptorKeys.has(key))) {
    return [value];
  }

  return Object.entries(value).map(([label, specs]) => {
    if (specs && typeof specs === "object" && !Array.isArray(specs) && Object.keys(specs).some((key) => descriptorKeys.has(key))) {
      const hasOwnLabel = [
        specs.label,
        specs.name,
        specs.title,
        specs.variant,
        specs.variantLabel,
        specs.variant_label,
        specs.color,
        specs.colorName,
        specs.color_name,
        specs.size,
        specs.sizeLabel,
        specs.size_label,
      ].some((entry) => cleanString(entry));
      return {
        ...specs,
        ...(!hasOwnLabel ? { label } : {}),
      };
    }
    return { label, specs };
  });
}

function normalizeCreationDimensionGroupSpecLines(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const text = cleanString(entry.text || entry.raw || entry.original);
        if (text) {
          return [text];
        }
        const label = cleanString(entry.label || entry.name || entry.key);
        const itemValue = cleanString(entry.value || entry.spec || entry.measurement);
        if (label && itemValue) {
          return [`${label}: ${itemValue}`];
        }
      }
      return normalizeCreationDimensionGroupSpecLines(entry);
    });
  }
  if (typeof value === "object") {
    const text = cleanString(value.text || value.raw || value.original);
    if (text) {
      return [text];
    }
    const label = cleanString(value.label || value.name || value.key);
    const itemValue = cleanString(value.value || value.spec || value.measurement);
    if (label && itemValue) {
      return [`${label}: ${itemValue}`];
    }
    return Object.entries(value).flatMap(([label, spec]) => {
      const normalizedSpec = cleanString(spec);
      return normalizedSpec ? [`${label}: ${normalizedSpec}`] : [];
    });
  }
  return normalizeDimensionSpecs(value);
}

function normalizeCreationDimensionGroup(value = {}, index = 0) {
  const source = value && typeof value === "object" ? value : { specs: value };
  const variant = cleanString(source.variant || source.variantLabel || source.variant_label);
  const color = cleanString(source.color || source.colorName || source.color_name);
  const size = cleanString(source.size || source.sizeLabel || source.size_label);
  const referenceIndexes = normalizeNumberArray(
    source.referenceIndexes ||
      source.reference_indexes ||
      source.reference_indices ||
      source.indexes ||
      source.indices ||
      source.referenceIndex ||
      source.reference_index,
  );
  const filenames = uniqueCleanStrings([
    ...(Array.isArray(source.filenames) ? source.filenames : [source.filenames]),
    ...(Array.isArray(source.referenceFilenames) ? source.referenceFilenames : [source.referenceFilenames]),
    ...(Array.isArray(source.reference_filenames) ? source.reference_filenames : [source.reference_filenames]),
    source.filename,
  ]);
  const explicitLabel = cleanString(source.label || source.name || source.title);
  const variantLabel = explicitLabel || uniqueCleanStrings([
    source.variantLabel,
    source.variant_label,
    source.variant,
    source.colorName,
    source.color_name,
    source.color,
    source.sizeLabel,
    source.size_label,
    source.size,
  ]).join(" / ");
  const explicitId = cleanString(source.id || source.key || source.groupId || source.group_id);
  const specs = normalizeCreationDimensionGroupSpecLines(
    source.specs ??
      source.specifications ??
      source.dimensions ??
      source.dimensionSpecs ??
      source.dimension_specs ??
      source.sizeSpecs ??
      source.size_specs ??
      source.lines ??
      source.values ??
      source.facts,
  );
  const note = cleanString(source.note || source.description);
  if (!explicitId && !variantLabel && specs.length === 0 && referenceIndexes.length === 0 && filenames.length === 0 && !note) {
    return null;
  }
  const id = explicitId || variantLabel || `dimension-group-${index + 1}`;
  return {
    id,
    label: variantLabel,
    referenceIndexes,
    filenames,
    specs,
    note,
    ...(variant ? { variant } : {}),
    ...(color ? { color } : {}),
    ...(size ? { size } : {}),
  };
}

export function normalizeCreationDimensionGroups(value) {
  return parseCreationDimensionGroupInput(value)
    .map((entry, index) => normalizeCreationDimensionGroup(entry, index))
    .filter(Boolean);
}

const CREATION_KEY_SPEC_LABEL_PRIORITY = ["length", "height", "width", "weight", "depth"];

function getCreationDimensionLineLabel(line = "") {
  const text = cleanString(line);
  const firstNumberIndex = text.search(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/u);
  const labelText = firstNumberIndex >= 0 ? text.slice(0, firstNumberIndex).trim() : text;
  return normalizeDimensionFactLabel(labelText);
}

function selectCreationKeySpecLines(lines = [], maxCount = 4) {
  const firstByLabel = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    const normalizedLine = cleanString(line);
    if (!normalizedLine) {
      continue;
    }
    const label = getCreationDimensionLineLabel(normalizedLine);
    if (!firstByLabel.has(label)) {
      firstByLabel.set(label, normalizedLine);
    }
  }

  const selected = CREATION_KEY_SPEC_LABEL_PRIORITY
    .map((label) => firstByLabel.get(label))
    .filter(Boolean);
  const remaining = [...firstByLabel.entries()]
    .filter(([label]) => !CREATION_KEY_SPEC_LABEL_PRIORITY.includes(label))
    .map(([, line]) => line);
  return [...selected, ...remaining].slice(0, Math.max(0, maxCount));
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
  const lines = ["Copy every digit, decimal point, leading zero, space, parenthesis, and unit exactly."];
  if (decimalWeights.length === 0) {
    return lines.join(" ");
  }

  lines.push(`That includes ${decimalWeights.map((entry) => entry.text).join(", ")} character for character.`);

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

function hasFeatureReferenceSignal(value) {
  return FEATURE_REFERENCE_SIGNAL_RE.test(cleanString(value).toLowerCase());
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

function buildReferenceDimensionSpecGroups(referenceImageRoles = [], mode, targetLanguageValue = "") {
  const entries = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  const eligibleEntries = entries.filter((entry) => {
    const note = cleanString(entry?.note);
    const hasStructuredGroups = normalizeCreationDimensionGroups(entry?.dimensionGroups ?? entry?.dimension_groups).length > 0;
    if (!hasStructuredGroups && !hasDimensionSpecificationValue(note)) {
      return false;
    }
    return cleanString(entry?.role) === "dimensions" || hasDimensionReferenceSignal(note) || hasStructuredGroups;
  });
  const dimensionEntries = eligibleEntries.filter((entry) => cleanString(entry?.role) === "dimensions");
  const sourceEntries = dimensionEntries.length > 0 ? dimensionEntries : eligibleEntries;
  const groups = [];

  sourceEntries.forEach((entry, entryIndex) => {
    const entryIndexValue = getCreationReferenceEntryIndex(entry, entryIndex);
    const entryFilename = cleanString(entry?.filename);
    const structuredGroups = normalizeCreationDimensionGroups(entry?.dimensionGroups ?? entry?.dimension_groups);
    const sourceGroups = structuredGroups.length > 0
      ? structuredGroups
      : [{ id: `reference-${entryIndexValue}`, label: "", referenceIndexes: [], filenames: [], specs: [], note: cleanString(entry?.note) }];

    sourceGroups.forEach((group, groupIndex) => {
      const rawLines = group.specs.length > 0 ? group.specs : [group.note || cleanString(entry?.note)];
      const facts = [];
      rawLines.forEach((line) => {
        collectUniqueDimensionFacts(
          facts,
          extractReferenceDimensionFacts(line, mode, targetLanguageValue).filter(isAllowedCreationDimensionFact),
        );
      });
      if (facts.length === 0) {
        return;
      }
      const explicitGroupIndexes = normalizeNumberArray(group.referenceIndexes);
      const explicitGroupFilenames = uniqueCleanStrings(group.filenames);
      const hasExplicitGroupBinding = explicitGroupIndexes.length > 0 || explicitGroupFilenames.length > 0;
      const canUseLegacyEntryBinding = structuredGroups.length <= 1;
      const referenceIndexes = hasExplicitGroupBinding
        ? explicitGroupIndexes
        : canUseLegacyEntryBinding
          ? [entryIndexValue]
          : [];
      const filenames = hasExplicitGroupBinding
        ? explicitGroupFilenames
        : canUseLegacyEntryBinding
          ? [entryFilename]
          : [];
      const label = cleanString(group.label) || (
        structuredGroups.length > 1
          ? explicitGroupFilenames[0] || entryFilename || `尺寸组 ${groupIndex + 1}`
          : ""
      );
      groups.push({
        id: cleanString(group.id || `${entryIndexValue}-${groupIndex + 1}`),
        label,
        referenceIndexes,
        filenames,
        ...(group.variant ? { variant: group.variant } : {}),
        ...(group.color ? { color: group.color } : {}),
        ...(group.size ? { size: group.size } : {}),
        hasStructuredSource: structuredGroups.length > 0,
        hasExplicitSkuBinding: hasExplicitGroupBinding,
        facts,
        lines: formatDimensionFactsAsLines(facts),
        note: cleanString(group.note),
      });
    });
  });

  return groups;
}

function formatCreationDimensionSpecGroups(groups = [], { keyOnly = false } = {}) {
  return (Array.isArray(groups) ? groups : [])
    .map((group, index) => {
      const lines = keyOnly ? selectCreationKeySpecLines(group.lines || []) : group.lines || [];
      if (lines.length === 0) {
        return "";
      }
      const label = cleanString(group.label) || `Dimension group ${index + 1}`;
      return `${label}: ${lines.map(trimTerminalSentencePunctuation).join(" / ")}`;
    })
    .filter(Boolean)
    .join("; ");
}

function buildReferenceDimensionSpecLines(referenceImageRoles = [], mode, targetLanguageValue = "") {
  const groups = buildReferenceDimensionSpecGroups(referenceImageRoles, mode, targetLanguageValue);
  const facts = [];
  groups.forEach((group) => collectUniqueDimensionFacts(facts, group.facts));
  return formatDimensionFactsAsLines(facts);
}

function buildCreationDimensionPromptInstruction({
  dimensionSpecSummary = "",
  dimensionSpecGroups = [],
  dimensionUnitMode,
  source = "",
  role = "",
} = {}) {
  const hasDimensionGroups = Array.isArray(dimensionSpecGroups) && dimensionSpecGroups.length > 1;
  const groupedSummary = hasDimensionGroups
    ? formatCreationDimensionSpecGroups(dimensionSpecGroups, { keyOnly: cleanString(role) === "spec-table" })
    : "";
  const effectiveDimensionSpecSummary = groupedSummary || dimensionSpecSummary;
  const groupLock = hasDimensionGroups
    ? "Show every bound variant or size group as its own clearly separated product/card or row in this dimension image. Each labeled group is a closed set: bind every value only to that matching color, size, or product unit. Do not combine, cross-pair, or reuse values from another group. Do not collapse all groups into one subject; if a value has no reliable group, leave it out rather than guess."
    : "";
  if (cleanString(role) === "spec-table") {
    if (!effectiveDimensionSpecSummary) {
      return `${dimensionUnitMode.promptInstruction} No exact specification value was supplied for this image, so keep the product dominant and rely on visible structure, scale, capacity, or fit cues without numbers.`;
    }

    const dualUnitLock =
      dimensionUnitMode.value === "both"
        ? "Each label carries the metric and imperial pair together, as in Length 10 cm (3.94 in)."
        : "";
    return [
      `Visible key specifications, the complete set for this image: ${effectiveDimensionSpecSummary}.`,
      dimensionUnitMode.promptInstruction,
      dualUnitLock,
      buildCreationExactNumericValueLock(effectiveDimensionSpecSummary),
      groupLock,
      "Other supplied measurements stay as background evidence.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (effectiveDimensionSpecSummary) {
    const heading =
      source === "reference"
        ? "Dimension specifications recognized from reference notes"
        : "Dimension specifications for this size chart";
    const mandatory =
      "Render every listed value as its own legible label here; other images in the set carry only broad size comparison.";
    const dualUnitLock =
      dimensionUnitMode.value === "both"
        ? "Each callout carries the metric and imperial pair together, as in Length 10 cm (3.94 in)."
        : "";

    return `${heading}: ${effectiveDimensionSpecSummary}. ${dimensionUnitMode.promptInstruction} ${dualUnitLock} ${buildCreationExactNumericValueLock(effectiveDimensionSpecSummary)} ${groupLock} ${mandatory}`;
  }

  return `${dimensionUnitMode.promptInstruction} Apply that unit mode to the length, height, width, depth, and weight values recognized from dimension references or analyst notes, and render only measurements visible in the supplied references or explicitly provided. With no exact measurement supplied, keep this a non-numeric scale or fit image grounded in the visible product structure.`;
}

function buildCreationNonDimensionSpecBoundaryInstruction(hasReservedDimensionSpecs) {
  return hasReservedDimensionSpecs
    ? "Exact size and weight values belong to the dimension image; convey scale here through visible proportion and context."
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
  const normalized = Number.parseInt(String(value ?? "").trim(), 10);
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

export function normalizeCreationPlatform(value) {
  const normalized = cleanString(value);
  return (
    CREATION_PLATFORM_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_PLATFORM_OPTIONS.find((option) => option.value === DEFAULT_CREATION_PLATFORM) ||
    CREATION_PLATFORM_OPTIONS[0]
  );
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
  if (scenarioInstructions[role]) {
    return scenarioInstructions[role];
  }
  if (isCreationDimensionImageRole(role)) {
    return "Role focus: keep this hard information image factual, verification-led, and easy to compare; prioritize exact dimensions, capacity, fit, compatibility, or parameter values over generic scenario or persuasion copy.";
  }
  return scenarioInstructions.default || CREATION_SCENARIO_ROLE_INSTRUCTIONS.standard.default;
}

const CREATION_LURE_SIGNAL_RE =
  /\blure|\bbait\b|crankbait|swimbait|jerkbait|spinnerbait|treble|鱼钩|鱼饵|饼饵|路亚|假饵|饶料/i;

function hasCreationLureContext(productContext = "") {
  return CREATION_LURE_SIGNAL_RE.test(cleanString(productContext));
}

function getCreationRoleDirective(roleValue, productContext = "") {
  const definition = getCreationItemRoleDefinition(roleValue);
  if (!definition) {
    return "";
  }
  const question = cleanString(definition.question);
  return [
    question ? `Shopper question: ${question}` : "",
    cleanString(definition.directive),
    hasCreationLureContext(productContext) ? cleanString(definition.lureDirective) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationScenarioPromptInstruction(scenario, roleValue) {
  const normalized = normalizeCreationScenario(scenario?.value || scenario);
  if (isCreationDimensionImageRole(roleValue) && normalized.value === "standard") {
    return `Scenario: ${normalized.label}. Keep this hard information image focused on factual verification and readable comparison of accurate values.`;
  }
  const roleFocus = buildCreationScenarioRoleFocus(scenario, roleValue);
  return roleFocus
    ? `Scenario: ${normalized.label}. ${roleFocus}`
    : `Scenario: ${normalized.label}. ${normalized.promptInstruction}`;
}

function buildCreationScenarioRoleFocus(scenario, roleValue) {
  const roleFocus = getCreationScenarioRoleInstruction(scenario?.value || scenario, roleValue);
  const scenarioDefault = (CREATION_SCENARIO_ROLE_INSTRUCTIONS[normalizeCreationScenario(scenario?.value || scenario).value] || {}).default;
  return roleFocus === scenarioDefault ? "" : roleFocus;
}

function buildCreationPlatformPromptInstruction(platform, industryTemplate, roleValue) {
  const normalizedPlatform = normalizeCreationPlatform(platform?.value || platform);
  const categoryLabel = cleanString(industryTemplate?.label) || "通用电商";
  const categoryPath = cleanString(industryTemplate?.categoryPath);
  const categoryText = categoryPath ? `${categoryLabel} (${categoryPath})` : categoryLabel;

  return [
    `Platform: ${normalizedPlatform.label}. Product category: ${categoryText}.`,
    normalizedPlatform.promptInstruction,
    cleanString(roleValue) === "hero" ? "Keep it thumbnail-legible for that platform's first buyer impression." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getCreationIndustryTemplateRoleInstruction(industryTemplate, roleValue) {
  const role = cleanString(roleValue);
  const roleInstructions = industryTemplate?.rolePromptInstructions || {};
  return cleanString(roleInstructions[role] || roleInstructions.default || "");
}

function buildCreationVisualLanguageGuidance(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);

  return [
    `Visual language: ${option.label}, held as the authority for every image in the set.`,
    option.promptInstruction,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationVisualLanguageQualityLine(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Ecommerce quality: clear uncrowded composition, legible text, real photographic surfaces, and nothing visible beyond the supplied product and its own brand marks.";
  }

  return "Ecommerce quality: clear uncrowded composition, legible text, real photographic surfaces following the selected visual language, and nothing visible beyond the supplied product and its own brand marks.";
}

function buildCreationSkuBackgroundInstruction(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Replace the uploaded plain photo background with a clean classic-commercial ecommerce background using polished neutral lighting and controlled shadow, matching the rest of the SKU series.";
  }

  return "Replace the uploaded plain photo background with a new ecommerce setting following the selected visual language, changing only the scene, surface, light, and layout mood.";
}

function buildCreationSkuQualityLine(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Ecommerce SKU quality: clear centered subject, clean background separation, realistic product details.";
  }

  return "Ecommerce SKU quality: clear subject recognition and realistic product details within the selected visual language.";
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
    "SKU series consistency: every SKU image here, retries included, shares one locked blueprint of camera height, product scale, margins, background plane, lighting, and typography, so only the subject and its colorway differ.",
    subjectList ? `Series subjects: ${subjectList}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationSkuMainSubjectLock(skuSubject = {}) {
  const subjectName = cleanString(skuSubject.filenames?.[0] || skuSubject.title || skuSubject.id);
  if (!subjectName) {
    return "";
  }

  return `SKU subject: ${subjectName} is the one sellable product here, kept exactly as supplied in shape, proportions, colors, materials, markings, logos, identifiers, and hardware. Only the background, light, layout, allowed duplication, and requested SKU information change.`;
}

function buildCreationSkuSourceTextBoundaryInstruction() {
  return "Visible text is limited to this SKU template's required product code or color label; source-card badges, stickers, price tags, captions, and watermarks stay out.";
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

function getCreationDimensionGroupMatchesSubject(
  dimensionGroups = [],
  skuSubject = {},
  { requireExplicitBinding = false } = {},
) {
  const subjectIndexes = new Set(normalizeNumberArray(skuSubject.referenceIndexes).map((value) => Number(value)));
  const subjectFilenames = new Set(uniqueCleanStrings(skuSubject.filenames).map((value) => value.toLowerCase()));
  if (subjectIndexes.size === 0 && subjectFilenames.size === 0) {
    return [];
  }
  const bindingCounts = getCreationDimensionGroupBindingCounts(dimensionGroups);
  return (Array.isArray(dimensionGroups) ? dimensionGroups : []).filter((group) => {
    if (requireExplicitBinding && group.hasExplicitSkuBinding !== true) {
      return false;
    }
    const groupIndexes = getReliableCreationDimensionGroupBindingSet(group, "referenceIndexes", bindingCounts);
    const groupFilenames = getReliableCreationDimensionGroupBindingSet(group, "filenames", bindingCounts);
    return (
      [...groupIndexes].some((value) => subjectIndexes.has(value)) ||
      [...groupFilenames].some((filename) => subjectFilenames.has(filename))
    );
  });
}

function buildCreationSkuDimensionSummaryForSubject({
  dimensionSpecSummary = "",
  dimensionSpecGroups = [],
  referenceImageRoles = [],
  skuSubject = {},
  skuSubjectCount = 0,
  dimensionUnitMode,
} = {}) {
  const subjectDimensionGroups = normalizeCreationDimensionGroups(skuSubject.dimensionGroups ?? skuSubject.dimension_groups);
  const formatSubjectDimensionSummary = () => formatCreationContentFacts(
    subjectDimensionGroups.map((group, index) => {
      const label = cleanString(group.label) || `Dimension group ${index + 1}`;
      const lines = dimensionUnitMode?.value
        ? formatCreationDimensionSpecsForMode(group.specs || [], dimensionUnitMode.value).split("\n").filter(Boolean)
        : group.specs || [];
      return `${label}: ${lines.map(trimTerminalSentencePunctuation).join(" / ")}`;
    }).filter((value) => !/:\s*$/u.test(value)),
  );
  if ((!Array.isArray(dimensionSpecGroups) || dimensionSpecGroups.length === 0) && subjectDimensionGroups.length > 0) {
    return formatSubjectDimensionSummary();
  }
  if (!Array.isArray(dimensionSpecGroups) || dimensionSpecGroups.length === 0) {
    // A flat summary has no reliable variant boundary. Keep it available for a
    // single SKU, but never copy a multi-variant input into every SKU subject.
    if (Number(skuSubjectCount) > 1) {
      return "";
    }
    return buildCreationSkuDimensionSummary(dimensionSpecSummary, referenceImageRoles);
  }

  const matchingGroups = getCreationDimensionGroupMatchesSubject(dimensionSpecGroups, skuSubject, {
    requireExplicitBinding: Number(skuSubjectCount) > 1,
  });
  if (matchingGroups.length === 0) {
    if (subjectDimensionGroups.length > 0) {
      return formatSubjectDimensionSummary();
    }
    if (Number(skuSubjectCount) <= 1 && dimensionSpecGroups.length === 1) {
      const [group] = dimensionSpecGroups;
      if (group.hasExplicitSkuBinding === true) {
        return "";
      }
      const label = cleanString(group.label) || "Dimension group 1";
      return formatCreationContentFacts([
        `${label}: ${(group.lines || []).map(trimTerminalSentencePunctuation).join(" / ")}`,
      ]);
    }
    return "";
  }
  return formatCreationContentFacts(
    matchingGroups.map((group, index) => {
      const label = cleanString(group.label) || `Dimension group ${index + 1}`;
      return `${label}: ${(group.lines || []).map(trimTerminalSentencePunctuation).join(" / ")}`;
    }),
  );
}

function getCreationSkuSupportingReferenceRoles(skuGenerationRule) {
  const roles = [];
  if (skuGenerationRule.includeDimensions) {
    roles.push("dimensions");
  }
  return roles;
}

function buildCreationSkuColorNameInstruction({ skuSubject, targetLanguage } = {}) {
  const subjectUnitCount =
    normalizeCreationSubjectUnitCount(skuSubject.subjectUnitCount) ||
    inferCreationSubjectUnitCount([skuSubject.title, skuSubject.note].join(" "));
  const colorNames = getCreationSkuColorNames(skuSubject, targetLanguage);
  const colorName = subjectUnitCount > 1 ? "" : colorNames.join(" ");
  const groupedColorLabels = subjectUnitCount > 1 && colorNames.length === subjectUnitCount
    ? colorNames.join("\n")
    : "";
  return [
    subjectUnitCount > 1
      ? "SKU generation rule: each complete visible product unit carries its own centered color-name label directly below it, in the selected target language."
      : "SKU generation rule: one short centered color-name label sits directly below the product subject, in the selected target language.",
    "It holds color words only, space-separated, keeping a hyphen inside a compound name such as off-white.",
    groupedColorLabels
      ? `Color label lines in product-unit order follow.\n${groupedColorLabels}\nPlace each line's color words below its matching unit.`
      : colorName
      ? `Color label line under the subject follows.\n${colorName}\nRender that exact color-only line below the product subject.`
      : "The exact SKU color name is unavailable, so this image stays free of any color-name label.",
  ].filter(Boolean).join(" ");
}

function buildCreationSkuGenerationRuleInstruction({
  skuGenerationRule,
  skuSubject,
  targetLanguage,
  packageListSummary,
  dimensionSummary,
} = {}) {
  const rule = normalizeCreationSkuGenerationRule(skuGenerationRule?.value || skuGenerationRule);
  if (rule.showColorNameUnderSubject) {
    return buildCreationSkuColorNameInstruction({ skuSubject, targetLanguage });
  }
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
      ? `Package-list content as facts only: ${packageListSummary}.`
      : "",
    rule.includePackageList
      ? "Treat that package list as a text inventory of included items and quantities, keeping the SKU subject itself as the only physical product shown."
      : "",
    rule.includeDimensions && dimensionSummary
      ? `Dimension/specification content to keep accurate when useful: ${dimensionSummary}.`
      : "",
    rule.includeDimensions
      ? "Use size and specification references as factual callouts for scale, capacity, and compatibility around the SKU subject."
      : "",
    rule.includeDimensions
      ? "Use only dimensions explicitly matched to this SKU subject's reference indexes or filenames. Never combine values from another color, size, or variant group; when no matching group is supplied, omit variant-specific dimensions instead of guessing."
      : "",
  ];
  return lines.filter(Boolean).join(" ");
}

function buildCreationSkuReferenceScopeInstruction(skuGenerationRule) {
  const rule = normalizeCreationSkuGenerationRule(skuGenerationRule?.value || skuGenerationRule);
  if (rule.includePackageList || rule.includeDimensions) {
    return [
      "Compose from the SKU subject reference alone.",
      rule.includePackageList ? "Package-list references contribute included-item and quantity facts as text." : "",
      rule.includeDimensions ? "Dimension references contribute size and specification values as text." : "",
    ].filter(Boolean).join(" ");
  }
  return "Compose from the SKU subject reference alone.";
}

function buildCreationSkuSubjectUnitCountInstruction(skuSubject = {}, { bundleCount = 1 } = {}) {
  const subjectUnitCount =
    normalizeCreationSubjectUnitCount(skuSubject.subjectUnitCount) ||
    inferCreationSubjectUnitCount([skuSubject.title, skuSubject.note].join(" "));
  if (subjectUnitCount <= 1) {
    return "";
  }

  const evidence = cleanString(skuSubject.note);
  const groupedSetInstruction =
    Number.isFinite(Number(bundleCount)) && Number(bundleCount) > 1
      ? `Keep ${subjectUnitCount} complete visible product units inside each duplicated grouped set.`
      : "Keep the same number of complete visible product units as the supplied SKU subject reference.";
  return [
    `SKU subject unit count: this grouped subject holds ${subjectUnitCount} complete visible product units in one sellable SKU image.`,
    groupedSetInstruction,
    "Keep all of those units together in this single image.",
    evidence ? `Visible unit evidence: ${evidence}.` : "",
  ].filter(Boolean).join(" ");
}

export function normalizeCreationReferenceRole(value) {
  const normalized = cleanString(value);
  if (normalized === "style") {
    return CREATION_REFERENCE_ROLE_OPTIONS.find((option) => option.value === "other");
  }
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
      if (cleanString(entry?.role) === "style") {
        return null;
      }
      const role = normalizeCreationReferenceRole(entry?.role);
      const filename = cleanString(entry?.filename || entry?.name || `reference-image-${index + 1}`);
      const note = cleanString(entry?.note || entry?.analysisNote || entry?.description);
      const requestedIndex = Number.parseInt(cleanString(entry?.index || entry?.referenceIndex || entry?.reference_index), 10);
      const dimensionGroups = normalizeCreationDimensionGroups(entry?.dimensionGroups ?? entry?.dimension_groups);
      return {
        index: Number.isFinite(requestedIndex) && requestedIndex > 0 ? requestedIndex : index + 1,
        filename,
        role: role.value,
        roleLabel: role.label,
        rolePromptLabel: role.promptLabel,
        promptInstruction: role.promptInstruction,
        note,
        ...(dimensionGroups.length > 0 ? { dimensionGroups } : {}),
      };
    })
    .filter((entry) => entry?.filename);
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
  const filenameSet = new Set(filenames.map((filename) => filename.toLowerCase()));
  const matchingRoles = referenceImageRoles.filter((entry) => filenameSet.has(cleanString(entry.filename).toLowerCase()));
  if (matchingRoles.length > 0) {
    return matchingRoles.every((entry) => !isCreationSubjectReferenceRole(entry.role));
  }

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
  if (/\b(accessory|accessories|package|packaging|included|material|feature|scene|style|support)\b|功能卖点|功能效果|卖点/.test(text)) {
    return true;
  }
  if (hasUsageInstructionSignal(text)) {
    return true;
  }
  return false;
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
  const structuredColorSource = Array.isArray(source.colorNames)
    ? source.colorNames
    : Array.isArray(source.color_names)
      ? source.color_names
      : null;
  const colorNames = normalizeCreationSkuColorLabels(
    structuredColorSource ?? source.colorNames ?? source.color_names ?? source.colorName ?? source.color_name ?? source.color ?? source.colour ?? source.colors ?? source.colours,
    subjectUnitCount > 1,
  );
  const colorName = colorNames.join(" ");
  const dimensionGroups = normalizeCreationDimensionGroups(source.dimensionGroups ?? source.dimension_groups);

  if (!id || filenames.length === 0 || isSkuSubjectAccessoryLike(source, filenames, referenceImageRoles)) {
    return null;
  }

  return {
    id,
    title,
    referenceIndexes,
    filenames,
    note,
    ...(structuredColorSource !== null || colorName ? { colorNames } : {}),
    ...(colorName ? { colorName } : {}),
    ...(bundleCount ? { bundleCount } : {}),
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
    ...(dimensionGroups.length > 0 ? { dimensionGroups } : {}),
  };
}

function getCreationReferenceEntryIndex(entry = {}, fallbackIndex = 0) {
  const requestedIndex = Number.parseInt(
    cleanString(entry?.index || entry?.referenceIndex || entry?.reference_index),
    10,
  );
  return Number.isFinite(requestedIndex) && requestedIndex > 0 ? requestedIndex : fallbackIndex + 1;
}

function getSkuReferenceSubjectEntries(referenceImageRoles = []) {
  return referenceImageRoles
    .map((entry, index) => ({
      ...entry,
      referenceIndex: getCreationReferenceEntryIndex(entry, index),
    }))
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
    .map((entry, index) => ({
      ...entry,
      referenceIndex: getCreationReferenceEntryIndex(entry, index),
    }))
    .filter((entry) => isCreationSubjectReferenceRole(entry.role) && filenames.has(cleanString(entry.filename).toLowerCase()));
}

function normalizeCreationDimensionGroupIdentityText(value) {
  return cleanString(value).toLowerCase();
}

function getCreationDimensionGroupSpecKey(group = {}) {
  return uniqueCleanStrings(group.specs)
    .map((spec) => normalizeCreationDimensionGroupIdentityText(spec))
    .sort()
    .join("\u001f");
}

function getCreationDimensionGroupBindingSet(group = {}, field) {
  const values = field === "referenceIndexes"
    ? normalizeNumberArray(group.referenceIndexes)
    : uniqueCleanStrings(group.filenames).map((filename) => filename.toLowerCase());
  return new Set(values);
}

function getCreationDimensionGroupBindingCounts(groups = []) {
  const indexCounts = new Map();
  const filenameCounts = new Map();
  (Array.isArray(groups) ? groups : []).forEach((group) => {
    getCreationDimensionGroupBindingSet(group, "referenceIndexes").forEach((value) => {
      indexCounts.set(value, (indexCounts.get(value) || 0) + 1);
    });
    getCreationDimensionGroupBindingSet(group, "filenames").forEach((value) => {
      filenameCounts.set(value, (filenameCounts.get(value) || 0) + 1);
    });
  });
  return { indexCounts, filenameCounts };
}

function getReliableCreationDimensionGroupBindingSet(group = {}, field, bindingCounts = {}) {
  const values = getCreationDimensionGroupBindingSet(group, field);
  const counts = field === "referenceIndexes" ? bindingCounts.indexCounts : bindingCounts.filenameCounts;
  if (!(counts instanceof Map)) {
    return values;
  }
  return new Set([...values].filter((value) => counts.get(value) === 1));
}

function hasCreationDimensionGroupBindingOverlap(left, right) {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

function canMergeCreationDimensionGroups(left = {}, right = {}) {
  const semanticFields = ["label", "variant", "color", "size"];
  if (!semanticFields.every((field) => {
    const leftValue = normalizeCreationDimensionGroupIdentityText(left[field]);
    const rightValue = normalizeCreationDimensionGroupIdentityText(right[field]);
    return !leftValue || !rightValue || leftValue === rightValue;
  })) {
    return false;
  }

  const hasSharedSemanticIdentity = semanticFields.some((field) => {
    const leftValue = normalizeCreationDimensionGroupIdentityText(left[field]);
    const rightValue = normalizeCreationDimensionGroupIdentityText(right[field]);
    return leftValue && rightValue && leftValue === rightValue;
  });

  const leftIndexes = getCreationDimensionGroupBindingSet(left, "referenceIndexes");
  const rightIndexes = getCreationDimensionGroupBindingSet(right, "referenceIndexes");
  const leftFilenames = getCreationDimensionGroupBindingSet(left, "filenames");
  const rightFilenames = getCreationDimensionGroupBindingSet(right, "filenames");
  const leftHasBinding = leftIndexes.size > 0 || leftFilenames.size > 0;
  const rightHasBinding = rightIndexes.size > 0 || rightFilenames.size > 0;
  const leftSpecs = getCreationDimensionGroupSpecKey(left);
  const rightSpecs = getCreationDimensionGroupSpecKey(right);
  if (!leftHasBinding && !rightHasBinding && hasSharedSemanticIdentity && leftSpecs && rightSpecs && leftSpecs !== rightSpecs) {
    return false;
  }
  if (!hasSharedSemanticIdentity && leftSpecs && rightSpecs && leftSpecs !== rightSpecs) {
    return false;
  }

  if (leftIndexes.size > 0 && rightIndexes.size > 0 && !hasCreationDimensionGroupBindingOverlap(leftIndexes, rightIndexes)) {
    return false;
  }
  if (leftFilenames.size > 0 && rightFilenames.size > 0 && !hasCreationDimensionGroupBindingOverlap(leftFilenames, rightFilenames)) {
    return false;
  }

  return hasSharedSemanticIdentity || Boolean(leftSpecs && rightSpecs && leftSpecs === rightSpecs);
}

function mergeCreationDimensionGroupPair(left = {}, right = {}) {
  const referenceIndexes = normalizeNumberArray([
    ...normalizeNumberArray(left.referenceIndexes),
    ...normalizeNumberArray(right.referenceIndexes),
  ]);
  const filenames = uniqueCleanStrings([
    ...uniqueCleanStrings(left.filenames),
    ...uniqueCleanStrings(right.filenames),
  ]);
  const specs = uniqueCleanStrings([
    ...uniqueCleanStrings(left.specs),
    ...uniqueCleanStrings(right.specs),
  ]);
  const note = uniqueCleanStrings([left.note, right.note]).join(" | ");
  return {
    ...left,
    ...(left.label || right.label ? { label: left.label || right.label } : {}),
    referenceIndexes,
    filenames,
    specs,
    ...(left.variant || right.variant ? { variant: left.variant || right.variant } : {}),
    ...(left.color || right.color ? { color: left.color || right.color } : {}),
    ...(left.size || right.size ? { size: left.size || right.size } : {}),
    ...(note ? { note } : {}),
  };
}

function getCreationDimensionGroupsForMatchedSubject(subject = {}, matchedRoles = []) {
  const subjectIndexes = getCreationDimensionGroupBindingSet(subject, "referenceIndexes");
  const subjectFilenames = getCreationDimensionGroupBindingSet(subject, "filenames");
  const entries = (Array.isArray(matchedRoles) ? matchedRoles : []).map((entry) => ({
    entry,
    groups: normalizeCreationDimensionGroups(entry.dimensionGroups ?? entry.dimension_groups),
  }));
  const bindingCounts = getCreationDimensionGroupBindingCounts(entries.flatMap(({ groups }) => groups));
  return entries.flatMap(({ entry, groups }) => {
    if (groups.length === 0) {
      return [];
    }

    const effectiveIndexes = new Set(subjectIndexes);
    const entryIndex = Number.parseInt(cleanString(entry.referenceIndex), 10);
    if (Number.isFinite(entryIndex) && entryIndex > 0) {
      effectiveIndexes.add(entryIndex);
    }
    const boundGroups = groups.filter((group) =>
      getCreationDimensionGroupBindingSet(group, "referenceIndexes").size > 0 ||
      getCreationDimensionGroupBindingSet(group, "filenames").size > 0,
    );
    const reliableBoundGroups = groups.filter((group) =>
      getReliableCreationDimensionGroupBindingSet(group, "referenceIndexes", bindingCounts).size > 0 ||
      getReliableCreationDimensionGroupBindingSet(group, "filenames", bindingCounts).size > 0,
    );
    const matchingBoundGroups = reliableBoundGroups.filter((group) =>
      hasCreationDimensionGroupBindingOverlap(getReliableCreationDimensionGroupBindingSet(group, "referenceIndexes", bindingCounts), effectiveIndexes) ||
      hasCreationDimensionGroupBindingOverlap(getReliableCreationDimensionGroupBindingSet(group, "filenames", bindingCounts), subjectFilenames),
    );
    if (matchingBoundGroups.length > 0) {
      return matchingBoundGroups;
    }
    if (boundGroups.length > 0 || groups.length !== 1) {
      return [];
    }
    return groups;
  });
}

function mergeCreationDimensionGroups(...values) {
  const merged = [];
  values.forEach((value) => {
    normalizeCreationDimensionGroups(value).forEach((group) => {
      const existingIndex = merged.findIndex((existing) => canMergeCreationDimensionGroups(existing, group));
      if (existingIndex < 0) {
        merged.push(group);
        return;
      }
      merged[existingIndex] = mergeCreationDimensionGroupPair(merged[existingIndex], group);
    });
  });
  return merged;
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
  const dimensionGroups = mergeCreationDimensionGroups(
    subject.dimensionGroups ?? subject.dimension_groups,
    getCreationDimensionGroupsForMatchedSubject(subject, matchedRoles),
  );

  return {
    ...subject,
    ...(referenceIndexes.length > 0 ? { referenceIndexes } : {}),
    ...(note ? { note } : {}),
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
    ...(dimensionGroups.length > 0 ? { dimensionGroups } : {}),
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
  if (hasFeatureReferenceSignal(raw)) {
    return "feature";
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
  const shouldUseFeatureRole =
    hasFeatureReferenceSignal(evidenceText) &&
    (!explicitRole || explicitRole.value === "other" || explicitRole.value === "product");
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
          : shouldUseFeatureRole
            ? "feature"
            : shouldUseDetailRole
              ? "material"
              : explicitRole?.value || inferredRole,
  );
  const note = cleanString(source.note || source.description || source.reason || source.summary);
  const dimensionGroups = normalizeCreationDimensionGroups(source.dimensionGroups ?? source.dimension_groups);

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
    ...(dimensionGroups.length > 0 ? { dimensionGroups } : {}),
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

const CREATION_REFERENCE_ANALYSIS_ANY_UNIT_COUNT_PATTERN =
  /(?:[，,；;\s]*)?(?:图中|画面中|图片中|画面|图片)?\s*(?:共|为|是|仅|只有|包含|展示|显示|呈现)?\s*(?:[一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款)?\s*完整(?:可见)?(?:产品|商品)?(?:单位|单体|单元|主体)[。.]?/gu;
const CREATION_REFERENCE_ANALYSIS_SINGULAR_UNIT_COUNT_PATTERN =
  /(?:[，,；;\s]*)?(?:图中|画面中|图片中|画面|图片)?\s*(?:共|为|是|仅|只有|包含|展示|显示|呈现)?\s*(?:一|1)\s*(?:个|件|只|条|款)?\s*完整(?:可见)?(?:产品|商品)?(?:单位|单体|单元|主体)[。.]?/gu;

function normalizeCreationReferenceAnalysisNotePunctuation(note = "") {
  return cleanString(note).replace(/[，,；;\s]+$/u, "").trim();
}

function normalizeCreationReferenceAnalysisUnitCountNote(note = "", subjectUnitCount = 0) {
  const noteWithoutSingularCount = normalizeCreationReferenceAnalysisNotePunctuation(
    cleanString(note).replace(CREATION_REFERENCE_ANALYSIS_SINGULAR_UNIT_COUNT_PATTERN, ""),
  );
  if (subjectUnitCount <= 1) {
    return noteWithoutSingularCount;
  }
  const cleanedNote = noteWithoutSingularCount
    .replace(CREATION_REFERENCE_ANALYSIS_ANY_UNIT_COUNT_PATTERN, "")
    .replace(/(?:^|([，,；;\s]))(?:单个|单件|单只|单条|单款|单一|一个|一件|一只|一条|一款|1\s*(?:个|件|只|条|款))\s*(?=[^，,；;。.!?！？]{0,24}(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵|主图|主体图|白底主体图))/gu, "$1")
    .trim();
  const countNote = `图中共 ${subjectUnitCount} 个完整产品单位。`;
  const cleanedPrefix = normalizeCreationReferenceAnalysisNotePunctuation(trimTerminalSentencePunctuation(cleanedNote));
  return cleanedPrefix ? `${cleanedPrefix}；${countNote}` : countNote;
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
    roleLabel: getCreationReferenceAnalysisDisplayRoleLabel({
      role: role.value,
      roleLabel: role.label,
      subjectUnitCount,
    }),
    rolePromptLabel: role.promptLabel,
    promptInstruction: role.promptInstruction,
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
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
  const audienceStrategy = normalizeCreationAudienceStrategy(source.audienceStrategy || source.audience_strategy, { defaultSource: "analysis-suggestion" });

  return {
    summary: cleanString(source.summary || source.relationship || source.title),
    productName: cleanString(
      source.productName ||
        source.product_name ||
        source.subjectName ||
        source.subject_name ||
        source.productTitle ||
        source.product_title,
    ),
    categoryHint: cleanString(source.categoryHint || source.category_hint || source.category || source.categoryName),
    categoryPath: cleanString(source.categoryPath || source.category_path),
    visualLanguage: visualLanguage.value,
    visualLanguageLabel: visualLanguage.label,
    visualLanguageReason: getCreationReferenceAnalysisVisualLanguageReason(source),
    recommendations,
    skuSubjects,
    audienceStrategy,
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
    `Primary subject: ${primarySubject.filename} is the main visual product for every non-SKU image in this set, keeping its silhouette, proportions, colorway, materials, logos, markings, hardware, front and back structure, straps or handles, seams, and visible feature placement. This selected subject is the sole identity authority: every generated view uses this same physical product and variant, while only the requested camera, scene, layout, lighting, background, and supported copy change.`,
    hasOtherProductSubjects
      ? "Other product-subject references serve as secondary comparison or variant context around that primary subject."
      : "",
    "Supporting references contribute only their assigned role content: background, scene, dimensions, usage, material, feature, or package.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationReferenceGuidance(referenceImageRoles = []) {
  if (referenceImageRoles.length === 0) {
    return "Use any supplied reference images for product identity, material, proportions, packaging, and visual constraints.";
  }

  const roleLines = referenceImageRoles
    .map(
      (entry, index) => {
        const note = cleanString(entry.note);
        const includeNote = note && entry.role !== "dimensions" && !hasDimensionReferenceSignal(note) && !hasDimensionSpecificationValue(note);
        return `${index + 1}. ${entry.filename} = ${entry.rolePromptLabel}: ${entry.promptInstruction}${includeNote ? ` Note: ${note}.` : ""}`;
      },
    )
    .join(" ");

  return `Reference image roles: ${roleLines} ${buildCreationPrimarySubjectLock(referenceImageRoles)} Each reference influences only its listed role. Usage and feature sources serve as selling-point evidence.`;
}

function buildCreationSkuPrompt({
  skuSubject,
  skuSubjects,
  productLine,
  targetLanguage,
  platform,
  industryTemplate,
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
  let bundleInstruction = "";
  if (bundleCount > 1 && subjectUnitCount > 1) {
    const totalUnitCount = bundleCount * subjectUnitCount;
    bundleInstruction = [
      `Combination count: copy and arrange the supplied ${subjectUnitCount}-unit grouped subject into ${bundleCount} identical grouped sets, so the image shows exactly ${totalUnitCount} complete visible product units of this same subject.`,
      "Every copy keeps the same shape, proportions, colors, materials, intrinsic markings, product-surface logos or model identifiers, hooks, hardware, and visible structure as the supplied subject.",
    ].join(" ");
  } else if (bundleCount > 1) {
    bundleInstruction = [
      `Combination count: copy and arrange the supplied SKU subject into ${bundleCount} identical units, so the image shows exactly ${bundleCount} complete visible product units of this same subject.`,
      "Every copy keeps the same shape, proportions, colors, materials, intrinsic markings, product-surface logos or model identifiers, hooks, hardware, and visible structure as the supplied subject.",
    ].join(" ");
  }

  return [
    `Create one SKU product image for the distinct sellable subject: ${subjectTitle}.`,
    buildCreationSkuMainSubjectLock(skuSubject),
    buildCreationSkuSeriesConsistencyInstruction(skuSubjects),
    buildCreationSkuSubjectUnitCountInstruction(skuSubject, { bundleCount }),
    bundleInstruction,
    `Product: ${productLine}.`,
    `SKU subject reference images: ${referenceList}.`,
    skuSubject.note ? `SKU subject note: ${skuSubject.note}.` : "",
    buildCreationSkuReferenceScopeInstruction(skuGenerationRule),
    buildCreationSkuGenerationRuleInstruction({
      skuGenerationRule,
      skuSubject,
      targetLanguage,
      packageListSummary,
      dimensionSummary,
    }),
    buildCreationSkuSourceTextBoundaryInstruction(),
    buildCreationPlatformPromptInstruction(platform, industryTemplate, "sku"),
    buildCreationSkuBackgroundInstruction(visualLanguage),
    targetLanguage.promptInstruction,
    buildCreationVisualLanguageGuidance(visualLanguage),
    buildCreationSubjectContentProtectionPrompt(),
    buildCreationSkuQualityLine(visualLanguage),
    buildCreationFinalTargetLanguageBoundary(targetLanguage, "concise"),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationSkuItemDisplayName(skuSubject = {}, index = 0, targetLanguage = {}) {
  const skuIndex = index + 1;
  const colorName = formatCreationSkuItemColorNames(skuSubject, targetLanguage);
  return colorName ? `SKU image ${skuIndex} - ${colorName}` : `SKU image ${skuIndex}`;
}

function collectCreationFunctionalCoverageFacts(allocation, referenceImageRoles = []) {
  const roleCategories = ["benefit", "material", "usage", "trust"];
  const contentFacts = [
    ...selectFallbackCreationContentFacts(allocation?.descriptionFacts || [], 12, { categories: roleCategories }),
    ...selectFallbackCreationContentFacts(allocation?.sellingPointFacts || [], 12, { categories: roleCategories }),
  ];
  const referenceFacts = (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => ["usage", "material", "feature"].includes(cleanString(entry?.role)))
    .map((entry) => cleanString(entry?.note))
    .filter((note) => !hasDimensionReferenceSignal(note) && !hasDimensionSpecificationValue(note))
    .filter(Boolean);
  return uniqueCleanStrings([...contentFacts, ...referenceFacts]).slice(0, 16);
}

function buildCreationFunctionalCoverageGuidance(allocation, referenceImageRoles = []) {
  const facts = collectCreationFunctionalCoverageFacts(allocation, referenceImageRoles);
  const coverage = formatCreationContentFacts(facts);
  if (!coverage) {
    return "Function coverage: show the product's visibly supported mechanism or effect cues as the functional content of this image.";
  }
  return `Function coverage: this list is the complete functional content of the image, and every item appears: ${coverage}. When one frame cannot keep them all legible, use a seamless continuous scene stitch around the same unchanged product with blended borderless transitions.`;
}

function collectCreationHeroCoverageFacts(allocation, referenceImageRoles = []) {
  const roleCategories = ["identity", "visible-copy", "benefit", "material", "usage", "scene", "package", "trust"];
  const contentFacts = [
    ...selectFallbackCreationContentFacts(allocation?.descriptionFacts || [], 24, { categories: roleCategories }),
    ...selectFallbackCreationContentFacts(allocation?.sellingPointFacts || [], 24, { categories: roleCategories }),
  ];
  const referenceFacts = (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => cleanString(entry?.role) !== "dimensions")
    .map((entry) => cleanString(entry?.note))
    .filter((note) => !hasDimensionReferenceSignal(note) && !hasDimensionSpecificationValue(note))
    .filter(Boolean);
  return uniqueCleanStrings([...contentFacts, ...referenceFacts]).slice(0, 24);
}

function buildCreationHeroInformationCoverageGuidance(allocation, referenceImageRoles = []) {
  const facts = collectCreationHeroCoverageFacts(allocation, referenceImageRoles);
  const coverage = formatCreationContentFacts(facts, 450);
  if (!coverage) {
    return "Hero coverage: keep the hero product-first and built from the supplied product identity alone.";
  }
  return `Hero coverage: every item in this list appears in that hierarchy: ${coverage}.`;
}

function buildCreationSkuItemFilenameToken(skuSubject = {}, index = 0, targetLanguage = {}) {
  const skuIndex = index + 1;
  const colorToken = formatCreationSkuItemColorNames(skuSubject, targetLanguage)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return colorToken ? `sku-${skuIndex}-${colorToken}` : `sku-${skuIndex}`;
}

function getCreationInfographicRebuildSources(referenceImageRoles = []) {
  return (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => entry?.filename && !isCreationSubjectReferenceRole(entry?.role))
    .map((entry) => ({
      index: Number(entry.index) || 0,
      filename: cleanString(entry.filename),
      role: cleanString(entry.role) || "other",
      roleLabel: cleanString(entry.roleLabel),
      rolePromptLabel: cleanString(entry.rolePromptLabel),
      promptInstruction: cleanString(entry.promptInstruction),
      note: cleanString(entry.note),
    }))
    .filter((entry) => entry.filename);
}

function buildCreationInfographicRebuildItems({
  sources = [],
  startIndex = 0,
  targetLanguage,
} = {}) {
  return sources.map((source, index) => {
    const slotIndex = startIndex + index + 1;
    const sourceTitle = cleanString(source.roleLabel || source.rolePromptLabel || source.role || source.filename);
    return {
      itemId: `${slotIndex}-infographic-rebuild-${index + 1}`,
      slotIndex,
      role: "infographic-rebuild",
      title: `信息图重构 - ${sourceTitle}`,
      filenameToken: `infographic-${slotIndex}`,
      marketingCopyLanguage: targetLanguage.value,
      sourceInfographic: source,
      prompt: buildCreationInfographicRebuildPrompt({ targetLanguage: targetLanguage.value }),
    };
  });
}

function buildCreationTargetLanguageTextGuidance(targetLanguage) {
  const targetLabel = cleanString(targetLanguage?.label) || "the selected target language";
  return `Added canvas text uses ${targetLabel} and is unique to this image. Keep existing text on the physical product or packaging in its original language; use supplied descriptions, selling points, and reference notes as source facts, and preserve brand names, model names, numbers, and units exactly.`;
}

function buildCreationFinalTargetLanguageBoundary(targetLanguage, textPolicy = "") {
  const planningMetadataBoundary =
    "Platform, scenario, category, and visual-language labels are internal planning metadata, never artwork text.";
  if (cleanString(textPolicy).toLowerCase() === "none") {
    return `Added canvas text: none; keep existing subject-surface text as shown in its original language. ${planningMetadataBoundary}`;
  }
  const targetLabel = cleanString(targetLanguage?.label) || "the selected target language";
  return `New canvas wording outside the physical product or packaging subject uses ${targetLabel}; existing subject-surface text remains in its original language. ${planningMetadataBoundary}`;
}

function collectCreationContentFactsByCategories(allocation, categories, maxCount = 4) {
  return uniqueCleanStrings([
    ...selectCreationContentFacts(allocation.descriptionFacts, categories, maxCount),
    ...selectCreationContentFacts(allocation.sellingPointFacts, categories, maxCount),
  ]).slice(0, maxCount);
}

function buildCreationSuiteSplitGuidance(role, slotIndex, totalCount) {
  if (isCreationDimensionImageRole(role)) {
    return "Suite split: this is the set's factual verification image.";
  }
  if (role === "effect-comparison") {
    return "Suite split: this is the set's functional effect image.";
  }
  if (CREATION_ART_DIRECTED_ROLES.has(role) || CREATION_CONVERSION_ART_DIRECTED_ROLES.has(role)) {
    return "Suite split: this is a conversion image of the set.";
  }
  return "";
}

function buildCreationCandidatePoolGuidance() {
  return "";
}

function buildCreationConversionIntentGuidance(intent = {}) {
  const audienceFocus = cleanString(intent.audienceFocus);
  const motivationFocus = cleanString(intent.motivationFocus);
  const objectionFocus = cleanString(intent.objectionFocus);
  const conversionGoal = cleanString(intent.conversionGoal);
  if (!audienceFocus && !motivationFocus && !objectionFocus && !conversionGoal) return "";
  return [
    conversionGoal ? `Conversion intent: ${conversionGoal}` : "Conversion intent:",
    objectionFocus ? `, easing this uncertainty: ${objectionFocus}` : "",
    ", from the supplied evidence.",
  ].filter(Boolean).join("").replace(/^Conversion intent:, /, "Conversion intent: ");
}

function replaceCreationConversionIntentGuidance(prompt, intent = {}) {
  const basePrompt = cleanString(prompt)
    .replace(
      /\s*(?:CONVERSION INTENT:[\s\S]*?Do not invent performance, certifications, prices, sales, guarantees, reviews, testimonials, ratings, or outcomes\.|Conversion intent:[\s\S]*?reference-image evidence\.)/giu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return [basePrompt, buildCreationConversionIntentGuidance(intent)].filter(Boolean).join(" ");
}

function buildCreationAppendedConversionIntent(role, index, strategy = {}) {
  const motivations = Array.isArray(strategy.purchaseMotivations) ? strategy.purchaseMotivations : [];
  const objections = Array.isArray(strategy.purchaseObjections) ? strategy.purchaseObjections : [];
  const evidence = Array.isArray(strategy.evidenceBasis) ? strategy.evidenceBasis : [];
  let conversionGoal = "answer a distinct buyer decision question with supplied evidence";
  if (role === "sku") conversionGoal = "reduce variant and product-choice uncertainty";
  else if (role === "infographic-rebuild") conversionGoal = "preserve source facts while making the decision evidence easier to understand";
  else if (role === "hero") conversionGoal = "create instant product recognition and connect it to the primary purchase motivation";
  else if (["benefit", "usage-suggestion", "effect-comparison"].includes(role)) conversionGoal = "turn supplied product evidence into a clear buyer outcome";
  else if (["scene", "atmosphere", "human-handheld", "human-wearable"].includes(role)) conversionGoal = "help the buyer imagine a believable ownership or use moment";
  else if (["size-capacity-fit", "spec-table", "multi-angle", "product-detail", "ingredient-material", "craft-process"].includes(role)) conversionGoal = "reduce product, fit, specification, or quality uncertainty with factual evidence";
  else if (["series-showcase", "accessory-gift"].includes(role)) conversionGoal = "reduce choice and package-completeness uncertainty";
  return {
    audienceFocus: cleanString(strategy.targetAudience) || "buyers evaluating this product category",
    motivationFocus: motivations[index % Math.max(motivations.length, 1)] || "make a confident product choice",
    objectionFocus: objections[index % Math.max(objections.length, 1)] || "unclear product fit",
    conversionGoal,
    evidenceFocus: evidence[index % Math.max(evidence.length, 1)] || "use only supplied product and reference evidence",
  };
}

function collectCreationUsageReferenceFacts(referenceImageRoles = [], maxCount = 4) {
  return uniqueCleanStrings(
    referenceImageRoles
      .filter((entry) => entry.role === "usage" || CREATION_CHARGING_SIGNAL_RE.test(entry.note))
      .map((entry) => entry.note),
  ).slice(0, maxCount);
}

function buildCreationUseSceneOpportunityInstruction(role, allocation, referenceImageRoles = []) {
  const usageFacts = [
    ...collectCreationContentFactsByCategories(allocation, ["usage", "scene"], 5),
    ...collectCreationUsageReferenceFacts(referenceImageRoles, 4),
  ];
  const chargingFacts = uniqueCleanStrings(usageFacts.filter((fact) => CREATION_CHARGING_SIGNAL_RE.test(fact)));
  const chargingCue = formatCreationContentFacts(chargingFacts);
  if (!chargingCue) {
    return "";
  }

  if (role === "scene") {
    return `Scene opportunity: include one concrete charging or cable-connection moment such as plugged-in desktop use, bedside charging, power-bank recharge, or ready-to-use battery context. Source usage cues: ${chargingCue}.`;
  }
  if (role === "usage-suggestion") {
    return `Selling-point opportunity: present charging and connection ease as evidence, linking cable or port orientation, safe connection, supplied charging duration, or ready-to-use state to a buyer payoff. Source usage cues: ${chargingCue}.`;
  }
  if (role === "atmosphere") {
    return `Atmosphere opportunity: use the rechargeable or connected-use cues to build desire around a ready, convenient lifestyle moment. Source usage cues: ${chargingCue}.`;
  }
  return "";
}

function getCreationItemRoleDefinition(roleValue = "") {
  const normalized = cleanString(roleValue);
  return CREATION_ITEM_ROLES.find((role) => role.role === normalized) || null;
}

function getCreationCoverageTargetRoles(sourceRole = "") {
  return CREATION_REFERENCE_COVERAGE_ROLE_TARGETS[cleanString(sourceRole)] || [];
}

function getCreationCoverageReferenceSources(referenceImageRoles = []) {
  return (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => getCreationCoverageTargetRoles(entry?.role).length > 0)
    .map((entry) => ({
      index: Number(entry.index) || 0,
      filename: cleanString(entry.filename),
      role: cleanString(entry.role),
      roleLabel: cleanString(entry.roleLabel),
      rolePromptLabel: cleanString(entry.rolePromptLabel),
      promptInstruction: cleanString(entry.promptInstruction),
      note: cleanString(entry.note),
    }))
    .filter((entry) => entry.filename);
}

function findCreationCoverageReplacementIndex(roleValues = [], protectedRoles = new Set()) {
  for (const role of CREATION_COVERAGE_REPLACEMENT_PRIORITY) {
    const index = roleValues.findIndex((value) => value === role && !protectedRoles.has(value));
    if (index >= 0) {
      return index;
    }
  }

  for (let index = roleValues.length - 1; index >= 0; index -= 1) {
    const role = roleValues[index];
    if (role && !protectedRoles.has(role)) {
      return index;
    }
  }

  return -1;
}

function applyCreationReferenceCoverageRolePlan(plannedRoles = [], referenceImageRoles = []) {
  const roleValues = plannedRoles.map((role) => role.role).filter(Boolean);
  const requiredSourceRoles = [
    ...new Set(
      getCreationCoverageReferenceSources(referenceImageRoles)
        .map((source) => source.role)
        .filter((role) => CREATION_REQUIRED_REFERENCE_COVERAGE_ROLES.has(role)),
    ),
  ];
  const protectedRoles = new Set(["hero"]);

  requiredSourceRoles.forEach((sourceRole) => {
    const targetRoles = getCreationCoverageTargetRoles(sourceRole);
    if (targetRoles.some((role) => roleValues.includes(role))) {
      return;
    }

    const preferredRole = targetRoles.find((role) => getCreationItemRoleDefinition(role));
    if (!preferredRole || roleValues.includes(preferredRole)) {
      return;
    }

    const replacementIndex = findCreationCoverageReplacementIndex(roleValues, protectedRoles);
    if (replacementIndex >= 0) {
      roleValues[replacementIndex] = preferredRole;
    }
  });

  return roleValues.map(getCreationItemRoleDefinition).filter(Boolean);
}

function buildCreationReferenceCoveragePlan(plannedRoles = [], referenceImageRoles = []) {
  const roleSet = new Set(plannedRoles.map((role) => role.role));
  const coverageByRole = new Map(plannedRoles.map((role) => [role.role, []]));
  const unassignedSources = [];

  getCreationCoverageReferenceSources(referenceImageRoles).forEach((source) => {
    const targetRoles = getCreationCoverageTargetRoles(source.role).filter((role) => roleSet.has(role));
    if (targetRoles.length === 0) {
      unassignedSources.push(source);
      return;
    }

    targetRoles.forEach((role) => {
      coverageByRole.get(role)?.push(source);
    });
  });

  return { coverageByRole, unassignedSources };
}

function formatCreationReferenceCoverageSource(source = {}, options = {}) {
  const filename = cleanString(source.filename);
  const label = cleanString(source.rolePromptLabel || source.roleLabel || source.role || "supporting reference");
  const role = cleanString(source.role);
  const rawNote = cleanString(source.note);
  const note =
    role === "dimensions" && cleanString(options.dimensionSpecSummary)
      ? "dimension values are carried by the dedicated specification line above"
      : role === "package" && (hasDimensionReferenceSignal(rawNote) || hasDimensionSpecificationValue(rawNote))
        ? "package/list content reference; ignore size, weight, hook, or specification values for this non-dimension role"
        : rawNote;
  const roleText = [role, label].filter(Boolean).join(" / ");
  return `${filename}${roleText ? ` (${roleText})` : ""}${note ? `: ${note}` : ""}`;
}

function buildCreationReferenceCoverageSummary(sources = [], options = {}) {
  if (!sources.length) {
    return "";
  }
  return `Carries reference coverage: ${sources.map((source) => formatCreationReferenceCoverageSource(source, options)).join("; ")}.`;
}

function buildCreationReferenceCoverageWarnings(role = "", sources = [], coveragePlan = {}) {
  const warnings = [];
  const roleValue = cleanString(role);
  if (!sources.length && Array.isArray(coveragePlan.unassignedSources)) {
    const missed = coveragePlan.unassignedSources.filter((source) =>
      getCreationCoverageTargetRoles(source.role).includes(roleValue),
    );
    if (missed.length > 0) {
      warnings.push(`No available ${roleValue} slot could carry ${missed.map((source) => source.filename).join(", ")}.`);
    }
  }
  return warnings;
}

function buildCreationReferenceCoverageSourceInstruction(source = {}) {
  const role = cleanString(source.role);
  const filename = cleanString(source.filename);
  if (role === "scene") {
    return `Scene source ${filename} is a visual blueprint: reconstruct its environment, user action, product placement, camera angle, scale, and spatial relationships faithfully, then recompose around the current product and selected visual language. Its note only identifies the source to follow.`;
  }
  if (role === "usage") {
    return `Usage source ${filename} is selling-point evidence: draw on its supplied setup, operation, charging, connection, care, or mistake-prevention facts to support ease, readiness, convenience, or buyer payoff. Its note only identifies the source to follow.`;
  }
  return "";
}

function buildCreationReferenceCoveragePromptInstruction(sources = [], options = {}) {
  if (!sources.length) {
    return "";
  }

  const sourceLines = sources
    .map((source, index) => `${index + 1}. ${formatCreationReferenceCoverageSource(source, options)}`)
    .join(" ");
  const hasVisualBlueprintSources = sources.some((source) =>
    CREATION_VISUAL_BLUEPRINT_REFERENCE_ROLES.has(cleanString(source.role)),
  );
  const sourceInstructions = sources.map(buildCreationReferenceCoverageSourceInstruction).filter(Boolean).join(" ");
  return [
    "Reference coverage:",
    hasVisualBlueprintSources
      ? "the attached source images are this item's visual evidence, and each filename, role, and note serves to identify which source to follow."
      : "this item carries the assigned source content that matches its image role.",
    sourceInstructions,
    `Assigned sources: ${sourceLines}.`,
  ].join(" ");
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

function getCreationEffectivePlanByteLength(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? {});
  return new TextEncoder().encode(text).byteLength;
}

function hasCreationBlockingConstraints(value = {}) {
  return Array.isArray(value.constraints) && value.constraints.some((constraint) => constraint.level === "blocking");
}

function getCreationSubmittedCanonicalSlot(profile = {}, item = {}, index = 0) {
  if (cleanString(item.itemKind) !== "carousel") return null;
  const slots = Array.isArray(profile.slots) ? profile.slots : [];
  const explicitSlot = slots.find((slot) => slot.slotKey === cleanString(item.slotKey || item.itemId));
  if (hasCreationBlockingConstraints(explicitSlot)) return explicitSlot;
  const positionalSlot = slots[index];
  return hasCreationBlockingConstraints(positionalSlot) ? positionalSlot : null;
}

function normalizeCreationSubmittedEffectiveAudienceStrategy(value, profile = {}) {
  const normalized = normalizeCreationAudienceStrategy(value, { defaultSource: "platform-default" });
  if (Object.keys(normalized).length === 0) return null;
  const rawProvenance = value?.provenance && typeof value.provenance === "object" && !Array.isArray(value.provenance) ? value.provenance : {};
  const provenance = {};
  for (const field of ["targetAudience", "purchaseMotivations", "purchaseObjections", "desiredOutcome", "evidenceBasis"]) if (cleanString(rawProvenance[field])) provenance[field] = cleanString(rawProvenance[field]);
  return { ...normalized, marketingContext: structuredClone(profile.marketingContext || {}), provenance };
}

function creationConversionIntentWasSanitized(value = {}, normalized = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return [["audienceFocus", "audience_focus"], ["motivationFocus", "motivation_focus"], ["objectionFocus", "objection_focus"], ["conversionGoal", "conversion_goal"], ["evidenceFocus", "evidence_focus"]].some(([camel, snake]) => cleanString(source[camel] || source[snake]) !== cleanString(normalized?.[camel]));
}

function parseCreationEffectivePlanSnapshot(value, input = {}) {
  if (!hasCreationInputValue(value)) return null;
  if (getCreationEffectivePlanByteLength(value) > MAX_CREATION_EFFECTIVE_PLAN_BYTES) {
    throw new Error("提交的冻结计划过大，请重新生成套图计划后再试。");
  }
  let source = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch (_error) {
      throw new Error("提交的冻结计划不是有效 JSON。");
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("提交的冻结计划格式无效。");
  }
  const normalizedPlatform = normalizeCreationPlatform(source.platform || source.platformPolicyId || source.platform_policy_id || input.platform || DEFAULT_CREATION_PLATFORM);
  const canonicalProfile = getCreationPlatformProfile(normalizedPlatform.value);
  const sourceItems = Array.isArray(source.items) ? source.items : [];
  if (sourceItems.length === 0 || sourceItems.length > MAX_CREATION_EFFECTIVE_PLAN_ITEMS) {
    throw new Error(`提交的冻结计划项数量必须在 1 到 ${MAX_CREATION_EFFECTIVE_PLAN_ITEMS} 之间。`);
  }
  const items = sourceItems.map((rawItem, index) => {
    const item = rawItem && typeof rawItem === "object" && !Array.isArray(rawItem) ? structuredClone(rawItem) : {};
    const requiredTextFields = ["itemId", "prompt", "ratio", "resolutionTier", "targetLanguage"];
    for (const field of requiredTextFields) {
      if (!cleanString(item[field])) {
        throw new Error(`冻结计划项 ${index + 1} 缺少 ${field}。`);
      }
      item[field] = cleanString(item[field]);
    }
    item.slotIndex = index + 1;
    item.itemKind = cleanString(item.itemKind) || "carousel";
    item.enabled = true;
    delete item.effectivePlan;
    delete item.effective_plan;
    const rawConversionIntent = item.conversionIntent || item.conversion_intent;
    const conversionIntent = normalizeCreationConversionIntent(rawConversionIntent);
    const conversionIntentChanged = creationConversionIntentWasSanitized(rawConversionIntent, conversionIntent);
    delete item.conversion_intent;
    if (conversionIntent) {
      item.conversionIntent = conversionIntent;
      if (conversionIntentChanged) item.prompt = replaceCreationConversionIntentGuidance(item.prompt, conversionIntent);
    } else {
      delete item.conversionIntent;
      if (conversionIntentChanged) item.prompt = replaceCreationConversionIntentGuidance(item.prompt);
    }
    const canonicalSlot = getCreationSubmittedCanonicalSlot(canonicalProfile, item, index);
    if (canonicalSlot) {
      item.slotKey = canonicalSlot.slotKey;
      item.imageType = canonicalSlot.imageType;
      item.imageTypeLabel = canonicalSlot.imageTypeLabel;
      item.role = canonicalSlot.role;
      item.required = canonicalSlot.required;
      item.advisory = canonicalSlot.advisory;
      item.constraints = structuredClone(canonicalSlot.constraints || []);
      item.sourceIds = structuredClone(canonicalSlot.sourceIds || []);
    } else {
      const imageTypeDefinition = getCreationPlatformImageType(item.imageType);
      item.constraints = imageTypeDefinition ? structuredClone(imageTypeDefinition.constraints || []) : [];
    }
    return item;
  });
  const validation = validateCreationPlatformPlan({ items });
  const carouselImageCount = items.filter((item) => item.itemKind === "carousel").length;
  const skuImageCount = items.filter((item) => item.itemKind === "sku").length;
  const infographicRebuildCount = items.filter((item) => item.itemKind === "infographic-rebuild").length;
  const warnings = Array.isArray(source.warnings) ? structuredClone(source.warnings) : [];
  const sanitizedSource = structuredClone(source);
  delete sanitizedSource.effectivePlan;
  delete sanitizedSource.effective_plan;
  delete sanitizedSource.audience_strategy;
  delete sanitizedSource.effective_audience_strategy;
  const audienceStrategy = normalizeCreationAudienceStrategy(source.audienceStrategy || source.audience_strategy, { defaultSource: "user" });
  const effectiveAudienceStrategy = normalizeCreationSubmittedEffectiveAudienceStrategy(source.effectiveAudienceStrategy || source.effective_audience_strategy, canonicalProfile);
  return {
    ...sanitizedSource,
    platform: canonicalProfile.id,
    platformLabel: canonicalProfile.label,
    platformPolicyId: canonicalProfile.id,
    platformProfile: canonicalProfile,
    platformEvidenceLevel: canonicalProfile.evidenceLevel,
    strategyVersion: canonicalProfile.strategyVersion,
    strategyVerifiedAt: canonicalProfile.verifiedAt,
    platformSourceIds: structuredClone(canonicalProfile.sourceIds || []),
    ...(Object.keys(audienceStrategy).length > 0 ? { audienceStrategy } : {}),
    ...(effectiveAudienceStrategy ? { effectiveAudienceStrategy } : {}),
    items,
    imageCount: carouselImageCount,
    carouselImageCount,
    skuImageCount,
    infographicRebuildCount,
    totalPlannedItemCount: items.length,
    selectedRoles: items.filter((item) => item.itemKind === "carousel").map((item) => cleanString(item.role)).filter(Boolean),
    validation: { ...validation, warnings },
    warnings,
    errors: validation.errors,
    canGenerate: validation.isValid,
  };
}

export function buildCreationSubmittedPlan(input = {}) {
  const snapshot = parseCreationEffectivePlanSnapshot(input.effectivePlan || input.effective_plan, input);
  const plan = snapshot || buildCreationPlan(input);
  return applyCreationPlanOverrides(plan, input.planOverrides || input.promptOverrides || []);
}

export function assertCreationPlanCanGenerate(plan = {}) {
  if (plan?.canGenerate !== false && plan?.validation?.isValid !== false) {
    return plan;
  }

  const issues = [
    ...(Array.isArray(plan?.errors) ? plan.errors : []),
    ...(Array.isArray(plan?.validation?.errors) ? plan.validation.errors : []),
  ];
  const blockingMessage = issues
    .map((issue) => cleanString(typeof issue === "string" ? issue : issue?.message))
    .find(Boolean);

  throw new Error(blockingMessage || "当前套图计划包含平台硬规则冲突，请先修正后再生成。");
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

  const nextPlan = {
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

  const hasPlatformValidation =
    plan.validation !== undefined || plan.canGenerate !== undefined || Array.isArray(plan.errors);
  if (!hasPlatformValidation) {
    return nextPlan;
  }

  const validation = validateCreationPlatformPlan({ items: nextPlan.items });
  const warnings = Array.isArray(plan.validation?.warnings)
    ? plan.validation.warnings
    : Array.isArray(plan.warnings)
      ? plan.warnings
      : [];
  return {
    ...nextPlan,
    validation: { ...validation, warnings },
    errors: validation.errors,
    canGenerate: validation.isValid,
  };
}

function hasCreationInputValue(value) {
  return value !== undefined && value !== null && cleanString(value) !== "";
}

function parseCreationPlatformPlanningJson(value, fallback) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function buildCreationPlatformSetOverrides(input = {}) {
  const overrides = normalizeCreationPlatformSetOverrides(input.platformSetOverrides ?? input.setOverrides ?? {});
  if (hasCreationInputValue(input.imageCount)) {
    overrides.imageCount = normalizeCreationImageCount(input.imageCount);
  }
  if (hasCreationInputValue(input.targetLanguage)) {
    overrides.targetLanguage = normalizeCreationTargetLanguage(input.targetLanguage).value;
  }
  if (hasCreationInputValue(input.ratio)) {
    overrides.ratio = cleanString(input.ratio);
  }
  if (hasCreationInputValue(input.resolutionTier ?? input.resolution_tier)) {
    overrides.resolutionTier = cleanString(input.resolutionTier ?? input.resolution_tier);
  }
  if (hasCreationInputValue(input.visualLanguage ?? input.visual_language)) {
    overrides.visualLanguage = normalizeCreationVisualLanguage(input.visualLanguage ?? input.visual_language).value;
  }
  return overrides;
}

function buildCreationPlatformItemOverrides(input = {}, profile = {}, selectedRoles = [], { setTargetLanguageExplicit = false } = {}) {
  const bySlotKey = new Map();
  if (selectedRoles.length > 0) {
    selectedRoles.forEach((role, index) => {
      const slotKey = profile.slots?.[index]?.slotKey;
      if (slotKey) bySlotKey.set(slotKey, { slotKey, role: role.role });
    });
  }
  for (const override of normalizeCreationPlatformItemOverrides(input.platformItemOverrides ?? input.itemOverrides ?? [])) {
    const normalizedOverride = setTargetLanguageExplicit
      ? Object.fromEntries(Object.entries(override).filter(([field]) => field !== "targetLanguage"))
      : override;
    if (Object.keys(normalizedOverride).length <= 1) continue;
    bySlotKey.set(normalizedOverride.slotKey, { ...(bySlotKey.get(normalizedOverride.slotKey) || {}), ...normalizedOverride });
  }
  return [...bySlotKey.values()];
}

function getCreationPlatformRoleDefinition(roleValue) {
  const normalizedRole = cleanString(roleValue);
  return (
    CREATION_ITEM_ROLES.find((entry) => entry.role === normalizedRole) || {
      role: normalizedRole || "product-detail",
      title: normalizedRole || "商品图",
      filenameToken: normalizedRole || "product",
      brief: "a platform-planned ecommerce product image",
    }
  );
}

function getCreationPlatformSlotTitle(slot = {}, role = {}, platformId = "") {
  if (cleanString(platformId) === "universal" && slot.imageType !== "custom") {
    return role.title || getCreationPlatformRoleDefinition(slot.role).title;
  }
  return slot.imageType === "custom"
    ? `${role.title || getCreationPlatformRoleDefinition(slot.role).title}（自定义）`
    : slot.imageTypeLabel || role.title || getCreationPlatformRoleDefinition(slot.role).title;
}

function isCreationPlatformPolicyDominantSlot(slot = {}) {
  return (
    slot.textPolicy === "none" ||
    slot.logoPolicy === "forbid-overlay" ||
    ["studio-white", "transparent"].includes(slot.scenePolicy) ||
    (Array.isArray(slot.constraints) && slot.constraints.some((constraint) => constraint.level === "blocking"))
  );
}

function buildCreationPlatformItemPolicyGuidance(platformPlan = {}, slot = {}) {
  const guidance = [
    `Platform gallery strategy: ${platformPlan.profile?.promptInstruction || "Use the selected platform profile as the gallery planning source."}`,
    `Platform image type: ${slot.imageTypeLabel || slot.imageType}.`,
    `Composition policy: ${slot.composition}. Text policy: ${slot.textPolicy}. Scene policy: ${slot.scenePolicy}. Logo policy: ${slot.logoPolicy}.`,
    "Build every visible dimension, material, package content, condition, and claim from the supplied product input and attached reference evidence.",
  ];
  if (slot.textPolicy === "none") {
    guidance.push("Keep this image free of added visible text and marketing copy.");
  }
  if (slot.logoPolicy === "forbid-overlay") {
    guidance.push(
      "Branding stays limited to the identifiers already printed on the supplied product, which remain part of its identity.",
    );
  }
  if (Array.isArray(slot.constraints) && slot.constraints.some((constraint) => constraint.level === "blocking")) {
    guidance.push(
      "Keep the frame to the product itself: no added marketing copy, badges, collage panels, or scene insets, and accessories only where the supplied evidence confirms they are included.",
    );
  }
  if (platformPlan.platform === "xiaohongshu") {
    guidance.push("Keep reviews, engagement metrics, endorsements, and user testimony out of the image.");
  }
  return guidance.filter(Boolean).join(" ");
}

export function buildCreationPlan(input = {}) {
  const productName = cleanString(input.productName);
  const productDescription = cleanString(input.productDescription);
  const sellingPoints = normalizeSellingPoints(input.sellingPoints);
  const dimensionSpecs = cleanString(input.dimensionSpecs);
  const dimensionUnitMode = normalizeCreationDimensionUnitMode(input.dimensionUnitMode);
  const requestedPlatformValue = input.platform ?? input.creationPlatform ?? input.ecommercePlatform ?? input.platform_id;
  const hasExplicitPlatform = hasCreationInputValue(requestedPlatformValue);
  const legacyPlanningMode =
    !hasExplicitPlatform &&
    !hasCreationInputValue(input.platformSetOverrides) &&
    !hasCreationInputValue(input.platformItemOverrides);
  const platform = normalizeCreationPlatform(requestedPlatformValue);
  const platformProfile = getCreationPlatformProfile(platform.value);
  const platformSetOverrides = buildCreationPlatformSetOverrides(input);
  const setTargetLanguageExplicit =
    hasCreationInputValue(input.targetLanguage) ||
    hasCreationInputValue(platformSetOverrides.targetLanguage);
  const referenceImageRoles = normalizeCreationReferenceRoles(input.referenceImageRoles);
  const legacyImageCount = normalizeCreationImageCount(input.imageCount);
  const selectedRoles = (legacyPlanningMode ? legacyImageCount : platformSetOverrides.imageCount) === 0
    ? []
    : normalizeCreationSelectedRoles(input.selectedRoles);
  if (selectedRoles.length > 0) {
    platformSetOverrides.imageCount = selectedRoles.length;
  }
  const targetLanguage = normalizeCreationTargetLanguage(platformSetOverrides.targetLanguage || platformProfile.targetLanguage);
  const inputDimensionSpecLines = buildDimensionSpecLinesFromText(
    dimensionSpecs,
    dimensionUnitMode.value,
    targetLanguage.value,
  );
  const referenceDimensionSpecLines =
    inputDimensionSpecLines.length > 0
      ? []
      : buildReferenceDimensionSpecLines(referenceImageRoles, dimensionUnitMode.value, targetLanguage.value);
  const allReferenceDimensionSpecGroups = buildReferenceDimensionSpecGroups(
    referenceImageRoles,
    dimensionUnitMode.value,
    targetLanguage.value,
  );
  const referenceDimensionSpecGroups = inputDimensionSpecLines.length > 0
    ? allReferenceDimensionSpecGroups.filter((group) => group.hasStructuredSource)
    : allReferenceDimensionSpecGroups;
  const dimensionSpecLines = inputDimensionSpecLines.length > 0 ? inputDimensionSpecLines : referenceDimensionSpecLines;
  const dimensionSpecSource = inputDimensionSpecLines.length > 0 ? "input" : referenceDimensionSpecLines.length > 0 ? "reference" : "";
  const dimensionSpecSummary = dimensionSpecLines.length > 0 ? dimensionSpecLines.map(trimTerminalSentencePunctuation).join(" / ") : "";
  const keyDimensionSpecLines = selectCreationKeySpecLines(dimensionSpecLines);
  const keyDimensionSpecSummary = keyDimensionSpecLines.length > 0
    ? keyDimensionSpecLines.map(trimTerminalSentencePunctuation).join(" / ")
    : "";
  const groupedDimensionSpecSummary = referenceDimensionSpecGroups.length > 1
    ? formatCreationDimensionSpecGroups(referenceDimensionSpecGroups)
    : "";
  const groupedKeyDimensionSpecSummary = referenceDimensionSpecGroups.length > 1
    ? formatCreationDimensionSpecGroups(referenceDimensionSpecGroups, { keyOnly: true })
    : "";
  const effectiveDimensionSpecs = dimensionSpecLines.join("\n");
  const hasReservedDimensionSpecs =
    Boolean(dimensionSpecSummary) ||
    referenceImageRoles.some((entry) => entry.role === "dimensions" || hasDimensionReferenceSignal(entry.note) || hasDimensionSpecificationValue(entry.note));
  const scenario = normalizeCreationScenario(input.scenario);
  const visualLanguage = normalizeCreationVisualLanguage(
    platformSetOverrides.visualLanguage || input.visualLanguage || input.visual_language,
  );
  const industryTemplate = normalizeCreationIndustryTemplate(input.industryTemplate);
  const skuSubjectInput = input.skuSubjects ?? input.sku_subjects;
  const skuBundleCount = normalizeCreationSkuBundleCount(input.skuBundleCount ?? input.sku_bundle_count);
  const skuGenerationRule = normalizeCreationSkuGenerationRule(input.skuGenerationRule ?? input.sku_generation_rule);
  const skuGenerationEnabled = normalizeDefaultEnabledBoolean(
    input.skuGenerationEnabled ?? input.sku_generation_enabled,
    true,
  );
  const infographicRebuildEnabled =
    (legacyPlanningMode ? legacyImageCount : platformSetOverrides.imageCount) === 0 ? true : normalizeDefaultEnabledBoolean(
    input.infographicRebuildEnabled ?? input.infographic_rebuild_enabled,
    false,
  );
  const normalizedSkuSubjects =
    skuSubjectInput === undefined || skuSubjectInput === null
      ? []
      : normalizeCreationSkuSubjects(skuSubjectInput, referenceImageRoles);
  const skuSubjects = normalizedSkuSubjects.map((subject) => ({
    ...subject,
    bundleCount: normalizeCreationSkuBundleCount(subject.bundleCount, skuBundleCount),
  }));
  const logoOptions = normalizeCreationLogoOptions(input.logoOptions || input.logo);
  const infographicRebuildSources = infographicRebuildEnabled ? getCreationInfographicRebuildSources(referenceImageRoles) : [];
  const platformItemOverrides = buildCreationPlatformItemOverrides(input, platformProfile, selectedRoles, {
    setTargetLanguageExplicit,
  });
  const audienceStrategy = normalizeCreationAudienceStrategy(input.audienceStrategy || input.audience_strategy, { defaultSource: "user" });
  const platformPlan = resolveCreationPlatformPlan({
    platform: hasExplicitPlatform ? requestedPlatformValue : platform.value,
    category: input.category || industryTemplate,
    categorySignals: parseCreationPlatformPlanningJson(input.categorySignals, []),
    referenceCoverage: parseCreationPlatformPlanningJson(
      input.platformReferenceCoverage ?? input.referenceCoverage,
      referenceImageRoles,
    ),
    referenceAnalysis: parseCreationPlatformPlanningJson(input.referenceAnalysis, null),
    evidence: parseCreationPlatformPlanningJson(input.platformEvidence ?? input.evidence, {}),
    skuSubjects,
    setOverrides: platformSetOverrides,
    itemOverrides: platformItemOverrides,
    selectedRoles: selectedRoles.map((role) => role.role),
    audienceStrategy,
    infographicRebuildCount: infographicRebuildSources.length,
  });
  let plannedRoles;
  if (legacyPlanningMode) {
    const industryPresetRoles = getCreationIndustryRolePreset(industryTemplate.value);
    const industryPresetRoleSet = new Set(industryPresetRoles.map((role) => role.role));
    const defaultRoles =
      industryPresetRoles.length > 0
        ? [...industryPresetRoles, ...CREATION_ITEM_ROLES.filter((role) => !industryPresetRoleSet.has(role.role))]
        : CREATION_ITEM_ROLES;
    const basePlannedRoles = selectedRoles.length > 0 ? selectedRoles : defaultRoles.slice(0, legacyImageCount);
    plannedRoles = applyCreationReferenceCoverageRolePlan(basePlannedRoles, referenceImageRoles).map((role, index) => ({
      ...role,
      platformSlot: {
        slotKey: `${index + 1}-${role.role}`,
        itemId: `${index + 1}-${role.role}`,
        itemKind: "carousel",
        imageType: role.role,
        imageTypeLabel: role.title,
        role: role.role,
        ratio: platformSetOverrides.ratio || "1:1",
        resolutionTier: platformSetOverrides.resolutionTier || "1K",
        targetLanguage: targetLanguage.value,
        composition: "role-default",
        textPolicy: "concise",
        scenePolicy: "role-default",
        logoPolicy: "allow-supplied",
        constraints: [],
        enabled: true,
        recommendationSource: "legacy-universal",
        legacyPlanning: true,
      },
    }));
  } else {
    plannedRoles = platformPlan.items.map((slot) => ({
      ...getCreationPlatformRoleDefinition(slot.role),
      role: slot.role,
      platformSlot: slot,
    }));
  }
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
  const contentCategoryBudget = buildCreationContentCategoryBudget(plannedRoles);
  const skuPackageListSummary = buildCreationSkuPackageListSummary(contentAllocation, referenceImageRoles);
  const skuSupportingReferenceRoles = getCreationSkuSupportingReferenceRoles(skuGenerationRule);
  const referenceCoveragePlan = buildCreationReferenceCoveragePlan(plannedRoles, referenceImageRoles);
  const appendedItemRatio = platformSetOverrides.ratio || platformProfile.defaultRatio;
  const appendedItemResolutionTier = platformSetOverrides.resolutionTier || platformProfile.resolutionTier;
  const appendedItemLogoPolicy = platformSetOverrides.logoPolicy || "allow-supplied";
  const effectiveAudienceStrategy = platformPlan.effectiveAudienceStrategy;

  const carouselItems = plannedRoles.map((role, index) => {
    const platformSlot = role.platformSlot;
    const conversionIntent = platformSlot.conversionIntent || buildCreationAppendedConversionIntent(role.role, index, effectiveAudienceStrategy);
    const itemTargetLanguage = normalizeCreationTargetLanguage(platformSlot.targetLanguage || targetLanguage.value);
    const platformPolicyDominant = !platformSlot.legacyPlanning && isCreationPlatformPolicyDominantSlot(platformSlot);
    const platformNativeSlot =
      platformPlan.platform !== "universal" && !platformSlot.legacyPlanning && platformSlot.imageType !== "custom";
    const coverageSources = referenceCoveragePlan.coverageByRole.get(role.role) || [];
    const coverageSummary = buildCreationReferenceCoverageSummary(coverageSources, { dimensionSpecSummary });
    const coverageWarnings = buildCreationReferenceCoverageWarnings(role.role, coverageSources, referenceCoveragePlan);
    const sourceFocus = buildCreationRoleSourceFocus({
      role: role.role,
      allocation: contentAllocation,
      descriptionLine,
      sellingPointLine,
      sellingPoints,
      categoryBudget: contentCategoryBudget,
    });
    const isDimensionRole = isCreationDimensionImageRole(role.role);
    const shouldReserveDimensionSourceText = isDimensionRole && Boolean(dimensionSpecSummary);
    const roleGuidance = platformPolicyDominant
      ? role.role === "effect-comparison"
        ? [getCreationRoleDirective(role.role, productLine)]
        : []
      : [
          getCreationRoleDirective(role.role, productLine),
          buildCreationScenarioPromptInstruction(scenario, role.role),
          getCreationIndustryTemplateRoleInstruction(industryTemplate, role.role),
          buildCreationVisualLanguageGuidance(visualLanguage),
        ];
    const generatedPrompt = [
      platformNativeSlot
        ? `Create ${platformPlan.platformLabel} ${platformSlot.imageTypeLabel || platformSlot.imageType} as a platform-native gallery asset.`
        : `Create ${role.brief}.`,
      `Product: ${productLine}.`,
      platformSlot.legacyPlanning ? "" : buildCreationPlatformItemPolicyGuidance(platformPlan, platformSlot),
      role.role !== "hero" && sourceFocus.description && !shouldReserveDimensionSourceText
        ? `Description: ${sourceFocus.description}.`
        : "",
      role.role !== "hero" && sourceFocus.selling && !shouldReserveDimensionSourceText
        ? `Selling points: ${sourceFocus.selling}.`
        : "",
      isDimensionRole
        ? buildCreationDimensionPromptInstruction({
            dimensionSpecSummary:
              role.role === "spec-table"
                ? groupedKeyDimensionSpecSummary || keyDimensionSpecSummary
                : groupedDimensionSpecSummary || dimensionSpecSummary,
            dimensionSpecGroups: referenceDimensionSpecGroups,
            dimensionUnitMode,
            source: dimensionSpecSource,
            role: role.role,
          })
        : "",
      !isDimensionRole ? buildCreationNonDimensionSpecBoundaryInstruction(hasReservedDimensionSpecs) : "",
      buildCreationSuiteSplitGuidance(role.role, index + 1, effectiveImageCount),
      role.role === "hero" && !platformPolicyDominant
        ? buildCreationHeroInformationCoverageGuidance(contentAllocation, referenceImageRoles)
        : "",
      role.role === "effect-comparison" ? buildCreationFunctionalCoverageGuidance(contentAllocation, referenceImageRoles) : "",
      platformPolicyDominant ? "" : buildCreationUseSceneOpportunityInstruction(role.role, contentAllocation, referenceImageRoles),
      buildCreationReferenceCoveragePromptInstruction(coverageSources, { dimensionSpecSummary }),
      platformPolicyDominant ? "" : buildCreationConversionIntentGuidance(conversionIntent),
      ...roleGuidance,
      buildCreationPlatformPromptInstruction(platform, industryTemplate, role.role),
      industryTemplate.promptInstruction,
      platformSlot.textPolicy === "none" ? "" : itemTargetLanguage.promptInstruction,
      platformSlot.textPolicy === "none" ? "" : buildCreationTargetLanguageTextGuidance(itemTargetLanguage),
      referenceImageRoles.length > 0 ? buildCreationReferenceGuidance(referenceImageRoles) : "",
      buildCreationSubjectContentProtectionPrompt(),
      platformPolicyDominant ? "" : buildCreationVisualLanguageQualityLine(visualLanguage),
      buildCreationFinalTargetLanguageBoundary(itemTargetLanguage, platformSlot.textPolicy),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      ...platformSlot,
      itemId: platformSlot.itemId || platformSlot.slotKey || `${index + 1}-${role.role}`,
      slotIndex: index + 1,
      itemKind: "carousel",
      role: role.role,
      imageTypeLabel:
        platformPlan.platform === "universal" && platformSlot.imageType !== "custom"
          ? role.title
          : platformSlot.imageTypeLabel,
      title: getCreationPlatformSlotTitle(platformSlot, role, platformPlan.platform),
      filenameToken: role.filenameToken,
      marketingCopyLanguage: itemTargetLanguage.value,
      conversionIntent,
      sourceFocus,
      prompt: platformSlot.prompt || generatedPrompt,
      coverageSources,
      coverageSummary,
      coverageWarnings,
    };
  });
  const skuItems = (skuGenerationEnabled ? skuSubjects : []).map((skuSubject, index) => {
    const slotIndex = effectiveImageCount + index + 1;
    const conversionIntent = buildCreationAppendedConversionIntent("sku", index, effectiveAudienceStrategy);
    return {
      itemId: `${slotIndex}-sku-${skuSubject.id}`,
      slotIndex,
      itemKind: "sku",
      imageType: "sku-item",
      role: "sku",
      title: buildCreationSkuItemDisplayName(skuSubject, index, targetLanguage),
      filenameToken: buildCreationSkuItemFilenameToken(skuSubject, index, targetLanguage),
      marketingCopyLanguage: targetLanguage.value,
      ratio: appendedItemRatio,
      resolutionTier: appendedItemResolutionTier,
      targetLanguage: targetLanguage.value,
      composition: "sku-product-grid",
      textPolicy: "factual-only",
      scenePolicy: "studio-clean",
      logoPolicy: appendedItemLogoPolicy,
      constraints: [],
      skuSubject,
      skuSupportingReferenceRoles,
      conversionIntent,
      prompt: `${buildCreationSkuPrompt({
        skuSubject,
        skuSubjects,
        productLine,
        targetLanguage,
        platform,
        industryTemplate,
        visualLanguage,
        logoOptions,
        skuGenerationRule,
        packageListSummary: skuPackageListSummary,
        dimensionSummary: buildCreationSkuDimensionSummaryForSubject({
          dimensionSpecSummary,
          dimensionSpecGroups: referenceDimensionSpecGroups,
          referenceImageRoles,
          skuSubject,
          skuSubjectCount: skuSubjects.length,
          dimensionUnitMode,
        }),
      })} ${buildCreationConversionIntentGuidance(conversionIntent)}`.trim(),
    };
  });
  const infographicRebuildItems = buildCreationInfographicRebuildItems({
    sources: infographicRebuildSources,
    startIndex: effectiveImageCount + skuItems.length,
    targetLanguage,
  }).map((item, index) => {
    const conversionIntent = buildCreationAppendedConversionIntent("infographic-rebuild", index, effectiveAudienceStrategy);
    return {
      ...item,
      itemKind: "infographic-rebuild",
      imageType: "infographic-rebuild",
      ratio: appendedItemRatio,
      resolutionTier: appendedItemResolutionTier,
      targetLanguage: targetLanguage.value,
      composition: "source-infographic-rebuild",
      textPolicy: "factual-only",
      scenePolicy: "source-preserving",
      logoPolicy: "forbid-overlay",
      constraints: [],
      conversionIntent,
      prompt: item.prompt,
    };
  });
  const carouselItemsBySlotKey = new Map(carouselItems.map((item) => [item.slotKey, item]));
  const editableSlots = legacyPlanningMode
    ? carouselItems
    : platformPlan.slots.map((slot) => {
      const role = getCreationPlatformRoleDefinition(slot.role);
      return carouselItemsBySlotKey.get(slot.slotKey) || {
        ...slot,
        itemId: slot.itemId || slot.slotKey,
        itemKind: "carousel",
        imageTypeLabel:
          platformPlan.platform === "universal" && slot.imageType !== "custom" ? role.title : slot.imageTypeLabel,
        title: getCreationPlatformSlotTitle(slot, role, platformPlan.platform),
        prompt: slot.prompt || "",
      };
    });

  return {
    productName,
    productDescription,
    sellingPoints,
    dimensionSpecs: effectiveDimensionSpecs,
    dimensionSpecGroups: referenceDimensionSpecGroups.map((group) => ({
      id: group.id,
      label: group.label,
      referenceIndexes: group.referenceIndexes,
      filenames: group.filenames,
      lines: group.lines,
      ...(group.variant ? { variant: group.variant } : {}),
      ...(group.color ? { color: group.color } : {}),
      ...(group.size ? { size: group.size } : {}),
    })),
    dimensionUnitMode: dimensionUnitMode.value,
    dimensionUnitModeLabel: dimensionUnitMode.label,
    targetLanguage: targetLanguage.value,
    targetLanguageLabel: targetLanguage.label,
    platform: platformPlan.platform,
    platformLabel: platformPlan.platformLabel,
    requestedPlatform: platformPlan.requestedPlatform,
    platformPolicyId: platformPlan.platform,
    platformEvidenceLevel: platformPlan.evidenceLevel,
    platformProvenance: cleanString(input.platformProvenance) || (hasExplicitPlatform ? "explicit" : "legacy-missing"),
    strategyVersion: platformPlan.strategyVersion,
    strategyVerifiedAt: platformPlan.verifiedAt,
    platformSourceIds: platformPlan.sourceIds,
    platformProfile: platformPlan.profile,
    platformSetOverrides: platformPlan.setOverrides,
    platformItemOverrides: platformPlan.itemOverrides,
    categorySignals: platformPlan.categorySignals,
    platformEvidence: platformPlan.evidence,
    platformReferenceCoverage: platformPlan.referenceCoverage,
    audienceStrategy,
    effectiveAudienceStrategy,
    validation: legacyPlanningMode ? { isValid: true, errors: [], warnings: [] } : platformPlan.validation,
    warnings: legacyPlanningMode ? [] : platformPlan.warnings,
    errors: legacyPlanningMode ? [] : platformPlan.errors,
    canGenerate: legacyPlanningMode ? true : platformPlan.canGenerate,
    imageCount: effectiveImageCount,
    carouselImageCount: effectiveImageCount,
    scenario: scenario.value,
    scenarioLabel: scenario.label,
    visualLanguage: visualLanguage.value,
    visualLanguageLabel: visualLanguage.label,
    industryTemplate: industryTemplate.value,
    industryTemplateLabel: industryTemplate.label,
    industryTemplatePath: industryTemplate.categoryPath || "",
    selectedRoles: plannedRoles.map((role) => role.role),
    referenceImageRoles,
    skuGenerationEnabled,
    infographicRebuildEnabled,
    infographicRebuildCount: infographicRebuildItems.length,
    skuSubjects,
    skuBundleCount,
    skuGenerationRule: skuGenerationRule.value,
    skuGenerationRuleLabel: skuGenerationRule.label,
    skuImageCount: skuItems.length,
    totalPlannedItemCount: effectiveImageCount + skuItems.length + infographicRebuildItems.length,
    contentAllocation: {
      strategy: contentAllocation.strategy,
      agentRequired: contentAllocation.agentRequired,
    },
    logo: logoOptions.enabled ? logoOptions : null,
    slots: editableSlots,
    items: [...carouselItems, ...skuItems, ...infographicRebuildItems],
  };
}
