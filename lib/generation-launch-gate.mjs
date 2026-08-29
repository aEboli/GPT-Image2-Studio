// Paces upstream generation submissions across EVERY fan-out that shares a client
// session and request scope.
//
// The gate used to live inside `runWithConcurrency`, which gave each HTTP request
// its own timer. Two suites running at once therefore each paced independently and
// the upstream saw roughly `interval / N` — measured at 353ms for two suites
// configured at 750ms, with same-millisecond collisions. The configured number was
// effectively meaningless once a second suite started.
//
// Scoping the gate the same way the session task slot limiter is scoped keeps the
// two mechanisms consistent: the concurrency ceiling and the submit interval now
// both mean "per session, per scope".

function defaultWait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeKeyPart(value, fallback) {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

export function buildLaunchGateKey(sessionId, requestScope) {
  return `${normalizeKeyPart(sessionId, "global-default-session")}\n${normalizeKeyPart(requestScope, "prompt")}`;
}

// One gate per key. `waitForTurn` serializes callers through a promise chain so
// concurrent fan-outs interleave instead of each reading a stale `nextLaunchAt`.
export function createGenerationLaunchGateRegistry({ wait = defaultWait, now = Date.now } = {}) {
  const gatesByKey = new Map();

  function pruneExpiredGates() {
    const currentTime = now();
    for (const [key, gate] of gatesByKey) {
      // Keep only the trailing cadence window after a scope ends. Retaining a
      // gate for minutes made a later batch ignore the newly saved interval;
      // deleting it sooner than nextLaunchAt would let immediate repair traffic
      // bypass the previous submission's spacing.
      if (gate.activeScopes === 0 && gate.waiters === 0 && currentTime >= gate.nextLaunchAt) {
        gatesByKey.delete(key);
      }
    }
  }

  function getGate(key) {
    pruneExpiredGates();
    const existing = gatesByKey.get(key);
    if (existing) {
      return existing;
    }

    const gate = {
      chain: Promise.resolve(),
      intervalMs: null,
      nextLaunchAt: 0,
      activeScopes: 0,
      waiters: 0,
    };
    gatesByKey.set(key, gate);
    return gate;
  }

  // A scope is the lifetime of one server-side fan-out, not one upstream
  // request. Its first interval wins while overlapping fan-outs share the same
  // session/scope; after the last one releases, the next batch may sample the
  // latest configuration while still honoring nextLaunchAt.
  function acquireScope(sessionId, requestScope, intervalMs) {
    const key = buildLaunchGateKey(sessionId, requestScope);
    const gate = getGate(key);
    gate.activeScopes += 1;
    if (gate.activeScopes === 1) {
      gate.intervalMs = Math.max(0, Math.floor(Number(intervalMs) || 0));
    }

    return { gate, released: false };
  }

  function releaseScope(lease) {
    if (!lease?.gate || lease.released) {
      return false;
    }

    lease.released = true;
    const gate = lease.gate;
    gate.activeScopes = Math.max(0, gate.activeScopes - 1);
    if (gate.activeScopes === 0 && gate.waiters === 0) {
      // Preserve nextLaunchAt for a possible immediate repair, but let a new
      // scope set the cadence used once that existing wait has elapsed.
      gate.intervalMs = null;
    }
    pruneExpiredGates();
    return true;
  }

  // `readyAt` lets a caller demand a later launch than the interval alone would
  // give it — used by the transient-failure backoff, so a requeued item cannot
  // retry straight back into the same congestion window.
  async function waitForTurn(sessionId, requestScope, intervalMs, { readyAt = 0, isActive = () => true } = {}) {
    const normalizedInterval = Math.max(0, Math.floor(Number(intervalMs) || 0));
    const key = buildLaunchGateKey(sessionId, requestScope);
    const gate = getGate(key);

    // A direct caller without a scope lease still gets the old one-turn
    // behavior. Server fan-outs acquire a lease first, which keeps this value
    // fixed while their shared scope is active.
    if (gate.intervalMs === null) {
      gate.intervalMs = normalizedInterval;
    }

    gate.waiters += 1;
    const turn = gate.chain.then(async () => {
      // Both conditions must hold: the shared interval AND this item's own backoff.
      const target = Math.max(gate.nextLaunchAt, Number(readyAt) || 0);
      let remaining = target - now();
      while (remaining > 0) {
        if (!isActive()) {
          return false;
        }
        await wait(Math.min(remaining, 250));
        remaining = target - now();
      }

      if (!isActive()) {
        return false;
      }

      gate.nextLaunchAt = Math.max(now(), target) + gate.intervalMs;
      return true;
    });

    // The chain must not reject, or one aborted caller would poison every caller
    // queued behind it on the same gate.
    gate.chain = turn.then(() => {}, () => {});

    try {
      return await turn;
    } finally {
      gate.waiters -= 1;
      if (gate.activeScopes === 0 && gate.waiters === 0) {
        gate.intervalMs = null;
      }
    }
  }

  function getActiveGateCount() {
    pruneExpiredGates();
    return gatesByKey.size;
  }

  return { acquireScope, buildLaunchGateKey, getActiveGateCount, releaseScope, waitForTurn };
}
