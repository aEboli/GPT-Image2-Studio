export const LIGHTBOX_VIEWER_MIN_SCALE = 0.25;
export const LIGHTBOX_VIEWER_MAX_SCALE = 8;
const LIGHTBOX_VIEWER_BUTTON_FACTOR = 1.18;
const LIGHTBOX_VIEWER_WHEEL_FACTOR = 1.12;
const LIGHTBOX_VIEWER_SCALE_EPSILON = 0.01;

export function createLightboxViewerState() {
  return {
    scale: 1,
    fitScale: 1,
    x: 0,
    y: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    mode: "view",
    lastInspectionScale: 1,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0,
  };
}

function clampScale(scale, minimumScale = LIGHTBOX_VIEWER_MIN_SCALE) {
  const parsed = Number(scale);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(LIGHTBOX_VIEWER_MAX_SCALE, Math.max(minimumScale, parsed));
}

function getBounds(element) {
  const rect = element?.getBoundingClientRect?.();
  return {
    left: rect?.left || 0,
    top: rect?.top || 0,
    width: Math.max(1, rect?.width || element?.clientWidth || 1),
    height: Math.max(1, rect?.height || element?.clientHeight || 1),
  };
}

function hasMetrics(viewer) {
  return viewer.naturalWidth > 0 && viewer.naturalHeight > 0;
}

function isInspectionMode(viewer) {
  return viewer.mode === "inspect";
}

function getMinimumScale(viewer) {
  return Math.min(LIGHTBOX_VIEWER_MIN_SCALE, viewer.fitScale || LIGHTBOX_VIEWER_MIN_SCALE);
}

function calculateFitScale(viewer, bounds) {
  if (!viewer.naturalWidth || !viewer.naturalHeight || !bounds.width || !bounds.height) {
    return 1;
  }
  return Math.min(1, bounds.width / viewer.naturalWidth, bounds.height / viewer.naturalHeight);
}

function canPan(viewer, bounds) {
  return hasMetrics(viewer) && (
    viewer.naturalWidth * viewer.scale > bounds.width + 1 ||
    viewer.naturalHeight * viewer.scale > bounds.height + 1
  );
}

function clampPan(viewer, bounds) {
  if (!hasMetrics(viewer)) {
    viewer.x = 0;
    viewer.y = 0;
    return;
  }
  const maxX = Math.max(0, (viewer.naturalWidth * viewer.scale - bounds.width) / 2);
  const maxY = Math.max(0, (viewer.naturalHeight * viewer.scale - bounds.height) / 2);
  viewer.x = Math.min(maxX, Math.max(-maxX, viewer.x));
  viewer.y = Math.min(maxY, Math.max(-maxY, viewer.y));
}

