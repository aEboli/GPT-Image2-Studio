(() => {
  const HOST_ID = "gpt-image2-studio-product-image-launcher";
  const PANEL_HOST_ID = "gpt-image2-studio-product-image-collector";
  const CONTROLLER_KEY = "__gptImage2StudioProductImageLauncherController";
  const LAUNCHER_VERSION = "1.1.23";
  const MESSAGE_OPEN = "product-image-collector:open";
  const PANEL_OPENED_EVENT = "gpt-image2-studio-product-image-collector:panel-opened";
  const PANEL_CLOSED_EVENT = "gpt-image2-studio-product-image-collector:panel-closed";
  const PANEL_NAVIGATED_EVENT = "gpt-image2-studio-product-image-collector:page-navigated";
  const OPEN_TIMEOUT_MS = 8000;
  const LOCATION_POLL_MS = 750;
  const AMAZON_HOSTS = [
    "amazon.com", "amazon.ca", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
    "amazon.es", "amazon.co.jp", "amazon.com.au", "amazon.com.mx", "amazon.in"
  ];

  function isHostOrSubdomain(hostname, suffix) {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  function isSupportedProductPage(value) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol !== "https:") return false;
      if (isHostOrSubdomain(url.hostname, "1688.com")) {
        return /^\/offer\/[^/.]+(?:\.html)?\/?$/i.test(url.pathname);
      }
      if (AMAZON_HOSTS.some((host) => isHostOrSubdomain(url.hostname, host))) {
        return /\/(?:dp|gp\/product|gp\/aw\/d)\/[a-z0-9]{10}(?:[/?]|$)/i.test(url.pathname);
      }
      if (isHostOrSubdomain(url.hostname, "temu.com")) {
        return /-g-\d+\.html\/?$/i.test(url.pathname) ||
          (url.pathname.toLowerCase().endsWith("/goods.html") && /^\d+$/.test(url.searchParams.get("goods_id") || ""));
      }
      if (url.hostname === "www.tiktok.com") {
        return /^\/shop\/pdp\/(?:[^/]+\/)?\d+\/?$/i.test(url.pathname);
      }
      if (url.hostname === "shop.tiktok.com") {
        return /^\/[a-z]{2}(?:-[a-z]{2})?\/pdp\/(?:[^/]+\/)?\d+\/?$/i.test(url.pathname);
      }
      if (isHostOrSubdomain(url.hostname, "shein.com")) {
        return /-p-\d+\.html\/?$/i.test(url.pathname);
      }
      if (isHostOrSubdomain(url.hostname, "gigab2b.com")) {
        return url.pathname === "/index.php" && url.searchParams.get("route") === "product/product" &&
          /^[a-z0-9_-]{1,120}$/i.test(url.searchParams.get("product_id") || "");
      }
      return false;
    } catch {
      return false;
    }
  }

  const previousController = globalThis[CONTROLLER_KEY];
  if (previousController?.version === LAUNCHER_VERSION && typeof previousController.refresh === "function") {
    try {
      previousController.refresh();
      return;
    } catch {}
  }
  if (previousController?.destroy) previousController.destroy();
  document.getElementById(HOST_ID)?.remove();

  let host = null;
  let button = null;
  let status = null;
  let pendingTimeoutId = 0;
  let currentHref = location.href;

  function isPanelVisible() {
    const panelHost = document.getElementById(PANEL_HOST_ID);
    return Boolean(panelHost && panelHost.dataset.panelHidden !== "true");
  }

  function setPanelOpen(open) {
    if (host) host.dataset.panelOpen = String(Boolean(open));
  }

  function setLauncherMessage(message = "") {
    if (!button || !status) return;
    const text = String(message || "");
    button.title = text || "打开商品图采集";
    button.setAttribute("aria-label", text || "打开商品图采集");
    status.textContent = text;
    status.hidden = !text;
  }

  function requestPanelOpen() {
    if (!button || button.disabled) return;
    button.disabled = true;
    setLauncherMessage();
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish(new Error("商品图采集打开超时，请重试。"));
    }, OPEN_TIMEOUT_MS);
    pendingTimeoutId = timeoutId;

    function finish(error, response) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (pendingTimeoutId === timeoutId) pendingTimeoutId = 0;
      if (!button) return;
      button.disabled = false;
      if (error || !response?.ok) {
        setLauncherMessage(error?.message || response?.message || "商品图采集打开失败，请重试。");
        return;
      }
      setLauncherMessage();
      setPanelOpen(true);
    }

    try {
      chrome.runtime.sendMessage({ type: MESSAGE_OPEN, pageUrl: location.href }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        finish(runtimeError ? new Error(runtimeError.message) : null, response);
      });
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error || "商品图采集打开失败，请重试。")));
    }
  }

  function mountLauncher() {
    if (host?.isConnected) {
      setPanelOpen(isPanelVisible());
      return;
    }
    if (host) removeLauncher();
    document.getElementById(HOST_ID)?.remove();
    host = document.createElement("div");
    host.id = HOST_ID;
    host.dataset.launcherVersion = LAUNCHER_VERSION;
    host.dataset.panelOpen = String(isPanelVisible());
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          top: 52%;
          right: 12px;
          z-index: 2147483646;
          display: block;
          color-scheme: light;
          font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
          transform: translateY(-50%);
        }
        :host([data-panel-open="true"]) { display: none; }
        button {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid #c94620;
          border-radius: 8px 0 0 8px;
          background: #e9542a;
          color: #fff;
          box-shadow: 0 8px 24px rgba(30, 41, 59, 0.24);
          cursor: pointer;
          font: 800 15px/1 "Segoe UI", sans-serif;
          letter-spacing: 0;
        }
        button:hover { background: #d94b22; }
        button:focus-visible { outline: 3px solid rgba(23, 105, 170, 0.38); outline-offset: 2px; }
        button:disabled { cursor: wait; opacity: 0.68; }
        .mark { display: grid; gap: 2px; place-items: center; }
        .mark strong { font-size: 15px; letter-spacing: 0; }
        .mark small { font-size: 9px; font-weight: 700; letter-spacing: 0; }
        output {
          position: absolute;
          top: calc(100% + 7px);
          right: 0;
          width: 190px;
          padding: 7px 9px;
          border: 1px solid #efb3a2;
          border-radius: 6px;
          background: rgba(255, 250, 248, 0.96);
          color: #a92f12;
          box-shadow: 0 6px 18px rgba(30, 41, 59, 0.16);
          font: 600 11px/1.45 "Microsoft YaHei UI", "Segoe UI", sans-serif;
          letter-spacing: 0;
        }
        output[hidden] { display: none; }
      </style>
      <button id="launcherButton" type="button" title="打开商品图采集" aria-label="打开商品图采集">
        <span class="mark" aria-hidden="true"><strong>G2</strong><small>商品图</small></span>
      </button>
      <output id="launcherStatus" role="status" aria-live="polite" hidden></output>
    `;
    button = shadow.querySelector("#launcherButton");
    status = shadow.querySelector("#launcherStatus");
    button.addEventListener("click", requestPanelOpen);
  }

  function removeLauncher() {
    if (pendingTimeoutId) window.clearTimeout(pendingTimeoutId);
    pendingTimeoutId = 0;
    host?.remove();
    host = null;
    button = null;
    status = null;
  }

  function syncLauncher() {
    if (isSupportedProductPage(location.href)) mountLauncher();
    else removeLauncher();
  }

  function closePanelForNavigation() {
    const panelHost = document.getElementById(PANEL_HOST_ID);
    if (!panelHost) return;
    panelHost.dispatchEvent(new CustomEvent(PANEL_NAVIGATED_EVENT));
    if (panelHost.isConnected) {
      panelHost.remove();
      document.dispatchEvent(new CustomEvent(PANEL_CLOSED_EVENT));
    }
  }

  function syncLocation() {
    if (currentHref === location.href) return;
    currentHref = location.href;
    closePanelForNavigation();
    syncLauncher();
  }

  const onPanelOpened = () => setPanelOpen(true);
  const onPanelClosed = () => setPanelOpen(false);
  document.addEventListener(PANEL_OPENED_EVENT, onPanelOpened);
  document.addEventListener(PANEL_CLOSED_EVENT, onPanelClosed);
  const locationTimer = window.setInterval(syncLocation, LOCATION_POLL_MS);
  const controller = {
    version: LAUNCHER_VERSION,
    refresh: syncLauncher,
    destroy() {
      window.clearInterval(locationTimer);
      document.removeEventListener(PANEL_OPENED_EVENT, onPanelOpened);
      document.removeEventListener(PANEL_CLOSED_EVENT, onPanelClosed);
      removeLauncher();
      if (globalThis[CONTROLLER_KEY] === controller) delete globalThis[CONTROLLER_KEY];
    },
  };
  globalThis[CONTROLLER_KEY] = controller;
  syncLauncher();
})();
