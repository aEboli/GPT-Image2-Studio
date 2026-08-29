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
  // A caller supplies a ceiling when it first activates a session/scope. That
  // ceiling remains bound until the scope becomes idle, so a concurrent request
  // carrying a higher browser value cannot expand the shared bucket mid-run.
  // This makes the configured concurrency a total per active scope rather than
  // an independent limit for each HTTP request.
  const resolveMaxParallelTasks = (requestScope, overrideMaxParallelTasks) => {
    const override = normalizePositiveInteger(overrideMaxParallelTasks, 0);
    if (override > 0) {
      return override;
    }

    return normalizePositiveInteger(
      typeof maxParallelTasks === "function" ? maxParallelTasks(requestScope) : maxParallelTasks,
      1,
    );
  };
  const normalizedRetryDelayMs = normalizePositiveInteger(retryDelayMs, 250);
  const activeTasksBySessionScope = new Map();

  function getScopeKey(sessionId, requestScope) {
    const scope = String(requestScope || "prompt").trim() || "prompt";
    return `${sessionId}\n${scope}`;
  }

  function getActiveTaskCount(sessionId, requestScope) {
    const taskCounts = activeTasksBySessionScope.get(getScopeKey(sessionId, requestScope))?.taskCounts;
    return taskCounts ? [...taskCounts.values()].reduce((total, count) => total + count, 0) : 0;
  }

  function getActiveTaskLimit(sessionId, requestScope) {
    return activeTasksBySessionScope.get(getScopeKey(sessionId, requestScope))?.maxParallelTasks || 0;
  }

  function claimSessionTaskSlot(sessionId, taskId, requestScope, { maxParallelTasks: overrideMaxParallelTasks } = {}) {
    const scopeKey = getScopeKey(sessionId, requestScope);
    const activeTasks = activeTasksBySessionScope.get(scopeKey) || {
      maxParallelTasks: resolveMaxParallelTasks(requestScope, overrideMaxParallelTasks),
      taskCounts: new Map(),
    };
    if (getActiveTaskCount(sessionId, requestScope) >= activeTasks.maxParallelTasks) {
      return false;
    }

    const normalizedTaskId = String(taskId || "").trim() || "anonymous-task";
    activeTasks.taskCounts.set(normalizedTaskId, (activeTasks.taskCounts.get(normalizedTaskId) || 0) + 1);
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

    const normalizedTaskId = String(taskId || "").trim() || "anonymous-task";
    const currentCount = activeTasks.taskCounts.get(normalizedTaskId) || 0;
    if (currentCount <= 1) {
      activeTasks.taskCounts.delete(normalizedTaskId);
    } else {
      activeTasks.taskCounts.set(normalizedTaskId, currentCount - 1);
    }
    if (activeTasks.taskCounts.size === 0) {
      activeTasksBySessionScope.delete(scopeKey);
    }
  }

  return {
    claimSessionTaskSlot,
    getActiveTaskCount,
    getActiveTaskLimit,
    getScopeKey,
    releaseSessionTaskSlot,
    waitForSessionTaskSlot,
  };
}
