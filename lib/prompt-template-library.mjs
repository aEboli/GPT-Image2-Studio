/*
 * Prompt Kit 的静态目录快照。
 * 目录不写入用户模板存储。人像与头像分类使用从 YouMind 目标页面抓取并随应用打包的真实图片；
 * 真实素材用尽后使用按模板键确定的内联 SVG 预览，避免重复循环同一张照片，离线桌面包也能正常显示。
 */

import { YOUMIND_PROFILE_ENTRIES } from "./youmind-profile-entries.mjs";

const PROMPT_TEMPLATE_VARIANTS = [
  { name: "自然光", tail: "采用柔和自然光，保留真实材质与自然层次" },
  { name: "棚拍", tail: "使用干净的专业棚拍光，边缘清晰、阴影克制" },
  { name: "电影感", tail: "使用有方向性的电影感光线，明暗层次丰富但不过度戏剧化" },
  { name: "俯拍", tail: "从稳定的俯拍视角呈现整体关系，主体位置清楚" },
  { name: "近景细节", tail: "采用近景构图突出关键细节，背景简洁并保持适度景深" },
  { name: "宽幅场景", tail: "采用宽幅构图交代环境关系，保留自然的前中后景层次" },
  { name: "低饱和", tail: "使用低饱和、克制的色彩，呈现安静高级的视觉气质" },
  { name: "黑白", tail: "以黑白摄影处理强化形体、光影和纹理，不丢失主体细节" },
  { name: "暖色", tail: "使用温暖但真实的色温，画面亲和、舒适且不偏色" },
  { name: "商业清透", tail: "采用清透的商业摄影风格，画面干净、信息明确、适合直接使用" },
];

