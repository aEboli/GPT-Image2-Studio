import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { createCreationSetStore } from "../lib/creation-store.mjs";
import { consumeSse } from "../lib/generation-client.mjs";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const serverUrl = new URL("../server.mjs", import.meta.url).href;
const fixtureKey = "sk-listing-local-fixture-only";
const keywords = { exact: ["blue lure"], longTail: [], traffic: [], descriptive: [] };
const listing = {
  title: "2 Pack Blue Fishing Lures",
  sellingPoints: ["Blue lures with a long body."],
  painPoints: ["This pack contains two blue lures."],
  fiveBullets: ["COLOR: Blue."],
  description: "Two blue lures with a long body.",
  backendSearchTerms: "blue lure",
  keywordBuckets: keywords,
  packageDimensions: "Estimated: 15 x 10 x 5 cm",
  productDimensions: "9 cm long",
  packageWeight: "Estimated: 350 g",
  productWeight: "Estimated: 250 g",
  warnings: [],
  missingInfo: [],
  deDisplay: {
    title: "2 Stück blaue Angelköder",
    sellingPoints: ["Blaue Köder mit länglichem Körper."],
    painPoints: ["Die Packung enthält zwei blaue Köder."],
    fiveBullets: ["FARBE: Blau."],
    description: "Zwei blaue Köder mit länglichem Körper und größerer Öse.",
    backendSearchTerms: "angelköder blau öse",
    keywordBuckets: { ...keywords, exact: ["blaue Angelköder"] },
    packageDimensions: "Geschätzt: 15 x 10 x 5 cm",
    productDimensions: "9 cm Länge",
    packageWeight: "Geschätzt: 350 g",
    productWeight: "Geschätzt: 250 g",
    warnings: [],
    missingInfo: [],
  },
  zhDisplay: {
    title: "2件装蓝色鱼饵",
    sellingPoints: ["蓝色鱼饵，长条形饵身。"],
    painPoints: ["每包包含两件蓝色鱼饵。"],
    fiveBullets: ["颜色：蓝色。"],
    description: "两件蓝色鱼饵，长条形饵身。",
    backendSearchTerms: "蓝色鱼饵",
    keywordBuckets: { ...keywords, exact: ["蓝色鱼饵"] },
    packageDimensions: "预估：15 x 10 x 5 厘米",
    productDimensions: "长9厘米",
    packageWeight: "预估：350克",
    productWeight: "预估：250克",
    warnings: [],
    missingInfo: [],
  },
};

async function waitFor(predicate, label, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `等待超时：${label}`);
    await delay(10);
  }
}

const bootstrap = `
  import fs from "node:fs/promises";
  import { syncBuiltinESMExports } from "node:module";
  import { basename, dirname, resolve } from "node:path";
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== process.env.LISTING_TEST_UPSTREAM || !["/v1/responses", "/v1/chat/completions", "/v2/responses"].includes(url.pathname)) {
      process.send({ kind: "blocked-fetch" });
      throw new Error("测试阻止了非 mock 上游请求");
    }
    return fetchOriginal(input, init);
  };
  const renameOriginal = fs.rename;
  const manifestDir = resolve(process.env.IMAGE_STUDIO_OUTPUT_DIR, "json", "creation-sets");
  fs.rename = async (source, destination) => {
    const result = await renameOriginal(source, destination);
    if (dirname(resolve(String(destination))) === manifestDir) process.send({ kind: "saved", file: basename(String(destination)) });
    return result;
  };
  syncBuiltinESMExports();
  process.on("message", (message) => {
    if (message.kind === "barrier") process.send({ kind: "barrier", id: message.id });
  });
  const server = await import(${JSON.stringify(serverUrl)});
  process.send({ kind: "ready", url: server.studioServerUrl });
`;

