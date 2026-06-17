import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";

import { normalizePptOutline, validatePptSourceInput } from "../lib/ppt-deck-workflow.mjs";
import { buildSlideEditPrompt, buildSlideImagePrompts } from "../lib/ppt-slide-prompts.mjs";
import { PPT_STYLE_PRESETS, normalizePptStylePreset } from "../lib/ppt-style-presets.mjs";
import {
  PPT_DYNAMIC_COMPONENT_PRESETS,
  PPT_TRANSITION_PRESETS,
  buildPptTransitionXml,
  normalizePptDynamicComponentPreset,
  normalizePptTransitionPreset,
} from "../lib/ppt-motion-presets.mjs";
import { createPptDeckStore } from "../lib/ppt-deck-store.mjs";
import {
  PPT_EXPORT_MODE_EDITABLE_RECONSTRUCTION,
  PPT_EXPORT_MODE_FLAT_IMAGE,
  isEditablePptExportMode,
  normalizePptExportMode,
} from "../lib/ppt-export-mode.mjs";
import {
  buildEditablePptxReconstruction,
  buildPptArtifactModulePrompt,
  buildPptReconstructionPrompt,
  discoverPresentationsSkillDir,
  normalizePptArtifactSlideModule,
  normalizePptReconstructionManifest,
} from "../lib/ppt-editable-reconstruction.mjs";
import { exportPptxDeck } from "../lib/ppt-export.mjs";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test("PPT outline validation requires input and exact requested page count", () => {
  assert.throws(() => validatePptSourceInput({ sourceFiles: [], sourceText: "", topic: "" }), /至少选择/);

  const normalized = normalizePptOutline(
    {
      title: "年度复盘",
      slides: [
        { title: "开场", keyMessage: "目标", visualBrief: "深色封面", speakerNotes: "介绍目标" },
        { slideNumber: 8, title: "数据", keyMessage: "增长", visualBrief: "图表", speakerNotes: "" },
      ],
    },
    2,
  );

  assert.equal(normalized.title, "年度复盘");
  assert.deepEqual(normalized.slides.map((slide) => slide.slideNumber), [1, 2]);
  assert.throws(() => normalizePptOutline({ title: "错页", slides: [{ title: "一页" }] }, 2), /页数不匹配/);
});

test("PPT slide prompts include outline content, visual guidance, 16:9 and readable Chinese text constraints", () => {
  const prompts = buildSlideImagePrompts({
    outline: {
      title: "课程发布",
      slides: [{ slideNumber: 1, title: "课程亮点", keyMessage: "让学习更高效", visualBrief: "教育培训风格" }],
    },
    theme: "教育培训",
  });

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].slideNumber, 1);
  assert.match(prompts[0].prompt, /16:9/);
  assert.match(prompts[0].prompt, /课程亮点/);
  assert.match(prompts[0].prompt, /中文文字必须清晰可读/);
  assert.match(prompts[0].prompt, /教育培训/);
});

test("PPT slide prompts can include progressive disclosure layout guidance", () => {
  const prompts = buildSlideImagePrompts({
    outline: {
      title: "增长发布",
      slides: [{ slideNumber: 1, title: "增长路径", keyMessage: "从线索到复购", visualBrief: "路径图" }],
    },
    theme: "tech",
    dynamicPreset: "storyline",
  });

  assert.equal(prompts.length, 1);
  assert.match(prompts[0].prompt, /渐进式披露/);
  assert.match(prompts[0].prompt, /路径叙事/);
  assert.doesNotMatch(prompts[0].prompt, /静态图片型幻灯片/);
  assert.match(prompts[0].prompt, /16:9/);
});

test("PPT style presets expose a broad set of selectable visual styles", () => {
  assert.ok(PPT_STYLE_PRESETS.length >= 10);
  assert.ok(PPT_STYLE_PRESETS.some((preset) => preset.value === "tech"));
  assert.ok(PPT_STYLE_PRESETS.some((preset) => preset.value === "finance"));
  assert.equal(normalizePptStylePreset("unknown").value, "business");
  assert.equal(normalizePptStylePreset("luxury").label, "高端品牌");
});

