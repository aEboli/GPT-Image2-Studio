import { forgetApiEndpoint, listApiEndpointBookEntries, rememberApiEndpoints } from "./api-endpoint-book.mjs";

/* 五个 API 地址字段各自维护一份历史清单的下拉选择器。选中一条把地址、协议后缀、
   配套 Key 和最后保存的模型一起填进当前通道；不同通道之间不串清单。
   结构刻意对齐 lib/config-model-picker.mjs：同一套 refs/state 注入、同一套展开收起
   与外部点击关闭，界面行为才不会两套下拉各走一路。 */

export const API_BOOK_TARGET_ROUTE = "route";
export const API_BOOK_TARGET_DIRECT_IMAGE = "direct-image";
export const API_BOOK_TARGET_DIRECT_TEXT = "direct-text";
export const API_BOOK_TARGET_PROTOCOL = "protocol";
export const API_BOOK_TARGET_GROK = "grok";
export const API_BOOK_TARGETS = [
  API_BOOK_TARGET_ROUTE,
  API_BOOK_TARGET_DIRECT_IMAGE,
  API_BOOK_TARGET_DIRECT_TEXT,
  API_BOOK_TARGET_PROTOCOL,
  API_BOOK_TARGET_GROK,
];

export function createApiEndpointBookPickerController({ refs, state, getUiText, storage, onApplied } = {}) {
  const documentRef = refs?.routeApiBookList?.ownerDocument || globalThis.document;
  const resolveStorage = () => (storage === undefined ? globalThis.window?.localStorage || null : storage);

  state.apiEndpointBook ||= { entriesByTarget: {}, open: "" };
  state.apiEndpointBook.entriesByTarget ||= {};

  // 清单内部的点击会立刻重建列表、把被点的节点移出文档；同一次点击继续冒泡到 document 时
  // 不能再按「点到外面」收起，否则删掉一条就得重新展开才能删下一条。
  let handledClickEvent = null;

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
        modelInput: refs.directImageModelInput,
        toggle: refs.directImageApiBookToggle,
        list: refs.directImageApiBookList,
      };
    }
    if (target === API_BOOK_TARGET_DIRECT_TEXT) {
      return {
        addressInput: refs.directTextBaseUrlInput,
        suffixSelect: refs.directTextEndpointPathSelect,
        keyInput: refs.directTextApiKeyInput,
        modelInput: refs.directResponsesModelInput,
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
        modelInput: refs.protocolImageModelInput,
        toggle: refs.protocolApiBookToggle,
        list: refs.protocolApiBookList,
      };
    }
    if (target === API_BOOK_TARGET_GROK) {
      return {
        addressInput: refs.grokBaseUrlInput,
        suffixSelect: refs.grokEndpointPathSelect,
        keyInput: refs.grokApiKeyInput,
        modelInput: refs.grokImageModelInput,
        toggle: refs.grokApiBookToggle,
        list: refs.grokApiBookList,
      };
    }
    return {
      addressInput: refs.baseUrlInput,
      suffixSelect: refs.endpointPathSelect,
      keyInput: refs.apiKeyInput,
      modelInput: refs.responsesModelInput,
      imageToolModelSelect: refs.imageToolModelSelect,
      toggle: refs.routeApiBookToggle,
      list: refs.routeApiBookList,
    };
  }

  /* 明文 Key 只留在这份快照里，列表按索引回填；渲染进 DOM 的只有地址与掩码。 */
  function refreshEntries(target = null) {
    const targets = target ? [target] : API_BOOK_TARGETS;
    targets.forEach((entryTarget) => {
      state.apiEndpointBook.entriesByTarget[entryTarget] = listApiEndpointBookEntries(entryTarget, resolveStorage());
    });
    // 保留一个默认别名，方便旧宿主读取状态；渲染和操作始终走按通道的 map。
    state.apiEndpointBook.entries = state.apiEndpointBook.entriesByTarget[API_BOOK_TARGET_ROUTE] || [];
    return target ? state.apiEndpointBook.entriesByTarget[target] : state.apiEndpointBook.entries;
  }

  function getEntries(target) {
    if (!Array.isArray(state.apiEndpointBook.entriesByTarget[target])) {
      refreshEntries(target);
    }
    return state.apiEndpointBook.entriesByTarget[target];
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

    const entries = getEntries(target);
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
      address.title = entry.baseUrl;
      option.appendChild(address);

      const meta = documentRef.createElement("span");
      meta.className = "api-endpoint-option-meta";
      meta.textContent = entry.endpointPath ? `${entry.endpointPath} · ${entry.mask}` : entry.mask;
      meta.title = meta.textContent;
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
    refreshEntries(target);
    setOpen(target, shouldOpen);
  }

  function closeAll() {
    if (!state.apiEndpointBook.open) {
      return;
    }
    setOpen("", false);
  }

  /* 后缀和工具模型只恢复当前下拉支持的选项。 */
  function applySelectValue(select, value) {
    if (!select || !value) {
      return;
    }
    const options = Array.from(select.options || []).map((option) => String(option?.value ?? ""));
    if (options.length > 0 && !options.includes(value)) {
      return;
    }
    select.value = value;
  }

  /* 选中即恢复最后保存的配置；旧条目未记录模型时保留当前值。
     记回队首只使用历史快照，不把表单中的未保存模型写进历史。 */
  function selectEntry(target, index) {
    const entry = getEntries(target)[Number(index)];
    const targetRefs = getTargetRefs(target);
    if (!entry) {
      return;
    }

    if (targetRefs.addressInput) {
      targetRefs.addressInput.value = entry.baseUrl;
    }
    applySelectValue(targetRefs.suffixSelect, entry.endpointPath);
    if (targetRefs.keyInput) {
      targetRefs.keyInput.value = entry.apiKey;
    }
    if (targetRefs.modelInput && entry.model) {
      targetRefs.modelInput.value = entry.model;
    }
    applySelectValue(targetRefs.imageToolModelSelect, entry.imageToolModel);

    rememberApiEndpoints(target, [entry], resolveStorage());
    refreshEntries(target);
    setOpen(target, false);
    // 地址框可能处于「完整 URL」显示模式，交回宿主按当前模式重排显示。
    onApplied?.(target, entry);
  }

  /* 删除只动清单，不清当前已保存配置：用户删的是「历史里这条」，
     不是「现在正在用的这套」。 */
  function removeEntry(target, index) {
    const entry = getEntries(target)[Number(index)];
    if (!entry) {
      return;
    }

    forgetApiEndpoint(target, entry, resolveStorage());
    const remaining = refreshEntries(target);
    setOpen(target, remaining.length > 0);
  }

  function remember(targetOrSources, maybeSources) {
    // 旧宿主传入一组 sources 时只记入默认路由通道；新的调用必须明确 target。
    const target = API_BOOK_TARGETS.includes(targetOrSources) ? targetOrSources : API_BOOK_TARGET_ROUTE;
    const sources = target === targetOrSources ? maybeSources : targetOrSources;
    rememberApiEndpoints(target, sources, resolveStorage());
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
          handledClickEvent = event;
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
      // 这次点击已经由清单自己消费（删除会重绘列表），不再当成外部点击收起。
      if (event === handledClickEvent) {
        handledClickEvent = null;
        return;
      }

      if (!isInsidePicker(event.target)) {
        closeAll();
      }
    });

    refreshEntries();
    render();
  }

  return { bindEvents, closeAll, remember, render, refreshEntries };
}
