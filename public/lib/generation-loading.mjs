import {
  beatHeartbeatMorphIcon,
  createHeartbeatMorphIcon,
  destroyHeartbeatMorphIcon,
} from "./heartbeat-morph-icon.mjs";
import { hasHeartbeatPrefix } from "./generation-activity-feed.mjs";

export const GENERATION_LOADING_BASE_INTERVAL_MS = 800;
export const GENERATION_LOADING_BASE_PERCENT = 20;
export const GENERATION_LOADING_STEP_PERCENT = 10;
export const GENERATION_LOADING_STEP_INTERVAL_MS = 1500;
export const GENERATION_LOADING_MAX_PERCENT = 99;
export const GENERATION_LOADING_WAITING_MODE = "waiting";
export const GENERATION_LOADING_GENERATING_MODE = "generating";
export const GENERATION_LOADING_GENERATING_LABEL = "生图生成中";
export const GENERATION_LOADING_WAITING_LABEL = "排队等待中";
export const GENERATION_LOADING_QUEUED_FAMILY = "queued";
export const GENERATION_LOADING_UPLOADING_FAMILY = "uploading";
export const GENERATION_LOADING_CONNECTING_FAMILY = "connecting";
export const GENERATION_LOADING_GENERATING_FAMILY = "generating";
export const GENERATION_LOADING_RECOVERING_FAMILY = "recovering";
export const GENERATION_LOADING_SAVING_FAMILY = "saving";
export const GENERATION_LOADING_FAILED_FAMILY = "failed";
export const GENERATION_LOADING_DEFAULT_FAMILY = GENERATION_LOADING_GENERATING_FAMILY;

/* 真实请求阶段到色相族的映射：色相表达当前在做什么，深浅另由百分比决定。
   取值与 lib/preview-placeholder-state.mjs 的 statusStage 保持一致。 */
export const GENERATION_LOADING_STAGE_FAMILIES = {
  queued: GENERATION_LOADING_QUEUED_FAMILY,
  uploading: GENERATION_LOADING_UPLOADING_FAMILY,
  connecting: GENERATION_LOADING_CONNECTING_FAMILY,
  generating: GENERATION_LOADING_GENERATING_FAMILY,
  waiting_upstream: GENERATION_LOADING_RECOVERING_FAMILY,
  waiting_final: GENERATION_LOADING_RECOVERING_FAMILY,
  retrying_upstream: GENERATION_LOADING_RECOVERING_FAMILY,
  missing_final_recovery: GENERATION_LOADING_RECOVERING_FAMILY,
  fallback_final_image: GENERATION_LOADING_RECOVERING_FAMILY,
  partial_image_fallback: GENERATION_LOADING_RECOVERING_FAMILY,
  recovering_original: GENERATION_LOADING_RECOVERING_FAMILY,
  waiting_original: GENERATION_LOADING_RECOVERING_FAMILY,
  recovered_original: GENERATION_LOADING_RECOVERING_FAMILY,
  recovery_unavailable: GENERATION_LOADING_RECOVERING_FAMILY,
  reference_generating: GENERATION_LOADING_GENERATING_FAMILY,
  saving: GENERATION_LOADING_SAVING_FAMILY,
  error: GENERATION_LOADING_FAILED_FAMILY,
  failed: GENERATION_LOADING_FAILED_FAMILY,
  original_failed: GENERATION_LOADING_FAILED_FAMILY,
};

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

export function getGenerationLoadingItemStage(item = null) {
  return String(item?.statusStage || item?.stage || item?.status || "").trim();
}

export function getGenerationLoadingStageFamily(stage = "", mode = GENERATION_LOADING_GENERATING_MODE) {
  const normalizedStage = String(stage || "").trim();
  if (GENERATION_LOADING_STAGE_FAMILIES[normalizedStage]) {
    return GENERATION_LOADING_STAGE_FAMILIES[normalizedStage];
  }
  /* 未知或缺失阶段时，等待态归入排队族，其余按生成族显示，不猜测更靠后的阶段。 */
  return isWaitingLoadingMode(mode) ? GENERATION_LOADING_QUEUED_FAMILY : GENERATION_LOADING_DEFAULT_FAMILY;
}

