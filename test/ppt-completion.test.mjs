import test from "node:test";
import assert from "node:assert/strict";

import {
  getMissingPptSlideNumbers,
  getPptCompletionStats,
  mergePptSlides,
  normalizePptCompletionRequest,
} from "../lib/ppt-completion.mjs";

const outline = {
  title: "产品发布会",
  slides: [
    { slideNumber: 1, title: "开场", keyMessage: "发布会主题" },
    { slideNumber: 2, title: "亮点", keyMessage: "产品能力" },
    { slideNumber: 3, title: "收尾", keyMessage: "行动号召" },
  ],
};

test("PPT completion stats count successful slides and report failed or missing pages", () => {
  const slides = [
    { slideNumber: 1, title: "开场", relativePath: "2026-04-30/a.png", imageUrl: "/output/2026-04-30/a.png" },
    { slideNumber: 2, title: "亮点", status: "failed" },
    { slideNumber: 3, title: "收尾", imageUrl: "/output/2026-04-30/c.png" },
  ];

  assert.deepEqual(getPptCompletionStats({ outline, slides }), { completed: 1, total: 3 });
  assert.deepEqual(getMissingPptSlideNumbers({ outline, slides }), [2, 3]);
});

test("PPT completion request normalizes deck id, theme, requested pages and existing slides", () => {
  const request = normalizePptCompletionRequest({
    deckId: " deck-1 ",
    outline,
    theme: " 教育培训 ",
    existingSlides: [
      { slideNumber: "1", title: "开场", relativePath: "2026-04-30/a.png", imageUrl: "/output/2026-04-30/a.png" },
      { slideNumber: "2", title: "失败页" },
    ],
    slideNumbers: [3, "2", 2, 99, 0],
  });

  assert.equal(request.deckId, "deck-1");
  assert.equal(request.theme, "教育培训");
  assert.deepEqual(request.existingSlides.map((slide) => slide.slideNumber), [1]);
  assert.deepEqual(request.slideNumbers, [2, 3]);
});

test("PPT slide merge replaces retried pages and sorts by slide number", () => {
  const merged = mergePptSlides(
    [
      { slideNumber: 1, title: "旧 1", relativePath: "a.png", imageUrl: "/output/a.png" },
      { slideNumber: 2, title: "旧 2", relativePath: "b.png", imageUrl: "/output/b.png" },
    ],
    [{ slideNumber: 2, title: "新 2", relativePath: "c.png", imageUrl: "/output/c.png" }],
  );

  assert.deepEqual(
    merged.map((slide) => [slide.slideNumber, slide.title, slide.relativePath]),
    [
      [1, "旧 1", "a.png"],
      [2, "新 2", "c.png"],
    ],
  );
});
