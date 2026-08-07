import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CREATION_TEMU_EXPORT_FIELD_NAMES,
  CREATION_TEMU_EXPORT_STORAGE_KEY,
  createCreationTemuExportController,
  getTemuExportFilename,
} from "../public/lib/creation-temu-export-ui.mjs";

function createElement({ disabled = false, textContent = "" } = {}) {
  const listeners = new Map();
  return {
    disabled,
    textContent,
    hidden: false,
    children: [],
    dataset: {},
    isConnected: true,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      for (const handler of listeners.get(type) || []) handler({ target: this, preventDefault() {}, ...event });
    },
    focus() {
      this.focused = true;
    },
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
  };
}

function createTemuExportDom({ values = {} } = {}) {
  const fields = new Map();
  const defaultValues = Object.fromEntries(CREATION_TEMU_EXPORT_FIELD_NAMES.map((name) => [name, name === "variantAttributeName" ? "颜色" : ""]));
  Object.assign(defaultValues, values);
  for (const [name, value] of Object.entries(defaultValues)) {
    fields.set(name, { value: String(value) });
  }
  const modeControl = { value: "draft" };
  const form = createElement();
  form.elements = { namedItem: (name) => name === "mode" ? modeControl : fields.get(name) || null };
  form.reportValidity = () => true;
  form.reset = () => {
    for (const [name, field] of fields) field.value = name === "variantAttributeName" ? "颜色" : "";
    modeControl.value = "draft";
  };

  const dialog = createElement();
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatch("close");
  };

  const controls = {
    creationRecordExportTemuButton: createElement(),
    creationRecordTemuExportCancelButton: createElement(),
    creationRecordTemuExportCloseButton: createElement(),
    creationRecordTemuExportDialog: dialog,
    creationRecordTemuExportFeedback: createElement(),
    creationRecordTemuExportFields: createElement(),
    creationRecordTemuExportForm: form,
    creationRecordTemuPreflightButton: createElement(),
    creationRecordTemuPreflightState: createElement(),
    creationRecordTemuProblemPanel: createElement(),
    creationRecordTemuStrictReason: createElement(),
    creationRecordTemuStrictMode: createElement({ disabled: true }),
    creationRecordTemuTemplateName: createElement(),
    creationRecordTemuBlockerList: createElement(),
    creationRecordTemuWarningList: createElement(),
    creationRecordTemuRecordSummary: createElement(),
    creationRecordTemuRecordList: createElement(),
    creationRecordTemuStatSetCount: createElement(),
    creationRecordTemuStatSkuCount: createElement(),
    creationRecordTemuStatImageCount: createElement(),
    creationRecordTemuStatPendingUploadCount: createElement(),
    creationRecordTemuStatUploadedCount: createElement(),
    creationRecordTemuStatCacheReuseCount: createElement(),
    creationRecordTemuStatBlockerCount: createElement(),
    creationRecordTemuStatWarningCount: createElement(),
    creationRecordSearchInput: createElement(),
    creationRecordSetList: createElement(),
    creationRecordTemuExportSelectedCount: createElement(),
    creationRecordTemuExportSubmitButton: createElement(),
  };
  const downloads = [];
  const documentRef = {
    activeElement: createElement(),
    body: { appendChild: (element) => downloads.push(element) },
    createElement() {
      const link = createElement();
      link.remove = () => {};
      link.click = () => {
        link.clicked = true;
      };
      return link;
    },
    querySelector(selector) {
      const id = selector.slice(1);
      return controls[id] || null;
    },
  };
  return { controls, documentRef, downloads, fields, modeControl };
}

class FakeFormData {
  constructor(form) {
    this.fields = form.elements;
  }

  get(name) {
    return this.fields.namedItem(name)?.value || "";
  }
}

function createBrowserWindow() {
  const storage = new Map();
  return {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    setTimeout(callback) {
      callback();
      return 0;
    },
    storage,
  };
}

