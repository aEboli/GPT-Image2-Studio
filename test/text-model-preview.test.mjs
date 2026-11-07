import test from "node:test";
import assert from "node:assert/strict";
import { createCreationProcessSteps, createTextModelPreview, getTextModelEventMetadata, requestTextModel, showTextModelProgress } from "../lib/text-model-client.mjs";

function createDocument() {
  const document = {
    createElement(tagName) {
      return {
        tagName, children: [], listeners: {}, ownText: "", scrollTop: 0,
        get textContent() { return this.ownText + this.children.map((child) => child.textContent).join(""); },
        set textContent(value) { this.ownText = value; this.children = []; },
        get isConnected() { return this === document.body || Boolean(this.parent?.isConnected); },
        append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } },
        remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
        setAttribute() {},
        addEventListener(type, listener) { this.listeners[type] = listener; },
      };
    },
  };
  document.body = document.createElement("body");
  return document;
}

function setup(t) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const document = createDocument();
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  globalThis.document = document;
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "document", original);
    else delete globalThis.document;
  });
  return document;
}

test("creation process steps follow real stages and reset on a new attempt", (t) => {
  const document = setup(t);
  const parent = document.createElement("section");
  document.body.append(parent);
  const process = createCreationProcessSteps({ document, parent, kind: "marketing" });

  process.update("waiting", { attempt: 1, requestKey: "first" });
  assert.deepEqual(parent.children[0].children.map((item) => item.dataset.state), ["complete", "current", "pending", "pending"]);
  process.update("receiving", { attempt: 1, requestKey: "first" });
  assert.deepEqual(parent.children[0].children.map((item) => item.dataset.state), ["complete", "complete", "current", "pending"]);
  process.update("waiting", { attempt: 2, requestKey: "second" });
  assert.deepEqual(parent.children[0].children.map((item) => item.dataset.state), ["complete", "current", "pending", "pending"]);
  assert.equal(parent.children[0].textContent.includes("百分比"), false);
});

test("concurrent previews keep one floating panel and old callbacks cannot change the new one", (t) => {
  const document = setup(t);
  const first = createTextModelPreview({ document });
  first.update({ text: "旧请求" });
  const oldPanel = document.body.children[0];
  const second = createTextModelPreview({ document });
  second.update({ text: "新请求" });
  assert.equal(document.body.children.length, 1);
  assert.equal(oldPanel.isConnected, false);
  first.update({ text: "迟到的旧内容" });
  first.finish(new Error("旧请求失败"));
  t.mock.timers.tick(50);
  assert.equal(document.body.children[0].children.at(-1).textContent, "新请求");
  t.mock.timers.tick(5000);
  assert.equal(document.body.children.length, 1);
  second.finish();
  assert.equal(document.body.children.length, 0);
});

test("failed previews dismiss automatically and never accumulate between retries", (t) => {
  const document = setup(t);
  const first = createTextModelPreview({ document });
  first.update({ purpose: "Listing", text: "草稿" });
  first.finish(new Error("连接中断"));
  assert.match(document.body.children[0].children[1].textContent, /连接中断/);
  t.mock.timers.tick(1000);
  const second = createTextModelPreview({ document });
  second.update({ text: "重试" });
  second.finish(new Error("重试失败"));
  assert.equal(document.body.children.length, 1);
  t.mock.timers.tick(4000);
  assert.equal(document.body.children.length, 1, "the first failure must not dismiss the replacement");
  t.mock.timers.tick(1000);
  assert.equal(document.body.children.length, 0);
  second.update({ text: "迟到内容" });
  second.finish();
  t.mock.timers.tick(50);
  assert.equal(document.body.children.length, 0);
});

test("manual close stops preview updates while the request continues", (t) => {
  const document = setup(t);
  const preview = createTextModelPreview({ document });
  const panel = document.body.children[0];
  preview.update({ text: "关闭前" });
  panel.children[0].children[0].listeners.click({ preventDefault() {}, stopPropagation() {} });
  preview.update({ text: "关闭后" });
  preview.finish(new Error("稍后失败"));
  t.mock.timers.tick(5000);
  assert.equal(document.body.children.length, 0);
  assert.equal(panel.children.at(-1).textContent, "");
});

test("floating preview replacement preserves embedded analysis and separate documents", (t) => {
  const document = setup(t);
  const panel = document.createElement("section");
  document.body.append(panel);
  const embedded = createTextModelPreview({ document, panel });
  const otherDocument = createDocument();
  const other = createTextModelPreview({ document: otherDocument });
  const first = createTextModelPreview({ document });
  const second = createTextModelPreview({ document });
  embedded.update({ text: "商品分析" });
  embedded.finish();
  assert.equal(panel.isConnected, true);
  assert.equal(panel.children.at(-1).textContent, "商品分析");
  assert.equal(document.body.children.length, 2);
  assert.equal(otherDocument.body.children.length, 1);
  first.finish();
  second.finish();
  other.finish();
});

