import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { Jimp } from "jimp";
import { ensureGalleryThumbnail } from "../lib/gallery-thumbnail.mjs";
import { inspectGeneratedImage } from "../lib/generated-image-validation.mjs";
import { createPortraitSetStore } from "../lib/portrait-store.mjs";
import { createArticleIllustrationSetStore } from "../lib/article-illustration-store.mjs";

const png = await new Jimp({ width: 2, height: 2, color: 0xffffffff }).getBuffer("image/png");
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="red"/></svg>');

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

function parseEvents(text) {
  return text.split(/\r?\n\r?\n/).flatMap((chunk) => {
    const name = /^event: (.+)$/m.exec(chunk)?.[1];
    const data = /^data: (.+)$/m.exec(chunk)?.[1];
    return name && data ? [{ name, data: JSON.parse(data) }] : [];
  });
}

test("2.6 server saves all candidates, vector/animation originals, history and thumbnails", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "image26-integration-"));
  const requests = [];
  const singleFrameGif = await new Jimp({ width: 32, height: 24, color: 0xff0000ff }).getBuffer("image/gif");
  const colorTableEnd = 13 + ((singleFrameGif[10] & 0x80) ? 3 * (1 << ((singleFrameGif[10] & 7) + 1)) : 0);
  const frameStart = singleFrameGif.indexOf(0x2c, colorTableEnd);
  assert.ok(frameStart >= colorTableEnd);
  assert.equal(singleFrameGif.at(-1), 0x3b);
  const gif = Buffer.concat([singleFrameGif.subarray(0, -1), singleFrameGif.subarray(frameStart, -1), Buffer.from([0x3b])]);
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (request.method !== "POST") { response.writeHead(404); response.end(); return; }
    const bytes = Buffer.concat(chunks);
    if (request.url === "/v1/images/edits") {
      requests.push({ endpoint: "edit", body: bytes.toString("utf8") });
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
      return;
    }
    const body = JSON.parse(bytes);
    requests.push(body);
    const imageTool = body.tools?.find((tool) => tool.type === "image_generation");
    const format = imageTool?.output_format || body.output_format || "png";
    const result = body.prompt?.includes("wrong-format-fixture") ? png : body.prompt?.includes("single-frame-fixture") ? singleFrameGif : format === "svg" ? svg : format === "gif" ? gif : png;
    response.setHeader("Content-Type", "application/json");
    if (imageTool) {
      response.setHeader("Content-Type", "text/event-stream");
      response.end("event: response.completed\ndata: " + JSON.stringify({ response: { id: "resp_gif_fixture", status: "completed", output: [{ type: "image_generation_call", result: result.toString("base64"), output_format: format }] } }) + "\n\n");
      return;
    }
    const data = body.prompt?.includes("partial-save-fixture") ? [{ b64_json: png.toString("base64") }, { b64_json: Buffer.from("not an image").toString("base64") }] : Array.from({ length: body.n || 1 }, () => ({ b64_json: result.toString("base64") }));
    response.end(JSON.stringify({ data, output_format: format, ...(format === "svg" ? { svg_usage: { model: "svg-author", input_tokens: 1, output_tokens: 2, reasoning_tokens: 0, total_tokens: 3 } } : {}) }));
  });
  const upstreamUrl = await listen(upstream);
  const probe = createServer();
  const studioUrl = await listen(probe);
  await new Promise((resolveClose) => probe.close(resolveClose));
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
    await new Promise((resolveClose) => upstream.close(resolveClose));
    await rm(root, { recursive: true, force: true });
  });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(studioUrl + "/api/config")).ok) break; } catch {}
    if (child.exitCode !== null || i === 89) throw new Error(diagnostics);
    await delay(100);
  }
  async function generate(format, options = {}, extra = () => {}, endpoint = "/api/generate") {
    const form = new FormData();
    for (const [key, value] of Object.entries({ prompt: "简体中文产品图", imageRoute: "b", directImageBaseUrl: upstreamUrl + "/v1", directImageApiKey: "fixture-only-key", directImageModel: "gpt-image-2.6-flare", directImageEndpointPath: "images/generations", format, size: "1024x1024", ratio: "1:1", imageOptions: JSON.stringify(options) })) form.set(key, value);
    extra(form);
    const response = await fetch(studioUrl + endpoint, { method: "POST", body: form });
    return parseEvents(await response.text());
  }
  const multi = await generate("png", { complexity: "low", n: 3 });
  assert.equal(multi.find((event) => event.name === "error"), undefined, JSON.stringify(multi));
  const first = multi.find((event) => event.name === "saved").data.item;
  assert.equal(first.additionalItems.length, 2);
  assert.equal(requests[0].n, 3);
  assert.equal(requests[0].complexity, "low");
  assert.equal(requests[0].response_format, undefined);
  for (const item of [first, ...first.additionalItems]) assert.deepEqual(await readFile(item.absolutePath), png);
  for (const [format, expected] of [["svg", svg], ["gif", gif]]) {
    const events = await generate(format, format === "gif" ? { frameCount: 9, frameDurationMs: 200 } : {});
    assert.equal(events.find((event) => event.name === "error"), undefined, JSON.stringify(events));
    const item = events.find((event) => event.name === "saved").data.item;
    assert.deepEqual(await readFile(item.absolutePath), expected);
    assert.equal(item.format, format);
    assert.equal(item.actualSize, "32x24");
    if (format === "gif") assert.equal(inspectGeneratedImage(expected).frameCount, 2);
    if (format === "svg") assert.equal(item.svgUsage.model, "svg-author");
    const thumb = await ensureGalleryThumbnail({ outputDir: join(root, "output"), relativeImagePath: item.relativePath });
    assert.ok(thumb, "new formats must have an actual thumbnail");
    assert.equal(inspectGeneratedImage(await readFile(thumb.thumbnailPath)).format, "webp");
    const asset = await fetch(studioUrl + item.imageUrl);
    assert.match(asset.headers.get("content-type"), format === "svg" ? /image\/svg\+xml/ : /image\/gif/);
    assert.deepEqual(Buffer.from(await asset.arrayBuffer()), expected);
  }
  for (const model of ["gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare", "IMAGE-CUSTOM"]) {
    const events = await generate("gif", { frameCount: 12, frameDurationMs: 120 }, (form) => form.set("directImageModel", model));
    assert.equal(events.find((event) => event.name === "error"), undefined, JSON.stringify(events));
    assert.equal(requests.at(-1).model, model);
    assert.equal(requests.at(-1).output_format, "gif");
    assert.equal(requests.at(-1).frame_count, 12);
    assert.deepEqual(await readFile(events.find((event) => event.name === "saved").data.item.absolutePath), gif);
  }
  const routed = await generate("gif", { frameCount: 6 }, (form) => {
    for (const [key, value] of Object.entries({ imageRoute: "a", baseUrl: upstreamUrl + "/v1", apiKey: "fixture-only-key", imageToolModel: "gpt-image-2", responsesModel: "gpt-6-luna", includeImageToolModel: "false" })) form.set(key, value);
  });
  assert.equal(routed.find((event) => event.name === "error"), undefined, JSON.stringify(routed));
  assert.equal(requests.at(-1).tools[0].output_format, "gif");
  assert.equal(requests.at(-1).tools[0].frame_count, 6);
  assert.equal(requests.at(-1).tools[0].model, undefined);
  // 网关只转发、不拦截：上游给了与请求不同的编码，也按真实字节的格式落盘。
  {
    const before = requests.length;
    const events = await generate("gif", {}, (form) => form.set("prompt", "wrong-format-fixture"));
    assert.equal(requests.length, before + 1);
    assert.equal(events.find((event) => event.name === "error"), undefined, JSON.stringify(events));
    const item = events.find((event) => event.name === "saved")?.data.item;
    assert.ok(item, "wrong-format result must still be saved");
    assert.equal(item.format, "png");
    assert.match(item.filename, /\.png$/);
  }
  // 请求动画但上游只给单帧：网关不拦，按实际 G_t 落盘，格式与帧数都由真实字节决定。
  {
    const before = requests.length;
    const events = await generate("gif", {}, (form) => form.set("prompt", "single-frame-fixture"));
    assert.equal(requests.length, before + 1, "只在收到结果后验证，不阻止实际请求");
    assert.equal(events.find((event) => event.name === "error"), undefined, JSON.stringify(events));
    const item = events.find((event) => event.name === "saved")?.data.item;
    assert.ok(item, "single-frame result must still be saved");
    assert.equal(item.format, "gif");
    assert.ok((await readFile(item.absolutePath)).length > 0);
  }
  // 多张里有空字节：那张报空图，好的一张照常保存（不再整批回退，也不丢好图）。
  const partial = await generate("png", { n: 2 }, (form) => { form.set("prompt", "partial-save-fixture"); });
  assert.equal(partial.find((event) => event.name === "error"), undefined, JSON.stringify(partial));
  const partialSaved = partial.find((event) => event.name === "saved");
  assert.ok(partialSaved, "the valid candidate must be saved");
  const gallery = await (await fetch(studioUrl + "/api/gallery")).json();
  assert.ok(gallery.filter((item) => item.prompt.includes("partial-save-fixture")).length >= 1);
  const beforeInvalidEdit = requests.length;
  const invalid = await generate("svg", {}, (form) => { form.set("mode", "image-edit"); form.set("referenceImages", new File([png], "source.png", { type: "image/png" })); });
  assert.ok(invalid.some((event) => event.name === "error"));
  assert.equal(requests.length, beforeInvalidEdit);
  const overlay = await new Jimp({ width: 2, height: 2, color: 0x00000000 }).getBuffer("image/png");
  const markupEvents = await generate("png", { complexity: "high" }, (form) => {
    form.set("mode", "image-edit"); form.set("editMode", "markup");
    form.set("referenceImages", new File([png], "source.png", { type: "image/png" }));
    form.set("markup", new File([overlay], "markup.png", { type: "image/png" }));
  });
  assert.equal(markupEvents.find((event) => event.name === "error"), undefined, JSON.stringify(markupEvents));
  const edit = requests.at(-1);
  assert.equal(edit.endpoint, "edit");
  assert.match(edit.body, /name="markup"/);
  const sixteen = await generate("png", {}, (form) => {
    for (let index = 0; index < 16; index++) form.append("referenceImages", new File([png], String(index) + ".png", { type: "image/png" }));
  });
  assert.equal(sixteen.find((event) => event.name === "error"), undefined, JSON.stringify(sixteen));
  const afterSixteen = requests.length;
  const seventeen = await generate("png", {}, (form) => {
    for (let index = 0; index < 17; index++) form.append("referenceImages", new File([png], String(index) + ".png", { type: "image/png" }));
  });
  assert.ok(seventeen.some((event) => event.name === "error"));
  assert.equal(requests.length, afterSixteen);
  for (const badOverlay of [png, await new Jimp({ width: 3, height: 2, color: 0x00000000 }).getBuffer("image/png")]) {
    const beforeMarkup = requests.length;
    const events = await generate("png", {}, (form) => {
      form.set("mode", "image-edit"); form.set("editMode", "markup");
      form.set("referenceImages", new File([png], "source.png", { type: "image/png" }));
      form.set("markup", new File([badOverlay], "markup.png", { type: "image/png" }));
    });
    assert.ok(events.some((event) => event.name === "error"));
    assert.equal(requests.length, beforeMarkup);
  }
  for (const [createStore, endpoint] of [[createPortraitSetStore, "/api/portrait/repair"], [createArticleIllustrationSetStore, "/api/article-illustration/generate"]]) {
    const store = createStore({ outputDir: join(root, "output") });
    for (const savedOptions of [{ complexity: "low" }, undefined]) {
      const setId = (endpoint.includes("portrait") ? "portrait" : "article") + (savedOptions ? "-snapshot" : "-legacy");
      await store.saveManifest({ setId, items: [{ itemId: "saved-item", status: "failed", prompt: "已保存的中文提示词", ...(savedOptions ? { imageOptions: savedOptions } : {}) }] });
      const events = await generate("png", { complexity: "high" }, (form) => { form.set("setId", setId); }, endpoint);
      assert.equal(events.find((event) => event.name === "error" || event.name === "item_error"), undefined, JSON.stringify(events));
      assert.equal(requests.at(-1).complexity, savedOptions?.complexity);
      const saved = await store.readManifest(setId);
      assert.equal(saved.items[0].status, "completed", JSON.stringify(events));
      assert.deepEqual(saved.items[0].imageOptions, savedOptions || {});
    }
  }
  assert.match(edit.body, /name="complexity"\r\n\r\nhigh/);
});
