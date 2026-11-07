import test from "node:test";
import assert from "node:assert/strict";
import { inferPromptOutputFormat, resolvePromptOutputFormat } from "../lib/prompt-output-format.mjs";
import { getOutputFormatOptions } from "../lib/output-format-options.mjs";
import { createDirectImageRequestBody, createResponsesRequestBody } from "../lib/responses-workflow.mjs";

test("自动识别明确格式、中英文动图及最后一次输出要求", () => {
  for (const [prompt, expected] of [
    ["生成一张会循环播放的 GIF 动画", "gif"],
    ["制作小猫眨眼的动图", "gif"],
    ["一只跳舞的小猫，循环动画", "gif"],
    ["Create an animated GIF of a dancing cat", "gif"],
    ["保存为 JPEG", "jpg"],
    ["请输出 WebP 图片", "webp"],
    ["输出 SVG 矢量图", "svg"],
    ["先考虑 PNG，最后输出 GIF", "gif"],
    ["不要 GIF，输出静态 PNG", "png"],
    ["不需要动图，请输出 JPG", "jpg"],
    ["不要 GIF 而是 PNG", "png"],
    ["输出 PNG 而不是 GIF", "png"],
    ["不是 PNG 而是 GIF", "gif"],
    ["Use PNG instead of GIF", "png"],
    ["No GIF, return PNG", "png"],
    ["生成动画风格的猫，画面有动感", ""],
    ["生成一件印有 GIF 字样的 T 恤", ""],
    ["画面中的按钮写着 PNG 字样", ""],
    ["画一个按钮，上面写着 GIF", ""],
    ["生成文字是 GIF 的标志", ""],
    ["Draw a T-shirt with the text GIF", ""],
    ["不要生成动图", ""],
    ["Do not generate a GIF", ""],
    ["a gift box", ""],
  ]) assert.equal(inferPromptOutputFormat(prompt), expected, prompt);
});

test("自动策略覆盖所有 GPT 模型，手动优先且冲突只是提示", () => {
  for (const imageModel of ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.6-sunburst", "IMAGE-2.6"]) {
    const auto = resolvePromptOutputFormat({ selection: "auto", prompt: "生成 GIF 动画", imageModel });
    assert.equal(auto.format, "gif");
    assert.equal(auto.source, "prompt");
    assert.equal(auto.error, undefined);
    const manual = resolvePromptOutputFormat({ selection: "png", prompt: "生成 GIF 动画", imageModel });
    assert.equal(manual.format, "png");
    assert.equal(manual.source, "manual");
    assert.match(manual.warning, /手动/);
    assert.equal(manual.error, undefined);
    const fallback = resolvePromptOutputFormat({ prompt: "动画风格的小猫", imageModel });
    assert.equal(fallback.format, "png");
    assert.equal(fallback.source, "default");
    assert.deepEqual(getOutputFormatOptions({ imageModel, special: true, automatic: true }).map((item) => item.value), ["auto", "png", "jpg", "webp", "gif", "svg"]);
  }
});

test("各模型的 GIF 和 SVG 请求仍正常发出，不传 auto 或静默降级", () => {
  for (const imageModel of ["gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.6-flare", "provider-image"]) {
    for (const format of ["gif", "svg"]) {
      const options = { prompt: "生成图片", imageModel, responsesModel: "gpt-6-luna", size: "1024x1024", format };
      const direct = createDirectImageRequestBody(options);
      const routed = createResponsesRequestBody(options).tools[0];
      assert.equal(direct.output_format, format);
      assert.equal(routed.output_format, format);
      if (format === "gif") {
        assert.equal(direct.frame_count, 9);
        assert.equal(routed.frame_duration_ms, 200);
      }
    }
  }
});
