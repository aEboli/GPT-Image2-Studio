import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

import {
  CREATION_UPSTREAM_TIMEOUT_CEILING_MS,
  UPSTREAM_STREAM_BODY_TIMEOUT_MS,
  UPSTREAM_STREAM_HEADERS_TIMEOUT_MS,
  createUpstreamStreamFetch,
  getUpstreamStreamBodyTimeoutMs,
  resolveCreationUpstreamTimeoutMs,
  resolveUndiciAgentConstructor,
} from "../lib/upstream-stream-fetch.mjs";
import { CREATION_UPSTREAM_TIMEOUT_MS } from "../lib/studio-constants.mjs";

async function withStallingServer(stallMs, run) {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    // Headers plus a comment arrive immediately, then the body goes silent. This is
    // exactly the upstream shape: completion announced, image minutes later.
    response.write(": open\n\n");
    setTimeout(() => {
      response.write("data: {\"ok\":true}\n\n");
      response.end();
    }, stallMs);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await run(`http://127.0.0.1:${server.address().port}/`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function drain(response) {
  const reader = response.body.getReader();
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

// The old form of this test compared the module constant against the default it is
// literally derived from (x + 60_000 > x), so it could never fail. server.mjs lets an
// operator raise the deadline to 1h, which used to leave undici firing 39min early.
test("the upstream body timeout stays above the EFFECTIVE deadline at every supported value", () => {
  const envValues = [
    undefined,
    "1200000",
    "3600000",
    "7200000",
    "500",
    "abc",
    "",
    String(CREATION_UPSTREAM_TIMEOUT_CEILING_MS),
  ];

  for (const value of envValues) {
    const env = value === undefined ? {} : { IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS: value };
    const deadline = resolveCreationUpstreamTimeoutMs(env);
    const body = getUpstreamStreamBodyTimeoutMs(env);
    assert.ok(
      body > deadline,
      `undici must not pre-empt the effective deadline (env=${String(value)}, deadline=${deadline}, body=${body})`,
    );
    assert.ok(deadline <= CREATION_UPSTREAM_TIMEOUT_CEILING_MS, "deadline must stay under the ceiling");
  }
});

test("an out-of-range creation timeout is clamped the same way server.mjs clamps it", () => {
  assert.equal(resolveCreationUpstreamTimeoutMs({ IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS: "7200000" }), CREATION_UPSTREAM_TIMEOUT_CEILING_MS);
  assert.equal(resolveCreationUpstreamTimeoutMs({ IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS: "500" }), CREATION_UPSTREAM_TIMEOUT_MS);
  assert.equal(resolveCreationUpstreamTimeoutMs({}), CREATION_UPSTREAM_TIMEOUT_MS);
  assert.equal(UPSTREAM_STREAM_BODY_TIMEOUT_MS, getUpstreamStreamBodyTimeoutMs({}));
});

// A dead upstream that never sends headers must still be caught quickly. Five routes
// pass no signal and no timeoutMs, so this is their only bound.
test("the headers timeout is NOT raised with the body timeout", () => {
  assert.equal(UPSTREAM_STREAM_HEADERS_TIMEOUT_MS, 300_000);
  assert.ok(
    UPSTREAM_STREAM_HEADERS_TIMEOUT_MS < getUpstreamStreamBodyTimeoutMs({ IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS: "3600000" }),
    "headers timeout must stay well below the raised body timeout",
  );
});

test("a silent gap longer than the dispatcher's body timeout kills the stream", async () => {
  const Agent = resolveUndiciAgentConstructor() || (await import("undici").then((m) => m.Agent).catch(() => null));
  if (!Agent) {
    // Without the internal Agent the wrapper degrades to plain fetch, which this
    // test cannot exercise; the fallback itself is covered below.
    return;
  }

  await withStallingServer(1200, async (url) => {
    await assert.rejects(
      async () => {
        const response = await fetch(url, { dispatcher: new Agent({ bodyTimeout: 300 }) });
        await drain(response);
      },
      (error) => error?.cause?.code === "UND_ERR_BODY_TIMEOUT" || /terminated/i.test(String(error?.message)),
    );
  });
});

test("the upstream stream fetch survives that same silent gap", async () => {
  await withStallingServer(1200, async (url) => {
    const upstreamFetch = createUpstreamStreamFetch();
    const response = await upstreamFetch(url);
    const text = await drain(response);
    assert.match(text, /"ok":true/);
  });
});

test("an explicit dispatcher from the caller is left untouched", async () => {
  let sawInit = null;
  const upstreamFetch = createUpstreamStreamFetch(async (_input, init) => {
    sawInit = init;
    return new Response("ok");
  });

  const marker = { marker: true };
  await upstreamFetch("https://example.test/", { dispatcher: marker });

  assert.equal(sawInit.dispatcher, marker);
});

test("a runtime that rejects the dispatcher option falls back to plain fetch", async () => {
  let calls = 0;
  const upstreamFetch = createUpstreamStreamFetch(async (_input, init) => {
    calls += 1;
    if (init && "dispatcher" in init) {
      throw new TypeError("Unrecognized dispatcher option");
    }
    return new Response("fallback");
  });

  const response = await upstreamFetch("https://example.test/");

  assert.equal(await response.text(), "fallback");
  assert.equal(calls, 2, "should retry once without the dispatcher");
});

test("a real network error still propagates", async () => {
  const upstreamFetch = createUpstreamStreamFetch(async () => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(() => upstreamFetch("https://example.test/"), /fetch failed/);
});

test("image generation requests default to the long-gap fetch", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow = await readFile(new URL("../lib/responses-workflow.mjs", import.meta.url), "utf8");

  assert.equal(
    workflow.includes("upstreamStreamFetch"),
    true,
    "responses-workflow must default its fetchImpl to the long-gap fetch",
  );
  assert.equal(
    /fetchImpl = fetch\b/.test(workflow),
    false,
    "no upstream entry point may still default to bare fetch",
  );
});
