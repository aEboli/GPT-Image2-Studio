import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendBrowserConfigToFormData,
  normalizeBrowserPrivateConfig,
  toPublicBrowserConfig,
} from "../lib/browser-config.mjs";
import { createConfigStore } from "../lib/config-store.mjs";
import { getSelectedImageGenerationConfig } from "../lib/image-route-config.mjs";
import {
  DEFAULT_IMAGE_TOOL_MODEL,
  IMAGE_TOOL_MODEL_OPTIONS,
  normalizeImageToolModel,
} from "../lib/model-defaults.mjs";
import { mergeRequestPrivateConfig } from "../lib/request-private-config.mjs";
import { requestImageEdit } from "../lib/responses-workflow.mjs";

const SUNBURST = "gpt-image-2.5-sunburst";
const FLARE = "gpt-image-2.5-flare";

test("image tool model options are the official ids with gpt-image-2 as the default", () => {
  assert.deepEqual(IMAGE_TOOL_MODEL_OPTIONS, ["gpt-image-2", SUNBURST, FLARE]);
  assert.equal(DEFAULT_IMAGE_TOOL_MODEL, "gpt-image-2");
});

test("normalizeImageToolModel accepts allowlisted ids and rejects everything else", () => {
  IMAGE_TOOL_MODEL_OPTIONS.forEach((modelId) => {
    assert.equal(normalizeImageToolModel(modelId), modelId);
  });
  assert.equal(normalizeImageToolModel(`  ${SUNBURST}  `), SUNBURST);
  // 自定义值、空值和被弃用的旧模型都收敛为默认值。
  assert.equal(normalizeImageToolModel("vendor-image-pro"), "gpt-image-2");
  assert.equal(normalizeImageToolModel("gpt-image-2.5"), "gpt-image-2");
  assert.equal(normalizeImageToolModel("gpt-image-1.5"), "gpt-image-2");
  assert.equal(normalizeImageToolModel(""), "gpt-image-2");
  assert.equal(normalizeImageToolModel(undefined), "gpt-image-2");
  assert.equal(normalizeImageToolModel(null), "gpt-image-2");
  // 非法值搭配合法 fallback 时用 fallback；fallback 也非法时才回落默认值。
  assert.equal(normalizeImageToolModel("nope", FLARE), FLARE);
  assert.equal(normalizeImageToolModel("nope", "also-nope"), "gpt-image-2");
});

test("route A image generation uses the configured tool model", () => {
  const base = { baseUrl: "https://api.openai.com/v1", apiKey: "test-key", imageRoute: "a" };

  assert.equal(getSelectedImageGenerationConfig(base).imageModel, "gpt-image-2");
  assert.equal(getSelectedImageGenerationConfig({ ...base, imageToolModel: SUNBURST }).imageModel, SUNBURST);
  assert.equal(getSelectedImageGenerationConfig({ ...base, imageToolModel: FLARE }).imageModel, FLARE);
  // 自定义值不能透传到上游。
  assert.equal(getSelectedImageGenerationConfig({ ...base, imageToolModel: "vendor-image-pro" }).imageModel, "gpt-image-2");
  // 路由 B 与路由 C 各自的模型字段不受影响。
  assert.equal(
    getSelectedImageGenerationConfig({ ...base, imageRoute: "b", directImageModel: "vendor-image-pro", imageToolModel: SUNBURST })
      .imageModel,
    "vendor-image-pro",
  );
  assert.equal(
    getSelectedImageGenerationConfig({ ...base, imageRoute: "c", protocolImageModel: "gemini-x", imageToolModel: SUNBURST })
      .imageModel,
    "gemini-x",
  );
});

test("local configuration persists the tool model and clamps illegal values", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-tool-model-"));
  const store = createConfigStore({ rootDir });

  assert.equal((await store.readPrivateConfig()).imageToolModel, "gpt-image-2");

  const saved = await store.saveConfig({ imageToolModel: SUNBURST });
  assert.equal(saved.imageToolModel, SUNBURST);
  assert.equal((await store.readPrivateConfig()).imageToolModel, SUNBURST);
  assert.equal((await store.readPublicConfig()).imageToolModel, SUNBURST);
  assert.equal(getSelectedImageGenerationConfig(await store.readPrivateConfig()).imageModel, SUNBURST);

  const clamped = await store.saveConfig({ imageToolModel: "vendor-image-pro" });
  assert.equal(clamped.imageToolModel, "gpt-image-2");
});

test("environment variables can select the tool model but not a custom one", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-tool-model-env-"));

  const viaShort = await createConfigStore({ rootDir, env: { IMAGE_TOOL_MODEL: FLARE } }).readPrivateConfig();
  assert.equal(viaShort.imageToolModel, FLARE);

  const viaPrefixed = await createConfigStore({
    rootDir,
    env: { IMAGE_STUDIO_IMAGE_TOOL_MODEL: SUNBURST },
  }).readPrivateConfig();
  assert.equal(viaPrefixed.imageToolModel, SUNBURST);

  const viaCustom = await createConfigStore({ rootDir, env: { IMAGE_TOOL_MODEL: "vendor-image-pro" } }).readPrivateConfig();
  assert.equal(viaCustom.imageToolModel, "gpt-image-2");
});

