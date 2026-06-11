import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { appendApiEndpointPath } from "./image-route-config.mjs";
import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";

export const ARTICLE_ILLUSTRATION_CONTENT_TYPES = [
  { value: "auto", label: "自动判断" },
  { value: "narrative", label: "叙事故事" },
  { value: "article", label: "图文文章" },
  { value: "mixed", label: "混合通用" },
];

export const DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET = "realist-magazine";

export const ARTICLE_ILLUSTRATION_STYLE_PRESETS = [
  {
    value: "realist-magazine",
    label: "杂志写实",
    promptInstruction:
      "realist magazine editorial illustration, naturalistic people, documentary detail, refined composition, natural color, polished print-magazine finish",
  },
  {
    value: "editorial-watercolor",
    label: "编辑水彩",
    promptInstruction: "editorial watercolor illustration, soft paper grain, restrained detail, warm natural light",
  },
  {
    value: "cinematic-editorial",
    label: "电影感插画",
    promptInstruction: "cinematic editorial illustration, composed camera language, coherent lighting, realistic emotion",
  },
  {
    value: "picture-book",
    label: "绘本质感",
    promptInstruction: "high-quality picture-book illustration, warm shapes, readable silhouettes, gentle pacing",
  },
  {
    value: "ink-wash",
    label: "淡墨叙事",
    promptInstruction: "modern ink-wash narrative illustration, quiet negative space, subtle texture, elegant rhythm",
  },
  {
    value: "documentary-realism",
    label: "纪实摄影感",
    promptInstruction:
      "documentary realism illustration, candid observational framing, grounded lens language, believable locations, natural imperfections",
  },
  {
    value: "historical-realism",
    label: "历史写实",
    promptInstruction:
      "historical realist illustration, researched costume and props, atmospheric period detail, grounded body language, cinematic but accurate setting",
  },
  {
    value: "gongbi-heritage",
    label: "工笔国风",
    promptInstruction:
      "contemporary gongbi-inspired Chinese illustration, precise linework, layered mineral colors, elegant historical atmosphere, restrained ornament",
  },
  {
    value: "graphic-novel",
    label: "图像小说",
    promptInstruction:
      "graphic novel illustration, expressive panel-like composition, inked contours, controlled color blocks, readable dramatic staging",
  },
  {
    value: "noir-comic",
    label: "黑白漫画",
    promptInstruction:
      "black-and-white noir comic illustration, strong chiaroscuro, textured ink, cinematic shadows, speech-bubble-friendly composition",
  },
  {
    value: "vintage-newsprint",
    label: "旧报刊版画",
    promptInstruction:
      "vintage newspaper engraving illustration, halftone texture, restrained monochrome ink, archival editorial mood, crisp silhouettes",
  },
  {
    value: "surreal-editorial",
    label: "超现实社论",
    promptInstruction:
      "surreal editorial illustration, symbolic visual metaphor, realistic materials with impossible composition, controlled magazine-art direction",
  },
  {
    value: "anime-storyboard",
    label: "动画分镜",
    promptInstruction:
      "premium animation storyboard illustration, clean character acting, cinematic keyframe composition, vivid but disciplined color, clear emotional beats",
  },
];

const CONTENT_TYPE_VALUES = new Set(ARTICLE_ILLUSTRATION_CONTENT_TYPES.map((option) => option.value));
const STYLE_PRESET_VALUES = new Set(ARTICLE_ILLUSTRATION_STYLE_PRESETS.map((option) => option.value));
const CHARACTER_REFERENCE_BOARD_INSTRUCTION =
  "Character reference board requirements: make one single image sheet containing front view, side view, and at least one additional angle; include joy, anger, sorrow, and happiness expression variations; include clothing/costume breakdown; include accessories and prop detail callouts; keep all views, expressions, clothing, and accessories together in the same image.";
const SCENE_REFERENCE_BOARD_INSTRUCTION =
  "Scene reference board requirements: make one single image sheet containing multiple scene views such as front view, side view, overhead view, and three-quarter or alternate angle; include a clear establishing scene display plus key geography, lighting, material, and atmosphere callouts; keep all views and scene displays together in the same image.";