test("generation progress cleans up success, interruption and errors without opening terminal-only panels", (t) => {
  const document = setup(t);
  for (const stage of ["received", "buffered", "error", "interrupted"]) {
    const requestId = `preview-${stage}`;
    showTextModelProgress({ requestId, stage: "waiting" });
    showTextModelProgress({ requestId, stage, message: "请求已结束" });
    if (stage === "error" || stage === "interrupted") t.mock.timers.tick(5000);
    assert.equal(document.body.children.length, 0, stage);
    showTextModelProgress({ requestId, stage });
    assert.equal(document.body.children.length, 0, `${stage} must not reopen a panel`);
  }
});

test("closing generation output keeps it closed through subsequent stream progress", (t) => {
  const document = setup(t);
  const requestId = "preview-manually-closed";
  showTextModelProgress({ requestId, stage: "waiting" });
  document.body.children[0].children[0].children[0].listeners.click({ preventDefault() {}, stopPropagation() {} });
  showTextModelProgress({ requestId, stage: "receiving", text: "后续内容" });
  t.mock.timers.tick(50);
  assert.equal(document.body.children.length, 0);
  showTextModelProgress({ requestId, stage: "received" });
});

test("request failures retain their error contract while the preview clears automatically", async (t) => {
  const document = setup(t);
  const events = 'event: text_progress\ndata: {"stage":"waiting"}\n\nevent: error\ndata: {"message":"上游失败"}\n\n';
  await assert.rejects(requestTextModel(async () => new Response(events, { headers: { "content-type": "text/event-stream" } }), "/fixture", {}), /上游失败/);
  assert.equal(document.body.children.length, 1);
  t.mock.timers.tick(5000);
  assert.equal(document.body.children.length, 0);
});

test("SSE errors preserve safe scheduling metadata even when followed by complete", async () => {
  const detail = { message: "上游超并发", errorKind: "rate_limit", stopBatch: true, fatal: true, httpStatus: 429, retryAfterMs: 3000, requestId: "safe-id", attempt: 3, timing: { totalMs: 1000, raw: "PRIVATE_TIMING" }, usage: { outputTokens: 4 }, text: "PRIVATE_TEXT", apiKey: "PRIVATE_KEY" };
  const events = "event: error\ndata: " + JSON.stringify(detail) + "\n\nevent: complete\ndata: {\"ok\":true}\n\n";
  await assert.rejects(requestTextModel(async () => new Response(events, { headers: { "content-type": "text/event-stream" } }), "/fixture", {}), (error) => {
    for (const key of ["message", "errorKind", "stopBatch", "fatal", "httpStatus", "retryAfterMs", "requestId", "attempt"]) assert.equal(error[key], detail[key], key);
    assert.deepEqual(error.timing, { totalMs: 1000 });
    assert.deepEqual(error.usage, { outputTokens: 4 });
    assert.doesNotMatch(JSON.stringify(error), /PRIVATE_/u);
    return true;
  });
});

test("live preview advances elapsed in silent queued and cooldown periods and clears timers", (t) => {
  const document = setup(t);
  const preview = createTextModelPreview({ document });
  preview.update({ stage: "queued", purpose: "Listing", elapsedMs: 1500 });
  t.mock.timers.tick(50);
  const meta = document.body.children[0].children[1];
  assert.match(meta.textContent, /排队/u);
  t.mock.timers.tick(3000);
  assert.match(meta.textContent, /4[.]5 秒/u);
  preview.update({ stage: "cooldown", elapsedMs: 10, retryAfterMs: 5000 });
  t.mock.timers.tick(50);
  assert.match(meta.textContent, /冷却/u);
  assert.doesNotMatch(meta.textContent, /0[.]0 秒/u);
  t.mock.timers.tick(1000);
  assert.match(meta.textContent, /5[.]6 秒/u);
  preview.finish(new Error("请求失败"));
  const final = meta.textContent;
  t.mock.timers.tick(4000);
  assert.equal(meta.textContent, final);
  t.mock.timers.tick(1000);
  assert.equal(document.body.children.length, 0);
});

test("silent fetches have a running preview while metadata observers are enabled", async (t) => {
  const document = setup(t);
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const run = requestTextModel(() => pending, "/fixture", {}, { onProgress() {}, showPreview: true });
  t.mock.timers.tick(2000);
  const panel = document.body.children[0];
  resolve(Response.json({ ok: true }));
  await run;
  assert.ok(panel);
  assert.match(panel.children[1].textContent, /2[.]0 秒/u);
  assert.equal(document.body.children.length, 0);
});