async function createFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "creation-listing-scheduler-server-"));
  const outputDir = join(directory, "output");
  const store = createCreationSetStore({ outputDir });
  const calls = [];
  const messages = [];
  const pending = [];
  let active = 0;
  let peak = 0;
  let child;
  let diagnostics = "";
  const upstream = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      assert.equal(request.method, "POST");
      assert.ok(["/v1/responses", "/v1/chat/completions", "/v2/responses"].includes(request.url));
      const call = { body: JSON.parse(Buffer.concat(chunks).toString("utf8")), path: request.url, response, startedAt: Date.now(), closed: false };
      active += 1;
      peak = Math.max(peak, active);
      const finish = () => {
        if (call.closed) return;
        call.closed = true;
        active -= 1;
      };
      response.once("finish", finish);
      response.once("close", finish);
      calls.push(call);
    } catch (error) {
      diagnostics += `\nMock: ${error.stack}`;
      response.destroy();
    }
  });
  t.after(async () => {
    for (const request of pending) request.controller.abort();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await Promise.race([exited, delay(2000)]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    }
    upstream.closeAllConnections();
    if (upstream.listening) await new Promise((done) => upstream.close(done));
    await Promise.allSettled(pending.map((request) => request.done));
    const offset = relative(resolve(tmpdir()), resolve(directory));
    assert.ok(offset && !isAbsolute(offset) && offset !== ".." && !offset.startsWith("../") && !offset.startsWith("..\\"));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    assert.equal(messages.filter((message) => message.kind === "blocked-fetch").length, 0, "不应尝试访问 mock 以外的上游");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|LANG|LC_ALL)$/i.test(key)));
  child = spawn(process.execPath, ["--input-type=module", "--eval", bootstrap], {
    cwd: projectDir,
    windowsHide: true,
    env: {
      ...env, HOST: "127.0.0.1", PORT: "0", VERCEL: "1", NODE_ENV: "test",
      IMAGE_STUDIO_OUTPUT_DIR: outputDir, IMAGE_STUDIO_LOCAL_DATA_DIR: join(directory, "localData"),
      IMAGE_STUDIO_REQUEST_TOKEN: "listing-integration-fixture-token", IMAGE_STUDIO_MOCK_LISTING_AGENT: "0",
      LISTING_TEST_UPSTREAM: upstreamUrl, TEMP: directory, TMP: directory, TMPDIR: directory,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.stdout.on("data", (value) => { diagnostics += value; });
  child.stderr.on("data", (value) => { diagnostics += value; });
  child.on("message", (message) => messages.push(message));
  child.on("error", (error) => { diagnostics += error.stack; });
  await waitFor(() => messages.some((message) => message.kind === "ready") || child.exitCode !== null || child.signalCode !== null, "隔离服务启动");
  const baseUrl = messages.find((message) => message.kind === "ready")?.url;
  assert.ok(baseUrl, diagnostics);

  function start(setId, { stream = true, batchId = "batch-fixture", ...config } = {}) {
    const controller = new AbortController();
    const request = { controller, events: [], result: null, error: null };
    request.done = (async () => {
      const response = await fetch(`${baseUrl}/api/creation/listings`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(stream ? { Accept: "text/event-stream" } : {}) },
        body: JSON.stringify({ setId, batchId, imageRoute: "a", baseUrl: `${upstreamUrl}/v1`, endpointPath: "/responses", apiKey: fixtureKey, responsesModel: "listing-fixture", reasoningEffort: "high", ...config }),
      });
      request.status = response.status;
      if (stream) {
        assert.match(response.headers.get("content-type"), /text\/event-stream/);
        await consumeSse(response.body, (event, data) => {
          request.events.push({ event, data });
          if (event === "complete" || event === "error") request.result = data;
        });
      } else request.result = await response.json();
      return request;
    })().catch((error) => { request.error = error; return request; });
    pending.push(request);
    return request;
  }

  async function seed(setId, extra = {}) {
    return store.saveManifest({ setId, productName: "Blue Fishing Lure", productDescription: "Blue lures with a long body.", skuBundleCount: 2, dimensionSpecs: "9 cm", dimensionUnitMode: "metric", status: "completed", items: [], ...extra });
  }
  async function savedCount(setId) {
    const id = messages.length;
    child.send({ kind: "barrier", id });
    await waitFor(() => messages.some((message) => message.kind === "barrier" && message.id === id), "保存计数同步");
    return messages.filter((message) => message.kind === "saved" && message.file === `${setId}.json`).length;
  }
  return { seed, start, store, calls, messages, savedCount, upstreamUrl, get peak() { return peak; }, get active() { return active; } };
}

