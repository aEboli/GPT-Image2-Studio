export const GENERATION_LOADING_BASE_INTERVAL_MS = 800;
export const GENERATION_LOADING_BASE_PERCENT = 20;
export const GENERATION_LOADING_STEP_PERCENT = 10;
export const GENERATION_LOADING_STEP_INTERVAL_MS = 1500;
export const GENERATION_LOADING_MAX_PERCENT = 99;
export const GENERATION_LOADING_WAITING_MODE = "waiting";
export const GENERATION_LOADING_GENERATING_MODE = "generating";
export const GENERATION_LOADING_GENERATING_LABEL = "生图生成中";
export const GENERATION_LOADING_WAITING_LABEL = "排队等待中";

const sharedLoadingSources = new Map();

function getDocumentRef(documentRef = null) {
  return documentRef || globalThis.document;
}

function normalizeLoadingMode(mode) {
  return String(mode || "") === GENERATION_LOADING_WAITING_MODE
    ? GENERATION_LOADING_WAITING_MODE
    : GENERATION_LOADING_GENERATING_MODE;
}

function isWaitingLoadingMode(mode) {
  return normalizeLoadingMode(mode) === GENERATION_LOADING_WAITING_MODE;
}

function resolveLoadingLabel(label, mode) {
  const text = String(label || "").trim();
  if (text) {
    return text;
  }
  return isWaitingLoadingMode(mode) ? GENERATION_LOADING_WAITING_LABEL : GENERATION_LOADING_GENERATING_LABEL;
}

function clampProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(GENERATION_LOADING_MAX_PERCENT, Math.round(numericValue)));
}

export function getGenerationLoadingInterval(progress = 0) {
  const nextProgress = clampProgress(progress) + 1;
  if (nextProgress <= GENERATION_LOADING_BASE_PERCENT) {
    return GENERATION_LOADING_BASE_INTERVAL_MS;
  }
  const step = Math.ceil((nextProgress - GENERATION_LOADING_BASE_PERCENT) / GENERATION_LOADING_STEP_PERCENT);
  return GENERATION_LOADING_BASE_INTERVAL_MS + step * GENERATION_LOADING_STEP_INTERVAL_MS;
}

function renderGenerationLoadingProgress(nodes, value = nodes?.progress) {
  if (!nodes?.shell) {
    return;
  }
  const progress = clampProgress(value);
  const waiting = isWaitingLoadingMode(nodes.mode);
  nodes.progress = progress;
  nodes.shell.dataset.progress = String(progress);
  nodes.shell.dataset.generationLoadingMode = normalizeLoadingMode(nodes.mode);
  nodes.shell.setAttribute("aria-valuenow", String(progress));
  nodes.shell.style?.setProperty?.("--generation-loading-progress", `${progress}%`);
  nodes.shell.style?.setProperty?.("--generation-loading-rise-duration", `${getGenerationLoadingInterval(progress)}ms`);
  nodes.percent.textContent = waiting ? "" : `${progress}%`;
  nodes.percent.setAttribute("aria-valuenow", String(progress));
}

function syncSharedLoadingTimers(source) {
  source.nodes.forEach((nodes) => {
    nodes.timer = source.timer;
  });
}

function getSharedLoadingSource(key) {
  const normalizedKey = String(key || "");
  if (!normalizedKey) {
    return null;
  }

  let source = sharedLoadingSources.get(normalizedKey);
  if (!source) {
    source = {
      key: normalizedKey,
      progress: 0,
      nodes: new Set(),
      timer: null,
    };
    sharedLoadingSources.set(normalizedKey, source);
  }
  return source;
}

function detachSharedLoadingNode(nodes) {
  const source = nodes?.source;
  if (!source) {
    return;
  }

  source.nodes.delete(nodes);
  nodes.source = null;
  nodes.timer = null;
  if (source.nodes.size === 0) {
    if (source.timer !== null) {
      globalThis.clearTimeout?.(source.timer);
      source.timer = null;
    }
    sharedLoadingSources.delete(source.key);
    return;
  }

  syncSharedLoadingTimers(source);
}

function attachSharedLoadingNode(nodes, key) {
  const source = getSharedLoadingSource(key);
  if (!source) {
    return;
  }

  source.nodes.add(nodes);
  nodes.source = source;
  nodes.progress = source.progress;
  renderGenerationLoadingProgress(nodes, source.progress);
  syncSharedLoadingTimers(source);
}

function scheduleSharedGenerationLoadingTick(source) {
  if (!source || source.nodes.size === 0 || source.progress >= GENERATION_LOADING_MAX_PERCENT || source.timer !== null) {
    return;
  }

  source.timer = globalThis.setTimeout(() => {
    source.timer = null;
    syncSharedLoadingTimers(source);
    if (source.nodes.size === 0) {
      sharedLoadingSources.delete(source.key);
      return;
    }

    source.progress = Math.min(GENERATION_LOADING_MAX_PERCENT, source.progress + 1);
    source.nodes.forEach((nodes) => {
      nodes.progress = source.progress;
      renderGenerationLoadingProgress(nodes, source.progress);
    });
    scheduleSharedGenerationLoadingTick(source);
  }, getGenerationLoadingInterval(source.progress));
  source.timer?.unref?.();
  syncSharedLoadingTimers(source);
}

