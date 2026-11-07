import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { buildParameterText } from "../lib/studio-formatters.mjs";
import { createPortraitSetStore } from "../lib/portrait-store.mjs";
import { createArticleIllustrationSetStore } from "../lib/article-illustration-store.mjs";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=";
const model = "gpt-image-2.6-sunburst";
const mappings = [{ source: model, target: "IMAGE-2.6" }];

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

function parseEvents(value) {
  return value.split(/\r?\n\r?\n/).flatMap((part) => {
    const name = /^event: (.+)$/m.exec(part)?.[1];
    const data = /^data: (.+)$/m.exec(part)?.[1];
    return name && data ? [{ name, data: JSON.parse(data) }] : [];
  });
}

test("server sends direct aliases and preserves selected/requested models in tasks and history", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "direct-model-mapping-"));
  const calls = [];
  const upstream = createServer(async (request, response) => {
    if (request.method !== "POST") { response.writeHead(404); response.end(); return; }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = request.headers["content-type"]?.startsWith("multipart/") ? raw : JSON.parse(raw);
    calls.push({ path: request.url, body });
    const payload = request.url === "/v1/responses" ? { status: "completed", output: [{ type: "image_generation_call", result: png }] }
      : request.url === "/v1/chat/completions" ? { choices: [{ message: { content: `data:image/png;base64,${png}` } }] }
        : { data: [{ b64_json: png }] };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(payload));
  });
  const upstreamUrl = await listen(upstream);
  const probe = createServer();
  const studioUrl = await listen(probe);
  await new Promise((done) => probe.close(done));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: resolve(import.meta.dirname, ".."),
    env: { ...process.env, HOST: "127.0.0.1", PORT: new URL(studioUrl).port, VERCEL: "1", IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "0", IMAGE_STUDIO_LOCAL_DATA_DIR: join(root, "local"), IMAGE_STUDIO_OUTPUT_DIR: join(root, "output"), TEMP: root, TMP: root },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  child.stdout.on("data", (value) => { diagnostics += value; });
  child.stderr.on("data", (value) => { diagnostics += value; });
  t.after(async () => {
    child.kill();
    await Promise.race([once(child, "exit"), delay(2000)]);
    upstream.closeAllConnections();
    await new Promise((done) => upstream.close(done));
    await rm(root, { recursive: true, force: true });
  });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(studioUrl + "/api/config")).ok) break; } catch {}
    if (child.exitCode !== null || i === 89) throw new Error(diagnostics);
    await delay(100);
  }
  const expected = [];
  async function generate(endpoint, extra = {}, file = false, apiEndpoint = "/api/generate") {
    const form = new FormData();
    for (const [key, value] of Object.entries({ prompt: "模型映射验证", imageRoute: "b", directImageBaseUrl: upstreamUrl + "/v1", directImageApiKey: "fixture-only-key", directImageModel: model, directTextModel: "text-only", directImageEndpointPath: endpoint, directImageModelMappings: JSON.stringify(mappings), format: "png", size: "1024x1024", ratio: "1:1", quality: "max", clientSessionId: "mapping-test", ...extra })) form.set(key, value);
    if (file) form.append("referenceImages", new File([Buffer.from(png, "base64")], "source.png", { type: "image/png" }));
    const events = parseEvents(await (await fetch(studioUrl + apiEndpoint, { method: "POST", body: form })).text());
    assert.equal(events.find(({ name }) => name === "error"), undefined, JSON.stringify(events));
    assert.equal(events.find(({ name }) => name === "item_error"), undefined, JSON.stringify(events));
    return events.find(({ name }) => name === "saved" || name === "item_saved")?.data.item;
  }
  for (const endpoint of ["images/generations", "responses", "chat/completions"]) {
    const item = await generate(endpoint);
    assert.ok(item, endpoint);
    const body = calls.at(-1).body;
    assert.equal(endpoint === "responses" ? body.tools[0].model : body.model, "IMAGE-2.6");
    if (endpoint === "responses") assert.equal(body.model, "text-only");
    assert.equal(item.selectedImageModel, model);
    assert.equal(item.requestImageModel, "IMAGE-2.6");
    assert.match(buildParameterText(item), /实际请求模型.*IMAGE-2.6/);
    assert.deepEqual(await readFile(item.absolutePath), Buffer.from(png, "base64"));
    expected.push(item.id);
  }
  const edited = await generate("images/generations", { mode: "image-edit" }, true);
  assert.equal(calls.at(-1).path, "/v1/images/edits");
  assert.match(calls.at(-1).body, /name="model"\r\n\r\nIMAGE-2\.6/);
  assert.equal(edited.requestImageModel, "IMAGE-2.6");
  const reverse = await generate("images/generations", { directImageModel: "IMAGE-2.6", directImageModelMappings: JSON.stringify([{ source: "IMAGE-2.6", target: model }]), imageOptions: JSON.stringify({ complexity: "low" }) });
  assert.equal(calls.at(-1).body.model, model);
  assert.equal(calls.at(-1).body.complexity, "low");
  assert.equal(reverse.selectedImageModel, "IMAGE-2.6");
  const cleared = await generate("images/generations", { directImageModelMappings: "[]" });
  assert.equal(calls.at(-1).body.model, model);
  assert.equal(cleared.requestImageModel, undefined);
  const gallery = await (await fetch(studioUrl + "/api/gallery")).json();
  for (const id of expected) assert.equal(gallery.find((item) => item.id === id)?.requestImageModel, "IMAGE-2.6");
  const tasks = await (await fetch(studioUrl + "/api/generation/tasks", { headers: { "x-client-session-id": "mapping-test" } })).json();
  assert.ok(tasks.some((task) => task.requestImageModel === "IMAGE-2.6" && task.selectedImageModel === model));
  assert.ok(tasks.filter((task) => task.requestImageModel === "IMAGE-2.6").every((task) => task.status === "completed"));
  for (const [createStore, endpoint] of [[createPortraitSetStore, "/api/portrait/repair"], [createArticleIllustrationSetStore, "/api/article-illustration/generate"]]) {
    const store = createStore({ outputDir: join(root, "output") });
    const setId = endpoint.includes("portrait") ? "portrait-mapping" : "article-mapping";
    await store.saveManifest({ setId, items: [{ itemId: "saved-item", status: "failed", prompt: "原任务的模型映射", imageRoute: "b", imageModel: model, selectedImageModel: model, requestImageModel: "FROZEN-IMAGE-ID" }] });
    await generate("images/generations", { setId }, false, endpoint);
    assert.equal(calls.at(-1).body.model, "FROZEN-IMAGE-ID", endpoint + " must preserve saved outbound ID");
  }
});
