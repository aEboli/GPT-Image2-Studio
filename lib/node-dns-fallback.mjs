export const DEFAULT_NODE_DNS_FALLBACK_SERVERS = ["223.5.5.5", "1.1.1.1"];

const FALLBACK_LOOKUP_STATE = Symbol.for("GPTImage2Studio.nodeDnsFallbackLookup");
const LOOKUP_FALLBACK_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "EAI_FAIL",
  "EAI_NODATA",
  "ECONNREFUSED",
  "ENODATA",
  "ENOTFOUND",
  "ETIMEOUT",
  "SERVFAIL",
]);

export function parseNodeDnsFallbackServers(value = "") {
  return String(value || "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueServers(servers) {
  const seen = new Set();
  return servers.filter((server) => {
    const normalized = String(server || "").trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function normalizeLookupOptions(options) {
  if (typeof options === "number") {
    return { family: options };
  }
  if (options && typeof options === "object") {
    return { ...options };
  }
  return {};
}

function getLookupFamilies(options = {}) {
  const family = Number(options.family || 0);
  if (family === 4 || family === 6) {
    return [family];
  }
  return options.order === "ipv6first" ? [6, 4] : [4, 6];
}

function shouldUseLookupFallback(error) {
  if (!error) {
    return false;
  }
  const code = typeof error.code === "string" ? error.code : "";
  return !code || LOOKUP_FALLBACK_ERROR_CODES.has(code);
}

function resolveWithServer({ Resolver, hostname, server, family }) {
  return new Promise((resolve, reject) => {
    const resolver = new Resolver();
    resolver.setServers([server]);
    const method = family === 6 ? "resolve6" : "resolve4";
    if (typeof resolver[method] !== "function") {
      reject(new Error(`DNS resolver does not support ${method}.`));
      return;
    }
    resolver[method](hostname, (error, addresses) => {
      if (error) {
        reject(error);
        return;
      }
      resolve((Array.isArray(addresses) ? addresses : []).filter(Boolean));
    });
  });
}

async function resolveWithFallbackServers({ Resolver, hostname, options, servers }) {
  let lastError = null;
  const families = getLookupFamilies(options);

  for (const server of servers) {
    const resolved = [];
    for (const family of families) {
      try {
        const addresses = await resolveWithServer({ Resolver, hostname, server, family });
        const results = addresses.map((address) => ({ address, family }));
        if (!options.all && results.length) {
          return results[0];
        }
        resolved.push(...results);
      } catch (error) {
        lastError = error;
      }
    }
    if (resolved.length) {
      return options.all ? resolved : resolved[0];
    }
  }

  throw lastError || new Error(`DNS fallback could not resolve ${hostname}.`);
}

function installLookupFallback({ dns, servers }) {
  if (typeof dns.lookup !== "function" || typeof dns.Resolver !== "function") {
    return false;
  }

  const lookupState = dns.lookup[FALLBACK_LOOKUP_STATE];
  const originalLookup = lookupState?.originalLookup || dns.lookup;
  const fallbackServers = [...servers];

  function lookupWithFallback(hostname, options, callback) {
    const hasOptions = typeof options !== "function";
    const lookupOptions = normalizeLookupOptions(hasOptions ? options : undefined);
    const done = hasOptions ? callback : options;

    if (typeof done !== "function") {
      return originalLookup.call(this, hostname, options, callback);
    }

    const onLookup = (error, address, family) => {
      if (!shouldUseLookupFallback(error)) {
        done(error, address, family);
        return;
      }

      resolveWithFallbackServers({
        Resolver: dns.Resolver,
        hostname,
        options: lookupOptions,
        servers: fallbackServers,
      }).then(
        (result) => {
          if (lookupOptions.all) {
            done(null, result);
            return;
          }
          done(null, result.address, result.family);
        },
        () => {
          done(error, address, family);
        },
      );
    };

    return hasOptions
      ? originalLookup.call(this, hostname, options, onLookup)
      : originalLookup.call(this, hostname, onLookup);
  }

  lookupWithFallback[FALLBACK_LOOKUP_STATE] = {
    originalLookup,
    servers: fallbackServers,
  };
  dns.lookup = lookupWithFallback;
  return true;
}

export function configureNodeDnsFallback({ dns, env = globalThis.process?.env || {} } = {}) {
  if (!dns || env.IMAGE_STUDIO_DISABLE_DNS_FALLBACK === "1") {
    return false;
  }

  const fallbackServers = parseNodeDnsFallbackServers(env.IMAGE_STUDIO_DNS_FALLBACK_SERVERS);
  const servers = fallbackServers.length ? fallbackServers : DEFAULT_NODE_DNS_FALLBACK_SERVERS;
  const currentServers = typeof dns.getServers === "function" ? dns.getServers() : [];
  const nextServers = uniqueServers([...servers, ...currentServers]);
  if (!nextServers.length) {
    return false;
  }

  let configured = false;
  if (typeof dns.setServers === "function") {
    dns.setServers(nextServers);
    configured = true;
  }

  configured = installLookupFallback({ dns, servers: nextServers }) || configured;
  return configured;
}
