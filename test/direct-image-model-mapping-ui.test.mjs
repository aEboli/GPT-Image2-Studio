import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "parse5";
import vm from "node:vm";
import { access, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDirectImageModelMappingView } from "../lib/direct-image-model-mapping-view.mjs";
import { createConfigModelPickerController } from "../lib/config-model-picker.mjs";
import { IMAGE_TOOL_MODEL_OPTIONS } from "../lib/model-defaults.mjs";

function element(tagName = "div") {
  const listeners = new Map();
  const attributes = new Map();
  return {
    tagName, children: [], dataset: {}, value: "", textContent: "", hidden: false,
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } },
    appendChild(node) { this.append(node); },
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
    set innerHTML(_value) { this.children = []; },
    remove() { this.parent.children = this.parent.children.filter((node) => node !== this); },
    setAttribute(key, value) { attributes.set(key, String(value)); },
    getAttribute(key) { return attributes.get(key) ?? null; },
    removeAttribute(key) { attributes.delete(key); },
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
    dispatch(type) { for (const callback of listeners.get(type) || []) callback({ target: this }); },
    focus() { this.focused = true; },
    setCustomValidity(message) { this.validationMessage = message; },
  };
}

function harness() {
  const root = element();
  const rows = element();
  const candidates = element("datalist");
  candidates.id = "directImageMappingCandidates";
  const add = element("button");
  const feedback = element();
  root.querySelector = (selector) => ({ "[data-mapping-rows]": rows, "[data-mapping-candidates]": candidates, "[data-mapping-add]": add, "[data-mapping-feedback]": feedback })[selector];
  root.ownerDocument = { createElement: element };
  let changes = 0;
  const view = createDirectImageModelMappingView({ root, getSelectedModel: () => "selected-custom", onChange: () => changes++ });
  const inputs = (index) => rows.children[index].children.filter((node) => node.tagName === "input");
  const fill = (index, source, target) => { const pair = inputs(index); pair[0].value = source; pair[1].value = target; pair[0].dispatch("input"); };
  return { view, root, rows, candidates, add, feedback, inputs, fill, changes: () => changes };
}

test("映射胶囊支持恢复、多行手填、共享候选、删除与显式清空", () => {
  const h = harness();
  h.view.write([{ source: "gpt-image-2.6-sunburst", target: "IMAGE-2.6" }]);
  assert.equal(h.rows.children.length, 1);
  assert.deepEqual(h.inputs(0).map((input) => input.value), ["gpt-image-2.6-sunburst", "IMAGE-2.6"]);
  assert.deepEqual(h.inputs(0).map((input) => input.placeholder), ["请求模型", "实际请求模型"]);
  assert.deepEqual(h.inputs(0).map((input) => input.getAttribute("aria-label")), ["请求模型", "实际请求模型"]);
  assert.equal(h.inputs(0)[0].getAttribute("list"), h.candidates.id);
  assert.equal(h.inputs(0)[1].getAttribute("list"), h.candidates.id);
  h.view.setCandidates(["IMAGE-2.6", "custom/text-and-image", "IMAGE-2.6"]);
  const options = h.candidates.children.map((option) => option.value);
  for (const id of [...IMAGE_TOOL_MODEL_OPTIONS, "selected-custom", "IMAGE-2.6", "custom/text-and-image"]) assert.ok(options.includes(id));
  assert.equal(new Set(options).size, options.length);
  assert.equal(h.rows.children.length, 1, "更新候选不创建规则");
  h.add.dispatch("click");
  h.fill(1, " handwritten ", " provider-id ");
  assert.deepEqual(h.view.read({ validate: true }), [{ source: "gpt-image-2.6-sunburst", target: "IMAGE-2.6" }, { source: "handwritten", target: "provider-id" }]);
  h.rows.children[0].children.at(-1).dispatch("click");
  assert.deepEqual(h.view.read(), [{ source: "handwritten", target: "provider-id" }]);
  h.rows.children[0].children.at(-1).dispatch("click");
  assert.deepEqual(h.view.read({ validate: true }), []);
  h.add.dispatch("click");
  assert.deepEqual(h.view.read({ validate: true }), [], "空白草稿不进入保存值");
  assert.ok(h.changes() >= 4);
});

