export const MAX_CREATION_MARKETING_BATCH_SCHEMES = 20;
export const MAX_CREATION_MARKETING_BATCH_COPIES = 20;
export const CREATION_MARKETING_BATCH_CONCURRENCY = 2;
export const CREATION_MARKETING_BATCH_MAX_RETRIES = 2;
export const CREATION_MARKETING_BATCH_RETRY_DELAYS_MS = Object.freeze([5000, 15000]);

const text = (value) => String(value ?? "").trim();
const runningBatches = new WeakMap();
const RETRYABLE_ERROR = /(?:timeout|timed out|gateway timeout|service unavailable|bad gateway|too many requests|rate limit|temporar|overload|busy|capacity|failed to fetch|network|fetch|连接|网络|超时|中断|稍后|繁忙|容量|\b408\b|\b429\b|\b5\d\d\b)/iu;
const NON_RETRYABLE_ERROR = /(?:api\s*key|apikey|authorization|unauthori[sz]ed|forbidden|permission|credential|billing|quota|credit|balance|payment|额度|余额|账单|密钥|鉴权|权限|参考图无效|商品资料|提示词不能为空|输入无效|校验失败|未填写)/iu;

export function normalizeCreationMarketingBatchSchemeCount(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return Math.min(MAX_CREATION_MARKETING_BATCH_SCHEMES, Math.max(1, Number(fallback) || 1));
  return Math.min(MAX_CREATION_MARKETING_BATCH_SCHEMES, Math.max(1, parsed));
}

export function normalizeCreationMarketingBatchCopies(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return Math.min(MAX_CREATION_MARKETING_BATCH_COPIES, Math.max(1, Number(fallback) || 1));
  return Math.min(MAX_CREATION_MARKETING_BATCH_COPIES, Math.max(1, parsed));
}

