import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { homedir } from "node:os";

import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { appendApiEndpointPath } from "./image-route-config.mjs";

const DEFAULT_CANVAS = { width: 2048, height: 1152 };
const ARTIFACT_SLIDE_SIZE = { width: 1280, height: 720 };
const LOW_CONFIDENCE_THRESHOLD = 0.68;
const IMAGE_EXTENSIONS = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);
const EDITABLE_ELEMENT_TYPES = new Set(["text", "table", "shape", "line", "image-region", "background", "fallback-image"]);

const RECONSTRUCTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["slideNumber", "canvas", "elements", "warnings"],
  properties: {
    slideNumber: { type: "integer" },
    sourceImage: { type: "string" },
    canvas: {
      type: "object",
      additionalProperties: false,
      required: ["width", "height"],
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
      },
    },
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "type", "editable", "bbox", "confidence"],
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          editable: { type: "string" },
          bbox: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "number" },
          },
          text: { type: "string" },
          rows: { type: "array" },
          fill: { type: "string" },
          color: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const ARTIFACT_MODULE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["slideNumber", "moduleSource", "warnings"],
  properties: {
    slideNumber: { type: "integer" },
    moduleSource: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
};

function cleanString(value) {
  return String(value || "").trim();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanPositiveInteger(value, fallback) {
  const number = Math.round(cleanNumber(value, fallback));
  return number > 0 ? number : fallback;
}

function normalizeCanvas(canvas = {}) {
  return {
    width: cleanPositiveInteger(canvas.width, DEFAULT_CANVAS.width),
    height: cleanPositiveInteger(canvas.height, DEFAULT_CANVAS.height),
  };
}

function clampBbox(bbox, canvas) {
  const values = Array.isArray(bbox) ? bbox : [0, 0, canvas.width, canvas.height];
  const rawX = Math.round(cleanNumber(values[0], 0));
  const rawY = Math.round(cleanNumber(values[1], 0));
  const x = Math.min(Math.max(0, rawX), Math.max(0, canvas.width - 1));
  const y = Math.min(Math.max(0, rawY), Math.max(0, canvas.height - 1));
  const width = Math.max(1, Math.round(cleanNumber(values[2], canvas.width)));
  const height = Math.max(1, Math.round(cleanNumber(values[3], canvas.height)));
  return [
    x,
    y,
    Math.max(1, Math.min(width, canvas.width - x)),
    Math.max(1, Math.min(height, canvas.height - y)),
  ];
}

function normalizeEditable(type, editable) {
  const normalized = cleanString(editable).toLowerCase();
  if (normalized) {
    return normalized;
  }
  if (type === "image-region" || type === "fallback-image" || type === "background") {
    return "image";
  }
  return type;
}

function normalizeElement(element, index, canvas, warnings) {
  const sourceType = cleanString(element?.type).toLowerCase();
  const confidence = Math.max(0, Math.min(1, cleanNumber(element?.confidence, 0)));
  let type = EDITABLE_ELEMENT_TYPES.has(sourceType) ? sourceType : "image-region";
  let editable = normalizeEditable(type, element?.editable);

  if (!["image-region", "fallback-image", "background"].includes(type) && confidence < LOW_CONFIDENCE_THRESHOLD) {
    warnings.push(`Element ${cleanString(element?.id) || index + 1} converted to image-region because of low confidence.`);
    type = "image-region";
    editable = "image";
  }

  const normalized = {
    ...element,
    id: cleanString(element?.id) || `${type}-${index + 1}`,
    type,
    editable,
    bbox: clampBbox(element?.bbox, canvas),
    confidence,
  };

  if (typeof element?.text === "string") {
    normalized.text = element.text.trim();
  }

  return normalized;
}

export function normalizePptReconstructionManifest(raw = {}, { fallbackImagePath = "" } = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const canvas = normalizeCanvas(source.canvas);
  const warnings = Array.isArray(source.warnings) ? source.warnings.map(cleanString).filter(Boolean) : [];
  const sourceImage = cleanString(source.sourceImage || fallbackImagePath);
  const rawElements = Array.isArray(source.elements) ? source.elements : [];
  const elements = rawElements
    .map((element, index) => normalizeElement(element, index, canvas, warnings))
    .filter((element) => element.bbox[2] > 0 && element.bbox[3] > 0);

  if (elements.length === 0 && sourceImage) {
    elements.push({
      id: "fallback-slide-image",
      type: "fallback-image",
      editable: "image",
      bbox: [0, 0, canvas.width, canvas.height],
      sourceImage,
      confidence: 1,
    });
    warnings.push("No reliable editable elements were detected; used full-slide image fallback.");
  }

  return {
    slideNumber: Math.max(1, Math.round(cleanNumber(source.slideNumber, 1))),
    sourceImage,
    canvas,
    elements,
    warnings,
  };
}

export function buildPptReconstructionPrompt({ title = "", slideNumber = 1, slideTitle = "" } = {}) {
  return [
    "Create an editable PowerPoint reconstruction manifest for the attached slide image.",
    "Identify reliable text boxes, tables, simple shapes, lines, and image regions that can become editable PowerPoint elements.",
    "Preserve each element's bounding box on a 2048x1152 canvas unless the image clearly has another size.",
    "Use fallback image-region for low-confidence artwork, icons, photos, chart regions, or anything that cannot be reconstructed safely.",
    "Do not guess unreadable text. If text is unclear, keep that area as a fallback image-region.",
    "Return JSON only, with no Markdown.",
    `Deck title: ${cleanString(title) || "Untitled"}`,
    `Slide ${Number(slideNumber) || 1} title: ${cleanString(slideTitle) || "Untitled slide"}`,
  ].join("\n");
}

export function buildPptArtifactModulePrompt({ title = "", slideNumber = 1, slideTitle = "" } = {}) {
  const exportName = `slide${padSlideNumber(slideNumber)}`;
  return [
    "Rebuild the attached slide as an editable artifact-tool PowerPoint slide module.",
    "Return JSON only. The moduleSource field must be a complete ESM module.",
    `The module must export exactly: export async function ${exportName}(presentation, ctx) { ... }`,
    "Inside the function, create exactly one slide with: const slide = presentation.slides.add();",
    "Use only these helpers: ctx.addText(slide, options), ctx.addShape(slide, options), await ctx.addImage(slide, options), await ctx.addLucideIcon(slide, options).",
    "Helper option schema is artifact-tool style, not pptxgenjs style: use geometry not type, fill as '#RRGGBB' string, line as { style, fill, width }, typeface not fontFace, insets not margin.",
    "Do not import modules, require modules, access process/globalThis/fs/network, define external dependencies, or read files.",
    "Prefer native editable text boxes, tables represented with editable text/shape grids, simple editable shapes, and icon placeholders.",
    "Use x/y/width/height coordinates on a 1280x720 canvas. Keep all elements inside the slide.",
    "Do not add the whole screenshot as a background unless a complex photo/artwork region cannot be recreated safely.",
    "If a region cannot be reconstructed, add a warning and use the source image only as a limited visual fallback.",
    "Use Simplified Chinese for visible text when the slide appears Chinese. Do not guess unreadable text.",
    `Deck title: ${cleanString(title) || "Untitled"}`,
    `Slide ${Number(slideNumber) || 1} title: ${cleanString(slideTitle) || "Untitled slide"}`,
  ].join("\n");
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
        if (content?.json && typeof content.json === "object") {
          return JSON.stringify(content.json);
        }
      }
    }
    return chunks.join("\n").trim();
  }

  return "";
}

