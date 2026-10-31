import { allocateCreationProductScenes, CREATION_SUPPORTED_VIEWS_INSTRUCTION } from "./creation-product-insights.mjs";
import { selectCreationPromptFacts } from "./creation-prompt-budget.mjs";

const SCENE_ROLES = new Set(["benefit", "scene", "brand-story", "scene-fit-1", "scene-fit-2", "scene-fit-3", "after-sales", "human-handheld", "human-wearable"]);
const REPLACEMENT_ORDER = ["scene-fit-3", "scene-fit-2", "scene-fit-1", "brand-story", "after-sales", "human-handheld", "benefit"];
const PARAMETER = /\d+(?:\.\d+)?\s*(?:mAh|Wh|mA|[WV]|°\s*[CF]|℃|℉|hours?|hrs?|minutes?|小时|分钟|档|级|mm|cm|kg|ml|毫米|厘米|千克|毫升)\b|\d+\s*(?:小时|分钟|档|级|厘米|毫米)/iu;
const idsOf = (facts) => [...new Set(facts.map((fact) => fact.id))];

export const CREATION_COMMERCIAL_CG_DIRECTIVE = "Create a text-free commercial 3D/CG product render with one complete dominant product. Establish sculptural volume and material-specific roughness, reflections and visible texture using shaped key and rim lighting, contact shadows and coherent spatial reflections. Preserve reference-supported geometry, colors, surface details and viewing angles; retain the actual fabric, metal, ceramic or plastic rather than a generic plastic finish. When assigned facts confirm a function, make its benefit immediately visible through a dimensional conceptual effect interacting with the intact product. For confirmed heating, use luminous amber-orange warmth, volumetric heat flow, soft thermal bloom, foreground/background occlusion and local warm light on the real material, not just a warm background or a thin glowing outline. For other confirmed functions, choose their own appropriate visible effect instead of heat. With no confirmed function, show material and volume only. Effects are conceptual, not measured thermal imaging; do not invent internal components, heating-wire layouts, exact affected regions, temperatures, performance values, fire, scorching or melting. No mandatory person or lifestyle action. No added text, headlines, slogans, labels, icons, badges, specification cards, callouts or watermarks; preserve existing physical product markings only.";

function task(taskKey, kind, role, imageType, title, facts, format, directive, extra = {}) {
  return {
    taskKey, kind, role, imageType, title, summary: title,
    factIds: idsOf(facts), sellingPointIds: [], painPointIds: [],
    format, directive, ...extra,
  };
}

function sceneFacts(scene, facts) {
  return facts.filter((fact) => scene?.factIds?.includes(fact.id));
}

function sceneCandidatesForHero(scenes, facts, maxCount = 4) {
  const candidates = scenes.filter((scene) => scene?.action && scene?.environment);
  const withEvidence = candidates.filter((scene) => sceneFacts(scene, facts).length > 0);
  const source = withEvidence.length ? withEvidence : candidates;
  const ranked = [...source].sort((left, right) => {
    const leftFacts = sceneFacts(left, facts).length;
    const rightFacts = sceneFacts(right, facts).length;
    return rightFacts - leftFacts;
  });
  return ranked.slice(0, maxCount);
}

