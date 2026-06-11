import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { appendApiEndpointPath } from "./image-route-config.mjs";
import { normalizeBase64 } from "./responses-workflow.mjs";
import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";
import {
  PPT_PAGE_COUNT_MAX,
  PPT_PAGE_COUNT_MIN,
  validatePptSourceInput,
} from "./ppt-deck-workflow.mjs";
import { PPT_STYLE_PRESETS, normalizePptStylePreset } from "./ppt-style-presets.mjs";

const ANALYSIS_SECTION_MAX = 12;

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "recommendedPageCount", "recommendedStylePreset", "rationale", "sections"],
  properties: {
    summary: { type: "string" },
    recommendedPageCount: { type: "integer" },
    recommendedStylePreset: { type: "string" },
    rationale: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "keyMessage", "suggestedSlides"],
        properties: {
          title: { type: "string" },
          keyMessage: { type: "string" },
          suggestedSlides: { type: "integer" },
        },
      },
    },
  },
};

function cleanString(value) {
  return String(value || "").trim();
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function compactText(value, fallback = "") {
  return cleanString(value).replace(/\s+/g, " ") || fallback;
}

function normalizeSection(section, index) {
  return {
    title: compactText(section?.title, `Section ${index + 1}`).slice(0, 80),
    keyMessage: compactText(section?.keyMessage, section?.title || `Section ${index + 1}`).slice(0, 220),
    suggestedSlides: clampInteger(section?.suggestedSlides, 1, PPT_PAGE_COUNT_MAX, 1),
  };
}

export function normalizePptDocumentAnalysis(analysis = {}, options = {}) {
  const fallbackPageCount = clampInteger(
    options.currentPageCount,
    PPT_PAGE_COUNT_MIN,
    PPT_PAGE_COUNT_MAX,
    8,
  );
  const sections = (Array.isArray(analysis?.sections) ? analysis.sections : [])
    .map(normalizeSection)
    .filter((section) => section.title || section.keyMessage)
    .slice(0, ANALYSIS_SECTION_MAX);
  const normalizedStyle = normalizePptStylePreset(analysis?.recommendedStylePreset || options.currentStylePreset);

  return {
    summary: compactText(analysis?.summary, "已完成文档分析。").slice(0, 600),
    recommendedPageCount: clampInteger(
      analysis?.recommendedPageCount,
      PPT_PAGE_COUNT_MIN,
      PPT_PAGE_COUNT_MAX,
      fallbackPageCount,
    ),
    recommendedStylePreset: normalizedStyle.value,
    recommendedStyleLabel: normalizedStyle.label,
    rationale: compactText(analysis?.rationale, "根据文档内容自动推荐页数和视觉风格。").slice(0, 600),
    sections,
  };
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

function buildAnalysisPrompt({ sourceText, topic, currentPageCount, currentStylePreset }) {
  const styleOptions = PPT_STYLE_PRESETS.map((preset) => `${preset.value}: ${preset.label}`).join("; ");
  const currentStyle = normalizePptStylePreset(currentStylePreset);
  const parts = [
    "Analyze the user source for a presentation deck.",
    "You must split the source into presentation sections, estimate how many slides each section needs, and recommend the best total slide count and visual style.",
    `Recommended page count must be an integer from ${PPT_PAGE_COUNT_MIN} to ${PPT_PAGE_COUNT_MAX}.`,
    `recommendedStylePreset must be one of these values: ${styleOptions}.`,
    `Current controls: pageCount=${currentPageCount || ""}, stylePreset=${currentStyle.value}.`,
    "Return concise Simplified Chinese summary and rationale. Do not generate the final slide outline.",
  ];

  if (topic) {
    parts.push(`Topic:\n${topic}`);
  }

  if (sourceText) {
    parts.push(`Pasted source text:\n${sourceText}`);
  }

  return parts.join("\n\n");
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

function parseAnalysisText(text) {
  const trimmed = cleanString(text);
  if (!trimmed) {
    throw new Error("PPT 文档分析响应为空。");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("PPT 文档分析响应不是有效 JSON。");
    }
    return JSON.parse(match[0]);
  }
}

export async function requestPptDocumentAnalysis({
  baseUrl,
  endpointPath,
  apiKey,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  sourceDocuments = [],
  sourceText = "",
  topic = "",
  currentPageCount = 8,
  currentStylePreset = "business",
  fetchImpl = fetch,
}) {
  validatePptSourceInput({ sourceFiles: sourceDocuments, sourceText, topic });

  const normalizedCurrentPageCount = clampInteger(
    currentPageCount,
    PPT_PAGE_COUNT_MIN,
    PPT_PAGE_COUNT_MAX,
    8,
  );
  const content = [
    ...sourceDocuments.map(sourceDocumentToContentPart),
    {
      type: "input_text",
      text: buildAnalysisPrompt({
        sourceText: cleanString(sourceText),
        topic: cleanString(topic),
        currentPageCount: normalizedCurrentPageCount,
        currentStylePreset,
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
          name: "ppt_document_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "PPT 文档分析请求失败",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  const payload = await response.json();
  return normalizePptDocumentAnalysis(parseAnalysisText(extractResponseText(payload)), {
    currentPageCount: normalizedCurrentPageCount,
    currentStylePreset,
  });
}

export async function analyzePptDocument(options) {
  try {
    return await requestPptDocumentAnalysis(options);
  } catch (firstError) {
    try {
      return await requestPptDocumentAnalysis(options);
    } catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : String(secondError);
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(`${message || firstMessage}`);
    }
  }
}