test("Temu export controller filters stale selections, sends only approved fields, and downloads the workbook", async () => {
  const dom = createTemuExportDom({
    defaultPrice: "19.99",
    defaultStock: "20",
    cloudName: "demo-cloud",
    uploadPreset: "temu_unsigned",
  });
  const windowRef = createBrowserWindow();
  const state = {
    creation: {
      sets: [{ setId: "set-a" }, { setId: "set-b" }],
      recordCheckedSetIds: ["missing", "set-a", "set-a", "set-b"],
      recordTemuExportBusy: false,
    },
  };
  const feedback = [];
  const rendered = [];
  const fetchRequests = [];
  const revoked = [];
  dom.controls.creationRecordSetList.scrollTop = 137;
  dom.controls.creationRecordSetList.scrollLeft = 23;
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    setRecordFeedback: (...args) => feedback.push(args),
    renderRecordView: () => {
      rendered.push(state.creation.recordTemuExportBusy);
      dom.controls.creationRecordSetList.scrollTop = 0;
      dom.controls.creationRecordSetList.scrollLeft = 0;
    },
    compactErrorMessage: (message) => message,
    documentRef: dom.documentRef,
    windowRef,
    FormDataCtor: FakeFormData,
    urlApi: {
      createObjectURL: () => "blob:temu-export",
      revokeObjectURL: (value) => revoked.push(value),
    },
    fetchImpl: async (url, options) => {
      fetchRequests.push({ url, options });
      assert.equal(state.creation.recordTemuExportBusy, true);
      return {
        ok: true,
        blob: async () => new Blob(["xlsx"]),
        headers: new Headers({
          "Content-Disposition": "attachment; filename*=UTF-8''temu-import-20260803.xlsx",
          "X-Temu-Export-Set-Count": "2",
          "X-Temu-Export-Row-Count": "3",
          "X-Temu-Export-Issue-Count": "1",
          "X-Temu-Export-Issue-Sheet": encodeURIComponent("导出问题"),
        }),
      };
    },
  });

  assert.deepEqual(controller.getCheckedSetIds(), ["set-a", "set-b"]);
  controller.syncControls(false, 2);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, false);
  assert.equal(dom.controls.creationRecordExportTemuButton.textContent, "导出 Temu Excel (2)");
  controller.syncControls(true, 2);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, true);
  controller.syncControls(false, 2);

  controller.open();
  assert.equal(dom.controls.creationRecordTemuExportDialog.open, true);
  assert.equal(dom.controls.creationRecordTemuExportSelectedCount.textContent, "2");
  dom.fields.get("defaultPrice").value = "19.99";
  dom.fields.get("defaultStock").value = "20";
  dom.fields.get("cloudName").value = "demo-cloud";
  dom.fields.get("uploadPreset").value = "temu_unsigned";

  await controller.submit({ preventDefault() {} });

  assert.equal(fetchRequests.length, 1);
  assert.equal(fetchRequests[0].url, "/api/creation/sets/export-temu-excel");
  assert.deepEqual(JSON.parse(fetchRequests[0].options.body), {
    mode: "draft",
    setIds: ["set-a", "set-b"],
    defaults: {
      variantAttributeName: "颜色",
      defaultPrice: "19.99",
      defaultStock: "20",
    },
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" },
  });
  assert.equal(dom.downloads.length, 1);
  assert.equal(dom.downloads[0].download, "temu-import-20260803.xlsx");
  assert.equal(dom.downloads[0].clicked, true);
  assert.deepEqual(revoked, ["blob:temu-export"]);
  assert.equal(state.creation.recordTemuExportBusy, false);
  assert.equal(dom.controls.creationRecordTemuExportFields.disabled, false);
  assert.deepEqual(rendered, [true, false]);
  assert.equal(dom.controls.creationRecordSetList.scrollTop, 137);
  assert.equal(dom.controls.creationRecordSetList.scrollLeft, 23);
  assert.match(feedback.at(-1)[0], /已待补全导出 2 套、3 个 SKU；导出问题共 1 项/u);
  const saved = JSON.parse(windowRef.storage.get(CREATION_TEMU_EXPORT_STORAGE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), [
    "cloudName",
    "defaultOriginCountry",
    "defaultPackageHeightCm",
    "defaultPackageLengthCm",
    "defaultPackageWeightG",
    "defaultPackageWidthCm",
    "defaultPrice",
    "defaultStock",
    "uploadPreset",
    "variantAttributeName",
  ]);
  assert.equal(saved.apiSecret, undefined);
});

