function appendStructuredFields(container, value, path = "") {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendStructuredFields(container, entry, `${path}${path ? "." : ""}${index + 1}`));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => appendStructuredFields(container, entry, `${path}${path ? "." : ""}${key}`));
    return;
  }
  const row = document.createElement("dl");
  row.className = "lightbox-prompt-field";
  const term = document.createElement("dt");
  term.textContent = path || "内容";
  const description = document.createElement("dd");
  description.textContent = String(value);
  row.append(term, description);
  container.appendChild(row);
}

export function createAssetWorkspaceController({ refs, state }) {
  function closeRecordPickers(except = null) {
    document.querySelectorAll("[data-asset-record-picker]").forEach((picker) => {
      if (picker === except) return;
      picker.classList.remove("is-open");
      picker.querySelector(".asset-record-picker-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  function closeCommandMenus(except = null) {
    document.querySelectorAll("details[data-asset-menu][open]").forEach((menu) => {
      if (menu !== except) menu.open = false;
    });
  }

  function renderStructuredPrompt(promptText) {
    if (!refs.lightboxPromptStructured) return;
    refs.lightboxPromptStructured.replaceChildren();
    const source = String(promptText || "").trim();
    if (!source || (!source.startsWith("{") && !source.startsWith("["))) return;
    try {
      appendStructuredFields(refs.lightboxPromptStructured, JSON.parse(source));
    } catch {
      refs.lightboxPromptStructured.replaceChildren();
    }
  }

  function setInspectorTab(tabName) {
    document.querySelectorAll("[data-lightbox-tab]").forEach((button) => {
      const active = button.dataset.lightboxTab === tabName;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll("[data-lightbox-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.lightboxPanel !== tabName);
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-asset-record-picker]").forEach((picker) => {
      const trigger = picker.querySelector(".asset-record-picker-trigger");
      trigger?.addEventListener("click", () => {
        const open = !picker.classList.contains("is-open");
        closeRecordPickers(picker);
        picker.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", String(open));
      });
      picker.addEventListener("click", (event) => {
        if (!event.target.closest("[role='option']")) return;
        picker.classList.remove("is-open");
        trigger?.setAttribute("aria-expanded", "false");
      });
    });
    document.querySelectorAll("details[data-asset-menu]").forEach((menu) => {
      menu.addEventListener("toggle", () => menu.open && closeCommandMenus(menu));
    });
    document.querySelectorAll("[data-lightbox-tab]").forEach((button) => {
      button.addEventListener("click", () => setInspectorTab(button.dataset.lightboxTab));
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-asset-menu]")) closeCommandMenus();
      if (!event.target.closest("[data-asset-record-picker]")) closeRecordPickers();
    });
  }

  return { bindEvents, closeCommandMenus, closeRecordPickers, renderStructuredPrompt };
}