test("PPT motion presets expose dynamic component and transition choices", () => {
  assert.ok(PPT_DYNAMIC_COMPONENT_PRESETS.length >= 6);
  assert.ok(PPT_DYNAMIC_COMPONENT_PRESETS.some((preset) => preset.value === "data-pulse"));
  assert.equal(normalizePptDynamicComponentPreset("unknown").value, "smart");

  assert.ok(PPT_TRANSITION_PRESETS.length >= 7);
  assert.equal(PPT_TRANSITION_PRESETS[0].value, "smooth");
  assert.equal(normalizePptTransitionPreset("").value, "smooth");
  assert.equal(normalizePptTransitionPreset("unknown").value, "smooth");
  assert.ok(PPT_TRANSITION_PRESETS.some((preset) => preset.value === "smooth"));
  assert.ok(PPT_TRANSITION_PRESETS.some((preset) => preset.value === "morph-flow"));
});

test("PPT export mode defaults to flat image and recognizes editable reconstruction", () => {
  assert.equal(normalizePptExportMode(""), PPT_EXPORT_MODE_FLAT_IMAGE);
  assert.equal(normalizePptExportMode("unknown"), PPT_EXPORT_MODE_FLAT_IMAGE);
  assert.equal(normalizePptExportMode("flat-image"), PPT_EXPORT_MODE_FLAT_IMAGE);
  assert.equal(normalizePptExportMode("editable-reconstruction"), PPT_EXPORT_MODE_EDITABLE_RECONSTRUCTION);
  assert.equal(isEditablePptExportMode("editable-reconstruction"), true);
  assert.equal(isEditablePptExportMode("flat-image"), false);
});

test("PPT reconstruction manifest normalizes element bounds and low-confidence fallback", () => {
  const manifest = normalizePptReconstructionManifest(
    {
      slideNumber: 3,
      sourceImage: "slide-03.png",
      canvas: { width: 2048, height: 1152 },
      elements: [
        {
          id: "title",
          type: "text",
          editable: "text",
          bbox: [100.4, 80.2, 640.9, 90.1],
          text: "Readable title",
          confidence: 0.94,
        },
        {
          id: "uncertain-table",
          type: "table",
          editable: "table",
          bbox: [-10, 1100, 400, 120],
          confidence: 0.42,
        },
      ],
      warnings: ["small footer omitted"],
    },
    { fallbackImagePath: "slide-03.png" },
  );

  assert.equal(manifest.slideNumber, 3);
  assert.deepEqual(manifest.canvas, { width: 2048, height: 1152 });
  assert.deepEqual(manifest.elements[0].bbox, [100, 80, 641, 90]);
  assert.equal(manifest.elements[0].editable, "text");
  assert.equal(manifest.elements[1].type, "image-region");
  assert.equal(manifest.elements[1].editable, "image");
  assert.deepEqual(manifest.elements[1].bbox, [0, 1100, 400, 52]);
  assert.match(manifest.warnings.join("\n"), /low confidence/i);
  assert.match(manifest.warnings.join("\n"), /small footer omitted/);
});

test("PPT reconstruction prompt asks for editable PowerPoint elements and fallback layers", () => {
  const prompt = buildPptReconstructionPrompt({
    title: "季度发布复盘",
    slideNumber: 2,
    slideTitle: "增长保持稳定",
  });

  assert.match(prompt, /editable PowerPoint reconstruction manifest/);
  assert.match(prompt, /text boxes/i);
  assert.match(prompt, /tables/i);
  assert.match(prompt, /fallback image-region/i);
  assert.match(prompt, /do not guess unreadable text/i);
  assert.match(prompt, /季度发布复盘/);
  assert.match(prompt, /增长保持稳定/);
});