function parseJsonText(text) {
  const trimmed = cleanString(text);
  if (!trimmed) {
    throw new Error("PPT reconstruction response was empty.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("PPT reconstruction response was not valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function imageMimeType(imagePath) {
  return IMAGE_EXTENSIONS.get(extname(imagePath).toLowerCase()) || "image/png";
}

export async function requestPptReconstructionManifest({
  baseUrl,
  endpointPath,
  apiKey,
  responsesModel,
  reasoningEffort,
  outline,
  slide,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    throw new Error("API key is required for editable PPT reconstruction.");
  }
  if (!slide?.absolutePath) {
    throw new Error("Slide image path is required for editable PPT reconstruction.");
  }

  const slideNumber = Number(slide.slideNumber) || 1;
  const outlineSlide = outline?.slides?.find((entry) => Number(entry.slideNumber) === slideNumber);
  const imageBuffer = await readFile(slide.absolutePath);
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
              text: buildPptReconstructionPrompt({
                title: outline?.title,
                slideNumber,
                slideTitle: slide.title || outlineSlide?.title,
              }),
            },
            {
              type: "input_image",
              image_url: `data:${imageMimeType(slide.absolutePath)};base64,${imageBuffer.toString("base64")}`,
            },
          ],
        },
      ],
      reasoning: { effort: reasoningEffort },
      text: {
        format: {
          type: "json_schema",
          name: "ppt_reconstruction_manifest",
          strict: true,
          schema: RECONSTRUCTION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Editable PPT reconstruction request failed",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  const payload = await response.json();
  return normalizePptReconstructionManifest(parseJsonText(extractResponseText(payload)), {
    fallbackImagePath: slide.absolutePath,
  });
}

function stripCodeFence(value) {
  const text = cleanString(value);
  const match = text.match(/^```(?:js|javascript|mjs)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : text;
}

function expectedSlideExportName(slideNumber) {
  return `slide${padSlideNumber(slideNumber)}`;
}

function artifactCompatPrelude() {
  return [
    "function normalizeColor(value, fallback = '#00000000') {",
    "  if (typeof value === 'string') {",
    "    const color = value.trim();",
    "    return color.startsWith('#') ? color : `#${color}`;",
    "  }",
    "  if (value && typeof value === 'object') {",
    "    const color = value.fill || value.color || value.hex;",
    "    if (typeof color === 'string' && color.trim()) {",
    "      const normalized = color.trim();",
    "      return normalized.startsWith('#') ? normalized : `#${normalized}`;",
    "    }",
    "    if (Number(value.transparency) >= 100) return '#00000000';",
    "  }",
    "  return fallback;",
    "}",
    "",
    "function normalizeLine(value) {",
    "  if (!value || typeof value !== 'object') return { style: 'solid', fill: '#00000000', width: 0 };",
    "  return {",
    "    style: value.style || value.dash || 'solid',",
    "    fill: normalizeColor(value.fill || value.color || value.stroke, '#00000000'),",
    "    width: Number.isFinite(Number(value.width)) ? Number(value.width) : 1,",
    "  };",
    "}",
    "",
    "function normalizeInsets(value) {",
    "  if (value && typeof value === 'object') return value;",
    "  const margin = Number.isFinite(Number(value)) ? Number(value) : 0;",
    "  return { left: margin, right: margin, top: margin, bottom: margin };",
    "}",
    "",
    "function createArtifactCompatCtx(ctx) {",
    "  return {",
    "    ...ctx,",
    "    addShape(slide, options = {}) {",
    "      return ctx.addShape(slide, {",
    "        ...options,",
    "        geometry: options.geometry || options.type || 'rect',",
    "        fill: normalizeColor(options.fill),",
    "        line: normalizeLine(options.line),",
    "      });",
    "    },",
    "    addText(slide, options = {}) {",
    "      return ctx.addText(slide, {",
    "        ...options,",
    "        typeface: options.typeface || options.fontFace || options.face,",
    "        fill: normalizeColor(options.fill, '#00000000'),",
    "        color: normalizeColor(options.color, '#111827'),",
    "        line: normalizeLine(options.line),",
    "        insets: normalizeInsets(options.insets ?? options.margin),",
    "        valign: options.valign || options.verticalAlign || options.verticalAlignment || 'top',",
    "        align: options.align || options.alignment || 'left',",
    "      });",
    "    },",
    "    async addLucideIcon(slide, options = {}) {",
    "      return ctx.addLucideIcon(slide, {",
    "        ...options,",
    "        color: normalizeColor(options.color || options.stroke, '#111827'),",
    "        strokeWidth: options.strokeWidth || options.stroke || 2,",
    "      });",
    "    },",
    "  };",
    "}",
    "",
  ].join("\n");
}

function injectArtifactCompat(source, slideNumber) {
  const exportName = expectedSlideExportName(slideNumber);
  const signature = `export async function ${exportName}(presentation, ctx) {`;
  const moduleSource = source.replace(signature, `${signature}\n  ctx = createArtifactCompatCtx(ctx);`);
  if (moduleSource.includes("function createArtifactCompatCtx(ctx)")) {
    return moduleSource;
  }
  return `${artifactCompatPrelude()}\n${moduleSource}`;
}

function validateArtifactModuleSource(source, slideNumber) {
  const moduleSource = stripCodeFence(source);
  const exportName = expectedSlideExportName(slideNumber);
  const blockedPatterns = [
    /\bimport\b/,
    /\brequire\s*\(/,
    /\bprocess\b/,
    /\bglobalThis\b/,
    /\bFunction\s*\(/,
    /\beval\s*\(/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bchild_process\b/,
    /\bfs\b/,
    /\bnode:/,
  ];

  if (!moduleSource) {
    throw new Error("Artifact slide module response was empty.");
  }
  if (!moduleSource.includes(`export async function ${exportName}(presentation, ctx)`)) {
    throw new Error(`Artifact slide module must export ${exportName}(presentation, ctx).`);
  }
  if (!/presentation\.slides\.add\s*\(\s*\)/.test(moduleSource)) {
    throw new Error("Artifact slide module must add exactly one slide.");
  }
  for (const pattern of blockedPatterns) {
    if (pattern.test(moduleSource)) {
      throw new Error(`Artifact slide module used a blocked construct: ${pattern}`);
    }
  }
  const compatSource = injectArtifactCompat(moduleSource, slideNumber);
  return compatSource.endsWith("\n") ? compatSource : `${compatSource}\n`;
}

export function normalizePptArtifactSlideModule(raw = {}, { slideNumber = 1 } = {}) {
  throw new Error("Artifact slide modules are disabled; use reconstruction manifests instead.");
}

export async function requestPptArtifactSlideModule({
  baseUrl,
  apiKey,
  responsesModel,
  reasoningEffort,
  outline,
  slide,
  fetchImpl = fetch,
}) {
  throw new Error("Artifact slide modules are disabled; use reconstruction manifests instead.");
}

export function buildFallbackPptReconstructionManifest({ slide, outline } = {}) {
  const slideNumber = Number(slide?.slideNumber) || 1;
  const title = cleanString(slide?.title || outline?.slides?.find((entry) => Number(entry.slideNumber) === slideNumber)?.title);
  const elements = [
    {
      id: "source-slide-image",
      type: "fallback-image",
      editable: "image",
      bbox: [0, 0, DEFAULT_CANVAS.width, DEFAULT_CANVAS.height],
      sourceImage: slide?.absolutePath || slide?.relativePath || "",
      confidence: 1,
    },
  ];

  if (title) {
    elements.push({
      id: "editable-slide-title",
      type: "text",
      editable: "text",
      bbox: [72, 56, 1180, 104],
      text: title,
      color: "#111827",
      fill: "#FFFFFFB8",
      fontSize: 42,
      confidence: 1,
    });
  }

  return normalizePptReconstructionManifest(
    {
      slideNumber,
      sourceImage: slide?.absolutePath || "",
      canvas: DEFAULT_CANVAS,
      elements,
      warnings: ["Used full-slide image fallback for editable reconstruction."],
    },
    { fallbackImagePath: slide?.absolutePath || "" },
  );
}

function presentationsBuildScript(skillDir) {
  return join(skillDir, "scripts", "build_artifact_deck.mjs");
}

async function hasPresentationsBuildScript(skillDir) {
  if (!skillDir) {
    return false;
  }
  try {
    const fileStat = await stat(presentationsBuildScript(skillDir));
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function findVersionedPresentationsSkillDir(baseDir) {
  let entries = [];
  try {
    entries = await readdir(baseDir, { withFileTypes: true });
  } catch {
    return "";
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(baseDir, entry.name, "skills", "presentations"))
    .sort()
    .reverse();

  for (const candidate of candidates) {
    if (await hasPresentationsBuildScript(candidate)) {
      return candidate;
    }
  }
  return "";
}

export async function discoverPresentationsSkillDir({ skillDir = "", env = process.env, defaultBaseDir = "" } = {}) {
  const explicitCandidates = [skillDir, env.PRESENTATIONS_SKILL_DIR].map(cleanString).filter(Boolean);
  for (const candidate of explicitCandidates) {
    const absolute = resolve(candidate);
    if (await hasPresentationsBuildScript(absolute)) {
      return { ok: true, skillDir: absolute };
    }
  }

  const baseDir = cleanString(defaultBaseDir) ||
    join(homedir(), ".codex", "plugins", "cache", "openai-primary-runtime", "presentations");
  const discovered = await findVersionedPresentationsSkillDir(baseDir);
  if (discovered) {
    return { ok: true, skillDir: discovered };
  }

  return {
    ok: false,
    message: "Presentations skill runtime was not found on this machine.",
  };
}

function padSlideNumber(value) {
  return String(value).padStart(2, "0");
}

function asJs(value) {
  return JSON.stringify(value);
}

function scaleFrame(bbox, canvas) {
  const scaleX = ARTIFACT_SLIDE_SIZE.width / canvas.width;
  const scaleY = ARTIFACT_SLIDE_SIZE.height / canvas.height;
  return {
    x: Math.round(bbox[0] * scaleX),
    y: Math.round(bbox[1] * scaleY),
    width: Math.max(1, Math.round(bbox[2] * scaleX)),
    height: Math.max(1, Math.round(bbox[3] * scaleY)),
  };
}

function normalizeHexColor(value, fallback) {
  const color = cleanString(value);
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color) ? color : fallback;
}

function buildTextStatement(element, canvas) {
  const frame = scaleFrame(element.bbox, canvas);
  const fontSize = Math.max(
    10,
    Math.min(56, Math.round(cleanNumber(element.fontSize, element.bbox[3] * 0.35) * (ARTIFACT_SLIDE_SIZE.height / canvas.height))),
  );
  return `  ctx.addText(slide, ${asJs({
    ...frame,
    name: element.id,
    text: cleanString(element.text),
    fontSize,
    color: normalizeHexColor(element.color, "#111827"),
    bold: Boolean(element.bold),
    fill: normalizeHexColor(element.fill, "#00000000"),
    insets: { left: 8, right: 8, top: 4, bottom: 4 },
  })});`;
}

function buildShapeStatement(element, canvas) {
  const frame = scaleFrame(element.bbox, canvas);
  return `  ctx.addShape(slide, ${asJs({
    ...frame,
    name: element.id,
    geometry: cleanString(element.geometry) || "rect",
    fill: normalizeHexColor(element.fill, "#00000000"),
    line: {
      style: "solid",
      fill: normalizeHexColor(element.lineColor || element.stroke || element.color, "#94A3B8"),
      width: Math.max(0, Math.round(cleanNumber(element.lineWidth, 1))),
    },
  })});`;
}

function buildTableStatements(element, canvas) {
  const rows = Array.isArray(element.rows) ? element.rows : [];
  const text = rows.length
    ? rows.map((row) => (Array.isArray(row) ? row.join("    ") : cleanString(row))).join("\\n")
    : cleanString(element.text);
  return text ? [buildTextStatement({ ...element, type: "text", text, fontSize: element.fontSize || 16 }, canvas)] : [];
}

function buildSlideModuleSource({ slide, manifest, deckTitle }) {
  const canvas = normalizeCanvas(manifest.canvas);
  const statements = [
    `  await ctx.addImage(slide, ${asJs({
      path: slide.absolutePath || manifest.sourceImage,
      x: 0,
      y: 0,
      width: ARTIFACT_SLIDE_SIZE.width,
      height: ARTIFACT_SLIDE_SIZE.height,
      fit: "cover",
      alt: slide.title || deckTitle || "source slide image",
      name: "source-slide-image",
    })});`,
  ];

  for (const element of manifest.elements || []) {
    if (element.type === "text" && cleanString(element.text)) {
      statements.push(buildTextStatement(element, canvas));
    } else if (element.type === "shape") {
      statements.push(buildShapeStatement(element, canvas));
    } else if (element.type === "table") {
      statements.push(...buildTableStatements(element, canvas));
    }
  }

  return [
    `export async function slide${padSlideNumber(slide.slideNumber)}(presentation, ctx) {`,
    "  const slide = presentation.slides.add();",
    ...statements,
    "  return slide;",
    "}",
    "",
  ].join("\n");
}

async function writeSlideModules({ slidesDir, manifestsDir, slides, manifests, deckTitle }) {
  await mkdir(slidesDir, { recursive: true });
  await mkdir(manifestsDir, { recursive: true });

  for (const slide of slides) {
    const slideNumber = Number(slide.slideNumber) || 1;
    const manifest = manifests.find((entry) => Number(entry.slideNumber) === slideNumber) ||
      buildFallbackPptReconstructionManifest({ slide });
    const fileStem = `slide-${padSlideNumber(slideNumber)}`;
    await writeFile(join(manifestsDir, `${fileStem}.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeFile(
      join(slidesDir, `${fileStem}.mjs`),
      buildSlideModuleSource({ slide, manifest, deckTitle }),
      "utf8",
    );
  }
}

function runNodeScript(nodePath, scriptPath, args, { cwd, env } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(nodePath, [scriptPath, ...args], {
      cwd,
      env: {
        ...process.env,
        HOME: process.env.HOME || homedir(),
        ...env,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function emit(onEvent, type, payload) {
  if (typeof onEvent === "function") {
    await onEvent(type, payload);
  }
}

export async function buildEditablePptxReconstruction({
  skillDir = "",
  workspaceDir,
  outputPath,
  title = "Editable PPT",
  outline,
  slides = [],
  baseUrl,
  endpointPath,
  apiKey,
  responsesModel,
  reasoningEffort,
  fetchImpl = fetch,
  nodePath = process.execPath,
  presentationsBaseDir = "",
  onEvent,
} = {}) {
  const sortedSlides = [...slides].sort((left, right) => Number(left.slideNumber) - Number(right.slideNumber));
  const runtime = await discoverPresentationsSkillDir({ skillDir, defaultBaseDir: presentationsBaseDir });
  if (!runtime.ok) {
    return {
      ok: false,
      outputPath,
      warnings: [runtime.message],
    };
  }

  const resolvedWorkspaceDir = resolve(
    workspaceDir || join(dirname(outputPath), "editable-reconstruction-workspace", randomUUID().slice(0, 8)),
  );
  const slidesDir = join(resolvedWorkspaceDir, "slides");
  const manifestsDir = join(resolvedWorkspaceDir, "manifests");
  const previewDir = join(resolvedWorkspaceDir, "preview");
  const layoutDir = join(resolvedWorkspaceDir, "layout");
  const buildManifestPath = join(resolvedWorkspaceDir, "artifact-build-manifest.json");
  const manifests = [];
  const warnings = [];

  await emit(onEvent, "editable_reconstruction_started", {
    slideCount: sortedSlides.length,
  });

  for (const slide of sortedSlides) {
    await emit(onEvent, "editable_reconstruction_slide_started", {
      slideNumber: slide.slideNumber,
      title: slide.title,
    });
    try {
      manifests.push(
        await requestPptReconstructionManifest({
          baseUrl,
          endpointPath,
          apiKey,
          responsesModel,
          reasoningEffort,
          outline,
          slide,
          fetchImpl,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Slide ${slide.slideNumber}: ${message}`);
      manifests.push(buildFallbackPptReconstructionManifest({ slide, outline }));
      await emit(onEvent, "editable_reconstruction_warning", {
        slideNumber: slide.slideNumber,
        message,
      });
    }
  }

  await writeSlideModules({
    slidesDir,
    manifestsDir,
    slides: sortedSlides,
    manifests,
    deckTitle: title,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  let result = await runNodeScript(
    nodePath,
    presentationsBuildScript(runtime.skillDir),
    [
      "--workspace",
      resolvedWorkspaceDir,
      "--slides-dir",
      slidesDir,
      "--out",
      outputPath,
      "--preview-dir",
      previewDir,
      "--layout-dir",
      layoutDir,
      "--manifest",
      buildManifestPath,
      "--slide-count",
      String(sortedSlides.length),
    ],
    { cwd: resolvedWorkspaceDir },
  );

  if (result.code !== 0) {
    return {
      ok: false,
      outputPath,
      workspaceDir: resolvedWorkspaceDir,
      warnings: [
        ...warnings,
        ["Presentations artifact-tool build failed.", result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n"),
      ],
    };
  }

  const outputStat = existsSync(outputPath) ? await stat(outputPath) : null;
  if (!outputStat?.size) {
    return {
      ok: false,
      outputPath,
      workspaceDir: resolvedWorkspaceDir,
      warnings: [...warnings, "Presentations artifact-tool build did not create a PPTX file."],
    };
  }

  return {
    ok: true,
    outputPath,
    outputBytes: outputStat.size,
    workspaceDir: resolvedWorkspaceDir,
    manifests,
    warnings,
  };
}

export function buildEditablePptxFilename(pptxFilename) {
  const filename = cleanString(pptxFilename) || "deck.pptx";
  const extension = extname(filename) || ".pptx";
  return `${basename(filename, extension)}-editable${extension}`;
}
