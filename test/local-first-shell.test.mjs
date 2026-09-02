import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

test("initial workbench shell uses local system fonts without third-party font hosts", async () => {
  const [html, styles] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  assert.match(styles, /:root\s*\{[\s\S]*--font-ui:\s*ui-sans-serif,/);
  assert.match(styles, /html,\s*body\s*\{[\s\S]*font-family:\s*var\(--font-ui\);/);
});
