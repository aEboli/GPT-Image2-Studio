import { consumeSse, requestGenerationStream } from "/lib/generation-client.mjs";

const MODE = "product-image-agent";
const MAX_FILES = 15;
const MAX_GENERATION_REFERENCES = 6;
const MAX_TASKS = 24;
const VALID_RATIOS = new Set(["1:1", "4:5", "5:4", "16:9", "9:16", "4:3", "3:4"]);

const WORKSPACES = Object.freeze([
  { id: "ecommerce", label: "电商商品页", hint: "ecommerce storefront", note: "商品列表、详情页、卖点图" },
  { id: "social", label: "社交种草", hint: "social content", note: "笔记、动态、短视频封面" },
  { id: "ads", label: "广告投放", hint: "paid advertising", note: "信息流、展示广告、落地页" },
  { id: "brand", label: "官网品牌页", hint: "brand website", note: "官网首屏、商品页、邮件专题" },
]);

const CHANNELS = Object.freeze([
  { id: "amazon", label: "Amazon 商品页", hint: "Amazon product listing", note: "列表主图与详情图", spaces: ["ecommerce"], ratio: "1:1" },
  { id: "temu", label: "Temu 商品页", hint: "Temu product listing", note: "列表主图与详情图", spaces: ["ecommerce"], ratio: "1:1" },
  { id: "tiktok", label: "TikTok Shop", hint: "TikTok Shop vertical commerce", note: "短视频电商商品图", spaces: ["ecommerce", "social"], ratio: "4:5" },
  { id: "xiaohongshu", label: "小红书笔记", hint: "Xiaohongshu lifestyle post", note: "种草笔记封面与配图", spaces: ["social"], ratio: "3:4" },
  { id: "instagram", label: "Instagram 动态", hint: "Instagram feed and story", note: "动态与广告配图", spaces: ["social", "ads"], ratio: "4:5" },
  { id: "ad-network", label: "广告信息流", hint: "performance ad creative", note: "信息流投放素材", spaces: ["ads"], ratio: "1:1" },
  { id: "website", label: "官网 / Shopify", hint: "website hero banner", note: "首页与商品页横幅", spaces: ["brand"], ratio: "16:9" },
]);

const DIRECTIONS = Object.freeze([
  { id: "hero", label: "主视觉", hint: "hero product image", note: "先让人看清商品", keywords: ["hero", "main", "主视觉", "主图"] },
  { id: "feature", label: "卖点展示", hint: "single feature demonstration", note: "一张图讲一个优势", keywords: ["feature", "benefit", "卖点"] },
  { id: "lifestyle", label: "使用场景", hint: "authentic lifestyle usage scene", note: "展示商品怎么使用", keywords: ["scene", "lifestyle", "usage", "场景", "使用"] },
  { id: "detail", label: "细节特写", hint: "product material and detail close-up", note: "放大结构、材质或接口", keywords: ["detail", "material", "close", "细节", "材质"] },
]);

const DEFAULT_SELECTION = Object.freeze({
  spaces: ["ecommerce", "social"],
  channels: ["amazon", "tiktok", "xiaohongshu"],
  directions: ["hero", "feature", "lifestyle"],
});

const state = {
  files: [],
  analysis: null,
  tasks: [],
  outputs: new Map(),
  analyzing: false,
  generatingAll: false,
  sessionId: "",
  selectedSpaces: new Set(DEFAULT_SELECTION.spaces),
  selectedChannels: new Set(DEFAULT_SELECTION.channels),
  selectedDirections: new Set(DEFAULT_SELECTION.directions),
};

let refs = null;
let mounted = false;
let appendCurrentConfig = () => {};

