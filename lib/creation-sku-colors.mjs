function cleanString(value) {
  return String(value || "").trim();
}

function escapeRegExp(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CREATION_SKU_COLOR_NAME_OPTIONS = [
  { zh: "玫瑰金色", en: "rose gold", tokens: ["玫瑰金色", "玫瑰金", "rose gold", "roségold", "oro rosa", "ローズゴールド", "로즈 골드"] },
  { zh: "酒红色", en: "burgundy", tokens: ["酒红色", "酒红", "勃艮第", "burgundy", "bordeaux", "burdeos", "weinrot", "バーガンディ", "버건디"] },
  { zh: "深红色", en: "deep red", tokens: ["深红色", "深红", "dark red", "deep red", "rouge foncé", "dunkelrot", "rojo oscuro", "ダークレッド", "진한 빨강"] },
  { zh: "珊瑚色", en: "coral", tokens: ["珊瑚色", "coral", "corail", "koralle", "coral", "コーラル", "코랄"] },
  { zh: "桃色", en: "peach", tokens: ["桃色", "蜜桃色", "peach", "pêche", "pfirsich", "melocotón", "ピーチ", "피치"] },
  { zh: "粉色", en: "pink", tokens: ["粉色", "粉红色", "粉红", "pink", "rose pink", "rose", "rosa", "ピンク", "분홍색"] },
  { zh: "红色", en: "red", tokens: ["红色", "red", "scarlet", "crimson", "rouge", "rot", "rojo", "レッド", "빨간색", "레드"] },
  { zh: "橙色", en: "orange", tokens: ["橙色", "orange", "naranja", "オレンジ", "주황색"] },
  { zh: "黄色", en: "yellow", tokens: ["黄色", "yellow", "jaune", "gelb", "amarillo", "イエロー", "노란색"] },
  { zh: "香槟色", en: "champagne", tokens: ["香槟色", "香槟金", "champagne", "champagner", "champán", "シャンパン", "샴페인"] },
  { zh: "古铜色", en: "bronze", tokens: ["古铜色", "青铜色", "bronze", "bronce", "ブロンズ", "브론즈"] },
  { zh: "铜色", en: "copper", tokens: ["铜色", "铜红色", "copper", "cuivre", "kupfer", "cobre", "カッパー", "구리색"] },
  { zh: "金色", en: "gold", tokens: ["金色", "gold", "golden", "doré", "dorado", "ゴールド", "골드"] },
  { zh: "橄榄绿色", en: "olive green", tokens: ["橄榄绿色", "橄榄绿", "olive green", "olive", "vert olive", "olivgrün", "verde oliva", "オリーブグリーン", "올리브 그린"] },
  { zh: "森林绿色", en: "forest green", tokens: ["森林绿色", "森林绿", "forest green", "vert forêt", "waldgrün", "verde bosque", "フォレストグリーン", "포레스트 그린"] },
  { zh: "祖母绿色", en: "emerald green", tokens: ["祖母绿色", "祖母绿", "emerald green", "emerald", "vert émeraude", "smaragdgrün", "verde esmeralda", "エメラルドグリーン", "에메랄드 그린"] },
  { zh: "薄荷绿色", en: "mint green", tokens: ["薄荷绿色", "薄荷绿", "mint green", "mint", "vert menthe", "mintgrün", "verde menta", "ミントグリーン", "민트 그린"] },
  { zh: "青柠绿色", en: "lime green", tokens: ["青柠绿色", "青柠绿", "lime green", "lime", "vert citron", "limettengrün", "verde lima", "ライムグリーン", "라임 그린"] },
  { zh: "绿色", en: "green", tokens: ["绿色", "green", "vert", "grün", "verde", "グリーン", "緑", "초록색", "그린"] },
  { zh: "深蓝色", en: "navy blue", tokens: ["深蓝色", "深蓝", "藏蓝色", "藏蓝", "海军蓝", "navy blue", "navy", "dark blue", "deep blue", "bleu marine", "marineblau", "azul marino", "ネイビーブルー", "네이비 블루"] },
  { zh: "天蓝色", en: "sky blue", tokens: ["天蓝色", "天蓝", "浅蓝色", "浅蓝", "sky blue", "light blue", "bleu ciel", "hellblau", "azul cielo", "azul claro", "スカイブルー", "하늘색"] },
  { zh: "亮蓝色", en: "cyan blue", tokens: ["亮蓝色", "亮蓝", "青蓝色", "青蓝", "湖蓝色", "湖蓝", "cyan blue", "cyan", "bright blue", "aqua blue", "aqua", "turquoise blue", "turquoise", "cyan", "türkis", "cian", "ターコイズ", "청록색"] },
  { zh: "蓝绿色", en: "teal", tokens: ["蓝绿色", "蓝绿", "teal", "bleu sarcelle", "petrol", "verde azulado", "ティール", "틸"] },
  { zh: "蓝色", en: "blue", tokens: ["蓝色", "blue", "bleu", "blau", "azul", "ブルー", "파란색", "블루"] },
  { zh: "薰衣草紫色", en: "lavender", tokens: ["薰衣草紫色", "薰衣草紫", "lavender", "lavande", "lavendel", "lavanda", "ラベンダー", "라벤더"] },
  { zh: "洋红色", en: "magenta", tokens: ["洋红色", "品红色", "magenta", "マゼンタ", "마젠타"] },
  { zh: "紫色", en: "purple", tokens: ["紫色", "purple", "violet", "lila", "morado", "violeta", "パープル", "보라색", "퍼플"] },
  { zh: "棕褐色", en: "tan", tokens: ["棕褐色", "黄褐色", "tan", "fauve", "hellbraun", "tostado", "タン", "황갈색"] },
  { zh: "卡其色", en: "khaki", tokens: ["卡其色", "khaki", "kaki", "カーキ", "카키"] },
  { zh: "棕色", en: "brown", tokens: ["棕色", "褐色", "brown", "brun", "braun", "marrón", "ブラウン", "茶色", "갈색", "브라운"] },
  { zh: "米色", en: "beige", tokens: ["米色", "beige", "ベージュ", "베이지"] },
  { zh: "奶油色", en: "cream", tokens: ["奶油色", "cream", "crème", "creme", "crema", "クリーム", "크림색"] },
  { zh: "象牙色", en: "ivory", tokens: ["象牙色", "ivory", "ivoire", "elfenbein", "marfil", "アイボリー", "아이보리"] },
  { zh: "炭灰色", en: "charcoal", tokens: ["炭灰色", "炭灰", "charcoal", "anthracite", "anthrazit", "antracita", "チャコール", "차콜"] },
  { zh: "浅灰色", en: "light gray", tokens: ["浅灰色", "浅灰", "light gray", "light grey", "gris clair", "hellgrau", "gris claro", "ライトグレー", "연회색"] },
  { zh: "灰色", en: "gray", tokens: ["灰色", "gray", "grey", "gris", "grau", "グレー", "회색"] },
  { zh: "银色", en: "silver", tokens: ["银色", "silver", "argent", "silber", "plateado", "シルバー", "은색"] },
  { zh: "黑色", en: "black", tokens: ["黑色", "black", "noir", "schwarz", "negro", "ブラック", "黒", "검은색", "블랙"] },
  { zh: "米白色", en: "off-white", tokens: ["米白色", "灰白色", "off-white", "off white", "blanc cassé", "cremeweiß", "blanco roto", "オフホワイト", "오프화이트"] },
  { zh: "白色", en: "white", tokens: ["白色", "white", "blanc", "weiß", "weiss", "blanco", "ホワイト", "흰색", "화이트"] },
  { zh: "透明色", en: "clear", tokens: ["透明色", "透明", "clear", "transparent", "translucent", "透明", "투명"] },
];

function isBoundaryMatchedToken(token) {
  return !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(token);
}

const CJK_COLOR_CONTEXT_PREFIX_PATTERN = /(?:颜色|配色|色款|色系|主色|外观|表面|涂层)\s*[:：=]?\s*$/u;
const CJK_COLOR_CONTEXT_SUFFIX_PATTERN = /^(?:色)?(?:款|配色|色系|外观|外壳|壳体|主体|机身|框架|镜框|镜片|绑带|带子|表带|鞋面|鞋|衣|服|裤|裙|帽|背包|包|手袋|箱|盒|瓶|杯|车|路亚|鱼饵|拟饵|产品|商品|部件|组件|材质|涂层|表面|结构|版本|型号|选项|可选|扣|扣件)/u;
const CJK_SCRIPT_CHARACTER_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function isContextSafeCjkColorMatch(source, start, end) {
  const before = source.slice(0, start);
  const after = source.slice(end);
  const previousCharacter = Array.from(before).at(-1) || "";
  const nextCharacter = Array.from(after)[0] || "";
  if (!CJK_SCRIPT_CHARACTER_PATTERN.test(previousCharacter) && !CJK_SCRIPT_CHARACTER_PATTERN.test(nextCharacter)) {
    return true;
  }
  return CJK_COLOR_CONTEXT_PREFIX_PATTERN.test(before) || CJK_COLOR_CONTEXT_SUFFIX_PATTERN.test(after);
}

export function findCreationSkuColorTokenMatches(source, token) {
  const normalizedToken = cleanString(token).toLowerCase();
  if (!source || !normalizedToken) {
    return [];
  }
  if (!isBoundaryMatchedToken(normalizedToken)) {
    const matches = [];
    const normalizedSource = source.toLowerCase();
    let start = normalizedSource.indexOf(normalizedToken);
    while (start >= 0) {
      const end = start + normalizedToken.length;
      if (isContextSafeCjkColorMatch(source, start, end)) {
        matches.push({ start, end });
      }
      start = normalizedSource.indexOf(normalizedToken, start + normalizedToken.length);
    }
    return matches;
  }

  const tokenPattern = escapeRegExp(normalizedToken).replace(/\s+/g, "[\\s-]+");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${tokenPattern})(?=$|[^\\p{L}\\p{N}])`, "giu");
  const matches = [];
  for (const match of source.matchAll(pattern)) {
    const prefixLength = match[1]?.length || 0;
    const start = (match.index || 0) + prefixLength;
    matches.push({ start, end: start + match[2].length });
  }
  return matches;
}

function normalizeCreationSkuColorName(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .replace(/-+/g, "-")
    .replace(/(?<![\p{L}\p{N}])-|-(?![\p{L}\p{N}])/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCreationSkuColorNames(value) {
  const source = cleanString(value);
  if (!source) {
    return [];
  }

  const candidates = CREATION_SKU_COLOR_NAME_OPTIONS.flatMap((option, optionIndex) =>
    option.tokens.flatMap((token) =>
      findCreationSkuColorTokenMatches(source, token).map(({ start, end }) => ({
        optionIndex,
        start,
        end,
        colorName: normalizeCreationSkuColorName(source.slice(start, end)),
      })),
    ),
  ).sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));

  const selected = [];
  const seenOptions = new Set();
  for (const candidate of candidates) {
    if (seenOptions.has(candidate.optionIndex)) {
      continue;
    }
    const overlaps = selected.some((entry) => candidate.start < entry.end && candidate.end > entry.start);
    if (overlaps) {
      continue;
    }
    selected.push(candidate);
    seenOptions.add(candidate.optionIndex);
  }

  return selected.sort((left, right) => left.start - right.start).map((entry) => entry.colorName);
}

function splitCreationSkuColorLabels(value) {
  return cleanString(value)
    .split(/[,\uFF0C\u3001;\uFF1B|/]+|\s+(?:and|&)\s+/i)
    .map(cleanString)
    .filter(Boolean);
}

export function normalizeCreationSkuColorLabels(value, splitScalar = false) {
  const isStructured = Array.isArray(value);
  const rawLabels = isStructured
    ? value.map(cleanString).filter(Boolean)
    : splitScalar
      ? splitCreationSkuColorLabels(value)
      : cleanString(value)
        ? [cleanString(value)]
        : [];
  const normalized = rawLabels.map((label) => extractCreationSkuColorNames(label).join(" "));

  if (isStructured) {
    return normalized.some((label) => !label) ? [] : normalized;
  }

  const seen = new Set();
  return normalized.filter((label) => {
    const key = label.toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
