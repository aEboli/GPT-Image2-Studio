import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { consumeSse } from "../lib/generation-client.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

test("analyst HTTP stream exposes real answer before final validation and returns safe timing records", { timeout: 20000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "creation-latency-server-"));
  const { payload } = marketingPlanFixture(2);
  let release;
  let posts = 0;
  const upstream = createServer(async (request, response) => {
    if (request.method !== "POST") { response.end("ok"); return; }
    for await (const _chunk of request) { /* 消费模拟请求体。 */ }
    posts += 1;
    response.writeHead(200, { "content-type": "text/event-stream" });
    const emit = (value) => response.write(`data: ${JSON.stringify(value)}\n\n`);
    response.write(": heartbeat\n\n");
    emit({ type: "response.reasoning_text.delta", delta: "PRIVATE_REASONING" });
    const source = JSON.stringify(payload);
    const gate = new Promise((done) => { release = done; });
    emit({ type: "response.output_text.delta", delta: source.slice(0, 80) });
    await gate;
    emit({ type: "response.output_text.delta", delta: source.slice(80) });
    emit({ type: "response.completed", response: { usage: { input_tokens: 123, output_tokens: 234 } } });
    response.end();
  });
  await new Promise((done) => upstream.listen(0, "127.0.0.1", done));
  const reservation = createServer();
  await new Promise((done) => reservation.listen(0, "127.0.0.1", done));
  const port = reservation.address().port;
  await new Promise((done) => reservation.close(done));
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.mjs"], { cwd: resolve(import.meta.dirname, ".."), windowsHide: true, env: { ...process.env, PORT: String(port), IMAGE_STUDIO_OUTPUT_DIR: join(directory, "output"), IMAGE_STUDIO_LOCAL_DATA_DIR: join(directory, "data") }, stdio: ["ignore", "ignore", "pipe"] });
  let diagnostics = "";
  child.stderr.on("data", (value) => { diagnostics += value; });
  t.after(async () => {
    release?.();
    if (child.exitCode === null) { child.kill(); await Promise.race([once(child, "exit"), delay(1500)]); if (child.exitCode === null) child.kill("SIGKILL"); }
    upstream.closeAllConnections();
    await new Promise((done) => upstream.close(done));
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}\\`) || resolve(directory).startsWith(`${resolve(tmpdir())}/`));
    await rm(directory, { recursive: true, force: true });
  });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/creation/sets`)).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) break;
    await delay(100);
  }
  assert.ok(ready, diagnostics);
  const form = new FormData();
  for (const [key, value] of Object.entries({ baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, apiKey: "LOCAL_TEST_KEY", responsesModel: "fixed-fixture", endpointPath: "/responses", imageRoute: "a", reasoningEffort: "high", productName: "加热手套" })) form.set(key, value);
  form.append("referenceImages", new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=", "base64")], "gloves.png", { type: "image/png" }));
  const response = await fetch(`${baseUrl}/api/creation/reference/analyze`, { method: "POST", body: form, headers: { Accept: "text/event-stream" } });
  const events = [];
  const unblock = setTimeout(() => release?.(), 10000);
  try {
    await consumeSse(response.body, (event, data) => {
      events.push({ event, data });
      if (event === "text_progress" && data.stage === "receiving") {
        assert.equal(events.some((entry) => entry.event === "complete"), false);
        assert.ok(Number.isFinite(data.timing.firstTextMs));
        release?.();
      }
    });
  } finally { clearTimeout(unblock); release?.(); }
  assert.equal(posts, 1);
  assert.ok(events.some((entry) => entry.event === "text_progress" && entry.data.stage === "connected"), JSON.stringify(events.map(({ event, data }) => ({ event, stage: data.stage, message: data.message }))));
  const validated = events.find((entry) => entry.event === "text_progress" && entry.data.stage === "validating");
  assert.ok(Number.isFinite(validated.data.timing.validationMs));
  const result = events.find((entry) => entry.event === "complete")?.data;
  assert.equal(result.ok, true);
  assert.equal(result.requestTrace.calls.length, 1);
  assert.equal(result.requestTrace.calls[0].usage.outputTokens, 234);
  assert.ok(result.analysis.recommendations.length);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE_REASONING|LOCAL_TEST_KEY|data:image/);
});
