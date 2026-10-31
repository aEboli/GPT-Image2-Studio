import { CREATION_PLATFORM_IMAGE_TYPE_REGISTRY, getCreationPlatformImageType } from "./creation-platform-policies.mjs";
import { buildCreationProductFidelityInstruction, formatCreationDimensionSpecsForMode, normalizeCreationDimensionUnitMode } from "./creation-planner.mjs";
import { CREATION_COMMERCIAL_CG_DIRECTIVE } from "./creation-suite-content-plan.mjs";
import { resolveCreationPlanCounts } from "./creation-plan-counts.mjs";
import { buildCreationMarketingQualityRequirements, normalizeCreationMarketingStrategy, CREATION_MARKETING_VISUAL_FORMS, CREATION_MARKETING_TEXT_DENSITIES } from "./creation-marketing-quality.mjs";

export const CREATION_MARKETING_PLAN_MODE = "creation-marketing-plan";
export const MAX_CREATION_MARKETING_IMAGES = 20;
const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const strings = (value) => [...new Set(array(value).map(text).filter(Boolean))];
export const isCreationAiMarketingEnabled = (value) => value === true || value === "true" || value === "ai-batch";

function buildMarketingMeasurementInstruction(mode, facts = [], targetLanguage = "") {
  const unitMode = normalizeCreationDimensionUnitMode(mode);
  const equivalents = facts.flatMap((fact) => {
    const source = text(fact.text);
    const converted = formatCreationDimensionSpecsForMode([source], unitMode.value, targetLanguage);
    return converted !== source ? [converted] : [];
  });
  return [
    `MEASUREMENT DISPLAY (${unitMode.value}): ${unitMode.promptInstruction}`,
    "Apply this unit mode to every newly added length, size, weight and capacity label in this image, including scene callouts. Use only this image's assigned facts; retain each variant's own values and conditions.",
    unitMode.value === "both" ? "Every displayed measurement label must keep the metric and imperial pair together; a single-unit source value is not a complete label. Unit equivalents are the same fact, not extra specifications." : "New measurement labels must use only the selected unit system, even when source evidence uses another system.",
    equivalents.length ? `Assigned measurement equivalents (retain their labels and conditions): ${equivalents.join("; ")}` : "",
    "Preserve physical product and packaging markings exactly as shown. This rule applies only when adding measurement text; it does not require new callouts on a text-free image.",
  ].filter(Boolean).join(" ");
}

const CREATION_MARKETING_RESTRICTED_TERMS = Object.freeze([
  { term: "safe", match: "standalone-word", source: "user-reported-shein" },
]);

function findRestrictedTerm(value, terms) {
  const content = String(value ?? "");
  for (const rule of terms) {
    const escaped = rule.term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const pattern = rule.match === "standalone-word"
      ? new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "iu")
      : new RegExp(escaped, "iu");
    const match = pattern.exec(content);
    if (match) return { term: match[0], rule };
  }
  return null;
}

const stringSchema = { type: "string" };
const idsSchema = { type: "array", items: stringSchema };
const properties = {
  item_id: stringSchema, image_type: { type: "string", enum: Object.keys(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY) },
  title: stringSchema, marketing_goal: stringSchema,
  audience_ids: idsSchema, selling_point_ids: idsSchema, pain_point_ids: idsSchema,
  recommendation_ids: idsSchema, fact_ids: idsSchema,
  reference_indexes: { type: "array", items: { type: "integer", minimum: 1 } },
  prompt: stringSchema,
  creative_brief: { type: "object", additionalProperties: false, required: ["purpose", "scene", "action", "framing", "evidence_focus", "visual_form", "text_density", "new_information", "effect_visual"], properties: { purpose: stringSchema, scene: stringSchema, action: stringSchema, framing: stringSchema, evidence_focus: stringSchema,
    visual_form: { type: "string", enum: CREATION_MARKETING_VISUAL_FORMS }, text_density: { type: "string", enum: CREATION_MARKETING_TEXT_DENSITIES }, new_information: stringSchema, effect_visual: stringSchema } },
};
export const CREATION_MARKETING_ITEMS_SCHEMA = {
  type: "array", minItems: 1, maxItems: MAX_CREATION_MARKETING_IMAGES,
  items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties },
};

