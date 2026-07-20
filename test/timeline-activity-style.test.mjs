import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

function readCssRule(styles, selector) {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\n/g, "\\r?\\n");
  const matches = [...styles.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "g"))];
  return matches.at(-1)?.[1] || "";
}

test("timeline activity rows use distinct status and metadata colors", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const sharedTimeRule = readCssRule(styles, ".timeline-start-time,\n.creation-record-time");

  assert.match(readCssRule(styles, ".timeline-item.done .timeline-summary"), /color:\s*var\(--success\);/);
  assert.match(readCssRule(styles, ".timeline-item.active .timeline-summary"), /color:\s*var\(--accent\);/);
  assert.match(readCssRule(styles, ".timeline-item.error .timeline-summary"), /color:\s*var\(--danger\);/);
  assert.match(readCssRule(styles, ".timeline-mode"), /color:\s*#ff6fae;/);
  assert.match(readCssRule(styles, ".timeline-ratio-size"), /color:\s*#8b5cf6;/);
  assert.match(sharedTimeRule, /color:\s*#ffad33;/);
  assert.match(sharedTimeRule, /font-weight:\s*700;/);
  assert.match(readCssRule(styles, ".timeline-start-time time"), /color:\s*inherit;/);
  assert.doesNotMatch(styles, /\.timeline-item\.done[^\{]*\.timeline-start-time\s*\{/);
});

test("creation record colors its full date and time with the timeline time rule", async () => {
  const [app, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(readCssRule(styles, ".creation-card-media span,\n.creation-record-meta"), /color:\s*var\(--muted\);/);
  assert.match(styles, /\.timeline-start-time,\s*\n\.creation-record-time\s*\{/);
  assert.match(app, /const metaParts = \[platformLabel, `\$\{progress\.completed\}\/\$\{progress\.total\}`\]\.filter\(Boolean\);/);
  assert.match(app, /const recordTimeText = formatTime\(set\.updatedAt \|\| set\.createdAt\);/);
  assert.match(app, /meta\.textContent = metaParts\.join\(" · "\);/);
  assert.match(app, /if \(recordTimeText\) \{/);
  assert.match(app, /recordTime\.className = "creation-record-time";/);
  assert.match(app, /recordTime\.textContent = recordTimeText;/);
  assert.match(app, /meta\.append\(metaParts\.length \? " · " : "", recordTime\);/);
});

test("timeline renders ordered generation times without labels and keeps the legacy activity time fallback", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /generationStartedAt:\s*String\(entry\?\.generationStartedAt \|\| ""\)/);
  assert.match(app, /generationCompletedAt:\s*String\(entry\?\.generationCompletedAt \|\| ""\)/);
  assert.match(app, /generationStartedAt:\s*task\?\.generationStartedAt \|\| task\?\.item\?\.generationStartedAt \|\| ""/);
  assert.match(app, /generationCompletedAt:\s*task\?\.generationCompletedAt \|\| task\?\.item\?\.generationCompletedAt \|\| ""/);
  assert.match(app, /const timelineTimes = item\.generationStartedAt \|\| item\.generationCompletedAt[\s\S]*\? \[item\.generationStartedAt, item\.generationCompletedAt\]\.filter\(Boolean\)[\s\S]*: \[item\.at\]\.filter\(Boolean\)/);
  assert.match(app, /className = "timeline-start-time"/);
  assert.match(app, /time\.textContent = formatClock\(timelineAt\)/);
  assert.doesNotMatch(app, /开始生图时间|Generation started|结束生图时间|Generation completed/);
});

test("timeline status dot is vertically centered in its current row", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const dotRule = readCssRule(styles, ".timeline-dot");
  const connectorRule = readCssRule(styles, ".timeline-item:not(:last-child)::after");

  assert.match(dotRule, /align-self:\s*center;/);
  assert.match(dotRule, /margin-top:\s*0;/);
  assert.match(connectorRule, /top:\s*calc\(50% \+ 11px\);/);
});