const CATEGORY_DEFINITIONS = [
  {
    id: "profile-avatar",
    name: "人像与头像",
    description: "职业形象、社交头像与生活写真",
    motif: "portrait",
    accent: "#5d7c8d",
    children: [
      {
        id: "identity-photo",
        name: "证件照",
        lead:
          "智感职业证件照，整体风格参考美式证件照，人物大小适中。使用淡淡的灰色到白色的渐变摄影背景，灯光柔和自然，突出真实肤色与层次感。画面清晰高质，面部保持对焦，皮肤质感通透气色好，头肩比要正常舒适。整体气质现代且优雅，神情放松，自然自信，眼神明亮有神。中景人像，人物居中，低对比度，呈现出专业肖像摄影的精致感。",
        use: "适合作为商务与职业形象照",
      },
      {
        id: "business-headshot",
        name: "商务头像",
        lead:
          "生成可信自然的商务个人头像，人物肩部以上或半身构图，姿态端正但不僵硬，穿着简洁得体的商务服装，背景干净并为头像裁切保留空间。",
        use: "适合作为简历、企业主页和职业社交头像",
      },
      {
        id: "lifestyle-portrait",
        name: "生活写真",
        lead:
          "生成一张自然真实的生活方式人像，人物动作松弛、表情有情绪，置于有生活气息但不杂乱的日常环境中，保留真实肤色、发丝和衣物纹理。",
        use: "适合作为个人主页和生活内容配图",
      },
      {
        id: "social-avatar",
        name: "社交头像",
        lead:
          "生成辨识度高又亲切的社交平台头像，人物面部清晰、眼神明亮，构图适合圆形或方形裁切，服装和背景简洁，避免复杂道具抢夺注意力。",
        use: "适合作为社交账号、社区和聊天工具头像",
      },
    ],
  },
  {
    id: "product-commerce",
    name: "商业与电商",
    description: "商品主图、详情页和餐饮商业摄影",
    motif: "product",
    accent: "#b36b4b",
    children: [
      {
        id: "ecommerce-white",
        name: "白底商品主图",
        lead:
          "生成一张电商产品白底主图，以主体产品为唯一视觉焦点。产品完整呈现，外形、颜色、材质和配件关系清晰，放置在画面中央并保留适度留白。",
        use: "适合作为商品首图和目录展示",
      },
      {
        id: "ecommerce-lifestyle",
        name: "生活方式商品",
        lead:
          "生成一张电商产品生活方式展示图，让主体产品保持外形、颜色、材质和品牌结构稳定，置于符合使用场景的真实环境中，辅助道具少而精且不遮挡主体。",
        use: "适合作为商品详情页和社交媒体营销图",
      },
      {
        id: "fashion-product",
        name: "服饰与配饰",
        lead:
          "生成一张服装或配饰商业展示图，准确呈现版型、面料纹理、颜色、缝线和金属细节，人物或衣架比例自然，构图给商品留出完整展示空间。",
        use: "适合作为服装目录、上新和穿搭内容",
      },
      {
        id: "food-commerce",
        name: "食品餐饮",
        lead:
          "生成一张专业美食商业摄影，主体菜品摆盘精致、食材新鲜，表现酥脆、汁水或蒸汽等可食用质感，餐具与配料少量点缀且不喧宾夺主。",
        use: "适合作为菜单、外卖平台和餐饮宣传配图",
      },
    ],
  },
  {
    id: "marketing-design",
    name: "设计与营销",
    description: "海报、品牌视觉、活动封面与详情页",
    motif: "design",
    accent: "#7b5c8f",
    children: [
      {
        id: "social-poster",
        name: "社媒营销海报",
        lead:
          "生成一张适合社交媒体与活动宣传的营销视觉海报，围绕明确主题设置单一视觉主体，层级清晰、色彩统一，并在主体周围预留可后期排版的留白区域。",
        use: "适合作为活动封面、商品推广和公众号配图",
      },
      {
        id: "brand-visual",
        name: "品牌视觉",
        lead:
          "生成一张现代品牌视觉主图，围绕品牌核心气质组织主体、材质、色彩和空间关系，画面简洁有记忆点，不生成复杂 Logo 或长段文字。",
        use: "适合作为品牌主页、宣传册和发布会视觉",
      },
      {
        id: "product-detail",
        name: "电商详情页",
        lead:
          "生成一张电商详情页场景图，清晰突出产品功能、使用方式和关键材质，画面分区明确并保留可后期添加卖点文字的干净区域，避免乱码与虚构参数。",
        use: "适合作为商品详情页模块和功能说明图",
      },
      {
        id: "event-cover",
        name: "活动封面",
        lead:
          "生成一张活动或课程封面视觉，使用明确的中心主体和有秩序的背景元素，构图适合横版与竖版裁切，顶部或侧边保留标题排版空间，不生成长文字。",
        use: "适合作为直播、课程、展览和线上活动封面",
      },
    ],
  },
  {
    id: "scene-space",
    name: "场景与空间",
    description: "室内、建筑、城市旅行与自然风景",
    motif: "scene",
    accent: "#4f7c6a",
    children: [
      {
        id: "interior-home",
        name: "室内家居",
        lead:
          "生成一张真实的室内家居空间效果图，明确呈现房间功能与主要家具，透视和建筑线条规整，家具比例合理，材质纹理真实，空间整洁但有生活气息。",
        use: "适合作为装修灵感和室内设计展示",
      },
      {
        id: "architecture",
        name: "建筑空间",
        lead:
          "生成一张建筑摄影作品，准确表现建筑体块、立面材质、结构线条和周围环境，视点与透视自然，人物和车辆只作为尺度参照，不遮挡主体建筑。",
        use: "适合作为建筑作品集、地产和空间品牌视觉",
      },
      {
        id: "travel-city",
        name: "城市旅行",
        lead:
          "生成一张旅行与城市纪实摄影，围绕指定地点或主题展现真实环境与生活氛围，画面有前中后景层次，人物、建筑和车辆比例自然，避免虚构招牌文字。",
        use: "适合作为旅行记录和城市内容配图",
      },
      {
        id: "nature-landscape",
        name: "自然风景",
        lead:
          "生成一张具有空间深度的自然风景摄影，突出山川、森林、海岸或天空的真实纹理和天气氛围，保留明确视觉主体，不使用过度 HDR 或不自然的颜色。",
        use: "适合作为旅行封面、壁纸和环境主题配图",
      },
    ],
  },
  {
    id: "art-style",
    name: "艺术与风格",
    description: "电影感、插画、3D 和复古胶片视觉",
    motif: "art",
    accent: "#9b6b5d",
    children: [
      {
        id: "cinematic",
        name: "电影感画面",
        lead:
          "生成一幅具有电影叙事感的画面，明确安排主体、环境和视觉焦点，光线有方向性，色彩服务于情绪，人物动作自然，避免无意义的装饰堆叠。",
        use: "适合作为短片分镜、概念视觉和故事海报",
      },
      {
        id: "illustration",
        name: "插画与绘本",
        lead:
          "生成一幅完成度高的插画或绘本画面，主体轮廓清晰，造型语言统一，色彩和材质服务于叙事，画面保留适度留白，不生成无法辨认的文字。",
        use: "适合作为文章插图、儿童绘本和角色设定",
      },
      {
        id: "3d-render",
        name: "3D 产品渲染",
        lead:
          "生成一张精致的 3D 产品渲染图，主体结构、材质、边缘和接触阴影清晰，摄影机角度稳定，背景简洁，避免漂浮、穿模和多余部件。",
        use: "适合作为概念产品、软件界面和品牌物料",
      },
      {
        id: "retro-film",
        name: "复古胶片",
        lead:
          "生成一张带有复古胶片气质的摄影作品，保留真实的颗粒、轻微色偏和自然光影，主体细节仍然清楚，年代感来自色彩和质地而不是模糊画面。",
        use: "适合作为生活方式内容、唱片视觉和怀旧主题海报",
      },
    ],
  },
  {
    id: "editorial-content",
    name: "内容与效率",
    description: "文章配图、PPT、信息图与教程视觉",
    motif: "editorial",
    accent: "#55718c",
    children: [
      {
        id: "article-illustration",
        name: "文章配图",
        lead:
          "生成一张服务于文章主题的编辑类配图，用单一视觉隐喻表达核心观点，主体明确、背景不过度喧宾夺主，并为标题和正文排版预留留白。",
        use: "适合作为公众号、博客和新闻文章头图",
      },
      {
        id: "presentation",
        name: "PPT 插图",
        lead:
          "生成一张适合演示文稿的横版插图，视觉重点明确、信息层级清楚，画面左右或顶部预留文字区域，避免生成小字号长文本和复杂 Logo。",
        use: "适合作为汇报、课程和产品介绍页面配图",
      },
      {
        id: "infographic",
        name: "信息图视觉",
        lead:
          "生成一张用于解释复杂主题的信息图视觉，使用清晰的分区、箭头、节点或对比关系组织内容，图形风格统一，文字区域留给后期排版，避免乱码。",
        use: "适合作为流程说明、数据解读和知识卡片底图",
      },
      {
        id: "tutorial",
        name: "教程步骤图",
        lead:
          "生成一张清楚展示操作步骤的教程视觉，按从左到右或从上到下的顺序安排关键动作，主体大小一致、背景干净，并预留编号和说明文字空间。",
        use: "适合作为软件教程、手工步骤和产品使用说明",
      },
    ],
  },
];

