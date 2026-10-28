import { CREATION_PLATFORM_IMAGE_TYPE_REGISTRY, getCreationPlatformImageType } from "./creation-platform-policies.mjs";
import { buildCreationAppearanceLockPrompt } from "./creation-product-insights.mjs";
import { resolveCreationPlanCounts } from "./creation-plan-counts.mjs";

export const CREATION_MARKETING_PLAN_MODE = "creation-marketing-plan";
export const MAX_CREATION_MARKETING_IMAGES = 20;
const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const strings = (value) => [...new Set(array(value).map(text).filter(Boolean))];
export const isCreationAiMarketingEnabled = (value) => value === true || value === "true" || value === "ai-batch";

const stringSchema = { type: "string" };
const idsSchema = { type: "array", items: stringSchema };
const properties = {
  item_id: stringSchema, image_type: { type: "string", enum: Object.keys(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY) },
  title: stringSchema, marketing_goal: stringSchema,
  audience_ids: idsSchema, selling_point_ids: idsSchema, pain_point_ids: idsSchema,
  recommendation_ids: idsSchema, fact_ids: idsSchema,
  reference_indexes: { type: "array", maxItems: 8, items: { type: "integer", minimum: 1 } },
  prompt: stringSchema,
  creative_brief: { type: "object", additionalProperties: false, required: ["purpose", "scene", "action", "framing", "evidence_focus"], properties: { purpose: stringSchema, scene: stringSchema, action: stringSchema, framing: stringSchema, evidence_focus: stringSchema } },
};
export const CREATION_MARKETING_ITEMS_SCHEMA = {
  type: "array", minItems: 1, maxItems: MAX_CREATION_MARKETING_IMAGES,
  items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties },
};

export const CREATION_MARKETING_PLAN_INSTRUCTION = `你是一名电商视觉营销专家，同时担任商品套图的视觉总监和转化文案策划。
任务：根据本次商品资料、全部参考图及编号、目标语言和 task_count，在一次回答里统筹并输出完整的 task_count 条 items。不是一张张询问，不是返回模板或拍摄建议，不调用图片工具。
先完成商品洞察：谁最需要它、具体使用任务、购买动机、犹豫点、核心卖点与痛点；然后让整套图互补地覆盖吸引注意、需求代入、商品价值、细节证据、使用方式、规格适配和决策顾虑。依据商品安排分工，不能每次机械照抄相同顺序。
资料充分时，受众分成 3–6 个具体群体并标主要/次要；卖点 4–8 个、痛点 3–6 个，分别说明买家价值与真实困扰，均绑定事实。已有分析中的有效事实及 ID 优先复用。没有图片时只使用用户文字事实，reference_roles 和 reference_indexes 可为空。
每条 item 指定唯一 item_id、合法 image_type、中文 title 和 marketing_goal，引用本次 product_insights 中对应的受众、卖点、痛点、营销建议、事实 ID，以及实际需要的参考图编号。fact_ids 至少一个；每个被引用分析点的事实都应包含在本图 fact_ids 中。
image_type 必须逐字使用 allowed_image_types 中的 image_type 值，不能填 role、中文图型名称或自造图型。每条 marketing_goal 必须非空且互不相同，明确本图独立回答的购买问题；同一图型的不同任务也必须有不同的营销目标与完整 prompt。提交前逐条核对 item_id、title、marketing_goal、image_type 和 prompt，确保全部 task_count 条都完整有效。
prompt 必须是一条可直接生成最终图片的完整提示词，具体描述主体占比、构图与景别、视角、动作或产品状态、环境、光线色调、证据特写、信息层级和画布文字。让买家一眼知道商品对自己有什么价值，用真实证据降低犹豫；不能只写“突出卖点”“高级质感”“提高转化”。不能把策划说明、内部 ID 或图片序号画在图上。
逐图只使用本图事实，首图和普通图都应完整保留本图所需的主体锁、事实、数值、条件和用户锁定提示词；不要为了字符长度删掉主体锁或证据。不要重复整套分析、其它场景或泛泛质量词。系统会在prompt前统一注入主主体锁，不用在每条重复抄写appearance_locks。
主体外观优先于创意，掌面/手背等表面、部件归属和翻盖开合状态按参考保持，画面左右不等于左右手。多角度只展示参考支持的视角或细节裁切，不能强制补造未见背面/内部。说明图的其它颜色不能改写主主体；保持可见文字和显示数字，不从55推断55°C温度。
整套统一商品身份与所选 visualLanguage，但每张有不同的购买问题、动作、证据表达或画面形式；同类图型可多次出现，只换背景或改写同一文案不算独立任务。prompt 不得逐字重复。
先在本次回答内分配整套用途，再写逐图提示词。每项 creative_brief 明确 purpose（本图用途）、scene（适用场景）、action（具体动作或商品状态）、framing（景别与构图）、evidence_focus（本图证据焦点）。这些字段使用简体中文，必须与本图 prompt 和已引用事实一致。相同商品可在不同真实应用场景自然适应握持、佩戴或摆放；保持商品数量、结构比例、部件与掌背面归属、标识、开合状态不变，不能把主体锁误写成每图同一姿态和景别。优先覆盖有依据的不同使用任务，资料不足时换购买问题或证据表达，不编造功能凑场景。白底展示、到手清单、参数规格各有用途，不强行改成场景图。仅换雪景/冬景背景、暖意/温暖标语或配色，不算新的应用任务。
最终 prompt 与新加画布文案遵循 targetLanguage，分析与预览摘要使用简体中文。实体产品原有标识照参考保留。使用已提供的真实功能、参数和配件，不凭空创造。
reference_indexes 指原始上传编号，必须把 primary_reference_index 放在第一位，并包含本图所引用参考事实的来源图；只发送确实需要的图，最多 8 张。构图主主体不被辅助说明图改写。无参考图时返回空数组。
遵守 locked_items 中用户锁定的图片 ID、类型或提示词；保留 mandatory_slots 的平台硬要求。SKU 白底图与源图重构不计入 task_count，也不要放入 items。
只返回符合 schema 的 JSON；reuse_analysis 为 true 时只返回 items，复用上下文中的已校验事实及 ID，不重做商品分析，不改写主体身份；否则同时提供本次 reference_roles、sku_subjects、audience_strategy、product_insights 与全部 items。结果不能少条、多条、放占位内容或把原模板提示词原样拼回。`;