test("Temu export controller keeps the dialog open for invalid Cloudinary pairing and cloud runtime responses", async () => {
  const dom = createTemuExportDom({ cloudName: "demo-cloud" });
  const state = {
    creation: {
      sets: [{ setId: "set-a" }],
      recordCheckedSetIds: ["set-a"],
      recordTemuExportBusy: false,
    },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => ["set-a"],
    setRecordFeedback() {},
    renderRecordView() {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    FormDataCtor: FakeFormData,
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ code: "unsupported_runtime_capability" }),
    }),
  });

  controller.open();
  dom.fields.get("cloudName").value = "demo-cloud";
  await controller.submit({ preventDefault() {} });
  assert.match(dom.controls.creationRecordTemuExportFeedback.textContent, /必须同时填写或同时留空/u);

  dom.fields.get("uploadPreset").value = "temu_unsigned";
  await controller.submit({ preventDefault() {} });
  assert.match(dom.controls.creationRecordTemuExportFeedback.textContent, /需要在本地应用中运行/u);
  assert.equal(dom.controls.creationRecordTemuExportDialog.open, true);
  assert.equal(state.creation.recordTemuExportBusy, false);
});

test("Temu export workbench enables strict export only for a current successful preflight", async () => {
  const dom = createTemuExportDom({ defaultPrice: "29.9" });
  const windowRef = createBrowserWindow();
  const state = {
    creation: {
      sets: [
        { setId: "set-a", productName: "商品 A", updatedAt: "2026-08-05T01:00:00.000Z", items: [{ role: "sku", skuSubjectId: "A-red", relativePath: "a.png" }] },
      ],
      recordCheckedSetIds: ["set-a"],
      recordTemuExportBusy: false,
    },
  };
  const requests = [];
  const feedback = [];
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    getCurrentSets: () => state.creation.sets,
    setRecordFeedback: (...args) => feedback.push(args),
    renderRecordView() {},
    documentRef: dom.documentRef,
    windowRef,
    urlApi: {
      createObjectURL: () => "blob:strict-export",
      revokeObjectURL() {},
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url.endsWith("/preflight")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            template: { name: "Temu 标准模板", version: "v1" },
            stats: { setCount: 1, skuCount: 1, imageCount: 3, pendingUploadCount: 0, uploadedCount: 1, cacheReuseCount: 1, blockerCount: 0, warningCount: 0 },
            strictReady: true,
            blockers: [],
            warnings: [],
            records: [{ setId: "set-a", productName: "商品 A", sourceUpdatedAt: "2026-08-05T01:00:00.000Z", skuCount: 1, imageCount: 3, strictReady: true, blockerCount: 0, warningCount: 0 }],
          }),
        };
      }
      return {
        ok: true,
        blob: async () => new Blob(["strict-xlsx"]),
        headers: new Headers({
          "Content-Disposition": "attachment; filename=temu-strict.xlsx",
          "X-Temu-Export-Set-Count": "1",
          "X-Temu-Export-Row-Count": "1",
          "X-Temu-Export-Issue-Count": "0",
        }),
      };
    },
  });

  controller.syncControls(false, 1);
  controller.open();
  await controller.runPreflight();

  assert.equal(dom.controls.creationRecordTemuStrictMode.disabled, false);
  assert.equal(dom.controls.creationRecordTemuPreflightState.textContent, "预检通过");
  assert.equal(dom.controls.creationRecordTemuStatUploadedCount.textContent, "1");
  assert.equal(dom.controls.creationRecordTemuStrictReason.dataset.state, "success");
  dom.modeControl.value = "strict";
  dom.controls.creationRecordTemuExportForm.dispatch("change");
  assert.equal(dom.controls.creationRecordTemuExportSubmitButton.textContent, "导出严格 XLSX");

  await controller.submit({ preventDefault() {} });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "/api/creation/sets/export-temu-excel/preflight");
  assert.equal(requests[0].body.mode, "strict");
  assert.equal(requests[1].url, "/api/creation/sets/export-temu-excel");
  assert.equal(requests[1].body.mode, "strict");
  assert.match(feedback.at(-1)[0], /已严格导出 1 套、1 个 SKU/u);
});

