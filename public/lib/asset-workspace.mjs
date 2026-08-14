function appendStructuredPath(path, key) {
  return `${path}${path ? "." : ""}${key}`;
}

function formatStructuredPromptValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((entry) => formatStructuredPromptValue(entry)).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => {
        const formatted = formatStructuredPromptValue(entry);
        return formatted ? `${key}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value).trim();
}

export function getStructuredPromptFields(value, path = "") {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    const formatted = formatStructuredPromptValue(value);
    return formatted ? [{ label: path || "内容", value: formatted }] : [];
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => getStructuredPromptFields(entry, appendStructuredPath(path, key)));
  }
  const formatted = formatStructuredPromptValue(value);
  return formatted ? [{ label: path || "内容", value: formatted }] : [];
}

function appendStructuredFields(container, value, path = "") {
  getStructuredPromptFields(value, path).forEach(({ label, value: fieldValue }) => {
    const row = document.createElement("dl");
    row.className = "lightbox-prompt-field";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = fieldValue;
    row.append(term, description);
    container.appendChild(row);
  });
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