function getRefs() {
  return {
    analyzeButton: document.querySelector("#productAgentAnalyzeButton"),
    boardMeta: document.querySelector("#productAgentBoardMeta"),
    channelOptions: document.querySelector("#productAgentChannelOptions"),
    clearButton: document.querySelector("#productAgentClearButton"),
    contextInput: document.querySelector("#productAgentContextInput"),
    directionOptions: document.querySelector("#productAgentDirectionOptions"),
    dropzone: document.querySelector("#productAgentDropzone"),
    empty: document.querySelector("#productAgentEmpty"),
    feedback: document.querySelector("#productAgentFeedback"),
    generateAllButton: document.querySelector("#productAgentGenerateAllButton"),
    input: document.querySelector("#productAgentInput"),
    analysis: document.querySelector("#productAgentAnalysis"),
    insightGrid: document.querySelector("#productAgentInsightGrid"),
    outputPanel: document.querySelector("#productAgentOutputPanel"),
    planList: document.querySelector("#productAgentPlanList"),
    referenceCount: document.querySelector("#productAgentReferenceCount"),
    referenceGrid: document.querySelector("#productAgentReferenceGrid"),
    resetRoutingButton: document.querySelector("#productAgentResetRoutingButton"),
    riskBox: document.querySelector("#productAgentRiskBox"),
    routingSummary: document.querySelector("#productAgentRoutingSummary"),
    spaceOptions: document.querySelector("#productAgentSpaceOptions"),
    taskCount: document.querySelector("#productAgentTaskCount"),
    workbenchGrid: document.querySelector("#productAgentWorkbenchGrid"),
  };
}

function setFeedback(message, tone = "") {
  if (!refs?.feedback) return;
  refs.feedback.textContent = message || "";
  refs.feedback.dataset.tone = tone;
}

function getSessionId() {
  if (!state.sessionId) {
    state.sessionId = globalThis.crypto?.randomUUID?.() || `product-agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return state.sessionId;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeAnalysis(payload) {
  const source = payload?.item?.json || payload?.analysis || payload || {};
  const summary = source.product_summary || source.productSummary || {};
  const plans = toArray(source.image_plans || source.imagePlans).map((plan, index) => ({
    id: text(plan?.id, `plan-${String(index + 1).padStart(2, "0")}`),
    title: text(plan?.title, `图片计划 ${index + 1}`),
    purpose: text(plan?.purpose),
    marketing_angle: text(plan?.marketing_angle || plan?.marketingAngle),
    reference_image_indexes: toArray(plan?.reference_image_indexes || plan?.referenceImageIndexes)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= MAX_FILES),
    aspect_ratio: VALID_RATIOS.has(text(plan?.aspect_ratio || plan?.aspectRatio))
      ? text(plan?.aspect_ratio || plan?.aspectRatio)
      : "1:1",
    prompt_en: text(plan?.prompt_en || plan?.promptEn),
    prompt_zh: text(plan?.prompt_zh || plan?.promptZh),
    avoid_en: toArray(plan?.avoid_en || plan?.avoidEn).map((value) => text(value)).filter(Boolean),
    avoid_zh: toArray(plan?.avoid_zh || plan?.avoidZh).map((value) => text(value)).filter(Boolean),
  }));

  return {
    product_summary: {
      product_type: text(summary.product_type || summary.productType, "未确认商品类型"),
      visible_facts: toArray(summary.visible_facts || summary.visibleFacts).map((value) => text(value)).filter(Boolean),
      differentiation: toArray(summary.differentiation).map((value) => text(value)).filter(Boolean),
    },
    pain_points: toArray(source.pain_points || source.painPoints),
    selling_points: toArray(source.selling_points || source.sellingPoints),
    target_audiences: toArray(source.target_audiences || source.targetAudiences),
    usage_scenarios: toArray(source.usage_scenarios || source.usageScenarios),
    image_plans: plans,
    risks: toArray(source.risks).map((value) => text(value)).filter(Boolean),
  };
}

function getSelection(group) {
  if (group === "space") return state.selectedSpaces;
  if (group === "channel") return state.selectedChannels;
  return state.selectedDirections;
}

function createSelectionOption(group, option, selected) {
  const wrapper = document.createElement("label");
  wrapper.className = "product-agent-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = selected;
  input.dataset.productAgentOption = group;
  input.value = option.id;
  const copy = document.createElement("span");
  copy.className = "product-agent-option-copy";
  const label = document.createElement("strong");
  label.textContent = option.label;
  const note = document.createElement("small");
  note.textContent = [option.note, option.ratio].filter(Boolean).join(" · ");
  copy.append(label, note);
  wrapper.append(input, copy);
  return wrapper;
}

function renderSelectionOptions() {
  const optionGroups = [
    [refs.spaceOptions, "space", WORKSPACES],
    [refs.channelOptions, "channel", CHANNELS],
    [refs.directionOptions, "direction", DIRECTIONS],
  ];
  optionGroups.forEach(([container, group, options]) => {
    if (!container) return;
    container.replaceChildren();
    const selected = getSelection(group);
    options.forEach((option) => container.append(createSelectionOption(group, option, selected.has(option.id))));
  });
}

function renderReferenceGrid() {
  refs.referenceGrid.replaceChildren();
  refs.referenceCount.textContent = `${state.files.length} / ${MAX_FILES}`;
  state.files.forEach((entry, index) => {
    const card = document.createElement("div");
    card.className = "product-agent-reference-card";
    const image = document.createElement("img");
    image.src = entry.previewUrl;
    image.alt = `母图 ${index + 1}`;
    const meta = document.createElement("span");
    meta.textContent = `${index + 1}. ${entry.file.name}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "product-agent-reference-remove";
    remove.dataset.productAgentRemove = String(index);
    remove.textContent = "移除";
    card.append(image, meta, remove);
    refs.referenceGrid.append(card);
  });
}

