import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

import { buildProductImageCollectorArchive } from "../lib/product-image-extension-package.mjs";

test("extension ZIP contains reviewable sources and the exact shared import protocol", async () => {
  const archive = await buildProductImageCollectorArchive();
  const zip = await JSZip.loadAsync(archive.bytes);
  const filenames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

  assert.match(archive.filename, /^GPT-Image2-Studio-Product-Image-Collector-v1\.0\.3\.zip$/);
  for (const filename of ["manifest.json", "collector.js", "floating-launcher.js", "floating-panel.js", "service-worker.mjs", "README.md", "lib/product-image-import.mjs"]) {
    assert.ok(filenames.includes(filename), `${filename} should be packaged`);
  }
  assert.doesNotMatch(filenames.join("\n"), /sidepanel/i);
  assert.equal(
    await zip.file("lib/product-image-import.mjs").async("string"),
    await readFile(new URL("../lib/product-image-import.mjs", import.meta.url), "utf8"),
  );
  assert.doesNotMatch(filenames.join("\n"), /artifact|node_modules|\.env|cookie/i);
});

test("package scripts and desktop distributions include extension sources", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const installer = await readFile(new URL("../scripts/build-windows-installer.mjs", import.meta.url), "utf8");

  assert.equal(packageJson.scripts["build:extension"], "node scripts/build-product-image-extension.mjs");
  assert.ok(packageJson.build.files.includes("extensions/product-image-collector/**/*"));
  assert.match(installer, /"extensions\/product-image-collector",/);
});
