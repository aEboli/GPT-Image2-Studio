import { selectCreationPromptFacts } from "./creation-prompt-budget.mjs";

const text = (value) => typeof value === "string" ? value.trim().slice(0, 600) : "";
const list = (value) => Array.isArray(value) ? value.slice(0, 32) : [];
const strings = (value) => [...new Set(list(value).map(text).filter(Boolean))];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function getCreationSceneActionGroup(scene = {}) {
  // 旧分析没有操作组；常见交互先合并，不能用换环境或换手机应用绕过去。
  const action = text(scene.action);
  if (/手机|smartphone|\bphone\b/iu.test(action)) return "phone-operation";
  const explicit = text(scene.actionGroup || scene.action_group).toLowerCase().replace(/\s+/gu, "-");
  if (explicit) return explicit;
  if (/相机|camera/iu.test(action)) return "camera-operation";
  if (/牵引绳|遛狗|\bleash\b|walking (?:a |the )?dog/iu.test(action)) return "leash-holding";
  if (/握把|车把|handlebar/iu.test(action)) return "handlebar-grip";
  if (/控制器|controller/iu.test(action)) return "control-operation";
  return action.toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");
}

function parseInsights(value) {
  if (typeof value !== "string") return object(value);
  try { return object(JSON.parse(value)); } catch { return {}; }
}

function hasComparableConflict(comparisons) {
  const groups = new Map();
  const key = (value) => value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
  for (const entry of comparisons) {
    if (!entry.subject || !entry.attribute || !entry.value) continue;
    const group = JSON.stringify([entry.subject, entry.attribute, entry.condition].map(key));
    const values = groups.get(group) || new Set();
    values.add(key(entry.value));
    groups.set(group, values);
  }
  return [...groups.values()].some((values) => values.size > 1);
}

function isUnverifiedRelationship(value) {
  const uncertain = /(?:无法|不能|尚未|难以|未能).{0,32}(?:核实|核对|确认|验证|对应|绑定)|(?:缺少|缺乏|缺失).{0,16}(?:对应关系|关联|资料|证据)|(?:cannot|unable to|not independently).{0,32}(?:verify|confirm)/iu;
  const contradiction = /不一致|互斥|(?:互相|相互)(?:冲突|矛盾)|(?:数值|数字|结构)冲突|contradict|incompatible|inconsistent/iu;
  return uncertain.test(value) && !contradiction.test(value);
}

