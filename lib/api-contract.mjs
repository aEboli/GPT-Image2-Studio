export const API_RUNTIME_STATUS = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
});

export const API_UNSUPPORTED_RUNTIME_CAPABILITY_CODE = "unsupported_runtime_capability";

const LOCAL = API_RUNTIME_STATUS.SUPPORTED;

export const API_RUNTIME_CAPABILITIES = Object.freeze([
  ["GET", "/api/config"],
  ["POST", "/api/config"],
  ["POST", "/api/models"],
  ["GET", "/api/gallery"],
  ["GET", "/api/generation/tasks"],
  ["GET", "/api/prompt-agent/history"],
  ["POST", "/api/prompt-agent/analyze"],
  ["POST", "/api/generate"],
  ["POST", "/api/creation/generate"],
  ["POST", "/api/creation/reference/analyze"],
  ["POST", "/api/product-image-collector/image"],
  ["GET", "/api/product-image-collector/image"],
  ["GET", "/api/product-image-collector/package"],
  ["POST", "/api/creation/plan"],
  ["POST", "/api/portrait/reference/analyze"],
  ["POST", "/api/portrait/plan"],
  ["POST", "/api/portrait/generate"],
  ["GET", "/api/portrait/sets"],
  ["POST", "/api/portrait/sets/delete"],
  ["POST", "/api/portrait/sets/open-folder"],
  ["POST", "/api/portrait/sets/paths"],
  ["POST", "/api/portrait/repair"],
  ["GET", "/api/article-illustration/sets"],
  ["POST", "/api/article-illustration/sets/delete"],
  ["POST", "/api/article-illustration/plan"],
  ["POST", "/api/article-illustration/generate-references"],
  ["POST", "/api/article-illustration/generate"],
  ["POST", "/api/creation/logo-batch"],
  ["GET", "/api/creation/sets"],
  ["POST", "/api/creation/sets/delete"],
  ["POST", "/api/creation/sets/export-temu-excel"],
  ["POST", "/api/creation/sets/export-temu-excel/preflight"],
  ["POST", "/api/creation/sets/open-folder"],
  ["POST", "/api/creation/sets/paths"],
  ["POST", "/api/creation/repair"],
  ["POST", "/api/output/open"],
  ["POST", "/api/output/delete"],
  ["POST", "/api/gallery/metadata"],
  ["GET", "/api/ppt/decks"],
  ["POST", "/api/ppt/decks/delete"],
  ["POST", "/api/ppt/analyze"],
  ["POST", "/api/ppt/generate"],
  ["POST", "/api/ppt/complete"],
  ["POST", "/api/ppt/slide/edit"],
].map(([method, path]) => ({ method, path, local: LOCAL })));

function normalizeRuntime(runtime) {
  return String(runtime || "").trim().toLowerCase();
}

function normalizeMethod(method) {
  return String(method || "").trim().toUpperCase();
}

function normalizePath(pathname) {
  return String(pathname || "").trim() || "/";
}

function routeMatches(route, method, pathname) {
  if (route.method !== method) {
    return false;
  }
  if (route.path.endsWith("*")) {
    return pathname.startsWith(route.path.slice(0, -1));
  }
  return route.path === pathname;
}

export function getApiRouteCapability(runtime, method, pathname) {
  if (normalizeRuntime(runtime) !== "local") {
    return null;
  }

  const normalizedMethod = normalizeMethod(method);
  const normalizedPath = normalizePath(pathname);
  return API_RUNTIME_CAPABILITIES.find((route) => routeMatches(route, normalizedMethod, normalizedPath)) || null;
}

export function isApiRouteSupported(runtime, method, pathname) {
  return Boolean(getApiRouteCapability(runtime, method, pathname));
}

export function buildUnsupportedRuntimeCapabilityPayload(runtime, method, pathname, message = "") {
  const normalizedRuntime = normalizeRuntime(runtime);
  const capability = getApiRouteCapability(normalizedRuntime, method, pathname);
  return {
    ok: false,
    code: API_UNSUPPORTED_RUNTIME_CAPABILITY_CODE,
    runtime: normalizedRuntime,
    method: capability?.method || normalizeMethod(method),
    path: capability?.path || normalizePath(pathname),
    message: message || "This API is not supported by the selected runtime.",
    reason: "",
  };
}
