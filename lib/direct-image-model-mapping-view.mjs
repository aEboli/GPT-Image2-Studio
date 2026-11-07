import { IMAGE_TOOL_MODEL_OPTIONS } from "./model-defaults.mjs";
import { normalizeDirectImageModelMappings } from "./direct-image-model-mapping.mjs";

export function createDirectImageModelMappingView({ root, getSelectedModel = () => "", onChange = () => {} } = {}) {
  const documentRef = root.ownerDocument;
  const container = root.querySelector("[data-mapping-rows]");
  const candidates = root.querySelector("[data-mapping-candidates]");
  const feedback = root.querySelector("[data-mapping-feedback]");
  let rows = [];
  let fetchedModels = [];

  function refreshCandidates() {
    const values = [...IMAGE_TOOL_MODEL_OPTIONS, ...fetchedModels, getSelectedModel(), ...rows.flatMap(({ source, target }) => [source.value, target.value])];
    const options = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].map((value) => {
      const option = documentRef.createElement("option");
      option.value = value;
      return option;
    });
    candidates.replaceChildren(...options);
  }

  function clearFeedback() {
    feedback.textContent = "";
    for (const row of rows) {
      row.source.setCustomValidity("");
      row.target.setCustomValidity("");
    }
  }

  function changed() {
    clearFeedback();
    refreshCandidates();
    onChange();
  }

  function addRow(value = {}, focus = false) {
    const element = documentRef.createElement("div");
    element.className = "direct-image-model-mapping-row";
    const inputs = ["source", "target"].map((side) => {
      const input = documentRef.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = value[side] || "";
      input.title = input.value;
      input.placeholder = side === "source" ? "请求模型" : "实际请求模型";
      input.setAttribute("aria-label", side === "source" ? "请求模型" : "实际请求模型");
      input.setAttribute("list", candidates.id);
      input.addEventListener("input", () => { input.title = input.value; changed(); });
      return input;
    });
    const arrow = documentRef.createElement("span");
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    const remove = documentRef.createElement("button");
    remove.type = "button";
    remove.className = "inline-button";
    remove.textContent = "删除";
    remove.setAttribute("aria-label", "删除这条生图模型映射");
    const row = { element, source: inputs[0], target: inputs[1] };
    remove.addEventListener("click", () => {
      const index = rows.indexOf(row);
      rows = rows.filter((entry) => entry !== row);
      element.remove();
      (rows[index]?.source || rows[index - 1]?.source || root.querySelector("[data-mapping-add]")).focus();
      changed();
    });
    element.append(inputs[0], arrow, inputs[1], remove);
    rows.push(row);
    container.appendChild(element);
    if (focus) inputs[0].focus();
  }

  root.querySelector("[data-mapping-add]").addEventListener("click", () => { addRow({}, true); changed(); });
  refreshCandidates();

  return {
    read({ validate = false } = {}) {
      const drafts = rows.map(({ source, target }) => ({ source: source.value.trim(), target: target.value.trim() }));
      if (validate) {
        clearFeedback();
        try {
          return normalizeDirectImageModelMappings(drafts);
        } catch (error) {
          feedback.textContent = error.message;
          const sources = new Set();
          for (let index = 0; index < drafts.length; index++) {
            const { source, target } = drafts[index];
            if (!source && !target) continue;
            const input = !source ? rows[index].source : !target ? rows[index].target : sources.has(source) ? rows[index].source : null;
            if (input) { input.setCustomValidity(error.message); input.focus(); break; }
            sources.add(source);
          }
          throw error;
        }
      }
      // 编辑中的草稿留在控件里；只有完整、不冲突的规则参与即时能力预览。
      const sources = new Set();
      return drafts.filter(({ source, target }) => {
        if (!source || !target || sources.has(source)) return false;
        sources.add(source);
        return true;
      });
    },
    write(value) {
      const mappings = normalizeDirectImageModelMappings(value);
      rows = [];
      container.replaceChildren();
      for (const mapping of mappings) addRow(mapping);
      clearFeedback();
      refreshCandidates();
    },
    setCandidates(models) {
      fetchedModels = Array.isArray(models) ? [...models] : [];
      refreshCandidates();
    },
    refreshCandidates,
  };
}
