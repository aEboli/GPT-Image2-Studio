import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appPath = new URL("../public/app.js", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);

test("PPT generation rejects duplicate submit and requires a terminal SSE event", async () => {
  const app = await readFile(appPath, "utf8");
  const terminalClient = await readFile(new URL("../lib/sse-terminal-client.mjs", import.meta.url), "utf8");
  const startBody = app.match(/async function startPptGeneration\(event\) \{[\s\S]*?\n\}/)?.[0] || "";
  const streamBody = app.match(/async function runPptStream\(response\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(startBody, /if \(state\.ppt\.generating\) \{\s*return;\s*\}/);
  assert.match(streamBody, /consumeSseUntilTerminal/);
  assert.match(terminalClient, /terminalEvents = \["complete", "error"\]/);
  assert.match(streamBody, /PPT 生成连接已中断，未收到完成事件/);
});

test("PPT completion uses the original generation parameter snapshot", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /generationSnapshot:\s*null/);
  assert.match(app, /state\.ppt\.generationSnapshot = getPptGenerationSnapshot\(\)/);
  const completionBody = app.match(/function buildPptCompletionRequest\(slideNumbers\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(completionBody, /state\.ppt\.generationSnapshot/);
  assert.doesNotMatch(completionBody, /refs\.pptStylePresetInput\.value|refs\.pptExportModeInput\.value/);
  assert.match(completionBody, /quality:\s*snapshot\.quality/);
});

test("PPT slide generation normalizes and preserves the requested quality", async () => {
  const [app, server] = await Promise.all([readFile(appPath, "utf8"), readFile(serverPath, "utf8")]);
  const pptForm = app.match(/function buildPptFormData\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const slideGenerator = server.match(/async function generateAndSavePptSlide\(\{[\s\S]*?\n\}\r?\n\r?\nasync function saveCompletedPptDeck/)?.[0] || "";

  assert.match(pptForm, /getSelectedImageQuality\(refs\.pptQualityInput\)/);
  assert.match(slideGenerator, /quality,/);
  assert.match(slideGenerator, /normalizeImageQuality\(quality \|\| config\.defaults\?\.quality/);
  assert.match(slideGenerator, /quality:\s*slideQuality/);
  assert.match(server, /async function handlePptGenerate\(request, response\) \{[\s\S]*const quality = normalizeImageQuality\(formData\.get\("quality"\)/);
  assert.match(server, /async function handlePptComplete\(request, response\) \{[\s\S]*const quality = normalizeImageQuality\(payload\.quality/);
  assert.match(server, /async function handlePptSlideEdit\(request, response\) \{[\s\S]*const quality = normalizeImageQuality\(formData\.get\("quality"\)/);
  ["handlePptGenerate", "handlePptComplete", "handlePptSlideEdit"].forEach((handlerName) => {
    const handlerBody = server.match(new RegExp(`async function ${handlerName}\\([^]*?(?=\\r?\\nasync function|\\r?\\nfunction|$)`))?.[0] || "";
    assert.match(handlerBody, /generateAndSavePptSlide\(\{[\s\S]*quality,\r?\n\s*pptDeckRelativeDir/);
  });
});

test("PPT record selection label is updated only while rendering PPT records", async () => {
  const app = await readFile(appPath, "utf8");
  const recordViewBody =
    app.match(/function renderPptRecordView\(\) \{[\s\S]*?\n\}\r?\n\r?\nfunction renderPptView/)?.[0] || "";
  const promptAgentBody =
    app.match(/async function analyzePromptAgentImage\(\) \{[\s\S]*?\n\}\r?\n\r?\nasync function analyzeReferenceImages/)?.[0] || "";

  assert.match(recordViewBody, /refs\.pptRecordSelection\.textContent = selectedDeck\?\.title/);
  assert.doesNotMatch(promptAgentBody, /selectedDeck|pptRecordSelection/);
});
