// Builds the human-readable part of a generated image filename.
// Slots follow a where/who/do-what order so a folder of files reads like a shot
// list: 1542-女士室内大提琴拍摄.png
export const IMAGE_NAME_MIN_LENGTH = 6;
export const IMAGE_NAME_MAX_LENGTH = 10;

// Names stay short and literal: 6 to 10 characters built from what the prompt's
// first clauses actually say, never padded to reach a length.
const LEADING_SCOPE_CHARS = 120;
const LEADING_SCOPE_CLAUSES = 2;
// A type word only supplies a topic when it opens the leading clause.
const TOPIC_ANCHOR_WINDOW = 30;
const TOPIC_MAX_CHARS = 5;

const WHO_RULES = [
  ["情侣", /情侣|夫妻|闺蜜|双胞胎/u],
  ["女士", /女性|女士|女子|女生|女孩|少女|姑娘|美女|妈妈|母亲|姐姐|妹妹|阿姨|新娘|女王|公主|女仆/u],
  ["男士", /男性|男士|男子|男生|男孩|少年|帅哥|爸爸|父亲|哥哥|弟弟|大叔|爷爷|新郎|骑士|王子/u],
  ["儿童", /宝宝|婴儿|儿童|小朋友|小孩|孩子|幼儿|幼童/u],
  ["猫咪", /猫咪|小猫/u],
  ["小狗", /小狗|柴犬|狗狗/u],
];

const WHERE_RULES = [
  ["影棚", /影棚|摄影棚|棚拍|studio/iu],
  ["办公室", /办公室|办公桌|工位/u],
  ["咖啡厅", /咖啡厅|咖啡馆|咖啡店/u],
  ["厨房", /厨房/u],
  ["卧室", /卧室|床上|床边|床沿/u],
  ["客厅", /客厅|沙发/u],
  ["浴室", /浴室|浴缸|淋浴/u],
  ["温泉", /温泉/u],
  ["阳台", /阳台|露台/u],
  ["花园", /花园|庭院|花田/u],
  ["图书馆", /图书馆|书房/u],
  ["书店", /书店/u],
  ["教室", /教室/u],
  ["健身房", /健身房|体育馆/u],
  ["泳池", /泳池|游泳池/u],
  ["舞台", /舞台|演唱会/u],
  ["商场", /商场|购物中心|超市/u],
  ["市集", /市集|夜市|集市|菜市场/u],
  ["展厅", /展厅|美术馆|画展|展览/u],
  ["会议室", /会议室/u],
  ["工作室", /工作室/u],
  ["酒吧", /酒吧|酒馆/u],
  ["餐厅", /餐厅|餐桌|饭桌/u],
  ["机场", /机场|候机/u],
  ["地铁", /地铁/u],
  ["车内", /车内|车里|驾驶座|副驾驶/u],
  ["街头", /街头|街道|街边|街拍|马路|城市|都市|巷口|斑马线/u],
  ["海边", /海边|海滩|沙滩|海浪/u],
  ["湖畔", /湖畔|湖边|湖面/u],
  ["河边", /河边|溪流|溪边|河岸/u],
  ["森林", /森林|树林|林地/u],
  ["草地", /草地|草原|草坪/u],
  ["沙漠", /沙漠|沙丘/u],
  ["雪山", /雪山|雪地|雪原/u],
  ["山顶", /山顶|山间|山谷|山地|山野/u],
  ["古镇", /古镇|古城|胡同|古建筑|故宫|寺庙/u],
  ["天台", /天台|屋顶/u],
  ["夜景", /夜景|夜晚|星空|霓虹|月光/u],
  ["雨天", /雨天|雨中|下雨/u],
  ["户外", /户外|室外|野外/u],
  ["室内", /室内|屋内|家里|家中|房间/u],
];

