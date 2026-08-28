function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }
  return number;
}

export function createSessionTaskSlotLimiter({
  maxParallelTasks = 1,
  retryDelayMs = 250,
  waitMs = wait,
} = {}) {
  // A caller may raise the ceiling for one request, because the configurable
  // generation concurrency is only known per request while this limiter is
  // built once at startup. Without the override a fan-out wider than the
  // scope default would leave its extra workers spinning in the wait loop.
  const resolveMaxParallelTasks = (requestScope, overrideMaxParallelTasks) => {
    const scopeLimit = normalizePositiveInteger(
      typeof maxParallelTasks === "function" ? maxParallelTasks(requestScope) : maxParallelTasks,
      1,
    );
    const override = normalizePositiveInteger(overrideMaxParallelTasks, 0);
    return override > scopeLimit ? override : scopeLimit;
  };
  const normalizedRetryDelayMs = normalizePositiveInteger(retryDelayMs, 250);
  const activeTasksBySessionScope = new Map();

  function getScopeKey(sessionId, requestScope) {
    const scope = String(requestScope || "prompt").trim() || "prompt";
    return `${sessionId}\n${scope}`;
  }

  function getActiveTaskCount(sessionId, requestScope) {
    return activeTasksBySessionScope.get(getScopeKey(sessionId, requestScope))?.size || 0;
  }

  function claimSessionTaskSlot(sessionId, taskId, requestScope, { maxParallelTasks: overrideMaxParallelTasks } = {}) {
    const scopeKey = getScopeKey(sessionId, requestScope);
    const activeTasks = activeTasksBySessionScope.get(scopeKey) || new Set();
    if (activeTasks.size >= resolveMaxParallelTasks(requestScope, overrideMaxParallelTasks)) {
      return false;
    }

    activeTasks.add(taskId);
    activeTasksBySessionScope.set(scopeKey, activeTasks);
    return true;
  }

  async function waitForSessionTaskSlot(
    sessionId,
    taskId,
    requestScope,
    { isActive = () => true, maxParallelTasks: overrideMaxParallelTasks } = {},
  ) {
    while (true) {
      if (!isActive()) {
        throw new Error("Generation request disconnected; queue wait cancelled.");
      }

      if (claimSessionTaskSlot(sessionId, taskId, requestScope, { maxParallelTasks: overrideMaxParallelTasks })) {
        return true;
      }

      await waitMs(normalizedRetryDelayMs);
    }
  }

  function releaseSessionTaskSlot(sessionId, taskId, requestScope) {
    const scopeKey = getScopeKey(sessionId, requestScope);
    const activeTasks = activeTasksBySessionScope.get(scopeKey);
    if (!activeTasks) {
      return;
    }

    activeTasks.delete(taskId);
    if (activeTasks.size === 0) {
      activeTasksBySessionScope.delete(scopeKey);
    }
  }

  return {
    claimSessionTaskSlot,
    getActiveTaskCount,
    getScopeKey,
    releaseSessionTaskSlot,
    waitForSessionTaskSlot,
  };
}
