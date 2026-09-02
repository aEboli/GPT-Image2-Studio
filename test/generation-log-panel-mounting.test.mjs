import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { GENERATION_LOG_BATCH_CHANNELS } from "../lib/generation-log-store.mjs";

const indexPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("the generation log lives only in the settings panel", async () => {
  const html = await readFile(indexPath, "utf8");

  // 日志只有配置区那一个位置，生图板块里不再内嵌日志面板。
  assert.doesNotMatch(html, /data-generation-log-host/);
  assert.doesNotMatch(html, /class="generation-log-panel"/);
  assert.match(
    html,
    /<section class="config-log-panel live-panel config-card" id="configGenerationLogPanel"[\s\S]*id="timelineChannelTabs"[\s\S]*id="timelineList"/,
  );
  assert.equal([...html.matchAll(/id="timelineList"/g)].length, 1);
  assert.equal([...html.matchAll(/id="timelineChannelTabs"/g)].length, 1);
});

test("board switching keeps each panel's log independent inside the one log panel", async () => {
  const app = await readFile(appPath, "utf8");

  // 默认跟随当前板块，显式点过之后以那次选择为准。
  assert.match(app, /function getActiveViewLogChannel\(\) \{[\s\S]*getCurrentGenerationQueueMode\(\)/);
  assert.match(app, /function getResolvedGenerationLogChannel\(\) \{[\s\S]*state\.generationLogChannel[\s\S]*getActiveViewLogChannel\(\) \|\| GENERATION_LOG_ALL_CHANNELS/);
  assert.match(app, /generationLogChannel: "",/);
  assert.match(app, /state\.generationLogChannel = channel;/);
  assert.match(app, /const channel = getResolvedGenerationLogChannel\(\);/);
  assert.match(app, /renderGenerationLogChannelTabs\(refs\.timelineChannelTabs, \{/);
  assert.match(app, /renderGenerationLogRows\(refs\.timelineList, \{[\s\S]*channel,/);
  assert.doesNotMatch(app, /renderGenerationLogPanels/);
  assert.doesNotMatch(app, /generationLogPanels/);
});

test("a scoped board shows its own empty state instead of another board's rows", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getTimelineItems\(channel = GENERATION_LOG_ALL_CHANNELS\) \{/);
  assert.match(app, /channel === GENERATION_LOG_ALL_CHANNELS[\s\S]*getGenerationLogAllEntries\(state\.generationLog\)[\s\S]*getGenerationLogChannelEntries\(state\.generationLog, channel\)/);
  assert.match(app, /if \(channel !== GENERATION_LOG_ALL_CHANNELS\) \{\s*return \[\];/);
});

test("each batch panel records grouped log events instead of flat rows", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function recordBatchLogEvent\(\{[\s\S]*recordGroupActivity\(\{/);
  assert.match(app, /function recordGroupActivity\(\{[\s\S]*upsertGenerationLogGroupEntry\(state\.generationLog,/);
  assert.match(app, /function recordCreationLogEvent\(\{[\s\S]*channel: "creation",/);
  assert.match(app, /function recordPortraitLogEvent\(\{[\s\S]*channel: "portrait",/);
  assert.match(app, /function recordArticleIllustrationLogEvent\(\{[\s\S]*channel: "article-illustration",/);
  assert.match(app, /function recordPptLogEvent\(\{[\s\S]*channel: "ppt",[\s\S]*groupUnit: "页",/);
  GENERATION_LOG_BATCH_CHANNELS.forEach((channel) => {
    assert.match(app, new RegExp(`channel: "${channel}",`), `${channel} should write grouped log entries`);
  });
});

test("batch repair and retry reuse the original batch id so no new top-level row appears", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /targetItems\.forEach\(\(item\) => recordCreationLogEvent\(\{[\s\S]*setId: currentSet\.setId,[\s\S]*status: "active",/);
  assert.match(app, /groupId: normalizedGroupId,/);
});

test("group expansion is in-memory only so batches reopen collapsed", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /generationLogExpandedGroups: new Set\(\)/);
  assert.match(app, /state\.generationLogExpandedGroups = toggleGenerationLogGroup\(state\.generationLogExpandedGroups, groupId\)/);
  assert.doesNotMatch(app, /generationLogExpandedGroups[\s\S]{0,200}localStorage/);
  assert.doesNotMatch(app, /localStorage[\s\S]{0,200}generationLogExpandedGroups/);
});

test("card log text reads the log store because view items drop statusText", async () => {
  const app = await readFile(appPath, "utf8");

  // normalizeCreationItemForView 是严格白名单，不带 statusText，直接读会静默显示不出来。
  // 仓库是 CRLF，所以按 /\r?\n\}\r?\n/ 找函数体结尾，切不中要显式失败。
  const normalizer = app.slice(app.indexOf("function normalizeCreationItemForView"));
  const bodyEnd = normalizer.search(/\r?\n\}\r?\n/);
  assert.ok(bodyEnd > 0, "expected to find the end of normalizeCreationItemForView");
  assert.doesNotMatch(normalizer.slice(0, bodyEnd), /statusText/, "view items intentionally omit statusText");
  assert.match(app, /getGenerationLogGroupItemDetail/);
  assert.match(
    app,
    /function getGenerationLogItemDetail\(channel, itemId, groupId = ""\) \{\s*return getGenerationLogGroupItemDetail\(state\.generationLog, channel, groupId, itemId\);\s*\}/,
  );
  assert.match(
    app,
    /function getCreationCardLogText\(item = \{\}, channel = "creation", groupId = ""\) \{[\s\S]*getGenerationLogItemDetail\(channel, item\.itemId, groupId\)/,
  );
  assert.match(app, /getCreationCardLogText\(item, "portrait", options\.logGroupId\)/);
  assert.match(
    app,
    /function renderPortraitView\(\) \{[\s\S]*createPortraitCard\(item, index, \{\s*logGroupId: currentSet\?\.setId \|\| "",\s*\}\)/,
  );
});

test("failure log entries resolve their relay url from the job rather than a lookup", async () => {
  const app = await readFile(appPath, "utf8");

  // 失败时任务可能已从 state.jobs 移除，所以传整个 job 而不是 id。
  assert.match(app, /function handleActivityFailure\(job, message, imageUrl = ""\) \{/);
  assert.match(app, /relayUrl: typeof job === "string" \? "" : resolveGenerationRelayUrl\(job \|\| \{\}\),/);
  assert.doesNotMatch(app, /handleActivityFailure\(job\.id,/);
  assert.match(app, /function resolveGenerationRelayUrl\(source = \{\}\) \{/);
  assert.match(app, /relayUrl: resolveGenerationRelayUrl\(job\), status: "active", at: job\.createdAt,/);
});
