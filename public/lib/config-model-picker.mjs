export function createConfigModelPickerController({
  refs,
  state,
  getBrowserPrivateConfigRequestPayload,
  fetchImpl = fetch,
  FormDataCtor = FormData,
} = {}) {
  const documentRef = refs?.modelOptionsList?.ownerDocument || globalThis.document;
  const MODEL_TARGET_RESPONSES = "responses";
  const MODEL_TARGET_DIRECT = "direct";
  const MODEL_TARGET_DIRECT_RESPONSES = "direct-responses";
  const MODEL_TARGETS = [MODEL_TARGET_RESPONSES, MODEL_TARGET_DIRECT, MODEL_TARGET_DIRECT_RESPONSES];

  state.configModels ||= { items: [], loading: false, loadingMode: "", open: false };
  state.configModels.targets ||= {};

  function normalizeTarget(target) {
    if (target === MODEL_TARGET_DIRECT_RESPONSES) {
      return MODEL_TARGET_DIRECT_RESPONSES;
    }
    return target === MODEL_TARGET_DIRECT ? MODEL_TARGET_DIRECT : MODEL_TARGET_RESPONSES;
  }

  function createEmptyModelState() {
    return { items: [], searchQuery: "", open: false };
  }

  function getModelState(target = getTargetForSelectedRoute()) {
    const normalizedTarget = normalizeTarget(target);
    if (!state.configModels.targets[normalizedTarget]) {
      const shouldSeedFromLegacy =
        normalizedTarget === normalizeTarget(state.configModels.target) ||
        (!state.configModels.target && normalizedTarget === MODEL_TARGET_RESPONSES);
      state.configModels.targets[normalizedTarget] = shouldSeedFromLegacy
        ? {
            items: Array.isArray(state.configModels.items) ? state.configModels.items : [],
            searchQuery: String(state.configModels.searchQuery || ""),
            open: Boolean(state.configModels.open),
          }
        : createEmptyModelState();
    }
    return state.configModels.targets[normalizedTarget];
  }

  function syncLegacyModelState(target = getTargetForSelectedRoute()) {
    const normalizedTarget = normalizeTarget(target);
    const modelState = getModelState(normalizedTarget);
    state.configModels.target = normalizedTarget;
    state.configModels.items = modelState.items;
    state.configModels.searchQuery = modelState.searchQuery;
    state.configModels.open = modelState.open;
  }

  function getSelectedImageRoute() {
    return refs.imageRouteInputs?.find((input) => input.checked)?.value === "b" ? "b" : "a";
  }

  function getTargetForSelectedRoute() {
    return getSelectedImageRoute() === "b" ? MODEL_TARGET_DIRECT : MODEL_TARGET_RESPONSES;
  }

  function getImageRouteForTarget(target = getTargetForSelectedRoute()) {
    return normalizeTarget(target) === MODEL_TARGET_RESPONSES ? "a" : "b";
  }

  function getTargetRefs(target = getTargetForSelectedRoute()) {
    const normalizedTarget = normalizeTarget(target);
    if (normalizedTarget === MODEL_TARGET_DIRECT) {
      return {
        input: refs.directImageModelInput,
        toggle: refs.directModelPickerToggle,
        list: refs.directModelOptionsList,
        fetchButton: refs.directFetchModelsButton,
      };
    }
    if (normalizedTarget === MODEL_TARGET_DIRECT_RESPONSES) {
      return {
        input: refs.directResponsesModelInput,
        toggle: refs.directResponsesModelPickerToggle,
        list: refs.directResponsesModelOptionsList,
        fetchButton: refs.directResponsesFetchModelsButton,
      };
    }
    return {
      input: refs.responsesModelInput,
      toggle: refs.modelPickerToggle,
      list: refs.modelOptionsList,
      fetchButton: refs.fetchModelsButton,
    };
  }

  function setFeedback(message = "", kind = "") {
    refs.configFeedback.textContent = message;
    refs.configFeedback.dataset.state = kind;
  }

  function getInputValue(input) {
    return String(input?.value || "").trim();
  }

  function getRequestPayloadFromForm(target = getTargetForSelectedRoute()) {
    const browserPayload = getBrowserPrivateConfigRequestPayload?.() || {};
    return {
      ...browserPayload,
      imageRoute: getImageRouteForTarget(target),
      baseUrl: getInputValue(refs.baseUrlInput) || browserPayload.baseUrl || state.config?.baseUrl || "",
      endpointPath:
        getInputValue(refs.endpointPathSelect) || browserPayload.endpointPath || state.config?.endpointPath || "responses",
      apiKey: getInputValue(refs.apiKeyInput) || browserPayload.apiKey || "",
      responsesModel:
        getInputValue(refs.responsesModelInput) ||
        browserPayload.responsesModel ||
        state.config?.responsesModel ||
        "gpt-5.5",
      directBaseUrl:
        getInputValue(refs.directBaseUrlInput) || browserPayload.directBaseUrl || state.config?.directBaseUrl || "",
      directEndpointPath:
        getInputValue(refs.directEndpointPathSelect) ||
        browserPayload.directEndpointPath ||
        state.config?.directEndpointPath ||
        "images/generations",
      directApiKey: getInputValue(refs.directApiKeyInput) || browserPayload.directApiKey || "",
      directImageModel:
        getInputValue(refs.directImageModelInput) ||
        browserPayload.directImageModel ||
        state.config?.directImageModel ||
        "gpt-image-2",
      directResponsesModel:
        getInputValue(refs.directResponsesModelInput) ||
        browserPayload.directResponsesModel ||
        state.config?.directResponsesModel ||
        "gpt-5.5",
    };
  }

  function buildModelsFormData(target = getTargetForSelectedRoute()) {
    const payload = getRequestPayloadFromForm(target);
    const formData = new FormDataCtor();
    formData.set("imageRoute", payload.imageRoute);
    formData.set("baseUrl", payload.baseUrl);
    formData.set("endpointPath", payload.endpointPath);
    formData.set("apiKey", payload.apiKey);
    formData.set("responsesModel", payload.responsesModel);
    formData.set("directBaseUrl", payload.directBaseUrl);
    formData.set("directEndpointPath", payload.directEndpointPath);
    formData.set("directApiKey", payload.directApiKey);
    formData.set("directImageModel", payload.directImageModel);
    formData.set("directResponsesModel", payload.directResponsesModel);
    return formData;
  }

  function renderActions() {
    const loading = state.configModels.loading;
    const loadingTarget = normalizeTarget(state.configModels.loadingTarget || state.configModels.target);
    if (refs.testConnectionButton) {
      refs.testConnectionButton.disabled = loading;
      refs.testConnectionButton.textContent =
        loading && state.configModels.loadingMode === "test" ? "测试中..." : "测试连接";
    }
    MODEL_TARGETS.forEach((target) => {
      const targetRefs = getTargetRefs(target);
      if (!targetRefs.fetchButton) {
        return;
      }
      targetRefs.fetchButton.disabled = loading;
      targetRefs.fetchButton.textContent =
        loading && state.configModels.loadingMode === "models" && loadingTarget === target
          ? "获取中..."
          : "获取模型列表";
    });
  }

  function getModelSearchQuery(target = getTargetForSelectedRoute()) {
    return String(getModelState(target).searchQuery || "").trim();
  }

  function getVisibleModels(target = getTargetForSelectedRoute()) {
    const modelState = getModelState(target);
    const query = getModelSearchQuery(target).toLowerCase();
    if (!query) {
      return modelState.items;
    }
    return modelState.items.filter((modelId) => modelId.toLowerCase().includes(query));
  }

  function renderEmptySearchState(list, query) {
    const empty = documentRef.createElement("div");
    empty.className = "model-options-empty";
    empty.setAttribute("role", "status");
    empty.textContent = query ? `没有匹配的模型：${query}` : "没有匹配的模型";
    list.appendChild(empty);
  }

  function renderTarget(target, activeTarget) {
    const targetRefs = getTargetRefs(target);
    if (!targetRefs.input || !targetRefs.toggle || !targetRefs.list) {
      return;
    }
    const modelState = getModelState(target);
    const isActiveTarget = normalizeTarget(target) === normalizeTarget(activeTarget);
    const hasModels = isActiveTarget && modelState.items.length > 0;
    const pickerOpen = isActiveTarget && modelState.open && hasModels;
    const searchQuery = getModelSearchQuery(target);
    const visibleModels = isActiveTarget ? getVisibleModels(target) : [];

    targetRefs.toggle.hidden = !hasModels;
    targetRefs.toggle.disabled = !hasModels || state.configModels.loading;
    targetRefs.toggle.setAttribute("aria-expanded", String(pickerOpen));
    targetRefs.list.hidden = !pickerOpen;
    targetRefs.list.innerHTML = "";

    if (!isActiveTarget) {
      return;
    }

    if (visibleModels.length === 0 && searchQuery) {
      renderEmptySearchState(targetRefs.list, searchQuery);
    }

    visibleModels.forEach((modelId) => {
      const option = documentRef.createElement("button");
      option.type = "button";
      option.className = "model-option";
      option.dataset.modelId = modelId;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(getInputValue(targetRefs.input) === modelId));
      option.textContent = modelId;
      targetRefs.list.appendChild(option);
    });
  }

  function getActiveTarget() {
    if (state.configModels.loading) {
      return normalizeTarget(state.configModels.loadingTarget);
    }
    const currentTarget = normalizeTarget(state.configModels.target || getTargetForSelectedRoute());
    if (getModelState(currentTarget).open) {
      return currentTarget;
    }
    return getTargetForSelectedRoute();
  }

  function render() {
    const activeTarget = normalizeTarget(getActiveTarget());
    syncLegacyModelState(activeTarget);
    MODEL_TARGETS.forEach((target) => renderTarget(target, activeTarget));

    renderActions();
  }

  function setOpen(open, target = getTargetForSelectedRoute()) {
    const normalizedTarget = normalizeTarget(target);
    const modelState = getModelState(normalizedTarget);
    modelState.open = Boolean(open) && modelState.items.length > 0;
    syncLegacyModelState(normalizedTarget);
    render();
  }

  function toggleModelPicker(target = getTargetForSelectedRoute()) {
    const normalizedTarget = normalizeTarget(target);
    setOpen(!getModelState(normalizedTarget).open, normalizedTarget);
  }

  function selectModelOption(modelId, target = getTargetForSelectedRoute()) {
    const normalizedTarget = normalizeTarget(target);
    const targetRefs = getTargetRefs(normalizedTarget);
    if (targetRefs.input) {
      targetRefs.input.value = modelId;
    }
    getModelState(normalizedTarget).searchQuery = "";
    setOpen(false, normalizedTarget);
  }

  async function fetchConfigModels({ openAfterFetch = true, mode = "models", target = getTargetForSelectedRoute() } = {}) {
    const requestTarget = normalizeTarget(target);
    state.configModels.loading = true;
    state.configModels.loadingMode = mode;
    state.configModels.loadingTarget = requestTarget;
    syncLegacyModelState(requestTarget);
    render();
    setFeedback(mode === "test" ? "正在测试连接..." : "正在获取模型列表...", "busy");

    try {
      const response = await fetchImpl("/api/models", {
        method: "POST",
        body: buildModelsFormData(requestTarget),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || "获取模型列表失败。");
      }

      const models = Array.isArray(payload.models)
        ? payload.models.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (models.length === 0) {
        throw new Error("未获取到可调用模型。");
      }

      const modelState = getModelState(requestTarget);
      modelState.items = models;
      modelState.searchQuery = "";
      modelState.open = Boolean(openAfterFetch);
      syncLegacyModelState(requestTarget);
      setFeedback(
        mode === "test" ? `连接测试成功，获取到 ${models.length} 个模型。` : `已获取 ${models.length} 个可调用模型。`,
        "success",
      );
    } catch (error) {
      getModelState(requestTarget).open = false;
      syncLegacyModelState(requestTarget);
      setFeedback(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.configModels.loading = false;
      state.configModels.loadingMode = "";
      state.configModels.loadingTarget = "";
      render();
    }
  }

  function handleModelInput(target) {
    const normalizedTarget = normalizeTarget(target);
    const targetRefs = getTargetRefs(normalizedTarget);
    const modelState = getModelState(normalizedTarget);
    modelState.searchQuery = targetRefs.input?.value || "";
    modelState.open = modelState.items.length > 0;
    syncLegacyModelState(normalizedTarget);
    render();
  }

  function closeAllPickers() {
    MODEL_TARGETS.forEach((target) => {
      getModelState(target).open = false;
    });
    syncLegacyModelState(getTargetForSelectedRoute());
    render();
  }

  function isInsideModelPicker(targetNode) {
    return MODEL_TARGETS.some((target) => {
      const targetRefs = getTargetRefs(target);
      return (
        targetRefs.list?.contains(targetNode) ||
        targetRefs.toggle?.contains(targetNode) ||
        targetNode === targetRefs.input
      );
    });
  }

  function bindEvents() {
    refs.testConnectionButton.addEventListener("click", () => {
      fetchConfigModels({ openAfterFetch: false, mode: "test", target: getTargetForSelectedRoute() });
    });
    refs.fetchModelsButton.addEventListener("click", () => {
      fetchConfigModels({ openAfterFetch: true, mode: "models", target: MODEL_TARGET_RESPONSES });
    });
    refs.directFetchModelsButton?.addEventListener("click", () => {
      fetchConfigModels({ openAfterFetch: true, mode: "models", target: MODEL_TARGET_DIRECT });
    });
    refs.directResponsesFetchModelsButton?.addEventListener("click", () => {
      fetchConfigModels({ openAfterFetch: true, mode: "models", target: MODEL_TARGET_DIRECT_RESPONSES });
    });
    refs.modelPickerToggle.addEventListener("click", () => toggleModelPicker(MODEL_TARGET_RESPONSES));
    refs.directModelPickerToggle?.addEventListener("click", () => toggleModelPicker(MODEL_TARGET_DIRECT));
    refs.directResponsesModelPickerToggle?.addEventListener("click", () =>
      toggleModelPicker(MODEL_TARGET_DIRECT_RESPONSES),
    );
    refs.modelOptionsList.addEventListener("click", (event) => {
      const option = event.target?.closest("[data-model-id]");
      if (option) {
        selectModelOption(option.dataset.modelId, MODEL_TARGET_RESPONSES);
      }
    });
    refs.directModelOptionsList?.addEventListener("click", (event) => {
      const option = event.target?.closest("[data-model-id]");
      if (option) {
        selectModelOption(option.dataset.modelId, MODEL_TARGET_DIRECT);
      }
    });
    refs.directResponsesModelOptionsList?.addEventListener("click", (event) => {
      const option = event.target?.closest("[data-model-id]");
      if (option) {
        selectModelOption(option.dataset.modelId, MODEL_TARGET_DIRECT_RESPONSES);
      }
    });
    refs.responsesModelInput.addEventListener("input", () => {
      handleModelInput(MODEL_TARGET_RESPONSES);
    });
    refs.directImageModelInput?.addEventListener("input", () => {
      handleModelInput(MODEL_TARGET_DIRECT);
    });
    refs.directResponsesModelInput?.addEventListener("input", () => {
      handleModelInput(MODEL_TARGET_DIRECT_RESPONSES);
    });
    refs.imageRouteInputs?.forEach((input) => {
      input.addEventListener?.("change", () => {
        syncLegacyModelState(getTargetForSelectedRoute());
        render();
      });
    });
    documentRef.addEventListener("click", (event) => {
      if (!isInsideModelPicker(event.target)) {
        closeAllPickers();
      }
    });
  }

  return {
    bindEvents,
    fetchConfigModels,
    render,
    setFeedback,
  };
}
