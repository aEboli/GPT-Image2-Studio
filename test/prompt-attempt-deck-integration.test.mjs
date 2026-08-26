import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  PROMPT_ATTEMPT_KIND,
  PROMPT_ATTEMPT_STATUS,
  completePromptAttemptDeck,
  createPromptAttemptDeckStore,
  failPromptAttemptDeck,
  getPromptAttemptCards,
  getTerminalPromptAttemptDecks,
  recordPromptAttemptImage,
  rekeyPromptAttemptDeck,
  startPromptAttemptRetry,
} from "../lib/prompt-attempt-deck.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

function extractFunctionBefore(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`function ${nextFunctionName}`, start + 1);
  assert.notEqual(start, -1, `${functionName} should exist`);
  assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
  return source.slice(start, end).trimEnd();
}

test("失败任务的卡组以独立条目留在胶片条中", async () => {
  const app = await readFile(appPath, "utf8");
  const runtime = extractFunctionBefore(app, "getFilmstripItems", "getFilmstripPlaceholderState");

  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:failed-1", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  failPromptAttemptDeck(store, { deckKey: "job:failed-1", errorMessage: "生成请求失败", updatedAt: "2026-08-25T00:00:01.000Z" });

  const state = {
    // 任务已被 removeJob 移除，卡组必须自己撑住这个条目。
    jobs: [],
    gallery: [],
    promptFilmstripBaselineFilenames: [],
    promptFilmstripSessionFilenames: [],
    promptAttemptDecks: store,
  };

  const getFilmstripItems = new Function(
    "state",
    "makeJobPreviewKey",
    "makeGalleryPreviewKey",
    "formatFilmstripSizeLabel",
    "formatClock",
    "getPromptGenerationGalleryItems",
    "getStablePreviewLoadingItems",
    "getTerminalPromptAttemptDecks",
    "PROMPT_FILMSTRIP_JOB_LIMIT",
    "PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT",
    `${runtime}\nreturn getFilmstripItems;`,
  )(
    state,
    (id) => `job:${id}`,
    (filename) => `file:${filename}`,
    () => "",
    () => "",
    () => [],
    (items) => [...items],
    (deckStore) => getTerminalPromptAttemptDecks(deckStore),
    15,
    50,
  );

  const entries = getFilmstripItems();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "job:failed-1");
  assert.equal(entries[0].item.unfinishedAttemptPreview, true);
  assert.equal(entries[0].item.previewUrl, "data:image/png;base64,AAA");
});

