import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import { PUBLIC_LIB_SYNC_TARGETS, syncPublicLib } from "../scripts/sync-public-lib.mjs";

function getPublicAppTopLevelLibImports(source) {
  return [...source.matchAll(/from\s+["']\/lib\/([^"'?/]+\.mjs)(?:\?[^"']*)?["']/g)].map((match) => match[1]);
}

async function sha256(path) {
  const bytes = await readFile(new URL(path, import.meta.url));
  return createHash("sha256").update(bytes).digest("hex");
}

test("public browser modules are synchronized from lib sources", async () => {
  await stat(new URL("../scripts/sync-public-lib.mjs", import.meta.url));
  const checkedFiles = await syncPublicLib({ check: true });

  assert.ok(checkedFiles.length >= PUBLIC_LIB_SYNC_TARGETS.length);

  for (const filename of checkedFiles) {
    assert.equal(
      await sha256(`../public/lib/${filename}`),
      await sha256(`../lib/${filename}`),
      `${filename} must be synced from lib/ to public/lib/`,
    );
  }
});

test("public app top-level browser imports are covered by the sync target list", async () => {
  const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const importedModules = getPublicAppTopLevelLibImports(appSource);

  for (const filename of importedModules) {
    assert.ok(
      PUBLIC_LIB_SYNC_TARGETS.includes(filename),
      `${filename} is imported by public/app.js and must be checked by sync-public-lib`,
    );
  }
});
