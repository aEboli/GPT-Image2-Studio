# Creation Listing Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Amazon US English Listing Agent to Creation Mode that generates one validated parent listing draft for the Creation set, uses SKU subjects as variant and quantity evidence, and falls back to input-only copy when generated images are missing or failed.

**2026-06-04 follow-up correction:** Current acceptance for the completed Listing Agent is the OpenSpec change in `openspec/changes/add-creation-listing-agent`. Do not use the older examples below to reintroduce one-draft-per-SKU output, `1 Pack` fallback for grouped multi-subject SKUs, or size/dimension/spec values in titles. Required regression coverage now includes: grouped `skuSubjects` such as three complete sellable subjects must produce a non-`1 Pack` parent listing title; titles must exclude `dimensionSpecs`, weight, hook size, and measurement values; fallback keywords and backend search terms must include stronger exact, long-tail, traffic, and descriptive Amazon search terms.

**Architecture:** Keep listing copy isolated from image planning and generation. Add pure listing draft helpers for schema normalization, source assembly, validation, keyword cleanup, and fallback evidence modes; add a thin model agent for Responses JSON generation and retry; expose one `/api/creation/listings` route that reads and updates Creation set manifests; render listing controls in Creation Mode and Creation record detail.

**Tech Stack:** Node.js ESM, `node:test`, OpenAI-compatible Responses API JSON schema, plain browser JavaScript, existing Creation Mode manifests and `/api/creation/*` routes.

---

## Scope Check

This is one subsystem: Creation Mode listing post-processing. It touches storage, API, model prompting, and UI, but every task feeds the same user-visible feature and can be verified independently.

## File Structure

- Create `lib/creation-listing-draft.mjs`: pure helpers for listing schema constants, source assembly, normalization, validation, keywords, evidence mode, and response summaries.
- Create `lib/creation-listing-agent.mjs`: model request, strict JSON schema, prompt assembly, JSON extraction, one retry, and mock mode for tests.
- Create `test/creation-listing-draft.test.mjs`: unit tests for source fallback, SKU count, title rules, keyword cleanup, and 500-character limits.
- Create `test/creation-listing-agent.test.mjs`: unit tests for Responses request shape, retry-once behavior, validation blocking, and mock mode.
- Modify `lib/creation-store.mjs`: persist normalized `listingDrafts` on Creation set manifests.
- Modify `test/creation-store.test.mjs`: assert listing drafts survive save/read/list.
- Modify `server.mjs`: add local `/api/creation/listings` route and handler.
- Modify `test/creation-e2e-regression.test.mjs`: verify endpoint persistence, image-backed output, and input-only fallback after failed image items.
- Modify `cloudflare-pages-worker.mjs` and `test/cloudflare-pages-worker.test.mjs`: keep route contract aligned and degrade to metadata-only generation when Worker cannot read local files.
- Modify `public/index.html`, `public/app.js`, and `public/styles.css`: add optional switch, listing section, actions, rendering, feedback, auto trigger, copy, and export.
- Modify `test/studio-preview-layout.test.mjs`: static/layout coverage for UI controls and browser fetch wiring.
- Modify `README.md` and `openspec/changes/add-creation-listing-agent/tasks.md`: document the feature and mark completed tasks during implementation.

## Task 1: Listing Draft Helpers

**Files:**
- Create: `lib/creation-listing-draft.mjs`
- Create: `test/creation-listing-draft.test.mjs`

- [ ] **Step 1: Write failing unit tests**

Create `test/creation-listing-draft.test.mjs` with these tests:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  dedupeCreationListingKeywords,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "../lib/creation-listing-draft.mjs";

const longText = "a".repeat(CREATION_LISTING_FIELD_MAX_CHARS + 1);

test("listing sources follow skuSubjects and use image-backed evidence when images exist", () => {
  const sources = buildCreationListingSources({
    setId: "set-1",
    productName: "Fishing Lure",
    productDescription: "Floating lure for bass fishing.",
    dimensionSpecs: "Length 3.5 in",
    industryTemplatePath: "Sports > Fishing > Lures",
    skuSubjects: [
      { id: "blue", title: "Blue Lure", filenames: ["blue.png"], note: "blue body" },
      { id: "green", title: "Green Lure", filenames: ["green.png"], note: "green body" },
    ],
    items: [
      { itemId: "sku-blue", role: "sku", status: "completed", title: "Blue SKU", relativePath: "a/blue.png", skuSubject: { id: "blue" } },
      { itemId: "sku-green", role: "sku", status: "completed", title: "Green SKU", relativePath: "a/green.png", skuSubject: { id: "green" } },
    ],
  });

  assert.equal(sources.length, 2);
  assert.equal(sources[0].skuSubjectId, "blue");
  assert.equal(sources[0].evidenceMode, "image-backed");
  assert.deepEqual(sources[0].imageItems.map((item) => item.relativePath), ["a/blue.png"]);
});

test("listing sources fall back to one input-only product package when no SKU and no image exists", () => {
  const sources = buildCreationListingSources({
    setId: "set-main",
    productName: "Travel Bottle",
    sellingPoints: ["Leak resistant"],
    items: [{ itemId: "1-hero", role: "hero", status: "failed", error: "upstream timeout" }],
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].skuSubjectId, "");
  assert.equal(sources[0].evidenceMode, "input-only");
  assert.match(sources[0].warnings.join("\n"), /Generated images were unavailable/);
});