function buildPromptTemplates(category, child, childIndex) {
  return PROMPT_TEMPLATE_VARIANTS.map((variant, index) => {
    const isFirstIdentityPhoto = child.id === "identity-photo" && index === 0;
    const sourcePreviewIndex = childIndex * PROMPT_TEMPLATE_VARIANTS.length + index;
    const sourcePreview = category.id === "profile-avatar"
      ? YOUMIND_PROFILE_ENTRIES[sourcePreviewIndex] || null
      : null;
    const sourcePrompt = sourcePreview?.prompt?.trim() || "";
    const prompt = sourcePrompt
      ? sourcePrompt.slice(0, 3000)
      : isFirstIdentityPhoto
      ? `${child.lead}${variant.tail}。${child.use}。画面清晰高质，无文字、无水印。`
      : `${child.lead}${variant.tail}。构图稳定、主体比例自然，避免畸形肢体、重复物体、乱码文字和水印。${child.use}。`;

    return {
      id: `library-${category.id}-${child.id}-${String(index + 1).padStart(2, "0")}`,
      name: sourcePreview?.name || `${child.name} · ${variant.name}`,
      prompt,
      categoryId: category.id,
      subcategoryId: child.id,
      categoryName: category.name,
      subcategoryName: child.name,
      previewKey: `${category.id}:${child.id}:${index}`,
      previewAccent: category.accent,
      previewMotif: category.motif,
      previewImage: sourcePreview?.path || "",
      previewAlt: sourcePreview?.alt || "",
      previewSourceUrl: sourcePreview?.sourceUrl || "",
      previewSourcePage: sourcePreview?.sourcePage || "",
    };
  });
}

export const PROMPT_TEMPLATE_LIBRARY = CATEGORY_DEFINITIONS.map((category) => ({
  ...category,
  children: category.children.map((child, childIndex) => ({
    ...child,
    templates: buildPromptTemplates(category, child, childIndex),
  })),
}));

export function flattenPromptTemplateLibrary({ categoryId = "", subcategoryId = "" } = {}) {
  const categories = categoryId
    ? PROMPT_TEMPLATE_LIBRARY.filter((category) => category.id === categoryId)
    : PROMPT_TEMPLATE_LIBRARY;
  return categories.flatMap((category) =>
    category.children
      .filter((child) => !subcategoryId || (category.id === categoryId && child.id === subcategoryId))
      .flatMap((child) => child.templates),
  );
}

export function getPromptTemplateLibraryCategory(categoryId) {
  return PROMPT_TEMPLATE_LIBRARY.find((category) => category.id === categoryId) || PROMPT_TEMPLATE_LIBRARY[0] || null;
}

export function getPromptTemplateLibrarySubcategory(categoryId, subcategoryId) {
  return getPromptTemplateLibraryCategory(categoryId)?.children.find((child) => child.id === subcategoryId) || null;
}

export function getPromptTemplateLibraryCounts() {
  return PROMPT_TEMPLATE_LIBRARY.reduce(
    (counts, category) => {
      counts.categories += 1;
      counts.subcategories += category.children.length;
      counts.templates += category.children.reduce((sum, child) => sum + child.templates.length, 0);
      return counts;
    },
    { categories: 0, subcategories: 0, templates: 0 },
  );
}

const previewUrlCache = new Map();

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function hashPreviewKey(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash;
}

