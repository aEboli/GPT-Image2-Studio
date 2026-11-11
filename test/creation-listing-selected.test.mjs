import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "parse5";

import { createCreationListingController } from "../lib/creation-listing-view.mjs";

function selectedListingHarness(count = 6) {
  const sets = Array.from({ length: count }, (_, index) => ({
    setId: `selected-${index}`,
    listingDrafts: index % 2 ? [] : [{ title: `Original ${index}` }],
  }));
  const state = { creation: { sets, recordSetId: sets[0].setId, recordCheckedSetIds: [] } };
  const requests = [];
  const pending = new Map();
  const feedback = [];
  let peak = 0;
  const context = {
    refs: {}, state,
    getSelectedSet: () => state.creation.sets.find((set) => set.setId === state.creation.recordSetId),
    setFeedback: (message, type) => feedback.push({ message, type }),
    upsertSet: (set) => {
      state.creation.sets = state.creation.sets.map((entry) => entry?.setId === set.setId ? set : entry);
      return set;
    },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body.setId);
      return new Promise((resolve) => {
        pending.set(body.setId, resolve);
        peak = Math.max(peak, pending.size);
      });
    },
  };
  const settle = async (setId, error) => {
    const resolve = pending.get(setId);
    assert.ok(resolve, `No pending request for ${setId}`);
    pending.delete(setId);
    resolve(error
      ? Response.json({ ok: false, ...error }, { status: error.httpStatus || 500 })
      : Response.json({ set: { setId, listingDrafts: [{ title: `New ${setId}` }] } }));
    await new Promise(setImmediate);
  };
  const drain = async () => {
    while (pending.size) await settle(pending.keys().next().value);
  };
  return { context, state, requests, pending, feedback, settle, drain, get peak() { return peak; } };
}