/* 实时日志行由调用点显式开启：小尺寸占位放不下一行文本，硬塞会挤压百分比。 */
function renderGenerationLoadingLog(nodes) {
  if (!nodes?.log) {
    return;
  }
  const rawText = nodes.showLog ? String(nodes.logText || "").trim() : "";
  /* 心跳不再占一行字：变形图标本身就是「上游还活着」的回执，
     再把「heartbeat（15 秒）：上游服务仍在处理，请保持页面打开」原文打出来是重复的。
     只滤心跳这一类，其余状态文本（正在生成图片、正在保存到本地图片目录等）照旧显示。 */
  const text = hasHeartbeatPrefix(rawText) ? "" : rawText;
  nodes.log.textContent = text;
  nodes.log.hidden = !text;
  nodes.shell.dataset.generationLoadingLog = text ? "on" : "off";
  /* 心跳图标跟着日志行走：能显示状态文本的宿主才有空间放它。
     等待态还没有上游心跳可言，所以排队时也不显示。
     注意判定用 showLog 而不是 text——心跳文本被滤掉后 text 是空的，图标仍要显示。 */
  if (nodes.heartbeat?.svg) {
    const showHeartbeat = Boolean(nodes.showLog) && !isWaitingLoadingMode(nodes.mode);
    nodes.heartbeat.svg.hidden = !showHeartbeat;
    nodes.shell.dataset.generationLoadingHeartbeat = showHeartbeat ? "on" : "off";
  }
}

/* 上游每推来一次 heartbeat 调一次：一次切换等于一次心跳唤起。 */
export function beatGenerationLoadingHeartbeat(nodes) {
  if (!nodes?.heartbeat || nodes.heartbeat.svg?.hidden) {
    return "";
  }
  const name = beatHeartbeatMorphIcon(nodes.heartbeat);
  if (name && nodes.source && Number.isInteger(nodes.heartbeat.index)) {
    nodes.source.heartbeatIndex = nodes.heartbeat.index;
  }
  return name;
}

export function getGenerationLoadingHeartbeatIcon(nodes) {
  return String(nodes?.heartbeat?.name || "");
}

export function getGenerationLoadingHeartbeatBeats(nodes) {
  return Number(nodes?.heartbeat?.beats || 0);
}

function renderGenerationLoadingProgress(nodes, value = nodes?.progress) {
  if (!nodes?.shell) {
    return;
  }
  const progress = clampProgress(value);
  const waiting = isWaitingLoadingMode(nodes.mode);
  nodes.progress = progress;
  nodes.family = getGenerationLoadingStageFamily(nodes.stage, nodes.mode);
  nodes.shell.dataset.progress = String(progress);
  nodes.shell.dataset.generationLoadingMode = normalizeLoadingMode(nodes.mode);
  nodes.shell.dataset.generationLoadingStage = String(nodes.stage || "");
  nodes.shell.dataset.generationLoadingFamily = nodes.family;
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
      heartbeatIndex: null,
      nodes: new Set(),
      timer: null,
    };
    sharedLoadingSources.set(normalizedKey, source);
  }
  return source;
}

function releaseSharedLoadingSource(source) {
  if (!source || sharedLoadingSources.get(source.key) !== source) {
    return false;
  }

  if (source.timer !== null) {
    globalThis.clearTimeout?.(source.timer);
    source.timer = null;
  }
  source.nodes.forEach((nodes) => {
    if (nodes.source === source) {
      nodes.source = null;
      nodes.timer = null;
      nodes.active = false;
      destroyHeartbeatMorphIcon(nodes.heartbeat);
    }
  });
  source.nodes.clear();
  sharedLoadingSources.delete(source.key);
  return true;
}

/* 队列切走时可临时保留进度源；真正终态必须显式释放，防止下一轮同 key 误继承。 */
export function releaseGenerationLoadingSource(key = "") {
  return releaseSharedLoadingSource(sharedLoadingSources.get(String(key || "")));
}

export function releaseGenerationLoadingSourcesByPrefix(prefix = "") {
  const normalizedPrefix = String(prefix || "");
  if (!normalizedPrefix) {
    return 0;
  }

  let releasedCount = 0;
  [...sharedLoadingSources.entries()].forEach(([key, source]) => {
    if (key.startsWith(normalizedPrefix) && releaseSharedLoadingSource(source)) {
      releasedCount += 1;
    }
  });
  return releasedCount;
}

function detachSharedLoadingNode(nodes, { retainSource = false } = {}) {
  const source = nodes?.source;
  if (!source) {
    return;
  }

  source.nodes.delete(nodes);
  nodes.source = null;
  nodes.timer = null;
  if (source.nodes.size === 0) {
    if (retainSource) {
      scheduleSharedGenerationLoadingTick(source);
    } else {
      releaseSharedLoadingSource(source);
    }
    return;
  }

  syncSharedLoadingTimers(source);
}

function attachSharedLoadingNode(nodes, key) {
  const source = getSharedLoadingSource(key);
  if (!source) {
    return;
  }

  if (!Number.isInteger(source.heartbeatIndex) && Number.isInteger(nodes.heartbeat?.index)) {
    source.heartbeatIndex = nodes.heartbeat.index;
  }
  source.nodes.add(nodes);
  nodes.source = source;
  nodes.progress = source.progress;
  renderGenerationLoadingProgress(nodes, source.progress);
  syncSharedLoadingTimers(source);
}