function scheduleGenerationLoadingTick(nodes) {
  if (!nodes || !nodes.active || isWaitingLoadingMode(nodes.mode)) {
    return;
  }

  if (nodes.source) {
    scheduleSharedGenerationLoadingTick(nodes.source);
    return;
  }

  if (nodes.progress >= GENERATION_LOADING_MAX_PERCENT || nodes.timer !== null) {
    return;
  }

  nodes.timer = globalThis.setTimeout(() => {
    nodes.timer = null;
    if (!nodes.active || isWaitingLoadingMode(nodes.mode)) {
      return;
    }
    nodes.progress = Math.min(GENERATION_LOADING_MAX_PERCENT, nodes.progress + 1);
    renderGenerationLoadingProgress(nodes);
    scheduleGenerationLoadingTick(nodes);
  }, getGenerationLoadingInterval(nodes.progress));
  nodes.timer?.unref?.();
}

export function createGenerationLoadingShell(
  documentRef = null,
  { label = "", key = "", active = true, mode = GENERATION_LOADING_GENERATING_MODE } = {},
) {
  const documentValue = getDocumentRef(documentRef);
  const shell = documentValue.createElement("div");
  shell.className = "generation-loading-shell";
  shell.setAttribute("role", "status");
  shell.setAttribute("aria-live", "polite");
  shell.setAttribute("aria-valuemin", "0");
  shell.setAttribute("aria-valuemax", String(GENERATION_LOADING_MAX_PERCENT));
  shell.setAttribute("aria-valuenow", "0");
  shell.dataset.generationLoadingKey = String(key || "");
  shell.dataset.generationLoadingMode = normalizeLoadingMode(mode);

  const drop = documentValue.createElement("span");
  drop.className = "generation-loading-drop";
  drop.setAttribute("aria-hidden", "true");

  const wave = documentValue.createElement("span");
  wave.className = "generation-loading-wave";
  wave.setAttribute("aria-hidden", "true");
  drop.append(wave);

  const percent = documentValue.createElement("strong");
  percent.className = "generation-loading-percent";

  const status = documentValue.createElement("span");
  status.className = "generation-loading-label";

  shell.append(drop, percent, status);

  const nodes = {
    shell,
    drop,
    wave,
    percent,
    status,
    progress: 0,
    key: "",
    mode: normalizeLoadingMode(mode),
    active: Boolean(active),
    timer: null,
    source: null,
  };
  shell.__generationLoadingNodes = nodes;
  updateGenerationLoadingShell(nodes, { label, key, active, mode });
  return nodes;
}

export function updateGenerationLoadingShell(
  nodes,
  { label = "", key = "", active = true, mode = GENERATION_LOADING_GENERATING_MODE, reset = false } = {},
) {
  if (!nodes?.shell) {
    return nodes;
  }

  const nextKey = String(key || nodes.key || "");
  const nextMode = normalizeLoadingMode(mode);
  const waiting = isWaitingLoadingMode(nextMode);
  if (
    reset ||
    normalizeLoadingMode(nodes.mode) !== nextMode ||
    (nodes.key && nextKey && nodes.key !== nextKey) ||
    (nodes.source && nodes.source.key !== nextKey)
  ) {
    stopGenerationLoadingShell(nodes, { reset: true });
  }
  nodes.key = nextKey;
  nodes.mode = nextMode;
  if (!waiting && nextKey && !nodes.source) {
    attachSharedLoadingNode(nodes, nextKey);
  }
  if (!waiting && nodes.source && nodes.source.nodes.size === 1 && nodes.progress !== nodes.source.progress) {
    nodes.source.progress = clampProgress(nodes.progress);
  }
  nodes.active = Boolean(active);
  nodes.shell.dataset.generationLoadingKey = nextKey;
  const resolvedLabel = resolveLoadingLabel(label, nextMode);
  nodes.shell.setAttribute("aria-label", waiting ? resolvedLabel : `${resolvedLabel}，${nodes.progress}%`);
  nodes.status.textContent = resolvedLabel;
  renderGenerationLoadingProgress(nodes);

  if (nodes.active && !waiting) {
    scheduleGenerationLoadingTick(nodes);
  } else if (!nodes.active) {
    stopGenerationLoadingShell(nodes);
  }
  return nodes;
}

export function stopGenerationLoadingShell(nodes, { reset = false } = {}) {
  if (!nodes) {
    return nodes;
  }
  nodes.active = false;
  if (nodes.source) {
    detachSharedLoadingNode(nodes);
  } else if (nodes.timer !== null) {
    globalThis.clearTimeout?.(nodes.timer);
    nodes.timer = null;
  }
  if (reset) {
    nodes.progress = 0;
    renderGenerationLoadingProgress(nodes);
  }
  return nodes;
}

export function stopGenerationLoadingShells(root) {
  if (!root?.querySelectorAll) {
    return;
  }
  root.querySelectorAll(".generation-loading-shell").forEach((shell) => {
    stopGenerationLoadingShell(shell.__generationLoadingNodes);
  });
}

export function getGenerationLoadingProgress(nodes) {
  return clampProgress(nodes?.progress);
}

export function getGenerationLoadingMode(nodes) {
  return normalizeLoadingMode(nodes?.mode);
}
