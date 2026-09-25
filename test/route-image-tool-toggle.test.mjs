import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import vm from "node:vm";
import { parse } from "parse5";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfigStore } from "../lib/config-store.mjs";
import { normalizeImageRouteConfig, getSelectedImageGenerationConfig } from "../lib/image-route-config.mjs";
import {
  normalizeBrowserPrivateConfig, saveBrowserPrivateConfig, readBrowserPrivateConfig,
  toPublicBrowserConfig, appendBrowserConfigToFormData, getBrowserPrivateConfigRequestPayload,
} from "../lib/browser-config.mjs";
import { mergeRequestPrivateConfig } from "../lib/request-private-config.mjs";
import { createResponsesRequestBody, requestImageGeneration } from "../lib/responses-workflow.mjs";

const model = "gpt-image-2.5-sunburst";

test("工具模型开关默认开启，关闭时保留选中的模型", () => {
  for (const includeImageToolModel of [undefined, null, true, false]) {
    const config = { imageToolModel: model, includeImageToolModel };
    const expected = includeImageToolModel !== false;
    assert.equal(normalizeImageRouteConfig(config).includeImageToolModel, expected);
    assert.equal(normalizeBrowserPrivateConfig(config).includeImageToolModel, expected);
    const selected = getSelectedImageGenerationConfig(config);
    assert.equal(selected.includeImageToolModel, expected);
    assert.equal(selected.imageModel, model);
  }
});

test("本地配置保存关闭状态，旧配置默认开启，公开配置同步状态", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-route-toggle-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const store = createConfigStore({ rootDir, env: {} });
  assert.equal((await store.readPrivateConfig()).includeImageToolModel, true);
  await store.saveConfig({ imageToolModel: model, includeImageToolModel: false });
  await store.saveConfig({ responsesModel: "test-text-model" });
  assert.equal((await store.readPrivateConfig()).includeImageToolModel, false);
  assert.equal((await store.readPublicConfig()).includeImageToolModel, false);
  assert.equal((await store.readPrivateConfig()).imageToolModel, model);
  await store.saveConfig({ includeImageToolModel: true });
  assert.equal((await store.readPublicConfig()).includeImageToolModel, true);
});

test("浏览器保存、公开配置、JSON 和表单均保留关闭状态", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveBrowserPrivateConfig({ apiKey: "test-key", imageToolModel: model, includeImageToolModel: false }, storage);
  saveBrowserPrivateConfig({ responsesModel: "test-text-model" }, storage);
  const config = readBrowserPrivateConfig(storage);
  assert.equal(config.includeImageToolModel, false);
  assert.equal(config.imageToolModel, model);
  assert.equal(toPublicBrowserConfig(config).includeImageToolModel, false);
  const json = getBrowserPrivateConfigRequestPayload(() => config);
  const form = appendBrowserConfigToFormData(new FormData(), () => config);
  assert.equal(json.includeImageToolModel, false);
  assert.equal(form.get("includeImageToolModel"), "false");
  for (const payload of [json, form]) {
    const merged = mergeRequestPrivateConfig(payload, normalizeBrowserPrivateConfig());
    assert.equal(merged.includeImageToolModel, false);
    assert.equal(getSelectedImageGenerationConfig(merged).imageModel, model);
  }
});

test("本地请求沿用已保存开关，浏览器私有请求可以重新开启", () => {
  const fallback = normalizeBrowserPrivateConfig({ apiKey: "local-key", includeImageToolModel: false });
  assert.equal(mergeRequestPrivateConfig({ imageRoute: "a", includeImageToolModel: true }, fallback).includeImageToolModel, false);
  assert.equal(mergeRequestPrivateConfig({ apiKey: "browser-key", includeImageToolModel: true }, fallback).includeImageToolModel, true);
});

test("其他路线不使用工具模型开关", () => {
  for (const imageRoute of ["b", "c", "d"]) {
    const enabled = getSelectedImageGenerationConfig({ imageRoute, includeImageToolModel: true });
    const disabled = getSelectedImageGenerationConfig({ imageRoute, includeImageToolModel: false });
    assert.deepEqual(disabled, enabled);
    assert.equal(Object.hasOwn(disabled, "includeImageToolModel"), false);
  }
});

