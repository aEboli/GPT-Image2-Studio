const DEFAULT_MAX_TASKS_PER_SESSION = 20;
const VALID_STATUSES = new Set(["running", "completed", "error"]);

function nowIso() {
  return new Date().toISOString();
}

function cloneTask(task) {
  return JSON.parse(JSON.stringify(task));
}

function normalizeStatus(value) {
  return VALID_STATUSES.has(value) ? value : "running";
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return String(rightTime).localeCompare(String(leftTime));
  });
}

function normalizeTask(task = {}, fallback = {}) {
  const id = String(task.id || fallback.id || "").trim();
  if (!id) {
    throw new Error("任务缺少 id。");
  }

  const createdAt = String(task.createdAt || fallback.createdAt || nowIso());
  const status = normalizeStatus(task.status || fallback.status);
  const errorMessage = String(task.errorMessage || fallback.errorMessage || "");

  return {
    ...fallback,
    ...task,
    id,
    createdAt,
    updatedAt: String(task.updatedAt || nowIso()),
    prompt: String(task.prompt || fallback.prompt || ""),
    ratio: String(task.ratio || fallback.ratio || ""),
    ratioLabel: String(task.ratioLabel || fallback.ratioLabel || ""),
    size: String(task.size || fallback.size || ""),
    quality: String(task.quality || fallback.quality || ""),
    format: String(task.format || fallback.format || ""),
    responsesModel: String(task.responsesModel || fallback.responsesModel || ""),
    imageModel: String(task.imageModel || fallback.imageModel || "gpt-image-2"),
    status,
    statusStage: String(task.statusStage || fallback.statusStage || status),
    statusText: String(task.statusText || fallback.statusText || errorMessage || ""),
    errorMessage,
  };
}

export function createGenerationTaskStore({ maxTasksPerSession = DEFAULT_MAX_TASKS_PER_SESSION } = {}) {
  const sessions = new Map();

  function getSessionTasks(sessionId) {
    const key = String(sessionId || "global-default-session");
    if (!sessions.has(key)) {
      sessions.set(key, new Map());
    }

    return sessions.get(key);
  }

  function trimSession(sessionTasks) {
    const sorted = sortTasks(sessionTasks.values());
    sorted.slice(maxTasksPerSession).forEach((task) => {
      sessionTasks.delete(task.id);
    });
  }

  function upsertTask(sessionId, task) {
    const sessionTasks = getSessionTasks(sessionId);
    const existing = sessionTasks.get(String(task?.id || "").trim());
    const normalized = normalizeTask(task, existing);
    sessionTasks.set(normalized.id, cloneTask(normalized));
    trimSession(sessionTasks);
    return cloneTask(normalized);
  }

  function updateTask(sessionId, taskId, patch = {}) {
    const sessionTasks = getSessionTasks(sessionId);
    const id = String(taskId || "").trim();
    const existing = sessionTasks.get(id);
    if (!existing) {
      return null;
    }

    return upsertTask(sessionId, {
      ...existing,
      ...patch,
      id,
      updatedAt: patch.updatedAt || nowIso(),
    });
  }

  function completeTask(sessionId, taskId, patch = {}) {
    return updateTask(sessionId, taskId, {
      ...patch,
      status: "completed",
      statusStage: "completed",
      statusText: patch.statusText || "图像已成功生成",
    });
  }

  function failTask(sessionId, taskId, patch = {}) {
    const errorMessage = String(patch.errorMessage || patch.statusText || "生成请求失败");
    return updateTask(sessionId, taskId, {
      ...patch,
      status: "error",
      statusStage: "error",
      statusText: errorMessage,
      errorMessage,
    });
  }

  function listTasks(sessionId) {
    return sortTasks(getSessionTasks(sessionId).values()).map(cloneTask);
  }

  return {
    upsertTask,
    updateTask,
    completeTask,
    failTask,
    listTasks,
  };
}
