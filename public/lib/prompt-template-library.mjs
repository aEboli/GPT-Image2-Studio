/*
 * Prompt Kit 的静态目录快照。
 * 目录不写入用户模板存储。所有模板都使用随应用打包的真实本地图片预览，离线桌面包也能正常显示。
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

const NON_PROFILE_PREVIEW_PATHS = Object.freeze({
  "ecommerce-white": "/assets/prompt-templates/generated/ecommerce-white.png",
  "ecommerce-lifestyle": "/assets/prompt-templates/generated/ecommerce-lifestyle.png",
  "fashion-product": "/assets/prompt-templates/generated/fashion-product.png",
  "food-commerce": "/assets/prompt-templates/generated/food-commerce.png",
  "social-poster": "/assets/prompt-templates/generated/social-poster.png",
  "brand-visual": "/assets/prompt-templates/generated/brand-visual.png",
  "product-detail": "/assets/prompt-templates/generated/product-detail.png",
  "event-cover": "/assets/prompt-templates/generated/event-cover.png",
  "interior-home": "/assets/prompt-templates/generated/interior-home.png",
  architecture: "/assets/prompt-templates/generated/architecture.png",
  "travel-city": "/assets/prompt-templates/generated/travel-city.png",
  "nature-landscape": "/assets/prompt-templates/generated/nature-landscape.png",
  cinematic: "/assets/prompt-templates/generated/cinematic.png",
  illustration: "/assets/prompt-templates/generated/illustration.png",
  "3d-render": "/assets/prompt-templates/generated/3d-render.png",
  "retro-film": "/assets/prompt-templates/generated/retro-film.png",
  "article-illustration": "/assets/prompt-templates/generated/article-illustration.png",
  presentation: "/assets/prompt-templates/generated/presentation.png",
  infographic: "/assets/prompt-templates/generated/infographic.png",
  tutorial: "/assets/prompt-templates/generated/tutorial.png",
});

function buildPromptTemplates(category, child, childIndex) {
  return PROMPT_TEMPLATE_VARIANTS.map((variant, index) => {
    const isFirstIdentityPhoto = child.id === "identity-photo" && index === 0;
    const sourcePreviewIndex = childIndex * PROMPT_TEMPLATE_VARIANTS.length + index;
    const sourcePreview = category.id === "profile-avatar"
      ? YOUMIND_PROFILE_ENTRIES[sourcePreviewIndex] || null
      : null;
    const previewImage = sourcePreview?.path || NON_PROFILE_PREVIEW_PATHS[child.id] || "";
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
      previewImage,
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

export function getPromptTemplatePreviewUrl(template) {
  return String(template?.previewImage || "");
}
