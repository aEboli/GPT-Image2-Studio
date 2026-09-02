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
    creationRecordActionFeedback: createElement(),
    creationRecordSearchInput: createElement(),
    creationRecordSetList: createElement(),
    creationRecordTemuExportSelectedCount: createElement(),
    creationRecordTemuExportSubmitButton: createElement(),
  };
  const downloads = [];
  const documentListeners = new Map();
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
    addEventListener(type, handler) {
      const handlers = documentListeners.get(type) || [];
      handlers.push(handler);
      documentListeners.set(type, handlers);
    },
    /* 事件对象原样透传：这些用例要自己伪造「被改指向祖先」的 target，
       不能像 createElement.dispatch 那样注入 target: this。 */
    dispatch(type, event = {}) {
      for (const handler of documentListeners.get(type) || []) handler(event);
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

/* 模拟真实浏览器里按下禁用的「temuexcel导出工作台」：该按钮的禁用样式声明了
   pointer-events: none，事件会改指向祖先容器，所以这里只交出祖先，
   让模块自己靠矩形命中测试找回按钮。 */
function pressDisabledExportButton(dom, { button = 0, clientX = 10, clientY = 10 } = {}) {
  const exportButton = dom.controls.creationRecordExportTemuButton;
  exportButton.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 });
  const origin = { closest: () => null, querySelectorAll: () => [exportButton] };
  dom.documentRef.dispatch("pointerdown", { target: origin, button, clientX, clientY });
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
  assert.equal(dom.controls.creationRecordExportTemuButton.textContent, "temuexcel导出工作台");
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
  const libSource = await readFile(new URL("../lib/creation-temu-export-ui.mjs", import.meta.url), "utf8");
  assert.match(libSource, /renderRecordViewPreservingListScroll/u);
  assert.match(libSource, /import \{ resolveDisabledShakeTarget \} from "\.\/disabled-shake\.mjs";/u);
  // 捕获阶段这一位行为测试观察不到（替身直接向 document 派发，冒泡监听也会通过），只能钉源码。
  assert.match(libSource, /documentRef\.addEventListener\?\.\("pointerdown", handleDisabledExportPress, true\);/u);
  assert.match(app, /creationRecordRefreshButton\.addEventListener\("click", refreshCreationRecordSets\)/u);
  assert.match(app, /\.finally\(\(\) => \{\s*creationRecordRefreshPromise = null;\s*renderCreationRecordView\(\);\s*\}\)/u);
  assert.match(html, /id="creationRecordExportTemuButton"/u);
  assert.match(html, /id="creationRecordExportTemuButton"[^>]*>temuexcel导出工作台</u);
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

test("注入 openWorkbench 后，入口忽略已勾选记录并直接打开工作台", () => {
  const dom = createTemuExportDom({});
  const state = {
    creation: {
      sets: [{ setId: "set-a" }, { setId: "set-b" }],
      recordCheckedSetIds: ["set-a", "set-b"],
      recordTemuExportBusy: false,
    },
  };
  const openedWith = [];
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    setRecordFeedback: () => {},
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    openWorkbench: (setIds) => openedWith.push(setIds),
  });

  controller.open();

  controller.syncControls(false, 2);
  assert.equal(dom.controls.creationRecordExportTemuButton.textContent, "temuexcel导出工作台");

  // 即使已经勾选记录，也不能自动打开 Studio 导入界面。
  assert.equal(openedWith.length, 1);
  assert.deepEqual(openedWith[0], []);
  // 关键：不再直接打开批量导出对话框。
  assert.equal(dom.controls.creationRecordTemuExportDialog.open, false);

  // 第二个标签仍能显式打开批量对话框。
  controller.openExportDialog();
  assert.equal(dom.controls.creationRecordTemuExportDialog.open, true);
  assert.equal(openedWith.length, 1);
});

test("注入 openWorkbench 后，零勾选可直接打开，批量标签仍要求勾选，忙碌状态仍会拦截", () => {
  const dom = createTemuExportDom({});
  const state = {
    creation: { sets: [{ setId: "set-a" }], recordCheckedSetIds: [], recordTemuExportBusy: false },
  };
  const openedWith = [];
  const feedback = [];
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    setRecordFeedback: (...args) => feedback.push(args),
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    openWorkbench: (setIds) => openedWith.push(setIds),
  });

  controller.syncControls(false, 0);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, false);

  // 零勾选直接进入工作台，不发送任何预选记录。
  controller.open();
  assert.equal(openedWith.length, 1);
  assert.deepEqual(openedWith[0], []);
  assert.equal(feedback.length, 0);

  // 只有覆盖层内的批量快速导出仍要求显式勾选。
  controller.openExportDialog();
  assert.equal(dom.controls.creationRecordTemuExportDialog.open, false);
  assert.equal(feedback.at(-1)?.[0], "请先勾选需要导出的套图记录。");

  // 记录变更中：同样不打开工作台，提示文案保持原文。
  const busyController = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    isMutationBusy: () => true,
    setRecordFeedback: (...args) => feedback.push(args),
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    openWorkbench: (setIds) => openedWith.push(setIds),
  });
  busyController.syncControls(false, 0);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, true);
  busyController.open();
  assert.equal(openedWith.length, 1);
  assert.equal(feedback.at(-1)?.[0], "当前记录正在生成、刷新或删除，请完成后再打开 Temu 导出。");
});