test("listing draft validation rejects fields and bullets over 500 characters", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-1",
    title: longText,
    sellingPoints: ["Compact"],
    painPoints: ["Hard to store"],
    fiveBullets: ["Useful bullet"],
    description: "Short description",
    backendSearchTerms: "travel bottle",
  });

  const validation = validateCreationListingDraft(draft);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title exceeds 500 characters/);
});

test("listing draft validation requires quantity first and size second when dimensions exist", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-2",
    title: "Blue Fishing Lure 2 Pack 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: ["Designed for visible lure presentation."],
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title must start with quantity/);
  assert.match(validation.errors.join("\n"), /title must place size immediately after quantity/);
});

test("keyword helper deduplicates case-insensitively and removes competitor brands", () => {
  assert.deepEqual(
    dedupeCreationListingKeywords(["Bass Lure", "bass lure", "Amazon", "long tail bait", "AMAZON"]),
    ["Bass Lure", "long tail bait"],
  );
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
node --test test/creation-listing-draft.test.mjs
```

Expected: fail with `Cannot find module '../lib/creation-listing-draft.mjs'`.

- [ ] **Step 3: Implement pure listing helpers**

Create `lib/creation-listing-draft.mjs` with these exports and behavior:

```js
export const CREATION_LISTING_FIELD_MAX_CHARS = 500;
export const CREATION_LISTING_MARKETPLACE = "amazon-us";
export const CREATION_LISTING_LANGUAGE = "en-US";

const COMPETITOR_BRAND_TERMS = new Set(["amazon", "walmart", "temu", "ebay", "etsy", "target"]);

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanArray(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function makeDraftId(source = {}) {
  const suffix = cleanString(source.skuSubjectId || source.skuTitle || source.setId || "main")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `listing-${suffix || "main"}`;
}

export function dedupeCreationListingKeywords(keywords = []) {
  const seen = new Set();
  const result = [];
  for (const keyword of cleanArray(keywords)) {
    const key = keyword.toLowerCase();
    if (COMPETITOR_BRAND_TERMS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(keyword);
  }
  return result;
}

function normalizeKeywordBuckets(value = {}) {
  return {
    exact: dedupeCreationListingKeywords(value.exact),
    longTail: dedupeCreationListingKeywords(value.longTail),
    traffic: dedupeCreationListingKeywords(value.traffic),
    descriptive: dedupeCreationListingKeywords(value.descriptive),
  };
}

export function normalizeCreationListingDraft(value = {}, source = {}) {
  const keywordBuckets = normalizeKeywordBuckets(value.keywordBuckets || value.keyword_buckets || {});
  return {
    id: cleanString(value.id) || makeDraftId(source),
    marketplace: cleanString(value.marketplace) || CREATION_LISTING_MARKETPLACE,
    language: cleanString(value.language) || CREATION_LISTING_LANGUAGE,
    skuSubjectId: cleanString(value.skuSubjectId || value.sku_subject_id || source.skuSubjectId),
    skuTitle: cleanString(value.skuTitle || value.sku_title || source.skuTitle),
    evidenceMode: cleanString(value.evidenceMode || value.evidence_mode || source.evidenceMode) || "input-only",
    status: cleanString(value.status) || "completed",
    title: cleanString(value.title),
    sellingPoints: cleanArray(value.sellingPoints || value.selling_points),
    painPoints: cleanArray(value.painPoints || value.pain_points),
    fiveBullets: cleanArray(value.fiveBullets || value.five_bullets),
    description: cleanString(value.description),
    backendSearchTerms: dedupeCreationListingKeywords(cleanString(value.backendSearchTerms || value.backend_search_terms).split(/[,\n;]+/)).join(" "),
    keywordBuckets,
    evidence: cleanArray(value.evidence || source.evidence),
    missingInfo: cleanArray(value.missingInfo || value.missing_info),
    warnings: cleanArray(value.warnings || source.warnings),
    createdAt: cleanString(value.createdAt) || new Date().toISOString(),
    updatedAt: cleanString(value.updatedAt) || cleanString(value.createdAt) || new Date().toISOString(),
  };
}

function checkMaxLength(errors, label, value) {
  if (cleanString(value).length > CREATION_LISTING_FIELD_MAX_CHARS) {
    errors.push(`${label} exceeds ${CREATION_LISTING_FIELD_MAX_CHARS} characters`);
  }
}

function titleStartsWithQuantity(title, expectedQuantity) {
  const normalized = title.toLowerCase();
  const expected = cleanString(expectedQuantity).toLowerCase();
  return expected ? normalized.startsWith(expected) : /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:pack|piece|pcs|count|ct|set)\b/i.test(title);
}

export function validateCreationListingDraft(draft = {}, options = {}) {
  const normalized = normalizeCreationListingDraft(draft);
  const errors = [];
  checkMaxLength(errors, "title", normalized.title);
  checkMaxLength(errors, "description", normalized.description);
  checkMaxLength(errors, "backendSearchTerms", normalized.backendSearchTerms);
  normalized.sellingPoints.forEach((item, index) => checkMaxLength(errors, `sellingPoints[${index}]`, item));
  normalized.painPoints.forEach((item, index) => checkMaxLength(errors, `painPoints[${index}]`, item));
  normalized.fiveBullets.forEach((item, index) => checkMaxLength(errors, `fiveBullets[${index}]`, item));
  for (const [bucket, values] of Object.entries(normalized.keywordBuckets)) {
    values.forEach((item, index) => checkMaxLength(errors, `keywordBuckets.${bucket}[${index}]`, item));
  }
  if (!titleStartsWithQuantity(normalized.title, options.expectedQuantity)) {
    errors.push("title must start with quantity");
  }
  const expectedQuantity = cleanString(options.expectedQuantity);
  const expectedSize = cleanString(options.expectedSize);
  if (expectedQuantity && expectedSize && !normalized.title.toLowerCase().startsWith(`${expectedQuantity} ${expectedSize}`.toLowerCase())) {
    errors.push("title must place size immediately after quantity");
  }
  return { ok: errors.length === 0, errors, draft: normalized };
}

function itemMatchesSku(item = {}, sku = {}) {
  const skuId = cleanString(sku.id);
  const itemSkuId = cleanString(item.skuSubject?.id || item.sku_subject?.id || item.skuSubjectId);
  if (skuId && itemSkuId && skuId === itemSkuId) {
    return true;
  }
  const filenames = new Set(cleanArray(sku.filenames));
  return filenames.size > 0 && filenames.has(cleanString(item.filename));
}

function completedImageItemsForSource(set = {}, sku = null) {
  return (Array.isArray(set.items) ? set.items : []).filter((item) => {
    if (item.status !== "completed" || !cleanString(item.relativePath)) {
      return false;
    }
    return sku ? itemMatchesSku(item, sku) : true;
  });
}

export function buildCreationListingSources(set = {}) {
  const skuSubjects = Array.isArray(set.skuSubjects) ? set.skuSubjects : [];
  const sourceSubjects = skuSubjects.length > 0 ? skuSubjects : [{ id: "", title: set.productName, filenames: [], note: "" }];
  return sourceSubjects.map((sku) => {
    const imageItems = completedImageItemsForSource(set, skuSubjects.length > 0 ? sku : null);
    const fallbackImages = imageItems.length ? imageItems : completedImageItemsForSource(set, null);
    const evidenceMode = imageItems.length > 0 ? "image-backed" : fallbackImages.length > 0 ? "mixed" : "input-only";
    const warnings = evidenceMode === "input-only" ? ["Generated images were unavailable; copy is based on product inputs and saved SKU metadata."] : [];
    return {
      setId: cleanString(set.setId),
      productName: cleanString(set.productName),
      productDescription: cleanString(set.productDescription),
      sellingPoints: cleanArray(set.sellingPoints),
      dimensionSpecs: cleanString(set.dimensionSpecs),
      industryTemplatePath: cleanString(set.industryTemplatePath),
      referenceImageRoles: Array.isArray(set.referenceImageRoles) ? set.referenceImageRoles : [],
      skuSubjectId: cleanString(sku.id),
      skuTitle: cleanString(sku.title),
      skuNote: cleanString(sku.note),
      skuFilenames: cleanArray(sku.filenames),
      skuBundleCount: Number(sku.bundleCount || set.skuBundleCount) || 1,
      imageItems: imageItems.length > 0 ? imageItems : fallbackImages,
      plannedItems: Array.isArray(set.items) ? set.items : [],
      evidenceMode,
      warnings,
      evidence: (imageItems.length > 0 ? imageItems : fallbackImages).map((item) => cleanString(item.title || item.role || item.itemId)).filter(Boolean),
    };
  });
}
```

- [ ] **Step 4: Run the unit tests**

Run:

```powershell
node --test test/creation-listing-draft.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/creation-listing-draft.mjs test/creation-listing-draft.test.mjs
git commit -m "Add creation listing draft helpers"
```

## Task 2: Creation Manifest Persistence

**Files:**
- Modify: `lib/creation-store.mjs`
- Modify: `test/creation-store.test.mjs`

- [ ] **Step 1: Write failing store tests**

Append to `test/creation-store.test.mjs`:

```js
// Extend the existing import from "node:fs/promises" to include rm:
// import { mkdtemp, readFile, rm } from "node:fs/promises";

test("creation store preserves listing drafts on manifests", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-listing-store-"));
  const store = createCreationSetStore({ outputDir: rootDir });

  const saved = await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Fishing Lure",
    listingDrafts: [
      {
        id: "listing-blue",
        skuSubjectId: "blue",
        evidenceMode: "input-only",
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
        sellingPoints: ["Bright color for visibility"],
        painPoints: ["Hard to track bait in stained water"],
        fiveBullets: ["2 Pack 3.5 in profile for compact tackle boxes."],
        description: "Blue fishing lure listing draft.",
        backendSearchTerms: "blue fishing lure bass bait",
      },
    ],
  });

  assert.equal(saved.listingDrafts.length, 1);
  assert.equal(saved.listingDrafts[0].marketplace, "amazon-us");

  const read = await store.readManifest("creation-set-listing");
  assert.equal(read.listingDrafts[0].title, "2 Pack 3.5 in Blue Fishing Lures for Bass");

  await rm(rootDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the failing store test**

Run:

```powershell
node --test test/creation-store.test.mjs
```

Expected: fail because `listingDrafts` is missing from normalized manifests.

- [ ] **Step 3: Persist normalized listing drafts**

Modify `lib/creation-store.mjs`:

```js
import { normalizeCreationListingDraft } from "./creation-listing-draft.mjs";
```

Inside `normalizeCreationSetManifest`, add this property before `createdAt`:

```js
    listingDrafts: Array.isArray(manifest.listingDrafts)
      ? manifest.listingDrafts.map((draft) => normalizeCreationListingDraft(draft)).filter((draft) => draft.id)
      : [],
```

- [ ] **Step 4: Run the store tests**

Run:

```powershell
node --test test/creation-store.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/creation-store.mjs test/creation-store.test.mjs
git commit -m "Persist creation listing drafts"
```

## Task 3: Listing Model Agent

**Files:**
- Create: `lib/creation-listing-agent.mjs`
- Create: `test/creation-listing-agent.test.mjs`

- [ ] **Step 1: Write failing agent tests**

Create `test/creation-listing-agent.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATION_LISTING_JSON_SCHEMA,
  generateCreationListingDrafts,
  requestCreationListingDraft,
} from "../lib/creation-listing-agent.mjs";

function makeValidDraft(overrides = {}) {
  return {
    title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
    sellingPoints: ["Bright blue profile helps organize color variants."],
    painPoints: ["Reduces guesswork when selecting a compact lure color."],
    fiveBullets: [
      "2 Pack 3.5 in size fits common freshwater tackle storage.",
      "Blue lure profile supports clear SKU identification.",
      "Compact design works for bass fishing presentations.",
      "Product details are based on provided inputs and SKU metadata.",
      "Keyword-focused copy keeps listing language concise.",
    ],
    description: "Blue fishing lure listing draft for Amazon US.",
    backendSearchTerms: "blue fishing lure bass bait compact lure",
    keywordBuckets: {
      exact: ["blue fishing lure"],
      longTail: ["3.5 in bass lure"],
      traffic: ["freshwater bait"],
      descriptive: ["compact blue lure"],
    },
    ...overrides,
  };
}

test("listing agent sends a strict JSON schema request", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ output_text: JSON.stringify(makeValidDraft()) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: {
      setId: "set-1",
      productName: "Fishing Lure",
      skuTitle: "Blue Lure",
      skuBundleCount: 2,
      dimensionSpecs: "3.5 in",
      evidenceMode: "input-only",
    },
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack 3.5 in Blue Fishing Lures for Bass");
  assert.equal(calls[0].body.text.format.name, "creation_listing_draft_json");
  assert.deepEqual(calls[0].body.text.format.schema.required, CREATION_LISTING_JSON_SCHEMA.required);
});

test("listing agent retries once after validation failure", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    const draft = callCount === 1 ? makeValidDraft({ title: "Bad title without quantity" }) : makeValidDraft();
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: {
      setId: "set-1",
      productName: "Fishing Lure",
      skuBundleCount: 2,
      dimensionSpecs: "3.5 in",
      evidenceMode: "input-only",
    },
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(draft.title, /^2 Pack 3\.5 in/);
});

test("generateCreationListingDrafts creates one draft per source and supports mock mode", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-1",
      productName: "Fishing Lure",
      dimensionSpecs: "3.5 in",
      skuSubjects: [
        { id: "blue", title: "Blue Lure", bundleCount: 2 },
        { id: "green", title: "Green Lure", bundleCount: 2 },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    mock: true,
  });

  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack 3\.5 in/);
});
```

- [ ] **Step 2: Run the failing agent tests**

Run:

```powershell
node --test test/creation-listing-agent.test.mjs
```

Expected: fail with `Cannot find module '../lib/creation-listing-agent.mjs'`.

- [ ] **Step 3: Implement the model agent**

Create `lib/creation-listing-agent.mjs` with these exports:

```js
import { normalizeBaseUrl } from "./responses-workflow.mjs";
import {
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "./creation-listing-draft.mjs";

export const CREATION_LISTING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "sellingPoints", "painPoints", "fiveBullets", "description", "backendSearchTerms", "keywordBuckets", "missingInfo", "warnings"],
  properties: {
    title: { type: "string" },
    sellingPoints: { type: "array", items: { type: "string" }, maxItems: 8 },
    painPoints: { type: "array", items: { type: "string" }, maxItems: 8 },
    fiveBullets: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
    description: { type: "string" },
    backendSearchTerms: { type: "string" },
    keywordBuckets: {
      type: "object",
      additionalProperties: false,
      required: ["exact", "longTail", "traffic", "descriptive"],
      properties: {
        exact: { type: "array", items: { type: "string" } },
        longTail: { type: "array", items: { type: "string" } },
        traffic: { type: "array", items: { type: "string" } },
        descriptive: { type: "array", items: { type: "string" } },
      },
    },
    missingInfo: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

function extractResponseText(payload = {}) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (Array.isArray(payload.output)) {
    return payload.output
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .map((part) => part.text || "")
      .filter(Boolean)
      .join("");
  }
  return "";
}

function expectedQuantity(source = {}) {
  const count = Number(source.skuBundleCount) || 1;
  return `${count} Pack`;
}

function expectedSize(source = {}) {
  return String(source.dimensionSpecs || "").match(/\d+(?:\.\d+)?\s*(?:in|inch|inches|cm|mm|ft|oz|lb|ml|l)\b/i)?.[0] || "";
}

function buildListingPrompt(source = {}, validationErrors = []) {
  return [
    "You are an Amazon US English listing writer for ecommerce products.",
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `Title rule: start with ${expectedQuantity(source)}. If size is known, place it immediately after quantity.`,
    "After quantity and size, use core search terms, long-tail terms, traffic terms, and descriptive terms without keyword stuffing.",
    "Use generated images only as visual evidence. Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims.",
    source.evidenceMode === "input-only" ? "Generated images are unavailable. Use only product inputs and saved SKU metadata. Mark missing visual facts in missingInfo." : "Generated images or saved image metadata are available. Use them for visible selling points and pain points.",
    validationErrors.length ? `Fix these validation errors: ${validationErrors.join("; ")}` : "",
    `Source JSON:\n${JSON.stringify(source, null, 2)}`,
  ].filter(Boolean).join("\n\n");
}

export function makeMockCreationListingDraft(source = {}) {
  const quantity = expectedQuantity(source);
  const size = expectedSize(source);
  const skuName = source.skuTitle || source.productName || "Product";
  return normalizeCreationListingDraft({
    id: `listing-${source.skuSubjectId || "main"}`,
    skuSubjectId: source.skuSubjectId,
    skuTitle: source.skuTitle,
    evidenceMode: source.evidenceMode,
    title: [quantity, size, skuName, "Amazon Listing Draft"].filter(Boolean).join(" "),
    sellingPoints: ["Built from product inputs, SKU metadata, and available creation evidence."],
    painPoints: ["Helps shoppers compare product variants with concise details."],
    fiveBullets: [
      `${quantity}${size ? ` ${size}` : ""} format keeps quantity and size visible.`,
      `${skuName} draft uses SKU-specific product information.`,
      "Copy stays conservative when generated images are unavailable.",
      "Keyword structure supports Amazon US English listing review.",
      "Each bullet is kept under the configured character limit.",
    ],
    description: `${skuName} listing draft for Amazon US review.`,
    backendSearchTerms: `${skuName} ecommerce product listing`.toLowerCase(),
    keywordBuckets: {
      exact: [skuName],
      longTail: [`${skuName} amazon listing`],
      traffic: ["ecommerce product"],
      descriptive: ["sku specific"],
    },
    missingInfo: source.evidenceMode === "input-only" ? ["Generated image evidence was unavailable."] : [],
    warnings: source.warnings || [],
  }, source);
}

export async function requestCreationListingDraft({ baseUrl, apiKey, responsesModel, reasoningEffort = "medium", source, fetchImpl = fetch, mock = false }) {
  if (mock) {
    return makeMockCreationListingDraft(source);
  }

  let validationErrors = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: responsesModel,
        reasoning: { effort: reasoningEffort },
        input: buildListingPrompt(source, validationErrors),
        text: {
          format: {
            type: "json_schema",
            name: "creation_listing_draft_json",
            strict: true,
            schema: CREATION_LISTING_JSON_SCHEMA,
          },
        },
        stream: false,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || payload.message || `Listing request failed with HTTP ${response.status}`);
    }
    const parsed = JSON.parse(extractResponseText(payload));
    const draft = normalizeCreationListingDraft(parsed, source);
    const validation = validateCreationListingDraft(draft, {
      expectedQuantity: expectedQuantity(source),
      expectedSize: expectedSize(source),
    });
    if (validation.ok) {
      return validation.draft;
    }
    validationErrors = validation.errors;
  }

  const failed = makeMockCreationListingDraft(source);
  return { ...failed, status: "failed", warnings: [...failed.warnings, ...validationErrors] };
}

export async function generateCreationListingDrafts({ set, config, fetchImpl = fetch, mock = false }) {
  const sources = buildCreationListingSources(set);
  const drafts = [];
  for (const source of sources) {
    drafts.push(await requestCreationListingDraft({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort: config.reasoningEffort,
      source,
      fetchImpl,
      mock,
    }));
  }
  return drafts;
}
```

- [ ] **Step 4: Run agent tests**

Run:

```powershell
node --test test/creation-listing-agent.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/creation-listing-agent.mjs test/creation-listing-agent.test.mjs
git commit -m "Add creation listing agent"
```

## Task 4: Local API And Manifest Update

**Files:**
- Modify: `server.mjs`
- Modify: `test/creation-e2e-regression.test.mjs`

- [ ] **Step 1: Write failing API regression tests**

In `test/creation-e2e-regression.test.mjs`, add `IMAGE_STUDIO_MOCK_LISTING_AGENT: "1"` to the server environment in the main workflow test. After the generated set is loaded, add:

```js
// Extend the existing import from "node:fs/promises" to include mkdir:
// import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";

  const listingResponse = await postJson(baseUrl, "/api/creation/listings", { setId: generatedSet.setId });
  assert.equal(listingResponse.response.status, 200);
  assert.equal(listingResponse.body.ok, true);
  assert.equal(listingResponse.body.set.listingDrafts.length, 1);
  assert.match(listingResponse.body.set.listingDrafts[0].title, /^1 Pack/);

  const listedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(listedManifest.listingDrafts.length, 1);
```

Add a second regression test after the main workflow test:

```js
test("creation listing endpoint degrades to input-only when images failed", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-listing-e2e-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_MOCK_LISTING_AGENT: "1",
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const manifestsDir = join(outputDir, "json", "creation-sets");
  await mkdir(manifestsDir, { recursive: true });
  await writeFile(
    join(manifestsDir, "creation-set-failed.json"),
    `${JSON.stringify({
      setId: "creation-set-failed",
      productName: "Blue Fishing Lure",
      productDescription: "Compact lure for freshwater fishing.",
      dimensionSpecs: "3.5 in",
      skuBundleCount: 2,
      status: "failed",
      items: [{ itemId: "1-hero", role: "hero", status: "failed", error: "upstream failed" }],
    }, null, 2)}\n`,
    "utf8",
  );

  const listingResponse = await postJson(baseUrl, "/api/creation/listings", { setId: "creation-set-failed" });
  assert.equal(listingResponse.response.status, 200);
  assert.equal(listingResponse.body.set.listingDrafts[0].evidenceMode, "input-only");
  assert.match(listingResponse.body.set.listingDrafts[0].warnings.join("\n"), /Generated images were unavailable/);
});
```

- [ ] **Step 2: Run the failing API regression**

Run:

```powershell
node --test test/creation-e2e-regression.test.mjs
```

Expected: fail with HTTP 404 for `/api/creation/listings`.

- [ ] **Step 3: Implement the local route**

Modify `server.mjs` imports:

```js
import { generateCreationListingDrafts } from "./lib/creation-listing-agent.mjs";
```

Add handler near other Creation set handlers:

```js
async function handleCreationListingsGenerate(request, response) {
  const payload = await readJsonBody(request);
  const setId = String(payload.setId || "").trim();
  if (!setId) {
    return sendJson(response, 400, { message: "缺少套图记录 ID。" });
  }

  const set = await creationSetStore.readManifest(setId);
  const config = await configStore.readPrivateConfig();
  const mock = process.env.IMAGE_STUDIO_MOCK_LISTING_AGENT === "1";
  if (!mock && !config.apiKey) {
    return sendJson(response, 400, { message: "当前未保存 API Key，请先在配置中保存。" });
  }

  const reasoningEffort = normalizeReasoningEffort(config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT);
  const listingDrafts = await generateCreationListingDrafts({
    set,
    config: {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort,
    },
    mock,
  });
  const nextSet = await creationSetStore.saveManifest({
    ...set,
    listingDrafts,
    updatedAt: new Date().toISOString(),
  });

  return sendJson(response, 200, { ok: true, set: nextSet, listingDrafts });
}
```

Add route before `/api/creation/generate`:

```js
  if (request.method === "POST" && url.pathname === "/api/creation/listings") {
    return handleCreationListingsGenerate(request, response);
  }
```

- [ ] **Step 4: Run API regression**

Run:

```powershell
node --test test/creation-e2e-regression.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add server.mjs test/creation-e2e-regression.test.mjs
git commit -m "Add creation listing API"
```

## Task 5: Browser Controls And Rendering

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `test/studio-preview-layout.test.mjs`

- [ ] **Step 1: Write failing layout/static tests**

Append to `test/studio-preview-layout.test.mjs`:

```js
test("creation mode exposes optional listing agent controls and record listing actions", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(html, /id="creationListingAgentEnabledInput"/);
  assert.match(html, /id="creationRecordGenerateListingsButton"/);
  assert.match(html, /id="creationRecordExportListingsButton"/);
  assert.match(html, /id="creationRecordListingDrafts"/);
  assert.match(app, /creationListingAgentEnabledInput: document\.querySelector\("#creationListingAgentEnabledInput"\)/);
  assert.match(app, /fetch\("\/api\/creation\/listings"/);
  assert.match(app, /function renderCreationListingDrafts/);
  assert.match(styles, /\.creation-listing-drafts\s*\{/);
});
```

- [ ] **Step 2: Run the failing layout test**

Run:

```powershell
node --test test/studio-preview-layout.test.mjs
```

Expected: fail because the new DOM ids and functions are missing.

- [ ] **Step 3: Add HTML controls**

In `public/index.html`, add a compact checkbox near Creation generation options:

```html
<label class="toggle-row creation-listing-toggle">
  <input id="creationListingAgentEnabledInput" type="checkbox" />
  <span>生成后自动撰写 Amazon Listing</span>
</label>
```

Inside Creation record actions, add:

```html
<button class="toolbar-button" id="creationRecordGenerateListingsButton" type="button" disabled>生成 Listing</button>
<button class="toolbar-button" id="creationRecordExportListingsButton" type="button" disabled>导出 Listing</button>
```

Inside the selected record detail area, add:

```html
<section class="creation-listing-panel" aria-label="Amazon Listing 草稿">
  <div class="panel-title between">
    <h3>Amazon Listing</h3>
    <span id="creationRecordListingStatus">未生成</span>
  </div>
  <div class="creation-listing-drafts" id="creationRecordListingDrafts"></div>
</section>
```

- [ ] **Step 4: Add browser state, refs, API call, renderers, copy, and export**

In `public/app.js`, add refs:

```js
creationListingAgentEnabledInput: document.querySelector("#creationListingAgentEnabledInput"),
creationRecordGenerateListingsButton: document.querySelector("#creationRecordGenerateListingsButton"),
creationRecordExportListingsButton: document.querySelector("#creationRecordExportListingsButton"),
creationRecordListingDrafts: document.querySelector("#creationRecordListingDrafts"),
creationRecordListingStatus: document.querySelector("#creationRecordListingStatus"),
```

Add helpers near Creation record helpers:

```js
function getCreationListingDrafts(set) {
  return Array.isArray(set?.listingDrafts) ? set.listingDrafts : [];
}

function renderCreationListingDrafts(set) {
  if (!refs.creationRecordListingDrafts) {
    return;
  }
  const drafts = getCreationListingDrafts(set);
  refs.creationRecordListingDrafts.replaceChildren();
  refs.creationRecordListingStatus.textContent = drafts.length ? `${drafts.length} 条` : "未生成";
  if (!drafts.length) {
    const empty = document.createElement("p");
    empty.className = "creation-listing-empty";
    empty.textContent = "当前套图还没有 Listing 草稿。";
    refs.creationRecordListingDrafts.appendChild(empty);
    return;
  }
  drafts.forEach((draft) => {
    const card = document.createElement("article");
    card.className = "creation-listing-card";
    const title = document.createElement("h4");
    title.textContent = draft.title || "Untitled Listing";
    const meta = document.createElement("p");
    meta.textContent = [draft.skuTitle, draft.evidenceMode, draft.status].filter(Boolean).join(" · ");
    const bullets = document.createElement("ul");
    (draft.fiveBullets || []).forEach((bullet) => {
      const item = document.createElement("li");
      item.textContent = bullet;
      bullets.appendChild(item);
    });
    const terms = document.createElement("p");
    terms.className = "creation-listing-terms";
    terms.textContent = draft.backendSearchTerms || "";
    card.append(title, meta, bullets, terms);
    refs.creationRecordListingDrafts.appendChild(card);
  });
}

async function generateCreationRecordListings() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet?.setId) {
    setCreationRecordFeedback("请先选择一个套图记录。", "error");
    return null;
  }
  setCreationRecordFeedback("正在生成 Listing...", "busy");
  const response = await fetch("/api/creation/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setId: selectedSet.setId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Listing 生成失败。");
  }
  upsertCreationSet(payload.set);
  state.creation.recordSetId = payload.set?.setId || selectedSet.setId;
  renderCreationRecordView();
  setCreationRecordFeedback("Listing 已生成。", "success");
  return payload.set;
}

function exportCreationRecordListings() {
  const selectedSet = getCreationRecordSelectedSet();
  const drafts = getCreationListingDrafts(selectedSet);
  if (!drafts.length) {
    setCreationRecordFeedback("当前套图还没有可导出的 Listing。", "error");
    return;
  }
  downloadCreationRecordTextFile(
    `${JSON.stringify({ setId: selectedSet.setId, productName: selectedSet.productName, listingDrafts: drafts }, null, 2)}\n`,
    `creation-listings-${selectedSet.setId || "record"}.json`,
    "application/json;charset=utf-8",
  );
  setCreationRecordFeedback("Listing 已导出。", "success");
}
```

In `renderCreationRecordView`, enable buttons and call renderer:

```js
  if (refs.creationRecordGenerateListingsButton) {
    refs.creationRecordGenerateListingsButton.disabled = !selectedSet;
  }
  if (refs.creationRecordExportListingsButton) {
    refs.creationRecordExportListingsButton.disabled = getCreationListingDrafts(selectedSet).length === 0;
  }
  renderCreationListingDrafts(selectedSet);
```

Add event listeners:

```js
refs.creationRecordGenerateListingsButton?.addEventListener("click", () => {
  generateCreationRecordListings().catch((error) => setCreationRecordFeedback(compactErrorMessage(error.message, "Listing 生成失败"), "error"));
});
refs.creationRecordExportListingsButton?.addEventListener("click", exportCreationRecordListings);
```

- [ ] **Step 5: Add scoped CSS**

In `public/styles.css`, add:

```css
.creation-listing-toggle {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
}

.creation-listing-panel {
  display: grid;
  gap: 10px;
}

.creation-listing-drafts {
  display: grid;
  gap: 10px;
}

.creation-listing-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.creation-listing-card h4,
.creation-listing-card p,
.creation-listing-card li {
  overflow-wrap: anywhere;
}
```

- [ ] **Step 6: Run layout tests**

Run:

```powershell
node --test test/studio-preview-layout.test.mjs
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add public/index.html public/app.js public/styles.css test/studio-preview-layout.test.mjs
git commit -m "Add creation listing UI"
```

## Task 6: Automatic Post-Generation Trigger

**Files:**
- Modify: `public/app.js`
- Modify: `test/studio-preview-layout.test.mjs`

- [ ] **Step 1: Write failing static test**

Add to `test/studio-preview-layout.test.mjs`:

```js
test("creation listing agent can run automatically after creation generation completes", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function shouldAutoGenerateCreationListings/);
  assert.match(app, /if \(eventName === "complete"\)[\s\S]*shouldAutoGenerateCreationListings\(\)[\s\S]*generateCreationRecordListings/);
});
```

- [ ] **Step 2: Run the failing static test**

Run:

```powershell
node --test test/studio-preview-layout.test.mjs
```

Expected: fail because `shouldAutoGenerateCreationListings` is missing.

- [ ] **Step 3: Implement auto trigger**

In `public/app.js`, add:

```js
function shouldAutoGenerateCreationListings() {
  return Boolean(refs.creationListingAgentEnabledInput?.checked) && state.creation.generationScope === "full";
}
```

In the `complete` branch of `handleCreationStreamEvent`, after `upsertCreationSet(payload.set)` and before feedback:

```js
    if (shouldAutoGenerateCreationListings() && payload.set?.setId) {
      state.creation.recordSetId = payload.set.setId;
      generateCreationRecordListings().catch((error) => {
        setCreationFeedback(compactErrorMessage(error.message, "Listing 自动生成失败"), "error");
      });
    }
```

Keep this call best-effort and do not throw from the `complete` handler.

- [ ] **Step 4: Run static tests**

Run:

```powershell
node --test test/studio-preview-layout.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add public/app.js test/studio-preview-layout.test.mjs
git commit -m "Auto-run creation listing agent"
```

## Task 7: Cloudflare Worker Contract

**Files:**
- Modify: `cloudflare-pages-worker.mjs`
- Modify: `test/cloudflare-pages-worker.test.mjs`

- [ ] **Step 1: Write failing Worker tests**

Add tests to `test/cloudflare-pages-worker.test.mjs` that post a JSON body to `/api/creation/listings` with a minimal set payload:

```js
test("Cloudflare creation listing route accepts explicit set metadata and returns input-only drafts", async () => {
  const request = new Request("https://studio.example/api/creation/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      set: {
        setId: "worker-set",
        productName: "Travel Bottle",
        dimensionSpecs: "12 oz",
        skuSubjects: [{ id: "blue", title: "Blue Bottle", bundleCount: 1 }],
        items: [{ itemId: "1-hero", role: "hero", status: "failed" }],
      },
    }),
  });

  const response = await handleApiRequest(request, {
    IMAGE_STUDIO_MOCK_LISTING_AGENT: "1",
    fetchImpl() {
      throw new Error("mock listing route should not call upstream fetch");
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.listingDrafts.length, 1);
  assert.equal(body.listingDrafts[0].evidenceMode, "input-only");
});
```

- [ ] **Step 2: Run the failing Worker tests**

Run:

```powershell
node --test test/cloudflare-pages-worker.test.mjs
```

Expected: fail with route missing.

- [ ] **Step 3: Implement Worker route**

Import the listing helper in `cloudflare-pages-worker.mjs`:

```js
import { generateCreationListingDrafts } from "./lib/creation-listing-agent.mjs";
```

Add a Worker handler that reads `payload.set`, uses mock mode when configured by tests, and does not try to resolve local output files:

```js
async function handleCloudCreationListings(request, env) {
  const payload = await request.json().catch(() => ({}));
  const set = payload.set && typeof payload.set === "object" ? payload.set : null;
  if (!set?.setId) {
    return jsonResponse({ message: "Missing Creation set metadata." }, 400);
  }
  const mock = env.IMAGE_STUDIO_MOCK_LISTING_AGENT === "1" || payload.mock === true;
  const listingDrafts = await generateCreationListingDrafts({
    set,
    config: {
      baseUrl: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY || "",
      responsesModel: env.RESPONSES_MODEL || "gpt-5.5",
      reasoningEffort: env.REASONING_EFFORT || "medium",
    },
    mock,
  });
  return jsonResponse({ ok: true, set: { ...set, listingDrafts }, listingDrafts });
}
```

Add the route near other `/api/creation/*` routes.

- [ ] **Step 4: Run Worker tests**

Run:

```powershell
node --test test/cloudflare-pages-worker.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cloudflare-pages-worker.mjs test/cloudflare-pages-worker.test.mjs
git commit -m "Align worker creation listing route"
```

## Task 8: Documentation, OpenSpec Task Sync, And Verification

**Files:**
- Modify: `README.md`
- Modify: `openspec/changes/add-creation-listing-agent/tasks.md`

- [ ] **Step 1: Update README feature documentation**

Add a short paragraph under the Creation Mode workflow section:

```markdown
套图模式还可以选择在生成完成后自动撰写 Amazon US 英文 Listing。Listing Agent 会按 SKU 主体数量生成标题、卖点、痛点、五点描述、描述和关键词；如果生成图失败，会降级为基于商品输入、SKU 元数据、尺寸和类目路径撰写，并在草稿中标记为 input-only。每个字段和每条 bullet 都会限制在 500 字符以内。
```

- [ ] **Step 2: Mark OpenSpec tasks complete as each implementation section lands**

In `openspec/changes/add-creation-listing-agent/tasks.md`, only check the boxes for tasks actually completed in the previous commits. Do not mark verification complete until the commands in Step 3 pass.

- [ ] **Step 3: Run verification commands**

Run:

```powershell
node --test test/creation-listing-draft.test.mjs
node --test test/creation-listing-agent.test.mjs
node --test test/creation-store.test.mjs
node --test test/creation-e2e-regression.test.mjs
node --test test/studio-preview-layout.test.mjs
node --test test/cloudflare-pages-worker.test.mjs
cmd /c npm test
cmd /c npm run build:pages
cmd /c npx openspec validate add-creation-listing-agent --strict
node -e "const fs=require('fs');const path=require('path');const roots=['README.md','openspec/changes/add-creation-listing-agent','docs/superpowers/plans/2026-05-24-creation-listing-agent.md'];const markers=[0xfffd,0xc3,0xc2,0x6db5,0x934f,0x7a0b,0x9435,0x6fc2,0x7487,0x93c3,0x9286,0x20ac].map(String.fromCodePoint);const files=[];function walk(p){const st=fs.statSync(p);if(st.isDirectory()){for(const n of fs.readdirSync(p))walk(path.join(p,n));}else files.push(p);}for(const r of roots)walk(r);let found=false;for(const file of files){const text=fs.readFileSync(file,'utf8');text.split(/\r?\n/).forEach((line,i)=>{if(markers.some(m=>line.includes(m))){found=true;console.log(`${file}:${i+1}:${line}`);}});}process.exit(found?1:0);"
```

Expected:

- Each `node --test` command exits 0.
- `cmd /c npm test` exits 0.
- `cmd /c npm run build:pages` exits 0.
- OpenSpec reports `Change 'add-creation-listing-agent' is valid`.
- The mojibake scan exits 0 and prints no lines.

- [ ] **Step 4: Commit documentation and task sync**

```powershell
git add README.md openspec/changes/add-creation-listing-agent/tasks.md
git commit -m "Document creation listing agent"
```

- [ ] **Step 5: Request final review before merge**

Dispatch a read-only review agent with this brief:

```text
Review the creation listing agent implementation against openspec/changes/add-creation-listing-agent.
Check for: SKU count mapping, input-only fallback when images fail, 500-character field and bullet validation, title quantity/size ordering, manifest persistence, local API behavior, Worker route parity, UI copy/export actions, and tests.
Do not edit files. Return findings with file paths and line references.
```

Expected: no blocking findings. If blocking findings exist, fix them with focused commits and rerun Step 3.
