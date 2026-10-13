import { isIP } from "node:net";

export const DEFAULT_OUTBOUND_REQUEST_IP_URL = "https://api64.ipify.org?format=json";

export function createOutboundRequestIpLookup({
  fetchImpl = fetch,
  endpoint = DEFAULT_OUTBOUND_REQUEST_IP_URL,
  timeoutMs = 1500,
  cacheMs = 5000,
  now = Date.now,
} = {}) {
  let cachedIp = "";
  let cacheExpiresAt = 0;
  let pendingLookup = null;

  return async function getOutboundRequestIp() {
    if (pendingLookup) {
      return pendingLookup;
    }
    if (cacheExpiresAt > now()) {
      return cachedIp;
    }

    pendingLookup = (async () => {
      try {
        const response = await fetchImpl(endpoint, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        if (!response.ok) {
          return "";
        }

        const payload = await response.json();
        const ip = String(payload?.ip || "").trim();
        return isIP(ip) ? ip : "";
      } catch {
        return "";
      }
    })();

    try {
      cachedIp = await pendingLookup;
      cacheExpiresAt = now() + (cachedIp ? cacheMs : Math.min(cacheMs, 5000));
      return cachedIp;
    } finally {
      pendingLookup = null;
    }
  };
}