function informationTasks(insights, dimensionLines) {
  const facts = insights.confirmedFacts;
  const dimensionFacts = facts.filter((fact) => fact.kind === "spec" && /\d.*(?:cm|mm|in\b|厘米|毫米|英寸)|尺码|size/iu.test(fact.text));
  const parameters = facts.filter((fact) => ["spec", "function"].includes(fact.kind) && !dimensionFacts.includes(fact) && PARAMETER.test(fact.text));
  const functions = facts.filter((fact) => fact.kind === "function" && !parameters.includes(fact));
  const candidates = [];
  if (dimensionLines.length) candidates.push(task("dimensions", "infographic", "size-capacity-fit", "dimension-fit", "尺寸与适配说明", dimensionFacts,
    "measurement-diagram", "Build a clear dimension infographic with the intact product, exact measurement lines, a scale reference, and compact factual labels from the supplied values."));
  if (functions.length) candidates.push(task("function-explanation", "functional-render", "effect-comparison", "comparison-proof", "核心功能与收益表现", functions,
    "single-product-functional-rendering", "Create one unified functional rendering with a complete dominant product. Make the supported function and buyer benefit visibly readable through the actual effect, action or flow appropriate to these assigned facts. Give the effect spatial depth through foreground/background occlusion, directional flow and plausible local light interaction rather than flat arrows or decorative glowing outlines. Keep the real product surface, structure and color intact in a single uninterrupted composition; every explanatory overlay is a conceptual illustration. Show only source-supported internal components, affected regions and exact supplied performance values, with the visible effect as the main proof."));
  if (parameters.length) candidates.push(task("specifications", "infographic", "spec-table", "spec-table", "可靠参数说明", parameters,
    "parameter-cards", "Place the intact product beside aligned parameter cards. Each card contains one exact assigned value and its stated condition, with related values grouped clearly."));
  const seenPoints = new Set();
  const points = insights.sellingPoints.filter((point) => {
    const relevant = point.factIds.filter((id) => facts.some((fact) => fact.id === id && !dimensionFacts.includes(fact)));
    const key = [...relevant].sort().join("|");
    if (!key || seenPoints.has(key)) return false;
    seenPoints.add(key);
    return true;
  }).slice(0, 4);
  if (points.length >= 2) candidates.push(task("selling-overview", "infographic", "usage-suggestion", "selling-point-stack", "卖点与证据总览", facts.filter((fact) => points.some((point) => point.factIds.includes(fact.id))),
    "benefit-evidence-panels", "Organize the assigned buying reasons with a clear primary benefit and a small amount of supporting evidence. Choose the simplest hierarchy for these facts; use short labels only where useful, without a default ring of icons or repeated product panels.", { sellingPointIds: points.map((point) => point.id) }));
  const steps = facts.filter((fact) => fact.kind === "usage" && /先.{1,80}(?:再|然后)|第一步.{1,80}第二步|step\s*1.{1,80}step\s*2/iu.test(fact.text));
  if (steps.length) candidates.push(task("usage-sequence", "infographic", "usage-suggestion", "selling-point-stack", "使用顺序说明", steps,
    "verified-steps", "Show the explicitly supplied operation steps in order as a compact numbered infographic. Give each step its own visible action, short label, and supporting thumbnail."));
  return candidates;
}

function gap(role, title, message) {
  return task(`gap:${role}`, "gap", role, "", title, [], "none", "No independent sourced task is available for this frame.", {
    evidenceRequirement: { code: "suite-content", label: "独立内容依据", message },
  });
}

