import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { File } from "node:buffer";
import { setTimeout as delay } from "node:timers/promises";
import { createCreationSetStore } from "../lib/creation-store.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=";
const surfaceLocks = ["画面左侧掌面有蜂窝纹理，翻盖保持原图状态", "画面右侧手背保留HOT字样、显示窗与下方按键，不能复制到掌面", "一双按1个可售单位计，画面左右不等于左右手"];

async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

function events(source) {
  return source.split(/\r?\n\r?\n/u).flatMap((entry) => {
    const event = entry.match(/^event:\s*(.+)$/mu)?.[1];
    const data = entry.match(/^data:\s*(.+)$/mu)?.[1];
    return event && data ? [{ event, data: JSON.parse(data) }] : [];
  });
}

function requestTexts(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(requestTexts);
}

test("AI marketing plans once, generates 20, preserves assignments and repairs without replanning", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "creation-marketing-e2e-"));
  const outputDir = join(directory, "output");
  let planningCalls = 0;
  let invalidCount = false;
  let repairReferences = false;
  let analysisOnlyResponses = 0;
  const imageRequests = [];
  const upstream = createServer(async (request, response) => {
    const parts = [];
    for await (const chunk of request) parts.push(chunk);
    if (request.url.endsWith("/files")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "file-marketing-primary", object: "file" }));
      return;
    }
    const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (body.text?.format?.name === "creation_marketing_plan_json") {
      planningCalls += 1;
      const context = JSON.parse(body.input[0].content.find((entry) => entry.type === "input_text" && entry.text.startsWith("{\"task_count\"")).text);
      const { payload } = marketingPlanFixture(context.task_count);
      payload.product_insights.confirmed_facts = payload.product_insights.confirmed_facts.filter((fact) => !["spec", "package"].includes(fact.kind));
      ["variant-comparison", "dimension-fit", "in-box", "spec-table"].forEach((imageType, index) => {
        if (payload.items[index]) payload.items[index].image_type = imageType;
      });
      payload.product_insights.appearance_locks = surfaceLocks.map((text) => ({ text, reference_indexes: [1] }));
      if (repairReferences) {
        payload.reference_roles = context.references.map((entry) => ({ ...entry, role: entry.index === 1 ? "product" : "feature" }));
        payload.product_insights.appearance_locks.forEach((entry) => { entry.reference_indexes = [9]; });
        payload.product_insights.confirmed_facts.forEach((fact) => { fact.reference_indexes = fact.id === "appearance" ? [9] : fact.id === "control" ? [2] : [3]; });
        payload.items.forEach((item) => { item.reference_indexes = [3]; });
      }
      if (analysisOnlyResponses > 0) { delete payload.items; analysisOnlyResponses -= 1; }
      if (invalidCount) payload.items.splice(18);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ output_text: JSON.stringify(payload) }));
      return;
    }
    assert.notEqual(body.text?.format?.name, "creation_prompt_translation", "a final AI plan is not rewritten by a second model pass");
    imageRequests.push(body);
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { id: `resp_marketing_${imageRequests.length}`, status: "completed", output: [{ type: "image_generation_call", result: png }] } })}\n\n`);
  });
  await new Promise((done) => upstream.listen(0, "127.0.0.1", done));
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}/v1`;
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.mjs"], { cwd: resolve(import.meta.dirname, ".."), windowsHide: true, env: { ...process.env, PORT: String(port), IMAGE_STUDIO_OUTPUT_DIR: outputDir, IMAGE_STUDIO_LOCAL_DATA_DIR: join(directory, "data") }, stdio: ["ignore", "pipe", "pipe"] });
  let diagnostics = "";
  child.stderr.on("data", (chunk) => { diagnostics += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([once(child, "exit"), delay(1500)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await new Promise((done) => upstream.close(done));
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}\\`) || resolve(directory).startsWith(`${resolve(tmpdir())}/`));
    assert.ok(basename(directory).startsWith("creation-marketing-e2e-"));
    await rm(directory, { recursive: true, force: true });
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { const response = await fetch(`${baseUrl}/api/creation/sets`); if (response.ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) break;
    await delay(100);
  }
  assert.ok(ready, diagnostics);
  const form = (changes = {}) => {
    const { input } = marketingPlanFixture(Number(changes.imageCount || 20));
    const fields = { ...input, dimensionSpecs: "", selectedRoles: [], aiMarketingEnabled: true, baseUrl: upstreamUrl, endpointPath: "/responses", imageRoute: "a", apiKey: "local-test-key", responsesModel: "test-vision", startDelayMs: "200", generationStartDelayMs: "200", clientSessionId: "marketing-e2e", ...changes };
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    data.append("referenceImages", new File([Buffer.from(png, "base64")], "gloves.png", { type: "image/png" }));
    return data;
  };
  const post = async (path, data) => {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", body: data });
    const source = await response.text();
    return { response, source, events: events(source) };
  };
  const preview = await post("/api/creation/plan", form());
  assert.equal(preview.response.status, 200, preview.source);
  const plan = JSON.parse(preview.source).plan;
  assert.equal(planningCalls, 1);
  assert.equal(plan.items.length, 20);
  assert.ok(plan.items.every((item) => item.enabled && !item.evidenceBlocked));
  assert.equal(plan.productInsights.audienceSegments.length, 3);
  assert.ok(plan.items.every((item) => surfaceLocks.every((lock) => item.prompt.includes(lock))));
  const generated = await post("/api/creation/generate", form({ effectivePlan: JSON.stringify(plan) }));
  assert.deepEqual(generated.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], generated.source);
  assert.equal(planningCalls, 1, "preview is reused without another planning call");
  assert.equal(imageRequests.length, 20);
  assert.ok(imageRequests.every((request) => surfaceLocks.every((lock) => requestTexts(request).some((text) => text.includes(lock)))), "surface ownership reaches every billable image request");
  for (const item of plan.items) assert.ok(imageRequests.some((request) => requestTexts(request).some((text) => text.includes(item.prompt))), item.itemId);
  const completed = generated.events.findLast((entry) => entry.event === "complete")?.data.set;
  assert.ok(completed, generated.source);
  const store = createCreationSetStore({ outputDir });
  const saved = await store.readManifest(completed.setId);
  assert.equal(saved.promptPlanningMode, "ai-batch");
  assert.deepEqual(saved.items[0].marketingAssignment, plan.items[0].marketingAssignment);
  assert.deepEqual(saved.items[0].promptContext, plan.items[0].promptContext);
  const target = saved.items[0];
  await store.saveManifest({ ...saved, items: saved.items.map((item) => item.itemId === target.itemId ? { ...item, status: "failed", error: "local repair test" } : item) });
  const repaired = await post("/api/creation/repair", form({ setId: saved.setId, itemId: target.itemId }));
  assert.deepEqual(repaired.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], repaired.source);
  assert.equal(planningCalls, 1);
  assert.equal(imageRequests.length, 21);
  assert.ok(requestTexts(imageRequests.at(-1)).some((text) => text.includes(target.prompt)));
  const changed = await post("/api/creation/generate", form({ effectivePlan: JSON.stringify(plan), productDescription: "changed product" }));
  assert.ok(changed.events.some((entry) => entry.event === "error" && /重新预览/.test(entry.data.message)), changed.source);
  assert.equal(imageRequests.length, 21);
  invalidCount = true;
  const invalid = await post("/api/creation/plan", form());
  assert.equal(invalid.response.status, 400, invalid.source);
  assert.match(invalid.source, /20 条.*18 条/);
  assert.equal(imageRequests.length, 21);
  const beforeTemplate = planningCalls;
  const template = await post("/api/creation/plan", form({ aiMarketingEnabled: false, imageCount: 6 }));
  assert.equal(template.response.status, 200, template.source);
  assert.equal(planningCalls, beforeTemplate);

  invalidCount = false;
  repairReferences = true;
  analysisOnlyResponses = 1;
  const nineReferenceForm = (changes = {}) => {
    const data = form({ referenceImageRoles: Array.from({ length: 9 }, (_, index) => ({ index: index + 1, filename: `reference-${index + 1}.png`, role: index === 8 ? "reference-product" : "feature", ...(index === 8 ? { roleManuallyEdited: true } : {}) })), ...changes });
    data.delete("referenceImages");
    for (let index = 1; index <= 9; index += 1) data.append("referenceImages", new File([Buffer.from(png, "base64")], `reference-${index}.png`, { type: "image/png" }));
    return data;
  };
  const nineReferencePreview = await post("/api/creation/plan", nineReferenceForm());
  assert.equal(nineReferencePreview.response.status, 200, nineReferencePreview.source);
  const repairedPlan = JSON.parse(nineReferencePreview.source).plan;
  assert.equal(planningCalls, beforeTemplate + 2, "analysis-only response is repaired as one whole-set retry");
  assert.equal(repairedPlan.items.length, 20);
  assert.equal(repairedPlan.marketingPlan.primaryReferenceIndex, 9);
  assert.ok(repairedPlan.items.every((item) => JSON.stringify(item.marketingAssignment.referenceIndexes) === "[9,2,3]"));
  const beforeRepairedGeneration = planningCalls;
  const generatedWithNineReferences = await post("/api/creation/generate", nineReferenceForm({ effectivePlan: JSON.stringify(repairedPlan) }));
  assert.deepEqual(generatedWithNineReferences.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], generatedWithNineReferences.source);
  assert.equal(planningCalls, beforeRepairedGeneration, "fixed preview is reused without replanning");
  assert.equal(imageRequests.length, 41);
  for (const request of imageRequests.slice(-20)) {
    const texts = requestTexts(request);
    assert.ok(texts.some((text) => text.includes("Reference 9:")));
    assert.ok(texts.some((text) => text.includes("Reference 2:")));
    assert.ok(texts.some((text) => text.includes("Reference 3:")));
    assert.equal(request.input.flatMap((entry) => entry.content || []).filter((part) => part.type === "input_image").length, 3);
  }
  repairReferences = false;
  const beforeDirectPlanning = planningCalls;
  const direct = await post("/api/creation/generate", form({ imageCount: 4 }));
  assert.deepEqual(direct.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], direct.source);
  assert.equal(planningCalls, beforeDirectPlanning + 1);
  assert.equal(imageRequests.length, 45);
  const directSet = direct.events.findLast((entry) => entry.event === "complete")?.data.set;
  assert.equal(directSet?.items.length, 4, direct.source);
  assert.ok(directSet.items.every((item) => item.status === "completed" && !item.evidenceBlocked));
});