function renderSemanticPreviewArt(template, colors) {
  const { accent, ink, primary, secondary, shadowId, soft, variantIndex } = colors;
  const scene = String(template?.subcategoryId || "");
  const tilt = (variantIndex % 3) - 1;
  const surface = `<ellipse cx="180" cy="276" rx="122" ry="18" fill="${ink}" opacity=".16"/>`;
  const frame = (content, attributes = "") =>
    `<g transform="rotate(${tilt} 180 180)" ${attributes}>${content}</g>`;

  switch (scene) {
    case "ecommerce-white":
      return frame(`${surface}<rect x="92" y="88" width="176" height="170" rx="22" fill="${soft}" stroke="${ink}" stroke-opacity=".28" stroke-width="4" filter="url(#${shadowId})"/><rect x="116" y="116" width="128" height="30" rx="9" fill="${primary}"/><path d="M126 176h108M126 202h76" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".55"/><circle cx="224" cy="224" r="17" fill="${secondary}"/>`);
    case "ecommerce-lifestyle":
      return frame(`${surface}<rect x="54" y="238" width="252" height="20" rx="10" fill="${ink}" opacity=".62"/><rect x="110" y="112" width="112" height="114" rx="18" fill="${soft}" stroke="${ink}" stroke-opacity=".28" stroke-width="4" filter="url(#${shadowId})"/><path d="M132 146h68M132 174h48" stroke="${primary}" stroke-width="11" stroke-linecap="round"/><path d="M246 218c-12-52 6-82 30-100M258 158c-20-18-34-22-48-16M268 140c18-20 28-20 40-16" fill="none" stroke="${secondary}" stroke-width="8" stroke-linecap="round"/>`);
    case "fashion-product":
      return frame(`${surface}<path d="M128 92 156 76h48l28 16 42 32-26 42-28-18v104H120V148l-28 18-26-42Z" fill="${soft}" stroke="${ink}" stroke-opacity=".28" stroke-width="4" filter="url(#${shadowId})"/><path d="M156 76q24 32 48 0M132 154h96" fill="none" stroke="${primary}" stroke-width="11" stroke-linecap="round"/><circle cx="242" cy="122" r="15" fill="${secondary}"/>`);
    case "food-commerce":
      return frame(`${surface}<ellipse cx="180" cy="190" rx="116" ry="70" fill="${soft}" stroke="${ink}" stroke-opacity=".28" stroke-width="4" filter="url(#${shadowId})"/><ellipse cx="180" cy="190" rx="76" ry="43" fill="${primary}"/><circle cx="142" cy="178" r="14" fill="${secondary}"/><circle cx="192" cy="164" r="16" fill="${accent}"/><circle cx="214" cy="204" r="12" fill="${secondary}"/><path d="M112 118c16-22 31-28 46-28M236 112c14-18 28-22 42-18" fill="none" stroke="${secondary}" stroke-width="8" stroke-linecap="round"/>`);
    case "social-poster":
      return frame(`<rect x="72" y="50" width="216" height="238" rx="18" fill="${soft}" filter="url(#${shadowId})"/><circle cx="180" cy="132" r="54" fill="${primary}"/><path d="M104 218h152M104 244h104" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".7"/><circle cx="240" cy="84" r="17" fill="${secondary}"/>`);
    case "brand-visual":
      return frame(`<rect x="60" y="72" width="240" height="202" rx="20" fill="${soft}" filter="url(#${shadowId})"/><circle cx="132" cy="150" r="52" fill="${primary}"/><path d="M212 112h54M212 144h40M212 176h58" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".66"/><rect x="92" y="224" width="42" height="22" rx="8" fill="${secondary}"/><rect x="144" y="224" width="42" height="22" rx="8" fill="${accent}"/><rect x="196" y="224" width="42" height="22" rx="8" fill="${primary}"/>`);
    case "product-detail":
      return frame(`<rect x="60" y="72" width="240" height="202" rx="22" fill="${soft}" filter="url(#${shadowId})"/><rect x="90" y="104" width="92" height="124" rx="16" fill="${primary}"/><circle cx="136" cy="144" r="20" fill="${secondary}"/><path d="M210 122h50M210 154h38M210 186h56M210 218h34" stroke="${ink}" stroke-width="9" stroke-linecap="round" opacity=".65"/>`);
    case "event-cover":
      return frame(`<rect x="58" y="74" width="244" height="202" rx="22" fill="${soft}" filter="url(#${shadowId})"/><path d="M58 74h244l-34 54H92Z" fill="${primary}" opacity=".9"/><circle cx="180" cy="166" r="46" fill="${secondary}"/><path d="M100 236h160" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".72"/>`);
    case "interior-home":
      return frame(`<rect x="54" y="72" width="252" height="190" rx="18" fill="${soft}" filter="url(#${shadowId})"/><path d="M54 210h252" stroke="${ink}" stroke-width="9" opacity=".5"/><rect x="88" y="154" width="108" height="68" rx="16" fill="${primary}"/><path d="M88 174h108M104 222v34M180 222v34" stroke="${ink}" stroke-width="9" stroke-linecap="round" opacity=".65"/><rect x="232" y="108" width="36" height="82" rx="10" fill="${secondary}"/><circle cx="250" cy="96" r="22" fill="${secondary}" opacity=".8"/>`);
    case "architecture":
      return frame(`<rect x="58" y="70" width="244" height="204" rx="16" fill="${soft}" filter="url(#${shadowId})"/><path d="M76 252V136l104-64 104 64v116Z" fill="${primary}"/><path d="M112 142v104M148 142v104M184 142v104M220 142v104M256 142v104" stroke="${soft}" stroke-width="13" opacity=".9"/><path d="M72 252h216" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".7"/>`);
    case "travel-city":
      return frame(`<rect x="48" y="68" width="264" height="210" rx="20" fill="${soft}" filter="url(#${shadowId})"/><circle cx="246" cy="108" r="28" fill="${secondary}"/><path d="M70 240V166h48v74M128 240V124h58v116M198 240V150h46v90M254 240V104h34v136" fill="${primary}"/><path d="M62 252h236" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".65"/>`);
    case "nature-landscape":
      return frame(`<rect x="48" y="74" width="264" height="196" rx="22" fill="${soft}" filter="url(#${shadowId})"/><circle cx="246" cy="112" r="28" fill="${secondary}"/><path d="M54 232 126 138l44 48 54-86 84 132v40H54Z" fill="${primary}"/><path d="M54 232c68-40 118-34 176 0 34 20 56 22 82 8v32H54Z" fill="${accent}" opacity=".72"/>`);
    case "cinematic":
      return frame(`<rect x="54" y="72" width="252" height="196" rx="18" fill="${soft}" filter="url(#${shadowId})"/><circle cx="248" cy="112" r="27" fill="${secondary}"/><path d="M54 218c58-58 96-56 142-12 40 38 74 38 110 8v54H54Z" fill="${primary}"/><circle cx="152" cy="164" r="24" fill="${accent}"/><path d="M152 188v42M130 214h44" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>`);
    case "illustration":
      return frame(`<rect x="62" y="62" width="236" height="220" rx="28" fill="${soft}" filter="url(#${shadowId})"/><circle cx="180" cy="150" r="62" fill="${primary}"/><circle cx="156" cy="142" r="8" fill="${ink}"/><circle cx="204" cy="142" r="8" fill="${ink}"/><path d="M148 176q32 24 64 0" fill="none" stroke="${secondary}" stroke-width="9" stroke-linecap="round"/><path d="M104 238h152" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".62"/>`);
    case "3d-render":
      return frame(`<rect x="62" y="70" width="236" height="204" rx="22" fill="${soft}" filter="url(#${shadowId})"/><path d="m180 92 72 42v82l-72 42-72-42v-82Z" fill="${primary}"/><path d="m180 92 72 42-72 42-72-42Z" fill="${secondary}"/><path d="M180 176v82" stroke="${ink}" stroke-width="9" opacity=".68"/>`);
    case "retro-film":
      return frame(`<rect x="52" y="76" width="256" height="190" rx="18" fill="${ink}" opacity=".86" filter="url(#${shadowId})"/><rect x="84" y="106" width="82" height="96" rx="10" fill="${primary}"/><rect x="194" y="106" width="82" height="96" rx="10" fill="${secondary}"/><path d="M70 94v154M290 94v154" stroke="${soft}" stroke-width="10" stroke-dasharray="10 14" opacity=".7"/><circle cx="124" cy="154" r="22" fill="${soft}" opacity=".72"/>`);
    case "article-illustration":
      return frame(`<rect x="66" y="60" width="228" height="224" rx="18" fill="${soft}" filter="url(#${shadowId})"/><rect x="92" y="88" width="176" height="92" rx="12" fill="${primary}"/><path d="M98 218h154M98 246h118" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".66"/><circle cx="238" cy="116" r="20" fill="${secondary}"/>`);
    case "presentation":
      return frame(`<rect x="48" y="82" width="264" height="174" rx="16" fill="${soft}" filter="url(#${shadowId})"/><path d="M76 218h212" stroke="${ink}" stroke-width="8" opacity=".5"/><path d="M92 202v-48M132 202v-82M172 202v-64M212 202v-112M252 202v-28" stroke="${primary}" stroke-width="22" stroke-linecap="round"/><circle cx="260" cy="112" r="20" fill="${secondary}"/>`);
    case "infographic":
      return frame(`<rect x="66" y="62" width="228" height="220" rx="18" fill="${soft}" filter="url(#${shadowId})"/><circle cx="116" cy="128" r="24" fill="${primary}"/><circle cx="244" cy="128" r="24" fill="${secondary}"/><circle cx="180" cy="232" r="24" fill="${accent}"/><path d="M138 132h82M128 146l38 70M232 146l-38 70" stroke="${ink}" stroke-width="9" stroke-linecap="round" opacity=".7"/>`);
    case "tutorial":
      return frame(`<rect x="58" y="68" width="244" height="208" rx="20" fill="${soft}" filter="url(#${shadowId})"/><circle cx="108" cy="120" r="23" fill="${primary}"/><circle cx="108" cy="176" r="23" fill="${secondary}"/><circle cx="108" cy="232" r="23" fill="${accent}"/><path d="M154 120h104M154 176h80M154 232h112" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".66"/>`);
    default:
      return "";
  }
}

