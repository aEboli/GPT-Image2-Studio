import { resolveCreationPlanCounts } from "./creation-plan-counts.mjs";
import { getCreationSceneActionGroup, isCreationUseSceneTask } from "./creation-product-insights.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" ? value.trim() : "";
const ids = (value) => [...new Set(list(value).map(text).filter(Boolean))];

export const CREATION_MARKETING_VISUAL_FORMS = ["product-photograph", "use-scene", "macro-evidence", "functional-render", "commercial-cg", "information-layout", "contents-layout", "variant-layout"];
export const CREATION_MARKETING_TEXT_DENSITIES = ["none", "minimal", "structured"];
const MAX_SIMILAR_IMAGES = 2;
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

function visualPromptContent(value) {
  return text(value).toLowerCase()
    .replace(/(?:画布文案|画布文字|标题文案|新增文案|overlay text|on-image text|headline|caption)\s*[:：]\s*(?:"[^"]*"|“[^”]*”|'[^']*'|[^\n。.;；]+)/gu, "")
    .replace(/(?:第\s*\d+\s*(?:张|个|幅)|\b(?:image|scene|option|variation)\s*(?:#|no\.?)?\s*\d+)\s*(?:独立营销画面)?/gu, "");
}

function visualPromptKey(value) {
  return visualPromptContent(value).replace(/[\p{P}\p{Z}\s]/gu, "");
}

function authoredPromptOf(item) {
  const authored = text(item.marketingAssignment?.authoredPrompt);
  return authored && text(item.prompt).includes(authored) ? authored : "";
}

function nearScenePrompts(left, right) {
  const a = visualPromptContent(authoredPromptOf(left));
  const b = visualPromptContent(authoredPromptOf(right));
  if (!a || !b || !isCreationUseSceneTask(left) || !isCreationUseSceneTask(right)) return false;
  const numbers = (value) => (value.match(/\d+(?:[.,]\d+)?/gu) || []).sort().join("|");
  if (numbers(a) !== numbers(b)) return false;
  // 共同保真描述可能很长；双方都改写了实际内容时，不凭全文重叠率作高置信判断。
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start += 1;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA -= 1; endB -= 1; }
  if (normalize(a.slice(start, endA)) && normalize(b.slice(start, endB))) return false;
  const action = getCreationSceneActionGroup({ action: a });
  return Boolean(action && action === getCreationSceneActionGroup({ action: b }) && similarity(a, b) >= 0.8);
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

function framingSignature(value) {
  const raw = text(value).toLowerCase();
  const match = (rules) => rules.findIndex((rule) => rule.test(raw));
  return {
    distance: match([/微距|macro/u, /近景|特写|近距离|close[ -]?up/u, /中景|medium shot/u, /全景|远景|wide|establishing/u, /完整|全貌|full product/u]),
    angle: match([/俯拍|俯视|top[ -]?down|overhead/u, /侧面|侧向|side view/u, /正面|正视|front view/u, /过肩|over[ -]the[ -]shoulder/u]),
    layout: match([/拼图|多格|多面板|collage|multi[ -]?panel/u, /分屏|左右对比|split[ -]?screen/u]),
  };
}

function framingMatches(left, right) {
  const a = framingSignature(left); const b = framingSignature(right);
  if (a.distance >= 0 && b.distance >= 0 && a.distance !== b.distance
    || a.angle >= 0 && b.angle >= 0 && a.angle !== b.angle || a.layout !== b.layout) return false;
  if (similarity(left, right) >= 0.8) return true;
  return a.distance >= 0 && a.distance === b.distance && a.layout === b.layout
    && (a.angle === b.angle || a.angle < 0 || b.angle < 0);
}

function similarVisualTask(left, right, functionFactIds) {
  const a = left.marketingAssignment?.creativeBrief || {};
  const b = right.marketingAssignment?.creativeBrief || {};
  if (isCreationUseSceneTask(left) || isCreationUseSceneTask(right)) return false;
  if (!framingMatches(a.framing, b.framing)) return false;
  const renderForms = ["functional-render", "commercial-cg"];
  if (renderForms.includes(a.visual_form) && renderForms.includes(b.visual_form)) {
    const floating = (brief) => /悬浮|漂浮|悬空|\b(?:float\w*|suspend\w*|levitat\w*)\b/iu.test(text(brief.action)
      .replace(/(?:不要|禁止|不能|避免|不|\b(?:do not|don't|without|no|not)\s+)[^，,。.;；\n]*/giu, ""));
    const sharedFunction = list(left.marketingAssignment?.factIds).some((id) => functionFactIds.has(id) && list(right.marketingAssignment?.factIds).includes(id));
    if (floating(a) && floating(b) && sharedFunction && similarity(a.effect_visual, b.effect_visual) >= 0.45) return true;
  }
  if (!a.visual_form || a.visual_form !== b.visual_form) return false;
  const dimensions = (brief) => /尺寸|尺码|长宽|宽度|高度|选码|dimension|measurement|size/iu.test(text(brief.action) + " " + text(brief.evidence_focus));
  return similarity(a.action, b.action) >= 0.75 || similarity(a.evidence_focus, b.evidence_focus) >= 0.8
    || a.visual_form === "information-layout" && dimensions(a) && dimensions(b);
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
    maxSimilarImages: MAX_SIMILAR_IMAGES,
    sceneDivergence: "creative-context",
    maxImagesPerScene: 1,
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
  const add = (code, item, message, extra = {}) => {
    const issue = { code, itemId: item?.itemId || "", sourceIndex: item?.marketingAssignment?.sourceIndex || 0, message, ...extra };
    const index = issues.findIndex((entry) => entry.code === code && entry.itemId === issue.itemId);
    if (index < 0) issues.push(issue);
    else if (extra.confidence === "high") issues[index] = issue;
  };
  const briefOf = (item) => item.marketingAssignment?.creativeBrief || {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]; const brief = briefOf(item);
    const promptKey = visualPromptKey(item.prompt);
    const authoredKey = visualPromptKey(authoredPromptOf(item));
    if ((brief.visual_form === "functional-render" || (item.role === "atmosphere" || brief.visual_form === "commercial-cg") && text(brief.effect_visual)) && !list(plan.productInsights?.confirmedFacts).some((fact) => fact.kind === "function" && list(item.marketingAssignment?.factIds).includes(fact.id))) {
      add("unsupported-functional-render", item, "本图没有已确认的功能依据，不能添加功能光效或编造性能；请改为有来源的外观或用途任务。");
    }
    if (!lockedIds.has(item.itemId) && plan.promptPlanningMode === "ai-batch"
      && (!CREATION_MARKETING_VISUAL_FORMS.includes(brief.visual_form) || !CREATION_MARKETING_TEXT_DENSITIES.includes(brief.text_density) || !text(brief.new_information))) {
      add("brief-incomplete", item, "请明确本图视觉形式、文字密度和相对整套新增的信息。");
    }
    for (const previous of items.slice(0, index)) {
      const old = briefOf(previous);
      const repeatedPrompt = Boolean(promptKey && promptKey === visualPromptKey(previous.prompt)
        || authoredKey && authoredKey === visualPromptKey(authoredPromptOf(previous)) || nearScenePrompts(item, previous));
      const sameGoal = similarity(item.marketingAssignment?.goal, previous.marketingAssignment?.goal) >= 0.85;
      const sameActionEvidence = similarity(brief.action, old.action) >= 0.75 && similarity(brief.evidence_focus, old.evidence_focus) >= 0.75
        && (brief.visual_form === old.visual_form || similarity(brief.framing, old.framing) >= 0.75);
      const sameInformation = similarity(brief.new_information, old.new_information) >= 0.85
        && similarity(brief.evidence_focus, old.evidence_focus) >= 0.6;
      const actionGroup = getCreationSceneActionGroup(brief);
      const action = getCreationSceneActionGroup({ action: brief.action });
      const sameFraming = framingMatches(brief.framing, old.framing);
      const bothUseScenes = isCreationUseSceneTask(item) && isCreationUseSceneTask(previous);
      const repeatedUse = bothUseScenes
        && (actionGroup && actionGroup === getCreationSceneActionGroup(old)
          || action && action === getCreationSceneActionGroup({ action: old.action }));
      const renderForms = ["functional-render", "commercial-cg"];
      const repeatedRender = renderForms.includes(brief.visual_form) && renderForms.includes(old.visual_form) && sameFraming
        && similarity(brief.action, old.action) >= 0.85 && similarity(brief.effect_visual, old.effect_visual) >= 0.8;
      if (repeatedPrompt || !bothUseScenes && (sameGoal || sameActionEvidence || sameInformation) || repeatedUse || repeatedRender) {
        const target = editable(item) ? item : editable(previous) ? previous : item;
        const similar = target === item ? previous : item;
        add("duplicate-task", target, repeatedPrompt
          ? `与第 ${similar.marketingAssignment?.sourceIndex || index + 1} 张的实际画面提示词相同或高度近似，仍在描绘同一操作；改序号、修饰词或画布文案不能形成新画面。请在提示词阶段重写具体场景、动作或镜头，不能只改分工摘要。`
          : repeatedUse ? `与第 ${similar.marketingAssignment?.sourceIndex || index + 1} 张重复同一核心操作场景；同一场景只能出现一次，换机位、背景、人物、标题或卖点不算新场景。请围绕产品真实用途改为不同的生活任务，符合现实使用条件。`
          : `与第 ${similar.marketingAssignment?.sourceIndex || index + 1} 张的购买问题、动作或证据表达重复；改变背景或用途措辞不能算新增任务。`, {
          similarItemId: similar.itemId, confidence: repeatedPrompt || repeatedUse || repeatedRender ? "high" : "advisory",
          ...(repeatedPrompt ? { basis: "prompt" } : {}),
        });
        if (repeatedPrompt || repeatedUse || repeatedRender) break;
      }
    }
  }
  const visualGroups = [];
  const functionFactIds = new Set(requirements.functionalFacts.map((fact) => fact.id));
  for (const item of items) {
    const group = visualGroups.find((entries) => entries.every((entry) => similarVisualTask(item, entry, functionFactIds)));
    if (group) group.push(item); else visualGroups.push([item]);
  }
  for (const group of visualGroups) {
    if (group.length <= MAX_SIMILAR_IMAGES) continue;
    // 锁定项和平台必需项优先占位，超出的自动项必须换成不同画面任务。
    const ordered = [...group.filter((item) => !editable(item)), ...group.filter(editable)];
    const retained = ordered.slice(0, MAX_SIMILAR_IMAGES);
    for (const item of ordered.slice(MAX_SIMILAR_IMAGES)) {
      add("duplicate-task", item, "相同商品静物姿态、同功能同姿态渲染或近似尺寸版式最多保留两张备选；首图、功能图与商业 CG 共用近似画面预算。本图须改为不同的证据展示，场景创意不适用此配额，不能只换标题或文案。", {
        similarItemId: retained[0].itemId, confidence: "high", maxSimilarImages: MAX_SIMILAR_IMAGES,
      });
    }
  }
  if (items.length >= 5 && !selectedRoles.length) {
    const scenes = items.filter(isCreationUseSceneTask);
    if (scenes.length >= 5) {
      const groups = new Map();
      for (const item of scenes) {
        const camera = framingSignature(briefOf(item).framing);
        if (camera.distance < 0 || camera.layout >= 0) continue;
        const group = groups.get(camera.distance) || [];
        group.push(item);
        groups.set(camera.distance, group);
      }
      const budget = Math.ceil(scenes.length / 2);
      for (const group of groups.values()) {
        const ordered = [...group.filter((item) => !editable(item)), ...group.filter(editable)];
        for (const item of ordered.slice(budget).filter(editable)) {
          add("layout-repetition", item, "不同使用动作仍过度集中于相同景别；请按本图任务改变主体占比、人物与环境关系或拍摄距离，并写进实际提示词。保留真实用途与商品结构，不靠换道具、背景或文案制造差异。", { similarItemId: ordered[0].itemId });
        }
      }
    }
    const layouts = [];
    for (const item of items) {
      const brief = briefOf(item);
      if (!brief.visual_form || !brief.framing || isCreationUseSceneTask(item)) continue;
      const group = layouts.find((entries) => {
        const first = briefOf(entries[0]);
        return brief.visual_form === first.visual_form && brief.text_density === first.text_density && similarity(brief.framing, first.framing) >= 0.65;
      });
      if (group) group.push(item); else layouts.push([item]);
    }
    for (const group of layouts) {
      const budget = MAX_SIMILAR_IMAGES;
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
    issues };
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
  const blocked = new Map(quality.issues.filter((issue) => issue.code === "duplicate-task" && issue.confidence === "high")
    .filter((issue) => plan.items.some((item) => item.itemId === issue.itemId && item.referenceSelection?.version === 1)).map((issue) => [issue.itemId, issue]));
  const items = plan.items.map((item) => blocked.has(item.itemId) ? { ...item, enabled: false, evidenceBlocked: true,
    evidenceRequirement: { code: "duplicate-task", message: "画面任务重复，待调整：" + blocked.get(item.itemId).message },
  } : item);
  const counts = resolveCreationPlanCounts({ items });
  if (blocked.size) {
    const active = auditCreationMarketingQuality({ ...plan, items }, options);
    quality = { ...quality, functionalCoverage: active.functionalCoverage, issues: [...quality.issues,
      ...active.issues.filter((issue) => issue.code === "functional-proof-missing" && !quality.issues.some((old) => old.code === issue.code && old.itemId === issue.itemId)),
    ] };
  }
  const issues = quality.issues.map((issue) => ({ ...issue, severity: blocked.has(issue.itemId) ? "blocking" : "warning" }));
  const warnings = issues.map((issue) => ({ code: `marketing-quality-${issue.code}`, level: "warning", itemId: issue.itemId, message: issue.message }));
  for (const item of excluded) warnings.push({ code: "marketing-item-excluded", level: "warning", itemId: item.itemId,
    message: `第 ${item.marketingAssignment.sourceIndex} 张“${item.title}”缺少功能依据，已单独跳过，其余有效图片可以继续生成。` });
  return { ...plan, ...counts, items, slots: items.filter((item) => item.itemKind === "carousel"), pendingAdjustmentCount: blocked.size,
    platformSetOverrides: { ...plan.platformSetOverrides, imageCount: counts.imageCount },
    marketingPlan: { ...plan.marketingPlan, validation: { ...plan.marketingPlan.validation, acceptedCount: counts.imageCount, pendingCount: blocked.size }, quality: { ...quality, version: 2, issues,
    status: blocked.size ? "needs-adjustment" : warnings.length ? "warning" : "passed", blockedItemIds: [...blocked.keys()], excludedItemIds: excluded.map((item) => item.itemId) } },
    warnings: [...list(plan.warnings).filter((warning) => !/^marketing-quality-|^marketing-item-excluded$/u.test(warning.code)), ...warnings] };
}