const PROP_RULES = [
  ["大提琴", /大提琴/u],
  ["小提琴", /小提琴/u],
  ["钢琴", /钢琴/u],
  ["吉他", /吉他/u],
  ["咖啡", /咖啡/u],
  ["鲜花", /鲜花|花束|花朵/u],
  ["书本", /书本|书籍/u],
  ["墨镜", /墨镜|太阳镜/u],
  ["耳机", /耳机/u],
  ["手机", /手机|智能手机/u],
  ["电脑", /笔记本|电脑/u],
  ["礼盒", /礼盒|礼包/u],
  ["香水", /香水/u],
  ["口红", /口红|唇膏/u],
  ["球鞋", /球鞋|运动鞋|跑鞋/u],
  ["背包", /背包|双肩包/u],
  ["雨伞", /雨伞/u],
  ["连衣裙", /连衣裙/u],
  ["衬衫", /衬衫/u],
  ["外套", /外套|夹克/u],
  ["帽子", /帽子/u],
  ["美食", /美食|料理|甜点|蛋糕/u],
];

const ACTION_RULES = [
  ["自拍", /自拍/u],
  ["演奏", /演奏|拉琴|弹奏/u],
  ["托腮", /托腮|手托下巴|托着下巴/u],
  ["阅读", /阅读|读书|看书/u],
  ["喝咖啡", /喝咖啡|端着咖啡/u],
  ["举杯", /举杯|碰杯/u],
  ["拥抱", /拥抱|抱着/u],
  ["徒步", /徒步|登山|hiking/iu],
  ["漫步", /漫步|散步|行走|走在/u],
  ["奔跑", /奔跑|跑步/u],
  ["办公", /办公|打字/u],
  ["冥想", /冥想|打坐/u],
  ["瑜伽", /瑜伽/u],
  ["舞蹈", /跳舞|舞蹈|芭蕾/u],
  ["展示", /展示|陈列|手持/u],
  ["特写", /特写|近景/u],
  ["人像", /人像|肖像/u],
  ["街拍", /街拍|抓拍/u],
  ["拍摄", /拍摄|摄影|照片|镜头|拍照|写真/u],
];

// Posture and expression words are the last resort for the "do what" slot; a real
// action such as reading or playing an instrument describes the picture better.
const POSE_RULES = [
  ["微笑", /微笑|笑容/u],
  ["站立", /站立|站着|站在|伫立/u],
  ["坐姿", /坐着|坐在|坐姿/u],
];

// A picture type only fills the "do what" slot when the prompt has no action, so
// "生成一张海报：女士在咖啡厅看书" is named after the reading scene, not the poster.
const TYPE_RULES = [
  ["海报", /海报/u],
  ["插画", /插画|绘本/u],
  ["信息图", /信息图|图解|资讯图/u],
  ["爆炸视图", /爆炸视图|拆解图|分解图/u],
  ["样机", /样机|mockup/iu],
  ["图标", /图标|头像/u],
  ["幻灯片", /slides|幻灯片/iu],
  ["地图", /地图/u],
];

const TYPE_WORDS = ["海报", "插画", "信息图", "爆炸视图", "样机", "图标", "幻灯片", "地图", "特写", "街拍"];
// Style and boilerplate words add length without describing the picture, so the
// fallback topic skips them before borrowing characters from the prompt.
const NOISE_TERMS = [
  "生成一张", "生成一幅", "生成一个", "生成一组", "生成", "创建一张", "创建一个", "创建", "制作一张", "制作",
  "请帮我", "帮我", "请", "一张", "一幅", "一个", "一组", "一套", "画面中", "画面", "图片", "图像",
  "照片", "摄影", "拍摄", "风格", "写实", "超写实", "商业", "提示词", "主题", "主要主体", "人像", "特写",
  "混合", "极简", "极简主义", "高清", "电影感", "高质量", "精致", "柔和",
];

const NOISE_TERMS_BY_LENGTH = [...NOISE_TERMS].sort((left, right) => right.length - left.length);

