/*
 * Prompt Kit 的共享分类定义。
 * 分类和 YouMind 官网的 imageCategories 一一对应；importer 和浏览器端
 * 使用同一份 id/slug，避免数据抓取与界面筛选各维护一套分类。
 */

export const PROMPT_TEMPLATE_SOURCES = Object.freeze([
  { id: "all", name: "全部来源", shortName: "全部" },
  { id: "gpt-image-2.5", name: "GPT Image 2.5", shortName: "2.5" },
  { id: "gpt-image-2", name: "GPT Image 2", shortName: "2" },
]);

export const PROMPT_TEMPLATE_SOURCE_IDS = Object.freeze(
  PROMPT_TEMPLATE_SOURCES.filter((source) => source.id !== "all").map((source) => source.id),
);

export const PROMPT_TEMPLATE_DISCOVERY_CATEGORY = Object.freeze({
  id: "discovery",
  name: "全部模板",
  description: "先浏览全部配对案例，再按场景、风格和主体收窄",
  accent: "#a85c3b",
  children: Object.freeze([
    { id: "featured", name: "编辑精选", kind: "featured" },
    { id: "reference", name: "需参考图", kind: "reference" },
    { id: "text-only", name: "无需参考图", kind: "text-only" },
  ]),
});

export const PROMPT_TEMPLATE_DIMENSIONS = Object.freeze([
  {
    id: "usage-scenario",
    name: "使用场景",
    description: "按图片最终要用在哪里筛选",
    accent: "#a85c3b",
    sourceDimension: "useCases",
    children: Object.freeze([
      { id: "personal-avatar", name: "个人资料 / 头像", sourceId: 8 },
      { id: "social-post", name: "社交媒体配图", sourceId: 5 },
      { id: "infographic-education", name: "信息图 / 教育视觉", sourceId: 9 },
      { id: "youtube-thumbnail", name: "YouTube 缩略图 / 封面", sourceId: 10 },
      { id: "comic-storyboard", name: "漫画 / 分镜故事板", sourceId: 11 },
      { id: "product-marketing", name: "产品营销", sourceId: 12 },
      { id: "ecommerce-main-image", name: "电商主图", sourceId: 13 },
      { id: "game-assets", name: "游戏素材", sourceId: 14 },
      { id: "poster-flyer", name: "海报 / 传单", sourceId: 15 },
      { id: "app-web-design", name: "App / 网页设计", sourceId: 16 },
    ]),
  },
  {
    id: "visual-style",
    name: "风格",
    description: "按画面语言和渲染方式筛选",
    accent: "#587b8c",
    sourceDimension: "styles",
    children: Object.freeze([
      { id: "photography", name: "摄影", sourceId: 17 },
      { id: "film-still", name: "电影剧照", sourceId: 18 },
      { id: "anime-manga", name: "日漫 / 动画", sourceId: 19 },
      { id: "illustration", name: "插画", sourceId: 20 },
      { id: "sketch-line-art", name: "草图 / 线稿", sourceId: 21 },
      { id: "comic-graphic-novel", name: "欧美漫画 / 图像小说", sourceId: 22 },
      { id: "3d-render", name: "3D 渲染", sourceId: 23 },
      { id: "cute-chibi", name: "Q 版 / 萌系", sourceId: 24 },
      { id: "isometric", name: "等距视图", sourceId: 25 },
      { id: "pixel-art", name: "像素艺术", sourceId: 26 },
      { id: "oil-painting", name: "油画", sourceId: 27 },
      { id: "watercolor", name: "水彩画", sourceId: 28 },
      { id: "ink-chinese-style", name: "水墨 / 国风", sourceId: 29 },
      { id: "retro-vintage", name: "复古 / 胶片", sourceId: 30 },
      { id: "cyberpunk-scifi", name: "赛博朋克 / 科幻", sourceId: 31 },
      { id: "minimalism", name: "极简主义", sourceId: 32 },
    ]),
  },
  {
    id: "subject",
    name: "主体",
    description: "按画面里的主要对象筛选",
    accent: "#6d5a82",
    sourceDimension: "subjects",
    children: Object.freeze([
      { id: "portrait-selfie", name: "人像 / 自拍", sourceId: 33 },
      { id: "influencer-model", name: "模特 / 网红", sourceId: 34 },
      { id: "character", name: "角色 / IP", sourceId: 35 },
      { id: "group-couple", name: "情侣 / 群像", sourceId: 36 },
      { id: "product", name: "产品", sourceId: 37 },
      { id: "food-drink", name: "美食 / 饮品", sourceId: 38 },
      { id: "fashion-item", name: "时尚单品", sourceId: 39 },
      { id: "animal-creature", name: "动物 / 生物", sourceId: 40 },
      { id: "vehicle", name: "车辆", sourceId: 41 },
      { id: "architecture-interior", name: "建筑 / 室内", sourceId: 42 },
      { id: "landscape-nature", name: "风景 / 自然", sourceId: 43 },
      { id: "city-street", name: "城市 / 街景", sourceId: 44 },
      { id: "chart", name: "图表 / 图解", sourceId: 45 },
      { id: "text-layout", name: "文字 / 排版", sourceId: 46 },
      { id: "summary-background", name: "抽象 / 纹理背景", sourceId: 47 },
    ]),
  },
]);

export const PROMPT_TEMPLATE_CATEGORIES = Object.freeze([
  PROMPT_TEMPLATE_DISCOVERY_CATEGORY,
  ...PROMPT_TEMPLATE_DIMENSIONS,
]);

export const PROMPT_TEMPLATE_SOURCE_CATEGORY_MAP = Object.freeze(
  PROMPT_TEMPLATE_DIMENSIONS.reduce((map, dimension) => {
    for (const child of dimension.children) {
      map[child.sourceId] = {
        dimension: dimension.sourceDimension,
        id: child.id,
        name: child.name,
      };
    }
    return map;
  }, {}),
);