function sendEvent(call, payload) {
  if (!call.response.headersSent) call.response.writeHead(200, { "Content-Type": "text/event-stream" });
  call.response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function succeed(call, stream = false) {
  if (stream) {
    sendEvent(call, { type: "response.output_text.delta", delta: JSON.stringify(listing) });
    sendEvent(call, { type: "response.completed", response: { usage: { input_tokens: 12, output_tokens: 34 } } });
    call.response.end();
  } else {
    call.response.writeHead(200, { "Content-Type": "application/json" });
    call.response.end(JSON.stringify({ output_text: JSON.stringify(listing) }));
  }
}

function reject(call, status, error, retryAfter = "0") {
  call.response.writeHead(status, { "Content-Type": "application/json", "Retry-After": retryAfter });
  call.response.end(JSON.stringify({ error }));
}

function assertCompleted(request) {
  assert.equal(request.error, null, request.error?.stack);
  assert.equal(request.status, 200);
  assert.equal(request.result?.ok, true, JSON.stringify(request.result));
  assert.equal(request.result.listingDrafts.length, 1);
  assert.equal(request.result.listingDrafts[0].status, "completed");
}

function progress(request, stage) {
  return request.events.find(({ event, data }) => event === "text_progress" && data.stage === stage)?.data;
}

test("Listing 服务端调度集成（独立端口、临时资产、本机上游）", { timeout: 120000 }, async (t) => {
  await t.test("不同套图与入口共享三个 HTTP 槽位，排队事件携带各自 setId/batchId", async (t) => {
    const fixture = await createFixture(t);
    const ids = Array.from({ length: 7 }, (_, index) => `parallel-${index}`);
    for (const id of ids) await fixture.seed(id);
    const requests = ids.map((id, index) => fixture.start(id, { stream: index !== 0, batchId: `batch-${index}` }));
    await waitFor(() => fixture.calls.length >= 3 && requests.slice(1).every((request) => progress(request, "queued")), "三个上游请求与排队事件");
    assert.equal(fixture.calls.length, 3, "响应体未完成时不能提前释放槽位");
    assert.equal(fixture.active, 3);
    requests.slice(1).forEach((request, index) => {
      const queued = progress(request, "queued");
      assert.equal(queued.setId, ids[index + 1]);
      assert.equal(queued.batchId, `batch-${index + 1}`);
      assert.ok(queued.requestId);
    });
    for (let index = 0; index < ids.length; index += 1) {
      await waitFor(() => fixture.calls.length > index, `上游请求 ${index + 1}`);
      succeed(fixture.calls[index], index % 2 === 0);
    }
    await Promise.all(requests.map((request) => request.done));
    requests.forEach(assertCompleted);
    assert.equal(fixture.calls.length, ids.length);
    assert.equal(fixture.peak, 3);
    assert.equal(fixture.active, 0);
    for (const id of ids) {
      const saved = JSON.parse(await readFile(fixture.store.manifestPath(id), "utf8"));
      assert.deepEqual(saved.listingDrafts, requests[ids.indexOf(id)].result.listingDrafts);
      assert.match(saved.listingDrafts[0].description, /Two blue lures with a long body/);
      assert.match(saved.listingDrafts[0].deDisplay.description, /Köder.*größerer Öse/);
      assert.match(saved.listingDrafts[0].zhDisplay.description, /两件蓝色鱼饵.*长条形饵身/);
      assert.equal(await fixture.savedCount(id), 1);
    }
    assert.doesNotMatch(JSON.stringify(requests.flatMap((request) => request.events)), new RegExp(fixtureKey));
  });

  await t.test("同套同配置合并一次 POST 和一次保存，断开一个等待者不取消其他等待者", async (t) => {
    const fixture = await createFixture(t);
    await fixture.seed("dedupe");
    const first = fixture.start("dedupe", { batchId: "first" });
    await waitFor(() => fixture.calls.length === 1, "首个上游请求");
    const second = fixture.start("dedupe", { batchId: "second" });
    const third = fixture.start("dedupe", { batchId: "third" });
    await waitFor(() => progress(second, "waiting") && progress(third, "waiting"), "重复请求订阅共享任务");
    assert.equal(progress(first, "queued").requestId, progress(second, "waiting").requestId);
    assert.equal(progress(second, "waiting").batchId, "second");
    first.controller.abort();
    await first.done;
    assert.ok(first.error);
    assert.equal(fixture.calls[0].closed, false);
    succeed(fixture.calls[0], true);
    await Promise.all([second.done, third.done]);
    assertCompleted(second);
    assertCompleted(third);
    assert.deepEqual(second.result, third.result);
    assert.equal(fixture.calls.length, 1);
    assert.equal(await fixture.savedCount("dedupe"), 1);

    const regenerated = fixture.start("dedupe");
    await waitFor(() => fixture.calls.length === 2, "完成后重新生成而非永久缓存");
    succeed(fixture.calls[1]);
    await regenerated.done;
    assertCompleted(regenerated);
    assert.equal(await fixture.savedCount("dedupe"), 2);
  });

  await t.test("同套不同模型、认证、思考等级、端点或地址不能误合并", async (t) => {
    const fixture = await createFixture(t);
    await fixture.seed("config");
    const changes = [{}, { responsesModel: "other-model" }, { apiKey: "sk-other-local-fixture" }, { reasoningEffort: "low" }, { endpointPath: "/chat/completions" }, { baseUrl: `${fixture.upstreamUrl}/v2` }];
    const requests = changes.map((config) => fixture.start("config", config));
    await waitFor(() => fixture.calls.length === 3 && requests.every((request) => progress(request, "queued")), "不同配置独立排队");
    for (let index = 0; index < requests.length; index += 1) {
      await waitFor(() => fixture.calls.length > index, "配置隔离上游请求");
      succeed(fixture.calls[index]);
    }
    await Promise.all(requests.map((request) => request.done));
    requests.forEach(assertCompleted);
    assert.equal(fixture.calls.length, changes.length);
    assert.equal(fixture.peak, 3);
    assert.ok(fixture.calls.some((call) => call.body.model === "other-model"));
    assert.ok(fixture.calls.some((call) => call.path === "/v1/chat/completions"));
    assert.ok(fixture.calls.some((call) => call.body.reasoning?.effort === "low"));
    assert.ok(fixture.calls.some((call) => call.path === "/v2/responses"));
    assert.equal(await fixture.savedCount("config"), changes.length);
  });

  await t.test("明确额度耗尽经 SSE 和 JSON 传递安全 stopBatch 元数据，保留已完成三语草稿", async (t) => {
    const fixture = await createFixture(t);
    await fixture.seed("quota");
    const completed = fixture.start("quota");
    await waitFor(() => fixture.calls.length === 1, "先保存成功草稿");
    succeed(fixture.calls[0]);
    await completed.done;
    assertCompleted(completed);
    const before = await readFile(fixture.store.manifestPath("quota"), "utf8");
    const secret = "sk-upstream-secret-fixture";
    for (const stream of [true, false]) {
      const request = fixture.start("quota", { stream });
      const index = fixture.calls.length;
      await waitFor(() => fixture.calls.length > index, "额度错误请求");
      reject(fixture.calls[index], 429, {
        code: "insufficient_quota",
        message: `账号额度已用完 ${secret} Bearer private-bearer-value https://fixture.invalid/?token=private-query-value`,
        privateField: "private-upstream-only",
      });
      await request.done;
      assert.equal(request.error, null);
      assert.equal(request.status, stream ? 200 : 502);
      assert.equal(request.result.httpStatus, 429);
      assert.equal(request.result.code, "insufficient_quota");
      assert.equal(request.result.errorKind, "quota");
      assert.equal(request.result.stopBatch, true);
      assert.equal(request.result.retryAfterMs, undefined);
      assert.match(request.result.message, /额度已用完/);
      assert.doesNotMatch(JSON.stringify(request.result), /sk-upstream-secret|private-bearer-value|private-query-value|private-upstream-only/);
      assert.equal(fixture.calls.length, index + 1, "额度不足不重试");
      assert.equal(await readFile(fixture.store.manifestPath("quota"), "utf8"), before);
    }
    assert.equal(await fixture.savedCount("quota"), 1);
  });

  await t.test("HTTP 200 SSE 的结构化额度错误透传分类，不自动重放或保存", async (t) => {
    const fixture = await createFixture(t);
    await fixture.seed("stream-quota");
    for (const nested of [false, true]) {
      const index = fixture.calls.length;
      const request = fixture.start("stream-quota");
      await waitFor(() => fixture.calls.length > index, "流内额度错误请求");
      const error = { code: "insufficient_quota", message: "账号额度已用完 sk-stream-private-value" };
      sendEvent(fixture.calls[index], nested
        ? { type: "response.failed", response: { id: "accepted-fixture", error } }
        : { type: "error", error });
      fixture.calls[index].response.end();
      await request.done;
      assert.equal(request.error, null);
      assert.equal(request.result.httpStatus, 200);
      assert.equal(request.result.errorKind, "quota");
      assert.equal(request.result.code, "insufficient_quota");
      assert.equal(request.result.stopBatch, true);
      assert.doesNotMatch(JSON.stringify(request.events), /sk-stream-private-value/);
      assert.equal(fixture.calls.length, index + 1);
    }
    assert.equal(await fixture.savedCount("stream-quota"), 0);
  });

  await t.test("已有上游 response id 的 HTTP 429 不重放已受理请求", async (t) => {
    const fixture = await createFixture(t);
    await fixture.seed("accepted");
    const request = fixture.start("accepted");
    await waitFor(() => fixture.calls.length === 1, "已受理请求");
    fixture.calls[0].response.writeHead(429, { "Content-Type": "application/json", "Retry-After": "0" });
    fixture.calls[0].response.end(JSON.stringify({ id: "already-accepted-fixture", error: { code: "rate_limited", message: "Too many concurrent requests" } }));
    await request.done;
    assert.equal(request.error, null);
    assert.equal(request.result.httpStatus, 429);
    assert.equal(request.result.errorKind, "rate_limit");
    assert.equal(fixture.calls.length, 1);
    assert.equal(await fixture.savedCount("accepted"), 0);
  });

  await t.test("结构化额度代码优先于 try again 提示，HTTP 与 SSE 均停止批次且不重试", async (t) => {
    const fixture = await createFixture(t);
    const actual = [];
    for (const status of [429, 200]) {
      const setId = `quota-code-${status}`;
      await fixture.seed(setId);
      const index = fixture.calls.length;
      const request = fixture.start(setId);
      await waitFor(() => fixture.calls.length > index, "额度代码优先级请求");
      const error = { code: "insufficient_quota", message: "Account quota exhausted; please try again later" };
      if (status === 429) {
        reject(fixture.calls[index], status, error);
        await waitFor(() => request.result || fixture.calls.length > index + 1, "额度终止或误重试");
        if (fixture.calls.length > index + 1) reject(fixture.calls[index + 1], status, error);
      } else {
        sendEvent(fixture.calls[index], { type: "error", error });
        fixture.calls[index].response.end();
      }
      await request.done;
      assert.equal(request.error, null);
      actual.push({ status, posts: fixture.calls.length - index, errorKind: request.result.errorKind, stopBatch: request.result.stopBatch });
      assert.equal(await fixture.savedCount(setId), 0);
    }
    assert.deepEqual(actual, [429, 200].map((status) => ({ status, posts: 1, errorKind: "quota", stopBatch: true })));
  });

  await t.test("HTTP 429 只重试一次，Retry-After 同时阻止重试和队列后续提交", async (t) => {
    const fixture = await createFixture(t);
    for (const id of ["limited", "busy-a", "busy-b", "after-limit"]) await fixture.seed(id);
    const limited = fixture.start("limited");
    await waitFor(() => fixture.calls.length === 1, "限流任务占槽");
    const busy = [fixture.start("busy-a"), fixture.start("busy-b")];
    await waitFor(() => fixture.calls.length === 3, "三个活动任务");
    const next = fixture.start("after-limit");
    await waitFor(() => progress(next, "queued"), "后续任务排队");
    const rejectedAt = Date.now();
    reject(fixture.calls[0], 429, { code: "rate_limited", message: "Too many concurrent requests" }, "1");
    await waitFor(() => progress(limited, "cooldown"), "限流冷却事件");
    assert.ok(progress(limited, "cooldown").retryAfterMs > 0);
    succeed(fixture.calls[1]);
    await waitFor(() => progress(next, "cooldown"), "共享队列进入冷却");
    await delay(150);
    assert.equal(fixture.calls.length, 3, "冷却期不得提前发出后续请求");
    succeed(fixture.calls[2]);
    await waitFor(() => fixture.calls.length === 5, "一次重试与后续任务提交");
    for (const call of fixture.calls.slice(3)) {
      assert.ok(call.startedAt - rejectedAt >= 980, `Retry-After 被缩短：${call.startedAt - rejectedAt}ms`);
      succeed(call);
    }
    await Promise.all([limited, ...busy, next].map((request) => request.done));
    [limited, ...busy, next].forEach(assertCompleted);
    assert.equal(fixture.calls.length, 5);
    assert.equal(fixture.peak, 3);
    assert.equal(await fixture.savedCount("limited"), 1);
  });

  await t.test("第二次 HTTP 429 失败后不进行第三次 POST，释放槽位供下一套使用", async (t) => {
    const fixture = await createFixture(t);
    await fixture.seed("twice-limited");
    await fixture.seed("after-twice");
    const limited = fixture.start("twice-limited");
    for (let index = 0; index < 2; index += 1) {
      await waitFor(() => fixture.calls.length > index, "有限重试");
      reject(fixture.calls[index], 429, { code: "rate_limited", message: "Too many concurrent requests" });
    }
    await limited.done;
    assert.equal(limited.result.httpStatus, 429);
    assert.equal(limited.result.errorKind, "rate_limit");
    assert.equal(fixture.calls.length, 2);
    assert.equal(await fixture.savedCount("twice-limited"), 0);
    const next = fixture.start("after-twice");
    await waitFor(() => fixture.calls.length === 3, "限流失败后槽位释放");
    succeed(fixture.calls[2]);
    await next.done;
    assertCompleted(next);
  });

  await t.test("HTTP 200 的流错误和中断结果不重放，队列继续且 HTTP 峰值不超过三", async (t) => {
    const fixture = await createFixture(t);
    for (const id of ["stream-error", "stream-cut", "held", "after-error", "after-cut"]) await fixture.seed(id);
    const failed = fixture.start("stream-error");
    await waitFor(() => fixture.calls.length === 1, "流错误请求");
    const cut = fixture.start("stream-cut");
    await waitFor(() => fixture.calls.length === 2, "流中断请求");
    const rest = [fixture.start("held"), fixture.start("after-error"), fixture.start("after-cut")];
    await waitFor(() => fixture.calls.length === 3 && rest.every((request) => progress(request, "queued")), "异常测试队列");
    sendEvent(fixture.calls[0], { type: "response.output_text.delta", delta: '{"title":"partial' });
    sendEvent(fixture.calls[1], { type: "response.output_text.delta", delta: '{"title":"partial' });
    await waitFor(() => progress(failed, "receiving") && progress(cut, "receiving"), "真实收到部分文本");
    sendEvent(fixture.calls[0], { type: "error", error: { message: "Too many concurrent requests; unknown stream outcome" } });
    fixture.calls[0].response.end();
    fixture.calls[1].response.destroy();
    await Promise.all([failed.done, cut.done]);
    assert.equal(failed.result.ok, undefined);
    assert.equal(cut.result.ok, undefined);
    assert.match(failed.result.message, /unknown stream outcome/);
    assert.equal(failed.result.errorKind, "rate_limit");
    assert.equal(failed.result.httpStatus, 200);
    assert.ok(cut.result.message);
    await waitFor(() => fixture.calls.length === 5, "异常后继续排队任务");
    fixture.calls.slice(2).forEach((call) => succeed(call));
    await Promise.all(rest.map((request) => request.done));
    rest.forEach(assertCompleted);
    assert.equal(fixture.calls.length, 5, "状态未知的流错误不额外重放");
    assert.equal(fixture.peak, 3);
    assert.equal(await fixture.savedCount("stream-error"), 0);
    assert.equal(await fixture.savedCount("stream-cut"), 0);
  });

  await t.test("排队取消不 POST，执行中取消关闭上游并继续队列，不扩大并发或保存取消结果", async (t) => {
    const fixture = await createFixture(t);
    for (const id of ["cancel-active", "keep-a", "keep-b", "cancel-queued", "after-cancel"]) await fixture.seed(id);
    const running = fixture.start("cancel-active");
    await waitFor(() => fixture.calls.length === 1, "待取消执行任务");
    sendEvent(fixture.calls[0], { type: "response.output_text.delta", delta: '{"title":"partial' });
    const kept = [fixture.start("keep-a"), fixture.start("keep-b")];
    await waitFor(() => fixture.calls.length === 3, "三个未完成上游请求");
    const queued = fixture.start("cancel-queued");
    const next = fixture.start("after-cancel");
    await waitFor(() => progress(queued, "queued") && progress(next, "queued"), "取消测试排队事件");
    queued.controller.abort();
    await queued.done;
    running.controller.abort();
    await running.done;
    await waitFor(() => fixture.calls[0].closed && fixture.calls.length === 4, "取消关闭与后续提交");
    fixture.calls.slice(1).forEach((call) => succeed(call));
    await Promise.all([...kept, next].map((request) => request.done));
    [...kept, next].forEach(assertCompleted);
    assert.equal(fixture.calls.length, 4);
    assert.equal(fixture.peak, 3);
    assert.equal(await fixture.savedCount("cancel-active"), 0);
    assert.equal(await fixture.savedCount("cancel-queued"), 0);
    for (const request of [running, queued]) assert.ok(request.error);
  });
});
