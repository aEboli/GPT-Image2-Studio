import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { handleApiRequest } from "../cloudflare-pages-worker.mjs";
import { createCreationQueueJob } from "../lib/creation-suite-queue.mjs";
import {
  createCreationListingController,
  getCreationListingEligibility,
} from "../lib/creation-listing-view.mjs";

function makeButton() {
  return {
    disabled: false,
    textContent: "",
    className: "",
    children: [],
    classList: { add() {}, toggle() {} },
    replaceChildren(...children) { this.children = children; },
  };
}

function makeState(set) {
  return { creation: { listingGeneratingSetId: "", listingGeneratingSetIds: [], sets: [set] } };
}

test("Listing eligibility accepts explicit Amazon and legacy-missing but rejects explicit universal", () => {
  assert.deepEqual(getCreationListingEligibility({ platform: "amazon", platformProvenance: "explicit" }), {
    eligible: true,
    reason: "amazon",
  });
  assert.deepEqual(getCreationListingEligibility({ platform: "universal", platformProvenance: "legacy-missing" }), {
    eligible: true,
    reason: "legacy-missing",
  });
  assert.deepEqual(getCreationListingEligibility({ productName: "Legacy product" }), {
    eligible: true,
    reason: "legacy-missing",
  });
  assert.deepEqual(getCreationListingEligibility({ platform: "universal", platformProvenance: "explicit" }), {
    eligible: false,
    reason: "non-amazon",
  });
  assert.equal(getCreationListingEligibility({ platform: "etsy" }).eligible, false);
});

test("non-Amazon records disable generation while preserving historical draft copy and export", async () => {
  const set = {
    setId: "etsy-history",
    platform: "etsy",
    platformProvenance: "explicit",
    productName: "Historical Etsy product",
    listingDrafts: [{ id: "amazon-draft", title: "Saved Amazon US Draft", marketplace: "amazon-us" }],
  };
  const refs = {
    creationRecordGenerateListingsButton: makeButton(),
    creationRecordCopyListingsButton: makeButton(),
    creationRecordExportListingsButton: makeButton(),
  };
  let fetchCount = 0;
  let copied = "";
  let exported = "";
  const controller = createCreationListingController({
    refs,
    state: makeState(set),
    getSelectedSet: () => set,
    fetchImpl: async () => { fetchCount += 1; throw new Error("must not fetch"); },
    writeTextToClipboard: async (value) => { copied = value; },
    downloadTextFile: (value) => { exported = value; },
    setFeedback() {},
  });

  controller.syncRecordControls(set);
  assert.equal(refs.creationRecordGenerateListingsButton.disabled, true);
  assert.match(refs.creationRecordGenerateListingsButton.title, /Amazon US/i);
  assert.equal(refs.creationRecordCopyListingsButton.disabled, false);
  assert.equal(refs.creationRecordExportListingsButton.disabled, false);
  await assert.rejects(controller.generate(), /Amazon US/i);
  assert.equal(fetchCount, 0);
  await controller.copy();
  controller.exportListings();
  assert.match(copied, /Saved Amazon US Draft/);
  assert.match(exported, /Saved Amazon US Draft/);
  assert.equal(set.listingDrafts.length, 1);
});

test("Cloudflare Listing endpoint allows Amazon and legacy records but rejects non-Amazon before upstream", async () => {
  for (const set of [
    { setId: "amazon-explicit", platform: "amazon", platformProvenance: "explicit", productName: "Bottle", items: [] },
    { setId: "legacy", productName: "Bottle", items: [] },
  ]) {
    const response = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mock: true, set }),
    }), { env: { IMAGE_STUDIO_MOCK_LISTING_AGENT: "1" } });
    assert.equal(response.status, 200, `${set.setId} should be eligible`);
  }

  for (const set of [
    { setId: "etsy-explicit", platform: "etsy", platformProvenance: "explicit", listingDrafts: [{ title: "keep" }] },
    { setId: "universal-explicit", platform: "universal", platformProvenance: "explicit" },
  ]) {
    let fetchCount = 0;
    const response = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "unused", set }),
    }), { async fetchImpl() { fetchCount += 1; throw new Error("must not fetch"); } });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.message, /Amazon US/i);
    assert.equal(fetchCount, 0);
    assert.deepEqual(set.listingDrafts, set.listingDrafts);
  }
});

test("local Listing endpoint checks shared eligibility before API configuration", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const handler = server.match(/async function handleCreationListingsGenerate[\s\S]*?\n}\n\nasync function handlePortraitSetsGet/)?.[0] || "";
  assert.match(handler, /getCreationListingEligibility\(set\)/);
  assert.ok(handler.indexOf("getCreationListingEligibility(set)") < handler.indexOf("mergeRequestPrivateConfig"));
  assert.match(handler, /Amazon US/);
});

test("current-platform automatic Listing control is restricted to Amazon US scope", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /getCreationListingEligibility/);
  assert.match(app, /creationListingAgentEnabledInput\.disabled\s*=\s*!listingEligibility\.eligible/);
  assert.match(app, /function shouldAutoGenerateCreationListings\([^)]*\)[\s\S]*getCreationListingEligibility/);
});

test("queued automatic Listing uses the completed set and frozen queue switch", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /function shouldAutoGenerateCreationListings\(completedSet = getCreationCurrentSet\(\), queueJob = null\)/);
  assert.match(app, /queueJob\?\.listingAgentEnabled[\s\S]*completedSet\?\.listingAgentEnabled/);
  assert.match(app, /shouldAutoGenerateCreationListings\(completedSet, context\.queueJob\)/);
  assert.match(app, /listingAgentEnabled: Boolean\(refs\.creationListingAgentEnabledInput\?\.checked\)/);
});

test("queue jobs freeze the Listing switch outside normalized set payloads", () => {
  const sourceSet = { setId: "amazon-queued", platform: "amazon", listingAgentEnabled: true };
  const job = createCreationQueueJob({
    creationState: { queue: [] },
    formData: new FormData(),
    set: sourceSet,
    normalizeSet: ({ listingAgentEnabled: _discarded, ...set }) => set,
    nowIso: () => "2026-07-12T00:00:00.000Z",
    idFactory: () => "queue-listing",
  });
  sourceSet.listingAgentEnabled = false;
  assert.equal(job.listingAgentEnabled, true);
  assert.equal(job.set.listingAgentEnabled, undefined);
});
