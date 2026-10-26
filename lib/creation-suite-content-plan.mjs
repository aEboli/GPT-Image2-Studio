import { allocateCreationProductScenes } from "./creation-product-insights.mjs";

const SCENE_ROLES = new Set(["benefit", "scene", "atmosphere", "brand-story", "scene-fit-1", "scene-fit-2", "scene-fit-3", "after-sales", "human-handheld", "human-wearable"]);
const REPLACEMENT_ORDER = ["scene-fit-3", "scene-fit-2", "scene-fit-1", "atmosphere", "brand-story", "after-sales", "human-handheld", "benefit"];
const PARAMETER = /\d+(?:\.\d+)?\s*(?:mAh|Wh|mA|[WV]|°\s*[CF]|℃|℉|hours?|hrs?|minutes?|小时|分钟|档|级|mm|cm|kg|ml|毫米|厘米|千克|毫升)\b|\d+\s*(?:小时|分钟|档|级|厘米|毫米)/iu;
const idsOf = (facts) => [...new Set(facts.map((fact) => fact.id))];

function task(taskKey, kind, role, imageType, title, facts, format, directive, extra = {}) {
  return {
    taskKey, kind, role, imageType, title, summary: title,
    factIds: idsOf(facts), sellingPointIds: [], painPointIds: [],
    format, directive, ...extra,
  };
}

function informationTasks(insights, dimensionLines) {
  const facts = insights.confirmedFacts;
  const dimensionFacts = facts.filter((fact) => fact.kind === "spec" && /\d.*(?:cm|mm|in\b|厘米|毫米|英寸)|尺码|size/iu.test(fact.text));
  const parameters = facts.filter((fact) => ["spec", "function"].includes(fact.kind) && !dimensionFacts.includes(fact) && PARAMETER.test(fact.text));
  const functions = facts.filter((fact) => fact.kind === "function" && !parameters.includes(fact));
  const candidates = [];
  if (dimensionLines.length) candidates.push(task("dimensions", "infographic", "size-capacity-fit", "dimension-fit", "尺寸与适配说明", dimensionFacts,
    "measurement-diagram", "An accurate dimension diagram with measurement lines and exact supplied values; no other product claims."));
  if (functions.length) candidates.push(task("function-explanation", "infographic", "effect-comparison", "comparison-proof", "功能关系图解", functions.slice(0, 2),
    "function-callouts", "Explain the assigned functions with short labels and thin connectors on the intact external product. Use only visible components and supplied text. Keep internal structure enclosed; do not draw a cutaway or exploded assembly."));
  if (parameters.length) candidates.push(task("specifications", "infographic", "spec-table", "spec-table", "可靠参数说明", parameters,
    "parameter-cards", "Place the intact product beside aligned parameter cards. Each card contains an exact assigned value and its stated condition; do not combine unrelated temperatures, durations, or modes."));
  const seenPoints = new Set();
  const points = insights.sellingPoints.filter((point) => {
    const relevant = point.factIds.filter((id) => facts.some((fact) => fact.id === id && !dimensionFacts.includes(fact)));
    const key = [...relevant].sort().join("|");
    if (!key || seenPoints.has(key)) return false;
    seenPoints.add(key);
    return true;
  }).slice(0, 4);
  if (points.length >= 2) candidates.push(task("selling-overview", "infographic", "usage-suggestion", "selling-point-stack", "卖点与证据总览", facts.filter((fact) => points.some((point) => point.factIds.includes(fact.id))),
    "benefit-evidence-panels", "Create one selling-point infographic: each assigned buying reason gets its own short label and a matching visible evidence inset, connected to the intact product. Use exactly the assigned reasons; this is not an instruction sequence.", { sellingPointIds: points.map((point) => point.id) }));
  const steps = facts.filter((fact) => fact.kind === "usage" && /先.{1,80}(?:再|然后)|第一步.{1,80}第二步|step\s*1.{1,80}step\s*2/iu.test(fact.text));
  if (steps.length) candidates.push(task("usage-sequence", "infographic", "usage-suggestion", "selling-point-stack", "使用顺序说明", steps,
    "verified-steps", "Show only the explicitly supplied operation steps in their supplied order. Each step depicts its own visible action; add no charging, assembly, or cleaning action unless assigned."));
  return candidates;
}

function gap(role, title, message) {
  return task(`gap:${role}`, "gap", role, "", title, [], "none", "No independent sourced task is available for this frame.", {
    evidenceRequirement: { code: "suite-content", label: "独立内容依据", message },
  });
}

