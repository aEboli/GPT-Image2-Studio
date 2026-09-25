/*
 * Prompt Kit 的 YouMind 官方快照目录。
 * 每个模板来自同一条官网记录，图片、完整提示词和详情页保持一一对应。
 * 分类选择依据官网场景前缀及提示词内容建立；同一来源记录可以从多个筛选维度进入。
 */

import { YOUMIND_PROFILE_ENTRIES } from "./youmind-profile-entries.mjs";

const TAXONOMY_DEFINITIONS = [
  {
    id: "usage-scenario",
    name: "使用场景",
    description: "按图片的实际使用场景筛选",
    accent: "#a85c3b",
    children: [
      ["personal-avatar", "个人资料 / 头像"],
      ["social-post", "社交媒体帖子"],
      ["infographic-education", "信息图 / 教育视觉图"],
      ["youtube-thumbnail", "YouTube 缩略图"],
      ["comic-storyboard", "漫画 / 故事板"],
      ["product-marketing", "产品营销"],
      ["ecommerce-main-image", "电商主图"],
      ["game-assets", "游戏素材"],
      ["poster-flyer", "海报 / 传单"],
      ["app-web-design", "App / 网页设计"],
    ],
  },
  {
    id: "visual-style",
    name: "风格",
    description: "按画面表现风格筛选",
    accent: "#587b8c",
    children: [
      ["photography", "摄影"],
      ["film-still", "电影 / 电影剧照"],
      ["anime-manga", "动漫 / 漫画"],
      ["illustration", "插画"],
      ["sketch-line-art", "草图 / 线稿"],
      ["comic-graphic-novel", "漫画 / 图画小说"],
      ["3d-render", "3D 渲染"],
      ["cute-chibi", "Q版 / Q萌风"],
      ["isometric", "等距"],
      ["pixel-art", "像素艺术"],
      ["oil-painting", "油画"],
      ["watercolor", "水彩画"],
      ["ink-chinese-style", "水墨 / 中国风"],
      ["retro-vintage", "复古 / 怀旧"],
      ["cyberpunk-scifi", "赛博朋克 / 科幻"],
      ["minimalism", "极简主义"],
    ],
  },
  {
    id: "subject",
    name: "主体",
    description: "按画面主体筛选",
    accent: "#6d5a82",
    children: [
      ["portrait-selfie", "人像 / 自拍"],
      ["influencer-model", "网红 / 模特"],
      ["character", "角色"],
      ["group-couple", "团体 / 情侣"],
      ["product", "产品"],
      ["food-drink", "食品 / 饮料"],
      ["fashion-item", "时尚单品"],
      ["animal-creature", "动物 / 生物"],
      ["vehicle", "车辆"],
      ["architecture-interior", "建筑 / 室内设计"],
      ["landscape-nature", "风景 / 自然"],
      ["city-street", "城市风光 / 街道"],
      ["chart", "图表"],
      ["text-layout", "文本 / 排版"],
      ["summary-background", "摘要 / 背景"],
    ],
  },
];

const CATEGORY_DEFINITIONS = TAXONOMY_DEFINITIONS.map((category) => ({
  ...category,
  children: category.children.map(([id, name]) => ({ id, name })),
}));

const TAXONOMY_DIMENSIONS = Object.freeze({
  "usage-scenario": "scenario",
  "visual-style": "style",
  subject: "subject",
});

const SOURCE_SCENARIO_BY_WEBSITE_CATEGORY = Object.freeze({
  "个人资料 / 头像": "personal-avatar",
  "社交媒体帖子": "social-post",
  "信息图 / 教育视觉图": "infographic-education",
  "YouTube 缩略图": "youtube-thumbnail",
  "漫画 / 故事板": "comic-storyboard",
  "产品营销": "product-marketing",
  "电商主图": "ecommerce-main-image",
});

