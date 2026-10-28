import { consumeSse } from "./generation-client.mjs";

const fieldLabels = { summary: "摘要", title: "任务", name: "名称", need: "需求", text: "内容", marketing_goal: "购买问题", prompt: "画面", scene: "场景", action: "动作", framing: "景别", evidence_focus: "证据" };
const readingPanels = new Set();
const observedViews = new WeakSet();

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
  const width = Math.min(1440, available * (view.innerWidth > 760 ? 0.88 : 1));
  const left = Math.max(12, Math.min(view.innerWidth - width - 12, rect.left + (rect.width - width) / 2));
  const top = Math.max(72, Math.min(rect.top + 12, view.innerHeight - 260));
  panel.style.left = `${left}px`; panel.style.right = "auto";
  panel.style.top = `${top}px`; panel.style.bottom = "auto";
  panel.style.width = `${width}px`;
  panel.style.maxHeight = `${Math.min(view.innerHeight * 0.82, view.innerHeight - top - 16)}px`;
}

// 仅用于显示的字符串草稿；绝不修补 JSON 后作为可生成的最终计划。
export function textModelDraftText(source = "") {
  const input = String(source);
  if (!/^\s*[\[{]/.test(input)) return input;
  const rows = [];
  const pattern = /"(summary|title|name|need|text|marketing_goal|prompt|scene|action|framing|evidence_focus)"\s*:\s*"/g;
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
    if (value) rows.push(`${fieldLabels[match[1]]}：${value}`);
  }
  return rows.join("\n\n");
}

export function createTextModelPreview({ document = globalThis.document, panel, title = "模型实时输出" } = {}) {
  if (!document?.createElement) return { update() {}, finish() {} };
  const ownPanel = !panel;
  panel ||= document.createElement("details");
  if (ownPanel) {
    panel.className = "text-model-live-preview";
    panel.open = true;
    const summary = document.createElement("summary"); summary.textContent = `${title} · 点击收起`;
    const close = document.createElement("button"); close.type = "button"; close.textContent = "关闭";
    close.setAttribute("aria-label", "关闭实时输出");
    close.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); panel.remove(); });
    summary.append(close);
    panel.append(summary); document.body.append(panel);
  }
  const meta = document.createElement("p"); meta.className = "text-model-live-meta";
  const pre = document.createElement("pre"); pre.className = "text-model-live-draft";
  panel.append(meta, pre);
  let current = null;
  let timer = null;
  const flush = () => {
    timer = null;
    if (!current || !panel.isConnected) return;
    const scrollTop = panel.scrollTop;
    const elapsed = Number(current.elapsedMs) / 1000;
    meta.textContent = [current.purpose || title, current.requestId ? `请求 ${current.requestId.slice(0, 8)}` : "", current.attempt ? `第 ${current.attempt} 次` : "", Number.isFinite(current.firstTextMs) ? `首字 ${(current.firstTextMs / 1000).toFixed(1)} 秒` : "", Number.isFinite(elapsed) ? `${elapsed.toFixed(1)} 秒` : "", current.message || (current.stage === "receiving" ? "正在接收 · 待校验" : "等待模型")].filter(Boolean).join(" · ");
    if (current.text !== undefined) pre.textContent = textModelDraftText(current.text);
    panel.scrollTop = scrollTop;
  };
  return {
    update(event) { current = { ...current, ...event }; if (event.stage === "waiting") { current.text = ""; current.firstTextMs = undefined; pre.textContent = ""; } if (timer === null) timer = setTimeout(flush, 50); },
    finish(error) { if (timer !== null) clearTimeout(timer); flush(); meta.textContent += error ? ` · ${error.message}` : " · 已结束，完整结果以校验后内容为准"; if (ownPanel && !error) panel.remove(); },
  };
}

export async function requestTextModel(fetchImpl, url, init, { onProgress, title } = {}) {
  let preview;
  let failure;
  try {
    const response = await fetchImpl(url, { ...init, headers: { ...init.headers, Accept: "text/event-stream" } });
    if (!/text\/event-stream/i.test(response.headers?.get("content-type") || "")) return response;
    let payload;
    let failed = false;
    await consumeSse(response.body, async (event, data) => {
      if (init.signal?.aborted) throw init.signal.reason;
      if (event === "text_progress") { if (onProgress) onProgress(data); else { preview ||= createTextModelPreview({ title }); preview.update(data); } }
      if (event === "error") { payload = data; failed = true; }
      if (event === "complete") payload = data;
    });
    if (!payload) throw new Error("文本连接已中断，未收到完整结果。");
    if (failed) throw new Error(payload.message || "文本分析失败。");
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) { failure = error; throw error; }
  finally { preview?.finish(failure); }
}

const generationPreviews = new Map();
export function showTextModelProgress(event) {
  const key = event.requestId || event.purpose || "text";
  if (!generationPreviews.has(key)) generationPreviews.set(key, createTextModelPreview({ title: event.purpose || "文本规划" }));
  const view = generationPreviews.get(key);
  view.update(event);
  if (event.stage === "received" || event.stage === "buffered") { view.finish(); generationPreviews.delete(key); }
}