test("metadata strips credentials and invalid numeric values without exposing text or configuration", () => {
  const metadata = getTextModelEventMetadata({
    batchId: "batch", setId: "set", stage: "error",
    message: "Bearer SECRET and sk-SECRET https://relay.test?api_key=SECRET",
    apiKey: "PRIVATE_KEY", text: "PRIVATE_TEXT", config: { token: "PRIVATE_TOKEN" },
    timing: { totalMs: 1500, apiKey: 12345, bad: Infinity, negative: -1, raw: "PRIVATE_TIMING" },
    usage: { outputTokens: 10, apiKey: 12345, raw: "PRIVATE_USAGE" }, attempt: NaN, retryAfterMs: -1,
  });
  assert.doesNotMatch(JSON.stringify(metadata), /SECRET|PRIVATE_|Infinity|NaN/u);
  assert.deepEqual(metadata.timing, { totalMs: 1500 });
  assert.deepEqual(metadata.usage, { outputTokens: 10 });
  assert.equal("attempt" in metadata, false);
  assert.equal("retryAfterMs" in metadata, false);
});

test("SSE terminal errors cancel an open reader and retain preceding progress metadata", async () => {
  let cancelled = false;
  const events = 'event: text_progress\ndata: {"requestId":"inherited","attempt":2,"stage":"connected","timing":{"headersMs":50}}\n\nevent: error\ndata: {"message":"额度不足","errorKind":"quota","stopBatch":true,"httpStatus":402}\n\n';
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(events)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(requestTextModel(async () => new Response(body, { headers: { "content-type": "text/event-stream" } }), "/fixture", {}), (error) => {
    assert.equal(error.requestId, "inherited");
    assert.equal(error.attempt, 2);
    assert.equal(error.httpStatus, 402);
    assert.deepEqual(error.timing, { headersMs: 50 });
    return true;
  });
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test("structured analyst groups partial reference observations and reuses text nodes while streaming", (t) => {
  const document = setup(t);
  const panel = document.createElement("section"); document.body.append(panel);
  const preview = createTextModelPreview({ document, panel, title: "商品分析", structured: true });
  const source = '{"product_name":"电加热手套","category_path":"服饰配件/手套","reference_roles":[{"filename":"gloves.jpg","note":"三档温控';
  preview.update({ stage: "receiving", elapsedMs: 2500, purpose: "creation-reference-analysis", message: "已收到上游数据，等待回答文本。", text: source });
  t.mock.timers.tick(50);
  const [meta, , draft] = panel.children;
  assert.equal(draft.children.length, 2);
  assert.match(draft.children[0].textContent, /商品电加热手套.*类目路径服饰配件\/手套/u);
  assert.match(draft.children[1].textContent, /参考图 01gloves.jpg观察三档温控/u);
  assert.doesNotMatch(meta.textContent, /creation-reference-analysis|等待回答文本/u);
  assert.match(meta.textContent, /正在识别.*2\.5 秒/u);
  const observation = draft.children[1].children[1].children[1];
  panel.scrollTop = 48;
  preview.update({ text: source + '，支持 45℃、50℃、55℃。"},{"filename":"detail.jpg","note":"<script>仅作文字</script>"}]}' });
  t.mock.timers.tick(50);
  assert.equal(draft.children[1].children[1].children[1], observation);
  assert.match(observation.textContent, /45℃、50℃、55℃/u);
  assert.match(draft.children[2].textContent, /参考图 02detail.jpg观察<script>仅作文字<\/script>/u);
  assert.equal(panel.scrollTop, 48);
  preview.finish();
  assert.match(meta.textContent, /接收结束.*完整结果以校验后内容为准/u);
});

test("structured analyst clears old cards on retry and supports plaintext and interruption", (t) => {
  const document = setup(t);
  const panel = document.createElement("section"); document.body.append(panel);
  const preview = createTextModelPreview({ document, panel, structured: true });
  preview.update({ stage: "receiving", text: "纯文本回答" }); t.mock.timers.tick(50);
  const draft = panel.children.at(-1);
  assert.equal(draft.textContent, "纯文本回答");
  preview.update({ text: '{"product_name":"旧商品"}' }); t.mock.timers.tick(50);
  assert.equal(draft.children.length, 1);
  assert.doesNotMatch(draft.textContent, /纯文本/u);
  preview.update({ stage: "waiting", attempt: 2 }); t.mock.timers.tick(50);
  assert.equal(draft.textContent, "");
  assert.equal(draft.children.length, 0);
  preview.update({ stage: "receiving", text: '{"filename":"new.jpg","note":"换行\\n温度 \\u0034' }); t.mock.timers.tick(50);
  assert.match(draft.textContent, /参考图 01new.jpg观察换行\n温度 4/u);
  assert.doesNotMatch(draft.textContent, /旧商品/u);
  preview.finish(new Error("连接中断"));
  assert.match(panel.children[0].textContent, /识别中断.*连接中断/u);
  assert.equal(panel.isConnected, true);
});
