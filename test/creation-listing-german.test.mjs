import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { requestCreationListingDraft, generateCreationListingDrafts } from "../lib/creation-listing-agent.mjs";
import { normalizeCreationListingDraft, sanitizeCreationListingBlockingClaims } from "../lib/creation-listing-draft.mjs";
import { listCreationListingPolicies } from "../lib/creation-listing-policies.mjs";
import { createCreationSetStore } from "../lib/creation-store.mjs";
import { buildCreationListingExportPayload } from "../lib/creation-listing-view.mjs";
import { sanitizeCreationListingNoBrandContent } from "../lib/creation-listing-content-gate.mjs";

const german = {
  title: "2 Stück blaue Angelköder",
  sellingPoints: ["Blaue Köder mit länglichem Körper."],
  painPoints: ["Die Packung enthält zwei blaue Köder."],
  fiveBullets: ["FARBE: Blau."],
  description: "Zwei blaue Köder mit länglichem Körper und größerer Öse.",
  backendSearchTerms: "angelköder blau öse süßwasser",
  keywordBuckets: {
    exact: ["blaue Angelköder"], longTail: ["Köder mit Öse"], traffic: ["Angelzubehör"], descriptive: ["länglicher Körper"],
  },
  packageDimensions: "Geschätzt: 15 x 10 x 5 cm",
  productDimensions: "9 cm Länge",
  packageWeight: "Geschätzt: 350 g",
  productWeight: "Geschätzt: 250 g",
  warnings: [],
  missingInfo: [],
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
  deDisplay: german,
  zhDisplay: { title: "2件装蓝色鱼饵" },
};

for (const endpointPath of ["/responses", "/chat/completions"]) {
  for (const contract of ["legacy", "v1", "v2"]) {
    test(`${contract} ${endpointPath} requests German and preserves translations through save/reload/export`, async () => {
      const rootDir = await mkdtemp(join(tmpdir(), "listing-german-"));
      try {
        const calls = [];
        const draft = await requestCreationListingDraft({
          baseUrl: "https://example.test/v1", endpointPath, apiKey: "test-key",
          source: {
            setId: "german-set", productName: "Blue Fishing Lure", skuBundleCount: 2,
            dimensionSpecs: "9 cm", dimensionUnitMode: "metric",
            ...(contract === "legacy" ? {} : { platformId: "etsy", ...(contract === "v1" ? { forceV1: true } : { forceV2: true }) }),
          },
          fetchImpl: async (_url, init) => {
            const body = JSON.parse(init.body);
            calls.push(body);
            const schema = body.text?.format.schema || body.response_format.json_schema.schema;
            assert.ok(schema.required.includes("deDisplay"));
            const display = schema.properties.deDisplay;
            assert.deepEqual([...display.required].sort(), Object.keys(display.properties).sort());
            assert.ok(display.required.includes("packageWeight"));
            assert.ok(display.required.includes("missingInfo"));
            assert.equal(display.additionalProperties, false);
            const prompt = body.input || body.messages[0].content;
            assert.match(prompt, /natural German reference translation/u);
            assert.match(prompt, /Geschätzt:/u);
            return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { status: 200 });
          },
        });
        assert.equal(calls.length, 1);
        const expectedGerman = contract === "legacy" ? german : sanitizeCreationListingNoBrandContent(german);
        for (const [key, value] of Object.entries(expectedGerman)) assert.deepEqual(draft.deDisplay[key], value, key);
        const store = createCreationSetStore({ outputDir: rootDir });
        await store.saveManifest({ setId: "german-set", productName: "Blue Fishing Lure", listingDrafts: [draft] });
        await store.saveManifest({ setId: "german-set", productName: "Blue Fishing Lure" });
        const saved = await store.readManifest("german-set");
        assert.deepEqual(saved.listingDrafts[0].deDisplay, draft.deDisplay);
        const exported = buildCreationListingExportPayload(saved);
        for (const [key, value] of Object.entries(expectedGerman)) assert.deepEqual(exported.listingDrafts[0].deDisplay[key], value, key);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    });
  }
}

test("every platform Listing generation includes the complete German schema", async () => {
  const policies = listCreationListingPolicies();
  assert.ok(policies.length >= 19);
  for (const policy of policies) {
    const drafts = await generateCreationListingDrafts({
      set: { setId: `german-${policy.id}`, platformPolicyId: policy.id, productName: "Blue Fishing Lure" },
      config: { baseUrl: "https://example.test/v1", apiKey: "test-key" },
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        assert.ok(body.text.format.schema.required.includes("deDisplay"), policy.id);
        return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { status: 200 });
      },
    });
    assert.equal(drafts[0].deDisplay.description, sanitizeCreationListingNoBrandContent(german.description), policy.id);
  }
});

test("German aliases normalize and forbidden brands are removed without damaging umlauts", () => {
  const draft = normalizeCreationListingDraft({
    ...payload, schemaVersion: "2", deDisplay: undefined,
    de_display: { ...german, title: "Acme Größe süß", selling_points: ["Öse"], sellingPoints: undefined },
  }, { brand: "Acme" });
  assert.equal(draft.deDisplay.title, "Größe süß");
  assert.deepEqual(draft.deDisplay.sellingPoints, ["Öse"]);
  assert.equal(normalizeCreationListingDraft({ title: "Historical" }).deDisplay, undefined);
});

test("claim cleanup removes matching German rows with removed source rows", () => {
  const draft = sanitizeCreationListingBlockingClaims({
    ...payload, sellingPoints: ["FDA certified", "Blue body"],
    deDisplay: { ...german, sellingPoints: ["FDA zertifiziert", "Blauer Körper"] },
  });
  assert.deepEqual(draft.sellingPoints, ["Blue body"]);
  assert.deepEqual(draft.deDisplay.sellingPoints, ["Blauer Körper"]);
});