function renderPreviewSvg(template) {
  const accent = String(template?.previewAccent || "#667788");
  const key = hashPreviewKey(template?.previewKey || template?.id);
  const hue = key % 360;
  const primary = `hsl(${hue}, 54%, 42%)`;
  const secondary = `hsl(${(hue + 38) % 360}, 65%, 58%)`;
  const soft = `hsl(${(hue + 178) % 360}, 30%, 94%)`;
  const ink = `hsl(${(hue + 190) % 360}, 28%, 18%)`;
  const variantIndex = key % 6;
  const rotation = (key % 15) - 7;
  const label = escapeXml(String(template?.subcategoryName || template?.name || "模板").slice(0, 10));
  const variant = escapeXml(String(template?.name || "").split("·").at(-1)?.trim().slice(0, 8) || "参考");
  const motif = template?.previewMotif || "scene";
  const gradientId = `g${key}`;
  const shadowId = `s${key}`;
  const common = `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}" stop-opacity=".94"/><stop offset=".56" stop-color="${accent}" stop-opacity=".9"/><stop offset="1" stop-color="${soft}" stop-opacity=".96"/></linearGradient><filter id="${shadowId}" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="${ink}" flood-opacity=".24"/></filter></defs>`;
  const backdrops = [
    `<circle cx="302" cy="62" r="96" fill="${secondary}" opacity=".38"/><path d="M0 258C82 214 126 300 214 252s104-18 146 18v90H0Z" fill="${soft}" opacity=".7"/>`,
    `<path d="M0 0h184L84 360H0Z" fill="${secondary}" opacity=".28"/><circle cx="292" cy="294" r="112" fill="${soft}" opacity=".72"/>`,
    `<rect x="22" y="22" width="316" height="316" rx="34" fill="${soft}" opacity=".66"/><path d="m0 274 106-94 72 44 102-126 80 70v192H0Z" fill="${secondary}" opacity=".3"/>`,
    `<path d="M0 78C94 10 168 118 246 54c34-28 73-32 114-4v310H0Z" fill="${secondary}" opacity=".3"/><circle cx="70" cy="72" r="38" fill="${soft}" opacity=".74"/>`,
    `<rect x="0" y="0" width="360" height="360" fill="${soft}" opacity=".4"/><path d="m-18 94 176-112 224 132-176 112Z" fill="${secondary}" opacity=".34"/><path d="m-26 288 160-106 226 120-160 106Z" fill="${primary}" opacity=".18"/>`,
    `<circle cx="68" cy="80" r="58" fill="${soft}" opacity=".7"/><circle cx="300" cy="284" r="92" fill="${secondary}" opacity=".3"/><path d="M0 210c76-28 110 30 180 0s112-26 180 10v140H0Z" fill="${soft}" opacity=".66"/>`,
  ][variantIndex];
  let art = "";
  if (motif === "portrait") {
    const cx = 146 + (key % 72);
    const cy = 116 + (key % 24);
    const head = 38 + (key % 16);
    const shoulder = `M${cx - 92} 286c8-68 48-102 92-102s84 34 92 102Z`;
    const accessory = [
      `<path d="M${cx - 48} ${cy + 5}h96" stroke="${secondary}" stroke-width="7" stroke-linecap="round" opacity=".8"/>`,
      `<circle cx="${cx - 30}" cy="${cy + 18}" r="7" fill="${secondary}"/><circle cx="${cx + 30}" cy="${cy + 18}" r="7" fill="${secondary}"/>`,
      `<path d="M${cx - 23} ${cy + 28}q23 18 46 0" fill="none" stroke="${secondary}" stroke-width="5" stroke-linecap="round"/>`,
      `<path d="M${cx - 37} ${cy - 4}q37-25 74 0" fill="none" stroke="${secondary}" stroke-width="8" stroke-linecap="round"/>`,
      `<circle cx="${cx + 44}" cy="${cy + 4}" r="9" fill="${accent}" stroke="${soft}" stroke-width="4"/>`,
      `<path d="M${cx - 30} ${cy + 26}h60" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>`,
    ][variantIndex];
    art = `<g transform="rotate(${rotation} 180 180)"><circle cx="${cx}" cy="${cy}" r="${head + 18}" fill="${soft}" opacity=".42"/><circle cx="${cx}" cy="${cy}" r="${head}" fill="#f2c3a4"/><path d="${shoulder}" fill="${primary}" filter="url(#${shadowId})"/><path d="M${cx - head - 8} ${cy - 8}c8-${head + 26} ${head * 2 + 16}-${head - 6} ${head * 2 + 20} ${head + 16}c-19-12-48-12-72 0Z" fill="${ink}"/><circle cx="${cx - 17}" cy="${cy + 6}" r="4" fill="${ink}"/><circle cx="${cx + 17}" cy="${cy + 6}" r="4" fill="${ink}"/>${accessory}</g>`;
  } else if (motif === "product") {
    const productArts = [
      `<rect x="84" y="82" width="192" height="154" rx="22" fill="${soft}" stroke="${ink}" stroke-opacity=".24" stroke-width="4" filter="url(#${shadowId})"/><path d="M116 122h126M116 154h84" stroke="${primary}" stroke-width="12" stroke-linecap="round"/><circle cx="226" cy="192" r="24" fill="${secondary}"/>`,
      `<ellipse cx="180" cy="252" rx="110" ry="22" fill="${ink}" opacity=".16"/><circle cx="180" cy="156" r="76" fill="${soft}" stroke="${ink}" stroke-opacity=".25" stroke-width="4" filter="url(#${shadowId})"/><path d="M130 178h100M146 122h68" stroke="${primary}" stroke-width="12" stroke-linecap="round"/><circle cx="180" cy="212" r="14" fill="${secondary}"/>`,
      `<path d="M126 108h108l20 40v106H106V148Z" fill="${soft}" stroke="${ink}" stroke-opacity=".25" stroke-width="4" filter="url(#${shadowId})"/><path d="M126 108v40h128M156 185h76M156 214h52" stroke="${primary}" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="218" cy="214" r="16" fill="${secondary}"/>`,
      `<path d="M120 112h120l-18 156H138Z" fill="${soft}" stroke="${ink}" stroke-opacity=".25" stroke-width="4" filter="url(#${shadowId})"/><path d="M150 112q30-38 60 0M146 174h68M154 208h52" fill="none" stroke="${primary}" stroke-width="11" stroke-linecap="round"/><circle cx="180" cy="244" r="11" fill="${secondary}"/>`,
      `<ellipse cx="180" cy="250" rx="120" ry="22" fill="${ink}" opacity=".15"/><ellipse cx="180" cy="166" rx="110" ry="70" fill="${soft}" stroke="${ink}" stroke-opacity=".26" stroke-width="4" filter="url(#${shadowId})"/><ellipse cx="180" cy="166" rx="58" ry="30" fill="${primary}" opacity=".8"/><circle cx="224" cy="212" r="17" fill="${secondary}"/>`,
      `<rect x="110" y="92" width="140" height="176" rx="70" fill="${soft}" stroke="${ink}" stroke-opacity=".25" stroke-width="4" filter="url(#${shadowId})"/><path d="M142 148h76M142 180h54" stroke="${primary}" stroke-width="11" stroke-linecap="round"/><circle cx="180" cy="224" r="24" fill="${secondary}"/>`,
    ];
    art = productArts[variantIndex];
  } else if (motif === "design") {
    const designArts = [
      `<rect x="74" y="54" width="212" height="232" rx="18" fill="${soft}" filter="url(#${shadowId})"/><rect x="96" y="78" width="168" height="92" rx="12" fill="${primary}"/><path d="M98 204h132M98 230h96" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".72"/><circle cx="238" cy="244" r="17" fill="${secondary}"/>`,
      `<rect x="66" y="80" width="228" height="188" rx="24" fill="${soft}" filter="url(#${shadowId})"/><circle cx="128" cy="154" r="54" fill="${primary}"/><rect x="196" y="112" width="60" height="84" rx="12" fill="${secondary}"/><path d="M98 226h158" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".66"/>`,
      `<rect x="66" y="60" width="228" height="226" rx="18" fill="${soft}" filter="url(#${shadowId})"/><path d="M66 186 176 60h118v90L184 286H66Z" fill="${primary}" opacity=".9"/><circle cx="236" cy="232" r="28" fill="${secondary}"/><path d="M90 104h74" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`,
      `<rect x="72" y="64" width="216" height="218" rx="18" fill="${soft}" filter="url(#${shadowId})"/><rect x="96" y="88" width="74" height="170" rx="14" fill="${primary}"/><rect x="184" y="88" width="78" height="74" rx="14" fill="${secondary}"/><path d="M184 202h78M184 228h54" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".7"/>`,
      `<rect x="60" y="72" width="240" height="208" rx="20" fill="${soft}" filter="url(#${shadowId})"/><circle cx="180" cy="156" r="70" fill="${primary}"/><circle cx="180" cy="156" r="34" fill="${secondary}"/><path d="M94 242h172" stroke="${ink}" stroke-width="11" stroke-linecap="round" opacity=".7"/>`,
      `<rect x="70" y="56" width="220" height="230" rx="18" fill="${soft}" filter="url(#${shadowId})"/><path d="M92 236 132 92l58 80 48-96 30 160Z" fill="${primary}" opacity=".9"/><circle cx="126" cy="108" r="21" fill="${secondary}"/><path d="M98 258h146" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`,
    ];
    art = designArts[variantIndex];
  } else if (motif === "art") {
    const artVariants = [
      `<circle cx="180" cy="166" r="92" fill="${soft}"/><path d="M76 236c34-86 86-98 140-148 20 48 38 79 88 120-68 47-150 52-228 28Z" fill="${primary}"/><circle cx="142" cy="126" r="26" fill="${secondary}"/>`,
      `<path d="M54 222 122 66l90 52 88-64-32 202Z" fill="${primary}" opacity=".92"/><circle cx="120" cy="222" r="48" fill="${soft}"/><circle cx="240" cy="124" r="27" fill="${secondary}"/>`,
      `<rect x="76" y="74" width="208" height="208" rx="104" fill="${soft}"/><path d="M76 182c52-72 106-78 208-54v154H76Z" fill="${primary}"/><path d="M98 100 260 260" stroke="${secondary}" stroke-width="22" stroke-linecap="round"/>`,
      `<path d="M56 242c70-144 114-174 246-146-36 100-94 152-246 146Z" fill="${primary}"/><path d="M94 96c44 40 96 40 172 0" fill="none" stroke="${soft}" stroke-width="20" stroke-linecap="round"/><circle cx="108" cy="222" r="24" fill="${secondary}"/>`,
      `<circle cx="180" cy="166" r="100" fill="${primary}"/><path d="M80 166h200M180 66v200" stroke="${soft}" stroke-width="20" opacity=".78"/><circle cx="180" cy="166" r="36" fill="${secondary}"/>`,
      `<path d="M72 250 96 92l84-34 108 80-38 122Z" fill="${primary}"/><path d="m116 218 66-100 54 74" fill="none" stroke="${soft}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><circle cx="252" cy="106" r="22" fill="${secondary}"/>`,
    ];
    art = artVariants[variantIndex];
  } else if (motif === "editorial") {
    const editorialVariants = [
      `<rect x="68" y="58" width="224" height="224" rx="20" fill="${soft}" filter="url(#${shadowId})"/><path d="M90 226 148 142l35 42 31-58 56 100Z" fill="${primary}"/><circle cx="240" cy="108" r="22" fill="${secondary}"/><path d="M90 250h154" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".55"/>`,
      `<rect x="60" y="76" width="240" height="196" rx="18" fill="${soft}" filter="url(#${shadowId})"/><path d="M88 236h184" stroke="${ink}" stroke-width="8" opacity=".5"/><path d="M96 214v-54M136 214v-92M176 214v-76M216 214v-126M256 214v-38" stroke="${primary}" stroke-width="22" stroke-linecap="round"/><circle cx="250" cy="108" r="20" fill="${secondary}"/>`,
      `<rect x="70" y="56" width="220" height="232" rx="18" fill="${soft}" filter="url(#${shadowId})"/><circle cx="126" cy="112" r="24" fill="${secondary}"/><path d="M98 166h140M98 196h160M98 226h112" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".65"/><path d="m226 244 30-46 30 46Z" fill="${primary}"/>`,
      `<rect x="62" y="66" width="236" height="214" rx="20" fill="${soft}" filter="url(#${shadowId})"/><path d="M92 224h168" stroke="${ink}" stroke-width="8" opacity=".5"/><circle cx="116" cy="144" r="30" fill="${primary}"/><circle cx="180" cy="144" r="30" fill="${secondary}"/><circle cx="244" cy="144" r="30" fill="${accent}"/><path d="M104 248h144" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".65"/>`,
      `<rect x="68" y="64" width="224" height="220" rx="20" fill="${soft}" filter="url(#${shadowId})"/><path d="M92 230h162" stroke="${ink}" stroke-width="8" opacity=".5"/><path d="M102 202 144 134l36 38 40-74 48 104Z" fill="${primary}"/><circle cx="236" cy="104" r="21" fill="${secondary}"/>`,
      `<rect x="58" y="82" width="244" height="192" rx="18" fill="${soft}" filter="url(#${shadowId})"/><path d="M88 128h182M88 164h182M88 200h182" stroke="${ink}" stroke-width="7" stroke-linecap="round" opacity=".45"/><rect x="90" y="224" width="58" height="28" rx="10" fill="${primary}"/><rect x="158" y="224" width="74" height="28" rx="10" fill="${secondary}"/><rect x="242" y="224" width="28" height="28" rx="10" fill="${accent}"/>`,
    ];
    art = editorialVariants[variantIndex];
  } else {
    const sceneVariants = [
      `<rect x="54" y="82" width="252" height="180" rx="28" fill="${soft}" filter="url(#${shadowId})"/><path d="M56 210 126 128l40 44 42-62 98 98Z" fill="${primary}"/><circle cx="238" cy="112" r="25" fill="${secondary}"/>`,
      `<rect x="52" y="64" width="256" height="208" rx="20" fill="${soft}" filter="url(#${shadowId})"/><path d="M76 236V126h84v110M202 236V98h82v138" fill="${primary}" opacity=".82"/><path d="M60 236h244" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".5"/><circle cx="112" cy="104" r="22" fill="${secondary}"/>`,
      `<rect x="48" y="90" width="264" height="174" rx="28" fill="${soft}" filter="url(#${shadowId})"/><path d="M50 204c58-58 98-50 148 0 48 48 78 44 114 12v52H48Z" fill="${primary}"/><path d="M50 184c56-52 106-48 164 0 46 38 70 34 98 10" fill="none" stroke="${secondary}" stroke-width="16"/><circle cx="102" cy="118" r="24" fill="${secondary}"/>`,
      `<rect x="54" y="76" width="252" height="194" rx="24" fill="${soft}" filter="url(#${shadowId})"/><path d="M54 206 116 152l44 34 62-82 84 102v64H54Z" fill="${primary}"/><path d="m70 238 68-58 44 34 58-76" fill="none" stroke="${secondary}" stroke-width="12" stroke-linecap="round"/><circle cx="246" cy="112" r="22" fill="${accent}"/>`,
      `<rect x="58" y="62" width="244" height="224" rx="18" fill="${soft}" filter="url(#${shadowId})"/><circle cx="180" cy="154" r="72" fill="${primary}" opacity=".88"/><path d="M110 248h140" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity=".55"/><path d="M180 82v144M108 154h144" stroke="${secondary}" stroke-width="10" stroke-linecap="round" opacity=".8"/>`,
      `<rect x="48" y="84" width="264" height="184" rx="32" fill="${soft}" filter="url(#${shadowId})"/><path d="M66 218 128 134l40 48 52-80 74 116Z" fill="${primary}"/><path d="M76 242h204" stroke="${ink}" stroke-width="9" stroke-linecap="round" opacity=".5"/><circle cx="112" cy="112" r="24" fill="${secondary}"/>`,
    ];
    art = sceneVariants[variantIndex];
  }
  art = renderSemanticPreviewArt(template, { accent, ink, primary, secondary, shadowId, soft, variantIndex }) || art;
  const scene = escapeXml(String(template?.subcategoryId || "scene"));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" role="img" aria-label="${label} ${variant}" data-preview-scene="${scene}">${common}<rect width="360" height="360" rx="28" fill="url(#${gradientId})"/>${backdrops}${art}<rect x="20" y="298" width="320" height="42" rx="12" fill="${ink}" opacity=".84"/><text x="38" y="325" font-size="17" font-family="system-ui, sans-serif" font-weight="700" fill="#fff">${label}</text><text x="322" y="325" text-anchor="end" font-size="14" font-family="system-ui, sans-serif" fill="#edf5f4">${variant}</text></svg>`;
}

export function getPromptTemplatePreviewUrl(template) {
  const cacheKey = String(template?.previewKey || template?.id || "");
  if (!cacheKey) {
    return "";
  }
  if (template?.previewImage) {
    return template.previewImage;
  }
  if (!previewUrlCache.has(cacheKey)) {
    previewUrlCache.set(cacheKey, `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(renderPreviewSvg(template))}`);
  }
  return previewUrlCache.get(cacheKey);
}