test("browser configuration round-trips the tool model through storage and FormData", () => {
  assert.equal(normalizeBrowserPrivateConfig().imageToolModel, "gpt-image-2");
  assert.equal(normalizeBrowserPrivateConfig({ imageToolModel: FLARE }).imageToolModel, FLARE);
  assert.equal(normalizeBrowserPrivateConfig({ imageToolModel: "vendor-image-pro" }).imageToolModel, "gpt-image-2");
  assert.equal(toPublicBrowserConfig({ imageToolModel: SUNBURST }).imageToolModel, SUNBURST);

  const formData = appendBrowserConfigToFormData(new FormData(), () => normalizeBrowserPrivateConfig({ imageToolModel: SUNBURST }));
  assert.equal(formData.get("imageToolModel"), SUNBURST);
});

test("request configuration applies the submitted tool model only alongside a request key", () => {
  const serverConfig = normalizeBrowserPrivateConfig({ apiKey: "server-key", imageToolModel: FLARE });

  const withKey = mergeRequestPrivateConfig(
    new Map([
      ["apiKey", "browser-key"],
      ["baseUrl", "https://api.openai.com/v1"],
      ["imageToolModel", SUNBURST],
    ]),
    serverConfig,
  );
  assert.equal(withKey.imageToolModel, SUNBURST);
  assert.equal(getSelectedImageGenerationConfig(withKey).imageModel, SUNBURST);

  // 请求里的自定义模型被收敛，不会透传给上游。
  const withCustomModel = mergeRequestPrivateConfig(
    new Map([
      ["apiKey", "browser-key"],
      ["imageToolModel", "vendor-image-pro"],
    ]),
    serverConfig,
  );
  assert.equal(withCustomModel.imageToolModel, "gpt-image-2");

  // 本地模式（请求不带 Key）仍以服务端保存的配置为准。
  const withoutKey = mergeRequestPrivateConfig(
    new Map([
      ["imageRoute", "a"],
      ["imageToolModel", SUNBURST],
    ]),
    serverConfig,
  );
  assert.equal(withoutKey.imageToolModel, FLARE);
});

test("image edit requests carry the configured tool model", async () => {
  async function captureEditModel(imageToolModel) {
    const generationConfig = getSelectedImageGenerationConfig({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      imageRoute: "a",
      imageToolModel,
    });
    let sentModel = null;
    await requestImageEdit({
      baseUrl: generationConfig.baseUrl,
      apiKey: generationConfig.apiKey,
      prompt: "edit it",
      sourceImage: { buffer: Buffer.from([1, 2, 3]), filename: "a.png", mimeType: "image/png" },
      size: "1024x1024",
      quality: "high",
      format: "png",
      imageModel: generationConfig.imageModel,
      onEvent() {},
      async fetchImpl(_url, init) {
        sentModel = init.body.get("model");
        return new Response(JSON.stringify({ data: [{ b64_json: "AAAA" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    return sentModel;
  }

  assert.equal(await captureEditModel(undefined), "gpt-image-2");
  assert.equal(await captureEditModel(SUNBURST), SUNBURST);
  assert.equal(await captureEditModel(FLARE), FLARE);
  // 非白名单值在归一化时就被拦下，编辑请求同样不会带上它。
  assert.equal(await captureEditModel("vendor-image-pro"), "gpt-image-2");
});

test("no consumer still hardcodes the route-mode tool model", async () => {
  // 这些位置原本写死 "gpt-image-2"：客户端乐观展示记录和 PPT 清单。工具模型可配置后
  // 它们必须读所选模型，否则界面与记录会谎报一个没实际使用的模型。
  const files = [
    "../lib/views/quick-blend-view.mjs",
    "../lib/views/image-edit-view.mjs",
    "../public/lib/views/quick-blend-view.mjs",
    "../public/lib/views/image-edit-view.mjs",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /imageModel: "gpt-image-2"/, `${file} must not hardcode the tool model`);
    assert.match(source, /imageModel: normalizeImageToolModel\(state\.config\?\.imageToolModel\)/, file);
  }

  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(server, /imageModel: "gpt-image-2",\r?\n\s+reasoningEffort,\r?\n\s+motion,/);
  assert.match(server, /imageModel: getSelectedImageGenerationConfig\(config\)\.imageModel,/);

  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /imageModel: DEFAULT_DIRECT_IMAGE_MODEL,/);
});

test("the config panel exposes the tool model as a fixed dropdown without a text input", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  const selectMatch = html.match(/<select id="imageToolModelSelect"[\s\S]*?<\/select>/);
  assert.ok(selectMatch, "config panel must render an imageToolModelSelect dropdown");
  const select = selectMatch[0];
  assert.match(select, /name="imageToolModel"/);
  assert.deepEqual(
    [...select.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]),
    IMAGE_TOOL_MODEL_OPTIONS,
  );
  // 只能下拉选择：不允许存在同名的自由文本输入框。
  assert.doesNotMatch(html, /<input[^>]*name="imageToolModel"/);
  assert.doesNotMatch(html, /<input[^>]*id="imageToolModelInput"/);

  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /imageToolModelSelect: document\.querySelector\("#imageToolModelSelect"\)/);
  assert.match(app, /imageToolModel: getSelectedImageToolModel\(browserPayload\)/);
  assert.match(app, /refs\.imageToolModelSelect\.value = imageToolModel/);
  assert.match(app, /refs\.parameterToolModel\.textContent = imageToolModel/);
});