export const ARTICLE_ILLUSTRATION_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "sourceSummary",
    "contentType",
    "recommendedImageCount",
    "styleBible",
    "characters",
    "scenes",
    "referenceCards",
    "storyboards",
  ],
  properties: {
    title: { type: "string" },
    sourceSummary: { type: "string" },
    contentType: { type: "string", enum: ["narrative", "article", "mixed"] },
    recommendedImageCount: { type: "integer" },
    styleBible: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "role", "visualContinuity", "emotionalRange", "prompt"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: { type: "string" },
          visualContinuity: { type: "string" },
          emotionalRange: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "visualContinuity", "mood", "prompt"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          visualContinuity: { type: "string" },
          mood: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
    referenceCards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cardId", "targetType", "targetId", "title", "prompt", "firstAppearanceIndex", "reason"],
        properties: {
          cardId: { type: "string" },
          targetType: { type: "string", enum: ["character", "scene"] },
          targetId: { type: "string" },
          title: { type: "string" },
          prompt: { type: "string" },
          firstAppearanceIndex: { type: "integer" },
          reason: { type: "string" },
        },
      },
    },
    storyboards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "itemId",
          "paragraphIndex",
          "timelineIndex",
          "title",
          "narrativeBeat",
          "prompt",
          "originalText",
          "captionText",
          "modelTextHint",
          "referencedCardIds",
          "emotion",
          "rhythm",
        ],
        properties: {
          itemId: { type: "string" },
          paragraphIndex: { type: "integer" },
          timelineIndex: { type: "integer" },
          title: { type: "string" },
          narrativeBeat: { type: "string" },
          prompt: { type: "string" },
          originalText: { type: "string" },
          captionText: { type: "string" },
          modelTextHint: { type: "string" },
          referencedCardIds: { type: "array", items: { type: "string" } },
          emotion: { type: "string" },
          rhythm: { type: "string" },
        },
      },
    },
  },
};

function cleanString(value) {
  return String(value || "").trim();
}

function parsePositiveInteger(value, fallback = 0) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function compactText(value, maxLength = 2000) {
  return cleanString(value).replace(/\s+/g, " ").slice(0, maxLength);
}

function slugId(value, fallback = "item") {
  const normalized = cleanString(value)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return normalized || fallback;
}

function normalizeContentType(value, fallback = "mixed") {
  const normalized = cleanString(value).toLowerCase();
  if (CONTENT_TYPE_VALUES.has(normalized) && normalized !== "auto") {
    return normalized;
  }
  const fallbackValue = cleanString(fallback).toLowerCase();
  return CONTENT_TYPE_VALUES.has(fallbackValue) && fallbackValue !== "auto" ? fallbackValue : "mixed";
}

function normalizeStylePreset(value) {
  const normalized = cleanString(value);
  return STYLE_PRESET_VALUES.has(normalized) ? normalized : DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET;
}

function getStylePresetPrompt(value) {
  const preset = ARTICLE_ILLUSTRATION_STYLE_PRESETS.find((option) => option.value === normalizeStylePreset(value));
  return preset?.promptInstruction || ARTICLE_ILLUSTRATION_STYLE_PRESETS[0].promptInstruction;
}

function getReferenceBoardInstruction(targetType) {
  return cleanString(targetType) === "scene" ? SCENE_REFERENCE_BOARD_INSTRUCTION : CHARACTER_REFERENCE_BOARD_INSTRUCTION;
}

function appendReferenceBoardInstruction(prompt, targetType) {
  const basePrompt = cleanString(prompt);
  const instruction = getReferenceBoardInstruction(targetType);
  if (basePrompt.includes("reference board requirements")) {
    return basePrompt;
  }
  return [basePrompt, instruction].filter(Boolean).join(" ");
}

