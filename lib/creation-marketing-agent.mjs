import { createHash } from "node:crypto";
import { requestPromptAgentAnalysis } from "./prompt-agent.mjs";
import { applyCreationPlanEvidenceRequirements, buildCreationPlan, normalizeCreationReferenceAnalysis, normalizeCreationReferenceRoles } from "./creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_MODE } from "./creation-marketing-plan.mjs";
import { buildCreationItemReferenceImages } from "./creation-reference-labels.mjs";
import { readCreationMarketingPartialJson, summarizeCreationMarketingProgress } from "./creation-marketing-progress.mjs";

const parse = (value, fallback) => { if (typeof value !== "string") return value ?? fallback; try { return JSON.parse(value); } catch { return fallback; } };

export function creationMarketingInputFingerprint(input = {}, referenceImages = []) {
  const fields = ["productName", "productDescription", "dimensionSpecs", "dimensionUnitMode", "targetLanguage", "imageCount", "ratio", "resolutionTier", "platform", "scenario", "visualLanguage", "industryTemplate", "skuGenerationEnabled", "infographicRebuildEnabled", "skuGenerationRule"];
  const snapshot = Object.fromEntries(fields.map((key) => [key, String(input[key] ?? "")]));
  snapshot.manualReferences = normalizeCreationReferenceRoles(input.referenceImageRoles).filter((entry) => entry.roleManuallyEdited || entry.role === "reference-product").map(({ index, filename, role, note }) => ({ index, filename, role, note }));
  snapshot.selectedRoles = parse(input.selectedRoles, []);
  snapshot.references = referenceImages.map((image) => ({ filename: image.filename || image.name, content: image.base64 || image.buffer?.toString("base64") || "" }));
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export async function requestCreationMarketingPlan({ input, referenceImages = [], config, fetchImpl = fetch, onProgress, signal }) {
  const count = Number(input.imageCount);
  const startedAt = Date.now();
  let lastOutputAt = 0;
  let attempt = 0;
  const report = (event) => onProgress?.({ ...event, productName: String(input.productName || "").slice(0, 160), attempt, total: count, elapsedMs: Date.now() - startedAt });
  report({ stage: "preparing", message: `正在整理商品资料与 ${referenceImages.length} 张参考图。` });
  try {
    const originalOverrides = parse(input.platformSetOverrides, {});
    const baseInput = { ...input, imageCount: Math.min(count, 18), platformSetOverrides: { ...originalOverrides, imageCount: Math.min(count, 18) } };
    const initial = buildCreationPlan(baseInput);
    const context = buildCreationMarketingContext({ ...input, selectedRoles: parse(input.selectedRoles, []) }, initial, referenceImages);
    const primaryIndex = context.primary_reference_index;
    const json = await requestPromptAgentAnalysis({ ...config, images: referenceImages, mode: CREATION_MARKETING_PLAN_MODE, contextPrompt: JSON.stringify(context), reasoningEffort: input.reasoningEffort || "medium", fetchImpl, signal,
      onProgress: onProgress ? (event) => {
        attempt = event.attempt || attempt;
        if (event.stage === "receiving") {
          if (Date.now() - lastOutputAt < 150) return;
          lastOutputAt = Date.now();
          report({ stage: "receiving", receivedCharacters: event.text.length,
            ...summarizeCreationMarketingProgress(readCreationMarketingPartialJson(event.text)),
            message: "正在接收模型的营销规划，条目尚待校验。" });
        } else {
          lastOutputAt = 0;
          report(event);
        }
      } : undefined,
    });
    report({ stage: "validating", ...summarizeCreationMarketingProgress(json), message: `正在校验 ${count} 条提示词、商品事实与参考图分配。` });
    const suppliedRoles = normalizeCreationReferenceRoles(input.referenceImageRoles);
    const analysis = normalizeCreationReferenceAnalysis(json, referenceImages.map((image) => image.filename || image.name), { referenceImageRoles: primaryIndex ? [{ index: primaryIndex, role: "reference-product" }] : suppliedRoles, userFacts: [input.productName, input.productDescription, input.sellingPoints].filter(Boolean).join("\n") });
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
    const plan = applyCreationMarketingPlan(basePlan, json, { count, referenceCount: referenceImages.length, primaryIndex, lockedItems: context.locked_items, selectedRoles: context.selected_roles });
    for (const item of plan.items.filter((entry) => entry.marketingAssignment)) buildCreationItemReferenceImages(item, referenceImages, referenceImageRoles);
    plan.marketingPlan = { version: 1, inputFingerprint: creationMarketingInputFingerprint(input, referenceImages), primaryReferenceIndex: primaryIndex, model: config.responsesModel, createdAt: new Date().toISOString(), selectedRoles: context.selected_roles, lockedItems: context.locked_items };
    const result = applyCreationPlanEvidenceRequirements(plan);
    report({ stage: "complete", ...summarizeCreationMarketingProgress(result), message: `${count} 条营销提示词已通过校验，可查看逐图预览。` });
    return result;
  } catch (error) {
    report({ stage: signal?.aborted ? "interrupted" : "error", message: "营销规划未完成，请查看错误详情。" });
    throw error;
  }
}
