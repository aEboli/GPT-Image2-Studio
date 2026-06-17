import {
  compressImageFile,
  formatImageCompressSize,
  normalizeImageCompressOptions,
} from "../image-compress-browser.mjs";
import { createViewRendererController } from "./view-renderer.mjs";

function getImageCompressFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified || 0}`;
}

function revokeImageCompressFile(item) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function revokeImageCompressResult(result) {
  if (result?.url) {
    URL.revokeObjectURL(result.url);
  }
}

function hasImageCompressContext({ refs, state } = {}) {
  return Boolean(refs?.imageCompressInput && refs?.imageCompressDropzone && state?.imageCompress);
}

function getImageCompressRefs() {
  if (typeof document === "undefined") {
    return {};
  }

  return {
    imageCompressClearButton: document.querySelector("#imageCompressClearButton"),
    imageCompressCount: document.querySelector("#imageCompressCount"),
    imageCompressDropzone: document.querySelector("#imageCompressDropzone"),
    imageCompressFeedback: document.querySelector("#imageCompressFeedback"),
    imageCompressFileList: document.querySelector("#imageCompressFileList"),
    imageCompressFormatInput: document.querySelector("#imageCompressFormatInput"),
    imageCompressInput: document.querySelector("#imageCompressInput"),
    imageCompressModeInput: document.querySelector("#imageCompressModeInput"),
    imageCompressQualityInput: document.querySelector("#imageCompressQualityInput"),
    imageCompressQualityValue: document.querySelector("#imageCompressQualityValue"),
    imageCompressResizeEnabledInput: document.querySelector("#imageCompressResizeEnabledInput"),
    imageCompressResizeHeightInput: document.querySelector("#imageCompressResizeHeightInput"),
    imageCompressResizeWidthInput: document.querySelector("#imageCompressResizeWidthInput"),
    imageCompressResultEmpty: document.querySelector("#imageCompressResultEmpty"),
    imageCompressResultList: document.querySelector("#imageCompressResultList"),
    imageCompressStartButton: document.querySelector("#imageCompressStartButton"),
    imageCompressTargetField: document.querySelector("#imageCompressTargetField"),
    imageCompressTargetInput: document.querySelector("#imageCompressTargetInput"),
  };
}

function createImageCompressState() {
  return {
    files: [],
    feedback: "",
    results: [],
    running: false,
  };
}

function createImageCompressController({ refs, state, showError, syncReferenceDropzoneCompact }) {
  function setFeedback(message = "", type = "") {
    state.imageCompress.feedback = message;
    refs.imageCompressFeedback.textContent = message;
    refs.imageCompressFeedback.dataset.status = type;
  }

  function getOptions() {
    return normalizeImageCompressOptions({
      mode: refs.imageCompressModeInput.value,
      targetSizeMb: refs.imageCompressTargetInput.value,
      quality: refs.imageCompressQualityInput.value,
      outputFormat: refs.imageCompressFormatInput.value,
      resizeEnabled: refs.imageCompressResizeEnabledInput.checked,
      resizeWidth: refs.imageCompressResizeWidthInput.value,
      resizeHeight: refs.imageCompressResizeHeightInput.value,
    });
  }

  function syncModeUi() {
    const options = getOptions();
    const targetMode = options.mode === "target";
    refs.imageCompressTargetField.classList.toggle("hidden", !targetMode);
    refs.imageCompressTargetInput.disabled = !targetMode;
    refs.imageCompressQualityValue.textContent = `${options.quality}%`;
    refs.imageCompressResizeWidthInput.disabled = !options.resizeEnabled;
    refs.imageCompressResizeHeightInput.disabled = !options.resizeEnabled;
  }

  function renderFileList() {
    refs.imageCompressFileList.replaceChildren();
    refs.imageCompressCount.textContent = `${state.imageCompress.files.length} 张`;
    syncReferenceDropzoneCompact?.(refs.imageCompressDropzone, state.imageCompress.files.length > 0);

    state.imageCompress.files.forEach((item) => {
      const card = document.createElement("div");
      card.className = "image-compress-file-card";

      const image = document.createElement("img");
      image.src = item.previewUrl;
      image.alt = item.file.name;
      image.loading = "lazy";
      card.appendChild(image);

      const body = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.file.name;
      body.appendChild(title);

      const meta = document.createElement("span");
      meta.textContent = `${formatImageCompressSize(item.file.size)} - ${item.file.type || "image"}`;
      body.appendChild(meta);
      card.appendChild(body);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "reference-remove";
      remove.textContent = "x";
      remove.dataset.imageCompressRemoveId = item.id;
      remove.setAttribute("aria-label", `移除 ${item.file.name}`);
      card.appendChild(remove);

      refs.imageCompressFileList.appendChild(card);
    });
  }

  function renderResultList() {
    refs.imageCompressResultList.replaceChildren();
    refs.imageCompressResultEmpty.classList.toggle("hidden", state.imageCompress.results.length > 0);

    state.imageCompress.results.forEach((result) => {
      const card = document.createElement("article");
      card.className = "image-compress-result-card";
      card.dataset.status = result.status;

      if (result.url) {
        const image = document.createElement("img");
        image.src = result.url;
        image.alt = result.fileName;
        image.loading = "lazy";
        card.appendChild(image);
      } else {
        const ghost = document.createElement("div");
        ghost.className = "image-compress-result-ghost";
        ghost.textContent = "!";
        card.appendChild(ghost);
      }

      const body = document.createElement("div");
      body.className = "image-compress-result-body";

      const head = document.createElement("div");
      head.className = "image-compress-result-head";
      const title = document.createElement("strong");
      title.textContent = result.fileName || result.originalName;
      head.appendChild(title);
      if (result.url) {
        const link = document.createElement("a");
        link.className = "toolbar-button";
        link.href = result.url;
        link.download = result.fileName;
        link.textContent = "下载";
        head.appendChild(link);
      }
      body.appendChild(head);

      const meta = document.createElement("span");
      meta.textContent =
        result.status === "error"
          ? result.message
          : `${formatImageCompressSize(result.originalSize)} -> ${formatImageCompressSize(result.outputSize)} - ${result.ratio} - ${result.width}x${result.height}`;
      body.appendChild(meta);
      card.appendChild(body);
      refs.imageCompressResultList.appendChild(card);
    });
  }

  function render() {
    syncModeUi();
    renderFileList();
    renderResultList();
    refs.imageCompressStartButton.disabled = state.imageCompress.running || state.imageCompress.files.length === 0;
    refs.imageCompressStartButton.textContent = state.imageCompress.running ? "压缩中..." : "开始压缩";
    refs.imageCompressClearButton.disabled =
      state.imageCompress.running || (state.imageCompress.files.length === 0 && state.imageCompress.results.length === 0);
  }

  function handleFiles(files) {
    const incomingFiles = [...(files || [])].filter((file) => String(file.type || "").startsWith("image/"));
    if (incomingFiles.length === 0) {
      setFeedback("请选择 JPG / PNG / WebP 等图片文件。", "error");
      return;
    }

    const knownKeys = new Set(state.imageCompress.files.map((item) => item.fingerprint));
    incomingFiles.forEach((file) => {
      const fingerprint = getImageCompressFileKey(file);
      if (knownKeys.has(fingerprint)) {
        return;
      }
      knownKeys.add(fingerprint);
      state.imageCompress.files.push({
        id: `compress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        fingerprint,
        previewUrl: URL.createObjectURL(file),
      });
    });

    refs.imageCompressInput.value = "";
    setFeedback("", "");
    render();
  }

  function removeFile(itemId) {
    const nextFiles = [];
    state.imageCompress.files.forEach((item) => {
      if (item.id === itemId) {
        revokeImageCompressFile(item);
        return;
      }
      nextFiles.push(item);
    });
    state.imageCompress.files = nextFiles;
    render();
  }

  function clearWorkspace() {
    state.imageCompress.files.forEach(revokeImageCompressFile);
    state.imageCompress.results.forEach(revokeImageCompressResult);
    state.imageCompress.files = [];
    state.imageCompress.results = [];
    refs.imageCompressInput.value = "";
    setFeedback("", "");
    render();
  }

  async function runCompression() {
    if (state.imageCompress.files.length === 0) {
      setFeedback("请先上传需要压缩的图片。", "error");
      return;
    }

    state.imageCompress.results.forEach(revokeImageCompressResult);
    state.imageCompress.results = [];
    state.imageCompress.running = true;
    render();

    const options = getOptions();
    for (const [index, item] of state.imageCompress.files.entries()) {
      setFeedback(`正在压缩 ${index + 1} / ${state.imageCompress.files.length}`, "busy");
      try {
        const result = await compressImageFile(item.file, options);
        state.imageCompress.results.push({ ...result, id: item.id, status: "success" });
      } catch (error) {
        state.imageCompress.results.push({
          id: item.id,
          status: "error",
          originalName: item.file.name,
          fileName: item.file.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      render();
    }

    const successCount = state.imageCompress.results.filter((result) => result.status === "success").length;
    const failedCount = state.imageCompress.results.length - successCount;
    state.imageCompress.running = false;
    setFeedback(
      failedCount > 0 ? `完成 ${successCount} 张，失败 ${failedCount} 张。` : `已完成 ${successCount} 张图片压缩。`,
      failedCount > 0 ? "error" : "success",
    );
    render();
  }

  function bindEvents() {
    refs.imageCompressInput.addEventListener("change", (event) => {
      handleFiles(event.target.files);
    });
    refs.imageCompressDropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.imageCompressDropzone.classList.add("dragover");
    });
    refs.imageCompressDropzone.addEventListener("dragleave", () => {
      refs.imageCompressDropzone.classList.remove("dragover");
    });
    refs.imageCompressDropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.imageCompressDropzone.classList.remove("dragover");
      handleFiles(event.dataTransfer?.files);
    });
    refs.imageCompressFileList.addEventListener("click", (event) => {
      const target = event.target.closest("[data-image-compress-remove-id]");
      if (target) {
        removeFile(target.dataset.imageCompressRemoveId);
      }
    });
    refs.imageCompressModeInput.addEventListener("change", render);
    refs.imageCompressQualityInput.addEventListener("input", render);
    refs.imageCompressFormatInput.addEventListener("change", render);
    refs.imageCompressTargetInput.addEventListener("input", render);
    refs.imageCompressResizeEnabledInput.addEventListener("change", render);
    refs.imageCompressResizeWidthInput.addEventListener("input", render);
    refs.imageCompressResizeHeightInput.addEventListener("input", render);
    refs.imageCompressClearButton.addEventListener("click", clearWorkspace);
    refs.imageCompressStartButton.addEventListener("click", () => {
      runCompression().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setFeedback(message, "error");
        showError?.(message);
      });
    });
  }

  bindEvents();

  return {
    render,
    runCompression,
  };
}

export function mountView(options = {}) {
  if (!hasImageCompressContext(options) && typeof document === "undefined") {
    return createViewRendererController({
      ...options,
      view: options.view || "image-compress",
      rendererKey: "imageCompress",
    });
  }

  const refs = options.refs || getImageCompressRefs();
  const state = options.state?.imageCompress || createImageCompressState();

  if (!hasImageCompressContext({ refs, state: { imageCompress: state } })) {
    return createViewRendererController({
      ...options,
      view: options.view || "image-compress",
      rendererKey: "imageCompress",
    });
  }

  const controller = createImageCompressController({ ...options, refs, state: { imageCompress: state } });
  return {
    view: options.view || "image-compress",
    loaded: true,
    renderView() {
      controller.render();
      return true;
    },
    renderImageCompressView: controller.render,
  };
}
