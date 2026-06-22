const CREATION_CARD_LOADING_COPY = {
  queued: {
    label: "排队中",
    detail: "等待并发槽位，提交后将自动接续",
    steps: ["已提交", "排队", "生成"],
    activeStep: 1,
  },
  generating: {
    label: "生成中",
    detail: "正在生成套图图片",
    steps: ["已提交", "处理中", "保存"],
    activeStep: 2,
  },
};
const CREATION_CARD_LOADING_SEQUENCE_STEPS = 4;

function getLoadingCopy(status = "generating") {
  return CREATION_CARD_LOADING_COPY[status === "queued" ? "queued" : "generating"];
}

function getDocumentRef(documentRef = null) {
  return documentRef || globalThis.document;
}

function setDataAttribute(element, name, value) {
  if (element?.dataset) {
    element.dataset[name] = String(value);
  }
}

function setStyleProperty(element, name, value) {
  element?.style?.setProperty?.(name, value);
}

function normalizeSequenceIndex(value = 0) {
  const index = Number.parseInt(value, 10);
  return Number.isFinite(index) && index > 0 ? index : 0;
}

function getSequenceMeta(options = {}) {
  const sequenceIndex = normalizeSequenceIndex(options.sequenceIndex);
  const order = sequenceIndex + 1;
  return {
    delayMs: (sequenceIndex % CREATION_CARD_LOADING_SEQUENCE_STEPS) * 180,
    order,
    orderLabel: String(order).padStart(2, "0"),
    phase: (sequenceIndex % CREATION_CARD_LOADING_SEQUENCE_STEPS) + 1,
    sequenceIndex,
  };
}

function applySequenceMeta(loading, meta) {
  setDataAttribute(loading, "creationCardLoadingOrder", meta.order);
  setDataAttribute(loading, "creationCardLoadingPhase", meta.phase);
  setStyleProperty(loading, "--creation-card-loading-delay", `${meta.delayMs}ms`);
}

function createStep(documentRef, label, index, activeStep) {
  const step = documentRef.createElement("i");
  step.className = `creation-card-loading-step${index < activeStep ? " is-done" : ""}${
    index === activeStep ? " is-active" : ""
  }`;
  step.setAttribute("aria-label", label);
  return step;
}

function updateStep(element, label, index, activeStep) {
  element.className = `creation-card-loading-step${index < activeStep ? " is-done" : ""}${
    index === activeStep ? " is-active" : ""
  }`;
  element.setAttribute("aria-label", label);
}

function syncStepList(steps, copy) {
  if (!steps) {
    return;
  }
  while (steps.children.length < copy.steps.length) {
    steps.appendChild(createStep(steps.ownerDocument || getDocumentRef(), "", steps.children.length, copy.activeStep));
  }
  while (steps.children.length > copy.steps.length) {
    steps.children[steps.children.length - 1]?.remove?.();
  }
  [...steps.children].forEach((step, index) => updateStep(step, copy.steps[index] || "", index, copy.activeStep));
}

export function createCreationCardLoading(status = "generating", documentRef = null, options = {}) {
  const doc = getDocumentRef(documentRef);
  const loading = doc.createElement("div");
  loading.className = "creation-card-loading";
  setDataAttribute(loading, "creationCardLoadingStatus", status === "queued" ? "queued" : "generating");

  const motion = doc.createElement("div");
  motion.className = "creation-card-loading-motion creation-card-loading-process";
  motion.setAttribute("aria-hidden", "true");

  const order = doc.createElement("b");
  order.className = "creation-card-loading-order";
  setDataAttribute(order, "creationCardLoadingOrderLabel", "true");

  const sketchRing = doc.createElement("div");
  sketchRing.className = "creation-card-loading-sketch-ring";
  for (let index = 0; index < 4; index += 1) {
    const line = doc.createElement("span");
    line.className = "creation-card-loading-sketch-line";
    sketchRing.appendChild(line);
  }
  sketchRing.appendChild(order);

  const steps = doc.createElement("div");
  steps.className = "creation-card-loading-steps";

  const waitingMark = doc.createElement("div");
  waitingMark.className = "creation-card-loading-waiting-mark";
  waitingMark.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    const line = doc.createElement("span");
    line.className = "creation-card-loading-waiting-line";
    waitingMark.appendChild(line);
  }

  motion.append(sketchRing, steps, waitingMark);

  loading.append(motion);
  updateCreationCardLoading(loading, status, options);
  return loading;
}

export function updateCreationCardLoading(loading, status = "generating", options = {}) {
  if (!loading) {
    return null;
  }

  const normalizedStatus = status === "queued" ? "queued" : "generating";
  const copy = getLoadingCopy(normalizedStatus);
  const sequenceMeta = getSequenceMeta(options);
  setDataAttribute(loading, "creationCardLoadingStatus", normalizedStatus);
  applySequenceMeta(loading, sequenceMeta);

  const motion = loading.querySelector?.(".creation-card-loading-motion");
  if (motion) {
    motion.className = `creation-card-loading-motion creation-card-loading-${
      normalizedStatus === "queued" ? "waiting" : "process"
    }`;
  }

  const order = loading.querySelector?.("[data-creation-card-loading-order-label]");
  if (order) {
    order.textContent = sequenceMeta.orderLabel;
  }

  const steps = loading.querySelector?.(".creation-card-loading-steps");
  syncStepList(steps, copy);

  return loading;
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
    title.textContent = item.title || getFallbackTitle(fallbackIndex) || `第 ${fallbackIndex + 1} 张`;
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
    if (loadingShell) {
      updateCreationCardLoading(loadingShell, item.status, { sequenceIndex: fallbackIndex });
    } else {
      renderCreationCardLoading(media, item.status, null, { sequenceIndex: fallbackIndex });
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
      card.remove();
    }
  });
}
