(() => {
  const HOST_ID = "gpt-image2-studio-product-image-collector";
  const PANEL_VERSION = "1.0.3";
  const TOGGLE_EVENT = "gpt-image2-studio-product-image-collector:toggle";
  const PANEL_OPENED_EVENT = "gpt-image2-studio-product-image-collector:panel-opened";
  const PANEL_CLOSED_EVENT = "gpt-image2-studio-product-image-collector:panel-closed";
  const MESSAGE_COLLECT = "product-image-collector:collect";
  const MESSAGE_COPY = "product-image-collector:copy";
  const MESSAGE_DOWNLOAD = "product-image-collector:download";
  const DOCK_THRESHOLD = 40;
  const CATEGORY_LABELS = { main: "主图", detail: "详情图", sku: "SKU 图" };

  const existing = document.getElementById(HOST_ID);
  if (existing?.dataset.collectorVersion === PANEL_VERSION) {
    document.dispatchEvent(new CustomEvent(PANEL_OPENED_EVENT));
    existing.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
    return;
  }
  existing?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.collectorVersion = PANEL_VERSION;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: block;
        pointer-events: none;
        color-scheme: light;
        font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      button, input { font: inherit; }
      button { letter-spacing: 0; }
      .panel {
        position: absolute;
        top: 76px;
        right: 16px;
        display: grid;
        grid-template-rows: auto auto auto auto minmax(0, 1fr) auto;
        width: 360px;
        max-width: calc(100vw - 24px);
        height: min(680px, calc(100vh - 96px));
        min-height: 320px;
        overflow: hidden;
        border: 1px solid #cfd6df;
        border-radius: 8px;
        background: #f6f7f9;
        color: #17202b;
        box-shadow: 0 16px 42px rgba(15, 23, 42, 0.24);
        pointer-events: auto;
        transition: transform 180ms ease, box-shadow 180ms ease;
      }
      .panel[data-dragging="true"] { transition: none; user-select: none; }
      .panel[data-dock="left"] { left: 0 !important; right: auto !important; border-radius: 0 8px 8px 0; }
      .panel[data-dock="right"] { right: 0 !important; left: auto !important; border-radius: 8px 0 0 8px; }
      .panel[data-dock="left"][data-collapsed="true"] { transform: translateX(calc(-100% + 44px)); }
      .panel[data-dock="right"][data-collapsed="true"] { transform: translateX(calc(100% - 44px)); }
      .panel-head {
        min-height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 10px 10px 14px;
        border-bottom: 1px solid #dde2e8;
        background: #fff;
        cursor: grab;
        touch-action: none;
      }
      .panel[data-dragging="true"] .panel-head { cursor: grabbing; }
      .title-block { min-width: 0; }
      .brand { color: #d94b22; font-size: 11px; font-weight: 700; }
      h1 { margin: 2px 0 0; font-size: 17px; line-height: 1.2; letter-spacing: 0; }
      .head-actions { display: flex; flex: 0 0 auto; gap: 6px; }
      .icon-button {
        width: 36px;
        height: 36px;
        display: inline-grid;
        place-items: center;
        padding: 0;
        border: 1px solid #cfd6df;
        border-radius: 6px;
        background: #fff;
        color: #263241;
        font-size: 19px;
        line-height: 1;
        cursor: pointer;
      }
      .icon-button:hover { background: #eef2f6; }
      .summary { display: grid; gap: 4px; padding: 11px 12px 8px; background: #fff; }
      .summary strong { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
      .summary span { color: #687585; font-size: 12px; }
      .selection-tools { display: grid; gap: 6px; padding: 4px 12px 8px; background: #fff; }
      .selection-row { display: grid; gap: 6px; }
      .selection-row[data-columns="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .selection-row[data-columns="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .selection-tools button {
        min-height: 34px;
        min-width: 0;
        padding: 0 6px;
        border: 1px solid #c9d1db;
        border-radius: 6px;
        background: #fff;
        color: #334155;
        cursor: pointer;
      }
      .selection-tools button:hover { background: #eef2f6; }
      .status { margin: 0; padding: 8px 12px; border-top: 1px solid #edf0f3; background: #fff; color: #667382; font-size: 12px; line-height: 1.5; }
      .status[data-state="error"] { color: #b42318; }
      .status[data-state="success"] { color: #08764f; }
      .groups { display: grid; align-content: start; gap: 16px; min-height: 0; overflow: auto; padding: 12px; scrollbar-width: thin; }
      .group { display: grid; gap: 8px; }
      .group-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .group-head h2 { margin: 0; font-size: 13px; letter-spacing: 0; }
      .group-head span { color: #687585; font-size: 12px; }
      .image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .image-card {
        position: relative;
        aspect-ratio: 1;
        min-width: 0;
        overflow: hidden;
        border: 2px solid transparent;
        border-radius: 6px;
        background: #e4e8ed;
        cursor: pointer;
      }
      .image-card.is-selected { border-color: #1769aa; }
      .image-card input { position: absolute; top: 5px; left: 5px; z-index: 2; width: 18px; height: 18px; accent-color: #1769aa; }
      .image-card img { width: 100%; height: 100%; display: block; object-fit: cover; }
      .image-card img.is-broken { opacity: 0.18; }
      .image-card small { position: absolute; right: 4px; bottom: 4px; max-width: calc(100% - 8px); padding: 2px 4px; overflow: hidden; border-radius: 3px; background: rgba(20, 27, 36, 0.78); color: #fff; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .action-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid #dce2e9; background: #fff; }
      .action-bar button { min-height: 42px; border-radius: 6px; font-weight: 700; cursor: pointer; }
      .action-bar button:disabled, .selection-tools button:disabled, .icon-button:disabled { opacity: 0.45; cursor: not-allowed; }
      .secondary { border: 1px solid #1769aa; background: #fff; color: #155d97; }
      .primary { border: 1px solid #d94b22; background: #e9542a; color: #fff; }
      .edge-handle {
        position: absolute;
        top: 50%;
        z-index: 8;
        width: 44px;
        height: 108px;
        display: none;
        place-items: center;
        padding: 0;
        transform: translateY(-50%);
        border: 1px solid #cfd6df;
        background: #fff;
        color: #d94b22;
        font-size: 25px;
        cursor: pointer;
      }
      .panel[data-dock="left"] .edge-handle { right: 0; display: grid; border-radius: 0 7px 7px 0; }
      .panel[data-dock="right"] .edge-handle { left: 0; display: grid; border-radius: 7px 0 0 7px; }
      @media (max-width: 420px) {
        .panel { top: 56px; width: calc(100vw - 16px); height: calc(100vh - 68px); max-width: none; min-height: 0; }
        .image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
    <aside class="panel" role="dialog" aria-label="商品图采集悬浮窗" data-collapsed="false">
      <header class="panel-head" id="dragHandle">
        <div class="title-block">
          <span class="brand">GPT-Image2-Studio</span>
          <h1>商品图采集</h1>
        </div>
        <div class="head-actions">
          <button class="icon-button" id="collectButton" type="button" title="重新采集" aria-label="重新采集">↻</button>
          <button class="icon-button" id="dockButton" type="button" title="贴边收起" aria-label="贴边收起">⇥</button>
          <button class="icon-button" id="closeButton" type="button" title="关闭" aria-label="关闭">×</button>
        </div>
      </header>
      <section class="summary" aria-live="polite">
        <strong id="productTitle">等待采集当前商品</strong>
        <span id="selectionCount">已选 0 / 共 0 张</span>
      </section>
      <div class="selection-tools" role="group" aria-label="选择商品图">
        <div class="selection-row" data-columns="2">
          <button id="selectAllButton" type="button">全选</button>
          <button id="invertButton" type="button">反选</button>
        </div>
        <div class="selection-row" data-columns="3">
          <button id="selectMainOnlyButton" type="button">只选主图</button>
          <button id="selectDetailOnlyButton" type="button">只选详情图</button>
          <button id="selectSkuOnlyButton" type="button">只选 SKU 图</button>
        </div>
      </div>
      <p class="status" id="status" data-state="idle">正在读取当前商品页...</p>
      <div class="groups" id="groups"></div>
      <footer class="action-bar">
        <button class="secondary" id="copyButton" type="button" disabled>复制到 Studio</button>
        <button class="primary" id="downloadButton" type="button" disabled>下载所选</button>
      </footer>
      <button class="edge-handle" id="edgeHandle" type="button" title="展开商品图采集" aria-label="展开商品图采集">‹</button>
    </aside>
  `;

  const refs = {
    closeButton: shadow.querySelector("#closeButton"),
    collectButton: shadow.querySelector("#collectButton"),
    copyButton: shadow.querySelector("#copyButton"),
    dockButton: shadow.querySelector("#dockButton"),
    downloadButton: shadow.querySelector("#downloadButton"),
    dragHandle: shadow.querySelector("#dragHandle"),
    edgeHandle: shadow.querySelector("#edgeHandle"),
    groups: shadow.querySelector("#groups"),
    invertButton: shadow.querySelector("#invertButton"),
    selectDetailOnlyButton: shadow.querySelector("#selectDetailOnlyButton"),
    selectMainOnlyButton: shadow.querySelector("#selectMainOnlyButton"),
    selectSkuOnlyButton: shadow.querySelector("#selectSkuOnlyButton"),
    panel: shadow.querySelector(".panel"),
    productTitle: shadow.querySelector("#productTitle"),
    selectAllButton: shadow.querySelector("#selectAllButton"),
    selectionCount: shadow.querySelector("#selectionCount"),
    status: shadow.querySelector("#status"),
  };
  const state = {
    busy: false,
    collapseTimer: 0,
    dock: "",
    drag: null,
    manifest: null,
    selectedIds: new Set(),
  };

  function setStatus(message, kind = "idle") {
    refs.status.textContent = message;
    refs.status.dataset.state = kind;
  }

  function sendMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, ...payload }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) return reject(new Error(runtimeError.message));
        if (!response?.ok) return reject(new Error(response?.message || "商品图采集操作失败。"));
        resolve(response);
      });
    });
  }

  function selectedItems() {
    return (state.manifest?.items || []).filter((item) => state.selectedIds.has(item.id));
  }

  function itemVariantLabels(item) {
    return Array.isArray(item?.variantLabels) ? item.variantLabels.filter(Boolean) : [];
  }

  function skuVariantCount(items = state.manifest?.items || []) {
    return items
      .filter((item) => item.category === "sku")
      .reduce((total, item) => total + Math.max(itemVariantLabels(item).length, Number.parseInt(item.variantCount, 10) || 0, 1), 0);
  }

  function displayFilename(item) {
    const fallback = `${CATEGORY_LABELS[item.category] || item.category} ${item.order}`;
    return String(item.filename || fallback).replace(/\.[^.]+$/, "");
  }

  function syncActions() {
    const total = state.manifest?.items.length || 0;
    const selected = state.selectedIds.size;
    const variantCount = skuVariantCount();
    refs.selectionCount.textContent = `已选 ${selected} / 共 ${total} 张${variantCount ? ` · SKU ${variantCount} 个规格` : ""}`;
    refs.copyButton.disabled = state.busy || selected === 0;
    refs.downloadButton.disabled = state.busy || selected === 0;
    refs.collectButton.disabled = state.busy;
    refs.selectAllButton.disabled = state.busy || total === 0;
    refs.invertButton.disabled = state.busy || total === 0;
    refs.selectMainOnlyButton.disabled = state.busy || !(state.manifest?.items || []).some((item) => item.category === "main");
    refs.selectDetailOnlyButton.disabled = state.busy || !(state.manifest?.items || []).some((item) => item.category === "detail");
    refs.selectSkuOnlyButton.disabled = state.busy || !(state.manifest?.items || []).some((item) => item.category === "sku");
  }

  function render() {
    refs.groups.replaceChildren();
    refs.productTitle.textContent = state.manifest?.product?.title || "等待采集当前商品";
    for (const category of ["main", "detail", "sku"]) {
      const items = (state.manifest?.items || []).filter((item) => item.category === category);
      if (items.length === 0) continue;
      const section = document.createElement("section");
      section.className = "group";
      const head = document.createElement("div");
      head.className = "group-head";
      const heading = document.createElement("h2");
      heading.textContent = CATEGORY_LABELS[category];
      const count = document.createElement("span");
      const variantCount = category === "sku" ? skuVariantCount(items) : 0;
      count.textContent = `${items.length} 张${variantCount ? ` · ${variantCount} 个规格` : ""}`;
      head.append(heading, count);
      const grid = document.createElement("div");
      grid.className = "image-grid";
      for (const item of items) {
        const label = document.createElement("label");
        label.className = `image-card${state.selectedIds.has(item.id) ? " is-selected" : ""}`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedIds.has(item.id);
        const variantLabels = itemVariantLabels(item);
        const variantTitle = variantLabels.join(" / ");
        const filename = displayFilename(item);
        checkbox.setAttribute("aria-label", filename);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) state.selectedIds.add(item.id);
          else state.selectedIds.delete(item.id);
          render();
        });
        const image = document.createElement("img");
        image.src = item.url;
        image.alt = filename;
        image.loading = "lazy";
        image.addEventListener("error", () => image.classList.add("is-broken"));
        const meta = document.createElement("small");
        meta.textContent = filename;
        meta.title = filename;
        label.title = variantTitle ? `${filename}：${variantTitle}` : filename;
        label.append(checkbox, image, meta);
        grid.appendChild(label);
      }
      section.append(head, grid);
      refs.groups.appendChild(section);
    }
    syncActions();
  }

  async function collectCurrentPage() {
    state.busy = true;
    syncActions();
    setStatus("正在读取当前商品页...");
    try {
      const response = await sendMessage(MESSAGE_COLLECT, { pageUrl: location.href });
      state.manifest = response.manifest;
      state.selectedIds = new Set(response.manifest.items.map((item) => item.id));
      const variantCount = skuVariantCount(response.manifest.items);
      const summary = `已采集 ${response.manifest.items.length} 张独立商品图${variantCount ? `，SKU 覆盖 ${variantCount} 个规格` : ""}。`;
      setStatus(`${summary}${response.notice ? ` ${response.notice}` : ""}`, response.notice ? "idle" : "success");
    } catch (error) {
      state.manifest = null;
      state.selectedIds.clear();
      setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("无法写入剪贴板。");
  }

  async function copySelection() {
    const items = selectedItems();
    if (items.length === 0) return setStatus("请先选择要复制的商品图。", "error");
    state.busy = true;
    syncActions();
    try {
      const response = await sendMessage(MESSAGE_COPY, {
        manifest: state.manifest,
        selectedIds: items.map((item) => item.id),
      });
      await writeClipboard(response.text);
      const variantCount = skuVariantCount(items);
      setStatus(`已复制 ${response.count} 张独立商品图清单${variantCount ? `，SKU 覆盖 ${variantCount} 个规格` : ""}，可到 Studio 导入。`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      syncActions();
    }
  }

  async function downloadSelection() {
    const items = selectedItems();
    if (items.length === 0) return setStatus("请先选择要下载的商品图。", "error");
    state.busy = true;
    syncActions();
    try {
      const response = await sendMessage(MESSAGE_DOWNLOAD, {
        manifest: state.manifest,
        selectedIds: items.map((item) => item.id),
      });
      setStatus(`已提交 ${response.count} 张图片到 ${response.folder}，未生成 JSON 文件。`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      syncActions();
    }
  }

  function clearCollapseTimer() {
    if (state.collapseTimer) window.clearTimeout(state.collapseTimer);
    state.collapseTimer = 0;
  }

  function setCollapsed(collapsed) {
    if (!state.dock) return;
    clearCollapseTimer();
    refs.panel.dataset.collapsed = String(Boolean(collapsed));
    refs.edgeHandle.textContent = state.dock === "left" ? "›" : "‹";
  }

  function dockPanel(edge, collapsed = true) {
    state.dock = edge;
    refs.panel.dataset.dock = edge;
    const maxTop = Math.max(0, window.innerHeight - refs.panel.offsetHeight);
    const top = Math.min(Math.max(0, Number.parseFloat(refs.panel.style.top) || refs.panel.getBoundingClientRect().top), maxTop);
    refs.panel.style.top = `${Math.round(top)}px`;
    if (edge === "left") {
      refs.panel.style.left = "0px";
      refs.panel.style.right = "auto";
    } else {
      refs.panel.style.left = "auto";
      refs.panel.style.right = "0px";
    }
    setCollapsed(collapsed);
  }

  function dockToNearestEdge() {
    const rect = refs.panel.getBoundingClientRect();
    dockPanel(rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right", true);
  }

  function beginDrag(event) {
    if (event.button !== 0 || event.target.closest("button")) return;
    clearCollapseTimer();
    const rect = refs.panel.getBoundingClientRect();
    state.dock = "";
    delete refs.panel.dataset.dock;
    refs.panel.dataset.collapsed = "false";
    refs.panel.dataset.dragging = "true";
    refs.panel.style.left = `${Math.round(rect.left)}px`;
    refs.panel.style.right = "auto";
    refs.panel.style.top = `${Math.round(rect.top)}px`;
    state.drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    refs.dragHandle.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    const maxLeft = Math.max(0, window.innerWidth - refs.panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - refs.panel.offsetHeight);
    const left = Math.min(Math.max(0, event.clientX - state.drag.offsetX), maxLeft);
    const top = Math.min(Math.max(0, event.clientY - state.drag.offsetY), maxTop);
    refs.panel.style.left = `${Math.round(left)}px`;
    refs.panel.style.top = `${Math.round(top)}px`;
  }

  function endDrag(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    state.drag = null;
    delete refs.panel.dataset.dragging;
    if (refs.dragHandle.hasPointerCapture(event.pointerId)) refs.dragHandle.releasePointerCapture(event.pointerId);
    const rect = refs.panel.getBoundingClientRect();
    if (rect.left <= DOCK_THRESHOLD) dockPanel("left", true);
    else if (window.innerWidth - rect.right <= DOCK_THRESHOLD) dockPanel("right", true);
  }

  function clampFloatingPanel() {
    if (state.dock) {
      dockPanel(state.dock, refs.panel.dataset.collapsed === "true");
      return;
    }
    const rect = refs.panel.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - refs.panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - refs.panel.offsetHeight);
    refs.panel.style.left = `${Math.round(Math.min(Math.max(0, rect.left), maxLeft))}px`;
    refs.panel.style.right = "auto";
    refs.panel.style.top = `${Math.round(Math.min(Math.max(0, rect.top), maxTop))}px`;
  }

  function closePanel() {
    clearCollapseTimer();
    window.removeEventListener("resize", clampFloatingPanel);
    host.remove();
    document.dispatchEvent(new CustomEvent(PANEL_CLOSED_EVENT));
  }

  function selectCategory(category) {
    state.selectedIds = new Set((state.manifest?.items || []).filter((item) => item.category === category).map((item) => item.id));
    render();
  }

  refs.collectButton.addEventListener("click", collectCurrentPage);
  refs.copyButton.addEventListener("click", copySelection);
  refs.downloadButton.addEventListener("click", downloadSelection);
  refs.selectAllButton.addEventListener("click", () => {
    state.selectedIds = new Set((state.manifest?.items || []).map((item) => item.id));
    render();
  });
  refs.invertButton.addEventListener("click", () => {
    state.selectedIds = new Set((state.manifest?.items || []).filter((item) => !state.selectedIds.has(item.id)).map((item) => item.id));
    render();
  });
  refs.selectMainOnlyButton.addEventListener("click", () => selectCategory("main"));
  refs.selectDetailOnlyButton.addEventListener("click", () => selectCategory("detail"));
  refs.selectSkuOnlyButton.addEventListener("click", () => selectCategory("sku"));
  refs.closeButton.addEventListener("click", closePanel);
  refs.dockButton.addEventListener("click", dockToNearestEdge);
  refs.edgeHandle.addEventListener("click", () => setCollapsed(false));
  refs.dragHandle.addEventListener("pointerdown", beginDrag);
  refs.dragHandle.addEventListener("pointermove", moveDrag);
  refs.dragHandle.addEventListener("pointerup", endDrag);
  refs.dragHandle.addEventListener("pointercancel", endDrag);
  refs.panel.addEventListener("pointerenter", () => {
    clearCollapseTimer();
    if (state.dock && refs.panel.dataset.collapsed === "true") setCollapsed(false);
  });
  refs.panel.addEventListener("pointerleave", () => {
    if (!state.dock || refs.panel.dataset.collapsed === "true" || state.drag) return;
    clearCollapseTimer();
    state.collapseTimer = window.setTimeout(() => setCollapsed(true), 550);
  });
  host.addEventListener(TOGGLE_EVENT, () => {
    if (state.dock) setCollapsed(refs.panel.dataset.collapsed !== "true");
    else dockToNearestEdge();
  });
  window.addEventListener("resize", clampFloatingPanel);

  document.dispatchEvent(new CustomEvent(PANEL_OPENED_EVENT));
  render();
  collectCurrentPage();
})();
