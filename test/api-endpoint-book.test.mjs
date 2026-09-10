import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  API_ENDPOINT_BOOK_LIMIT,
  API_ENDPOINT_BOOK_STORAGE_KEY,
  formatApiEndpointLabel,
  forgetApiEndpoint,
  listApiEndpointBookEntries,
  maskApiKeyForBook,
  readApiEndpointBook,
  rememberApiEndpoints,
} from "../public/lib/api-endpoint-book.mjs";
import { createApiEndpointBookPickerController } from "../public/lib/api-endpoint-book-picker.mjs";
import { PUBLIC_LIB_SYNC_TARGETS } from "../scripts/sync-public-lib.mjs";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

function createThrowingStorage() {
  return {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
  };
}

function seed(entries) {
  return { [API_ENDPOINT_BOOK_STORAGE_KEY]: JSON.stringify({ entries }) };
}

function datasetKeyForSelector(selector) {
  const name = selector.replace(/^\[|\]$/g, "");
  return name.replace(/^data-/, "").replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function createFakeElement(tagName, ownerDocument) {
  const listeners = new Map();
  const element = {
    tagName,
    ownerDocument,
    children: [],
    parentElement: null,
    dataset: {},
    attributes: new Map(),
    className: "",
    textContent: "",
    title: "",
    value: "",
    hidden: false,
    disabled: false,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    appendChild(child) {
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return element.attributes.has(name) ? element.attributes.get(name) : null;
    },
    contains(node) {
      for (let current = node; current; current = current.parentElement) {
        if (current === element) return true;
      }
      return false;
    },
    closest(selector) {
      const key = datasetKeyForSelector(selector);
      for (let current = element; current; current = current.parentElement) {
        if (current.dataset && current.dataset[key] !== undefined) return current;
      }
      return null;
    },
    dispatchEvent(event) {
      event.target ||= element;
      for (const handler of listeners.get(event.type) || []) handler(event);
      // 监听挂在列表容器上，点的是行内按钮，所以必须冒泡才能命中委托。
      if (event.bubbles !== false && element.parentElement) element.parentElement.dispatchEvent(event);
      return true;
    },
  };
  let innerHTML = "";
  Object.defineProperty(element, "innerHTML", {
    get() {
      return innerHTML;
    },
    set(value) {
      innerHTML = String(value || "");
      if (!innerHTML) {
        element.children.forEach((child) => {
          child.parentElement = null;
        });
        element.children = [];
      }
    },
  });
  return element;
}

function createFakeSelect(values, ownerDocument) {
  const select = createFakeElement("select", ownerDocument);
  select.options = values.map((value) => ({ value }));
  select.value = values[0] || "";
  return select;
}

function createPickerHarness(entries = []) {
  const documentRef = createFakeElement("#document");
  documentRef.createElement = (tagName) => createFakeElement(tagName, documentRef);
  documentRef.ownerDocument = documentRef;

  const storage = createFakeStorage(entries.length ? seed(entries) : {});
  const applied = [];
  const refs = {
    baseUrlInput: createFakeElement("input", documentRef),
    endpointPathSelect: createFakeSelect(["responses"], documentRef),
    apiKeyInput: createFakeElement("input", documentRef),
    routeApiBookToggle: createFakeElement("button", documentRef),
    routeApiBookList: createFakeElement("div", documentRef),
    directBaseUrlInput: createFakeElement("input", documentRef),
    directEndpointPathSelect: createFakeSelect(["images/generations", "responses", "chat/completions"], documentRef),
    directImageApiKeyInput: createFakeElement("input", documentRef),
    directImageApiBookToggle: createFakeElement("button", documentRef),
    directImageApiBookList: createFakeElement("div", documentRef),
    directTextBaseUrlInput: createFakeElement("input", documentRef),
    directTextEndpointPathSelect: createFakeSelect(["responses", "chat/completions"], documentRef),
    directTextApiKeyInput: createFakeElement("input", documentRef),
    directTextApiBookToggle: createFakeElement("button", documentRef),
    directTextApiBookList: createFakeElement("div", documentRef),
    protocolBaseUrlInput: createFakeElement("input", documentRef),
    protocolApiKeyInput: createFakeElement("input", documentRef),
    protocolApiBookToggle: createFakeElement("button", documentRef),
    protocolApiBookList: createFakeElement("div", documentRef),
  };
  const state = {};
  const controller = createApiEndpointBookPickerController({
    refs,
    state,
    storage,
    onApplied: (target, entry) => applied.push({ target, entry }),
  });
  controller.bindEvents();
  return { applied, controller, documentRef, refs, state, storage };
}

function clickOn(element) {
  element.dispatchEvent({ type: "click", target: element });
}

function optionRows(list) {
  return list.children.map((row) => row.children);
}

function rowTexts(list) {
  return optionRows(list).map(([option]) => option.children.map((child) => child.textContent));
}

const OPENAI = { baseUrl: "https://api.openai.com/v1", endpointPath: "responses", apiKey: "sk-abcdef123456" };
const RELAY = { baseUrl: "https://relay.example.test/v1", endpointPath: "chat/completions", apiKey: "sk-zzzzzz999999" };

test("the address label drops the scheme and any trailing slash", () => {
  assert.equal(formatApiEndpointLabel("https://api.openai.com/v1"), "api.openai.com/v1");
  assert.equal(formatApiEndpointLabel("http://relay.example.test/v1/"), "relay.example.test/v1");
  assert.equal(formatApiEndpointLabel("  HTTPS://Api.Example.test/v1  "), "Api.Example.test/v1");
  assert.equal(formatApiEndpointLabel(""), "");
});

test("the key mask never exposes the middle", () => {
  assert.equal(maskApiKeyForBook("sk-abcdef123456"), "sk-a***3456");
  assert.equal(maskApiKeyForBook("short"), "sh***");
  assert.equal(maskApiKeyForBook(""), "");
});

test("an entry without both an address and a key never enters the book", () => {
  const storage = createFakeStorage();

  rememberApiEndpoints(
    [
      { baseUrl: "https://api.openai.com/v1", endpointPath: "responses", apiKey: "" },
      { baseUrl: "", endpointPath: "responses", apiKey: "sk-orphan-key" },
      { baseUrl: "   ", apiKey: "   " },
      null,
    ],
    storage,
  );

  // 缺地址或缺 Key 都无法「整套切过来」，所以清单必须还是空的。
  assert.deepEqual(readApiEndpointBook(storage), []);
});

test("identity is address plus key, so the suffix follows the newest save", () => {
  const storage = createFakeStorage();

  rememberApiEndpoints([OPENAI], storage);
  rememberApiEndpoints([{ ...OPENAI, endpointPath: "chat/completions" }], storage);

  // 同一家同一把钥匙只占一条，后缀跟最近一次走。
  assert.deepEqual(readApiEndpointBook(storage), [{ ...OPENAI, endpointPath: "chat/completions" }]);

  // 同一家的第二把钥匙是另一条 API，必须各自保留。
  rememberApiEndpoints([{ ...OPENAI, apiKey: "sk-second-key-9999" }], storage);
  assert.equal(readApiEndpointBook(storage).length, 2);
});

test("remembering keeps the newest first and moves a reused entry up", () => {
  const storage = createFakeStorage();

  rememberApiEndpoints([OPENAI], storage);
  rememberApiEndpoints([RELAY], storage);
  assert.deepEqual(
    readApiEndpointBook(storage).map((entry) => entry.baseUrl),
    [RELAY.baseUrl, OPENAI.baseUrl],
  );

  rememberApiEndpoints([OPENAI], storage);
  assert.deepEqual(
    readApiEndpointBook(storage).map((entry) => entry.baseUrl),
    [OPENAI.baseUrl, RELAY.baseUrl],
  );
});

test("the book caps at the documented limit and drops the oldest", () => {
  const storage = createFakeStorage();
  const made = Array.from({ length: API_ENDPOINT_BOOK_LIMIT + 5 }, (_value, index) => ({
    baseUrl: `https://host-${index}.example.test/v1`,
    endpointPath: "responses",
    apiKey: `sk-key-${index}`,
  }));

  made.forEach((entry) => rememberApiEndpoints([entry], storage));

  const stored = readApiEndpointBook(storage);
  assert.equal(stored.length, API_ENDPOINT_BOOK_LIMIT);
  assert.equal(stored[0].baseUrl, made.at(-1).baseUrl);
  assert.ok(!stored.some((entry) => entry.apiKey === "sk-key-0"));
});

test("forgetting one entry leaves the rest ordered and untouched", () => {
  const storage = createFakeStorage(seed([OPENAI, RELAY]));

  forgetApiEndpoint(OPENAI, storage);
  assert.deepEqual(readApiEndpointBook(storage), [RELAY]);

  // 删不存在的条目不改顺序；后缀不参与身份，所以只换后缀也能删掉同一条。
  forgetApiEndpoint({ baseUrl: "https://nope.example.test/v1", apiKey: "sk-nope" }, storage);
  assert.deepEqual(readApiEndpointBook(storage), [RELAY]);
  forgetApiEndpoint({ ...RELAY, endpointPath: "responses" }, storage);
  assert.deepEqual(readApiEndpointBook(storage), []);
});

test("a corrupt or unavailable book reads as empty instead of throwing", () => {
  assert.deepEqual(readApiEndpointBook(createFakeStorage({ [API_ENDPOINT_BOOK_STORAGE_KEY]: "{not json" })), []);
  assert.deepEqual(readApiEndpointBook(createFakeStorage({ [API_ENDPOINT_BOOK_STORAGE_KEY]: '{"entries":{"a":1}}' })), []);
  assert.deepEqual(readApiEndpointBook(createThrowingStorage()), []);
  assert.deepEqual(readApiEndpointBook(null), []);

  assert.doesNotThrow(() => rememberApiEndpoints([OPENAI], createThrowingStorage()));
  assert.doesNotThrow(() => forgetApiEndpoint(OPENAI, createThrowingStorage()));
});

test("legacy bare array storage still reads as a book", () => {
  const storage = createFakeStorage({ [API_ENDPOINT_BOOK_STORAGE_KEY]: JSON.stringify([OPENAI, OPENAI, RELAY]) });
  assert.deepEqual(readApiEndpointBook(storage), [OPENAI, RELAY]);
});

test("listed entries carry a label and mask alongside the plaintext", () => {
  const storage = createFakeStorage(seed([OPENAI]));
  assert.deepEqual(listApiEndpointBookEntries(storage), [
    { ...OPENAI, label: "api.openai.com/v1", mask: "sk-a***3456" },
  ]);
});

test("an empty book hides every expand control", () => {
  const { refs } = createPickerHarness();

  [refs.routeApiBookToggle, refs.directImageApiBookToggle, refs.directTextApiBookToggle, refs.protocolApiBookToggle].forEach(
    (toggle) => {
      assert.equal(toggle.hidden, true);
      assert.equal(toggle.disabled, true);
      assert.equal(toggle.getAttribute("aria-expanded"), "false");
    },
  );
});

test("picking an API switches its key, address and suffix together", () => {
  const { applied, refs } = createPickerHarness([OPENAI, RELAY]);

  clickOn(refs.directImageApiBookToggle);
  const [, relayRow] = refs.directImageApiBookList.children;
  clickOn(relayRow.children[0]);

  // 这是本功能的要点：选 API，Key 跟着自动切过来。
  assert.equal(refs.directBaseUrlInput.value, RELAY.baseUrl);
  assert.equal(refs.directImageApiKeyInput.value, RELAY.apiKey);
  assert.equal(refs.directEndpointPathSelect.value, RELAY.endpointPath);
  // 其他通道不受影响。
  assert.equal(refs.baseUrlInput.value, "");
  assert.equal(refs.apiKeyInput.value, "");
  assert.equal(refs.protocolApiKeyInput.value, "");
  // 选中即收起，并交回宿主重排地址显示。
  assert.equal(refs.directImageApiBookList.hidden, true);
  assert.deepEqual(applied.map((item) => item.target), ["direct-image"]);
  assert.equal(applied[0].entry.apiKey, RELAY.apiKey);
});

test("a suffix the current channel does not offer is left alone", () => {
  const { refs } = createPickerHarness([RELAY]);
  refs.endpointPathSelect.value = "responses";

  // 路由模式只支持 responses，而这条 API 存的是 chat/completions。
  clickOn(refs.routeApiBookToggle);
  clickOn(refs.routeApiBookList.children[0].children[0]);

  assert.equal(refs.baseUrlInput.value, RELAY.baseUrl);
  assert.equal(refs.apiKeyInput.value, RELAY.apiKey);
  // 后缀保持原值，不会被顶成一个该通道不支持的值。
  assert.equal(refs.endpointPathSelect.value, "responses");
});

test("the protocol channel has no suffix control and still switches key and address", () => {
  const { applied, refs } = createPickerHarness([OPENAI]);

  clickOn(refs.protocolApiBookToggle);
  clickOn(refs.protocolApiBookList.children[0].children[0]);

  assert.equal(refs.protocolBaseUrlInput.value, OPENAI.baseUrl);
  assert.equal(refs.protocolApiKeyInput.value, OPENAI.apiKey);
  assert.deepEqual(applied.map((item) => item.target), ["protocol"]);
});

test("rows show the address and a masked key, never the plaintext", () => {
  const { refs } = createPickerHarness([OPENAI, RELAY]);

  clickOn(refs.routeApiBookToggle);

  assert.deepEqual(rowTexts(refs.routeApiBookList), [
    ["api.openai.com/v1", "responses · sk-a***3456"],
    ["relay.example.test/v1", "chat/completions · sk-z***9999"],
  ]);

  const serialized = JSON.stringify(
    optionRows(refs.routeApiBookList).map(([option, remove]) => [
      option.children.map((child) => child.textContent),
      option.dataset,
      [...option.attributes],
      remove.dataset,
      [...remove.attributes],
      remove.title,
    ]),
  );
  assert.ok(!serialized.includes(OPENAI.apiKey));
  assert.ok(!serialized.includes(RELAY.apiKey));
});

test("the four channels share one book", () => {
  const { refs } = createPickerHarness([OPENAI]);

  [
    [refs.routeApiBookToggle, refs.routeApiBookList],
    [refs.directImageApiBookToggle, refs.directImageApiBookList],
    [refs.directTextApiBookToggle, refs.directTextApiBookList],
    [refs.protocolApiBookToggle, refs.protocolApiBookList],
  ].forEach(([toggle, list]) => {
    assert.equal(toggle.hidden, false);
    clickOn(toggle);
    assert.equal(list.children.length, 1);
    clickOn(toggle);
  });
});

test("opening one channel closes the other", () => {
  const { refs } = createPickerHarness([OPENAI]);

  clickOn(refs.routeApiBookToggle);
  assert.equal(refs.routeApiBookList.hidden, false);

  clickOn(refs.protocolApiBookToggle);
  assert.equal(refs.routeApiBookList.hidden, true);
  assert.equal(refs.protocolApiBookList.hidden, false);

  clickOn(refs.protocolApiBookToggle);
  assert.equal(refs.protocolApiBookList.hidden, true);
});

test("removing an entry drops it without touching the live fields", () => {
  const { refs, storage } = createPickerHarness([OPENAI, RELAY]);
  refs.baseUrlInput.value = OPENAI.baseUrl;
  refs.apiKeyInput.value = OPENAI.apiKey;

  clickOn(refs.routeApiBookToggle);
  clickOn(refs.routeApiBookList.children[0].children[1]);

  assert.deepEqual(readApiEndpointBook(storage), [RELAY]);
  // 删的是历史条目，当前填着的地址与 Key 不动。
  assert.equal(refs.baseUrlInput.value, OPENAI.baseUrl);
  assert.equal(refs.apiKeyInput.value, OPENAI.apiKey);
  assert.equal(refs.routeApiBookList.hidden, false);
  assert.deepEqual(rowTexts(refs.routeApiBookList), [["relay.example.test/v1", "chat/completions · sk-z***9999"]]);

  clickOn(refs.routeApiBookList.children[0].children[1]);
  assert.deepEqual(readApiEndpointBook(storage), []);
  assert.equal(refs.routeApiBookToggle.hidden, true);
});

test("selected state needs both the address and the key to line up", () => {
  const sameHost = { ...OPENAI, apiKey: "sk-second-key-9999" };
  const { refs } = createPickerHarness([OPENAI, sameHost]);
  refs.baseUrlInput.value = OPENAI.baseUrl;
  refs.apiKeyInput.value = sameHost.apiKey;

  clickOn(refs.routeApiBookToggle);
  // 同一家两把钥匙，只有 Key 也对得上的那条才是选中态。
  assert.deepEqual(
    optionRows(refs.routeApiBookList).map(([option]) => option.getAttribute("aria-selected")),
    ["false", "true"],
  );
});

test("a full-url address still marks its entry as selected", () => {
  const { refs } = createPickerHarness([OPENAI]);
  // 「完整 URL」模式下地址框显示到后缀，前缀仍是这条 API 的基础 URL。
  refs.baseUrlInput.value = `${OPENAI.baseUrl}/responses`;
  refs.apiKeyInput.value = OPENAI.apiKey;

  clickOn(refs.routeApiBookToggle);
  assert.equal(refs.routeApiBookList.children[0].children[0].getAttribute("aria-selected"), "true");
});

test("clicking outside closes an open list", () => {
  const { documentRef, refs } = createPickerHarness([OPENAI]);

  clickOn(refs.routeApiBookToggle);
  assert.equal(refs.routeApiBookList.hidden, false);

  documentRef.dispatchEvent({ type: "click", target: createFakeElement("div", documentRef) });
  assert.equal(refs.routeApiBookList.hidden, true);
});

test("remember() feeds the book from a saved config and skips incomplete channels", () => {
  const { controller, refs, storage } = createPickerHarness();

  controller.remember([
    OPENAI,
    { baseUrl: "https://api.openai.com/v1", endpointPath: "images/generations", apiKey: "" },
    RELAY,
    OPENAI,
  ]);

  assert.deepEqual(readApiEndpointBook(storage), [OPENAI, RELAY]);
  assert.equal(refs.routeApiBookToggle.hidden, false);
});

test("all four address fields carry a picker, and the key fields stay plain", async () => {
  const html = await readFile(indexPath, "utf8");

  [
    ["baseUrlInput", "routeApiBookToggle", "routeApiBookList"],
    ["directBaseUrlInput", "directImageApiBookToggle", "directImageApiBookList"],
    ["directTextBaseUrlInput", "directTextApiBookToggle", "directTextApiBookList"],
    ["protocolBaseUrlInput", "protocolApiBookToggle", "protocolApiBookList"],
  ].forEach(([inputId, toggleId, listId]) => {
    assert.match(
      html,
      new RegExp(
        `<div class="endpoint-address-control">\\s*<input id="${inputId}"[^>]*type="url"[^>]*/>\\s*<button class="api-endpoint-picker-toggle" id="${toggleId}" type="button"[^>]*aria-expanded="false" aria-controls="${listId}" data-ui-i18n-aria-label="apiBookExpand" hidden></button>\\s*<div class="api-endpoint-options-list" id="${listId}" role="listbox" hidden></div>`,
      ),
      `${inputId} must sit in an address control with a picker`,
    );
  });

  // 下拉挂在地址上，Key 输入框保持原样：Key 跟着 API 走，不单独挑。
  ["apiKeyInput", "directApiKeyInput", "directTextApiKeyInput", "protocolApiKeyInput"].forEach((inputId) => {
    assert.doesNotMatch(html, new RegExp(`id="${inputId}"[\\s\\S]{0,200}?api-endpoint-picker-toggle`));
  });
  assert.equal([...html.matchAll(/data-ui-i18n-placeholder="keepSavedKey"/g)].length, 4);
  ["savedKeyMask", "directSavedKeyMask", "directTextSavedKeyMask", "protocolSavedKeyMask"].forEach((maskId) => {
    assert.match(html, new RegExp(`id="${maskId}" data-ui-i18n="notSaved"`));
  });

  // 路由 C 的地址原本裸在 label 里，展开按钮进去会被 label 转发焦点，所以换成 div + 显式 label。
  assert.match(html, /<label for="protocolBaseUrlInput" data-ui-i18n="baseUrl">/);
});

test("picker styles cover the address container, two-line rows and delete affordance", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.endpoint-address-control:has\(\.api-endpoint-picker-toggle\)\s*\{[\s\S]*position:\s*relative;/);
  assert.match(styles, /\.endpoint-address-control:has\(\.api-endpoint-picker-toggle\) > input\s*\{[\s\S]*padding-right:\s*44px;/);
  assert.match(styles, /\.api-endpoint-picker-toggle\s*\{[\s\S]*position:\s*absolute;[\s\S]*width:\s*34px;/);
  assert.match(styles, /\.api-endpoint-picker-toggle\[aria-expanded="true"\]::before\s*\{/);
  // 弹层不是原生 select，必须自带不透明底色，否则深色主题下白底白字。
  assert.match(styles, /\.api-endpoint-options-list\s*\{[\s\S]*z-index:\s*30;[\s\S]*background:\s*var\(--bg-soft\);/);
  assert.match(styles, /\.api-endpoint-option-row\s*\{[\s\S]*grid-template-columns:\s*1fr auto;/);
  assert.match(styles, /\.api-endpoint-option-address\s*\{[\s\S]*text-overflow:\s*ellipsis;/);
  assert.match(styles, /\.api-endpoint-option-meta\s*\{[\s\S]*color:\s*var\(--muted\);/);
  assert.match(styles, /\.api-endpoint-option\[aria-selected="true"\]\s*\{[\s\S]*background:/);
  assert.match(styles, /\.api-endpoint-option-remove:hover,\s*\.api-endpoint-option-remove:focus-visible\s*\{[\s\S]*--danger/);
  assert.match(styles, /\.api-endpoint-options-empty\s*\{[\s\S]*place-items:\s*center;/);
});

test("the app wires the picker and keeps the book off the wire", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /from "\/lib\/api-endpoint-book-picker\.mjs";/);
  assert.match(app, /createApiEndpointBookPickerController\(\{ refs, state, getUiText: getUiLanguageText, onApplied: applyPickedApiEndpointDisplay \}\)/);
  assert.match(app, /apiEndpointBookPicker\.bindEvents\(\);/);
  assert.match(app, /function rememberApiEndpointsFromConfig\(browserConfig\)/);
  // 保存与首次加载各记一次，历史 API 才能在升级后立即出现在下拉里。
  assert.equal([...app.matchAll(/rememberApiEndpointsFromConfig\(browserConfig\)/g)].length, 3);
  // 选中后要按「完整 URL」模式重排地址显示，否则形态与切换前不一致。
  assert.match(app, /function applyPickedApiEndpointDisplay\(target\)/);
  assert.match(app, /syncEndpointInputDisplay\(imageRoute, endpoint\.baseUrl, endpoint\.endpointPath\)/);

  const bookModule = await readFile(new URL("../public/lib/api-endpoint-book.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(bookModule, /formData|fetch\(/);
});

test("both modules are public-lib sync targets and byte-identical mirrors", async () => {
  for (const filename of ["api-endpoint-book.mjs", "api-endpoint-book-picker.mjs"]) {
    assert.ok(PUBLIC_LIB_SYNC_TARGETS.includes(filename), `${filename} must be a public-lib sync target`);
    const [source, mirror] = await Promise.all([
      readFile(new URL(`../lib/${filename}`, import.meta.url), "utf8"),
      readFile(new URL(`../public/lib/${filename}`, import.meta.url), "utf8"),
    ]);
    assert.equal(mirror, source);
    assert.doesNotMatch(mirror, /\uFFFD/);
  }
});

test("the book never reaches the server config surface", async () => {
  const sources = await Promise.all(
    ["../lib/config-store.mjs", "../lib/request-private-config.mjs", "../lib/browser-config.mjs", "../server.mjs"].map(
      (relative) => readFile(new URL(relative, import.meta.url), "utf8"),
    ),
  );

  sources.forEach((source) => {
    assert.doesNotMatch(source, /api-endpoint-book|apiEndpointBook|image-studio-api-endpoint-book/);
  });
});
