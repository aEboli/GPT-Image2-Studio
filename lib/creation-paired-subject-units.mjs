function cleanPairUnitText(value) {
  return String(value || "").trim();
}

const CHINESE_PAIR_NUMBER_WORDS = new Map([
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
const ENGLISH_PAIR_NUMBER_WORDS = new Map([
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

/* 套图里的“完整产品单位”是可售单位，不是可见零件数。一双 = 1 个单位。
   判定分三层，越靠前越确定：
   1. 明确分开售卖的说法（分别出售、两个 SKU、sold separately）——直接否定折算。
   2. 说明里写出的双数（一双、两副、2 pairs）——按双数取；与可见件数冲突时保留件数并标待确认。
   3. 成对品类约定（下表）+ 可见件数为偶数——按半折算；件数为奇数时保留件数并标待确认。
   新增品类只需在表里加一行，不要改判定逻辑。 */
export const CREATION_PAIRED_UNIT_CATEGORY_TABLE = [
  { id: "handwear", zh: ["手套", "手蹼", "拳套", "袖套", "臂套", "护腕", "腕带"], en: ["glove", "mitten", "boxing glove", "arm sleeve", "wristband", "wrist guard"] },
  { id: "footwear", zh: ["鞋", "靴", "拖鞋", "凉鞋", "鞋垫", "冰鞋", "冰刀"], en: ["shoe", "boot", "sandal", "slipper", "sneaker", "insole", "ice skate"] },
  { id: "hosiery", zh: ["袜"], en: ["sock", "stocking"] },
  { id: "earwear", zh: ["耳环", "耳钉", "耳坠", "耳夹", "耳机", "耳塞"], en: ["earring", "ear stud", "earbud", "earphone", "headphone"] },
  { id: "limb-guard", zh: ["护膝", "护肘", "护腿"], en: ["knee pad", "knee guard", "elbow pad", "shin guard"] },
  { id: "pole", zh: ["滑雪杖", "登山杖", "雪杖", "健走杖"], en: ["ski pole", "trekking pole", "walking pole"] },
  { id: "tableware", zh: ["筷子", "袖扣"], en: ["chopstick", "cufflink"] },
];

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${()|[\]\\]/g, "\\$&");
}

function buildPairedCategoryPattern(table = CREATION_PAIRED_UNIT_CATEGORY_TABLE) {
  const zhTerms = table.flatMap((entry) => entry.zh || []);
  const enTerms = table.flatMap((entry) => entry.en || []);
  const zhPattern = zhTerms.map(escapeRegExp).join("|");
  const enPattern = enTerms.map((term) => escapeRegExp(term) + "s?").join("|");
  return new RegExp("(?:" + zhPattern + ")|\\b(?:" + enPattern + ")\\b", "i");
}

const PAIRED_PRODUCT_PATTERN = buildPairedCategoryPattern();

/* 品类词也会出现在容器或配件名里：鞋盒、鞋柜、鞋架、袜盒、手套箱。
   这些不是商品本体，不能按成对折算。 */
const PAIRED_PRODUCT_EXCLUSION_PATTERN = /鞋盒|鞋柜|鞋架|鞋撑|袜盒|袜架|手套盒|手套箱|耳机盒|耳机套/i;

/* 成对表述：一双 / 一对 / 左右各一只 / a pair of / matching pair。
   只表示“这两件是配对的”，不单独决定单位数。 */
const PAIR_WORDING_PATTERN =
  /(?:(?:\d{1,2}|[一二两三四五六七八九十])\s*(?:双|对|副)|成双|成对|左右(?:手|脚)?(?:各)?(?:[一二两三四]|\d)\s*(?:只|个|条|支|片)|\bpairs?\b|\bas a pair\b|\bpaired\b|\bmatching pair\b)/i;
const PAIR_QUANTITY_PATTERN = /(\d{1,2}|[一二两三四五六七八九十])\s*(?:双|对|副)/g;
const PAIR_QUANTITY_ENGLISH_PATTERN =
  /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+pairs?\b/gi;
const PAIR_OF_ENGLISH_PATTERN = /\b(?:a|one)\s+pair\s+of\b/i;

/* 说明里同时写出件数时（两只 / 四只 / two pieces），件数必须等于双数的两倍；
   对不上说明说明本身自相矛盾，单位数不能靠猜。 */
const PIECE_QUANTITY_PATTERN = /(\d{1,2}|[一二两三四五六七八九十])\s*(?:只|条|件|支|片)/g;
const PIECE_QUANTITY_ENGLISH_PATTERN = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:pieces?|pcs)\b/gi;

/* 一件商品通常只对应一个尺码，出现两个不同尺码说明图里是两件独立商品。 */
const SIZE_CODE_PATTERN = /(?:^|[^\p{L}\p{N}])(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL)\s*(?:码|号|size)?(?=$|[^\p{L}\p{N}])/giu;
function getDistinctSizeCodeCount(text) {
  const codes = new Set();
  for (const match of text.matchAll(SIZE_CODE_PATTERN)) {
    codes.add(String(match[1] || "").toUpperCase());
  }
  return codes.size;
}

/* 明确按只卖：命中后不再折算，也不提示待确认，因为用户已经写清楚了。 */
const SEPARATE_UNIT_SALE_PATTERN =
  /分别(?:出售|售卖|销售|卖)|分开(?:出售|售卖)|单独(?:出售|售卖|卖)|单个(?:出售|售卖)|(?:两|2|二)\s*个\s*(?:独立)?\s*SKU|不同(?:颜色|配色|色款|尺码|码数|型号)|两种(?:颜色|配色)|(?:two|2)\s+(?:different\s+)?(?:colors?|colorways?|sizes?)|different\s+(?:colors?|colorways?|sizes?)|\b(?:sold\s+(?:separately|individually)|each\s+sold\s+separately|two\s+(?:separate|distinct)\s+(?:skus?|products?|units?))\b/i;

export const CREATION_PAIRED_SINGLE_UNIT_NOTE = "图中共 1 个完整产品单位（一双，左右各一只合为一双）。";
export function buildCreationPairedMultiUnitNote(unitCount) {
  return "图中共 " + unitCount + " 个完整产品单位（按双计数，每双算 1 个）。";
}

function parsePairQuantityToken(value) {
  const token = cleanPairUnitText(value).toLowerCase();
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return digitCount;
  }
  return CHINESE_PAIR_NUMBER_WORDS.get(token) || ENGLISH_PAIR_NUMBER_WORDS.get(token) || 0;
}

