(() => {
  const HOST_ID = "gpt-image2-studio-product-image-launcher";
  const PANEL_HOST_ID = "gpt-image2-studio-product-image-collector";
  const LAUNCHER_VERSION = "1.0.3";
  const MESSAGE_OPEN = "product-image-collector:open";
  const PANEL_OPENED_EVENT = "gpt-image2-studio-product-image-collector:panel-opened";
  const PANEL_CLOSED_EVENT = "gpt-image2-studio-product-image-collector:panel-closed";

  const existing = document.getElementById(HOST_ID);
  if (existing?.dataset.launcherVersion === LAUNCHER_VERSION) {
    existing.dataset.panelOpen = String(Boolean(document.getElementById(PANEL_HOST_ID)));
    return;
  }
  existing?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.launcherVersion = LAUNCHER_VERSION;
  host.dataset.panelOpen = String(Boolean(document.getElementById(PANEL_HOST_ID)));
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