function createTextList(title, values) {
  const section = document.createElement("section");
  section.className = "product-agent-insight-card";
  const heading = document.createElement("h4");
  heading.textContent = title;
  section.append(heading);
  const list = document.createElement("ul");
  values.filter(Boolean).slice(0, 4).forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
  if (list.children.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "暂无可确认信息";
    section.append(empty);
  } else {
    section.append(list);
  }
  return section;
}

function renderInsights(analysis) {
  refs.insightGrid.replaceChildren();
  const summary = analysis.product_summary;
  refs.insightGrid.append(
    createTextList("母图识别", [summary.product_type, ...summary.visible_facts]),
    createTextList("可用证据", summary.differentiation),
  );
  refs.riskBox.classList.toggle("hidden", analysis.risks.length === 0);
  refs.riskBox.replaceChildren();
  if (analysis.risks.length > 0) {
    const title = document.createElement("strong");
    title.textContent = "需人工确认";
    const list = document.createElement("ul");
    analysis.risks.slice(0, 4).forEach((risk) => {
      const item = document.createElement("li");
      item.textContent = risk;
      list.append(item);
    });
    refs.riskBox.append(title, list);
  }
}

function createReferenceLabel(index) {
  const image = state.files[index - 1];
  return image ? `${index}. ${image.file.name}` : `参考图 ${index}`;
}