function looksLikeDialogueText(value) {
  const text = cleanString(value);
  if (!text) {
    return false;
  }

  return (
    /["“”‘’「」『』]/.test(text) ||
    /(?:^|[，。！？；\s])(?:我|你|他|她|它|咱|我们|你们|他们|她们|小[\p{L}\p{N}_-]+|老[\p{L}\p{N}_-]+)[^，。！？；]{0,18}(?:说|问|道|喊|叫|答|回|低声|笑道|骂道|吼道)/u.test(text) ||
    /\b(?:said|asked|replied|whispered|shouted|answered)\b/i.test(text)
  );
}

function buildArticleTextRenderingInstruction({ modelTextHint = "", captionText = "" } = {}) {
  const explicitHint = cleanString(modelTextHint);
  const caption = cleanString(captionText);
  const textToRender = explicitHint || (looksLikeDialogueText(caption) ? caption : "");
  if (!textToRender) {
    return "Avoid adding readable text inside the image unless the scene naturally needs a sign, label, or environmental text.";
  }

  if (looksLikeDialogueText(textToRender)) {
    return `Dialogue text treatment: render the following dialogue as comic-style speech balloons, dialogue boxes, or narration caption boxes attached to the relevant speaker or panel. Do not print this dialogue directly on walls, clothing, paper, signs, or other background surfaces. Dialogue text: ${textToRender}.`;
  }

  return `Optional non-dialogue visual text, only if it fits naturally as a small designed label, sign, or caption element rather than pasted text on the image: ${textToRender}.`;
}

function normalizeArticlePlanningReasoningEffort(reasoningEffort) {
  const effort = cleanString(reasoningEffort).toLowerCase();
  if (effort === "low") {
    return "low";
  }
  return "medium";
}

function parseJsonText(text, label = "article illustration plan") {
  const trimmed = cleanString(text);
  if (!trimmed) {
    throw new Error(`${label} response was empty.`);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`${label} response was not valid JSON.`);
    }
    return JSON.parse(match[0]);
  }
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  if (Array.isArray(payload?.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (!Array.isArray(item?.content)) {
        continue;
      }
      for (const content of item.content) {
        if (typeof content?.text === "string") {
          chunks.push(content.text);
        }
        if (typeof content?.json === "object") {
          return JSON.stringify(content.json);
        }
      }
    }
    return chunks.join("\n").trim();
  }

  return "";
}

function normalizeSourceEntry(entry, index, kind) {
  const fallbackLabel = kind === "file" ? `source file ${index + 1}` : `pasted text ${index + 1}`;
  if (typeof entry === "string") {
    return {
      label: fallbackLabel,
      title: fallbackLabel,
      text: cleanString(entry),
      kind,
    };
  }

  const title = cleanString(entry?.title || entry?.filename || entry?.name || fallbackLabel);
  return {
    label: fallbackLabel,
    title,
    filename: cleanString(entry?.filename || entry?.name),
    text: cleanString(entry?.text || entry?.content || entry?.sourceText),
    kind,
  };
}

export function buildArticleBundle({
  title = "",
  textEntries = [],
  sourceText = "",
  sourceFiles = [],
  supplementalPrompt = "",
} = {}) {
  const normalizedTextEntries = Array.isArray(textEntries) ? textEntries : [textEntries];
  if (cleanString(sourceText)) {
    normalizedTextEntries.unshift({ title: "source text", text: sourceText });
  }

  const textSources = normalizedTextEntries
    .map((entry, index) => normalizeSourceEntry(entry, index, "text"))
    .filter((entry) => entry.text);
  const fileSources = (Array.isArray(sourceFiles) ? sourceFiles : [])
    .map((entry, index) => normalizeSourceEntry(entry, index, "file"))
    .filter((entry) => entry.text);
  const noteText = cleanString(supplementalPrompt);
  const noteSource = noteText
    ? [
        {
          label: "Supplemental notes",
          title: "Supplemental notes",
          text: noteText,
          kind: "note",
        },
      ]
    : [];
  const sources = [...textSources, ...fileSources, ...noteSource];

  if (sources.length === 0) {
    throw new Error("Article illustration requires pasted text, uploaded text files, or supplemental notes.");
  }

  const content = sources
    .map((source) => {
      const titlePart = source.filename || source.title || source.label;
      return `## ${source.label}${titlePart && titlePart !== source.label ? `: ${titlePart}` : ""}\n${source.text}`;
    })
    .join("\n\n");

  return {
    title: cleanString(title) || compactText(sources[0]?.title || sources[0]?.text, 80) || "Untitled article",
    sourceSummary: sources
      .map((source) => [source.label, source.filename || source.title].filter(Boolean).join(": "))
      .join("; "),
    content,
    sources: sources.map((source) => ({
      label: source.label,
      title: source.title,
      filename: source.filename || "",
      kind: source.kind,
      textPreview: compactText(source.text, 220),
    })),
  };
}