function scheduleSharedGenerationLoadingTick(source) {
  if (
    !source ||
    sharedLoadingSources.get(source.key) !== source ||
    source.progress >= GENERATION_LOADING_MAX_PERCENT ||
    source.timer !== null
  ) {
    return;
  }

  source.timer = globalThis.setTimeout(() => {
    source.timer = null;
    syncSharedLoadingTimers(source);
    if (sharedLoadingSources.get(source.key) !== source) {
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
  { label = "", key = "", active = true, mode = GENERATION_LOADING_GENERATING_MODE, stage = "", logText = "", showLog = false } = {},
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
  shell.dataset.generationLoadingStage = String(stage || "");
  shell.dataset.generationLoadingFamily = getGenerationLoadingStageFamily(stage, mode);

  /* 心跳图标与百分比同属中间文字层，压在满幅模糊背景之上；
     它只在显示日志行的宿主里出现——小占位放不下，硬塞会挤压百分比。 */
  const existingSource = sharedLoadingSources.get(String(key || ""));
  const heartbeat = createHeartbeatMorphIcon(documentValue, {
    startIndex: existingSource?.heartbeatIndex,
  });
  heartbeat.svg.hidden = true;

  const percent = documentValue.createElement("strong");
  percent.className = "generation-loading-percent";

  const status = documentValue.createElement("span");
  status.className = "generation-loading-label";

  const log = documentValue.createElement("span");
  log.className = "generation-loading-log";
  log.hidden = true;

  shell.append(heartbeat.svg, percent, status, log);

  const nodes = {
    shell,
    heartbeat,
    percent,
    status,
    log,
    progress: 0,
    key: "",
    mode: normalizeLoadingMode(mode),
    stage: String(stage || ""),
    family: getGenerationLoadingStageFamily(stage, mode),
    active: Boolean(active),
    logText: "",
    showLog: Boolean(showLog),
    timer: null,
    source: null,
  };
  shell.__generationLoadingNodes = nodes;
  updateGenerationLoadingShell(nodes, { label, key, active, mode, stage, logText, showLog });
  return nodes;
}

export function updateGenerationLoadingShell(
  nodes,
  { label = "", key = "", active = true, mode = GENERATION_LOADING_GENERATING_MODE, stage = "", reset = false, logText = undefined, showLog = undefined } = {},
) {
  if (!nodes?.shell) {
    return nodes;
  }

  /* 阶段是可选信息：调用点没传时保留上一次已知阶段，避免颜色在重渲染时退回默认族。 */
  nodes.stage = String(stage || nodes.stage || "");
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
  /* 调用点没传 showLog / logText 时保留上一次的值，避免重渲染把日志行关掉或清空。 */
  nodes.showLog = showLog === undefined ? Boolean(nodes.showLog) : Boolean(showLog);
  nodes.logText = logText === undefined ? String(nodes.logText || "") : String(logText || "").trim();
  renderGenerationLoadingProgress(nodes);
  renderGenerationLoadingLog(nodes);

  if (nodes.active && !waiting) {
    scheduleGenerationLoadingTick(nodes);
  } else if (!nodes.active) {
    stopGenerationLoadingShell(nodes);
  }
  return nodes;
}

export function stopGenerationLoadingShell(nodes, { reset = false, retainSource = false } = {}) {
  if (!nodes) {
    return nodes;
  }
  nodes.active = false;
  /* 变形引擎会把实例注册进自己的帧循环，只把节点从 DOM 摘掉会留下常驻实例，
     和共享进度源同一类泄漏。 */
  destroyHeartbeatMorphIcon(nodes.heartbeat);
  if (nodes.source) {
    detachSharedLoadingNode(nodes, { retainSource });
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

export function stopGenerationLoadingShells(root, { retainSource = false } = {}) {
  if (!root?.querySelectorAll) {
    return;
  }
  root.querySelectorAll(".generation-loading-shell").forEach((shell) => {
    stopGenerationLoadingShell(shell.__generationLoadingNodes, { retainSource });
  });
}

export function getGenerationLoadingProgress(nodes) {
  return clampProgress(nodes?.progress);
}

export function getGenerationLoadingMode(nodes) {
  return normalizeLoadingMode(nodes?.mode);
}

export function getGenerationLoadingShellFamily(nodes) {
  return getGenerationLoadingStageFamily(nodes?.stage, nodes?.mode);
}

export function getGenerationLoadingLogText(nodes) {
  return nodes?.showLog ? String(nodes?.logText || "").trim() : "";
}