test("保存前拒绝单边输入和重复 source，并保留可修正草稿", () => {
  const h = harness();
  h.add.dispatch("click");
  h.fill(0, "A", "");
  assert.throws(() => h.view.read({ validate: true }), /两端/);
  assert.equal(h.rows.children.length, 1);
  assert.equal(h.inputs(0)[0].value, "A");
  h.fill(0, "A", "B");
  h.add.dispatch("click");
  h.fill(1, " A ", "C");
  assert.throws(() => h.view.read({ validate: true }), /重复/);
  assert.equal(h.rows.children.length, 2);
  assert.deepEqual(h.view.read(), [{ source: "A", target: "B" }], "编辑中不让不完整或冲突草稿破坏能力刷新");
  h.fill(1, "a", "C");
  assert.deepEqual(h.view.read({ validate: true }), [{ source: "A", target: "B" }, { source: "a", target: "C" }]);
  assert.equal(h.feedback.textContent, "");
});

test("获取直连模型只更新共享候选，连接测试带当前映射且文本候选独立", async () => {
  const h = harness();
  h.view.write([{ source: "custom", target: "gpt-image-2.6-flare" }]);
  const refs = Object.fromEntries(["modelOptionsList", "responsesModelInput", "modelPickerToggle", "fetchModelsButton", "testConnectionButton", "configFeedback", "directModelOptionsList", "directImageModelInput", "directModelPickerToggle", "directFetchModelsButton", "directResponsesModelInput", "directResponsesModelOptionsList", "directResponsesModelPickerToggle"].map((name) => [name, element()]));
  refs.modelOptionsList.ownerDocument = { createElement: element };
  refs.imageRouteInputs = [{ value: "b", checked: true }];
  refs.directImageModelInput.value = "custom";
  refs.directResponsesModelInput.value = "independent-text";
  const requests = [];
  let fail = false;
  const picker = createConfigModelPickerController({
    refs, state: {}, getDirectImageModelMappings: () => h.view.read(),
    getBrowserPrivateConfigRequestPayload: () => ({}),
    onDirectImageModelsFetched: (models) => h.view.setCandidates(models),
    fetchImpl: async (_url, request) => { requests.push(request.body); return { ok: !fail, json: async () => fail ? { message: "读取失败" } : { models: ["IMAGE-2.6", "unknown-provider-model"] } }; },
  });
  await picker.fetchConfigModels({ target: "direct", mode: "test", openAfterFetch: false });
  assert.deepEqual(JSON.parse(requests[0].get("directImageModelMappings")), h.view.read());
  assert.ok(h.candidates.children.some((option) => option.value === "unknown-provider-model"));
  assert.equal(refs.directImageModelInput.value, "custom");
  assert.deepEqual(h.view.read(), [{ source: "custom", target: "gpt-image-2.6-flare" }]);
  const before = h.candidates.children.map((option) => option.value);
  await picker.fetchConfigModels({ target: "direct-responses" });
  assert.equal(refs.directResponsesModelInput.value, "independent-text");
  assert.deepEqual(h.candidates.children.map((option) => option.value), before);
  h.add.dispatch("click"); h.fill(1, "unfinished", "");
  const draftCandidates = h.candidates.children.map((option) => option.value);
  fail = true;
  await picker.fetchConfigModels({ target: "direct" });
  assert.equal(h.inputs(1)[0].value, "unfinished");
  assert.deepEqual(h.candidates.children.map((option) => option.value), draftCandidates);
  assert.equal(refs.configFeedback.dataset.state, "error");
});

