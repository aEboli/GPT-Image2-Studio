import {
  beatGenerationLoadingHeartbeat,
  createGenerationLoadingShell,
  updateGenerationLoadingShell,
  stopGenerationLoadingShell,
  GENERATION_LOADING_GENERATING_MODE,
  GENERATION_LOADING_WAITING_MODE,
} from "./generation-loading.mjs";
import { getCreationItemDisplayTitle } from "./creation-item-display.mjs";

function getDocumentRef(documentRef = null) {
  return documentRef || globalThis.document;
}

function getLoadingNodes(loading) {
  return loading?.__generationLoadingNodes || null;
}

function getCreationCardLoadingMode(status) {
  return String(status || "") === "queued" ? GENERATION_LOADING_WAITING_MODE : GENERATION_LOADING_GENERATING_MODE;
}

export function createCreationCardLoading(status = "generating", documentRef = null, options = {}) {
  const nodes = createGenerationLoadingShell(getDocumentRef(documentRef), {
    key: options.key || options.itemId || "",
    active: true,
    mode: getCreationCardLoadingMode(status),
    stage: String(status || ""),
    logText: options.logText,
    showLog: options.showLog ?? true,
  });
  nodes.shell.classList.add("creation-card-loading");
  nodes.shell.dataset.creationCardLoadingStatus = status === "queued" ? "queued" : "generating";
  updateCreationCardLoading(nodes.shell, status, options);
  return nodes.shell;
}

export function updateCreationCardLoading(loading, status = "generating", options = {}) {
  const nodes = getLoadingNodes(loading);
  if (!loading || !nodes) {
    return loading || null;
  }
  const normalizedStatus = status === "queued" ? "queued" : "generating";
  loading.dataset.creationCardLoadingStatus = normalizedStatus;
  updateGenerationLoadingShell(nodes, {
    key: options.key || options.itemId || "",
    active: true,
    mode: getCreationCardLoadingMode(status),
    stage: String(status || ""),
    logText: options.logText,
    showLog: options.showLog ?? true,
  });
  return loading;
}

export function stopCreationCardLoading(loading, { retainSource = false } = {}) {
  stopGenerationLoadingShell(getLoadingNodes(loading), { retainSource });
  return loading || null;
}

/* 套图卡片的心跳回执：批量生成里每一项都有自己的加载壳，
   所以心跳要落到收到心跳的那一项上，而不是像主预览那样只有一个壳。
   grid 传 null 时退化成空操作，调用点不必先判空。 */
export function beatCreationCardHeartbeat(grid, itemId) {
  const normalizedItemId = String(itemId || "").trim();
  if (!grid?.querySelectorAll || !normalizedItemId) {
    return "";
  }

  /* 按 dataset 扫描而不是拼选择器：itemId 进选择器需要转义，
     而 CSS.escape 在 Node 测试环境里并不存在。套图一次最多十来张卡，扫描代价可忽略。 */
  const card = [...grid.querySelectorAll(".creation-card[data-creation-card-key]")]
    .find((entry) => String(entry.dataset?.creationCardKey || "") === normalizedItemId);
  return beatGenerationLoadingHeartbeat(getLoadingNodes(card?.querySelector?.(".creation-card-loading")));
}

export function renderCreationCardLoading(host, status = "generating", documentRef = null, options = {}) {
  const existing = host?.querySelector?.(".creation-card-loading");
  if (existing) {
    return updateCreationCardLoading(existing, status, options);
  }

  const loading = createCreationCardLoading(status, documentRef || host?.ownerDocument || null, options);
  host?.replaceChildren?.(loading);
  return loading;
}

export function getCreationCardDomKey(item = {}, fallbackIndex = 0) {
  const stableId = String(item.itemId || item.id || "").trim();
  if (stableId) {
    return stableId;
  }
  const fallbackLabel = String(item.title || item.role || "creation-card").trim() || "creation-card";
  return `${fallbackLabel}-${fallbackIndex}`;
}

/* 加载动画的进度源按 key 共享，而套图的 itemId 在每个队列里都是同一套值。
   不带上本次运行的作用域，队列二的卡片会直接接上队列一残留的进度并显示 99%。 */
export function getCreationCardLoadingKey(item = {}, fallbackIndex = 0, keyScope = "") {
  const domKey = getCreationCardDomKey(item, fallbackIndex);
  const scope = String(keyScope || "").trim();
  return scope ? `${scope}::${domKey}` : domKey;
}