export function buildCreationMarketingContext(input, basePlan, referenceImages = []) {
  const count = Number(input.imageCount ?? basePlan.imageCount);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREATION_MARKETING_IMAGES) throw new Error("AI 营销套图数量必须为 1–20 张。");
  const referenceRoles = basePlan.referenceImageRoles || [];
  const primary = referenceRoles.find((entry) => entry.role === "reference-product") || referenceRoles.find((entry) => entry.role === "product");
  return {
    task_count: count, productName: input.productName, productDescription: input.productDescription,
    targetLanguage: input.targetLanguage || basePlan.targetLanguage,
    platform: basePlan.platform, visualLanguage: input.visualLanguage || basePlan.visualLanguage,
    scenario: input.scenario || basePlan.scenario, dimensionSpecs: input.dimensionSpecs,
    product_insights: basePlan.productInsights, audience_strategy: basePlan.audienceStrategy,
    reuse_analysis: (input.analysisValidated === true || input.analysisValidated === "true") && Boolean(basePlan.productInsights?.confirmedFacts?.length),
    primary_reference_index: referenceImages.length ? Number(primary?.index) || 1 : 0,
    prompt_contract: { subject_lock: buildCreationAppearanceLockPrompt(basePlan.productInsights), note: "系统将统一注入主体锁；新分析的实际主体锁以返回的appearance_locks为准。完整保留本图所需事实和条件。" },
    references: referenceImages.map((image, index) => {
      const reference = referenceRoles.find((entry) => Number(entry.index) === index + 1);
      return { index: index + 1, filename: image.filename || image.name, role: reference?.role || "", note: reference?.note || "" };
    }),
    allowed_image_types: Object.values(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY).map(({ imageType, imageTypeLabel, role, textPolicy, scenePolicy }) => ({ image_type: imageType, title: imageTypeLabel, role, textPolicy, scenePolicy })),
    locked_items: array(basePlan.items).filter((item) => item.itemKind === "carousel" && item.contentAssignment?.kind === "manual" && item.textPolicy !== "none" && !item.constraints?.some((rule) => rule.level === "blocking")).map((item) => ({ item_id: item.itemId, image_type: item.imageType, prompt: item.prompt })),
    selected_roles: input.selectedRoles || [],
    mandatory_slots: array(basePlan.platformProfile?.slots).filter((slot) => array(slot.constraints).some((rule) => rule.level === "blocking")).map(({ slotKey, imageType, role, composition, textPolicy, scenePolicy, constraints }) => ({ slotKey, imageType, role, composition, textPolicy, scenePolicy, constraints })),
  };
}