test("Temu preflight becomes stale when batch defaults change", async () => {
  const dom = createTemuExportDom({ defaultPrice: "19.9" });
  const state = {
    creation: {
      sets: [{ setId: "set-a", productName: "商品 A", updatedAt: "2026-08-05T02:00:00.000Z" }],
      recordCheckedSetIds: ["set-a"],
      recordTemuExportBusy: false,
    },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => ["set-a"],
    getCurrentSets: () => state.creation.sets,
    renderRecordView() {},
    setRecordFeedback() {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        template: { name: "Temu 标准模板" },
        stats: { setCount: 1, skuCount: 1, blockerCount: 0, warningCount: 0 },
        strictReady: true,
        blockers: [],
        warnings: [],
        records: [{ setId: "set-a", sourceUpdatedAt: "2026-08-05T02:00:00.000Z", skuCount: 1, strictReady: true }],
      }),
    }),
  });

  controller.syncControls(false, 1);
  controller.open();
  await controller.runPreflight();
  assert.equal(dom.controls.creationRecordTemuStrictMode.disabled, false);

  dom.fields.get("defaultPrice").value = "20.9";
  dom.controls.creationRecordTemuExportForm.dispatch("input");

  assert.equal(dom.controls.creationRecordTemuStrictMode.disabled, true);
  assert.equal(dom.controls.creationRecordTemuPreflightState.textContent, "预检已过期");
  assert.equal(dom.controls.creationRecordTemuStrictReason.dataset.state, "stale");
});

test("Temu export frontend keeps the record refresh binding and HTML form contract", async () => {
  const [app, html, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /from "\/lib\/creation-temu-export-ui\.mjs"/u);
  assert.match(app, /from "\/lib\/creation-record-list-model\.mjs(?:\?[^"]+)?"/u);
  assert.match(app, /creationRecordTemuExportController\.syncControls\(temuStartBlocked, checkedCount\)/u);
  assert.doesNotMatch(app, /filterCreationRecordSets\(\)\.slice\(0, 60\)/u);
  assert.match(await readFile(new URL("../lib/creation-temu-export-ui.mjs", import.meta.url), "utf8"), /renderRecordViewPreservingListScroll/u);
  assert.match(app, /creationRecordRefreshButton\.addEventListener\("click", refreshCreationRecordSets\)/u);
  assert.match(app, /\.finally\(\(\) => \{\s*creationRecordRefreshPromise = null;\s*renderCreationRecordView\(\);\s*\}\)/u);
  assert.match(html, /id="creationRecordExportTemuButton"/u);
  assert.match(html, /id="creationRecordTemuExportDialog"/u);
  assert.match(html, /id="creationRecordTemuPreflightButton"/u);
  assert.match(html, /id="creationRecordTemuStrictMode"/u);
  assert.match(html, /id="creationRecordLoadMoreButton"/u);
  assert.match(html, /id="creationRecordSetList" role="list"/u);
  assert.match(html, /name="cloudName"/u);
  assert.match(html, /name="uploadPreset"/u);
  assert.match(styles, /\.creation-temu-export-mode input\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/us);
  assert.doesNotMatch(app, /apiSecret|authorization|cookie/iu);
});

test("Temu export filename keeps only a safe XLSX attachment name", () => {
  assert.equal(getTemuExportFilename("attachment; filename*=UTF-8''temu-import.xlsx"), "temu-import.xlsx");
  assert.equal(getTemuExportFilename('attachment; filename="bad<name>.xlsx"'), "badname.xlsx");
  assert.equal(getTemuExportFilename("attachment; filename=not-a-workbook.txt"), "temu-import.xlsx");
});
