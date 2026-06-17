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
  const normalizedMaxParallelTasks = normalizePositiveInteger(maxParallelTasks, 1);
  const normalizedRetryDelayMs = normalizePositiveInteger(retryDelayMs, 250);
  const activeTasksBySessionScope = new Map();

  function getScopeKey(sessionId, requestScope) {
    const scope = String(requestScope || "prompt").trim() || "prompt";
    return `${sessionId}\n${scope}`;
  }

  function getActiveTaskCount(sessionId, requestScope) {
    return activeTasksBySessionScope.get(getScopeKey(sessionId, requestScope))?.size || 0;
  }

  function claimSessionTaskSlot(sessionId, taskId, requestScope) {
    const scopeKey = getScopeKey(sessionId, requestScope);
    const activeTasks = activeTasksBySessionScope.get(scopeKey) || new Set();
    if (activeTasks.size >= normalizedMaxParallelTasks) {
      return false;
    }

    activeTasks.add(taskId);
    activeTasksBySessionScope.set(scopeKey, activeTasks);
    return true;
  }

  async function waitForSessionTaskSlot(sessionId, taskId, requestScope, { isActive = () => true } = {}) {
    while (true) {
      if (!isActive()) {
        throw new Error("Generation request disconnected; queue wait cancelled.");
      }

      if (claimSessionTaskSlot(sessionId, taskId, requestScope)) {
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
