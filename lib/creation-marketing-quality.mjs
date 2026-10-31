import { resolveCreationPlanCounts } from "./creation-plan-counts.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" ? value.trim() : "";
const ids = (value) => [...new Set(list(value).map(text).filter(Boolean))];

export const CREATION_MARKETING_VISUAL_FORMS = ["product-photograph", "use-scene", "macro-evidence", "functional-render", "commercial-cg", "information-layout", "contents-layout", "variant-layout"];
export const CREATION_MARKETING_TEXT_DENSITIES = ["none", "minimal", "structured"];
const string = { type: "string" };
const factIds = { type: "array", items: string };
export const CREATION_MARKETING_STRATEGY_SCHEMA = {
  type: "object", additionalProperties: false, required: ["core_buying_reason", "primary_fact_ids", "functional_proofs"],
  properties: {
    core_buying_reason: string, primary_fact_ids: factIds,
    functional_proofs: { type: "array", maxItems: 3, items: {
      type: "object", additionalProperties: false, required: ["fact_ids", "buyer_benefit", "visual_evidence"],
      properties: { fact_ids: factIds, buyer_benefit: string, visual_evidence: string },
    } },
  },
};

function normalize(value) {
  return text(value).toLowerCase().replace(/展示|呈现|体现|突出|强调|show|display/gu, "").replace(/[\p{P}\p{Z}\d\s]/gu, "");
}

function tokens(value) {
  const content = normalize(value);
  const common = new Set(["the", "and", "with", "from", "this", "that", "product", "show", "display", "image", "for", "into"]);
  const result = new Set((text(value).toLowerCase().match(/[a-z]{2,}/gu) || []).filter((token) => !common.has(token)));
  for (const part of content.match(/[\p{Script=Han}]+/gu) || []) {
    for (let index = 0; index < part.length - 1; index += 1) result.add(part.slice(index, index + 2));
  }
  return result;
}

function similarity(left, right) {
  if (!normalize(left) || !normalize(right)) return 0;
  if (normalize(left) === normalize(right)) return 1;
  const a = tokens(left); const b = tokens(right);
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / Math.max(1, a.size + b.size - shared);
}

