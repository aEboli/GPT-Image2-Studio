import { extractCreationSkuColorNames, getCreationSkuColorNames } from "./creation-sku-colors.mjs";

const PACKAGE_SIGNAL = /(清单|包含|内含|配件|附件|套装|赠品|礼盒|包装|included|includes|package|contents|accessor)/iu;
const MEASUREMENT_VALUE = /\b\d+(?:\.\d+)?\s*(?:mm|cm|m|in(?:ch(?:es)?)?\.?|ft|feet|g|kg|oz|lbs?|ml|l)\b|\d+(?:\.\d+)?\s*(?:毫米|厘米|米|英寸|英尺|克|千克|公斤|毫升|升)/iu;
const SINGLE_VARIANT = /(?:仅|只有|单一|一种|1\s*(?:个|种))[^。；;\n]{0,16}(?:SKU|颜色|配色|款式|尺码)|\b(?:only one|single)\s+(?:sku|variant|color|colour|size|style)\b/iu;

function cleanString(value) {
  return String(value ?? "").trim();
}

function unique(values = []) {
  return [...new Set(values.map((value) => cleanString(value).toLowerCase()).filter(Boolean))];
}

// 一个标签可以包含商品本身的多种颜色；它仍然只代表一个可售变体。
export function getCreationEvidenceVariantLabels({ skuSubjects = [], sellingPoints = [], productDescription = "" } = {}) {
  const subjects = Array.isArray(skuSubjects) ? skuSubjects : [];
  if (subjects.length > 0) {
    const labels = [];
    const usedSources = new Set();
    for (const subject of subjects) {
      const sources = [
        ...(Array.isArray(subject.filenames) ? subject.filenames : []).map(cleanString).filter(Boolean).map((name) => `file:${name.toLowerCase()}`),
        ...(Array.isArray(subject.referenceIndexes) ? subject.referenceIndexes : []).filter((index) => Number(index) > 0).map((index) => `index:${index}`),
      ];
      if (sources.length === 0 || sources.some((source) => usedSources.has(source))) continue;
      sources.forEach((source) => usedSources.add(source));
      const colors = getCreationSkuColorNames(subject, { value: "en" });
      const groupedCount = Number(subject.subjectUnitCount) || 1;
      if (groupedCount > 1 && colors.length === groupedCount) {
        labels.push(...colors);
      } else {
        const color = unique(extractCreationSkuColorNames(colors.join(" "))).sort().join(" ");
        const dimensions = [subject.size, subject.model, subject.variant].map(cleanString).filter(Boolean).join(" ");
        if (color || dimensions) labels.push([color, dimensions].filter(Boolean).join(" / "));
      }
    }
    return unique(labels);
  }

  const text = [productDescription, ...(Array.isArray(sellingPoints) ? sellingPoints : [])].map(cleanString).join("\n");
  if (SINGLE_VARIANT.test(text)) return [];
  const labels = [];
  for (const line of text.split(/[\n;；。]+/u)) {
    const explicitList = line.match(/(?:颜色|色号|款式|尺码|型号|SKU|colors?|colours?|sizes?|styles?|variants?)\s*[:：]\s*(.+)/iu)
      || line.match(/(?:available in|可选(?:颜色)?[:：]?|颜色可选[:：]?)\s*(.+)/iu)
      || line.match(/^(.+?)(?:两种|[2-9]\s*种)(?:颜色|配色|款式)(?:可选)?/u);
    if (!explicitList) continue;
    const entries = explicitList[1].split(/\s*(?:[/、,，]|\band\b|\bor\b|和|及|与|或)\s*/iu)
      .map((entry) => entry.replace(/(?:两种|[2-9]\s*种)?(?:颜色|配色|款式)?可选.*$/u, "").trim())
      .filter(Boolean);
    if (entries.length >= 2) labels.push(...entries);
  }
  return unique(labels);
}

export function getCreationItemEvidenceRequirement({
  role = "",
  contentAssignment = null,
  productInsights = null,
  dimensionLines = [],
  skuSubjects = [],
  sellingPoints = [],
  productDescription = "",
} = {}) {
  const normalizedRole = cleanString(role);
  if (contentAssignment?.kind === "gap") return contentAssignment.evidenceRequirement || {
    code: "suite-content", label: "独立内容依据", message: "没有独立的内容依据，已跳过；请补充资料或减少张数。",
  };
  if (normalizedRole === "spec-table" && contentAssignment?.taskKey === "specifications") {
    const facts = productInsights?.confirmedFacts || [];
    if (facts.some((fact) => contentAssignment.factIds.includes(fact.id) && ["function", "spec"].includes(fact.kind) && /\d/u.test(fact.text))) return null;
  }
  if (["spec-table", "size-capacity-fit"].includes(normalizedRole)) {
    if ((Array.isArray(dimensionLines) ? dimensionLines : []).some((line) => MEASUREMENT_VALUE.test(cleanString(line)))) return null;
    return {
      code: "specifications",
      label: "规格参数",
      message: "没有可核实的尺寸或规格数值，已跳过生成，不消耗生图额度。",
    };
  }

  if (normalizedRole === "series-showcase") {
    if (getCreationEvidenceVariantLabels({ skuSubjects, sellingPoints, productDescription }).length >= 2) return null;
    return {
      code: "variants",
      label: "款式/颜色数据",
      message: "未提供至少两个不同的可售 SKU，已跳过多 SKU 图，不虚构颜色或款式，也不消耗生图额度。",
    };
  }

  return null;
}

export function isCreationPackageFactAvailable({ sellingPoints = [], referenceImageRoles = [] } = {}) {
  const facts = [
    ...(Array.isArray(sellingPoints) ? sellingPoints : []),
    ...(Array.isArray(referenceImageRoles) ? referenceImageRoles.map((entry) => cleanString(entry?.note)) : []),
  ].filter(Boolean);
  return facts.some((fact) => PACKAGE_SIGNAL.test(fact));
}