test("不注入 openWorkbench 时退回原行为，直接打开批量导出对话框", () => {
  const dom = createTemuExportDom({});
  const state = {
    creation: { sets: [{ setId: "set-a" }], recordCheckedSetIds: ["set-a"], recordTemuExportBusy: false },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    setRecordFeedback: () => {},
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
  });

  controller.open();
  assert.equal(dom.controls.creationRecordTemuExportDialog.open, true);
});

/* 反馈区替身按 public/app.js 的 setCreationRecordFeedback 逐行写法实现，
   撤回时的「反馈区仍显示那句话」读回判定才是真的被跑到。 */
function createRecordFeedbackHarness(dom) {
  const node = dom.controls.creationRecordActionFeedback;
  return {
    node,
    setRecordFeedback: (message = "", kind = "") => {
      node.textContent = message || "";
      node.dataset.state = kind || "";
    },
  };
}

test("工作台入口无需勾选记录，零勾选时不再播报旧的选择提示", () => {
  const dom = createTemuExportDom({});
  const feedback = createRecordFeedbackHarness(dom);
  const state = {
    creation: { sets: [{ setId: "set-a" }], recordCheckedSetIds: [], recordTemuExportBusy: false },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    setRecordFeedback: feedback.setRecordFeedback,
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    openWorkbench: () => {
      throw new Error("禁用按钮不得触发导出");
    },
  });

  controller.syncControls(false, 0);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, false);
  assert.equal(dom.controls.creationRecordExportTemuButton.textContent, "temuexcel导出工作台");

  pressDisabledExportButton(dom);
  assert.equal(feedback.node.textContent, "");
  assert.equal(feedback.node.dataset.state || "", "");

  state.creation.recordCheckedSetIds = ["set-a"];
  controller.syncControls(false, 1);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, false);
  assert.equal(feedback.node.textContent, "");
  assert.equal(feedback.node.dataset.state || "", "");
});

test("记录变更中按下禁用按钮播报忙碌原因；非主键与命中其它控件都保持沉默", () => {
  const dom = createTemuExportDom({});
  const feedback = createRecordFeedbackHarness(dom);
  const state = {
    creation: { sets: [{ setId: "set-a" }], recordCheckedSetIds: ["set-a"], recordTemuExportBusy: false },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    isMutationBusy: () => true,
    setRecordFeedback: feedback.setRecordFeedback,
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    openWorkbench: () => {
      throw new Error("禁用按钮不得触发导出");
    },
  });

  controller.syncControls(false, 1);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, true);

  pressDisabledExportButton(dom, { button: 2 });
  assert.equal(feedback.node.textContent, "", "非主键按下不播报");

  dom.documentRef.dispatch("pointerdown", {
    target: { closest: () => null, querySelectorAll: () => [] },
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  assert.equal(feedback.node.textContent, "", "命中不到导出按钮时不播报");

  pressDisabledExportButton(dom);
  assert.equal(feedback.node.textContent, "当前记录正在生成、刷新或删除，请完成后再打开 Temu 导出。");
});

test("撤回禁用原因不会覆盖之后写入的新反馈", () => {
  const dom = createTemuExportDom({});
  const feedback = createRecordFeedbackHarness(dom);
  let mutationBusy = true;
  const state = {
    creation: { sets: [{ setId: "set-a" }], recordCheckedSetIds: [], recordTemuExportBusy: false },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    isMutationBusy: () => mutationBusy,
    setRecordFeedback: feedback.setRecordFeedback,
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
  });

  controller.syncControls(false, 0);
  assert.equal(dom.controls.creationRecordExportTemuButton.disabled, true);
  pressDisabledExportButton(dom);
  assert.equal(feedback.node.textContent, "当前记录正在生成、刷新或删除，请完成后再打开 Temu 导出。");

  feedback.setRecordFeedback("已删除 1 套记录。", "success");
  mutationBusy = false;
  controller.syncControls(false, 0);
  assert.equal(feedback.node.textContent, "已删除 1 套记录。");
  assert.equal(feedback.node.dataset.state, "success");
});

test("按钮禁用时必定给得出原因：四种组合逐一按下", () => {
  const dom = createTemuExportDom({});
  const feedback = createRecordFeedbackHarness(dom);
  let mutationBusy = false;
  const state = {
    creation: { sets: [{ setId: "set-a" }], recordCheckedSetIds: [], recordTemuExportBusy: false },
  };
  const controller = createCreationTemuExportController({
    state,
    getCurrentSetIds: () => state.creation.sets.map((set) => set.setId),
    isMutationBusy: () => mutationBusy,
    setRecordFeedback: feedback.setRecordFeedback,
    renderRecordView: () => {},
    documentRef: dom.documentRef,
    windowRef: createBrowserWindow(),
    openWorkbench: () => {},
  });

  for (const busy of [false, true]) {
    for (const checked of [[], ["set-a"]]) {
      mutationBusy = busy;
      state.creation.recordCheckedSetIds = checked;
      feedback.node.textContent = "";
      controller.syncControls(false, checked.length);
      pressDisabledExportButton(dom);
      const { disabled } = dom.controls.creationRecordExportTemuButton;
      assert.equal(disabled, busy);
      assert.equal(Boolean(feedback.node.textContent), disabled, "禁用必有原因，可用必不播报");
    }
  }
});

test("Temu export filename keeps only a safe XLSX attachment name", () => {
  assert.equal(getTemuExportFilename("attachment; filename*=UTF-8''temu-import.xlsx"), "temu-import.xlsx");
  assert.equal(getTemuExportFilename('attachment; filename="bad<name>.xlsx"'), "badname.xlsx");
  assert.equal(getTemuExportFilename("attachment; filename=not-a-workbook.txt"), "temu-import.xlsx");
});
