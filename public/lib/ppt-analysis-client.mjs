function findOption(select, value) {
  return [...(select?.options || [])].find((entry) => entry.value === value) || null;
}

function createPptAnalyzeMotion() {
  const motion = document.createElement("span");
  motion.className = "inline-busy-motion";
  motion.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    motion.appendChild(document.createElement("span"));
  }
  return motion;
}

export function createPptAnalysisController({
  state,
  buildFormData,
  compactErrorMessage,
  renderPptView,
} = {}) {
  const refs = {
    analyzeButton: document.querySelector("#pptAnalyzeButton"),
    feedback: document.querySelector("#pptAnalysisFeedback"),
    meta: document.querySelector("#pptAnalysisMeta"),
    pageCountInput: document.querySelector("#pptPageCountInput"),
    panel: document.querySelector("#pptAnalysisPanel"),
    sections: document.querySelector("#pptAnalysisSections"),
    sourceModeInputs: [...document.querySelectorAll("input[name=\"pptSourceMode\"]")],
    sourceTextInput: document.querySelector("#pptSourceTextInput"),
    stylePresetInput: document.querySelector("#pptStylePresetInput"),
    summary: document.querySelector("#pptAnalysisSummary"),
    topicInput: document.querySelector("#pptTopicInput"),
  };
  const model = { analysis: null, analyzing: false };

  function setFeedback(message = "", kind = "") {
    refs.feedback.textContent = message ? compactErrorMessage(message, "PPT 文档分析失败") : "";
    refs.feedback.dataset.state = kind;
  }

  function clear() {
    model.analysis = null;
    setFeedback("");
  }

  function hasInput() {
    return (
      state.ppt.files.length > 0 ||
      refs.sourceTextInput.value.trim().length > 0 ||
      refs.topicInput.value.trim().length > 0
    );
  }

  function applyResult(analysis = {}) {
    const recommendedPageCount = Number.parseInt(String(analysis.recommendedPageCount || ""), 10);
    if (Number.isFinite(recommendedPageCount) && recommendedPageCount >= 1 && recommendedPageCount <= 20) {
      refs.pageCountInput.value = String(recommendedPageCount);
    }

    const recommendedStylePreset = String(analysis.recommendedStylePreset || "").trim();
    if (findOption(refs.stylePresetInput, recommendedStylePreset)) {
      refs.stylePresetInput.value = recommendedStylePreset;
    }
  }

  async function readAnalysisResponsePayload(response) {
    const text = await response.text().catch(() => "");
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return { rawText: text };
    }
  }

  async function requestAnalysis() {
    const response = await fetch("/api/ppt/analyze", { method: "POST", body: buildFormData() });
    const payload = await readAnalysisResponsePayload(response);
    if (!response.ok || payload.ok === false) {
      if (response.status === 404 || response.status === 405) {
        throw new Error("PPT 分析接口不可用，请重启本地服务后再试。");
      }
      throw new Error(payload.message || `PPT 文档分析失败${response.status ? `：HTTP ${response.status}` : ""}`);
    }
    return payload.analysis || payload;
  }

  async function analyze() {
    if (state.ppt.generating || model.analyzing) return;
    if (!hasInput()) {
      setFeedback("请先上传文档、输入文本或输入主题。", "error");
      return;
    }

    model.analyzing = true;
    model.analysis = null;
    setFeedback("正在分析文档...", "busy");
    renderPptView();

    try {
      const analysis = await requestAnalysis();
      model.analysis = analysis;
      applyResult(analysis);
      setFeedback("已根据文档内容更新页数和视觉风格。", "success");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error), "error");
    } finally {
      model.analyzing = false;
      renderPptView();
    }
  }

  function render() {
    const analysis = model.analysis;
    refs.analyzeButton.disabled = state.ppt.generating || model.analyzing;
    refs.analyzeButton.classList.toggle("is-loading", model.analyzing);
    refs.analyzeButton.setAttribute("aria-busy", String(model.analyzing));
    if (model.analyzing) {
      if (!refs.analyzeButton.dataset.busyMinWidth) {
        const width = Math.ceil(refs.analyzeButton.offsetWidth || 0);
        if (width > 0) {
          refs.analyzeButton.dataset.busyMinWidth = `${width}px`;
        }
      }
      if (refs.analyzeButton.dataset.busyMinWidth) {
        refs.analyzeButton.style.minWidth = refs.analyzeButton.dataset.busyMinWidth;
      }
      refs.analyzeButton.replaceChildren("分析中", createPptAnalyzeMotion());
    } else {
      delete refs.analyzeButton.dataset.busyMinWidth;
      refs.analyzeButton.style.minWidth = "";
      refs.analyzeButton.replaceChildren("分析文档");
    }
    refs.panel.classList.toggle("hidden", !analysis);

    if (!analysis) {
      refs.summary.textContent = "";
      refs.meta.textContent = "";
      refs.sections.innerHTML = "";
      return;
    }

    const pageCount = Number(analysis.recommendedPageCount) || Number(refs.pageCountInput.value) || 0;
    const styleLabel = analysis.recommendedStyleLabel || analysis.recommendedStylePreset || refs.stylePresetInput.value;
    refs.summary.textContent = analysis.summary || "已完成文档拆分分析。";
    refs.meta.textContent = `${pageCount} 页 · ${styleLabel} · ${analysis.rationale || "已更新下方建议参数。"}`;
    refs.sections.innerHTML = "";
    (Array.isArray(analysis.sections) ? analysis.sections : []).forEach((section) => {
      const item = document.createElement("li");
      item.textContent = `${section.title || "未命名段落"}：${section.keyMessage || ""}（${section.suggestedSlides || 1} 页）`;
      refs.sections.appendChild(item);
    });
  }

  function bind() {
    refs.analyzeButton.addEventListener("click", () => {
      analyze().catch((error) => setFeedback(error.message, "error"));
    });
    [...refs.sourceModeInputs, refs.sourceTextInput, refs.topicInput].forEach((input) => {
      input.addEventListener("input", () => {
        clear();
        renderPptView();
      });
      input.addEventListener("change", () => {
        clear();
        renderPptView();
      });
    });
  }

  return { analyze, bind, clear, hasInput, render };
}
