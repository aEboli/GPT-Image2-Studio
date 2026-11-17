import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function createView({ files = [], set = null, job = null, draft = false } = {}) {
  const start = app.indexOf("let creationCardReferenceSnapshot =");
  const end = app.indexOf("\nfunction createCreationCard(", start);
  assert.ok(start >= 0 && end > start, "卡片应具有独立的参考图来源和分配处理");
  const revoked = [];
  let nextUrl = 0;
  const scope = {
    state: { creationReferenceFiles: files },
    getCreationDisplayedSet: () => set,
    getCreationQueueJobForSet: () => job,
    shouldUseCreationRepairDraftFiles: () => draft,
    isCreationLogoBatchBranch: () => false,
    URL: { createObjectURL: () => `blob:queue-${++nextUrl}`, revokeObjectURL: (url) => revoked.push(url) },
  };
  vm.createContext(scope);
  vm.runInContext(app.slice(start, end), scope);
  return { scope, revoked, select: (item, references) => JSON.parse(JSON.stringify(scope.getCreationCardReferences(item, references))) };
}

const references = [1, 2, 3].map((referenceIndex) => ({
  referenceIndex, filename: `${referenceIndex}.png`, previewUrl: `blob:${referenceIndex}`,
}));

test("卡片按冻结参考编号的顺序显示，不显示全部上传图片", () => {
  const view = createView();
  assert.deepEqual(view.select({ referenceSelection: { referenceIndexes: [3, 1] } }, references), [references[2], references[0]]);
  assert.deepEqual(view.select({ marketingAssignment: { referenceIndexes: [2] } }, references), [references[1]]);
});

test("实际请求的参考文件名优先于规划，明确无参考时不回退", () => {
  const view = createView();
  assert.deepEqual(view.select({ referenceImageNames: ["2.png"], referenceSelection: { referenceIndexes: [1] } }, references), [references[1]]);
  assert.deepEqual(view.select({ hasReferenceImage: false, referenceSelection: { referenceIndexes: [1] } }, references), []);
  assert.deepEqual(view.select({ referenceSelection: { referenceIndexes: [] }, marketingAssignment: { referenceIndexes: [1] } }, references), []);
});

test("缺失编号和重复分配不产生错误缩略图，SKU 和信息图保持各自来源", () => {
  const view = createView();
  assert.deepEqual(view.select({ referenceSelection: { referenceIndexes: [4, 2, 2] } }, references), [references[1]]);
  assert.deepEqual(view.select({ role: "sku", skuSubject: { referenceIndexes: [3] } }, references), [references[2]]);
  assert.deepEqual(view.select({ role: "infographic-rebuild", sourceInfographic: { index: 2, filename: "2.png" } }, references), [references[1]]);
  assert.deepEqual(view.select({}, references), []);
});

test("草稿按保存的名称匹配来源，重新排序的当前上传图不会错位", () => {
  const files = [3, 1, 2].map((index) => ({ file: { name: `${index}.png` }, previewUrl: `blob:${index}` }));
  const view = createView({ files, draft: true, set: { setId: "draft", referenceImageNames: ["1.png", "2.png", "missing.png"] } });
  const actual = view.scope.getCreationCardReferenceFiles();
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), references.slice(0, 2));
});

test("队列使用自身上传快照，切换时释放旧预览并拒绝借用当前上传图", () => {
  const uploads = [{ name: "queue.png" }];
  const job = { formData: { getAll: () => uploads } };
  const view = createView({ files: [{ file: { name: "other.png" }, previewUrl: "blob:other" }], set: { setId: "saved" }, job });
  const first = view.scope.getCreationCardReferenceFiles();
  assert.equal(first[0].filename, "queue.png");
  assert.equal(first[0].previewUrl, "blob:queue-1");
  assert.equal(view.scope.getCreationCardReferenceFiles(), first);
  job.formData = { getAll: () => [{ name: "second.png" }] };
  assert.equal(view.scope.getCreationCardReferenceFiles()[0].filename, "second.png");
  assert.deepEqual(view.revoked, ["blob:queue-1"]);
  view.scope.getCreationQueueJobForSet = () => null;
  assert.deepEqual(JSON.parse(JSON.stringify(view.scope.getCreationCardReferenceFiles())), []);
  assert.deepEqual(view.revoked, ["blob:queue-1", "blob:queue-2"]);
});

test("产物卡片移除逐图补图按钮，参考图不受生成详情隐藏影响", () => {
  const card = app.slice(app.indexOf("function createCreationCard("), app.indexOf("\nfunction syncCreationResultGrid("));
  assert.doesNotMatch(card, /creationRetryItemId|creation-card-actions/);
  assert.match(card, /if \(!showRecordActions\) syncCreationCardReferences\(card, item, options\.referenceFiles\);/);
  assert.match(app, /syncCreationCardReferences\(target, item, referenceFiles\)/);
});