function normalizeEntityList(entries = [], fallbackPrefix = "entity") {
  const seen = new Set();
  const result = [];

  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    const name = cleanString(entry?.name || entry?.title || `${fallbackPrefix} ${index + 1}`);
    const identityKey = slugId(name || entry?.id || `${fallbackPrefix}-${index + 1}`);
    if (!identityKey || seen.has(identityKey)) {
      return;
    }
    seen.add(identityKey);
    result.push({
      id: cleanString(entry?.id) || identityKey,
      name,
      role: cleanString(entry?.role),
      visualContinuity: cleanString(entry?.visualContinuity || entry?.appearance || entry?.description),
      emotionalRange: cleanString(entry?.emotionalRange || entry?.emotion),
      mood: cleanString(entry?.mood),
      prompt: cleanString(entry?.prompt),
    });
  });

  return result;
}

function normalizeReferenceCard(card = {}, index = 0) {
  const targetType = cleanString(card.targetType) === "scene" ? "scene" : "character";
  const cardId = slugId(card.cardId || card.id || card.title || `${targetType}-${index + 1}`, `${targetType}-${index + 1}`);
  const title = cleanString(card.title || `${targetType} reference ${index + 1}`);
  const prompt = cleanString(card.prompt || card.visualPrompt || title);
  return {
    cardId,
    targetType,
    targetId: cleanString(card.targetId || card.entityId || card.sceneId),
    title,
    prompt: appendReferenceBoardInstruction(prompt, targetType),
    firstAppearanceIndex: Math.max(1, Number.parseInt(String(card.firstAppearanceIndex || index + 1), 10) || index + 1),
    reason: cleanString(card.reason),
  };
}

function normalizeStoryboardItem(item = {}, index = 0) {
  const title = cleanString(item.title || `Illustration ${index + 1}`);
  const originalText = cleanString(item.originalText || item.sourceText || item.quote);
  const captionText = cleanString(item.captionText || originalText || item.modelTextHint);
  const modelTextHint = cleanString(item.modelTextHint);
  const fallbackOrder = index + 1;
  return {
    itemId: slugId(item.itemId || item.id || title || `scene-${index + 1}`, `scene-${index + 1}`),
    slotIndex: index + 1,
    itemKind: "storyboard",
    paragraphIndex: parsePositiveInteger(
      item.paragraphIndex || item.paragraphNumber || item.sourceParagraphIndex || item.paragraph,
      fallbackOrder,
    ),
    timelineIndex: parsePositiveInteger(
      item.timelineIndex || item.timelineOrder || item.chronologyIndex || item.sequenceIndex,
      fallbackOrder,
    ),
    title,
    narrativeBeat: cleanString(item.narrativeBeat || item.beat),
    prompt: cleanString(item.prompt || item.visualPrompt || title),
    originalText,
    captionText,
    modelTextHint,
    referencedCardIds: Array.isArray(item.referencedCardIds)
      ? item.referencedCardIds.map(cleanString).filter(Boolean)
      : [],
    emotion: cleanString(item.emotion),
    rhythm: cleanString(item.rhythm),
    status: cleanString(item.status) || "planned",
  };
}

function referenceCardToItem(card) {
  return {
    itemId: `reference-${card.cardId}`,
    slotIndex: 0,
    itemKind: "reference-card",
    cardId: card.cardId,
    title: card.title,
    paragraphIndex: 0,
    timelineIndex: 0,
    narrativeBeat: card.reason || "Key reference card for visual consistency",
    prompt: card.prompt,
    originalText: "",
    captionText: `${card.title} reference`,
    modelTextHint: "",
    referencedCardIds: [],
    emotion: "",
    rhythm: "reference",
    status: "planned",
  };
}