export function createCreationMarketingBatchState({
  batchId = `marketing-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  count = 1,
  copiesPerScheme = 1,
  variationSeedFactory = (index) => `${batchId}-${index + 1}`,
} = {}) {
  const total = normalizeCreationMarketingBatchSchemeCount(count);
  const normalizedCopiesPerScheme = normalizeCreationMarketingBatchCopies(copiesPerScheme);
  return {
    batchId: text(batchId) || `marketing-batch-${Date.now()}`,
    total,
    copiesPerScheme: normalizedCopiesPerScheme,
    targetQueueCount: total * normalizedCopiesPerScheme,
    status: "queued",
    pauseReason: "",
    currentIndex: 0,
    activeIndexes: [],
    completedCount: 0,
    enqueuedCount: 0,
    retryCount: 0,
    error: "",
    startedAt: "",
    finishedAt: "",
    elapsedMs: 0,
    timingStartedAt: "",
    updatedAt: new Date().toISOString(),
    schemes: Array.from({ length: total }, (_, index) => ({
      index: index + 1,
      total,
      status: "queued",
      variationSeed: text(variationSeedFactory(index)) || `${batchId}-${index + 1}`,
      targetCount: normalizedCopiesPerScheme,
      enqueuedCount: 0,
      attempts: 0,
      retryCount: 0,
      lastRetryReason: "",
      pendingPlan: null,
      queueJobIds: [],
      setIds: [],
      error: "",
      startedAt: "",
      finishedAt: "",
      elapsedMs: 0,
      timingStartedAt: "",
      updatedAt: "",
    })),
  };
}

export function getCreationMarketingBatchElapsedMs(task, now = Date.now()) {
  const elapsedMs = Number(task?.elapsedMs);
  const accumulated = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const startedAt = Date.parse(task?.timingStartedAt);
  return accumulated + (Number.isFinite(startedAt) && Number.isFinite(now) ? Math.max(0, now - startedAt) : 0);
}

function startTiming(task) {
  const now = new Date(Date.now()).toISOString();
  task.startedAt ||= now;
  task.timingStartedAt = now;
}

function stopTiming(task, finished = false) {
  task.elapsedMs = getCreationMarketingBatchElapsedMs(task);
  task.timingStartedAt = "";
  if (finished && task.startedAt) task.finishedAt ||= new Date(Date.now()).toISOString();
}

export function getCreationMarketingBatchScheme(state, index = 0) {
  return state?.schemes?.[Math.max(0, Number(index) || 0)] || null;
}

export function getCreationMarketingBatchRetryPlan({ error, retryCount = 0, maxRetries = CREATION_MARKETING_BATCH_MAX_RETRIES } = {}) {
  const message = text(error instanceof Error ? error.message : error);
  const normalizedRetryCount = Math.max(0, Number.isInteger(retryCount) ? retryCount : 0);
  const retryable = Boolean(message) && !NON_RETRYABLE_ERROR.test(message) && RETRYABLE_ERROR.test(message);
  const shouldRetry = retryable && normalizedRetryCount < Math.max(0, Number(maxRetries) || 0);
  return {
    retryable,
    shouldRetry,
    retryCount: normalizedRetryCount,
    nextRetryCount: shouldRetry ? normalizedRetryCount + 1 : normalizedRetryCount,
    delayMs: shouldRetry ? CREATION_MARKETING_BATCH_RETRY_DELAYS_MS[Math.min(normalizedRetryCount, CREATION_MARKETING_BATCH_RETRY_DELAYS_MS.length - 1)] : 0,
    message,
  };
}

export function getCreationMarketingBatchNextRunnableIndex(state) {
  return state?.schemes?.findIndex((scheme) => scheme.status === "queued" || scheme.status === "paused") ?? -1;
}

export function canContinueCreationMarketingBatch(state) {
  return state?.status === "paused" && !runningBatches.has(state) && getCreationMarketingBatchNextRunnableIndex(state) >= 0;
}

export function pausePendingCreationMarketingBatch(state) {
  if (!state || !["queued", "running"].includes(state.status)) return state;
  state.status = runningBatches.has(state) ? "pausing" : "paused";
  state.pauseReason = "user";
  state.error = "";
  state.updatedAt = new Date().toISOString();
  runningBatches.get(state)?.abort();
  return state;
}

export function cancelPendingCreationMarketingBatch(state) {
  if (!state || ["completed", "canceled"].includes(state.status)) return state;
  for (const scheme of state.schemes || []) {
    if (!["enqueued", "completed", "failed", "canceled"].includes(scheme.status)) {
      scheme.status = "canceled";
      stopTiming(scheme, true);
      scheme.pendingPlan = null;
      scheme.updatedAt = new Date().toISOString();
    }
  }
  state.status = "canceled";
  stopTiming(state, true);
  state.pauseReason = "";
  state.currentIndex = -1;
  state.activeIndexes = [];
  state.error = "";
  state.updatedAt = new Date().toISOString();
  runningBatches.get(state)?.abort();
  return state;
}

function updateBatch(state, onUpdate) {
  state.updatedAt = new Date().toISOString();
  onUpdate?.(structuredClone(state));
}

export async function runCreationMarketingBatch({
  state,
  generatePlan,
  enqueuePlan,
  onUpdate,
  wait = (milliseconds, signal) => new Promise((resolve) => {
    const timer = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    if (signal?.aborted) done();
    else signal?.addEventListener("abort", done, { once: true });
  }),
  maxRetries = CREATION_MARKETING_BATCH_MAX_RETRIES,
} = {}) {
  if (!state || typeof generatePlan !== "function" || typeof enqueuePlan !== "function") {
    throw new Error("批量 AI 营销规划缺少执行依赖。");
  }
  if (["completed", "canceled"].includes(state.status) || runningBatches.has(state)) return state;
  const interruption = new AbortController();
  const interrupted = new Promise((resolve) => interruption.signal.addEventListener("abort", resolve, { once: true }));
  runningBatches.set(state, interruption);

  state.status = "running";
  startTiming(state);
  state.pauseReason = "";
  state.error = "";
  updateBatch(state, onUpdate);

  const claimed = new Set();
  const active = new Set();
  const syncActive = () => {
    state.activeIndexes = [...active].sort((left, right) => left - right);
    state.currentIndex = state.activeIndexes[0] ?? -1;
  };
  const pauseScheme = (scheme, error = "") => {
    scheme.status = "paused";
    stopTiming(scheme);
    scheme.error = text(error instanceof Error ? error.message : error);
    scheme.updatedAt = new Date().toISOString();
    updateBatch(state, onUpdate);
  };
  const failScheme = (scheme, error) => {
    if (state.status !== "running") {
      pauseScheme(scheme, error);
      return;
    }
    scheme.status = "failed";
    stopTiming(scheme, true);
    scheme.error = text(error instanceof Error ? error.message : error);
    scheme.pendingPlan = null;
    scheme.updatedAt = new Date().toISOString();
    updateBatch(state, onUpdate);
  };

  const runScheme = async (index) => {
    const scheme = state.schemes[index];
    scheme.error = "";
    scheme.status = "planning";
    startTiming(scheme);
    scheme.updatedAt = new Date().toISOString();
    updateBatch(state, onUpdate);

    let planResult = scheme.pendingPlan;
    while (!planResult) {
      scheme.attempts += 1;
      scheme.updatedAt = new Date().toISOString();
      updateBatch(state, onUpdate);
      if (state.status !== "running") {
        if (state.status !== "canceled") pauseScheme(scheme);
        return;
      }
      try {
        planResult = await generatePlan({ scheme, state });
        if (state.status === "canceled") return state;
        scheme.pendingPlan = planResult;
        break;
      } catch (error) {
        if (state.status === "canceled") return;
        const retry = getCreationMarketingBatchRetryPlan({ error, retryCount: scheme.retryCount, maxRetries });
        if (!retry.shouldRetry || state.status !== "running") {
          failScheme(scheme, retry.message || "批量营销规划失败。");
          return;
        }
        scheme.retryCount = retry.nextRetryCount;
        scheme.lastRetryReason = retry.message;
        state.retryCount += 1;
        scheme.status = "retrying";
        scheme.updatedAt = new Date().toISOString();
        updateBatch(state, onUpdate);
        await Promise.race([wait(retry.delayMs, interruption.signal), interrupted]);
        if (state.status !== "running") {
          if (state.status !== "canceled") pauseScheme(scheme);
          return;
        }
        scheme.status = "planning";
        updateBatch(state, onUpdate);
      }
    }

    while (scheme.enqueuedCount < scheme.targetCount) {
      if (state.status !== "running") {
        if (state.status !== "canceled") pauseScheme(scheme);
        return;
      }
      const copyIndex = scheme.enqueuedCount;
      scheme.status = "enqueuing";
      scheme.updatedAt = new Date().toISOString();
      updateBatch(state, onUpdate);
      if (state.status !== "running") {
        if (state.status !== "canceled") pauseScheme(scheme);
        return;
      }
      try {
        const queueJob = await enqueuePlan({
          planResult,
          scheme,
          copyIndex,
          copyNumber: copyIndex + 1,
          state,
        });
        scheme.enqueuedCount += 1;
        scheme.queueJobIds.push(text(queueJob?.id));
        scheme.setIds.push(text(queueJob?.set?.setId || planResult?.set?.setId));
        state.enqueuedCount += 1;
        scheme.updatedAt = new Date().toISOString();
        updateBatch(state, onUpdate);
        if (state.status === "canceled") return state;
      } catch (error) {
        if (state.status === "canceled") return state;
        scheme.pendingPlan = planResult;
        failScheme(scheme, text(error instanceof Error ? error.message : error) || "方案加入队列失败。");
        return state;
      }
    }
    scheme.status = "enqueued";
    stopTiming(scheme, true);
    scheme.pendingPlan = null;
    state.completedCount += 1;
    scheme.updatedAt = new Date().toISOString();
    updateBatch(state, onUpdate);
  };

  const worker = async () => {
    while (state.status === "running") {
      const index = state.schemes.findIndex((scheme, entryIndex) =>
        !claimed.has(entryIndex) && ["queued", "paused"].includes(scheme.status));
      if (index < 0) return;
      claimed.add(index);
      active.add(index);
      syncActive();
      try {
        await runScheme(index);
      } finally {
        active.delete(index);
        syncActive();
        updateBatch(state, onUpdate);
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CREATION_MARKETING_BATCH_CONCURRENCY, state.total) }, () => worker()));
    if (state.status === "running" || (state.status === "pausing" && state.schemes.every((scheme) => ["enqueued", "completed", "failed"].includes(scheme.status)))) {
      state.status = "completed";
      state.pauseReason = "";
      state.error = "";
    } else if (state.status === "pausing") {
      state.status = "paused";
    }
    state.currentIndex = -1;
    state.activeIndexes = [];
    stopTiming(state, ["completed", "canceled"].includes(state.status));
    updateBatch(state, onUpdate);
  } finally {
    runningBatches.delete(state);
  }
  return state;
}