test("PPT artifact module prompt asks for artifact-tool editable slide modules", () => {
  const prompt = buildPptArtifactModulePrompt({
    title: "季度发布复盘",
    slideNumber: 2,
    slideTitle: "增长保持稳定",
  });

  assert.match(prompt, /artifact-tool PowerPoint slide module/);
  assert.match(prompt, /export async function slide02\(presentation, ctx\)/);
  assert.match(prompt, /ctx\.addText/);
  assert.match(prompt, /ctx\.addShape/);
  assert.match(prompt, /1280x720/);
  assert.match(prompt, /Do not import modules/);
});

test("PPT artifact module normalization rejects model-supplied code", () => {
  const moduleSource = [
    "export async function slide02(presentation, ctx) {",
    "  const slide = presentation.slides.add();",
    "  ctx.addText(slide, { x: 80, y: 80, width: 640, height: 90, text: '增长保持稳定', fontSize: 42 });",
    "  return slide;",
    "}",
    "",
  ].join("\n");

  assert.throws(
    () => normalizePptArtifactSlideModule({
      slideNumber: 2,
      moduleSource,
      warnings: ["Chart approximated with editable shapes"],
    }),
    /disabled/i,
  );
  assert.throws(
    () => normalizePptArtifactSlideModule({
      slideNumber: 2,
      moduleSource: "import fs from 'node:fs';\nexport async function slide02(presentation, ctx) { const slide = presentation.slides.add(); return slide; }",
    }),
    /disabled/i,
  );
  assert.throws(
    () => normalizePptArtifactSlideModule({
      slideNumber: 2,
      moduleSource: [
        "export async function slide02(presentation, ctx) {",
        "  const slide = presentation.slides.add();",
        "  const run = ({}).constructor.constructor('return 7');",
        "  ctx.addText(slide, String(run()), { x: 0, y: 0, w: 1, h: 1 });",
        "  return slide;",
        "}",
      ].join("\n"),
    }),
    /disabled/i,
  );
});

test("PPT artifact module normalization does not allow helper-style executable modules", () => {
  assert.throws(() => normalizePptArtifactSlideModule({
    slideNumber: 1,
    moduleSource: [
      "export async function slide01(presentation, ctx) {",
      "  const slide = presentation.slides.add();",
      "  ctx.addShape(slide, { type: 'roundRect', x: 10, y: 10, width: 100, height: 50, fill: { color: 'FFFFFF' }, line: { color: '062B6F', width: 1 } });",
      "  ctx.addText(slide, { x: 20, y: 20, width: 80, height: 24, text: '标题', fontFace: 'Microsoft YaHei', margin: 0, color: '062B6F' });",
      "  return slide;",
      "}",
    ].join("\n"),
  }), /disabled/i);

});

test("PPT presentations runtime discovery supports explicit and environment skill directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-skill-discovery-"));
  const explicitSkillDir = join(dir, "explicit-skill");
  const envSkillDir = join(dir, "env-skill");
  await mkdir(join(explicitSkillDir, "scripts"), { recursive: true });
  await mkdir(join(envSkillDir, "scripts"), { recursive: true });
  await writeFile(join(explicitSkillDir, "scripts", "build_artifact_deck.mjs"), "export {};\n", "utf8");
  await writeFile(join(envSkillDir, "scripts", "build_artifact_deck.mjs"), "export {};\n", "utf8");

  const explicit = await discoverPresentationsSkillDir({ skillDir: explicitSkillDir, defaultBaseDir: join(dir, "missing") });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.skillDir, explicitSkillDir);

  const fromEnv = await discoverPresentationsSkillDir({
    env: { PRESENTATIONS_SKILL_DIR: envSkillDir },
    defaultBaseDir: join(dir, "missing"),
  });
  assert.equal(fromEnv.ok, true);
  assert.equal(fromEnv.skillDir, envSkillDir);

  const missing = await discoverPresentationsSkillDir({ env: {}, defaultBaseDir: join(dir, "missing") });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /runtime was not found/i);
});

