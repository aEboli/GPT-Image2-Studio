import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateCreationListingDrafts, requestCreationListingDraft } from "../lib/creation-listing-agent.mjs";
import { normalizeCreationListingDraft, sanitizeCreationListingBlockingClaims } from "../lib/creation-listing-draft.mjs";
import { listCreationListingPolicies } from "../lib/creation-listing-policies.mjs";
import { createCreationSetStore } from "../lib/creation-store.mjs";
import { buildCreationListingExportPayload } from "../lib/creation-listing-view.mjs";

const titleTranslations = {
  es: "2 señuelos de pesca azules",
  fr: "2 leurres de pêche bleus",
  it: "2 esche da pesca azzurre",
  pl: "2 niebieskie przynęty wędkarskie",
};
const payload = {
  title: "2 Pack Blue Fishing Lures",
  sellingPoints: ["Blue lures with a long body."],
  painPoints: ["This pack contains two blue lures."],
  fiveBullets: ["COLOR: Blue."],
  description: "Two blue lures with a long body.",
  backendSearchTerms: "blue lure",
  keywordBuckets: { exact: ["blue lure"], longTail: [], traffic: [], descriptive: [] },
  packageDimensions: "Estimated: 15 x 10 x 5 cm",
  productDimensions: "9 cm long",
  packageWeight: "Estimated: 350 g",
  productWeight: "Estimated: 250 g",
  deDisplay: { title: "2 Stück blaue Angelköder" },
  zhDisplay: { title: "2件装蓝色鱼饵" },
};

for (const endpointPath of ["/responses", "/chat/completions"]) {
  for (const contract of ["legacy", "v1", "v2"]) {
    test(`${contract} ${endpointPath} requests only four additional titles and preserves them through save/reload/export`, async () => {
      const outputDir = await mkdtemp(join(tmpdir(), "listing-title-languages-"));
      try {
        let calls = 0;
        const draft = await requestCreationListingDraft({
          baseUrl: "https://example.test/v1", endpointPath, apiKey: "test-key",
          source: {
            setId: "title-languages-set", productName: "Blue Fishing Lure", skuBundleCount: 2,
            dimensionSpecs: "9 cm", dimensionUnitMode: "metric",
            ...(contract === "legacy" ? {} : { platformId: "etsy", [contract === "v1" ? "forceV1" : "forceV2"]: true }),
          },
          fetchImpl: async (_url, init) => {
            calls += 1;
            const body = JSON.parse(init.body);
            const schema = body.text?.format.schema || body.response_format.json_schema.schema;
            assert.ok(schema.required.includes("titleTranslations"));
            const translations = schema.properties.titleTranslations;
            assert.equal(translations.type, "object");
            assert.equal(translations.additionalProperties, false);
            assert.deepEqual(translations.required, ["es", "fr", "it", "pl"]);
            assert.deepEqual(translations.properties, {
              es: { type: "string" }, fr: { type: "string" }, it: { type: "string" }, pl: { type: "string" },
            });
            assert.ok(schema.required.includes("deDisplay"));
            assert.ok(schema.required.includes("zhDisplay"));
            const prompt = body.input || body.messages[0].content;
            assert.match(prompt, /Spanish.*French.*Italian.*Polish/u);
            assert.match(prompt, /titleTranslations/u);
            assert.match(prompt, /title only/iu);
            return new Response(JSON.stringify({ output_text: JSON.stringify({ ...payload, titleTranslations }) }), { status: 200 });
          },
        });
        assert.equal(calls, 1);
        assert.deepEqual(draft.titleTranslations, titleTranslations);
        const store = createCreationSetStore({ outputDir });
        await store.saveManifest({ setId: "title-languages-set", productName: "Blue Fishing Lure", listingDrafts: [draft] });
        await store.saveManifest({ setId: "title-languages-set", productName: "Blue Fishing Lure" });
        const saved = await store.readManifest("title-languages-set");
        assert.deepEqual(saved.listingDrafts[0].titleTranslations, titleTranslations);
        assert.deepEqual(buildCreationListingExportPayload(saved).listingDrafts[0].titleTranslations, titleTranslations);
      } finally {
        await rm(outputDir, { recursive: true, force: true });
      }
    });
  }
}