test("selected Listing generates checked saved and missing records without touching unchecked drafts", async () => {
  const h = selectedListingHarness();
  const untouched = h.state.creation.sets[2];
  h.state.creation.recordCheckedSetIds = ["selected-0", "selected-1"];
  const run = createCreationListingController(h.context).generateSelected();
  await h.drain();
  const result = await run;
  assert.deepEqual(h.requests, ["selected-0", "selected-1"]);
  assert.equal(result.generatedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.equal(h.state.creation.sets[0].listingDrafts[0].title, "New selected-0");
  assert.equal(h.state.creation.sets[1].listingDrafts[0].title, "New selected-1");
  assert.equal(h.state.creation.sets[2], untouched);
});

test("selected Listing never falls back to the current record or all records", async () => {
  for (const checked of [undefined, [], ["deleted"], ["selected-0"]]) {
    const h = selectedListingHarness();
    h.state.creation.recordCheckedSetIds = checked;
    h.state.creation.listingGeneratingSetIds = ["selected-0"];
    const result = await createCreationListingController(h.context).generateSelected();
    assert.equal(result.totalCount, 0);
    assert.deepEqual(h.requests, []);
    assert.match(h.feedback.at(-1).message, /勾选/u);
  }
});

test("selected Listing deduplicates valid checked ids and skips active and invalid records", async () => {
  const h = selectedListingHarness();
  h.state.creation.sets.push(null, {}, h.state.creation.sets[0]);
  h.state.creation.recordCheckedSetIds = ["selected-0", "selected-0", "selected-1", "deleted", ""];
  h.state.creation.listingGeneratingSetIds = ["selected-1"];
  const run = createCreationListingController(h.context).generateSelected();
  await h.drain();
  assert.equal((await run).generatedCount, 1);
  assert.deepEqual(h.requests, ["selected-0"]);
});

test("selected Listing freezes checked scope, regenerates queued saved drafts and caps workers at three", async () => {
  const h = selectedListingHarness();
  h.state.creation.recordCheckedSetIds = ["selected-0", "selected-1", "selected-2", "selected-3", "selected-4"];
  const controller = createCreationListingController(h.context);
  const run = controller.generateSelected();
  assert.equal(h.pending.size, 3);
  const duplicate = await controller.generateMissing();
  assert.equal(duplicate.totalCount, 5);
  h.state.creation.recordCheckedSetIds = ["selected-5"];
  h.state.creation.recordSetId = "selected-5";
  h.state.creation.sets[3].listingDrafts = [{ title: "Saved while queued" }];
  await h.drain();
  const result = await run;
  assert.deepEqual(h.requests, ["selected-0", "selected-1", "selected-2", "selected-3", "selected-4"]);
  assert.equal(h.peak, 3);
  assert.equal(result.generatedCount, 5);
  assert.equal(h.state.creation.recordSetId, "selected-5");
  assert.equal(h.state.creation.listingBatchGenerating, false);
});

test("selected Listing retains old drafts on ordinary failure and attempts later checked records", async () => {
  const h = selectedListingHarness();
  const original = h.state.creation.sets[0].listingDrafts;
  h.state.creation.recordCheckedSetIds = h.state.creation.sets.map((set) => set.setId);
  const run = createCreationListingController(h.context).generateSelected();
  assert.equal(h.state.creation.sets[0].listingDrafts, original);
  await h.settle("selected-0", { message: "Generation failed" });
  await h.drain();
  const result = await run;
  assert.equal(h.state.creation.sets[0].listingDrafts, original);
  assert.equal(result.failedCount, 1);
  assert.equal(result.generatedCount, 5);
  assert.equal(h.requests.length, 6);
});

test("selected Listing stops taking new records after account failure and settles active work", async () => {
  const h = selectedListingHarness();
  h.state.creation.recordCheckedSetIds = h.state.creation.sets.map((set) => set.setId);
  const run = createCreationListingController(h.context).generateSelected();
  await h.settle("selected-0", { message: "No quota", errorKind: "quota" });
  await h.drain();
  const result = await run;
  assert.equal(result.stopped, true);
  assert.equal(result.unstartedCount, 3);
  assert.equal(result.generatedCount, 2);
  assert.equal(h.requests.length, 3);
});

test("selected Listing menu state tracks checked records, existing drafts and mutation locks", () => {
  const h = selectedListingHarness();
  const selected = {};
  const missing = {};
  h.context.refs = { creationRecordGenerateSelectedListingsButton: selected, creationRecordGenerateMissingListingsButton: missing };
  const controller = createCreationListingController(h.context);
  const sync = () => controller.syncRecordControls(null);
  sync();
  assert.equal(selected.disabled, true);
  h.state.creation.recordCheckedSetIds = ["selected-0", "selected-0", "deleted"];
  sync();
  assert.equal(selected.disabled, false);
  assert.equal(selected.textContent, "生成 Listing");
  assert.match(selected.title, /1/u);
  h.state.creation.sets = [h.state.creation.sets[0]];
  sync();
  assert.equal(selected.disabled, false);
  assert.equal(missing.disabled, true);
  for (const key of ["listingBatchGenerating", "recordTemuExportBusy", "recordDeleteBusy"]) {
    h.state.creation[key] = true;
    sync();
    assert.equal(selected.disabled, true, key);
    h.state.creation[key] = false;
  }
  h.state.creation.listingGeneratingSetIds = ["selected-0"];
  sync();
  assert.equal(selected.disabled, true);
});

test("selected Listing menu click generates checked records through the bound listener", async () => {
  const h = selectedListingHarness();
  const handlers = new Map();
  h.context.refs.creationRecordGenerateSelectedListingsButton = { addEventListener: (name, handler) => handlers.set(name, handler) };
  h.state.creation.recordCheckedSetIds = ["selected-0"];
  createCreationListingController(h.context).bindEvents();
  assert.equal(typeof handlers.get("click"), "function");
  handlers.get("click")();
  await h.drain();
  assert.deepEqual(h.requests, ["selected-0"]);
  assert.equal(h.state.creation.listingBatchGenerating, false);
});

test("selected Listing HTML button stays inside the More menu at every viewport", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);
  const matches = [];
  const visit = (node, ancestors = []) => {
    if (node.attrs?.some(({ name, value }) => name === "id" && value === "creationRecordGenerateSelectedListingsButton")) matches.push({ node, ancestors });
    node.childNodes?.forEach((child) => visit(child, [...ancestors, node]));
  };
  visit(parse(html));
  assert.equal(matches.length, 1);
  const { node, ancestors } = matches[0];
  assert.equal(node.tagName, "button");
  assert.equal(node.childNodes[0].value.trim(), "生成 Listing");
  assert.ok(ancestors.some((entry) => entry.tagName === "details" && entry.attrs.some(({ name }) => name === "data-asset-menu")));
  assert.ok(!ancestors.some((entry) => entry.attrs?.some(({ name, value }) => name === "class" && /creation-record-(?:mobile|desktop)-actions/u.test(value))));
  assert.match(app, /creationRecordGenerateSelectedListingsButton: document\.querySelector\("#creationRecordGenerateSelectedListingsButton"\)/u);
});