test("映射区域位于流式开关和文本 API 之间，宽屏映射占独立一整行", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const doc = parse(html);
  const nodes = [];
  const walk = (node) => { if (node.attrs) nodes.push(node); (node.childNodes || []).forEach(walk); };
  walk(doc);
  const id = (node) => node.attrs.find((attr) => attr.name === "id")?.value;
  const root = nodes.find((node) => id(node) === "directImageModelMappings");
  assert.ok(root);
  assert.ok(html.indexOf('id="directImageStreamToggle"') < html.indexOf('id="directImageModelMappings"'));
  assert.ok(html.indexOf('id="directImageModelMappings"') < html.indexOf('id="directTextBaseUrlInput"'));
  assert.match(html, /请求模型 → 实际请求模型/);
  assert.match(css, /\.direct-image-model-mapping-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)\s+auto;/);
  assert.match(css, /\.direct-image-model-mapping-row input\s*\{[^}]*min-width:\s*0;[^}]*border-radius:\s*999px;/);
  assert.match(css, /\[data-route-panel="b"\] > \.direct-image-model-mappings-field\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*4;/);
  assert.match(css, /\[data-route-panel="b"\] > \.direct-text-endpoint-field\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*5;/);
});

test("保存入口在持久化前校验，拒绝无效草稿且不会丢失原配置", async () => {
  const h = harness();
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const saveSource = app.match(/async function saveConfig\([^]*?\n\}/)?.[0];
  assert.ok(saveSource);
  let saves = 0;
  const context = {
    directImageModelMappingView: h.view,
    clearError() {}, syncEndpointFieldsFromFullUrlModes() {},
    getCurrentPrivateConfigRequestPayload: () => ({ directImageModelMappings: h.view.read() }),
    refs: {},
    saveBrowserPrivateConfig() { saves++; throw new Error("reached-persistence"); },
  };
  vm.runInNewContext(saveSource, context);
  h.add.dispatch("click"); h.fill(0, "source", "");
  await assert.rejects(context.saveConfig({ preventDefault() {} }), /两端/);
  assert.equal(saves, 0);
  h.fill(0, "source", "target");
  h.add.dispatch("click"); h.fill(1, "source", "another-target");
  await assert.rejects(context.saveConfig({ preventDefault() {} }), /重复/);
  assert.equal(saves, 0);
  assert.equal(h.rows.children.length, 2);
  h.fill(1, "another-source", "another-target");
  await assert.rejects(context.saveConfig({ preventDefault() {} }), /reached-persistence/);
  assert.equal(saves, 1);
  assert.match(app, /directImageModelMappingView\.write\(config\.directImageModelMappings\)/);
});

test("真实 Chromium 在宽窄配置面板中保持胶囊、长 ID 和独立行布局", { skip: process.platform !== "win32", timeout: 30000 }, async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const electron = join(root, "node_modules/electron/dist/electron.exe");
  try { await access(electron); } catch { t.skip("Electron runtime is unavailable"); return; }
  const profile = await mkdtemp(join(tmpdir(), "studio-image-mapping-layout-"));
  t.after(() => rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 }));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const probe = fileURLToPath(new URL("./fixtures/direct-image-model-mapping-layout-probe.mjs", import.meta.url));
  const result = await promisify(execFile)(electron, [probe, profile], { cwd: root, env, windowsHide: true, timeout: 20000 });
  const layouts = JSON.parse(result.stdout.match(/DIRECT_IMAGE_MAPPING_LAYOUT=(.+)/)[1]);
  assert.deepEqual(layouts.map((layout) => layout.viewport), [360, 768, 1280]);
  for (const layout of layouts) {
    const label = `视口 ${layout.viewport}`;
    assert.ok(layout.root.width > 0, label);
    assert.ok(layout.root.left >= layout.panel.left - 1 && layout.root.right <= layout.panel.right + 1, label);
    assert.ok(layout.root.top >= layout.stream.bottom - 1, `${label} 映射位于流式开关下方`);
    assert.ok(layout.text.top >= layout.root.bottom - 1, `${label} 文本 API 位于映射下方`);
    assert.equal(layout.rows.length, 2);
    for (const row of layout.rows) assert.ok(row.scrollWidth <= row.clientWidth + 1, `${label} 映射行无横向溢出`);
    for (const input of layout.inputs) {
      assert.equal(input.radius, "999px", `${label} 胶囊圆角`);
      assert.equal(input.list, "directImageMappingCandidates");
      assert.ok(input.bounds.width > 40, `${label} 输入可编辑`);
    }
    assert.ok(layout.inputs[2].value.length > 200);
    assert.ok(layout.candidates.includes("fetched-custom-model"));
  }
});
