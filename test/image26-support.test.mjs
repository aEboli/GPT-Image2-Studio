import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_TOOL_MODEL_OPTIONS, supportsExtendedImageQuality } from "../lib/model-defaults.mjs";
import { normalizeImageQuality } from "../lib/image-quality-options.mjs";
import { normalizeOutputFormat, toOutputFormatMimeType } from "../lib/output-format-options.mjs";
import { consumeResponsesSse, createDirectImageRequestBody, createResponsesRequestBody } from "../lib/responses-workflow.mjs";
import { inspectGeneratedImage } from "../lib/generated-image-validation.mjs";
import { buildImageOptionParameters, getImageOptionsForFormat, normalizeGptImage26Size } from "../lib/image-model-capabilities.mjs";
import { getSelectedImageGenerationConfig } from "../lib/image-route-config.mjs";
import { normalizeBrowserPrivateConfig, appendBrowserConfigToFormData } from "../lib/browser-config.mjs";
import { resolveCreationRepairGenerationConfig } from "../lib/creation-repair.mjs";

test("2.6 models retain extended quality and new output formats", () => {
  for (const model of ["gpt-image-2.6-sunburst", "gpt-image-2.6-flare"]) {
    assert.ok(IMAGE_TOOL_MODEL_OPTIONS.includes(model));
    assert.ok(supportsExtendedImageQuality(model));
    assert.equal(normalizeImageQuality("max", { imageModel: model }), "max");
  }
  for (const format of ["webp", "gif", "svg"]) assert.equal(normalizeOutputFormat(format), format);
  assert.equal(toOutputFormatMimeType("svg"), "image/svg+xml");
});

test("Responses final image events preserve available quality and author usage", async () => {
  const payload = { response: { usage: { total_tokens: 12 }, output: [{ type: "image_generation_call", result: "aW1hZ2U=", quality: "xhigh", svg_usage: { model: "author", total_tokens: 4 } }] } };
  const stream = new Response(["event: response.completed", "data: " + JSON.stringify(payload), "", ""].join(String.fromCharCode(10))).body;
  const result = await consumeResponsesSse(stream);
  assert.equal(result.actualQuality, "xhigh");
  assert.equal(result.svgUsage.model, "author");
  assert.equal(result.usage.total_tokens, 12);
});

test("2.6 direct requests serialize image planning independently and omit legacy response_format", () => {
  const body = createDirectImageRequestBody({ prompt: "图标", imageModel: "gpt-image-2.6-flare", size: "1024x1024", quality: "max", imageOptions: { complexity: "low", n: 3 } });
  assert.equal(body.complexity, "low");
  assert.equal(body.quality, "max");
  assert.equal(body.n, 3);
  assert.equal(body.response_format, undefined);
});

test("Responses GIF keeps lifecycle streaming without partial previews", () => {
  const body = createResponsesRequestBody({ prompt: "循环动画", responsesModel: "gpt-6-luna", imageModel: "gpt-image-2.6-flare", includeImageToolModel: true, size: "1024x1024", format: "gif", imageOptions: { complexity: "medium", frameCount: 9, frameDurationMs: 200 } });
  assert.equal(body.stream, true);
  assert.equal(body.tools[0].frame_count, 9);
  assert.equal(body.tools[0].frame_duration_ms, 200);
  assert.equal(body.tools[0].partial_images, undefined);
});

test("generated SVG is validated as vector content and rejects active content", () => {
  assert.equal(inspectGeneratedImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="red"/></svg>')).format, "svg");
  assert.equal(inspectGeneratedImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" onload="alert(1)"/>')).valid, false);
  assert.equal(inspectGeneratedImage(Buffer.from('<svg><broken></svg>')).valid, false);
});

test("advanced controls round-trip, including zero, and repairs keep the original snapshot", () => {
  const options = { complexity: "high", partialImages: 0, outputCompression: 0 };
  const config = normalizeBrowserPrivateConfig({ imageToolModel: "gpt-image-2.6-flare", imageOptions: options });
  const form = appendBrowserConfigToFormData(new FormData(), () => config);
  assert.deepEqual(JSON.parse(form.get("imageOptions")), options);
  assert.deepEqual(resolveCreationRepairGenerationConfig({ imageOptions: { complexity: "low" } }, { imageOptions: options }).imageOptions, { complexity: "low" });
  assert.deepEqual(resolveCreationRepairGenerationConfig({}, { imageOptions: options }).imageOptions, {});
  assert.deepEqual(getImageOptionsForFormat({ ...options, n: 3, frameCount: 9, svgModel: "author" }, "png", true), { complexity: "high", partialImages: 0 });
});

test("direct Responses separates the outer text model from the 2.6 image tool model", () => {
  const config = getSelectedImageGenerationConfig({ imageRoute: "b", directImageModel: "gpt-image-2.6-flare", directImageEndpointPath: "responses", directTextModel: "gpt-6-luna" });
  assert.equal(config.imageModel, "gpt-image-2.6-flare");
  assert.equal(config.responsesModel, "gpt-6-luna");
});

test("invalid advanced combinations fail before transport", () => {
  const context = { imageModel: "gpt-image-2.6-flare", format: "svg" };
  for (const options of [{ n: 2 }, { partialImages: 1 }, { outputCompression: 50 }]) assert.throws(() => buildImageOptionParameters(options, context));
  assert.throws(() => buildImageOptionParameters({}, { ...context, operation: "edit" }));
  assert.throws(() => buildImageOptionParameters({}, { ...context, format: "png", mask: {}, markup: {} }));
  assert.equal(normalizeGptImage26Size("auto"), "auto");
  assert.equal(normalizeGptImage26Size("1536x864"), "1536x864");
  assert.equal(normalizeGptImage26Size("1001x1001"), "1001x1001");
  assert.throws(() => normalizeGptImage26Size("0x1024"));
});

test("SVG parsing rejects external entities, processing instructions and external styles", () => {
  for (const content of [
    '<!DOCTYPE svg [<!ENTITY ext SYSTEM "file:///secret">]><svg xmlns="http://www.w3.org/2000/svg" width="32" height="24">&ext;</svg>',
    '<?xml-stylesheet href="https://example.test/remote.css"?><svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><style>@import "https://example.test/remote.css";</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><use href="https://example.test/a.svg#x"/></svg>',
  ]) assert.equal(inspectGeneratedImage(Buffer.from(content)).valid, false);
  assert.equal(inspectGeneratedImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><defs><linearGradient id="a"><stop stop-color="red"/></linearGradient></defs><rect width="32" height="24" fill="url(#a)"/></svg>')).valid, true);
});