test("every platform requests the additional title languages in its existing generation request", async () => {
  for (const policy of listCreationListingPolicies()) {
    let calls = 0;
    const drafts = await generateCreationListingDrafts({
      set: { setId: `title-languages-${policy.id}`, platformPolicyId: policy.id, productName: "Blue Fishing Lure" },
      config: { baseUrl: "https://example.test/v1", apiKey: "test-key" },
      fetchImpl: async (_url, init) => {
        calls += 1;
        const body = JSON.parse(init.body);
        assert.ok(body.text.format.schema.required.includes("titleTranslations"), policy.id);
        return new Response(JSON.stringify({ output_text: JSON.stringify({ ...payload, titleTranslations }) }), { status: 200 });
      },
    });
    assert.equal(calls, 1, policy.id);
    assert.deepEqual(drafts[0].titleTranslations, titleTranslations, policy.id);
  }
});

test("normalization preserves supported title strings without changing any other field", () => {
  for (const schemaVersion of ["", "2"]) {
    const source = { schemaVersion };
    const original = { ...payload, schemaVersion, id: "stable-id", createdAt: "2026-11-11T00:00:00Z" };
    const { titleTranslations: translations, ...rest } = normalizeCreationListingDraft({
      ...original, titleTranslations: { ...titleTranslations, ja: "ignored", description: "ignored" },
    }, source);
    assert.deepEqual(translations, titleTranslations);
    assert.deepEqual(rest, normalizeCreationListingDraft(original, source));
  }
  assert.equal(normalizeCreationListingDraft(payload).titleTranslations, undefined);
  for (const invalid of [null, [], "texto", { es: {}, fr: 42, it: [], pl: "  " }]) {
    assert.equal(normalizeCreationListingDraft({ ...payload, titleTranslations: invalid }).titleTranslations, undefined);
  }
  assert.deepEqual(normalizeCreationListingDraft({ ...payload, titleTranslations: { es: "  título  ", pl: "łódź" } }).titleTranslations,
    { es: "título", pl: "łódź" });
});

test("new title translations retain existing brand and blocking-claim cleanup", () => {
  for (const schemaVersion of ["", "2"]) {
    const normalized = normalizeCreationListingDraft({
      ...payload, schemaVersion,
      titleTranslations: Object.fromEntries(Object.entries(titleTranslations).map(([language, title]) => [language, `Acme ${title}`])),
    }, { brand: "Acme" });
    assert.deepEqual(normalized.titleTranslations, titleTranslations);
  }
  const cleaned = sanitizeCreationListingBlockingClaims({
    ...payload, titleTranslations: { ...titleTranslations, es: "FDA certified señuelos" },
  });
  assert.equal(cleaned.titleTranslations.es, "señuelos");
});

test("generated title translations remove internal part numbers without touching other fields", async () => {
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1", apiKey: "test-key",
    source: { productName: "Blue Fishing Lure", skuSubjects: [{ partNumber: "INTERNAL-941" }], skuBundleCount: 2 },
    fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify({
      ...payload,
      titleTranslations: Object.fromEntries(Object.entries(titleTranslations).map(([language, title]) => [language, `INTERNAL-941 ${title}`])),
    }) }), { status: 200 }),
  });
  assert.deepEqual(draft.titleTranslations, titleTranslations);
});

test("usable responses missing title translations remain completed with no extra translation request", async () => {
  for (const translations of [undefined, { pl: titleTranslations.pl }]) {
    let calls = 0;
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1", apiKey: "test-key", source: { productName: "Blue Fishing Lure" },
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ output_text: JSON.stringify({ ...payload,
          ...(translations ? { titleTranslations: translations } : {}),
        }) }), { status: 200 });
      },
    });
    assert.equal(calls, 1);
    assert.equal(draft.status, "completed");
    assert.deepEqual(draft.titleTranslations, translations);
  }
});
