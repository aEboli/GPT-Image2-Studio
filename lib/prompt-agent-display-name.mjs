const PROMPT_AGENT_DISPLAY_NAME_MAX_LENGTH = 40;
const IMAGE_FILENAME_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/iu;
const LEGACY_PROMPT_AGENT_ANALYSIS_FIELDS = [
  "title",
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
];

const HUMAN_SUBJECT_SIGNALS = [
  { pattern: /年轻(?:成年)?女性|年轻女性/u, label: "年轻女性" },
  { pattern: /年轻(?:成年)?男性|年轻男性/u, label: "年轻男性" },
  { pattern: /老年女性|老妇人/u, label: "老年女性" },
  { pattern: /老年男性|老先生/u, label: "老年男性" },
  { pattern: /成年女性/u, label: "成年女性" },
  { pattern: /成年男性/u, label: "成年男性" },
  { pattern: /女生|女孩|少女/u, label: "女生" },
  { pattern: /男生|男孩|少年/u, label: "男生" },
  { pattern: /婴儿|宝宝/u, label: "婴儿" },
  { pattern: /儿童|孩子/u, label: "儿童" },
  { pattern: /情侣/u, label: "情侣" },
  { pattern: /夫妻/u, label: "夫妻" },
  { pattern: /家庭|一家人/u, label: "家庭" },
  { pattern: /女性|女人/u, label: "女性" },
  { pattern: /男性|男人/u, label: "男性" },
];

const SUBJECT_ACTION_SIGNALS = [
  { pattern: /仰躺|平躺|侧躺|躺在|躺卧|躺着/u, label: "躺卧" },
  { pattern: /雨伞|伞面|伞柄|撑伞|打伞/u, label: "打伞" },
  { pattern: /看(?:着)?手机|查看(?:手机|屏幕)|使用(?:智能)?手机|操作(?:智能)?手机|手机屏幕/u, label: "看手机" },
  { pattern: /骑(?:自行车|单车)|骑行/u, label: "骑行" },
  { pattern: /跑步|奔跑/u, label: "跑步" },
  { pattern: /散步|行走|走路/u, label: "行走" },
  { pattern: /阅读|看书|读书/u, label: "看书" },
  { pattern: /弹(?:奏)?吉他|吉他演奏/u, label: "弹吉他" },
  { pattern: /拍照|摄影相机|举起相机/u, label: "拍照" },
  { pattern: /做饭|烹饪|切菜/u, label: "烹饪" },
  { pattern: /跳舞|舞蹈/u, label: "跳舞" },
];

const TIME_SIGNALS = [
  { pattern: /深夜/u, label: "深夜" },
  { pattern: /夜晚|夜间|夜景/u, label: "夜晚" },
  { pattern: /傍晚|黄昏|日落/u, label: "傍晚" },
  { pattern: /清晨|黎明|日出|早晨/u, label: "清晨" },
  { pattern: /午后|下午/u, label: "午后" },
  { pattern: /中午|正午/u, label: "中午" },
];

const WEATHER_SIGNALS = [
  { pattern: /雨中|下雨|雨天|雨滴|雨幕|降雨/u, label: "雨中" },
  { pattern: /雨后|雨水打湿|地面[^，。；]{0,8}(?:湿润|湿透|湿滑)/u, label: "雨后" },
  { pattern: /雪中|下雪|雪天|飘雪/u, label: "雪中" },
  { pattern: /雾天|大雾|雾气/u, label: "雾天" },
  { pattern: /阴天|阴云/u, label: "阴天" },
  { pattern: /晴天|晴朗/u, label: "晴天" },
];

const ENVIRONMENT_PLACE_SIGNALS = [
  { pattern: /庭院/u, label: "庭院" },
  { pattern: /花园/u, label: "花园" },
  { pattern: /步道/u, label: "步道" },
  { pattern: /街道|街头/u, label: "街道" },
  { pattern: /小巷|巷子/u, label: "小巷" },
  { pattern: /公园/u, label: "公园" },
  { pattern: /广场/u, label: "广场" },
  { pattern: /海边|海岸/u, label: "海边" },
  { pattern: /沙滩/u, label: "沙滩" },
  { pattern: /森林|林间/u, label: "森林" },
  { pattern: /山地|山野|山间/u, label: "山野" },
  { pattern: /草地|草坪/u, label: "草地" },
  { pattern: /咖啡馆|咖啡店/u, label: "咖啡馆" },
  { pattern: /床铺|床面|床单|床上/u, label: "床铺" },
  { pattern: /卧室/u, label: "卧室" },
  { pattern: /客厅/u, label: "客厅" },
  { pattern: /厨房/u, label: "厨房" },
  { pattern: /办公室/u, label: "办公室" },
  { pattern: /工作室/u, label: "工作室" },
  { pattern: /餐厅/u, label: "餐厅" },
  { pattern: /车站|站台/u, label: "车站" },
  { pattern: /天台|屋顶/u, label: "天台" },
  { pattern: /阳台/u, label: "阳台" },
];

