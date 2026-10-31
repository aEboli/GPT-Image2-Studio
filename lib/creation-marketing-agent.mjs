import { createHash } from "node:crypto";
import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";
import { requestPromptAgentAnalysis } from "./prompt-agent.mjs";
import { applyCreationPlanEvidenceRequirements, buildCreationPlan, normalizeCreationReferenceAnalysis, normalizeCreationReferenceRoles } from "./creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_MODE } from "./creation-marketing-plan.mjs";
import { buildCreationItemReferenceImages } from "./creation-reference-labels.mjs";
import { readCreationMarketingPartialJson, summarizeCreationMarketingProgress } from "./creation-marketing-progress.mjs";
import { auditCreationMarketingQuality, finalizeCreationMarketingQuality } from "./creation-marketing-quality.mjs";
import { recordTextModelCall, runWithTextModelRequest } from "./text-model-stream.mjs";

const parse = (value, fallback) => { if (typeof value !== "string") return value ?? fallback; try { return JSON.parse(value); } catch { return fallback; } };

export function creationMarketingInputFingerprint(input = {}, referenceImages = []) {
  const fields = ["productName", "productDescription", "dimensionSpecs", "dimensionUnitMode", "targetLanguage", "imageCount", "ratio", "resolutionTier", "platform", "scenario", "visualLanguage", "industryTemplate", "skuGenerationEnabled", "infographicRebuildEnabled", "skuGenerationRule", "marketingSupplement", "variationSeed"];
  const snapshot = Object.fromEntries(fields.map((key) => [key, String(input[key] ?? "")]));
  snapshot.planningContractVersion = 6;
  snapshot.manualReferences = normalizeCreationReferenceRoles(input.referenceImageRoles).filter((entry) => entry.roleManuallyEdited || entry.role === "reference-product").map(({ index, filename, role, note }) => ({ index, filename, role, note }));
  snapshot.selectedRoles = parse(input.selectedRoles, []);
  snapshot.references = referenceImages.map((image) => ({ filename: image.filename || image.name, content: image.base64 || image.buffer?.toString("base64") || "" }));
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function requestCreationMarketingPlan(options) {
  return runWithTextModelRequest(() => runCreationMarketingPlan(options));
}

async function runCreationMarketingPlan({ input, referenceImages = [], config, fetchImpl = fetch, onProgress, signal }) {
  const count = Number(input.imageCount);
  const startedAt = Date.now();
  let lastOutputAt = 0;
  let attempt = 0;
  const requestTrace = { calls: [], validationMs: 0 };
  const report = (event) => onProgress?.({ ...event, requestTrace: structuredClone(requestTrace), productName: String(input.productName || "").slice(0, 160), attempt, total: count, elapsedMs: Date.now() - startedAt });
  report({ stage: "preparing", message: `正在整理商品资料与 ${referenceImages.length} 张参考图。` });
  try {
    const originalOverrides = parse(input.platformSetOverrides, {});
    const baseInput = { ...input, imageCount: Math.min(count, 18), platformSetOverrides: { ...originalOverrides, imageCount: Math.min(count, 18) } };
    const initial = buildCreationPlan(baseInput);
    const context = buildCreationMarketingContext({ ...input, selectedRoles: parse(input.selectedRoles, []) }, initial, referenceImages);
    const primaryIndex = context.primary_reference_index;
    requestTrace.prepareMs = Date.now() - startedAt;
    const requestDraft = async (requestContext) => {
      signal?.throwIfAborted();
      requestTrace.requests = (requestTrace.requests || 0) + 1;
      return requestPromptAgentAnalysis({ ...config, images: referenceImages, mode: CREATION_MARKETING_PLAN_MODE, contextPrompt: JSON.stringify(requestContext), reasoningEffort: input.reasoningEffort || config?.reasoningEffort || DEFAULT_REASONING_EFFORT, fetchImpl, signal,
      onProgress: (event) => {
        attempt = event.attempt || attempt || 1;
        recordTextModelCall(requestTrace, { ...event, attempt }, { repairRound: requestContext.repair_request?.round || 0 });
        requestTrace.postCount = requestTrace.calls.length;
        if (event.requestId) requestTrace.requestId = event.requestId;
        requestTrace.attempts = attempt;
        if (Number.isFinite(event.firstTextMs)) requestTrace.firstTextMs = event.firstTextMs;
        if (event.stage === "retrying") requestTrace.retryReason = event.message;
        if (!onProgress) return;
        if (event.stage === "receiving") {
          if (Date.now() - lastOutputAt < 150) return;
          lastOutputAt = Date.now();
          report({ stage: requestContext.repair_request ? "repairing" : "receiving", receivedCharacters: event.text.length,
            text: event.text, requestId: event.requestId, firstTextMs: event.firstTextMs, transport: event.transport,
            callId: event.callId, timing: event.timing, usage: event.usage,
            ...(requestContext.repair_request ? {} : summarizeCreationMarketingProgress(readCreationMarketingPartialJson(event.text))),
            message: requestContext.repair_request ? "正在接收问题图片的修复，合格项保持不变。" : "正在接收模型的营销规划，条目尚待校验。" });
        } else {
          lastOutputAt = 0;
          report({ ...event, attempt });
        }
      },
      });
    };
    let json = await requestDraft(context);
    let validationStartedAt = Date.now();
    report({ stage: "validating", ...summarizeCreationMarketingProgress(json), message: `正在校验 ${count} 条提示词、商品事实与参考图分配。` });
    const suppliedRoles = normalizeCreationReferenceRoles(input.referenceImageRoles);
    const analysis = context.reuse_analysis ? { productInsights: initial.productInsights, audienceStrategy: initial.audienceStrategy, skuSubjects: initial.skuSubjects, recommendations: suppliedRoles } : normalizeCreationReferenceAnalysis(json, referenceImages.map((image) => image.filename || image.name), { referenceImageRoles: primaryIndex ? [{ index: primaryIndex, role: "reference-product" }] : suppliedRoles, userFacts: [input.productName, input.productDescription, input.sellingPoints].filter(Boolean).join("\n") });
    // 主体在请求前确定，响应重排或用途重分类不能把全套主体换成辅助图。
    const referenceImageRoles = referenceImages.map((image, index) => {
      const filename = image.filename || image.name;
      const supplied = suppliedRoles.find((entry) => entry.index === index + 1);
      const analyzed = analysis.recommendations.find((entry) => entry.index === index + 1);
      const entry = supplied && (supplied.roleManuallyEdited || supplied.role === "reference-product") ? supplied : analyzed || supplied || {};
      const role = index + 1 === primaryIndex ? (supplied?.role === "reference-product" ? "reference-product" : "product") : entry.role === "reference-product" ? "product" : entry.role || "other";
      return { ...entry, index: index + 1, filename, role };
    });
    const basePlan = buildCreationPlan({ ...baseInput, referenceImageRoles, productInsights: analysis.productInsights, audienceStrategy: analysis.audienceStrategy, skuSubjects: parse(input.skuSubjects, []).length ? input.skuSubjects : analysis.skuSubjects });
    const apply = (payload, allowStrategyRepair = false) => applyCreationMarketingPlan(basePlan, payload, { count, referenceCount: referenceImages.length, primaryIndex, lockedItems: context.locked_items, selectedRoles: context.selected_roles, allowStrategyRepair, allowEmpty: true,
      validateItem: (item) => buildCreationItemReferenceImages(item, referenceImages, referenceImageRoles),
    });
    let plan = apply(json, true);
    let quality = auditCreationMarketingQuality(plan, { lockedItems: context.locked_items, selectedRoles: context.selected_roles });
    requestTrace.validationMs += Date.now() - validationStartedAt;
    const repairs = [];
    for (let round = 1; round <= 2; round += 1) {
      signal?.throwIfAborted();
      const draftRows = Array.isArray(json.items) ? json.items : [];
      const rejected = new Map(plan.marketingPlan.validation.removedItems.filter((entry) => entry.sourceIndex <= count).map((entry) => [entry.sourceIndex, entry]));
      for (let index = plan.marketingPlan.validation.returnedCount + 1; index <= count; index += 1) {
        rejected.set(index, { sourceIndex: index, reason: "模型未返回本张图片的完整规划。" });
      }
      const strategyIssues = quality.issues.filter((issue) => ["strategy-missing", "strategy-invalid", "core-benefit-missing", "strategy-proof-missing"].includes(issue.code));
      const targets = plan.items.filter((item) => quality.issues.some((issue) => issue.itemId === item.itemId)
        && !context.locked_items.some((locked) => locked.item_id === item.itemId)
        && !item.constraints?.some((rule) => rule.level === "blocking")
        && !(quality.issues.some((issue) => issue.itemId === item.itemId && ["functional-proof-missing", "core-benefit-missing"].includes(issue.code))
          && context.selected_roles[item.marketingAssignment.sourceIndex - 1] && !["hero", "effect-comparison"].includes(item.role)));
      const usedIds = new Set(plan.items.map((item) => item.itemId));
      for (const [sourceIndex, entry] of rejected) {
        const row = draftRows[sourceIndex - 1];
        let itemId = typeof row?.item_id === "string" ? row.item_id.trim() : "";
        if (!itemId || usedIds.has(itemId) || draftRows.filter((item) => item?.item_id === itemId).length > 1) {
          itemId = `marketing-repair-${sourceIndex}`;
          while (usedIds.has(itemId) || draftRows.some((item) => item?.item_id === itemId)) itemId += "-repair";
        }
        usedIds.add(itemId);
        targets.push({ itemId, marketingAssignment: { sourceIndex }, rejectionReason: entry.reason, constraints: basePlan.platformProfile?.slots?.[sourceIndex - 1]?.constraints || [] });
      }
      targets.sort((left, right) => left.marketingAssignment.sourceIndex - right.marketingAssignment.sourceIndex);
      const targetIds = targets.map((item) => item.itemId);
      const strategyOnly = !targets.length && strategyIssues.length > 0;
      if (!targets.length && !strategyOnly) break;
      const repairIssues = [...quality.issues.filter((issue) => targetIds.includes(issue.itemId) || strategyIssues.includes(issue)),
        ...targets.filter((item) => item.rejectionReason).map((item) => ({ code: "item-invalid", itemId: item.itemId, sourceIndex: item.marketingAssignment.sourceIndex, message: item.rejectionReason }))];
      report({ stage: "reviewing", ...summarizeCreationMarketingProgress(plan), quality, message: `正在修复 ${rejected.size} 张不可用规划及策略、功能或分工问题。` });
      const repairContext = {
        ...context, task_count: targets.length, reuse_analysis: true,
        product_insights: basePlan.productInsights, audience_strategy: basePlan.audienceStrategy,
        quality_requirements: quality.requirements, suite_strategy: json.suite_strategy || null,
        selected_roles: targets.map((item) => context.selected_roles[item.marketingAssignment.sourceIndex - 1] || ""),
        repair_request: {
          round, max_rounds: 2, original_task_count: count, strategy_only: strategyOnly, target_item_ids: targetIds, issues: repairIssues,
          targets: targets.map((item) => ({ ...json.items?.[item.marketingAssignment.sourceIndex - 1], item_id: item.itemId, source_index: item.marketingAssignment.sourceIndex,
            ...(item.rejectionReason ? { rejected: true, rejection_reason: item.rejectionReason } : {}),
            selected_role: context.selected_roles[item.marketingAssignment.sourceIndex - 1] || "", constraints: item.constraints || [] })),
          accepted_items: plan.items.filter((item) => item.itemKind === "carousel" && !targetIds.includes(item.itemId)).map((item) => ({
            item_id: item.itemId, marketing_goal: item.marketingAssignment.goal, creative_brief: item.marketingAssignment.creativeBrief,
            fact_ids: item.marketingAssignment.factIds,
            ...(context.locked_items.some((locked) => locked.item_id === item.itemId) ? { prompt: item.prompt } : {}),
          })),
          previous_rejection: repairs.at(-1)?.rejection || "",
        },
      };
      report({ stage: "repairing", repairRound: round, quality, message: strategyOnly ? `第 ${round}/2 轮：正在修复整套营销策略，全部已通过图片保持不变。` : `第 ${round}/2 轮：只修复 ${targets.length} 张问题图片，其余已通过图片保持不变。` });
      const record = { round, targetItemIds: targets.map((item) => item.itemId), beforeIssues: repairIssues.length };
      let repairValidationStartedAt;
      try {
        const patch = await requestDraft(repairContext);
        repairValidationStartedAt = Date.now();
        const rows = Array.isArray(patch.items) ? patch.items : [];
        if (rows.length !== targets.length || rows.some((row) => !row || typeof row !== "object" || !record.targetItemIds.includes(row.item_id))
          || new Set(rows.map((row) => row.item_id)).size !== targets.length) throw new Error("局部修复必须完整返回指定图片 ID，不能返回、改写或遗漏其他图片。");
        const replacements = new Map(targets.map((item) => [item.marketingAssignment.sourceIndex, rows.find((row) => row.item_id === item.itemId)]));
        const candidateJson = { ...json, suite_strategy: patch.suite_strategy || json.suite_strategy,
          items: Array.from({ length: Math.max(json.items?.length || 0, ...replacements.keys()) }, (_, index) => replacements.get(index + 1) || json.items?.[index] || null) };
        const normalizedCandidate = apply(candidateJson);
        const acceptedItemsById = new Map(plan.items
          .filter((item) => item.itemKind === "carousel" && !targetIds.includes(item.itemId))
          .map((item) => [item.itemId, item]));
        const preserveAcceptedItem = (item) => {
          const accepted = acceptedItemsById.get(item.itemId);
          return accepted && accepted.marketingAssignment?.sourceIndex === item.marketingAssignment?.sourceIndex
            ? accepted
            : item;
        };
        const candidateItems = normalizedCandidate.items.map(preserveAcceptedItem);
        const candidate = {
          ...normalizedCandidate,
          items: candidateItems,
          slots: candidateItems.filter((item) => item.itemKind === "carousel"),
        };
        if (plan.items.filter((item) => item.itemKind === "carousel").some((item) => !candidate.items.some((next) => next.itemId === item.itemId && next.marketingAssignment?.sourceIndex === item.marketingAssignment.sourceIndex
          && (targetIds.includes(item.itemId) || next.prompt === item.prompt && next.imageType === item.imageType)))) {
          throw new Error(candidate.marketingPlan.validation.removedItems.map((item) => item.reason).join("；") || "局部修复未通过原有事实与图型校验。");
        }
        json = candidateJson; plan = candidate;
        quality = auditCreationMarketingQuality(plan, { lockedItems: context.locked_items, selectedRoles: context.selected_roles });
        record.afterIssues = quality.issues.length;
      } catch (error) {
        if (signal?.aborted) throw error;
        record.rejection = error.message;
        record.afterIssues = quality.issues.length;
      }
      if (repairValidationStartedAt !== undefined) requestTrace.validationMs += Date.now() - repairValidationStartedAt;
      repairs.push(record);
    }
    quality = { ...quality, repairRounds: repairs.length, repairs };
    if (!plan.items.some((item) => item.itemKind === "carousel")) throw Object.assign(new Error(`AI 营销规划没有可用条目：${plan.marketingPlan.validation.removedItems.map((item) => item.reason).join("；") || "模型未返回有效图片任务。"}`), { marketingValidation: plan.marketingPlan.validation, marketingQuality: quality });
    validationStartedAt = Date.now();
    plan = finalizeCreationMarketingQuality(plan, quality, { lockedItems: context.locked_items, selectedRoles: context.selected_roles });
    const effectiveRoles = context.selected_roles.length ? plan.items.filter((item) => item.marketingAssignment).map((item) => context.selected_roles[item.marketingAssignment.sourceIndex - 1] || "") : [];
    plan.marketingPlan = { ...plan.marketingPlan, requestTrace, version: 5, inputFingerprint: creationMarketingInputFingerprint({ ...input, imageCount: plan.imageCount, selectedRoles: effectiveRoles }, referenceImages), primaryReferenceIndex: primaryIndex, model: config.responsesModel, createdAt: new Date().toISOString(), marketingSupplement: String(input.marketingSupplement || ""), variationSeed: String(input.variationSeed || ""), selectedRoles: context.selected_roles, effectiveSelectedRoles: effectiveRoles, lockedItems: context.locked_items.filter((locked) => plan.items.some((item) => item.itemId === locked.item_id)) };
    const result = applyCreationPlanEvidenceRequirements(plan);
    requestTrace.validationMs += Date.now() - validationStartedAt;
    requestTrace.totalMs = Date.now() - startedAt;
    const validation = result.marketingPlan.validation;
    const partial = validation.removedItems.length || validation.missingCount;
    const advice = result.marketingPlan.quality.issues.length ? `另有 ${result.marketingPlan.quality.issues.length} 条优化建议，不影响有效图片生成。` : "";
    report({ stage: partial ? "partial" : "complete", ...summarizeCreationMarketingProgress(result), message: (partial ? `可生成 ${result.imageCount} 张，缺失 ${count - result.imageCount} 张；不可用项已单独跳过。` : `${count} 条营销提示词可生成，可查看逐图预览。`) + advice });
    return result;
  } catch (error) {
    report({ stage: signal?.aborted ? "interrupted" : "error", validation: error.marketingValidation, quality: error.marketingQuality, message: error.message || "营销规划未完成，请查看错误详情。" });
    throw error;
  }
}
