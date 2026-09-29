import { appendApiEndpointPath } from "./image-route-config.mjs";
import { DEFAULT_RESPONSES_MODEL } from "./model-defaults.mjs";

const CJK_RUN_PATTERN = /[\p{Script=Han}　-〿＀-￯‘-‟]+/gu;
const HAN_PATTERN = /\p{Script=Han}/u;
const MERGEABLE_GAP_PATTERN = /^[\p{L}\p{N} .%+\-\/×*()]{0,24}$/u;
const TRANSLATION_LANGUAGE_NAMES = {
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
};
const DEFAULT_TRANSLATION_TIMEOUT_MS = 60000;

function cleanString(value) {
  return String(value ?? "").trim();
}

function isChineseLanguage(value) {
  return /^zh\b/iu.test(cleanString(value));
}

function isTranslatableItem(item = {}) {
  return cleanString(item.role || item.itemKind) !== "infographic-rebuild";
}

// 把提示词里连续的中文片段（含夹在中间的数字、单位和短英文）提取为待翻译片段。
export function extractCreationPromptSourceSegments(text = "") {
  const source = String(text ?? "");
  const runs = [...source.matchAll(CJK_RUN_PATTERN)]
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
  const merged = [];
  for (const run of runs) {
    const previous = merged.at(-1);
    if (previous && MERGEABLE_GAP_PATTERN.test(source.slice(previous.end, run.start))) {
      previous.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }
  return [...new Set(
    merged
      .map(({ start, end }) => source.slice(start, end).trim())
      .filter((segment) => HAN_PATTERN.test(segment)),
  )];
}

function buildTranslationRequestBody({ responsesModel, languageName, segments }) {
  return {
    model: responsesModel || DEFAULT_RESPONSES_MODEL,
    input: [
      `Translate each ecommerce product source segment into ${languageName}.`,
      "Keep every number, unit, model code, and Latin-letter brand name exactly as written; keep the separators between clauses.",
      "Return one translation per segment in the same order, with the source copied verbatim.",
      JSON.stringify(segments),
    ].join("\n"),
    text: {
      format: {
        type: "json_schema",
        name: "creation_prompt_translation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["translations"],
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source", "target"],
                properties: {
                  source: { type: "string" },
                  target: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    stream: false,
  };
}

function collectResponseText(value, parts = []) {
  if (!value || typeof value !== "object") return parts;
  if (typeof value.output_text === "string") parts.push(value.output_text);
  if (typeof value.text === "string") parts.push(value.text);
  if (typeof value.content === "string") parts.push(value.content);
  ["output", "choices", "content"].forEach((key) => {
    if (Array.isArray(value[key])) value[key].forEach((item) => collectResponseText(item, parts));
  });
  if (value.message && typeof value.message === "object") collectResponseText(value.message, parts);
  return parts;
}

function parseTranslations(payload) {
  const candidates = Array.isArray(payload?.translations) ? [JSON.stringify(payload)] : collectResponseText(payload);
  for (const candidate of candidates) {
    const cleaned = cleanString(candidate).replace(/^```(?:json)?\s*|\s*```$/giu, "");
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.translations)) return parsed.translations;
    } catch {
      // 尝试下一个候选文本。
    }
  }
  throw new Error("Translation response did not contain translations.");
}

async function requestSegmentTranslations({ config, languageName, segments, fetchImpl, timeoutMs }) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(appendApiEndpointPath(config.baseUrl, config.endpointPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildTranslationRequestBody({ responsesModel: config.responsesModel, languageName, segments })),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text.trim() ? JSON.parse(text) : null;
    } catch {
      payload = { output_text: text };
    }
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || `Translation request failed with HTTP ${response.status}`);
    }
    const translations = parseTranslations(payload);
    return new Map(segments.map((segment, index) => {
      const entry = translations.find((item) => cleanString(item?.source) === segment) || translations[index];
      const target = cleanString(entry?.target);
      return [segment, target && !HAN_PATTERN.test(target) ? target : ""];
    }).filter(([, target]) => target));
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Translation request timed out after ${timeoutMs}ms.`);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function replaceSegments(prompt, translations) {
  return [...translations.keys()]
    .sort((left, right) => right.length - left.length)
    .reduce((text, segment) => text.split(segment).join(translations.get(segment)), String(prompt ?? ""));
}

// 生成前把套图提示词中的中文片段翻译为各项目标语言；失败时保留原提示词并返回 warning。
export async function translateCreationPlanPrompts(plan = {}, {
  config = {},
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TRANSLATION_TIMEOUT_MS,
} = {}) {
  const items = Array.isArray(plan.items) ? plan.items : [];
  const segmentsByLanguage = new Map();
  items.forEach((item) => {
    const language = cleanString(item.targetLanguage || plan.targetLanguage);
    if (!language || isChineseLanguage(language) || !isTranslatableItem(item)) return;
    const segments = extractCreationPromptSourceSegments(item.prompt);
    if (segments.length === 0) return;
    const bucket = segmentsByLanguage.get(language) || new Set();
    segments.forEach((segment) => bucket.add(segment));
    segmentsByLanguage.set(language, bucket);
  });
  if (segmentsByLanguage.size === 0) return { plan, translatedCount: 0, warning: "" };
  if (!cleanString(config.apiKey)) {
    return { plan, translatedCount: 0, warning: "未配置文本模型，提示词中的中文未翻译。" };
  }

  const translationsByLanguage = new Map();
  try {
    for (const [language, segments] of segmentsByLanguage) {
      translationsByLanguage.set(language, await requestSegmentTranslations({
        config,
        languageName: TRANSLATION_LANGUAGE_NAMES[language] || language,
        segments: [...segments],
        fetchImpl,
        timeoutMs,
      }));
    }
  } catch (error) {
    return {
      plan,
      translatedCount: 0,
      warning: `提示词翻译失败，已使用原提示词：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  let translatedCount = 0;
  const nextItems = items.map((item) => {
    const translations = translationsByLanguage.get(cleanString(item.targetLanguage || plan.targetLanguage));
    if (!translations || !isTranslatableItem(item)) return item;
    const prompt = replaceSegments(item.prompt, translations);
    if (prompt === item.prompt) return item;
    translatedCount += 1;
    return { ...item, prompt };
  });
  return { plan: { ...plan, items: nextItems }, translatedCount, warning: "" };
}
