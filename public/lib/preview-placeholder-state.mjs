const LOADING_STAGES = ["uploading", "connecting", "generating", "saving"];
const PREVIEW_LOADING_ITEM_LIMIT = 6;

const LOADING_STAGE_LABELS = {
  uploading: "准备请求",
  connecting: "连接服务",
  generating: "生成画面",
  saving: "写入本地",
};

export function getPreviewPlaceholderState({
  item = null,
  imageUrl = "",
  prompt = "",
  runningCount = 0,
  runningItems = [],
  maxConcurrentTasks = 5,
} = {}) {
  if (imageUrl) {
    return {
      mode: "ready",
      showAnimation: false,
      steps: [],
    };
  }

  if (!item) {
    return {
      mode: "idle",
      eyebrow: "Output Preview",
      title: "生成结果会在这里实时更新。",
      detail: "生成日志可在配置中查看，底部胶片条可快速切换查看。",
      showAnimation: false,
      steps: [],
    };
  }

  const stage = normalizeStage(item.statusStage);
  const activeIndex = LOADING_STAGES.indexOf(stage);
  const rawRunningItems = Array.isArray(runningItems) ? runningItems : [];
  const activeJobCount = Math.max(1, Number.isFinite(runningCount) ? runningCount : rawRunningItems.length || 1);
  const maxCount = Math.max(activeJobCount, Number.isFinite(maxConcurrentTasks) ? maxConcurrentTasks : activeJobCount);
  const loadingItems = normalizeLoadingItems(rawRunningItems.length > 0 ? rawRunningItems : [item]).slice(
    0,
    PREVIEW_LOADING_ITEM_LIMIT,
  );

  return {
    mode: "loading",
    eyebrow: "Generation Running",
    title: "生图进行中",
    statusText: item.statusText || "正在等待上游图像返回。",
    detail: prompt || "提示词会显示在这里。",
    showAnimation: true,
    stage,
    stageIndex: activeIndex,
    stageCount: LOADING_STAGES.length,
    activeJobCount,
    maxConcurrentTasks: maxCount,
    loadingItems,
    jobCountLabel: `并发 ${activeJobCount} / ${maxCount}`,
    progressLabel: `阶段 ${activeIndex + 1} / ${LOADING_STAGES.length}`,
    steps: LOADING_STAGES.map((key, index) => ({
      key,
      label: LOADING_STAGE_LABELS[key],
      state: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
    })),
  };
}

function normalizeLoadingItems(items) {
  return items
    .map((entry, index) => {
      const id = String(entry?.id || entry?.taskId || `preview-loading-${index + 1}`).trim();
      if (!id) {
        return null;
      }

      return {
        id,
        stage: normalizeStage(entry?.statusStage || entry?.stage),
        statusText: String(entry?.statusText || "").trim(),
      };
    })
    .filter(Boolean);
}

function normalizeStage(stage) {
  if (LOADING_STAGES.includes(stage)) {
    return stage;
  }

  return "connecting";
}
