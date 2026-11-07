import test from "node:test";
import assert from "node:assert/strict";
import { createImageOptionsView } from "../lib/image-options-view.mjs";
import { resolvePromptOutputFormat } from "../lib/prompt-output-format.mjs";

function element() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    children: [], dataset: {}, value: "", hidden: false, disabled: false, textContent: "",
    append(...nodes) { this.children.push(...nodes); },
    setAttribute(key, value) { attributes.set(key, String(value)); },
    getAttribute(key) { return attributes.get(key); },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatchEvent(event) { for (const callback of listeners.get(event.type) || []) callback(event); return true; },
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
  };
}

test("各 GPT 模型共用格式入口，帧参数同步且参数约束保持", (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  const root = element();
  const promptRoot = element();
  const formatInput = element();
  const formatField = element();
  formatInput.closest = (selector) => selector === "label" ? formatField : null;
  formatInput.value = "png";
  const formats = ["png", "jpg", "webp", "gif", "svg"].map((value) => Object.assign(element(), { dataset: { promptOutputFormat: value } }));
  const mirrors = ["frameCount", "frameDurationMs"].map((value) => Object.assign(element(), { dataset: { promptImageOption: value } }));
  const gif = element();
  const settings = element();
  promptRoot.querySelectorAll = (selector) => selector === "[data-prompt-output-format]" ? formats : mirrors;
  promptRoot.querySelector = (selector) => ({ "[data-prompt-output-gif]": gif, "[data-prompt-output-settings]": settings })[selector];
  let model = "gpt-image-2";
  let references = 0;
  let promptMode = true;
  let openSettings = 0;
  const selections = [];
  const automatic = element();
  const querySelector = promptRoot.querySelector;
  promptRoot.querySelector = (selector) => selector === '[data-prompt-output-auto]' ? automatic : querySelector(selector);
  let prompt = '';
  const view = createImageOptionsView({ root, promptRoot, formatInput, getModel: () => model, getOutputDecision: () => resolvePromptOutputFormat({ selection: formatInput.value, prompt, imageModel: model }), getReferenceCount: () => references, isPromptMode: () => promptMode, onFormatChange: (value) => selections.push(value), onOpenSettings: () => openSettings++ });
  view.refresh();
  assert.equal(promptRoot.hidden, false);
  assert.equal(formatField.hidden, true, "有上方快捷入口时隐藏下方重复格式");
  assert.equal(settings.hidden, true);
  model = "gpt-image-2.6-sunburst";
  view.refresh();
  assert.equal(promptRoot.hidden, false);
  assert.equal(settings.hidden, false);
  formats[3].dispatchEvent(new Event("click"));
  assert.equal(formatInput.value, "gif");
  assert.equal(gif.hidden, false);
  assert.equal(mirrors[0].disabled, false);
  assert.equal(formats[3].getAttribute("aria-pressed"), "true");
  assert.deepEqual(selections, ["gif"]);
  mirrors[0].value = "12";
  mirrors[0].dispatchEvent(new Event("input"));
  assert.equal(view.read().frameCount, 12);
  view.write({ frameCount: 8, frameDurationMs: 120 });
  assert.equal(mirrors[0].value, 8);
  assert.equal(mirrors[1].value, 120);
  const canonicalCount = root.children[0].children.map((label) => label.children[1]).find((input) => input.dataset.imageOption === "frameCount");
  canonicalCount.value = "10";
  canonicalCount.dispatchEvent(new Event("change"));
  assert.equal(mirrors[0].value, "10");
  references = 1;
  view.refresh();
  assert.match(view.getPromptError(), /移除参考图/);
  references = 0;
  view.write({ n: 2 });
  assert.match(view.getPromptError(), /候选数/);
  view.write({ background: "transparent" });
  assert.match(view.getPromptError(), /背景/);
  view.write({});
  view.refresh();
  assert.equal(view.getPromptError(), "");
  formats[4].dispatchEvent(new Event("click"));
  assert.equal(formatInput.value, "svg");
  assert.equal(gif.hidden, true);
  assert.equal(mirrors[0].disabled, true);
  settings.dispatchEvent(new Event("click"));
  assert.equal(openSettings, 1);
  model = "gpt-image-2";
  formats[3].dispatchEvent(new Event("click"));
  view.write({ frameCount: 12, frameDurationMs: 120 });
  assert.equal(view.getPromptError(), "");
  assert.deepEqual(view.read(), { frameCount: 12, frameDurationMs: 120 });
  promptMode = false;
  view.refresh();
  assert.equal(promptRoot.hidden, true);
  assert.equal(formatField.hidden, false, "其他模式仍使用下方格式下拉框");
  assert.equal(view.getPromptError(), "");
  promptMode = true;
  model = "";
  view.refresh();
  assert.equal(promptRoot.hidden, true);
  assert.equal(formatField.hidden, false, "没有上方入口的通道保留下方格式");
  model = "gpt-image-2";
  view.refresh();
  assert.equal(promptRoot.hidden, false);
  assert.equal(formatField.hidden, true);
  automatic.dispatchEvent(new Event('click'));
  assert.equal(formatInput.value, 'auto');
  assert.equal(automatic.getAttribute('aria-checked'), 'true');
  assert.equal(formats[0].getAttribute('aria-pressed'), 'true', '自动默认 PNG 也高亮');
  assert.ok(formats.every((button) => button.disabled));
  formats[4].dispatchEvent(new Event('click'));
  assert.equal(formatInput.value, 'auto', '自动模式禁止切换手动格式');
  for (const [keyword, expected] of [['PNG', 'png'], ['JPEG', 'jpg'], ['WebP', 'webp'], ['GIF', 'gif'], ['SVG', 'svg'], ['动图', 'gif']]) {
    prompt = '请输出 ' + keyword;
    view.refresh();
    assert.deepEqual(formats.filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.dataset.promptOutputFormat), [expected]);
    assert.ok(formats.every((button) => button.disabled));
  }
  automatic.dispatchEvent(new Event('click'));
  assert.equal(automatic.getAttribute('aria-checked'), 'false');
  assert.equal(formatInput.value, 'gif', '关闭自动保留当前实际格式');
  assert.ok(formats.every((button) => !button.disabled));
  formats[1].dispatchEvent(new Event('click'));
  assert.equal(formatInput.value, 'jpg');
  assert.equal(formats[1].getAttribute('aria-pressed'), 'true');
  prompt = '请输出 SVG';
  view.refresh();
  assert.equal(formats[1].getAttribute('aria-pressed'), 'true', '手动选择不随提示词改变');
  automatic.dispatchEvent(new Event('click'));
  assert.equal(formatInput.value, 'auto');
  assert.equal(formats[4].getAttribute('aria-pressed'), 'true', '重新开启自动解析当前提示词');
});
