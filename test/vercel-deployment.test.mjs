import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel deployment ignores local build and smoke-test artifacts", async () => {
  const ignoreFile = await readFile(new URL("../.vercelignore", import.meta.url), "utf8");

  for (const pattern of ["artifacts/", "dist/", "output/", ".local/", ".vercel/"]) {
    assert.match(ignoreFile, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }

  assert.doesNotMatch(ignoreFile, /^!\.env\.example$/m);
});

test("Vercel deployment config gives the Node backend the maximum Hobby duration", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.functions?.["server.mjs"]?.maxDuration, 300);
});

test("Vercel deployment config includes PPT export runtime dependencies", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.functions?.["server.mjs"]?.includeFiles, "node_modules/pptxgenjs/**");
});