function findPlanForDirection(plans, direction, index) {
  const match = plans.find((plan) => {
    const haystack = `${plan.title} ${plan.purpose} ${plan.marketing_angle}`.toLowerCase();
    return direction.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
  return match || plans[index % plans.length];
}

function buildTaskPrompt({ plan, space, channel, direction }) {
  const basePrompt = plan.prompt_en || "Create a faithful product image using the supplied reference images.";
  const avoid = plan.avoid_en.length > 0 ? ` Avoid: ${plan.avoid_en.join(", ")}.` : "";
  return [
    basePrompt,
    `Adapt this creative for the ${space.hint} and ${channel.hint}.`,
    `Create a ${direction.hint} in a ${channel.ratio} aspect ratio.`,
    "Keep the exact product identity, visible structure, color, included items, and reference evidence unchanged.",
    "VISIBLE CANVAS TEXT: All text outside product/packaging is English in Latin letters. Rebuild corner text; never copy non-Latin glyphs. Erase unclear text.",
    "Treat standalone reference graphics as layout evidence, not product identity. Keep source-language text only when physically printed on the product itself. If a source phrase cannot be translated reliably, use a concise evidence-based English equivalent or omit it.",
    "Do not add invented claims or extra products.",
    avoid,
  ].filter(Boolean).join(" ");
}

function buildTasks() {
  const plans = state.analysis?.image_plans || [];
  const spaces = WORKSPACES.filter((space) => state.selectedSpaces.has(space.id));
  const channels = CHANNELS.filter((channel) => state.selectedChannels.has(channel.id));
  const directions = DIRECTIONS.filter((direction) => state.selectedDirections.has(direction.id));
  const tasks = [];
  let index = 0;
  spaces.forEach((space) => {
    channels.filter((channel) => channel.spaces.includes(space.id)).forEach((channel) => {
      directions.forEach((direction) => {
        const plan = findPlanForDirection(plans, direction, index);
        tasks.push({
          id: `task-${space.id}-${channel.id}-${direction.id}`,
          plan,
          space,
          channel,
          direction,
          prompt: buildTaskPrompt({ plan, space, channel, direction }),
        });
        index += 1;
      });
    });
  });
  return tasks.slice(0, MAX_TASKS);
}

function updateRoutingSummary() {
  const spaces = WORKSPACES.filter((space) => state.selectedSpaces.has(space.id));
  const channels = CHANNELS.filter((channel) => state.selectedChannels.has(channel.id));
  const directions = DIRECTIONS.filter((direction) => state.selectedDirections.has(direction.id));
  const pairs = spaces.flatMap((space) => channels.filter((channel) => channel.spaces.includes(space.id)));
  const count = pairs.length * directions.length;
  if (!spaces.length || !channels.length || !directions.length) {
    refs.routingSummary.textContent = "至少选择一个内容用途、一个发布渠道和一个画面方向。";
  } else if (!pairs.length) {
    refs.routingSummary.textContent = "当前内容用途与发布渠道没有可匹配的组合。";
  } else {
    refs.routingSummary.textContent = `将生成 ${Math.min(count, MAX_TASKS)} 个任务${count > MAX_TASKS ? `（上限 ${MAX_TASKS} 个）` : ""}。`;
  }
}

function rebuildTasks({ clearOutputs = true } = {}) {
  if (clearOutputs) state.outputs.clear();
  state.tasks = state.analysis ? buildTasks() : [];
  updateRoutingSummary();
}

function renderTaskCard(task) {
  const output = state.outputs.get(task.id) || { status: "idle", dataUrl: "", error: "" };
  const card = document.createElement("article");
  card.className = "product-agent-plan-card";
  card.dataset.productAgentTask = task.id;

  const head = document.createElement("div");
  head.className = "product-agent-plan-head";
  const titleWrap = document.createElement("div");
  const title = document.createElement("h4");
  title.textContent = `${task.space.label} · ${task.channel.label}`;
  const purpose = document.createElement("p");
  purpose.textContent = `${task.direction.label} · ${task.direction.note}`;
  titleWrap.append(title, purpose);
  const ratio = document.createElement("span");
  ratio.className = "count-pill small";
  ratio.textContent = task.channel.ratio;
  head.append(titleWrap, ratio);

  const source = document.createElement("div");
  source.className = "product-agent-plan-references";
  const sourceLabel = document.createElement("span");
  sourceLabel.textContent = "母图";
  source.append(sourceLabel);
  const indexes = task.plan.reference_image_indexes.length > 0
    ? task.plan.reference_image_indexes.slice(0, MAX_GENERATION_REFERENCES)
    : state.files.slice(0, MAX_GENERATION_REFERENCES).map((_entry, index) => index + 1);
  indexes.forEach((refIndex) => {
    const chip = document.createElement("span");
    chip.textContent = createReferenceLabel(refIndex);
    source.append(chip);
  });

  const details = document.createElement("details");
  details.className = "product-agent-prompt-details";
  const summary = document.createElement("summary");
  summary.textContent = "查看本格生成指令";
  const prompt = document.createElement("p");
  prompt.textContent = task.prompt;
  details.append(summary, prompt);

  const actions = document.createElement("div");
  actions.className = "product-agent-plan-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "inline-button";
  copy.dataset.productAgentCopy = task.id;
  copy.textContent = "复制指令";
  const generate = document.createElement("button");
  generate.type = "button";
  generate.className = "generate-button";
  generate.dataset.productAgentGenerate = task.id;
  generate.disabled = output.status === "generating";
  generate.textContent = output.status === "generating" ? "生成中…" : output.status === "completed" ? "重新生成" : "生成此格";
  actions.append(copy, generate);

  const status = document.createElement("p");
  status.className = "product-agent-plan-status";
  status.textContent = output.error || (output.status === "generating" ? "正在调用图片模型…" : output.status === "completed" ? "已生成，可下载或继续重做。" : "等待生成");

  card.append(head, source, details, actions, status);
  if (output.dataUrl) {
    const result = document.createElement("div");
    result.className = "product-agent-result-image-wrap";
    const image = document.createElement("img");
    image.src = output.dataUrl;
    image.alt = `${task.space.label}${task.channel.label}${task.direction.label}生成结果`;
    const download = document.createElement("a");
    download.className = "inline-button";
    download.href = output.dataUrl;
    download.download = `${task.id}.png`;
    download.textContent = "下载图片";
    result.append(image, download);
    card.append(result);
  }
  return card;
}

function renderTaskBoard() {
  refs.planList.replaceChildren();
  state.tasks.forEach((task) => refs.planList.append(renderTaskCard(task)));
  refs.taskCount.textContent = `${state.tasks.length} 个任务`;
  refs.boardMeta.textContent = state.tasks.length
    ? `${state.tasks.length} 个裂变格子，支持单格生成、重做和下载。`
    : "当前选择没有形成可执行任务。";
}

function render() {
  if (!refs) return;
  renderReferenceGrid();
  renderSelectionOptions();
  const hasAnalysis = Boolean(state.analysis);
  refs.outputPanel?.classList.toggle("hidden", !hasAnalysis);
  refs.workbenchGrid?.classList.toggle("has-analysis", hasAnalysis);
  refs.analyzeButton.disabled = state.analyzing || state.files.length === 0;
  refs.clearButton.disabled = state.files.length === 0;
  refs.generateAllButton.disabled = state.generatingAll || !state.tasks.length;
  refs.empty.classList.toggle("hidden", Boolean(state.analysis));
  refs.analysis.classList.toggle("hidden", !state.analysis);
  if (!state.analysis) {
    refs.insightGrid.replaceChildren();
    refs.planList.replaceChildren();
    refs.riskBox.classList.add("hidden");
    refs.taskCount.textContent = "0 个任务";
    refs.boardMeta.textContent = "每个格子都是一个可单独生成、重做和下载的任务。";
    updateRoutingSummary();
    return;
  }
  renderInsights(state.analysis);
  renderTaskBoard();
}

function clearFiles() {
  state.files.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
  state.files = [];
  state.analysis = null;
  state.tasks = [];
  state.outputs.clear();
  setFeedback("");
  render();
}

function addFiles(fileList) {
  const incoming = [...(fileList || [])].filter((file) => file?.type?.startsWith("image/"));
  if (incoming.length === 0) {
    setFeedback("请选择图片文件。", "error");
    return;
  }
  const remaining = MAX_FILES - state.files.length;
  const accepted = incoming.slice(0, Math.max(0, remaining));
  if (accepted.length < incoming.length) {
    setFeedback(`最多上传 ${MAX_FILES} 张图片，已忽略多余文件。`, "error");
  } else {
    setFeedback("");
  }
  accepted.forEach((file) => state.files.push({ file, previewUrl: URL.createObjectURL(file) }));
  state.analysis = null;
  state.tasks = [];
  state.outputs.clear();
  render();
}

async function analyze() {
  if (state.analyzing || state.files.length === 0) return;
  state.analyzing = true;
  state.analysis = null;
  state.tasks = [];
  state.outputs.clear();
  setFeedback("正在读取母图并建立裂变草案…", "busy");
  render();
  try {
    const formData = new FormData();
    formData.set("mode", MODE);
    formData.set("targetLanguage", "en");
    formData.set("targetLanguageLabel", "English prompts with Simplified Chinese counterparts");
    formData.set("contextPrompt", refs.contextInput.value.trim());
    state.files.forEach((entry) => formData.append("referenceImages", entry.file));
    appendCurrentConfig(formData);
    const response = await fetch("/api/prompt-agent/analyze", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "母图分析失败。");
    state.analysis = normalizeAnalysis(payload);
    if (state.analysis.image_plans.length === 0) throw new Error("没有得到可执行的裂变基础方案，请补充母图或目标后重试。");
    rebuildTasks();
    setFeedback(`草案已建立，已形成 ${state.tasks.length} 个裂变任务。`, "success");
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : String(error), "error");
  } finally {
    state.analyzing = false;
    render();
  }
}

async function generateTask(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task || state.outputs.get(task.id)?.status === "generating") return;
  const selectedIndexes = task.plan.reference_image_indexes.length > 0
    ? task.plan.reference_image_indexes.slice(0, MAX_GENERATION_REFERENCES)
    : state.files.slice(0, MAX_GENERATION_REFERENCES).map((_entry, index) => index + 1);
  const referenceFiles = selectedIndexes.map((refIndex) => state.files[refIndex - 1]?.file).filter(Boolean);
  const output = { status: "generating", dataUrl: "", error: "" };
  state.outputs.set(task.id, output);
  render();
  try {
    const formData = new FormData();
    formData.set("jobId", `${MODE}-${task.id}-${Date.now()}`);
    formData.set("mode", MODE);
    formData.set("prompt", task.prompt);
    formData.set("ratio", task.channel.ratio || task.plan.aspect_ratio || "1:1");
    formData.set("size", "1024x1024");
    formData.set("format", "png");
    formData.set("clientSessionId", getSessionId());
    referenceFiles.forEach((file) => formData.append("referenceImages", file));
    appendCurrentConfig(formData);
    const response = await requestGenerationStream("/api/generate", {
      body: formData,
      clientSessionId: getSessionId(),
    });
    await consumeSse(response.body, async (eventName, payload) => {
      if (eventName === "final_image" && payload?.dataUrl) {
        output.dataUrl = payload.dataUrl;
        render();
      }
      if (eventName === "error") throw new Error(payload?.message || "图片生成失败。");
    });
    if (!output.dataUrl) throw new Error("生成连接结束，但没有收到图片。");
    output.status = "completed";
    setFeedback(`${task.space.label} · ${task.channel.label} · ${task.direction.label} 已生成。`, "success");
  } catch (error) {
    output.status = "failed";
    output.error = error instanceof Error ? error.message : String(error);
    setFeedback(output.error, "error");
  } finally {
    render();
  }
}

