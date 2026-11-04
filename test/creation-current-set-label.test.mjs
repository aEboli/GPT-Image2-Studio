import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = app.indexOf("function renderCreationCurrentSet() {");
const end = app.indexOf("\nfunction renderCreationQueueStrip()", start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);
const renderFunction = app.slice(start, end);

function createView({ jobs = [], selectedJob = null, currentSet = null, logoBatch = false } = {}) {
  const badge = { textContent: "", hidden: true, title: "" };
  const scope = {
    refs: { creationCurrentSet: badge },
    state: { creation: { currentSet } },
    isCreationLogoBatchBranch: () => logoBatch,
    getSelectedCreationQueueJob: () => selectedJob,
    getCreationQueueJobs: () => jobs,
    isCreationDraftSet: (set) => Boolean(set?.draft),
  };
  vm.createContext(scope);
  vm.runInContext(renderFunction, scope);
  return { badge, render: scope.renderCreationCurrentSet };
}

test("batch label follows the selected set and its saved marketing coordinates", () => {
  const job = {
    set: { productName: "多节仿生路亚" },
    marketingBatch: { schemeIndex: 2, schemeTotal: 3, copyNumber: 1, copyTotal: 2 },
  };
  const view = createView({
    jobs: [{ set: { productName: "另一个商品" } }, job],
    selectedJob: job,
    currentSet: { productName: "未选中的商品" },
  });

  view.render();

  assert.equal(view.badge.textContent, "当前：多节仿生路亚 · 方案 2/3 · 第 1/2 套");
  assert.equal(view.badge.title, "多节仿生路亚");
  assert.equal(view.badge.hidden, false);
});

test("ordinary queue label uses the selected job's current queue position", () => {
  const first = { set: { productName: "一号商品" } };
  const selected = { set: { productName: "二号商品" } };
  const view = createView({ jobs: [first, selected], selectedJob: selected });

  view.render();

  assert.equal(view.badge.textContent, "当前：二号商品 · 第 2/2 套");
});

test("existing sets show a name while drafts and the logo branch hide the label", () => {
  const empty = createView();
  empty.render();
  assert.equal(empty.badge.hidden, true);

  const existing = createView({ currentSet: { productName: "  " } });
  existing.render();
  assert.equal(existing.badge.textContent, "当前：未命名商品");

  const draft = createView({ currentSet: { productName: "草稿商品", draft: true } });
  draft.render();
  assert.equal(draft.badge.hidden, true);

  const logoJob = { set: { productName: "加 Logo" } };
  const logo = createView({ jobs: [logoJob], selectedJob: logoJob, logoBatch: true });
  logo.render();
  assert.equal(logo.badge.hidden, true);
});
