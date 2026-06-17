import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTICLE_ILLUSTRATION_STYLE_PRESETS,
  buildArticleBundle,
  buildArticleImagePrompt,
  DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET,
  requestArticleIllustrationPlan,
  normalizeArticleIllustrationPlan,
} from "../lib/article-illustration-planner.mjs";

test("article bundle merges pasted text, uploaded text, and supplemental notes", () => {
  const bundle = buildArticleBundle({
    title: "Rain Alley",
    textEntries: [
      { title: "draft", text: "Mira stopped under the old theater sign.\n\nThe rain turned the street gold." },
      "She heard a song from the empty lobby.",
    ],
    sourceFiles: [{ filename: "notes.md", text: "Keep the mood quiet and cinematic." }],
    supplementalPrompt: "The main character should remain visually consistent.",
  });

  assert.equal(bundle.title, "Rain Alley");
  assert.equal(bundle.sources.length, 4);
  assert.match(bundle.content, /Mira stopped/);
  assert.match(bundle.content, /notes\.md/);
  assert.match(bundle.content, /Supplemental notes/);
  assert.match(bundle.sourceSummary, /pasted text 1/);
});

test("article style presets default to realist magazine and expose broader options", () => {
  const values = ARTICLE_ILLUSTRATION_STYLE_PRESETS.map((option) => option.value);
  const plan = normalizeArticleIllustrationPlan({
    title: "Style fallback",
    stylePreset: "unknown-style",
    storyboards: [{ title: "Opening", prompt: "A person reads beside a window." }],
  });

  assert.equal(DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET, "realist-magazine");
  assert.equal(ARTICLE_ILLUSTRATION_STYLE_PRESETS[0].value, "realist-magazine");
  assert.ok(ARTICLE_ILLUSTRATION_STYLE_PRESETS.length >= 12);
  assert.deepEqual(
    [
      "realist-magazine",
      "documentary-realism",
      "historical-realism",
      "gongbi-heritage",
      "graphic-novel",
      "noir-comic",
      "vintage-newsprint",
      "surreal-editorial",
      "anime-storyboard",
    ].every((value) => values.includes(value)),
    true,
  );
  assert.equal(plan.stylePreset, "realist-magazine");
  assert.match(plan.styleBible, /realist magazine editorial illustration/);
});