const ENVIRONMENT_OBJECT_SIGNALS = [
  { pattern: /霓虹灯/u, label: "霓虹灯" },
  { pattern: /街灯/u, label: "街灯" },
  { pattern: /路灯/u, label: "路灯" },
  { pattern: /地灯/u, label: "地灯" },
  { pattern: /窗框|窗户/u, label: "窗框" },
  { pattern: /门框|门洞/u, label: "门框" },
  { pattern: /长凳|木凳|木椅/u, label: "长凳" },
  { pattern: /石质矮墙|石墙/u, label: "石墙" },
  { pattern: /砖墙/u, label: "砖墙" },
  { pattern: /斑驳[^，。；]{0,6}墙|旧墙|水泥墙/u, label: "旧墙" },
  { pattern: /灌木/u, label: "灌木" },
  { pattern: /建筑窗光|窗光/u, label: "窗光" },
  { pattern: /纸巾盒|抽纸盒|纸团/u, label: "纸巾盒" },
];

function normalizeDisplayNamePart(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .replace(/^[\s，。；：、|/·_-]+|[\s，。；：、|/·_-]+$/gu, "")
    .trim();
}

function truncateDisplayName(value, limit = PROMPT_AGENT_DISPLAY_NAME_MAX_LENGTH) {
  const normalized = normalizeDisplayNamePart(value);
  const characters = Array.from(normalized);
  return characters.length <= limit ? normalized : `${characters.slice(0, limit - 1).join("")}…`;
}

function stringifyDisplayNameSource(value) {
  if (Array.isArray(value)) {
    return value.map(stringifyDisplayNameSource).filter(Boolean).join(" ");
  }
  return typeof value === "string" ? normalizeDisplayNamePart(value) : "";
}

function findDisplayNameSignal(source, signals) {
  return signals.find((signal) => signal.pattern.test(source))?.label || "";
}

function findDisplayNameSignals(source, signals, limit) {
  const labels = [];
  signals.forEach((signal) => {
    if (labels.length >= limit || !signal.pattern.test(source) || labels.includes(signal.label)) {
      return;
    }
    labels.push(signal.label);
  });
  return labels;
}

function getPromptAgentSubjectLabel(subject) {
  const type = normalizeDisplayNamePart(subject?.type);
  const normalizedType = type
    .replace(/^(?:一位|一名|一个|一只|一辆|一组|一对)\s*/u, "")
    .replace(/(?:主体|人像|照片|图像|摄影作品|摄影)$/u, "");
  const humanLabel = findDisplayNameSignal(type, HUMAN_SUBJECT_SIGNALS);
  if (humanLabel) {
    const specificHumanType = normalizeDisplayNamePart(
      normalizedType
        .slice(normalizedType.lastIndexOf("的") + 1)
        .replace(/(?:人物|角色|形象|人像)$/u, ""),
    );
    return truncateDisplayName(specificHumanType || humanLabel, 18);
  }
  return truncateDisplayName(normalizedType, 18);
}

function getPromptAgentSubjectAction(subject, subjectSource) {
  const knownAction = findDisplayNameSignal(subjectSource, SUBJECT_ACTION_SIGNALS);
  if (knownAction) {
    return knownAction;
  }

  const interactionSource = [subject?.interaction, subject?.appearance]
    .map(stringifyDisplayNameSource)
    .filter(Boolean)
    .join(" ");
  const propMatch = interactionSource.match(
    /(手持|拿着|握住|握持|撑着|抱着|背着|提着|佩戴着?|戴着)([^，。；：、]{1,12})/u,
  );
  if (!propMatch) {
    return "";
  }

  const verb = /^(?:拿着|握住|握持)$/u.test(propMatch[1]) ? "手持" : propMatch[1].replace(/着$/u, "");
  const object = normalizeDisplayNamePart(propMatch[2].replace(/(?:并|同时|且).*/u, ""));
  return truncateDisplayName(`${verb}${object}`, 12);
}