export const CREATION_MARKETING_PLAN_INSTRUCTION = `你是一名电商视觉营销专家，同时担任商品套图的视觉总监和转化文案策划。
任务：根据本次商品资料、全部参考图及编号、目标语言和 task_count，在一次回答里统筹并输出完整的 task_count 条 items。不是一张张询问，不是返回模板或拍摄建议，不调用图片工具。
如果上下文提供 user_supplement，先把它当作用户对本套方案的补充要求；只有在不违反已确认商品事实、参考图、平台硬约束和图片类型规则时才吸收它，不能据此虚构商品功能、规格、配件或效果。variation_seed 只用于让本套方案形成独立变化，不要把它写进图片文字或最终提示词。
先完成商品洞察：谁最需要它、具体使用任务、购买动机、犹豫点、核心卖点与痛点；然后让整套图互补地覆盖吸引注意、需求代入、商品价值、细节证据、使用方式、规格适配和决策顾虑。依据商品安排分工，不能每次机械照抄相同顺序。
先返回 suite_strategy：core_buying_reason 是整套最应记住的一个购买理由，primary_fact_ids 绑定主事实；functional_proofs 用 fact_ids、buyer_benefit、visual_evidence 说明核心功能怎样被看见、给买家什么收益。功能必须来自已确认事实，按当前商品推导，不套类目模板。优先覆盖 quality_requirements.primaryFunctionFactIds；不能把核心功能挤成参数文字或只展示次要操作。
存在已确认功能时，必须安排核心功能的可见效果表达，使用 functional-render 视觉形式；多图优先独立 comparison-proof 图，单图可融入主视觉。加热手套应能看见加热带来的温暖，例如在完整主体周围叠加克制的半透明热流示意；不能只有暖色背景、穿戴或加热文字。其他商品按自己的功能选择水流、光照、清洁过程、容纳关系或真实作用等合适表达，不一律加热光。加强商品本体的材质与体积表现，让功能流动形成前后遮挡、空间纵深和合理局部光照，不只贴平面箭头或发光描边。视觉示意不是实测；不补造发热区域、内部线路、温度、续航、效果幅度或认证。保留参考实物，不改商品本身的颜色、结构和可见数字。明确功能通过什么作用、表现到哪里，不能只写“功能渲染”四个字。
ownership-atmosphere 为独立的“商业 CG 渲染图”。可依据商品事实与整套分工自主选择 commercial-cg 视觉形式，不设配额、不强制每套一张。commercial-cg 的 text_density 必须为 none：只做纯渲染，禁止新增文字、标题、标语、图标、徽章、标注和参数卡，仅保留商品实物已有标记。用完整商品、真实曲面与厚度、材质各自的粗糙度/反射/纹理、主光与轮廓光、接触阴影及空间反射建立商业建模质感，不把织物等材质统一塑料化，不强制真人或生活场景。已确认的核心功能应绑定本图 fact_ids 并通过立体效果呈现，effect_visual 用目标语言写出并逐字放入 prompt；加热产品可用橙金暖光、体积热流、柔和热晕、前后遮挡和材质局部暖色照明直接表达暖意，不能只有背景变暖或细线描边，也不能把真实布料变成熔岩、明火或烧焦表面。其他商品使用自身有依据的作用效果。不得补造内部线路、具体发热区域、温度或实测结论；只有参考明确支持时才表现相关结构或区域。没有已确认功能时只表现外观材质，纯外观 CG 不替代核心功能覆盖。保留 comparison-proof 独立功能图的分工，二者不能只换背景或重复同一购买信息；其他图型的营销文案仍自主安排。
资料充分时，受众分成 3–6 个具体群体并标主要/次要；卖点 4–8 个、痛点 3–6 个，分别说明买家价值与真实困扰，均绑定事实。已有分析中的有效事实及 ID 优先复用。没有图片时只使用用户文字事实，reference_roles 和 reference_indexes 可为空。
每条 item 指定唯一 item_id、合法 image_type、中文 title 和 marketing_goal，引用本次 product_insights 中对应的受众、卖点、痛点、营销建议、事实 ID，以及实际需要的参考图编号。fact_ids 至少一个；每个被引用分析点的事实都应包含在本图 fact_ids 中。
先核对本图需要的事实、视角、规格、配件和来源是否已确认，再选择方向并写提示词。事实 ID 必须逐字复用本次已确认分析，不自造、改名或引用已排除事实。没有支持的方向不要推荐：改用有依据的外观、细节、使用关系或不同购买问题；不能把未知性能、未见结构、未提供款式或包装内容写成已知事实，也不能只换一个有效 ID 却保留无依据的画面。
image_type 必须逐字使用 allowed_image_types 中的 image_type 值，不能填 role、中文图型名称或自造图型。每条 marketing_goal 必须非空且互不相同，明确本图独立回答的购买问题；同一图型的不同任务也必须有不同的营销目标与完整 prompt。提交前逐条核对 item_id、title、marketing_goal、image_type 和 prompt，确保全部 task_count 条都完整有效。
prompt 必须是一条可直接生成最终图片的完整提示词，具体描述主体占比、构图与景别、视角、动作或产品状态、环境、光线色调、证据特写和信息层级，按本图文字策略处理画布文字（商业 CG 无新增文字）。让买家一眼知道商品对自己有什么价值，用真实证据降低犹豫；不能只写“突出卖点”“高级质感”“提高转化”。不能把策划说明、内部 ID 或图片序号画在图上。
逐图只使用本图事实，首图和普通图都应完整保留本图所需的事实、数值、条件和用户锁定提示词；不要为了字符长度删掉证据。不要重复整套分析、其它场景或泛泛质量词。系统会在 prompt 前统一注入基于主参考图的 PRODUCT FIDELITY，不要额外添加分析推断的外观锁定段落。
主体外观优先于创意，掌面/手背等表面、部件归属和翻盖开合状态按参考保持，画面左右不等于左右手。普通单款画面以 primary_reference_index 为主体，不另换其它SKU；variant-comparison、dimension-fit、spec-table 按逐图任务保留各个已提供款式和它们自己的参考、配色、数量与规格，不能把所有款式都改成主参考款。多角度只展示参考支持的视角或细节裁切，不能强制补造未见背面/内部。辅助说明图不能改写商品身份；保持可见文字和显示数字，不从55推断55°C温度。
若 restricted_terms 非空，所有最终提示词、标题、营销目标和 creative_brief 文本均不得包含其中的受限词，并遵循每条规则提供的匹配范围。
整套统一商品身份与所选 visualLanguage，但每张有不同的购买问题、动作、证据表达或画面形式；同类图型可多次出现，只换背景或改写同一文案不算独立任务。prompt 不得逐字重复。
creative_brief 同时说明 visual_form（schema 中的视觉形式）、text_density（none/minimal/structured）、new_information（看完前图后本图新增的购买信息）和 effect_visual（功能图及表现已确认功能的商业 CG 的实际可见效果指令，其他图为空）。effect_visual 是可执行指令，必须用 targetLanguage 写出并逐字放入最终 prompt；其他分析、分工和 new_information 摘要仍用简体中文。effect_visual 必须与 suite_strategy 的有据功能表现一致，不能只填功能名、摘要或引用事实 ID。按任务安排简洁产品画面、真实场景、微距证据、功能渲染和必要信息说明；不规定信息图配额，不默认每张都有圆框、拼图、箭头、图标或卖点条，避免整套同一构图和文字密度。
若有 repair_request，只返回指定 target_item_ids 的修复项，items 数量等于 task_count；复用已校验分析和来源，suite_strategy 保持已有有效内容并修正被指出的遗漏。accepted_items 仅提供已确认任务的分工摘要，未重复的 prompt 保留在系统中；locked_items 保留用户锁定内容。两者都不返回、不改写，目标 ID、原有用户选型和平台约束必须遵守。逐项消除 repair_request.issues 后再提交，不把问题换词掩盖。
repair_request.targets 中 rejected 为 true 的方向未通过事实或来源校验，不能继续当作已确认任务。依据 rejection_reason 和 product_insights.confirmedFacts 重做完整提示词、标题、目标与引用；方向缺少证据时一并换成有据任务，保留 source_index 对应位置和指定 item_id，不得只删除无效引用或替换事实 ID。
若 repair_request.strategy_only 为 true，则仅修复 suite_strategy，task_count 为 0 且 items 必须为 []；全部图片已通过校验，不返回、不改写。事实 ID 必须逐字使用 product_insights.confirmedFacts 中的 id，functional_proofs 仅绑定 kind 为 function 的已确认功能；没有功能事实时返回空 functional_proofs，不编造功能。
先在本次回答内分配整套用途，再写逐图提示词。每项 creative_brief 明确 purpose（本图用途）、scene（适用场景）、action（具体动作或商品状态）、framing（景别与构图）、evidence_focus（本图证据焦点）。这些字段使用简体中文，必须与本图 prompt 和已引用事实一致。相同商品可在不同真实应用场景自然适应握持、佩戴或摆放；保持参考图中的商品数量、结构比例、部件与掌背面归属、标识、开合状态，不要求每图同一姿态和景别。优先覆盖有依据的不同使用任务，资料不足时换购买问题或证据表达，不编造功能凑场景。白底展示、到手清单、参数规格各有用途，不强行改成场景图。仅换雪景/冬景背景、暖意/温暖标语或配色，不算新的应用任务。
最终 prompt 与新加画布文案遵循 targetLanguage，分析与预览摘要使用简体中文。实体产品原有标识照参考保留。使用已提供的真实功能、参数和配件，不凭空创造。
按 dimensionUnitMode 和 prompt_contract.dimension_units 处理所有图型中新加的尺寸、重量和容量标注，包含场景图角标。both 必须在同一标签中同时显示公制和英制换算值，公制在前、英制放括号内；metric 只显示公制，imperial 只显示英制。原始事实只给一种单位时也要做等值换算，不能省掉另一种；换算不是新事实，不能改原始数值含义或混用不同款式的规格。不为了单位规则给无文字图片新增标注，实物原有印字按原图保留。
reference_indexes 指原始上传编号，必须把 primary_reference_index 放在第一位，并包含本图所引用参考事实的来源图；只发送确实需要的图。构图主主体不被辅助说明图改写。无参考图时返回空数组。
遵守 locked_items 中用户锁定的图片 ID、类型或提示词；保留 mandatory_slots 的平台硬要求。SKU 白底图与源图重构不计入 task_count，也不要放入 items。
只返回符合 schema 的 JSON；reuse_analysis 为 true 时只返回 suite_strategy 和 items，复用上下文中的已校验事实及 ID，不重做商品分析，不改写主体身份；否则同时提供本次 reference_roles、sku_subjects、audience_strategy、product_insights、suite_strategy 与全部 items。结果不能少条、多条、放占位内容或把原模板提示词原样拼回。`;

