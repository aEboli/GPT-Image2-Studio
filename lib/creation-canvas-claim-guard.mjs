export const CREATION_CANVAS_CLAIM_POLICY =
  "CANVAS CLAIM POLICY: canvas text names only what the product visibly is — name, material, size, quantity, color, and confirmed contents; performance, safety, certification, medical, price, and superiority wording stays off the canvas.";

const FIBER_SUFFIXES = ["棉", "羊毛", "真丝", "桑蚕丝", "亚麻", "涤纶", "锦纶", "尼龙", "聚酯", "氨纶", "麻", "丝", "绒"];

const MEDICAL_SUFFIXES = ["口罩", "胶带", "纱布", "棉签", "棉", "手套", "帽", "服", "绷带", "敷料", "贴", "器械"];

const SAFETY_SUFFIXES = [
  "帽", "座椅", "座", "带", "绳", "锁", "门", "窗", "网", "阀", "鞋", "服", "套", "锤", "栏", "杆",
  "钩", "扣", "夹", "垫", "箱", "柜", "架", "灯", "镜", "针", "剪", "刀", "插头", "插座", "开关",
  "气囊", "护栏", "栏杆", "手套", "眼镜", "护具", "背心", "头盔",
];

export const CREATION_CANVAS_CLAIM_GROUPS = Object.freeze([
  {
    id: "medical-efficacy",
    label: "医疗功效",
    pattern: /(治疗|治愈|疗效|消炎|祛痘|美白|淡斑|祛斑|抗皱|紧致提拉|减肥|瘦身|增高|助眠|防脱|生发|保健功效|药用|处方|医用级|医疗级|功效|紧致|淡纹|提亮|抗氧化|抗衰|呵护|肠胃|免疫|抵抗力|调理)/u,
    allowSuffixes: MEDICAL_SUFFIXES,
  },
  {
    id: "safety-claim",
    label: "安全卫生宣称",
    pattern: /(安全无毒|无毒无害|无毒|无害|零添加|纯天然|食品级|抗菌|抑菌|杀菌|除菌|防霉|抗螨|抗过敏|低敏|安全)/u,
    allowSuffixes: SAFETY_SUFFIXES,
  },
  {
    id: "certification",
    label: "认证背书",
    pattern: /(认证|官方推荐|官方授权|权威|临床验证|检测报告|专利|FDA|CE\s*认证|3C\s*认证)/u,
  },
  {
    id: "price-promo",
    label: "价格促销",
    pattern: /(全网最低价|最低价|全网最低|特价|到手价|优惠价|包邮|赠品|买一送一|\d+(?:\.\d+)?\s*折)/u,
  },
  {
    id: "absolute",
    label: "绝对化表述",
    pattern: /(销量第一|全网第一|行业第一|排名第一|第一品牌|百分百|百分之百|100\s*%|顶级|极致|爆款|绝对|(?:最好|最强|最大|最小|最低|最高))|(?:\d+(?:\.\d+)?\s*倍)/u,
    allowSuffixes: FIBER_SUFFIXES,
  },
]);

function startsWithSuffix(text, index, suffixes) {
  if (!Array.isArray(suffixes) || suffixes.length === 0) return false;
  const tail = text.slice(index);
  return suffixes.some((suffix) => tail.startsWith(suffix));
}

export function detectCreationCanvasClaims(value) {
  const text = String(value ?? "");
  if (!text.trim()) return [];
  const found = [];
  for (const group of CREATION_CANVAS_CLAIM_GROUPS) {
    const pattern = new RegExp(group.pattern.source, "gu");
    let match = pattern.exec(text);
    while (match) {
      const term = match[0];
      if (!startsWithSuffix(text, match.index + term.length, group.allowSuffixes)) {
        found.push({ group: group.id, groupLabel: group.label, term, index: match.index });
      }
      match = pattern.exec(text);
    }
  }
  return found.sort((left, right) => left.index - right.index);
}

export function stripCreationCanvasClaims(value) {
  const source = String(value ?? "").trim();
  if (!source) return { text: "", claims: [] };

  const claims = [];
  let text = source;
  for (const group of CREATION_CANVAS_CLAIM_GROUPS) {
    const pattern = new RegExp(group.pattern.source, "gu");
    let match = pattern.exec(text);
    while (match) {
      const term = match[0];
      const afterIndex = match.index + term.length;
      if (startsWithSuffix(text, afterIndex, group.allowSuffixes)) {
        match = pattern.exec(text);
        continue;
      }
      claims.push({ group: group.id, groupLabel: group.label, term });
      text = `${text.slice(0, match.index)} ${text.slice(afterIndex)}`;
      pattern.lastIndex = match.index;
      match = pattern.exec(text);
    }
  }

  return {
    text: text.replace(/\s{2,}/gu, " ").replace(/^[\s、,，;；:：]+|[\s、,，;；:：]+$/gu, "").trim(),
    claims,
  };
}

export function summarizeCreationCanvasClaims(claims = []) {
  const terms = [...new Set(claims.map((claim) => claim.term).filter(Boolean))];
  return { count: claims.length, terms };
}
