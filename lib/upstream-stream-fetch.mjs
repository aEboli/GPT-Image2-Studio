// Node's fetch is undici, whose bodyTimeout defaults to 300s measured BETWEEN body
// chunks -- not for the whole response. Image providers routinely announce
// `image_generation_call.completed` and then go silent for minutes before the
// ~1.5 MB image arrives on a single line. Measured against a live proxy, that gap
// was 464s, so the socket died at 300s with `terminated` / UND_ERR_BODY_TIMEOUT
// long before the image showed up. Callers then saw an interrupted stream and
// burned the whole recovery-and-retry ladder on a task that was still fine.
//
// The app already bounds these requests itself (CREATION_UPSTREAM_TIMEOUT_MS plus a
// per-request AbortSignal), so undici's shorter default only pre-empts our own
// deadline. Raise it past ours and let the app's abort be the single authority.
//
// undici is not a production dependency here (it only reaches node_modules through
// electron-builder, and Vercel installs with --omit=dev), so importing it directly
// would break the deployed build. Node keeps its built-in copy's dispatcher on a
// versioned global symbol; the Agent constructor is reachable through that instance.
// The symbol is an implementation detail, so every step degrades to plain fetch.

import { CREATION_UPSTREAM_TIMEOUT_MS } from "./studio-constants.mjs";

export const CREATION_UPSTREAM_TIMEOUT_CEILING_MS = 60 * 60 * 1000;

// server.mjs lets an operator raise the creation deadline via this variable, so the
// compile-time default is the wrong basis for our ceiling: a configured 1h deadline
// with a 21min socket timeout puts undici first again, which is the exact failure
// this module exists to prevent. Both sides now read the effective value from here.
export function resolveCreationUpstreamTimeoutMs(env = typeof process === "undefined" ? {} : process.env) {
  const configured = Number(env?.IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1000
    ? Math.min(configured, CREATION_UPSTREAM_TIMEOUT_CEILING_MS)
    : CREATION_UPSTREAM_TIMEOUT_MS;
}

// Sit above the app's own deadline so our AbortSignal always fires first and
// produces our own message instead of a bare `terminated`.
export function getUpstreamStreamBodyTimeoutMs(env) {
  return resolveCreationUpstreamTimeoutMs(env) + 60_000;
}

export const UPSTREAM_STREAM_BODY_TIMEOUT_MS = getUpstreamStreamBodyTimeoutMs();

// Only the BODY timeout is the long-gap case. Headers are different: an upstream that
// completes the TCP handshake and never sends a status line is dead, not slow, and
// five routes (PPT, article, portrait x2, handleGenerate) pass no signal and no
// timeoutMs, so undici is their only bound. Raising this to match the body timeout
// would leave them hanging 21min instead of 300s. Keep undici's own default here.
export const UPSTREAM_STREAM_HEADERS_TIMEOUT_MS = 300_000;

function findGlobalDispatcherSymbol() {
  return Object.getOwnPropertySymbols(globalThis).find((symbol) =>
    String(symbol).includes("undici.globalDispatcher"),
  );
}

export function resolveUndiciAgentConstructor() {
  const symbol = findGlobalDispatcherSymbol();
  if (!symbol) {
    return null;
  }

  const dispatcher = globalThis[symbol];
  const candidate = dispatcher?.constructor;
  return typeof candidate === "function" && candidate.name === "Agent" ? candidate : null;
}

let cachedDispatcher;

// The global dispatcher symbol is created lazily on first fetch, so a caller that
// runs before any request would find nothing. Resolve on demand and re-try later
// rather than caching a null forever.
export function getUpstreamStreamDispatcher({
  bodyTimeoutMs = UPSTREAM_STREAM_BODY_TIMEOUT_MS,
  headersTimeoutMs = UPSTREAM_STREAM_HEADERS_TIMEOUT_MS,
} = {}) {
  if (cachedDispatcher !== undefined) {
    return cachedDispatcher;
  }

  const Agent = resolveUndiciAgentConstructor();
  if (!Agent) {
    return null;
  }

  try {
    cachedDispatcher = new Agent({
      bodyTimeout: bodyTimeoutMs,
      headersTimeout: headersTimeoutMs,
    });
  } catch {
    cachedDispatcher = null;
  }

  return cachedDispatcher;
}

// The global dispatcher symbol only exists after a real fetch has run, so the FIRST
// upstream generation in a freshly started process resolved nothing and silently used
// plain fetch with undici's 300s default -- the exact gap this module exists to close.
// One throwaway request to a closed local port creates the symbol without touching the
// network or DNS. Never throws, never blocks startup.
export async function warmUpstreamStreamDispatcher(baseFetch = fetch) {
  if (getUpstreamStreamDispatcher()) {
    return true;
  }

  try {
    await baseFetch("http://127.0.0.1:1/", { signal: AbortSignal.timeout(50) });
  } catch {
    // A refused connection or abort is the expected outcome; we only want the symbol.
  }

  return Boolean(getUpstreamStreamDispatcher());
}
// Wraps fetch so a long silent gap mid-stream does not kill the socket. Falls back
// to unmodified fetch whenever the dispatcher cannot be built, and retries without
// the dispatcher if a runtime rejects the option outright.
export function createUpstreamStreamFetch(baseFetch = fetch) {
  return async function upstreamStreamFetch(input, init = {}) {
    if (init?.dispatcher) {
      return baseFetch(input, init);
    }

    const dispatcher = getUpstreamStreamDispatcher();
    if (!dispatcher) {
      return baseFetch(input, init);
    }

    try {
      return await baseFetch(input, { ...init, dispatcher });
    } catch (error) {
      if (error instanceof TypeError && /dispatcher/i.test(error.message)) {
        return baseFetch(input, init);
      }
      throw error;
    }
  };
}

export const upstreamStreamFetch = createUpstreamStreamFetch();