test("PPT editable reconstruction wrapper writes local slide modules and reports fallback warnings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-editable-wrapper-"));
  const skillDir = join(dir, "presentations");
  const workspaceDir = join(dir, "workspace");
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "editable.pptx");
  await mkdir(join(skillDir, "scripts"), { recursive: true });
  await writeFile(imagePath, png1x1);
  await writeFile(
    join(skillDir, "scripts", "build_artifact_deck.mjs"),
    [
      'import { mkdir, writeFile } from "node:fs/promises";',
      'import { dirname } from "node:path";',
      'const outIndex = process.argv.indexOf("--out");',
      'const manifestIndex = process.argv.indexOf("--manifest");',
      'const outputPath = process.argv[outIndex + 1];',
      'const manifestPath = process.argv[manifestIndex + 1];',
      "await mkdir(dirname(outputPath), { recursive: true });",
      "await writeFile(manifestPath, JSON.stringify({ ok: true }));",
      'await writeFile(outputPath, "fake editable pptx");',
      "",
    ].join("\n"),
    "utf8",
  );

  const events = [];
  const result = await buildEditablePptxReconstruction({
    skillDir,
    workspaceDir,
    outputPath,
    title: "可编辑重建测试",
    outline: {
      title: "可编辑重建测试",
      slides: [{ slideNumber: 1, title: "第一页" }],
    },
    slides: [{ slideNumber: 1, title: "第一页", absolutePath: imagePath }],
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    fetchImpl: async () => {
      throw new Error("simulated reconstruction failure");
    },
    onEvent: (eventName, payload) => events.push({ eventName, payload }),
  });

  assert.equal(result.ok, true);
  assert.ok(result.outputBytes > 0);
  assert.match(result.warnings.join("\n"), /simulated reconstruction failure/);
  assert.deepEqual(
    events.map((event) => event.eventName),
    [
      "editable_reconstruction_started",
      "editable_reconstruction_slide_started",
      "editable_reconstruction_warning",
    ],
  );

  const slideModule = await readFile(join(workspaceDir, "slides", "slide-01.mjs"), "utf8");
  const manifestJson = await readFile(join(workspaceDir, "manifests", "slide-01.json"), "utf8");
  assert.match(slideModule, /source-slide-image/);
  assert.match(slideModule, /editable-slide-title/);
  assert.match(manifestJson, /Used full-slide image fallback/);
});

test("PPT editable reconstruction wrapper uses local manifest rendering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-editable-artifact-module-"));
  const skillDir = join(dir, "presentations");
  const workspaceDir = join(dir, "workspace");
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "editable.pptx");
  await mkdir(join(skillDir, "scripts"), { recursive: true });
  await writeFile(imagePath, png1x1);
  await writeFile(
    join(skillDir, "scripts", "build_artifact_deck.mjs"),
    [
      'import { mkdir, readFile, writeFile } from "node:fs/promises";',
      'import { dirname, join } from "node:path";',
      'const outIndex = process.argv.indexOf("--out");',
      'const slidesIndex = process.argv.indexOf("--slides-dir");',
      'const outputPath = process.argv[outIndex + 1];',
      'const slidesDir = process.argv[slidesIndex + 1];',
      'const source = await readFile(join(slidesDir, "slide-01.mjs"), "utf8");',
      "await mkdir(dirname(outputPath), { recursive: true });",
      "await writeFile(outputPath, source.includes('manifest-rendered-title') ? 'manifest deck' : 'fallback deck');",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = await buildEditablePptxReconstruction({
    skillDir,
    workspaceDir,
    outputPath,
    title: "可编辑重建测试",
    outline: {
      title: "可编辑重建测试",
      slides: [{ slideNumber: 1, title: "第一页" }],
    },
    slides: [{ slideNumber: 1, title: "第一页", absolutePath: imagePath }],
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify({
        slideNumber: 1,
        canvas: { width: 2048, height: 1152 },
        elements: [
          {
            type: "text",
            editable: "text",
            bbox: [120, 120, 640, 100],
            text: "manifest-rendered-title",
            confidence: 0.95,
          },
        ],
        moduleSource: [
          "export async function slide01(presentation, ctx) {",
          "  const slide = presentation.slides.add();",
          "  ctx.addText(slide, { x: 80, y: 80, width: 640, height: 90, name: 'artifact-module-title', text: '第一页', fontSize: 42 });",
          "  return slide;",
          "}",
        ].join("\n"),
        warnings: [],
      }),
    }), { status: 200 }),
  });

  assert.equal(result.ok, true);
  const slideModule = await readFile(join(workspaceDir, "slides", "slide-01.mjs"), "utf8");
  const output = await readFile(outputPath, "utf8");
  assert.match(slideModule, /manifest-rendered-title/);
  assert.equal(output, "manifest deck");
});