// 先给整套分工；不按单张序号取模，也不循环候选来凑张数。
export function buildCreationSuiteContentPlan(roles, insights, { dimensionLines = [], automatic = true, seed = 0, protectedSlotKeys = new Set(), primaryReferenceIndexes = [] } = {}) {
  if (!insights?.confirmedFacts?.length) return { assignments: roles.map(() => null), warnings: [] };
  const isProtected = (entry) => {
    const slot = entry.platformSlot;
    return !automatic || protectedSlotKeys.has(slot.slotKey) || slot.prompt || slot.textPolicy === "none" || slot.logoPolicy === "forbid-overlay" || (slot.constraints || []).some((constraint) => constraint.level === "blocking");
  };
  const facts = insights.confirmedFacts;
  const primaryIndexes = new Set(primaryReferenceIndexes.map(Number).filter((index) => Number.isInteger(index) && index > 0));
  const appearance = facts.filter((fact) => fact.kind === "appearance" && (!primaryIndexes.size || fact.source === "user" || fact.referenceIndexes.some((index) => primaryIndexes.has(index))));
  const availableInfo = informationTasks(insights, dimensionLines);
  const infoByKey = new Map(availableInfo.map((entry) => [entry.taskKey, entry]));
  const usedTasks = new Set();
  const take = (key) => {
    if (!key || usedTasks.has(key)) return null;
    const result = infoByKey.get(key);
    if (result) usedTasks.add(key);
    return result ? structuredClone(result) : null;
  };
  const sceneInsights = { ...insights, usageScenarios: insights.usageScenarios.filter((scene) =>
    scene.factIds.some((id) => facts.some((fact) => fact.id === id && fact.kind !== "spec"))) };
  const sceneAssignments = allocateCreationProductScenes(roles.map((entry) => entry.platformSlot.prompt ? { role: "" } : entry), sceneInsights, {}, seed);
  const scenes = sceneAssignments.filter(Boolean);
  const heroSceneCandidates = sceneCandidatesForHero(
    allocateCreationProductScenes(
      [{ role: "scene", platformSlot: { scenePolicy: "role-default" } }],
      sceneInsights,
      {},
      seed,
    ).filter(Boolean),
    facts,
    1,
  );
  const assignments = roles.map((entry, index) => {
    const role = entry.role;
    if (entry.platformSlot.prompt || (entry.platformSlot.textPolicy === "none" && role !== "atmosphere") || entry.platformSlot.logoPolicy === "forbid-overlay" || (entry.platformSlot.constraints || []).some((constraint) => constraint.level === "blocking")) return task(`manual:${index}`, "manual", role, entry.platformSlot.imageType, entry.platformSlot.prompt ? "使用本图手动填写的提示词" : "遵循当前图型的画面约束", [], "manual", "");
    const infoKey = { "size-capacity-fit": "dimensions", "spec-table": "specifications", "effect-comparison": "function-explanation", "usage-suggestion": "selling-overview" }[role];
    if (infoKey) return take(infoKey) || gap(role, entry.title, "缺少与该图匹配的独立事实，请补充规格、功能说明或操作资料；本图已跳过，不凑图。" );
    if (role === "atmosphere") return task("commercial-cg", "commercial-cg", role, "ownership-atmosphere", "商业 CG 渲染图", [...facts.filter((fact) => fact.kind === "function"), ...appearance],
      "commercial-cg-product-rendering", CREATION_COMMERCIAL_CG_DIRECTIVE);
    if (SCENE_ROLES.has(role)) {
      const scene = sceneAssignments[index];
      const sceneFormat = ["benefit", "brand-story"].includes(role)
          ? "benefit-scene"
          : "use-action-photograph";
      const sceneDirective = "Create one believable uninterrupted photograph of the assigned product use and concrete action. Let the assigned framing, interaction and environment prove this frame's value. Keep added text minimal and give the action room to read.";
      return scene ? task(`action:${scene.actionGroup}`, "scene", role, entry.platformSlot.imageType, scene.title, sceneFacts(scene, facts),
        sceneFormat, sceneDirective, { sceneAssignment: scene, painPointIds: scene.painPointIds })
        : gap(role, entry.title, "可用的独立操作场景已分配完，请减少张数或补充不同用途；本图已跳过，不重复已有动作。");
    }
    if (role === "hero") {
      const heroPoints = insights.sellingPoints.slice(0, 1);
      const heroFactIds = new Set(heroPoints.flatMap((point) => point.factIds));
      const heroFacts = facts.filter((fact) => fact.kind === "appearance" || heroFactIds.has(fact.id));
      const sceneFactsForHero = heroSceneCandidates.flatMap((scene) => sceneFacts(scene, facts));
      const assignedFacts = [...new Map([...heroFacts, ...sceneFactsForHero].map((fact) => [fact.id, fact])).values()];
      const supportedSceneText = heroSceneCandidates.map((scene) => `${scene.title}: ${scene.environment}; ${scene.action}`).join(" | ");
      const directive = [
        "Create a product-first conversion hero with one dominant complete product and one memorable supported buying reason. Choose a clear contextual or studio composition with restrained text and deliberate negative space.",
        supportedSceneText ? `Scene cues: ${supportedSceneText}.` : "Use only supplied product evidence for supporting panels.",
        "Keep a single uninterrupted product-first composition with one clear visual priority.",
      ].join(" ");
      return task("hero", "hero", role, entry.platformSlot.imageType, "主视觉与核心购买理由", assignedFacts,
        "product-hero", directive, { sellingPointIds: heroPoints.map((point) => point.id), sceneAssignments: heroSceneCandidates });
    }
    if (role === "multi-angle") return task("product-views", "product-views", role, entry.platformSlot.imageType, "有依据的商品视角", [],
      "studio-views", CREATION_SUPPORTED_VIEWS_INSTRUCTION);
    if (role === "product-detail" && appearance.length) {
      usedTasks.add(`detail:${appearance[0].id}`);
      return task(`detail:${appearance[0].id}`, "detail", role, "detail-macro", "可见外观细节", [appearance[0]], "macro-photograph", "Show the assigned external component as a tightly cropped evidence photograph with one precise label and a small locator inset for the whole product.");
    }
    if (role === "accessory-gift") {
      const contents = facts.filter((fact) => fact.kind === "package");
      return contents.length ? task("package", "package", role, entry.platformSlot.imageType, "实际到手内容", contents, "contents-flatlay", "Lay out the confirmed package contents with their stated quantities, a clear open-surface arrangement, and concise item labels. Scene props remain context elements.")
        : gap(role, entry.title, "没有确认的包装清单，已跳过；不把场景道具或充电配件当作赠品。");
    }
    if (role === "series-showcase") return task("variants", "variants", role, entry.platformSlot.imageType, "有来源的可售变体", [], "variant-lineup", "Compare the verified supplied sellable variants in one structured lineup or grid, with each complete unit and its supplied color, style, or size label.");
    return gap(role, entry.title, "没有分配到独立的来源事实，请补充资料或减少张数。");
  });

  const warnings = [];
  const replace = (index, assignment) => {
    assignments[index] = assignment;
    warnings.push({ code: "suite-task-reassigned", level: "advisory", slotKey: roles[index].platformSlot.slotKey,
      message: `${roles[index].title}已改为「${assignment.title}」，避免重复场景并补充信息。` });
  };
  const takeNext = () => availableInfo.map((entry) => entry.taskKey).map((key) => usedTasks.has(key) ? null : key).filter(Boolean)[0];
  // 先填有独立依据的空位；只有核心功能尚未呈现时才替换额外场景，不设置信息图配额。
  const replacementIndexes = roles.map((_, index) => index).filter((index) => !isProtected(roles[index]) && assignments[index].kind === "gap")
    .concat(roles.map((entry, index) => entry.role === "usage-suggestion" && !isProtected(entry) && assignments[index].kind === "infographic" ? index : -1).filter((index) => index >= 0))
    .concat(REPLACEMENT_ORDER.flatMap((role) => roles.map((entry, index) => entry.role === role && !isProtected(entry) && assignments[index].kind === "scene" ? index : -1).filter((index) => index >= 0)));
  for (const index of [...new Set(replacementIndexes)]) {
    const missingFunction = availableInfo.find((entry) => entry.kind === "functional-render" && !usedTasks.has(entry.taskKey));
    if (assignments[index].kind !== "gap" && !missingFunction) continue;
    const next = take(missingFunction?.taskKey || takeNext());
    if (next) replace(index, next);
  }
  // 剩余空位只使用尚未讲过的可见细节，不能再借用已耗尽的动作。
  for (let index = 0; index < roles.length; index += 1) {
    if (isProtected(roles[index]) || assignments[index].kind !== "gap") continue;
    if (roles[index].role === "series-showcase") continue;
    const detail = appearance.find((fact) => !usedTasks.has(`detail:${fact.id}`));
    if (!detail) continue;
    usedTasks.add(`detail:${detail.id}`);
    replace(index, task(`detail:${detail.id}`, "detail", "product-detail", "detail-macro", "另一处可见细节", [detail],
      "detail-evidence-crop", "Show the assigned external component as a tightly cropped evidence photograph with one precise label and a small locator inset for the whole product."));
  }
  if (assignments.some((entry) => entry.kind === "gap")) warnings.push({ code: "suite-content-gap", level: "warning",
    message: "当前资料不足以支撑全部独立图片任务；请减少张数或补充新的功能、细节与用途依据，不以重复信息图凑数。" });
  const missingScenes = assignments.filter((entry, index) => SCENE_ROLES.has(roles[index].role) && entry.kind === "gap");
  if (missingScenes.length) warnings.push({ code: "suite-scene-gap", level: "warning", message: `${missingScenes.length}张场景图缺少不同的核心操作，已停止循环分配；可减少张数或补充新用途。` });
  if (insights.usageScenarios.some((scene) => scene.actionGroupInferred)) warnings.push({ code: "suite-legacy-actions", level: "advisory", message: "部分场景来自旧分析，已合并可识别的同类操作；请核对动作分工，重新智能识别可获得更明确的操作组。" });
  return { assignments: assignments.map((assignment) => {
    const assignedFacts = assignment.kind === "commercial-cg"
      ? assignment.factIds.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean)
      : facts.filter((fact) => assignment.factIds.includes(fact.id));
    const recommendationFacts = new Set((insights.marketingRecommendations || [])
      .filter((entry) => entry.factIds.every((id) => assignment.factIds.includes(id))).flatMap((entry) => entry.factIds));
    const assignedPoints = insights.sellingPoints.filter((point) => assignment.sellingPointIds.includes(point.id));
    if (recommendationFacts.size) assignedPoints.sort((left, right) =>
      Number(right.factIds.some((id) => recommendationFacts.has(id))) - Number(left.factIds.some((id) => recommendationFacts.has(id)))
      || left.factIds.length - right.factIds.length);
    const pointFacts = assignedPoints
      .flatMap((point) => point.factIds.map((id) => assignedFacts.find((fact) => fact.id === id)).filter(Boolean));
    const selected = ["dimensions", "specifications", "package", "usage-sequence"].includes(assignment.taskKey)
      ? assignedFacts : selectCreationPromptFacts([...pointFacts, ...assignedFacts], { role: assignment.role });
    const factIds = idsOf(selected);
    assignment = { ...assignment, factIds,
      sellingPointIds: assignment.sellingPointIds.filter((id) => insights.sellingPoints.some((point) => point.id === id && point.factIds.every((factId) => factIds.includes(factId)))),
      ...(assignment.sceneAssignment ? { sceneAssignment: { ...assignment.sceneAssignment, factIds } } : {}),
    };
    const sources = new Map();
    for (const fact of selected) {
      for (const index of fact.referenceIndexes) {
        if (!sources.has(index)) sources.set(index, []);
        sources.get(index).push(fact.text);
      }
    }
    return { ...assignment, referenceSources: [...sources].map(([index, notes]) => ({ index, note: notes.join("; ") })) };
  }), warnings };
}

export function buildCreationContentAssignmentPrompt(assignment) {
  if (!assignment || assignment.kind === "manual") return "";
  return `FRAME TASK: ${assignment.title}. ${assignment.directive} Format: ${assignment.format}.`;
}
