export const API_RUNTIME_STATUS = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
});

export const API_UNSUPPORTED_RUNTIME_CAPABILITY_CODE = "unsupported_runtime_capability";

export const API_RUNTIME_CAPABILITIES = Object.freeze([
  {
    method: "GET",
    path: "/api/config",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/config",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare keeps private API settings in the browser and only returns public config.",
  },
  {
    method: "POST",
    path: "/api/models",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Lists models from the configured OpenAI-compatible endpoint using private browser or local API settings.",
  },
  {
    method: "GET",
    path: "/api/gallery",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare returns an empty server gallery; browser cache remains authoritative there.",
  },
  {
    method: "GET",
    path: "/api/generation/tasks",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "GET",
    path: "/api/prompt-agent/history",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare returns an empty server-side history.",
  },
  {
    method: "POST",
    path: "/api/prompt-agent/analyze",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/generate",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/creation/generate",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/creation/reference/analyze",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/creation/plan",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/portrait/reference/analyze",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/portrait/plan",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/portrait/generate",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "GET",
    path: "/api/portrait/sets",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare returns an empty server-side portrait set list.",
  },
  {
    method: "POST",
    path: "/api/portrait/sets/open-folder",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Cloudflare cannot open a local filesystem directory.",
  },
  {
    method: "POST",
    path: "/api/portrait/sets/paths",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Cloudflare cannot expose local filesystem paths.",
  },
  {
    method: "POST",
    path: "/api/portrait/repair",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Portrait repair depends on local portrait set manifests and local output files.",
  },
  {
    method: "POST",
    path: "/api/creation/logo-batch",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "GET",
    path: "/api/creation/sets",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare returns an empty server-side set list.",
  },
  {
    method: "POST",
    path: "/api/creation/sets/open-folder",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Cloudflare cannot open a local filesystem directory.",
  },
  {
    method: "POST",
    path: "/api/creation/sets/paths",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Cloudflare cannot expose local filesystem paths.",
  },
  {
    method: "POST",
    path: "/api/creation/repair",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Creation repair depends on local set manifests and local output files.",
  },
  {
    method: "POST",
    path: "/api/output/open",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.UNSUPPORTED,
    reason: "Cloudflare cannot open a local filesystem directory.",
  },
  {
    method: "POST",
    path: "/api/output/delete",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare treats server deletion as a no-op because browser cache owns generated files.",
  },
  {
    method: "POST",
    path: "/api/gallery/metadata",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare returns a no-op metadata repair response.",
  },
  {
    method: "GET",
    path: "/api/ppt/decks",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Cloudflare returns an empty server-side deck list.",
  },
  {
    method: "POST",
    path: "/api/ppt/analyze",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/ppt/generate",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/ppt/complete",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "POST",
    path: "/api/ppt/slide/edit",
    local: API_RUNTIME_STATUS.SUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
  },
  {
    method: "GET",
    path: "/api/images/*",
    local: API_RUNTIME_STATUS.UNSUPPORTED,
    cloudflare: API_RUNTIME_STATUS.SUPPORTED,
    reason: "Only Cloudflare exposes temporary R2 image proxy URLs.",
  },
]);

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
  const normalizedRuntime = normalizeRuntime(runtime);
  const normalizedMethod = normalizeMethod(method);
  const normalizedPath = normalizePath(pathname);
  if (!["local", "cloudflare"].includes(normalizedRuntime)) {
    return null;
  }

  return (
    API_RUNTIME_CAPABILITIES.find((route) => routeMatches(route, normalizedMethod, normalizedPath)) ||
    null
  );
}

export function isApiRouteSupported(runtime, method, pathname) {
  const capability = getApiRouteCapability(runtime, method, pathname);
  return capability?.[normalizeRuntime(runtime)] === API_RUNTIME_STATUS.SUPPORTED;
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
    message: message || capability?.reason || "This API is not supported by the selected runtime.",
    reason: capability?.reason || "",
  };
}
