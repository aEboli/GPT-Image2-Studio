import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../public/app.js", import.meta.url);
const imageEditViewPath = new URL("../lib/views/image-edit-view.mjs", import.meta.url);
const quickBlendViewPath = new URL("../lib/views/quick-blend-view.mjs", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const publicLibSyncPath = new URL("../scripts/sync-public-lib.mjs", import.meta.url);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFunctionBefore(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}(`);
  const end = source.indexOf(`function ${nextFunctionName}(`, start + 1);
  assert.notEqual(start, -1, `${functionName} should exist`);
  assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
  return source.slice(start, end);
}

function assertSharedRevealImport(source, modulePath) {
  assert.match(
    source,
    new RegExp(
      `import\\s*\\{(?=[^}]*\\bclearImageReveal\\b)(?=[^}]*\\bsetImageRevealSource\\b)[^}]*\\}\\s*from\\s*["']${escapeRegExp(modulePath)}["']`,
    ),
  );
}

function assertImageUrlRevealBranch(body, targetRef) {
  const target = escapeRegExp(targetRef);
  const setCall = new RegExp(`setImageRevealSource\\(\\s*${target}\\s*,\\s*imageUrl\\s*,`);
  const clearCall = new RegExp(`clearImageReveal\\(\\s*${target}\\s*\\)`);
  const directSourceAssignment = new RegExp(`${target}\\.src\\s*=`);
  const legacyImmediateVisibility = new RegExp(`${target}\\.classList\\.add\\(\\s*["']is-visible["']\\s*\\)`);

  assert.match(body, setCall, `${targetRef} should use the shared reveal source setter`);
  assert.match(body, clearCall, `${targetRef} should clear stale reveal state when no image is available`);
  assert.doesNotMatch(body, directSourceAssignment, `${targetRef} should not assign src directly in a reveal entrypoint`);
  assert.doesNotMatch(body, legacyImmediateVisibility, `${targetRef} should not restore the legacy immediate visibility class`);
}

function getCssRules(styles) {
  return [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

function findCssRule(rules, predicate, description) {
  const rule = rules.find(predicate);
  assert.ok(rule, `${description} should exist`);
  return rule;
}

function extractBalancedBlock(source, start) {
  const openingBrace = source.indexOf("{", start);
  assert.notEqual(openingBrace, -1, "CSS block should have an opening brace");

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBrace + 1, index);
      }
    }
  }

  assert.fail("CSS block should have a closing brace");
}

function findReducedMotionRevealBlock(styles) {
  const mediaPattern = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/g;
  for (const match of styles.matchAll(mediaPattern)) {
    const block = extractBalancedBlock(styles, match.index);
    if (block.includes("#previewImage.image-reveal")) {
      return block;
    }
  }
  assert.fail("image reveal styles should include a reduced-motion media query");
}