test("成功任务的卡组不重复出现在失败条目中", async () => {
  const app = await readFile(appPath, "utf8");
  const runtime = extractFunctionBefore(app, "getFilmstripItems", "getFilmstripPlaceholderState");

  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  startPromptAttemptRetry(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:01.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,CCC", updatedAt: "2026-08-25T00:00:02.000Z" });
  completePromptAttemptDeck(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:03.000Z" });
  rekeyPromptAttemptDeck(store, { fromKey: "job:a", toKey: "file:done.png", updatedAt: "2026-08-25T00:00:04.000Z" });

  const state = {
    jobs: [],
    gallery: [{ filename: "done.png", createdAt: "2026-08-25T00:00:04.000Z", size: "1024x1024", imageUrl: "/output/done.png" }],
    promptFilmstripBaselineFilenames: ["done.png"],
    promptFilmstripSessionFilenames: [],
    promptAttemptDecks: store,
  };

  const getFilmstripItems = new Function(
    "state",
    "makeJobPreviewKey",
    "makeGalleryPreviewKey",
    "formatFilmstripSizeLabel",
    "formatClock",
    "getPromptGenerationGalleryItems",
    "getStablePreviewLoadingItems",
    "getTerminalPromptAttemptDecks",
    "PROMPT_FILMSTRIP_JOB_LIMIT",
    "PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT",
    `${runtime}\nreturn getFilmstripItems;`,
  )(
    state,
    (id) => `job:${id}`,
    (filename) => `file:${filename}`,
    () => "",
    () => "",
    (items) => items,
    (items) => [...items],
    (deckStore) => getTerminalPromptAttemptDecks(deckStore),
    15,
    50,
  );

  const entries = getFilmstripItems();
  // 画廊条目已经代表这张图，卡组不应再追加一个重复槽位。
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "file:done.png");
  assert.equal(getPromptAttemptCards(store, "file:done.png").length, 2);
});

test("卡组渲染在单卡时不显示角标，多卡时显示可展开角标", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function syncFilmstripDeck\(shell, key\) \{/);
  // 单卡必须与引入卡组前的呈现一致。
  assert.match(app, /if \(cards\.length < 2\) \{[\s\S]*?existingBadge\?\.remove\(\);[\s\S]*?existingTray\?\.remove\(\);[\s\S]*?shell\.classList\.remove\("has-deck"\);/);
  assert.match(app, /badge\.setAttribute\("aria-expanded", String\(expanded\)\);/);
  assert.match(app, /badge\.setAttribute\("aria-controls", trayId\);/);
  assert.match(app, /badge\.type = "button";/);
});

test("未完成卡带未完成标记与另存入口，已完成卡没有另存入口", async () => {
  const app = await readFile(appPath, "utf8");
  const runtime = extractFunctionBefore(app, "createDeckCardNode", "savePromptAttemptPreview");
  assert.match(runtime, /const unfinished = card\.status !== PROMPT_ATTEMPT_STATUS\.COMPLETED;/);
  assert.match(runtime, /if \(unfinished\) \{[\s\S]*filmstrip-deck-save/);
  assert.match(runtime, /caption\.textContent = unfinished \? `\$\{attemptLabel\} · 未完成` : attemptLabel;/);
  // 已另存的卡不能再次触发另存。
  assert.match(runtime, /saveButton\.disabled = alreadySaved;/);
});

test("三条失败收尾路径都封存卡组并把预览带进活动记录", async () => {
  const app = await readFile(appPath, "utf8");

  const sealCalls = [...app.matchAll(/^\s+sealPromptDeckOnFailure\(job, message\);$/gm)];
  assert.equal(sealCalls.length, 3, "error、流中断与异常三条路径都应封存卡组");

  const failureCalls = [...app.matchAll(/handleActivityFailure\(job\.id, message, getPromptDeckLastPreviewUrl\(job\)\)/g)];
  assert.equal(failureCalls.length, 3, "三条路径都应把最后一张预览带进活动记录");

  assert.match(app, /function handleActivityFailure\(jobId, message, imageUrl = ""\)/);
});

test("上游重试状态触发尝试封存", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /if \(payload\.stage === "retrying_upstream" && isPromptDeckJob\(job\)\) \{[\s\S]*?startPromptAttemptRetry\(state\.promptAttemptDecks, \{/,
  );
});

test("四个有独立预览面的模式不使用卡组", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /const DECK_EXCLUDED_JOB_MODES = new Set\(\["reference-analysis", "image-decomposition", "image-edit", "quick-blend"\]\);/,
  );
  assert.match(app, /function isPromptDeckJob\(job\) \{\s*return Boolean\(job\) && !DECK_EXCLUDED_JOB_MODES\.has\(String\(job\.mode \|\| ""\)\);/);
});

test("卡组状态不持久化", async () => {
  const app = await readFile(appPath, "utf8");
  const stateBlock = app.slice(app.indexOf("promptAttemptDecks:"), app.indexOf("promptAttemptDecks:") + 400);

  assert.match(stateBlock, /promptAttemptDecks: createPromptAttemptDeckStore\(\)/);
  // 卡组只存在于内存 state，不应出现任何写入 localStorage 的路径。
  assert.equal(/localStorage[^\n]*promptAttemptDecks/.test(app), false);
  assert.equal(/promptAttemptDecks[^\n]*localStorage/.test(app), false);
});

test("选中某张尝试卡时主预览切换到该图", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function setSelectedPreviewKey\(key, \{ attemptIndex = -1 \} = \{\}\)/);
  assert.match(app, /state\.selectedPromptAttempt = Number\(attemptIndex\) >= 0 \? \{ deckKey: key, attemptIndex: Number\(attemptIndex\) \} : null;/);
  assert.match(app, /setSelectedPreviewKey\(deckKey, \{ attemptIndex: card\.attemptIndex \}\)/);
  // 主预览取图前必须确认 pin 属于当前选中的键。
  assert.match(app, /if \(!item \|\| !pinned \|\| pinned\.deckKey !== state\.selectedPreviewKey\) \{/);
});

test("卡组样式定义展开区与未完成标记", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.filmstrip-deck-badge \{[\s\S]*position: absolute;/);
  assert.match(styles, /\.filmstrip-deck-tray \{[\s\S]*display: flex;/);
  assert.match(styles, /\.filmstrip-deck-card\[data-attempt-status="failed"\] \.filmstrip-deck-card-label \{/);
  assert.match(styles, /\.filmstrip-deck-save:disabled \{[\s\S]*opacity/);
});

test("另存请求只发送预览数据与参数快照，不含文件名", async () => {
  const app = await readFile(appPath, "utf8");
  const start = app.indexOf("async function savePromptAttemptPreview");
  const scope = app.slice(start, app.indexOf("\n}", app.indexOf("catch (error)", start)));

  assert.match(scope, /fetch\("\/api\/prompt-preview\/save", \{/);
  assert.match(scope, /imageBase64: match\[2\]/);
  assert.match(scope, /markPromptAttemptSaved\(state\.promptAttemptDecks/);

  // 落盘文件名由服务端生成，请求体不得携带文件名或路径字段。
  const bodyStart = scope.indexOf("body: JSON.stringify({");
  const requestBody = scope.slice(bodyStart, scope.indexOf("}),", bodyStart));
  assert.equal(/\bfilename\s*:/.test(requestBody), false, "请求体不得携带 filename");
  assert.equal(/\brelativePath\s*:/.test(requestBody), false, "请求体不得携带 relativePath");
});

test("同一尝试的连续预览不产生额外卡，最终图替换该尝试图像", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,P1", kind: PROMPT_ATTEMPT_KIND.PARTIAL, updatedAt: "2026-08-25T00:00:00.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,P2", kind: PROMPT_ATTEMPT_KIND.PARTIAL, updatedAt: "2026-08-25T00:00:01.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,F", kind: PROMPT_ATTEMPT_KIND.FINAL, updatedAt: "2026-08-25T00:00:02.000Z" });

  const cards = getPromptAttemptCards(store, "job:a");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].previewUrl, "data:image/png;base64,F");
  assert.equal(cards[0].kind, PROMPT_ATTEMPT_KIND.FINAL);
  assert.equal(cards[0].status, PROMPT_ATTEMPT_STATUS.RUNNING);
});