// 分析结果只能引用本次输入；没有来源的推断不能升级成商品事实。
export function normalizeCreationProductInsights(value, { referenceCount = 0, primaryIndex = 0, userFacts = "" } = {}) {
  const source = parseInsights(value);
  if (!Object.keys(source).length) return null;
  const indexes = (entry) => [...new Set(list(entry.referenceIndexes || entry.reference_indexes)
    .filter((index) => Number.isInteger(index) && index > 0 && index <= referenceCount))];
  const unknowns = strings(source.unknowns);
  const conflicts = list(source.conflicts).map((entry) => ({
    text: text(entry?.text),
    factIds: strings(entry?.factIds || entry?.fact_ids),
    claims: strings(entry?.claims),
    referenceIndexes: indexes(object(entry)),
    ...(Object.hasOwn(object(entry), "comparisons") ? {
      comparisons: list(entry.comparisons).map((comparison) => ({
        subject: text(comparison?.subject), attribute: text(comparison?.attribute),
        condition: text(comparison?.condition), value: text(comparison?.value),
      })),
    } : {}),
  })).filter((entry) => {
    if (!entry.text) return false;
    // 跨图互补、不同款式或不同档位的数值不能互相否定。
    if (entry.comparisons) return hasComparableConflict(entry.comparisons);
    if (!isUnverifiedRelationship(entry.text)) return true;
    unknowns.push(entry.text);
    return false;
  });
  const disputed = new Set(conflicts.flatMap((entry) => entry.factIds));
  const ids = new Set();
  const confirmedFacts = list(source.confirmedFacts || source.confirmed_facts).map((entry) => ({
    id: text(entry?.id), text: typeof entry?.text === "string" ? entry.text.trim() : "",
    kind: ["appearance", "function", "spec", "package", "usage"].includes(entry?.kind) ? entry.kind : "appearance",
    source: entry?.source === "user" ? "user" : "reference",
    referenceIndexes: indexes(object(entry)),
  })).filter((entry) => {
    if (!entry.id || !entry.text || ids.has(entry.id) || disputed.has(entry.id)) return false;
    if (entry.source === "user" ? !String(userFacts).includes(entry.text) : !entry.referenceIndexes.length) return false;
    if (conflicts.some((conflict) => conflict.claims.some((claim) => entry.text.includes(claim)))) return false;
    ids.add(entry.id);
    return true;
  });
  const factIds = (entry) => strings(entry?.factIds || entry?.fact_ids).filter((id) => ids.has(id));
  const groundedPoints = (entries, prefix) => {
    const seen = new Set();
    return list(entries).map((entry, index) => ({ id: text(entry?.id) || `${prefix}-${index + 1}`, text: text(entry?.text), factIds: factIds(entry) }))
      .filter((entry) => entry.text && entry.factIds.length && !seen.has(entry.id) && seen.add(entry.id));
  };
  const painPoints = groundedPoints(source.painPoints || source.pain_points, "pain");
  const audienceSegments = list(source.audienceSegments || source.audience_segments).map((entry, index) => ({
    id: text(entry?.id) || `audience-${index + 1}`, name: text(entry?.name),
    context: text(entry?.context), need: text(entry?.need),
    purchaseTrigger: text(entry?.purchaseTrigger || entry?.purchase_trigger), objection: text(entry?.objection),
    priority: entry?.priority === "primary" ? "primary" : "secondary", factIds: factIds(entry),
  })).filter((entry, index, entries) => entry.name && entry.context && entry.need && entry.factIds.length
    && entries.findIndex((other) => other.id === entry.id || other.name === entry.name) === index).slice(0, 6);
  const painIds = new Set(painPoints.map((entry) => entry.id));
  const seenScenes = new Set();
  const usageScenarios = list(source.usageScenarios || source.usage_scenarios).map((entry, index) => ({
    id: text(entry?.id) || `scene-${index + 1}`, title: text(entry?.title),
    environment: text(entry?.environment), action: text(entry?.action), framing: text(entry?.framing),
    actionGroup: getCreationSceneActionGroup(object(entry)),
    actionGroupInferred: entry?.actionGroupInferred === true || !text(entry?.actionGroup || entry?.action_group),
    people: ["none", "hands", "partial-body"].includes(entry?.people) ? entry.people : "hands",
    factIds: factIds(entry),
    painPointIds: strings(entry?.painPointIds || entry?.pain_point_ids).filter((id) => painIds.has(id)),
    source: "analysis-suggestion",
  })).filter((entry) => {
    const key = `${entry.environment}|${entry.action}`.toLowerCase().replace(/\s+/g, "");
    if (!entry.environment || !entry.action || !entry.factIds.length || seenScenes.has(key)) return false;
    seenScenes.add(key);
    return true;
  }).slice(0, 12);
  const appearanceLocks = list(source.appearanceLocks || source.appearance_locks).map((entry) => ({
    text: typeof entry?.text === "string" ? entry.text.trim() : "", referenceIndexes: indexes(object(entry)),
  })).filter((entry, index, entries) => entry.text && entry.referenceIndexes.length && (!primaryIndex || entry.referenceIndexes.includes(primaryIndex))
    && entries.findIndex((other) => other.text.replace(/\s+/gu, " ") === entry.text.replace(/\s+/gu, " ")) === index).slice(0, 10);
  const marketingRecommendations = groundedPoints(list(source.marketingRecommendations || source.marketing_recommendations).filter((entry) => {
    const references = strings(entry?.factIds || entry?.fact_ids);
    return references.length && references.every((id) => ids.has(id));
  }), "marketing").filter((entry) => !conflicts.some((conflict) => conflict.claims.some((claim) => entry.text.toLowerCase().includes(claim.toLowerCase())))).slice(0, 6);
  return {
    version: 1, appearanceLocks, confirmedFacts,
    sellingPoints: groundedPoints(source.sellingPoints || source.selling_points, "selling"),
    audienceSegments, marketingRecommendations, painPoints, usageScenarios, unknowns: strings(unknowns), conflicts,
  };
}