test("article plan normalization dedupes cards and groups references before storyboards", () => {
  const plan = normalizeArticleIllustrationPlan(
    {
      title: "Rain Alley",
      contentType: "narrative",
      recommendedImageCount: 3,
      sourceSummary: "short story",
      stylePreset: "editorial-watercolor",
      styleBible: "Muted watercolor, rainy gold light, restrained expressions.",
      characters: [
        { id: "mira", name: "Mira", visualContinuity: "navy coat, short black hair" },
        { id: "mira-copy", name: "Mira", visualContinuity: "duplicate should be merged" },
      ],
      scenes: [
        { id: "theater", name: "Old theater", visualContinuity: "wet marquee and amber bulbs" },
        { id: "theater-2", name: "Old theater", visualContinuity: "duplicate should be merged" },
      ],
      referenceCards: [
        {
          cardId: "mira-card",
          targetType: "character",
          targetId: "mira",
          title: "Mira reference",
          prompt: "Character design sheet for Mira.",
          firstAppearanceIndex: 2,
        },
        {
          cardId: "theater-card",
          targetType: "scene",
          targetId: "theater",
          title: "Theater reference",
          prompt: "Scene design sheet for the old theater.",
          firstAppearanceIndex: 1,
        },
      ],
      storyboards: [
        {
          itemId: "scene-1",
          paragraphIndex: 2,
          timelineIndex: 2,
          title: "The street turns gold",
          narrativeBeat: "quiet opening",
          prompt: "Wide shot of the empty rainy street.",
          originalText: "The rain turned the street gold.",
          modelTextHint: "The rain turned the street gold.",
          referencedCardIds: ["theater-card"],
        },
        {
          itemId: "scene-2",
          paragraphIndex: 1,
          timelineIndex: 1,
          title: "Mira looks up",
          narrativeBeat: "small emotional turn",
          prompt: "Medium shot of Mira under the marquee.",
          captionText: "Mira stopped under the old theater sign.",
          referencedCardIds: ["mira-card", "theater-card"],
        },
      ],
    },
    { stylePreset: "cinematic-editorial" },
  );

  assert.equal(plan.contentType, "narrative");
  assert.equal(plan.recommendedImageCount, 4);
  assert.equal(plan.characters.length, 1);
  assert.equal(plan.scenes.length, 1);
  assert.deepEqual(
    plan.items.map((item) => item.itemId),
    ["reference-theater-card", "reference-mira-card", "scene-2", "scene-1"],
  );
  assert.match(plan.referenceCards.find((card) => card.cardId === "mira-card").prompt, /Character reference board requirements/);
  assert.match(plan.referenceCards.find((card) => card.cardId === "mira-card").prompt, /front view, side view/);
  assert.match(plan.referenceCards.find((card) => card.cardId === "mira-card").prompt, /joy, anger, sorrow, and happiness/);
  assert.match(plan.referenceCards.find((card) => card.cardId === "mira-card").prompt, /clothing\/costume breakdown/);
  assert.match(plan.referenceCards.find((card) => card.cardId === "mira-card").prompt, /accessories and prop detail callouts/);
  assert.match(plan.referenceCards.find((card) => card.cardId === "theater-card").prompt, /Scene reference board requirements/);
  assert.match(plan.referenceCards.find((card) => card.cardId === "theater-card").prompt, /front view, side view, overhead view/);
  assert.equal(plan.items[2].paragraphIndex, 1);
  assert.equal(plan.items[2].timelineIndex, 1);
  assert.equal(plan.items[2].captionText, "Mira stopped under the old theater sign.");
  assert.equal(plan.items[2].modelTextHint, "");
  assert.equal(plan.items[3].paragraphIndex, 2);
  assert.equal(plan.items[3].timelineIndex, 2);
  assert.equal(plan.items[3].captionText, "The rain turned the street gold.");
  assert.equal(plan.items[3].modelTextHint, "The rain turned the street gold.");
});

test("article reference image prompts require single-sheet character and scene boards", () => {
  const characterPrompt = buildArticleImagePrompt({
    plan: { title: "Character Reference", styleBible: "Magazine realism." },
    item: {
      itemKind: "reference-card",
      cardId: "mira-card",
      title: "Mira reference",
      prompt: "Character sheet for Mira.",
    },
    referenceCards: [{ cardId: "mira-card", targetType: "character", title: "Mira", prompt: "Character sheet." }],
  });
  const scenePrompt = buildArticleImagePrompt({
    plan: { title: "Scene Reference", styleBible: "Magazine realism." },
    item: {
      itemKind: "reference-card",
      cardId: "theater-card",
      title: "Theater reference",
      prompt: "Scene sheet for the old theater.",
    },
    referenceCards: [{ cardId: "theater-card", targetType: "scene", title: "Theater", prompt: "Scene sheet." }],
  });

  assert.match(characterPrompt, /one single image sheet/);
  assert.match(characterPrompt, /front view, side view/);
  assert.match(characterPrompt, /joy, anger, sorrow, and happiness expression variations/);
  assert.match(characterPrompt, /clothing\/costume breakdown/);
  assert.match(characterPrompt, /accessories and prop detail callouts/);
  assert.match(scenePrompt, /one single image sheet/);
  assert.match(scenePrompt, /multiple scene views/);
  assert.match(scenePrompt, /front view, side view, overhead view/);
  assert.match(scenePrompt, /clear establishing scene display/);
});