async function generateAll() {
  if (!state.tasks.length || state.generatingAll) return;
  state.generatingAll = true;
  setFeedback("正在按任务板顺序生成…", "busy");
  render();
  try {
    for (const task of state.tasks) {
      if (state.outputs.get(task.id)?.status === "completed") continue;
      await generateTask(task.id);
    }
    setFeedback("任务板已处理完成。", "success");
  } finally {
    state.generatingAll = false;
    render();
  }
}

async function copyTaskPrompt(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task?.prompt) return;
  try {
    await navigator.clipboard.writeText(task.prompt);
    setFeedback("本格生成指令已复制。", "success");
  } catch {
    setFeedback("复制失败，请展开任务卡手动选择。", "error");
  }
}

function resetRouting() {
  state.selectedSpaces = new Set(DEFAULT_SELECTION.spaces);
  state.selectedChannels = new Set(DEFAULT_SELECTION.channels);
  state.selectedDirections = new Set(DEFAULT_SELECTION.directions);
  rebuildTasks();
  render();
}

function handleRoutingChange(input) {
  const target = input.dataset.productAgentOption;
  const selection = target === "space" ? state.selectedSpaces : target === "channel" ? state.selectedChannels : state.selectedDirections;
  if (input.checked) selection.add(input.value);
  else selection.delete(input.value);
  rebuildTasks();
  render();
}