test("PPT editable reconstruction ignores artifact module responses and uses fallback rendering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-editable-artifact-retry-"));
  const skillDir = join(dir, "presentations");
  const workspaceDir = join(dir, "workspace");
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "editable.pptx");
  await mkdir(join(skillDir, "scripts"), { recursive: true });
  await writeFile(imagePath, png1x1);
  await writeFile(
    join(skillDir, "scripts", "build_artifact_deck.mjs"),
    [
      'import { mkdir, readFile, writeFile } from "node:fs/promises";',
      'import { dirname, join } from "node:path";',
      'const outIndex = process.argv.indexOf("--out");',
      'const slidesIndex = process.argv.indexOf("--slides-dir");',
      'const outputPath = process.argv[outIndex + 1];',
      'const slidesDir = process.argv[slidesIndex + 1];',
      'const source = await readFile(join(slidesDir, "slide-01.mjs"), "utf8");',
      "if (source.includes('bad-artifact-module')) process.exit(9);",
      "await mkdir(dirname(outputPath), { recursive: true });",
      "await writeFile(outputPath, source.includes('source-slide-image') ? 'fallback deck' : 'unexpected deck');",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = await buildEditablePptxReconstruction({
    skillDir,
    workspaceDir,
    outputPath,
    title: "可编辑重建测试",
    outline: {
      title: "可编辑重建测试",
      slides: [{ slideNumber: 1, title: "第一页" }],
    },
    slides: [{ slideNumber: 1, title: "第一页", absolutePath: imagePath }],
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify({
        slideNumber: 1,
        moduleSource: [
          "export async function slide01(presentation, ctx) {",
          "  const slide = presentation.slides.add();",
          "  ctx.addText(slide, { x: 80, y: 80, width: 640, height: 90, name: 'bad-artifact-module', text: '第一页', fontSize: 42 });",
          "  return slide;",
          "}",
        ].join("\n"),
        warnings: [],
      }),
    }), { status: 200 }),
  });

  assert.equal(result.ok, true);
  const output = await readFile(outputPath, "utf8");
  const slideModule = await readFile(join(workspaceDir, "slides", "slide-01.mjs"), "utf8");
  assert.equal(output, "fallback deck");
  assert.match(slideModule, /source-slide-image/);
  assert.doesNotMatch(result.warnings.join("\n"), /retrying with element-level fallback/);
});

test("PPT editable reconstruction reports missing local presentations runtime without throwing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-editable-runtime-missing-"));
  const result = await buildEditablePptxReconstruction({
    skillDir: join(dir, "missing-skill"),
    presentationsBaseDir: join(dir, "missing-cache"),
    outputPath: join(dir, "editable.pptx"),
    slides: [],
    apiKey: "sk-test",
  });

  assert.equal(result.ok, false);
  assert.match(result.warnings.join("\n"), /runtime was not found/i);
});

