import { forgetApiEndpoint, listApiEndpointBookEntries, rememberApiEndpoints } from "./api-endpoint-book.mjs";

/* 四个 API 地址字段共用一份历史清单的下拉选择器。选中一条把地址、协议后缀和
   配套 Key 一起填进当前通道——Key 跟着 API 走，不单独挑。
   结构刻意对齐 lib/config-model-picker.mjs：同一套 refs/state 注入、同一套展开收起
   与外部点击关闭，界面行为才不会两套下拉各走一路。 */

export const API_BOOK_TARGET_ROUTE = "route";
export const API_BOOK_TARGET_DIRECT_IMAGE = "direct-image";
export const API_BOOK_TARGET_DIRECT_TEXT = "direct-text";
export const API_BOOK_TARGET_PROTOCOL = "protocol";
export const API_BOOK_TARGETS = [
  API_BOOK_TARGET_ROUTE,
  API_BOOK_TARGET_DIRECT_IMAGE,
  API_BOOK_TARGET_DIRECT_TEXT,
  API_BOOK_TARGET_PROTOCOL,
];

export function createApiEndpointBookPickerController({ refs, state, getUiText, storage, onApplied } = {}) {
  const documentRef = refs?.routeApiBookList?.ownerDocument || globalThis.document;
  const resolveStorage = () => (storage === undefined ? globalThis.window?.localStorage || null : storage);

  state.apiEndpointBook ||= { entries: [], open: "" };

  function uiText(key, fallback) {
    const text = typeof getUiText === "function" ? getUiText(key) : "";
    return text || fallback;
  }

  function getTargetRefs(target) {
    if (target === API_BOOK_TARGET_DIRECT_IMAGE) {
      return {
        addressInput: refs.directBaseUrlInput,
        suffixSelect: refs.directEndpointPathSelect,
        keyInput: refs.directImageApiKeyInput,
        toggle: refs.directImageApiBookToggle,
        list: refs.directImageApiBookList,
      };
    }
    if (target === API_BOOK_TARGET_DIRECT_TEXT) {
      return {
        addressInput: refs.directTextBaseUrlInput,
        suffixSelect: refs.directTextEndpointPathSelect,
        keyInput: refs.directTextApiKeyInput,
        toggle: refs.directTextApiBookToggle,
        list: refs.directTextApiBookList,
      };
    }
    if (target === API_BOOK_TARGET_PROTOCOL) {
      // 模型协议通道没有后缀下拉，请求路径由服务端固定拼接。
      return {
        addressInput: refs.protocolBaseUrlInput,
        suffixSelect: null,
        keyInput: refs.protocolApiKeyInput,
        toggle: refs.protocolApiBookToggle,
        list: refs.protocolApiBookList,
      };
    }
    return {
      addressInput: refs.baseUrlInput,
      suffixSelect: refs.endpointPathSelect,
      keyInput: refs.apiKeyInput,
      toggle: refs.routeApiBookToggle,
      list: refs.routeApiBookList,
    };
  }

  /* 明文 Key 只留在这份快照里，列表按索引回填；渲染进 DOM 的只有地址与掩码。 */
  function refreshEntries() {
    state.apiEndpointBook.entries = listApiEndpointBookEntries(resolveStorage());
    return state.apiEndpointBook.entries;
  }

  function renderEmptyState(list) {
    const empty = documentRef.createElement("div");
    empty.className = "api-endpoint-options-empty";
    empty.setAttribute("role", "status");
    empty.textContent = uiText("apiBookEmpty", "还没有保存过 API");
    list.appendChild(empty);
  }

  function renderTarget(target) {
    const targetRefs = getTargetRefs(target);
    if (!targetRefs.toggle || !targetRefs.list) {
      return;
    }

    const entries = state.apiEndpointBook.entries;
    const hasEntries = entries.length > 0;
    const isOpen = state.apiEndpointBook.open === target && hasEntries;

    targetRefs.toggle.hidden = !hasEntries;
    targetRefs.toggle.disabled = !hasEntries;
    targetRefs.toggle.setAttribute("aria-expanded", String(isOpen));
    targetRefs.list.hidden = !isOpen;
    targetRefs.list.innerHTML = "";

    if (!isOpen) {
      return;
    }

    if (!hasEntries) {
      renderEmptyState(targetRefs.list);
      return;
    }

    // 选中态按「地址 + Key 都对得上」判定：只比地址会在同一家的两把 Key 上误标。
    const currentKey = String(targetRefs.keyInput?.value || "").trim();
    const currentAddress = String(targetRefs.addressInput?.value || "").trim();

    entries.forEach((entry, index) => {
      const row = documentRef.createElement("div");
      row.className = "api-endpoint-option-row";

      const option = documentRef.createElement("button");
      option.type = "button";
      option.className = "api-endpoint-option";
      option.dataset.apiEndpointIndex = String(index);
      option.setAttribute("role", "option");
      const selected = currentKey !== "" && currentKey === entry.apiKey && currentAddress.startsWith(entry.baseUrl);
      option.setAttribute("aria-selected", String(selected));

      const address = documentRef.createElement("span");
      address.className = "api-endpoint-option-address";
      address.textContent = entry.label;
      option.appendChild(address);

      const meta = documentRef.createElement("span");
      meta.className = "api-endpoint-option-meta";
      meta.textContent = entry.endpointPath ? `${entry.endpointPath} · ${entry.mask}` : entry.mask;
      option.appendChild(meta);

      row.appendChild(option);

      const remove = documentRef.createElement("button");
      remove.type = "button";
      remove.className = "api-endpoint-option-remove";
      remove.dataset.apiEndpointRemoveIndex = String(index);
      const removeLabel = uiText("apiBookRemove", "删除这条 API");
      remove.setAttribute("aria-label", removeLabel);
      remove.title = removeLabel;
      row.appendChild(remove);

      targetRefs.list.appendChild(row);
    });
  }

  function render() {
    API_BOOK_TARGETS.forEach(renderTarget);
  }

  function setOpen(target, open) {
    state.apiEndpointBook.open = open ? target : "";
    render();
  }

  function toggle(target) {
    const shouldOpen = state.apiEndpointBook.open !== target;
    refreshEntries();
    setOpen(target, shouldOpen);
  }

  function closeAll() {
    if (!state.apiEndpointBook.open) {
      return;
    }
    setOpen("", false);
  }

  /* 后缀只在当前通道确实有这个选项时才跟着换：路由 A 存的 responses 不该把
     直连生图的 images/generations 顶掉成一个它不支持的值。 */
  function applySuffix(suffixSelect, endpointPath) {
    if (!suffixSelect || !endpointPath) {
      return;
    }
    const options = Array.from(suffixSelect.options || []).map((option) => String(option?.value ?? ""));
    if (options.length > 0 && !options.includes(endpointPath)) {
      return;
    }
    suffixSelect.value = endpointPath;
  }

  /* 选中即整套切换：地址、后缀、Key 一起填。模型不动，仍要用户点保存才生效。
     顺手把它记回队首，下次展开就在最上面。 */
  function selectEntry(target, index) {
    const entry = state.apiEndpointBook.entries[Number(index)];
    const targetRefs = getTargetRefs(target);
    if (!entry) {
      return;
    }

    if (targetRefs.addressInput) {
      targetRefs.addressInput.value = entry.baseUrl;
    }
    applySuffix(targetRefs.suffixSelect, entry.endpointPath);
    if (targetRefs.keyInput) {
      targetRefs.keyInput.value = entry.apiKey;
    }

    rememberApiEndpoints([entry], resolveStorage());
    refreshEntries();
    setOpen(target, false);
    // 地址框可能处于「完整 URL」显示模式，交回宿主按当前模式重排显示。
    onApplied?.(target, entry);
  }

  /* 删除只动清单，不清当前已保存配置：用户删的是「历史里这条」，
     不是「现在正在用的这套」。 */
  function removeEntry(target, index) {
    const entry = state.apiEndpointBook.entries[Number(index)];
    if (!entry) {
      return;
    }

    forgetApiEndpoint(entry, resolveStorage());
    const remaining = refreshEntries();
    setOpen(target, remaining.length > 0);
  }

  function remember(sources) {
    rememberApiEndpoints(sources, resolveStorage());
    refreshEntries();
    render();
  }

  function isInsidePicker(node) {
    return API_BOOK_TARGETS.some((target) => {
      const targetRefs = getTargetRefs(target);
      return Boolean(targetRefs.list?.contains?.(node) || targetRefs.toggle?.contains?.(node));
    });
  }

  function bindEvents() {
    API_BOOK_TARGETS.forEach((target) => {
      const targetRefs = getTargetRefs(target);
      targetRefs.toggle?.addEventListener?.("click", () => toggle(target));
      targetRefs.list?.addEventListener?.("click", (event) => {
        const removeButton = event.target?.closest?.("[data-api-endpoint-remove-index]");
        if (removeButton) {
          removeEntry(target, removeButton.dataset.apiEndpointRemoveIndex);
          return;
        }

        const option = event.target?.closest?.("[data-api-endpoint-index]");
        if (option) {
          selectEntry(target, option.dataset.apiEndpointIndex);
        }
      });
    });

    documentRef?.addEventListener?.("click", (event) => {
      if (!isInsidePicker(event.target)) {
        closeAll();
      }
    });

    refreshEntries();
    render();
  }

  return { bindEvents, closeAll, remember, render, refreshEntries };
}
