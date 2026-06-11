import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { appendApiEndpointPath } from "./image-route-config.mjs";
import { normalizeBase64 } from "./responses-workflow.mjs";
import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";

export const PPT_PAGE_COUNT_MIN = 1;
export const PPT_PAGE_COUNT_MAX = 20;

const OUTLINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "slides"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slideNumber", "title", "keyMessage", "visualBrief", "speakerNotes"],
        properties: {
          slideNumber: { type: "integer" },
          title: { type: "string" },
          keyMessage: { type: "string" },
          visualBrief: { type: "string" },
          speakerNotes: { type: "string" },
        },
      },
    },
  },
};

function cleanString(value) {
  return String(value || "").trim();
}

function normalizePageCount(value) {
  const count = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(count) || count < PPT_PAGE_COUNT_MIN || count > PPT_PAGE_COUNT_MAX) {
    throw new Error(`PPT 页数必须在 ${PPT_PAGE_COUNT_MIN}-${PPT_PAGE_COUNT_MAX} 之间。`);
  }
  return count;
}

function compactText(value, fallback = "") {
  return cleanString(value).replace(/\s+/g, " ") || fallback;
}

export function validatePptSourceInput({ sourceFiles = [], sourceText = "", topic = "" } = {}) {
  const files = Array.isArray(sourceFiles) ? sourceFiles.filter(Boolean) : [];
  if (files.length === 0 && !cleanString(sourceText) && !cleanString(topic)) {
    throw new Error("至少选择上传文档、输入文本或输入主题中的一项。");
  }
}

export function normalizePptOutline(outline, pageCount) {
  const expectedCount = normalizePageCount(pageCount);
  const source = outline && typeof outline === "object" ? outline : {};
  const slides = Array.isArray(source.slides) ? source.slides : [];

  if (slides.length !== expectedCount) {
    throw new Error(`PPT 大纲页数不匹配：需要 ${expectedCount} 页，实际 ${slides.length} 页。`);
  }

  return {
    title: compactText(source.title, "未命名演示文稿").slice(0, 80),
    summary: compactText(source.summary, "").slice(0, 600),
    slides: slides.map((slide, index) => ({
      slideNumber: index + 1,
      title: compactText(slide?.title, `第 ${index + 1} 页`).slice(0, 80),
      keyMessage: compactText(slide?.keyMessage, slide?.title || `第 ${index + 1} 页要点`).slice(0, 240),
      visualBrief: compactText(slide?.visualBrief, "清晰专业的演示页视觉").slice(0, 360),
      speakerNotes: compactText(slide?.speakerNotes, "").slice(0, 800),
    })),
  };
}

function buildSourceText({ sourceText, topic, pageCount, stylePreset }) {
  const parts = [
    "请根据用户提供的资料生成 PPT 演示文稿结构化大纲。",
    `必须生成 ${pageCount} 页，slides.length 必须严格等于 ${pageCount}。`,
    "每页只输出标题、核心信息、视觉说明和讲稿备注，不要输出 Markdown。",
    "所有面向观众的文字使用简体中文，标题要短，单页只保留一个核心观点。",
  ];

  if (stylePreset) {
    parts.push(`视觉风格：${stylePreset}`);
  }

  if (topic) {
    parts.push(`主题：${topic}`);
  }

  if (sourceText) {
    parts.push(`材料：\n${sourceText}`);
  }

  return parts.join("\n\n");
}

function sourceDocumentToContentPart(document) {
  const filename = cleanString(document.filename || "source-file");
  const mimeType = cleanString(document.mimeType || "application/octet-stream");
  const base64 = document.base64 || (document.buffer ? Buffer.from(document.buffer).toString("base64") : "");

  return {
    type: "input_file",
    filename,
    file_data: `data:${mimeType};base64,${normalizeBase64(base64)}`,
  };
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  if (Array.isArray(payload?.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string") {
            chunks.push(content.text);
          }
          if (typeof content?.json === "object") {
            return JSON.stringify(content.json);
          }
        }
      }
    }
    return chunks.join("\n").trim();
  }

  return "";
}

function parseOutlineText(text) {
  const trimmed = cleanString(text);
  if (!trimmed) {
    throw new Error("PPT 大纲响应为空。");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("PPT 大纲响应不是有效 JSON。");
    }
    return JSON.parse(match[0]);
  }
}

export async function requestPptDeckOutline({
  baseUrl,
  endpointPath,
  apiKey,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  sourceDocuments = [],
  sourceText = "",
  topic = "",
  pageCount,
  stylePreset = "",
  fetchImpl = fetch,
}) {
  const normalizedPageCount = normalizePageCount(pageCount);
  validatePptSourceInput({ sourceFiles: sourceDocuments, sourceText, topic });

  const content = [
    ...sourceDocuments.map(sourceDocumentToContentPart),
    {
      type: "input_text",
      text: buildSourceText({
        sourceText: cleanString(sourceText),
        topic: cleanString(topic),
        pageCount: normalizedPageCount,
        stylePreset: cleanString(stylePreset),
      }),
    },
  ];

  const response = await fetchImpl(appendApiEndpointPath(baseUrl, endpointPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: responsesModel,
      input: [{ role: "user", content }],
      reasoning: { effort: reasoningEffort },
      text: {
        format: {
          type: "json_schema",
          name: "ppt_deck_outline",
          strict: true,
          schema: OUTLINE_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "PPT 大纲请求失败",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  const payload = await response.json();
  return normalizePptOutline(parseOutlineText(extractResponseText(payload)), normalizedPageCount);
}

export async function generatePptDeckOutline(options) {
  try {
    return await requestPptDeckOutline(options);
  } catch (firstError) {
    try {
      return await requestPptDeckOutline(options);
    } catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : String(secondError);
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(`${message || firstMessage}`);
    }
  }
}
