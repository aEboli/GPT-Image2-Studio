import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesPath = new URL("../public/styles.css", import.meta.url);

function readCssRule(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...styles.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "g"))];
  return matches.at(-1)?.[1] || "";
}

test("timeline activity rows use distinct status and metadata colors", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(readCssRule(styles, ".timeline-item.done .timeline-summary"), /color:\s*var\(--success\);/);
  assert.match(readCssRule(styles, ".timeline-item.active .timeline-summary"), /color:\s*var\(--accent\);/);
  assert.match(readCssRule(styles, ".timeline-item.error .timeline-summary"), /color:\s*var\(--danger\);/);
  assert.match(readCssRule(styles, ".timeline-mode"), /color:\s*#ff6fae;/);
  assert.match(readCssRule(styles, ".timeline-ratio-size"), /color:\s*#8b5cf6;/);
  assert.match(readCssRule(styles, ".timeline-item time"), /color:\s*#ffad33;/);
});

test("timeline status dot is vertically centered in its current row", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const dotRule = readCssRule(styles, ".timeline-dot");
  const connectorRule = readCssRule(styles, ".timeline-item:not(:last-child)::after");

  assert.match(dotRule, /align-self:\s*center;/);
  assert.match(dotRule, /margin-top:\s*0;/);
  assert.match(connectorRule, /top:\s*calc\(50% \+ 11px\);/);
});