export function syncCreationLoadingCard(
  card,
  item = {},
  fallbackIndex = 0,
  {
    isSkuStart = false,
    isInfographicRebuildStart = false,
    keyScope = "",
    getFallbackTitle = () => "",
    getImageUrl = () => "",
    getStatusLabel = () => "",
    getLogText = () => "",
    shouldShowLoading = () => false,
  } = {},
) {
  if (!card?.querySelector?.(".creation-card-loading") || !shouldShowLoading(item) || getImageUrl(item)) {
    return null;
  }

  card.dataset.creationCardKey = getCreationCardDomKey(item, fallbackIndex);
  card.classList.toggle("is-generating", true);
  card.classList.toggle("is-sku", item.role === "sku");
  card.classList.toggle("is-sku-start", isSkuStart);
  card.classList.toggle("is-infographic-rebuild", item.role === "infographic-rebuild");
  card.classList.toggle("is-infographic-rebuild-start", isInfographicRebuildStart);

  const title = card.querySelector("[data-creation-card-title]");
  if (title) {
    title.textContent = getCreationItemDisplayTitle(item, getFallbackTitle(fallbackIndex) || `第 ${fallbackIndex + 1} 张`);
  }

  const status = card.querySelector("[data-creation-card-status]");
  if (status) {
    status.textContent = getStatusLabel(item);
  }

  const media = card.querySelector("[data-creation-card-media]");
  if (media) {
    media.classList.add("is-loading");
    media.setAttribute("aria-busy", "true");
    const loadingShell = media.querySelector(".creation-card-loading");
    const key = getCreationCardLoadingKey(item, fallbackIndex, keyScope);
    const logText = getLogText(item);
    const existingKey = String(loadingShell?.dataset?.generationLoadingKey || "");
    if (loadingShell && existingKey && existingKey !== key) {
      /* 选中另一条队列会复用这张卡片，但旧 key 对应的任务仍可能在运行。
         先保留旧 source，再用新壳承载当前队列，返回时即可接回旧进度和图标。 */
      stopCreationCardLoading(loadingShell, { retainSource: true });
      media.replaceChildren(createCreationCardLoading(item.status, media.ownerDocument || null, { key, logText }));
    } else if (loadingShell) {
      updateCreationCardLoading(loadingShell, item.status, { key, logText });
    } else {
      renderCreationCardLoading(media, item.status, null, { key, logText });
    }
  }

  return card;
}

export function syncCreationResultGrid({
  grid,
  items = [],
  createCard,
  syncCard,
  getKey = getCreationCardDomKey,
  getItemOptions = () => ({}),
  shouldRetainLoadingSource = () => false,
} = {}) {
  if (!grid || typeof createCard !== "function") {
    return;
  }

  const existingCards = new Map(
    [...grid.querySelectorAll(".creation-card[data-creation-card-key]")].map((card) => [
      card.dataset.creationCardKey,
      card,
    ]),
  );
  const firstSkuItem = items.find((item) => item.role === "sku");
  const firstInfographicRebuildItem = items.find((item) => item.role === "infographic-rebuild");
  const renderedKeys = new Set();

  items.forEach((item, index) => {
    const key = getKey(item, index);
    const options = getItemOptions(item, index, { firstSkuItem, firstInfographicRebuildItem });
    const existingCard = existingCards.get(key);
    const card = syncCard?.(existingCard, item, index, options) || createCard(item, index, options);
    renderedKeys.add(key);

    const currentCard = grid.children[index] || null;
    if (currentCard !== card) {
      grid.insertBefore(card, currentCard);
    }
    if (existingCard && existingCard !== card) {
      /* 被替换掉的卡片必须先停掉自己的加载动画：它的进度源是按 key 共享的，
         只把节点从 DOM 里摘掉会留下一个脱离文档却继续跑到 99% 的常驻进度源。
         停在替换之后，本次运行内重建卡片仍能接上原进度。 */
      stopCreationCardLoading(existingCard.querySelector?.(".creation-card-loading"), {
        retainSource: Boolean(shouldRetainLoadingSource({ existingCard, nextCard: card, item, index, options })),
      });
      existingCard.remove();
    }
  });

  [...grid.querySelectorAll(".creation-card[data-creation-card-key]")].forEach((card) => {
    if (!renderedKeys.has(card.dataset.creationCardKey)) {
      stopCreationCardLoading(card.querySelector(".creation-card-loading"), {
        retainSource: Boolean(shouldRetainLoadingSource({ existingCard: card, nextCard: null, item: null, index: -1, options: {} })),
      });
      card.remove();
    }
  });
}
