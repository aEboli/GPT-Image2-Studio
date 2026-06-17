import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { confirmCreationLogoLibraryDelete } from "../lib/creation-logo-library.mjs";

test("common logo deletion confirmation names the target logo", () => {
  let capturedMessage = "";
  const confirmed = confirmCreationLogoLibraryDelete(
    { filename: "Alures.png" },
    (message) => {
      capturedMessage = message;
      return true;
    },
  );

  assert.equal(confirmed, true);
  assert.match(capturedMessage, /确认删除常用 Logo/);
  assert.match(capturedMessage, /Alures\.png/);
  assert.match(capturedMessage, /重新上传/);
});

test("common logo deletion stops when the confirmation is cancelled", () => {
  let confirmCalls = 0;
  const confirmed = confirmCreationLogoLibraryDelete(
    { filename: "Alures.png" },
    () => {
      confirmCalls += 1;
      return false;
    },
  );

  assert.equal(confirmCalls, 1);
  assert.equal(confirmed, false);
});

test("common logo library controller checks confirmation before deleting stored logo data", async () => {
  const source = await readFile(new URL("../lib/creation-logo-library.mjs", import.meta.url), "utf8");

  assert.match(
    source,
    /async function deleteItem\(id\) \{[\s\S]*if \(!confirmCreationLogoLibraryDelete\(item, confirmDelete\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*await deleteCreationLogoLibraryItem\(id\);/,
  );
});
