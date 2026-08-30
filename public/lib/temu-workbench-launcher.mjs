// Temu 上品工作台覆盖层的宿主侧控制器。
//
// 承载方式是同源 iframe 覆盖层，不是弹窗、不是整页跳转、也不是模态 dialog：
// - 桌面外壳对一切 window.open 返回 deny，回环 http 又过不了外链协议检查，
//   所以弹窗在浏览器里能用、在打包版里静默失效。
// - 整页跳转会替换唯一的 BrowserWindow，丢掉已加载的记录与在跑的生成任务。
// - 模态 dialog 有 min(1600px, 96vw) 之类的宽高上限，子文档自带的图片灯箱按
//   100vw/100dvh 铺满视口，装进受限容器后「全屏看图」在结构上不成立。
//
// 覆盖层因此是 position: fixed; inset: 0，且不置于既有导出表单内部
//（否则一次误触回车即触发批量导出的 submit）。

export const TEMU_WORKBENCH_FRAME_SRC = "/temu/";

export const TEMU_WORKBENCH_MESSAGES = Object.freeze({
  init: "temu-workbench:init",
  theme: "temu-workbench:theme",
  requestClose: "temu-workbench:request-close",
});

function getLauncherDomRefs(documentRef) {
  return {
    batchTab: documentRef.querySelector("#temuWorkbenchTabBatch"),
    closeButton: documentRef.querySelector("#temuWorkbenchCloseButton"),
    frame: documentRef.querySelector("#temuWorkbenchFrame"),
    layer: documentRef.querySelector("#temuWorkbenchLayer"),
    workbenchTab: documentRef.querySelector("#temuWorkbenchTabWorkbench"),
  };
}

export function createTemuWorkbenchLauncher({
  documentRef = document,
  windowRef = window,
  // 覆盖层第二个标签的去向：既有的批量快速导出对话框。
  openExportDialog = null,
  // 主题与语言取值函数，供 init 与后续 theme 消息使用。
  getTheme = () => documentRef.documentElement?.dataset?.theme || "",
  getLanguage = () => documentRef.documentElement?.lang || "",
  // 关闭覆盖层后焦点归还处。
  getFocusTarget = () => documentRef.querySelector("#creationRecordExportTemuButton"),
} = {}) {
  const refs = getLauncherDomRefs(documentRef);
  // 首次打开才赋 src。后续只切 hidden，使草稿、滚动位置与未上传的
  // blob: 预览在重新打开后仍在。
  let frameLoaded = false;
  let pendingInit = null;
  let activeTab = "workbench";

  function isOpen() {
    return Boolean(refs.layer) && refs.layer.hidden === false;
  }

  function postToFrame(message) {
    const frameWindow = refs.frame?.contentWindow;
    if (!frameWindow) return false;
    // targetOrigin 固定为自身来源：子文档同源，且不允许消息发往别处。
    frameWindow.postMessage(message, windowRef.location.origin);
    return true;
  }

  function sendInit(setIds) {
    const message = {
      type: TEMU_WORKBENCH_MESSAGES.init,
      setIds: Array.isArray(setIds) ? [...setIds] : [],
      theme: getTheme(),
      lang: getLanguage(),
    };
    if (frameLoaded) {
      postToFrame(message);
      return;
    }
    // frame 尚未 load，先存下来，load 事件到达后再发。
    pendingInit = message;
  }

  function syncTabs() {
    const isWorkbench = activeTab === "workbench";
    if (refs.workbenchTab) refs.workbenchTab.setAttribute("aria-selected", String(isWorkbench));
    if (refs.batchTab) refs.batchTab.setAttribute("aria-selected", String(!isWorkbench));
  }

  function selectWorkbenchTab() {
    activeTab = "workbench";
    syncTabs();
  }

  function selectBatchTab() {
    activeTab = "batch";
    syncTabs();
    // 原生 dialog 进 top layer，天然盖在 position: fixed 覆盖层之上，
    // 不需要 z-index 博弈。
    openExportDialog?.();
  }

  function open(setIds = []) {
    if (!refs.layer) return;
    refs.layer.hidden = false;
    selectWorkbenchTab();

    if (!frameLoaded && refs.frame && !refs.frame.getAttribute("src")) {
      refs.frame.setAttribute("src", TEMU_WORKBENCH_FRAME_SRC);
    }
    sendInit(setIds);
    refs.frame?.focus?.();
  }

  function close() {
    if (!refs.layer || refs.layer.hidden) return;
    // 只隐藏，不卸载 frame：卸载会丢掉编辑中的草稿与本地预览。
    refs.layer.hidden = true;
    activeTab = "workbench";
    syncTabs();
    getFocusTarget()?.focus?.();
  }

  function syncTheme() {
    if (!isOpen()) return;
    postToFrame({ type: TEMU_WORKBENCH_MESSAGES.theme, theme: getTheme() });
  }

  function handleFrameLoad() {
    frameLoaded = true;
    if (!pendingInit) return;
    postToFrame(pendingInit);
    pendingInit = null;
  }

  function handleMessage(event) {
    // 同源校验：非自身来源的消息一律忽略，不改变任何状态。
    if (event.origin !== windowRef.location.origin) return;
    if (event.source && refs.frame && event.source !== refs.frame.contentWindow) return;
    if (event.data?.type === TEMU_WORKBENCH_MESSAGES.requestClose) close();
  }

  function bind() {
    refs.frame?.addEventListener("load", handleFrameLoad);
    refs.closeButton?.addEventListener("click", close);
    refs.workbenchTab?.addEventListener("click", selectWorkbenchTab);
    refs.batchTab?.addEventListener("click", selectBatchTab);
    windowRef.addEventListener("message", handleMessage);
    // 焦点在标签栏（而非 frame 内）时的 Escape 由宿主自己处理。
    refs.layer?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    });
  }

  bind();

  return { close, handleMessage, isOpen, open, selectBatchTab, selectWorkbenchTab, syncTheme };
}