function bindEvents() {
  refs.input.addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  });
  refs.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.dropzone.classList.add("dragover");
  });
  refs.dropzone.addEventListener("dragleave", () => refs.dropzone.classList.remove("dragover"));
  refs.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.dropzone.classList.remove("dragover");
    addFiles(event.dataTransfer?.files);
  });
  refs.analyzeButton.addEventListener("click", analyze);
  refs.clearButton.addEventListener("click", clearFiles);
  refs.generateAllButton.addEventListener("click", generateAll);
  refs.resetRoutingButton.addEventListener("click", resetRouting);
  [refs.spaceOptions, refs.channelOptions, refs.directionOptions].forEach((container) => {
    container.addEventListener("change", (event) => {
      const input = event.target.closest("input[data-product-agent-option]");
      if (input) handleRoutingChange(input);
    });
  });
  refs.referenceGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-agent-remove]");
    if (!button) return;
    const index = Number(button.dataset.productAgentRemove);
    const entry = state.files[index];
    if (entry) URL.revokeObjectURL(entry.previewUrl);
    state.files.splice(index, 1);
    state.analysis = null;
    state.tasks = [];
    state.outputs.clear();
    render();
  });
  refs.planList.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-product-agent-copy]");
    if (copyButton) {
      copyTaskPrompt(copyButton.dataset.productAgentCopy);
      return;
    }
    const generateButton = event.target.closest("[data-product-agent-generate]");
    if (generateButton) generateTask(generateButton.dataset.productAgentGenerate);
  });
}

export function mountView(options = {}) {
  if (typeof options.appendCurrentConfigToFormData === "function") {
    appendCurrentConfig = options.appendCurrentConfigToFormData;
  }
  if (!mounted) {
    refs = getRefs();
    bindEvents();
    mounted = true;
  }
  render();
  return { loaded: true, renderView: render };
}
