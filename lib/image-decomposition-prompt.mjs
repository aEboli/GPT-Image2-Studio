export const IMAGE_DECOMPOSITION_MODE = "image-decomposition";
export const IMAGE_DECOMPOSITION_ASSET_KIND = "image-decomposition";
export const IMAGE_DECOMPOSITION_REFERENCE_LABEL =
  "Reference image 1: SOURCE image for identifying visible components. Do not render this label or any process/source disclaimer in the final image.";

const DEFAULT_LANGUAGE = {
  code: "zh-CN",
  label: "简体中文",
};

const LANGUAGE_ALIASES = new Map([
  ["zh", DEFAULT_LANGUAGE],
  ["zh-cn", DEFAULT_LANGUAGE],
  ["简体中文", DEFAULT_LANGUAGE],
  ["中文", DEFAULT_LANGUAGE],
  ["chinese", DEFAULT_LANGUAGE],
  ["en", { code: "en", label: "English" }],
  ["english", { code: "en", label: "English" }],
  ["ja", { code: "ja", label: "日本語" }],
  ["jp", { code: "ja", label: "日本語" }],
  ["日本語", { code: "ja", label: "日本語" }],
  ["日语", { code: "ja", label: "日本語" }],
  ["ko", { code: "ko", label: "한국어" }],
  ["kr", { code: "ko", label: "한국어" }],
  ["한국어", { code: "ko", label: "한국어" }],
  ["韩语", { code: "ko", label: "한국어" }],
  ["fr", { code: "fr", label: "Français" }],
  ["français", { code: "fr", label: "Français" }],
  ["french", { code: "fr", label: "Français" }],
  ["de", { code: "de", label: "Deutsch" }],
  ["deutsch", { code: "de", label: "Deutsch" }],
  ["german", { code: "de", label: "Deutsch" }],
  ["es", { code: "es", label: "Español" }],
  ["español", { code: "es", label: "Español" }],
  ["spanish", { code: "es", label: "Español" }],
]);

export function normalizeImageDecompositionLanguage(value = "", customLanguage = "") {
  const rawValue = String(value || "").trim();
  const rawCustom = String(customLanguage || "").trim();
  const normalized = rawValue.toLowerCase();

  if (normalized === "custom") {
    return rawCustom ? { code: "custom", label: rawCustom } : { ...DEFAULT_LANGUAGE };
  }

  const preset = LANGUAGE_ALIASES.get(normalized) || LANGUAGE_ALIASES.get(rawValue);
  if (preset) {
    return { ...preset };
  }

  if (rawValue) {
    return {
      code: "custom",
      label: rawValue,
    };
  }

  return { ...DEFAULT_LANGUAGE };
}

export function normalizeImageDecompositionFeatureCards(value = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

export function buildImageDecompositionPrompt({
  targetLanguage = "",
  customLanguage = "",
  featureCardsEnabled = false,
} = {}) {
  const language = normalizeImageDecompositionLanguage(targetLanguage, customLanguage);
  const includeFeatureCards = normalizeImageDecompositionFeatureCards(featureCardsEnabled);
  const featureCardsInstruction = includeFeatureCards
    ? "The final poster must include left and right side feature cards. Reserve narrow columns on both sides, place 4-8 side feature cards total balanced left and right, and give each card small icon-like sketches plus 1-2 short explanatory lines for visible feature groups. Do not leave the side margins empty."
    : "Do not render side feature cards, icon cards, or separate explanation columns; use direct callouts around the subject instead.";
  const featureCardsChinese = includeFeatureCards
    ? "必须在画面左右两侧放置说明卡片，总数约4到8个，左右均衡，每张卡片包含简洁图标和1到2行可见特征说明，不要让两侧留空。"
    : "不使用两侧说明卡片或图标说明栏，只围绕主体做直接标注。";
  const prompt = [
    "Create a polished annotated component breakdown poster from the uploaded image.",
    `All rendered labels, callouts, headings, and optional short notes must use ${language.label}.`,
    "Identify the major components, materials, parts, spatial groups, controls, surfaces, or visual features that are clearly visible in the uploaded image.",
    "Make the poster information-rich rather than sparse. When the subject has enough visible structure, use about 10-14 numbered component callouts.",
    "Use detailed callout boxes around the subject. Each callout box should contain a numbered marker, a specific visible part name, and 1-2 short explanatory lines describing visible material, color, shape, position, surface texture, connection, or apparent external function.",
    "Visible text should be limited to part names, numbered callouts, short explanatory descriptions, a subject-specific title when useful, and the side feature cards only when enabled.",
    "Use plain descriptor phrases without parentheses, colons, dashes, or decorative punctuation. Avoid generic source, process, or task titles that describe why the image was made instead of naming the subject.",
    featureCardsInstruction,
    "Do not add task explanations, source-reference captions, analysis disclaimers, generic poster subtitles, or any wording that describes why the image was made. Keep these constraints internal.",
    "Do not invent brands, model names, identities, ingredients, internal mechanisms, hidden parts, prices, certifications, provenance, or any content that cannot be seen in the uploaded image.",
    "If a component is uncertain, label it generically by visible form or material instead of guessing.",
    "Keep all text clear, correctly spelled, high contrast, and readable at normal viewing size. Avoid clutter, overlapping labels, and tiny typography.",
    "Favor a balanced poster composition with the subject central and separated detail callouts around it.",
    "",
    `中文要求：生成一张信息密度更高的拆解信息图，只标注上传图片中真实可见的组成部分；优先做约10到14个编号部件说明框，每个说明框包含部件名称和1到2行可见材质、颜色、形状、位置、纹理、连接关系或外部功能说明；不要加入任务说明、来源说明或免责声明；描述词使用普通短语，不用括号、冒号或破折号，不要编造品牌、身份或不可见内容，文字清晰可读。${featureCardsChinese}`,
  ].join("\n");

  return {
    prompt,
    targetLanguage: language.label,
    languageCode: language.code,
    featureCardsEnabled: includeFeatureCards,
  };
}