export function buildArticleIllustrationSequence({ referenceCards = [], storyboards = [] } = {}) {
  const sortedCards = [...referenceCards].sort(
    (left, right) => left.firstAppearanceIndex - right.firstAppearanceIndex || left.cardId.localeCompare(right.cardId),
  );
  const sortedStoryboards = [...storyboards].sort(
    (left, right) =>
      (left.timelineIndex || left.slotIndex || 0) - (right.timelineIndex || right.slotIndex || 0) ||
      (left.paragraphIndex || left.timelineIndex || 0) - (right.paragraphIndex || right.timelineIndex || 0) ||
      left.slotIndex - right.slotIndex ||
      left.title.localeCompare(right.title) ||
      left.itemId.localeCompare(right.itemId),
  );
  const sequence = [
    ...sortedCards.map(referenceCardToItem),
    ...sortedStoryboards,
  ];

  return sequence.map((item, index) => ({
    ...item,
    slotIndex: index + 1,
  }));
}

export function normalizeArticleIllustrationPlan(plan = {}, options = {}) {
  const source = plan && typeof plan === "object" ? plan : {};
  const referenceCards = (Array.isArray(source.referenceCards) ? source.referenceCards : [])
    .map(normalizeReferenceCard)
    .filter((card) => card.prompt);
  const storyboards = (Array.isArray(source.storyboards) ? source.storyboards : [])
    .map(normalizeStoryboardItem)
    .filter((item) => item.prompt);
  const items = buildArticleIllustrationSequence({ referenceCards, storyboards });
  const title = cleanString(source.title || options.title || "Untitled article");
  const fallbackContentType = normalizeContentType(options.contentType || source.contentType || "mixed");

  return {
    title,
    sourceSummary: cleanString(source.sourceSummary || options.sourceSummary),
    contentType: normalizeContentType(source.contentType, fallbackContentType),
    recommendedImageCount: items.length,
    stylePreset: normalizeStylePreset(source.stylePreset || options.stylePreset),
    styleBible:
      cleanString(source.styleBible || options.styleBible) ||
      `Use ${getStylePresetPrompt(source.stylePreset || options.stylePreset)} consistently across all illustrations.`,
    characters: normalizeEntityList(source.characters, "character"),
    scenes: normalizeEntityList(source.scenes, "scene"),
    referenceCards,
    storyboards,
    items,
  };
}

function buildPlanningPrompt({ bundle, contentType, stylePreset }) {
  const styleInstruction = getStylePresetPrompt(stylePreset);
  const typeInstruction =
    contentType && contentType !== "auto"
      ? `The user selected content type: ${contentType}.`
      : "Infer whether the source is narrative, article, or mixed.";

  return [
    "Read the complete article bundle before planning. Do not plan paragraph-by-paragraph mechanically.",
    typeInstruction,
    "Create an article illustration plan, similar to a polished illustrated article storyboard.",
    "Choose the illustration count according to emotional rhythm and article structure. It is not fixed.",
    "Create key reference cards only for major recurring characters and frequent scenes that need consistency.",
    `Character reference cards must follow this format: ${CHARACTER_REFERENCE_BOARD_INSTRUCTION}`,
    `Scene reference cards must follow this format: ${SCENE_REFERENCE_BOARD_INSTRUCTION}`,
    "The final item sequence must group all reference cards first, then finished storyboard illustrations in article reading order.",
    "For every storyboard, set paragraphIndex to the 1-based source paragraph or natural paragraph cluster it illustrates, set timelineIndex to the 1-based chronological reading order, and sort storyboards by timelineIndex.",
    "Each storyboard prompt must inherit one style bible, keep recurring characters and repeated scenes visually consistent, and preserve the article's emotional pacing.",
    "For text, provide both fields: captionText as exact saved UI/export caption; modelTextHint only for dialogue lines or short visual text that should appear in the illustration.",
    "When source text contains dialogue, modelTextHint should contain the dialogue line(s), and the image must present dialogue through comic-style speech balloons, dialogue boxes, or narration caption boxes, not as text printed directly onto scene surfaces.",
    "For ordinary narrative sentences, keep captionText exact and leave modelTextHint empty unless a small environmental label is truly needed.",
    `Style preset direction: ${styleInstruction}.`,
    `Bundle title: ${bundle.title}`,
    `Source summary: ${bundle.sourceSummary}`,
    "Article bundle:",
    bundle.content,
  ].join("\n\n");
}

