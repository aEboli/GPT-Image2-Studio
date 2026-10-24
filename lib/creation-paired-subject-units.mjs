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

/* 套图里的“完整产品单位”是可售单位，不是可见零件数。
   成对售卖的左右套装（手套、鞋、袜、耳环、护腕等）在买家手里是一双，
   左右两只合起来只算 1 个完整产品单位。分析指令和归一化两侧共用这一份判定，
   否则同一张图会同时出现“两只组成一双”和“2 个完整产品单位”两种说法。 */
const PAIRED_PRODUCT_PATTERN =
  /(?:手套|手蹼|袖套|臂套|护腕|腕带|护膝|护肘|护腿|鞋|靴|拖鞋|袜|耳环|耳钉|耳坠|耳饰|耳机|耳塞|筷子|滑雪杖|拳套|鞋垫|冰刀)|\b(?:gloves?|mittens?|shoes?|boots?|sneakers?|sandals?|slippers?|socks?|stockings?|earrings?|earbuds?|headphones?|wristbands?|wrist\s?guards?|knee\s?pads?|knee\s?guards?|elbow\s?pads?|arm\s?sleeves?|shin\s?guards?|chopsticks?|ski\s?poles?|boxing\s?gloves?)\b/i;
const PAIR_WORDING_PATTERN =
  /(?:(?:\d{1,2}|[一二两三四五六七八九十])\s*(?:双|对|副)|成双|成对|左右(?:手|脚)?(?:各)?(?:[一二两三四]|\d)\s*(?:只|个|条|支|片)|\bpairs?\b|\bas a pair\b|\bpaired\b)/i;
const PAIR_QUANTITY_PATTERN = /(\d{1,2}|[一二两三四五六七八九十])\s*(?:双|对|副)/;
const PAIR_QUANTITY_ENGLISH_PATTERN =
  /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+pairs?\b/i;

export const CREATION_PAIRED_SINGLE_UNIT_NOTE = "图中共 1 个完整产品单位（一双，左右各一只合为一双）。";

export function isCreationPairedSellableSubject(value = "") {
  const text = cleanPairUnitText(value);
  if (!text) {
    return false;
  }
  return PAIRED_PRODUCT_PATTERN.test(text) && PAIR_WORDING_PATTERN.test(text);
}

export function getCreationPairedSubjectPairQuantity(value = "") {
  const text = cleanPairUnitText(value);
  const match = text.match(PAIR_QUANTITY_PATTERN) || text.match(PAIR_QUANTITY_ENGLISH_PATTERN);
  if (!match) {
    return 0;
  }
  const token = cleanPairUnitText(match[1]).toLowerCase();
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return digitCount;
  }
  return CHINESE_PAIR_NUMBER_WORDS.get(token) || ENGLISH_PAIR_NUMBER_WORDS.get(token) || 0;
}

/* 一双 = 1 个可售单位。文字已写明双数时按双数取，否则把件数折成双数，
   例如“两只手套组成一双”由 2 变 1，“四只手套组成两双”保持 2。 */
export function resolveCreationPairedSubjectUnitCount(value = "", unitCount = 0) {
  const rawCount = Number.parseInt(String(unitCount ?? "").trim(), 10);
  const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
  if (count <= 1 || !isCreationPairedSellableSubject(value)) {
    return count;
  }
  const pairQuantity = getCreationPairedSubjectPairQuantity(value);
  if (pairQuantity > 0) {
    return Math.max(1, Math.min(count, pairQuantity));
  }
  return Math.max(1, Math.ceil(count / 2));
}

/* 套图载荷沿用“0 表示单件”的旧约定，需要落库的调用方走这个包装，
   以免把一双写成 subjectUnitCount: 1 后又被下游当成显式多数单位。 */
export function normalizeCreationPairedSubjectUnitCount(value = "", unitCount = 0) {
  const count = resolveCreationPairedSubjectUnitCount(value, unitCount);
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
  if (!isCreationPairedSellableSubject(value)) {
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
