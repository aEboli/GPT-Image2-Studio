import { consumeSse } from "./generation-client.mjs";

const fieldLabels = {
  summary: "摘要", product_name: "商品", category_hint: "类目", category_path: "类目路径", filename: "参考图", note: "观察",
  title: "任务", name: "名称", need: "需求", text: "内容", target_audience: "目标买家", context: "使用情境", purchase_trigger: "购买动机", objection: "购买顾虑",
  marketing_goal: "购买问题", prompt: "画面", scene: "场景", environment: "环境", action: "动作", framing: "景别", evidence_focus: "证据",
  core_buying_reason: "主购买理由", buyer_benefit: "买家收益", visual_evidence: "功能证据", new_information: "新增信息", effect_visual: "可见功能",
};
const readingPanels = new Set();
const observedViews = new WeakSet();
const floatingPreviews = new WeakMap();

export function getTextModelEventMetadata(event = {}) {
  const metadata = {};
  for (const key of ["batchId", "setId", "requestId", "stage", "errorKind", "code", "message"]) {
    if (typeof event?.[key] !== "string") continue;
    metadata[key] = event[key]
      .replace(/\b(?:sk-[A-Za-z0-9_-]+|Bearer\s+[^\s,;"}]+)/gi, "[已隐藏认证信息]")
      .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, "$1[已隐藏]")
      .slice(0, key === "message" ? 800 : 200);
  }
  for (const key of ["attempt", "elapsedMs", "firstTextMs", "retryAfterMs", "httpStatus"]) {
    if (Number.isFinite(event?.[key]) && event[key] >= 0) metadata[key] = event[key];
  }
  for (const key of ["stopBatch", "fatal"]) {
    if (typeof event?.[key] === "boolean") metadata[key] = event[key];
  }
  for (const [key, fields] of [
    ["timing", ["clientPrepareMs", "prepareMs", "queueMs", "headersMs", "firstByteMs", "firstTextMs", "lastTextMs", "receiveMs", "validationMs", "totalMs"]],
    ["usage", ["inputTokens", "outputTokens", "reasoningTokens", "totalTokens"]],
  ]) {
    if (event?.[key] && typeof event[key] === "object") {
      metadata[key] = Object.fromEntries(fields
        .filter((name) => Number.isFinite(event[key][name]) && event[key][name] >= 0)
        .map((name) => [name, event[key][name]]));
    }
  }
  return metadata;
}

export function createTextModelError(event, fallback = "文本分析失败。") {
  const metadata = getTextModelEventMetadata(event);
  return Object.assign(new Error(metadata.message || fallback), metadata);
}

export function fitCreationReadingPanel(panel) {
  const area = panel?.ownerDocument?.querySelector?.('.creation-output-panel');
  const rect = area?.getBoundingClientRect?.();
  const view = panel?.ownerDocument?.defaultView;
  if (!rect?.width || !view || !panel.style) return;
  readingPanels.add(panel);
  if (!observedViews.has(view)) {
    observedViews.add(view);
    view.addEventListener?.("resize", () => { for (const current of readingPanels) if (!current.hidden) fitCreationReadingPanel(current); });
  }
  const available = Math.min(rect.width, view.innerWidth - 24);
  const isAnalystPanel = panel.matches?.("#creationRecordDetail.creation-analyst-floating") === true;
  const isNarrowViewport = view.innerWidth <= 760;
  const width = isAnalystPanel
    ? (isNarrowViewport ? available : Math.min(560, available, Math.max(420, available * 0.42)))
    : Math.min(1440, available * (view.innerWidth > 760 ? 0.88 : 1));
  const targetLeft = isAnalystPanel && !isNarrowViewport ? rect.right - width : rect.left + (rect.width - width) / 2;
  const left = Math.max(12, Math.min(view.innerWidth - width - 12, targetLeft));
  const top = Math.max(72, Math.min(rect.top + 12, view.innerHeight - 260));
  panel.style.left = `${left}px`; panel.style.right = "auto";
  panel.style.top = `${top}px`; panel.style.bottom = "auto";
  panel.style.width = `${width}px`;
  panel.style.maxHeight = `${Math.min(view.innerHeight * 0.82, view.innerHeight - top - 16)}px`;
}

const creationProcessSteps = {
  analyst: ["准备参考图", "请求模型", "接收分析", "校验结果"],
  marketing: ["准备资料", "请求模型", "接收规划", "审核校验"],
};
const creationProcessStageIndexes = {
  preparing: 0,
  queued: 1, waiting: 1, connected: 1, cooldown: 1, retrying: 1,
  receiving: 2,
  received: 3, buffered: 3, validating: 3, reviewing: 3, repairing: 3,
};

export function createCreationProcessSteps({ document = globalThis.document, parent, kind = "analyst" } = {}) {
  if (!document?.createElement || !parent?.append) return { update() {} };
  const labels = creationProcessSteps[kind] || creationProcessSteps.analyst;
  const list = document.createElement("ol");
  list.className = "creation-process-steps";
  list.setAttribute("aria-label", kind === "marketing" ? "营销规划进度" : "参考图分析进度");
  const items = labels.map((label, index) => {
    const item = document.createElement("li");
    item.dataset ||= {};
    const marker = document.createElement("span");
    marker.className = "creation-process-step-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = String(index + 1);
    const name = document.createElement("span");
    name.className = "creation-process-step-label";
    name.textContent = label;
    item.append(marker, name);
    list.append(item);
    return { item, name, label };
  });
  parent.append(list);
  let activeIndex = -1;
  let previousAttempt = null;
  let previousRequestKey = "";

  return {
    element: list,
    update(stage, { attempt = 0, requestKey = "" } = {}) {
      const nextAttempt = Number(attempt) || 0;
      if ((requestKey && previousRequestKey && requestKey !== previousRequestKey)
        || (nextAttempt && previousAttempt && nextAttempt !== previousAttempt)
        || stage === "retrying") activeIndex = -1;
      if (requestKey) previousRequestKey = requestKey;
      if (nextAttempt) previousAttempt = nextAttempt;

      const reused = stage === "reused";
      const completed = ["finished", "complete", "partial"].includes(stage);
      const failed = ["error", "interrupted"].includes(stage);
      const stageIndex = creationProcessStageIndexes[stage];
      if (Number.isInteger(stageIndex)) activeIndex = Math.max(activeIndex, stageIndex);

      list.hidden = failed && activeIndex < 0;
      items.forEach(({ item, name, label }, index) => {
        item.hidden = reused && index > 0;
        name.textContent = reused && index === 0 ? "复用已确认计划" : label;
        const state = reused || completed ? "complete"
          : failed && index === activeIndex ? "error"
            : index < activeIndex ? "complete"
              : index === activeIndex ? "current" : "pending";
        item.dataset.state = state;
        if (state === "current" || state === "error") item.setAttribute("aria-current", "step");
        else item.removeAttribute?.("aria-current");
      });
    },
  };
}

// 仅用于显示的字符串草稿；绝不修补 JSON 后作为可生成的最终计划。
export function textModelDraftText(source = "") {
  const input = String(source);
  if (!/^\s*[\[{]/.test(input)) return input;
  return textModelDraftFields(input).map(({ key, value }) => `${fieldLabels[key]}：${value}`).join("\n\n");
}

function textModelDraftFields(input) {
  const rows = [];
  const pattern = new RegExp(`"(${Object.keys(fieldLabels).join("|")})"\\s*:\\s*"`, "g");
  let match;
  while ((match = pattern.exec(input))) {
    let value = "";
    for (let index = pattern.lastIndex; index < input.length; index += 1) {
      const char = input[index];
      if (char === '"') { pattern.lastIndex = index + 1; break; }
      if (char !== "\\") { value += char; continue; }
      const escape = input[++index];
      if (!escape) break;
      if (escape === "u") {
        const hex = input.slice(index + 1, index + 5);
        if (!/^[0-9a-f]{4}$/i.test(hex)) break;
        value += String.fromCharCode(parseInt(hex, 16)); index += 4;
      } else value += ({ n: "\n", r: "", t: "  " })[escape] ?? escape;
    }
    if (value) rows.push({ key: match[1], value });
  }
  return rows;
}

function createAnalysisDraftRenderer(document, root) {
  let fields = [];
  let group;
  let referenceCount = 0;
  let plain = false;
  return (source) => {
    const input = String(source);
    const next = /^\s*[\[{]/.test(input) ? textModelDraftFields(input) : [];
    if (plain || !next.length || fields.length > next.length || fields.some((field, index) => field.key !== next[index]?.key)) {
      root.textContent = next.length || /^\s*[\[{]/.test(input) ? "" : input;
      fields = []; group = undefined; referenceCount = 0;
    }
    plain = !next.length;
    next.forEach(({ key, value }, index) => {
      if (!fields[index]) {
        if (!group || key === "filename" || key !== "note" && group.isReference) {
          const node = document.createElement(key === "filename" ? "details" : "section");
          node.className = `text-model-analysis-group${key === "filename" ? " is-reference-group" : ""}`;
          root.append(node);
          group = { node, isReference: key === "filename" };
        }
        const row = document.createElement(key === "filename" ? "summary" : "div");
        row.className = `text-model-analysis-field${key === "filename" ? " is-reference" : key === "note" ? " is-observation" : ""}`;
        const label = document.createElement("span"); label.className = "text-model-analysis-label";
        label.textContent = key === "filename" ? `参考图 ${String(++referenceCount).padStart(2, "0")}` : fieldLabels[key];
        const content = document.createElement("span"); content.className = "text-model-analysis-value";
        row.append(label, content); group.node.append(row);
        fields.push({ key, content });
      }
      if (fields[index].content.textContent !== value) fields[index].content.textContent = value;
    });
  };
}

export function formatTextModelTiming({ timing = {}, usage = {} } = {}) {
  const values = [["clientPrepareMs", "图片准备"], ["prepareMs", "资料整理"], ["headersMs", "连接响应"], ["firstByteMs", "上游首包"], ["firstTextMs", "首段回答"], ["receiveMs", "回答接收"], ["validationMs", "校验"], ["totalMs", "总计"]]
    .filter(([key]) => Number.isFinite(timing[key]) && timing[key] >= 0)
    .map(([key, label]) => `${label} ${(timing[key] / 1000).toFixed(1)} 秒`);
  if (Number.isFinite(usage.outputTokens)) values.push(`输出 ${usage.outputTokens.toLocaleString()} token`);
  return values.join(" · ");
}

export function createTextModelPreview({ document = globalThis.document, panel, title = "模型实时输出", structured = false } = {}) {
  if (!document?.createElement || !panel && !document.body?.append) return { update() {}, finish() {} };
  const ownPanel = !panel;
  panel ||= document.createElement("details");
  let timer = null;
  let elapsedTimer = null;
  let dismissTimer = null;
  let disposed = false;
  let finished = false;
  const startedAt = Date.now();
  let elapsedOffsetMs = 0;
  const dispose = () => {
    disposed = true;
    if (timer !== null) clearTimeout(timer);
    if (elapsedTimer !== null) clearTimeout(elapsedTimer);
    if (dismissTimer !== null) clearTimeout(dismissTimer);
    panel.remove();
    if (floatingPreviews.get(document) === dispose) floatingPreviews.delete(document);
  };
  if (ownPanel) {
    // 并发请求共用一个浮层位置，替换展示不影响后台请求。
    floatingPreviews.get(document)?.();
    floatingPreviews.set(document, dispose);
    panel.className = "text-model-live-preview";
    panel.open = true;
    const summary = document.createElement("summary"); summary.textContent = `${title} · 点击收起`;
    const close = document.createElement("button"); close.type = "button"; close.textContent = "关闭";
    close.setAttribute("aria-label", "关闭实时输出");
    close.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); dispose(); });
    summary.append(close);
    panel.append(summary); document.body.append(panel);
  }
  const meta = document.createElement(structured ? "div" : "p"); meta.className = "text-model-live-meta";
  const timing = document.createElement(structured ? "details" : "p"); timing.className = "text-model-live-timing";
  const pre = document.createElement(structured ? "div" : "pre"); pre.className = "text-model-live-draft";
  const renderDraft = structured ? createAnalysisDraftRenderer(document, pre) : (text) => { pre.textContent = textModelDraftText(text); };
  let status, elapsedLabel, detail, message, failure, process;
  if (structured) {
    meta.className += " is-structured";
    timing.className += " is-structured";
    pre.className += " is-structured";
    [status, elapsedLabel, detail, message] = ["status", "elapsed", "detail", "message"].map((name) => {
      const node = document.createElement("span"); node.className = `text-model-analysis-${name}`; meta.append(node); return node;
    });
    status.setAttribute("role", "status");
    process = createCreationProcessSteps({ document, parent: meta });
  }
  panel.append(meta, timing, pre);
  let current = {};
  let renderedText;
  let renderedTiming;
  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (disposed || !current || !panel.isConnected) return;
    const scrollTop = panel.scrollTop;
    const elapsed = (ownPanel ? Math.max(0, Date.now() - startedAt) + elapsedOffsetMs : Number(current.elapsedMs) || 0) / 1000;
    const stageMessage = {
      queued: "正在排队", cooldown: "限流冷却中", waiting: "等待模型",
      connected: "已连接，等待回答文本", receiving: "正在接收 · 待校验", received: "已接收，正在校验",
    }[current.stage] || "等待模型";
    const retryAfterMs = Math.max(0, (current.retryAfterMs || 0) - (Date.now() - retryObservedAt));
    if (structured) {
      const stage = failure ? "error" : finished ? "finished" : current.stage || "waiting";
      status.textContent = { preparing: "准备参考图", waiting: "等待模型", connected: "等待回答", receiving: "正在识别 · 待校验", received: "正在校验", buffered: "正在校验", queued: "正在排队", cooldown: "限流冷却中", finished: "接收结束", error: "识别中断", interrupted: "识别中断" }[stage] || stageMessage;
      status.setAttribute("data-stage", stage);
      process.update(stage, { attempt: current.attempt, requestKey: current.requestId });
      elapsedLabel.textContent = `已用时 ${elapsed.toFixed(1)} 秒`;
      const receivedCharacters = Number(current.receivedCharacters) || current.text?.length || 0;
      detail.textContent = [receivedCharacters ? `已接收 ${receivedCharacters.toLocaleString()} 字符` : "", current.attempt > 1 ? `第 ${current.attempt} 次请求` : ""].filter(Boolean).join(" · ");
      detail.hidden = !detail.textContent;
      message.textContent = failure ? failure.message : finished ? "已结束，完整结果以校验后内容为准。" : current.stage === "receiving" ? "内容实时更新，识别结果待校验。" : current.stage === "cooldown" && retryAfterMs ? `约 ${Math.ceil(retryAfterMs / 1000)} 秒后重试。` : current.message || "";
      message.hidden = !message.textContent;
    } else {
      meta.textContent = [current.purpose || title, current.requestId ? `请求 ${current.requestId.slice(0, 8)}` : "", current.attempt ? `第 ${current.attempt} 次` : "", current.requestedReasoningEffort ? `思考 ${current.requestedReasoningEffort} → ${current.actualReasoningEffort ?? "省略参数"}` : "", Number.isFinite(current.firstTextMs) ? `首字 ${(current.firstTextMs / 1000).toFixed(1)} 秒` : "", `${elapsed.toFixed(1)} 秒`, stageMessage, current.stage === "cooldown" && retryAfterMs ? `约 ${Math.ceil(retryAfterMs / 1000)} 秒后重试` : "", current.message].filter(Boolean).join(" · ");
    }
    const timingText = formatTextModelTiming(current);
    const timingDetail = [current.requestId ? `请求 ${current.requestId.slice(0, 8)}` : "", current.attempt ? `第 ${current.attempt} 次` : "", timingText].filter(Boolean).join(" · ");
    if (structured && timingDetail !== renderedTiming) {
      timing.textContent = "";
      const summary = document.createElement("summary"); summary.textContent = "请求详情"; timing.append(summary);
      for (const value of timingDetail.split(" · ").filter(Boolean)) {
        const item = document.createElement("span"); item.textContent = value; timing.append(item);
      }
      renderedTiming = timingDetail;
    } else if (!structured) timing.textContent = timingText;
    timing.hidden = structured ? !timingDetail : !timingText;
    if (current.text !== undefined && current.text !== renderedText) {
      renderDraft(current.text);
      renderedText = current.text;
    }
    panel.scrollTop = scrollTop;
  };
  let retryObservedAt = startedAt;
  const tick = () => {
    elapsedTimer = null;
    if (disposed || finished || !panel.isConnected) return;
    flush();
    elapsedTimer = setTimeout(tick, 1000);
    elapsedTimer.unref?.();
  };
  if (ownPanel) {
    elapsedTimer = setTimeout(tick, 1000);
    elapsedTimer.unref?.();
  }
  return {
    update(event) {
      if (disposed || finished) return;
      const localElapsedMs = Math.max(0, Date.now() - startedAt);
      if (Number.isFinite(event.elapsedMs)) elapsedOffsetMs = Math.max(elapsedOffsetMs, event.elapsedMs - localElapsedMs);
      current = { ...current, ...event };
      if (event.retryAfterMs !== undefined) retryObservedAt = Date.now();
      if (event.stage === "waiting") { current.text = ""; current.firstTextMs = undefined; current.usage = undefined; if (renderedText !== "") { renderDraft(""); renderedText = ""; } }
      if (timer === null) timer = setTimeout(flush, 50);
    },
    finish(error) {
      if (disposed || finished) return;
      finished = true;
      if (timer !== null) clearTimeout(timer);
      if (elapsedTimer !== null) clearTimeout(elapsedTimer);
      failure = error;
      flush();
      if (!structured) meta.textContent += error ? ` · ${error.message}` : " · 已结束，完整结果以校验后内容为准";
      if (ownPanel) {
        if (error) dismissTimer = setTimeout(dispose, 5000);
        else dispose();
      }
    },
  };
}

export async function requestTextModel(fetchImpl, url, init, { onProgress, title, showPreview = !onProgress } = {}) {
  const preview = showPreview ? createTextModelPreview({ title }) : undefined;
  let failure;
  try {
    const response = await fetchImpl(url, { ...init, headers: { ...init.headers, Accept: "text/event-stream" } });
    if (!/text\/event-stream/i.test(response.headers?.get("content-type") || "")) return response;
    let payload;
    let metadata = {};
    const reader = response.body.getReader();
    try {
      await consumeSse({ getReader: () => reader }, async (event, data) => {
        if (init.signal?.aborted) throw init.signal.reason;
        if (event === "text_progress") {
          metadata = { ...metadata, ...getTextModelEventMetadata(data) };
          onProgress?.(data);
          preview?.update(data);
        }
        if (event === "error") throw createTextModelError({ ...metadata, ...getTextModelEventMetadata(data) });
        if (event === "complete") payload = data;
      });
    } catch (error) {
      void reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    if (!payload) throw new Error("文本连接已中断，未收到完整结果。");
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) { failure = error; throw error; }
  finally { preview?.finish(failure); }
}

const generationPreviews = new Map();
export function showTextModelProgress(event) {
  const key = event.requestId || event.purpose || "text";
  const failed = event.stage === "error" || event.stage === "interrupted";
  const terminal = failed || event.stage === "received" || event.stage === "buffered";
  if (terminal && !generationPreviews.has(key)) return;
  if (!generationPreviews.has(key)) generationPreviews.set(key, createTextModelPreview({ title: event.purpose || "文本规划" }));
  const view = generationPreviews.get(key);
  view.update(event);
  if (terminal) { view.finish(failed ? new Error(event.message || "文本请求已结束。") : undefined); generationPreviews.delete(key); }
}
