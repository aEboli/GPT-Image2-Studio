import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { CREATION_PLATFORM_OPTIONS } from "../lib/creation-platform-policies.mjs";
import { createCreationQueueJob } from "../lib/creation-suite-queue.mjs";
import { createCreationListingController } from "../lib/creation-listing-view.mjs";

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

test("all selected Creation platforms enable manual Listing while missing and active records stay disabled", () => {
  assert.equal(CREATION_PLATFORM_OPTIONS.length, 19);
  for (const platform of [...CREATION_PLATFORM_OPTIONS.map((option) => option.value), ""]) {
    const set = { setId: platform || "legacy", platform, productName: `${platform || "legacy"} product` };
    const refs = { creationRecordGenerateListingsButton: makeButton() };
    const controller = createCreationListingController({ refs, state: makeState(set) });

    controller.syncRecordControls(set);

    assert.equal(refs.creationRecordGenerateListingsButton.disabled, false, platform || "legacy");
    assert.equal(refs.creationRecordGenerateListingsButton.title, "", platform || "legacy");
  }

  const emptyRefs = { creationRecordGenerateListingsButton: makeButton() };
  createCreationListingController({ refs: emptyRefs, state: makeState(null) }).syncRecordControls(null);
  assert.equal(emptyRefs.creationRecordGenerateListingsButton.disabled, true);

  const busySet = { setId: "busy-temu", platform: "temu", productName: "Busy Temu product" };
  const busyRefs = { creationRecordGenerateListingsButton: makeButton() };
  const busyState = makeState(busySet);
  busyState.creation.listingGeneratingSetId = busySet.setId;
  createCreationListingController({ refs: busyRefs, state: busyState }).syncRecordControls(busySet);
  assert.equal(busyRefs.creationRecordGenerateListingsButton.disabled, true);
});

test("completed universal records keep manual Listing generation enabled", () => {
  const set = {
    setId: "universal-completed",
    platform: "universal",
    platformProvenance: "explicit",
    productName: "Universal product",
    status: "completed",
    items: Array.from({ length: 15 }, (_, index) => ({
      itemId: `item-${index + 1}`,
      status: "completed",
    })),
  };
  const refs = {
    creationRecordGenerateListingsButton: makeButton(),
    creationRecordCopyListingsButton: makeButton(),
    creationRecordExportListingsButton: makeButton(),
  };
  const controller = createCreationListingController({ refs, state: makeState(set) });

  controller.syncRecordControls(set);

  assert.equal(refs.creationRecordGenerateListingsButton.disabled, false);
  assert.equal(refs.creationRecordGenerateListingsButton.textContent, "生成 Listing");
  assert.equal(refs.creationRecordGenerateListingsButton.title, "");
});

test("specific platform records use the existing Listing generation, copy, and export flow", async () => {
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
  let selectedSet = set;
  const controller = createCreationListingController({
    refs,
    state: makeState(set),
    getSelectedSet: () => selectedSet,
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({
        ok: true,
        set: {
          ...set,
          listingDrafts: [{
            id: "etsy-regenerated",
            title: "1 Pack Regenerated Etsy Draft",
            marketplace: "amazon-us",
            packageDimensions: "Estimated: 6 x 4 x 2 in",
            productDimensions: "Estimated: 4 x 2 x 1 in",
            packageWeight: "Estimated: 12.35 oz",
            productWeight: "Estimated: 8.82 oz",
            zhDisplay: {
              packageDimensions: "预估：6 x 4 x 2 英寸",
              productDimensions: "预估：4 x 2 x 1 英寸",
              packageWeight: "预估：12.35 盎司",
              productWeight: "预估：8.82 盎司",
            },
          }],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    writeTextToClipboard: async (value) => { copied = value; },
    downloadTextFile: (value) => { exported = value; },
    setFeedback() {},
    upsertSet: (nextSet) => {
      selectedSet = nextSet;
      return nextSet;
    },
  });

  controller.syncRecordControls(set);
  assert.equal(refs.creationRecordGenerateListingsButton.disabled, false);
  assert.equal(refs.creationRecordGenerateListingsButton.title, "");
  assert.equal(refs.creationRecordCopyListingsButton.disabled, false);
  assert.equal(refs.creationRecordExportListingsButton.disabled, false);
  const nextSet = await controller.generate();
  assert.equal(fetchCount, 1);
  assert.equal(nextSet.listingDrafts[0].title, "1 Pack Regenerated Etsy Draft");
  await controller.copy();
  controller.exportListings();
  assert.match(copied, /Regenerated Etsy Draft/);
  assert.match(exported, /Regenerated Etsy Draft/);
});

test("local Listing endpoint has no platform eligibility gate", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const handler = server.match(/async function handleCreationListingsGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handlePortraitSetsGet/)?.[0] || "";
  assert.doesNotMatch(handler, /CreationListingEligibility|marketplace eligibility gate/i);
  assert.match(handler, /mergeRequestPrivateConfig/);
});

test("current-platform automatic Listing controls have no platform eligibility gate", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /CreationListingEligibility/);
  assert.match(app, /creationListingAgentEnabledInput\.disabled\s*=\s*false/);
  assert.match(app, /function shouldAutoGenerateCreationListings\([^)]*\)[\s\S]*return Boolean\(listingAgentEnabled\)/);
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
