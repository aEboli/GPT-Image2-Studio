import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverPath = new URL("../server.mjs", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const galleryStorePath = new URL("../lib/gallery-store.mjs", import.meta.url);
const pptExportPath = new URL("../lib/ppt-export.mjs", import.meta.url);

test("server exposes PPT generation, completion and deck history endpoints", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /async function handlePptAnalyze/);
  assert.match(server, /async function handlePptGenerate/);
  assert.match(server, /async function handlePptComplete/);
  assert.match(server, /url\.pathname === "\/api\/ppt\/analyze"/);
  assert.match(server, /url\.pathname === "\/api\/ppt\/generate"/);
  assert.match(server, /url\.pathname === "\/api\/ppt\/complete"/);
  assert.match(server, /url\.pathname === "\/api\/ppt\/slide\/edit"/);
  assert.match(server, /url\.pathname === "\/api\/ppt\/decks"/);
  assert.match(server, /writeSseEvent\(response, "slide_failed"/);
  assert.match(server, /writeSseEvent\(response, "deck_saved"/);
  assert.match(server, /async function handlePptSlideEdit/);
  assert.match(server, /formData\.get\("sourceSlideImage"\)/);
  assert.match(server, /formData\.get\("annotatedSlideImage"\)/);
  assert.match(server, /formData\.get\("dynamicPreset"\)/);
  assert.match(server, /formData\.get\("transitionPreset"\)/);
  assert.match(server, /buildSlideImagePrompts\(\{\s*outline,[\s\S]*dynamicPreset/);
  assert.match(server, /exportPptxDeck\(\{[\s\S]*motion:/);
  assert.match(server, /function buildPptDeckRelativeDir/);
  assert.match(server, /function resolvePptDeckRelativeDir/);
  assert.match(server, /extractPptDeckRelativeDirFromSlides\(slides\) \|\| buildPptDeckRelativeDir/);
  assert.match(server, /\$\{monthFolder\}\/\$\{dayFolder\}\/\$\{dateFolder\}-ppt\/\$\{deckFolderName\}/);
  assert.match(server, /migrateOutputDirectoryMonths\(\{ outputDir \}\)/);
  assert.match(server, /relativeDir:\s*pptDeckRelativeDir/);
  assert.match(server, /const pptxRelativePath = normalizePptRelativePath\(`\$\{pptDeckRelativeDir\}\/\$\{pptxFilename\}`\)/);
  assert.match(server, /"\.pptx": "application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation"/);
});

test("server marks PPT slide assets hidden from the waterfall gallery", async () => {
  const server = await readFile(serverPath, "utf8");
  const galleryStore = await readFile(galleryStorePath, "utf8");

  assert.match(server, /assetKind:\s*"ppt-slide"/);
  assert.match(server, /galleryVisible:\s*false/);
  assert.match(galleryStore, /galleryVisible/);
  assert.match(galleryStore, /if \(!normalizedMetadata\.galleryVisible\) \{/);
});

test("server persists the effective image size after an upstream fallback", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /const generationResult = await requestStudioImageGeneration\(/);
  assert.match(server, /const savedSize = generationResult\.effectiveSize \|\| finalSize;/);
  assert.match(server, /generationTaskStore\.completeTask\([\s\S]*size:\s*savedSize/);
  assert.match(server, /metadata:\s*\{[\s\S]*size:\s*savedSize/);
  assert.match(server, /buildSavedItem\(\{[\s\S]*size:\s*savedSize/);
});

test("server uses tmp output storage on Vercel serverless runtime", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /tmpdir/);
  assert.match(server, /process\.env\.VERCEL/);
  assert.match(server, /process\.env\.IMAGE_STUDIO_OUTPUT_DIR/);
  assert.match(server, /join\(tmpdir\(\),\s*"gpt-image2-studio-output"\)/);
  assert.doesNotMatch(server, /const outputDir = join\(homedir\(\), "Pictures"\);/);
});

test("server keeps local data stores writable on Vercel serverless runtime", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /process\.env\.IMAGE_STUDIO_LOCAL_DATA_DIR/);
  assert.match(server, /join\(tmpdir\(\),\s*"gpt-image2-studio-local"\)/);
  assert.match(server, /createConfigStore\(\{ rootDir: localDataRootDir, env: process\.env \}\)/);
  assert.match(server, /createPromptAgentStore\(\{ rootDir: localDataRootDir \}\)/);
});

test("server serves browser modules from public before Vercel-bundled lib files", async () => {
  const server = await readFile(serverPath, "utf8");
  const publicRouteIndex = server.indexOf("const target = resolveSafeFile(publicDir, url.pathname);");
  const bundledLibRouteIndex = server.indexOf('url.pathname.startsWith("/lib/")');

  assert.ok(publicRouteIndex > -1);
  assert.ok(bundledLibRouteIndex > -1);
  assert.ok(publicRouteIndex < bundledLibRouteIndex);
});

test("server static file resolver rejects same-prefix sibling directories", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /const backToBase = relative\(normalizedBase, target\);/);
  assert.match(server, /backToBase\.startsWith\("\.\."\) \|\| isAbsolute\(backToBase\)/);
  assert.doesNotMatch(server, /target\.startsWith\(normalizedBase\)/);
});

test("package declares pptxgenjs dependency for deck export", async () => {
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  assert.match(pkg.dependencies?.pptxgenjs || "", /\^4\.0\.1/);
});

test("PPT export loads pptxgenjs through CommonJS for Vercel runtime compatibility", async () => {
  const pptExport = await readFile(pptExportPath, "utf8");

  assert.match(pptExport, /createRequire/);
  assert.match(pptExport, /require\("pptxgenjs"\)/);
  assert.doesNotMatch(pptExport, /import\s+\w+\s+from\s+"pptxgenjs"/);
});