// 先给整套分工；不按单张序号取模，也不循环候选来凑张数。
export function buildCreationSuiteContentPlan(roles, insights, { dimensionLines = [], automatic = true, seed = 0, protectedSlotKeys = new Set() } = {}) {
  if (!insights?.confirmedFacts?.length) return { assignments: roles.map(() => null), warnings: [] };
  const isProtected = (entry) => {
    const slot = entry.platformSlot;
    return !automatic || protectedSlotKeys.has(slot.slotKey) || slot.prompt || slot.textPolicy === "none" || slot.logoPolicy === "forbid-overlay" || (slot.constraints || []).some((constraint) => constraint.level === "blocking");
  };
  const facts = insights.confirmedFacts;
  const primaryIndexes = new Set(insights.appearanceLocks.flatMap((lock) => lock.referenceIndexes));
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
  const scenes = allocateCreationProductScenes(roles.map((entry) => entry.platformSlot.prompt ? { role: "" } : entry), sceneInsights, {}, seed);
  const assignments = roles.map((entry, index) => {
    const role = entry.role;
    if (entry.platformSlot.prompt || entry.platformSlot.textPolicy === "none" || entry.platformSlot.logoPolicy === "forbid-overlay" || (entry.platformSlot.constraints || []).some((constraint) => constraint.level === "blocking")) return task(`manual:${index}`, "manual", role, entry.platformSlot.imageType, entry.platformSlot.prompt ? "使用本图手动填写的提示词" : "遵循当前图型的画面约束", [], "manual", "");
    const infoKey = { "size-capacity-fit": "dimensions", "spec-table": "specifications", "effect-comparison": "function-explanation", "usage-suggestion": "selling-overview" }[role];
    if (infoKey) return take(infoKey) || gap(role, entry.title, "缺少与该图匹配的独立事实，请补充规格、功能说明或操作资料；本图已跳过，不凑图。" );
    if (SCENE_ROLES.has(role)) {
      const scene = scenes[index];
      return scene ? task(`action:${scene.actionGroup}`, "scene", role, entry.platformSlot.imageType, scene.title, facts.filter((fact) => scene.factIds.includes(fact.id)),
        "use-action-photograph", "Create one photograph of the assigned product use and action. The assigned framing controls this shot; show only the relevant hands or body area.", { sceneAssignment: scene, painPointIds: scene.painPointIds })
        : gap(role, entry.title, "可用的独立操作场景已分配完，请减少张数或补充不同用途；本图已跳过，不重复已有动作。");
    }
    if (role === "hero") return task("hero", "hero", role, entry.platformSlot.imageType, "主视觉与核心购买理由", facts.filter((fact) => insights.sellingPoints[0]?.factIds.includes(fact.id)),
      "product-hero", "Create a thumbnail-legible product hero with one concise buying reason and the complete supplied sellable unit.", { sellingPointIds: insights.sellingPoints.slice(0, 1).map((point) => point.id) });
    if (role === "multi-angle") return task("product-views", "product-views", role, entry.platformSlot.imageType, "正反与侧面外观", [],
      "studio-views", "Show the same exact product from distinct supplied viewpoints on one neutral seamless background, without text or new variants.");
    if (role === "product-detail" && appearance.length) {
      usedTasks.add(`detail:${appearance[0].id}`);
      return task(`detail:${appearance[0].id}`, "detail", role, "detail-macro", "可见外观细节", [appearance[0]], "macro-photograph", "Create a tight macro of the assigned visible external detail. Keep the whole-product silhouette outside this close crop.");
    }
    if (role === "accessory-gift") {
      const contents = facts.filter((fact) => fact.kind === "package");
      return contents.length ? task("package", "package", role, entry.platformSlot.imageType, "实际到手内容", contents, "contents-flatlay", "Lay out only the confirmed package contents, with their stated quantities. Props from other scenes are not included items.")
        : gap(role, entry.title, "没有确认的包装清单，已跳过；不把场景道具或充电配件当作赠品。");
    }
    if (role === "series-showcase") return task("variants", "variants", role, entry.platformSlot.imageType, "有来源的可售变体", [], "variant-lineup", "Compare only the verified supplied sellable variants; invent no colour, style, or size.");
    return gap(role, entry.title, "没有分配到独立的来源事实，请补充资料或减少张数。");
  });

  const warnings = [];
  const replace = (index, assignment) => {
    assignments[index] = assignment;
    warnings.push({ code: "suite-task-reassigned", level: "advisory", slotKey: roles[index].platformSlot.slotKey,
      message: `${roles[index].title}已改为「${assignment.title}」，避免重复场景并补充信息。` });
  };
  const takeNext = () => availableInfo.map((entry) => entry.taskKey).map((key) => usedTasks.has(key) ? null : key).filter(Boolean)[0];
  const minimum = roles.length >= 12 ? 3 : roles.length >= 6 ? 2 : 0;
  const infoCount = () => assignments.filter((entry) => entry.kind === "infographic").length;
  // 有明确空缺的位置优先补内容，之后才调整额外场景位。
  const replacementIndexes = roles.map((_, index) => index).filter((index) => !isProtected(roles[index]) && assignments[index].kind === "gap")
    .concat(REPLACEMENT_ORDER.flatMap((role) => roles.map((entry, index) => entry.role === role && !isProtected(entry) && assignments[index].kind === "scene" ? index : -1).filter((index) => index >= 0)));
  for (const index of [...new Set(replacementIndexes)]) {
    if (assignments[index].kind !== "gap" && infoCount() >= minimum) continue;
    const next = take(takeNext());
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
      "detail-evidence-crop", "Show only the assigned external component as a tightly cropped evidence photograph, with one precise label. Do not repeat a whole-product tabletop composition."));
  }
  if (infoCount() < minimum) warnings.push({ code: "suite-information-gap", level: "warning",
    message: `当前轮播有${infoCount()}张独立信息图，目标为${minimum}张；请补充不同的功能、可靠参数或使用资料，或减少张数。手动选择的图型保持不变。` });
  const missingScenes = assignments.filter((entry, index) => SCENE_ROLES.has(roles[index].role) && entry.kind === "gap");
  if (missingScenes.length) warnings.push({ code: "suite-scene-gap", level: "warning", message: `${missingScenes.length}张场景图缺少不同的核心操作，已停止循环分配；可减少张数或补充新用途。` });
  if (insights.usageScenarios.some((scene) => scene.actionGroupInferred)) warnings.push({ code: "suite-legacy-actions", level: "advisory", message: "部分场景来自旧分析，已合并可识别的同类操作；请核对动作分工，重新智能识别可获得更明确的操作组。" });
  return { assignments: assignments.map((assignment) => {
    const sources = new Map();
    for (const fact of facts.filter((fact) => assignment.factIds.includes(fact.id))) {
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
  return `FRAME TASK: ${assignment.title}. ${assignment.directive}\nVisual format: ${assignment.format}.`;
}