function visibleInPrompt(visual, prompt) {
  const positive = (value) => text(value).replace(/(?:不要|禁止|不可|不能|避免|不显示|不展示|不渲染|do not|don't|without)[^。.;；\n]*/giu, "");
  const expected = tokens(positive(visual));
  const actual = tokens(positive(prompt));
  return expected.size >= 3 && [...expected].filter((token) => actual.has(token)).length / expected.size >= 0.6;
}

export function buildCreationMarketingQualityRequirements(plan = {}) {
  const functions = list(plan.productInsights?.confirmedFacts).filter((fact) => fact.kind === "function");
  const name = tokens(plan.productName);
  const selling = list(plan.productInsights?.sellingPoints);
  const frequency = new Map();
  for (const fact of functions) for (const token of tokens(fact.text)) frequency.set(token, (frequency.get(token) || 0) + 1);
  const ranked = functions.map((fact, index) => ({ fact, index,
    nameScore: [...tokens(fact.text)].filter((token) => name.has(token)).reduce((score, token) => score + 1 / frequency.get(token), 0),
    score: [...tokens(fact.text)].filter((token) => name.has(token)).reduce((score, token) => score + 10 / frequency.get(token), 0)
      + (selling.findIndex((point) => list(point.factIds).includes(fact.id)) >= 0
        ? 1 / (selling.findIndex((point) => list(point.factIds).includes(fact.id)) + 1) : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const namedFunctions = ranked.filter((entry) => ranked[0]?.nameScore > 0 && entry.nameScore >= ranked[0].nameScore * 0.8).slice(0, 3);
  return {
    primaryFunctionFactIds: (namedFunctions.length ? namedFunctions : ranked.slice(0, 1)).map(({ fact }) => fact.id),
    functionalFacts: functions.map(({ id, text }) => ({ id, text })),
    note: "依据商品功能和购买理由安排可见表现；功能名称、参数卡和事实引用不能代替功能画面。保留实物身份，效果是创意示意而非实测，不补造内部结构、数值或认证。",
  };
}

export function normalizeCreationMarketingStrategy(value, insights = {}) {
  if (!value) return null;
  const facts = list(insights.confirmedFacts);
  const validIds = new Set(facts.map((fact) => fact.id));
  const primary = ids(value.primary_fact_ids || value.primaryFactIds);
  const proofs = list(value.functional_proofs || value.functionalProofs).map((proof) => ({
    factIds: ids(proof.fact_ids || proof.factIds), buyerBenefit: text(proof.buyer_benefit || proof.buyerBenefit),
    visualEvidence: text(proof.visual_evidence || proof.visualEvidence),
  }));
  if (!text(value.core_buying_reason || value.coreBuyingReason)) throw new Error("整套营销策略缺少核心购买理由（core_buying_reason）。");
  if (!primary.length) throw new Error("整套营销策略缺少主要商品事实（primary_fact_ids）。");
  const invalidIds = [...new Set([...primary, ...proofs.flatMap((proof) => proof.factIds)].filter((id) => !validIds.has(id)))];
  if (invalidIds.length) throw new Error(`整套营销策略引用了无效商品事实：${invalidIds.join("、")}。请使用已确认事实 ID。`);
  if (proofs.length > 3) throw new Error("整套营销策略的功能表现超过 3 项，请保留核心功能。");
  for (const [index, proof] of proofs.entries()) {
    if (!proof.factIds.some((id) => facts.some((fact) => fact.id === id && fact.kind === "function"))) {
      throw new Error(`整套营销策略第 ${index + 1} 项功能表现未绑定已确认的功能事实（fact_ids）。`);
    }
    if (!proof.buyerBenefit || !proof.visualEvidence) throw new Error(`整套营销策略第 ${index + 1} 项功能表现缺少买家收益或画面说明。`);
  }
  return { coreBuyingReason: text(value.core_buying_reason || value.coreBuyingReason), primaryFactIds: primary, functionalProofs: proofs };
}

export function auditCreationMarketingQuality(plan = {}, { lockedItems = [], selectedRoles = [] } = {}) {
  const items = list(plan.items).filter((item) => item.itemKind === "carousel" && !item.evidenceBlocked);
  const requirements = buildCreationMarketingQualityRequirements(plan);
  const strategy = plan.marketingPlan?.suiteStrategy;
  const lockedIds = new Set(lockedItems.map((item) => item.item_id));
  const editable = (item) => !lockedIds.has(item.itemId) && !list(item.constraints).some((rule) => rule.level === "blocking");
  const issues = [];
  const add = (code, item, message, extra = {}) => issues.push({ code, itemId: item?.itemId || "", sourceIndex: item?.marketingAssignment?.sourceIndex || 0, message, ...extra });
  const briefOf = (item) => item.marketingAssignment?.creativeBrief || {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]; const brief = briefOf(item);
    if ((brief.visual_form === "functional-render" || (item.role === "atmosphere" || brief.visual_form === "commercial-cg") && text(brief.effect_visual)) && !list(plan.productInsights?.confirmedFacts).some((fact) => fact.kind === "function" && list(item.marketingAssignment?.factIds).includes(fact.id))) {
      add("unsupported-functional-render", item, "本图没有已确认的功能依据，不能添加功能光效或编造性能；请改为有来源的外观或用途任务。");
    }
    if (!lockedIds.has(item.itemId) && plan.promptPlanningMode === "ai-batch"
      && (!CREATION_MARKETING_VISUAL_FORMS.includes(brief.visual_form) || !CREATION_MARKETING_TEXT_DENSITIES.includes(brief.text_density) || !text(brief.new_information))) {
      add("brief-incomplete", item, "请明确本图视觉形式、文字密度和相对整套新增的信息。");
    }
    for (const previous of items.slice(0, index)) {
      const old = briefOf(previous);
      const sameGoal = similarity(item.marketingAssignment?.goal, previous.marketingAssignment?.goal) >= 0.85;
      const sameActionEvidence = similarity(brief.action, old.action) >= 0.75 && similarity(brief.evidence_focus, old.evidence_focus) >= 0.75
        && (brief.visual_form === old.visual_form || similarity(brief.framing, old.framing) >= 0.75);
      const sameInformation = similarity(brief.new_information, old.new_information) >= 0.85
        && similarity(brief.evidence_focus, old.evidence_focus) >= 0.6;
      if (sameGoal || sameActionEvidence || sameInformation) {
        const target = editable(item) ? item : editable(previous) ? previous : item;
        add("duplicate-task", target, `与第 ${previous.marketingAssignment?.sourceIndex || index} 张的购买问题、动作或证据表达重复；改变背景或用途措辞不能算新增任务。`, { similarItemId: previous.itemId });
        break;
      }
    }
  }
  if (items.length >= 5 && !selectedRoles.length) {
    const layouts = [];
    for (const item of items) {
      const brief = briefOf(item);
      if (!brief.visual_form || !brief.framing) continue;
      const group = layouts.find((entries) => {
        const first = briefOf(entries[0]);
        return brief.visual_form === first.visual_form && brief.text_density === first.text_density && similarity(brief.framing, first.framing) >= 0.65;
      });
      if (group) group.push(item); else layouts.push([item]);
    }
    for (const group of layouts) {
      const budget = Math.max(3, Math.floor(items.length * 0.6));
      if (group.length <= budget) continue;
      for (const item of group.filter(editable).slice(-(group.length - budget))) add("layout-repetition", item, "整套过多图片使用相同构图和文字密度；请按任务换成真实使用、局部证据或简洁产品表现，不能只换颜色。");
    }
  }
  const replacement = () => {
    const candidates = items.filter((item) => editable(item) && item.textPolicy !== "none" && item.logoPolicy !== "forbid-overlay");
    const allowed = candidates.filter((item) => !selectedRoles[item.marketingAssignment?.sourceIndex - 1]
      || ["hero", "effect-comparison"].includes(item.role));
    return allowed.find((item) => item.role === "effect-comparison")
      || allowed.find((item) => issues.some((issue) => issue.itemId === item.itemId)) || allowed.at(-1);
  };
  if (plan.marketingPlan?.strategyIssue) add("strategy-invalid", null, plan.marketingPlan.strategyIssue);
  else if (plan.promptPlanningMode === "ai-batch" && !strategy) add("strategy-missing", null, "请补齐整套主购买理由、主要事实和功能的可见表现，保留已通过的图片任务。");
  const primary = requirements.primaryFunctionFactIds;
  const coveredFactIds = primary.filter((id) => items.some((item) => {
    const brief = briefOf(item);
    return ["hero", "effect-comparison"].includes(item.role) && item.textPolicy !== "none" && list(item.marketingAssignment?.factIds).includes(id)
      && brief.visual_form === "functional-render" && text(brief.effect_visual).length >= 12
      && visibleInPrompt(brief.effect_visual, item.prompt);
  }));
  const missing = primary.filter((id) => !coveredFactIds.includes(id));
  const covered = !missing.length;
  if (!covered) add("functional-proof-missing", replacement(), "缺少核心功能的可见表现：需要完整商品上的作用、效果或收益表达，不能只列名称、参数或使用温暖背景；画面示意不能冒充实测。", { factIds: missing });
  if (strategy && primary.some((id) => !strategy.primaryFactIds.includes(id))) {
    add("core-benefit-missing", null, "主购买理由忽略了当前商品的核心功能，请以有事实支持的功能及买家收益统领整套。", { factIds: primary });
  }
  if (strategy && primary.some((id) => !strategy.functionalProofs.some((proof) => proof.factIds.includes(id)))) {
    add("strategy-proof-missing", null, "整套策略缺少核心功能的买家收益或画面说明，请补齐策略并保留已有功能画面。", { factIds: primary });
  }
  return { version: 1, requirements, functionalCoverage: { required: Boolean(primary.length), covered, requiredFactIds: primary, coveredFactIds },
    issues: issues.filter((issue, index) => issues.findIndex((other) => other.code === issue.code && other.itemId === issue.itemId) === index) };
}

export function finalizeCreationMarketingQuality(plan, quality, options = {}) {
  const unsupported = new Map(quality.issues.filter((issue) => issue.code === "unsupported-functional-render").map((issue) => [issue.itemId, issue]));
  const excluded = plan.items.filter((item) => unsupported.has(item.itemId));
  const required = excluded.find((item) => list(item.constraints).some((rule) => rule.level === "blocking"));
  if (required) throw Object.assign(new Error(`平台必需图“${required.title}”没有已确认的功能依据，请补充资料或更换图型。`), { marketingQuality: quality });
  const locked = excluded.find((item) => list(options.lockedItems).some((entry) => entry.item_id === item.itemId));
  if (locked) throw Object.assign(new Error(`用户锁定的图片“${locked.title}”没有已确认的功能依据，请补充资料或解除锁定后重新规划。`), { marketingQuality: quality });
  if (excluded.length) {
    const items = plan.items.filter((item) => !unsupported.has(item.itemId)).map((item, index) => ({ ...item, slotIndex: index + 1 }));
    const carousel = items.filter((item) => item.itemKind === "carousel");
    const validation = { ...plan.marketingPlan.validation, acceptedCount: carousel.length,
      removedItems: [...list(plan.marketingPlan.validation?.removedItems), ...excluded.map((item) => ({
        sourceIndex: item.marketingAssignment.sourceIndex, itemId: item.itemId, title: item.title, reason: unsupported.get(item.itemId).message,
      }))] };
    if (!carousel.length) throw Object.assign(new Error("AI 营销规划没有可用图片：功能表现缺少已确认依据，请补充资料或更换图型。"), { marketingValidation: validation, marketingQuality: quality });
    const counts = resolveCreationPlanCounts({ items });
    plan = { ...plan, ...counts, items, slots: carousel, selectedRoles: carousel.map((item) => item.role),
      platformSetOverrides: { ...plan.platformSetOverrides, imageCount: counts.imageCount },
      marketingPlan: { ...plan.marketingPlan, validation,
        duplicateRisks: list(plan.marketingPlan.duplicateRisks).filter((risk) => !unsupported.has(risk.itemId) && !unsupported.has(risk.similarItemId)) } };
    quality = { ...auditCreationMarketingQuality(plan, options), repairRounds: quality.repairRounds, repairs: quality.repairs };
  }
  const issues = quality.issues.map((issue) => ({ ...issue, severity: "warning" }));
  const warnings = issues.map((issue) => ({ code: `marketing-quality-${issue.code}`, level: "warning", itemId: issue.itemId, message: issue.message }));
  for (const item of excluded) warnings.push({ code: "marketing-item-excluded", level: "warning", itemId: item.itemId,
    message: `第 ${item.marketingAssignment.sourceIndex} 张“${item.title}”缺少功能依据，已单独跳过，其余有效图片可以继续生成。` });
  return { ...plan, marketingPlan: { ...plan.marketingPlan, quality: { ...quality, version: 2, issues,
    status: warnings.length ? "warning" : "passed", excludedItemIds: excluded.map((item) => item.itemId) } },
    warnings: [...list(plan.warnings).filter((warning) => !/^marketing-quality-|^marketing-item-excluded$/u.test(warning.code)), ...warnings] };
}
