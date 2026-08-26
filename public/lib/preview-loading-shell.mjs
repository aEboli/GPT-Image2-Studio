function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

const PREVIEW_LOADING_ORB_LIMIT = 6;
const PREVIEW_LOADING_ORB_MIN_CENTER_SPACING_PX = 112;
const PREVIEW_LOADING_ORB_ENTRY_GAP_PX = 168;
const PREVIEW_LOADING_STAGES = ["uploading", "connecting", "generating", "saving"];
const PREVIEW_LOADING_STAGE_PHYSICS = {
  uploading: {
    gravity: 0.92,
    viscosity: 0.72,
    settleDuration: 3200,
    flowDuration: 2500,
    surfaceDuration: 3000,
    sedimentDuration: 3600,
  },
  connecting: {
    gravity: 0.98,
    viscosity: 0.82,
    settleDuration: 3400,
    flowDuration: 2700,
    surfaceDuration: 3200,
    sedimentDuration: 3800,
  },
  generating: {
    gravity: 1.08,
    viscosity: 0.9,
    settleDuration: 3600,
    flowDuration: 2900,
    surfaceDuration: 3400,
    sedimentDuration: 4000,
  },
  saving: {
    gravity: 1.16,
    viscosity: 0.66,
    settleDuration: 2500,
    flowDuration: 1900,
    surfaceDuration: 2500,
    sedimentDuration: 3000,
  },
};

export function shouldReusePreviewLoadingShell(previousState = {}, nextState = {}) {
  if (previousState.mode !== "loading" || nextState.mode !== "loading") {
    return false;
  }
  if (previousState.loadingKey && nextState.loadingKey && previousState.loadingKey !== nextState.loadingKey) {
    return false;
  }
  return true;
}

export function getPreviewLoadingShellTheme(placeholderState = {}) {
  const requestedStage = String(placeholderState.stage || "connecting");
  const stage = PREVIEW_LOADING_STAGES.includes(requestedStage) ? requestedStage : "connecting";
  const progressRatio =
    placeholderState.stageCount > 1 ? placeholderState.stageIndex / (placeholderState.stageCount - 1) : 0;
  const countRatio =
    placeholderState.maxConcurrentTasks > 1
      ? (placeholderState.activeJobCount - 1) / (placeholderState.maxConcurrentTasks - 1)
      : 0;
  const energy = clamp(0, 0.16 + countRatio * 0.14 + progressRatio * 0.08, 0.42);
  const progress = clamp(0.22, 0.22 + progressRatio * 0.72, 0.94);
  const physics = PREVIEW_LOADING_STAGE_PHYSICS[stage];
  const gravity = clamp(0.88, physics.gravity + energy * 0.06, 1.24);
  const viscosity = clamp(0.58, physics.viscosity + (1 - energy) * 0.04, 0.96);
  const settleDistance = `${Math.round(4 + gravity * 3)}px`;
  const streamDistance = `${Math.round(16 + gravity * 8)}px`;
  const flowDurationMs = Math.round(physics.flowDuration - energy * 140);
  const phaseViscosity = clamp(0.34, viscosity * 0.68, 0.72);

  return {
    stage,
    progress: progress.toFixed(3),
    ringDuration: `${Math.round(3400 - energy * 720)}ms`,
    counterRingDuration: `${Math.round(4100 - energy * 760)}ms`,
    fillDuration: `${Math.round(2100 - energy * 380)}ms`,
    floatDuration: `${Math.round(3600 - energy * 500)}ms`,
    motionScale: (1 + energy * 0.025).toFixed(3),
    gravity: gravity.toFixed(3),
    viscosity: viscosity.toFixed(3),
    phaseViscosity: phaseViscosity.toFixed(3),
    settleDistance,
    streamDistance,
    settleDuration: `${Math.round(physics.settleDuration - energy * 180)}ms`,
    flowDuration: `${flowDurationMs}ms`,
    flowPhaseDelay: `-${Math.round(flowDurationMs / 2)}ms`,
    surfaceDuration: `${Math.round(physics.surfaceDuration - energy * 160)}ms`,
    sedimentDuration: `${Math.round(physics.sedimentDuration - energy * 180)}ms`,
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
    gravity: theme.gravity,
    viscosity: theme.viscosity,
    phaseViscosity: theme.phaseViscosity,
    settleDistance: theme.settleDistance,
    streamDistance: theme.streamDistance,
    settleDuration: theme.settleDuration,
    flowDuration: theme.flowDuration,
    flowPhaseDelay: theme.flowPhaseDelay,
    surfaceDuration: theme.surfaceDuration,
    sedimentDuration: theme.sedimentDuration,
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