test("generation previews and the lightbox route image assignment through the shared reveal helper", async () => {
  const [app, imageEditView, quickBlendView, publicLibSync] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(imageEditViewPath, "utf8"),
    readFile(quickBlendViewPath, "utf8"),
    readFile(publicLibSyncPath, "utf8"),
  ]);

  assertSharedRevealImport(app, "/lib/image-reveal.mjs");
  assertSharedRevealImport(imageEditView, "../image-reveal.mjs");
  assertSharedRevealImport(quickBlendView, "../image-reveal.mjs");
  assert.match(
    publicLibSync,
    /PUBLIC_LIB_SYNC_TARGETS\s*=\s*\[[\s\S]*?["']image-reveal\.mjs["']/,
    "the browser mirror should be kept in the public-lib sync target list",
  );

  const decompositionPreview = extractFunctionBefore(
    app,
    "renderImageDecompositionGenerationPreview",
    "renderImageDecompositionGenerationStrip",
  );
  const referenceAnalysisPreview = extractFunctionBefore(
    app,
    "renderReferenceAnalysisGenerationPreview",
    "renderReferenceAnalysisSelectedPrompt",
  );
  const promptPreview = extractFunctionBefore(app, "renderPreview", "syncPromptFilmstripBaseline");
  const imageEditPreview = extractFunctionBefore(
    imageEditView,
    "renderImageEditGenerationPreview",
    "renderImageEditGenerationStrip",
  );
  const quickBlendPreview = extractFunctionBefore(
    quickBlendView,
    "renderQuickBlendGenerationPreview",
    "renderQuickBlendGenerationStrip",
  );
  const lightbox = extractFunctionBefore(app, "syncLightboxItem", "getJobActivitySize");

  assertImageUrlRevealBranch(decompositionPreview, "refs.imageDecompositionGenerationImage");
  assertImageUrlRevealBranch(referenceAnalysisPreview, "refs.referenceAnalysisGenerationImage");
  assertImageUrlRevealBranch(imageEditPreview, "refs.imageEditGenerationImage");
  assertImageUrlRevealBranch(quickBlendPreview, "refs.quickBlendGenerationImage");

  assert.match(promptPreview, /setImageRevealSource\(\s*refs\.previewImage\s*,\s*imageUrl\s*,/);
  assert.match(promptPreview, /clearImageReveal\(\s*refs\.previewImage\s*\)/);
  assert.doesNotMatch(promptPreview, /refs\.previewImage\.src\s*=/);
  assert.doesNotMatch(promptPreview, /refs\.previewImage\.classList\.add\(\s*["']is-visible["']\s*\)/);

  assert.match(lightbox, /setImageRevealSource\(\s*refs\.lightboxImage\s*,\s*imageUrl\s*,/);
  assert.match(
    lightbox,
    /if\s*\(\s*!state\.lightboxItem\s*\)\s*\{[\s\S]*?clearImageReveal\(\s*refs\.lightboxImage\s*\)[\s\S]*?return;/,
    "closing the lightbox should clear its reveal state",
  );
  assert.ok(
    /if\s*\(\s*!imageUrl\s*\)\s*\{[\s\S]*?clearImageReveal\(\s*refs\.lightboxImage\s*\)/.test(lightbox) ||
      /if\s*\(\s*imageUrl\s*\)\s*\{[\s\S]*?setImageRevealSource\(\s*refs\.lightboxImage\s*,\s*imageUrl\s*,[\s\S]*?\}\s*else\s*\{[\s\S]*?clearImageReveal\(\s*refs\.lightboxImage\s*\)/.test(lightbox),
    "a lightbox item without an image should clear the previous image instead of assigning an empty source",
  );
  assert.doesNotMatch(lightbox, /refs\.lightboxImage\.src\s*=/);
  assert.doesNotMatch(lightbox, /refs\.lightboxImage\.classList\.add\(\s*["']is-visible["']\s*\)/);
});

test("soft reveal CSS uses blur, opacity, and independent scale without replacing preview transforms", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const rules = getCssRules(styles);
  const initialRule = findCssRule(
    rules,
    ({ selector }) => selector.includes("#previewImage.image-reveal") && !selector.includes("is-image-reveal-"),
    "base image reveal rule",
  );
  const pendingRule = findCssRule(
    rules,
    ({ selector }) => selector.includes("#previewImage.image-reveal.is-image-reveal-pending"),
    "pending image reveal rule",
  );
  const revealedRule = findCssRule(
    rules,
    ({ selector }) => selector.includes("#previewImage.image-reveal.is-image-revealed"),
    "revealed image rule",
  );
  const requiredTargets = [
    "#previewImage.image-reveal",
    ".reference-analysis-generation-canvas img.image-reveal",
    ".image-decomposition-generation-canvas img.image-reveal",
    ".image-edit-generation-canvas img.image-reveal",
    ".quick-blend-generation img.image-reveal",
    "#lightboxImage.image-reveal",
  ];

  for (const selector of requiredTargets) {
    assert.ok(initialRule.selector.includes(selector), `${selector} should receive the common reveal transition`);
    assert.ok(pendingRule.selector.includes(selector), `${selector} should receive the pending reveal state`);
    assert.ok(revealedRule.selector.includes(selector), `${selector} should receive the revealed state`);
  }

  assert.match(initialRule.body, /opacity\s+300ms[\s\S]*?filter\s+300ms[\s\S]*?scale\s+300ms/);
  assert.match(pendingRule.body, /opacity\s*:\s*0;/);
  assert.match(pendingRule.body, /filter\s*:\s*blur\(10px\);/);
  assert.match(pendingRule.body, /scale\s*:\s*1\.03;/);
  assert.match(revealedRule.body, /opacity\s*:\s*1;/);
  assert.match(revealedRule.body, /filter\s*:\s*blur\(0\);/);
  assert.match(revealedRule.body, /scale\s*:\s*1;/);

  const reducedMotionBlock = findReducedMotionRevealBlock(styles);
  assert.match(reducedMotionBlock, /transition\s*:\s*none;/);
  assert.match(reducedMotionBlock, /filter\s*:\s*none;/);
  assert.match(reducedMotionBlock, /scale\s*:\s*1;/);

  const imageRevealRules = rules.filter(({ selector }) => selector.includes("image-reveal"));
  assert.ok(imageRevealRules.length >= 4, "image reveal styles should define their base and reduced-motion states");
  for (const rule of imageRevealRules) {
    assert.doesNotMatch(
      rule.body,
      /\btransform\s*:/,
      `reveal rule should preserve the existing transform controlled by its preview or lightbox: ${rule.selector}`,
    );
  }
});