const TAXONOMY_RULES = Object.freeze({
  scenario: {
    "personal-avatar": { keywords: ["头像", "肖像", "人像", "自拍", "portrait", "selfie"] },
    "social-post": { keywords: ["社交", "帖子", "instagram", "social", "feed"] },
    "infographic-education": { keywords: ["信息图", "图解", "教育", "知识", "地图", "diagram", "infographic"] },
    "youtube-thumbnail": { keywords: ["youtube", "缩略图", "thumbnail", "视频封面"] },
    "comic-storyboard": { keywords: ["漫画", "故事板", "分镜", "comic", "storyboard"] },
    "product-marketing": { keywords: ["营销", "广告", "品牌", "campaign", "marketing"] },
    "ecommerce-main-image": { keywords: ["电商", "商品", "产品图", "主图", "commerce", "product photo"] },
    "game-assets": { keywords: ["游戏", "game", "角色卡", "卡牌", "游戏素材", "avatar"] },
    "poster-flyer": { keywords: ["海报", "传单", "poster", "flyer", "封面", "banner"] },
    "app-web-design": { keywords: ["app", "网页", "web", "ui", "界面", "样机", "dashboard", "slides"] },
  },
  style: {
    photography: { keywords: ["摄影", "照片", "写实", "真实", "摄影棚", "photo", "photoreal"] },
    "film-still": { keywords: ["电影", "剧照", "电影感", "cinematic", "film still"] },
    "anime-manga": { keywords: ["动漫", "日漫", "anime", "manga"] },
    illustration: { keywords: ["插画", "绘画", "illustration", "手绘"] },
    "sketch-line-art": { keywords: ["草图", "线稿", "素描", "sketch", "line art"] },
    "comic-graphic-novel": { keywords: ["漫画", "图画小说", "graphic novel", "comic panel"] },
    "3d-render": { keywords: ["3d", "三维", "渲染", "render", "立体"] },
    "cute-chibi": { keywords: ["q版", "萌", "可爱", "chibi", "cute", "吉祥物"] },
    isometric: { keywords: ["等距", "isometric"] },
    "pixel-art": { keywords: ["像素", "pixel art", "pixel"] },
    "oil-painting": { keywords: ["油画", "oil painting"] },
    watercolor: { keywords: ["水彩", "watercolor"] },
    "ink-chinese-style": { keywords: ["水墨", "中国风", "国风", "ink wash", "chinese style"] },
    "retro-vintage": { keywords: ["复古", "怀旧", "retro", "vintage"] },
    "cyberpunk-scifi": { keywords: ["赛博", "科幻", "cyberpunk", "sci-fi", "science fiction"] },
    minimalism: { keywords: ["极简", "简洁", "minimal", "clean"] },
  },
  subject: {
    "portrait-selfie": { keywords: ["头像", "肖像", "人像", "自拍", "portrait", "selfie", "女性", "男子"] },
    "influencer-model": { keywords: ["网红", "模特", "主播", "influencer", "model", "直播"] },
    character: { keywords: ["角色", "人物", "吉祥物", "character", "mascot"] },
    "group-couple": { keywords: ["情侣", "团体", "多人", "couple", "group", "family"] },
    product: { keywords: ["产品", "商品", "设备", "瓶", "product", "device"] },
    "food-drink": { keywords: ["美食", "食品", "饮料", "咖啡", "甜点", "food", "drink", "coffee"] },
    "fashion-item": { keywords: ["服装", "时尚", "衣服", "鞋", "包", "fashion", "outfit"] },
    "animal-creature": { keywords: ["动物", "猫", "狗", "熊猫", "鸟", "animal", "pet"] },
    vehicle: { keywords: ["汽车", "车辆", "飞机", "火车", "vehicle", "car"] },
    "architecture-interior": { keywords: ["建筑", "室内", "房间", "厨房", "办公室", "architecture", "interior"] },
    "landscape-nature": { keywords: ["风景", "自然", "森林", "山", "海", "landscape", "nature"] },
    "city-street": { keywords: ["城市", "街道", "地图", "旅行", "city", "street", "urban"] },
    chart: { keywords: ["图表", "数据", "diagram", "chart", "流程图", "地图"] },
    "text-layout": { keywords: ["文字", "排版", "标题", "字体", "typography", "text", "logo"] },
    "summary-background": { keywords: ["背景", "抽象", "摘要", "background", "abstract", "纹理"] },
  },
});

const MIN_TEMPLATES_PER_SUBCATEGORY = 20;

const PINNED_SOURCE_KEYWORDS = Object.freeze({
  "visual-style/photography": ["厨房围裙"],
  "subject/portrait-selfie": ["厨房围裙"],
});