test("PPT smooth transition writes a Morph transition by default", () => {
  const xml = buildPptTransitionXml({
    transitionSpeed: "fast",
    autoAdvanceSeconds: 2,
  });

  assert.match(xml, /<p:transition[^>]*spd="fast"[^>]*advClick="1"[^>]*advTm="2000"/);
  assert.match(xml, /xmlns:p159="http:\/\/schemas\.microsoft\.com\/office\/powerpoint\/2015\/09\/main"/);
  assert.match(xml, /<p159:morph\b[^>]*option="byObject"\/>/);
});

test("PPT slide edit prompts use the original slide, annotation and user instruction", () => {
  const prompt = buildSlideEditPrompt({
    outline: {
      title: "课程发布",
      slides: [{ slideNumber: 2, title: "课程亮点", keyMessage: "让学习更高效", visualBrief: "教育培训风格" }],
    },
    slideNumber: 2,
    theme: "tech",
    editInstruction: "把左侧标题改得更醒目，删除红圈里的图标。",
    dynamicPreset: "spotlight",
  });

  assert.match(prompt, /重新生成第 2 页/);
  assert.match(prompt, /课程亮点/);
  assert.match(prompt, /标注图/);
  assert.match(prompt, /把左侧标题改得更醒目/);
  assert.match(prompt, /演讲聚焦/);
  assert.match(prompt, /16:9/);
});

test("PPTX export writes a non-empty file with full-slide images", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-export-"));
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "deck.pptx");
  await writeFile(imagePath, png1x1);

  await exportPptxDeck({
    outputPath,
    title: "测试演示",
    slides: [
      { title: "第一页", imagePath },
      { title: "第二页", imagePath },
    ],
  });

  const fileStat = await stat(outputPath);
  assert.ok(fileStat.size > 1000);
});

test("PPTX export can embed slide transition timing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-transition-"));
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "deck.pptx");
  await writeFile(imagePath, png1x1);

  await exportPptxDeck({
    outputPath,
    title: "转场测试",
    motion: {
      transitionPreset: "fade",
      transitionSpeed: "fast",
      autoAdvanceSeconds: 3.5,
    },
    slides: [
      { title: "第一页", imagePath },
      { title: "第二页", imagePath },
    ],
  });

  const zip = await JSZip.loadAsync(await readFile(outputPath));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<p:transition[^>]*spd="fast"[^>]*advClick="1"[^>]*advTm="3500"/);
  assert.match(slideXml, /<p:fade\/>/);
});

test("PPTX export expands dynamic presets into progressive reveal steps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-progressive-"));
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "deck.pptx");
  await writeFile(imagePath, png1x1);

  await exportPptxDeck({
    outputPath,
    title: "渐进披露测试",
    motion: {
      dynamicPreset: "data-pulse",
      transitionPreset: "fade",
      transitionSpeed: "fast",
      autoAdvanceSeconds: 2,
    },
    slides: [{ title: "指标页", imagePath }],
  });

  const zip = await JSZip.loadAsync(await readFile(outputPath));
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)\.xml/)?.[1] || 0) - Number(right.match(/slide(\d+)\.xml/)?.[1] || 0));

  assert.equal(slideFiles.length, 3);
  const firstStepXml = await zip.file(slideFiles[0]).async("string");
  const finalStepXml = await zip.file(slideFiles[2]).async("string");
  assert.match(firstStepXml, /pptx-reveal-mask/);
  assert.doesNotMatch(finalStepXml, /pptx-reveal-mask/);
});