function normalizePrompt(prompt) {
  return String(prompt || "")
    .replace(/\{argument[^}]*?default="([^"]*)"[^}]*\}/gu, " $1 ")
    .replace(/[“”‘’【】（）《》〈〉「」『』]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function leadingScope(text) {
  const clauses = text
    .split(/[。！？；;\n]/u)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .slice(0, LEADING_SCOPE_CLAUSES);
  const scope = clauses.join(" ").slice(0, LEADING_SCOPE_CHARS).trim();
  return scope || text.slice(0, LEADING_SCOPE_CHARS);
}

function findAll(rules, text) {
  const found = [];
  for (const [label, pattern] of rules) {
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const matcher = new RegExp(pattern.source, flags);
    let match = matcher.exec(text);
    while (match) {
      found.push({ label, index: match.index, length: match[0].length });
      if (!match[0].length) {
        matcher.lastIndex += 1;
      }
      match = matcher.exec(text);
    }
  }
  return found.sort((left, right) => left.index - right.index || right.length - left.length);
}

function overlaps(candidate, spans) {
  return spans.some(
    (span) => candidate.index < span.index + span.length && span.index < candidate.index + candidate.length,
  );
}

// The leading clause describes the picture; anything later is styling detail.
function findFirst(rules, text, skipSpans = []) {
  return findAll(rules, text).find((candidate) => !overlaps(candidate, skipSpans)) || null;
}

function stripNoise(value) {
  let result = String(value || "");
  for (const term of NOISE_TERMS_BY_LENGTH) {
    result = result.replaceAll(term, " ");
  }
  return trimStopwords(result.replace(/[^\p{Script=Han}]+/gu, "").trim());
}

// Only grammatical particles are trimmed; characters like 中 and 上 also start
// ordinary nouns (中秋节, 上市) and must stay.
function trimStopwords(value) {
  return String(value || "")
    .replace(/^[的了在是和与着把被让使]+/u, "")
    .replace(/[的了在是和与着把被让使]+$/u, "");
}

// Borrows the closest characters in front of the matched word so a two character
// type word like 信息图 still becomes a readable topic such as 污水处理厂信息图.
function topicBefore(scope, match, maxChars) {
  const cleaned = stripNoise(scope.slice(0, match.index));
  const keep = Math.min(cleaned.length, maxChars);
  return trimStopwords(cleaned.slice(cleaned.length - keep));
}

function dedupeLabels(labels) {
  const seen = new Set();
  return labels.filter((label) => {
    if (!label || seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
}

export function buildImageFilenameDescriptor(prompt) {
  const text = normalizePrompt(prompt);
  if (!text) {
    return "";
  }
  const scope = leadingScope(text);
  if (!scope) {
    return "";
  }

  const answered = [];
  const take = (rules) => {
    const match = findFirst(rules, scope, answered);
    if (match) {
      answered.push(match);
    }
    return match;
  };

  const who = take(WHO_RULES);
  let where = take(WHERE_RULES);
  let prop = take(PROP_RULES);
  let what = take(ACTION_RULES) || take(POSE_RULES) || take(TYPE_RULES);
  // "街头 + 街拍" would repeat the same idea in one name, so a do-what word that
  // starts like the background or prop word is dropped.
  if (what && [where, prop].some((match) => match && match.label[0] === what.label[0])) {
    what = null;
  }

  const labels = () => dedupeLabels([who, where, prop, what].map((match) => (match ? match.label : "")));
  let name = labels().join("");

  const droppable = () => [where, prop, what].filter(Boolean);
  while (name.length > IMAGE_NAME_MAX_LENGTH) {
    const next = droppable().pop();
    if (!next) {
      break;
    }
    if (next === where) where = null;
    if (next === prop) prop = null;
    if (next === what) what = null;
    name = labels().join("");
  }

  const hasSubject = Boolean(who || where || prop);
  if (!hasSubject) {
    // Without a subject the only reliable anchor is a picture type that opens the
    // leading clause; generic verbs would borrow unrelated characters.
    const isTypeAnchor = what && TYPE_WORDS.includes(what.label) && what.index <= TOPIC_ANCHOR_WINDOW;
    const head = isTypeAnchor
      ? topicBefore(scope, what, Math.min(TOPIC_MAX_CHARS, IMAGE_NAME_MAX_LENGTH - what.label.length))
      : "";
    name = isTypeAnchor ? (head + what.label).slice(0, IMAGE_NAME_MAX_LENGTH) : "";
  }

  if (name.length < 2 || (who && name === who.label)) {
    return "";
  }
  return name.slice(0, IMAGE_NAME_MAX_LENGTH);
}
