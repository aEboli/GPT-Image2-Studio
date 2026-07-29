export const CREATION_CARD_IDLE_RIPPLE_DELAY_MS = 30_000;
export const CREATION_CARD_IDLE_RIPPLE_DURATION_MS = 1_200;
export const CREATION_CARD_IDLE_RIPPLE_SELECTOR = "[data-creation-card-key]:hover";

export function createCreationCardIdleRippleController({
  documentRoot = globalThis.document,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  idleDelayMs = CREATION_CARD_IDLE_RIPPLE_DELAY_MS,
  rippleDurationMs = CREATION_CARD_IDLE_RIPPLE_DURATION_MS,
  targetSelector = CREATION_CARD_IDLE_RIPPLE_SELECTOR,
  rippleClass = "is-idle-rippling",
} = {}) {
  let idleTimerId = null;
  let rippleTimerId = null;
  let activeCard = null;
  let bound = false;

  function clearIdleTimer() {
    if (idleTimerId === null) {
      return;
    }
    clearTimeoutFn(idleTimerId);
    idleTimerId = null;
  }

  function clearActiveRipple() {
    if (rippleTimerId !== null) {
      clearTimeoutFn(rippleTimerId);
      rippleTimerId = null;
    }
    activeCard?.classList.remove(rippleClass);
    activeCard = null;
  }

  function scheduleIdleRipple() {
    clearIdleTimer();
    if (!bound) {
      return;
    }
    idleTimerId = setTimeoutFn(triggerRipple, idleDelayMs);
  }

  function triggerRipple() {
    idleTimerId = null;
    clearActiveRipple();
    const hoveredCard = documentRoot?.querySelector?.(targetSelector) || null;
    if (hoveredCard?.classList) {
      activeCard = hoveredCard;
      activeCard.classList.add(rippleClass);
      rippleTimerId = setTimeoutFn(clearActiveRipple, rippleDurationMs);
    }
    scheduleIdleRipple();
  }

  function resetIdleTimer() {
    if (!bound) {
      return;
    }
    clearActiveRipple();
    scheduleIdleRipple();
  }

  function bind() {
    if (bound || typeof documentRoot?.addEventListener !== "function") {
      return;
    }
    bound = true;
    documentRoot.addEventListener("pointermove", resetIdleTimer, { passive: true });
    scheduleIdleRipple();
  }

  function destroy() {
    if (bound) {
      documentRoot.removeEventListener("pointermove", resetIdleTimer);
    }
    bound = false;
    clearIdleTimer();
    clearActiveRipple();
  }

  return { bind, destroy };
}
