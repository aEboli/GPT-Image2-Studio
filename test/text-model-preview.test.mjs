import test from "node:test";
import assert from "node:assert/strict";
import { createTextModelPreview, requestTextModel, showTextModelProgress } from "../lib/text-model-client.mjs";

function createDocument() {
  const document = {
    createElement(tagName) {
      return {
        tagName, children: [], listeners: {}, textContent: "", scrollTop: 0,
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
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const document = createDocument();
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  globalThis.document = document;
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "document", original);
    else delete globalThis.document;
  });
  return document;
}

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