export function buildCreationMarketingContext(input, basePlan, referenceImages = []) {
  const count = Number(input.imageCount ?? basePlan.imageCount);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREATION_MARKETING_IMAGES) throw new Error("AI 营销套图数量必须为 1–20 张。");
  const referenceRoles = basePlan.referenceImageRoles || [];
  const primary = referenceRoles.find((entry) => entry.role === "reference-product") || referenceRoles.find((entry) => entry.role === "product");
  const unitMode = normalizeCreationDimensionUnitMode(input.dimensionUnitMode ?? basePlan.dimensionUnitMode);
  const targetLanguage = input.targetLanguage || basePlan.targetLanguage;
  return {
    task_count: count, productName: input.productName, productDescription: input.productDescription,
    user_supplement: String(input.marketingSupplement || "").trim(), variation_seed: String(input.variationSeed || "").trim(),
    targetLanguage: input.targetLanguage || basePlan.targetLanguage,
    platform: basePlan.platform, visualLanguage: input.visualLanguage || basePlan.visualLanguage,
    restricted_terms: CREATION_MARKETING_RESTRICTED_TERMS.map(({ term, match }) => ({ term, match })),
    scenario: input.scenario || basePlan.scenario, dimensionUnitMode: unitMode.value,
    dimensionSpecs: formatCreationDimensionSpecsForMode(input.dimensionSpecs || basePlan.dimensionSpecs, unitMode.value, targetLanguage),
    product_insights: basePlan.productInsights, audience_strategy: basePlan.audienceStrategy,
    quality_requirements: buildCreationMarketingQualityRequirements(basePlan),
    reuse_analysis: (input.analysisValidated === true || input.analysisValidated === "true") && Boolean(basePlan.productInsights?.confirmedFacts?.length),
    primary_reference_index: referenceImages.length ? Number(primary?.index) || 1 : 0,
    prompt_contract: { product_fidelity: referenceImages.length ? buildCreationProductFidelityInstruction(referenceRoles) : "", dimension_units: buildMarketingMeasurementInstruction(unitMode.value), note: "product_fidelity 用于普通单款图；variant-comparison、dimension-fit、spec-table 按各款原图保真，系统逐图注入对应约束。分析名称仅供参考，完整保留本图所需事实和条件。" },
    references: referenceImages.map((image, index) => {
      const reference = referenceRoles.find((entry) => Number(entry.index) === index + 1);
      return { index: index + 1, filename: image.filename || image.name, role: reference?.role || "", note: reference?.note || "" };
    }),
    allowed_image_types: Object.values(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY).map(({ imageType, imageTypeLabel, role, textPolicy, scenePolicy }) => ({ image_type: imageType, title: imageTypeLabel, role, textPolicy, scenePolicy })),
    locked_items: array(basePlan.items).filter((item) => item.itemKind === "carousel" && item.contentAssignment?.kind === "manual" && (item.textPolicy !== "none" || item.role === "atmosphere") && !item.constraints?.some((rule) => rule.level === "blocking")).map((item) => ({ item_id: item.itemId, image_type: item.imageType, prompt: item.prompt })),
    selected_roles: input.selectedRoles || [],
    mandatory_slots: array(basePlan.platformProfile?.slots).filter((slot) => array(slot.constraints).some((rule) => rule.level === "blocking")).map(({ slotKey, imageType, role, composition, textPolicy, scenePolicy, constraints }) => ({ slotKey, imageType, role, composition, textPolicy, scenePolicy, constraints })),
  };
}