export function applyCreationMarketingPlan(basePlan, payload, { count, referenceCount = 0, primaryIndex = 0, lockedItems = [], selectedRoles = [], validateItem, allowPartial = true, sourceIndexes = [], constraintCount = count } = {}) {
  const rows = array(payload?.items);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREATION_MARKETING_IMAGES) throw new Error("AI 营销套图数量必须为 1–20 张。");
  if (!Number.isInteger(constraintCount) || constraintCount < count || constraintCount > MAX_CREATION_MARKETING_IMAGES) throw new Error("营销计划原始数量无效，请重新预览。");
  if (!rows.length || (!allowPartial && rows.length !== count)) throw new Error(`AI 需要一次返回 ${count} 条完整提示词，本次返回 ${rows.length} 条，请重新规划。`);
  if (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex > referenceCount || (referenceCount && !primaryIndex)) throw new Error("引用了不存在的主主体或商品事实来源图。");
  const insights = basePlan.productInsights;
  const facts = array(insights?.confirmedFacts);
  const factMap = new Map(facts.map((fact) => [fact.id, fact]));
  const sources = {
    audience_ids: array(insights?.audienceSegments), selling_point_ids: array(insights?.sellingPoints),
    pain_point_ids: array(insights?.painPoints), recommendation_ids: array(insights?.marketingRecommendations),
  };
  const itemIds = new Set(basePlan.items.filter((item) => item.itemKind !== "carousel").map((item) => item.itemId));
  const prompts = new Set();
  const goals = new Set();
  const defaults = basePlan.items.find((item) => item.itemKind === "carousel") || {};
  const carouselItems = [];
  const removedItems = [];
  const requiredSlot = (index) => array(basePlan.platformProfile?.slots?.[index]?.constraints).some((rule) => rule.level === "blocking");
  const buildItem = (row, index) => {
    if ([row.item_id ?? row.itemId, row.prompt, row.marketing_goal ?? row.marketingGoal, row.image_type ?? row.imageType, row.title].some((value) => value != null && typeof value !== "string")) throw new Error(`AI 第 ${index + 1} 条必填字段类型无效。`);
    const id = text(row.item_id || row.itemId);
    const prompt = text(row.prompt);
    const goal = text(row.marketing_goal || row.marketingGoal);
    const type = getCreationPlatformImageType(row.image_type || row.imageType);
    const invalidReason = !id ? "缺少独立任务 ID"
      : itemIds.has(id) ? "独立任务 ID 重复"
      : !prompt ? "缺少完整提示词"
      : prompts.has(prompt) ? "提示词与前面的条目重复，未形成独立任务"
      : !text(row.title) ? "缺少图片标题"
      : !goal ? "缺少营销目标"
      : goals.has(goal) ? "营销目标与前面的条目重复，未形成独立任务"
      : !type ? `没有有效图型（${text(row.image_type || row.imageType).slice(0, 80) || "未提供"}）`
      : "";
    if (invalidReason) throw new Error(`AI 第 ${index + 1} 条${invalidReason}，请重新规划。`);
    const selectedRole = typeof selectedRoles[index] === "string" ? selectedRoles[index] : selectedRoles[index]?.role;
    if (selectedRole && type.role !== selectedRole) throw new Error(`AI 第 ${index + 1} 条没有保留用户选择的图片类型。`);
    const declaredFactIds = strings(row.fact_ids || row.factIds);
    if (!declaredFactIds.length || declaredFactIds.some((factId) => !factMap.has(factId))) throw new Error(`AI 第 ${index + 1} 条引用了缺失或失效的商品事实。`);
    const assignments = {};
    for (const [field, entries] of Object.entries(sources)) {
      const ids = strings(row[field]);
      if (ids.some((value) => !entries.some((entry) => entry.id === value))) throw new Error(`AI 第 ${index + 1} 条 ${field} 与商品分析不匹配。`);
      assignments[field] = ids;
    }
    // 模型经常会引用一个已绑定事实的受众/卖点，却漏掉该事实的 ID。
    // 这些事实仍来自服务端已校验的分析结果，可以安全补齐，避免整套计划被无谓拒绝。
    const factIds = [...new Set([
      ...declaredFactIds,
      ...Object.entries(assignments).flatMap(([field, ids]) => ids.flatMap((id) => sources[field].find((entry) => entry.id === id)?.factIds || [])),
    ])];
    if (factIds.some((factId) => !factMap.has(factId))) throw new Error(`AI 第 ${index + 1} 条引用的分析包含失效商品事实。`);
    const suppliedRefs = array(row.reference_indexes || row.referenceIndexes);
    if (suppliedRefs.length > 8 || new Set(suppliedRefs).size !== suppliedRefs.length || suppliedRefs.some((value) => !Number.isInteger(value) || value < 1 || value > referenceCount)) throw new Error(`AI 第 ${index + 1} 条参考图分配无效。`);
    const requiredRefs = [...new Set([...(primaryIndex ? [primaryIndex] : []), ...factIds.flatMap((factId) => factMap.get(factId).referenceIndexes)])];
    if (requiredRefs.some((value) => !Number.isInteger(value) || value < 1 || value > referenceCount)) throw new Error(`AI 第 ${index + 1} 条引用了不存在的主主体或商品事实来源图。`);
    // 兼容部分网关漏写已知来源编号：只补回分析已经证明的来源，未知或超预算仍拦截。
    const refs = [...new Set([...requiredRefs, ...suppliedRefs])];
    if (refs.length > 8) throw new Error(`AI 第 ${index + 1} 条需要的依据参考图超过 8 张，请重新规划参考分配。`);
    for (const [field, entries] of Object.entries(sources)) {
      const ids = strings(row[field]);
      if (ids.some((value) => !entries.some((entry) => entry.id === value && entry.factIds.every((factId) => factIds.includes(factId))))) throw new Error(`AI 第 ${index + 1} 条 ${field} 与商品事实不匹配。`);
    }
    const mandatory = basePlan.platformProfile?.slots?.[index];
    if (array(mandatory?.constraints).some((rule) => rule.level === "blocking") && mandatory.imageType !== type.imageType) throw new Error(`AI 第 ${index + 1} 条不符合平台必需图型。`);
    const locked = lockedItems.find((item) => item.item_id === id);
    if (locked && (locked.prompt !== prompt || locked.image_type !== type.imageType)) throw new Error("AI 改写了用户锁定的图片，请重新规划。");
    const subjectLock = buildCreationAppearanceLockPrompt(insights);
    const fidelity = referenceCount ? "PRODUCT FIDELITY: Primary reference and APPEARANCE LOCK define shape, proportions, parts, markings and opening states; scene styling follows them." : "";
    const prefix = [fidelity, subjectLock].filter(Boolean).join("\n");
    const authoredPrompt = prefix && prompt.startsWith(`${prefix}\n`) ? prompt.slice(prefix.length + 1) : prompt;
    // 已通过营销项和事实来源校验的事实全部保留到证据链，不能因文本较长而拒绝整套计划。
    const finalPrompt = locked ? prompt : [prefix, authoredPrompt].filter(Boolean).join("\n");
    const referenceSources = refs.map((refIndex) => ({ index: refIndex, note: facts.filter((fact) => factIds.includes(fact.id) && fact.referenceIndexes.includes(refIndex)).map((fact) => fact.text).join("; ") }));
    const creativeBrief = Object.fromEntries(["purpose", "scene", "action", "framing", "evidence_focus"].map((key) => [key, text(row.creative_brief?.[key] || row.marketingAssignment?.creativeBrief?.[key])]));
    const marketingAssignment = { goal, creativeBrief, sourceIndex: index + 1, audienceIds: assignments.audience_ids, sellingPointIds: assignments.selling_point_ids, painPointIds: assignments.pain_point_ids, recommendationIds: assignments.recommendation_ids, factIds, referenceIndexes: [...refs] };
    return {
      ...type, ...(requiredSlot(index) ? { required: mandatory.required, constraints: structuredClone(mandatory.constraints), sourceIds: mandatory.sourceIds } : {}),
      itemId: id, slotKey: id, slotIndex: carouselItems.length + 1, itemKind: "carousel", title: text(row.title), prompt: finalPrompt,
      promptContext: { version: 1, subjectLock },
      imageTypeLabel: type.imageTypeLabel, ratio: defaults.ratio || basePlan.platformSetOverrides?.ratio || "1:1",
      resolutionTier: defaults.resolutionTier || "1K", targetLanguage: basePlan.targetLanguage,
      enabled: true, marketingAssignment, recommendationSource: "ai-marketing",
      contentAssignment: { taskKey: id, kind: "marketing", role: type.role, imageType: type.imageType, title: text(row.title), summary: goal, factIds, sellingPointIds: assignments.selling_point_ids, painPointIds: assignments.pain_point_ids, format: type.composition, referenceSources },
    };
  };
  const seenIndexes = new Set();
  rows.forEach((value, position) => {
    const row = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const sourceIndex = !allowPartial && sourceIndexes.length ? sourceIndexes[position] : position + 1;
    if (!Number.isInteger(sourceIndex) || sourceIndex < 1 || sourceIndex > Math.max(rows.length, constraintCount) || seenIndexes.has(sourceIndex) || (!allowPartial && sourceIndex > constraintCount)) throw new Error("冻结营销计划原始序号无效，请重新预览。");
    seenIndexes.add(sourceIndex);
    try {
      if (position >= count) throw new Error(`AI 第 ${sourceIndex} 条超出本次请求的 ${count} 条范围。`);
      const item = buildItem(row, sourceIndex - 1);
      validateItem?.(item);
      carouselItems.push(item);
      itemIds.add(item.itemId); prompts.add(text(row.prompt)); goals.add(item.marketingAssignment.goal);
    } catch (error) {
      if (!allowPartial) throw error;
      if (requiredSlot(sourceIndex - 1) && sourceIndex <= constraintCount) throw new Error(`平台必需图第 ${sourceIndex} 条不可用：${error.message}`);
      if (lockedItems.some((item) => item.item_id === text(row.item_id || row.itemId))) throw new Error(`用户锁定的图片不可用：${error.message}`);
      removedItems.push({ sourceIndex, itemId: text(row.item_id || row.itemId), title: text(row.title) || `第 ${sourceIndex} 张`, reason: error.message });
    }
  });
  if (lockedItems.some((item) => !carouselItems.some((entry) => entry.itemId === item.item_id))) throw new Error("AI 遗漏了用户锁定的图片，请重新规划。");
  for (let index = 0; index < constraintCount; index += 1) {
    if (requiredSlot(index) && !carouselItems.some((item) => item.marketingAssignment.sourceIndex === index + 1)) throw new Error(`AI 遗漏了平台必需图第 ${index + 1} 条，请重新规划。`);
  }
  const validation = allowPartial ? { requestedCount: count, returnedCount: rows.length, acceptedCount: carouselItems.length, missingCount: Math.max(0, count - rows.length), removedItems } : basePlan.marketingPlan?.validation;
  if (!carouselItems.length) throw Object.assign(new Error(`AI 营销规划没有可用条目：${removedItems.map((item) => item.reason).join("；")}`), { marketingValidation: validation });
  const extraItems = basePlan.items.filter((item) => item.itemKind !== "carousel").map((item, index) => ({ ...item, slotIndex: carouselItems.length + index + 1 }));
  const items = [...carouselItems, ...extraItems];
  const counts = resolveCreationPlanCounts({ items });
  return {
    ...basePlan, promptPlanningMode: "ai-batch", ...counts,
    marketingPlan: { ...basePlan.marketingPlan, validation, duplicateRisks: findCreationMarketingDuplicateRisks(carouselItems) },
    platformSetOverrides: { ...basePlan.platformSetOverrides, imageCount: counts.imageCount },
    selectedRoles: carouselItems.map((item) => item.role), slots: carouselItems,
    items,
    warnings: [...array(basePlan.warnings).filter((warning) => !/^suite-|^item-missing-evidence$|^image-count-extension-limited$|^creation-prompt-budget$/u.test(warning.code))],
  };
}

