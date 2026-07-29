(() => {
  const HOST_ID = "gpt-image2-studio-product-image-collector";
  const CONTROLLER_KEY = "__gptImage2StudioProductImagePanelController";
  const PANEL_VERSION = "1.1.23";
  const REVEAL_EVENT = "gpt-image2-studio-product-image-collector:reveal";
  const PANEL_OPENED_EVENT = "gpt-image2-studio-product-image-collector:panel-opened";
  const PANEL_CLOSED_EVENT = "gpt-image2-studio-product-image-collector:panel-closed";
  const PANEL_NAVIGATED_EVENT = "gpt-image2-studio-product-image-collector:page-navigated";
  const MESSAGE_COLLECT = "product-image-collector:collect";
  const MESSAGE_COPY = "product-image-collector:copy";
  const MESSAGE_COPY_IMAGES = "product-image-collector:copy-images";
  const MESSAGE_DOWNLOAD = "product-image-collector:download";
  const MESSAGE_TIMEOUT_MS = Object.freeze({
    [MESSAGE_COLLECT]: 20000,
    [MESSAGE_COPY]: 10000,
    [MESSAGE_DOWNLOAD]: 60000,
  });
  const COPY_IMAGES_MIN_TIMEOUT_MS = 45000;
  const COPY_IMAGES_MAX_TIMEOUT_MS = 10 * 60 * 1000;
  const NATIVE_DOWNLOAD_CONCURRENCY = 8;
  const NATIVE_DOWNLOAD_TIMEOUT_MS = 35000;
  const DOCK_THRESHOLD = 40;
  const VIEWER_MIN_SCALE = 0.5;
  const VIEWER_MAX_SCALE = 4;
  const VIEWER_SCALE_FACTOR = 1.15;
  const VIEWER_DRAG_THRESHOLD = 3;
  const VARIANT_FONT_MAX_PX = 10;
  const VARIANT_FONT_MIN_PX = 1;
  const VARIANT_HORIZONTAL_PADDING_PX = 10;
  const COPY_SUCCESS_TOAST_MS = 1800;
  const CATEGORY_LABELS = { main: "主图", detail: "详情图", sku: "SKU 图" };
  const PLATFORM_LABELS = {
    "1688": "1688",
    amazon: "Amazon",
    temu: "Temu",
    tiktok: "TikTok Shop",
    shein: "SHEIN",
    gigacloud: "大健云仓",
  };
  const ICON_MARKUP = {
    eye: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
    download: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    "chevron-left": '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    "chevron-right": '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    maximize: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    minimize: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
    "rotate-ccw": '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    "rotate-cw": '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    "zoom-in": '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
    "zoom-out": '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>',
    x: '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  };

  const currentController = globalThis[CONTROLLER_KEY];
  if (currentController?.version === PANEL_VERSION && currentController.reveal) {
    currentController.reveal();
    return;
  }
  if (currentController?.destroy) currentController.destroy();
  const existing = document.getElementById(HOST_ID);
  existing?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.collectorVersion = PANEL_VERSION;
  host.dataset.panelHidden = "false";
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
        grid-template-rows: auto auto auto minmax(0, 1fr) auto;
        width: clamp(520px, 31vw, 540px);
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
        transition: box-shadow 180ms ease, transform 180ms ease;
      }
      .panel[data-dragging="true"] { transition: none; user-select: none; }
      .panel[hidden] { display: none; }
      .panel[data-dock="left"] {
        top: 0 !important;
        left: 0 !important;
        right: auto !important;
        height: 100vh;
        height: 100dvh;
        min-height: 0;
        border-radius: 0;
      }
      .panel[data-dock="right"] {
        top: 0 !important;
        right: 0 !important;
        left: auto !important;
        height: 100vh;
        height: 100dvh;
        min-height: 0;
        border-radius: 0;
      }
      .panel[data-folded="true"][data-dock="right"] { transform: translateX(calc(100% - 40px)); }
      .panel[data-folded="true"][data-dock="left"] { transform: translateX(calc(-100% + 40px)); }
      .panel[data-folded="true"] > :not(.fold-rail) { visibility: hidden; pointer-events: none; }
      .fold-rail {
        position: absolute;
        z-index: 30;
        top: 0;
        bottom: 0;
        width: 40px;
        display: none;
        place-items: center;
        padding: 0;
        border: 0;
        background: #fff;
        color: #1769aa;
        cursor: pointer;
      }
      .panel[data-folded="true"] .fold-rail { display: grid; visibility: visible; pointer-events: auto; }
      .panel[data-dock="right"] .fold-rail { left: 0; border-right: 1px solid #cfd6df; }
      .panel[data-dock="left"] .fold-rail { right: 0; border-left: 1px solid #cfd6df; }
      .fold-rail:hover { background: #eef2f6; }
      .panel-head {
        min-height: 48px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 6px;
        padding: 6px 8px 6px 10px;
        border-bottom: 1px solid #dde2e8;
        background: #fff;
        cursor: grab;
        touch-action: none;
      }
      .panel[data-dragging="true"] .panel-head { cursor: grabbing; }
      .product-summary { min-width: 0; align-self: stretch; display: flex; align-items: center; }
      .product-summary strong { min-width: 0; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; white-space: normal; }
      .title-block { width: 96px; min-width: 0; align-self: stretch; display: grid; place-content: center; justify-items: center; padding-left: 6px; border-left: 1px solid #e4e8ed; text-align: center; }
      .brand { width: 100%; display: block; overflow: hidden; color: #d94b22; font-size: 8px; font-weight: 700; line-height: 1.2; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
      .platform-name { width: 100%; margin: 1px 0 0; overflow: hidden; font-size: 12px; line-height: 1.2; letter-spacing: 0; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
      .head-actions { display: flex; flex: 0 0 auto; gap: 4px; }
      .icon-button {
        width: 28px;
        height: 28px;
        display: inline-grid;
        place-items: center;
        padding: 0;
        border: 1px solid #cfd6df;
        border-radius: 5px;
        background: #fff;
        color: #263241;
        font-size: 17px;
        line-height: 1;
        cursor: pointer;
      }
      .icon-button:hover { background: #eef2f6; }
      .selection-tools { display: grid; gap: 4px; overflow-x: auto; padding: 3px 8px 5px; background: #fff; scrollbar-width: thin; }
      .selection-row { display: grid; gap: 5px; }
      .selection-row[data-columns="6"] { grid-template-columns: repeat(6, minmax(66px, 1fr)); min-width: 421px; }
      .selection-tools button {
        min-height: 27px;
        min-width: 0;
        padding: 0 4px;
        border: 1px solid #c9d1db;
        border-radius: 5px;
        background: #fff;
        color: #334155;
        font-size: 11px;
        line-height: 1.2;
        cursor: pointer;
        white-space: nowrap;
      }
      .selection-tools button:hover { background: #eef2f6; }
      .status { margin: 0; padding: 4px 8px; border-top: 1px solid #edf0f3; background: #fff; color: #667382; font-size: 10px; line-height: 1.4; overflow-wrap: anywhere; white-space: normal; }
      .status[data-state="error"] { color: #b42318; }
      .status[data-state="success"] { color: #08764f; }
      .groups { display: grid; align-content: start; min-height: 0; overflow: auto; scrollbar-width: thin; }
      .group { display: grid; gap: 6px; padding: 7px 8px 9px; border-bottom: 1px solid hsl(210 24% 88%); }
      .group[data-category="main"] { background: hsl(210 24% 98%); }
      .group[data-category="detail"] { background: hsl(210 24% 95%); }
      .group[data-category="sku"] { background: hsl(210 24% 92%); }
      .group-head { min-height: 36px; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 7px; border: 1px solid #e2e7ed; border-radius: 5px; background: #fff; }
      .group-head h2 { min-width: 0; margin: 0; overflow: hidden; font-size: 13px; font-weight: 700; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
      .group-head-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; }
      .group-selection-count { color: #17202b; font-size: 11px; font-weight: 700; white-space: nowrap; }
      .group-select-all { display: inline-flex; align-items: center; gap: 4px; color: #263241; font-size: 11px; font-weight: 700; white-space: nowrap; cursor: pointer; }
      .group-select-all input { width: 15px; height: 15px; margin: 0; accent-color: #3f78ff; cursor: pointer; }
      .group-select-all input:disabled { cursor: not-allowed; opacity: 0.45; }
      .group-download-button { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #356dff; cursor: pointer; }
      .group-download-button:hover { background: #edf3ff; }
      .group-download-button:disabled { cursor: not-allowed; opacity: 0.35; }
      .image-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .image-card {
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-rows: auto 24px;
        overflow: hidden;
        border: 2px solid #d7dee7;
        border-radius: 5px;
        background: #fff;
      }
      .image-card.has-variant { grid-template-rows: auto 20px 24px; }
      .image-card.is-selected { border-color: #5b9cff; }
      .image-card-media { position: relative; width: 100%; height: auto; min-width: 0; aspect-ratio: 1; display: block; overflow: hidden; background: #fff; cursor: pointer; }
      .image-card-media input { position: absolute; top: 3px; left: 3px; z-index: 2; width: 14px; height: 14px; accent-color: #1769aa; }
      .image-card-media img { width: 100%; height: 100%; display: block; content-visibility: auto; contain-intrinsic-size: 1px 1px; object-fit: contain; }
      .image-card-media img.is-broken { opacity: 0.18; }
      .image-card-meta { position: absolute; left: 4px; right: 4px; bottom: 4px; min-width: 0; display: grid; grid-template-columns: minmax(0, auto) auto; align-items: center; justify-content: space-between; gap: 4px; padding: 2px 4px; border: 1px solid rgba(255, 255, 255, 0.72); border-radius: 4px; background: rgba(248, 250, 252, 0.64); color: #263241; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); pointer-events: none; }
      .image-card-name { min-width: 0; padding: 0; background: transparent; color: inherit; font-size: 10px; font-weight: 700; line-height: 1.25; white-space: nowrap; }
      .image-card-resolution { justify-self: end; padding: 0; background: transparent; color: inherit; font-size: 9px; font-weight: 700; line-height: 1.25; white-space: nowrap; }
      .image-card-variant { min-width: 0; overflow: hidden; padding: 2px 5px; border-top: 1px solid #e1e5ea; background: #fff; color: #334155; font-size: 10px; font-weight: 600; line-height: 15px; letter-spacing: 0; text-align: center; white-space: nowrap; }
      .image-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid #d5dbe3; background: #fff; }
      .image-card-actions button { min-width: 0; display: grid; place-items: center; padding: 0; border: 0; border-right: 1px solid #e1e5ea; background: #fff; color: #263241; cursor: pointer; }
      .image-card-actions button:last-child { border-right: 0; }
      .image-card-actions button:hover { background: #eef2f6; color: #155d97; }
      .image-card-actions button:disabled { cursor: wait; opacity: 0.45; }
      .button-icon { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
      .action-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 6px 8px 8px; border-top: 1px solid #dce2e9; background: #fff; }
      .action-bar button { min-height: 32px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer; }
      .action-bar button:disabled, .selection-tools button:disabled, .icon-button:disabled { opacity: 0.45; cursor: not-allowed; }
      .secondary { border: 1px solid #1769aa; background: #fff; color: #155d97; }
      .primary { border: 1px solid #d94b22; background: #e9542a; color: #fff; }
      .copy-success-toast { position: absolute; z-index: 35; left: 50%; bottom: 60px; max-width: calc(100% - 32px); overflow: hidden; padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.56); border-radius: 6px; background: rgba(8, 118, 79, 0.78); color: #fff; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); font-size: 12px; font-weight: 700; line-height: 1.4; text-align: center; text-overflow: ellipsis; white-space: nowrap; opacity: 0; visibility: hidden; pointer-events: none; transform: translate(-50%, 8px); transition: opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms; }
      .copy-success-toast[data-visible="true"] { opacity: 1; visibility: visible; transform: translate(-50%, 0); transition: opacity 180ms ease, transform 180ms ease, visibility 0s; }
      .image-viewer {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        background: rgba(15, 23, 42, 0.76);
        border-radius: inherit;
        overflow: hidden;
        pointer-events: auto;
      }
      .image-viewer[hidden] { display: none; }
      .viewer-close-button { position: absolute; z-index: 3; top: 10px; right: 10px; width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 1px solid rgba(203, 213, 225, 0.72); border-radius: 50%; background: rgba(248, 250, 252, 0.68); color: #334155; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); cursor: pointer; }
      .viewer-close-button:hover, .viewer-close-button:focus-visible { background: rgba(248, 250, 252, 0.9); color: #17202b; }
      .image-viewer-stage { position: relative; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; padding: 14px 14px 58px; overscroll-behavior: contain; }
      .viewer-image-frame { position: absolute; inset: 14px 14px 58px; overflow: visible; pointer-events: none; }
      .image-viewer-stage img { position: absolute; left: 50%; top: 50%; width: auto; height: auto; max-width: none; max-height: none; display: block; object-fit: contain; translate: -50% -50%; transform: translate3d(0, 0, 0) scale(1); transform-origin: center; transition: transform 90ms ease-out; user-select: none; -webkit-user-drag: none; pointer-events: auto; cursor: grab; }
      .image-viewer-stage img.is-dragging { cursor: grabbing; transition: none; }
      .image-viewer-toolbar { position: absolute; z-index: 2; left: 50%; bottom: 10px; display: flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid rgba(203, 213, 225, 0.42); border-radius: 6px; background: rgba(248, 250, 252, 0.38); box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); transform: translateX(-50%); }
      .viewer-tool-button { position: relative; width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 1px solid rgba(203, 213, 225, 0.68); border-radius: 4px; background: rgba(248, 250, 252, 0.68); color: #526173; cursor: pointer; }
      .viewer-tool-button:hover, .viewer-tool-button:focus-visible { background: rgba(248, 250, 252, 0.92); color: #326cff; }
      .viewer-tool-button:disabled { cursor: not-allowed; opacity: 0.36; }
      .viewer-tool-button::after { content: attr(data-tooltip); position: absolute; left: 50%; bottom: calc(100% + 7px); padding: 5px 7px; border-radius: 4px; background: #17202b; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; white-space: nowrap; opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(3px); transition: opacity 120ms ease, transform 120ms ease; }
      .viewer-tool-button:hover::after, .viewer-tool-button:focus-visible::after { opacity: 1; transform: translateX(-50%) translateY(0); }
      .viewer-zoom-output { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .image-viewer-nav { position: absolute; z-index: 2; left: 10px; right: 10px; bottom: 10px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
      .image-viewer-nav button { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 1px solid rgba(203, 213, 225, 0.68); border-radius: 5px; background: rgba(248, 250, 252, 0.68); color: #263241; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); cursor: pointer; pointer-events: auto; }
      .image-viewer-nav button:hover, .image-viewer-nav button:focus-visible { background: rgba(248, 250, 252, 0.92); color: #326cff; }
      .image-viewer-nav button:disabled { cursor: not-allowed; opacity: 0.38; }
      @media (max-width: 520px) {
        .panel { top: 56px; width: calc(100vw - 16px); height: calc(100vh - 68px); max-width: none; min-height: 0; }
        .panel[data-dock="left"], .panel[data-dock="right"] { width: 100%; max-width: 100%; }
        .image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .image-card { width: auto; grid-template-rows: auto 24px; }
        .image-card-media { width: 100%; height: auto; aspect-ratio: 1; }
      }
    </style>
    <aside class="panel" role="dialog" aria-label="商品图采集悬浮窗" data-dock="right" data-fold-enabled="false" data-folded="false">
      <header class="panel-head" id="dragHandle">
        <div class="product-summary" aria-live="polite">
          <strong id="productTitle">等待采集当前商品</strong>
        </div>
        <div class="title-block">
          <span class="brand">GPT-Image2-Studio</span>
          <h1 class="platform-name" id="platformName">商品平台</h1>
        </div>
        <div class="head-actions">
          <button class="icon-button" id="collectButton" type="button" title="重新采集" aria-label="重新采集">↻</button>
          <button class="icon-button" id="closeButton" type="button" title="关闭" aria-label="关闭">×</button>
        </div>
      </header>
      <div class="selection-tools" role="group" aria-label="选择商品图">
        <div class="selection-row" data-columns="6">
          <button id="selectAllButton" type="button">全选</button>
          <button id="invertButton" type="button">反选</button>
          <button id="foldToggleButton" type="button">开启折叠</button>
          <button id="selectMainButton" type="button">选主图</button>
          <button id="selectDetailButton" type="button">选详情图</button>
          <button id="selectSkuButton" type="button">选 SKU 图</button>
        </div>
      </div>
      <p class="status" id="status" data-state="idle">正在读取当前商品页...</p>
      <div class="groups" id="groups"></div>
      <footer class="action-bar">
        <button class="secondary" id="copyButton" type="button" disabled>复制到 Studio</button>
        <button class="secondary" id="copyImagesButton" type="button" disabled>复制图片</button>
        <button class="primary" id="downloadButton" type="button" disabled>下载所选</button>
      </footer>
      <output class="copy-success-toast" id="copySuccessToast" role="status" aria-live="polite" aria-atomic="true" data-visible="false"></output>
      <button class="fold-rail" id="foldRailButton" type="button" title="展开采集窗" aria-label="展开采集窗"></button>
      <section class="image-viewer" id="imageViewer" role="dialog" aria-label="查看商品图" hidden>
        <button class="viewer-close-button" id="viewerCloseButton" type="button" title="关闭查看" aria-label="关闭查看"></button>
        <div class="image-viewer-stage" id="viewerStage">
          <div class="viewer-image-frame"><img id="viewerImage" alt="" draggable="false" /></div>
          <div class="image-viewer-toolbar" role="toolbar" aria-label="图片查看工具">
            <button class="viewer-tool-button" id="viewerFitButton" type="button" title="全屏" aria-label="全屏显示在插件内" data-tooltip="全屏"></button>
            <button class="viewer-tool-button" id="viewerRotateLeftButton" type="button" title="向左旋转" aria-label="向左旋转" data-tooltip="向左旋转"></button>
            <button class="viewer-tool-button" id="viewerRotateRightButton" type="button" title="向右旋转" aria-label="向右旋转" data-tooltip="向右旋转"></button>
            <button class="viewer-tool-button" id="viewerZoomInButton" type="button" title="放大" aria-label="放大" data-tooltip="放大"></button>
            <button class="viewer-tool-button" id="viewerZoomOutButton" type="button" title="缩小" aria-label="缩小" data-tooltip="缩小"></button>
            <button class="viewer-tool-button" id="viewerOriginalSizeButton" type="button" title="恢复初始视图" aria-label="恢复初始视图" data-tooltip="恢复初始视图"></button>
            <output class="viewer-zoom-output" id="viewerZoomLabel" aria-live="polite">100%</output>
          </div>
        </div>
        <footer class="image-viewer-nav">
          <button id="viewerPreviousButton" type="button" title="上一张" aria-label="上一张"></button>
          <button id="viewerNextButton" type="button" title="下一张" aria-label="下一张"></button>
        </footer>
      </section>
    </aside>
  `;

  const refs = {
    closeButton: shadow.querySelector("#closeButton"),
    collectButton: shadow.querySelector("#collectButton"),
    copyButton: shadow.querySelector("#copyButton"),
    copyImagesButton: shadow.querySelector("#copyImagesButton"),
    copySuccessToast: shadow.querySelector("#copySuccessToast"),
    downloadButton: shadow.querySelector("#downloadButton"),
    dragHandle: shadow.querySelector("#dragHandle"),
    foldRailButton: shadow.querySelector("#foldRailButton"),
    foldToggleButton: shadow.querySelector("#foldToggleButton"),
    groups: shadow.querySelector("#groups"),
    invertButton: shadow.querySelector("#invertButton"),
    selectDetailButton: shadow.querySelector("#selectDetailButton"),
    selectMainButton: shadow.querySelector("#selectMainButton"),
    selectSkuButton: shadow.querySelector("#selectSkuButton"),
    panel: shadow.querySelector(".panel"),
    platformName: shadow.querySelector("#platformName"),
    productTitle: shadow.querySelector("#productTitle"),
    selectAllButton: shadow.querySelector("#selectAllButton"),
    status: shadow.querySelector("#status"),
    viewer: shadow.querySelector("#imageViewer"),
    viewerCloseButton: shadow.querySelector("#viewerCloseButton"),
    viewerFitButton: shadow.querySelector("#viewerFitButton"),
    viewerImage: shadow.querySelector("#viewerImage"),
    viewerNextButton: shadow.querySelector("#viewerNextButton"),
    viewerOriginalSizeButton: shadow.querySelector("#viewerOriginalSizeButton"),
    viewerPreviousButton: shadow.querySelector("#viewerPreviousButton"),
    viewerRotateLeftButton: shadow.querySelector("#viewerRotateLeftButton"),
    viewerRotateRightButton: shadow.querySelector("#viewerRotateRightButton"),
    viewerStage: shadow.querySelector("#viewerStage"),
    viewerZoomInButton: shadow.querySelector("#viewerZoomInButton"),
    viewerZoomLabel: shadow.querySelector("#viewerZoomLabel"),
    viewerZoomOutButton: shadow.querySelector("#viewerZoomOutButton"),
  };
  const state = {
    busy: false,
    collectionNotice: "",
    dock: "right",
    drag: null,
    foldEnabled: false,
    folded: false,
    manifest: null,
    selectedIds: new Set(),
    viewerDrag: null,
    viewerIndex: -1,
    viewerItem: null,
    viewerOffsetX: 0,
    viewerOffsetY: 0,
    viewerRotation: 0,
    viewerScale: 1,
  };
  let copySuccessToastTimer = 0;
  let variantFitFrame = 0;
  let panelController = null;
  let panelDestroyed = false;

  refs.foldRailButton.append(createIcon("chevron-left"));
  refs.viewerPreviousButton.append(createIcon("chevron-left"));
  refs.viewerNextButton.append(createIcon("chevron-right"));
  refs.viewerFitButton.append(createIcon("maximize"));
  refs.viewerRotateLeftButton.append(createIcon("rotate-ccw"));
  refs.viewerRotateRightButton.append(createIcon("rotate-cw"));
  refs.viewerZoomInButton.append(createIcon("zoom-in"));
  refs.viewerZoomOutButton.append(createIcon("zoom-out"));
  refs.viewerOriginalSizeButton.append(createIcon("minimize"));
  refs.viewerCloseButton.append(createIcon("x"));

  function setStatus(message, kind = "idle") {
    refs.status.textContent = message;
    refs.status.dataset.state = kind;
  }

  function hideCopySuccessToast() {
    window.clearTimeout(copySuccessToastTimer);
    copySuccessToastTimer = 0;
    refs.copySuccessToast.dataset.visible = "false";
  }

  function showCopySuccessToast(message) {
    window.clearTimeout(copySuccessToastTimer);
    copySuccessToastTimer = 0;
    refs.copySuccessToast.dataset.visible = "false";
    refs.copySuccessToast.textContent = "";
    void refs.copySuccessToast.offsetWidth;
    refs.copySuccessToast.textContent = message;
    refs.copySuccessToast.dataset.visible = "true";
    copySuccessToastTimer = window.setTimeout(() => {
      refs.copySuccessToast.dataset.visible = "false";
      copySuccessToastTimer = 0;
    }, COPY_SUCCESS_TOAST_MS);
  }

  function messageTimeoutMs(type, payload) {
    if (type !== MESSAGE_COPY_IMAGES) return MESSAGE_TIMEOUT_MS[type] || 30000;
    const count = Math.max(1, Array.isArray(payload?.selectedIds) ? payload.selectedIds.length : 1);
    const downloadWaves = Math.ceil(count / NATIVE_DOWNLOAD_CONCURRENCY);
    return Math.min(
      COPY_IMAGES_MAX_TIMEOUT_MS,
      Math.max(COPY_IMAGES_MIN_TIMEOUT_MS, downloadWaves * NATIVE_DOWNLOAD_TIMEOUT_MS + 10000),
    );
  }

  function messageTimeoutText(type) {
    if (type === MESSAGE_COLLECT) return "读取商品页超时，请重试。";
    if (type === MESSAGE_COPY_IMAGES) return "准备图片超时，操作已恢复，请检查网络后重试。";
    if (type === MESSAGE_DOWNLOAD) return "提交下载超时，操作已恢复，请重试。";
    return "商品图采集操作超时，请重试。";
  }

  function sendMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(messageTimeoutText(type)));
      }, messageTimeoutMs(type, payload));

      function finish(callback) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        callback();
      }

      try {
        chrome.runtime.sendMessage({ type, ...payload }, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (settled) return;
          finish(() => {
            if (runtimeError) reject(new Error(runtimeError.message));
            else if (!response?.ok) reject(new Error(response?.message || "商品图采集操作失败。"));
            else resolve(response);
          });
        });
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error || "商品图采集操作失败。"))));
      }
    });
  }

  function selectedItems() {
    return (state.manifest?.items || []).filter((item) => state.selectedIds.has(item.id));
  }

  function selectedCategoryItems(category) {
    return (state.manifest?.items || []).filter((item) => item.category === category && state.selectedIds.has(item.id));
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

  function selectionStatusMessage() {
    const total = state.manifest?.items.length || 0;
    const selected = state.selectedIds.size;
    const variantCount = skuVariantCount();
    const summary = `已选 ${selected} / 共 ${total} 张商品图${variantCount ? ` · SKU 共 ${variantCount} 个规格` : ""}。`;
    return `${summary}${state.collectionNotice ? ` ${state.collectionNotice}` : ""}`;
  }

  function syncSelectionStatus() {
    setStatus(selectionStatusMessage(), state.collectionNotice ? "idle" : "success");
  }

  function cardLabelFor(item) {
    const category = CATEGORY_LABELS[item?.category] || String(item?.category || "图片");
    const order = Math.max(1, Number.parseInt(item?.order, 10) || 1);
    return `${category}-${order}`;
  }

  function resolutionLabelFor(item) {
    const width = Math.max(0, Math.round(Number(item?.width) || 0));
    const height = Math.max(0, Math.round(Number(item?.height) || 0));
    return width > 0 && height > 0 ? `${width}×${height}` : "未知";
  }

  function syncResolutionLabel(resolution, item) {
    const label = resolutionLabelFor(item);
    resolution.textContent = label;
    resolution.title = label === "未知" ? "分辨率未知" : `分辨率 ${label}`;
    resolution.setAttribute("aria-label", resolution.title);
  }

  function variantRows(nodes) {
    const rows = [];
    let row = null;
    for (const node of nodes) {
      const card = node.closest(".image-card");
      if (!card) continue;
      const top = Math.round(card.getBoundingClientRect().top);
      if (!row || Math.abs(row.top - top) > 1) {
        row = { top, nodes: [] };
        rows.push(row);
      }
      row.nodes.push(node);
    }
    return rows.map((row) => row.nodes);
  }

  function fittingVariantFontSize(node) {
    const availableWidth = Math.max(1, node.clientWidth - VARIANT_HORIZONTAL_PADDING_PX);
    const textWidth = Math.max(1, node.scrollWidth - VARIANT_HORIZONTAL_PADDING_PX);
    if (textWidth <= availableWidth) return VARIANT_FONT_MAX_PX;
    const scaled = VARIANT_FONT_MAX_PX * availableWidth / textWidth;
    return Math.max(VARIANT_FONT_MIN_PX, Math.floor(scaled * 10) / 10);
  }

  function fitVariantRows() {
    const nodes = Array.from(shadow.querySelectorAll(".image-card-variant"));
    for (const node of nodes) node.style.fontSize = `${VARIANT_FONT_MAX_PX}px`;
    for (const row of variantRows(nodes)) {
      const fontSize = Math.min(...row.map(fittingVariantFontSize));
      for (const node of row) node.style.fontSize = `${fontSize}px`;
    }
  }

  function scheduleVariantRowFit() {
    if (variantFitFrame) window.cancelAnimationFrame(variantFitFrame);
    variantFitFrame = window.requestAnimationFrame(() => {
      variantFitFrame = 0;
      fitVariantRows();
    });
  }

  function previewUrlFor(item) {
    if (state.manifest?.source?.platform !== "gigacloud") return item.url;
    try {
      const url = new URL(item.url);
      const hostname = url.hostname.toLowerCase();
      if (hostname !== "gigab2b.cn" && !hostname.endsWith(".gigab2b.cn") && hostname !== "gigab2b.com" && !hostname.endsWith(".gigab2b.com")) {
        return item.url;
      }
      url.searchParams.set("x-oss-process", "image/resize,w_300,h_300,m_pad");
      return url.href;
    } catch {
      return item.url;
    }
  }

  function createIcon(name) {
    const wrapper = document.createElement("span");
    wrapper.innerHTML = ICON_MARKUP[name] || "";
    return wrapper.firstElementChild;
  }

  function viewerImageDimensions() {
    const width = refs.viewerImage.naturalWidth || refs.viewerImage.clientWidth;
    const height = refs.viewerImage.naturalHeight || refs.viewerImage.clientHeight;
    const rotatedQuarterTurn = Math.abs(state.viewerRotation / 90) % 2 === 1;
    return {
      width: rotatedQuarterTurn ? height : width,
      height: rotatedQuarterTurn ? width : height,
    };
  }

  function viewerStageMetrics() {
    const style = getComputedStyle(refs.viewerStage);
    const width = Math.max(1, refs.viewerStage.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0));
    const height = Math.max(1, refs.viewerStage.clientHeight - (Number.parseFloat(style.paddingTop) || 0) - (Number.parseFloat(style.paddingBottom) || 0));
    const image = viewerImageDimensions();
    return {
      width,
      height,
      imageWidth: image.width,
      imageHeight: image.height,
    };
  }

  function viewerFitScale() {
    const metrics = viewerStageMetrics();
    if (!metrics.imageWidth || !metrics.imageHeight) return 1;
    return Math.min(1, metrics.width / metrics.imageWidth, metrics.height / metrics.imageHeight);
  }

  function viewerMinimumScale() {
    return Math.min(VIEWER_MIN_SCALE, viewerFitScale());
  }

  function clampViewerScale(value) {
    return Math.min(VIEWER_MAX_SCALE, Math.max(viewerMinimumScale(), Number(value) || 1));
  }

  function viewerFullscreenScale() {
    const metrics = viewerStageMetrics();
    if (!metrics.imageWidth || !metrics.imageHeight) return 1;
    return Math.min(VIEWER_MAX_SCALE, Math.max(metrics.width / metrics.imageWidth, metrics.height / metrics.imageHeight));
  }

  function viewerOffsetBounds() {
    const metrics = viewerStageMetrics();
    return {
      x: Math.abs(metrics.imageWidth * state.viewerScale - metrics.width) / 2,
      y: Math.abs(metrics.imageHeight * state.viewerScale - metrics.height) / 2,
    };
  }

  function syncViewerScale() {
    state.viewerScale = clampViewerScale(state.viewerScale);
    const bounds = viewerOffsetBounds();
    state.viewerOffsetX = Math.min(bounds.x, Math.max(-bounds.x, state.viewerOffsetX));
    state.viewerOffsetY = Math.min(bounds.y, Math.max(-bounds.y, state.viewerOffsetY));
    refs.viewerImage.style.transform = `translate3d(${Math.round(state.viewerOffsetX)}px, ${Math.round(state.viewerOffsetY)}px, 0) rotate(${state.viewerRotation}deg) scale(${state.viewerScale})`;
    refs.viewerZoomLabel.textContent = `${Math.round(state.viewerScale * 100)}%`;
    refs.viewerZoomOutButton.disabled = state.viewerScale <= viewerMinimumScale() + 0.001;
    refs.viewerZoomInButton.disabled = state.viewerScale >= VIEWER_MAX_SCALE;
  }

  function setViewerScale(value) {
    state.viewerScale = clampViewerScale(value);
    syncViewerScale();
  }

  function runViewerCommand(event, command) {
    command();
    if (event.detail > 0) event.currentTarget.blur();
  }

  function fitViewerWithinPanel() {
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerScale = viewerFitScale();
    syncViewerScale();
  }

  function fitViewerToPanel() {
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerScale = viewerFullscreenScale();
    syncViewerScale();
  }

  function resetViewerView() {
    endViewerDrag();
    state.viewerRotation = 0;
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerScale = viewerFitScale();
    syncViewerScale();
  }

  function rotateViewer(degrees) {
    state.viewerRotation = ((state.viewerRotation + degrees) % 360 + 360) % 360;
    state.viewerScale = 1;
    fitViewerWithinPanel();
  }

  function showViewerItemAt(index) {
    const items = state.manifest?.items || [];
    if (items.length === 0) return closeImageViewer();
    const safeIndex = Math.min(items.length - 1, Math.max(0, index));
    const item = items[safeIndex];
    state.viewerIndex = safeIndex;
    state.viewerItem = item;
    state.viewerScale = 1;
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerRotation = 0;
    refs.viewerImage.src = item.url;
    refs.viewerImage.alt = displayFilename(item);
    refs.viewerPreviousButton.disabled = safeIndex === 0;
    refs.viewerNextButton.disabled = safeIndex === items.length - 1;
    syncViewerScale();
  }

  function openImageViewer(item) {
    const items = state.manifest?.items || [];
    const index = items.findIndex((candidate) => candidate.id === item.id);
    setPanelFolded(false);
    refs.viewer.hidden = false;
    showViewerItemAt(index >= 0 ? index : 0);
    refs.viewerCloseButton.focus();
  }

  function closeImageViewer() {
    endViewerDrag();
    refs.viewer.hidden = true;
    refs.viewerImage.removeAttribute("src");
    refs.viewerImage.alt = "";
    state.viewerIndex = -1;
    state.viewerItem = null;
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerRotation = 0;
    state.viewerScale = 1;
    if (state.foldEnabled) setPanelFolded(true);
  }

  function syncActions() {
    const total = state.manifest?.items.length || 0;
    const selected = state.selectedIds.size;
    refs.groups.setAttribute("aria-busy", String(state.busy));
    refs.copyButton.disabled = state.busy || selected === 0;
    refs.copyImagesButton.disabled = state.busy || selected === 0;
    refs.downloadButton.disabled = state.busy || selected === 0;
    refs.collectButton.disabled = state.busy;
    refs.selectAllButton.disabled = total === 0;
    refs.invertButton.disabled = total === 0;
    refs.selectMainButton.disabled = !(state.manifest?.items || []).some((item) => item.category === "main");
    refs.selectDetailButton.disabled = !(state.manifest?.items || []).some((item) => item.category === "detail");
    refs.selectSkuButton.disabled = !(state.manifest?.items || []).some((item) => item.category === "sku");
    for (const button of shadow.querySelectorAll('[data-transfer-action="download"]')) button.disabled = state.busy;
    for (const button of shadow.querySelectorAll(".group-download-button")) {
      button.disabled = state.busy || selectedCategoryItems(button.dataset.category).length === 0;
    }
  }

  function syncSelectionUi() {
    for (const card of shadow.querySelectorAll(".image-card[data-item-id]")) {
      const selected = state.selectedIds.has(card.dataset.itemId);
      card.classList.toggle("is-selected", selected);
      const checkbox = card.querySelector(".image-card-media input[type=checkbox]");
      if (checkbox) checkbox.checked = selected;
    }
    for (const section of shadow.querySelectorAll(".group[data-category]")) {
      const category = section.dataset.category;
      const items = (state.manifest?.items || []).filter((item) => item.category === category);
      const selectedCount = items.filter((item) => state.selectedIds.has(item.id)).length;
      const groupSelectionCount = section.querySelector(".group-selection-count");
      const groupSelectAllCheckbox = section.querySelector(".group-select-all input[type=checkbox]");
      if (groupSelectionCount) groupSelectionCount.textContent = `已选 ${selectedCount} 张`;
      if (groupSelectAllCheckbox) {
        groupSelectAllCheckbox.checked = items.length > 0 && selectedCount === items.length;
        groupSelectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < items.length;
      }
    }
    syncActions();
  }

  function commitSelectionChange() {
    const scrollTop = refs.groups.scrollTop;
    syncSelectionUi();
    syncSelectionStatus();
    refs.groups.scrollTop = scrollTop;
  }

  function platformLabelFor(manifest) {
    const platform = String(manifest?.source?.platform || "").trim().toLowerCase();
    return PLATFORM_LABELS[platform] || "商品平台";
  }

  function panelProductTitleFor(manifest) {
    const title = String(manifest?.product?.title || "").trim();
    if (!title) return "等待采集当前商品";
    const platformLabel = platformLabelFor(manifest);
    const suffixes = [`——${platformLabel}`, `——“${platformLabel}”`, `——"${platformLabel}"`];
    for (const suffix of suffixes) {
      if (title.endsWith(suffix)) return title.slice(0, -suffix.length).trim() || title;
    }
    return title;
  }

  function render() {
    refs.groups.replaceChildren();
    refs.productTitle.textContent = panelProductTitleFor(state.manifest);
    refs.platformName.textContent = platformLabelFor(state.manifest);
    for (const category of ["main", "detail", "sku"]) {
      const items = (state.manifest?.items || []).filter((item) => item.category === category);
      if (items.length === 0) continue;
      const section = document.createElement("section");
      section.className = "group";
      section.dataset.category = category;
      const head = document.createElement("div");
      head.className = "group-head";
      const heading = document.createElement("h2");
      heading.textContent = `${CATEGORY_LABELS[category]}（${items.length}张）`;
      const variantCount = category === "sku" ? skuVariantCount(items) : 0;
      if (variantCount) heading.title = `SKU 图覆盖 ${variantCount} 个规格`;
      const selectedInGroup = items.filter((item) => state.selectedIds.has(item.id));
      const headActions = document.createElement("div");
      headActions.className = "group-head-actions";
      const groupSelectionCount = document.createElement("span");
      groupSelectionCount.className = "group-selection-count";
      groupSelectionCount.textContent = `已选 ${selectedInGroup.length} 张`;
      const groupSelectAll = document.createElement("label");
      groupSelectAll.className = "group-select-all";
      const groupSelectAllCheckbox = document.createElement("input");
      groupSelectAllCheckbox.type = "checkbox";
      groupSelectAllCheckbox.checked = selectedInGroup.length === items.length;
      groupSelectAllCheckbox.indeterminate = selectedInGroup.length > 0 && selectedInGroup.length < items.length;
      groupSelectAllCheckbox.setAttribute("aria-label", `全选${CATEGORY_LABELS[category]}`);
      groupSelectAllCheckbox.addEventListener("change", () => setCategorySelection(category, groupSelectAllCheckbox.checked));
      const groupSelectAllText = document.createElement("span");
      groupSelectAllText.textContent = "全选";
      groupSelectAll.append(groupSelectAllCheckbox, groupSelectAllText);
      const groupDownloadButton = document.createElement("button");
      groupDownloadButton.type = "button";
      groupDownloadButton.className = "group-download-button";
      groupDownloadButton.dataset.category = category;
      groupDownloadButton.append(createIcon("download"));
      groupDownloadButton.title = `下载已选${CATEGORY_LABELS[category]}`;
      groupDownloadButton.setAttribute("aria-label", `下载已选${CATEGORY_LABELS[category]}`);
      groupDownloadButton.disabled = state.busy || selectedInGroup.length === 0;
        groupDownloadButton.addEventListener("click", () => downloadItems(selectedCategoryItems(category)));
      headActions.append(groupSelectionCount, groupSelectAll, groupDownloadButton);
      head.append(heading, headActions);
      const grid = document.createElement("div");
      grid.className = "image-grid";
      for (const item of items) {
        const card = document.createElement("div");
        card.className = `image-card${state.selectedIds.has(item.id) ? " is-selected" : ""}`;
        card.dataset.itemId = item.id;
        const label = document.createElement("label");
        label.className = "image-card-media";
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
          commitSelectionChange();
        });
        const image = document.createElement("img");
        image.alt = filename;
        image.loading = "lazy";
        image.decoding = "async";
        image.fetchPriority = "low";
        image.addEventListener("error", () => image.classList.add("is-broken"));
        const meta = document.createElement("div");
        meta.className = "image-card-meta";
        const name = document.createElement("small");
        name.className = "image-card-name";
        name.textContent = cardLabelFor(item);
        name.title = filename;
        const resolution = document.createElement("span");
        resolution.className = "image-card-resolution";
        resolution.textContent = resolutionLabelFor(item);
        syncResolutionLabel(resolution, item);
        const cardTitle = variantTitle ? `${filename}：${variantTitle}` : filename;
        image.addEventListener("load", () => {
          if (image.naturalWidth > 0 && image.naturalHeight > 0 && state.manifest?.source?.platform !== "gigacloud") {
            item.width = image.naturalWidth;
            item.height = image.naturalHeight;
            syncResolutionLabel(resolution, item);
            label.title = `${cardTitle} · ${resolution.title}`;
          }
        });
        image.src = previewUrlFor(item);
        meta.append(name, resolution);
        label.title = `${cardTitle} · ${resolution.title}`;
        label.append(checkbox, image, meta);
        const actions = document.createElement("div");
        actions.className = "image-card-actions";
        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.append(createIcon("eye"));
        viewButton.title = `查看 ${filename}`;
        viewButton.setAttribute("aria-label", `查看 ${filename}`);
        viewButton.addEventListener("click", () => openImageViewer(item));
        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.dataset.transferAction = "download";
        downloadButton.disabled = state.busy;
        downloadButton.append(createIcon("download"));
        downloadButton.title = `下载 ${filename}`;
        downloadButton.setAttribute("aria-label", `下载 ${filename}`);
        downloadButton.addEventListener("click", () => downloadItems([item], { single: true }));
        actions.append(viewButton, downloadButton);
        if (item.category === "sku" && variantTitle) {
          card.classList.add("has-variant");
          const variant = document.createElement("div");
          variant.className = "image-card-variant";
          variant.textContent = variantTitle;
          variant.title = variantTitle;
          card.append(label, variant, actions);
        } else {
          card.append(label, actions);
        }
        grid.appendChild(card);
      }
      section.append(head, grid);
      refs.groups.appendChild(section);
    }
    syncSelectionUi();
    scheduleVariantRowFit();
  }

  async function collectCurrentPage() {
    if (!refs.viewer.hidden) closeImageViewer();
    state.busy = true;
    syncActions();
    setStatus("正在读取当前商品页...");
    try {
      const response = await sendMessage(MESSAGE_COLLECT, { pageUrl: location.href });
      if (panelDestroyed) return;
      state.manifest = response.manifest;
      state.selectedIds = new Set(response.manifest.items.map((item) => item.id));
      state.collectionNotice = String(response.notice || "");
      syncSelectionStatus();
    } catch (error) {
      if (panelDestroyed) return;
      state.manifest = null;
      state.selectedIds.clear();
      state.collectionNotice = "";
      setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      if (!panelDestroyed) render();
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
      if (panelDestroyed) return;
      await writeClipboard(response.text);
      const variantCount = skuVariantCount(items);
      setStatus(`已复制 ${response.count} 张商品图清单${variantCount ? `，SKU 共 ${variantCount} 个规格` : ""}，可到 Studio 导入。`, "success");
    } catch (error) {
      if (!panelDestroyed) setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      if (!panelDestroyed) syncActions();
    }
  }

  async function downloadItems(items, { single = false } = {}) {
    if (items.length === 0) return setStatus("请先选择要下载的商品图。", "error");
    state.busy = true;
    syncActions();
    try {
      const response = await sendMessage(MESSAGE_DOWNLOAD, {
        manifest: state.manifest,
        selectedIds: items.map((item) => item.id),
      });
      if (panelDestroyed) return;
      setStatus(
        single
          ? `已提交 ${displayFilename(items[0])} 到 ${response.folder}。`
          : `已提交 ${response.count} 张图片到 ${response.folder}，未生成 JSON 文件。`,
        "success",
      );
    } catch (error) {
      if (!panelDestroyed) setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      if (!panelDestroyed) syncActions();
    }
  }

  async function copyImagesSelection() {
    const items = selectedItems();
    if (items.length === 0) return setStatus("请先选择要复制的商品图。", "error");
    hideCopySuccessToast();
    state.busy = true;
    syncActions();
    setStatus(`正在准备 ${items.length} 张图片...`);
    try {
      const response = await sendMessage(MESSAGE_COPY_IMAGES, {
        manifest: state.manifest,
        selectedIds: items.map((item) => item.id),
      });
      if (panelDestroyed) return;
      setStatus(
        response.failedCount > 0
          ? `已复制 ${response.count} 张图片，${response.failedCount} 张失败，可直接粘贴到聊天软件。`
          : `已复制 ${response.count} 张图片，可直接粘贴到聊天软件。`,
        "success",
      );
      showCopySuccessToast(`已复制 ${response.count} 张图片`);
    } catch (error) {
      if (!panelDestroyed) setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.busy = false;
      if (!panelDestroyed) syncActions();
    }
  }

  async function downloadSelection() {
    return downloadItems(selectedItems());
  }

  function handleViewerWheel(event) {
    if (refs.viewer.hidden) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? VIEWER_SCALE_FACTOR : 1 / VIEWER_SCALE_FACTOR;
    setViewerScale(state.viewerScale * factor);
  }

  function clampViewerOffset(x, y) {
    const bounds = viewerOffsetBounds();
    return {
      x: Math.min(bounds.x, Math.max(-bounds.x, x)),
      y: Math.min(bounds.y, Math.max(-bounds.y, y)),
    };
  }

  function beginViewerDrag(event) {
    if (refs.viewer.hidden || state.viewerDrag || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    state.viewerDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: state.viewerOffsetX,
      originY: state.viewerOffsetY,
      moved: false,
    };
    refs.viewerImage.classList.add("is-dragging");
    window.addEventListener("pointermove", moveViewerDrag);
    window.addEventListener("pointerup", endViewerDrag);
    window.addEventListener("pointercancel", endViewerDrag);
    try {
      refs.viewerImage.setPointerCapture?.(event.pointerId);
    } catch {}
  }

  function moveViewerDrag(event) {
    const drag = state.viewerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) >= VIEWER_DRAG_THRESHOLD) drag.moved = true;
    const next = clampViewerOffset(drag.originX + deltaX, drag.originY + deltaY);
    state.viewerOffsetX = next.x;
    state.viewerOffsetY = next.y;
    syncViewerScale();
  }

  function endViewerDrag(event) {
    const drag = state.viewerDrag;
    if (!drag || (event && event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    state.viewerDrag = null;
    refs.viewerImage.classList.remove("is-dragging");
    window.removeEventListener("pointermove", moveViewerDrag);
    window.removeEventListener("pointerup", endViewerDrag);
    window.removeEventListener("pointercancel", endViewerDrag);
    if (refs.viewerImage.hasPointerCapture?.(drag.pointerId)) {
      try {
        refs.viewerImage.releasePointerCapture(drag.pointerId);
      } catch {}
    }
  }

  function handleViewerBackdropClick(event) {
    if (refs.viewer.hidden || event.target === refs.viewerImage || event.target.closest?.("button, .image-viewer-toolbar")) return;
    closeImageViewer();
  }

  function syncFoldRailIcon() {
    refs.foldRailButton.replaceChildren(createIcon(state.dock === "left" ? "chevron-right" : "chevron-left"));
  }

  function setPanelFolded(value) {
    const folded = Boolean(value && state.foldEnabled && state.dock && refs.viewer.hidden && !state.drag);
    state.folded = folded;
    refs.panel.dataset.folded = String(folded);
    refs.foldRailButton.title = state.dock === "left" ? "从左侧展开采集窗" : "从右侧展开采集窗";
    refs.foldRailButton.setAttribute("aria-label", refs.foldRailButton.title);
    syncFoldRailIcon();
    if (!folded) scheduleVariantRowFit();
  }

  function togglePanelFold() {
    state.foldEnabled = !state.foldEnabled;
    refs.foldToggleButton.textContent = state.foldEnabled ? "关闭折叠" : "开启折叠";
    refs.panel.dataset.foldEnabled = String(state.foldEnabled);
    if (!state.foldEnabled) return setPanelFolded(false);
    const rect = refs.panel.getBoundingClientRect();
    dockPanel(rect.left + rect.width / 2 <= window.innerWidth / 2 ? "left" : "right");
    setPanelFolded(true);
  }

  function expandFoldedPanel() {
    if (state.folded) setPanelFolded(false);
  }

  function collapseFoldedPanel() {
    if (state.foldEnabled && state.dock && !state.drag && refs.viewer.hidden) setPanelFolded(true);
  }

  function dockPanel(edge) {
    state.dock = edge;
    refs.panel.dataset.dock = edge;
    refs.panel.style.top = "0px";
    if (edge === "left") {
      refs.panel.style.left = "0px";
      refs.panel.style.right = "auto";
    } else {
      refs.panel.style.left = "auto";
      refs.panel.style.right = "0px";
    }
    syncFoldRailIcon();
  }

  function beginDrag(event) {
    if (state.drag || event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    setPanelFolded(false);
    const rect = refs.panel.getBoundingClientRect();
    state.dock = "";
    delete refs.panel.dataset.dock;
    refs.panel.dataset.dragging = "true";
    refs.panel.style.left = `${Math.round(rect.left)}px`;
    refs.panel.style.right = "auto";
    refs.panel.style.top = `${Math.round(rect.top)}px`;
    state.drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    window.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    try {
      refs.dragHandle.setPointerCapture?.(event.pointerId);
    } catch {}
  }

  function moveDrag(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    event.preventDefault();
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
    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    if (refs.dragHandle.hasPointerCapture?.(event.pointerId)) {
      try {
        refs.dragHandle.releasePointerCapture(event.pointerId);
      } catch {}
    }
    const rect = refs.panel.getBoundingClientRect();
    if (state.foldEnabled) {
      dockPanel(rect.left + rect.width / 2 <= window.innerWidth / 2 ? "left" : "right");
      setPanelFolded(true);
    } else if (rect.left <= DOCK_THRESHOLD) dockPanel("left");
    else if (window.innerWidth - rect.right <= DOCK_THRESHOLD) dockPanel("right");
  }

  function clampFloatingPanel() {
    if (state.dock) {
      dockPanel(state.dock);
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
    if (panelDestroyed) return;
    panelDestroyed = true;
    hideCopySuccessToast();
    endViewerDrag();
    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("resize", clampFloatingPanel);
    window.removeEventListener("resize", scheduleVariantRowFit);
    if (variantFitFrame) window.cancelAnimationFrame(variantFitFrame);
    host.removeEventListener(PANEL_NAVIGATED_EVENT, closePanel);
    host.remove();
    if (globalThis[CONTROLLER_KEY] === panelController) delete globalThis[CONTROLLER_KEY];
    document.dispatchEvent(new CustomEvent(PANEL_CLOSED_EVENT));
  }

  function setCategorySelection(category, selected) {
    for (const item of state.manifest?.items || []) {
      if (item.category !== category) continue;
      if (selected) state.selectedIds.add(item.id);
      else state.selectedIds.delete(item.id);
    }
    commitSelectionChange();
  }

  refs.collectButton.addEventListener("click", collectCurrentPage);
  refs.copyButton.addEventListener("click", copySelection);
  refs.copyImagesButton.addEventListener("click", copyImagesSelection);
  refs.downloadButton.addEventListener("click", downloadSelection);
  refs.selectAllButton.addEventListener("click", () => {
    state.selectedIds = new Set((state.manifest?.items || []).map((item) => item.id));
    commitSelectionChange();
  });
  refs.invertButton.addEventListener("click", () => {
    state.selectedIds = new Set((state.manifest?.items || []).filter((item) => !state.selectedIds.has(item.id)).map((item) => item.id));
    commitSelectionChange();
  });
  refs.selectMainButton.addEventListener("click", () => setCategorySelection("main", true));
  refs.selectDetailButton.addEventListener("click", () => setCategorySelection("detail", true));
  refs.selectSkuButton.addEventListener("click", () => setCategorySelection("sku", true));
  refs.viewerCloseButton.addEventListener("click", closeImageViewer);
  refs.viewerFitButton.addEventListener("click", (event) => runViewerCommand(event, fitViewerToPanel));
  refs.viewerPreviousButton.addEventListener("click", () => showViewerItemAt(state.viewerIndex - 1));
  refs.viewerNextButton.addEventListener("click", () => showViewerItemAt(state.viewerIndex + 1));
  refs.viewerRotateLeftButton.addEventListener("click", (event) => runViewerCommand(event, () => rotateViewer(-90)));
  refs.viewerRotateRightButton.addEventListener("click", (event) => runViewerCommand(event, () => rotateViewer(90)));
  refs.viewerZoomInButton.addEventListener("click", (event) => runViewerCommand(event, () => setViewerScale(state.viewerScale * VIEWER_SCALE_FACTOR)));
  refs.viewerZoomOutButton.addEventListener("click", (event) => runViewerCommand(event, () => setViewerScale(state.viewerScale / VIEWER_SCALE_FACTOR)));
  refs.viewerOriginalSizeButton.addEventListener("click", (event) => runViewerCommand(event, resetViewerView));
  refs.viewerStage.addEventListener("wheel", handleViewerWheel, { passive: false });
  refs.viewer.addEventListener("click", handleViewerBackdropClick);
  refs.viewerImage.addEventListener("load", resetViewerView);
  refs.viewerImage.addEventListener("dblclick", resetViewerView);
  refs.viewerImage.addEventListener("pointerdown", beginViewerDrag);
  refs.foldToggleButton.addEventListener("click", togglePanelFold);
  refs.foldRailButton.addEventListener("click", expandFoldedPanel);
  refs.closeButton.addEventListener("click", closePanel);
  refs.dragHandle.addEventListener("pointerdown", beginDrag);
  refs.panel.addEventListener("pointerenter", expandFoldedPanel);
  refs.panel.addEventListener("pointerleave", collapseFoldedPanel);
  host.addEventListener("keydown", (event) => {
    if (refs.viewer.hidden) return;
    if (event.key === "Escape") closeImageViewer();
    else if (event.key === "ArrowLeft") showViewerItemAt(state.viewerIndex - 1);
    else if (event.key === "ArrowRight") showViewerItemAt(state.viewerIndex + 1);
    else return;
    event.preventDefault();
  });
  host.addEventListener(REVEAL_EVENT, () => {
    host.dataset.panelHidden = "false";
    setPanelFolded(false);
    clampFloatingPanel();
  });
  host.addEventListener(PANEL_NAVIGATED_EVENT, closePanel);
  window.addEventListener("resize", clampFloatingPanel);
  window.addEventListener("resize", scheduleVariantRowFit);

  panelController = {
    version: PANEL_VERSION,
    reveal() {
      if (panelDestroyed) return;
      host.dispatchEvent(new CustomEvent(REVEAL_EVENT));
      document.dispatchEvent(new CustomEvent(PANEL_OPENED_EVENT));
    },
    destroy: closePanel,
  };
  globalThis[CONTROLLER_KEY] = panelController;
  document.dispatchEvent(new CustomEvent(PANEL_OPENED_EVENT));
  render();
  collectCurrentPage();
})();
