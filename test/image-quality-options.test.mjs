import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createConfigStore } from "../lib/config-store.mjs";
import { getSelectedImageGenerationConfig } from "../lib/image-route-config.mjs";
import {
  DEFAULT_IMAGE_QUALITY,
  EXTENDED_IMAGE_QUALITY_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  getImageQualityOptions,
  isImageQualitySupportedByModel,
  normalizeImageQuality,
} from "../lib/image-quality-options.mjs";
import { supportsExtendedImageQuality } from "../lib/model-defaults.mjs";
import { requestImageEdit } from "../lib/responses-workflow.mjs";

const SUNBURST = "gpt-image-2.5-sunburst";
const FLARE = "gpt-image-2.5-flare";
const LEGACY = "gpt-image-2";

test("quality options cover the official tiers and keep high as the repo default", () => {
  assert.deepEqual(IMAGE_QUALITY_OPTIONS, ["auto", "low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(EXTENDED_IMAGE_QUALITY_OPTIONS, ["xhigh", "max"]);
  // 官方 API 默认 auto，但仓库既有行为是 high，不能悄悄改掉所有人的出图质量。
  assert.equal(DEFAULT_IMAGE_QUALITY, "high");
});

test("only the 2.5 models advertise the extended tiers", () => {
  assert.equal(supportsExtendedImageQuality(SUNBURST), true);
  assert.equal(supportsExtendedImageQuality(FLARE), true);
  assert.equal(supportsExtendedImageQuality(LEGACY), false);
  assert.equal(supportsExtendedImageQuality("gpt-image-1.5"), false);
  assert.equal(supportsExtendedImageQuality(""), false);
  assert.equal(supportsExtendedImageQuality(undefined), false);

  assert.deepEqual(
    getImageQualityOptions(SUNBURST).map((option) => option.value),
    ["auto", "low", "medium", "high", "xhigh", "max"],
  );
  assert.deepEqual(
    getImageQualityOptions(LEGACY).map((option) => option.value),
    ["auto", "low", "medium", "high"],
  );
  // 未知或空模型按保守处理，不暴露扩展档。
  assert.deepEqual(
    getImageQualityOptions("").map((option) => option.value),
    ["auto", "low", "medium", "high"],
  );
  assert.ok(getImageQualityOptions(SUNBURST).every((option) => option.label));
});

test("extended tiers clamp to high on models that cannot take them", () => {
  assert.equal(normalizeImageQuality("max", { imageModel: SUNBURST }), "max");
  assert.equal(normalizeImageQuality("xhigh", { imageModel: FLARE }), "xhigh");
  // 这是本次改动的核心保护：选了 max 之后把工具模型切回旧模型，必须降级而不是让上游报 400。
  assert.equal(normalizeImageQuality("max", { imageModel: LEGACY }), "high");
  assert.equal(normalizeImageQuality("xhigh", { imageModel: LEGACY }), "high");
  assert.equal(normalizeImageQuality("XHigh", { imageModel: LEGACY }), "high");
  assert.equal(normalizeImageQuality("max", { imageModel: "" }), "high");

  // 非扩展档在任何模型上都原样透传。
  ["auto", "low", "medium", "high"].forEach((quality) => {
    assert.equal(normalizeImageQuality(quality, { imageModel: LEGACY }), quality);
    assert.equal(normalizeImageQuality(quality, { imageModel: SUNBURST }), quality);
  });

  // 大小写与空白归一化。
  assert.equal(normalizeImageQuality("  MAX  ", { imageModel: SUNBURST }), "max");

  // 非法值走 fallback，fallback 也非法时回落默认值；fallback 同样受模型收敛约束。
  assert.equal(normalizeImageQuality("ultra", { imageModel: SUNBURST }), "high");
  assert.equal(normalizeImageQuality("ultra", { imageModel: SUNBURST, fallback: "max" }), "max");
  assert.equal(normalizeImageQuality("ultra", { imageModel: LEGACY, fallback: "max" }), "high");
  assert.equal(normalizeImageQuality("ultra", { imageModel: SUNBURST, fallback: "nope" }), "high");
  assert.equal(normalizeImageQuality("", { imageModel: SUNBURST }), "high");
  assert.equal(normalizeImageQuality(undefined, { imageModel: SUNBURST }), "high");
  // 不传 imageModel 时按保守处理。
  assert.equal(normalizeImageQuality("max"), "high");
});

test("isImageQualitySupportedByModel gates the extended tiers", () => {
  assert.equal(isImageQualitySupportedByModel("max", SUNBURST), true);
  assert.equal(isImageQualitySupportedByModel("max", LEGACY), false);
  assert.equal(isImageQualitySupportedByModel("high", LEGACY), true);
  assert.equal(isImageQualitySupportedByModel("ultra", SUNBURST), false);
});

test("saved configuration clamps quality against the saved tool model", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-quality-"));
  const store = createConfigStore({ rootDir });

  assert.equal((await store.readPrivateConfig()).defaults.quality, "high");

  const withSunburst = await store.saveConfig({ imageToolModel: SUNBURST, defaults: { quality: "max" } });
  assert.equal(withSunburst.defaults.quality, "max");
  assert.equal((await store.readPublicConfig()).defaults.quality, "max");

  // 只切模型、不动质量：已保存的 max 必须随之降级，否则之后每次生成都会失败。
  const backToLegacy = await store.saveConfig({ imageToolModel: LEGACY });
  assert.equal(backToLegacy.defaults.quality, "high");
  assert.equal((await store.readPrivateConfig()).defaults.quality, "high");

  const bogus = await store.saveConfig({ defaults: { quality: "ultra" } });
  assert.equal(bogus.defaults.quality, "high");
});

test("environment variables can select a quality tier within model limits", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-quality-env-"));

  const allowed = await createConfigStore({
    rootDir,
    env: { IMAGE_TOOL_MODEL: SUNBURST, IMAGE_QUALITY: "max" },
  }).readPrivateConfig();
  assert.equal(allowed.defaults.quality, "max");

  const clamped = await createConfigStore({
    rootDir,
    env: { IMAGE_QUALITY: "max" },
  }).readPrivateConfig();
  assert.equal(clamped.defaults.quality, "high");

  const bogus = await createConfigStore({ rootDir, env: { IMAGE_QUALITY: "ultra" } }).readPrivateConfig();
  assert.equal(bogus.defaults.quality, "high");

  const prefixed = await createConfigStore({
    rootDir,
    env: { IMAGE_STUDIO_IMAGE_TOOL_MODEL: FLARE, IMAGE_STUDIO_IMAGE_QUALITY: "xhigh" },
  }).readPrivateConfig();
  assert.equal(prefixed.defaults.quality, "xhigh");

  // 质量环境变量不应干扰思考等级。
  const both = await createConfigStore({
    rootDir,
    env: { IMAGE_QUALITY: "low", REASONING_EFFORT: "medium" },
  }).readPrivateConfig();
  assert.equal(both.defaults.quality, "low");
  assert.equal(both.defaults.reasoningEffort, "medium");
});

