import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("transparent background control is scoped to prompt generation and snapshots independently", async () => {
  const [html, app, styles, server] = await Promise.all([
    readFile(resolve(rootDir, "public/index.html"), "utf8"),
    readFile(resolve(rootDir, "public/app.js"), "utf8"),
    readFile(resolve(rootDir, "public/styles.css"), "utf8"),
    readFile(resolve(rootDir, "server.mjs"), "utf8"),
  ]);

  assert.match(html, /id="transparentBackgroundField"\s+data-prompt-mode-block[\s\S]*?id="transparentBackgroundInput"/);
  assert.match(app, /function supportsPromptTransparentBackground\(\) \{\s*return state\.activeView === "studio" && state\.studioMode === "prompt" && !\["c", "d"\]\.includes\(getSelectedImageRoute\(\)\);/);
  assert.match(app, /refs\.styleTransferBlock\?\.classList\.toggle\("hidden", nextMode !== "style-transfer"\);\s*syncPromptTransparentBackgroundControl\(\);/);
  assert.match(app, /function getPromptImageBackground\(\) \{[\s\S]*?"transparent"[\s\S]*?"opaque"/);
  assert.match(app, /if \(!job\.mode\) \{\s*formData\.set\("imageBackground", job\.imageBackground === "transparent" \? "transparent" : "opaque"\);/);
  assert.match(app, /format: imageBackground === "transparent" \? "png"/);
  assert.match(server, /function normalizePromptImageBackground\(value\)/);
  assert.match(server, /generationMode === "" && generationConfig\.imageRoute !== IMAGE_ROUTE_C && generationConfig\.imageRoute !== IMAGE_ROUTE_D/);
  assert.match(styles, /\.transparent-background-control\s*\{/);
});