function getSearchText(entry) {
  return `${entry.title}\n${entry.prompt}\n${entry.websiteCategory}`.toLocaleLowerCase();
}

function scoreEntry(entry, dimension, childId) {
  const rule = TAXONOMY_RULES[dimension]?.[childId] || {};
  const searchText = getSearchText(entry);
  let score = 0;

  if (dimension === "scenario" && SOURCE_SCENARIO_BY_WEBSITE_CATEGORY[entry.websiteCategory] === childId) {
    score += 10000;
  }
  for (const keyword of rule.keywords || []) {
    if (searchText.includes(keyword.toLocaleLowerCase())) {
      score += 100;
    }
  }
  return score;
}

function selectSourceEntriesForChild(category, child) {
  const dimension = TAXONOMY_DIMENSIONS[category.id];
  const pinnedKeywords = PINNED_SOURCE_KEYWORDS[`${category.id}/${child.id}`] || [];
  const pinned = YOUMIND_PROFILE_ENTRIES.filter((entry) =>
    pinnedKeywords.some((keyword) => `${entry.title}\n${entry.prompt}`.includes(keyword)),
  );
  const selectedIds = new Set(pinned.map((entry) => entry.id));
  const ranked = [...YOUMIND_PROFILE_ENTRIES]
    .map((entry) => ({ entry, score: scoreEntry(entry, dimension, child.id) }))
    .sort((left, right) => right.score - left.score || left.entry.sourceIndex - right.entry.sourceIndex)
    .map(({ entry }) => entry)
    .filter((entry) => !selectedIds.has(entry.id));
  return [...pinned, ...ranked].slice(0, MIN_TEMPLATES_PER_SUBCATEGORY);
}

function buildPromptTemplates(category, child) {
  return selectSourceEntriesForChild(category, child).map((entry) => ({
    id: entry.id,
    name: entry.name || entry.title,
    prompt: String(entry.prompt || "").trim(),
    categoryId: category.id,
    subcategoryId: child.id,
    categoryName: category.name,
    subcategoryName: child.name,
    previewKey: entry.id,
    previewAccent: category.accent,
    previewMotif: child.id,
    previewImage: entry.path,
    previewAlt: entry.alt || entry.name || entry.title || "",
    previewSourceUrl: entry.sourceUrl || "",
    previewSourcePage: entry.sourcePage || "",
  }));
}

export const PROMPT_TEMPLATE_LIBRARY = CATEGORY_DEFINITIONS.map((category) => ({
  ...category,
  children: category.children.map((child) => ({
    ...child,
    templates: buildPromptTemplates(category, child),
  })),
}));

export function flattenPromptTemplateLibrary({ categoryId = "", subcategoryId = "" } = {}) {
  const categories = categoryId
    ? PROMPT_TEMPLATE_LIBRARY.filter((category) => category.id === categoryId)
    : PROMPT_TEMPLATE_LIBRARY;
  const seen = new Set();
  return categories.flatMap((category) =>
    category.children
      .filter((child) => !subcategoryId || (category.id === categoryId && child.id === subcategoryId))
      .flatMap((child) => child.templates)
      .filter((template) => {
        if (seen.has(template.id)) {
          return false;
        }
        seen.add(template.id);
        return true;
      }),
  );
}

export function getPromptTemplateLibraryCategory(categoryId) {
  return PROMPT_TEMPLATE_LIBRARY.find((category) => category.id === categoryId) || PROMPT_TEMPLATE_LIBRARY[0] || null;
}

export function getPromptTemplateLibrarySubcategory(categoryId, subcategoryId) {
  return getPromptTemplateLibraryCategory(categoryId)?.children.find((child) => child.id === subcategoryId) || null;
}

export function getPromptTemplateLibraryCounts() {
  return {
    categories: PROMPT_TEMPLATE_LIBRARY.length,
    subcategories: PROMPT_TEMPLATE_LIBRARY.reduce((sum, category) => sum + category.children.length, 0),
    templates: new Set(flattenPromptTemplateLibrary().map((template) => template.id)).size,
  };
}

export function getPromptTemplatePreviewUrl(template) {
  return String(template?.previewImage || "");
}