test("upstream edit requests carry the clamped quality", async () => {
  async function captureQuality({ imageToolModel, quality }) {
    const generationConfig = getSelectedImageGenerationConfig({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      imageRoute: "a",
      imageToolModel,
    });
    let sent = null;
    await requestImageEdit({
      baseUrl: generationConfig.baseUrl,
      apiKey: generationConfig.apiKey,
      prompt: "edit it",
      sourceImage: { buffer: Buffer.from([1, 2, 3]), filename: "a.png", mimeType: "image/png" },
      size: "1024x1024",
      quality: normalizeImageQuality(quality, { imageModel: generationConfig.imageModel }),
      format: "png",
      imageModel: generationConfig.imageModel,
      onEvent() {},
      async fetchImpl(_url, init) {
        sent = { model: init.body.get("model"), quality: init.body.get("quality") };
        return new Response(JSON.stringify({ data: [{ b64_json: "AAAA" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    return sent;
  }

  assert.deepEqual(await captureQuality({ imageToolModel: SUNBURST, quality: "max" }), {
    model: SUNBURST,
    quality: "max",
  });
  assert.deepEqual(await captureQuality({ imageToolModel: LEGACY, quality: "max" }), {
    model: LEGACY,
    quality: "high",
  });
});

test("select options declare a theme-following background so the native popup stays readable", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  // 下拉弹层由系统绘制。option 没有不透明底色时，Windows 会铺自己的浅色背景，
  // 而文字继承接近白色的 --text，深色主题下就是白底白字。
  const globalOptionRule = css.match(/\nselect option,\r?\nselect optgroup \{[^}]*\}/);
  assert.ok(globalOptionRule, "a global `select option` background rule must exist");
  assert.match(globalOptionRule[0], /background:\s*var\(--bg-soft\)/);
  assert.match(globalOptionRule[0], /color:\s*var\(--text\)/);

  // 兜底规则的特异度必须低于既有的按类规则，否则会覆盖它们刻意的配色。
  assert.match(css, /\.compact-field select option \{[^}]*background:\s*var\(--bg-soft\)/);
  assert.match(css, /\.endpoint-suffix-select option \{/);

  // 改了 styles.css 就必须升版本号，否则老用户命中缓存仍看到旧样式。
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const stylesVersion = html.match(/styles\.css\?v=([\w-]+)/);
  assert.ok(stylesVersion, "index.html must pin a styles.css version");
  assert.notEqual(stylesVersion[1], "20260830-temu-workbench-1", "bump the asset version when styles.css changes");
});

test("the parameter panel exposes quality as a dropdown instead of static text", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  const select = html.match(/<select id="qualityInput"[^>]*>/);
  assert.ok(select, "parameter panel must render a qualityInput select");
  assert.match(select[0], /name="quality"/);
  // 原本是写死的 <strong>High</strong>，现在必须没有了。
  assert.doesNotMatch(html, /<span data-ui-i18n="quality">质量<\/span>\s*<strong>High<\/strong>/);

  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /qualityInput: document\.querySelector\("#qualityInput"\)/);
  assert.match(app, /function renderImageQualityOptions\(\)/);
  // 切换工具模型时要重建选项，否则旧模型上仍能选到 xhigh / max。
  assert.match(app, /renderImageQualityOptions\(\);\s*\}\);/);
  assert.match(app, /formData\.set\("quality", job\.quality\)/);
  assert.doesNotMatch(app, /quality: state\.config\?\.defaults\?\.quality \|\| "high"/);

  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(server, /const finalQuality = config\.defaults\?\.quality \|\| "high"/);
  assert.doesNotMatch(server, /quality: config\.defaults\?\.quality \|\| "high"/);
  assert.match(server, /normalizeImageQuality\(formData\.get\("quality"\) \|\| config\.defaults\?\.quality/);

  assert.ok(
    (await readFile(new URL("../scripts/sync-public-lib.mjs", import.meta.url), "utf8")).includes(
      '"image-quality-options.mjs"',
    ),
    "the new shared module must be in the public/lib sync manifest or the browser import 404s",
  );
});
