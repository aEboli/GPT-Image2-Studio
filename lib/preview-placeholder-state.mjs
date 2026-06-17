const LOADING_STAGES = ["uploading", "connecting", "generating", "saving"];
const PREVIEW_LOADING_ITEM_LIMIT = 6;

const LOADING_STAGE_LABELS = {
  uploading: "准备请求",
  connecting: "连接服务",
  generating: "生成画面",
  saving: "写入本地",
};

const LOADING_THUMBNAIL_STAGE_LABELS = {
  queued: "排队中",
  uploading: "发送请求中",
  connecting: "连接中",
  generating: "生成中",
  waiting_upstream: "获取中",
  waiting_final: "获取中",
  retrying_upstream: "重试中",
  missing_final_recovery: "获取中",
  fallback_final_image: "获取中",
  saving: "保存中",
  error: "失败",
  failed: "失败",
};

export function formatLoadingThumbnailStatusLabel(item = {}, { idleLabel = "等待", runningLabel = "生成中" } = {}) {
  const stage = String(item?.statusStage || item?.stage || item?.status || "").trim();
  if (LOADING_THUMBNAIL_STAGE_LABELS[stage]) {
    return LOADING_THUMBNAIL_STAGE_LABELS[stage];
  }

  const statusTextLabel = getShortLoadingThumbnailStatusFromText(item?.statusText);
  if (statusTextLabel) {
    return statusTextLabel;
  }

  return item?.isRunning || item?.started ? runningLabel : idleLabel;
}

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

export function getStablePreviewLoadingItems(items = []) {
  return getPreviewLoadingItemRecords(items).map(({ entry }) => entry);
}

function getPreviewLoadingItemRecords(items) {
  return (Array.isArray(items) ? items : [])
    .map((entry, index) => ({
      entry,
      index,
      createdAt: String(entry?.createdAt || entry?.startedAt || entry?.updatedAt || ""),
    }))
    .filter(({ entry, index }) => {
      const id = String(entry?.id || entry?.taskId || `preview-loading-${index + 1}`).trim();
      return Boolean(id);
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || right.index - left.index);
}

function normalizeLoadingItems(items) {
  return getPreviewLoadingItemRecords(items)
    .map(({ entry, index }) => {
      const id = String(entry?.id || entry?.taskId || `preview-loading-${index + 1}`).trim();
      return {
        id,
        stage: normalizeStage(entry?.statusStage || entry?.stage),
        statusText: String(entry?.statusText || "").trim(),
      };
    });
}

function normalizeStage(stage) {
  if (LOADING_STAGES.includes(stage)) {
    return stage;
  }

  return "connecting";
}

function getShortLoadingThumbnailStatusFromText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const prefix = text.match(/^([^：:]{1,10})[：:]/)?.[1]?.trim() || "";
  if (/最终失败|生成失败|失败|错误/.test(prefix)) {
    return "失败";
  }
  if (/排队/.test(prefix)) {
    return "排队中";
  }
  if (/重试/.test(prefix)) {
    return "重试中";
  }
  if (/缺最终图|heartbeat|获取|等待/.test(prefix)) {
    return "获取中";
  }

  if (/最终失败|生成失败|失败|错误/.test(text)) {
    return "失败";
  }
  if (/排队|队列|等待后台/.test(text)) {
    return "排队中";
  }
  if (/重试/.test(text)) {
    return "重试中";
  }
  if (/写入|保存|缓存/.test(text)) {
    return "保存中";
  }
  if (/接收|拿到|获取|最终图|上游|兜底|补救|等待.*图/.test(text)) {
    return "获取中";
  }
  if (/准备.*请求|发送|提交|请求/.test(text)) {
    return "发送请求中";
  }
  if (/生成|处理/.test(text)) {
    return "生成中";
  }

  return "";
}
