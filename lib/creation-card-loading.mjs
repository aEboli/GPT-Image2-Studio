import {
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

export function stopCreationCardLoading(loading) {
  stopGenerationLoadingShell(getLoadingNodes(loading));
  return loading || null;
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

export function syncCreationLoadingCard(
  card,
  item = {},
  fallbackIndex = 0,
  {
    isSkuStart = false,
    isInfographicRebuildStart = false,
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
    const key = getCreationCardDomKey(item, fallbackIndex);
    const logText = getLogText(item);
    if (loadingShell) {
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
      existingCard.remove();
    }
  });

  [...grid.querySelectorAll(".creation-card[data-creation-card-key]")].forEach((card) => {
    if (!renderedKeys.has(card.dataset.creationCardKey)) {
      stopCreationCardLoading(card.querySelector(".creation-card-loading"));
      card.remove();
    }
  });
}