export function createLightboxImageViewer({ refs, state }) {
  const viewer = () => state.lightboxViewer;
  const bounds = () => getBounds(refs.lightboxImageShell);

  function syncControls() {
    const current = viewer();
    const ready = hasMetrics(current);
    const isInspect = isInspectionMode(current);
    const minimumScale = getMinimumScale(current);
    refs.lightboxViewerControls.classList.toggle("hidden", !isInspect);
    refs.lightboxZoomLabel.textContent = ready ? `${Math.round(current.scale * 100)}%` : "适配";
    refs.lightboxZoomOutButton.disabled = !ready || !isInspect || current.scale <= minimumScale + LIGHTBOX_VIEWER_SCALE_EPSILON;
    refs.lightboxZoomInButton.disabled = !ready || !isInspect || current.scale >= LIGHTBOX_VIEWER_MAX_SCALE - LIGHTBOX_VIEWER_SCALE_EPSILON;
    refs.lightboxFitButton.disabled = !ready || !isInspect;
    refs.lightboxActualSizeButton.disabled = !ready || !isInspect;
  }

  function apply() {
    const current = viewer();
    if (hasMetrics(current)) {
      refs.lightboxImage.style.width = `${current.naturalWidth}px`;
      refs.lightboxImage.style.height = `${current.naturalHeight}px`;
    } else {
      refs.lightboxImage.style.removeProperty("width");
      refs.lightboxImage.style.removeProperty("height");
    }
    const panX = `${Math.round(current.x * 100) / 100}px`;
    const panY = `${Math.round(current.y * 100) / 100}px`;
    const scale = String(Math.round(current.scale * 10000) / 10000);
    refs.lightboxImage.style.setProperty("--lightbox-pan-x", panX);
    refs.lightboxImage.style.setProperty("--lightbox-pan-y", panY);
    refs.lightboxImage.style.setProperty("--lightbox-scale", scale);
    refs.lightboxImage.style.transform = `translate(-50%, -50%) translate3d(${panX}, ${panY}, 0) scale(${scale})`;
    refs.lightboxMediaStage.classList.toggle("is-viewer-inspecting", isInspectionMode(current));
    refs.lightboxImageShell.classList.toggle("is-viewer-draggable", isInspectionMode(current) && canPan(current, bounds()));
    refs.lightboxMediaStage.classList.toggle("is-viewer-dragging", current.dragging);
    syncControls();
  }

  function reset({ clearDimensions = true } = {}) {
    const current = viewer();
    Object.assign(current, createLightboxViewerState(), clearDimensions ? {} : {
      naturalWidth: current.naturalWidth,
      naturalHeight: current.naturalHeight,
    });
    apply();
  }

  function syncMetrics({ preserveMode = false } = {}) {
    const current = viewer();
    const naturalWidth = refs.lightboxImage.naturalWidth || 0;
    const naturalHeight = refs.lightboxImage.naturalHeight || 0;
    if (!naturalWidth || !naturalHeight) {
      apply();
      return;
    }
    current.naturalWidth = naturalWidth;
    current.naturalHeight = naturalHeight;
    if (!preserveMode || !isInspectionMode(current)) {
      current.mode = "view";
    }
    refs.lightboxMediaStage.classList.toggle("is-viewer-inspecting", isInspectionMode(current));
    current.fitScale = calculateFitScale(current, bounds());
    if (!preserveMode || !isInspectionMode(current)) {
      current.scale = current.fitScale;
      current.x = 0;
      current.y = 0;
    } else {
      current.scale = clampScale(Math.max(current.scale, current.fitScale), getMinimumScale(current));
      clampPan(current, bounds());
    }
    apply();
  }

  function fit() {
    const current = viewer();
    if (!hasMetrics(current)) {
      syncMetrics();
      return;
    }
    current.mode = "view";
    current.dragging = false;
    refs.lightboxMediaStage.classList.toggle("is-viewer-inspecting", isInspectionMode(current));
    current.fitScale = calculateFitScale(current, bounds());
    current.scale = current.fitScale;
    current.x = 0;
    current.y = 0;
    apply();
  }

  function zoomAtPoint(nextScale, anchorPoint = null) {
    const current = viewer();
    if (!hasMetrics(current) || !isInspectionMode(current)) {
      return;
    }
    refs.lightboxMediaStage.classList.toggle("is-viewer-inspecting", isInspectionMode(current));
    const currentScale = current.scale || current.fitScale || 1;
    const scale = clampScale(nextScale, getMinimumScale(current));
    const currentBounds = bounds();
    const centerX = currentBounds.left + currentBounds.width / 2;
    const centerY = currentBounds.top + currentBounds.height / 2;
    if (anchorPoint && Number.isFinite(anchorPoint.clientX) && Number.isFinite(anchorPoint.clientY)) {
      const imageAnchorX = (anchorPoint.clientX - centerX - current.x) / currentScale;
      const imageAnchorY = (anchorPoint.clientY - centerY - current.y) / currentScale;
      current.x = anchorPoint.clientX - centerX - imageAnchorX * scale;
      current.y = anchorPoint.clientY - centerY - imageAnchorY * scale;
    } else if (currentScale > 0) {
      const ratio = scale / currentScale;
      current.x *= ratio;
      current.y *= ratio;
    }
    current.scale = scale;
    current.mode = "inspect";
    if (scale > current.fitScale + LIGHTBOX_VIEWER_SCALE_EPSILON) {
      current.lastInspectionScale = Math.max(current.lastInspectionScale, scale);
    }
    clampPan(current, bounds());
    apply();
  }

  function setActualSize(anchorPoint = null) {
    if (!hasMetrics(viewer())) {
      syncMetrics();
    }
    if (hasMetrics(viewer())) {
      viewer().mode = "inspect";
      zoomAtPoint(1, anchorPoint);
    }
  }

  function stepZoom(direction, anchorPoint = null) {
    if (!hasMetrics(viewer())) {
      syncMetrics();
    }
    if (!hasMetrics(viewer())) {
      return;
    }
    if (!isInspectionMode(viewer())) {
      return;
    }
    const factor = direction > 0 ? LIGHTBOX_VIEWER_BUTTON_FACTOR : 1 / LIGHTBOX_VIEWER_BUTTON_FACTOR;
    zoomAtPoint(viewer().scale * factor, anchorPoint);
  }

  function panBy(deltaX, deltaY) {
    const current = viewer();
    if (!hasMetrics(current) || !isInspectionMode(current)) {
      return;
    }
    current.x += deltaX;
    current.y += deltaY;
    clampPan(current, bounds());
    apply();
  }

  function startPan(event) {
    const current = viewer();
    if (event.button !== 0 || !isInspectionMode(current) || !canPan(current, bounds())) {
      return;
    }
    Object.assign(current, {
      dragging: true,
      dragStartX: event.clientX,
      dragStartY: event.clientY,
      dragOriginX: current.x,
      dragOriginY: current.y,
    });
    refs.lightboxImageShell.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    apply();
  }

  function continuePan(event) {
    const current = viewer();
    if (!current.dragging) {
      return;
    }
    current.x = current.dragOriginX + event.clientX - current.dragStartX;
    current.y = current.dragOriginY + event.clientY - current.dragStartY;
    clampPan(current, bounds());
    event.preventDefault();
    apply();
  }

  function endPan(event) {
    const current = viewer();
    if (!current.dragging) {
      return;
    }
    current.dragging = false;
    try {
      refs.lightboxImageShell.releasePointerCapture?.(event.pointerId);
    } catch {
      // Some browsers already release capture before lostpointercapture fires.
    }
    apply();
  }

  function toggleInspectionZoom(anchorPoint = null) {
    const current = viewer();
    if (!hasMetrics(current)) {
      syncMetrics();
    }
    if (!hasMetrics(current)) {
      return;
    }
    if (!isInspectionMode(current)) {
      current.mode = "inspect";
      zoomAtPoint(Math.max(1, current.lastInspectionScale, current.fitScale), anchorPoint);
    } else {
      fit();
    }
  }

  function bindEvents() {
    refs.lightboxZoomOutButton.addEventListener("click", () => stepZoom(-1));
    refs.lightboxZoomInButton.addEventListener("click", () => stepZoom(1));
    refs.lightboxFitButton.addEventListener("click", () => fit());
    refs.lightboxActualSizeButton.addEventListener("click", () => setActualSize());
    refs.lightboxImage.addEventListener("load", () => syncMetrics());
    refs.lightboxImage.addEventListener("dragstart", (event) => event.preventDefault());
    refs.lightboxImageShell.addEventListener("wheel", (event) => {
      if (refs.lightbox.classList.contains("hidden") || !hasMetrics(viewer()) || !isInspectionMode(viewer())) {
        return;
      }
      event.preventDefault();
      const factor = event.deltaY < 0 ? LIGHTBOX_VIEWER_WHEEL_FACTOR : 1 / LIGHTBOX_VIEWER_WHEEL_FACTOR;
      zoomAtPoint(viewer().scale * factor, { clientX: event.clientX, clientY: event.clientY });
    }, { passive: false });
    refs.lightboxImageShell.addEventListener("pointerdown", startPan);
    refs.lightboxImageShell.addEventListener("pointermove", continuePan);
    refs.lightboxImageShell.addEventListener("pointerup", endPan);
    refs.lightboxImageShell.addEventListener("pointercancel", endPan);
    refs.lightboxImageShell.addEventListener("lostpointercapture", endPan);
    refs.lightboxImageShell.addEventListener("dblclick", (event) => {
      event.preventDefault();
      toggleInspectionZoom({ clientX: event.clientX, clientY: event.clientY });
    });
    window.addEventListener("resize", () => {
      if (!refs.lightbox.classList.contains("hidden")) {
        syncMetrics({ preserveMode: true });
      }
    });
  }

  return {
    reset,
    syncMetrics,
    bindEvents,
    fit,
    setActualSize,
    stepZoom,
    zoomAtPoint,
    panBy,
    toggleInspectionZoom,
  };
}
