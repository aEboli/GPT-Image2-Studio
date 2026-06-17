export const VIEW_MODULE_URLS = Object.freeze({
  "style-transfer": "/lib/views/style-transfer-view.mjs",
  "reference-analysis": "/lib/views/reference-analysis-view.mjs",
  "image-decomposition": "/lib/views/image-decomposition-view.mjs",
  "quick-blend": "/lib/views/quick-blend-view.mjs?v=20260608-quick-blend-time-sort-1",
  "image-edit": "/lib/views/image-edit-view.mjs",
  "image-compress": "/lib/views/image-compress-view.mjs",
  "article-illustration": "/lib/views/article-illustration-view.mjs",
  "creation": "/lib/views/creation-view.mjs",
  ppt: "/lib/views/ppt-view.mjs",
  gallery: "/lib/views/gallery-view.mjs",
  "article-record": "/lib/views/article-record-view.mjs",
  "creation-record": "/lib/views/creation-record-view.mjs",
  portrait: "/lib/views/portrait-view.mjs",
  "portrait-record": "/lib/views/portrait-record-view.mjs",
  "ppt-record": "/lib/views/ppt-record-view.mjs",
});

const loadedViewModules = new Map();
const mountedViewModules = new Map();

export function getLazyViewModuleUrl(view) {
  return VIEW_MODULE_URLS[String(view || "").trim()] || "";
}

export function getLoadedLazyViewIds() {
  return [...loadedViewModules.keys()];
}

export function getMountedLazyViewModule(view) {
  const normalizedView = String(view || "").trim();
  return mountedViewModules.get(normalizedView) || null;
}

function normalizeLoaderOptions(options = {}) {
  if (typeof options === "function") {
    return { importer: options, context: {} };
  }

  return {
    importer: typeof options.importer === "function" ? options.importer : (url) => import(url),
    context: options.context && typeof options.context === "object" ? options.context : {},
  };
}

function mountLazyViewModule(viewModule, { view, context }) {
  const controller =
    typeof viewModule.mountView === "function"
      ? viewModule.mountView({ view, ...context })
      : { view, loaded: true };
  mountedViewModules.set(view, controller);
  return controller;
}

export async function ensureLazyViewModule(view, options = {}) {
  const normalizedView = String(view || "").trim();
  const moduleUrl = getLazyViewModuleUrl(normalizedView);
  if (!moduleUrl) {
    return { view: normalizedView, loaded: false };
  }

  if (!loadedViewModules.has(normalizedView)) {
    const { importer, context } = normalizeLoaderOptions(options);
    const promise = importer(moduleUrl).then((viewModule) =>
      mountLazyViewModule(viewModule, { view: normalizedView, context }),
    );
    loadedViewModules.set(normalizedView, promise);
  }

  return loadedViewModules.get(normalizedView);
}