test("关闭工具模型仅省略 model 属性，保留质量与流式参数", () => {
  const options = { prompt: "test", size: "1024x1024", imageModel: model, quality: "max", responsesModel: "text-model" };
  const enabled = createResponsesRequestBody(options);
  const disabled = createResponsesRequestBody({ ...options, includeImageToolModel: false });
  assert.equal(enabled.tools[0].model, model);
  assert.equal(Object.hasOwn(disabled.tools[0], "model"), false);
  delete enabled.tools[0].model;
  assert.deepEqual(disabled, enabled);
  assert.equal(disabled.tools[0].quality, "max");
  assert.equal(disabled.stream, true);
});

test("路由生成真实构造的请求按默认、关闭、重开状态发送模型", async () => {
  for (const includeImageToolModel of [undefined, false, true]) {
    let body;
    await requestImageGeneration({
      baseUrl: "https://route.example.test/v1", apiKey: "test-key",
      prompt: "test", size: "1024x1024", quality: "max",
      responsesModel: "text-model", imageModel: model, includeImageToolModel,
      async fetchImpl(_url, init) {
        body = JSON.parse(init.body);
        return new Response([
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"AAAA"}}',
          "", "data: [DONE]", "",
        ].join("\n"), {
          status: 200, headers: { "content-type": "text/event-stream" },
        });
      },
    });
    assert.equal(body.model, "text-model");
    assert.equal(body.stream, true);
    assert.equal(body.tools[0].quality, "max");
    assert.equal(Object.hasOwn(body.tools[0], "model"), includeImageToolModel !== false);
    if (includeImageToolModel !== false) assert.equal(body.tools[0].model, model);
  }
});

test("服务端配置保存接口往返开关，省略字段时保留已保存值", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-toggle-handler-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const configStore = createConfigStore({ rootDir, env: {} });
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const handler = source.match(/async function handleConfigPost\([^]*?\n\}/)?.[0];
  assert.ok(handler);
  let result;
  const context = { configStore, readJsonBody: async (request) => request, getAspectRatioOptions: () => [], sendJson: (_response, status, body) => { result = { status, body }; } };
  vm.runInNewContext(handler, context);
  for (const [payload, expected] of [[{ includeImageToolModel: false }, false], [{}, false], [{ includeImageToolModel: true }, true]]) {
    await context.handleConfigPost(payload, {});
    assert.equal(result.status, 200);
    assert.equal(result.body.includeImageToolModel, expected);
    assert.equal((await configStore.readPrivateConfig()).includeImageToolModel, expected);
  }
  const generationCalls = [...source.matchAll(/imageModel: (generationConfig|itemGenerationConfig)\.imageModel,\r?\n\s+includeImageToolModel: \1\.includeImageToolModel,\r?\n\s+endpointPath: \1\.endpointPath,/g)];
  assert.equal(generationCalls.length, 8, "所有生成入口都应传递路由开关，包括套图修复与共享生图选项");
});

test("路由模型并排布局与默认开启开关仅存在于路由面板", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const nodes = [];
  const visit = (node) => { nodes.push(node); for (const child of node.childNodes || []) visit(child); };
  visit(parse(html));
  const attr = (node, key) => node.attrs?.find((entry) => entry.name === key)?.value;
  const route = nodes.find((node) => attr(node, "data-route-panel") === "a");
  const fields = route.childNodes.filter((node) => attr(node, "class")?.split(" ").includes("field"));
  assert.equal(fields.length, 5);
  assert.match(attr(fields[2], "class"), /route-text-model-field/);
  assert.match(attr(fields[3], "class"), /route-tool-model-field/);
  const toggles = nodes.filter((node) => attr(node, "id") === "includeImageToolModelToggle");
  assert.equal(toggles.length, 1);
  const toggle = toggles[0];
  assert.equal(toggle.parentNode, fields[4]);
  assert.equal(attr(toggle, "role"), "switch");
  assert.equal(attr(toggle, "aria-checked"), "true");
  assert.equal(attr(toggle, "data-ui-i18n-aria-label"), "includeImageToolModel");
  assert.match(attr(toggle, "class"), /reference-analysis-auto-collapse/);
  assert.match(css, /\.route-config-panel\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  const desktop = css.slice(css.lastIndexOf("@media (min-width: 1120px)"));
  assert.match(desktop, /data-route-panel="a"\]\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(desktop, /\.route-text-model-field\s*\{[^}]*grid-column: 1;[^}]*grid-row: 3;/);
  assert.match(desktop, /\.route-tool-model-field\s*\{[^}]*grid-column: 2;[^}]*grid-row: 3;/);
  assert.match(desktop, /data-route-panel="a"\] > \.field\s*\{[^}]*grid-column: 1 \/ -1;/);
});
