import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDirectImageModelMappings, resolveDirectImageModelMapping } from "../lib/direct-image-model-mapping.mjs";
import { getSelectedImageGenerationConfig, getSelectedTextVisionConfig } from "../lib/image-route-config.mjs";
import { requestDirectImageGeneration, requestImageEdit } from "../lib/responses-workflow.mjs";

const model = "gpt-image-2.6-sunburst";
const mappings = [{ source: model, target: "IMAGE-2.6" }];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=";
const sourceImage = { filename: "source.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") };
const config = (extra = {}) => ({ imageRoute: "b", directImageBaseUrl: "https://images.example.test/v1", directImageApiKey: "image-test-key", directImageModel: model, directTextModel: "text-only", directImageModelMappings: mappings, ...extra });

test("image mappings normalize blank drafts and reject ambiguous or incomplete rules", () => {
  assert.deepEqual(normalizeDirectImageModelMappings(undefined), []);
  assert.deepEqual(normalizeDirectImageModelMappings("[]"), []);
  assert.deepEqual(normalizeDirectImageModelMappings([{ source: " A ", target: " B " }, { source: " ", target: "" }]), [{ source: "A", target: "B" }]);
  for (const value of ["invalid", {}, [null], [{ source: "A" }], [{ target: "B" }], [{ source: "A", target: "B" }, { source: " A ", target: "C" }]]) assert.throws(() => normalizeDirectImageModelMappings(value));
});

test("mapping matches exact case-sensitive IDs once and preserves capability identity", () => {
  assert.deepEqual(resolveDirectImageModelMapping(model, mappings), { selectedImageModel: model, imageModel: model, requestImageModel: "IMAGE-2.6" });
  assert.equal(resolveDirectImageModelMapping("A", [{ source: "A", target: "B" }, { source: "B", target: "C" }]).requestImageModel, "B");
  assert.equal(resolveDirectImageModelMapping("a", [{ source: "A", target: "B" }]).requestImageModel, "a");
  assert.equal(resolveDirectImageModelMapping("A", [{ source: "A", target: "A" }]).requestImageModel, "A");
  assert.equal(resolveDirectImageModelMapping("IMAGE-2.6", [{ source: "IMAGE-2.6", target: model }]).imageModel, model);
  assert.equal(resolveDirectImageModelMapping("unknown-2.6", []).imageModel, "unknown-2.6");
});

test("direct mapping does not alter text or other generation routes", () => {
  assert.equal(getSelectedTextVisionConfig(config()).responsesModel, "text-only");
  assert.equal(getSelectedImageGenerationConfig(config({ imageRoute: "a", imageToolModel: model })).requestImageModel, undefined);
  assert.equal(getSelectedImageGenerationConfig(config({ imageRoute: "c", protocolImageModel: model })).imageModel, model);
  assert.equal(getSelectedImageGenerationConfig(config({ imageRoute: "d", grokImageModel: model })).imageModel, model);
});

for (const endpointPath of ["images/generations", "images/edits", "responses", "chat/completions"]) {
  for (const streaming of [false, true]) {
    test(`direct mapping reaches ${endpointPath}, streaming=${streaming}`, async () => {
      const selected = getSelectedImageGenerationConfig(config({ directImageEndpointPath: endpointPath }));
      const calls = [];
      const result = await requestDirectImageGeneration({
        ...selected, prompt: "绘制一个杯子", size: "1024x1024", quality: "max", directImageStream: streaming,
        ...(endpointPath === "images/edits" ? { referenceImages: [sourceImage] } : {}),
        fetchImpl: async (url, options) => {
          const body = options.body instanceof FormData ? options.body : JSON.parse(options.body);
          calls.push({ url, body });
          if (endpointPath.startsWith("images/") && streaming) {
            assert.equal(body instanceof FormData ? body.get("stream") : body.stream, body instanceof FormData ? "true" : true);
            return new Response(`event: image_generation.completed\ndata: ${JSON.stringify({ type: "image_generation.completed", b64_json: png })}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
          }
          const payload = endpointPath === "responses" ? { status: "completed", output: [{ type: "image_generation_call", result: png }] }
            : endpointPath === "chat/completions" ? { choices: [{ message: { content: `data:image/png;base64,${png}` } }] }
              : { data: [{ b64_json: png }] };
          return Response.json(payload);
        },
      });
      assert.equal(calls.length, 1);
      const { body } = calls[0];
      if (body instanceof FormData) {
        assert.equal(body.get("model"), "IMAGE-2.6");
        assert.equal(body.get("quality"), "max");
      } else if (endpointPath === "responses") {
        assert.equal(body.model, "text-only");
        assert.equal(body.tools[0].model, "IMAGE-2.6");
        assert.equal(body.tools[0].quality, "max");
      } else {
        assert.equal(body.model, "IMAGE-2.6");
        assert.equal(body.quality, "max");
        if (endpointPath === "images/generations") assert.equal(body.response_format, undefined);
      }
      assert.equal(result.selectedImageModel, model);
      assert.equal(result.requestImageModel, "IMAGE-2.6");
      assert.equal(result.finalImageBase64, png);
      assert.equal(result.streamFallbackUsed, false);
    });
  }
}

test("direct references auto-switch to edits without losing mapping", async () => {
  const selected = getSelectedImageGenerationConfig(config());
  await requestDirectImageGeneration({ ...selected, prompt: "修改杯子", referenceImages: [sourceImage], size: "1024x1024", quality: "max", fetchImpl: async (url, options) => {
    assert.ok(url.endsWith("/images/edits"));
    assert.equal(options.body.get("model"), "IMAGE-2.6");
    return Response.json({ data: [{ b64_json: png }] });
  } });
});

test("explicit image edits send mapped model while retaining 2.6 markup capability", async () => {
  const selected = getSelectedImageGenerationConfig(config());
  const result = await requestImageEdit({ ...selected, prompt: "修改杯子", sourceImage, size: "1024x1024", quality: "max", imageOptions: { complexity: "low" }, fetchImpl: async (_url, options) => {
    assert.equal(options.body.get("model"), "IMAGE-2.6");
    assert.equal(options.body.get("complexity"), "low");
    return Response.json({ data: [{ b64_json: png }] });
  } });
  assert.equal(result.requestImageModel, "IMAGE-2.6");
});
