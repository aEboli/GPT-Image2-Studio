export function createPortraitReferenceAnalysisController({
  state,
  appendCurrentConfigToFormData,
  buildReferenceFingerprint,
  compactErrorMessage,
  renderPortraitView,
  showError,
  fetchImpl = globalThis.fetch,
} = {}) {
  const refs = {
    analyzeButton: document.querySelector("#portraitReferenceAnalyzeButton"),
    applyButton: document.querySelector("#portraitReferenceApplyAnalysisButton"),
    feedback: document.querySelector("#portraitReferenceAnalysisFeedback"),
    panel: document.querySelector("#portraitReferenceAnalysisPanel"),
    subjectSummaryInput: document.querySelector("#portraitSubjectSummaryInput"),
  };
  let requestToken = 0;
  let abortController = null;

  function getSnapshot() {
    const getFingerprints = (items = []) => items.map((item) => (
      item.fingerprint || buildReferenceFingerprint(item.file)
    ));
    return JSON.stringify({
      person: getFingerprints(state.portrait.files),
      action: getFingerprints(state.portrait.actionFiles),
      accessory: getFingerprints(state.portrait.accessoryFiles),
    });
  }

  function invalidate({ clearResult = false } = {}) {
    abortController?.abort();
    abortController = null;
    requestToken += 1;
    state.portrait.referenceAnalysis.running = false;
    if (clearResult) {
      state.portrait.referenceAnalysis.result = null;
      state.portrait.referenceAnalysis.applied = false;
    }
  }

  function setFeedback(message = "", kind = "") {
    if (!refs.feedback) return;
    refs.feedback.textContent = message;
    refs.feedback.dataset.state = kind;
  }

  function buildFormData() {
    const formData = new FormData();
    state.portrait.files.forEach((item) => formData.append("portraitReferenceImages", item.file));
    state.portrait.actionFiles.forEach((item) => formData.append("portraitActionReferenceImages", item.file));
    state.portrait.accessoryFiles.forEach((item) => formData.append("portraitAccessoryReferenceImages", item.file));
    formData.set("reasoningEffort", "low");
    appendCurrentConfigToFormData(formData);
    return formData;
  }

  function buildSubjectSummary(analysis = {}) {
    const details = [
      analysis.visiblePresentation,
      analysis.heightImpression,
      analysis.bodyBuild,
      analysis.pose,
      analysis.clothing,
      analysis.hair,
      analysis.faceVisibility,
      ...(Array.isArray(analysis.distinctVisibleFeatures) ? analysis.distinctVisibleFeatures : []),
    ].map((value) => String(value || "").trim()).filter((value) => value && value !== "unclear");
    return [String(analysis.summary || "").trim(), details.join("；")].filter(Boolean).join("。 ").slice(0, 900);
  }

  function render() {
    const analysisState = state.portrait.referenceAnalysis;
    const analysis = analysisState.result;
    if (refs.analyzeButton) {
      refs.analyzeButton.disabled = analysisState.running || state.portrait.files.length === 0;
      refs.analyzeButton.textContent = analysisState.running ? "分析中..." : "分析人物参考图";
    }
    if (refs.applyButton) refs.applyButton.disabled = analysisState.running || !analysis;
    if (!refs.panel) return;
    refs.panel.classList.toggle("hidden", !analysis);
    refs.panel.replaceChildren();
    if (!analysis) return;
    const rows = [
      ["分析摘要", analysis.summary], ["外观呈现", analysis.visiblePresentation],
      ["身高印象", analysis.heightImpression], ["体型印象", analysis.bodyBuild],
      ["姿态", analysis.pose], ["服装", analysis.clothing], ["发型", analysis.hair],
      ["面部可见度", analysis.faceVisibility],
      ["可见特征", Array.isArray(analysis.distinctVisibleFeatures) ? analysis.distinctVisibleFeatures.join("、") : ""],
      ["安全说明", analysis.safety], ["置信度", analysis.confidence],
    ].filter(([, value]) => String(value || "").trim());
    rows.forEach(([label, value]) => {
      const row = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}：`;
      row.append(strong, document.createTextNode(String(value)));
      refs.panel.appendChild(row);
    });
  }

  async function analyze() {
    if (state.portrait.files.length === 0) {
      setFeedback("请先上传人物参考图。", "error");
      return;
    }
    const currentToken = requestToken + 1;
    requestToken = currentToken;
    abortController?.abort();
    const requestController = new AbortController();
    abortController = requestController;
    const snapshot = getSnapshot();
    state.portrait.referenceAnalysis.running = true;
    state.portrait.referenceAnalysis.applied = false;
    setFeedback("正在分析写真任务参考图...", "busy");
    renderPortraitView();
    try {
      const response = await fetchImpl("/api/portrait/reference/analyze", {
        method: "POST",
        signal: requestController.signal,
        body: buildFormData(),
      });
      const payload = await response.json().catch(() => ({}));
      if (currentToken !== requestToken || snapshot !== getSnapshot()) return;
      if (!response.ok) throw new Error(payload.message || "人物参考图分析失败。");
      state.portrait.referenceAnalysis.result = payload.analysis || {};
      setFeedback("分析草稿已生成，确认后应用到人物描述。", "success");
    } catch (error) {
      if (currentToken !== requestToken || snapshot !== getSnapshot()) return;
      const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "人物参考图分析失败");
      setFeedback(message, "error");
      showError(message);
    } finally {
      if (currentToken === requestToken) {
        abortController = null;
        state.portrait.referenceAnalysis.running = false;
        renderPortraitView();
      }
    }
  }

  function apply() {
    const analysis = state.portrait.referenceAnalysis.result;
    if (!analysis) return;
    const summary = buildSubjectSummary(analysis);
    if (summary && refs.subjectSummaryInput) refs.subjectSummaryInput.value = summary;
    state.portrait.referenceAnalysis.applied = true;
    state.portrait.currentSet = null;
    setFeedback("分析草稿已应用，可继续编辑人物描述。", "success");
    renderPortraitView();
  }

  return { analyze, apply, invalidate, render, setFeedback };
}
