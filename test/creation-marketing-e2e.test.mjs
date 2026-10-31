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
import { consumeSse } from "../lib/generation-client.mjs";
import { getCreationPlatformImageType } from "../lib/creation-platform-policies.mjs";

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
  let invalidFact = false;
  let invalidFactIndexes = [12];
  let recoverInvalidFact = false;
  let repairReferences = false;
  let assignAllReferences = false;
  let analysisOnlyResponses = 0;
  let streamPlanning = false;
  let releasePlanning = null;
  let omitFunctionalEffect = false;
  let rejectQualityRepairs = false;
  let invalidStrategy = false;
  let unsupportedFunction = false;
  const imageRequests = [];
  const upstream = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/") { response.writeHead(200); response.end("ok"); return; }
    const parts = [];
    for await (const chunk of request) parts.push(chunk);
    if (request.url.endsWith("/files")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "file-marketing-primary", object: "file" }));
      return;
    }
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (body.text?.format?.name === "creation_marketing_plan_json") {
      planningCalls += 1;
      const context = JSON.parse(body.input[0].content.find((entry) => entry.type === "input_text" && entry.text.startsWith("{\"task_count\"")).text);
      const { payload } = marketingPlanFixture(context.repair_request?.original_task_count || context.task_count);
      payload.product_insights.confirmed_facts = payload.product_insights.confirmed_facts.filter((fact) => !["spec", "package"].includes(fact.kind));
      (omitFunctionalEffect ? [] : ["variant-comparison", "dimension-fit", "in-box", "spec-table"]).forEach((imageType, index) => {
        const position = [0, 2, 3, 4][index];
        if (payload.items[position]) payload.items[position].image_type = imageType;
      });
      payload.product_insights.appearance_locks = surfaceLocks.map((text) => ({ text, reference_indexes: [1] }));
      if (repairReferences) {
        payload.reference_roles = context.references.map((entry) => ({ ...entry, role: entry.index === 1 ? "product" : "feature" }));
        payload.product_insights.appearance_locks.forEach((entry) => { entry.reference_indexes = [9]; });
        payload.product_insights.confirmed_facts.forEach((fact) => { fact.reference_indexes = fact.id === "appearance" ? [9] : fact.id === "control" ? [2] : [3]; });
        payload.items.forEach((item) => { item.reference_indexes = assignAllReferences ? context.references.map((entry) => entry.index) : [3]; });
      }
      if (analysisOnlyResponses > 0) { delete payload.items; analysisOnlyResponses -= 1; }
      if (invalidCount) payload.items.splice(18);
      if (invalidFact && (!context.repair_request || !recoverInvalidFact)) {
        invalidFactIndexes.forEach((index) => { if (payload.items[index]) payload.items[index].fact_ids.push("missing-fact"); });
      }
      if (omitFunctionalEffect && (!context.repair_request || rejectQualityRepairs)) {
        payload.items[1].creative_brief.effect_visual = "";
        payload.items[1].prompt = "完整商品居中陈列，周围是参数文字和温暖背景。";
      }
      if (invalidStrategy) payload.suite_strategy.primary_fact_ids = ["invented-strategy-fact"];
      if (unsupportedFunction) {
        payload.product_insights.confirmed_facts.forEach((fact) => { fact.kind = "appearance"; });
        payload.suite_strategy = { core_buying_reason: "核对已确认外观", primary_fact_ids: ["appearance"], functional_proofs: [] };
      }
      if (context.repair_request) payload.items = payload.items.filter((item) => context.repair_request.target_item_ids.includes(item.item_id));
      if (streamPlanning) {
        response.writeHead(200, { "content-type": "text/event-stream" });
        const source = JSON.stringify(payload);
        const split = source.indexOf(',{"item_id":"ai-2"');
        const send = (value) => response.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: value })}\n\n`);
        send(source.slice(0, split));
        await new Promise((done) => { releasePlanning = done; });
        send(source.slice(split));
        response.end("data: [DONE]\n\n");
        return;
      }
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
  const cachedPreview = await post("/api/creation/plan", form());
  assert.equal(cachedPreview.response.status, 200);
  assert.equal(planningCalls, 1, "same session and identical inputs reuse the valid preview");
  assert.equal(plan.items.length, 20);
  assert.equal(plan.marketingPlan.requestTrace.postCount, 1);
  assert.equal(plan.marketingPlan.requestTrace.calls[0].transport, "buffered");
  assert.ok(Number.isFinite(plan.marketingPlan.requestTrace.validationMs));
  assert.ok(plan.items.every((item) => item.enabled && !item.evidenceBlocked));
  assert.equal(plan.productInsights.audienceSegments.length, 3);
  assert.ok(plan.items.every((item) => item.prompt.startsWith("PRODUCT FIDELITY: gloves.png") &&
    (["series-showcase", "size-capacity-fit", "spec-table"].includes(item.role)
      ? item.prompt.includes("each supplied variant from its own matching reference")
      : item.prompt.startsWith("PRODUCT FIDELITY: gloves.png is the product:"))));
  assert.ok(plan.items.every((item) => surfaceLocks.every((lock) => !item.prompt.includes(lock))));
  assert.equal(Object.hasOwn(plan.productInsights, "appearanceLocks"), false);
  const generated = await post("/api/creation/generate", form({ effectivePlan: JSON.stringify(plan) }));
  assert.deepEqual(generated.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], generated.source);
  assert.equal(planningCalls, 1, "preview is reused without another planning call");
  assert.equal(imageRequests.length, 20);
  assert.ok(imageRequests.every((request) => requestTexts(request).some((text) => text.includes("PRODUCT FIDELITY:"))), "primary reference fidelity reaches every image request");
  assert.ok(imageRequests.every((request) => surfaceLocks.every((lock) => requestTexts(request).every((text) => !text.includes(lock)))), "legacy analysis locks cannot re-enter image requests");
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
  const invalid = await post("/api/creation/plan", form({ variationSeed: "invalid-count-test" }));
  assert.equal(invalid.response.status, 200, invalid.source);
  assert.equal(JSON.parse(invalid.source).plan.marketingPlan.validation.missingCount, 2);
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
  assert.deepEqual(direct.events.filter((entry) => entry.event === "marketing_progress").map((entry) => entry.data.stage), ["preparing", "waiting", "connected", "connected", "buffered", "validating", "complete"]);
  assert.ok(generated.events.some((entry) => entry.event === "marketing_progress" && entry.data.stage === "reused"));
  assert.equal(repaired.events.some((entry) => entry.event === "marketing_progress"), false, "repair does not replay planning");

  streamPlanning = true;
  const beforeStreaming = planningCalls;
  const streamingResponse = await fetch(`${baseUrl}/api/creation/plan`, { method: "POST", headers: { Accept: "text/event-stream" }, body: form({ variationSeed: "progress-test" }) });
  assert.match(streamingResponse.headers.get("content-type"), /text\/event-stream/);
  const streamed = [];
  let incremental = false;
  const unblock = setTimeout(() => releasePlanning?.(), 5000);
  try {
    await consumeSse(streamingResponse.body, (event, data) => {
      streamed.push({ event, data });
      if (event === "marketing_progress" && data.stage === "receiving" && data.receivedCount === 1) {
        incremental = true;
        assert.equal(streamed.some((entry) => entry.event === "complete"), false);
        assert.equal(data.total, 20);
        assert.ok(data.summary.audiences.length);
        assert.equal(typeof data.text, "string", "safe answer draft is streamed before the complete plan");
        assert.doesNotMatch(data.text, /PRIVATE_REASONING/);
        assert.ok(Number.isFinite(data.timing.firstByteMs));
        assert.ok(Number.isFinite(data.timing.firstTextMs));
        assert.equal(data.requestTrace.postCount, 1);
        releasePlanning();
      }
    });
  } finally { clearTimeout(unblock); releasePlanning?.(); }
  assert.equal(incremental, true, "progress must arrive before releasing the upstream final response");
  assert.equal(planningCalls, beforeStreaming + 1);
  const streamedPlan = streamed.find((entry) => entry.event === "complete")?.data.plan;
  assert.equal(streamedPlan?.items.length, 20);
  assert.equal(streamedPlan.marketingPlan.requestTrace.calls[0].transport, "stream");
  assert.ok(Number.isFinite(streamedPlan.marketingPlan.requestTrace.calls[0].timing.totalMs));
  // 两个真实 HTTP 消费者合并；首个客户端断开不能取消另一个消费者。
  releasePlanning = null;
  const beforeShared = planningCalls;
  const abortShared = new AbortController();
  const firstShared = await fetch(`${baseUrl}/api/creation/plan`, { method: "POST", headers: { Accept: "text/event-stream" }, signal: abortShared.signal, body: form({ variationSeed: "shared-cancel-test" }) });
  const secondShared = await fetch(`${baseUrl}/api/creation/plan`, { method: "POST", headers: { Accept: "text/event-stream" }, body: form({ variationSeed: "shared-cancel-test" }) });
  const sharedEvents = [];
  let joined;
  const joinedPromise = new Promise((resolve) => { joined = resolve; });
  const sharedResult = consumeSse(secondShared.body, (event, data) => {
    sharedEvents.push({ event, data });
    if (event === "marketing_progress" && data.stage === "receiving") joined();
  });
  const sharedDeadline = setTimeout(() => releasePlanning?.(), 5000);
  try {
    await Promise.race([joinedPromise, delay(3000).then(() => { throw new Error("shared consumer did not receive progress"); })]);
    abortShared.abort();
    await firstShared.body.cancel().catch(() => {});
    releasePlanning();
    await sharedResult;
  } finally { clearTimeout(sharedDeadline); releasePlanning?.(); }
  assert.equal(planningCalls, beforeShared + 1);
  assert.equal(sharedEvents.find((entry) => entry.event === "complete")?.data.plan.items.length, 20);
  assert.equal(sharedEvents.some((entry) => entry.event === "error"), false);
  streamPlanning = false;
  const equivalent = await post("/api/creation/plan", form({ variationSeed: "progress-test" }));
  assert.deepEqual(streamedPlan.items, JSON.parse(equivalent.source).plan.items, "SSE and JSON preserve identical final prompts and bindings");
  invalidCount = true;
  const failedResponse = await fetch(`${baseUrl}/api/creation/plan`, { method: "POST", headers: { Accept: "text/event-stream" }, body: form({ variationSeed: "invalid-count-stream-test" }) });
  const failed = events(await failedResponse.text());
  assert.ok(failed.some((entry) => entry.event === "marketing_progress" && entry.data.stage === "partial"));
  assert.equal(failed.find((entry) => entry.event === "complete")?.data.plan.imageCount, 18);
  assert.equal(imageRequests.length, 45, "preview progress never starts image generation");

  invalidCount = false;
  invalidFact = true;
  const beforePartial = planningCalls;
  const partialPreview = await post("/api/creation/plan", form({ imageCount: 18 }));
  assert.equal(partialPreview.response.status, 200, partialPreview.source);
  const partialPlan = JSON.parse(partialPreview.source).plan;
  assert.equal(partialPlan.imageCount, 17);
  assert.equal(partialPlan.marketingPlan.validation.removedItems[0].sourceIndex, 13);
  const partialGeneration = await post("/api/creation/generate", form({ imageCount: 17, effectivePlan: JSON.stringify(partialPlan) }));
  assert.deepEqual(partialGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], partialGeneration.source);
  assert.equal(planningCalls, beforePartial + 3, "bounded preview repair is followed by frozen generation without replanning");
  assert.equal(imageRequests.length, 62, "only the seventeen valid prompts become image requests");
  const partialSet = partialGeneration.events.findLast((entry) => entry.event === "complete")?.data.set;
  const partialSaved = await store.readManifest(partialSet.setId);
  assert.equal(partialSaved.imageCount, 17);
  assert.deepEqual(partialSaved.marketingPlan.validation, partialPlan.marketingPlan.validation);
  assert.equal(partialSaved.items.some((item) => item.itemId === "ai-13"), false);
  assert.deepEqual(partialSaved.items.map((item) => item.prompt), partialPlan.items.map((item) => item.prompt));
  const partialTarget = partialSaved.items[12];
  await store.saveManifest({ ...partialSaved, items: partialSaved.items.map((item) => item.itemId === partialTarget.itemId ? { ...item, status: "failed", error: "partial repair test" } : item) });
  const partialRepair = await post("/api/creation/repair", form({ setId: partialSet.setId, itemId: partialTarget.itemId }));
  assert.deepEqual(partialRepair.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], partialRepair.source);
  assert.equal(imageRequests.length, 63);
  assert.equal(planningCalls, beforePartial + 3);
  const changedPartial = await post("/api/creation/generate", form({ imageCount: 17, effectivePlan: JSON.stringify(partialPlan), productDescription: "changed partial product" }));
  assert.ok(changedPartial.events.some((entry) => entry.event === "error" && /重新预览/.test(entry.data.message)));
  assert.equal(imageRequests.length, 63);
  const { payload: rolePayload } = marketingPlanFixture(18);
  ["variant-comparison", "dimension-fit", "in-box", "spec-table"].forEach((imageType, index) => { rolePayload.items[[0, 2, 3, 4][index]].image_type = imageType; });
  const selectedRoles = rolePayload.items.map((item) => getCreationPlatformImageType(item.image_type).role);
  const rolePreview = await post("/api/creation/plan", form({ imageCount: 18, selectedRoles }));
  assert.equal(rolePreview.response.status, 200, rolePreview.source);
  const rolePlan = JSON.parse(rolePreview.source).plan;
  const rolePlanningCalls = planningCalls;
  const roleGeneration = await post("/api/creation/generate", form({ imageCount: 17, selectedRoles: rolePlan.marketingPlan.effectiveSelectedRoles, effectivePlan: JSON.stringify(rolePlan) }));
  assert.deepEqual(roleGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], roleGeneration.source);
  assert.equal(planningCalls, rolePlanningCalls, "selected roles keep their original mapping after the middle task is removed");
  assert.equal(imageRequests.length, 80);

  invalidFact = false;
  omitFunctionalEffect = true;
  const beforeQuality = planningCalls;
  const qualityFields = { imageCount: 4, productDescription: "卡其色一双手套；功能覆盖循环验证" };
  const qualityPreview = await post("/api/creation/plan", form(qualityFields));
  assert.equal(qualityPreview.response.status, 200, qualityPreview.source);
  const qualityPlan = JSON.parse(qualityPreview.source).plan;
  assert.equal(planningCalls, beforeQuality + 2, "one initial request plus one local quality repair");
  assert.equal(qualityPlan.marketingPlan.quality.repairRounds, 1);
  assert.equal(qualityPlan.marketingPlan.quality.functionalCoverage.covered, true);
  const qualityGeneration = await post("/api/creation/generate", form({ ...qualityFields, effectivePlan: JSON.stringify(qualityPlan) }));
  assert.deepEqual(qualityGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], qualityGeneration.source);
  assert.equal(planningCalls, beforeQuality + 2, "generation reuses the repaired preview without another model pass");
  assert.equal(imageRequests.length, 84);
  assert.ok(imageRequests.slice(80).some((request) => requestTexts(request).some((text) => text.includes("半透明暖色热流示意"))));
  const qualitySet = qualityGeneration.events.findLast((entry) => entry.event === "complete")?.data.set;
  const qualitySaved = await store.readManifest(qualitySet.setId);
  assert.deepEqual(qualitySaved.marketingPlan.quality, qualityPlan.marketingPlan.quality);
  assert.deepEqual(qualitySaved.items.map((item) => item.prompt), qualityPlan.items.map((item) => item.prompt));
  const qualityTarget = qualitySaved.items[1];
  await store.saveManifest({ ...qualitySaved, items: qualitySaved.items.map((item) => item.itemId === qualityTarget.itemId ? { ...item, status: "failed", error: "quality repair persistence test" } : item) });
  const qualityRepair = await post("/api/creation/repair", form({ setId: qualitySet.setId, itemId: qualityTarget.itemId }));
  assert.deepEqual(qualityRepair.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], qualityRepair.source);
  assert.equal(planningCalls, beforeQuality + 2);
  assert.equal(imageRequests.length, 85);

  rejectQualityRepairs = true;
  const beforeRejected = planningCalls;
  const warningPreview = await post("/api/creation/plan", form({ imageCount: 5 }));
  assert.equal(warningPreview.response.status, 200, warningPreview.source);
  const warningPlan = JSON.parse(warningPreview.source).plan;
  assert.equal(warningPlan.marketingPlan.quality.status, "warning");
  assert.equal(warningPlan.imageCount, 5);
  assert.equal(planningCalls, beforeRejected + 3, "unresolved quality stops after the bounded two repair rounds");
  assert.equal(imageRequests.length, 85, "preview still never posts images");
  const warningGeneration = await post("/api/creation/generate", form({ imageCount: 5, effectivePlan: JSON.stringify(warningPlan) }));
  assert.deepEqual(warningGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], warningGeneration.source);
  assert.equal(planningCalls, beforeRejected + 3, "advice does not trigger replanning when generating");
  assert.equal(imageRequests.length, 90);
  const warningSet = warningGeneration.events.findLast((entry) => entry.event === "complete")?.data.set;
  const warningSaved = await store.readManifest(warningSet.setId);
  assert.deepEqual(warningSaved.marketingPlan.quality, warningPlan.marketingPlan.quality);

  omitFunctionalEffect = false;
  rejectQualityRepairs = false;
  invalidStrategy = true;
  const beforeStrategy = planningCalls;
  const strategyFields = { imageCount: 4, productDescription: "卡其色一双手套；策略字段降级验证" };
  const strategyPreview = await post("/api/creation/plan", form(strategyFields));
  assert.equal(strategyPreview.response.status, 200, strategyPreview.source);
  const strategyPlan = JSON.parse(strategyPreview.source).plan;
  assert.equal(strategyPlan.marketingPlan.suiteStrategy, null);
  assert.equal(strategyPlan.marketingPlan.quality.status, "warning");
  assert.equal(planningCalls, beforeStrategy + 3);
  const strategyGeneration = await post("/api/creation/generate", form({ ...strategyFields, effectivePlan: JSON.stringify(strategyPlan) }));
  assert.deepEqual(strategyGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], strategyGeneration.source);
  assert.equal(planningCalls, beforeStrategy + 3, "discarded strategy metadata cannot reblock generation");
  assert.equal(imageRequests.length, 94);

  invalidStrategy = false;
  unsupportedFunction = true;
  const beforeUnsupported = planningCalls;
  const unsupportedFields = { imageCount: 4, productDescription: "卡其色一双手套；单项隔离降级验证" };
  const unsupportedPreview = await post("/api/creation/plan", form(unsupportedFields));
  assert.equal(unsupportedPreview.response.status, 200, unsupportedPreview.source);
  const unsupportedPlan = JSON.parse(unsupportedPreview.source).plan;
  assert.equal(unsupportedPlan.imageCount, 3);
  assert.deepEqual(unsupportedPlan.items.map((item) => item.marketingAssignment.sourceIndex), [1, 3, 4]);
  assert.equal(unsupportedPlan.marketingPlan.validation.removedItems[0].sourceIndex, 2);
  assert.equal(planningCalls, beforeUnsupported + 3);
  const unsupportedGeneration = await post("/api/creation/generate", form({ ...unsupportedFields, imageCount: 3, effectivePlan: JSON.stringify(unsupportedPlan) }));
  assert.deepEqual(unsupportedGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], unsupportedGeneration.source);
  assert.equal(planningCalls, beforeUnsupported + 3);
  assert.equal(imageRequests.length, 97, "only the three valid images are posted");
  const unsupportedSet = unsupportedGeneration.events.findLast((entry) => entry.event === "complete")?.data.set;
  const unsupportedSaved = await store.readManifest(unsupportedSet.setId);
  assert.equal(unsupportedSaved.items.length, 3);
  assert.ok(!unsupportedSaved.items.some((item) => item.itemId === "ai-2"));
  assert.deepEqual(unsupportedSaved.items.map((item) => item.prompt), unsupportedPlan.items.map((item) => item.prompt));

  unsupportedFunction = false;
  invalidFact = true;
  recoverInvalidFact = true;
  invalidFactIndexes = [0, 2, 3, 6, 7, 8, 11, 12, 15, 16];
  const beforeRecovered = planningCalls;
  const beforeRecoveredImages = imageRequests.length;
  const recoveredFields = { imageCount: 18, selectedRoles, productDescription: "卡其色一双手套；多条方向事实修复验证" };
  const recoveredPreview = await post("/api/creation/plan", form(recoveredFields));
  assert.equal(recoveredPreview.response.status, 200, recoveredPreview.source);
  const recoveredPlan = JSON.parse(recoveredPreview.source).plan;
  assert.equal(planningCalls, beforeRecovered + 2, "ten rejected directions share one local repair request");
  assert.equal(recoveredPlan.imageCount, 18);
  assert.equal(recoveredPlan.marketingPlan.version, 5);
  assert.equal(recoveredPlan.marketingPlan.validation.removedItems.length, 0);
  assert.deepEqual(recoveredPlan.items.map((item) => item.marketingAssignment.sourceIndex), Array.from({ length: 18 }, (_, index) => index + 1));
  assert.deepEqual(recoveredPlan.items.map((item) => item.role), selectedRoles);
  const recoveredGeneration = await post("/api/creation/generate", form({ ...recoveredFields, effectivePlan: JSON.stringify(recoveredPlan) }));
  assert.deepEqual(recoveredGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], recoveredGeneration.source);
  assert.equal(planningCalls, beforeRecovered + 2, "repaired plan generation does not replan");
  assert.equal(imageRequests.length, beforeRecoveredImages + 18);
  const recoveredSet = recoveredGeneration.events.findLast((entry) => entry.event === "complete")?.data.set;
  const recoveredSaved = await store.readManifest(recoveredSet.setId);
  assert.deepEqual(recoveredSaved.items.map((item) => item.prompt), recoveredPlan.items.map((item) => item.prompt));
  assert.ok(!JSON.stringify(recoveredSaved.items.map((item) => item.marketingAssignment)).includes("missing-fact"));

  invalidFact = false;
  repairReferences = true;
  assignAllReferences = true;
  const allReferenceFields = { imageCount: 1, variationSeed: "no-eight-reference-cap" };
  const allReferencePreview = await post("/api/creation/plan", nineReferenceForm(allReferenceFields));
  assert.equal(allReferencePreview.response.status, 200, allReferencePreview.source);
  const allReferencePlan = JSON.parse(allReferencePreview.source).plan;
  const indexes = allReferencePlan.items[0].marketingAssignment.referenceIndexes;
  assert.equal(indexes[0], 9);
  assert.deepEqual([...indexes].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const beforeAllReferenceGeneration = planningCalls;
  const allReferenceGeneration = await post("/api/creation/generate", nineReferenceForm({ ...allReferenceFields, effectivePlan: JSON.stringify(allReferencePlan) }));
  assert.deepEqual(allReferenceGeneration.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], allReferenceGeneration.source);
  assert.equal(imageRequests.at(-1).input.flatMap((entry) => entry.content || []).filter((part) => part.type === "input_image").length, 9);
  const allReferenceSet = allReferenceGeneration.events.findLast((entry) => entry.event === "complete")?.data.set;
  const allReferenceSaved = await store.readManifest(allReferenceSet.setId);
  assert.deepEqual(allReferenceSaved.items[0].marketingAssignment.referenceIndexes, indexes);
  await store.saveManifest({ ...allReferenceSaved, items: allReferenceSaved.items.map((item) => ({ ...item, status: "failed", error: "reference count repair test" })) });
  const allReferenceRepair = await post("/api/creation/repair", nineReferenceForm({ ...allReferenceFields, setId: allReferenceSet.setId, itemId: allReferenceSaved.items[0].itemId }));
  assert.deepEqual(allReferenceRepair.events.filter((entry) => ["error", "item_failed"].includes(entry.event)), [], allReferenceRepair.source);
  assert.equal(imageRequests.at(-1).input.flatMap((entry) => entry.content || []).filter((part) => part.type === "input_image").length, 9);
  assert.equal(planningCalls, beforeAllReferenceGeneration, "nine-reference generation and repair reuse the frozen plan");
});