/* 说明里写出的可见件数，取最大：两只手套 → 2。返回 0 表示没有写。 */
export function getCreationPairedSubjectPieceQuantity(value = "") {
  const text = cleanPairUnitText(value);
  if (!text) {
    return 0;
  }
  const quantities = [];
  for (const match of text.matchAll(PIECE_QUANTITY_PATTERN)) {
    quantities.push(parsePairQuantityToken(match[1]));
  }
  for (const match of text.matchAll(PIECE_QUANTITY_ENGLISH_PATTERN)) {
    quantities.push(parsePairQuantityToken(match[1]));
  }
  return quantities.filter((count) => count > 0).reduce((max, count) => Math.max(max, count), 0);
}

export function isCreationPairedSellableSubject(value = "") {
  const text = cleanPairUnitText(value);
  if (!text) {
    return false;
  }
  return PAIRED_PRODUCT_PATTERN.test(text) && PAIR_WORDING_PATTERN.test(text);
}

/* 说明里声明的双数，多个写法取最大：一双……共两副 → 2。返回 0 表示没有声明。 */
export function getCreationPairedSubjectPairQuantity(value = "") {
  const text = cleanPairUnitText(value);
  if (!text) {
    return 0;
  }
  const quantities = [];
  for (const match of text.matchAll(PAIR_QUANTITY_PATTERN)) {
    quantities.push(parsePairQuantityToken(match[1]));
  }
  for (const match of text.matchAll(PAIR_QUANTITY_ENGLISH_PATTERN)) {
    quantities.push(parsePairQuantityToken(match[1]));
  }
  if (PAIR_OF_ENGLISH_PATTERN.test(text)) {
    quantities.push(1);
  }
  return quantities.filter((count) => count > 0).reduce((max, count) => Math.max(max, count), 0);
}

