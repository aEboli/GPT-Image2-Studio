function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

const PREVIEW_LOADING_ORB_LIMIT = 6;
const PREVIEW_LOADING_ORB_MIN_CENTER_SPACING_PX = 112;
const PREVIEW_LOADING_ORB_ENTRY_GAP_PX = 168;
const PREVIEW_LOADING_STAGES = ["uploading", "connecting", "generating", "saving"];

export function shouldReusePreviewLoadingShell(previousState = {}, nextState = {}) {
  return previousState.mode === "loading" && nextState.mode === "loading";
}

export function getPreviewLoadingShellTheme(placeholderState = {}) {
  const stage = String(placeholderState.stage || "connecting");
  const progressRatio =
    placeholderState.stageCount > 1 ? placeholderState.stageIndex / (placeholderState.stageCount - 1) : 0;
  const countRatio =
    placeholderState.maxConcurrentTasks > 1
      ? (placeholderState.activeJobCount - 1) / (placeholderState.maxConcurrentTasks - 1)
      : 0;
  const energy = clamp(0, 0.16 + countRatio * 0.14 + progressRatio * 0.08, 0.42);
  const progress = clamp(0.22, 0.22 + progressRatio * 0.72, 0.94);

  return {
    stage,
    progress: progress.toFixed(3),
    ringDuration: `${Math.round(3400 - energy * 720)}ms`,
    counterRingDuration: `${Math.round(4100 - energy * 760)}ms`,
    fillDuration: `${Math.round(2100 - energy * 380)}ms`,
    floatDuration: `${Math.round(3600 - energy * 500)}ms`,
    motionScale: (1 + energy * 0.025).toFixed(3),
  };
}

export function getPreviewLoadingShellItems(placeholderState = {}) {
  const loadingItems = Array.isArray(placeholderState.loadingItems) ? placeholderState.loadingItems : [];
  const activeJobCount = Math.max(1, Number(placeholderState.activeJobCount) || loadingItems.length || 1);
  const visibleCount = Math.min(PREVIEW_LOADING_ORB_LIMIT, activeJobCount);
  return Array.from({ length: visibleCount }, (_, index) => {
    const item = loadingItems[index] || {};
    return {
      id: String(item.id || `preview-loading-${index + 1}`),
      stage: normalizePreviewLoadingOrbStage(item.stage || item.statusStage || placeholderState.stage),
      statusText: String(item.statusText || placeholderState.statusText || "").trim(),
    };
  });
}

export function getPreviewLoadingOrbRenderState(item, index, count, placeholderState = {}) {
  const stageIndex = Math.max(0, PREVIEW_LOADING_STAGES.indexOf(item.stage));
  const theme = getPreviewLoadingShellTheme({
    ...placeholderState,
    stage: item.stage,
    stageIndex,
    stageCount: PREVIEW_LOADING_STAGES.length,
  });
  const layout = getPreviewLoadingOrbLayout(count, index);
  const entry = getPreviewLoadingOrbEntryOffset(item.id, index, layout);

  return {
    stage: theme.stage,
    ariaLabel: item.statusText || placeholderState.statusText || "Generation running",
    progress: theme.progress,
    ringDuration: theme.ringDuration,
    counterRingDuration: theme.counterRingDuration,
    fillDuration: theme.fillDuration,
    floatDuration: theme.floatDuration,
    motionScale: theme.motionScale,
    x: `${layout.x}px`,
    y: `${layout.y}px`,
    enterX: `${entry.x}px`,
    enterY: `${entry.y}px`,
    delay: `${index * 42}ms`,
  };
}

export function getPreviewLoadingOrbLimit() {
  return PREVIEW_LOADING_ORB_LIMIT;
}

function normalizePreviewLoadingOrbStage(stage) {
  const value = String(stage || "");
  return PREVIEW_LOADING_STAGES.includes(value) ? value : "connecting";
}

function getPreviewLoadingOrbLayout(count, index) {
  if (count <= 1) {
    return { x: 0, y: 0 };
  }

  if (count === 2) {
    return { x: index === 0 ? -56 : 56, y: 0 };
  }

  const visibleCount = Math.min(PREVIEW_LOADING_ORB_LIMIT, Math.max(2, count));
  const radius = Math.ceil(PREVIEW_LOADING_ORB_MIN_CENTER_SPACING_PX / (2 * Math.sin(Math.PI / visibleCount))) + 2;
  const startAngle = count === 4 ? -135 : -90;
  const angle = ((startAngle + (360 / visibleCount) * index) * Math.PI) / 180;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

function getPreviewLoadingOrbEntryOffset(id, index, layout = { x: 0, y: 0 }) {
  let hash = 0;
  const text = `${id}:${index}`;
  for (let charIndex = 0; charIndex < text.length; charIndex += 1) {
    hash = (hash * 31 + text.charCodeAt(charIndex)) % 9973;
  }

  const layoutDistance = Math.hypot(layout.x, layout.y);
  if (layoutDistance > 0) {
    const entryGap = PREVIEW_LOADING_ORB_ENTRY_GAP_PX + (hash % 36);
    return {
      x: Math.round(layout.x + (layout.x / layoutDistance) * entryGap),
      y: Math.round(layout.y + (layout.y / layoutDistance) * entryGap),
    };
  }

  const angle = ((hash % 360) * Math.PI) / 180;
  const distance = 150 + (hash % 70);
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
  };
}