export function isStructuredImagePromptJson(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.subject &&
    typeof value.subject === "object" &&
    !Array.isArray(value.subject) &&
    value.framing &&
    typeof value.framing === "object" &&
    !Array.isArray(value.framing) &&
    Object.hasOwn(value, "scene") &&
    Object.hasOwn(value, "visual") &&
    Array.isArray(value.avoid)
  );
}

function hasMeaningfulLegacyPromptAgentValue(value) {
  if (typeof value === "string") {
    return Boolean(value.trim());
  }
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulLegacyPromptAgentValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(hasMeaningfulLegacyPromptAgentValue);
  }
  return false;
}

export function getLegacyPromptAgentTemplatePrompt(template, json) {
  if (
    !String(template?.id || "").startsWith("prompt-agent-") ||
    !json ||
    typeof json !== "object" ||
    Array.isArray(json)
  ) {
    return "";
  }
  const prompt = String(json.prompt || "").trim();
  const legacyFieldCount = LEGACY_PROMPT_AGENT_ANALYSIS_FIELDS.filter((field) => (
    Object.hasOwn(json, field) && hasMeaningfulLegacyPromptAgentValue(json[field])
  )).length;
  return prompt && legacyFieldCount >= 3 ? prompt : "";
}

export function stripImageFilenameExtension(value) {
  const filename = String(value || "").trim().split(/[\\/]/u).pop() || "";
  return filename.replace(IMAGE_FILENAME_EXTENSION_PATTERN, "").replace(/[.\s]+$/u, "").trim();
}

export function isFilenameLikePromptTemplateName(value) {
  return IMAGE_FILENAME_EXTENSION_PATTERN.test(String(value || "").trim());
}

export function getStructuredImagePromptDisplayName(json) {
  if (!isStructuredImagePromptJson(json)) {
    return "";
  }

  const subject = json.subject;
  const subjectSource = [
    subject.type,
    subject.pose,
    subject.expression,
    subject.appearance,
    subject.clothing,
    subject.interaction,
  ]
    .map(stringifyDisplayNameSource)
    .filter(Boolean)
    .join(" ");
  const sceneSource = stringifyDisplayNameSource(json.scene);
  const visualSource = stringifyDisplayNameSource(json.visual);
  const environmentSource = [json.framing?.foreground_frame, sceneSource]
    .map(stringifyDisplayNameSource)
    .filter(Boolean)
    .join(" ");

  const primaryParts = [
    findDisplayNameSignal(`${sceneSource} ${visualSource}`, TIME_SIGNALS),
    findDisplayNameSignal(`${subjectSource} ${sceneSource} ${visualSource}`, WEATHER_SIGNALS),
    getPromptAgentSubjectAction(subject, subjectSource),
    getPromptAgentSubjectLabel(subject),
  ].filter((part, index, parts) => part && parts.indexOf(part) === index);
  const primaryName = primaryParts.join("");

  const place = findDisplayNameSignal(sceneSource, ENVIRONMENT_PLACE_SIGNALS);
  const environmentObjects = findDisplayNameSignals(environmentSource, ENVIRONMENT_OBJECT_SIGNALS, place ? 1 : 2);
  const environmentParts = [place, ...environmentObjects].filter(
    (part, index, parts) =>
      part &&
      parts.indexOf(part) === index &&
      !primaryName.includes(part),
  );
  const environmentName = environmentParts.join("");

  return truncateDisplayName([primaryName, environmentName].filter(Boolean).join("·"));
}

export function getPromptAgentDisplayName(item) {
  const title = normalizeDisplayNamePart(item?.json?.title);
  if (title) {
    return truncateDisplayName(title);
  }
  const structuredName = getStructuredImagePromptDisplayName(item?.json);
  if (structuredName) {
    return structuredName;
  }
  return truncateDisplayName(stripImageFilenameExtension(item?.filename)) || "图片反推 JSON";
}

export function getPromptAgentTemplateDisplayName(template, json, index = 0) {
  const currentName = normalizeDisplayNamePart(template?.name) || `模板 ${index + 1}`;
  if (
    !String(template?.id || "").startsWith("prompt-agent-") ||
    !isFilenameLikePromptTemplateName(currentName)
  ) {
    return currentName;
  }
  return getPromptAgentDisplayName({ json, filename: currentName });
}
