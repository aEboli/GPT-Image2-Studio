import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TERMINAL_PROMPT_DECKS,
  PROMPT_ATTEMPT_KIND,
  PROMPT_ATTEMPT_STATUS,
  completePromptAttemptDeck,
  createPromptAttemptDeckStore,
  failPromptAttemptDeck,
  getPromptAttemptCards,
  getPromptAttemptDeck,
  getTerminalPromptAttemptDecks,
  markPromptAttemptSaved,
  recordPromptAttemptImage,
  rekeyPromptAttemptDeck,
  startPromptAttemptRetry,
} from "../lib/prompt-attempt-deck.mjs";

test("同一尝试内的多张中途预览就地更新，不增加卡数", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,BBB", updatedAt: "2026-08-25T00:00:01.000Z" });

  const cards = getPromptAttemptCards(store, "job:a");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].previewUrl, "data:image/png;base64,BBB");
});

test("上游自动重试封存上一尝试并追加新卡", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  startPromptAttemptRetry(store, { deckKey: "job:a", errorMessage: "原任务结果未知", updatedAt: "2026-08-25T00:00:02.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,CCC", updatedAt: "2026-08-25T00:00:03.000Z" });

  const cards = getPromptAttemptCards(store, "job:a");
  assert.equal(cards.length, 2);
  assert.equal(cards[0].previewUrl, "data:image/png;base64,AAA");
  assert.equal(cards[0].status, PROMPT_ATTEMPT_STATUS.FAILED);
  assert.equal(cards[0].errorMessage, "原任务结果未知");
  assert.equal(cards[1].previewUrl, "data:image/png;base64,CCC");
  assert.equal(cards[1].status, PROMPT_ATTEMPT_STATUS.RUNNING);
});

test("重试时上一尝试没有图像则复用空卡，不产生空白卡", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  startPromptAttemptRetry(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:01.000Z" });
  // 第二次尝试尚未出图就再次重试：应复用那张空卡而不是继续追加。
  startPromptAttemptRetry(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:02.000Z" });

  const deck = getPromptAttemptDeck(store, "job:a");
  assert.equal(deck.attempts.length, 2);
  assert.equal(getPromptAttemptCards(store, "job:a").length, 1);
});

test("没有中途预览的任务不建立卡组", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "", updatedAt: "2026-08-25T00:00:00.000Z" });

  assert.equal(getPromptAttemptDeck(store, "job:a"), null);
});

test("失败但已有中途预览时保留卡并标记未完成", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  const deck = failPromptAttemptDeck(store, { deckKey: "job:a", errorMessage: "生成请求失败", updatedAt: "2026-08-25T00:00:05.000Z" });

  assert.ok(deck);
  assert.equal(deck.terminal, true);
  const cards = getPromptAttemptCards(store, "job:a");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, PROMPT_ATTEMPT_STATUS.FAILED);
  assert.equal(cards[0].kind, PROMPT_ATTEMPT_KIND.PARTIAL);
  assert.equal(cards[0].errorMessage, "生成请求失败");
});

test("失败且从未收到图像时不留下任何卡", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  startPromptAttemptRetry(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:01.000Z" });
  // 第二次尝试还没出图就失败：只应保留第一次尝试那张。
  const deck = failPromptAttemptDeck(store, { deckKey: "job:a", errorMessage: "连接中断", updatedAt: "2026-08-25T00:00:02.000Z" });
  assert.equal(deck.attempts.length, 1);

  const emptyStore = createPromptAttemptDeckStore();
  recordPromptAttemptImage(emptyStore, { deckKey: "job:b", previewUrl: "", updatedAt: "2026-08-25T00:00:00.000Z" });
  assert.equal(failPromptAttemptDeck(emptyStore, { deckKey: "job:b", updatedAt: "2026-08-25T00:00:01.000Z" }), null);
  assert.equal(getPromptAttemptDeck(emptyStore, "job:b"), null);
});

test("完成时最终卡标记为已完成且不带未完成标记", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  startPromptAttemptRetry(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:01.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,CCC", updatedAt: "2026-08-25T00:00:02.000Z" });
  completePromptAttemptDeck(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,FINAL", updatedAt: "2026-08-25T00:00:03.000Z" });

  const cards = getPromptAttemptCards(store, "job:a");
  assert.equal(cards.length, 2);
  assert.equal(cards[0].status, PROMPT_ATTEMPT_STATUS.FAILED);
  assert.equal(cards[1].status, PROMPT_ATTEMPT_STATUS.COMPLETED);
  assert.equal(cards[1].kind, PROMPT_ATTEMPT_KIND.FINAL);
  assert.equal(cards[1].previewUrl, "data:image/png;base64,FINAL");
});

test("保存成功后改键，使画廊槽位仍能展开历史尝试", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  startPromptAttemptRetry(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:01.000Z" });
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,CCC", updatedAt: "2026-08-25T00:00:02.000Z" });
  completePromptAttemptDeck(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:03.000Z" });
  rekeyPromptAttemptDeck(store, { fromKey: "job:a", toKey: "file:out.png", updatedAt: "2026-08-25T00:00:04.000Z" });

  assert.equal(getPromptAttemptDeck(store, "job:a"), null);
  assert.equal(getPromptAttemptCards(store, "file:out.png").length, 2);
});

test("终态卡组超过上限时按更新时间淘汰最早项", () => {
  const store = createPromptAttemptDeckStore();
  for (let index = 0; index < MAX_TERMINAL_PROMPT_DECKS + 2; index += 1) {
    const deckKey = `job:${index}`;
    const updatedAt = `2026-08-25T00:00:${String(index).padStart(2, "0")}.000Z`;
    recordPromptAttemptImage(store, { deckKey, previewUrl: `data:image/png;base64,${index}`, updatedAt });
    failPromptAttemptDeck(store, { deckKey, updatedAt });
  }

  const terminal = getTerminalPromptAttemptDecks(store);
  assert.equal(terminal.length, MAX_TERMINAL_PROMPT_DECKS);
  assert.equal(getPromptAttemptDeck(store, "job:0"), null);
  assert.equal(getPromptAttemptDeck(store, "job:1"), null);
  assert.ok(getPromptAttemptDeck(store, `job:${MAX_TERMINAL_PROMPT_DECKS + 1}`));
});

test("已另存的卡记录文件名，避免重复另存", () => {
  const store = createPromptAttemptDeckStore();
  recordPromptAttemptImage(store, { deckKey: "job:a", previewUrl: "data:image/png;base64,AAA", updatedAt: "2026-08-25T00:00:00.000Z" });
  failPromptAttemptDeck(store, { deckKey: "job:a", updatedAt: "2026-08-25T00:00:01.000Z" });
  markPromptAttemptSaved(store, { deckKey: "job:a", attemptIndex: 0, filename: "saved.png" });

  assert.equal(getPromptAttemptCards(store, "job:a")[0].savedFilename, "saved.png");
});