export async function requestArticleIllustrationPlan({
  baseUrl,
  endpointPath,
  apiKey,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  bundle,
  contentType = "auto",
  stylePreset = DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    throw new Error("API key is required for article illustration planning.");
  }
  if (!bundle?.content) {
    throw new Error("Article bundle is required.");
  }

  const response = await fetchImpl(appendApiEndpointPath(baseUrl, endpointPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: responsesModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPlanningPrompt({
                bundle,
                contentType: cleanString(contentType) || "auto",
                stylePreset: normalizeStylePreset(stylePreset),
              }),
            },
          ],
        },
      ],
      reasoning: { effort: normalizeArticlePlanningReasoningEffort(reasoningEffort) },
      text: {
        format: {
          type: "json_schema",
          name: "article_illustration_plan",
          strict: true,
          schema: ARTICLE_ILLUSTRATION_PLAN_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Article illustration plan request failed",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  const payload = await response.json();
  return normalizeArticleIllustrationPlan(parseJsonText(extractResponseText(payload)), {
    title: bundle.title,
    sourceSummary: bundle.sourceSummary,
    contentType,
    stylePreset,
  });
}

export async function generateArticleIllustrationPlan(options) {
  try {
    return await requestArticleIllustrationPlan(options);
  } catch (firstError) {
    try {
      return await requestArticleIllustrationPlan(options);
    } catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : String(secondError);
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(message || firstMessage);
    }
  }
}

export function buildArticleImagePrompt({ plan = {}, item = {}, referenceCards = [] } = {}) {
  const styleBible = cleanString(plan.styleBible);
  const referenceSummary = (Array.isArray(referenceCards) ? referenceCards : [])
    .map((card) => `${card.title || card.cardId}: ${card.reason || card.prompt || ""}`)
    .filter(Boolean)
    .join("\n");
  const captionText = cleanString(item.captionText);
  const modelTextHint = cleanString(item.modelTextHint);
  const parts = [
    `Article title: ${cleanString(plan.title) || "Untitled article"}.`,
    `Global style bible: ${styleBible || getStylePresetPrompt(plan.stylePreset)}.`,
    "Keep character identity, costume, age, proportions, scene geography, lighting logic, emotion, and pacing consistent with the plan.",
  ];

  if (item.itemKind === "reference-card") {
    parts.push("This is a key reference card. Make a clean reusable design reference, not a finished article illustration.");
    const matchedReferenceCard =
      (Array.isArray(referenceCards) ? referenceCards : []).find((card) => card.cardId && card.cardId === item.cardId) ||
      (Array.isArray(referenceCards) ? referenceCards : [])[0] ||
      {};
    parts.push(getReferenceBoardInstruction(matchedReferenceCard.targetType));
  } else {
    parts.push("This is a finished article illustration in the final reading order.");
    if (item.paragraphIndex || item.timelineIndex) {
      parts.push(
        `Reading order: paragraph ${parsePositiveInteger(item.paragraphIndex, 0) || "unknown"}, timeline ${parsePositiveInteger(item.timelineIndex, 0) || "unknown"}.`,
      );
    }
  }

  if (referenceSummary) {
    parts.push(`Available reference cards:\n${referenceSummary}`);
  }

  parts.push(`Scene title: ${cleanString(item.title)}.`);
  if (item.narrativeBeat) {
    parts.push(`Narrative beat: ${cleanString(item.narrativeBeat)}.`);
  }
  if (item.emotion) {
    parts.push(`Emotion: ${cleanString(item.emotion)}.`);
  }
  if (item.rhythm) {
    parts.push(`Rhythm: ${cleanString(item.rhythm)}.`);
  }
  parts.push(`Image prompt: ${cleanString(item.prompt)}.`);

  parts.push(buildArticleTextRenderingInstruction({ modelTextHint, captionText }));
  if (captionText) {
    parts.push(`Exact saved caption for UI/export, preserve separately from image rendering: ${captionText}.`);
  }
  parts.push("No unrelated characters, no style drift, no extra watermark, no UI chrome.");

  return parts.filter(Boolean).join("\n");
}
