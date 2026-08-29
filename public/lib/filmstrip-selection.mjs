export const FILMSTRIP_SELECTED_MARKER_CLASS = "filmstrip-selected-marker";
export const FILMSTRIP_SELECTED_MARKER_GLYPH = "✓";
export const FILMSTRIP_SELECTED_MARKER_TITLE = "当前查看的图片";

// The marker host is whichever node owns the tile's positioning context: the
// shell wrapper where one exists, otherwise the thumb button itself.
export function syncFilmstripSelectedMarker(host, isSelected, { documentRef = globalThis.document, title = FILMSTRIP_SELECTED_MARKER_TITLE } = {}) {
  if (!host) {
    return null;
  }

  const existingMarker = host.querySelector(`.${FILMSTRIP_SELECTED_MARKER_CLASS}`);
  if (!isSelected) {
    existingMarker?.remove();
    return null;
  }

  if (existingMarker) {
    return existingMarker;
  }

  const marker = documentRef.createElement("span");
  marker.className = FILMSTRIP_SELECTED_MARKER_CLASS;
  marker.textContent = FILMSTRIP_SELECTED_MARKER_GLYPH;
  marker.title = title;
  marker.setAttribute("aria-hidden", "true");
  host.appendChild(marker);
  return marker;
}

export function createFilmstripRevealTracker() {
  return { key: "" };
}

function findEntryByKey(strip, selectedKey, getEntryKey) {
  return [...(strip.children || [])].find((entry) => getEntryKey(entry) === selectedKey) || null;
}

// Only a changed selection may move the rail. Repainting the same selection must
// leave the user's scroll position exactly where they put it, or status polling
// fights their manual scrolling.
export function revealFilmstripSelection({ strip, selectedKey = "", getEntryKey, tracker } = {}) {
  if (!strip || !tracker || typeof getEntryKey !== "function") {
    return "unavailable";
  }

  const normalizedKey = String(selectedKey || "");
  if (!normalizedKey) {
    tracker.key = "";
    return "no-selection";
  }

  if (tracker.key === normalizedKey) {
    return "skipped";
  }

  const entry = findEntryByKey(strip, normalizedKey, getEntryKey);
  if (!entry) {
    return "not-found";
  }

  tracker.key = normalizedKey;
  entry.scrollIntoView({ block: "nearest", inline: "nearest" });
  return "revealed";
}

// Takes the render callback so the scroll read cannot drift after the first node
// mutation. Detaching or clearing entries collapses scrollWidth to the client
// width, and the engine clamps scrollLeft to 0 before the new nodes land; a read
// taken next to the reattach therefore restores nothing.
export function renderFilmstripPreservingSelection({ strip, selectedKey = "", getEntryKey, tracker, render } = {}) {
  if (typeof render !== "function") {
    return "unavailable";
  }

  if (!strip) {
    render();
    return "unavailable";
  }

  const previousScrollLeft = strip.scrollLeft;
  render();
  strip.scrollLeft = previousScrollLeft;
  return revealFilmstripSelection({ strip, selectedKey, getEntryKey, tracker });
}
