export function createViewRendererController({ view, rendererKey, renderers = {} } = {}) {
  const normalizedView = String(view || rendererKey || "").trim();
  const normalizedRendererKey = String(rendererKey || normalizedView).trim();
  const mountedRenderers = renderers && typeof renderers === "object" ? renderers : {};

  return {
    view: normalizedView,
    loaded: true,
    rendererKey: normalizedRendererKey,
    renderView(context = {}) {
      const contextRenderers = context.renderers && typeof context.renderers === "object" ? context.renderers : {};
      const renderer = contextRenderers[normalizedRendererKey] || mountedRenderers[normalizedRendererKey];
      if (typeof renderer !== "function") {
        return false;
      }

      renderer();
      return true;
    },
  };
}
