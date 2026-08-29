import { isFatalUpstreamError } from "./upstream-fatal-error.mjs";
import { MAX_ITEM_UPSTREAM_ATTEMPTS } from "./studio-constants.mjs";

export const CREATION_AUTO_REPAIR_MAX_ATTEMPTS = 1;

function hasCompletedCreationAsset(item = {}) {
  return Boolean(item.relativePath || item.imageUrl || item.thumbnailUrl || item.storageKey);
}

function isReconciledMissingAsset(item = {}) {
  return Boolean(item.missingAsset || item.missing_asset);
}

export function getCreationIncompleteItems(set = {}) {
  const items = Array.isArray(set?.items) ? set.items : [];
  return items.filter((item) => isReconciledMissingAsset(item) || item.status !== "completed" || !item.filename || !hasCompletedCreationAsset(item));
}

function getGenerationAttemptCount(item = {}) {
  return Math.max(0, Math.floor(Number(item?.generationAttemptCount) || 0));
}

// Automatic repair shares the initial generation's upstream-attempt budget. A
// user can still explicitly choose a manual re-generation, but the background
// repair pass must never turn a temporary 402 into an unbounded request loop.
export function getCreationAutoRepairableItems(set = {}) {
  return getCreationIncompleteItems(set).filter(
    (item) => getGenerationAttemptCount(item) < MAX_ITEM_UPSTREAM_ATTEMPTS,
  );
}

// The first account-level error among the items auto-repair would retry. Quota,
// key and billing failures reject every request the same way, so another pass
// only burns more upstream calls and leaves the user with the same set.
export function getCreationFatalUpstreamError(set = {}) {
  for (const item of getCreationIncompleteItems(set)) {
    const message = String(item?.error || "").trim();
    if (message && isFatalUpstreamError(message)) {
      return message;
    }
  }

  return "";
}

export function shouldAutoRepairCreationSet({
  set,
  generationScope = "",
  autoRepairAttemptCount = 0,
  canRepair = false,
  maxAttempts = CREATION_AUTO_REPAIR_MAX_ATTEMPTS,
} = {}) {
  const repairableItems = getCreationAutoRepairableItems(set);
  return (
    generationScope === "full" &&
    canRepair &&
    autoRepairAttemptCount < maxAttempts &&
    repairableItems.length > 0 &&
    !repairableItems.some(isReconciledMissingAsset) &&
    !getCreationFatalUpstreamError(set)
  );
}

export function getCreationAutoRepairNotice({
  incompleteCount = 0,
  attemptCount = 1,
  maxAttempts = CREATION_AUTO_REPAIR_MAX_ATTEMPTS,
} = {}) {
  return `有 ${Math.max(1, incompleteCount)} 个套图项未完成，正在自动补图 ${attemptCount}/${maxAttempts}。`;
}

export function getCreationCompletionFeedback(set = {}) {
  const incompleteCount = getCreationIncompleteItems(set).length;
  return incompleteCount > 0
    ? { message: `套图生成结束，仍有 ${incompleteCount} 个项目未完成，可手动补齐。`, tone: "error" }
    : { message: "套图生成完成。", tone: "success" };
}