/* 结构化判定：调用方据此决定单位数、是否改写说明、是否提示用户确认。
   ambiguity 为空表示口径明确；非空表示保留可见件数、等用户确认。 */
export function resolveCreationSubjectUnitCount(value = "", unitCount = 0) {
  const text = cleanPairUnitText(value);
  const rawCount = Number.parseInt(String(unitCount ?? "").trim(), 10);
  const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
  const unchanged = { count, paired: false, ambiguity: "" };
  if (count <= 1 || !text) {
    return unchanged;
  }
  if (SEPARATE_UNIT_SALE_PATTERN.test(text) || getDistinctSizeCodeCount(text) > 1) {
    return unchanged;
  }
  const pairQuantity = getCreationPairedSubjectPairQuantity(text);
  if (pairQuantity > 0) {
    const pieceQuantity = getCreationPairedSubjectPieceQuantity(text);
    if (pieceQuantity >= 2 && pieceQuantity !== pairQuantity * 2) {
      return {
        count,
        paired: true,
        ambiguity:
          "说明同时写到 " + pieceQuantity + " 件和 " + pairQuantity + " 双，双数与件数对不上，暂按 " + count + " 个单位保留。",
      };
    }
    if (count === pairQuantity || count === pairQuantity * 2) {
      return { count: pairQuantity, paired: true, ambiguity: "" };
    }
    return {
      count,
      paired: true,
      ambiguity:
        "说明写到 " + pairQuantity + " 双，但识别到 " + count + " 个可见件，双数与件数对不上，暂按 " + count + " 个单位保留。",
    };
  }
  if (!PAIRED_PRODUCT_PATTERN.test(text) || PAIRED_PRODUCT_EXCLUSION_PATTERN.test(text)) {
    return unchanged;
  }
  if (count % 2 === 0) {
    return { count: count / 2, paired: true, ambiguity: "" };
  }
  return {
    count,
    paired: true,
    ambiguity:
      "识别到 " + count + " 个可见件，成对品类通常按双售卖，奇数无法整除，暂按 " + count + " 个单位保留。",
  };
}

/* 一双 = 1 个可售单位。说明写明双数时按双数取，否则按品类约定折算。 */
export function resolveCreationPairedSubjectUnitCount(value = "", unitCount = 0) {
  return resolveCreationSubjectUnitCount(value, unitCount).count;
}

/* 套图载荷沿用“0 表示单件”的旧约定，需要落库的调用方走这个包装。 */
export function normalizeCreationPairedSubjectUnitCount(value = "", unitCount = 0) {
  const count = resolveCreationSubjectUnitCount(value, unitCount).count;
  return count > 1 ? count : 0;
}

/* 一双是一个单位，颜色标签也只能有一条：左右同色合并为 black，
   左右异色合并为 black grey，与单个商品的多颜色标签写法一致。 */
export function collapseCreationPairedSubjectColorLabels(value = "", colorNames = [], unitCount = 0) {
  const labels = Array.isArray(colorNames) ? colorNames.map(cleanPairUnitText).filter(Boolean) : [];
  const resolvedCount = Number.parseInt(String(unitCount ?? "").trim(), 10);
  if (labels.length <= 1 || (Number.isFinite(resolvedCount) && resolvedCount > 1)) {
    return labels;
  }
  if (resolveCreationSubjectUnitCount(value, 2).count !== 1) {
    return labels;
  }
  const unique = [];
  labels.forEach((label) => {
    const key = label.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === key)) {
      unique.push(label);
    }
  });
  return [unique.join(" ")];
}