export function applyCreationMarketingPlan(basePlan, payload, { count, referenceCount = 0, primaryIndex = 0, lockedItems = [], selectedRoles = [], validateItem, allowPartial = true, sourceIndexes = [], constraintCount = count, allowStrategyRepair = false, allowEmpty = false } = {}) {
  const rows = array(payload?.items);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREATION_MARKETING_IMAGES) throw new Error("AI 营销套图数量必须为 1–20 张。");
  if (!Number.isInteger(constraintCount) || constraintCount < count || constraintCount > MAX_CREATION_MARKETING_IMAGES) throw new Error("营销计划原始数量无效，请重新预览。");
  if ((!rows.length && !(allowPartial && allowEmpty)) || (!allowPartial && rows.length !== count)) throw new Error(`AI 需要一次返回 ${count} 条完整提示词，本次返回 ${rows.length} 条，请重新规划。`);
  if (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex > referenceCount || (referenceCount && !primaryIndex)) throw new Error("引用了不存在的主主体或商品事实来源图。");
  const insights = basePlan.productInsights;
  let suiteStrategy = null;
  let strategyIssue = "";
  try {
    suiteStrategy = normalizeCreationMarketingStrategy(payload?.suite_strategy || basePlan.marketingPlan?.suiteStrategy, insights);
    if (suiteStrategy && [suiteStrategy.coreBuyingReason, ...suiteStrategy.functionalProofs.flatMap((proof) => [proof.buyerBenefit, proof.visualEvidence])]
      .some((value) => findRestrictedTerm(value, CREATION_MARKETING_RESTRICTED_TERMS))) throw new Error("整套营销策略命中受限词，请重新规划。");
  } catch (error) {
    if (!allowStrategyRepair) throw error;
    suiteStrategy = null;
    strategyIssue = error.message;
  }
  const restrictedTerms = CREATION_MARKETING_RESTRICTED_TERMS;
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
    if (new Set(suppliedRefs).size !== suppliedRefs.length || suppliedRefs.some((value) => !Number.isInteger(value) || value < 1 || value > referenceCount)) throw new Error(`AI 第 ${index + 1} 条参考图分配无效。`);
    const requiredRefs = [...new Set([...(primaryIndex ? [primaryIndex] : []), ...factIds.flatMap((factId) => factMap.get(factId).referenceIndexes)])];
    if (requiredRefs.some((value) => !Number.isInteger(value) || value < 1 || value > referenceCount)) throw new Error(`AI 第 ${index + 1} 条引用了不存在的主主体或商品事实来源图。`);
    // 兼容部分网关漏写已知来源编号：只补回分析已经证明的来源，未知来源仍拦截。
    const refs = [...new Set([...requiredRefs, ...suppliedRefs])];
    for (const [field, entries] of Object.entries(sources)) {
      const ids = strings(row[field]);
      if (ids.some((value) => !entries.some((entry) => entry.id === value && entry.factIds.every((factId) => factIds.includes(factId))))) throw new Error(`AI 第 ${index + 1} 条 ${field} 与商品事实不匹配。`);
    }
    const mandatory = basePlan.platformProfile?.slots?.[index];
    if (array(mandatory?.constraints).some((rule) => rule.level === "blocking") && mandatory.imageType !== type.imageType) throw new Error(`AI 第 ${index + 1} 条不符合平台必需图型。`);
    const locked = lockedItems.find((item) => item.item_id === id);
    if (locked && (locked.prompt !== prompt || locked.image_type !== type.imageType)) throw new Error("AI 改写了用户锁定的图片，请重新规划。");
    const primaryRoles = array(basePlan.referenceImageRoles).filter((entry) => Number(entry.index) === primaryIndex);
    const prefix = referenceCount ? buildCreationProductFidelityInstruction(primaryRoles, { role: type.role }) : "";
    const withoutPrefix = prefix && prompt.startsWith(`${prefix}\n`) ? prompt.slice(prefix.length + 1) : prompt;
    const authoredPrompt = withoutPrefix.split(/\r?\n/u).filter((line) => !/^\s*APPEARANCE LOCK\s*:/iu.test(line)).join("\n").trim();
    const preservePrompt = locked || (!allowPartial && basePlan.promptPlanningMode === "ai-batch" && basePlan.marketingPlan);
    if (!preservePrompt && !authoredPrompt) throw new Error(`AI 第 ${index + 1} 条缺少有效的画面提示词。`);
    // 已通过营销项和事实来源校验的事实全部保留到证据链，不能因文本较长而拒绝整套计划。
    const creativeBrief = Object.fromEntries(["purpose", "scene", "action", "framing", "evidence_focus", "visual_form", "text_density", "new_information", "effect_visual"].map((key) => [key, text(row.creative_brief?.[key] || row.marketingAssignment?.creativeBrief?.[key])]));
    const commercialCg = type.role === "atmosphere" || creativeBrief.visual_form === "commercial-cg";
    if (!preservePrompt && commercialCg && creativeBrief.text_density !== "none") throw new Error(`AI 第 ${index + 1} 条商业 CG 必须纯渲染，text_density 必须为 none，请移除画布文案。`);
    const effectPrompt = commercialCg && creativeBrief.effect_visual && !authoredPrompt.includes(creativeBrief.effect_visual) ? creativeBrief.effect_visual : "";
    const measurementPrompt = !commercialCg && type.textPolicy !== "none" && creativeBrief.text_density !== "none"
      ? buildMarketingMeasurementInstruction(basePlan.dimensionUnitMode, factIds.map((factId) => factMap.get(factId)), basePlan.targetLanguage)
      : "";
    const finalPrompt = preservePrompt ? prompt : [prefix, authoredPrompt, effectPrompt, measurementPrompt && !authoredPrompt.includes(measurementPrompt) ? measurementPrompt : "", commercialCg ? CREATION_COMMERCIAL_CG_DIRECTIVE : ""].filter(Boolean).join("\n");
    const referenceSources = refs.map((refIndex) => ({ index: refIndex, note: facts.filter((fact) => factIds.includes(fact.id) && fact.referenceIndexes.includes(refIndex)).map((fact) => fact.text).join("; ") }));
    const checkedFields = [
      ["prompt", finalPrompt],
      ["title", text(row.title)],
      ["marketing_goal", goal],
      ...Object.entries(creativeBrief).map(([key, value]) => [`creative_brief.${key}`, value]),
    ];
    for (const [field, value] of checkedFields) {
      const match = findRestrictedTerm(value, restrictedTerms);
      if (match) throw new Error(`AI 第 ${index + 1} 条 ${field} 命中受限词“${match.term}”。`);
    }
    const marketingAssignment = { goal, creativeBrief, sourceIndex: index + 1, audienceIds: assignments.audience_ids, sellingPointIds: assignments.selling_point_ids, painPointIds: assignments.pain_point_ids, recommendationIds: assignments.recommendation_ids, factIds, referenceIndexes: [...refs] };
    return {
      ...type, ...(requiredSlot(index) ? { required: mandatory.required, constraints: structuredClone(mandatory.constraints), sourceIds: mandatory.sourceIds } : {}),
      textPolicy: preservePrompt ? basePlan.items.find((item) => item.itemId === id)?.textPolicy || type.textPolicy : commercialCg ? "none" : type.textPolicy,
      itemId: id, slotKey: id, slotIndex: carouselItems.length + 1, itemKind: "carousel", title: text(row.title), prompt: finalPrompt,
      promptContext: { version: 1 },
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
  if (!carouselItems.length && !allowEmpty) throw Object.assign(new Error(`AI 营销规划没有可用条目：${removedItems.map((item) => item.reason).join("；")}`), { marketingValidation: validation });
  const extraItems = basePlan.items.filter((item) => item.itemKind !== "carousel").map((item, index) => ({ ...item, slotIndex: carouselItems.length + index + 1 }));
  const items = [...carouselItems, ...extraItems];
  const counts = resolveCreationPlanCounts({ items });
  return {
    ...basePlan, promptPlanningMode: "ai-batch", ...counts,
    marketingPlan: { ...basePlan.marketingPlan, suiteStrategy, strategyIssue, validation, duplicateRisks: findCreationMarketingDuplicateRisks(carouselItems) },
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