test("article image prompt preserves global style and dual text fields", () => {
  const plan = normalizeArticleIllustrationPlan({
    title: "Rain Alley",
    styleBible: "Muted watercolor, rainy gold light.",
    referenceCards: [],
    storyboards: [
      {
        itemId: "scene-1",
        title: "Gold rain",
        prompt: "A rainy alley glowing under a theater sign.",
        captionText: "The rain turned the street gold.",
        modelTextHint: "The rain turned the street gold.",
      },
    ],
  });

  const prompt = buildArticleImagePrompt({ plan, item: plan.items[0] });

  assert.match(prompt, /Muted watercolor/);
  assert.match(prompt, /A rainy alley/);
  assert.match(prompt, /Reading order: paragraph 1, timeline 1/);
  assert.match(prompt, /Optional non-dialogue visual text/);
  assert.match(prompt, /Exact saved caption/);
  assert.match(prompt, /The rain turned the street gold/);
});

test("article image prompt renders dialogue as speech bubbles instead of printed scene text", () => {
  const plan = normalizeArticleIllustrationPlan({
    title: "Tunnel",
    styleBible: "Cinematic ink illustration.",
    referenceCards: [],
    storyboards: [
      {
        itemId: "scene-1",
        title: "A warning in the fog",
        prompt: "Two explorers stand in a poisonous tunnel.",
        captionText: "潘子道：“小三爷，别点烟了。”",
        modelTextHint: "潘子道：“小三爷，别点烟了。”",
      },
    ],
  });

  const prompt = buildArticleImagePrompt({ plan, item: plan.items[0] });

  assert.match(prompt, /comic-style speech balloons/);
  assert.match(prompt, /dialogue boxes/);
  assert.match(prompt, /Do not print this dialogue directly on walls, clothing, paper, signs, or other background surfaces/);
  assert.match(prompt, /小三爷，别点烟了/);
});

test("article image prompt keeps ordinary captions out of the rendered image text", () => {
  const plan = normalizeArticleIllustrationPlan({
    title: "Rain Alley",
    styleBible: "Muted watercolor.",
    referenceCards: [],
    storyboards: [
      {
        itemId: "scene-1",
        title: "Opening",
        prompt: "A quiet rainy alley.",
        captionText: "The rain turned the street gold.",
      },
    ],
  });

  const prompt = buildArticleImagePrompt({ plan, item: plan.items[0] });

  assert.match(prompt, /Avoid adding readable text inside the image/);
  assert.match(prompt, /Exact saved caption/);
  assert.doesNotMatch(prompt, /Optional integrated text inside the image/);
});

test("article planning caps xhigh reasoning to medium for structured long-text parsing", async () => {
  let capturedReasoningEffort = "";
  let capturedPlanningPrompt = "";
  const bundle = buildArticleBundle({
    title: "Classical battle excerpt",
    sourceText: "朱儁引兵围住阳城攻打，玄德献策，孙坚来援。",
  });

  const plan = await requestArticleIllustrationPlan({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-test",
    reasoningEffort: "xhigh",
    bundle,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      capturedReasoningEffort = body.reasoning.effort;
      capturedPlanningPrompt = body.input[0].content[0].text;
      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            title: "朱儁攻城",
            contentType: "narrative",
            stylePreset: "editorial-watercolor",
            storyboards: [
              {
                title: "军报入营",
                prompt: "Han dynasty military camp receives urgent news.",
                captionText: "朱儁引兵围住阳城攻打。",
              },
            ],
          }),
        }),
      };
    },
  });

  assert.equal(capturedReasoningEffort, "medium");
  assert.match(capturedPlanningPrompt, /Character reference cards must follow this format/);
  assert.match(capturedPlanningPrompt, /Scene reference cards must follow this format/);
  assert.match(capturedPlanningPrompt, /joy, anger, sorrow, and happiness expression variations/);
  assert.match(capturedPlanningPrompt, /multiple scene views/);
  assert.equal(plan.title, "朱儁攻城");
});
