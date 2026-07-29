import {
  buildAssetRecordTimeFilterOptions,
  filterAssetRecordsByTime,
  hasActiveAssetRecordTimeFilter,
  normalizeAssetRecordDateFilter,
  normalizeAssetRecordTimeFilter,
} from "./asset-record-time-filter.mjs";

export function getArticleRecordSearchText(record = {}) {
  return [
    record.title,
    record.sourceSummary,
    record.contentType,
    record.stylePreset,
    record.styleBible,
    ...(Array.isArray(record.characters) ? record.characters.map((item) => item.name) : []),
    ...(Array.isArray(record.scenes) ? record.scenes.map((item) => item.name) : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getPortraitRecordSearchText(record = {}, formatStyleSummary = () => "") {
  return [
    record.subjectName,
    record.subjectSummary,
    formatStyleSummary(record),
    record.customStyle,
    record.notes,
    ...(Array.isArray(record.referenceImageNames) ? record.referenceImageNames : []),
    ...(Array.isArray(record.items)
      ? record.items.flatMap((item) => [
          item.title,
          item.styleLabel,
          item.shotLabel,
          item.actionLabel,
          item.prompt,
          item.filename,
          item.relativePath,
        ])
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function createAssetRecordTimeFilterController({ pages = {}, documentRoot = globalThis.document } = {}) {
  const entries = new Map(
    Object.entries(pages).map(([name, config]) => [
      name,
      {
        bound: false,
        config,
        elements: null,
        state: { window: "all", date: "", query: "" },
      },
    ]),
  );

  function getEntry(name) {
    const entry = entries.get(name);
    if (!entry) throw new Error(`Unknown asset record filter page: ${name}`);
    return entry;
  }

  function getElements(name) {
    const entry = getEntry(name);
    if (entry.elements) return entry.elements;
    const prefix = entry.config.prefix;
    const select = (suffix) => documentRoot?.querySelector?.(`#${prefix}${suffix}`) || null;
    entry.elements = {
      count: select("Count"),
      dateInput: select("DateInput"),
      resetButton: select("ResetFiltersButton"),
      searchInput: select("SearchInput"),
      timeFilters: select("TimeFilters"),
    };
    return entry.elements;
  }

  function snapshot(name) {
    const entry = getEntry(name);
    const date = normalizeAssetRecordDateFilter(entry.state.date);
    const window = date ? "all" : normalizeAssetRecordTimeFilter(entry.state.window);
    entry.state.date = date;
    entry.state.window = window;
    return { window, date, query: entry.state.query };
  }

  function getCollections(name, referenceNow) {
    const entry = getEntry(name);
    const records = entry.config.getRecords?.();
    const allRecords = Array.isArray(records) ? records : [];
    const filters = snapshot(name);
    const query = String(filters.query || "").trim().toLowerCase();
    const keywordRecords = query && entry.config.getSearchText
      ? allRecords.filter((record) => String(entry.config.getSearchText(record) || "").toLowerCase().includes(query))
      : allRecords;
    return {
      allRecords,
      filters,
      keywordRecords,
      records: filterAssetRecordsByTime(keywordRecords, filters, referenceNow),
    };
  }

  function hasActive(name) {
    const filters = snapshot(name);
    return Boolean(String(filters.query || "").trim() || hasActiveAssetRecordTimeFilter(filters));
  }

  function filter(name) {
    const entry = getEntry(name);
    return getCollections(name, entry.config.getReferenceNow?.() || new Date()).records;
  }

  function render(name) {
    const entry = getEntry(name);
    const elements = getElements(name);
    const referenceNow = entry.config.getReferenceNow?.() || new Date();
    const collections = getCollections(name, referenceNow);
    const hasActiveFilters = hasActive(name);

    if (elements.searchInput && elements.searchInput.value !== collections.filters.query) {
      elements.searchInput.value = collections.filters.query;
    }
    if (elements.dateInput && elements.dateInput.value !== collections.filters.date) {
      elements.dateInput.value = collections.filters.date;
    }
    if (elements.timeFilters) {
      elements.timeFilters.replaceChildren();
      for (const option of buildAssetRecordTimeFilterOptions(collections.keywordRecords, referenceNow)) {
        const button = documentRoot.createElement("button");
        button.type = "button";
        button.className = "toolbar-button creation-record-time-filter asset-record-time-filter";
        button.dataset.assetRecordTimeFilter = option.value;
        button.setAttribute(
          "aria-pressed",
          String(!collections.filters.date && collections.filters.window === option.value),
        );
        button.textContent = `${option.label} ${option.count}`;
        button.addEventListener("click", () => {
          entry.state.window = option.value;
          entry.state.date = "";
          entry.config.renderView?.();
        });
        elements.timeFilters.appendChild(button);
      }
    }
    if (elements.resetButton) elements.resetButton.disabled = !hasActiveFilters;
    if (elements.count) {
      const suffix = String(entry.config.countSuffix || "").trim();
      elements.count.textContent = hasActiveFilters
        ? `${collections.records.length} / ${collections.allRecords.length}${suffix ? ` ${suffix}` : ""}`
        : `${collections.allRecords.length}${suffix ? ` ${suffix}` : ""}`;
    }
    return { records: collections.records, hasActiveFilters };
  }

  function reset(name) {
    const entry = getEntry(name);
    entry.state.query = "";
    entry.state.window = "all";
    entry.state.date = "";
    entry.config.renderView?.();
  }

  function bind() {
    for (const [name, entry] of entries) {
      if (entry.bound) continue;
      const elements = getElements(name);
      elements.searchInput?.addEventListener("input", (event) => {
        entry.state.query = event.target.value;
        entry.config.renderView?.();
      });
      elements.dateInput?.addEventListener("input", (event) => {
        entry.state.date = normalizeAssetRecordDateFilter(event.target.value);
        if (entry.state.date) entry.state.window = "all";
        entry.config.renderView?.();
      });
      elements.resetButton?.addEventListener("click", () => reset(name));
      entry.bound = true;
    }
  }

  return { bind, filter, hasActive, render, reset, snapshot };
}
