import test from "node:test";
import assert from "node:assert/strict";

import { createOutboundRequestIpLookup } from "../lib/outbound-request-ip.mjs";

function response(ip, ok = true) {
  return { ok, json: async () => ({ ip }) };
}

test("outbound IP lookup validates the reflected address and uses a bounded no-store request", async () => {
  let request;
  const lookup = createOutboundRequestIpLookup({
    endpoint: "https://ip-check.invalid/",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response("2001:db8::42");
    },
  });

  assert.equal(await lookup(), "2001:db8::42");
  assert.equal(request.url, "https://ip-check.invalid/");
  assert.deepEqual(request.options.headers, { accept: "application/json" });
  assert.equal(request.options.cache, "no-store");
  assert.ok(request.options.signal instanceof AbortSignal);
});

test("outbound IP lookup returns an empty value for failed or malformed responses", async () => {
  const failed = createOutboundRequestIpLookup({ fetchImpl: async () => response("203.0.113.1", false) });
  const malformed = createOutboundRequestIpLookup({ fetchImpl: async () => response("not-an-ip") });
  const rejected = createOutboundRequestIpLookup({ fetchImpl: async () => { throw new Error("offline"); } });

  assert.equal(await failed(), "");
  assert.equal(await malformed(), "");
  assert.equal(await rejected(), "");
});

test("outbound IP lookup coalesces concurrent calls and caches the result briefly", async () => {
  let now = 10_000;
  let calls = 0;
  const lookup = createOutboundRequestIpLookup({
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response("203.0.113.42");
    },
    cacheMs: 100,
    now: () => now,
  });

  const results = await Promise.all([lookup(), lookup(), lookup()]);
  assert.deepEqual(results, ["203.0.113.42", "203.0.113.42", "203.0.113.42"]);
  assert.equal(calls, 1);
  assert.equal(await lookup(), "203.0.113.42");
  assert.equal(calls, 1);

  now += 101;
  assert.equal(await lookup(), "203.0.113.42");
  assert.equal(calls, 2);
});