// 原文也可能包含冲突值，不能只过滤结构化事实后又从描述/参考备注引入。
export function excludeCreationConflictingClaims(value, insights) {
  const claims = insights?.conflicts?.flatMap((entry) => entry.claims) || [];
  if (!claims.length) return String(value || "");
  return String(value || "").split(/(?<=[。；;\n])|\s*\/\s*/u)
    .filter((part) => !claims.some((claim) => part.toLowerCase().includes(claim.toLowerCase())))
    .join(" ").trim();
}

const SCENE_ROLES = new Set(["benefit", "scene", "atmosphere", "brand-story", "scene-fit-1", "scene-fit-2", "scene-fit-3", "after-sales", "human-handheld", "human-wearable"]);

export function buildCreationAppearanceLockPrompt(insights, { referenceIndexes = null } = {}) {
  const locks = (insights?.appearanceLocks || []).filter((entry) => !referenceIndexes || entry.referenceIndexes.some((index) => referenceIndexes.includes(index)));
  return locks.length ? `APPEARANCE LOCK: ${[...new Set(locks.map((entry) => entry.text))].join("; ")}. Preserve surface ownership; position is not handedness.` : "";
}

export const CREATION_SUPPORTED_VIEWS_INSTRUCTION = "Show only reference-supported views on one clean sheet; use observed surfaces and detail crops, with factual labels. Preserve the complete sellable unit, surface-specific parts, markings and opening states; unseen surfaces stay unspecified.";

export function allocateCreationProductScenes(roles = [], insights, scenePresets = {}, seed = 0) {
  if (!insights?.usageScenarios?.length && !insights?.confirmedFacts?.length) {
    return roles.map(() => null);
  }
  const scenes = insights?.usageScenarios || [];
  const usedGroups = new Set();
  const candidates = scenes.filter((scene) => {
    const group = getCreationSceneActionGroup(scene);
    if (!group || usedGroups.has(group)) return false;
    usedGroups.add(group);
    return true;
  });
  const offset = candidates.length ? Math.abs(seed) % candidates.length : 0;
  const available = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  let ordinal = 0;
  return roles.map((entry) => {
    const role = entry.role;
    const slot = entry.platformSlot || entry;
    if (!SCENE_ROLES.has(role) || ["product-only", "none", "white-background"].includes(slot.scenePolicy)) return null;
    const scene = available[ordinal++];
    if (!scene) return null;
    return {
      ...scene,
      actionGroup: getCreationSceneActionGroup(scene),
      people: role === "human-wearable" ? "partial-body" : role === "human-handheld" ? "hands" : scene.people,
    };
  });
}