export function findCreationMarketingDuplicateRisks(items = []) {
  const normalize = (value) => text(value).toLowerCase().replace(/冬日|雪日|雪天|寒冬|winter|snowy/gu, "冬季").replace(/暖意|温暖|暖和|warmth|warm/gu, "保暖").replace(/展示|呈现|体现|突出|强调|show|display/gu, "").replace(/[\p{P}\p{Z}\d\s]/gu, "");
  const risks = [];
  for (let index = 0; index < items.length; index += 1) {
    const current = items[index];
    const brief = current.marketingAssignment?.creativeBrief || {};
    for (const previous of items.slice(0, index)) {
      const old = previous.marketingAssignment?.creativeBrief || {};
      const goalSame = normalize(current.marketingAssignment?.goal) === normalize(previous.marketingAssignment?.goal);
      const sameEvidence = brief.action && brief.evidence_focus && normalize(brief.action) === normalize(old.action) && normalize(brief.evidence_focus) === normalize(old.evidence_focus) && normalize(brief.purpose) === normalize(old.purpose);
      if (goalSame || sameEvidence) {
        risks.push({ itemId: current.itemId, sourceIndex: current.marketingAssignment.sourceIndex, similarItemId: previous.itemId, similarSourceIndex: previous.marketingAssignment.sourceIndex, reason: "购买问题或动作与证据表达相近；请核对是否仅更换背景、标语或配色。" });
        break;
      }
    }
  }
  return risks;
}