test("PPT deck store writes manifests, reads newest first, and keeps output download URLs", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ppt-store-"));
  const store = createPptDeckStore({ outputDir, publicBasePath: "/output" });

  await store.saveManifest({
    deckId: "deck-old",
    title: "旧演示",
    pageCount: 1,
    createdAt: "2026-04-28T00:00:00.000Z",
    slides: [],
    pptxRelativePath: "2026-04-28/old.pptx",
    pptxFilename: "old.pptx",
  });
  await store.saveManifest({
    deckId: "deck-new",
    title: "新演示",
    pageCount: 1,
    createdAt: "2026-04-30T00:00:00.000Z",
    slides: [],
    pptxRelativePath: "2026-04-30/new.pptx",
    pptxFilename: "new.pptx",
    editablePptxRelativePath: "2026-04-30/new-editable.pptx",
    editablePptxFilename: "new-editable.pptx",
    editablePptxWarnings: ["Slide 2 used image fallback"],
  });

  const decks = await store.listManifests();
  assert.deepEqual(decks.map((deck) => deck.deckId), ["deck-new", "deck-old"]);
  assert.equal(decks[0].pptxUrl, "/output/2026-04-30/new.pptx");
  assert.equal(decks[0].editablePptxUrl, "/output/2026-04-30/new-editable.pptx");
  assert.equal(decks[0].editablePptxFilename, "new-editable.pptx");
  assert.deepEqual(decks[0].editablePptxWarnings, ["Slide 2 used image fallback"]);

  const raw = await readFile(join(outputDir, "json", "ppt-decks", "deck-new.json"), "utf8");
  assert.match(raw, /新演示/);
  assert.match(raw, /editablePptxRelativePath/);
});

test("PPT deck store merges manifest records with PPTX files found in output folders", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ppt-store-files-"));
  const store = createPptDeckStore({ outputDir, publicBasePath: "/output" });

  await mkdir(join(outputDir, "2026-04-29"), { recursive: true });
  await mkdir(join(outputDir, "2026-04-30", "ppt"), { recursive: true });
  await mkdir(join(outputDir, "2026-05", "05-01", "2026-05-01-ppt", "folder-deck"), { recursive: true });
  await writeFile(join(outputDir, "2026-04-29", "manifested.pptx"), "manifested");
  await writeFile(join(outputDir, "2026-04-30", "ppt", "folder-only.pptx"), "folder-only");
  await writeFile(
    join(outputDir, "2026-05", "05-01", "2026-05-01-ppt", "folder-deck", "month-folder-only.pptx"),
    "month-folder-only",
  );

  await store.saveManifest({
    deckId: "deck-manifested",
    title: "Manifested Deck",
    pageCount: 3,
    createdAt: "2026-04-29T10:00:00.000Z",
    slides: [],
    pptxRelativePath: "2026-04-29/manifested.pptx",
    pptxFilename: "manifested.pptx",
  });

  const decks = await store.listManifests();
  const manifestedRecords = decks.filter((deck) => deck.pptxRelativePath === "2026-04-29/manifested.pptx");
  const folderOnly = decks.find((deck) => deck.pptxRelativePath === "2026-04-30/ppt/folder-only.pptx");
  const monthFolderOnly = decks.find(
    (deck) => deck.pptxRelativePath === "2026-05/05-01/2026-05-01-ppt/folder-deck/month-folder-only.pptx",
  );

  assert.equal(manifestedRecords.length, 1);
  assert.equal(manifestedRecords[0].deckId, "deck-manifested");
  assert.equal(manifestedRecords[0].recordSource, "manifest");
  assert.equal(folderOnly?.title, "folder-only");
  assert.equal(folderOnly?.recordSource, "folder");
  assert.equal(folderOnly?.pptxUrl, "/output/2026-04-30/ppt/folder-only.pptx");
  assert.equal(monthFolderOnly?.title, "month-folder-only");
  assert.equal(monthFolderOnly?.recordSource, "folder");
  assert.equal(
    monthFolderOnly?.pptxUrl,
    "/output/2026-05/05-01/2026-05-01-ppt/folder-deck/month-folder-only.pptx",
  );
});
