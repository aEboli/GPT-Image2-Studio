(() => {
  const HOST_ID = "gpt-image2-studio-product-image-launcher";
  const PANEL_HOST_ID = "gpt-image2-studio-product-image-collector";
  const LAUNCHER_VERSION = "1.1.17";
  const MESSAGE_OPEN = "product-image-collector:open";
  const PANEL_OPENED_EVENT = "gpt-image2-studio-product-image-collector:panel-opened";
  const PANEL_CLOSED_EVENT = "gpt-image2-studio-product-image-collector:panel-closed";
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

  if (!isSupportedProductPage(location.href)) return;

  function isPanelVisible() {
    const panelHost = document.getElementById(PANEL_HOST_ID);
    return Boolean(panelHost && panelHost.dataset.panelHidden !== "true");
  }

  const existing = document.getElementById(HOST_ID);
  if (existing?.dataset.launcherVersion === LAUNCHER_VERSION) {
    existing.dataset.panelOpen = String(isPanelVisible());
    return;
  }
  existing?.remove();

  const host = document.createElement("div");
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
    </style>
    <button id="launcherButton" type="button" title="打开商品图采集" aria-label="打开商品图采集">
      <span class="mark" aria-hidden="true"><strong>G2</strong><small>商品图</small></span>
    </button>
  `;

  const button = shadow.querySelector("#launcherButton");
  function setPanelOpen(open) {
    host.dataset.panelOpen = String(Boolean(open));
  }

  document.addEventListener(PANEL_OPENED_EVENT, () => setPanelOpen(true));
  document.addEventListener(PANEL_CLOSED_EVENT, () => setPanelOpen(false));
  button.addEventListener("click", () => {
    button.disabled = true;
    chrome.runtime.sendMessage({ type: MESSAGE_OPEN, pageUrl: location.href }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      button.disabled = false;
      if (runtimeError || !response?.ok) {
        const message = runtimeError?.message || response?.message || "商品图采集打开失败";
        button.title = message;
        button.setAttribute("aria-label", message);
        return;
      }
      button.title = "打开商品图采集";
      button.setAttribute("aria-label", "打开商品图采集");
      setPanelOpen(true);
    });
  });
})();