export function buildCreationProductInsightPrompt(insights, { role = "", index = 0, sceneAssignment = null, includeScene = true, includeMarketingRecommendations = true, includeAppearance = true, contentAssignment = null } = {}) {
  if (!insights && !sceneAssignment) return "";
  const facts = insights?.confirmedFacts || [];
  const selling = insights?.sellingPoints || [];
  const pain = insights?.painPoints || [];
  let focus = [];
  let task = "";
  if (contentAssignment) {
    focus = facts.filter((fact) => contentAssignment.factIds.includes(fact.id));
    const assignedPoints = selling.filter((point) => contentAssignment.sellingPointIds.includes(point.id));
    task = assignedPoints.length ? `BUYING REASONS: ${assignedPoints.map((point) => point.text).join("; ")}.` : "";
  } else if (sceneAssignment?.factIds?.length) {
    focus = facts.filter((fact) => sceneAssignment.factIds.includes(fact.id)).slice(0, 2);
  } else {
    const kinds = ["product-detail", "ingredient-material", "craft-process", "multi-angle"].includes(role) ? ["appearance"]
      : role === "accessory-gift" ? ["package"] : ["function", "usage", "appearance"];
    const candidates = facts.filter((fact) => kinds.includes(fact.kind));
    if (candidates.length) focus = [candidates[index % candidates.length]];
  }
  const point = (role === "after-sales" ? pain : selling)[index % ((role === "after-sales" ? pain : selling).length || 1)];
  const scenePain = insights?.painPoints?.filter((entry) => sceneAssignment?.painPointIds?.includes(entry.id)).slice(0, 1) || [];
  if (!contentAssignment && point && ["hero", "benefit", "usage-suggestion", "after-sales", "effect-comparison"].includes(role)) {
    focus = facts.filter((fact) => point.factIds.includes(fact.id));
    task = `${role === "after-sales" ? "Buyer concern to address visually" : "Single buying reason"}: ${point.text}. Express it through supplied visual evidence and concise labels.`;
  }
  if (!["size-capacity-fit", "spec-table", "accessory-gift"].includes(role) && contentAssignment?.taskKey !== "usage-sequence") focus = selectCreationPromptFacts(focus, { role });
  const focusIds = new Set(focus.map((fact) => fact.id));
  if (!contentAssignment && point && !point.factIds.every((id) => focusIds.has(id))) task = "";
  const recommendations = includeMarketingRecommendations && !["manual", "gap"].includes(contentAssignment?.kind)
    ? (insights?.marketingRecommendations || []).filter((entry) => entry.factIds.length && entry.factIds.every((id) => focusIds.has(id))).slice(0, role === "usage-suggestion" ? 6 : 2)
    : [];
  return [
    includeAppearance ? buildCreationAppearanceLockPrompt(insights) : "",
    task,
    recommendations.length ? `ANALYST MARKETING RECOMMENDATIONS FOR THIS FRAME: ${recommendations.map((entry) => entry.text).join("; ")}.` : "",
    scenePain.length ? `PAIN-POINT CONTEXT: ${scenePain[0].text}.` : "",
    focus.length ? `FRAME EVIDENCE: ${focus.map((fact) => `[${fact.id}; ${fact.source === "user" ? "user" : `ref ${fact.referenceIndexes.join(",")}`}] ${fact.text}`).join("; ")}.` : "",
    includeScene && sceneAssignment ? `SCENE TASK: ${sceneAssignment.environment}; ${sceneAssignment.action}; framing ${sceneAssignment.framing || "product-focused action crop"}; people ${sceneAssignment.people}. Props are context only.` : "",
  ].filter(Boolean).join("\n");
}

// strict JSON schema 与运行时规范化共用字段，兼容 Responses 和 Chat Completions。
const stringSchema = { type: "string" };
const stringListSchema = { type: "array", items: stringSchema };
const indexSchema = { type: "array", items: { type: "integer", minimum: 1 } };
const strictObject = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const arrayOf = (properties, maxItems) => ({ type: "array", maxItems, items: strictObject(properties) });
const pointProperties = { id: stringSchema, text: stringSchema, fact_ids: stringListSchema };
export const CREATION_PRODUCT_INSIGHTS_JSON_SCHEMA = strictObject({
  appearance_locks: arrayOf({ text: { type: "string", description: "短的主体锁定事实，一条只记录一个表面/部件的归属、开合状态或数量关系；画面位置不等于左右手。不重复用途建议，不把多个表面的细节混在一起。" }, reference_indexes: indexSchema }, 10),
  confirmed_facts: arrayOf({ id: stringSchema, text: stringSchema, kind: { type: "string", enum: ["appearance", "function", "spec", "package", "usage"] }, source: { type: "string", enum: ["reference", "user"] }, reference_indexes: indexSchema }, 24),
  selling_points: arrayOf(pointProperties, 8),
  audience_segments: arrayOf({ id: stringSchema, name: stringSchema, context: stringSchema, need: stringSchema, purchase_trigger: stringSchema, objection: stringSchema, priority: { type: "string", enum: ["primary", "secondary"] }, fact_ids: stringListSchema }, 6),
  marketing_recommendations: arrayOf(pointProperties, 6),
  pain_points: arrayOf(pointProperties, 8),
  usage_scenarios: arrayOf({ id: stringSchema, title: stringSchema, environment: stringSchema, action: stringSchema, action_group: stringSchema, framing: stringSchema, people: { type: "string", enum: ["none", "hands", "partial-body"] }, fact_ids: stringListSchema, pain_point_ids: stringListSchema }, 12),
  unknowns: stringListSchema,
  conflicts: arrayOf({
    text: stringSchema, fact_ids: stringListSchema, claims: stringListSchema, reference_indexes: indexSchema,
    comparisons: { type: "array", minItems: 2, maxItems: 12, items: strictObject({ subject: stringSchema, attribute: stringSchema, condition: stringSchema, value: stringSchema }) },
  }, 12),
});
