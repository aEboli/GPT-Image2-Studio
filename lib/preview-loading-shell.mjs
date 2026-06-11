function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

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
