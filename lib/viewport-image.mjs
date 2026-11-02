// 只给视口附近的列表图片设置 src；离屏后解除图片资源引用，保留轻量地址以便恢复。
export function createViewportImageController({
  documentRef = globalThis.document,
  IntersectionObserverRef = globalThis.IntersectionObserver,
  MutationObserverRef = globalThis.MutationObserver,
} = {}) {
  const images = new Map();
  const unload = (image) => image.removeAttribute("src");
  const show = (image, state) => {
    if (state.visible && !documentRef?.hidden && image.isConnected !== false) image.src = state.source;
    else unload(image);
  };
  const observer = typeof IntersectionObserverRef === "function"
    ? new IntersectionObserverRef((entries) => {
      for (const entry of entries) {
        const state = images.get(entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        show(entry.target, state);
      }
    }, { rootMargin: "160px 0px", threshold: 0 })
    : null;

  const release = (image) => {
    observer?.unobserve(image);
    images.delete(image);
    unload(image);
  };
  // 切换套图、分页和重渲染都会移除节点；观察器不能继续持有这些节点。
  const mutations = typeof MutationObserverRef === "function" && documentRef?.documentElement
    ? new MutationObserverRef((records) => {
      if (!records.some((record) => record.removedNodes.length)) return;
      for (const image of images.keys()) {
        if (!image.isConnected) release(image);
      }
    })
    : null;
  mutations?.observe(documentRef.documentElement, { childList: true, subtree: true });

  const onVisibilityChange = () => {
    for (const [image, state] of images) {
      state.visible = !observer;
      unload(image);
      if (!documentRef.hidden) {
        if (observer) {
          observer.unobserve(image);
          observer.observe(image);
        } else show(image, state);
      }
    }
  };
  documentRef?.addEventListener("visibilitychange", onVisibilityChange);

  return {
    setSource(image, source) {
      const value = String(source || "").trim();
      if (!value) return release(image);
      image.decoding = "async";
      image.loading = observer ? "eager" : "lazy";
      const state = images.get(image);
      if (state) {
        if (state.source === value) return;
        state.source = value;
        show(image, state);
      } else {
        const next = { source: value, visible: !observer };
        images.set(image, next);
        if (observer) {
          unload(image);
          observer.observe(image);
        } else show(image, next);
      }
    },
    dispose() {
      mutations?.disconnect();
      observer?.disconnect();
      documentRef?.removeEventListener("visibilitychange", onVisibilityChange);
      for (const image of images.keys()) unload(image);
      images.clear();
    },
  };
}

let sharedController;

export function setViewportImageSource(image, source) {
  sharedController ||= createViewportImageController();
  sharedController.setSource(image, source);
}
